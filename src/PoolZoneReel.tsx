import {
  AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence,
  interpolate, staticFile, useCurrentFrame, useVideoConfig, spring,
} from "remotion";
import { useMemo } from "react";
import { createTikTokStyleCaptions, type Caption, type TikTokPage } from "@remotion/captions";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import { Gif } from "@remotion/gif";
import plan from "./poolzone-plan.json";

const { fontFamily } = loadFont("normal", { weights: ["600", "700", "800", "900"], subsets: ["cyrillic", "latin"] });
export const PZ_FPS = 30;

type Word = { text: string; startMs: number; endMs: number };
type PlanItem = { clip: string; fromMs: number; toMs: number; rate: number; volume: number; slow: boolean; sfx: string | null; captionToMs: number | null; shot: "wide" | "close" | "pov" };
type Series = { title: string; location: string; sub?: string };
type Accent = { atMs: number; durMs: number; mag?: number };
type GifDef = { src: string; atMs: number; durMs: number; mode: string; label?: string; pos?: string; size?: number };
type Hero = { atMs: number; durMs: number; anim: "slam" | "slide" | "wipe"; pre: string; key: string };
type SfxT = { atMs: number; src: string; vol?: number };
type ReelPlan = { id: string; title: string; music: string; items: PlanItem[]; series?: Series; accents?: Accent[]; gifs?: GifDef[]; heroPhrases?: Hero[]; sfxTrack?: SfxT[] };
type TimelineItem = PlanItem & { globalStartMs: number };

const WORDS = plan.words as Record<string, Word[]>;
const REEL_PLANS = plan.reels as ReelPlan[];
const msToFrame = (ms: number) => Math.round((ms / 1000) * PZ_FPS);
const XFADE_MS = 350;

const buildTimeline = (reel: ReelPlan) => {
  const items: TimelineItem[] = [];
  let cursor = 0;
  for (const it of reel.items) { items.push({ ...it, globalStartMs: cursor }); cursor += (it.toMs - it.fromMs) / it.rate - XFADE_MS; }
  return { items, totalMs: cursor + XFADE_MS };
};

const buildCaptions = (items: TimelineItem[]): Caption[] => {
  const captions: Caption[] = [];
  for (const item of items) {
    const cap = item.captionToMs ?? item.toMs;
    for (const w of WORDS[item.clip]) {
      if (w.startMs >= item.fromMs - 60 && w.startMs < cap) {
        const startMs = item.globalStartMs + Math.max(0, w.startMs - item.fromMs) / item.rate;
        const endMs = item.globalStartMs + Math.min(item.toMs - item.fromMs, w.endMs - item.fromMs) / item.rate;
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

// Субтитры B&W (белый + чёрная обводка), активное слово — жёлтая плашка
const CaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = page.startMs + (frame / fps) * 1000;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 300, paddingLeft: 60, paddingRight: 60 }}>
      <div style={{ fontFamily, fontSize: 58, fontWeight: 900, textTransform: "uppercase", textAlign: "center", lineHeight: 1.25,
        scale: String(interpolate(frame, [0, 5], [0.92, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.34, 1.56, 0.64, 1) })),
        opacity: interpolate(frame, [0, 3], [0, 1], { extrapolateRight: "clamp" }) }}>
        {page.tokens.map((t) => {
          const active = t.fromMs <= abs && t.toMs > abs;
          return (<span key={t.fromMs} style={{ color: active ? "#111" : "#fff", backgroundColor: active ? "#FFE500" : "transparent",
            borderRadius: 10, padding: active ? "2px 12px" : "2px 2px", marginLeft: 5, marginRight: 5, display: "inline-block",
            rotate: active ? "-1.5deg" : "0deg", scale: active ? "1.06" : "1",
            textShadow: active ? "none" : "3px 3px 0 #000,-3px 3px 0 #000,3px -3px 0 #000,-3px -3px 0 #000,0 6px 14px rgba(0,0,0,0.6)" }}>
            {t.text.trim()}</span>);
        })}
      </div>
    </AbsoluteFill>
  );
};

const Captions: React.FC<{ items: TimelineItem[] }> = ({ items }) => {
  const { fps } = useVideoConfig();
  const pages = useMemo(() => createTikTokStyleCaptions({ captions: buildCaptions(items), combineTokensWithinMilliseconds: SWITCH_MS }).pages, [items]);
  return (<AbsoluteFill>{pages.map((page, i) => {
    const next = pages[i + 1] ?? null;
    const start = (page.startMs / 1000) * fps;
    const end = next ? (next.startMs / 1000) * fps : start + fps * 3;
    if (end - start <= 0) return null;
    return (<Sequence key={i} from={Math.round(start)} durationInFrames={Math.round(end - start)}><CaptionPage page={page} /></Sequence>);
  })}</AbsoluteFill>);
};

