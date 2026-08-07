import fs from "fs";
import path from "path";

// Single-clip processing for IMG_1437 (дежурство в «Этажи»).
// Same logic as process-captions.mjs, scoped to one clip.

const CLIP = "IMG_1437";
const DUR_MS = 38530;

// ffmpeg silencedetect (noise=-32dB, d=0.6), seconds
const SILENCES = [
  [0, 3.55],
  [5.29, 6.01],
  [27.28, 28.03],
  // [32.18, 33.62] оставляем: тихая концовка под CTA «Подпишись»
  [35.03, 38.55],
];

const EDGE_KEEP_MS = 150;
const MIN_CUT_MS = 250;

// Жёсткий вырез: сильный вдох (33.6–35.0s) и всё после него;
// тихий хвост 31.5–33.3s остаётся под CTA
const HARD_CUTS = [[33300, DUR_MS]];

const FIXES = [
  [["привет!"], ["Всем", "привет!"]],
  [
    ["компании", "это", "же", "наша", "партнера"],
    ["компании", "«Этажи»", "—", "это", "наш", "партнёр,"],
  ],
  [["карьера", "недвижимости."], ["карьера", "в", "недвижимости."]],
  [
    ["я", "все-вдруг", "кому-то", "интересно,"],
    ["если", "вдруг", "кому-то", "интересно", "—"],
  ],
];

const applyFixes = (words, fixes) => {
  for (const [find, replace] of fixes) {
    for (let i = 0; i <= words.length - find.length; i++) {
      const slice = words.slice(i, i + find.length);
      if (slice.every((w, j) => w.text.toLowerCase() === find[j].toLowerCase())) {
        const startMs = slice[0].startMs;
        // Не даём заменам растягиваться через паузы (whisper иногда
        // приклеивает к слову длинный хвост тишины)
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

const raw = JSON.parse(
  fs.readFileSync(path.join("public", "captions", "raw", `${CLIP}.json`)),
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

let clean = words.filter(
  (w) => !/^\[.*\]?$/.test(w.text) && !/\[|\]/.test(w.text),
);
clean = applyFixes(clean, FIXES);

const cuts = [];
for (const [s, e] of SILENCES) {
  const isEdge = s === 0 || Math.abs(e * 1000 - DUR_MS) < 300;
  const from = s === 0 ? 0 : s * 1000 + EDGE_KEEP_MS;
  const to = Math.abs(e * 1000 - DUR_MS) < 300 ? DUR_MS : e * 1000 - EDGE_KEEP_MS;
  if (to - from > (isEdge ? 100 : MIN_CUT_MS)) cuts.push([from, to]);
}

cuts.push(...HARD_CUTS);
cuts.sort((a, b) => a[0] - b[0]);
for (let i = cuts.length - 1; i > 0; i--) {
  if (cuts[i][0] <= cuts[i - 1][1] + 50) {
    cuts[i - 1][1] = Math.max(cuts[i - 1][1], cuts[i][1]);
    cuts.splice(i, 1);
  }
}

clean = clean.filter(
  (w) => !cuts.some(([a, b]) => w.startMs >= a - 60 && w.startMs < b),
);

const segments = [];
let cursor = 0;
for (const [from, to] of cuts) {
  if (from > cursor + 100) segments.push({ fromMs: cursor, toMs: from });
  cursor = to;
}
if (cursor < DUR_MS - 100) segments.push({ fromMs: cursor, toMs: DUR_MS });

const spoken = (s) => clean.some((w) => w.startMs < s.toMs && w.endMs > s.fromMs);
const filtered = segments.filter((s) => s.toMs - s.fromMs > 1200 || spoken(s));

fs.writeFileSync(
  path.join("src", "edit-plan-1437.json"),
  JSON.stringify({ [CLIP]: { segments: filtered, words: clean } }, null, 2),
);

const kept = filtered.reduce((a, s) => a + (s.toMs - s.fromMs), 0);
console.log(
  "words:", clean.length,
  "| segments:", JSON.stringify(filtered),
  "| kept:", (kept / 1000).toFixed(1) + "s",
);
console.log(clean.map((w) => w.text).join(" "));
