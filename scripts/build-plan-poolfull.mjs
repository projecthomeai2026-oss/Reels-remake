import fs from "fs";
import path from "path";

// БОЛЬШОЙ рилс «Бассейн + джакузи» из всех 5 клипов (p80-p84).
// Инфоблоки (робот-пылесос, джакузи, форсунки/массаж, цены) чередуются со вставками
// реальной чистки бассейна сачком (немые, каждые ~15-20с контента). Фразы НЕ обрываем.
// По кино-шаблону: без чёрной заставки, без виньетки, люди целиком, бодрая музыка.

const CLIPS = [["p80", "p80g"], ["p81", "p81g"], ["p82", "p82g"], ["p83", "p83g"], ["p84", "p84g"]];
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
  WORDS[clip] = words.filter((w) => !/\[|\]|\(|\)/.test(w.text) && w.text.trim() && !/Воинова|Кулакова|Бойкова|Редактор|Корректор|субтитров/i.test(w.text));
}
WORDS.p80g.forEach((w) => { if (/подрицающий/i.test(w.text)) w.text = "прекрасный"; });
WORDS.p82hdg = []; // немая HD-вставка (без транскрипции)

const item  = (clip, seg, shot, sfx = null, capToMs = null) => ({ clip, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate: 1, volume: 1, slow: false, sfx, captionToMs: capToMs, shot });
const broll = (clip, seg, shot) => ({ clip, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate: 1, volume: 0, slow: false, sfx: null, captionToMs: Math.round(seg[0] * 1000), shot });

const items = [
  broll("p84g", [0.0, 3.0], "wide"),                  // хук: тихий бассейн
  item("p80g", [0.1, 16.9], "pov", "impact"),         // «бассейн готов… вопрос от чистки… покупаем пылесосик… врубаем, отпускаем»
  broll("p84g", [15.0, 20.0], "wide"),                // ВСТАВКА: чистит сачком
  item("p80g", [18.9, 30.6], "close", "whoosh"),      // «программа два часа… сам погружается и всё чистит… партнёров отмечаю»
  broll("p83g", [16.0, 21.0], "pov"),                 // ВСТАВКА: чистит сачком (др. ракурс)
  item("p81g", [0.7, 11.3], "wide"),                  // «мебель специально и джакузи рядом с бассейном — поставили кнопочку джик»
  broll("p82hdg", [0.3, 3.8], "close"),               // ВСТАВКА (4K HD): рука на панели джакузи, активно бурлит
  item("p81g", [11.3, 15.0], "wide"),                 // «пожалуйста, всё гудит, всё работает»
  broll("p84g", [25.0, 30.0], "wide"),                // ВСТАВКА: чистит сачком
  item("p82g", [0.0, 10.8], "close", "whoosh"),       // «форсунки под ваш запрос — 4 стоит, массаж классный получается»
  broll("p84g", [35.0, 40.0], "pov"),                 // ВСТАВКА: чистит сачком
  item("p82g", [11.5, 31.9], "wide", "riser"),        // «включаем с кнопки… коммуникации в техпомещении… партнёры расскажут цены… реализуем эти проекты. Пока!»
];

const XF = 0.15;
const starts = [];
let cur = 0;
for (const it of items) { starts.push(cur); cur += (it.toMs - it.fromMs) / 1000 - XF; }
const g = (i, localS) => Math.round((starts[i] + localS) * 1000);

const heroPhrases = [
  { atMs: g(1, 7.6),  durMs: 2000, anim: "slam",  pre: "ПОКУПАЕМ",    key: "ПЫЛЕСОСИК" },   // «покупаем пылесосик»
  { atMs: g(3, 0.1),  durMs: 1900, anim: "slide", pre: "ДВА ЧАСА —",  key: "И ГОТОВО" },     // «программа два часа»
  { atMs: g(5, 5.6),  durMs: 2000, anim: "wipe",  pre: "ДЖАКУЗИ",     key: "С КНОПКИ" },     // «кнопочку джик»
  { atMs: g(9, 3.2),  durMs: 2000, anim: "slam",  pre: "ФОРСУНКИ",    key: "ПОД ЗАПРОС" },   // «форсунки под ваш запрос»
  { atMs: g(11, 20.2), durMs: 2000, anim: "wipe",  pre: "ЗОНА ОТДЫХА", key: "ПОД КЛЮЧ" },    // «реализуем эти проекты»
];

const sfxTrack = [
  { atMs: g(1, 7.6), src: "impact", vol: 0.5 },
];

const accents = [
  { atMs: g(1, 7.6),  durMs: 1600, mag: 0.13 },
  { atMs: g(3, 0.1),  durMs: 1700, mag: 0.13 },
  { atMs: g(3, 2.0),  durMs: 1600, mag: 0.12 },
  { atMs: g(5, 5.6),  durMs: 1600, mag: 0.12 },
  { atMs: g(6, 0.3),  durMs: 1400, mag: 0.11 },  // включаем — лёгкий панч на вставке
  { atMs: g(9, 3.2),  durMs: 1600, mag: 0.12 },
  { atMs: g(9, 8.8),  durMs: 1600, mag: 0.13 },
  { atMs: g(11, 20.2), durMs: 1600, mag: 0.10 },
];

const gifs = [
  { src: "pool2",    atMs: g(1, 7.5),  durMs: 2400, mode: "sticker", pos: "tr", size: 230, label: "робот-пылесос" },
  { src: "timer2",   atMs: g(3, 0.0),  durMs: 2600, mode: "sticker", pos: "tr", size: 230, label: "2 часа" },
  { src: "lightning2", atMs: g(6, 0.2), durMs: 2200, mode: "sticker", pos: "tr", size: 230, label: "включаем" },
  { src: "drop2",    atMs: g(9, 8.7),  durMs: 2200, mode: "sticker", pos: "bl", size: 220, label: "массаж" },
  { src: "sparkle2", atMs: g(11, 20.0), durMs: 2400, mode: "sticker", pos: "tr", size: 230, label: "под ключ" },
];

const reel = {
  id: "pool-full",
  title: "Бассейн + джакузи — всё про уход",
  music: "music5.mp3",
  series: { title: "БАССЕЙН\nИ ДЖАКУЗИ", location: "Новосибирск", sub: "Чистка · автоматика · массаж" },
  heroPhrases, sfxTrack, accents, gifs, items,
};

fs.writeFileSync(path.join("src", "poolfull-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));
const total = items.reduce((a, it) => a + (it.toMs - it.fromMs) / 1000, 0) - XF * (items.length - 1);
console.log(`pool-full | ${total.toFixed(1)}s | сегментов: ${items.length}`);
for (let i = 0; i < items.length; i++) console.log(`  [${i}] ${items[i].clip} @${starts[i].toFixed(1)}s vol=${items[i].volume}`);
