#backend/services/memory/llm.py
"""
LLM wrapper — uses Ollama Python client for contextual memory recall
and conversation summarization.
"""
from __future__ import annotations
import ollama
from loguru import logger
from backend.core.config import get_settings
from datetime import datetime

settings = get_settings()

RECALL_SYSTEM_PROMPT = """You are Smaran, an intelligent memory assistant helping someone recall
information about people they interact with. Given context about a person and a recent
conversation snippet, provide brief, natural memory cues — past interactions, topics they
care about, or relevant personal details. Be concise (2-3 sentences max). Never fabricate
details not present in the context."""

SUMMARY_SYSTEM_PROMPT = """You are Smaran, an intelligent memory assistant. 
Summarize the following conversation transcript into 2-4 short bullet points capturing:
- Key topics discussed
- Any decisions made or action items
- Emotional tone or anything notable about the interaction
Be factual and concise. Use plain bullet points starting with "•". Never fabricate."""


class MemoryLLM:
    def recall(self, person_context: str, conversation_snippet: str) -> str:
        prompt = (
            f"Person context:\n{person_context}\n\n"
            f"Current conversation snippet:\n{conversation_snippet}\n\n"
            "Provide a helpful memory cue:"
        )
        try:
            response = ollama.chat(
                model=settings.ollama_model,
                messages=[
                    {"role": "system", "content": RECALL_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
            )
            return response["message"]["content"].strip()
        except Exception as e:
            logger.error("LLM recall failed: {}", e)
            return ""

    def summarize(self, transcript: str, person_name: str) -> str:
        """
        Summarizes a full session transcript into bullet points.
        Returns a dated note block ready to be appended to Person.notes.
        """
        if not transcript.strip():
            return ""
        prompt = (
            f"Person: {person_name}\n\n"
            f"Conversation transcript:\n{transcript}\n\n"
            "Summarize this conversation:"
        )
        try:
            response = ollama.chat(
                model=settings.ollama_model,
                messages=[
                    {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
            )
            summary = response["message"]["content"].strip()
            date_str = datetime.now().strftime("%Y-%m-%d %H:%M")
            return f"\n[{date_str}]\n{summary}"
        except Exception as e:
            logger.error("LLM summarize failed: {}", e)
            return ""