import asyncio
import math
from pathlib import Path

SPIN_SIZE = 360
# Bounding box big enough to hold the square photo at any rotation angle.
SPIN_CANVAS = math.ceil(SPIN_SIZE * math.sqrt(2))
SECONDS_PER_ROTATION = 3


class PhotoOverlayError(RuntimeError):
    pass


async def add_spinning_photo(source: Path, photo: Path, destination: Path) -> None:
    """Overlay a photo in the bottom-left corner, spinning continuously."""
    angle = f"2*PI*t/{SECONDS_PER_ROTATION}"
    filter_complex = (
        f"[1:v]scale={SPIN_SIZE}:{SPIN_SIZE}:force_original_aspect_ratio=decrease,"
        f"pad={SPIN_SIZE}:{SPIN_SIZE}:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba,"
        f"rotate={angle}:c=black@0:ow={SPIN_CANVAS}:oh={SPIN_CANVAS}[spin];"
        f"[0:v][spin]overlay=40:H-h-40:shortest=1"
    )

    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(source),
        "-loop", "1",
        "-i", str(photo),
        "-filter_complex", filter_complex,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-c:a", "copy",
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
        raise PhotoOverlayError(stderr.decode(errors="ignore")[-2000:])
