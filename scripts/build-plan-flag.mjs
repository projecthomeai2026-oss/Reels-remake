import fs from "fs";
import path from "path";

// Рилс: проход с флагом ДВА ПРОРАБА + приглашение на выставку Open Village (речь есть).
// Оригинальный звук клипа, жёлтые субтитры, без зум-эффектов и без затемнения.

const rawWords = (file) => {
  const raw = JSON.parse(fs.readFileSync(path.join("public", "captions", "raw", `${file}.json`)));
  const words = [];
  for (const t of raw) {
    const isNewWord = t.text.startsWith(" ") || words.length === 0;
    const isPunct = /^[.,!?…:;\-–—]+$/.test(t.text.trim());
    if (isNewWord && !isPunct) words.push({ text: t.text.trim(), startMs: t.startMs, endMs: t.endMs });
    else if (words.length > 0) { words[words.length - 1].text += t.text.trimEnd().replace(/^ /, ""); words[words.length - 1].endMs = t.endMs; }
  }
  return words.filter((w) => !/\[|\]|\(|\)/.test(w.text) && w.text.trim());
};

const WORDS = { "flag-walk": rawWords("flag-walk") };
// правки распознавания
WORDS["flag-walk"].forEach((w) => {
  if (/пиццы/i.test(w.text)) w.text = "фишки";
  if (w.text === "2") w.text = "ДВА";
});

const item = (clip, from, to, opts = {}) => ({
  clip, fromMs: Math.round(from), toMs: Math.round(to),
  rate: 1, volume: opts.volume ?? 1, slow: false, sfx: null, captionToMs: opts.captionToMs ?? null,
});

const items = [ item("flag-walk", 0, 24600, { volume: 1 }) ]; // оригинальный звук клипа

const reel = {
  id: "flag-village",
  title: "ДВА ПРОРАБА · приглашение на Open Village",
  music: "music5.mp3",
  series: { title: "ДВА\nПРОРАБА", location: "Open Village", sub: "Выставка загородных домов" },
  accents: [], // без зум-эффектов
  gifs: [],
  items,
};

fs.writeFileSync(path.join("src", "flag-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));
const total = items.reduce((a, it) => a + (it.toMs - it.fromMs), 0);
console.log(`flag-village | ${(total / 1000).toFixed(1)}s | слов: ${WORDS["flag-walk"].length}`);
