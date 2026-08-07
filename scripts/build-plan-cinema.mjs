import fs from "fs";
import path from "path";

// Кино-рилс «Что внутри премиум-бассейна» из IMG_1804 (экскурсия по техпомещению).
// Кинематографичный стиль: тёмный грейд, леттербокс, элегантные субтитры, плавные
// переходы, медленный зум. ~70 сек.

const SPEECH_CLIPS = ["IMG_1804"];
const FIXES = { IMG_1804: [] };

const applyFixes = (words) => words;

const WORDS = {};
for (const clip of SPEECH_CLIPS) {
  const raw = JSON.parse(fs.readFileSync(path.join("public", "captions", "raw", `${clip}.json`)));
  const words = [];
  for (const t of raw) {
    const isNewWord = t.text.startsWith(" ") || words.length === 0;
    const isPunct = /^[.,!?…:;\-–—]+$/.test(t.text.trim());
    if (isNewWord && !isPunct) words.push({ text: t.text.trim(), startMs: t.startMs, endMs: t.endMs });
    else if (words.length > 0) { words[words.length - 1].text += t.text.trimEnd().replace(/^ /, ""); words[words.length - 1].endMs = t.endMs; }
  }
  WORDS[clip] = words.filter((w) => !/\[|\]|\(|\)/.test(w.text) && w.text.trim());
}

const item = (clip, seg, opts = {}) => ({
  clip,
  fromMs: Math.round(seg[0] * 1000),
  toMs: Math.round(seg[1] * 1000),
  rate: opts.rate ?? 1,
  volume: opts.volume ?? 1,
  slow: opts.slow ?? false,       // слоу-мо кинокадр
  sfx: opts.sfx ?? null,          // звуковой акцент на входе
  captionToMs: opts.captionToMs != null ? Math.round(opts.captionToMs * 1000) : null,
});

const reels = [
  {
    id: "cinema-pool",
    title: "Премиум-бассейн",
    music: "music6.mp3",
    items: [
      // ХУК из концовки — интрига «крутой кат»
      item("IMG_1804", [382.5, 384.1], { sfx: "riser" }),
      // круглый год: вопрос → ответ (вырезано «если топить/в зависимости»)
      item("IMG_1804", [110.0, 113.6], { sfx: "impact" }),
      item("IMG_1804", [122.1, 124.6], { sfx: "whoosh" }),
      // техпомещение — что скрыто под бассейном
      item("IMG_1804", [85.3, 92.2], { sfx: "whoosh" }),
      // синие бочки → песчаные фильтры
      item("IMG_1804", [38.3, 46.1], { sfx: "whoosh" }),
      // а ещё водопад (без «а ещё? да вон труба»)
      item("IMG_1804", [68.0, 70.0], { sfx: "impact" }),
      // насосы и фильтры в техпомещении
      item("IMG_1804", [96.2, 100.3], { sfx: "whoosh" }),
      // гидромассажная ванна
      item("IMG_1804", [182.6, 185.8], { sfx: "impact" }),
      // до 40 градусов (без «наверное»/«а теперь»)
      item("IMG_1804", [143.7, 146.0], { sfx: "impact" }),
      // автодолив (без «ну я бы сказал/рекомендуется/наверное»)
      item("IMG_1804", [354.0, 357.6], { sfx: "whoosh" }),
      item("IMG_1804", [362.5, 364.2], { sfx: "impact" }),
      // всё на автомате
      item("IMG_1804", [366.0, 367.6], { sfx: "whoosh" }),
      // финал: пишите, спрашивайте у партнёров
      item("IMG_1804", [369.5, 379.0], { sfx: "whoosh" }),
    ],
  },
];

fs.writeFileSync(path.join("src", "cinema-plan.json"), JSON.stringify({ words: WORDS, reels }, null, 2));

for (const r of reels) {
  const total = r.items.reduce((a, it) => a + (it.toMs - it.fromMs) / it.rate, 0);
  console.log(r.id, "|", (total / 1000).toFixed(1) + "s", "|", r.items.length, "items");
  for (const it of r.items) {
    const w = WORDS[it.clip].filter((x) => x.startMs >= it.fromMs - 60 && x.startMs < (it.captionToMs ?? it.toMs));
    console.log(`   [${(it.fromMs / 1000).toFixed(1)}–${(it.toMs / 1000).toFixed(1)}]${it.sfx ? " +" + it.sfx : ""} :: ${w.map((x) => x.text).join(" ")}`);
  }
}
