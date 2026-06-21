"""
Smaran — FastAPI entrypoint
"""
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger

from backend.core.config import get_settings
from backend.db.database import init_db
from backend.services.face.manager import FaceManager
from backend.services.speech.transcriber import Transcriber
from backend.api.routes import health, persons, faces, memory, speech, settings as settings_route

settings = get_settings()

# backend/uploads/  and  backend/uploads/faces/
BASE_DIR    = Path(__file__).resolve().parent  
UPLOADS_DIR = BASE_DIR / "uploads"
FACES_DIR   = UPLOADS_DIR / "faces"
UPLOADS_DIR.mkdir(exist_ok=True)
FACES_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Smaran backend (env={})", settings.app_env)
    await init_db()
    FaceManager.get().load()
    Transcriber.get().load()
    yield
    logger.info("Shutting down Smaran backend")


app = FastAPI(
    title="Smaran API",
    description="Real-time AI memory assistant — face recognition, speech, contextual recall",
    version="0.1.0",
    lifespan=lifespan,
)

# ── 1. Middleware first ───────────────────────────────────────────────────────
# CORS must be registered before any mounts. Starlette processes middleware
# in reverse registration order, and mounted sub-apps (StaticFiles) bypass
# the middleware stack entirely if mounted first — causing 404s.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 2. API routers ────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(persons.router)
app.include_router(faces.router)
app.include_router(memory.router)
app.include_router(speech.router)
app.include_router(settings_route.router)

# ── 3. Static files last ─────────────────────────────────────────────────────
# Mount AFTER routers so /uploads never shadows an API path.
# Serves:  GET /uploads/faces/<filename>
# Written by faces.py: backend/uploads/faces/person_<id>_<uuid>.<ext>
app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOADS_DIR)),
    name="uploads",
)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=True,
    )