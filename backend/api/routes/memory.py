from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.memory.llm import MemoryLLM

router = APIRouter(prefix="/memory", tags=["memory"])

class RecallRequest(BaseModel):
    person_context: str
    conversation_snippet: str

@router.post("/recall")
async def recall_memory(payload: RecallRequest):
    llm = MemoryLLM()
    cue = llm.recall(payload.person_context, payload.conversation_snippet)
    return {"cue": cue}
