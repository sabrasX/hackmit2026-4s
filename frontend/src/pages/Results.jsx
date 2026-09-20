import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import DoodleBackground from '../components/DoodleBackground.jsx'
import StruggleChart from '../components/StruggleChart.jsx'
import CalmStressChart, { calmBaseline } from '../components/CalmStressChart.jsx'

export default function Results() {
  const navigate = useNavigate()

  const session = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('lastSession')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  // Real Arduino samples land in session.sensorSamples; calm is the fallback.
  const sensorSamples = useMemo(
    () => session?.sensorSamples?.length ? session.sensorSamples : calmBaseline(session?.words),
    [session],
  )

  const score = session?.overallScore ?? 100
  const message =
    score < 35
      ? 'Amazing work! You stayed calm the whole time!'
      : score < 60
        ? 'Nice job! You did really well!'
        : 'Good effort! Practice makes perfect!'

  useEffect(() => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#5D94D6', '#FF85A2', '#FADBB6', '#4ABFFF', '#6BCB77'],
    })
  }, [])

  if (!session) {
    return (
      <DoodleBackground>
        <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
          <p className="text-lg text-slate-500">No session found.</p>
          <button type="button" onClick={() => navigate('/dashboard')} className="btn-primary">
            Back to Dashboard
          </button>
        </main>
      </DoodleBackground>
    )
  }

  return (
    <DoodleBackground>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="card-doodle p-8 sm:p-10">
          <div className="text-center">
            <span className="text-6xl" aria-hidden="true">🏆</span>
            <h1 className="font-display mt-4 text-4xl font-bold text-sky-700">Session Complete!</h1>
            <p className="mt-3 text-xl text-slate-600">{message}</p>
          </div>

          <div className="mb-8 mt-8">
            <h2 className="font-display mb-4 text-xl font-bold text-sky-700">Your words</h2>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <StruggleChart words={session.words} />
              </div>
              <div className="card-doodle shrink-0 px-6 py-5 text-center sm:w-44">
                <p className="text-sm font-semibold text-slate-500">Total struggle score</p>
                <p className="font-display mt-2 text-5xl font-bold text-sky-700">
                  {session.overallScore}
                </p>
                <p className="mt-1 text-sm text-slate-400">out of 100</p>
                <p className="mt-3 text-xs text-slate-400">Lower is better</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-display mb-4 text-xl font-bold text-sky-700">Calm vs stressed</h2>
            <CalmStressChart samples={sensorSamples} />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => navigate('/write')} className="btn-primary">
              Practice Again
            </button>
            <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary">
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    </DoodleBackground>
  )
}
