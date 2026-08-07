import fs from "fs";
import path from "path";

// Рилс 7 «Ставим бассейн» из съёмки 2026-07-21 (IMG_1616–1628).
// Речь: 1620 (основной рассказ), 1621 (чих), 1627 + 1628 (глубина бассейна).
// Б-ролл: 1616 (несут с «раз-два»), 1622, 1624 (ускоренный).
// 1618 выброшен целиком: крепкий мат + ненадёжная расшифровка.
// 1619 дублирует 1620, 1623/1625/1626 не влезли по хронометражу.

const SPEECH_CLIPS = ["IMG_1620", "IMG_1621", "IMG_1627", "IMG_1628"];
const BROLL_CLIPS = [
  "IMG_1616", "IMG_1622", "IMG_1624", "IMG_1458",
  "IMG_1625", "IMG_1626",
];

// Исправления распознавания: последовательность слов -> замена
const FIXES = {
  IMG_1620: [
    [["четенько,"], ["чётенько,"]],
    [["все", "было"], ["всё", "было"]],
  ],
  IMG_1621: [],
  IMG_1627: [
    [["Басик"], ["басик"]],
  ],
  IMG_1628: [
    [["так"], ["Так,"]],
    [["просторной"], ["просторный"]],
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
    (w) =>
      !/\[|\]|\(|\)/.test(w.text) && // [Субтитры…], (говорят по-французски)
      w.text.trim(),
  );
  WORDS[clip] = applyFixes(clean, FIXES[clip] ?? []);
}
for (const clip of BROLL_CLIPS) WORDS[clip] = [];

// Перетайминг: whisper смазал слова в паузы (silencedetect — источник правды).
// Раскладывает последовательность слов равномерно по [fromMs, toMs].
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

// 1620: «два дня…» реально звучит после паузы 0.89–2.03
respace(
  WORDS.IMG_1620,
  ["два", "дня", "назад", "бурили", "ямы", "под", "террасу,"],
  2050, 4400,
);
// 1621: речь по silencedetect — 0.74–1.46 и 2.0–2.9
respace(WORDS.IMG_1621, ["Будьте", "здоровы!"], 740, 1455, 0);
respace(WORDS.IMG_1621, ["Будьте", "здоровы!"], 2000, 2900, 1);
// 1628: речь начинается с 0.72, а не с нуля
respace(
  WORDS.IMG_1628,
  ["Так,", "152", "сантиметра", "глубина", "у", "бассейна"],
  750, 2900,
);

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
    id: "reel7",
    title: "Ставим бассейн",
    music: "music7.mp3", // Pixabay: GR0ZA — Upbeat Background Music (funk)
    items: [
      // холодный опенер (VHS): «будем кайфовать здесь, купаться чисто туда-сюда»
      // (пауза 12.74–13.28 вырезана; фраза потом повторяется на своём месте)
      item("IMG_1620", [12.31, 12.89], { hookLook: true }),
      item("IMG_1620", [13.13, 16.0], { hookLook: true }),
      // начало истории: «два дня назад бурили ямы под террасу» (пауза 0.89–2.03 вырезана)
      item("IMG_1620", [0, 1.04], { flash: true }),
      item("IMG_1620", [1.88, 4.44]),
      // флешбэк (VHS): таймлапс бурения из съёмки 2026-07-18
      item("IMG_1458", [64.7, 125.0], {
        rate: 10,
        volume: 0.15,
        flash: true,
        badge: "×10",
        hookLook: true,
      }),
      // основной рассказ: привезли бассейн, делаем террасу (пауза 12.74–13.28 вырезана)
      item("IMG_1620", [4.44, 12.89], { flash: true }),
      item("IMG_1620", [13.13, 16.0]),
      // разгрузка бассейна: чаша на участке
      item("IMG_1625", [0.3, 4.3], { flash: true, volume: 0.25 }),
      item("IMG_1626", [0, 3.6], { volume: 0.25 }),
      // несут чашу (счёт «раз-два» заглушен по просьбе Романа)
      item("IMG_1616", [0, 2.53], { flash: true, volume: 0 }),
      item("IMG_1622", [1.54, 4.06], { volume: 0.3 }),
      // команда у бассейна, ускорено
      item("IMG_1624", [2.83, 11.98], { rate: 3, volume: 0.12, flash: true, badge: "×3" }),
      // чих — «Будьте здоровы!» (вход и пауза между репликами подрезаны)
      item("IMG_1621", [0.6, 1.61], { flash: true }),
      item("IMG_1621", [1.85, 4.03]),
      // «вот такой будет басик — глубокий» (вырезаны паузы 1.35–3.35 и 4.80–5.69,
      // фраза «сейчас узнаю характеристики» 6.2–7.42 и тихий хвост после 8.96)
      item("IMG_1627", [0, 1.35], { flash: true }),
      item("IMG_1627", [3.35, 4.8]),
      item("IMG_1627", [5.69, 6.2]),
      item("IMG_1627", [7.42, 8.96]),
      // финал: 152 см + для клиентов (тихий вход, паузы 2.92–3.95 и 10.01–10.61
      // подрезаны; кусок 5.4–9.9 с невнятным и смятый хвост — вырезаны)
      item("IMG_1628", [0.57, 3.07], { flash: true }),
      item("IMG_1628", [3.8, 5.4]),
      item("IMG_1628", [9.9, 10.16]),
      item("IMG_1628", [10.46, 14.27]),
    ],
  },
];

fs.writeFileSync(
  path.join("src", "reel7-plan.json"),
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
