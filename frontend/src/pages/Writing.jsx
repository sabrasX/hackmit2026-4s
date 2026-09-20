import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DoodleBackground from '../components/DoodleBackground.jsx'
import WordDisplay from '../components/WordDisplay.jsx'
import SupportBanner from '../components/SupportBanner.jsx'
import TickButton from '../components/TickButton.jsx'
import CameraPreview from '../components/CameraPreview.jsx'
import { useVisionStream } from '../hooks/useVisionStream.js'
import { useHeartMonitor } from '../hooks/useHeartMonitor.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { createScorer, paceFromSessions } from '../lib/scoring.js'
import { applyStressToWords, summarise, toChartSamples } from '../lib/heart.js'
import { speak } from '../lib/speech.js'
import { saveSession, getSessions, getLesson } from '../lib/firebase.js'
import { DEFAULT_LESSON, CALIBRATION_TIMEOUT_S } from '../config.js'

const STEPS = { intro: 'intro', calibrating: 'calibrating', writing: 'writing', done: 'done' }

export default function Writing() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { status, connected, send } = useVisionStream()
  const scorerRef = useRef(createScorer())
  const [step, setStep] = useState(STEPS.intro)
  const [wordIndex, setWordIndex] = useState(0)
  const [supportLevel, setSupportLevel] = useState(0)
  const [, forceUpdate] = useState(0)
  // This child's own writing pace, learned from their past sessions, so a
  // slow writer isn't marked as struggling for writing at their normal speed.
  const [pace, setPace] = useState(null)
  // Which sentence to practise and the tutorial video for each of its words.
  const [lesson, setLesson] = useState(DEFAULT_LESSON)
  const [calibrationLeft, setCalibrationLeft] = useState(CALIBRATION_TIMEOUT_S)
  const sessionStartRef = useRef(null)

  // Heart samples are collected quietly through the session and only reported
  // at the end - nothing about the sensor is shown while the child is writing.
  const heart = useHeartMonitor({ collecting: step === STEPS.writing })

  const words = lesson.words
  const currentWord = words[wordIndex]?.word
  const currentVideo = words[wordIndex]?.video

  useEffect(() => {
    let cancelled = false
    getLesson()
      .then((l) => {
        if (!cancelled) setLesson(l)
      })
      .catch(() => {
        // Firestore unavailable - DEFAULT_LESSON from config.js is used.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    getSessions(user.uid)
      .then((sessions) => {
        if (!cancelled) setPace(paceFromSessions(sessions))
      })
      .catch(() => {
        // No history available - the default pace in config.js is used.
      })
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (step !== STEPS.writing) return
    if (!status) return

    scorerRef.current.addStatus(status)
    setSupportLevel(scorerRef.current.supportLevel())
    forceUpdate((n) => n + 1)
  }, [status, step])

  const beginWriting = useCallback(() => {
    sessionStartRef.current = Date.now()
    heart.resetSamples()
    setStep(STEPS.writing)
    scorerRef.current.startWord(words[0].word)
    send({ type: 'reset' })
    speak(words[0].word)
  }, [heart, words, send])

  // Wait on the heart monitor's baseline before the first word, but never let a
  // missing or slow sensor block the session - the countdown starts it anyway.
  useEffect(() => {
    if (step !== STEPS.calibrating) return

    if (heart.ready) {
      beginWriting()
      return
    }

    const timer = setInterval(() => {
      setCalibrationLeft((left) => {
        if (left <= 1) {
          clearInterval(timer)
          beginWriting()
          return 0
        }
        return left - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [step, heart.ready, beginWriting])

  const finishWord = useCallback(() => {
    scorerRef.current.finishWord()
    const next = wordIndex + 1

    if (next >= words.length) {
      setStep(STEPS.done)

      // Fold the heart monitor in once, at the end: it adjusts each word's score
      // and supplies the calm/stressed trace. With no board the words are
      // returned untouched and the summary is null.
      const heartSamples = heart.takeSamples()
      const scored = applyStressToWords(scorerRef.current.getWords(), heartSamples)
      const overallScore = scored.length
        ? Math.round(scored.reduce((sum, w) => sum + w.score, 0) / scored.length)
        : 0
      const heartSummary = summarise(heartSamples)
      const sensorSamples = toChartSamples(heartSamples, sessionStartRef.current)

      sessionStorage.setItem(
        'lastSession',
        JSON.stringify({
          words: scored,
          overallScore,
          sentence: lesson.sentence,
          heart: heartSummary,
          sensorSamples,
        }),
      )
      if (user?.uid) {
        saveSession(user.uid, { words: scored, overallScore, heart: heartSummary }).catch(() => {})
      }
      setTimeout(() => navigate('/results'), 800)
      return
    }

    setWordIndex(next)
    scorerRef.current.startWord(words[next].word)
    send({ type: 'reset' })
    speak(words[next].word)
    setSupportLevel(0)
  }, [wordIndex, navigate, send, user, words, lesson, heart])

  const startSession = () => {
    scorerRef.current = createScorer({ secondsPerLetter: pace })
    setWordIndex(0)
    setSupportLevel(0)
    setCalibrationLeft(CALIBRATION_TIMEOUT_S)
    setStep(STEPS.calibrating)
  }

  return (
    <DoodleBackground>
      <main className="mx-auto flex min-h-dvh max-w-7xl flex-col px-6 py-6">
        <header className="mb-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="font-semibold text-sky-600 hover:underline"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-300'}`}
              aria-hidden="true"
            />
            {connected ? 'Camera connected' : 'Connecting camera…'}
          </div>
        </header>

        {step === STEPS.intro && (
          <div className="card-doodle flex flex-1 flex-col items-center justify-center gap-8 p-10 text-center">
            <img src="/rabbit.png" alt="" className="h-40 w-40 object-contain animate-bounce-gentle" />
            <div>
              <h1 className="font-display text-3xl font-bold text-sky-700 sm:text-4xl">
                Writing Practice
              </h1>
              <p className="mt-4 text-lg text-slate-500">
                You&apos;ll write: <strong className="text-sky-700">{lesson.sentence}</strong>
              </p>
              <p className="mt-2 text-slate-400">One word at a time - take your time!</p>
            </div>
            <button type="button" onClick={startSession} className="btn-primary">
              Let&apos;s Go!
            </button>
          </div>
        )}

        {step === STEPS.calibrating && (
          <div className="card-doodle flex flex-1 flex-col items-center justify-center gap-6 p-10 text-center">
            <div
              className="h-16 w-16 animate-spin rounded-full border-4 border-slate-200"
              style={{ borderTopColor: 'var(--color-sky)' }}
              aria-hidden="true"
            />
            <div>
              <h2 className="font-display text-3xl font-bold text-sky-700">Getting ready…</h2>
              <p className="mt-3 text-lg text-slate-500">
                {heart.connected
                  ? 'Rest your finger on the sensor and stay still for a moment.'
                  : 'Setting up your writing session.'}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Starting in {calibrationLeft}s
              </p>
            </div>
            <button type="button" onClick={beginWriting} className="btn-secondary">
              Skip and start now
            </button>
          </div>
        )}

        {step === STEPS.writing && (
          <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1fr_minmax(0,34rem)]">
            <div className="flex flex-col items-center gap-6">
              <WordDisplay word={currentWord} index={wordIndex} total={words.length} />

              <SupportBanner level={supportLevel} word={currentWord} video={currentVideo} />

              <p className="text-slate-500">Tap the check when you finish this word</p>
              <TickButton onClick={finishWord} />
            </div>

            <CameraPreview
              status={status}
              rollingScore={scorerRef.current.rollingScore()}
              connected={connected}
            />
          </div>
        )}

        {step === STEPS.done && (
          <div className="card-doodle flex flex-1 flex-col items-center justify-center gap-6 p-10 text-center">
            <span className="text-7xl animate-bounce-gentle" aria-hidden="true">🎉</span>
            <h2 className="font-display text-3xl font-bold text-sky-700">Great job!</h2>
            <p className="text-lg text-slate-500">Taking you to your results…</p>
          </div>
        )}
      </main>
    </DoodleBackground>
  )
}
