"""
Transcriber — wraps faster-whisper for offline, streaming-compatible STT.
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
        logger.info("Loading Whisper model: {} on {}", settings.whisper_model_size, settings.whisper_device)
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

        Key settings explained:
        - vad_filter: Voice Activity Detection — skips silence-only segments
          before even running Whisper on them. Cuts hallucinations on quiet
          chunks dramatically (Whisper famously invents text on silence).
        - vad_parameters: silence_threshold is how quiet "silent" is (0.5 is
          default; lower = more aggressive filtering). min_silence_duration_ms
          avoids splitting on brief natural pauses mid-sentence.
        - beam_size=5: standard quality/speed tradeoff, fine to leave as-is.
        - temperature=0.0: deterministic decoding — no sampling randomness,
          gives more consistent results for live transcription where you want
          stability over creativity.
        - condition_on_previous_text=False: stops the model from conditioning
          each segment on what it just said, which can cause repetition loops
          on short clips where there isn't enough audio context.
        - no_speech_threshold=0.6: if Whisper's own confidence that a segment
          contains speech is below 60%, discard it rather than transcribing
          whatever noise it heard.
        """
        if self._model is None:
            raise RuntimeError("Transcriber not loaded — call load() first")

        segments, info = self._model.transcribe(
            audio_path,
            language=settings.whisper_language if settings.whisper_language != "auto" else None,
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