"""
Builds the plain-text context block describing a person, for use in
LLM prompts (recall cues, summarization, etc).
"""
from __future__ import annotations
from backend.models.person import Person


def build_person_context(person: Person, max_notes_chars: int = 2000) -> str:
    """
    Turns a Person row into a compact text block for the LLM.
    Notes are appended chronologically over time (see speech.py summarize),
    so if they've grown long we keep the most recent tail rather than
    the oldest history — recent context matters most for a fresh recall cue.
    """
    lines = [f"Name: {person.name}"]
    if person.nickname:
        lines.append(f"Nickname: {person.nickname}")
    if person.relation:
        lines.append(f"Relation: {person.relation}")

    if person.notes:
        notes = person.notes.strip()
        if len(notes) > max_notes_chars:
            notes = "...(earlier history omitted)...\n" + notes[-max_notes_chars:]
        lines.append(f"Past conversation history:\n{notes}")
    else:
        lines.append("Past conversation history: none yet — this is likely a first interaction.")

    return "\n".join(lines)