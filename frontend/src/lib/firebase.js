// TODO: implement saveSession, getSessions, getUserProfile (collections listed in firebase/firestore.rules)
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc } from 'firebase/firestore'

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const db = getFirestore(app)

// Save a completed writing session to Firestore
export async function saveSession(userId, words, overallScore) {
  const session = {
    studentId: userId,
    date: new Date(),
    words,
    overallScore,
  }
  const docRef = await addDoc(collection(db, 'sessions'), session)
  return docRef.id
}

// Fetch all sessions for a student
export async function getSessions(userId) {
  const q = query(collection(db, 'sessions'), where('studentId', '==', userId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

// Get a student's profile (name, etc)
export async function getUserProfile(userId) {
  const docRef = doc(db, 'users', userId)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) return docSnap.data()
  return null
}

