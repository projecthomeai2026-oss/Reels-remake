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
import editPlan from "./edit-plan.json";

const { fontFamily } = loadFont("normal", {
  weights: ["800", "900"],
  subsets: ["cyrillic", "latin"],
});

export const VLOG_FPS = 30;

const CLIP_ORDER = [
  "IMG_1404",
  "IMG_1406",
  "IMG_1407",
  "IMG_1409",
  "IMG_1411",
  "IMG_1412",
  "IMG_1415",
] as const;

type Word = { text: string; startMs: number; endMs: number };
type Segment = { fromMs: number; toMs: number };

type TimelineItem = {
  clip: string;
  fromMs: number;
  toMs: number;
  globalStartMs: number;
  isClipStart: boolean;
  rate: number;
};

// Cold-open hook (~2s): "Ну конечно же бассейн"
const HOOK = { clip: "IMG_1406", fromMs: 2870, toMs: 4950 };

// Speed up slow walking transitions (audio tempo is preserved by Remotion)
const SPEED_OVERRIDES: Record<string, number> = {
  "IMG_1407@0": 1.35, // walk to «Невада» door — was dragging
};

const buildTimeline = (): { items: TimelineItem[]; totalMs: number } => {
  const items: TimelineItem[] = [];
  let cursor = 0;

  const push = (
    clip: string,
    seg: Segment,
    isClipStart: boolean,
  ) => {
    const rate = SPEED_OVERRIDES[`${clip}@${seg.fromMs}`] ?? 1;
    items.push({
      clip,
      fromMs: seg.fromMs,
      toMs: seg.toMs,
      globalStartMs: cursor,
      isClipStart,
      rate,
    });
    cursor += (seg.toMs - seg.fromMs) / rate;
  };

  push(HOOK.clip, { fromMs: HOOK.fromMs, toMs: HOOK.toMs }, false);

  for (const clip of CLIP_ORDER) {
    const { segments } = editPlan[clip] as {
      segments: Segment[];
      words: Word[];
    };
    segments.forEach((seg, i) => push(clip, seg, i === 0));
  }
  return { items, totalMs: cursor };
};

const TIMELINE = buildTimeline();

export const VLOG_DURATION = Math.ceil((TIMELINE.totalMs / 1000) * VLOG_FPS);

const msToFrame = (ms: number) => Math.round((ms / 1000) * VLOG_FPS);

const buildGlobalCaptions = (): Caption[] => {
  const captions: Caption[] = [];
  for (const item of TIMELINE.items) {
    const { words } = editPlan[item.clip] as { words: Word[] };
    for (const w of words) {
      if (w.startMs >= item.fromMs - 60 && w.startMs < item.toMs) {
        const startMs =
          item.globalStartMs +
          Math.max(0, w.startMs - item.fromMs) / item.rate;
        const endMs =
          item.globalStartMs +
          Math.min(item.toMs - item.fromMs, w.endMs - item.fromMs) /
            item.rate;
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
                boxShadow: isActive
                  ? "0 6px 18px rgba(0,0,0,0.35)"
                  : "none",
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
  const pages = useMemo(() => {
    // Split caption pages at every clip boundary so a page never spans a cut
    const all = buildGlobalCaptions();
    const boundaries = TIMELINE.items
      .filter((it, i) => i > 0 && (it.isClipStart || i === 1))
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
  }, []);

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
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "saturate(1.18) contrast(1.06) brightness(1.02)",
          translate: `${Math.sin(frame * 2.3) * shakeAmp}px ${
            Math.cos(frame * 3.1) * shakeAmp
          }px`,
          scale: String(
            // punch-in, then slow drift for a "alive" camera feel
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

// Thin progress bar near the top
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
            width: `${(frame / VLOG_DURATION) * 100}%`,
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

// Icon-only sticker that pops and bobs (accent on key words)
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

const FlameIcon: React.FC = () => (
  <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
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

// Find global frame of a word inside a clip (first occurrence)
const wordGlobalFrame = (clip: string, word: string): number | null => {
  const { words } = editPlan[clip] as { words: Word[] };
  const w = words.find((x) =>
    x.text.toLowerCase().includes(word.toLowerCase()),
  );
  if (!w) return null;
  for (const item of TIMELINE.items) {
    if (
      item.clip === clip &&
      w.startMs >= item.fromMs - 60 &&
      w.startMs < item.toMs
    ) {
      return msToFrame(
        item.globalStartMs + Math.max(0, w.startMs - item.fromMs) / item.rate,
      );
    }
  }
  return null;
};

// Subtle cinematic vignette
const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 90% 75% at 50% 46%, transparent 62%, rgba(0,0,0,0.34) 100%)",
      pointerEvents: "none",
    }}
  />
);

// Yellow sticker that slams in (shared style for badges/pills)
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

const PinIcon: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

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

// Bouncing question marks for the "под что это?" moment
const QuestionMarks: React.FC = () => {
  const frame = useCurrentFrame();
  const marks = [
    { left: "18%", top: 560, delay: 0, size: 130, rot: -14 },
    { left: "72%", top: 480, delay: 5, size: 170, rot: 10 },
    { left: "44%", top: 380, delay: 10, size: 110, rot: -5 },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {marks.map((m, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: m.left,
            top: m.top,
            fontFamily,
            fontSize: m.size,
            fontWeight: 900,
            color: "#FFDD00",
            textShadow:
              "4px 4px 0 #000, -4px 4px 0 #000, 4px -4px 0 #000, -4px -4px 0 #000",
            rotate: `${m.rot}deg`,
            scale: String(
              interpolate(frame, [m.delay, m.delay + 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.34, 1.8, 0.64, 1),
              }),
            ),
            translate: `0px ${Math.sin((frame - m.delay) / 5) * 10}px`,
          }}
        >
          ?
        </div>
      ))}
    </AbsoluteFill>
  );
};

