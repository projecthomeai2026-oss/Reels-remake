import {
  AbsoluteFill,
  Audio,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useMemo } from "react";
import {
  createTikTokStyleCaptions,
  type Caption,
  type TikTokPage,
} from "@remotion/captions";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import plan from "./reel9-plan.json";

const { fontFamily } = loadFont("normal", {
  weights: ["800", "900"],
  subsets: ["cyrillic", "latin"],
});

export const REELS9_FPS = 30;

type Word = { text: string; startMs: number; endMs: number };

type PlanItem = {
  clip: string;
  fromMs: number;
  toMs: number;
  rate: number;
  volume: number;
  flash: boolean;
  badge: string | null;
  hookLook?: boolean;
};

type StickerDef = {
  text: string;
  atMs: number;
  durMs: number;
  top: number;
  rotation?: number;
  fontSize?: number;
};

type ReelPlan = {
  id: string;
  title: string;
  music: string;
  items: PlanItem[];
  stickers?: StickerDef[];
};

type TimelineItem = PlanItem & { globalStartMs: number };

const WORDS = plan.words as Record<string, Word[]>;
const REEL_PLANS = plan.reels as ReelPlan[];

const msToFrame = (ms: number) => Math.round((ms / 1000) * REELS9_FPS);

const buildTimeline = (reel: ReelPlan) => {
  const items: TimelineItem[] = [];
  let cursor = 0;
  for (const it of reel.items) {
    items.push({ ...it, globalStartMs: cursor });
    cursor += (it.toMs - it.fromMs) / it.rate;
  }
  return { items, totalMs: cursor };
};

const buildCaptions = (items: TimelineItem[]): Caption[] => {
  const captions: Caption[] = [];
  for (const item of items) {
    const words = WORDS[item.clip];
    for (const w of words) {
      if (w.startMs >= item.fromMs - 60 && w.startMs < item.toMs) {
        const startMs =
          item.globalStartMs + Math.max(0, w.startMs - item.fromMs) / item.rate;
        const endMs =
          item.globalStartMs +
          Math.min(item.toMs - item.fromMs, w.endMs - item.fromMs) / item.rate;
        captions.push({
          // без точек в субтитрах (просьба Романа); "!" и "?" оставляем
          text: " " + w.text.replace(/[.…]+$/g, ""),
          startMs,
          endMs: Math.max(endMs, startMs + 80),
          timestampMs: (startMs + endMs) / 2,
          confidence: null,
        });
      }
    }
  }
  return captions;
};

const SWITCH_CAPTIONS_EVERY_MS = 1000;

