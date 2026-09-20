import { useEffect, useRef, useState, useCallback } from 'react'
import { VISION_WS_URL } from '../config.js'

function isMockMode() {
  return new URLSearchParams(window.location.search).get('mock') === '1'
}

// Shaped like the vision server's payload, minus its struggleScore: the score
// is then computed the same way the server would compute it.
function randomStatus(t) {
  const r = Math.random()
  return {
    t,
    handVisible: r > 0.05,
    stopped: r > 0.6 && r < 0.75,
    palmFacingAway: r > 0.9,
    badPosture: r > 0.85 && r < 0.9,
    struggling: r > 0.6,
    stillExtent: Math.random(),
    articulation: Math.random() * 2.5,
  }
}

export function useVisionStream() {
  const [status, setStatus] = useState(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const mockRef = useRef(null)
  const reconnectRef = useRef(null)

  const connect = useCallback(() => {
    if (isMockMode()) {
      setConnected(true)
      mockRef.current = setInterval(() => {
        setStatus(randomStatus(Date.now()))
      }, 200)
      return
    }

    try {
      const ws = new WebSocket(VISION_WS_URL)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        reconnectRef.current = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (evt) => {
        try {
          setStatus(JSON.parse(evt.data))
        } catch {
          /* ignore malformed messages */
        }
      }
    } catch {
      reconnectRef.current = setTimeout(connect, 2000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      if (mockRef.current) clearInterval(mockRef.current)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])

  const send = useCallback((obj) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj))
    }
  }, [])

  return { status, connected, send, url: VISION_WS_URL, isMock: isMockMode() }
}
