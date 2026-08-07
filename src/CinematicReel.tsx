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
import plan from "./cinema-plan.json";

const { fontFamily } = loadFont("normal", {
  weights: ["600", "700", "800", "900"],
  subsets: ["cyrillic", "latin"],
});

export const CINEMA_FPS = 30;

type Word = { text: string; startMs: number; endMs: number };
type PlanItem = {
  clip: string; fromMs: number; toMs: number; rate: number; volume: number;
  slow: boolean; sfx: string | null; captionToMs: number | null;
};
type ReelPlan = { id: string; title: string; music: string; items: PlanItem[] };
type TimelineItem = PlanItem & { globalStartMs: number };

const WORDS = plan.words as Record<string, Word[]>;
const REEL_PLANS = plan.reels as ReelPlan[];
const msToFrame = (ms: number) => Math.round((ms / 1000) * CINEMA_FPS);
const CAPTION_DELAY_MS = 150;
const XFADE_MS = 350; // плавный кросс-переход между сценами

const buildTimeline = (reel: ReelPlan) => {
  const items: TimelineItem[] = [];
  let cursor = 0;
  for (const it of reel.items) {
    items.push({ ...it, globalStartMs: cursor });
    cursor += (it.toMs - it.fromMs) / it.rate - XFADE_MS; // перекрытие для кросс-фейда
  }
  return { items, totalMs: cursor + XFADE_MS };
};

const buildCaptions = (items: TimelineItem[]): Caption[] => {
  const captions: Caption[] = [];
  for (const item of items) {
    const cap = item.captionToMs ?? item.toMs;
    for (const w of WORDS[item.clip]) {
      if (w.startMs >= item.fromMs - 60 && w.startMs < cap) {
        const startMs = item.globalStartMs + Math.max(0, w.startMs - item.fromMs) / item.rate + CAPTION_DELAY_MS;
        const endMs = item.globalStartMs + Math.min(item.toMs - item.fromMs, w.endMs - item.fromMs) / item.rate + CAPTION_DELAY_MS;
        captions.push({ text: " " + w.text.replace(/[.…]+$/g, ""), startMs, endMs: Math.max(endMs, startMs + 80), timestampMs: (startMs + endMs) / 2, confidence: null });
      }
    }
  }
  captions.sort((a, b) => a.startMs - b.startMs);
  for (let i = 0; i < captions.length - 1; i++) {
    const gap = captions[i + 1].startMs - captions[i].startMs;
    if (gap > 0 && gap < 700) { captions[i].endMs = captions[i + 1].startMs; captions[i].timestampMs = (captions[i].startMs + captions[i].endMs) / 2; }
  }
  return captions;
};

const SWITCH_MS = 900;

