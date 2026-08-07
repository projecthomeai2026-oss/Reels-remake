import asyncio
from pathlib import Path

from bot.config import MAX_DURATION_SECONDS, OUTPUT_HEIGHT, OUTPUT_WIDTH


class VideoProcessingError(RuntimeError):
    pass


async def to_reels_format(source: Path, destination: Path) -> None:
    """Convert an arbitrary video into a vertical 9:16 Reels-style clip.

    Crops to fill the target frame (rather than padding), and trims to
    MAX_DURATION_SECONDS so the result is ready to post as a Reel/Short.
    """
    vf = (
        f"scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,"
        f"crop={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}"
    )
    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(source),
        "-t", str(MAX_DURATION_SECONDS),
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        str(destination),
    ]

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await process.communicate()

    if process.returncode != 0:
        raise VideoProcessingError(stderr.decode(errors="ignore")[-2000:])
