"""
MemoryRetriever — fetches everything needed to generate a memory cue
for a detected person: their stored profile/notes, plus recent transcript
if the live session hasn't produced one yet.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.person import Person
from backend.models.conversation import ConversationLog
from backend.core.exceptions import PersonNotFoundError
from backend.services.memory.context import build_person_context


class MemoryRetriever:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_person_context(self, person_id: int, user_id: str) -> str:
        """Fetch a person (scoped to the requesting user) and build their context string."""
        person = await self.db.get(Person, person_id)
        if not person or person.user_id != user_id:
            raise PersonNotFoundError(person_id)
        return build_person_context(person)

    async def get_recent_snippet(self, person_id: int, user_id: str, limit: int = 5) -> str:
        """
        Most recent transcript chunks tied to this person, across sessions.
        Used as a stand-in 'current conversation' when the cue is requested
        right at detection time, before any new speech has been transcribed.
        """
        result = await self.db.execute(
            select(ConversationLog)
            .where(ConversationLog.person_id == person_id, ConversationLog.user_id == user_id)
            .order_by(ConversationLog.timestamp.desc())
            .limit(limit)
        )
        logs = result.scalars().all()
        logs.reverse()  # chronological order for the prompt
        return " ".join(log.transcript for log in logs)