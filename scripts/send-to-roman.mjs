// Отправка готового рилса Роману в личку через бота @gerasimchik_stroit_bot.
// Usage: node scripts/send-to-roman.mjs <файл.mp4> ["подпись"]
// chat_id Романа берётся из ~/.config/social-tokens/roman-chat.env (ROMAN_CHAT_ID).
import fs from "fs";
import os from "os";
import path from "path";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Нет TELEGRAM_BOT_TOKEN (source telegram.env)");
  process.exit(1);
}

// chat_id Романа
let chatId = process.env.ROMAN_CHAT_ID;
if (!chatId) {
  const cfg = path.join(os.homedir(), ".config/social-tokens/roman-chat.env");
  if (fs.existsSync(cfg)) {
    const m = fs.readFileSync(cfg, "utf8").match(/ROMAN_CHAT_ID=(\S+)/);
    if (m) chatId = m[1];
  }
}
if (!chatId) {
  console.error("Нет ROMAN_CHAT_ID — сначала Роман должен написать боту /start");
  process.exit(1);
}

const file = process.argv[2];
const caption = process.argv[3] ?? "";
if (!file || !fs.existsSync(file)) {
  console.error("Файл не найден:", file);
  process.exit(1);
}

const sizeMb = fs.statSync(file).size / 1e6;
if (sizeMb > 50) {
  console.error(`Файл ${sizeMb.toFixed(1)} МБ > лимит бота 50 МБ — нужна ТГ-версия (crf выше)`);
  process.exit(1);
}

const form = new FormData();
form.append("chat_id", chatId);
if (caption) form.append("caption", caption);
form.append("supports_streaming", "true");
form.append("width", "1080");
form.append("height", "1920");
form.append(
  "video",
  new Blob([fs.readFileSync(file)], { type: "video/mp4" }),
  path.basename(file),
);

const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
  method: "POST",
  body: form,
});
const json = await res.json();
if (!json.ok) {
  console.error("FAIL", JSON.stringify(json));
  process.exit(1);
}
console.log(
  `OK → отправлено Роману (${sizeMb.toFixed(1)} МБ), message_id ${json.result.message_id}`,
);
