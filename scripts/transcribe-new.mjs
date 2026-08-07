import path from "path";
import fs from "fs";
import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
  toCaptions,
} from "@remotion/install-whisper-cpp";

const to = path.join(process.cwd(), "whisper.cpp");
const model = process.env.WHISPER_MODEL || "medium";

await installWhisperCpp({ to, version: "1.5.5" });
await downloadWhisperModel({ model, folder: to });

const clips = process.argv.slice(2);
if (clips.length === 0) {
  console.error("Usage: node scripts/transcribe-new.mjs IMG_XXXX ...");
  process.exit(1);
}

fs.mkdirSync("public/captions/raw", { recursive: true });

for (const clip of clips) {
  console.log("Transcribing", clip);
  const whisperCppOutput = await transcribe({
    model,
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
    captions.map((c) => c.text).join(" ").slice(0, 200),
  );
}
console.log("DONE");
