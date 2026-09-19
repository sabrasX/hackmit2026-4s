import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DoodleBackground from '../components/DoodleBackground.jsx'
import LoadingScreen from '../components/LoadingScreen.jsx'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Login() {
  const { login, loading, user, isDemo } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  if (loading) return <LoadingScreen />
  if (user) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      setError('Oops! That email or password did not work. Try again!')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DoodleBackground>
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
        <div className="card-doodle w-full max-w-md p-8 sm:p-10">
          <div className="mb-8 text-center">
            <div className="mb-4 text-6xl animate-wiggle" aria-hidden="true">
              ✏️
            </div>
            <h1 className="font-display text-4xl font-bold text-sky-700">The Pen Pal</h1>
            <p className="mt-3 text-lg text-slate-500">Learning made fun!</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="font-semibold text-slate-600">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-doodle"
                placeholder="you@school.com"
                required
                autoComplete="username"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="font-semibold text-slate-600">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-doodle"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-red-600" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary mt-2 w-full" disabled={submitting}>
              {submitting ? 'Logging in…' : 'Log In'}
            </button>
          </form>

          {isDemo && (
            <p className="mt-6 text-center text-sm text-slate-400">
              Demo mode — any email &amp; password works
            </p>
          )}
        </div>
      </main>
    </DoodleBackground>
  )
}
