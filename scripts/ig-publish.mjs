// Автопубликация Reels в Instagram через Graph API.
// Заливает видео на временный хостинг (tmpfiles) → создаёт media-контейнер →
// ждёт обработки → публикует. Коллабов API не умеет — добавлять вручную после.
// Usage: node scripts/ig-publish.mjs <файл.mp4> "Описание с хэштегами" [thumbOffsetMs]
import fs from "fs";

import os from "os";
import path from "path";

let token = process.env.IG_ACCESS_TOKEN;
const igUser = process.env.IG_USER_ID;
const appId = process.env.IG_APP_ID;
const appSecret = process.env.IG_APP_SECRET;
const V = "v25.0";

// Авто-продление long-lived токена: если до истечения < 10 дней — обновляем
// (пока публикуешь хотя бы раз в ~2 мес, токен живёт вечно)
async function refreshTokenIfNeeded() {
  if (!appId || !appSecret || !token) return;
  try {
    const dbg = await (await fetch(`https://graph.facebook.com/${V}/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`)).json();
    const exp = dbg.data?.expires_at ?? 0;
    const daysLeft = exp ? (exp * 1000 - Date.now()) / 86400000 : Infinity;
    if (daysLeft < 10) {
      const r = await (await fetch(`https://graph.facebook.com/${V}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${token}`)).json();
      if (r.access_token) {
        token = r.access_token;
        const cfg = path.join(os.homedir(), ".config/social-tokens/instagram.env");
        const lines = fs.readFileSync(cfg, "utf8").split("\n").filter((l) => !l.startsWith("IG_ACCESS_TOKEN="));
        lines.push(`IG_ACCESS_TOKEN=${token}`);
        fs.writeFileSync(cfg, lines.filter(Boolean).join("\n") + "\n");
        console.log(`   ↻ токен продлён ещё на 60 дней`);
      }
    }
  } catch { /* не критично — публикуем текущим */ }
}
await refreshTokenIfNeeded();

const file = process.argv[2];
const caption = process.argv[3] ?? "";
const thumbOffset = process.argv[4] ?? "4000";

if (!token || !igUser) { console.error("нет IG_ACCESS_TOKEN / IG_USER_ID (source instagram.env)"); process.exit(1); }
if (!file || !fs.existsSync(file)) { console.error("файл не найден:", file); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. заливаем видео на публичный хостинг (uguu.se — прямые mp4-ссылки, файлы живут ~3ч)
console.log("1/4 загрузка видео на хостинг…");
const upForm = new FormData();
upForm.append("files[]", new Blob([fs.readFileSync(file)], { type: "video/mp4" }), "reel.mp4");
const upRes = await fetch("https://uguu.se/upload.php", { method: "POST", body: upForm });
const upJson = await upRes.json();
if (!upJson.success || !upJson.files?.[0]?.url) throw new Error("хостинг: " + JSON.stringify(upJson));
const videoUrl = upJson.files[0].url;
console.log("   видео:", videoUrl);

// 2. создаём media-контейнер (Reels)
console.log("2/4 создание media-контейнера…");
const createParams = new URLSearchParams({
  media_type: "REELS",
  video_url: videoUrl,
  caption,
  thumb_offset: thumbOffset,
  access_token: token,
});
const createRes = await fetch(`https://graph.facebook.com/${V}/${igUser}/media`, { method: "POST", body: createParams });
const createJson = await createRes.json();
if (createJson.error) throw new Error("media: " + JSON.stringify(createJson.error));
const creationId = createJson.id;
console.log("   creation_id:", creationId);

// 3. ждём, пока Instagram скачает и обработает видео
console.log("3/4 обработка видео Instagram…");
let status = "IN_PROGRESS";
for (let i = 0; i < 80 && status === "IN_PROGRESS"; i++) {
  await sleep(5000);
  let stJson;
  try {
    const st = await fetch(`https://graph.facebook.com/${V}/${creationId}?fields=status_code,status&access_token=${token}`);
    const body = await st.text();
    stJson = JSON.parse(body); // иногда прилетает HTML-страница ошибки — не падаем, просто ждём дальше
  } catch (e) {
    process.stdout.write(`   [${i}] опрос дал не-JSON, повтор…\n`);
    continue;
  }
  status = stJson.status_code || "IN_PROGRESS";
  process.stdout.write(`   [${i}] ${status}${stJson.status ? " — " + stJson.status : ""}\n`);
  if (status === "ERROR") throw new Error("обработка не удалась: " + JSON.stringify(stJson));
  if (status === "FINISHED") break;
}
if (status !== "FINISHED") throw new Error("видео не обработалось вовремя (status=" + status + ")");

// 4. публикуем
console.log("4/4 публикация…");
const pubParams = new URLSearchParams({ creation_id: creationId, access_token: token });
const pubRes = await fetch(`https://graph.facebook.com/${V}/${igUser}/media_publish`, { method: "POST", body: pubParams });
const pubJson = await pubRes.json();
if (pubJson.error) throw new Error("publish: " + JSON.stringify(pubJson.error));

console.log("ГОТОВО ✓ опубликовано в Instagram, media id:", pubJson.id);
console.log("  ⚠ коллабов через API нет — добавь вручную: Изменить рилс → Пригласить соавтора");
