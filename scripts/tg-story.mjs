// Публикация истории (Story) в Telegram от имени личного аккаунта Романа
// через Telegram Business (business connection). Usage: node scripts/tg-story.mjs <файл.mp4> ["подпись"]
import fs from "fs";

const token = process.env.TELEGRAM_BOT_TOKEN;
const bizConn = process.env.TG_BUSINESS_CONNECTION;
const file = process.argv[2];
const caption = process.argv[3] ?? "";
if (!token || !bizConn || !file || !fs.existsSync(file)) { console.error("нет токена/business connection/файла"); process.exit(1); }

const form = new FormData();
form.append("business_connection_id", bizConn);
form.append("content", JSON.stringify({ type: "video", video: "attach://vid" }));
form.append("active_period", "86400"); // 24 часа
form.append("post_to_chat_page", "true"); // сохранить историю в профиле
if (caption) form.append("caption", caption);
form.append("vid", new Blob([fs.readFileSync(file)], { type: "video/mp4" }), "story.mp4");

const res = await fetch(`https://api.telegram.org/bot${token}/postStory`, { method: "POST", body: form });
const json = await res.json();
if (!json.ok) { console.error("TG story FAIL:", JSON.stringify(json)); process.exit(1); }
console.log("TG story OK ✓ id:", json.result?.id);
