from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

router = Router()


@router.message(Command("start"))
async def handle_start(message: Message) -> None:
    await message.answer(
        "Пришлите видео, и я сделаю из него вертикальный клип под Reels "
        "(обрезка до 9:16, ограничение по длительности)."
    )
