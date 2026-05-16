# Smaran — Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                 │
│   CameraFeed  │  ConversationPanel  │  MemoryCue        │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP + WebSocket
┌────────────────────▼────────────────────────────────────┐
│                FastAPI Backend                           │
│  /persons  /faces/enroll  /memory/recall  /health       │
│                                                          │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │ FaceManager  │  │  Transcriber  │  │  MemoryLLM  │  │
│  │ InsightFace  │  │ faster-whisper│  │  Ollama     │  │
│  └──────┬───────┘  └───────┬───────┘  └──────┬──────┘  │
│         │                  │                  │         │
│  ┌──────▼──────────────────▼──────────────────▼──────┐  │
│  │          ChromaDB (vector store)                   │  │
│  │    faces collection  │  memory collection          │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐ │
│  │            SQLite (structured data)                  │ │
│  │   persons  │  conversation_logs                     │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Data Flow — Live Session

1. **Camera frame** captured every 200ms → sent to `FaceManager`
2. `FaceManager.detect()` finds faces → `FaceManager.identify()` queries ChromaDB
3. Matched person metadata returned to frontend as overlay
4. **Microphone audio** buffered → `Transcriber.transcribe()` → text
5. Transcript + person context → `MemoryLLM.recall()` → contextual cue
6. All transcripts saved to `conversation_logs` (SQLite)
