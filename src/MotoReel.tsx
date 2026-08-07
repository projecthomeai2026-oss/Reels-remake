import {
  AbsoluteFill,
  Audio,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";

const { fontFamily } = loadFont("normal", {
  weights: ["800", "900"],
  subsets: ["cyrillic", "latin"],
});

export const MOTO_FPS = 30;

type Seg = {
  clip: string;
  fromMs: number;
  toMs: number;
  rate?: number;
  text?: string;
  textStyle?: "glitch" | "hero" | "brand";
  slow?: boolean; // слоу-мо герой-кадр
};

const S = (ms: number) => Math.round((ms / 1000) * MOTO_FPS);

// v2: рваное драйв-интро → слоу-мо герой → нарастание → эпик-финал
const SEGMENTS: Seg[] = [
  // BLITZ: быстрые рубленые POV-куски, текст-глитч влетает
  { clip: "moto1", fromMs: 9000, toMs: 9750, rate: 1.3, text: "ГОНЮ", textStyle: "glitch" },
  { clip: "moto1", fromMs: 14000, toMs: 14650, rate: 1.3 },
  { clip: "moto1", fromMs: 17400, toMs: 18200, rate: 1.3, text: "ПО ГОРОДУ", textStyle: "glitch" },
  // СЛОУ герой: высотки, замедление
  { clip: "moto2", fromMs: 11700, toMs: 14700, rate: 0.7, text: "ЭТО МОЙ\nРИТМ", textStyle: "hero", slow: true },
  // нарастание драйва
  { clip: "moto1", fromMs: 20000, toMs: 20800, rate: 1.4 },
  { clip: "moto1", fromMs: 23400, toMs: 24200, rate: 1.4, text: "БЕЗ ТОРМОЗОВ", textStyle: "glitch" },
  { clip: "moto1", fromMs: 24800, toMs: 25850, rate: 1.35 },
  // герой контровый свет (слоу)
  { clip: "moto2", fromMs: 2000, toMs: 5200, rate: 0.75, slow: true },
  { clip: "moto2", fromMs: 6400, toMs: 8800, rate: 0.85 },
  // ЭПИК-финал: высотки, бренд
  { clip: "moto2", fromMs: 11400, toMs: 14750, rate: 0.7, text: "@romejo__", textStyle: "brand", slow: true },
];

// Глубокий кино-грейд: холодные тени + контраст, слоу-кадры темнее и синее
const graded = (frame: number, dur: number, slow?: boolean): React.CSSProperties => ({
  filter: slow
    ? "contrast(1.34) saturate(0.92) brightness(0.82) hue-rotate(-8deg) sepia(0.12)"
    : "contrast(1.3) saturate(1.12) brightness(0.9) hue-rotate(-4deg)",
  transform: `scale(${interpolate(frame, [0, dur], [slow ? 1.04 : 1.1, slow ? 1.16 : 1.02], {
    extrapolateRight: "clamp",
    easing: slow ? Easing.linear : Easing.out(Easing.quad),
  })})`,
});

const SegmentVideo: React.FC<{ seg: Seg }> = ({ seg }) => {
  const frame = useCurrentFrame();
  const dur = S((seg.toMs - seg.fromMs) / (seg.rate ?? 1));
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <OffthreadVideo
        src={staticFile(`clips/${seg.clip}.mp4`)}
        startFrom={S(seg.fromMs)}
        playbackRate={seg.rate ?? 1}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          ...graded(frame, dur, seg.slow),
        }}
      />
    </AbsoluteFill>
  );
};

