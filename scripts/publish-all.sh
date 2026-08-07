#!/bin/bash
# Единая публикация рилса ВЕЗДЕ: посты (TG канал, ВК стена, IG Reels) +
# истории (TG страница, ВК сообщество, IG story). Готовит форматы сам.
#
# Usage:
#   scripts/publish-all.sh <финал.mp4> "<описание с хэштегами>" [опции]
# Опции:
#   --no-stories   только посты, без историй
#   --no-ig        пропустить Instagram (посты и историю)
#   --title "..."  название для ВК-видео (по умолчанию первая строка описания)
#
# Требует конфиги в ~/.config/social-tokens/: telegram.env, vk.env, instagram.env

set -e
cd "$(dirname "$0")/.."
FF=~/Library/Python/3.9/lib/python/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1

FINAL="$1"; DESC="$2"; shift 2 || true
[ -z "$FINAL" ] || [ ! -f "$FINAL" ] && { echo "❌ укажи финальный mp4"; exit 1; }
[ -z "$DESC" ] && { echo "❌ укажи описание"; exit 1; }

STORIES=1; DO_IG=1; TITLE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-stories) STORIES=0 ;;
    --no-ig) DO_IG=0 ;;
    --title) TITLE="$2"; shift ;;
  esac
  shift
done
[ -z "$TITLE" ] && TITLE=$(echo "$DESC" | head -1)

set -a; source ~/.config/social-tokens/telegram.env; source ~/.config/social-tokens/vk.env; source ~/.config/social-tokens/instagram.env; set +a

TMP=$(mktemp -d)
IG="$TMP/post.mp4"      # bt709 tv, IG/VK посты + IG/VK истории (высокое качество)
TGP="$TMP/tg-post.mp4"  # ≤50 МБ — для Telegram-поста (бот-лимит)
STORY="$TMP/story.mp4"  # весь рилс (макс 59с, ≤30 МБ) — для TG/VK/IG историй

DUR=$("$FF" -i "$FINAL" 2>&1 | grep Duration | sed 's/.*Duration: \([0-9:.]*\).*/\1/' | awk -F: '{print ($1*3600)+($2*60)+$3}')
# битрейт под 45 МБ для TG-поста (лимит бота 50)
TGBR=$(awk "BEGIN{b=int(45*8*1024/$DUR); print (b>4500?4500:b)}")

echo "🎬 Готовлю форматы (длина ${DUR}с)…"
# IG/пост-версия (правильная яркость, bt709 tv)
"$FF" -y -i "$FINAL" -vf "scale=in_range=full:out_range=tv,format=yuv420p" \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:v libx264 -preset medium -crf 19 -maxrate 12M -bufsize 24M -profile:v high -level 4.1 \
  -movflags +faststart -c:a aac -ar 48000 -b:a 128k "$IG" >/dev/null 2>&1
# TG-пост ≤50 МБ
"$FF" -y -i "$IG" -c:v libx264 -preset medium -crf 25 -maxrate ${TGBR}k -bufsize $((TGBR*2))k \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k "$TGP" >/dev/null 2>&1
# сторис = ВЕСЬ рилс (не тизер); IG/TG сторис ≤60с и ≤30 МБ, поэтому режем максимум до 59с
"$FF" -y -i "$IG" -t 59 -c:v libx264 -preset medium -crf 27 -maxrate 4000k -bufsize 8M \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k "$STORY" >/dev/null 2>&1
echo "   пост: $(du -h "$IG" | cut -f1) | TG-пост: $(du -h "$TGP" | cut -f1) | история: $(du -h "$STORY" | cut -f1)"

echo ""; echo "📢 ПОСТЫ:"
echo "— Telegram канал…"; node scripts/tg-post.mjs "$TGP" "$DESC" || echo "  ⚠ TG пост не удался"
echo "— ВК стена…";       node scripts/vk-publish.mjs "$IG" "$TITLE" "$DESC" || echo "  ⚠ ВК пост не удался"
if [ "$DO_IG" = 1 ]; then
  echo "— Instagram Reels…"; node scripts/ig-publish.mjs "$IG" "$DESC" 4000 || echo "  ⚠ IG пост не удался"
fi

if [ "$STORIES" = 1 ]; then
  echo ""; echo "📸 ИСТОРИИ:"
  echo "— Telegram страница…"; node scripts/tg-story.mjs "$STORY" || echo "  ⚠ TG история не удалась"
  echo "— ВК сообщество…";     node scripts/vk-story.mjs "$STORY" || echo "  ⚠ ВК история не удалась"
  if [ "$DO_IG" = 1 ]; then
    echo "— Instagram история…"; node scripts/ig-story.mjs "$STORY" || echo "  ⚠ IG история не удалась"
  fi
fi

rm -rf "$TMP"
echo ""; echo "✅ Готово. Проверь публикации. Коллаб в IG (dva.proraba/tilernso) — добавь вручную, API не умеет."
