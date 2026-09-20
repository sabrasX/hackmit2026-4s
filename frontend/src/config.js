// Words practised in the writing session, in order.
export const SENTENCE = 'Welcome to The Pen Pal'
export const WORDS = SENTENCE.split(' ')

// Vision server WebSocket URL.
export const VISION_WS_URL = import.meta.env.VITE_VISION_WS_URL || 'ws://localhost:8765/ws'

// Calibration: seconds the child writes normally before word 1, to learn their baseline.
export const CALIBRATION_SECONDS = 10

// Per-sample score weights, mirroring struggle_vision/scoring.py. The vision
// server sends its own struggleScore; these are only used for statuses that
// arrive without one (the ?mock=1 demo stream). Must add up to 1.
export const WEIGHTS = { stopped: 0.35, wrongPosition: 0.25, fidget: 0.25, handMissing: 0.15 }

// Finger speed (hand sizes/s) between quiet writing and a full fidget score.
export const FIDGET_ARTICULATION = { low: 0.5, high: 2.0 }

// Live support triggers on the rolling score (0-100) over ROLLING_WINDOW_S seconds.
export const ROLLING_WINDOW_S = 5
// A hand that is stopped and out of position - the worst the vision AI can see
// at once - scores 60, and the warm-up baseline takes up to 10 off that, so
// every threshold has to sit below 50 to be reachable.
export const SUPPORT_LEVELS = [
  { level: 1, minScore: 20, holdSeconds: 3 }, // encouragement + read word aloud
  { level: 2, minScore: 35, holdSeconds: 4 }, // show dotted trace hint
  { level: 3, minScore: 48, holdSeconds: 5 }, // play a video of the word being written
]

// Support level at which the reference-video helper opens.
export const VIDEO_SUPPORT_LEVEL = 3
