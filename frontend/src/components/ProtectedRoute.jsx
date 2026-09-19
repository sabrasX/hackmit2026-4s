import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import LoadingScreen from './LoadingScreen.jsx'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return children
}
