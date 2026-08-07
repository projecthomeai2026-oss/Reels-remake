import {
  AbsoluteFill,
  Audio,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadFont as loadPacifico } from "@remotion/google-fonts/Pacifico";

const { fontFamily: pacifico } = loadPacifico("normal", {
  subsets: ["cyrillic", "latin"],
});

export const WISH_FPS = 30;

// Сцены: обычный клип BD1532 + слоу-мо BD1532slow (0.5x из 60fps)
type Scene = {
  src: string;
  fromMs: number;
  toMs: number;
  volume?: number;
  zoom?: "slow" | "punch";
  dark?: number; // затемнение для титула
};

const SCENES: Scene[] = [
  { src: "clips/BD1532.mp4", fromMs: 1000, toMs: 3800, dark: 0.42, zoom: "slow" },
  { src: "clips/BD1532.mp4", fromMs: 3800, toMs: 12000, zoom: "slow" },
  { src: "clips/BD1532.mp4", fromMs: 16500, toMs: 19000, zoom: "punch" },
  { src: "clips/BD1532slow.mp4", fromMs: 500, toMs: 7000, volume: 0.9, zoom: "slow" },
  { src: "clips/BD1532.mp4", fromMs: 21200, toMs: 22900, zoom: "punch" },
];

const FINAL_MS = 3000;
const msToFrame = (ms: number) => Math.round((ms / 1000) * WISH_FPS);

const sceneStarts: number[] = [];
{
  let cur = 0;
  for (const s of SCENES) {
    sceneStarts.push(cur);
    cur += s.toMs - s.fromMs;
  }
  sceneStarts.push(cur); // старт финала
}
export const WISH_DURATION = msToFrame(
  SCENES.reduce((a, s) => a + (s.toMs - s.fromMs), 0) + FINAL_MS,
);

// Момент погасания свечи внутри слоу-сцены (кадры от её начала)
const SLOW_SCENE_INDEX = 3;
const BLOW_FRAME_IN_SCENE = 105;
const blowGlobalFrame =
  msToFrame(sceneStarts[SLOW_SCENE_INDEX]) + BLOW_FRAME_IN_SCENE;

