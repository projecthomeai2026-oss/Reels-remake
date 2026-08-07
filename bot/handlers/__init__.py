from aiogram import Router

from bot.handlers.start import router as start_router
from bot.handlers.video import router as video_router

router = Router()
router.include_router(start_router)
router.include_router(video_router)
