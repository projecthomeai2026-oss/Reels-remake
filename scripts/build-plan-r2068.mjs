import fs from "fs";
import path from "path";

// Рилс IMG_2068: приглашение на Open Village (5-й день, 13 готовых домов) + робот-пылесос.
// Хук-обложка + жёлтые субтитры + плашки бренда по углам (как у Андрея) + зумы/стикеры. Без затемнения.

const CLIP = "r2068";
const raw = JSON.parse(fs.readFileSync(path.join("public", "captions", "raw", `${CLIP}.json`)));
const words = [];
for (const t of raw) {
  const isNewWord = t.text.startsWith(" ") || words.length === 0;
  const isPunct = /^[.,!?…:;\-–—]+$/.test(t.text.trim());
  if (isNewWord && !isPunct) words.push({ text: t.text.trim(), startMs: t.startMs, endMs: t.endMs });
  else if (words.length > 0) { words[words.length - 1].text += t.text.trimEnd().replace(/^ /, ""); words[words.length - 1].endMs = t.endMs; }
}
const WORDS = { [CLIP]: words.filter((w) => !/\[|\]|\(|\)/.test(w.text) && w.text.trim()) };

const item = (seg, capToMs = null) => ({ clip: CLIP, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate: 1, volume: 1, slow: false, sfx: null, captionToMs: capToMs });

// один непрерывный клип 0..23.1с
const items = [ item([0.2, 23.1]) ]; // старт с «друзья» (0.0 «что» — обрезаем)

// зум-панчи по смыслу (atMs — глобально от старта)
const accents = [
  { atMs: 4300, durMs: 1900, mag: 0.12 },   // «13 готовых домов»
  { atMs: 12600, durMs: 1800, mag: 0.11 },  // «приезжайте»
  { atMs: 19200, durMs: 2000, mag: 0.12 },  // «робот-пылесос»
];

// стикеры
const gifs = [
  { src: "house2", atMs: 4200, durMs: 2600, mode: "sticker", pos: "tr", size: 240, label: "13 домов" },
  { src: "pool2", atMs: 18900, durMs: 2600, mode: "sticker", pos: "tr", size: 230, label: "робот-пылесос" },
];

const reel = {
  id: "open-village5",
  title: "Open Village · 5-й день",
  music: "music6.mp3",
  series: { title: "13 ГОТОВЫХ\nДОМОВ", location: "Новосибирск", sub: "Open Village · 5-й день" },
  accents,
  gifs,
  items,
};

fs.writeFileSync(path.join("src", "r2068-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));
const total = items.reduce((a, it) => a + (it.toMs - it.fromMs) / 1000, 0);
console.log(`open-village5 | ${total.toFixed(1)}s`);
