import { Composition, staticFile } from "remotion";
import { getVideoMetadata } from "@remotion/media-utils";
import { ReelsCaption, ReelsCaptionProps } from "./ReelsCaption";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition<typeof ReelsCaption, ReelsCaptionProps>
      id="ReelsCaption"
      component={ReelsCaption}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={150}
      defaultProps={{ videoSrc: "", caption: "" }}
      calculateMetadata={async ({ props }) => {
        const { durationInSeconds } = await getVideoMetadata(
          staticFile(props.videoSrc),
        );
        return {
          durationInFrames: Math.max(1, Math.ceil(durationInSeconds * 30)),
        };
      }}
    />
  );
};
