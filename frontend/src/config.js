// TODO: tune these numbers after testing with real writing (WEIGHTS must add up to 1).
// Words practised in the writing session, in order.
export const SENTENCE = 'Welcome to better Education'
export const WORDS = SENTENCE.split(' ')

// Vision server WebSocket URL.
export const VISION_WS_URL = import.meta.env.VITE_VISION_WS_URL || 'ws://localhost:8765/ws'

// Calibration: seconds the child writes normally before word 1, to learn their baseline.
export const CALIBRATION_SECONDS = 10

// Per-word score weights (see lib/scoring.js). Must add up to 1.
export const WEIGHTS = { stopped: 0.35, fidget: 0.3, handMissing: 0.15, overtime: 0.2 }

// Live support triggers on the rolling score (0-100) over ROLLING_WINDOW_S seconds.
export const ROLLING_WINDOW_S = 5
export const SUPPORT_LEVELS = [
  { level: 1, minScore: 40, holdSeconds: 3 }, // encouragement + read word aloud
  { level: 2, minScore: 60, holdSeconds: 5 }, // show dotted trace hint
]
