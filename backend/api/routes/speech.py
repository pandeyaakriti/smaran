from fastapi import APIRouter, UploadFile, File, Depends, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from loguru import logger

from backend.db.database import get_db
from backend.core.auth import get_current_user
from backend.services.speech.transcriber import Transcriber
from backend.services.speech.processor import AudioProcessor
import backend.services.speech.dedup
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
    trims any text that overlaps with the previous chunk in this session
    (chunks are recorded with intentional overlap to avoid clipping words
    at boundaries), saves the result, and returns the new text only.
    """
    audio_bytes = await audio.read()

    if not AudioProcessor.is_valid_audio(audio_bytes):
        return {"text": "", "skipped": True, "reason": "clip too short or silent"}

    path = AudioProcessor.save_chunk(audio_bytes, suffix=".webm")
    try:
        transcriber = Transcriber.get()
        result = transcriber.transcribe(path)
    finally:
        AudioProcessor.cleanup(path)

    raw_text = result["text"].strip()
    if not raw_text:
        return {"text": "", "skipped": True, "reason": "no speech detected"}

    # Fetch the most recent transcript in this session to dedupe against
    prev_result = await db.execute(
        select(ConversationLog)
        .where(ConversationLog.session_id == session_id, ConversationLog.user_id == user_id)
        .order_by(ConversationLog.timestamp.desc())
        .limit(1)
    )
    previous_log = prev_result.scalar_one_or_none()
    previous_text = previous_log.transcript if previous_log else ""

    text = backend.services.speech.dedup.trim_overlap(previous_text, raw_text)

    if not text:
        # The entire chunk was just a repeat of the previous one — nothing new
        return {"text": "", "skipped": True, "reason": "duplicate of previous chunk"}

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
    result = await db.execute(
        select(ConversationLog)
        .where(ConversationLog.session_id == session_id, ConversationLog.user_id == user_id)
        .order_by(ConversationLog.timestamp.asc())
    )
    return result.scalars().all()