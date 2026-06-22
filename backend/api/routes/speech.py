from fastapi import APIRouter, UploadFile, File, Depends, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from loguru import logger

from backend.db.database import get_db
from backend.core.auth import get_current_user
from backend.services.speech.transcriber import Transcriber
from backend.services.speech.processor import AudioProcessor
from backend.models.conversation import ConversationLog

router = APIRouter(prefix="/speech", tags=["speech"])


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    session_id: str = Form(...),
    person_id: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Accepts a short audio clip, transcribes it via faster-whisper,
    saves the result to the conversation log, and returns the text.
    """
    audio_bytes = await audio.read()

    if not AudioProcessor.is_valid_audio(audio_bytes):
        return {"text": "", "skipped": True, "reason": "clip too short or silent"}

    path = AudioProcessor.save_chunk(audio_bytes)
    try:
        transcriber = Transcriber.get()
        result = transcriber.transcribe(path)
    finally:
        AudioProcessor.cleanup(path)

    text = result["text"].strip()
    if not text:
        return {"text": "", "skipped": True, "reason": "no speech detected"}

    log = ConversationLog(
        user_id=user_id,
        session_id=session_id,
        person_id=person_id,
        speaker="user",
        transcript=text,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)

    logger.info("Transcribed {} chars for session {}", len(text), session_id)

    return {
        "id": log.id,
        "text": text,
        "language": result["language"],
        "segments": result["segments"],
        "skipped": False,
    }


@router.get("/sessions/{session_id}")
async def get_session_transcript(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Returns the full conversation log for a session, in order."""
    from sqlalchemy import select
    result = await db.execute(
        select(ConversationLog)
        .where(ConversationLog.session_id == session_id, ConversationLog.user_id == user_id)
        .order_by(ConversationLog.timestamp.asc())
    )
    return result.scalars().all()