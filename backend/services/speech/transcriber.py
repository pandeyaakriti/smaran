"""
Transcriber — wraps faster-whisper for offline English speech-to-text.
"""
from __future__ import annotations
from loguru import logger
from backend.core.config import get_settings

settings = get_settings()


class Transcriber:
    _instance: "Transcriber | None" = None

    def __init__(self):
        self._model = None

    @classmethod
    def get(cls) -> "Transcriber":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(self):
        from faster_whisper import WhisperModel
        logger.info("Loading Whisper {} model...", settings.whisper_model_size)
        self._model = WhisperModel(
            settings.whisper_model_size,
            device=settings.whisper_device,
            compute_type="int8",
        )
        logger.info("Transcriber ready.")

    def transcribe(self, audio_path: str) -> dict:
        """
        Transcribe an audio file. Returns:
        { "text": str, "language": str, "segments": [...] }
        """
        if self._model is None:
            raise RuntimeError("Transcriber not loaded — call load() first")

        segments, info = self._model.transcribe(
            audio_path,
            language="en",
            beam_size=5,
            temperature=0.0,
            condition_on_previous_text=False,
            no_speech_threshold=0.6,
            vad_filter=True,
            vad_parameters={
                "threshold": 0.5,
                "min_silence_duration_ms": 300,
                "speech_pad_ms": 200,
            },
        )

        seg_list = [{"start": s.start, "end": s.end, "text": s.text} for s in segments]
        full_text = " ".join(s["text"].strip() for s in seg_list)
        return {"text": full_text, "language": info.language, "segments": seg_list}