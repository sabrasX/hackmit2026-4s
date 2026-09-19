import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, getUserProfile, isFirebaseConfigured } from '../lib/firebase.js'

const AuthContext = createContext(null)
const DEMO_KEY = 'the-pen-pal-demo-user'

function loadDemoUser() {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveDemoUser(user) {
  if (user) localStorage.setItem(DEMO_KEY, JSON.stringify(user))
  else localStorage.removeItem(DEMO_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setUser(loadDemoUser())
      setLoading(false)
      return
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }
      const profile = await getUserProfile(firebaseUser.uid)
      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: profile?.name || firebaseUser.email?.split('@')[0] || 'Friend',
      })
      setLoading(false)
    })
    return unsub
  }, [])

  const login = async (email, password) => {
    if (!isFirebaseConfigured) {
      const demoUser = { uid: 'demo', email, name: email.split('@')[0] || 'Student' }
      saveDemoUser(demoUser)
      setUser(demoUser)
      return
    }
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const profile = await getUserProfile(cred.user.uid)
    setUser({
      uid: cred.user.uid,
      email: cred.user.email,
      name: profile?.name || cred.user.email?.split('@')[0] || 'Friend',
    })
  }

  const logout = async () => {
    if (isFirebaseConfigured) await signOut(auth)
    else saveDemoUser(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isDemo: !isFirebaseConfigured }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
