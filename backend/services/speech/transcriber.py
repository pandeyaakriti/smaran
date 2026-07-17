"""
Transcriber — wraps faster-whisper for offline, streaming-compatible STT.

Two models are loaded:
- base   → English (fast, accurate enough for en)
- small  → Nepali  (base cannot reliably distinguish Nepali from Urdu/Hindi;
                    small has meaningfully better Devanagari coverage)

English path is completely unchanged.
"""
from __future__ import annotations
from loguru import logger
from backend.core.config import get_settings

settings = get_settings()

# A longer, conversational Nepali prompt gives the decoder stronger
# Devanagari context. The more Devanagari tokens it sees before the
# audio starts, the less likely it is to drift toward Hindi or Urdu.
_NEPALI_INITIAL_PROMPT = (
    "यो एक नेपाली वार्तालाप हो। "
    "हामी नेपाली भाषामा कुरा गर्दैछौं। "
    "कृपया नेपाली शब्दहरू सही तरिकाले लेख्नुहोस्।"
)
# Translation: "This is a Nepali conversation. We are speaking in the Nepali
# language. Please write the Nepali words correctly."


class Transcriber:
    _instance: "Transcriber | None" = None

    def __init__(self):
        self._model_en = None   # base  — English
        self._model_ne = None   # small — Nepali

    @classmethod
    def get(cls) -> "Transcriber":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(self):
        from faster_whisper import WhisperModel

        logger.info("Loading Whisper base model for English...")
        self._model_en = WhisperModel(
            "base",
            device=settings.whisper_device,
            compute_type="int8",
        )

        logger.info("Loading Whisper small model for Nepali...")
        self._model_ne = WhisperModel(
            "small",
            device=settings.whisper_device,
            compute_type="int8",
        )

        logger.info("Transcriber ready — base (en) + small (ne).")

    def transcribe(self, audio_path: str, language: str | None = None) -> dict:
        """
        Transcribe an audio file.
        Returns: { "text": str, "language": str, "segments": [...] }

        language: "en" | "ne" | None (auto-detect using base model)

        Priority: explicit language arg > None (auto-detect).
        The .env WHISPER_LANGUAGE is intentionally ignored here — the
        frontend toggle is the source of truth during a live session.
        """
        if self._model_en is None or self._model_ne is None:
            raise RuntimeError("Transcriber not loaded — call load() first")

        is_nepali = language == "ne"
        model = self._model_ne if is_nepali else self._model_en

        # Shared params — same for both languages
        common_params = dict(
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

        if is_nepali:
            extra = dict(
                language="ne",
                initial_prompt=_NEPALI_INITIAL_PROMPT,
                # best_of=3 runs 3 decode passes and picks the highest-scoring
                # result. Slows transcription ~2-3x but meaningfully improves
                # word accuracy on short conversational Nepali clips.
                best_of=3,
                # Slightly higher beam size for Nepali — more candidates to
                # search through before committing to a word.
                beam_size=8,
            )
        else:
            # English — no initial prompt, no extra passes needed
            extra = dict(
                language=language,   # "en" or None for auto-detect
            )

        segments, info = model.transcribe(audio_path, **common_params, **extra)

        seg_list = [{"start": s.start, "end": s.end, "text": s.text} for s in segments]
        full_text = " ".join(s["text"].strip() for s in seg_list)
        return {"text": full_text, "language": info.language, "segments": seg_list}