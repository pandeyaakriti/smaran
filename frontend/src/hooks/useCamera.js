import { useRef, useCallback, useState } from 'react'
import { FRAME_INTERVAL_MS } from '../utils/constants'

export function useCamera(onFrame) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)
  const [active, setActive] = useState(false)

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    videoRef.current.srcObject = stream
    setActive(true)
    intervalRef.current = setInterval(() => {
      const ctx = canvasRef.current.getContext('2d')
      ctx.drawImage(videoRef.current, 0, 0, 640, 480)
      canvasRef.current.toBlob((blob) => onFrame(blob), 'image/jpeg', 0.8)
    }, FRAME_INTERVAL_MS)
  }, [onFrame])

  const stop = useCallback(() => {
    clearInterval(intervalRef.current)
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop())
    setActive(false)
  }, [])

  return { videoRef, canvasRef, active, start, stop }
}