// CapCut-стиль: капс, активное слово в жёлтой плашке
const CaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const absoluteTimeMs = page.startMs + (frame / fps) * 1000;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 430,
        paddingLeft: 60,
        paddingRight: 60,
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize: 64,
          fontWeight: 900,
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 1.32,
          letterSpacing: "0.01em",
          scale: String(
            interpolate(frame, [0, 5], [0.9, 1], {
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.34, 1.56, 0.64, 1),
            }),
          ),
          opacity: interpolate(frame, [0, 3], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        {page.tokens.map((token) => {
          const isActive =
            token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;
          return (
            <span
              key={token.fromMs}
              style={{
                color: isActive ? "#111111" : "#FFFFFF",
                backgroundColor: isActive ? "#FFDD00" : "transparent",
                borderRadius: 14,
                padding: isActive ? "2px 14px" : "2px 2px",
                marginLeft: 6,
                marginRight: 6,
                display: "inline-block",
                rotate: isActive ? "-1.5deg" : "0deg",
                scale: isActive ? "1.06" : "1",
                textShadow: isActive
                  ? "none"
                  : "3px 3px 0 #000, -3px 3px 0 #000, 3px -3px 0 #000, -3px -3px 0 #000, 0 6px 14px rgba(0,0,0,0.55)",
                boxShadow: isActive ? "0 6px 18px rgba(0,0,0,0.35)" : "none",
              }}
            >
              {token.text.trim()}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Captions: React.FC<{ items: TimelineItem[] }> = ({ items }) => {
  const { fps } = useVideoConfig();
  const pages = useMemo(() => {
    // Разрезаем страницы субтитров на границах сцен, чтобы страница не жила через склейку
    const all = buildCaptions(items);
    const boundaries = items
      .filter((it, i) => i > 0 && (it.flash || i === 1))
      .map((it) => it.globalStartMs);
    const groups: Caption[][] = [];
    let rest = all;
    for (const b of boundaries) {
      groups.push(rest.filter((c) => c.startMs < b - 20));
      rest = rest.filter((c) => c.startMs >= b - 20);
    }
    groups.push(rest);
    return groups.flatMap(
      (captions) =>
        createTikTokStyleCaptions({
          captions,
          combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS,
        }).pages,
    );
  }, [items]);

  return (
    <AbsoluteFill>
      {pages.map((page, index) => {
        const nextPage = pages[index + 1] ?? null;
        const startFrame = (page.startMs / 1000) * fps;
        const endFrame = Math.min(
          nextPage ? (nextPage.startMs / 1000) * fps : Infinity,
          startFrame + (SWITCH_CAPTIONS_EVERY_MS / 1000) * fps + fps * 0.8,
        );
        const durationInFrames = endFrame - startFrame;
        if (durationInFrames <= 0) return null;

        return (
          <Sequence
            key={index}
            from={Math.round(startFrame)}
            durationInFrames={Math.round(durationInFrames)}
            name={`Caption "${page.text.trim().slice(0, 20)}"`}
          >
            <CaptionPage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// Сегмент видео: punch-in на входе + медленный дрейф-зум, грейдинг
const SegmentVideo: React.FC<{ item: TimelineItem; shake?: boolean }> = ({
  item,
  shake,
}) => {
  const frame = useCurrentFrame();
  const durFrames = msToFrame((item.toMs - item.fromMs) / item.rate);
  const shakeAmp = shake
    ? interpolate(frame, [0, 14], [9, 0], { extrapolateRight: "clamp" })
    : 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(`clips/${item.clip}.mp4`)}
        startFrom={msToFrame(item.fromMs)}
        playbackRate={item.rate}
        volume={item.volume}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: item.hookLook
            ? "saturate(1.45) contrast(1.22) brightness(1.05)"
            : "saturate(1.18) contrast(1.06) brightness(1.02)",
          translate: `${Math.sin(frame * 2.3) * shakeAmp}px ${
            Math.cos(frame * 3.1) * shakeAmp
          }px`,
          scale: String(
            interpolate(frame, [0, 8], [1.1, 1.02], {
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }) *
              interpolate(frame, [8, Math.max(9, durFrames)], [1, 1.045], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
          ),
        }}
      />
    </AbsoluteFill>
  );
};

// Эффектный цветной опенер (без ч/б и глич-эффектов): тёплая вспышка на входе,
// въезжающие киношные полосы, усиленная виньетка. Цвет качает SegmentVideo.
const HookOverlay: React.FC<{ animateIn?: boolean }> = ({ animateIn }) => {
  const frame = useCurrentFrame();
  const barH = animateIn
    ? interpolate(frame, [0, 12], [0, 150], {
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      })
    : 150;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* киношные полосы въезжают сверху и снизу */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: barH, backgroundColor: "#000" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: barH, backgroundColor: "#000" }} />
      {/* усиленное киновиньетирование */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 85% 70% at 50% 46%, transparent 52%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* тёплая вспышка на входе (только на первом сегменте хука,
          на стыке её даёт CutFlash) */}
      {animateIn ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(115deg, rgba(255,190,60,0.9) 0%, rgba(255,255,255,0.95) 45%, rgba(255,140,60,0.7) 100%)",
            opacity: interpolate(frame, [0, 9], [0.75, 0], {
              extrapolateRight: "clamp",
            }),
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

// Тёплая вспышка на жёстких склейках
const CutFlash: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(115deg, rgba(255,190,60,0.9) 0%, rgba(255,255,255,0.95) 45%, rgba(255,140,60,0.7) 100%)",
        opacity: interpolate(frame, [0, 7], [0.6, 0], {
          extrapolateRight: "clamp",
        }),
        pointerEvents: "none",
      }}
    />
  );
};

const ProgressBar: React.FC<{ totalFrames: number }> = ({ totalFrames }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 222,
          left: 60,
          width: 960,
          height: 10,
          borderRadius: 5,
          backgroundColor: "rgba(255,255,255,0.28)",
        }}
      >
        <div
          style={{
            width: `${(frame / totalFrames) * 100}%`,
            height: "100%",
            borderRadius: 5,
            backgroundColor: "#FFDD00",
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          }}
        />
      </div>
    </AbsoluteFill>
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

// Жёлтый стикер-плашка
const Sticker: React.FC<{
  children: React.ReactNode;
  top: number;
  rotation?: number;
  fontSize?: number;
}> = ({ children, top, rotation = -3, fontSize = 44 }) => {
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
          color: "#111111",
          backgroundColor: "#FFDD00",
          padding: "12px 28px",
          borderRadius: 16,
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

const HammerIcon: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9" />
    <path d="m18 15 4-4" />
    <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
  </svg>
);

const BellIcon: React.FC = () => (
  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const EndCTA: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontFamily,
          fontSize: 58,
          fontWeight: 900,
          textTransform: "uppercase",
          color: "#111111",
          backgroundColor: "#FFDD00",
          padding: "20px 44px",
          borderRadius: 22,
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
          rotate: "-2deg",
          translate: `0px ${Math.sin(frame / 4) * 6}px`,
          scale: String(
            interpolate(frame, [0, 8], [0, 1], {
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.34, 1.7, 0.64, 1),
            }),
          ),
        }}
      >
        <BellIcon />
        Подпишись
      </div>
    </AbsoluteFill>
  );
};

