import asyncio
from pathlib import Path

from faster_whisper import WhisperModel

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel("small", device="cpu", compute_type="int8")
    return _model


def _transcribe_words(source: Path) -> list[dict]:
    model = _get_model()
    segments, _info = model.transcribe(str(source), word_timestamps=True)

    words = []
    for segment in segments:
        for word in segment.words or []:
            text = word.word.strip()
            if text:
                words.append({"text": text, "start": word.start, "end": word.end})
    return words


async def transcribe_words(source: Path) -> list[dict] | None:
    """Transcribe speech in `source` into word-level timed captions.

    Returns None when no speech was detected, so the caller can skip
    the subtitle step entirely.
    """
    words = await asyncio.to_thread(_transcribe_words, source)
    return words or None
