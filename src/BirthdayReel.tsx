import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadFont as loadPacifico } from "@remotion/google-fonts/Pacifico";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const { fontFamily: pacifico } = loadPacifico("normal", {
  subsets: ["cyrillic", "latin"],
});
const { fontFamily: montserrat } = loadMontserrat("normal", {
  weights: ["800"],
  subsets: ["cyrillic", "latin"],
});

export const BDAY_FPS = 30;

type Scene =
  | {
      type: "photo";
      src: string;
      durMs: number;
      kb: "in" | "out";
      panX?: number;
      polaroid?: boolean;
      rot?: number;
    }
  | { type: "video"; src: string; fromMs: number; toMs: number; volume?: number };

// Таймлайн ролика (≈39.5 c): без видео со взрослой девушкой у торта
const SCENES: Scene[] = [
  { type: "photo", src: "bday/p1533.jpg", durMs: 3200, kb: "in" }, // торт, под титул
  { type: "video", src: "clips/BD1516.mp4", fromMs: 1500, toMs: 7500 },
  { type: "photo", src: "bday/p1496.jpg", durMs: 2000, kb: "out", panX: -40, polaroid: true, rot: -3 },
  { type: "photo", src: "bday/p1507.jpg", durMs: 2000, kb: "in", panX: 40, polaroid: true, rot: 2.5 },
  { type: "photo", src: "bday/p1499.jpg", durMs: 2000, kb: "out", polaroid: true, rot: -2 },
  { type: "video", src: "clips/BD1535b.mp4", fromMs: 500, toMs: 6500 }, // папа с ножом
  { type: "photo", src: "bday/p1517.jpg", durMs: 2000, kb: "in", panX: -40, polaroid: true, rot: 3 },
  { type: "photo", src: "bday/p1523.jpg", durMs: 2000, kb: "out", panX: 40, polaroid: true, rot: -2.5 },
  { type: "photo", src: "bday/p1526.jpg", durMs: 2000, kb: "in", polaroid: true, rot: 2 },
  { type: "video", src: "clips/BD1535.mp4", fromMs: 13000, toMs: 17500 }, // режет торт
  { type: "photo", src: "bday/p1529.jpg", durMs: 2000, kb: "out", panX: -40, polaroid: true, rot: -3 },
  { type: "photo", src: "bday/p1504.jpg", durMs: 3400, kb: "out" }, // финал
];

const sceneDurMs = (s: Scene) =>
  s.type === "photo" ? s.durMs : s.toMs - s.fromMs;

const msToFrame = (ms: number) => Math.round((ms / 1000) * BDAY_FPS);

export const BDAY_DURATION = msToFrame(
  SCENES.reduce((a, s) => a + sceneDurMs(s), 0),
);

const CONFETTI_COLORS = ["#F8BBD0", "#F48FB1", "#FFD54F", "#AED581", "#FFF9C4", "#EF9A9A"];
const BALLOON_COLORS = ["#F48FB1", "#AED581", "#FFD54F", "#CE93D8", "#90CAF9"];

// Детерминированное конфетти
const Confetti: React.FC<{ count?: number; opacity?: number }> = ({
  count = 70,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const parts = [];
  for (let i = 0; i < count; i++) {
    const seed = i * 7919 + 13;
    const x0 = (seed * 31) % 1080;
    const speed = 5 + ((seed * 17) % 100) / 18;
    const phase = (seed * 53) % 2020;
    const size = 11 + ((seed * 11) % 14);
    const y = ((frame * speed + phase) % 2120) - 100;
    const x = x0 + Math.sin(frame / 14 + i * 1.7) * 46;
    const rot = (frame * (2 + (i % 5)) + seed) % 360;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const round = i % 3 === 0;
    parts.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: round ? size : size * 0.55,
          backgroundColor: color,
          borderRadius: round ? "50%" : 3,
          transform: `rotate(${rot}deg)`,
          opacity: 0.85,
        }}
      />,
    );
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>{parts}</AbsoluteFill>
  );
};

// Мерцающие блёстки
const Sparkles: React.FC<{ count?: number }> = ({ count = 26 }) => {
  const frame = useCurrentFrame();
  const parts = [];
  for (let i = 0; i < count; i++) {
    const seed = i * 4241 + 7;
    const x = (seed * 37) % 1040;
    const y = (seed * 71) % 1840;
    const size = 14 + ((seed * 13) % 18);
    const tw = (Math.sin(frame / 6 + i * 2.1) + 1) / 2;
    parts.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          opacity: 0.15 + tw * 0.75,
          transform: `scale(${0.6 + tw * 0.5}) rotate(${frame * 2 + seed}deg)`,
          color: i % 2 ? "#FFF59D" : "#FFFFFF",
          fontSize: size,
          lineHeight: 1,
          textShadow: "0 0 12px rgba(255,240,150,0.9)",
        }}
      >
        ✦
      </div>,
    );
  }
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{parts}</AbsoluteFill>;
};

