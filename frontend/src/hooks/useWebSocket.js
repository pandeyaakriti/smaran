import { useEffect, useRef, useCallback } from 'react'
import { WS_URL } from '../utils/constants'

/**
 * Generic WebSocket hook.
 * @param {string} path - e.g. "/ws/session"
 * @param {function} onMessage - callback(data: object)
 */
export function useWebSocket(path, onMessage) {
  const ws = useRef(null)

  const connect = useCallback(() => {
    ws.current = new WebSocket(`${WS_URL}${path}`)
    ws.current.onmessage = (e) => onMessage(JSON.parse(e.data))
    ws.current.onclose   = () => setTimeout(connect, 2000)   // auto-reconnect
  }, [path, onMessage])

  useEffect(() => {
    connect()
    return () => ws.current?.close()
  }, [connect])

  const send = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
