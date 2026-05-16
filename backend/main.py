"""
Smaran — FastAPI entrypoint
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger

from backend.core.config import get_settings
from backend.db.database import init_db
from backend.services.face.manager import FaceManager
from backend.services.speech.transcriber import Transcriber
from backend.api.routes import health, persons, faces, memory

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────
    logger.info("Starting Smaran backend (env={})", settings.app_env)
    await init_db()
    FaceManager.get().load()
    Transcriber.get().load()
    yield
    # ── Shutdown ─────────────────────────────────────────
    logger.info("Shutting down Smaran backend")


app = FastAPI(
    title="Smaran API",
    description="Real-time AI memory assistant — face recognition, speech, contextual recall",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],   # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
app.include_router(persons.router)
app.include_router(faces.router)
app.include_router(memory.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.backend_host,
                port=settings.backend_port, reload=True)
