import asyncio
import random
from pathlib import Path

import aiohttp

from bot.config import GIPHY_API_KEY

GIPHY_SEARCH_URL = "https://api.giphy.com/v1/gifs/search"
DEFAULT_QUERIES = ["excited", "fire", "wow", "cool", "lol", "sparkles", "hype"]
GIF_COUNT = 3


class GifOverlayError(RuntimeError):
    pass


async def _fetch_gif_urls(query: str, count: int) -> list[str]:
    params = {"api_key": GIPHY_API_KEY, "q": query, "limit": count, "rating": "g"}

    async with aiohttp.ClientSession() as session:
        async with session.get(GIPHY_SEARCH_URL, params=params) as resp:
            if resp.status != 200:
                raise GifOverlayError(f"Giphy API error: {resp.status}")
            data = await resp.json()

    return [item["images"]["fixed_height"]["url"] for item in data.get("data") or []]


async def _fetch_gif_url(query: str) -> str | None:
    urls = await _fetch_gif_urls(query, count=1)
    return urls[0] if urls else None


async def _get_duration(path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        str(path),
    ]
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await process.communicate()
    return float(stdout.strip())


async def add_gif_overlay(
    source: Path, destination: Path, query: str | None = None
) -> bool:
    """Overlay a rotating sequence of Giphy GIFs in the top-right corner.

    The video is split into equal segments (one per GIF) so a fresh GIF
    plays in each. Returns False (leaving `destination` untouched) when
    no API key is configured or no matching gifs were found, so the
    caller can fall back to the un-decorated video.
    """
    if not GIPHY_API_KEY:
        return False

    if query:
        urls = await _fetch_gif_urls(query, count=GIF_COUNT)
    else:
        queries = random.sample(DEFAULT_QUERIES, k=min(GIF_COUNT, len(DEFAULT_QUERIES)))
        fetched = await asyncio.gather(*(_fetch_gif_url(q) for q in queries))
        urls = [url for url in fetched if url]

    if not urls:
        return False

    duration = await _get_duration(source)
    segment = duration / len(urls)

    gif_paths = []
    async with aiohttp.ClientSession() as session:
        for index, url in enumerate(urls):
            async with session.get(url) as resp:
                gif_path = source.with_suffix(f".{index}.gif")
                gif_path.write_bytes(await resp.read())
                gif_paths.append(gif_path)

    try:
        inputs = ["-i", str(source)]
        for gif_path in gif_paths:
            inputs += ["-ignore_loop", "0", "-i", str(gif_path)]

        filter_parts = []
        prev = "0:v"
        for index in range(len(gif_paths)):
            start = index * segment
            end = duration if index == len(gif_paths) - 1 else (index + 1) * segment
            scaled = f"g{index}"
            out = f"v{index + 1}"
            filter_parts.append(f"[{index + 1}:v]scale=380:-1[{scaled}]")
            filter_parts.append(
                f"[{prev}][{scaled}]overlay=W-w-40:40:"
                f"enable='between(t,{start:.3f},{end:.3f})'[{out}]"
            )
            prev = out

        cmd = [
            "ffmpeg",
            "-y",
            *inputs,
            "-filter_complex", ";".join(filter_parts),
            "-map", f"[{prev}]",
            "-map", "0:a?",
            "-t", f"{duration:.3f}",
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
        for gif_path in gif_paths:
            gif_path.unlink(missing_ok=True)

    return True
