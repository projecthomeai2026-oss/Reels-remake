import fs from "fs";
import path from "path";

// Merge whisper tokens into words (leading space = new word),
// drop hallucinated tags/credits, compute keep-segments per clip.

const clips = [
  "IMG_1404",
  "IMG_1406",
  "IMG_1407",
  "IMG_1409",
  "IMG_1411",
  "IMG_1412",
  "IMG_1415",
];

// ffmpeg silencedetect results (noise=-32dB, d=0.6), in seconds
const SILENCES = {
  IMG_1404: [],
  IMG_1406: [],
  IMG_1407: [
    [7.86, 8.6],
    [21.99, 22.64],
  ],
  IMG_1409: [
    [6.67, 7.73],
    [8.65, 9.54],
    [16.87, 17.48],
  ],
  IMG_1411: [[3.58, 4.33]],
  IMG_1412: [[17.15, 17.83]],
  IMG_1415: [
    [26.42, 27.35],
    [28.04, 33.04],
  ],
};

const CLIP_DURATION_S = {
  IMG_1404: 12.77,
  IMG_1406: 11.08,
  IMG_1407: 35.32,
  IMG_1409: 21.77,
  IMG_1411: 9.94,
  IMG_1412: 21.74,
  IMG_1415: 33.03,
};

const EDGE_KEEP_MS = 150; // keep this much of each silence edge (breathing room)
const MIN_CUT_MS = 250; // only cut if the remaining silence is longer than this

// Manually curated cuts of less interesting content, in ms (source-clip time)
const BORING_CUTS = {
  IMG_1404: [],
  // "Можно будет кайфовать и купаться у себя на участке в таком бассейне"
  IMG_1406: [[7000, 11080]],
  IMG_1407: [
    [5950, 10000], // "Вот так вот. Достаточно темно здесь."
    [14950, 23000], // "Приятного парня... всё подзаклеили... все штробы сделали."
    [26700, 29900], // "Очень будет стелёчек." (garbled)
  ],
  // repeated "вот так преобразился стал выглядеть наш Шанхай..."
  IMG_1409: [[17050, 21770]],
  // ""Шанхай" — наш любимый проект, люди его выбирают..."
  IMG_1412: [[9250, 13450]],
  // "Чуть позже буду показывать вам в режиме реального времени..." (keep "Пока!")
  IMG_1415: [[19150, 26340]],
};

const HALLUCINATION = /редактор субтитров|корректор|субтитров|с вами был|продолжение следует/i;

// Word-level corrections: exact word-sequence -> replacement words.
// Replacement words share the time span of the found sequence.
const FIXES = {
  IMG_1404: [[["лаван"], ["котлован"]]],
  IMG_1407: [
    [
      ["в", "Бентли", "Неваду,", "где", "полный", "вход", "отмыдён", "от", "ремонта."],
      ["в", "«Неваду»,", "где", "полным", "ходом", "идёт", "ремонт."],
    ],
  ],
  IMG_1409: [
    [["на", "шанхай"], ["Наш", "«Шанхай»"]],
    [["зарезит"], ["Церезит,"]],
    [["от", "флага"], ["от", "влаги,"]],
    [["сибит"], ["СИБИТ,"]],
    [["пара", "проницаемая"], ["паропроницаемая,"]],
    [["наш", "шанхай", "на", "второй", "улице", "улицы."], ["наш", "«Шанхай»", "на", "второй", "улице."]],
  ],
  IMG_1411: [[["На", "дэнере"], ["На", "«Денвере»"]]],
  IMG_1412: [
    [["с", "Бер-эпотека."], ["в", "Сбер-ипотеку."]],
    [["одного", "Шанхая."], ["одного", "«Шанхая»."]],
    [["Шанхай", "наш"], ["«Шанхай»", "—", "наш"]],
  ],
  IMG_1415: [],
};

