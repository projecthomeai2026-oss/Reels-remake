import fs from "fs";
import path from "path";

// Рилс из IMG_8195 (r8195): умные окна — автооткрывание, Алиса, зенитные фонари (Open Village).
// Плотный монтаж: вырезаны филлеры/повторы/длинноты. Хук, стильные субтитры, гифки, зумы, эффекты.

const CLIP = "r8195";
const raw = JSON.parse(fs.readFileSync(path.join("public", "captions", "raw", `${CLIP}.json`)));
const words = [];
for (const t of raw) {
  const isNewWord = t.text.startsWith(" ") || words.length === 0;
  const isPunct = /^[.,!?…:;\-–—]+$/.test(t.text.trim());
  if (isNewWord && !isPunct) words.push({ text: t.text.trim(), startMs: t.startMs, endMs: t.endMs });
  else if (words.length > 0) { words[words.length - 1].text += t.text.trimEnd().replace(/^ /, ""); words[words.length - 1].endMs = t.endMs; }
}
const WORDS = { [CLIP]: words.filter((w) => !/\[|\]|\(|\)/.test(w.text) && w.text.trim()) };
// FIX: whisper слышит «на крови» → «на кровле»
WORDS[CLIP].forEach((w) => { if (/^крови/i.test(w.text)) w.text = "кровле"; });

const item = (seg, sfx = null, capToMs = null) => ({ clip: CLIP, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate: 1, volume: 1, slow: false, sfx, captionToMs: capToMs });

// плотный монтаж — только смысловые куски (паузы/филлеры вырезаны склейками)
const items = [
  item([2.4, 11.3]),            // «Это Рус, основатель окон — придумал автоматическое открывание окна»
  item([11.3, 14.4], "whoosh"), // «Смотрите — бам! Кнопку нажимаем, когда лежим»
  item([15.0, 23.4]),           // «пришёл, отдыхаешь, не охота вставать — кнопку нажал либо Алиса»
  item([23.9, 27.1]),           // «это он придумал — может приехать и сделать»
  item([36.5, 43.6]),           // «любая задача — реализуем, найдём подход под вашу цель»
  item([44.0, 48.2]),           // «хотите впечатлить — зенитные фонари на кровле»
  item([54.5, 58.7]),           // «что касается окон, крутых профилей — пишите, всё покажут»
];

const XF = 0.35;
const starts = [];
let cur = 0;
for (const it of items) { starts.push(cur); cur += (it.toMs - it.fromMs) / 1000 - XF; }
const g = (i, localS) => Math.round((starts[i] + localS) * 1000);

const accents = [
  { atMs: g(0, 7.2), durMs: 1800, mag: 0.12 },  // «автоматическое открывание окна»
  { atMs: g(1, 0.6), durMs: 1200, mag: 0.13 },  // «бам!»
  { atMs: g(2, 8.0), durMs: 1600, mag: 0.11 },  // «интегрировал с Алисой»
  { atMs: g(5, 2.5), durMs: 1600, mag: 0.10 },  // «зенитные фонари»
];

const gifs = [
  { src: "lightning2", atMs: g(1, 0.4), durMs: 2200, mode: "sticker", pos: "tr", size: 240, label: "нажал — открыл" },
  { src: "house2",     atMs: g(2, 7.6), durMs: 2400, mode: "sticker", pos: "tr", size: 230, label: "умный дом" },
  { src: "rocket2",    atMs: g(4, 0.5), durMs: 2600, mode: "sticker", pos: "tr", size: 240, label: "любая задача" },
  { src: "sparkle2",   atMs: g(5, 2.2), durMs: 2400, mode: "sticker", pos: "tr", size: 230, label: "премиум" },
  { src: "thumbup2",   atMs: g(6, 2.6), durMs: 2200, mode: "sticker", pos: "bl", size: 220, label: "пишите" },
];

const reel = {
  id: "smart-window2",
  title: "Окно открывается само",
  music: "music6.mp3",
  series: { title: "ОКНО САМО\nОТКРЫВАЕТСЯ", location: "Новосибирск", sub: "Умные окна · Open Village" },
  accents,
  gifs,
  items,
};

fs.writeFileSync(path.join("src", "r8195-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));
const total = items.reduce((a, it) => a + (it.toMs - it.fromMs) / 1000, 0) - XF * (items.length - 1);
console.log(`smart-window2 | ${total.toFixed(1)}s (из 58.7с исходника) | сегментов: ${items.length}`);
