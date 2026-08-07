import fs from "fs";
import path from "path";

// Рилс: утреннее приглашение с бассейна на выставку Open Village (3-й день).
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

const WORDS = { pool97: rawWords("pool97") };

const item = (clip, from, to, opts = {}) => ({
  clip, fromMs: Math.round(from), toMs: Math.round(to),
  rate: 1, volume: opts.volume ?? 1, slow: false, sfx: null, captionToMs: opts.captionToMs ?? null,
});

const items = [ item("pool97", 0, 21700) ];
const g = (clipMs) => clipMs; // один сегмент с 0

const reel = {
  id: "pool-village",
  title: "Утро у бассейна · приглашение на Open Village",
  music: "music6.mp3",
  series: { title: "УТРО\nУ БАССЕЙНА", location: "Open Village", sub: "3-й день · выставка домов" },
  accents: [
    { atMs: g(4500), durMs: 2400 },  // «13 готовых домов»
    { atMs: g(17300), durMs: 2600 }, // «покайфовать у бассейна»
  ],
  gifs: [
    { src: "house2", atMs: g(4500), durMs: 2600, mode: "sticker", pos: "tr", size: 210, label: "13 домов" },
    { src: "pool2", atMs: g(16800), durMs: 2800, mode: "sticker", pos: "tr", size: 220, label: "у бассейна" },
  ],
  items,
};

fs.writeFileSync(path.join("src", "pool97-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));
const total = items.reduce((a, it) => a + (it.toMs - it.fromMs), 0);
console.log(`pool-village | ${(total / 1000).toFixed(1)}s | слов: ${WORDS.pool97.length}`);
