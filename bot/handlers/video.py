import uuid

from aiogram import F, Router
from aiogram.types import FSInputFile, Message

from bot.config import TMP_DIR
from bot.services.remotion_renderer import RemotionRenderError, add_caption
from bot.services.video_processor import VideoProcessingError, to_reels_format

router = Router()


@router.message(F.video | (F.document & F.document.mime_type.startswith("video/")))
async def handle_video(message: Message) -> None:
    file_id = message.video.file_id if message.video else message.document.file_id
    caption = message.caption

    job_id = uuid.uuid4().hex
    source_path = TMP_DIR / f"{job_id}_src.mp4"
    reels_path = TMP_DIR / f"{job_id}_reels.mp4"
    captioned_path = TMP_DIR / f"{job_id}_captioned.mp4"

    status = await message.answer("Принял видео, начинаю монтаж...")

    try:
        file = await message.bot.get_file(file_id)
        await message.bot.download_file(file.file_path, destination=source_path)

        await to_reels_format(source_path, reels_path)

        if caption:
            await add_caption(reels_path, captioned_path, caption)
            result_path = captioned_path
        else:
            result_path = reels_path

        await message.answer_video(
            FSInputFile(result_path),
            caption="Готово! Вертикальный формат под Reels.",
        )
    except (VideoProcessingError, RemotionRenderError):
        await message.answer("Не удалось обработать видео — попробуйте другой файл.")
    finally:
        await status.delete()
        source_path.unlink(missing_ok=True)
        reels_path.unlink(missing_ok=True)
        captioned_path.unlink(missing_ok=True)
