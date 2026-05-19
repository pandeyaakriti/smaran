<div align="center">
  <h1>Smaran</h1>
  <p><strong>Real-time AI memory assistant — face recognition · speech transcription · contextual recall</strong></p>
  <img src="https://img.shields.io/badge/python-3.11+-blue?logo=python" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi" />
  <img src="https://img.shields.io/badge/React-18-61dafb?logo=react" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
</div>

---

## What is Smaran?

Smaran (*Sanskrit: "to remember"*) is a real-time AI-powered memory assistant that helps you recall who you're talking to and what matters to them — during live conversations. It combines:

- **Face recognition** via InsightFace — identify people the moment they appear on camera
- **Speech transcription** via faster-whisper — offline, real-time conversation capture
- **Contextual memory recall** via LLaMA (Ollama) + ChromaDB — relevant cues surfaced at the right moment

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Tailwind CSS, Vite |
| Backend | FastAPI, Python 3.11 |
| Face Recognition | InsightFace, OpenCV |
| Speech-to-Text | faster-whisper |
| Vector Store | ChromaDB |
| Relational DB | SQLite (aiosqlite) |
| LLM | LLaMA 3.2 via Ollama |
| ML | PyTorch |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- [Ollama](https://ollama.com) installed and running

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/smaran.git
cd smaran

# 2. One-shot setup (venv + npm + .env + Ollama model)
./scripts/setup.sh

# 3. Edit .env with your settings (optional for local dev)
# nano .env

# 4. Start dev servers
./scripts/start_dev.sh
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |

---

## Project Structure

```
smaran/
├── backend/
│   ├── api/routes/      # FastAPI route handlers
│   ├── core/            # Config, logging, exceptions
│   ├── models/          # SQLAlchemy ORM models
│   ├── services/
│   │   ├── face/        # InsightFace recognition & ChromaDB enrollment
│   │   ├── speech/      # faster-whisper transcription
│   │   └── memory/      # Ollama LLM recall & context retrieval
│   └── db/              # Database init & ChromaDB client
├── frontend/
│   └── src/
│       ├── components/  # Camera, Conversation, Memory UI
│       ├── hooks/       # useCamera, useSpeech, useWebSocket
│       ├── pages/       # Dashboard, PersonManager, Settings
│       └── store/       # Redux slices
├── scripts/             # setup.sh, start_dev.sh
└── docs/                # Architecture, API reference
```

---

## Key Workflows

### Enroll a person
```bash
curl -X POST http://localhost:8000/persons \
  -H "Content-Type: application/json" \
  -d '{"name": "Ananya", "relation": "colleague", "notes": "Loves hiking, works in ML"}'

# Then enroll their face
curl -X POST http://localhost:8000/faces/enroll/1 \
  -F "image=@ananya.jpg"
```

### Get a memory recall
```bash
curl -X POST http://localhost:8000/memory/recall \
  -H "Content-Type: application/json" \
  -d '{"person_context": "Ananya, colleague, loves hiking", "conversation_snippet": "How was your weekend?"}'
```

---

## Roadmap

- [ ] WebSocket live frame pipeline
- [ ] Real-time speaker diarization
- [ ] Multi-face tracking in a single frame
- [ ] Mobile PWA support
- [ ] End-to-end encryption for stored data

---

## Contributing

1. Fork → create branch (`feat/your-feature`)
2. Run `ruff check backend/` and `npm run lint` before committing
3. Open a PR with the provided template

---

*Smaran — because every conversation deserves its full context.*
