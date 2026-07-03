"""
Transcript deduplication — since audio chunks are recorded with a slight
overlap (to avoid clipping words at chunk boundaries), the same words can
appear at the tail of one transcript and the head of the next. This finds
and trims that overlap so the saved conversation log doesn't repeat itself.
"""
from __future__ import annotations


def trim_overlap(previous_text: str, new_text: str, max_overlap_words: int = 12) -> str:
    """
    Looks for a run of words at the end of `previous_text` that also appears
    at the start of `new_text`, and strips that repeated portion from the
    start of `new_text`.

    Uses a simple word-level match rather than fuzzy matching — Whisper's
    transcription of the same overlapped audio is usually word-identical
    or very close, so exact matching on the trailing words is enough.
    """
    if not previous_text or not new_text:
        return new_text

    prev_words = previous_text.strip().split()
    new_words = new_text.strip().split()

    if not prev_words or not new_words:
        return new_text

    max_check = min(max_overlap_words, len(prev_words), len(new_words))

    # Try the longest possible overlap first, shrinking until we find a match
    for overlap_len in range(max_check, 0, -1):
        prev_tail = [w.lower().strip(".,!?") for w in prev_words[-overlap_len:]]
        new_head = [w.lower().strip(".,!?") for w in new_words[:overlap_len]]
        if prev_tail == new_head:
            return " ".join(new_words[overlap_len:]).strip()

    return new_text