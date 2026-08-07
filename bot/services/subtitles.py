import asyncio
from pathlib import Path

from faster_whisper import WhisperModel

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel("small", device="cpu", compute_type="int8")
    return _model


def _format_timestamp(seconds: float) -> str:
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    millis = round((secs - int(secs)) * 1000)
    return f"{int(hours):02d}:{int(minutes):02d}:{int(secs):02d},{millis:03d}"


def _transcribe_to_srt(source: Path) -> str:
    model = _get_model()
    segments, _info = model.transcribe(str(source))

    lines = []
    for index, segment in enumerate(segments, start=1):
        lines.append(str(index))
        lines.append(
            f"{_format_timestamp(segment.start)} --> {_format_timestamp(segment.end)}"
        )
        lines.append(segment.text.strip())
        lines.append("")

    return "\n".join(lines)


async def burn_subtitles(source: Path, destination: Path) -> bool:
    """Transcribe speech in `source` and burn it in as hardcoded subtitles.

    Returns False (leaving `destination` untouched) when no speech was
    detected, so the caller can fall back to the un-subtitled video.
    """
    srt_text = await asyncio.to_thread(_transcribe_to_srt, source)
    if not srt_text.strip():
        return False

    srt_path = source.with_suffix(".srt")
    srt_path.write_text(srt_text, encoding="utf-8")

    style = (
        "FontName=DejaVu Sans,FontSize=14,PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H00000000,BorderStyle=3,Outline=1,Alignment=2,"
        "MarginV=120"
    )
    vf = f"subtitles={srt_path}:force_style='{style}'"

    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(source),
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-c:a", "copy",
        "-movflags", "+faststart",
        str(destination),
    ]

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await process.communicate()
        if process.returncode != 0:
            raise RuntimeError(stderr.decode(errors="ignore")[-2000:])
    finally:
        srt_path.unlink(missing_ok=True)

    return True
