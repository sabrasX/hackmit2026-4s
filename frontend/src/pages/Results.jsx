import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import DoodleBackground from '../components/DoodleBackground.jsx'
import StruggleChart from '../components/StruggleChart.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { loadLastSession } from '../lib/sessionStore.js'

function scoreToStars(overall) {
  if (overall < 35) return 3
  if (overall < 60) return 2
  return 1
}

function StarRating({ count }) {
  return (
    <div className="flex justify-center gap-2 text-5xl" aria-label={`${count} out of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= count ? 'animate-bounce-gentle' : 'opacity-25'} aria-hidden="true">
          ⭐
        </span>
      ))}
    </div>
  )
}

export default function Results() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const session = useMemo(() => loadLastSession(user?.uid), [user?.uid])

  const stars = session ? scoreToStars(session.overallScore) : 0
  const message =
    stars >= 3
      ? 'Amazing work! You stayed calm the whole time!'
      : stars >= 2
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
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="card-doodle p-8 sm:p-10">
          <div className="text-center">
            <span className="text-6xl" aria-hidden="true">🏆</span>
            <h1 className="font-display mt-4 text-4xl font-bold text-sky-700">Session Complete!</h1>
            <p className="mt-3 text-xl text-slate-600">{message}</p>
          </div>

          <div className="my-8">
            <StarRating count={stars} />
            <p className="mt-3 text-center text-sm text-slate-400">
              More stars = less struggle detected
            </p>
          </div>

          <div className="mb-8">
            <h2 className="font-display mb-4 text-xl font-bold text-sky-700">Your words</h2>
            <StruggleChart words={session.words} />
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