// Воздушные шарики, поднимающиеся по бокам
const Balloons: React.FC<{ count?: number }> = ({ count = 8 }) => {
  const frame = useCurrentFrame();
  const parts = [];
  for (let i = 0; i < count; i++) {
    const seed = i * 6007 + 29;
    const side = i % 2 === 0 ? (seed % 260) : 820 + (seed % 260);
    const speed = 6 + (seed % 5);
    const y = 2100 - ((frame * speed + (seed % 900)) % 2500);
    const x = side + Math.sin(frame / 18 + i * 2.3) * 34;
    const color = BALLOON_COLORS[i % BALLOON_COLORS.length];
    const w = 110 + (seed % 40);
    parts.push(
      <div key={i} style={{ position: "absolute", left: x, top: y, opacity: 0.9 }}>
        <div
          style={{
            width: w,
            height: w * 1.2,
            borderRadius: "50% 50% 50% 50% / 46% 46% 54% 54%",
            background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.75), ${color} 55%)`,
            boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
          }}
        />
        <div
          style={{
            width: 2.5,
            height: 130,
            backgroundColor: "rgba(255,255,255,0.75)",
            margin: "0 auto",
            transform: `rotate(${Math.sin(frame / 15 + i) * 7}deg)`,
            transformOrigin: "top center",
          }}
        />
      </div>,
    );
  }
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{parts}</AbsoluteFill>;
};

// Сердечки на финал
const Hearts: React.FC<{ count?: number }> = ({ count = 16 }) => {
  const frame = useCurrentFrame();
  const parts = [];
  for (let i = 0; i < count; i++) {
    const seed = i * 3571 + 11;
    const x0 = (seed * 41) % 1020;
    const speed = 7 + (seed % 6);
    const y = 2050 - ((frame * speed + (seed % 700)) % 2400);
    const x = x0 + Math.sin(frame / 12 + i * 1.9) * 42;
    const size = 34 + (seed % 30);
    parts.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: y,
          fontSize: size,
          opacity: 0.85,
          transform: `rotate(${Math.sin(frame / 10 + i) * 16}deg)`,
        }}
      >
        {i % 3 === 0 ? "💖" : i % 3 === 1 ? "❤️" : "💛"}
      </div>,
    );
  }
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{parts}</AbsoluteFill>;
};

const KenBurnsImg: React.FC<{
  src: string;
  durFrames: number;
  kb: "in" | "out";
  panX?: number;
}> = ({ src, durFrames, kb, panX = 0 }) => {
  const frame = useCurrentFrame();
  const t = Math.min(1, frame / Math.max(1, durFrames));
  const scale = kb === "in" ? 1.06 + t * 0.12 : 1.2 - t * 0.12;
  const tx = panX * (t - 0.5);
  return (
    <Img
      src={staticFile(src)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: `scale(${scale}) translateX(${tx}px)`,
        filter: "saturate(1.12) brightness(1.03)",
      }}
    />
  );
};

// Фото в полароид-рамке на размытом фоне, влетает с пружиной
const PolaroidPhoto: React.FC<{
  src: string;
  durFrames: number;
  kb: "in" | "out";
  panX?: number;
  rot?: number;
}> = ({ src, durFrames, kb, panX, rot = 0 }) => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [0, 11], [0.6, 1], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.65, 0.64, 1),
  });
  const rotNow = rot * interpolate(frame, [0, 11], [2.2, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#1a0f14" }}>
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(26px) brightness(0.72) saturate(1.1)",
          transform: "scale(1.15)",
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 860,
            height: 1300,
            backgroundColor: "#FFFFFF",
            padding: "26px 26px 92px 26px",
            borderRadius: 10,
            boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
            transform: `scale(${pop}) rotate(${rotNow}deg)`,
            overflow: "hidden",
          }}
        >
          <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 4 }}>
            <KenBurnsImg src={src} durFrames={durFrames} kb={kb} panX={panX} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Видео с панч-зумом, дрейфом и «дыханием» кадра
const VideoScene: React.FC<{ src: string; fromMs: number; volume: number }> = ({
  src,
  fromMs,
  volume,
}) => {
  const frame = useCurrentFrame();
  const punch = interpolate(frame, [0, 10], [1.14, 1.04], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const breathe = 1 + Math.sin(frame / 22) * 0.012;
  const drift = interpolate(frame, [10, 200], [1, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={msToFrame(fromMs)}
        volume={volume}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "saturate(1.15) contrast(1.05) brightness(1.03)",
          transform: `scale(${punch * breathe * drift}) translate(${Math.sin(frame / 30) * 8}px, ${Math.cos(frame / 26) * 6}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

// Тёплый световой блик, плывущий по кадру
const LightLeak: React.FC = () => {
  const frame = useCurrentFrame();
  const x = 20 + Math.sin(frame / 40) * 55;
  const y = 25 + Math.cos(frame / 34) * 30;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `radial-gradient(circle 640px at ${x}% ${y}%, rgba(255,190,120,0.28), transparent 70%)`,
        mixBlendMode: "screen",
      }}
    />
  );
};

const WhiteFlash: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        opacity: interpolate(frame, [0, 8], [0.85, 0], { extrapolateRight: "clamp" }),
        pointerEvents: "none",
      }}
    />
  );
};

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = (from: number) =>
    interpolate(frame, [from, from + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.34, 1.6, 0.64, 1),
    });
  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
    >
      <div
        style={{
          textAlign: "center",
          transform: `scale(${pop(4)}) rotate(${Math.sin(frame / 22) * 1.5}deg)`,
          textShadow: "0 6px 30px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ fontFamily: pacifico, fontSize: 92, color: "#FFFFFF", lineHeight: 1.25 }}>
          День рождения
        </div>
        <div style={{ fontFamily: pacifico, fontSize: 148, color: "#F8BBD0", lineHeight: 1.2 }}>
          Нины
        </div>
      </div>
      <div
        style={{
          marginTop: 40,
          transform: `scale(${pop(16)}) rotate(-2deg) translateY(${Math.sin(frame / 8) * 6}px)`,
          fontFamily: montserrat,
          fontWeight: 800,
          fontSize: 64,
          color: "#5D4037",
          backgroundColor: "#FFD54F",
          padding: "16px 44px",
          borderRadius: 60,
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        🎂 1 годик
      </div>
    </AbsoluteFill>
  );
};

const FinalCard: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 300, pointerEvents: "none" }}
    >
      <div
        style={{
          textAlign: "center",
          transform: `scale(${interpolate(frame, [0, 14], [0, 1], {
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.34, 1.6, 0.64, 1),
          })}) rotate(${Math.sin(frame / 18) * 1.8}deg)`,
          fontFamily: pacifico,
          fontSize: 88,
          color: "#FFFFFF",
          textShadow: "0 6px 30px rgba(0,0,0,0.6)",
          lineHeight: 1.3,
        }}
      >
        С днём рождения,
        <br />
        Нина! ❤️
      </div>
    </AbsoluteFill>
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 92% 78% at 50% 45%, transparent 60%, rgba(40,10,25,0.35) 100%)",
      pointerEvents: "none",
    }}
  />
);

