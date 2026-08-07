import { Composition, staticFile } from "remotion";
import { getVideoMetadata } from "@remotion/media-utils";
import { ReelsCaption, ReelsCaptionProps } from "./ReelsCaption";
import { CapCutSubtitles, CapCutSubtitlesProps } from "./CapCutSubtitles";

const durationFromVideo = async (videoSrc: string) => {
  const { durationInSeconds } = await getVideoMetadata(staticFile(videoSrc));
  return Math.max(1, Math.ceil(durationInSeconds * 30));
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition<typeof ReelsCaption, ReelsCaptionProps>
        id="ReelsCaption"
        component={ReelsCaption}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={150}
        defaultProps={{ videoSrc: "", caption: "" }}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: await durationFromVideo(props.videoSrc),
        })}
      />
      <Composition<typeof CapCutSubtitles, CapCutSubtitlesProps>
        id="CapCutSubtitles"
        component={CapCutSubtitles}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={150}
        defaultProps={{ videoSrc: "", words: [] }}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: await durationFromVideo(props.videoSrc),
        })}
      />
    </>
  );
};
