import fs from "fs";
import path from "path";

// Рилс «Продолжаем ремонт · Бентли-Невада» из 4 клипов (IMG_1807/1808/1809/1810).
// Хук-заставка + жёлтые субтитры + кино-грейд, стикеры и зумы.
// 1809 — немой b-roll (установка реек) под хук; речь берём из 1807, 1808, 1810.

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

const WORDS = {
  IMG_1807: rawWords("IMG_1807"),
  IMG_1808: rawWords("IMG_1808"),
  IMG_1810: rawWords("IMG_1810b", 40000), // чистые тайминги хвоста (40–80с) со сдвигом
  IMG_1809: [], // немой b-roll — без субтитров
};
// whisper слышит «свет» — про декоративку речь про ЦВЕТ
WORDS.IMG_1810.forEach((w) => { w.text = w.text.replace(/\bСвет\b/g, "Цвет").replace(/\bсвет\b/g, "цвет").replace(/\bсвете\b/g, "цвете"); });

const item = (clip, from, to, opts = {}) => ({
  clip, fromMs: Math.round(from), toMs: Math.round(to),
  rate: 1, volume: opts.volume ?? 1, slow: false, sfx: null, captionToMs: opts.captionToMs ?? null,
});

// сегменты в нарративном порядке
const items = [
  item("IMG_1809", 2800, 6100, { volume: 0 }),   // хук b-roll: ставят рейки (немой)
  item("IMG_1807", 10800, 26100),                 // санузел: плитка, эпоксидка, «вот она красота, 20 на 20»
  item("IMG_1807", 33300, 40200),                 // Мавлон показывает: «здесь большое зеркало будет и мебель»
  item("IMG_1808", 0, 7000),                      // «здесь будут бамбуковые панели»
  item("IMG_1808", 16200, 22300),                 // «панель, ТВ-зона сюда, подсветка по низу»
  item("IMG_1810", 45600, 61600),                 // ДЕКОРАТИВКА: про цвет/оттенок «темнеет цвет… чуть бежевый… посветлее стены»
  item("IMG_1810", 66600, 78500),                 // финал: «…полным ходом… к выставке. Двигаемся!» (даём слову договорить, «Двигаемся» до 77.85с)
  item("IMG_1810", 2600, 5000, { volume: 0 }),    // концовка: кадр на Романа в комнате со штукатуркой (немой), музыка + затухание
];

// глобальные тайминги (учёт кросс-фейда 350мс), чтобы поставить стикеры/зумы
const XFADE = 350;
let cur = 0; const gStart = [];
for (const it of items) { gStart.push(cur); cur += (it.toMs - it.fromMs) - XFADE; }

// глобальное время слова = старт сегмента + (клип-тайминг слова − начало сегмента)
const gKras = gStart[1] + (23200 - 10800);   // «красота» 1807 @23.2с
const gZerk = gStart[2] + (35700 - 33300);   // «большое зеркало» 1807 @35.7с
const gBezh = gStart[5] + (54800 - 45600);   // «бежевый» 1810 @54.8с (про цвет)
const gHod  = gStart[6] + (70000 - 66600);   // «полным ходом» 1810 @70.0с
const gVyst = gStart[6] + (75000 - 66600);   // «к выставке» 1810 @75.0с

const reel = {
  id: "remont-bentley",
  title: "Продолжаем ремонт · Бентли-Невада",
  music: "music5.mp3",
  series: { title: "Продолжаем\nремонт", location: "Бентли-Невада", sub: "Стройка без прикрас" },
  accents: [
    { atMs: gKras, durMs: 2400 }, // наезд на плитку «вот она красота»
    { atMs: gZerk, durMs: 2400 }, // наезд на стену «здесь большое зеркало»
    { atMs: gBezh, durMs: 2200 }, // наезд на стену «чуть бежевый»
    { atMs: gHod, durMs: 2600 },  // наезд на штукатурку «полным ходом»
  ],
  gifs: [
    { src: "sparkle2", atMs: gKras - 200, durMs: 2400, mode: "sticker", pos: "tr", size: 210 },
    { src: "sparkle2", atMs: gZerk - 100, durMs: 2400, mode: "sticker", pos: "tr", size: 200, label: "зеркало" },
    { src: "palette2", atMs: gBezh - 200, durMs: 2400, mode: "sticker", pos: "tr", size: 220, label: "оттенок" },
    { src: "fire2", atMs: gHod, durMs: 2400, mode: "sticker", pos: "bl", size: 210 },
    { src: "rocket2", atMs: gVyst, durMs: 2600, mode: "sticker", pos: "tr", size: 235, label: "к выставке" },
  ],
  items,
};

fs.writeFileSync(path.join("src", "remont-plan.json"), JSON.stringify({ words: WORDS, reels: [reel] }, null, 2));

const total = items.reduce((a, it) => a + (it.toMs - it.fromMs), 0) - XFADE * (items.length - 1);
console.log(`remont-bentley | ${(total / 1000).toFixed(1)}s | сегментов: ${items.length}`);
console.log(`стикеры: красота@${(gKras/1000).toFixed(1)}s  ходом@${(gHod/1000).toFixed(1)}s  выставка@${(gVyst/1000).toFixed(1)}s`);
