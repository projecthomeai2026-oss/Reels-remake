import fs from "fs";
import path from "path";

// Рилс «Как чистить бассейн» из трёх клипов (pc1/pc2/pc3): робот-пылесос.
// Хук-обложка + жёлтые субтитры + плашки бренда + зумы/стикеры. Без затемнения.

const CLIPS = ["pc1", "pc2", "pc3"];

const loadWords = (clip) => {
  const raw = JSON.parse(fs.readFileSync(path.join("public", "captions", "raw", `${clip}.json`)));
  const words = [];
  for (const t of raw) {
    const isNewWord = t.text.startsWith(" ") || words.length === 0;
    const isPunct = /^[.,!?…:;\-–—]+$/.test(t.text.trim());
    if (isNewWord && !isPunct) words.push({ text: t.text.trim(), startMs: t.startMs, endMs: t.endMs });
    else if (words.length > 0) { words[words.length - 1].text += t.text.trimEnd().replace(/^ /, ""); words[words.length - 1].endMs = t.endMs; }
  }
  return words.filter((w) => !/\[|\]|\(|\)/.test(w.text) && w.text.trim());
};

const WORDS = {};
for (const c of CLIPS) WORDS[c] = loadWords(c);
// FIX распознавания: whisper слышит «постеном», Роман говорит «потихоньку»
WORDS.pc3.forEach((w) => { if (w.text === "постеном") w.text = "потихоньку"; });

const item = (clip, seg, capToMs = null) => ({ clip, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate: 1, volume: 1, slow: false, sfx: null, captionToMs: capToMs });
// замедленный немой b-roll: rate<1 растягивает, volume 0, субтитры выключены (captionToMs 0)
const slow = (clip, seg, rate) => ({ clip, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate, volume: 0, slow: true, sfx: null, captionToMs: 0 });

// Разговорный блок (речь) + замедленный «залипательный» монтаж работы робота под музыку
const items = [
  item("pc1", [0.0, 7.56]),          // «итак друзья, коротко как чистить бассейн — подключаем в розетку»
  item("pc2", [1.05, 6.68]),         // «робот-пылесос в розетку для очистки — он начнёт делать своё дело»
  item("pc3", [0.0, 15.22], 15300),  // «программу на 2 часа — ездит, прочищает сам — отдыхаем, наслаждаемся»
  // === замедленный монтаж (≈0.5–0.6x), без речи ===
  slow("pc3", [6.0, 12.5], 0.5),     // робот скользит по дну — крупно, залипательно (6.5с → 13с)
  slow("pc2", [3.6, 6.68], 0.6),     // робот заходит в воду (3.1с → 5.1с)
  slow("pc1", [3.9, 7.2], 0.55),     // общий план бассейна + опускаем робота (3.3с → 6с)
];

// глобальные старты сегментов (учёт XFADE 0.35с перекрытия) — для акцентов/стикеров
const XF = 0.35;
const starts = [];
let cur = 0;
for (const it of items) { starts.push(cur); cur += (it.toMs - it.fromMs) / 1000 - XF; }
const g = (i, localS) => Math.round((starts[i] + localS) * 1000);

// зум-панчи по смыслу
const accents = [
  { atMs: g(0, 2.0), durMs: 1600, mag: 0.10 },   // «чистить бассейн»
  { atMs: g(0, 5.2), durMs: 1800, mag: 0.12 },   // «подключаем в розетку»
  { atMs: g(1, 0.2), durMs: 1700, mag: 0.13 },   // «робот-пылесос»
  { atMs: g(2, 3.2), durMs: 1600, mag: 0.11 },   // «на два часа запускаем»
  { atMs: g(2, 8.0), durMs: 2200, mag: 0.12 },   // «прочищает самостоятельно»
  { atMs: g(2, 13.2), durMs: 1800, mag: 0.10 },  // «отдыхаем, наслаждаемся»
];

// стикеры по смыслу
const gifs = [
  { src: "pool2", atMs: g(1, 0.3), durMs: 2400, mode: "sticker", pos: "tr", size: 230, label: "робот-пылесос" },
  { src: "timer2", atMs: g(2, 2.4), durMs: 2600, mode: "sticker", pos: "tr", size: 230, label: "2 часа" },
  { src: "sparkle2", atMs: g(2, 7.8), durMs: 2600, mode: "sticker", pos: "bl", size: 220, label: "чисто" },
  { src: "sleep2", atMs: g(2, 12.9), durMs: 2400, mode: "sticker", pos: "tr", size: 230, label: "отдыхаем" },
];

const reel = {
  id: "pool-clean",
  title: "Как чистить бассейн",
  music: "music6.mp3",
  series: { title: "КАК ЧИСТИТЬ\nБАССЕЙН", location: "Новосибирск", sub: "Лайфхак от прораба" },
  outro: { title: "БАССЕЙНЫ\nПОД КЛЮЧ", sub: "Два прораба · Новосибирск", cta: "Пиши в директ" },
  accents,
  gifs,
  items,
};

fs.writeFileSync(path.join("src", "poolclean-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));

const total = items.reduce((a, it) => a + (it.toMs - it.fromMs) / 1000, 0) - XF * (items.length - 1);
console.log(`pool-clean | ${total.toFixed(1)}s | сегментов: ${items.length}`);
for (let i = 0; i < items.length; i++) console.log(`  ${items[i].clip} @${starts[i].toFixed(1)}s`);
