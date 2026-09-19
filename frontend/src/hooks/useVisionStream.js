// TODO: connect to VISION_WS_URL, parse each message into `status`, auto-reconnect every 2 s
// - Status keys must match struggle_vision/server.py
// - Add a ?mock=1 mode that emits fake statuses so the UI works without the camera
import { useEffect, useRef, useState } from 'react'
import { VISION_WS_URL } from '../config.js'

const RECONNECT_DELAY_MS = 2000
const MOCK_INTERVAL_MS = 200

// Whatever server.py ends up sending (raw signals, or an already-computed
// score) gets passed through untouched - this hook doesn't assume a shape.
function isMockMode() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('mock') === '1'
}

// Cycles through a few fake statuses so the UI is drivable without a camera
// or the Python server running. Rough shape matches the plan's Status JSON.
function nextMockStatus(t) {
  const cyclePos = (t / 4) % 3 // 0-8s calm, 8-16s "stopped", 16-24s "fidget"-ish
  const stopped = cyclePos >= 1 && cyclePos < 2
  const fidget = cyclePos >= 2
  return {
    t,
    handVisible: true,
    stopped,
    fidget,
    struggling: stopped || fidget,
    stillExtent: stopped ? 0.15 : 0.6,
    reversalsPerS: fidget ? 8 : 1,
    efficiency: fidget ? 0.15 : 0.7,
    articulation: fidget ? 0.08 : 0.03,
  }
}

export function useVisionStream() {
  const [status, setStatus] = useState(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let reconnectTimer = null

    if (isMockMode()) {
      setConnected(true)
      let t = 0
      const mockTimer = setInterval(() => {
        t += MOCK_INTERVAL_MS / 1000
        setStatus(nextMockStatus(t))
      }, MOCK_INTERVAL_MS)
      return () => clearInterval(mockTimer)
    }

    function connect() {
      if (cancelled) return
      const ws = new WebSocket(VISION_WS_URL)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)

      ws.onmessage = (event) => {
        try {
          setStatus(JSON.parse(event.data))
        } catch {
          // Ignore malformed frames rather than crashing the writing session.
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (!cancelled) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      wsRef.current?.close()
    }
  }, [])

  const send = (obj) => wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify(obj))
  return { status, connected, send, url: VISION_WS_URL }
}