// Тёмная кино-рамка + холодный вельвет + зерно + сканлайн
const CineOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.07 }}>
        <filter id="mgrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#mgrain)" />
      </svg>
      {/* холодный тон в тенях */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,20,40,0.14)", mixBlendMode: "multiply" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 130, background: "linear-gradient(#000,transparent)" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 240, background: "linear-gradient(transparent,#000)" }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 78% 68% at 50% 44%, transparent 48%, rgba(0,0,0,0.66) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// Текст с RGB-глитчем (характерно для стиля)
const GlitchText: React.FC<{ text: string; kind: "glitch" | "hero" | "brand" }> = ({ text, kind }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 11, stiffness: 200, mass: 0.5 } });
  // дрожание RGB-сдвига затухает
  const g = (1 - enter) * 10 + Math.sin(frame * 2.1) * (1 - enter) * 6;

  if (kind === "glitch") {
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 360, pointerEvents: "none" }}>
        <div
          style={{
            position: "relative",
            fontFamily,
            fontSize: 92,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            color: "#fff",
            opacity: enter,
            transform: `translateX(${interpolate(enter, [0, 1], [-90, 0])}px)`,
            textShadow: `${g}px 0 rgba(255,20,50,0.9), ${-g}px 0 rgba(0,200,255,0.85), 0 6px 22px rgba(0,0,0,0.7)`,
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    );
  }

  if (kind === "brand") {
    return (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
        <div
          style={{
            fontFamily,
            fontSize: 100,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            color: "#fff",
            opacity: enter,
            transform: `scale(${interpolate(enter, [0, 1], [1.3, 1])})`,
            textShadow: `${g}px 0 rgba(255,20,50,0.9), ${-g}px 0 rgba(0,200,255,0.8), 0 8px 30px rgba(0,0,0,0.8)`,
          }}
        >
          {text}
        </div>
        <div
          style={{
            fontFamily,
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: "#ff1f3d",
            marginTop: 20,
            opacity: interpolate(frame, [12, 28], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Новосибирск
        </div>
      </AbsoluteFill>
    );
  }

  // hero — крупно по центру, красный
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
      <div
        style={{
          fontFamily,
          fontSize: 116,
          fontWeight: 900,
          fontStyle: "italic",
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 0.92,
          color: "#ff1f3d",
          WebkitTextStroke: "3px rgba(0,0,0,0.8)",
          whiteSpace: "pre-line",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 60}px) scale(${interpolate(enter, [0, 1], [1.2, 1])})`,
          textShadow: "0 10px 34px rgba(0,0,0,0.75), 5px 5px 0 rgba(0,0,0,0.5)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// Резкая вспышка + хроматический удар на склейке
const CutHit: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: "#fff",
          opacity: interpolate(frame, [0, 3], [0.42, 0], { extrapolateRight: "clamp" }),
          mixBlendMode: "overlay",
        }}
      />
      <AbsoluteFill
        style={{
          background: "linear-gradient(90deg, rgba(255,20,50,0.4), transparent 40%, transparent 60%, rgba(0,200,255,0.4))",
          opacity: interpolate(frame, [0, 5], [0.5, 0], { extrapolateRight: "clamp" }),
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};

let cursor = 0;
const TIMED = SEGMENTS.map((seg) => {
  const from = cursor;
  const dur = S((seg.toMs - seg.fromMs) / (seg.rate ?? 1));
  cursor += dur;
  return { seg, from, dur };
});
export const MOTO_DURATION = cursor;

export const MotoReel: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {TIMED.map(({ seg, from, dur }, i) => (
        <Sequence key={i} from={from} durationInFrames={dur} name={`${seg.clip} ${i}`}>
          <SegmentVideo seg={seg} />
          <CineOverlay />
          {i > 0 ? <CutHit /> : null}
          {seg.text ? <GlitchText text={seg.text} kind={seg.textStyle ?? "glitch"} /> : null}
        </Sequence>
      ))}

      <Sequence name="music">
        <Audio
          src={staticFile("music7.mp3")}
          startFrom={S(3000)}
          volume={(f) =>
            interpolate(f, [0, 16, MOTO_DURATION - 40, MOTO_DURATION], [0, 0.9, 0.9, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      </Sequence>
    </AbsoluteFill>
  );
};
