export const WS_URL = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000'
export const FRAME_INTERVAL_MS = 200   // how often to capture & send a frame
export const MAX_TRANSCRIPT_LINES = 100
// Speech capture — records in chunks rather than one continuous stream,
// so the backend gets bite-sized clips it can transcribe quickly.
export const AUDIO_CHUNK_MS = 4000     // how long each recorded chunk is
export const AUDIO_MIME_TYPE = 'audio/webm'