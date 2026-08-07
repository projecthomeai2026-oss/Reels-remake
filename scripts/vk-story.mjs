// Публикация истории (Story) в ВК-сообщество.
// Usage: node scripts/vk-story.mjs <файл.mp4>
import fs from "fs";

const GROUP_ID = "240321169";
const token = process.env.VK_USER_TOKEN;
const V = "5.199";
const file = process.argv[2];
if (!token || !file || !fs.existsSync(file)) { console.error("нет токена/файла"); process.exit(1); }

// 1. сервер загрузки истории
const srv = await (await fetch(`https://api.vk.com/method/stories.getVideoUploadServer?add_to_news=1&group_id=${GROUP_ID}&access_token=${token}&v=${V}`)).json();
if (srv.error) throw new Error("getVideoUploadServer: " + srv.error.error_msg);
const uploadUrl = srv.response.upload_url;
console.log("1/2 загрузка видео истории…");

// 2. заливаем видео
const form = new FormData();
form.append("video_file", new Blob([fs.readFileSync(file)], { type: "video/mp4" }), "story.mp4");
const up = await (await fetch(uploadUrl, { method: "POST", body: form })).json();
if (up.error) throw new Error("upload: " + JSON.stringify(up));

// история сохраняется автоматически после загрузки (add_to_news=1)
console.log("2/2 готово ✓ история опубликована в ВК-сообщество");
console.log("   ответ:", JSON.stringify(up).slice(0, 200));
