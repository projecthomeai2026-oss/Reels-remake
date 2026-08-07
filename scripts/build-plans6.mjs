import fs from "fs";
import path from "path";

// Сборка edit-планов для 6 рилсов из IMG_1457 / IMG_1458 / IMG_1460.
// Паузы — ffmpeg silencedetect (noise=-32dB, d=0.6); мат и мусор — ручные вырезы.

const CLIPS = ["IMG_1457", "IMG_1458", "IMG_1460"];

const DUR_MS = {
  IMG_1457: 42573,
  IMG_1458: 239775,
  IMG_1460: 145188,
};

// silencedetect, в секундах
const SILENCES = {
  IMG_1457: [
    [0, 0.654], [3.944, 4.621], [5.249, 6.436], [9.108, 9.722],
    [32.942, 34.634], [40.789, 41.919],
  ],
  IMG_1458: [
    [11.79, 12.647], [15.915, 17.455], [17.613, 18.744], [22.456, 23.699],
    [24.532, 25.647], [36.637, 38.379], [41.67, 42.582], [43.407, 44.958],
    [49.058, 49.906], [51.389, 52.544], [52.744, 54.204], [58.678, 59.722],
    [63.552, 64.523], [65.585, 67.515], [173.913, 174.549], [179.672, 181.93],
    [190.751, 191.443], [192.724, 193.989], [195.933, 197.428],
    [200.429, 201.445], [204.04, 205.27], [208.435, 209.152],
    [213.581, 214.812], [215.387, 217.257], [223.038, 223.823],
    [224.851, 225.78], [225.824, 226.659], [232.889, 233.708],
    [235.73, 237.057],
  ],
  IMG_1460: [
    [28.932, 29.591], [30.946, 31.727], [53.717, 54.37], [55.639, 56.315],
    [58.779, 60.432], [61.024, 61.815], [63.868, 64.738], [76.203, 76.907],
    [86.67, 87.459], [94.609, 95.705], [96.097, 96.929], [103.298, 105.521],
    [109.556, 110.203],
  ],
};

const EDGE_KEEP_MS = 150;
const MIN_CUT_MS = 250;

