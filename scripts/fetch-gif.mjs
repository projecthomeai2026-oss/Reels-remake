// Поиск и загрузка гифки/стикера с Giphy как mp4 (для вставки в рилс).
// Usage: node scripts/fetch-gif.mjs "<запрос>" <имя-выхода> [индекс] [sticker]
//   4-й аргумент "s" или "sticker" → искать среди прозрачных стикеров (чище иконки)
import fs from "fs";
const key = process.env.GIPHY_KEY;
const q = process.argv[2];
const name = process.argv[3] ?? q.replace(/\s+/g, "-");
const idx = parseInt(process.argv[4] ?? "0", 10);
const sticker = /^(s|sticker)$/i.test(process.argv[5] ?? "");
if (!key || !q) { console.error("нужен GIPHY_KEY и запрос"); process.exit(1); }

const kind = sticker ? "stickers" : "gifs";
const r = await (await fetch(`https://api.giphy.com/v1/${kind}/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=12&rating=pg`)).json();
const g = r.data?.[idx];
if (!g) { console.error("ничего не найдено:", q); process.exit(1); }
console.log("найдено:", g.title.slice(0, 50), "|", g.images.original.width + "x" + g.images.original.height, sticker ? "[стикер]" : "");
fs.mkdirSync("public/inserts", { recursive: true });
// стикеры: берём .gif (с прозрачностью) — вставка через @remotion/gif; гифки: .mp4
const isGif = sticker;
const url = isGif ? g.images.original.url : (g.images.original.mp4 || g.images.original_mp4?.mp4);
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
const out = `public/inserts/${name}.${isGif ? "gif" : "mp4"}`;
fs.writeFileSync(out, buf);
console.log("сохранено:", out, "|", (buf.length / 1024).toFixed(0) + "КБ");
