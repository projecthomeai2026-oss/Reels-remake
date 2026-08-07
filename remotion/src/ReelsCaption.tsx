import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

export type ReelsCaptionProps = {
  videoSrc: string;
  caption: string;
};

export const ReelsCaption: React.FC<ReelsCaptionProps> = ({
  videoSrc,
  caption,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <OffthreadVideo src={staticFile(videoSrc)} />
      {caption ? (
        <AbsoluteFill
          style={{
            justifyContent: "flex-end",
            alignItems: "center",
            paddingBottom: 160,
          }}
        >
          <div
            style={{
              fontFamily: "sans-serif",
              fontSize: 56,
              fontWeight: 700,
              color: "white",
              textAlign: "center",
              padding: "12px 24px",
              backgroundColor: "rgba(0,0,0,0.45)",
              borderRadius: 16,
              maxWidth: "85%",
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}
          >
            {caption}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
