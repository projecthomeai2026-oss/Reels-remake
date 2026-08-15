import uuid

from aiogram import F, Router
from aiogram.types import FSInputFile, Message

from bot.config import TMP_DIR
from bot.handlers.photo import pending_photos
from bot.services.gif_overlay import GifOverlayError, add_gif_overlay
from bot.services.music import MusicMixError, add_background_music
from bot.services.photo_overlay import PhotoOverlayError, add_spinning_photo
from bot.services.remotion_renderer import (
    RemotionRenderError,
    add_caption,
    add_word_subtitles,
)
from bot.services.subtitles import transcribe_words
from bot.services.video_processor import VideoProcessingError, to_reels_format

router = Router()

ProcessingError = (
    VideoProcessingError,
    RemotionRenderError,
    MusicMixError,
    GifOverlayError,
    PhotoOverlayError,
)


@router.message(F.video | (F.document & F.document.mime_type.startswith("video/")))
async def handle_video(message: Message) -> None:
    file_id = message.video.file_id if message.video else message.document.file_id
    caption = message.caption

    job_id = uuid.uuid4().hex
    source_path = TMP_DIR / f"{job_id}_1_src.mp4"
    reels_path = TMP_DIR / f"{job_id}_2_reels.mp4"
    captioned_path = TMP_DIR / f"{job_id}_3_captioned.mp4"
    subtitled_path = TMP_DIR / f"{job_id}_4_subtitled.mp4"
    photo_path_out = TMP_DIR / f"{job_id}_5_photo.mp4"
    gif_path = TMP_DIR / f"{job_id}_6_gif.mp4"
    final_path = TMP_DIR / f"{job_id}_7_final.mp4"
    all_temp_paths = [
        source_path,
        reels_path,
        captioned_path,
        subtitled_path,
        photo_path_out,
        gif_path,
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

        words = await transcribe_words(source_path)
        if words:
            await add_word_subtitles(result_path, subtitled_path, words)
            result_path = subtitled_path

        pending_photo = pending_photos.pop(message.chat.id, None)
        if pending_photo:
            await add_spinning_photo(result_path, pending_photo, photo_path_out)
            result_path = photo_path_out
            pending_photo.unlink(missing_ok=True)

        if await add_gif_overlay(result_path, gif_path, query=caption):
            result_path = gif_path

        await add_background_music(result_path, final_path)
        result_path = final_path

        await message.answer_video(
            FSInputFile(result_path),
            caption="Готово! Вертикальный формат, субтитры, гифка и музыка добавлены.",
        )
    except ProcessingError:
        await message.answer("Не удалось обработать видео — попробуйте другой файл.")
    finally:
        await status.delete()
        for path in all_temp_paths:
            path.unlink(missing_ok=True)
