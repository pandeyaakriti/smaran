"""
AudioProcessor — handles incoming audio bytes from the frontend mic capture,
saving them as temp WAV files that the Transcriber can read.

The frontend sends short audio chunks (e.g. 3-5 second clips) rather than
a continuous stream, which keeps this simple: write bytes to disk, hand
the path to faster-whisper, clean up after.
"""
from __future__ import annotations
import os
import uuid
import tempfile
from pathlib import Path
from loguru import logger

# Where temp audio chunks get written before transcription.
# Cleaned up immediately after each transcription completes.
AUDIO_TMP_DIR = Path(tempfile.gettempdir()) / "smaran_audio"
AUDIO_TMP_DIR.mkdir(exist_ok=True)


class AudioProcessor:
    @staticmethod
    def save_chunk(audio_bytes: bytes, suffix: str = ".webm") -> str:
        """
        Writes raw audio bytes to a uniquely named temp file.
        Returns the file path for the Transcriber to consume.
        """
        filename = f"{uuid.uuid4().hex}{suffix}"
        path = AUDIO_TMP_DIR / filename
        with open(path, "wb") as f:
            f.write(audio_bytes)
        return str(path)

    @staticmethod
    def cleanup(path: str):
        """Deletes a temp audio file after it's been transcribed."""
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
        except Exception as e:
            logger.warning("Failed to clean up audio temp file {}: {}", path, e)

    @staticmethod
    def is_valid_audio(audio_bytes: bytes, min_bytes: int = 1000) -> bool:
        """
        Basic sanity check — rejects empty or tiny clips (e.g. silence-only
        chunks under ~1KB) before wasting a Whisper call on them.
        """
        return len(audio_bytes) >= min_bytes