const MUSIC_VOLUME = 0.08;

export const makeReel = (reel: ReelPlan) => {
  const { items, totalMs } = buildTimeline(reel);
  const duration = Math.ceil((totalMs / 1000) * REELS9_FPS);

  // Стикер с названием — на старте основной части (первый flash-элемент
  // вне хука; в хуке flash прикрывает вырез мата), без опенера — с 8-го кадра
  const firstFlash = items.find((it) => it.flash && !it.hookLook);
  const stickerFrame = (firstFlash ? msToFrame(firstFlash.globalStartMs) : 0) + 8;

  const Reel: React.FC = () => (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {items.map((item, i) => (
        <Sequence
          key={i}
          from={msToFrame(item.globalStartMs)}
          durationInFrames={msToFrame((item.toMs - item.fromMs) / item.rate)}
          name={`${item.clip} ${(item.fromMs / 1000).toFixed(1)}s`}
        >
          <SegmentVideo item={item} shake={i === 0} />
          {item.hookLook ? <HookOverlay animateIn={i === 0} /> : null}
          {i > 0 && item.flash ? <CutFlash /> : null}
        </Sequence>
      ))}

      <Sequence from={stickerFrame} durationInFrames={95} name={`Badge ${reel.title}`}>
        <Sticker top={300}>
          <HammerIcon />
          {reel.title}
        </Sticker>
      </Sequence>

      {(reel.stickers ?? []).map((s, i) => (
        <Sequence
          key={`sticker-${i}`}
          from={msToFrame(s.atMs)}
          durationInFrames={msToFrame(s.durMs)}
          name={`Sticker ${s.text}`}
        >
          <Sticker top={s.top} rotation={s.rotation ?? -3} fontSize={s.fontSize ?? 50}>
            {s.text}
          </Sticker>
        </Sequence>
      ))}

      {items.map((item, i) =>
        item.badge ? (
          <Sequence
            key={`badge-${i}`}
            from={msToFrame(item.globalStartMs) + 6}
            durationInFrames={msToFrame((item.toMs - item.fromMs) / item.rate) - 6}
            name={`Speed badge ${item.badge}`}
          >
            <Sticker top={430} rotation={3} fontSize={54}>
              {item.badge}
            </Sticker>
          </Sequence>
        ) : null,
      )}

      <Sequence from={duration - 68} durationInFrames={68} name="CTA Подпишись">
        <EndCTA />
      </Sequence>

      {items.map((item, i) =>
        i > 0 && item.flash ? (
          <Sequence
            key={`whoosh-${i}`}
            from={Math.max(0, msToFrame(item.globalStartMs) - 3)}
            durationInFrames={30}
            name={`Whoosh ${item.clip}`}
          >
            <Audio src={staticFile("whoosh.wav")} volume={0.22} />
          </Sequence>
        ) : null,
      )}

      <Sequence name="Vignette">
        <Vignette />
      </Sequence>

      <Sequence name="Background music">
        <Audio
          src={staticFile(reel.music)}
          loop
          volume={(f) =>
            interpolate(
              f,
              [0, 20, duration - 50, duration],
              [0, MUSIC_VOLUME, MUSIC_VOLUME, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )
          }
        />
      </Sequence>

      <Sequence name="Captions">
        <Captions items={items} />
      </Sequence>
    </AbsoluteFill>
  );

  return { id: reel.id, component: Reel, duration };
};

export const REELS9 = REEL_PLANS.map(makeReel);
