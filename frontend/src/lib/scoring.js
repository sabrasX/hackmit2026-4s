import { WEIGHTS, ROLLING_WINDOW_S, SUPPORT_LEVELS } from '../config.js'

function extractMetrics(status) {
  const handMissing = status.handVisible === false ? 1 : 0
  const stopped = status.stopped ? 1 : 0
  const fidget = status.fidget ? 1 : 0
  return { stopped, fidget, handMissing, overtime: 0 }
}

function weightedSum(metrics) {
  return (
    WEIGHTS.stopped * metrics.stopped +
    WEIGHTS.fidget * metrics.fidget +
    WEIGHTS.handMissing * metrics.handMissing +
    WEIGHTS.overtime * metrics.overtime
  )
}

function averageMetrics(samples) {
  if (!samples.length) return { stopped: 0, fidget: 0, handMissing: 0, overtime: 0 }
  const sum = samples.reduce(
    (acc, s) => ({
      stopped: acc.stopped + s.stopped,
      fidget: acc.fidget + s.fidget,
      handMissing: acc.handMissing + s.handMissing,
      overtime: acc.overtime + s.overtime,
    }),
    { stopped: 0, fidget: 0, handMissing: 0, overtime: 0 },
  )
  const n = samples.length
  return {
    stopped: sum.stopped / n,
    fidget: sum.fidget / n,
    handMissing: sum.handMissing / n,
    overtime: sum.overtime / n,
  }
}

function computeScore(samples, baseline, wordStartTime) {
  if (!samples.length) return 0

  const avg = averageMetrics(samples)
  const elapsed = (samples[samples.length - 1].t - wordStartTime) / 1000
  const overtime = elapsed > 45 ? Math.min(1, (elapsed - 45) / 30) : 0
  avg.overtime = overtime

  const raw = weightedSum(avg)
  const base = weightedSum(baseline)
  const adjusted = Math.max(0, raw - base * 0.5)
  return Math.round(100 * Math.min(1, adjusted))
}

export function createScorer() {
  let baseline = { stopped: 0, fidget: 0, handMissing: 0, overtime: 0 }
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
        baseline = averageMetrics(calibrationSamples)
      }
    },

    startWord(word) {
      currentWord = word
      wordStartTime = Date.now()
      wordSamples = []
      levelHoldStart = null
      currentLevel = 0
    },

    addStatus(status) {
      const sample = { ...extractMetrics(status), t: status.t ?? Date.now() }
      if (calibrating) {
        calibrationSamples.push(sample)
        return
      }
      if (currentWord) {
        wordSamples.push(sample)
        const partial = computeScore(wordSamples, baseline, wordStartTime)
        scoreHistory.push({ t: sample.t, score: partial })
        const cutoff = sample.t - ROLLING_WINDOW_S * 1000
        scoreHistory = scoreHistory.filter((e) => e.t >= cutoff)
      }
    },

    rollingScore() {
      if (!scoreHistory.length) return 0
      const sum = scoreHistory.reduce((a, e) => a + e.score, 0)
      return Math.round(sum / scoreHistory.length)
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
      const result = { word: currentWord, score }
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
      const sum = completedWords.reduce((a, w) => a + w.score, 0)
      return Math.round(sum / completedWords.length)
    },

    getWords() {
      return [...completedWords]
    },
  }
}
