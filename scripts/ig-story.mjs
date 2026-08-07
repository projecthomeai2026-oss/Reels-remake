// Публикация видео как Instagram Story (24ч) через Graph API.
// Usage: node scripts/ig-story.mjs <файл.mp4>
import fs from "fs";
import os from "os";
import path from "path";

let token = process.env.IG_ACCESS_TOKEN;
const igUser = process.env.IG_USER_ID;
const appId = process.env.IG_APP_ID;
const appSecret = process.env.IG_APP_SECRET;
const V = "v25.0";
const file = process.argv[2];
if (!token || !igUser || !file || !fs.existsSync(file)) { console.error("нет токена/файла"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// авто-продление токена (как в ig-publish)
if (appId && appSecret) {
  try {
    const dbg = await (await fetch(`https://graph.facebook.com/${V}/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`)).json();
    const exp = dbg.data?.expires_at ?? 0;
    if (exp && (exp * 1000 - Date.now()) / 86400000 < 10) {
      const r = await (await fetch(`https://graph.facebook.com/${V}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${token}`)).json();
      if (r.access_token) {
        token = r.access_token;
        const cfg = path.join(os.homedir(), ".config/social-tokens/instagram.env");
        const lines = fs.readFileSync(cfg, "utf8").split("\n").filter((l) => !l.startsWith("IG_ACCESS_TOKEN="));
        lines.push(`IG_ACCESS_TOKEN=${token}`);
        fs.writeFileSync(cfg, lines.filter(Boolean).join("\n") + "\n");
      }
    }
  } catch {}
}

// 1. хостинг видео (uguu — прямые mp4)
console.log("1/4 загрузка видео на хостинг…");
const upForm = new FormData();
upForm.append("files[]", new Blob([fs.readFileSync(file)], { type: "video/mp4" }), "story.mp4");
const upJson = await (await fetch("https://uguu.se/upload.php", { method: "POST", body: upForm })).json();
if (!upJson.success || !upJson.files?.[0]?.url) throw new Error("хостинг: " + JSON.stringify(upJson));
const videoUrl = upJson.files[0].url;
console.log("   видео:", videoUrl);

// 2. media-контейнер STORIES
console.log("2/4 создание story-контейнера…");
const createJson = await (await fetch(`https://graph.facebook.com/${V}/${igUser}/media`, {
  method: "POST",
  body: new URLSearchParams({ media_type: "STORIES", video_url: videoUrl, access_token: token }),
})).json();
if (createJson.error) throw new Error("media: " + JSON.stringify(createJson.error));
const creationId = createJson.id;

// 3. ждём обработки
console.log("3/4 обработка видео Instagram…");
let status = "IN_PROGRESS";
for (let i = 0; i < 80 && status === "IN_PROGRESS"; i++) {
  await sleep(5000);
  let st;
  try {
    const body = await (await fetch(`https://graph.facebook.com/${V}/${creationId}?fields=status_code&access_token=${token}`)).text();
    st = JSON.parse(body); // HTML-страница ошибки → не падаем, ждём дальше
  } catch (e) { continue; }
  status = st.status_code || "IN_PROGRESS";
  if (status === "ERROR") throw new Error("обработка не удалась: " + JSON.stringify(st));
}
if (status !== "FINISHED") throw new Error("не обработалось (status=" + status + ")");

// 4. публикуем
console.log("4/4 публикация истории…");
const pubJson = await (await fetch(`https://graph.facebook.com/${V}/${igUser}/media_publish`, {
  method: "POST",
  body: new URLSearchParams({ creation_id: creationId, access_token: token }),
})).json();
if (pubJson.error) throw new Error("publish: " + JSON.stringify(pubJson.error));
console.log("IG story OK ✓ media id:", pubJson.id);
