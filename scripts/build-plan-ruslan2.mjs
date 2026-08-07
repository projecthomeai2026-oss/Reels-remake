import fs from "fs";
import path from "path";

// ЧАСТЬ 2 «Руслан · Райт Окна» из IMG_2073 (демо створки 170 кг). Тот же кино-шаблон.
// Дописывает второй reel в src/ruslan-plan.json (часть 1 уже там). Без заставки — для бесшовной склейки.

const AUDIO = "r2073";
const CLIP = "r2073g";
const raw = JSON.parse(fs.readFileSync(path.join("public", "captions", "raw", `${AUDIO}.json`)));
const words = [];
for (const t of raw) {
  const isNewWord = t.text.startsWith(" ") || words.length === 0;
  const isPunct = /^[.,!?…:;\-–—]+$/.test(t.text.trim());
  if (isNewWord && !isPunct) words.push({ text: t.text.trim(), startMs: t.startMs, endMs: t.endMs });
  else if (words.length > 0) { words[words.length - 1].text += t.text.trimEnd().replace(/^ /, ""); words[words.length - 1].endMs = t.endMs; }
}
let W = words.filter((w) => !/\[|\]|\(|\)/.test(w.text) && w.text.trim());
W.forEach((w) => {
  if (/сворка/i.test(w.text)) w.text = w.text.replace(/сворка/i, "створка");
  if (/^колесе/i.test(w.text)) w.text = "Алисе";
  if (/хрена/i.test(w.text)) w.text = "х****";   // цензура в субтитрах (аудио оставляем)
});

const item = (seg, shot, sfx = null, capToMs = null) => ({ clip: CLIP, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate: 1, volume: 1, slow: false, sfx, captionToMs: capToMs, shot });

// крупные цельные куски демо
const items = [
  item([12.9, 20.9], "wide", "impact"),  // «в фасаде глухарь — не открывается. Но это не глухарь — открывается!»
  item([21.6, 28.6], "close", "whoosh"), // «нажимаем электропривод — створка, к Алисе и умному дому»
  item([28.9, 35.6], "pov"),             // «обратите внимание — створка 170 кг. На автоматике»
  item([40.9, 44.7], "close"),           // «полностью открылась и закрылась с кнопки пульта»
  item([47.3, 53.9], "wide", "riser"),   // «…+70–100 тысяч, в зависимости от размера, к самому изделию» (договариваем фразу)
];

const XF = 0.15;
const starts = [];
let cur = 0;
for (const it of items) { starts.push(cur); cur += (it.toMs - it.fromMs) / 1000 - XF; }
const g = (i, localS) => Math.round((starts[i] + localS) * 1000);

const heroPhrases = [
  { atMs: g(2, 4.1), durMs: 2000, anim: "slam",  pre: "СТВОРКА",      key: "170 КГ" },
  { atMs: g(3, 3.6), durMs: 1900, anim: "slide", pre: "ОТКРЫЛАСЬ",    key: "С ПУЛЬТА" },
  { atMs: g(4, 3.0), durMs: 2000, anim: "wipe",  pre: "ЦЕНА ВОПРОСА", key: "+70–100 ТЫС" },
];

const sfxTrack = [
  { atMs: g(2, 4.1), src: "impact", vol: 0.5 },   // kick на «170 кг»
];

const accents = [
  { atMs: g(0, 7.9), durMs: 1500, mag: 0.12 },  // «оно открывается»
  { atMs: g(2, 4.1), durMs: 1700, mag: 0.14 },  // «170 килограмм»
  { atMs: g(3, 3.6), durMs: 1500, mag: 0.12 },  // «с кнопки пульта»
  { atMs: g(4, 3.0), durMs: 1500, mag: 0.11 },  // «+70–100 тысяч»
];

const gifs = [
  { src: "rocket2",  atMs: g(2, 4.0), durMs: 2400, mode: "sticker", pos: "tr", size: 240, label: "170 кг" },
  { src: "thumbup2", atMs: g(3, 3.4), durMs: 2200, mode: "sticker", pos: "bl", size: 220, label: "с пульта" },
];

const reel2 = {
  id: "ruslan-raitokna-2",
  title: "Руслан · Райт Окна — часть 2",
  music: "music5.mp3",
  series: null,   // без заставки — бесшовное продолжение
  heroPhrases, sfxTrack, accents, gifs, items,
};

// дописываем в общий план часть 2
const planPath = path.join("src", "ruslan-plan.json");
const plan = JSON.parse(fs.readFileSync(planPath));
plan.words[CLIP] = W;
plan.reels = plan.reels.filter((r) => r.id !== "ruslan-raitokna-2");
plan.reels.push(reel2);
fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

const total = items.reduce((a, it) => a + (it.toMs - it.fromMs) / 1000, 0) - XF * (items.length - 1);
console.log(`ruslan-raitokna-2 | ${total.toFixed(1)}s | сегментов: ${items.length} | reels в плане: ${plan.reels.length}`);
