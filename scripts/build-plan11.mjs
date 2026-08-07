import fs from "fs";
import path from "path";

// Рилс 11 «Джакузи и терраса» из полного клипа IMG_1727B (2026-07-26, 84 с):
// устройство террасы + чаша под джакузи + интрига «куда поставим» + сваи.
// БЕЗ цветофильтров (просьба Романа) — натуральный вход.

const SPEECH_CLIPS = ["IMG_1727B"];
const FIXES = {
  IMG_1727B: [[["слои,"], ["сваи,"]], [["слои"], ["сваи"]]],
};

const applyFixes = (words, fixes) => {
  for (const [find, replace] of fixes) {
    for (let i = 0; i <= words.length - find.length; i++) {
      const slice = words.slice(i, i + find.length);
      if (slice.every((w, j) => w.text.toLowerCase() === find[j].toLowerCase())) {
        const startMs = slice[0].startMs;
        const endMs = Math.min(slice[slice.length - 1].endMs, startMs + 450 * replace.length);
        const step = (endMs - startMs) / replace.length;
        const replacement = replace.map((text, j) => ({
          text, startMs: Math.round(startMs + j * step), endMs: Math.round(startMs + (j + 1) * step),
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
  const raw = JSON.parse(fs.readFileSync(path.join("public", "captions", "raw", `${clip}.json`)));
  const words = [];
  for (const t of raw) {
    const isNewWord = t.text.startsWith(" ") || words.length === 0;
    const isPunct = /^[.,!?…:;\-–—]+$/.test(t.text.trim());
    if (isNewWord && !isPunct) words.push({ text: t.text.trim(), startMs: t.startMs, endMs: t.endMs });
    else if (words.length > 0) { words[words.length - 1].text += t.text.trimEnd().replace(/^ /, ""); words[words.length - 1].endMs = t.endMs; }
  }
  const clean = words.filter((w) => !/\[|\]|\(|\)/.test(w.text) && w.text.trim());
  WORDS[clip] = applyFixes(clean, FIXES[clip] ?? []);
}

const item = (clip, seg, opts = {}) => ({
  clip,
  fromMs: Math.round(seg[0] * 1000),
  toMs: Math.round(seg[1] * 1000),
  rate: opts.rate ?? 1,
  volume: opts.volume ?? 1,
  flash: opts.flash ?? false,
  badge: opts.badge ?? null,
  hookLook: opts.hookLook ?? false,
  captionToMs: opts.captionToMs != null ? Math.round(opts.captionToMs * 1000) : null,
});

const reels = [
  {
    id: "reel11",
    title: "Джакузи и терраса",
    music: "music8.mp3",
    stickers: [
      { text: "Зона отдыха с террасой", atMs: 3600, durMs: 4000, top: 300, rotation: -2, fontSize: 46 },
    ],
    items: [
      // ХУК без цветофильтра — продающая мечта
      item("IMG_1727B", [47.53, 50.8]),
      // терраса — инфа голосом
      item("IMG_1727B", [40.11, 44.52], { flash: true }),
      item("IMG_1727B", [44.52, 47.53], { flash: true }),
      // чаша появилась
      item("IMG_1727B", [50.8, 55.26], { flash: true }),
      // это будет джакузи
      item("IMG_1727B", [55.26, 58.4], { flash: true }),
      // интрига: куда поставим
      item("IMG_1727B", [59.68, 62.02], { flash: true }),
      item("IMG_1727B", [62.02, 69.34], { flash: true }),
      // энергичный кусок про сваи
      item("IMG_1727B", [69.34, 77.28], { flash: true }),
      // финал
      item("IMG_1727B", [80.28, 82.4], { flash: true }),
    ],
  },
];

fs.writeFileSync(path.join("src", "reel11-plan.json"), JSON.stringify({ words: WORDS, reels }, null, 2));

for (const r of reels) {
  const total = r.items.reduce((a, it) => a + (it.toMs - it.fromMs) / it.rate, 0);
  console.log(r.id, "|", (total / 1000).toFixed(1) + "s", "|", r.items.length, "items", "|", r.title);
  for (const it of r.items) {
    const w = WORDS[it.clip].filter((x) => x.startMs >= it.fromMs - 60 && x.startMs < (it.captionToMs ?? it.toMs));
    console.log(`   [${(it.fromMs / 1000).toFixed(1)}–${(it.toMs / 1000).toFixed(1)}] :: ${w.map((x) => x.text).join(" ")}`);
  }
}
