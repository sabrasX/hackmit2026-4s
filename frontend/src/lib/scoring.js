import { WEIGHTS, ROLLING_WINDOW_S, SUPPORT_LEVELS, SECONDS_PER_LETTER } from '../config.js'

// If the vision server sends its own struggle score we use that verbatim and
// skip the weights below. Saba's server just has to put a `struggleScore`
// number (0-100) in the JSON it already streams; anything else keeps working.
function serverScoreOf(status) {
  const raw = status.struggleScore
  if (typeof raw !== 'number' || Number.isNaN(raw)) return null
  return Math.max(0, Math.min(100, raw))
}

function extractMetrics(status) {
  const handMissing = status.handVisible === false ? 1 : 0
  const stopped = status.stopped ? 1 : 0
  return { stopped, handMissing, overtime: 0 }
}

function weightedSum(metrics) {
  return (
    WEIGHTS.stopped * metrics.stopped +
    WEIGHTS.handMissing * metrics.handMissing +
    WEIGHTS.overtime * metrics.overtime
  )
}

function averageMetrics(samples) {
  if (!samples.length) return { stopped: 0, handMissing: 0, overtime: 0 }
  const sum = samples.reduce(
    (acc, s) => ({
      stopped: acc.stopped + s.stopped,
      handMissing: acc.handMissing + s.handMissing,
      overtime: acc.overtime + s.overtime,
    }),
    { stopped: 0, handMissing: 0, overtime: 0 },
  )
  const n = samples.length
  return {
    stopped: sum.stopped / n,
    handMissing: sum.handMissing / n,
    overtime: sum.overtime / n,
  }
}

function letterCount(word) {
  return (word ?? '').replace(/[^\p{L}\p{N}]/gu, '').length
}

/**
 * This child's own seconds-per-letter, learned from their past sessions, so a
 * naturally slow writer isn't scored as struggling just for writing slowly.
 * Returns null when there isn't enough history to say, and the caller falls
 * back to the SECONDS_PER_LETTER default.
 *
 * The median is deliberate: a couple of words where the child genuinely got
 * stuck shouldn't drag their "normal pace" upwards and mask future struggling.
 */
export function paceFromSessions(sessions = []) {
  const paces = []
  for (const session of sessions) {
    for (const w of session?.words ?? []) {
      const letters = letterCount(w?.word)
      // Older sessions predate per-word timing and have no `seconds`.
      if (!letters || typeof w?.seconds !== 'number' || w.seconds <= 0) continue
      paces.push(w.seconds / letters)
    }
  }
  if (paces.length < 3) return null

  paces.sort((a, b) => a - b)
  const mid = Math.floor(paces.length / 2)
  return paces.length % 2 ? paces[mid] : (paces[mid - 1] + paces[mid]) / 2
}

function computeScore(samples, wordStartTime, expectedSeconds) {
  if (!samples.length) return 0

  // The server's own score wins whenever it is sending one.
  const fromServer = samples.map((s) => s.serverScore).filter((s) => s !== null)
  if (fromServer.length) {
    return Math.round(fromServer.reduce((a, b) => a + b, 0) / fromServer.length)
  }

  const avg = averageMetrics(samples)
  // Overtime is measured against what this particular word should take, so a
  // long word isn't penalised for simply having more letters in it. Taking
  // twice the expected time maxes the term out.
  const elapsed = (Date.now() - wordStartTime) / 1000
  avg.overtime = expectedSeconds > 0
    ? Math.max(0, Math.min(1, (elapsed - expectedSeconds) / expectedSeconds))
    : 0

  return Math.round(100 * Math.min(1, weightedSum(avg)))
}

export function createScorer({ secondsPerLetter } = {}) {
  // The child's learned pace when we have one, the shared default otherwise.
  const pace = secondsPerLetter > 0 ? secondsPerLetter : SECONDS_PER_LETTER
  let currentWord = null
  let wordStartTime = null
  let expectedSeconds = 0
  let wordSamples = []
  let completedWords = []
  let scoreHistory = []
  let levelHoldStart = null
  let currentLevel = 0

  return {
    startWord(word) {
      currentWord = word
      wordStartTime = Date.now()
      // Letters only: punctuation shouldn't buy the child extra time.
      expectedSeconds = letterCount(word) * pace
      wordSamples = []
      scoreHistory = []
      levelHoldStart = null
      currentLevel = 0
    },

    addStatus(status) {
      // Timestamps come off our own clock. The server's `t` is seconds since
      // the camera thread started, which is not comparable to Date.now().
      const sample = {
        ...extractMetrics(status),
        serverScore: serverScoreOf(status),
        t: Date.now(),
      }
      if (currentWord) {
        wordSamples.push(sample)
        const cutoff = sample.t - ROLLING_WINDOW_S * 1000
        const recent = wordSamples.filter((s) => s.t >= cutoff)
        scoreHistory = [
          { t: sample.t, score: computeScore(recent, wordStartTime, expectedSeconds) },
        ]
      }
    },

    rollingScore() {
      if (!scoreHistory.length) return 0
      return scoreHistory[scoreHistory.length - 1].score
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
          levelHoldStart = now
        }
      } else {
        currentLevel = targetLevel
        levelHoldStart = now
      }

      return currentLevel
    },

    finishWord() {
      const score = computeScore(wordSamples, wordStartTime, expectedSeconds)
      // Seconds spent on the word - the results chart uses it as bar width.
      const endedAt = Date.now()
      const seconds = Math.round(((endedAt - wordStartTime) / 1000) * 10) / 10
      // The window is what lets heart-monitor samples be matched to this word.
      const result = { word: currentWord, score, seconds, startedAt: wordStartTime, endedAt }
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
