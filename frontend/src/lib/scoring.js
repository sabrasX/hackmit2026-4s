import { WEIGHTS, FIDGET_ARTICULATION, ROLLING_WINDOW_S, SUPPORT_LEVELS } from '../config.js'

// A word taking longer than this is struggle the camera can't see on its own.
const OVERTIME_AFTER_S = 45
const OVERTIME_RAMP_S = 30
const OVERTIME_MAX_POINTS = 20

// Half the warm-up score is discounted, but never so much that the worst state
// the camera can report stops reaching the top support threshold.
const BASELINE_DISCOUNT_MAX_POINTS = 10

function baselineDiscount(baseline) {
  return Math.min(0.5 * baseline, BASELINE_DISCOUNT_MAX_POINTS)
}

function ramp(value, low, high) {
  if (!(high > low)) return 0
  return Math.min(1, Math.max(0, (value - low) / (high - low)))
}

// Mirror of struggle_vision/scoring.py, for statuses that arrive without a
// score of their own (the ?mock=1 demo stream).
function localScoreParts(status) {
  const handVisible = status.handVisible !== false
  const fidget = handVisible
    ? ramp(status.articulation ?? 0, FIDGET_ARTICULATION.low, FIDGET_ARTICULATION.high)
    : 0
  return {
    stopped: 100 * WEIGHTS.stopped * (status.stopped ? 1 : 0),
    wrongPosition: 100 * WEIGHTS.wrongPosition * (status.palmFacingAway || status.badPosture ? 1 : 0),
    fidget: 100 * WEIGHTS.fidget * fidget,
    handMissing: 100 * WEIGHTS.handMissing * (handVisible ? 0 : 1),
  }
}

/** The parts of one status's struggle score, in points out of 100. */
export function scoreParts(status) {
  if (status?.scoreParts) return status.scoreParts
  return localScoreParts(status ?? {})
}

/** One status's struggle score, 0 (calm) to 100. The vision server's own
 *  number when it sent one, so the graph shows what the camera measured. */
export function sampleScore(status) {
  if (Number.isFinite(status?.struggleScore)) return status.struggleScore
  return Object.values(localScoreParts(status ?? {})).reduce((a, b) => a + b, 0)
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function averageParts(samples) {
  const names = Object.keys(WEIGHTS)
  const out = {}
  for (const name of names) {
    out[name] = Math.round(mean(samples.map((s) => s.parts[name] ?? 0)) * 10) / 10
  }
  return out
}

function computeScore(samples, baseline, wordStartTime) {
  if (!samples.length) return 0

  // The child's own calm baseline is discounted, so a naturally fidgety hand
  // doesn't start every word halfway up the scale.
  const live = Math.max(0, mean(samples.map((s) => s.score)) - baselineDiscount(baseline))
  const elapsed = (samples[samples.length - 1].t - wordStartTime) / 1000
  const overtime = ramp(elapsed, OVERTIME_AFTER_S, OVERTIME_AFTER_S + OVERTIME_RAMP_S)
  return Math.round(Math.min(100, live + OVERTIME_MAX_POINTS * overtime))
}

export function createScorer() {
  let baseline = 0
  let calibrating = false
  let calibrationSamples = []
  let currentWord = null
  let wordStartTime = null
  let wordSamples = []
  let completedWords = []
  let scoreHistory = []
  let levelHoldStart = null
  let currentLevel = 0

  return {
    startCalibration() {
      calibrating = true
      calibrationSamples = []
    },

    endCalibration() {
      calibrating = false
      if (calibrationSamples.length) {
        baseline = mean(calibrationSamples.map((s) => s.score))
      }
    },

    baselineScore() {
      return Math.round(baseline)
    },

    startWord(word) {
      currentWord = word
      wordStartTime = Date.now()
      wordSamples = []
      scoreHistory = []
      levelHoldStart = null
      currentLevel = 0
    },

    addStatus(status) {
      const sample = {
        score: sampleScore(status),
        parts: scoreParts(status),
        t: Date.now(),
      }
      if (calibrating) {
        calibrationSamples.push(sample)
        return
      }
      if (currentWord) {
        wordSamples.push(sample)
        scoreHistory.push(sample)
        const cutoff = sample.t - ROLLING_WINDOW_S * 1000
        scoreHistory = scoreHistory.filter((e) => e.t >= cutoff)
      }
    },

    rollingScore() {
      // Baseline-discounted like the finished-word score, so a naturally
      // restless hand doesn't trigger support while writing normally.
      return Math.round(Math.max(0, mean(scoreHistory.map((e) => e.score)) - baselineDiscount(baseline)))
    },

    supportLevel() {
      const rolling = this.rollingScore()
      const now = Date.now()
      let targetLevel = 0

      for (let i = SUPPORT_LEVELS.length - 1; i >= 0; i--) {
        const { level, minScore } = SUPPORT_LEVELS[i]
        if (rolling >= minScore) {
          targetLevel = level
          break
        }
      }

      if (targetLevel === 0) {
        levelHoldStart = null
        currentLevel = 0
        return 0
      }

      const threshold = SUPPORT_LEVELS.find((s) => s.level === targetLevel)
      if (targetLevel > currentLevel) {
        if (!levelHoldStart) levelHoldStart = now
        if ((now - levelHoldStart) / 1000 >= threshold.holdSeconds) {
          currentLevel = targetLevel
        }
      } else {
        currentLevel = targetLevel
        levelHoldStart = now
      }

      return currentLevel
    },

    finishWord() {
      const score = computeScore(wordSamples, baseline, wordStartTime)
      const result = { word: currentWord, score, parts: averageParts(wordSamples) }
      completedWords.push(result)
      currentWord = null
      wordSamples = []
      scoreHistory = []
      levelHoldStart = null
      currentLevel = 0
      return result
    },

    overall() {
      if (!completedWords.length) return 0
      return Math.round(mean(completedWords.map((w) => w.score)))
    },

    getWords() {
      return [...completedWords]
    },
  }
}