// Рефрейм под «план»: wide/close/pov — имитация 3 камер из одного исходника
// Люди почти всегда в кадре — держим их целиком: только лёгкий дрейф-зум, без кропа
const SHOT: Record<string, { z0: number; z1: number; ox: number; oy: number }> = {
  wide:  { z0: 1.01, z1: 1.05, ox: 50, oy: 50 },
  close: { z0: 1.04, z1: 1.08, ox: 50, oy: 50 },
  pov:   { z0: 1.02, z1: 1.06, ox: 52, oy: 48 },
};

const SegmentVideo: React.FC<{ item: TimelineItem; accents?: Accent[] }> = ({ item, accents = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durF = msToFrame((item.toMs - item.fromMs) / item.rate);
  const s = SHOT[item.shot] ?? SHOT.wide;
  const baseZoom = interpolate(frame, [0, durF], [s.z0, s.z1], { extrapolateRight: "clamp", easing: Easing.linear });
  let punch = 0;
  const tMs = (frame / fps) * 1000 + item.globalStartMs;
  for (const a of accents) {
    if (tMs >= a.atMs - 400 && tMs <= a.atMs + a.durMs + 400) {
      const local = tMs - a.atMs; const m = a.mag ?? 0.12;
      punch = Math.max(punch, interpolate(local, [-400, 300, a.durMs - 200, a.durMs + 400], [0, m, m, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) }));
    }
  }
  const zoom = baseZoom + Math.min(punch, 0.05); // ограничиваем наезд, чтобы не срезать людей
  // первый сегмент стартует сразу на полной яркости — без проявления из чёрного
  const fadeIn = item.globalStartMs === 0 ? 1 : interpolate(frame, [0, msToFrame(XFADE_MS)], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durF - msToFrame(XFADE_MS), durF], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: Math.min(fadeIn, fadeOut) }}>
      <OffthreadVideo src={staticFile(`clips/${item.clip}.mp4`)} startFrom={msToFrame(item.fromMs)} playbackRate={item.rate} volume={item.volume}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${s.ox}% ${s.oy}%`, transform: `scale(${zoom})` }} />
    </AbsoluteFill>
  );
};

// Кино-оверлей: виньетка (эпик) + лёгкое зерно
const CineFrame: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* виньетка убрана — не затемняем кадр */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.045 }}>
        <filter id="rgrain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#rgrain)" />
      </svg>
    </AbsoluteFill>
  );
};

// 3 ключевые фразы — разные стили анимации, keyword жёлтым
const HeroPhrase: React.FC<{ hero: Hero }> = ({ hero }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durF = Math.round((hero.durMs / 1000) * PZ_FPS);
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 180, mass: 0.7 } });
  const out = interpolate(frame, [durF - 8, durF], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  let wrap: React.CSSProperties = { opacity: Math.min(1, enter) * out };
  let clip = "none";
  if (hero.anim === "slam") {
    wrap.transform = `scale(${interpolate(enter, [0, 1], [1.7, 1])}) rotate(${(1 - enter) * -3}deg)`;
  } else if (hero.anim === "slide") {
    wrap.transform = `translateX(${(1 - enter) * 120}%)`;
  } else { // wipe
    clip = `inset(0 ${(1 - enter) * 100}% 0 0)`;
    wrap.transform = `translateX(0)`;
  }

  const box: React.CSSProperties = {
    fontFamily, fontSize: 96, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", textAlign: "center",
    lineHeight: 0.98, color: "#fff", letterSpacing: "-0.01em", textShadow: "0 8px 30px rgba(0,0,0,0.7)", clipPath: clip,
  };
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none", paddingBottom: 120 }}>
      <div style={{ ...box, ...wrap }}>
        <div>{hero.pre}</div>
        <div style={{ display: "inline-block", marginTop: 8, background: "#FFE500", color: "#0a0a0a", padding: "6px 22px", borderRadius: 10, transform: "rotate(-2deg)", boxShadow: "0 10px 26px rgba(0,0,0,0.45)" }}>{hero.key}</div>
      </div>
    </AbsoluteFill>
  );
};

// Хук-обложка: эпичный интро-кадр
const SeriesCover: React.FC<{ series: Series }> = ({ series }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 13, stiffness: 150, mass: 0.8 } });
  const op = interpolate(frame, [0, 8, 62, 74], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none", opacity: op }}>
      {/* без чёрной заставки — хук поверх чистого кадра, читаемость за счёт обводки/тени */}
      <div style={{ textAlign: "center", transform: `translateY(${(1 - enter) * 40}px) scale(${interpolate(enter, [0, 1], [0.9, 1])})` }}>
        <div style={{ fontFamily, fontSize: 26, fontWeight: 800, letterSpacing: "0.34em", textTransform: "uppercase", color: "#FFE500", marginBottom: 20, textShadow: "0 2px 10px rgba(0,0,0,0.8), 2px 2px 0 #000" }}>{series.sub}</div>
        <div style={{ fontFamily, fontSize: 150, fontWeight: 900, fontStyle: "italic", color: "#fff", lineHeight: 0.9, textShadow: "4px 4px 0 rgba(0,0,0,0.55), -2px 2px 0 rgba(0,0,0,0.55), 0 14px 40px rgba(0,0,0,0.8)", textTransform: "uppercase" }}>
          {series.title.split("\n").map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div style={{ fontFamily, fontSize: 32, fontWeight: 900, textTransform: "uppercase", color: "#0a0a0a", background: "#FFE500", display: "inline-block", padding: "10px 26px", borderRadius: 12, marginTop: 26, rotate: "-2deg", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>🏖 ЗОНА ОТДЫХА</div>
      </div>
    </AbsoluteFill>
  );
};

// Co-brand плашки по углам
const Badges: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", top: 158, left: 40, fontFamily, fontSize: 25, fontWeight: 900, color: "#0a0a0a", background: "#FFE500", padding: "7px 15px", borderRadius: 11, textTransform: "uppercase", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>🏗 ДВА ПРОРАБА</div>
    <div style={{ position: "absolute", top: 158, right: 40, fontFamily, fontSize: 25, fontWeight: 900, color: "#0a0a0a", background: "#FFE500", padding: "7px 15px", borderRadius: 11, textTransform: "uppercase", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>📍 НОВОСИБИРСК</div>
  </AbsoluteFill>
);

const Sticker: React.FC<{ gif: GifDef }> = ({ gif }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 13, stiffness: 170, mass: 0.6 } });
  const durF = Math.round((gif.durMs / 1000) * PZ_FPS);
  const out = interpolate(frame, [durF - 8, durF], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = Math.min(enter, out);
  const size = gif.size ?? 220;
  const bob = Math.sin(frame / 6) * 7;
  const anchor: React.CSSProperties = (gif.pos === "bl") ? { left: 70, bottom: 360 } : (gif.pos === "tl") ? { left: 70, top: 300 } : { right: 70, top: 300 };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", ...anchor, width: size, opacity: op, transform: `translateY(${bob}px) scale(${enter})`, filter: "drop-shadow(0 10px 22px rgba(0,0,0,0.5))" }}>
        <Gif src={staticFile(`inserts/${gif.src}.gif`)} width={size} height={size} fit="contain" style={{ width: size, height: size }} />
        {gif.label ? <div style={{ marginTop: 6, textAlign: "center", fontFamily, fontSize: 28, fontWeight: 900, textTransform: "uppercase", color: "#0a0a0a", background: "#FFE500", display: "inline-block", padding: "5px 14px", borderRadius: 9 }}>{gif.label}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

const MUSIC_VOLUME = 0.10;

export const makePZ = (reel: ReelPlan) => {
  const { items, totalMs } = buildTimeline(reel);
  const duration = Math.ceil((totalMs / 1000) * PZ_FPS);
  const Reel: React.FC = () => (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {items.map((item, i) => (
        <Sequence key={i} from={msToFrame(item.globalStartMs)} durationInFrames={msToFrame((item.toMs - item.fromMs) / item.rate)}>
          <SegmentVideo item={item} accents={reel.accents} />
        </Sequence>
      ))}
      <Sequence><CineFrame /></Sequence>
      {reel.series ? <Sequence from={0} durationInFrames={90}><SeriesCover series={reel.series} /></Sequence> : null}
      <Sequence from={reel.series ? 90 : 0}><Badges /></Sequence>

      {(reel.gifs ?? []).map((gif, i) => (
        <Sequence key={`g-${i}`} from={msToFrame(gif.atMs)} durationInFrames={msToFrame(gif.durMs)}><Sticker gif={gif} /></Sequence>
      ))}

      {(reel.heroPhrases ?? []).map((h, i) => (
        <Sequence key={`h-${i}`} from={msToFrame(h.atMs)} durationInFrames={msToFrame(h.durMs)}><HeroPhrase hero={h} /></Sequence>
      ))}

      {items.map((item, i) => item.sfx ? (
        <Sequence key={`sfx-${i}`} from={Math.max(0, msToFrame(item.globalStartMs) - 2)} durationInFrames={80}>
          <Audio src={staticFile(`${item.sfx}.wav`)} volume={item.sfx === "riser" ? 0.4 : item.sfx === "impact" ? 0.55 : 0.5} />
        </Sequence>
      ) : null)}
      {(reel.sfxTrack ?? []).map((s, i) => (
        <Sequence key={`sx-${i}`} from={Math.max(0, msToFrame(s.atMs) - 2)} durationInFrames={80}><Audio src={staticFile(`${s.src}.wav`)} volume={s.vol ?? 0.5} /></Sequence>
      ))}

      <Sequence>
        <Audio src={staticFile(reel.music)} loop volume={(f) => interpolate(f, [0, 25, duration - 45, duration], [0, MUSIC_VOLUME, MUSIC_VOLUME, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      </Sequence>

      <Sequence><Captions items={items} /></Sequence>
    </AbsoluteFill>
  );
  return { id: reel.id, component: Reel, duration };
};

export const POOLZONE = REEL_PLANS.map(makePZ);
