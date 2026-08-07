import asyncio
import random
from pathlib import Path

import aiohttp

from bot.config import GIPHY_API_KEY

GIPHY_SEARCH_URL = "https://api.giphy.com/v1/gifs/search"
DEFAULT_QUERIES = ["excited", "fire", "wow", "cool", "lol"]


class GifOverlayError(RuntimeError):
    pass


async def _fetch_gif_url(query: str) -> str | None:
    params = {"api_key": GIPHY_API_KEY, "q": query, "limit": 1, "rating": "g"}

    async with aiohttp.ClientSession() as session:
        async with session.get(GIPHY_SEARCH_URL, params=params) as resp:
            if resp.status != 200:
                raise GifOverlayError(f"Giphy API error: {resp.status}")
            data = await resp.json()

    results = data.get("data") or []
    if not results:
        return None
    return results[0]["images"]["fixed_height"]["url"]


async def add_gif_overlay(
    source: Path, destination: Path, query: str | None = None
) -> bool:
    """Overlay a Giphy GIF onto the top-right corner of the video.

    Returns False (leaving `destination` untouched) when no API key is
    configured or no matching gif was found, so the caller can fall back
    to the un-decorated video.
    """
    if not GIPHY_API_KEY:
        return False

    gif_url = await _fetch_gif_url(query or random.choice(DEFAULT_QUERIES))
    if gif_url is None:
        return False

    gif_path = source.with_suffix(".gif")
    async with aiohttp.ClientSession() as session:
        async with session.get(gif_url) as resp:
            gif_path.write_bytes(await resp.read())

    try:
        cmd = [
            "ffmpeg",
            "-y",
            "-i", str(source),
            "-stream_loop", "-1",
            "-i", str(gif_path),
            "-filter_complex",
            "[1:v]scale=320:-1[gif];[0:v][gif]overlay=W-w-40:40:shortest=1",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "23",
            "-c:a", "copy",
            str(destination),
        ]
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await process.communicate()
        if process.returncode != 0:
            raise GifOverlayError(stderr.decode(errors="ignore")[-2000:])
    finally:
        gif_path.unlink(missing_ok=True)

    return True
