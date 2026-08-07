import fs from "fs";
import path from "path";

// Рилс «Тихие стены» (звукоизоляция) — интервью из IMG_1875 в Бентли-Невада.
// Два блока: устройство (акустический синтепон → профиль → полотно) + финал про соседей.

const rawWords = (file, shift = 0) => {
  const raw = JSON.parse(fs.readFileSync(path.join("public", "captions", "raw", `${file}.json`)));
  const words = [];
  for (const t of raw) {
    const isNewWord = t.text.startsWith(" ") || words.length === 0;
    const isPunct = /^[.,!?…:;\-–—]+$/.test(t.text.trim());
    if (isNewWord && !isPunct) words.push({ text: t.text.trim(), startMs: t.startMs + shift, endMs: t.endMs + shift });
    else if (words.length > 0) { words[words.length - 1].text += t.text.trimEnd().replace(/^ /, ""); words[words.length - 1].endMs = t.endMs + shift; }
  }
  return words.filter((w) => !/\[|\]|\(|\)/.test(w.text) && w.text.trim());
};

const WORDS = { IMG_1875: rawWords("IMG_1875") };
// мат оставляем в звуке, но на экране мягко прикрываем (чтобы площадки не резали охват)
WORDS.IMG_1875.forEach((w) => { w.text = w.text.replace(/заебали/gi, "за**али").replace(/разъеб\w*/gi, "разнос"); });

const item = (clip, from, to, opts = {}) => ({
  clip, fromMs: Math.round(from), toMs: Math.round(to),
  rate: 1, volume: opts.volume ?? 1, slow: false, sfx: null, captionToMs: opts.captionToMs ?? null,
});

const items = [
  item("IMG_1875", 105700, 110700), // ХУК: «кайф, мы людей не убиваем, ну понятно понятно» (продлён)
  item("IMG_1875", 13500, 47500),   // устройство: спальни, акустический синтепон, профиль, полотно-финал
  item("IMG_1875", 93500, 105700),  // партнёры: «если соседи достали — приедем, всё сделаем, никто уметь не будет»
  item("IMG_1875", 111500, 119400, { captionToMs: 118200 }), // финал: «…соседей потише сделать с кайфом» (продлён, чтоб фраза договорилась; субтитры до «кайфом», без мусора распознавания)
];

// глобальное время слова с учётом сегментов + кросс-фейд (клип встречается в нескольких сегментах — ищем по диапазону)
const XFADE = 350;
let cur = 0; const segs = [];
for (const it of items) { segs.push({ ...it, gStart: cur }); cur += (it.toMs - it.fromMs) - XFADE; }
const g = (clipMs) => { const s = segs.find((x) => clipMs >= x.fromMs && clipMs <= x.toMs) || segs[segs.length - 1]; return Math.round(s.gStart + (clipMs - s.fromMs)); };

const reel = {
  id: "tihie-steny",
  title: "Тихие стены · звукоизоляция в Бентли-Невада",
  music: "music6.mp3",
  series: { title: "МЫ ЛЮДЕЙ\nНЕ УБИВАЕМ", location: "Бентли-Невада", sub: "Звукоизоляция · тихие стены" },
  accents: [
    { atMs: g(26200), durMs: 2400 }, // «акустический синтепон»
    { atMs: g(46200), durMs: 2400 }, // «закрываем полотном — финал»
    { atMs: g(115600), durMs: 2200, mag: 0.24 }, // «соседей потише» — финал
  ],
  gifs: [
    { src: "shh2", atMs: g(17500) - 200, durMs: 2600, mode: "sticker", pos: "tr", size: 210, label: "тихо" },   // «устройство тихих стен»
    { src: "sleep2", atMs: g(115200), durMs: 2600, mode: "sticker", pos: "tr", size: 230, label: "соседи спят" }, // «соседей потише»
  ],
  items,
};

fs.writeFileSync(path.join("src", "tihie-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));
const total = items.reduce((a, it) => a + (it.toMs - it.fromMs), 0) - XFADE * (items.length - 1);
console.log(`tihie-steny | ${(total / 1000).toFixed(1)}s | сегментов: ${items.length}`);