const applyFixes = (words, fixes) => {
  for (const [find, replace] of fixes) {
    for (let i = 0; i <= words.length - find.length; i++) {
      const slice = words.slice(i, i + find.length);
      if (slice.every((w, j) => w.text.toLowerCase() === find[j].toLowerCase())) {
        const startMs = slice[0].startMs;
        const endMs = slice[slice.length - 1].endMs;
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

const result = {};

for (const clip of clips) {
  const raw = JSON.parse(
    fs.readFileSync(path.join("public", "captions", "raw", `${clip}.json`)),
  );

  // 1. Merge tokens into words
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

  // 2. Drop bracketed tags like [музыка] and hallucinated credits
  let clean = words.filter(
    (w) => !/^\[.*\]?$/.test(w.text) && !/\[|\]/.test(w.text),
  );
  const halluIdx = clean.findIndex(
    (w, i) =>
      /^(субтитров?|редактор|корректор)$/i.test(w.text.replace(/[.,!?]/g, "")) ||
      /^с вами был/i.test(
        clean.slice(i, i + 3).map((x) => x.text).join(" "),
      ),
  );
  if (halluIdx !== -1) clean = clean.slice(0, halluIdx);

  clean = applyFixes(clean, FIXES[clip] ?? []);

  // 3. Build keep-segments: clip duration minus detected silences
  const durMs = Math.round(CLIP_DURATION_S[clip] * 1000);
  const cuts = [];
  for (const [s, e] of SILENCES[clip]) {
    const isEdge = s === 0 || Math.abs(e * 1000 - durMs) < 300;
    const from = s === 0 ? 0 : s * 1000 + EDGE_KEEP_MS;
    const to = Math.abs(e * 1000 - durMs) < 300 ? durMs : e * 1000 - EDGE_KEEP_MS;
    if (to - from > (isEdge ? 100 : MIN_CUT_MS)) cuts.push([from, to]);
  }
  cuts.push(...(BORING_CUTS[clip] ?? []).map(([a, b]) => [a, Math.min(b, durMs)]));

  // Merge overlapping cut intervals
  cuts.sort((a, b) => a[0] - b[0]);
  for (let i = cuts.length - 1; i > 0; i--) {
    if (cuts[i][0] <= cuts[i - 1][1] + 50) {
      cuts[i - 1][1] = Math.max(cuts[i - 1][1], cuts[i][1]);
      cuts.splice(i, 1);
    }
  }

  // Drop caption words that fall inside cuts
  clean = clean.filter(
    (w) => !cuts.some(([a, b]) => w.startMs >= a - 60 && w.startMs < b),
  );
  const segments = [];
  let cursor = 0;
  for (const [from, to] of cuts) {
    if (from > cursor + 100) segments.push({ fromMs: cursor, toMs: from });
    cursor = to;
  }
  if (cursor < durMs - 100) segments.push({ fromMs: cursor, toMs: durMs });

  // Drop degenerate segments that contain no speech
  const spoken = (s) =>
    clean.some((w) => w.startMs < s.toMs && w.endMs > s.fromMs);
  const filtered = segments.filter((s) => s.toMs - s.fromMs > 1200 || spoken(s));
  segments.length = 0;
  segments.push(...filtered);

  result[clip] = { words: clean, segments };
  fs.writeFileSync(
    path.join("public", "captions", `${clip}.words.json`),
    JSON.stringify(clean, null, 2),
  );
}

fs.writeFileSync(
  path.join("src", "edit-plan.json"),
  JSON.stringify(
    Object.fromEntries(
      Object.entries(result).map(([k, v]) => [
        k,
        { segments: v.segments, words: v.words },
      ]),
    ),
    null,
    2,
  ),
);

for (const [clip, { words, segments }] of Object.entries(result)) {
  const kept = segments.reduce((a, s) => a + (s.toMs - s.fromMs), 0);
  console.log(
    clip,
    "| words:", words.length,
    "| segments:", segments.length,
    "| kept:", (kept / 1000).toFixed(1) + "s",
    "| sample:", words.slice(0, 6).map((w) => w.text).join(" "),
  );
}
