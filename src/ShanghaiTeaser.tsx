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
import { loadFont } from "@remotion/google-fonts/Montserrat";

const { fontFamily } = loadFont("normal", {
  weights: ["800", "900"],
  subsets: ["cyrillic", "latin"],
});

export const TEASER_FPS = 30;

const MOTO_S = 11; // сколько берём из мото-клипа
const HOUSE_S = 5.5; // сколько показываем дом
export const TEASER_DURATION = Math.round((MOTO_S + HOUSE_S) * TEASER_FPS);

const HOUSE_START = Math.round(MOTO_S * TEASER_FPS);

// Мото-часть: лёгкий грейд, пульс-зумы «в бит», ускорение 1.1
const MotoPart: React.FC = () => {
  const frame = useCurrentFrame();
  // зум-бамп каждые ~1.6s: резкий вход, плавный спад
  const beat = 48;
  const t = frame % beat;
  const bump = interpolate(t, [0, 3, 20], [0, 0.035, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile("clips/moto.mp4")}
        playbackRate={1.1}
        volume={0}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "saturate(1.25) contrast(1.1) brightness(1.02)",
          scale: String(1.04 + bump + 0.006 * Math.sin(frame / 5)),
          rotate: `${Math.sin(frame / 9) * 0.4}deg`,
        }}
      />
    </AbsoluteFill>
  );
};

// Дом «Шанхай»: Ken Burns + снегопад
const HousePart: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#0b1020" }}>
      <Img
        src={staticFile("shanghai.jpg")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "saturate(1.15) contrast(1.05) brightness(1.03)",
          scale: String(
            interpolate(frame, [0, HOUSE_S * TEASER_FPS], [1.18, 1.02], {
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.quad),
            }),
          ),
        }}
      />
      <Snow />
    </AbsoluteFill>
  );
};

// Детерминированный снегопад (без Math.random — стабильный рендер)
const Snow: React.FC = () => {
  const frame = useCurrentFrame();
  const flakes = Array.from({ length: 60 }, (_, i) => {
    const seed = (i * 2654435761) % 1000;
    const x = (seed % 100) / 100; // 0..1
    const size = 4 + (seed % 7);
    const speed = 1.6 + ((seed >> 3) % 10) / 6;
    const drift = ((seed >> 5) % 7) - 3;
    const phase = seed % 360;
    return { x, size, speed, drift, phase };
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {flakes.map((f, i) => {
        const y = ((frame * f.speed * 2 + f.phase * 5) % 2100) - 100;
        const x = f.x * 1080 + Math.sin((frame + f.phase) / 20) * 30 + f.drift;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: f.size,
              height: f.size,
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.85)",
              filter: "blur(1px)",
              boxShadow: "0 0 6px rgba(255,255,255,0.6)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// Вспышка-переход
const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(115deg, rgba(255,190,60,0.95) 0%, rgba(255,255,255,1) 45%, rgba(255,140,60,0.8) 100%)",
        opacity: interpolate(frame, [0, 4, 12], [0, 1, 0], {
          extrapolateRight: "clamp",
        }),
        pointerEvents: "none",
      }}
    />
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 90% 75% at 50% 46%, transparent 62%, rgba(0,0,0,0.34) 100%)",
      pointerEvents: "none",
    }}
  />
);

const Sticker: React.FC<{
  children: React.ReactNode;
  top: number;
  rotation?: number;
  fontSize?: number;
  bg?: string;
  color?: string;
}> = ({ children, top, rotation = -3, fontSize = 48, bg = "#FFDD00", color = "#111111" }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: "center", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontFamily,
          fontSize,
          fontWeight: 900,
          textTransform: "uppercase",
          color,
          backgroundColor: bg,
          padding: "14px 32px",
          borderRadius: 18,
          boxShadow: "0 8px 22px rgba(0,0,0,0.35)",
          rotate: `${rotation}deg`,
          scale: String(
            interpolate(frame, [0, 7], [0, 1], {
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.34, 1.7, 0.64, 1),
            }),
          ),
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

export const ShanghaiTeaser: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <Sequence durationInFrames={HOUSE_START} name="Мото">
        <MotoPart />
      </Sequence>

      <Sequence from={15} durationInFrames={80} name="Плашка Еду показывать">
        <Sticker top={330}>🏍 Еду показывать дом</Sticker>
      </Sequence>

      <Sequence from={HOUSE_START} name="Дом Шанхай">
        <HousePart />
      </Sequence>

      <Sequence from={HOUSE_START} durationInFrames={14} name="Вспышка">
        <Flash />
      </Sequence>

      <Sequence from={HOUSE_START + 8} name="Плашка Шанхай">
        <Sticker top={330} rotation={2} fontSize={58}>
          Проект «Шанхай»
        </Sticker>
      </Sequence>

      <Sequence from={HOUSE_START + 16} name="Подпись">
        <Sticker top={440} rotation={-1} fontSize={34} bg="#111111" color="#FFFFFF">
          строим и продаём · «ДВА ПРОРАБА»
        </Sticker>
      </Sequence>

      <Sequence from={Math.max(0, HOUSE_START - 2)} durationInFrames={30} name="Whoosh">
        <Audio src={staticFile("whoosh.wav")} volume={0.25} />
      </Sequence>

      <Sequence name="Музыка">
        <Audio
          src={staticFile("music2.mp3")}
          loop
          volume={(f) =>
            interpolate(
              f,
              [0, 15, TEASER_DURATION - 40, TEASER_DURATION],
              [0, 0.6, 0.6, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )
          }
        />
      </Sequence>

      <Sequence name="Виньетка">
        <Vignette />
      </Sequence>
    </AbsoluteFill>
  );
};