export const BirthdayReel: React.FC = () => {
  let cursor = 0;
  const seqs = SCENES.map((s, i) => {
    const from = msToFrame(cursor);
    const dur = msToFrame(sceneDurMs(s));
    cursor += sceneDurMs(s);
    return { s, from, dur, i };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a0f14" }}>
      {seqs.map(({ s, from, dur, i }) => (
        <Sequence key={i} from={from} durationInFrames={dur} name={`${i} ${s.type}`}>
          {s.type === "photo" ? (
            s.polaroid ? (
              <PolaroidPhoto src={s.src} durFrames={dur} kb={s.kb} panX={s.panX} rot={s.rot} />
            ) : (
              <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#1a0f14" }}>
                <KenBurnsImg src={s.src} durFrames={dur} kb={s.kb} panX={s.panX} />
              </AbsoluteFill>
            )
          ) : (
            <>
              <VideoScene src={s.src} fromMs={s.fromMs} volume={s.volume ?? 0.7} />
              <LightLeak />
            </>
          )}
          {i > 0 ? <WhiteFlash /> : null}
        </Sequence>
      ))}

      {/* блёстки — всегда */}
      <Sparkles count={26} />

      {/* конфетти: густое на интро и финале, лёгкое в середине */}
      <Sequence durationInFrames={msToFrame(3200)} name="Confetti intro">
        <Confetti count={90} />
      </Sequence>
      <Sequence from={msToFrame(3200)} durationInFrames={BDAY_DURATION - msToFrame(6600)} name="Confetti light">
        <Confetti count={26} opacity={0.7} />
      </Sequence>
      <Sequence from={BDAY_DURATION - msToFrame(3400)} name="Confetti finale">
        <Confetti count={110} />
      </Sequence>

      {/* шарики на интро и финале */}
      <Sequence durationInFrames={msToFrame(3200)} name="Balloons intro">
        <Balloons count={7} />
      </Sequence>
      <Sequence from={BDAY_DURATION - msToFrame(3400)} name="Balloons finale">
        <Balloons count={9} />
      </Sequence>

      {/* сердечки на финале */}
      <Sequence from={BDAY_DURATION - msToFrame(3400)} name="Hearts finale">
        <Hearts count={16} />
      </Sequence>

      <Sequence durationInFrames={msToFrame(3200)} name="Title">
        <Title />
      </Sequence>

      <Sequence from={BDAY_DURATION - msToFrame(3400)} name="Final card">
        <FinalCard />
      </Sequence>

      <Vignette />

      <Audio
        src={staticFile("bday-music2.mp3")}
        volume={(f) =>
          interpolate(
            f,
            [0, 15, BDAY_DURATION - 60, BDAY_DURATION],
            [0, 0.55, 0.55, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
    </AbsoluteFill>
  );
};
