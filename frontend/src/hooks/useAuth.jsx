// TODO: onAuthStateChanged -> load users/{uid} for the student's name
// - login() = signInWithEmailAndPassword, logout() = signOut
// - Create 2-3 demo student accounts in the Firebase console
import { createContext, useContext, useEffect, useState } from 'react'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase.js'

const AuthContext = createContext(null)

// Firebase's own error messages are written for developers, not kids or
// parents at a demo table - map the common ones to something friendlier.
const FRIENDLY_LOGIN_ERRORS = {
  'auth/invalid-email': "That username doesn't look right.",
  'auth/user-not-found': "We couldn't find that account.",
  'auth/wrong-password': 'That password is not quite right.',
  'auth/invalid-credential': "That username or password isn't right.",
  'auth/too-many-requests': 'Too many tries - please wait a moment and try again.',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }

      let name = firebaseUser.email
      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (snap.exists()) name = snap.data().name ?? name
      } catch {
        // Fall back to the email above if the profile doc can't be read.
      }

      setUser({ uid: firebaseUser.uid, email: firebaseUser.email, name })
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      console.error('Login error:', err.code, err.message)
      throw new Error(FRIENDLY_LOGIN_ERRORS[err.code] ?? `Login failed: ${err.code || err.message}`)
    }
  }

  const logout = async () => {
    await signOut(auth)
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
