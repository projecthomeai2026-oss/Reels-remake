#!/bin/bash
# Авто-публикация Бассейн Серия 2 в 19:30 НСК (запускается launchd один раз).
export PATH="/Users/romejo/.nvm/versions/node/v24.18.0/bin:/usr/local/bin:/usr/bin:/bin"
PLIST="$HOME/Library/LaunchAgents/com.romejo.publish-bentley.plist"
LOG="$HOME/Desktop/Project/reels-remake/out/publish-series2.log"

# сработать один раз: сразу снять расписание
launchctl unload "$PLIST" 2>/dev/null
rm -f "$PLIST"

cd "$HOME/Desktop/Project/reels-remake" || exit 1
{
  echo ""
  echo "=================================================="
  echo "=== АВТО-ПУБЛИКАЦИЯ Бассейн Серия 2 $(date '+%Y-%m-%d %H:%M %Z') ==="
  bash scripts/publish-all.sh "$HOME/Desktop/bassein-seria2.mp4" "$(cat scripts/series2-caption.txt)"
  echo "=== ЗАВЕРШЕНО $(date '+%H:%M') ==="
} >> "$LOG" 2>&1
