import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

export const REEL_FPS = 30;
export const REEL_DURATION = 13 * REEL_FPS; // 13 seconds

const SCENE_1 = 4 * REEL_FPS; // 0-4s
const SCENE_2 = 4 * REEL_FPS; // 4-8s
const SCENE_3 = REEL_DURATION - SCENE_1 - SCENE_2; // 8-13s

const CAPTION =
  "Когда нашёл желающего купить твой объект в 2026 г. за наличку";

// Photo filling the frame with a slow push-in (Ken Burns)
const Photo: React.FC<{
  src: string;
  zoomFrom: number;
  zoomTo: number;
  duration: number;
}> = ({ src, zoomFrom, zoomTo, duration }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          scale: String(
            interpolate(frame, [0, duration], [zoomFrom, zoomTo], {
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            }),
          ),
        }}
      />
    </AbsoluteFill>
  );
};

// Instagram-style meme caption: white rounded box, black text
const Caption: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 560,
        paddingLeft: 80,
        paddingRight: 80,
      }}
    >
      <Interactive.Div
        name="Meme caption"
        style={{
          backgroundColor: "#FFFFFF",
          color: "#000000",
          fontFamily:
            "-apple-system, 'Helvetica Neue', Arial, sans-serif",
          fontSize: 52,
          fontWeight: 600,
          lineHeight: 1.35,
          textAlign: "center",
          padding: "28px 36px",
          borderRadius: 18,
          maxWidth: 860,
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: String(
            interpolate(frame, [0, 14], [0.85, 1], {
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.34, 1.56, 0.64, 1),
            }),
          ),
        }}
      >
        {CAPTION}
      </Interactive.Div>
    </AbsoluteFill>
  );
};

// Quick white flash between cuts
const CutFlash: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        opacity: interpolate(frame, [0, 5], [0.65, 0], {
          extrapolateRight: "clamp",
        }),
        pointerEvents: "none",
      }}
    />
  );
};

export const Reel: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <Sequence name="Scene 1 — sunglasses" durationInFrames={SCENE_1}>
        <Photo
          src={staticFile("photo1.jpg")}
          zoomFrom={1}
          zoomTo={1.12}
          duration={SCENE_1}
        />
      </Sequence>

      <Sequence name="Scene 2 — stare" from={SCENE_1} durationInFrames={SCENE_2}>
        <Photo
          src={staticFile("photo2.jpg")}
          zoomFrom={1.15}
          zoomTo={1.02}
          duration={SCENE_2}
        />
        <CutFlash />
      </Sequence>

      <Sequence name="Scene 3 — welcome" from={SCENE_1 + SCENE_2} durationInFrames={SCENE_3}>
        <Photo
          src={staticFile("photo3.jpg")}
          zoomFrom={1}
          zoomTo={1.18}
          duration={SCENE_3}
        />
        <CutFlash />
      </Sequence>

      <Sequence name="Caption">
        <Caption />
      </Sequence>
    </AbsoluteFill>
  );
};
