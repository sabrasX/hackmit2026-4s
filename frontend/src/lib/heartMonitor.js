// Reads the Arduino UNO Q stress-checker export (heartMonitor/python/main.py)
// and turns it into the samples CalmStressChart expects. Calm is the fallback
// for every failure mode: bridge down, no export yet, no finger, warming up…

export const HEART_SESSION_URL = '/api/heart-session'
const FETCH_TIMEOUT_MS = 4000
const WINDOW_TOLERANCE_S = 5

function toState(state) {
  return state === 'stressed' ? 'stressed' : 'calm'
}

/**
 * Convert exported samples ({unix, state, confidence 0-1}) into chart samples
 * ({t, confidence 0-100, state}) covering [startUnix, endUnix].
 * If the Arduino clock doesn't overlap the session (unsynced device clock),
 * the most recent stretch of the same duration is used instead.
 */
export function samplesForWindow(exported, startUnix, endUnix) {
  if (!Array.isArray(exported) || !exported.length) return []
  const duration = Math.max(endUnix - startUnix, 0)
  const sorted = exported
    .filter((s) => typeof s?.unix === 'number')
    .sort((a, b) => a.unix - b.unix)
  if (!sorted.length) return []

  let inWindow = sorted.filter(
    (s) => s.unix >= startUnix - WINDOW_TOLERANCE_S && s.unix <= endUnix + WINDOW_TOLERANCE_S,
  )
  let origin = startUnix
  if (!inWindow.length) {
    const last = sorted[sorted.length - 1].unix
    inWindow = sorted.filter((s) => s.unix >= last - duration)
    origin = inWindow[0].unix
  }

  return inWindow.map((s) => ({
    t: +Math.max(s.unix - origin, 0).toFixed(2),
    confidence: Math.round(Math.min(Math.max(s.confidence ?? 0, 0), 1) * 100),
    state: toState(s.state),
  }))
}

export async function fetchSensorSamples(startUnix, endUnix) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(HEART_SESSION_URL, { signal: ctrl.signal })
    if (!res.ok) return []
    const doc = await res.json()
    return samplesForWindow(doc?.samples, startUnix, endUnix)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}
