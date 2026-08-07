// Автопубликация клипа в ВК-сообщество: загрузка видео (video.save + upload)
// + пост на стену от имени группы. Без кликов и кабинета.
// Usage: node scripts/vk-publish.mjs <файл.mp4> "Название" "Описание"
import fs from "fs";

const GROUP_ID = "240321169";
const userToken = process.env.VK_USER_TOKEN;   // личный токен (video.save)
const groupToken = process.env.VK_GROUP_TOKEN;  // токен сообщества (wall.post)
const V = "5.199";

const file = process.argv[2];
const name = process.argv[3] ?? "Рилс";
const description = process.argv[4] ?? "";

if (!userToken) { console.error("нет VK_USER_TOKEN"); process.exit(1); }
if (!file || !fs.existsSync(file)) { console.error("файл не найден:", file); process.exit(1); }

const api = async (method, params, token) => {
  const usp = new URLSearchParams({ ...params, access_token: token, v: V });
  const res = await fetch(`https://api.vk.com/method/${method}?${usp}`);
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.error_msg}`);
  return json.response;
};

// 1. video.save — получаем upload_url и id ролика
console.log("1/3 video.save…");
const saved = await api("video.save", {
  name,
  description,
  group_id: GROUP_ID,
  wallpost: "0",
  repeat: "0",
}, userToken);

// 2. заливаем сам файл на upload_url
console.log("2/3 загрузка файла…");
const form = new FormData();
form.append("video_file", new Blob([fs.readFileSync(file)], { type: "video/mp4" }), "video.mp4");
const upRes = await fetch(saved.upload_url, { method: "POST", body: form });
const upJson = await upRes.json();
if (upJson.error) throw new Error("upload: " + JSON.stringify(upJson));

const ownerId = saved.owner_id;         // -group_id
const videoId = saved.video_id ?? upJson.video_id;
const attach = `video${ownerId}_${videoId}`;
console.log("   загружено:", attach, `https://vk.com/${attach}`);

// 3. пост на стену сообщества со ссылкой на видео (от имени группы)
console.log("3/3 wall.post…");
const post = await api("wall.post", {
  owner_id: `-${GROUP_ID}`,
  from_group: "1",
  message: description,
  attachments: attach,
}, groupToken ?? userToken);

console.log("ГОТОВО ✓");
console.log("  видео:", `https://vk.com/${attach}`);
console.log("  пост:", `https://vk.com/wall-${GROUP_ID}_${post.post_id}`);
