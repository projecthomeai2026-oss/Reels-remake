import fs from "fs";
import path from "path";

// Рилс «Ремонт Бентли-Невада» — монтаж из клипов: обзор → кухня → бамбук → двери → бассейн.
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

const CLIPS = ["IMG_1883", "IMG_1885", "IMG_1886", "IMG_1887", "IMG_1884"];
const WORDS = {};
for (const c of CLIPS) WORDS[c] = rawWords(c);
// мат оставляем в звуке, на экране мягко прикрываем
for (const c of CLIPS) WORDS[c].forEach((w) => { w.text = w.text.replace(/разъеб\w*/gi, "огонь").replace(/(?:за)?ебал\w*/gi, "достали"); });

const item = (clip, from, to, opts = {}) => ({
  clip, fromMs: Math.round(from), toMs: Math.round(to),
  rate: 1, volume: opts.volume ?? 1, slow: false, sfx: null, captionToMs: opts.captionToMs ?? null,
});

const items = [
  item("IMG_1883", 0, 11500),      // обзор: «ремонт полным ходом… два прораба здесь»
  item("IMG_1885", 9000, 17800),   // кухня: «активно собирают кухню, потрясающего цвета»
  item("IMG_1886", 500, 9500),     // бамбуковые панели: «основную часть уже сделали»
  item("IMG_1887", 3500, 14000),   // двери: «скотч отрываете… аккуратно, чтобы не поцарапали»
  item("IMG_1884", 13500, 25500),  // бассейн: «здесь бассейн на фоне Шанхая, будем кайфовать»
];

const XFADE = 350;
let cur = 0; const segs = [];
for (const it of items) { segs.push({ ...it, gStart: cur }); cur += (it.toMs - it.fromMs) - XFADE; }
// глобальное время момента (clip = имя клипа, clipMs = тайминг внутри клипа)
const g = (clip, clipMs) => { const s = segs.find((x) => x.clip === clip && clipMs >= x.fromMs && clipMs <= x.toMs); return s ? Math.round(s.gStart + (clipMs - s.fromMs)) : 0; };

const reel = {
  id: "bentley-remont2",
  title: "Ремонт Бентли-Невада — полным ходом",
  music: "music7.mp3",
  series: { title: "РЕМОНТ\nПОЛНЫМ ХОДОМ", location: "Бентли-Невада", sub: "Экскурсия по стройке" },
  accents: [
    { atMs: g("IMG_1885", 13000), durMs: 2200 }, // кухня «приятного цвета»
    { atMs: g("IMG_1886", 5000), durMs: 2200 },  // бамбук
    { atMs: g("IMG_1884", 16000), durMs: 2400, mag: 0.2 }, // бассейн
  ],
  gifs: [
    { src: "fire2", atMs: g("IMG_1886", 5000), durMs: 2200, mode: "sticker", pos: "tr", size: 200, label: "бамбук" },
    { src: "pool2", atMs: g("IMG_1884", 15500), durMs: 2600, mode: "sticker", pos: "tr", size: 220, label: "бассейн" },
  ],
  items,
};

fs.writeFileSync(path.join("src", "bentley2-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));
const total = items.reduce((a, it) => a + (it.toMs - it.fromMs), 0) - XFADE * (items.length - 1);
console.log(`bentley-remont2 | ${(total / 1000).toFixed(1)}s | сегментов: ${items.length}`);
