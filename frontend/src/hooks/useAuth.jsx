// TODO: onAuthStateChanged -> load users/{uid} for the student's name
// - login() = signInWithEmailAndPassword, logout() = signOut
// - Create 2-3 demo student accounts in the Firebase console
import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)

  const login = async (email, password) => {}
  const logout = async () => setUser(null)

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
