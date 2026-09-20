// Turns raw samples from the Arduino monitor into the numbers the results page
// reports, and into the per-word stress figure that feeds the struggle score.
//
// Sample shape (from heartMonitor/python/main.py):
//   { unix, utc, state, confidence, hr_bpm?, rmssd_ms?, calibrated, baseline? }
// `state` is one of no_finger | warming_up | poor_signal | calibrating | calm | stressed.

import { STRESS_WEIGHT } from '../config.js'

// Only these two are verdicts; the rest mean the sensor had nothing to say.
const VERDICTS = ['calm', 'stressed']

export function isVerdict(sample) {
  return VERDICTS.includes(sample?.state)
}

/** Share of usable samples in a window that came back "stressed", or null. */
export function stressFraction(samples = []) {
  const verdicts = samples.filter(isVerdict)
  if (!verdicts.length) return null
  return verdicts.filter((s) => s.state === 'stressed').length / verdicts.length
}

/**
 * Samples recorded in [startMs, endMs). Half-open so a sample landing exactly on
 * a word boundary belongs to the next word rather than being counted in both.
 */
export function samplesBetween(samples = [], startMs, endMs) {
  return samples.filter((s) => {
    const ms = (s?.unix ?? 0) * 1000
    return ms >= startMs && ms < endMs
  })
}

/**
 * Adds the sensor's verdict to a word's struggle score. Words the sensor said
 * nothing about are returned untouched, so a missing board never changes a score.
 */
export function applyStressToWords(words = [], samples = []) {
  if (!samples.length) return words
  return words.map((w) => {
    if (!w.startedAt || !w.endedAt) return w
    const stress = stressFraction(samplesBetween(samples, w.startedAt, w.endedAt))
    if (stress === null) return w
    const blended = w.score * (1 - STRESS_WEIGHT) + stress * 100 * STRESS_WEIGHT
    return { ...w, score: Math.round(blended), stress: Math.round(stress * 100) }
  })
}

/** Headline numbers for the results page, or null when there is no usable data. */
export function summarise(samples = []) {
  const beats = samples.map((s) => s.hr_bpm).filter((n) => typeof n === 'number' && n > 0)
  const verdicts = samples.filter(isVerdict)
  if (!beats.length && !verdicts.length) return null

  const stressed = verdicts.filter((s) => s.state === 'stressed').length
  const baseline = samples.find((s) => s.baseline)?.baseline ?? null

  return {
    averageBpm: beats.length ? Math.round(beats.reduce((a, b) => a + b, 0) / beats.length) : null,
    minBpm: beats.length ? Math.round(Math.min(...beats)) : null,
    maxBpm: beats.length ? Math.round(Math.max(...beats)) : null,
    baselineBpm: baseline?.hr_bpm ?? null,
    stressedPercent: verdicts.length ? Math.round((stressed / verdicts.length) * 100) : null,
    readings: verdicts.length,
  }
}

/** Sensor samples in the shape CalmStressChart wants: t seconds, 0-100 confidence. */
export function toChartSamples(samples = [], sessionStartMs) {
  const usable = samples.filter(isVerdict)
  if (usable.length < 2) return []
  const start = sessionStartMs ?? usable[0].unix * 1000
  return usable.map((s) => ({
    t: +(((s.unix * 1000 - start) / 1000).toFixed(2)),
    confidence: Math.round((s.confidence ?? 0) * 100),
    state: s.state,
  }))
}
