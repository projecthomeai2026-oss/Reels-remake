import fs from "fs";
import path from "path";

// Рилс «Зона отдыха под ключ» — бассейн + джакузи с массажными форсунками (шоу-дом).
// Кино-шаблон (как вчера), БЕЗ затемнения: без виньетки, без фейда из чёрного, без чёрной заставки.
// Речь: r2081 (джакузи+кнопка) + r2082 (форсунки/массаж/коммуникации/партнёры). r2083 — немой b-roll вида.

const SPEECH = [["r2081", "r2081g"], ["r2082", "r2082g"]];
const WORDS = {};
for (const [audio, clip] of SPEECH) {
  const raw = JSON.parse(fs.readFileSync(path.join("public", "captions", "raw", `${audio}.json`)));
  const words = [];
  for (const t of raw) {
    const isNewWord = t.text.startsWith(" ") || words.length === 0;
    const isPunct = /^[.,!?…:;\-–—]+$/.test(t.text.trim());
    if (isNewWord && !isPunct) words.push({ text: t.text.trim(), startMs: t.startMs, endMs: t.endMs });
    else if (words.length > 0) { words[words.length - 1].text += t.text.trimEnd().replace(/^ /, ""); words[words.length - 1].endMs = t.endMs; }
  }
  WORDS[clip] = words.filter((w) => !/\[|\]|\(|\)|\*/.test(w.text) && w.text.trim() && !/Воинова|Кулакова|Бойкова|Синецкая|Редактор|Корректор|субтитров/i.test(w.text));
  WORDS[clip].forEach((w) => { if (/басиком/i.test(w.text)) w.text = "бассейном"; });
}
WORDS["r2083g"] = []; // немой b-roll — без субтитров

const item  = (clip, seg, shot, sfx = null, capToMs = null) => ({ clip, fromMs: Math.round(seg[0]*1000), toMs: Math.round(seg[1]*1000), rate: 1, volume: 1, slow: false, sfx, captionToMs: capToMs, shot });
const broll = (clip, seg, shot) => ({ clip, fromMs: Math.round(seg[0]*1000), toMs: Math.round(seg[1]*1000), rate: 1, volume: 0, slow: false, sfx: null, captionToMs: Math.round(seg[0]*1000), shot });

const items = [
  // ХУК (холодный опенер): джакузи крупно + вау-фраза «массаж классный получается» (звук есть, субтитр выключен — работает крупный текст хука)
  item("r2082g", [8.6, 11.0], "close", "impact", 8600),
  broll("r2083g", [2.0, 6.5], "wide"),           // establishing: бассейн + дом (немой)
  item("r2081g", [0.7, 15.0], "pov"),            // «здесь мебель специально, и джакузи рядом с бассейном — кнопочку джик, всё гудит, работает»
  item("r2082g", [0.0, 8.6], "close", "whoosh"), // «форсунки именно под ваш запрос — 4 стоит, мы пробовали»
  item("r2082g", [11.5, 20.9], "pov"),           // «включаем с кнопки, все коммуникации в техпомещении»
  item("r2082g", [23.1, 33.0], "wide"),          // «партнёры расскажут цены, а мы приедем и реализуем эти проекты. Пока!»
];

const XF = 0.15;
const starts = [];
let cur = 0;
for (const it of items) { starts.push(cur); cur += (it.toMs - it.fromMs) / 1000 - XF; }
const g = (i, localS) => Math.round((starts[i] + localS) * 1000);

const heroPhrases = [
  { atMs: g(2, 9.1), durMs: 2000, anim: "slam",  pre: "ДЖАКУЗИ",   key: "С КНОПКИ" },    // «кнопочку джик»
  { atMs: g(3, 3.2), durMs: 1900, anim: "slide", pre: "ФОРСУНКИ",  key: "ПОД ЗАПРОС" }, // «форсунки под ваш запрос»
  { atMs: g(5, 7.0), durMs: 2000, anim: "wipe",  pre: "ЗОНА ОТДЫХА", key: "ПОД КЛЮЧ" },  // «реализуем»
];

const sfxTrack = [
  { atMs: g(2, 9.1), src: "impact", vol: 0.5 },
];

const accents = [
  { atMs: g(2, 9.1), durMs: 1600, mag: 0.13 },  // «кнопочку джик»
  { atMs: g(3, 3.2), durMs: 1600, mag: 0.13 },  // «форсунки под запрос»
  { atMs: g(4, 5.0), durMs: 1500, mag: 0.11 },  // «коммуникации»
  { atMs: g(5, 7.0), durMs: 1600, mag: 0.10 },  // «реализуем»
];

const gifs = [
  { src: "sparkle2", atMs: g(2, 9.0), durMs: 2200, mode: "sticker", pos: "tr", size: 230, label: "релакс" },
  { src: "drop2",    atMs: g(3, 3.0), durMs: 2200, mode: "sticker", pos: "tr", size: 230, label: "форсунки" },
  { src: "rocket2",  atMs: g(5, 6.6), durMs: 2200, mode: "sticker", pos: "bl", size: 220, label: "под ключ" },
];

const reel = {
  id: "pool-zone",
  title: "Зона отдыха под ключ",
  music: "music5.mp3",
  series: { title: "ХОЧУ ТАКОЙ\nДВОР", location: "Новосибирск", sub: "Бассейн + джакузи с массажем" },
  heroPhrases, sfxTrack, accents, gifs, items,
};

fs.writeFileSync(path.join("src", "poolzone-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));
const total = items.reduce((a, it) => a + (it.toMs - it.fromMs) / 1000, 0) - XF * (items.length - 1);
console.log(`pool-zone | ${total.toFixed(1)}s | сегментов: ${items.length}`);