// CapCut-стиль (как в прежних рилсах): капс, активное слово в жёлтой плашке
const CaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = page.startMs + (frame / fps) * 1000;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 320, paddingLeft: 60, paddingRight: 60 }}>
      <div
        style={{
          fontFamily, fontSize: 62, fontWeight: 900, textTransform: "uppercase", textAlign: "center",
          lineHeight: 1.3, letterSpacing: "0.01em",
          scale: String(interpolate(frame, [0, 5], [0.9, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.34, 1.56, 0.64, 1) })),
          opacity: interpolate(frame, [0, 3], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {page.tokens.map((t) => {
          const active = t.fromMs <= abs && t.toMs > abs;
          return (
            <span key={t.fromMs} style={{
              color: active ? "#111" : "#fff",
              backgroundColor: active ? "#FFDD00" : "transparent",
              borderRadius: 12, padding: active ? "2px 12px" : "2px 2px",
              marginLeft: 5, marginRight: 5, display: "inline-block",
              rotate: active ? "-1.5deg" : "0deg", scale: active ? "1.06" : "1",
              textShadow: active ? "none" : "3px 3px 0 #000,-3px 3px 0 #000,3px -3px 0 #000,-3px -3px 0 #000,0 6px 14px rgba(0,0,0,0.55)",
              boxShadow: active ? "0 6px 18px rgba(0,0,0,0.35)" : "none",
            }}>
              {t.text.trim()}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Captions: React.FC<{ items: TimelineItem[] }> = ({ items }) => {
  const { fps } = useVideoConfig();
  const pages = useMemo(() => createTikTokStyleCaptions({ captions: buildCaptions(items), combineTokensWithinMilliseconds: SWITCH_MS }).pages, [items]);
  return (
    <AbsoluteFill>
      {pages.map((page, i) => {
        const next = pages[i + 1] ?? null;
        const start = (page.startMs / 1000) * fps;
        const end = next ? (next.startMs / 1000) * fps : start + fps * 3;
        const dur = end - start;
        if (dur <= 0) return null;
        return (
          <Sequence key={i} from={Math.round(start)} durationInFrames={Math.round(dur)} name={`Cap ${page.text.trim().slice(0, 16)}`}>
            <CaptionPage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// Кино-грейд + медленный дрейф-зум
const SegmentVideo: React.FC<{ item: TimelineItem }> = ({ item }) => {
  const frame = useCurrentFrame();
  const durF = msToFrame((item.toMs - item.fromMs) / item.rate);
  const zoom = interpolate(frame, [0, durF], [item.slow ? 1.05 : 1.08, item.slow ? 1.16 : 1.14], { extrapolateRight: "clamp", easing: Easing.linear });
  const fadeIn = interpolate(frame, [0, msToFrame(XFADE_MS)], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durF - msToFrame(XFADE_MS), durF], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: Math.min(fadeIn, fadeOut) }}>
      <OffthreadVideo
        src={staticFile(`clips/${item.clip}.mp4`)}
        startFrom={msToFrame(item.fromMs)}
        playbackRate={item.rate}
        volume={item.volume}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})`, filter: "contrast(1.08) saturate(1.08) brightness(1.02)" }}
      />
    </AbsoluteFill>
  );
};

// Постоянный кино-оверлей: леттербокс, виньетка, зерно, холодный вельвет
const CineFrame: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.05 }}>
        <filter id="cgrain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#cgrain)" />
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 88% 78% at 50% 46%, transparent 66%, rgba(0,0,0,0.3) 100%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 130, background: "#000" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 130, background: "#000" }} />
    </AbsoluteFill>
  );
};

const TitleCard: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [8, 20, 70, 82], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 200, pointerEvents: "none" }}>
      <div style={{ fontFamily, fontSize: 30, fontWeight: 600, letterSpacing: "0.4em", textTransform: "uppercase", color: "#fff", opacity: op, textShadow: "0 2px 16px rgba(0,0,0,0.9)" }}>
        {title}
      </div>
    </AbsoluteFill>
  );
};

const MUSIC_VOLUME = 0.14;

export const makeCinema = (reel: ReelPlan) => {
  const { items, totalMs } = buildTimeline(reel);
  const duration = Math.ceil((totalMs / 1000) * CINEMA_FPS);
  const Reel: React.FC = () => (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {items.map((item, i) => (
        <Sequence key={i} from={msToFrame(item.globalStartMs)} durationInFrames={msToFrame((item.toMs - item.fromMs) / item.rate)} name={`${item.clip} ${(item.fromMs / 1000).toFixed(0)}s`}>
          <SegmentVideo item={item} />
        </Sequence>
      ))}
      <Sequence name="cine-frame"><CineFrame /></Sequence>
      <Sequence from={0} durationInFrames={90} name="title"><TitleCard title={reel.title} /></Sequence>

      {items.map((item, i) => item.sfx ? (
        <Sequence key={`sfx-${i}`} from={Math.max(0, msToFrame(item.globalStartMs) - 2)} durationInFrames={70} name={`sfx ${item.sfx}`}>
          <Audio src={staticFile(`${item.sfx}.wav`)} volume={item.sfx === "riser" ? 0.35 : 0.5} />
        </Sequence>
      ) : null)}

      <Sequence name="music">
        <Audio src={staticFile(reel.music)} loop volume={(f) => interpolate(f, [0, 25, duration - 45, duration], [0, MUSIC_VOLUME, MUSIC_VOLUME, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      </Sequence>

      <Sequence name="captions"><Captions items={items} /></Sequence>
    </AbsoluteFill>
  );
  return { id: reel.id, component: Reel, duration };
};

export const CINEMA = REEL_PLANS.map(makeCinema);