// Final subscribe call-to-action
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

const clipStartFrame = (clip: string) =>
  msToFrame(
    TIMELINE.items.find((it) => it.clip === clip && it.isClipStart)
      ?.globalStartMs ?? 0,
  );

export const Vlog: React.FC = () => {
  const introStart = msToFrame(TIMELINE.items[1].globalStartMs);
  const questionStart = introStart + msToFrame(10740);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {TIMELINE.items.map((item, i) => (
        <Sequence
          key={i}
          from={msToFrame(item.globalStartMs)}
          durationInFrames={msToFrame((item.toMs - item.fromMs) / item.rate)}
          name={`${item.clip} ${(item.fromMs / 1000).toFixed(1)}s`}
        >
          <SegmentVideo item={item} shake={i === 0} />
          {i > 0 && item.isClipStart ? <CutFlash /> : null}
        </Sequence>
      ))}

      <Sequence from={introStart + 8} durationInFrames={95} name="Badge День со стройки">
        <Sticker top={300}>
          <HammerIcon />
          День со стройки
        </Sticker>
      </Sequence>

      <Sequence from={questionStart} durationInFrames={72} name="Question marks">
        <QuestionMarks />
      </Sequence>

      <Sequence from={clipStartFrame("IMG_1407")} durationInFrames={90} name="Pill Невада">
        <Sticker top={300} rotation={2}>
          <PinIcon />
          1/4 · «Невада»
        </Sticker>
      </Sequence>

      <Sequence from={clipStartFrame("IMG_1409")} durationInFrames={90} name="Pill Шанхай">
        <Sticker top={300}>
          <PinIcon />
          2/4 · «Шанхай»
        </Sticker>
      </Sequence>

      <Sequence from={clipStartFrame("IMG_1411")} durationInFrames={90} name="Pill Денвер">
        <Sticker top={300} rotation={2}>
          <PinIcon />
          3/4 · «Денвер»
        </Sticker>
      </Sequence>

      <Sequence from={clipStartFrame("IMG_1412")} durationInFrames={90} name="Pill Новый Шанхай">
        <Sticker top={300}>
          <PinIcon />
          4/4 · Новый «Шанхай»
        </Sticker>
      </Sequence>

      {wordGlobalFrame("IMG_1407", "клёво") !== null ? (
        <Sequence
          from={wordGlobalFrame("IMG_1407", "клёво")! - 2}
          durationInFrames={40}
          name="Flame клёво"
        >
          <IconPop left="66%" top={560}>
            <FlameIcon />
          </IconPop>
        </Sequence>
      ) : null}

      {wordGlobalFrame("IMG_1412", "Начинаем") !== null ? (
        <Sequence
          from={wordGlobalFrame("IMG_1412", "Начинаем")!}
          durationInFrames={55}
          name="Rocket стройка"
        >
          <IconPop left="16%" top={520} rot={8}>
            <RocketIcon />
          </IconPop>
        </Sequence>
      ) : null}

      <Sequence name="Progress bar">
        <ProgressBar />
      </Sequence>

      <Sequence from={VLOG_DURATION - 68} durationInFrames={68} name="CTA Подпишись">
        <EndCTA />
      </Sequence>

      {TIMELINE.items.map((item, i) =>
        i > 0 && item.isClipStart ? (
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
          src={staticFile("music4.mp3")}
          loop
          volume={(f) =>
            interpolate(
              f,
              [0, 20, VLOG_DURATION - 50, VLOG_DURATION],
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
