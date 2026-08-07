import fs from "fs";
import path from "path";

// РИЛС «Руслан · Райт Окна» — агрессивный коммерческий кинематограф (Nike/Apple вайб).
// Грейд запечён в клип r8195g. 3 «плана» (wide/close/pov) через рефрейм, 3 кинетические
// ключевые фразы (slam/slide/wipe), звук-дизайн (kick/switch/white-noise), суб B&W + жёлтый keyword.

const AUDIO = "r8195";        // тайминги речи берём из исходной транскрипции
const CLIP = "r8195g";        // видео — грейженое
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
  if (/^крови/i.test(w.text)) w.text = "кровле";
  if (/райд[-\s]?окна/i.test(w.text)) w.text = "Райт-Окна";
});
const WORDS = { [CLIP]: W };  // ключ по видео-клипу (компонент читает WORDS[item.clip])

const item = (seg, shot, sfx = null, capToMs = null) => ({ clip: CLIP, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate: 1, volume: 1, slow: false, sfx, captionToMs: capToMs, shot });

// крупные цельные куски — фразы договаривают до конца, не рвём смысл
const items = [
  // A: знакомство + автооткрывание + «бам, кнопку нажимаем, когда лежим» — одним куском
  item([2.4, 14.4], "wide", "impact"),
  // B: «пришёл, отдыхаешь — кнопка / Алиса. Это он придумал — приедет и сделает» — одним куском
  item([15.0, 27.4], "pov", "whoosh"),
  // C: «любая задача — реализуем, найдём подход. Хотите впечатлить — зенитные фонари» — одним куском
  item([36.5, 48.3], "close", "riser"),
  // D: CTA «что касается окон, крутых профилей — пишите, всё покажут»
  item([54.5, 58.9], "wide"),
];

const XF = 0.15; // короткий кроссфейд — аудио не наезжает, слова не глотаются
const starts = [];
let cur = 0;
for (const it of items) { starts.push(cur); cur += (it.toMs - it.fromMs) / 1000 - XF; }
const g = (i, localS) => Math.round((starts[i] + localS) * 1000);

// 3 КЛЮЧЕВЫЕ ФРАЗЫ — каждая со своим стилем анимации, keyword жёлтым
const heroPhrases = [
  { atMs: g(0, 7.2), durMs: 2000, anim: "slam",  pre: "ОКНО ОТКРЫВАЕТСЯ", key: "САМО" },   // «автоматическое открывание»
  { atMs: g(1, 8.3), durMs: 1900, anim: "slide", pre: "УПРАВЛЯЙ С",       key: "АЛИСОЙ" },  // «интегрировал с Алисой»
  { atMs: g(2, 0.7), durMs: 2000, anim: "wipe",  pre: "ЛЮБАЯ ЗАДАЧА —",    key: "РЕШИМ" },   // «любая задача»
];

// доп. kick на слэме первой фразы
const sfxTrack = [
  { atMs: g(0, 7.2), src: "impact", vol: 0.5 },
];

const accents = [
  { atMs: g(0, 7.2), durMs: 1600, mag: 0.13 },  // «автоматическое открывание окна»
  { atMs: g(0, 9.7), durMs: 1100, mag: 0.14 },  // «бам!»
  { atMs: g(2, 0.7), durMs: 1600, mag: 0.11 },  // «любая задача»
  { atMs: g(2, 10.0), durMs: 1500, mag: 0.10 }, // «зенитные фонари»
];

const gifs = [
  { src: "lightning2", atMs: g(0, 9.5), durMs: 2000, mode: "sticker", pos: "tr", size: 220, label: "автоматика" },
  { src: "sparkle2",   atMs: g(2, 9.7), durMs: 2200, mode: "sticker", pos: "tr", size: 220, label: "премиум" },
];

const reel = {
  id: "ruslan-raitokna",
  title: "Руслан · Райт Окна",
  music: "music5.mp3",
  series: { title: "РУСЛАН", location: "Новосибирск", sub: "Основатель «Райт Окна»" },
  heroPhrases, sfxTrack, accents, gifs, items,
};

fs.writeFileSync(path.join("src", "ruslan-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));
const total = items.reduce((a, it) => a + (it.toMs - it.fromMs) / 1000, 0) - XF * (items.length - 1);
console.log(`ruslan-raitokna | ${total.toFixed(1)}s | сегментов: ${items.length} | hero: ${heroPhrases.length}`);
