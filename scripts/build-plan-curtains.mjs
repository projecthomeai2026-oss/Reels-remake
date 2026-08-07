import fs from "fs";
import path from "path";

// Рилс «Умные шторы» — по кино-шаблону (как вчера, Руслан), из IMG_2078 (r2078g) + IMG_2079 (r2079g).
// Шоу-дом «Бентли-Невада», 6-й день выставки: шторы закрываются жестом и с пульта.
// БЕЗ чёрной заставки. Хук поверх чистого кадра, B&W субтитры + жёлтый keyword, плашки ДВА ПРОРАБА.

const CLIPS = [["r2078", "r2078g"], ["r2079", "r2079g"]];
const WORDS = {};
for (const [audio, clip] of CLIPS) {
  const raw = JSON.parse(fs.readFileSync(path.join("public", "captions", "raw", `${audio}.json`)));
  const words = [];
  for (const t of raw) {
    const isNewWord = t.text.startsWith(" ") || words.length === 0;
    const isPunct = /^[.,!?…:;\-–—]+$/.test(t.text.trim());
    if (isNewWord && !isPunct) words.push({ text: t.text.trim(), startMs: t.startMs, endMs: t.endMs });
    else if (words.length > 0) { words[words.length - 1].text += t.text.trimEnd().replace(/^ /, ""); words[words.length - 1].endMs = t.endMs; }
  }
  WORDS[clip] = words.filter((w) => !/\[|\]|\(|\)|\*/.test(w.text) && w.text.trim() && !/Воинова|Кулакова|Редактор|Корректор|субтитров/i.test(w.text));
}

const item = (clip, seg, shot, sfx = null, capToMs = null) => ({ clip, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate: 1, volume: 1, slow: false, sfx, captionToMs: capToMs, shot });

const items = [
  item("r2078g", [5.3, 12.7], "wide"),           // «6-й день выставки, мы в Бентли-Неваде — расскажу фишки по ремонту и интерьеру»
  item("r2078g", [15.4, 19.3], "wide"),          // «есть прекрасные партнёры — сейчас покажу со шторами приколюшечку»
  item("r2079g", [0.0, 6.0], "pov"),             // «наши партнёры делают вот такую крутую штуку»
  item("r2079g", [6.9, 13.0], "close", "whoosh"),// «надо закрыть шторы — дали направление, они сами закрываются и открываются»
  item("r2079g", [14.0, 18.2], "pov"),           // «и конечно всё это можно с пульта управления»
  item("r2079g", [28.4, 33.2], "wide"),          // «жду на выставку посмотреть лично. Пока!»
];

const XF = 0.15;
const starts = [];
let cur = 0;
for (const it of items) { starts.push(cur); cur += (it.toMs - it.fromMs) / 1000 - XF; }
const g = (i, localS) => Math.round((starts[i] + localS) * 1000);

const heroPhrases = [
  { atMs: g(3, 4.5), durMs: 2000, anim: "slam",  pre: "ШТОРЫ",  key: "САМИ" },       // «они сами закрываются»
  { atMs: g(4, 3.4), durMs: 1900, anim: "slide", pre: "И С",    key: "ПУЛЬТА" },      // «с пульта управления»
  { atMs: g(5, 0.9), durMs: 2000, anim: "wipe",  pre: "ЖДУ НА", key: "ВЫСТАВКЕ" },    // CTA
];

const sfxTrack = [
  { atMs: g(3, 4.5), src: "impact", vol: 0.5 },
];

const accents = [
  { atMs: g(0, 5.2), durMs: 1600, mag: 0.12 },  // «прикольные фишки»
  { atMs: g(3, 4.5), durMs: 1700, mag: 0.14 },  // «сами закрываются»
  { atMs: g(4, 3.4), durMs: 1500, mag: 0.12 },  // «с пульта»
  { atMs: g(5, 0.9), durMs: 1500, mag: 0.10 },  // «жду на выставке»
];

const gifs = [
  { src: "house2",     atMs: g(0, 1.5), durMs: 2200, mode: "sticker", pos: "tr", size: 220, label: "6-й день" },
  { src: "lightning2", atMs: g(3, 4.2), durMs: 2200, mode: "sticker", pos: "tr", size: 230, label: "автоматика" },
  { src: "thumbup2",   atMs: g(4, 3.0), durMs: 2000, mode: "sticker", pos: "bl", size: 220, label: "с пульта" },
];

const reel = {
  id: "smart-curtains",
  title: "Умные шторы · Бентли-Невада",
  music: "music5.mp3",
  series: { title: "УМНЫЕ\nШТОРЫ", location: "Новосибирск", sub: "Бентли-Невада · 6-й день выставки" },
  heroPhrases, sfxTrack, accents, gifs, items,
};

fs.writeFileSync(path.join("src", "curtains-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));
const total = items.reduce((a, it) => a + (it.toMs - it.fromMs) / 1000, 0) - XF * (items.length - 1);
console.log(`smart-curtains | ${total.toFixed(1)}s | сегментов: ${items.length}`);
