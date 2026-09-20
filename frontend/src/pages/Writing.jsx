import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DoodleBackground from '../components/DoodleBackground.jsx'
import WordDisplay from '../components/WordDisplay.jsx'
import SupportBanner from '../components/SupportBanner.jsx'
import TickButton from '../components/TickButton.jsx'
import ReferenceVideoPopup from '../components/ReferenceVideoPopup.jsx'
import { useVisionStream } from '../hooks/useVisionStream.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { createScorer } from '../lib/scoring.js'
import { speak } from '../lib/speech.js'
import { saveSession } from '../lib/firebase.js'
import { saveLastSession } from '../lib/sessionStore.js'
import { WORDS, CALIBRATION_SECONDS, SENTENCE, VIDEO_SUPPORT_LEVEL } from '../config.js'

function defaultVideoSrc(word) {
  return `${import.meta.env.BASE_URL}videos/${word.toLowerCase()}.mp4`
}

const STEPS = { intro: 'intro', calibrating: 'calibrating', writing: 'writing', done: 'done' }

export default function Writing() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { status, connected, send, isMock } = useVisionStream()
  const scorerRef = useRef(createScorer())
  const [step, setStep] = useState(STEPS.intro)
  const [wordIndex, setWordIndex] = useState(0)
  const [supportLevel, setSupportLevel] = useState(0)
  const [calibrationLeft, setCalibrationLeft] = useState(CALIBRATION_SECONDS)
  const [liveScore, setLiveScore] = useState(0)
  const [videoDismissed, setVideoDismissed] = useState(false)
  const [videos, setVideos] = useState({})

  const currentWord = WORDS[wordIndex]
  const showVideo = supportLevel >= VIDEO_SUPPORT_LEVEL && !videoDismissed

  useEffect(() => {
    if (step !== STEPS.calibrating && step !== STEPS.writing) return
    if (!status) return

    scorerRef.current.addStatus(status)
    setSupportLevel(scorerRef.current.supportLevel())
    setLiveScore(scorerRef.current.rollingScore())
  }, [status, step])

  useEffect(() => {
    if (step !== STEPS.calibrating) return

    scorerRef.current.startCalibration()
    const interval = setInterval(() => {
      setCalibrationLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          scorerRef.current.endCalibration()
          scorerRef.current.startWord(WORDS[0])
          send({ type: 'reset' })
          speak(WORDS[0])
          setStep(STEPS.writing)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [step, send])

  const finishWord = useCallback(() => {
    scorerRef.current.finishWord()
    const next = wordIndex + 1

    if (next >= WORDS.length) {
      setStep(STEPS.done)
      const words = scorerRef.current.getWords()
      const overallScore = scorerRef.current.overall()
      saveLastSession(user?.uid, { words, overallScore, sentence: SENTENCE })
      if (user?.uid) {
        saveSession(user.uid, { words, overallScore }).catch(() => {})
      }
      setTimeout(() => navigate('/results'), 800)
      return
    }

    setWordIndex(next)
    scorerRef.current.startWord(WORDS[next])
    send({ type: 'reset' })
    speak(WORDS[next])
    setSupportLevel(0)
    setVideoDismissed(false)
  }, [wordIndex, navigate, send, user])

  const startSession = () => {
    scorerRef.current = createScorer()
    setWordIndex(0)
    setCalibrationLeft(CALIBRATION_SECONDS)
    setVideoDismissed(false)
    setStep(STEPS.calibrating)
    speak('Write anything you like for a few seconds to get started!')
  }

  return (
    <DoodleBackground>
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-10">
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
            {connected ? (isMock ? 'Demo camera' : 'Camera connected') : 'Connecting camera…'}
            {step === STEPS.writing && (
              <span className="ml-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                Struggle {liveScore}/100
              </span>
            )}
          </div>
        </header>

        {step === STEPS.intro && (
          <div className="card-doodle flex flex-1 flex-col items-center justify-center gap-8 p-10 text-center">
            <span className="text-7xl" aria-hidden="true">📝</span>
            <div>
              <h1 className="font-display text-3xl font-bold text-sky-700 sm:text-4xl">
                Writing Practice
              </h1>
              <p className="mt-4 text-lg text-slate-500">
                You&apos;ll write: <strong className="text-sky-700">{SENTENCE}</strong>
              </p>
              <p className="mt-2 text-slate-400">
                First we&apos;ll do a quick {CALIBRATION_SECONDS}-second warm-up, then one word at a time.
              </p>
            </div>
            <button type="button" onClick={startSession} className="btn-primary">
              Let&apos;s Go!
            </button>
          </div>
        )}

        {step === STEPS.calibrating && (
          <div className="card-doodle flex flex-1 flex-col items-center justify-center gap-6 p-10 text-center">
            <span className="text-6xl animate-bounce-gentle" aria-hidden="true">✋</span>
            <h2 className="font-display text-3xl font-bold text-sky-700">Warm-up time!</h2>
            <p className="text-lg text-slate-500">
              Write anything on your paper for{' '}
              <strong className="text-2xl text-sky-600">{calibrationLeft}</strong> seconds
            </p>
            <div className="h-3 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${((CALIBRATION_SECONDS - calibrationLeft) / CALIBRATION_SECONDS) * 100}%`,
                  background: 'var(--color-sky)',
                }}
              />
            </div>
          </div>
        )}

        {step === STEPS.writing && (
          <div className="flex flex-1 flex-col gap-8">
            <WordDisplay word={currentWord} index={wordIndex} total={WORDS.length} />

            <SupportBanner level={supportLevel} word={currentWord} />

            <div className="mt-auto flex flex-col items-center gap-4 pb-8">
              <p className="text-slate-500">Tap the check when you finish this word</p>
              <TickButton onClick={finishWord} />
            </div>

            {showVideo && (
              <ReferenceVideoPopup
                word={currentWord}
                src={videos[currentWord] || defaultVideoSrc(currentWord)}
                onPick={(word, src) => setVideos((prev) => ({ ...prev, [word]: src }))}
                onClose={() => setVideoDismissed(true)}
              />
            )}
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
