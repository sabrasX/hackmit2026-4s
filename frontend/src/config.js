// TODO: tune these numbers after testing with real writing (WEIGHTS must add up to 1).
// Words practised in the writing session, in order.
export const SENTENCE = 'Welcome to The Pen Pal'
export const WORDS = SENTENCE.split(' ')

// Vision server WebSocket URL.
export const VISION_WS_URL = import.meta.env.VITE_VISION_WS_URL || 'ws://localhost:8765/ws'

// Calibration: seconds the child writes normally before word 1, to learn their baseline.
export const CALIBRATION_SECONDS = 10

// Per-word score weights (see lib/scoring.js). Must add up to 1.
export const WEIGHTS = { stopped: 0.35, wrongPosition: 0.3, handMissing: 0.15, overtime: 0.2 }

// Overtime: a word is allowed OVERTIME_GRACE_S seconds, then the metric ramps
// from 0 to 1 over the next OVERTIME_RAMP_S seconds.
export const OVERTIME_GRACE_S = 45
export const OVERTIME_RAMP_S = 30

// How much of the child's own calibration baseline is forgiven before scoring.
export const BASELINE_CREDIT = 0.5

// The four metrics the struggle score is built from. `source` names the field on
// the vision AI's WebSocket message that each one reads, which is what the live
// Vision AI panel and the Results breakdown show the audience.
export const METRICS = [
  {
    key: 'stopped',
    label: 'Pen stopped',
    source: 'stopped',
    color: 'var(--color-sky)',
    explain:
      'Vision AI flags `stopped` when the grip point stays inside a small box and the fingers stay quiet — a real stall, not just a parked hand.',
  },
  {
    key: 'wrongPosition',
    label: 'Wrong hand position',
    source: 'palmFacingAway / badPosture',
    color: 'var(--color-coral-bright)',
    explain:
      'Vision AI flags `palmFacingAway` (hand turned off the page) or `badPosture` (fingers straighter than the calibrated writing grip).',
  },
  {
    key: 'handMissing',
    label: 'Hand out of frame',
    source: 'handVisible === false',
    color: 'var(--color-peach-bright)',
    explain:
      'Vision AI reports `handVisible: false` when no hand has been seen for 1.5s — the child has stopped writing altogether.',
  },
  {
    key: 'overtime',
    label: 'Taking too long',
    source: 'time on this word',
    color: 'var(--color-cyan)',
    explain: `Measured in the app, not the camera: 0 for the first ${OVERTIME_GRACE_S}s on a word, then ramping to 1 over the following ${OVERTIME_RAMP_S}s.`,
  },
]

// Live support triggers on the rolling score (0-100) over ROLLING_WINDOW_S seconds.
export const ROLLING_WINDOW_S = 5
export const SUPPORT_LEVELS = [
  { level: 1, minScore: 40, holdSeconds: 3 }, // encouragement + read word aloud
  { level: 2, minScore: 60, holdSeconds: 5 }, // show dotted trace hint
]
