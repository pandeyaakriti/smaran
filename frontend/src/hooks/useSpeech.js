import { useRef, useCallback, useState } from 'react'
import { AUDIO_CHUNK_MS, AUDIO_MIME_TYPE } from '../utils/constants'

/**
 * Captures microphone audio in fixed-length chunks (default 4s) and calls
 * onChunk(blob) with each one — mirrors the useCamera hook's frame-interval
 * pattern, but for audio.
 *
 * Why chunks instead of one continuous recording: faster-whisper transcribes
 * fastest on short clips, and chunking lets the UI show near-real-time text
 * without waiting for the whole conversation to end.
 */
export function useSpeech(onChunk) {
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState(null)
  const [volume, setVolume] = useState(0)   // 0-100, for a simple level meter
  const analyserRef = useRef(null)
  const volumeIntervalRef = useRef(null)

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Simple volume metering so the UI can show "is it hearing me"
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      volumeIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setVolume(Math.round((avg / 255) * 100))
      }, 150)

      const recorder = new MediaRecorder(stream, { mimeType: AUDIO_MIME_TYPE })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) onChunk(e.data)
      }

      // start(timeslice) makes the recorder fire ondataavailable every N ms
      // automatically, instead of us manually stopping/restarting it.
      recorder.start(AUDIO_CHUNK_MS)
      setActive(true)
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone permissions.'
          : 'Could not access microphone.'
      )
    }
  }, [onChunk])

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    clearInterval(volumeIntervalRef.current)
    setActive(false)
    setVolume(0)
  }, [])

  return { active, error, volume, start, stop }
}