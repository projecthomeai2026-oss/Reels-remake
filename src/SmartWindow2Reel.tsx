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
  spring,
} from "remotion";
import { useMemo } from "react";
import {
  createTikTokStyleCaptions,
  type Caption,
  type TikTokPage,
} from "@remotion/captions";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import { Gif } from "@remotion/gif";
import plan from "./r8195-plan.json";

const { fontFamily } = loadFont("normal", {
  weights: ["600", "700", "800", "900"],
  subsets: ["cyrillic", "latin"],
});

export const SW2_FPS = 30;

type Word = { text: string; startMs: number; endMs: number };
type PlanItem = {
  clip: string; fromMs: number; toMs: number; rate: number; volume: number;
  slow: boolean; sfx: string | null; captionToMs: number | null;
};
type Series = { title: string; location: string; sub?: string };
type Accent = { atMs: number; durMs: number; mag?: number };
type GifDef = { src: string; atMs: number; durMs: number; mode: "waterfall" | "arrow" | "weather" | "card" | "sticker"; label?: string; pos?: "bl" | "br" | "tr" | "tl" | "center"; size?: number };
type ReelPlan = { id: string; title: string; music: string; items: PlanItem[]; series?: Series; accents?: Accent[]; gifs?: GifDef[] };
type TimelineItem = PlanItem & { globalStartMs: number };

const WORDS = plan.words as Record<string, Word[]>;
const REEL_PLANS = plan.reels as ReelPlan[];
const msToFrame = (ms: number) => Math.round((ms / 1000) * SW2_FPS);
const CAPTION_DELAY_MS = 0;
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

// Кино-грейд + медленный дрейф-зум + акцентные зум-панчи
const SegmentVideo: React.FC<{ item: TimelineItem; accents?: Accent[] }> = ({ item, accents = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durF = msToFrame((item.toMs - item.fromMs) / item.rate);
  const baseZoom = interpolate(frame, [0, durF], [item.slow ? 1.05 : 1.08, item.slow ? 1.16 : 1.14], { extrapolateRight: "clamp", easing: Easing.linear });
  // акцентный punch: плавный наезд на время акцента, потом отъезд
  let punch = 0;
  const tMs = (frame / fps) * 1000 + item.globalStartMs;
  for (const a of accents) {
    if (tMs >= a.atMs - 400 && tMs <= a.atMs + a.durMs + 400) {
      const local = tMs - a.atMs;
      const m = a.mag ?? 0.12; punch = Math.max(punch, interpolate(local, [-400, 300, a.durMs - 200, a.durMs + 400], [0, m, m, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) }));
    }
  }
  const zoom = baseZoom + punch;
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
    </AbsoluteFill>
  );
};

