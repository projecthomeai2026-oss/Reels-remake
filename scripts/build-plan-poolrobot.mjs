import fs from "fs";
import path from "path";

// Рилс «Как чистить бассейн» v2 — новый материал: робот-пылесос (p80) + немой хук-заход (p84).
// По вчерашнему кино-шаблону: без чёрной заставки, без виньетки, люди целиком, бодрая музыка,
// 3 ключевые фразы (slam/slide/wipe), B&W субтитры + жёлтый keyword, плашки ДВА ПРОРАБА.

const CLIPS = [["p80", "p80g"], ["p84", "p84g"]];
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
  WORDS[clip] = words.filter((w) => !/\[|\]|\(|\)/.test(w.text) && w.text.trim() && !/Воинова|Кулакова|Редактор|Корректор|субтитров/i.test(w.text));
}
// FIX: whisper мисслышал «подрицающий» — поправляем на «прекрасный»
WORDS.p80g.forEach((w) => { if (/подрицающий/i.test(w.text)) w.text = "прекрасный"; });

const item  = (clip, seg, shot, sfx = null, capToMs = null) => ({ clip, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate: 1, volume: 1, slow: false, sfx, captionToMs: capToMs, shot });
const broll = (clip, seg, shot) => ({ clip, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate: 1, volume: 0, slow: false, sfx: null, captionToMs: Math.round(seg[0] * 1000), shot });

const items = [
  broll("p84g", [0.0, 3.0], "wide"),               // немой хук-заход: идёт со щёткой к бассейну
  item("p80g", [0.1, 16.9], "pov", "impact"),      // «бассейн готов… вопрос от чистки… покупаем пылесосик… врубаем, отпускаем»
  item("p80g", [18.9, 30.6], "close", "whoosh"),   // «программа два часа… сам погружается и всё чистит… партнёров отмечаю»
];

const XF = 0.15;
const starts = [];
let cur = 0;
for (const it of items) { starts.push(cur); cur += (it.toMs - it.fromMs) / 1000 - XF; }
const g = (i, localS) => Math.round((starts[i] + localS) * 1000);

const heroPhrases = [
  { atMs: g(1, 7.6), durMs: 2000, anim: "slam",  pre: "ПОКУПАЕМ",   key: "ПЫЛЕСОСИК" },  // «покупаем вот такой пылесосик»
  { atMs: g(2, 0.1), durMs: 1900, anim: "slide", pre: "ДВА ЧАСА —", key: "И ГОТОВО" },    // «программа два часа»
  { atMs: g(2, 2.0), durMs: 2000, anim: "wipe",  pre: "ВСЁ ЧИСТИТ", key: "САМ" },         // «полностью ездит, всё чистит»
];

const sfxTrack = [
  { atMs: g(1, 7.6), src: "impact", vol: 0.5 },
];

const accents = [
  { atMs: g(1, 7.6), durMs: 1600, mag: 0.13 },  // «покупаем пылесосик»
  { atMs: g(1, 14.6), durMs: 1500, mag: 0.11 }, // «вот так его врубаем»
  { atMs: g(2, 0.1), durMs: 1700, mag: 0.13 },  // «программа два часа»
  { atMs: g(2, 2.0), durMs: 1600, mag: 0.12 },  // «всё чистит»
];

const gifs = [
  { src: "pool2",   atMs: g(1, 7.5), durMs: 2400, mode: "sticker", pos: "tr", size: 230, label: "робот-пылесос" },
  { src: "timer2",  atMs: g(2, 0.0), durMs: 2600, mode: "sticker", pos: "tr", size: 230, label: "2 часа" },
  { src: "sparkle2",atMs: g(2, 2.2), durMs: 2400, mode: "sticker", pos: "bl", size: 220, label: "чисто" },
];

const reel = {
  id: "pool-robot",
  title: "Как чистить бассейн",
  music: "music5.mp3",
  series: { title: "БАССЕЙН\nЧИСТИТ СЕБЯ", location: "Новосибирск", sub: "Робот-пылесос за 2 часа" },
  heroPhrases, sfxTrack, accents, gifs, items,
};

fs.writeFileSync(path.join("src", "poolrobot-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));
const total = items.reduce((a, it) => a + (it.toMs - it.fromMs) / 1000, 0) - XF * (items.length - 1);
console.log(`pool-robot | ${total.toFixed(1)}s | сегментов: ${items.length}`);
