import fs from "fs";
import path from "path";

// Рилс 9 «Плита готова» v2 из съёмки 2026-07-22 (IMG_1632B — удлинённый экспорт
// того же дубля, что и IMG_1632: в конце есть блупер «что-то не пошло у меня не так»).
// Хук по просьбе Романа — из последних 4 секунд: блупер холодным опенером,
// он же в цвете — панчлайн в самом конце. Крепкий мат (22.71–22.98) вырезан стыком.

const SPEECH_CLIPS = ["IMG_1632B"];

// Исправления распознавания
const FIXES = {
  IMG_1632B: [
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
// паузы 4.44–5.12, 8.08–8.66, 14.20–14.70, 16.81–17.28 (тайминги дубля = IMG_1632)
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
respace(WORDS.IMG_1632B, ["под", "заливку", "бетона."], 5120, 5960);
// «Как» прилип к «стены.» — речь после паузы идёт с 14.70
respace(WORDS.IMG_1632B, ["Как", "вы", "знаете"], 14700, 15100);
// «стены из сибита» звучит после паузы с 17.28
respace(WORDS.IMG_1632B, ["стены", "из", "сибита"], 17300, 18050);
// хвост «укладываются.» уполз в блупер — реально заканчивается к 22.66
respace(WORDS.IMG_1632B, ["укладываются."], 21600, 22660);
// блупер: точные тайминги из отдельной транскрипции хвоста (whisper на 22–25 с)
respace(WORDS.IMG_1632B, ["Что-то"], 23030, 23330);
respace(WORDS.IMG_1632B, ["не", "пошло", "у", "меня"], 23330, 23990);
respace(WORDS.IMG_1632B, ["не", "так."], 23990, 24380);

// «блять» (22.71–22.98) whisper на полном прогоне не услышал — возвращаем:
// Роман попросил мат оставить («мат мы любим»). В звуке как есть,
// в субтитрах звёздочка для IG
const matIdx = WORDS.IMG_1632B.findIndex((w) => w.text === "Что-то");
WORDS.IMG_1632B.splice(matIdx, 0, {
  text: "бл*ть,",
  startMs: 22710,
  endMs: 22980,
});

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
    id: "reel9",
    title: "Плита готова",
    music: "music6.mp3",
    items: [
      // цветной эффектный опенер — из последних 4 секунд, начало раньше:
      // «укладываются… бл*ть, что-то не пошло у меня не так». Мат оставлен,
      // звук непрерывный; бит-склейка со вспышкой ровно на мате
      item("IMG_1632B", [21.55, 22.7], { hookLook: true }),
      item("IMG_1632B", [22.7, 24.95], { hookLook: true, flash: true }),
      // история с начала: подготовка основания (пауза 4.44–5.12 вырезана)
      item("IMG_1632B", [0, 4.44], { flash: true }),
      // «под заливку бетона. Вчера успешно приняли бетон» (пауза 8.08–8.66 подрезана)
      item("IMG_1632B", [5.12, 8.12]),
      // «Плита под новый дом готова… начнём выкладывать стены» (пауза 14.20–14.70 подрезана)
      item("IMG_1632B", [8.6, 14.24], { flash: true }),
      // «Как вы знаете из моих предыдущих роликов» (пауза 16.81–17.28 вырезана)
      item("IMG_1632B", [14.7, 16.86]),
      // «стены из сибита с высокой скоростью укладываются»
      item("IMG_1632B", [17.28, 22.7], { flash: true }),
      // панчлайн в цвете: блупер целиком с матом — ответ на хук
      item("IMG_1632B", [22.7, 24.95], { flash: true }),
    ],
  },
];

fs.writeFileSync(
  path.join("src", "reel9-plan.json"),
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
