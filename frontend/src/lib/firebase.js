import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, doc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { DEFAULT_LESSON } from '../config.js'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let app = null
let auth = null
let db = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
}

export { auth, db }

/**
 * A lesson: the sentence to practise plus, per word, the URL of its tutorial
 * video. Stored in Firestore so new word sets and videos are added as documents
 * rather than code changes. Falls back to DEFAULT_LESSON when the collection is
 * empty or unreachable, so the app works before anything is seeded.
 *
 * Seed a document like:
 *   lessons/welcome-pen-pal = {
 *     title: "Welcome to The Pen Pal",
 *     sentence: "Welcome to The Pen Pal",
 *     active: true,
 *     words: [ { word: "Welcome", video: "/videos/welcome.mp4" }, ... ]
 *   }
 */
export async function getLesson(lessonId) {
  if (!db) return DEFAULT_LESSON

  try {
    if (lessonId) {
      const snap = await getDoc(doc(db, 'lessons', lessonId))
      if (snap.exists()) return normaliseLesson(snap.id, snap.data())
      return DEFAULT_LESSON
    }

    // No id asked for: take whichever lesson is flagged active.
    const snap = await getDocs(query(collection(db, 'lessons'), where('active', '==', true)))
    const first = snap.docs[0]
    return first ? normaliseLesson(first.id, first.data()) : DEFAULT_LESSON
  } catch {
    return DEFAULT_LESSON
  }
}

function normaliseLesson(id, data) {
  const words = (data?.words ?? [])
    .map((w) => (typeof w === 'string' ? { word: w, video: null } : w))
    .filter((w) => w?.word)
  if (!words.length) return DEFAULT_LESSON
  return {
    id,
    title: data.title ?? data.sentence ?? id,
    sentence: data.sentence ?? words.map((w) => w.word).join(' '),
    words,
  }
}

export async function getUserProfile(uid) {
  if (!db) return null
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data() : null
}

export async function saveSession(studentId, session) {
  if (!db) return null
  const ref = await addDoc(collection(db, 'sessions'), {
    studentId,
    words: session.words,
    overallScore: session.overallScore,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function getSessions(studentId) {
  if (!db) return []
  // Sorted here rather than with orderBy: combining it with the studentId
  // filter would need a composite Firestore index, and a child's session list
  // is far too small for that to be worth setting up.
  const q = query(collection(db, 'sessions'), where('studentId', '==', studentId))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => {
      const data = d.data()
      return {
        id: d.id,
        ...data,
        // Firestore hands back a Timestamp; callers just want a Date.
        createdAt: data.createdAt?.toDate?.() ?? null,
      }
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}
