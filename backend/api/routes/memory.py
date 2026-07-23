#backend/api/routes/memory.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.core.auth import get_current_user
from backend.services.memory.llm import MemoryLLM
from backend.services.memory.retriever import MemoryRetriever

router = APIRouter(prefix="/memory", tags=["memory"])

class RecallRequest(BaseModel):
    person_id: int
    conversation_snippet: Optional[str] = None

@router.post("/recall")
async def recall_memory(
    payload: RecallRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    retriever = MemoryRetriever(db)
    person_context = await retriever.get_person_context(payload.person_id, user_id)

    snippet = payload.conversation_snippet
    if not snippet:
        snippet = await retriever.get_recent_snippet(payload.person_id, user_id)

    llm = MemoryLLM()
    cue = llm.recall(person_context, snippet or "(no conversation yet — this is a fresh detection)")
    return {"cue": cue}
