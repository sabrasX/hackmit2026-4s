// TODO: Student dashboard
// - "Hi {name}!" greeting + Log Out button
// - <ActivityCard>s: "Start Writing Session" -> /write; Coloring/Tracing greyed out "Coming soon"
// NOTE: This is a bare-bones functional test page with NO styling.
// The frontend teammate will add Tailwind + design later.

import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <main>
      <h1>Dashboard</h1>
      {user && <p>Hi, {user.name}!</p>}

      <button onClick={() => navigate('/write')}>Start Writing Session</button>

      <p style={{ opacity: 0.5 }}>Coloring (Coming soon)</p>
      <p style={{ opacity: 0.5 }}>Tracing (Coming soon)</p>

      <button onClick={handleLogout} style={{ marginTop: '2em' }}>
        Log Out
      </button>
    </main>
  )
}
