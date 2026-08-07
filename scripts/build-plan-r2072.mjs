import fs from "fs";
import path from "path";

// Рилс «Умное окно»: панорамный фасад + автоматическая створка 170 кг с пульта (Open Village).
// Из IMG_2072 (r2072) и IMG_2073 (r2073). Стиль: хук, жёлтые субтитры, плашки бренда,
// тематические гифки, зумы, звук-эффекты. Мат — грубые куски НЕ берём, оставшееся цензурим.

const CLIPS = ["r2072", "r2073"];
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
// FIX распознавания: whisper слышит «колесе» → «Алисе», «сворка» → «створка»
WORDS.r2073.forEach((w) => {
  if (/колесе/i.test(w.text)) w.text = w.text.replace(/колесе/i, "Алисе");
  if (/сворка/i.test(w.text)) w.text = w.text.replace(/сворка/i, "створка");
});

const item = (clip, seg, sfx = null, capToMs = null) => ({ clip, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate: 1, volume: 1, slow: false, sfx, captionToMs: capToMs });

// монтаж: демо-первым, вау (170 кг) в центр, ценность и «премиум» в финал
const items = [
  item("r2073", [12.9, 18.4]),            // «в фасаде огромный глухарь — окно, которое не открывается»
  item("r2073", [19.8, 28.6], "whoosh"),  // «не глухарь — и оно открывается! электропривод, к Алисе и умному дому»
  item("r2073", [29.5, 35.6], "impact"),  // «створка весом 170 кг — на автоматике»
  item("r2073", [40.9, 44.8]),            // «полностью открылась и закрылась с кнопки пульта»
  item("r2072", [10.0, 14.5]),            // «автоматическое открывание — бам, кнопку нажимаем»
  item("r2073", [47.3, 52.9]),            // «стоит всё решение +70–100 тысяч, в зависимости от размера»
  item("r2072", [44.9, 48.6]),            // «хотите произвести впечатление — зенитные фонари на кровле»
];

const XF = 0.35;
const starts = [];
let cur = 0;
for (const it of items) { starts.push(cur); cur += (it.toMs - it.fromMs) / 1000 - XF; }
const g = (i, localS) => Math.round((starts[i] + localS) * 1000);

const accents = [
  { atMs: g(1, 1.9), durMs: 1800, mag: 0.11 },  // «нажимаем на электропривод»
  { atMs: g(2, 3.4), durMs: 2200, mag: 0.14 },  // «170 килограмм»
  { atMs: g(3, 2.8), durMs: 1600, mag: 0.11 },  // «с кнопки пульта»
  { atMs: g(6, 2.2), durMs: 1600, mag: 0.10 },  // «зенитные фонари»
];

const gifs = [
  { src: "lightning2", atMs: g(1, 1.7), durMs: 2400, mode: "sticker", pos: "tr", size: 230, label: "автоматика" },
  { src: "rocket2",    atMs: g(2, 3.0), durMs: 2600, mode: "sticker", pos: "tr", size: 250, label: "170 кг" },
  { src: "thumbup2",   atMs: g(3, 2.4), durMs: 2200, mode: "sticker", pos: "bl", size: 220, label: "с пульта" },
  { src: "sparkle2",   atMs: g(6, 2.0), durMs: 2400, mode: "sticker", pos: "tr", size: 230, label: "премиум" },
];

const reel = {
  id: "smart-window",
  title: "Умное окно 170 кг",
  music: "music6.mp3",
  series: { title: "ОКНО\n170 КГ", location: "Новосибирск", sub: "Умный фасад · Open Village" },
  accents,
  gifs,
  items,
};

fs.writeFileSync(path.join("src", "r2072-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));
const total = items.reduce((a, it) => a + (it.toMs - it.fromMs) / 1000, 0) - XF * (items.length - 1);
console.log(`smart-window | ${total.toFixed(1)}s | сегментов: ${items.length}`);
for (let i = 0; i < items.length; i++) console.log(`  ${items[i].clip} [${(items[i].fromMs/1000).toFixed(1)}-${(items[i].toMs/1000).toFixed(1)}] @${starts[i].toFixed(1)}s`);
