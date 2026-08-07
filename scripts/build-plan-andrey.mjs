import fs from "fs";
import path from "path";

// Рилс-приглашение: Андрей зовёт на выставку домов Open Village (Freedom Village).
// База — склейка andrey-houses.mp4 (речь Андрея + перебивка домов 12–22.5с).
// Голос Андрея сквозной, субтитры из IMG_1896.

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

const WORDS = { "andrey-houses": rawWords("IMG_1896") };
// правки распознавания (Роман поправил на слух)
WORDS["andrey-houses"].forEach((w) => {
  if (w.text === "квартирные") w.text = "многоквартирные";        // «многоквартирные дома»
  if (w.text === "остался") w.text = "осталось";                  // «квартир осталось…»
  if (w.text === "всем" && Math.abs(w.startMs - 33440) < 300) w.text = "совсем"; // «…совсем немного»
});
// убрать лишнее «на» перед «многоквартирные» (≈24.2с)
WORDS["andrey-houses"] = WORDS["andrey-houses"].filter((w) => !(w.text === "на" && Math.abs(w.startMs - 24240) < 200));

const item = (clip, from, to, opts = {}) => ({
  clip, fromMs: Math.round(from), toMs: Math.round(to),
  rate: opts.rate ?? 1, volume: opts.volume ?? 1, slow: false, sfx: null, captionToMs: opts.captionToMs ?? null,
});

const START = 1900; // старт с «друзья, всем привет», без дубль-слейта «давай ещё раз»
// БЕЗ ускорения — оригинальный звук Андрея, пан на нормальной скорости
const items = [ item("andrey-houses", START, 53700) ];
const g = (clipMs) => clipMs - START; // клип-время → глобальное время рилса

const reel = {
  id: "andrey-village",
  title: "Приглашение на выставку домов · Open Village",
  music: "music5.mp3",
  series: { title: "OPEN\nVILLAGE", location: "Freedom Village", sub: "Выставка загородной недвижимости" },
  accents: [
    { atMs: g(14000), durMs: 2600 }, // наезд на дома «13 домовладений» (совпадает с вставкой)
    { atMs: g(32000), durMs: 2200 }, // «торопитесь»
    { atMs: g(52200), durMs: 1500, mag: 0.28 }, // зум на поклоне Андрея в конце
  ],
  gifs: [
    { src: "house2", atMs: g(14000), durMs: 3000, mode: "sticker", pos: "tr", size: 210, label: "13 домов" }, // «13 домовладений»
    { src: "fire2", atMs: g(20600), durMs: 2200, mode: "sticker", pos: "bl", size: 200 },                      // «в диком стиле»
    { src: "timer2", atMs: g(32000), durMs: 2400, mode: "sticker", pos: "tr", size: 210, label: "успей" },     // «торопитесь»
    { src: "rocket2", atMs: g(50600), durMs: 2600, mode: "sticker", pos: "tr", size: 230, label: "старт 30" }, // «ждём завтра, 30 число»
  ],
  items,
};

fs.writeFileSync(path.join("src", "andrey-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));

const total = items.reduce((a, it) => a + (it.toMs - it.fromMs), 0);
console.log(`andrey-village | ${(total / 1000).toFixed(1)}s | база: andrey-houses.mp4`);
