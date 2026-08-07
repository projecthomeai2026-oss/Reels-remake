import asyncio
import random
from pathlib import Path

from bot.config import BASE_DIR

MUSIC_DIR = BASE_DIR / "assets" / "music"


class MusicMixError(RuntimeError):
    pass


def _pick_track() -> Path:
    tracks = sorted(MUSIC_DIR.glob("*.mp3"))
    return random.choice(tracks)


async def _has_audio_stream(source: Path) -> bool:
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "a",
        "-show_entries", "stream=index",
        "-of", "csv=p=0",
        str(source),
    ]
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await process.communicate()
    return bool(stdout.strip())


async def add_background_music(source: Path, destination: Path) -> None:
    track = _pick_track()
    has_audio = await _has_audio_stream(source)

    if has_audio:
        filter_complex = (
            "[1:a]volume=0.25[music];"
            "[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[a]"
        )
        maps = ["-map", "0:v", "-map", "[a]"]
    else:
        filter_complex = "[1:a]volume=0.25[a]"
        maps = ["-map", "0:v", "-map", "[a]"]

    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(source),
        "-stream_loop", "-1",
        "-i", str(track),
        "-filter_complex", filter_complex,
        *maps,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        str(destination),
    ]

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await process.communicate()

    if process.returncode != 0:
        raise MusicMixError(stderr.decode(errors="ignore")[-2000:])
