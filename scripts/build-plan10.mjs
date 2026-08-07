import fs from "fs";
import path from "path";

// Рилс 10 v2 «Тихие стены» из съёмки 2026-07-24 (IMG_1725, визит к плиточникам).
// Переделка по правкам Романа: хук — вау-фишка «тихие стены» (не юмор про цену),
// контент плотнее и содержательнее (процесс/технологии, без болтовни).

const SPEECH_CLIPS = ["IMG_1725"];

const FIXES = {
  IMG_1725: [
    [["облитьки"], ["плитки"]],
    [["мавлон"], ["Мавлон"]],
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

// Перетайминг слов хука: whisper на полном файле ошибся на ~1.4с
// (реально «Поэтому» с 104.59, проверено отдельной транскрипцией куска).
// Правим startMs/endMs, чтобы и обрезка, и субтитры совпали со звуком.
const retime = (clip, seq) => {
  const words = WORDS[clip];
  for (let i = 0; i <= words.length - seq.length; i++) {
    if (seq.every((x, j) => words[i + j].text.toLowerCase().replace(/[.,!?…]+$/g, "") === x[0].toLowerCase())) {
      seq.forEach((x, j) => {
        words[i + j].startMs = x[1];
        words[i + j].endMs = x[2];
      });
      return;
    }
  }
  throw new Error("retime: не найдено " + seq.map((x) => x[0]).join(" "));
};
retime("IMG_1725", [
  ["стоит", 102720, 103050],
  ["очень", 103100, 103650],
  ["дорого", 103710, 104400],
  ["поэтому", 104590, 105050],
  ["ребята", 105070, 105600],
  ["монтаж", 105620, 105900],
  ["ведут", 105920, 106260],
  ["еще", 106280, 106490],
  ["аккуратнее", 106500, 107100],
]);
// «же» в whisper стоит позже реального (27.2 vs факт 26.84) и лезет в субтитр
// после обрезки — двигаем на реальное место, за границу сегмента
retime("IMG_1725", [["же", 26500, 26840]]);
retime("IMG_1725", [["правильно", 27190, 27850]]);
// сегмент «процесс» (28-я сек рилса) — whisper сильно сдвинут, синхроним точно
retime("IMG_1725", [
  ["здесь", 74790, 75210], ["клей", 75210, 75390], ["да", 75390, 75540],
  ["плитка", 75540, 75990], ["да", 75990, 76810], ["да", 76810, 77280],
  ["гидроизоляцию", 77280, 78190], ["сделали", 78190, 78700], ["типа", 78700, 79040],
  ["и", 79040, 79160], ["все", 79160, 79380], ["потом", 79380, 79760],
  ["клей", 79760, 80080], ["плитка", 80080, 80560], ["погнали", 80560, 81140],
  ["выставляем", 81140, 81910], ["все", 81910, 82140], ["четко", 82140, 82600],
  ["красиво", 82600, 83240],
]);
// сегмент плитки 20×20 — тоже синхроним
retime("IMG_1725", [
  ["обратите", 95520, 96110], ["внимание", 96110, 97250], ["дамы", 97250, 97810],
  ["и", 97810, 97950], ["господа", 97950, 99000], ["вот", 99000, 99660],
  ["это", 99660, 99880], ["на", 99880, 100000], ["богатом", 100000, 101030],
  ["20", 101030, 101590], ["на", 101590, 102550], ["20", 102600, 102660],
]);
// концовка тихих стен + обещание: whisper сдвинул на ~0.6с раньше реального
retime("IMG_1725", [
  ["будет", 181000, 181700],
  ["очень", 181710, 182300],
  ["тихо", 182340, 183000],
  ["чуть", 183140, 183500],
  ["позже", 183510, 184100],
  ["уже", 184170, 184190],
  ["когда", 184200, 184500],
  ["появится", 184520, 185000],
  ["я", 185000, 185070],
  ["вам", 185080, 185650],
  ["покажу", 185690, 186350],
]);
// «ну все» (начало прощания) whisper ставит раньше «покажу» — сдвигаем за
// границу концовки, чтобы не лезло в субтитр
{
  const wi = WORDS.IMG_1725;
  const idx = wi.findIndex((w) => w.startMs === 185690);
  if (wi[idx + 1]) { wi[idx + 1].startMs = 186600; wi[idx + 1].endMs = 186900; }
  if (wi[idx + 2]) { wi[idx + 2].startMs = 186920; wi[idx + 2].endMs = 187200; }
}
// Синхрон с 28-й секунды (просьба Романа): whisper слепил быструю речь.
// Плитка 20×20 — точные тайминги:
retime("IMG_1725", [
  ["обратите", 96070, 97300],
  ["внимание", 97310, 98700],
  ["дамы", 98730, 98840],
  ["и", 98850, 98950],
  ["господа", 98960, 99650],
  ["вот", 99700, 99790],
  ["это", 99800, 99890],
  ["на", 99900, 100030],
  ["богатом", 100040, 101000],
  ["20", 101040, 101380],
  ["на", 101390, 101460],
  ["20", 101470, 101850],
]);
// Процесс — равномерно распределяем слипшуюся скороговорку по реальным якорям:
retime("IMG_1725", [
  ["клей", 75650, 75990],
  ["да", 76000, 76550],
  ["плитка", 76600, 77250],
  ["да", 77260, 77460],
  ["да", 77470, 77750],
  ["гидроизоляцию", 77760, 79300],
  ["сделали", 80390, 80720],
  ["типа", 80730, 80950],
  ["и", 80960, 81050],
  ["все", 81060, 81230],
  ["потом", 81240, 81430],
  ["клей", 81440, 81600],
  ["плитка", 81610, 81820],
  ["погнали", 81830, 82080],
  ["выставляем", 82090, 82560],
  ["все", 82570, 82760],
  ["четко", 82770, 83020],
  ["красиво", 83030, 83600],
]);
// «да» после «аккуратнее» — лишнее, сдвигаем за границу хука
{
  const wi = WORDS.IMG_1725;
  const idx = wi.findIndex((w) => w.startMs === 106500);
  if (wi[idx + 1] && wi[idx + 1].text.replace(/[.,!?…]+$/g, "").toLowerCase() === "да") {
    wi[idx + 1].startMs = 108000;
    wi[idx + 1].endMs = 108300;
  }
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
  // граница для субтитров (если нужно показать меньше слов, чем звучит)
  captionToMs: opts.captionToMs != null ? Math.round(opts.captionToMs * 1000) : null,
});

const reels = [
  {
    id: "reel10",
    title: "Тихие стены",
    music: "music7.mp3",
    items: [
      // ХУК с заходом ~2с: «стоит очень дорого, поэтому ребята монтаж ведут
      // ещё аккуратнее» — завязка+панч. Без цветофильтра/полос (просьба Романа)
      // хук по звуку полный (с «да»), но субтитры — до «да» (просьба Романа)
      item("IMG_1725", [102.66, 107.35], { captionToMs: 107.1 }),
      // приезд на объект
      item("IMG_1725", [3.2, 7.0], { flash: true }),
      item("IMG_1725", [9.25, 12.5]),
      // кварцвинил на пол (без «а это плитка же» — с «правильно?»)
      item("IMG_1725", [27.15, 29.95], { flash: true }),
      // (порядок сегментов ниже: санузел, процесс, плитка)
      // санузел: было синий → стало
      item("IMG_1725", [35.3, 41.8], { flash: true }),
      // процесс: гидроизоляция → клей → плитка
      item("IMG_1725", [74.75, 84.0], { flash: true }),
      // дорогая плитка 20×20 «на богатом» — до стыка со «стоит» (оно в хуке)
      item("IMG_1725", [94.7, 102.66], { flash: true }),
      // ВАЖНЫЙ раздел: тихие стены целиком (Роман: фраза очень важна)
      // «здесь у нас будут тихие стены, это очень крутая штука, которая
      // позволяет делать шумоподавление, в спальне будет очень тихо»
      item("IMG_1725", [172.5, 183.05], { flash: true }),
      // концовка — обещание показать фишку (вместо «доброго дня»)
      item("IMG_1725", [183.1, 186.4], { flash: true }),
    ],
  },
];

fs.writeFileSync(
  path.join("src", "reel10-plan.json"),
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
      `   [${(it.fromMs / 1000).toFixed(1)}–${(it.toMs / 1000).toFixed(1)}]` +
        (it.hookLook ? " HOOK" : "") +
        ` :: ${w.map((x) => x.text).join(" ")}`,
    );
  }
}
