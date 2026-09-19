// TODO: connect to VISION_WS_URL, parse each message into `status`, auto-reconnect every 2 s
// - Status keys must match struggle_vision/server.py
// - Add a ?mock=1 mode that emits fake statuses so the UI works without the camera
import { useEffect, useRef, useState } from 'react'
import { VISION_WS_URL } from '../config.js'

export function useVisionStream() {
  const [status, setStatus] = useState(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)

  useEffect(() => {
  }, [])

  const send = (obj) => wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify(obj))
  return { status, connected, send, url: VISION_WS_URL }
}
