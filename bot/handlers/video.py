import uuid

from aiogram import F, Router
from aiogram.types import FSInputFile, Message

from bot.config import TMP_DIR
from bot.services.music import MusicMixError, add_background_music
from bot.services.remotion_renderer import RemotionRenderError, add_caption
from bot.services.subtitles import burn_subtitles
from bot.services.video_processor import VideoProcessingError, to_reels_format

router = Router()

ProcessingError = (VideoProcessingError, RemotionRenderError, MusicMixError)


@router.message(F.video | (F.document & F.document.mime_type.startswith("video/")))
async def handle_video(message: Message) -> None:
    file_id = message.video.file_id if message.video else message.document.file_id
    caption = message.caption

    job_id = uuid.uuid4().hex
    source_path = TMP_DIR / f"{job_id}_1_src.mp4"
    reels_path = TMP_DIR / f"{job_id}_2_reels.mp4"
    captioned_path = TMP_DIR / f"{job_id}_3_captioned.mp4"
    subtitled_path = TMP_DIR / f"{job_id}_4_subtitled.mp4"
    final_path = TMP_DIR / f"{job_id}_5_final.mp4"
    all_temp_paths = [
        source_path,
        reels_path,
        captioned_path,
        subtitled_path,
        final_path,
    ]

    status = await message.answer("Принял видео, начинаю монтаж...")

    try:
        file = await message.bot.get_file(file_id)
        await message.bot.download_file(file.file_path, destination=source_path)

        await to_reels_format(source_path, reels_path)
        result_path = reels_path

        if caption:
            await add_caption(result_path, captioned_path, caption)
            result_path = captioned_path

        if await burn_subtitles(result_path, subtitled_path):
            result_path = subtitled_path

        await add_background_music(result_path, final_path)
        result_path = final_path

        await message.answer_video(
            FSInputFile(result_path),
            caption="Готово! Вертикальный формат, субтитры и музыка добавлены.",
        )
    except ProcessingError:
        await message.answer("Не удалось обработать видео — попробуйте другой файл.")
    finally:
        await status.delete()
        for path in all_temp_paths:
            path.unlink(missing_ok=True)
