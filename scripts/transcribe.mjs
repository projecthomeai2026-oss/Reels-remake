import path from "path";
import fs from "fs";
import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
  toCaptions,
} from "@remotion/install-whisper-cpp";

const to = path.join(process.cwd(), "whisper.cpp");

await installWhisperCpp({ to, version: "1.5.5" });
await downloadWhisperModel({ model: process.env.WHISPER_MODEL || "small", folder: to });

const clips = [
  "IMG_1404",
  "IMG_1406",
  "IMG_1407",
  "IMG_1409",
  "IMG_1411",
  "IMG_1412",
  "IMG_1415",
];

fs.mkdirSync("public/captions", { recursive: true });

for (const clip of clips) {
  console.log("Transcribing", clip);
  const whisperCppOutput = await transcribe({
    model: process.env.WHISPER_MODEL || "small",
    whisperPath: to,
    whisperCppVersion: "1.5.5",
    inputPath: path.join(process.cwd(), "audio", `${clip}.wav`),
    tokenLevelTimestamps: true,
    language: "ru",
  });

  const { captions } = toCaptions({ whisperCppOutput });
  fs.writeFileSync(
    path.join("public", "captions", "raw", `${clip}.json`),
    JSON.stringify(captions, null, 2),
  );
  console.log(
    clip,
    "->",
    captions.map((c) => c.text).join(" ").slice(0, 120),
  );
}
console.log("DONE");