// Исправления распознавания: последовательность слов -> замена
const FIXES = {
  IMG_1457: [
    [["состройки."], ["со", "стройки."]],
    [["лед-дождь."], ["льёт", "дождь."]],
    [["прихуярят"], ["прих*ярят"]],
  ],
  IMG_1458: [
    [["террас", "а", "а"], ["терраса.", "А"]],
    [["св", "а", "и"], ["сваи"]],
    [["басики", "коктейль"], ["басике", "коктейли"]],
    [["чиска"], ["очистка"]],
    [["здравиков"], ["здоровяков"]],
    [["два", "прораба"], ["«ДВА", "ПРОРАБА»"]],
    [["ахуеть"], ["оф*геть"]],
  ],
  IMG_1460: [
    [["Bentley", "Nevada,"], ["«Бентли-Неваде»,"]],
    [["Брата", "тебя"], ["Брат,", "а", "тебя"]],
    [["трещина", "и", "стойкая"], ["трещиностойкая,"]],
    [["Трещина,", "стойкая"], ["трещиностойкая"]],
    [["шпакливаться."], ["шпаклеваться."]],
    [["Шпакливаться,"], ["Шпаклеваться,"]],
    [["Облесоваться."], ["Облицовываться."]],
    [["вровь,", "вровень"], ["вровень"]],
    [["Мавалон."], ["Мавлон."]],
    [["Мавалон?"], ["Мавлон?"]],
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

// --- Слова из raw-транскриптов ---
const WORDS = {};
for (const clip of CLIPS) {
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
  let clean = words.filter(
    (w) => !/^\[.*\]?$/.test(w.text) && !/\[|\]/.test(w.text) && w.text.trim(),
  );
  clean = clean.map((w) => ({
    ...w,
    text: w.text.replace(/стекло-холст/gi, (m) =>
      m[0] === "С" ? "Стеклохолст" : "стеклохолст",
    ),
  }));
  WORDS[clip] = applyFixes(clean, FIXES[clip] ?? []);
}

// Whisper затянул «арматуры…» в паузу 5.25–6.44 — реально фраза после паузы;
// раскладываем 5 слов равномерно по [6.45, 8.32]
{
  const ws = WORDS.IMG_1457;
  const i = ws.findIndex((w) => w.text === "арматуры");
  if (i !== -1) {
    const span = [6450, 8320];
    const step = (span[1] - span[0]) / 5;
    for (let j = 0; j < 5 && i + j < ws.length; j++) {
      ws[i + j].startMs = Math.round(span[0] + j * step);
      ws[i + j].endMs = Math.round(span[0] + (j + 1) * step);
    }
  }
}

// Галлюцинации whisper во время шума мотобура (реальной речи там нет)
WORDS.IMG_1458 = WORDS.IMG_1458.filter(
  (w) => w.startMs < 63500 || w.startMs > 174400,
);

// --- Вырезание пауз из диапазона ---
// range [a,b] сек; cutsSec — ручные вырезы; результат: сегменты в мс
const cutRange = (clip, rangeSec, extraCutsSec = [], skipSilSec = []) => {
  const [ra, rb] = rangeSec.map((s) => Math.round(s * 1000));
  const raw = [];
  for (const [s, e] of SILENCES[clip]) {
    if (skipSilSec.some(([ss, se]) => Math.abs(ss - s) < 0.01 && Math.abs(se - e) < 0.01)) continue;
    const sm = s * 1000;
    const em = e * 1000;
    if (em <= ra || sm >= rb) continue;
    const from = Math.max(ra, sm + EDGE_KEEP_MS);
    const to = Math.min(rb, em - EDGE_KEEP_MS);
    if (to - from > MIN_CUT_MS) raw.push([from, to]);
  }
  for (const [s, e] of extraCutsSec) {
    const from = Math.max(ra, s * 1000);
    const to = Math.min(rb, e * 1000);
    if (to > from) raw.push([from, to]);
  }
  raw.sort((a, b) => a[0] - b[0]);
  const cuts = [];
  for (const c of raw) {
    const last = cuts[cuts.length - 1];
    if (last && c[0] <= last[1] + 50) last[1] = Math.max(last[1], c[1]);
    else cuts.push([...c]);
  }
  const segments = [];
  let cursor = ra;
  for (const [from, to] of cuts) {
    if (from > cursor + 100) segments.push({ fromMs: cursor, toMs: Math.round(from) });
    cursor = Math.round(to);
  }
  if (cursor < rb - 100) segments.push({ fromMs: cursor, toMs: rb });
  return segments;
};

const item = (clip, seg, opts = {}) => ({
  clip,
  fromMs: Math.round(seg.fromMs ?? seg[0] * 1000),
  toMs: Math.round(seg.toMs ?? seg[1] * 1000),
  rate: opts.rate ?? 1,
  volume: opts.volume ?? 1,
  flash: opts.flash ?? false,
  badge: opts.badge ?? null,
  hookLook: opts.hookLook ?? false,
});

// --- 6 рилсов ---
const reels = [];

// R1: Новый «Шанхай», фундамент под ледяным дождём (IMG_1457)
{
  // хук — «Сейчас арматуры прих*ярят мне по ноге» с начала исходника,
  // визуально отличается: ч/б + чёрные киношные полосы
  const hook = cutRange("IMG_1457", [4.62, 8.32]).map((s) =>
    item("IMG_1457", s, { hookLook: true }),
  );
  // конец — сразу после «Но это всё», хвост про «пилим контент» убран
  const main = cutRange("IMG_1457", [8.32, 36.46]).map((s, i) =>
    item("IMG_1457", s, { flash: i === 0 }),
  );
  reels.push({
    id: "reel1",
    title: "Новый «Шанхай» · фундамент",
    music: "music5.mp3",
    items: [...hook, ...main],
  });
}

// R1-clean: тот же рилс, но без матерного хука — холодный опенер «Покупаешь дом, бам»
{
  const hook = item("IMG_1457", [29.6, 32.94]);
  const main = cutRange("IMG_1457", [8.32, 36.46]).map((s, i) =>
    item("IMG_1457", s, { flash: i === 0 }),
  );
  reels.push({
    id: "reel1clean",
    title: "Новый «Шанхай» · фундамент",
    music: "music5.mp3",
    items: [hook, ...main],
  });
}

// R2: Терраса и бассейн — разговор с бригадой (IMG_1458, начало)
{
  const hook = item("IMG_1458", [26.8, 32.2]);
  // вырез «ахуенно» [44.7, 45.98]
  const main = cutRange("IMG_1458", [0, 49.2], [[44.7, 45.98]]).map((s, i) =>
    item("IMG_1458", s, { flash: i === 0 }),
  );
  reels.push({
    id: "reel2",
    title: "Терраса + бассейн",
    music: "music2.mp3",
    items: [hook, ...main],
  });
}

// R3: Роман пробует мотобур + таймлапс бурения (IMG_1458, середина)
{
  const hook = item("IMG_1458", [100, 102.5], { volume: 0.5 });
  // вырез мата/мусора [53.2, 59.87]
  const talk = cutRange("IMG_1458", [49.9, 63.55], [[53.2, 59.87]]).map(
    (s, i) => item("IMG_1458", s, { flash: i === 0 }),
  );
  const lapse = item("IMG_1458", [64.67, 174.0], {
    rate: 10,
    volume: 0.12,
    flash: true,
    badge: "×10",
  });
  reels.push({
    id: "reel3",
    title: "Бурим сваи сами",
    music: "music3.mp3",
    items: [hook, ...talk, lapse],
  });
}

// R4: Жёсткий грунт, винтовые сваи, нужен трактор (IMG_1458, конец)
{
  const hook = item("IMG_1458", [181.95, 187.5]);
  // вырезы: «и блять» [199.3, 201.295], «это хуйня» [225.0, 226.66];
  // «ахуеть» остаётся в аудио, в субтитрах цензура через FIXES
  const main = cutRange(
    "IMG_1458",
    [174.7, 235.7],
    [[199.3, 201.295], [225.0, 226.66]],
    [[208.435, 209.152]],
  ).map((s, i) => item("IMG_1458", s, { flash: i === 0 }));
  reels.push({
    id: "reel4",
    title: "Жёсткий грунт",
    music: "music4.mp3",
    items: [hook, ...main],
  });
}

// R5: «Бентли-Невада»: гидроизоляция + стеклохолст с Мавлоном (IMG_1460, начало)
// v2 (2026-07-21): холодный VHS-хук «куяк налево-направо, чик-чик-брик-пам»,
// музыка динамичнее (music8 — SunSides dance с Pixabay)
{
  const hook = item("IMG_1460", [13.3, 16.55], { hookLook: true });
  const main = cutRange("IMG_1460", [0, 53.87]).map((s, i) =>
    item("IMG_1460", s, { flash: i === 0 }),
  );
  const items = [hook, ...main];
  // глобальное время по времени исходника (с учётом склеек)
  const globalAt = (clipSec) => {
    let cursor = 0;
    for (const it of items) {
      const ms = clipSec * 1000;
      if (ms >= it.fromMs && ms < it.toMs) return cursor + (ms - it.fromMs) / it.rate;
      cursor += (it.toMs - it.fromMs) / it.rate;
    }
    return cursor;
  };
  reels.push({
    id: "reel5",
    title: "Ремонт в «Бентли-Неваде»",
    music: "music8.mp3",
    items,
    stickers: [
      // «синенько, красивенько» ~9.2–9.7
      { text: "СИНЕНЬКО ✨ КРАСИВЕНЬКО", atMs: Math.round(globalAt(9.2)), durMs: 2300, top: 430, rotation: -4, fontSize: 44 },
      // знакомство с Мавлоном, «Красавчик» ~21.7
      { text: "КРАСАВЧИК 💪", atMs: Math.round(globalAt(21.7)), durMs: 2500, top: 400, rotation: 3, fontSize: 52 },
      // «Вообще кайф» ~51.6
      { text: "ВООБЩЕ КАЙФ 🔥", atMs: Math.round(globalAt(51.6)), durMs: 2300, top: 430, rotation: -3, fontSize: 54 },
    ],
  });
}

// R6: Скрытые двери + Мавлон-учитель, финал субботы (IMG_1460, конец)
{
  const hook = item("IMG_1460", [80.3, 87.4]);
  // вырезы: шутка про клей [58.9, 64.8], повтор про двери [86.7, 95.455],
  // повтор про имя [113.95, 122.62]; короткую паузу 96.1–96.9 оставляем
  const main = cutRange(
    "IMG_1460",
    [54.8, 141.8],
    [[57.9, 64.8], [86.7, 95.455], [113.95, 123.25]],
    [[96.097, 96.929]],
  ).map((s, i) => item("IMG_1460", s, { flash: i === 0 }));
  reels.push({
    id: "reel6",
    title: "Скрытые двери · Мавлон",
    music: "music2.mp3",
    items: [hook, ...main],
  });
}

fs.writeFileSync(
  path.join("src", "reels6-plan.json"),
  JSON.stringify({ words: WORDS, reels }, null, 2),
);

for (const r of reels) {
  const total = r.items.reduce(
    (a, it) => a + (it.toMs - it.fromMs) / it.rate,
    0,
  );
  console.log(
    r.id,
    "|", (total / 1000).toFixed(1) + "s",
    "|", r.items.length, "items",
    "|", r.title,
  );
  for (const it of r.items) {
    const w = WORDS[it.clip].filter(
      (x) => x.startMs >= it.fromMs - 60 && x.startMs < it.toMs,
    );
    console.log(
      `   ${it.clip} [${(it.fromMs / 1000).toFixed(2)}–${(it.toMs / 1000).toFixed(2)}]` +
        (it.rate !== 1 ? ` x${it.rate}` : "") +
        ` :: ${w.map((x) => x.text).join(" ").slice(0, 90)}`,
    );
  }
}
