import {
  AbsoluteFill, OffthreadVideo, Audio, Sequence, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, spring, Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";

const { fontFamily } = loadFont("normal", { weights: ["800", "900"], subsets: ["cyrillic", "latin"] });

export const WAKE_FPS = 30;
const NICK = "@romejo__";

// тайминги (мс реального клипа wake.mp4, 7.32с)
const RIDE_END = 5500;    // до этого — реальное время
const CLIP_END = 7300;
const SLOW = 0.45;        // скорость слоу-мо на падении
const SPLASH_MS = 6300;   // момент входа в воду (реальное время клипа)

const ms = (m: number) => Math.round((m / 1000) * WAKE_FPS);
const rideF = ms(RIDE_END);
const slowF = Math.round(((CLIP_END - RIDE_END) / SLOW / 1000) * WAKE_FPS);
export const WAKE_DURATION = rideF + slowF;
// глобальный кадр всплеска: в слоу-сегменте
const splashF = rideF + Math.round(((SPLASH_MS - RIDE_END) / SLOW / 1000) * WAKE_FPS);

const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 100% 90% at 50% 45%, transparent 72%, rgba(0,0,0,0.18) 100%)" }} />
);

// Ник огромными буквами по вертикали сбоку — проявляется по одной букве через весь ролик,
// последняя буква ложится в момент входа в воду (как «SLOVAKIA» в референсе)
const NickReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const letters = NICK.toUpperCase().split("");
  const startF = ms(900);       // старт проявления
  const endF = splashF;          // последняя буква — на всплеске
  const per = (endF - startF) / letters.length;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", alignItems: "flex-end", justifyContent: "center", paddingRight: "3%" }}>
      <div style={{
        writingMode: "vertical-rl", textOrientation: "sideways",
        fontFamily, fontSize: 250, fontWeight: 900, fontStyle: "italic",
        letterSpacing: "-0.05em", lineHeight: 0.86,
      }}>
        {letters.map((ch, i) => {
          const lf = startF + i * per;
          const op = interpolate(frame, [lf, lf + 6], [0, 0.92], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const dy = interpolate(frame, [lf, lf + 8], [26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <span key={i} style={{
              color: "#fff", opacity: op, transform: `translateY(${dy}px)`,
              textShadow: "0 0 3px rgba(0,0,0,0.5), 0 4px 22px rgba(0,0,0,0.55)",
              WebkitTextStroke: "1.5px rgba(0,0,0,0.28)",
            }}>{ch === " " ? " " : ch}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const WakeReel: React.FC = () => {
  const duration = WAKE_DURATION;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence from={0} durationInFrames={rideF} name="ride">
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <OffthreadVideo src={staticFile("clips/wake.mp4")} startFrom={0} playbackRate={1} muted
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.06) saturate(1.1) brightness(1.03)" }} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={rideF} name="fall-slow">
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <OffthreadVideo src={staticFile("clips/wake.mp4")} startFrom={ms(RIDE_END)} playbackRate={SLOW} muted
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.08) saturate(1.12) brightness(1.03)" }} />
        </AbsoluteFill>
      </Sequence>

      <Sequence name="grade"><Grade /></Sequence>
      <Sequence name="nick"><NickReveal /></Sequence>

      <Sequence name="music">
        <Audio src={staticFile("music5.mp3")} loop volume={(f) => interpolate(f, [0, 20, duration - 30, duration], [0, 0.85, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      </Sequence>
    </AbsoluteFill>
  );
};
