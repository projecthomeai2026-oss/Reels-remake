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
import editPlan from "./edit-plan-1437.json";

const { fontFamily } = loadFont("normal", {
  weights: ["800", "900"],
  subsets: ["cyrillic", "latin"],
});

export const REEL1437_FPS = 30;

const CLIP = "IMG_1437";

type Word = { text: string; startMs: number; endMs: number };
type Segment = { fromMs: number; toMs: number };

type TimelineItem = {
  fromMs: number;
  toMs: number;
  globalStartMs: number;
};

const buildTimeline = (): { items: TimelineItem[]; totalMs: number } => {
  const items: TimelineItem[] = [];
  let cursor = 0;
  const { segments } = editPlan[CLIP] as { segments: Segment[]; words: Word[] };
  for (const seg of segments) {
    items.push({ fromMs: seg.fromMs, toMs: seg.toMs, globalStartMs: cursor });
    cursor += seg.toMs - seg.fromMs;
  }
  return { items, totalMs: cursor };
};

const TIMELINE = buildTimeline();

export const REEL1437_DURATION = Math.ceil(
  (TIMELINE.totalMs / 1000) * REEL1437_FPS,
);

const msToFrame = (ms: number) => Math.round((ms / 1000) * REEL1437_FPS);

// Глобальный кадр первого вхождения слова (для синхронизации эффектов)
const wordGlobalFrame = (word: string): number | null => {
  const { words } = editPlan[CLIP] as { words: Word[] };
  const w = words.find((x) => x.text.toLowerCase().includes(word.toLowerCase()));
  if (!w) return null;
  for (const item of TIMELINE.items) {
    if (w.startMs >= item.fromMs - 60 && w.startMs < item.toMs) {
      return msToFrame(item.globalStartMs + Math.max(0, w.startMs - item.fromMs));
    }
  }
  return null;
};

const buildGlobalCaptions = (): Caption[] => {
  const captions: Caption[] = [];
  const { words } = editPlan[CLIP] as { words: Word[] };
  for (const item of TIMELINE.items) {
    for (const w of words) {
      if (w.startMs >= item.fromMs - 60 && w.startMs < item.toMs) {
        const startMs = item.globalStartMs + Math.max(0, w.startMs - item.fromMs);
        const endMs =
          item.globalStartMs + Math.min(item.toMs - item.fromMs, w.endMs - item.fromMs);
        captions.push({
          text: " " + w.text,
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

// CapCut-style captions: uppercase, active word in a yellow pill
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

const Captions: React.FC = () => {
  const { fps } = useVideoConfig();
  const pages = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions: buildGlobalCaptions(),
        combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS,
      }).pages,
    [],
  );

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

// Video segment with punch-in on entry + slow drift zoom, graded look
const SegmentVideo: React.FC<{ item: TimelineItem; shake?: boolean }> = ({
  item,
  shake,
}) => {
  const frame = useCurrentFrame();
  const durFrames = msToFrame(item.toMs - item.fromMs);
  const shakeAmp = shake
    ? interpolate(frame, [0, 14], [9, 0], { extrapolateRight: "clamp" })
    : 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(`clips/${CLIP}.mp4`)}
        startFrom={msToFrame(item.fromMs)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "saturate(1.18) contrast(1.06) brightness(1.02)",
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
              }) *
              // едва заметное «дыхание» камеры — живость кадра
              (1 + 0.006 * Math.sin(frame / 6)),
          ),
        }}
      />
    </AbsoluteFill>
  );
};

// Warm light-leak flash on hard cuts
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

const ProgressBar: React.FC = () => {
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
            width: `${(frame / REEL1437_DURATION) * 100}%`,
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

// Иконка-стикер, который выпрыгивает и покачивается (акцент на ключевых словах)
const IconPop: React.FC<{
  children: React.ReactNode;
  left: string;
  top: number;
  rot?: number;
}> = ({ children, left, top, rot = -8 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left,
          top,
          backgroundColor: "#FFDD00",
          borderRadius: "50%",
          width: 130,
          height: 130,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 22px rgba(0,0,0,0.35)",
          rotate: `${rot}deg`,
          translate: `0px ${Math.sin(frame / 4) * 8}px`,
          scale: String(
            interpolate(frame, [0, 8], [0, 1], {
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.34, 1.8, 0.64, 1),
            }),
          ),
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

const BuildingIcon: React.FC = () => (
  <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
  </svg>
);

const RocketIcon: React.FC = () => (
  <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

const HandshakeIcon: React.FC = () => (
  <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m11 17 2 2a1 1 0 1 0 3-3" />
    <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
    <path d="m21 3 1 11h-2" />
    <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
    <path d="M3 4h8" />
  </svg>
);

const PinIcon: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
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

export const Reel1437: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {TIMELINE.items.map((item, i) => (
        <Sequence
          key={i}
          from={msToFrame(item.globalStartMs)}
          durationInFrames={msToFrame(item.toMs - item.fromMs)}
          name={`${CLIP} ${(item.fromMs / 1000).toFixed(1)}s`}
        >
          <SegmentVideo item={item} shake={i === 0} />
          {i > 0 ? <CutFlash /> : null}
        </Sequence>
      ))}

      <Sequence from={10} durationInFrames={95} name="Badge Дежурство">
        <Sticker top={300}>
          <PinIcon />
          Дежурю в «Этажах»
        </Sticker>
      </Sequence>

      {wordGlobalFrame("«Этажи»") !== null ? (
        <Sequence
          from={wordGlobalFrame("«Этажи»")! - 2}
          durationInFrames={45}
          name="Building Этажи"
        >
          <IconPop left="68%" top={540}>
            <BuildingIcon />
          </IconPop>
        </Sequence>
      ) : null}

      {wordGlobalFrame("2015") !== null ? (
        <Sequence from={wordGlobalFrame("2015")!} durationInFrames={80} name="Badge 2015">
          <Sticker top={300} rotation={2}>
            Здесь всё началось · 2015
          </Sticker>
        </Sequence>
      ) : null}

      {wordGlobalFrame("карьера") !== null ? (
        <Sequence
          from={wordGlobalFrame("карьера")!}
          durationInFrames={50}
          name="Rocket карьера"
        >
          <IconPop left="16%" top={520} rot={8}>
            <RocketIcon />
          </IconPop>
        </Sequence>
      ) : null}

      {wordGlobalFrame("консультацию") !== null ? (
        <Sequence
          from={wordGlobalFrame("консультацию")! - 4}
          durationInFrames={55}
          name="Handshake консультация"
        >
          <IconPop left="64%" top={560} rot={-6}>
            <HandshakeIcon />
          </IconPop>
        </Sequence>
      ) : null}

      <Sequence name="Progress bar">
        <ProgressBar />
      </Sequence>

      <Sequence
        from={REEL1437_DURATION - 54}
        durationInFrames={54}
        name="CTA Подпишись"
      >
        <EndCTA />
      </Sequence>

      {TIMELINE.items.map((item, i) =>
        i > 0 ? (
          <Sequence
            key={`whoosh-${i}`}
            from={Math.max(0, msToFrame(item.globalStartMs) - 3)}
            durationInFrames={30}
            name={`Whoosh ${i}`}
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
          src={staticFile("music4.mp3")}
          loop
          volume={(f) =>
            interpolate(
              f,
              [0, 20, REEL1437_DURATION - 50, REEL1437_DURATION],
              [0, MUSIC_VOLUME, MUSIC_VOLUME, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )
          }
        />
      </Sequence>

      <Sequence name="Captions">
        <Captions />
      </Sequence>
    </AbsoluteFill>
  );
};
