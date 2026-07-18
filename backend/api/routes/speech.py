from fastapi import APIRouter, UploadFile, File, Depends, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel
from loguru import logger

from backend.db.database import get_db
from backend.core.auth import get_current_user
from backend.services.speech.transcriber import Transcriber
from backend.services.speech.processor import AudioProcessor
from backend.services.speech.dedup import trim_overlap
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

    text = trim_overlap(previous_text, raw_text)

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


class SummarizeRequest(BaseModel):
    session_id: str
    person_id: int


@router.post("/summarize")
async def summarize_session(
    payload: SummarizeRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Called when a session ends and a person was detected.
    Fetches all transcript chunks for the session, asks the LLM to summarize,
    and appends the summary to the person's notes field.
    """
    from sqlalchemy import select
    from backend.models.person import Person
    from backend.services.memory.llm import MemoryLLM
    from backend.core.exceptions import PersonNotFoundError

    # Verify person belongs to this user
    person = await db.get(Person, payload.person_id)
    if not person or person.user_id != user_id:
        raise PersonNotFoundError(payload.person_id)

    # Fetch all transcript chunks for this session in order
    result = await db.execute(
        select(ConversationLog)
        .where(
            ConversationLog.session_id == payload.session_id,
            ConversationLog.user_id == user_id,
        )
        .order_by(ConversationLog.timestamp.asc())
    )
    logs = result.scalars().all()

    if not logs:
        return {"status": "skipped", "reason": "no transcript found for session"}

    full_transcript = " ".join(log.transcript for log in logs)

    llm = MemoryLLM()
    summary = llm.summarize(full_transcript, person.name)

    if not summary:
        return {"status": "skipped", "reason": "LLM returned empty summary"}

    # Append to existing notes (never overwrites — always adds)
    person.notes = (person.notes or "") + summary
    await db.commit()

    logger.info("Appended summary to {} (person_id={})", person.name, person.id)
    return {"status": "saved", "person_id": person.id, "summary": summary}