// Тёплые плавающие боке-круги
const Bokeh: React.FC<{ count?: number }> = ({ count = 12 }) => {
  const frame = useCurrentFrame();
  const parts = [];
  for (let i = 0; i < count; i++) {
    const seed = i * 5407 + 19;
    const x0 = (seed * 47) % 1080;
    const y0 = (seed * 83) % 1920;
    const r = 60 + (seed % 130);
    const x = x0 + Math.sin(frame / 46 + i * 1.9) * 60;
    const y = y0 + Math.cos(frame / 52 + i * 1.3) * 44;
    const o = 0.05 + ((Math.sin(frame / 30 + i * 2.2) + 1) / 2) * 0.1;
    parts.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x - r,
          top: y - r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(255,210,140,${o}) 0%, transparent 70%)`,
        }}
      />,
    );
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      {parts}
    </AbsoluteFill>
  );
};

// Восходящие золотые искры
const GoldSparks: React.FC<{ count?: number }> = ({ count = 40 }) => {
  const frame = useCurrentFrame();
  const parts = [];
  for (let i = 0; i < count; i++) {
    const seed = i * 6841 + 31;
    const x0 = (seed * 37) % 1080;
    const speed = 2.2 + (seed % 40) / 11;
    const y = 2000 - ((frame * speed + (seed % 1900)) % 2100);
    const x = x0 + Math.sin(frame / 17 + i * 2.4) * 26;
    const size = 4 + (seed % 6);
    const tw = (Math.sin(frame / 5 + i * 1.4) + 1) / 2;
    parts.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: "#FFE9A8",
          opacity: 0.25 + tw * 0.65,
          boxShadow: `0 0 ${8 + tw * 10}px rgba(255,215,130,0.9)`,
        }}
      />,
    );
  }
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{parts}</AbsoluteFill>;
};

// Радиальный взрыв конфетти в момент погасания свечи
const BURST_COLORS = ["#FFD54F", "#F8BBD0", "#FFF9C4", "#F48FB1", "#FFE082", "#FFFFFF"];
const ConfettiBurst: React.FC = () => {
  const frame = useCurrentFrame(); // 0 = момент взрыва
  const parts = [];
  const cx = 560;
  const cy = 1080;
  for (let i = 0; i < 70; i++) {
    const seed = i * 7127 + 41;
    const angle = ((seed % 360) * Math.PI) / 180;
    const speed = 9 + (seed % 100) / 7;
    const dist = speed * frame * (1 - Math.min(0.6, frame / 90));
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist * 0.85 + frame * frame * 0.09;
    const size = 10 + (seed % 12);
    const o = interpolate(frame, [0, 8, 55, 75], [0, 1, 0.9, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    parts.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: i % 3 === 0 ? size : size * 0.5,
          backgroundColor: BURST_COLORS[i % BURST_COLORS.length],
          borderRadius: i % 3 === 0 ? "50%" : 3,
          transform: `rotate(${frame * (4 + (i % 7)) + seed}deg)`,
          opacity: o,
        }}
      />,
    );
  }
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{parts}</AbsoluteFill>;
};

const WhiteFlash: React.FC<{ peak?: number }> = ({ peak = 0.85 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFF8E7",
        opacity: interpolate(frame, [0, 2, 9], [0, peak, 0], {
          extrapolateRight: "clamp",
        }),
        pointerEvents: "none",
      }}
    />
  );
};

const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.4 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 88% 72% at 50% 44%, transparent 55%, rgba(20,8,4,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [6, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.5, 0.64, 1),
  });
  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
    >
      <div
        style={{
          textAlign: "center",
          transform: `scale(${pop})`,
          fontFamily: pacifico,
          fontSize: 110,
          lineHeight: 1.35,
          color: "#FFF6E5",
          textShadow:
            "0 0 30px rgba(255,200,90,0.95), 0 0 80px rgba(255,170,60,0.6), 0 6px 26px rgba(0,0,0,0.65)",
        }}
      >
        Загадай
        <br />
        желание ✨
      </div>
    </AbsoluteFill>
  );
};

const FinalCard: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [4, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.5, 0.64, 1),
  });
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 120% 90% at 50% 30%, #3a1f33 0%, #1a0d18 70%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Bokeh count={10} />
      <GoldSparks count={50} />
      <div
        style={{
          textAlign: "center",
          transform: `scale(${pop}) rotate(${Math.sin(frame / 20) * 1.5}deg)`,
          fontFamily: pacifico,
          fontSize: 96,
          lineHeight: 1.4,
          color: "#FFF6E5",
          textShadow:
            "0 0 30px rgba(255,200,90,0.95), 0 0 80px rgba(255,170,60,0.55), 0 6px 26px rgba(0,0,0,0.6)",
        }}
      >
        Пусть всё
        <br />
        сбудется! 🎂
      </div>
    </AbsoluteFill>
  );
};

const SceneVideo: React.FC<{ s: Scene; durFrames: number }> = ({ s, durFrames }) => {
  const frame = useCurrentFrame();
  const zoom =
    s.zoom === "punch"
      ? interpolate(frame, [0, 10], [1.16, 1.06], {
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }) * interpolate(frame, [10, Math.max(11, durFrames)], [1, 1.07], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(frame, [0, Math.max(1, durFrames)], [1.04, 1.12], {
          extrapolateRight: "clamp",
        });
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#150a08" }}>
      <OffthreadVideo
        src={staticFile(s.src)}
        startFrom={msToFrame(s.fromMs)}
        volume={s.volume ?? 0.8}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "saturate(1.16) contrast(1.07) brightness(1.02) sepia(0.12)",
          transform: `scale(${zoom}) translate(${Math.sin(frame / 34) * 6}px, ${Math.cos(frame / 30) * 5}px)`,
        }}
      />
      {s.dark ? (
        <AbsoluteFill style={{ backgroundColor: `rgba(10,5,8,${s.dark})` }} />
      ) : null}
    </AbsoluteFill>
  );
};

export const WishReel: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#150a08" }}>
      {SCENES.map((s, i) => (
        <Sequence
          key={i}
          from={msToFrame(sceneStarts[i])}
          durationInFrames={msToFrame(s.toMs - s.fromMs)}
          name={`scene ${i}`}
        >
          <SceneVideo s={s} durFrames={msToFrame(s.toMs - s.fromMs)} />
          {i > 0 ? <WhiteFlash peak={0.5} /> : null}
        </Sequence>
      ))}

      <Sequence from={msToFrame(sceneStarts[SCENES.length])} durationInFrames={msToFrame(FINAL_MS)} name="final">
        <FinalCard />
        <WhiteFlash peak={0.6} />
      </Sequence>

      {/* атмосфера поверх всего видео-блока */}
      <Sequence durationInFrames={msToFrame(sceneStarts[SCENES.length])} name="atmo">
        <Bokeh count={12} />
        <GoldSparks count={36} />
      </Sequence>

      {/* титул на первой сцене */}
      <Sequence durationInFrames={msToFrame(2800)} name="title">
        <Title />
      </Sequence>

      {/* вспышка + взрыв конфетти в момент погасания свечи */}
      <Sequence from={blowGlobalFrame} durationInFrames={80} name="burst">
        <WhiteFlash peak={0.7} />
        <ConfettiBurst />
      </Sequence>

      <Vignette strength={0.45} />

      <Audio
        src={staticFile("wish-music.mp3")}
        volume={(f) =>
          interpolate(
            f,
            [0, 20, WISH_DURATION - 55, WISH_DURATION],
            [0, 0.5, 0.5, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
    </AbsoluteFill>
  );
};
