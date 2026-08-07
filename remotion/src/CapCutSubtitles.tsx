import {
  AbsoluteFill,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type Word = { text: string; start: number; end: number };

export type CapCutSubtitlesProps = {
  videoSrc: string;
  words: Word[];
};

const WORDS_PER_LINE = 4;
const HIGHLIGHT_COLOR = "#39FF14";

function groupIntoLines(words: Word[]): Word[][] {
  const lines: Word[][] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
    lines.push(words.slice(i, i + WORDS_PER_LINE));
  }
  return lines;
}

const WordSpan: React.FC<{ word: Word; t: number; frame: number; fps: number }> = ({
  word,
  t,
  frame,
  fps,
}) => {
  const isActive = t >= word.start && t < word.end;
  const bump = spring({
    frame: frame - Math.round(word.start * fps),
    fps,
    config: { damping: 14, stiffness: 200 },
    durationInFrames: 8,
  });
  const scale = isActive ? 1 + bump * 0.25 : 1;

  return (
    <span
      style={{
        color: isActive ? HIGHLIGHT_COLOR : "white",
        transform: `scale(${scale})`,
        display: "inline-block",
      }}
    >
      {word.text}
    </span>
  );
};

export const CapCutSubtitles: React.FC<CapCutSubtitlesProps> = ({
  videoSrc,
  words,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const lines = groupIntoLines(words);
  const activeLine = lines.find(
    (line) => t >= line[0].start && t < line[line.length - 1].end,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <OffthreadVideo src={staticFile(videoSrc)} />
      {activeLine ? (
        <AbsoluteFill
          style={{
            justifyContent: "flex-end",
            alignItems: "center",
            paddingBottom: 220,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0 14px",
              maxWidth: "90%",
              fontFamily: "sans-serif",
              fontSize: 58,
              fontWeight: 800,
              textAlign: "center",
              textShadow: "0 3px 10px rgba(0,0,0,0.9)",
            }}
          >
            {activeLine.map((word, i) => (
              <WordSpan key={i} word={word} t={t} frame={frame} fps={fps} />
            ))}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
