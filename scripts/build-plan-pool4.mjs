import fs from "fs";
import path from "path";

// 4 серии «Устройство бассейна» из одного файла pool4 (5:27).
// Каждая серия — непрерывный кусок (ничего не режем внутри), в правильной
// последовательности. Кино-стиль + жёлтые субтитры + обложка-заставка серии.

const CLIP = "pool4";
const raw = JSON.parse(fs.readFileSync(path.join("public", "captions", "raw", `${CLIP}.json`)));
const words = [];
for (const t of raw) {
  const isNewWord = t.text.startsWith(" ") || words.length === 0;
  const isPunct = /^[.,!?…:;\-–—]+$/.test(t.text.trim());
  if (isNewWord && !isPunct) words.push({ text: t.text.trim(), startMs: t.startMs, endMs: t.endMs });
  else if (words.length > 0) { words[words.length - 1].text += t.text.trimEnd().replace(/^ /, ""); words[words.length - 1].endMs = t.endMs; }
}
const WORDS = { [CLIP]: words.filter((w) => !/\[|\]|\(|\)/.test(w.text) && w.text.trim()) };
// FIX распознавания: whisper слышит «отогрев», Роман говорит «подогрев»
WORDS[CLIP].forEach((w) => { if (w.text === "отогрев") w.text = "подогрев"; });

const item = (seg, capToMs = null) => ({ clip: CLIP, fromMs: Math.round(seg[0] * 1000), toMs: Math.round(seg[1] * 1000), rate: 1, volume: 1, slow: false, sfx: null, captionToMs: capToMs });

// 4 серии: [начало, конец] на паузах + тема для обложки
const SERIES = [
  { n: 1, theme: "Фильтры и техпомещение", seg: [0, 79.5], music: "music6.mp3" },
  { n: 2, theme: "Температура и электрика", seg: [79.5, 140.6], music: "music6.mp3" }, // +0.4с чтобы «выглядеть» договорилось, конец с fade-out
  { n: 3, theme: "Обслуживание бассейна", seg: [140.2, 236.4], music: "music6.mp3" }, // +5с: фраза «…он её поддерживает?» + хвост под затухание
  { n: 4, theme: "Умная автоматика", seg: [235.3, 328.0], music: "music6.mp3" },
];

// акценты-зумы по видео-таймингу серии (atMs — от начала ролика)
const ACCENTS = {
  1: [
    { atMs: 29000, durMs: 2600 }, // «вот они фильтры, вот эти два штуки»
    { atMs: 32000, durMs: 3200 }, // «там будет водопад» (+ сюда вставка водопада)
  ],
  2: [
    { atMs: 46000, durMs: 2800 }, // «мощный насос» на водопад
  ],
  // S3 старт 140.2с: люк ≈0.2с, песок ≈18.8с, щит ≈46с (отн. начала серии)
  3: [
    { atMs: 19000, durMs: 2600 }, // «песок меняется раз-два года»
    { atMs: 46000, durMs: 3000 }, // «будет стоять щит управления, таймер»
  ],
  // S4 с ХУКОМ-перестановкой (глоб. время учитывает порядок сегментов)
  4: [
    { atMs: 13250, durMs: 2400 }, // «22 градуса» (термостат)
    { atMs: 58000, durMs: 2600 }, // «автоматический долив»
    { atMs: 76600, durMs: 2400 }, // «пишите, спрашивайте» (финал)
  ],
};

// гифки-вставки поверх видео (Giphy)
const GIFS = {
  1: [
    { src: "waterfall2", atMs: 32000, durMs: 3400, mode: "waterfall", label: "будущий водопад" },
    // снег/лёд/дождь «ничего страшного» (75.7–78с)
    { src: "snow", atMs: 75400, durMs: 3400, mode: "weather" },
    { src: "rain", atMs: 75400, durMs: 3400, mode: "weather" },
    { src: "ice", atMs: 76100, durMs: 2400, mode: "card", label: "не страшно" },
  ],
  2: [
    { src: "fire2", atMs: 9200, durMs: 2000, mode: "sticker", pos: "bl", size: 240, label: "до 40°" }, // «купель до 40 градусов»
    { src: "lightning2", atMs: 17200, durMs: 2400, mode: "sticker", pos: "tr", size: 240 },           // «кабеля крутые ставить»
    { src: "fire2", atMs: 26900, durMs: 2000, mode: "sticker", pos: "br", size: 220 },                // «он от газа работает»
    { src: "thumbup2", atMs: 36100, durMs: 2800, mode: "sticker", pos: "tr", size: 240, label: "вопрос снят" }, // «вопрос снят»
  ],
  // S3 (старт 140.2с): песок раз-два года, промывка, щит+таймер, подогрев
  3: [
    { src: "calendar2", atMs: 19800, durMs: 2600, mode: "sticker", pos: "tr", size: 230, label: "раз-два года" }, // «песок меняется раз-два года»
    { src: "drop2", atMs: 25800, durMs: 2200, mode: "sticker", pos: "bl", size: 200 },                            // «как часто промывать»
    { src: "timer2", atMs: 49100, durMs: 2600, mode: "sticker", pos: "tr", size: 230, label: "автотаймер" },      // «будет стоять таймер»
    { src: "fire2", atMs: 68400, durMs: 2400, mode: "sticker", pos: "bl", size: 220, label: "подогрев" },         // «плюс подогрев»
  ],
  4: [
    { src: "fire2", atMs: 5100, durMs: 2400, mode: "sticker", pos: "bl", size: 220, label: "подогрев" },     // хук: «…и подогревает»
    { src: "pool2", atMs: 40800, durMs: 2600, mode: "sticker", pos: "tr", size: 220, label: "скиммер" },     // «в скиммер»
    { src: "drop2", atMs: 58000, durMs: 2600, mode: "sticker", pos: "tr", size: 210, label: "автодолив" },   // «автоматический долив»
    { src: "thumbup2", atMs: 68800, durMs: 2600, mode: "sticker", pos: "tr", size: 220, label: "на автомате" }, // «всё на автомате»
  ],
};

// S4: хук из «датчика» (рел ~16с) в начало, затем остальное без повтора
const S4_ITEMS = [
  item([248.4, 255.4]),          // ХУК: «Датчик считывает, что вода остыла, и подогревает»
  item([235.3, 248.4]),          // термозащита → 22 градуса → загоняет свежую воду
  item([255.4, 328.0], 325800),  // циркуляция → скиммер → автодолив → финал (субтитры до «спасибо»)
];

const reels = SERIES.map((s) => ({
  id: `pool-s${s.n}`,
  title: `Устройство бассейна · Серия ${s.n}`,
  music: s.music,
  series: { n: s.n, total: 4, theme: s.theme },
  accents: ACCENTS[s.n] ?? [],
  gifs: GIFS[s.n] ?? [],
  items: s.n === 4 ? S4_ITEMS : [item(s.seg, s.n === 2 ? 140220 : s.n === 3 ? 235400 : null)], // s2 субтитры до «выглядеть»; s3 до «поддерживает?»; s4 — хук-перестановка
}));

fs.writeFileSync(path.join("src", "pool4-plan.json"), JSON.stringify({ words: WORDS, reels }, null, 2));

for (const r of reels) {
  const total = r.items.reduce((a, it) => a + (it.toMs - it.fromMs) / it.rate, 0);
  console.log(`${r.id} | ${(total / 1000).toFixed(1)}s | Серия ${r.series.n}: ${r.series.theme}`);
}
