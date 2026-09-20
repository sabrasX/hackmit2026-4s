import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DoodleBackground from '../components/DoodleBackground.jsx'
import ActivityCard from '../components/ActivityCard.jsx'
import PastSessions from '../components/PastSessions.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { getSessions } from '../lib/firebase.js'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState(null)

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    getSessions(user.uid)
      .then((rows) => {
        if (!cancelled) setSessions(rows)
      })
      .catch(() => {
        if (!cancelled) setSessions([])
      })
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <DoodleBackground>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold text-sky-700 sm:text-5xl">
              Hi {user?.name}! 👋
            </h1>
            <p className="mt-2 text-lg text-slate-500">What would you like to practice today?</p>
          </div>
          <button type="button" onClick={logout} className="btn-secondary text-base">
            Log Out
          </button>
        </header>

        <div className="grid gap-6 sm:grid-cols-1">
          <ActivityCard
            title="Start Writing Session"
            icon="📝"
            description="Practice writing words with a little help when you need it"
            onClick={() => navigate('/write')}
          />
          <ActivityCard
            title="Coloring"
            icon="🎨"
            description="Color fun pictures"
            disabled
          />
          <ActivityCard
            title="Tracing"
            icon="✍️"
            description="Trace letters and shapes"
            disabled
          />
        </div>

        <PastSessions sessions={sessions} />
      </main>
    </DoodleBackground>
  )
}
