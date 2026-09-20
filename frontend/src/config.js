// TODO: tune these numbers after testing with real writing (WEIGHTS must add up to 1).

// The lesson used when Firestore has no `lessons` document yet - the app reads
// the active lesson from the database first (see getLesson in lib/firebase.js)
// and only falls back to this, so new sentences and their tutorial videos are
// added as documents rather than code changes.
//
// `video` is a URL, not a file: these live in public/videos today, but pointing
// a word at Firebase Storage or a CDN later means editing this string only.
export const DEFAULT_LESSON = {
  id: 'default',
  title: 'Welcome to The Pen Pal',
  sentence: 'Welcome to The Pen Pal',
  words: [
    { word: 'Welcome', video: '/videos/welcome.mp4' },
    { word: 'to', video: '/videos/to.mp4' },
    { word: 'The', video: '/videos/the.mp4' },
    { word: 'Pen', video: '/videos/pen.mp4' },
    { word: 'Pal', video: '/videos/pal.mp4' },
  ],
}

export const SENTENCE = DEFAULT_LESSON.sentence
export const WORDS = DEFAULT_LESSON.words.map((w) => w.word)

// Vision server WebSocket URL.
export const VISION_WS_URL = import.meta.env.VITE_VISION_WS_URL || 'ws://localhost:8765/ws'

// Arduino heart-rate monitor (heartMonitor/python/main.py). Set this to the
// board's own address, e.g. http://192.168.1.42:8766 - the board serves it, not
// this laptop. Everything still works when it is unreachable.
export const HEART_HTTP_URL = import.meta.env.VITE_HEART_HTTP_URL || 'http://localhost:8766'
export const HEART_POLL_MS = 1000

// How long to wait at the calibration screen before letting the child start
// anyway. The sensor needs ~30 s in demo mode, ~110 s in full mode, but a
// missing or struggling sensor must never block a session.
export const CALIBRATION_TIMEOUT_S = 45

// Weight of the sensor's "stressed" verdict in a word's struggle score, applied
// only when the board actually produced readings for that word.
export const STRESS_WEIGHT = 0.25

// Per-word score weights (see lib/scoring.js). Must add up to 1.
// NOTE: the vision detector dropped "fidget" as unreliable and doesn't send it
// anymore - that weight moved onto "stopped", the signal Saba confirmed is solid.
// "badPosture" (grip drifting flat vs the calibrated reference) exists in the
// detector's output but isn't scored yet - it needs the server-side calibration
// handshake ({type: 'calibrate'}) wired into the writing flow first.
export const WEIGHTS = { stopped: 0.65, handMissing: 0.15, overtime: 0.2 }

// How long a child is expected to spend per letter, in seconds. A word's
// expected time is letters x this, so "Welcome" gets longer than "to". Going
// over it feeds the "overtime" weight above; at twice the expected time the
// overtime term is maxed out. Tune this after watching a few real sessions.
export const SECONDS_PER_LETTER = 3

// Live support triggers on the rolling score (0-100) over ROLLING_WINDOW_S seconds.
export const ROLLING_WINDOW_S = 5
export const SUPPORT_LEVELS = [
  { level: 1, minScore: 30, holdSeconds: 2 }, // encouragement + read word aloud
  { level: 2, minScore: 40, holdSeconds: 2 }, // play the word's tutorial video
]
