"""
LLM wrapper — uses Ollama Python client for contextual memory recall.
"""
from __future__ import annotations
import ollama
from loguru import logger
from backend.core.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are Smaran, an intelligent memory assistant helping someone recall
information about people they interact with. Given context about a person and a recent
conversation snippet, provide brief, natural memory cues — past interactions, topics they
care about, or relevant personal details. Be concise (2-3 sentences max). Never fabricate
details not present in the context."""

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
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
            )
            return response["message"]["content"].strip()
        except Exception as e:
            logger.error("LLM recall failed: {}", e)
            return ""
