import { useRef, useCallback, useState } from 'react'
import { AUDIO_CHUNK_MS, AUDIO_MIME_TYPE } from '../utils/constants'

/**
 * Captures microphone audio in fixed-length chunks (default 6s) and calls
 * onChunk(blob) with each one — mirrors the useCamera hook's frame-interval
 * pattern, but for audio.
 *
 * Why we restart the recorder every cycle instead of using start(timeslice):
 * MediaRecorder only writes the WebM/Matroska container header into the
 * FIRST ondataavailable blob of a recording session. Every blob after that
 * is a headerless continuation fragment — not a valid standalone file on
 * its own. Since each chunk is sent to the backend independently and must
 * be decodable by itself, we instead stop() and start() a brand new
 * MediaRecorder every cycle, so every blob we emit is a complete,
 * self-contained WebM file with its own header.
 */
export function useSpeech(onChunk) {
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const cycleTimeoutRef = useRef(null)
  const stoppingRef = useRef(false)

  const [active, setActive] = useState(false)
  const [error, setError] = useState(null)
  const [volume, setVolume] = useState(0)
  const volumeIntervalRef = useRef(null)

  const startCycle = useCallback(() => {
    const stream = streamRef.current
    if (!stream || stoppingRef.current) return

    const recorder = new MediaRecorder(stream, { mimeType: AUDIO_MIME_TYPE })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) onChunk(e.data)
    }

    recorder.onstop = () => {
      if (!stoppingRef.current) startCycle()
    }

    recorder.start()

    cycleTimeoutRef.current = setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop()
    }, AUDIO_CHUNK_MS)
  }, [onChunk])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      stoppingRef.current = false

      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      volumeIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setVolume(Math.round((avg / 255) * 100))
      }, 150)

      startCycle()
      setActive(true)
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone permissions.'
          : 'Could not access microphone.'
      )
    }
  }, [startCycle])

  const stop = useCallback(() => {
    stoppingRef.current = true
    clearTimeout(cycleTimeoutRef.current)
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    clearInterval(volumeIntervalRef.current)
    setActive(false)
    setVolume(0)
  }, [])

  return { active, error, volume, start, stop }
}