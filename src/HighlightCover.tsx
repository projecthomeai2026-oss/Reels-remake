import { AbsoluteFill } from "remotion";

// Обложка для актуального в Instagram. Кадрируется в круг по центру —
// вся графика держится в центральной трети.
export const HighlightCover: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #1d7f7c 0%, #14555c 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div style={{ fontSize: 340, lineHeight: 1 }}>🏗</div>
        <div
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 800,
            fontSize: 86,
            letterSpacing: 10,
            color: "#ffffff",
          }}
        >
          СТРОЙКА
        </div>
      </div>
    </AbsoluteFill>
  );
};
