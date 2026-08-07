import asyncio
from pathlib import Path

from bot.config import MAX_DURATION_SECONDS, OUTPUT_HEIGHT, OUTPUT_WIDTH


class VideoProcessingError(RuntimeError):
    pass


async def to_reels_format(source: Path, destination: Path) -> None:
    """Convert an arbitrary video into a vertical 9:16 Reels-style clip.

    The original frame is kept intact (nothing is cropped out) and centered
    over a blurred, zoomed-in copy of itself that fills the rest of the
    1080x1920 canvas. Trims to MAX_DURATION_SECONDS so the result is ready
    to post as a Reel/Short.
    """
    filter_complex = (
        f"[0:v]scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,"
        f"crop={OUTPUT_WIDTH}:{OUTPUT_HEIGHT},gblur=sigma=20[bg];"
        f"[0:v]scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease[fg];"
        f"[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]"
    )
    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(source),
        "-t", str(MAX_DURATION_SECONDS),
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-map", "0:a?",
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
