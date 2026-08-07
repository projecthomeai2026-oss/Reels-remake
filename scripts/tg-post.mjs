// Пост видео в Telegram-канал от имени бота.
// Usage: node scripts/tg-post.mjs <файл.mp4> ["подпись"]
import fs from "fs";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = "@gerasimchik_stroit";
const file = process.argv[2];
const caption = process.argv[3] ?? "";
if (!token || !file || !fs.existsSync(file)) { console.error("нет токена/файла"); process.exit(1); }

const form = new FormData();
form.append("chat_id", chatId);
if (caption) form.append("caption", caption);
form.append("supports_streaming", "true");
form.append("width", "1080");
form.append("height", "1920");
form.append("video", new Blob([fs.readFileSync(file)], { type: "video/mp4" }), "reel.mp4");

const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, { method: "POST", body: form });
const json = await res.json();
if (!json.ok) { console.error("TG post FAIL:", JSON.stringify(json)); process.exit(1); }
console.log("TG post OK ✓ message_id:", json.result.message_id);
