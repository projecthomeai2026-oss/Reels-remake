import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.environ["BOT_TOKEN"]

BASE_DIR = Path(__file__).resolve().parent.parent
TMP_DIR = BASE_DIR / "data" / "tmp"
TMP_DIR.mkdir(parents=True, exist_ok=True)

# Target format for the Reels-style output.
OUTPUT_WIDTH = 1080
OUTPUT_HEIGHT = 1920
MAX_DURATION_SECONDS = 90
