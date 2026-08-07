import asyncio
import json
import shutil
from pathlib import Path

from bot.config import BASE_DIR

REMOTION_DIR = BASE_DIR / "remotion"
STATIC_INPUT_DIR = REMOTION_DIR / "public" / "input"
STATIC_INPUT_DIR.mkdir(parents=True, exist_ok=True)


class RemotionRenderError(RuntimeError):
    pass


async def add_caption(source: Path, destination: Path, caption: str) -> None:
    """Overlay a text caption onto an already-formatted vertical video.

    Remotion only serves files placed under its project's public/ folder,
    so the source is staged there under a unique name before rendering.
    """
    destination = destination.resolve()
    staged_source = STATIC_INPUT_DIR / f"{destination.stem}{source.suffix}"
    shutil.copy(source, staged_source)

    try:
        props = json.dumps(
            {"videoSrc": f"input/{staged_source.name}", "caption": caption}
        )
        cmd = [
            "npx",
            "remotion",
            "render",
            "src/index.ts",
            "ReelsCaption",
            str(destination),
            f"--props={props}",
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=REMOTION_DIR,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await process.communicate()

        if process.returncode != 0:
            raise RemotionRenderError(stderr.decode(errors="ignore")[-2000:])
    finally:
        staged_source.unlink(missing_ok=True)


async def add_word_subtitles(
    source: Path, destination: Path, words: list[dict]
) -> None:
    """Burn CapCut-style word-by-word highlighted captions onto a video."""
    destination = destination.resolve()
    staged_source = STATIC_INPUT_DIR / f"{destination.stem}{source.suffix}"
    shutil.copy(source, staged_source)

    try:
        props = json.dumps(
            {"videoSrc": f"input/{staged_source.name}", "words": words}
        )
        cmd = [
            "npx",
            "remotion",
            "render",
            "src/index.ts",
            "CapCutSubtitles",
            str(destination),
            f"--props={props}",
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=REMOTION_DIR,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await process.communicate()

        if process.returncode != 0:
            raise RemotionRenderError(stderr.decode(errors="ignore")[-2000:])
    finally:
        staged_source.unlink(missing_ok=True)
