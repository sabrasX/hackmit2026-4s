// Reads the Arduino heart-rate monitor (heartMonitor/python/main.py) over HTTP.
//
// Polled rather than streamed on purpose: the calm/stressed state is never shown
// live during writing, only summarised on the results page, so once a second is
// plenty and there is no socket to keep alive.
//
// Everything degrades quietly when the board isn't plugged in: `connected` stays
// false, `samples` stays empty, and the writing session carries on without it.
import { useCallback, useEffect, useRef, useState } from 'react'
import { HEART_HTTP_URL, HEART_POLL_MS } from '../config.js'

// States the monitor reports before it can classify anything.
const NOT_READY = ['starting', 'no_finger', 'warming_up', 'poor_signal', 'calibrating']

export function isSensorReady(status) {
  return Boolean(status?.calibrated) && !NOT_READY.includes(status?.state)
}

export function useHeartMonitor({ collecting = false } = {}) {
  const [status, setStatus] = useState(null)
  const [connected, setConnected] = useState(false)
  const samplesRef = useRef([])
  const collectingRef = useRef(collecting)
  collectingRef.current = collecting

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch(`${HEART_HTTP_URL}/status`, { cache: 'no-store' })
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        if (cancelled) return
        setStatus(data)
        setConnected(true)
        if (collectingRef.current) samplesRef.current.push(data)
      } catch {
        if (!cancelled) setConnected(false)
      }
    }

    tick()
    const timer = setInterval(tick, HEART_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const resetSamples = useCallback(() => {
    samplesRef.current = []
  }, [])

  const takeSamples = useCallback(() => samplesRef.current.slice(), [])

  return { status, connected, ready: isSensorReady(status), resetSamples, takeSamples }
}
