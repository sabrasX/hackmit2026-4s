// TODO: Login page
// - Username/password fields + big "Log In" button; call login() from useAuth
// - On success go to /dashboard; friendly message on failure
// NOTE: This is a bare-bones functional test form with NO styling.
// The frontend teammate will add Tailwind + design later.
// Fields are pre-filled with a demo account for quick testing - remove before the real demo.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

// Minimal inline styles so the form reads as a form during testing -
// still not the real design, just enough to tell fields from buttons.
const inputStyle = {
  padding: '0.5rem 0.75rem',
  fontSize: '1rem',
  border: '1px solid #94a3b8',
  borderRadius: '6px',
  backgroundColor: '#f1f5f9',
  color: '#0f172a',
  width: '220px',
}

const buttonStyle = {
  padding: '0.5rem 1.5rem',
  fontSize: '1rem',
  border: 'none',
  borderRadius: '6px',
  backgroundColor: '#2563eb',
  color: 'white',
  cursor: 'pointer',
}

export default function Login() {
  const [email, setEmail] = useState('student1@demo.com')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
      }}
    >
      <h1>Login</h1>
      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}
      >
        <input
          type="text"
          name="username"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Username"
          disabled={loading}
          style={inputStyle}
        />

        <input
          type="text"
          name="password"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          disabled={loading}
          style={inputStyle}
        />

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>

        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </main>
  )
}