// Обложка-заставка серии: фирменный интро-кадр (превью каждого рилса).
// Держится в начале ~2.8с, затем плавно уходит; в углу весь ролик — маркер «N/4».
const SeriesCover: React.FC<{ series: Series }> = ({ series }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 160, mass: 0.7 } });
  const op = interpolate(frame, [0, 8, 62, 74], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none", opacity: op }}>
      {/* затемняющая подложка для читаемости хука */}
      <AbsoluteFill style={{ background: "rgba(0,0,0,0.5)" }} />
      <div style={{ textAlign: "center", transform: `translateY(${(1 - enter) * 40}px) scale(${interpolate(enter, [0, 1], [0.92, 1])})` }}>
        <div style={{ fontFamily, fontSize: 26, fontWeight: 800, letterSpacing: "0.36em", textTransform: "uppercase", color: "rgba(255,255,255,0.9)", marginBottom: 22 }}>
          {series.sub ?? "Стройка без прикрас"}
        </div>
        <div style={{ fontFamily, fontSize: 118, fontWeight: 900, fontStyle: "italic", color: "#fff", lineHeight: 0.92, textShadow: "0 10px 40px rgba(0,0,0,0.6)", textTransform: "uppercase" }}>
          {series.title.split("\n").map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div style={{
          fontFamily, fontSize: 46, fontWeight: 900, textTransform: "uppercase", color: "#111",
          background: "#FFDD00", display: "inline-block", padding: "12px 32px", borderRadius: 16,
          marginTop: 34, rotate: "-2deg", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          📍 {series.location}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Маркер серии в углу на весь ролик
const SeriesBadge: React.FC<{ series: Series }> = ({ series }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{
      position: "absolute", top: 158, left: 40, fontFamily, fontSize: 26, fontWeight: 900,
      color: "#111", background: "#FFDD00", padding: "7px 16px", borderRadius: 12,
      textTransform: "uppercase", letterSpacing: "0.02em",
      boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
    }}>
      🏗 ДВА ПРОРАБА
    </div>
    <div style={{
      position: "absolute", top: 158, right: 40, fontFamily, fontSize: 26, fontWeight: 900,
      color: "#111", background: "#FFDD00", padding: "7px 16px", borderRadius: 12,
      textTransform: "uppercase", letterSpacing: "0.02em",
      boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
    }}>
      📍 {series.location}
    </div>
  </AbsoluteFill>
);

// Вставка гифки поверх видео: водопад — крупная карточка сверху; стрелка — указатель
const GifOverlay: React.FC<{ gif: GifDef }> = ({ gif }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 13, stiffness: 170, mass: 0.6 } });
  const durF = Math.round((gif.durMs / 1000) * SW2_FPS);
  const out = interpolate(frame, [durF - 8, durF], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = Math.min(enter, out);

  if (gif.mode === "waterfall") {
    return (
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 300, pointerEvents: "none" }}>
        <div style={{ opacity: op, transform: `translateY(${(1 - enter) * -40}px) scale(${interpolate(enter, [0, 1], [0.85, 1])}) rotate(-2deg)` }}>
          <div style={{ position: "relative", width: 560, height: 440, borderRadius: 22, overflow: "hidden", border: "5px solid #fff", boxShadow: "0 16px 50px rgba(0,0,0,0.55)" }}>
            <OffthreadVideo src={staticFile(`inserts/${gif.src}.mp4`)} loop muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          {gif.label ? (
            <div style={{ marginTop: 14, textAlign: "center", fontFamily, fontSize: 40, fontWeight: 900, textTransform: "uppercase", color: "#111", background: "#FFDD00", display: "inline-block", padding: "8px 24px", borderRadius: 14, boxShadow: "0 6px 18px rgba(0,0,0,0.4)" }}>
              {gif.label}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    );
  }
  // weather — снег/дождь на весь экран (чёрный фон → screen убирает его)
  if (gif.mode === "weather") {
    return (
      <AbsoluteFill style={{ pointerEvents: "none", opacity: op * 0.9, mixBlendMode: "screen" }}>
        <OffthreadVideo src={staticFile(`inserts/${gif.src}.mp4`)} loop muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    );
  }
  // card — цветная гифка карточкой (мем), сбоку сверху
  if (gif.mode === "card") {
    return (
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 300, paddingRight: 40, pointerEvents: "none" }}>
        <div style={{ opacity: op, transform: `scale(${interpolate(enter, [0, 1], [0.7, 1])}) rotate(3deg)` }}>
          <div style={{ width: 320, height: 250, borderRadius: 18, overflow: "hidden", border: "4px solid #fff", boxShadow: "0 12px 36px rgba(0,0,0,0.5)" }}>
            <OffthreadVideo src={staticFile(`inserts/${gif.src}.mp4`)} loop muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          {gif.label ? (
            <div style={{ marginTop: 10, textAlign: "center", fontFamily, fontSize: 30, fontWeight: 900, textTransform: "uppercase", color: "#111", background: "#FFDD00", display: "inline-block", padding: "6px 16px", borderRadius: 10 }}>
              {gif.label}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    );
  }
  // sticker — прозрачный .gif-стикер (через @remotion/gif), всплывает с «пружиной»
  if (gif.mode === "sticker") {
    const size = gif.size ?? 260;
    const pos = gif.pos ?? "br";
    const bob = Math.sin(frame / 6) * 8;
    const anchor: React.CSSProperties =
      pos === "bl" ? { left: 70, bottom: 340 } :
      pos === "br" ? { right: 70, bottom: 340 } :
      pos === "tl" ? { left: 70, top: 300 } :
      pos === "tr" ? { right: 70, top: 300 } :
      { left: "50%", top: "44%", marginLeft: -size / 2 };
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div style={{ position: "absolute", ...anchor, width: size, opacity: op, transform: `translateY(${bob}px) scale(${enter}) rotate(${(1 - enter) * -8}deg)`, filter: "drop-shadow(0 10px 22px rgba(0,0,0,0.45))" }}>
          <Gif src={staticFile(`inserts/${gif.src}.gif`)} width={size} height={size} fit="contain" style={{ width: size, height: size }} />
          {gif.label ? (
            <div style={{ marginTop: 6, textAlign: "center", fontFamily, fontSize: 30, fontWeight: 900, textTransform: "uppercase", color: "#111", background: "#FFDD00", display: "inline-block", padding: "6px 16px", borderRadius: 10, boxShadow: "0 6px 18px rgba(0,0,0,0.4)" }}>
              {gif.label}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    );
  }
  // arrow — указатель сбоку, слегка «дышит»
  const bob = Math.sin(frame / 4) * 10;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 120, top: 620, width: 200, height: 200, opacity: op, transform: `translateY(${bob}px) scale(${enter})` }}>
        <OffthreadVideo src={staticFile(`inserts/${gif.src}.mp4`)} loop muted style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
    </AbsoluteFill>
  );
};

const MUSIC_VOLUME = 0.09;

export const makeSW2 = (reel: ReelPlan) => {
  const { items, totalMs } = buildTimeline(reel);
  const duration = Math.ceil((totalMs / 1000) * SW2_FPS);
  const Reel: React.FC = () => (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {items.map((item, i) => (
        <Sequence key={i} from={msToFrame(item.globalStartMs)} durationInFrames={msToFrame((item.toMs - item.fromMs) / item.rate)} name={`${item.clip} ${(item.fromMs / 1000).toFixed(0)}s`}>
          <SegmentVideo item={item} accents={reel.accents} />
        </Sequence>
      ))}
      <Sequence name="cine-frame"><CineFrame /></Sequence>
      {reel.series ? (
        <>
          <Sequence from={0} durationInFrames={90} name="series-cover"><SeriesCover series={reel.series} /></Sequence>
          <Sequence from={90} name="series-badge"><SeriesBadge series={reel.series} /></Sequence>
        </>
      ) : null}

      {(reel.gifs ?? []).map((gif, i) => (
        <Sequence key={`gif-${i}`} from={msToFrame(gif.atMs)} durationInFrames={msToFrame(gif.durMs)} name={`gif ${gif.mode}`}>
          <GifOverlay gif={gif} />
        </Sequence>
      ))}

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

export const SMARTWIN2 = REEL_PLANS.map(makeSW2);
