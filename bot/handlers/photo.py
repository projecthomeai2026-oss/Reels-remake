import uuid
from pathlib import Path

from aiogram import F, Router
from aiogram.types import Message

from bot.config import TMP_DIR

router = Router()

# chat_id -> path of the photo to spin into the next video sent in that chat.
pending_photos: dict[int, Path] = {}


@router.message(F.photo)
async def handle_photo(message: Message) -> None:
    photo = message.photo[-1]
    photo_path = TMP_DIR / f"pending_{uuid.uuid4().hex}.jpg"

    file = await message.bot.get_file(photo.file_id)
    await message.bot.download_file(file.file_path, destination=photo_path)

    old_path = pending_photos.pop(message.chat.id, None)
    if old_path:
        old_path.unlink(missing_ok=True)

    pending_photos[message.chat.id] = photo_path
    await message.answer(
        "Фото сохранено! Пришлите видео — вставлю это фото туда вращающимся."
    )
