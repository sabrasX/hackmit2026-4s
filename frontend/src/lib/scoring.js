// TODO: createScorer(): calibration baseline, per-word score, rolling score, support level 0-2
// score = 100 * min(1, 0.35*stopped + 0.30*fidget + 0.15*missing + 0.20*overtime), after subtracting baseline
// support level = rolling score above SUPPORT_LEVELS[i].minScore for holdSeconds
import { WEIGHTS, ROLLING_WINDOW_S, SUPPORT_LEVELS } from '../config.js'

export function createScorer() {
  return {
    startCalibration() {},
    endCalibration() {},
    startWord(word) {},
    addStatus(status) {},
    rollingScore() { return 0 },
    supportLevel() { return 0 },
    finishWord() { return null },
    overall() { return 0 },
  }
}
