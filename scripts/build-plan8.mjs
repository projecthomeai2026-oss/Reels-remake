import fs from "fs";
import path from "path";

// Рилс 8 «Плита готова» из съёмки 2026-07-22 (IMG_1632, один клип).
// Речь: подготовка основания → приняли бетон → плита готова → ждём прочности →
// стены из сибита кладутся быстро.

const SPEECH_CLIPS = ["IMG_1632"];

// Исправления распознавания
const FIXES = {
  IMG_1632: [
    [["CBIT"], ["сибита"]],
    [["подождем,"], ["подождём,"]],
    [["наберет"], ["наберёт"]],
    [["начнем"], ["начнём"]],
  ],
};

const applyFixes = (words, fixes) => {
  for (const [find, replace] of fixes) {
    for (let i = 0; i <= words.length - find.length; i++) {
      const slice = words.slice(i, i + find.length);
      if (slice.every((w, j) => w.text.toLowerCase() === find[j].toLowerCase())) {
        const startMs = slice[0].startMs;
        const endMs = Math.min(
          slice[slice.length - 1].endMs,
          startMs + 450 * replace.length,
        );
        const step = (endMs - startMs) / replace.length;
        const replacement = replace.map((text, j) => ({
          text,
          startMs: Math.round(startMs + j * step),
          endMs: Math.round(startMs + (j + 1) * step),
        }));
        words.splice(i, find.length, ...replacement);
        break;
      }
    }
  }
  return words;
};

const WORDS = {};
for (const clip of SPEECH_CLIPS) {
  const raw = JSON.parse(
    fs.readFileSync(path.join("public", "captions", "raw", `${clip}.json`)),
  );
  const words = [];
  for (const t of raw) {
    const isNewWord = t.text.startsWith(" ") || words.length === 0;
    const isPunct = /^[.,!?…:;\-–—]+$/.test(t.text.trim());
    if (isNewWord && !isPunct) {
      words.push({ text: t.text.trim(), startMs: t.startMs, endMs: t.endMs });
    } else if (words.length > 0) {
      words[words.length - 1].text += t.text.trimEnd().replace(/^ /, "");
      words[words.length - 1].endMs = t.endMs;
    }
  }
  const clean = words.filter(
    (w) => !/\[|\]|\(|\)/.test(w.text) && w.text.trim(),
  );
  WORDS[clip] = applyFixes(clean, FIXES[clip] ?? []);
}

// Перетайминг по silencedetect (-38dB d=0.45):
// паузы 4.44–5.12, 8.08–8.66, 14.20–14.70, 16.81–17.28
const respace = (words, texts, fromMs, toMs, occurrence = 0) => {
  let seen = 0;
  for (let i = 0; i <= words.length - texts.length; i++) {
    const slice = words.slice(i, i + texts.length);
    if (slice.every((w, j) => w.text.toLowerCase() === texts[j].toLowerCase())) {
      if (seen++ < occurrence) continue;
      const step = (toMs - fromMs) / texts.length;
      slice.forEach((w, j) => {
        w.startMs = Math.round(fromMs + j * step);
        w.endMs = Math.round(fromMs + (j + 1) * step);
      });
      return;
    }
  }
  throw new Error(`respace: not found: ${texts.join(" ")}`);
};

// «под» размазан в паузу 4.44–5.12: реально звучит с 5.12
respace(WORDS.IMG_1632, ["под", "заливку", "бетона."], 5120, 5960);
// «Как» прилип к «стены.» — речь после паузы идёт с 14.70
respace(WORDS.IMG_1632, ["Как", "вы", "знаете"], 14700, 15100);
// «стены из сибита» звучит после паузы с 17.28
respace(WORDS.IMG_1632, ["стены", "из", "сибита"], 17300, 18050);

const item = (clip, seg, opts = {}) => ({
  clip,
  fromMs: Math.round(seg[0] * 1000),
  toMs: Math.round(seg[1] * 1000),
  rate: opts.rate ?? 1,
  volume: opts.volume ?? 1,
  flash: opts.flash ?? false,
  badge: opts.badge ?? null,
  hookLook: opts.hookLook ?? false,
});

const reels = [
  {
    id: "reel8",
    title: "Плита готова",
    music: "music6.mp3",
    items: [
      // холодный опенер (VHS) — финальная фраза: «стены из сибита —
      // с высокой скоростью укладываются» (тягучее «достаточно» вырезано)
      item("IMG_1632", [17.28, 18.06], { hookLook: true }),
      item("IMG_1632", [19.28, 23.3], { hookLook: true }),
      // история с начала: подготовка основания (пауза 4.44–5.12 вырезана)
      item("IMG_1632", [0, 4.44], { flash: true }),
      // «под заливку бетона. Вчера успешно приняли бетон» (пауза 8.08–8.66 подрезана)
      item("IMG_1632", [5.12, 8.12]),
      // «Плита под новый дом готова… начнём выкладывать стены» (пауза 14.20–14.70 подрезана)
      item("IMG_1632", [8.6, 14.24], { flash: true }),
      // «Как вы знаете из моих предыдущих роликов» (пауза 16.81–17.28 вырезана)
      item("IMG_1632", [14.7, 16.86]),
      // «стены из сибита с высокой скоростью укладываются»
      item("IMG_1632", [17.28, 23.35], { flash: true }),
    ],
  },
];

fs.writeFileSync(
  path.join("src", "reel8-plan.json"),
  JSON.stringify({ words: WORDS, reels }, null, 2),
);

for (const r of reels) {
  const total = r.items.reduce((a, it) => a + (it.toMs - it.fromMs) / it.rate, 0);
  console.log(r.id, "|", (total / 1000).toFixed(1) + "s", "|", r.items.length, "items", "|", r.title);
  for (const it of r.items) {
    const w = WORDS[it.clip].filter(
      (x) => x.startMs >= it.fromMs - 60 && x.startMs < it.toMs,
    );
    console.log(
      `   ${it.clip} [${(it.fromMs / 1000).toFixed(2)}–${(it.toMs / 1000).toFixed(2)}]` +
        (it.rate !== 1 ? ` x${it.rate}` : "") +
        ` :: ${w.map((x) => x.text).join(" ")}`,
    );
  }
}
