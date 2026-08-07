import { Composition, Still } from "remotion";
import { REELS6, REELS6_FPS } from "./Reels6";
import { REELS7, REELS7_FPS } from "./Reels7";
import { REELS8, REELS8_FPS } from "./Reels8";
import { REELS9, REELS9_FPS } from "./Reels9";
import { REELS10, REELS10_FPS } from "./Reels10";
import { MotoReel, MOTO_DURATION, MOTO_FPS } from "./MotoReel";
import { CINEMA, CINEMA_FPS } from "./CinematicReel";
import { POOL4, POOL_FPS } from "./PoolSeries";
import { REMONT, REMONT_FPS } from "./RemontReel";
import { ANDREY, ANDREY_FPS } from "./AndreyReel";
import { TIHIE, TIHIE_FPS } from "./TihieReel";
import { BENTLEY2, BENTLEY2_FPS } from "./Bentley2Reel";
import { FLAG, FLAG_FPS } from "./FlagReel";
import { WakeReel, WAKE_DURATION, WAKE_FPS } from "./WakeReel";
import { POOL97, POOL97_FPS } from "./PoolReel";
import { POOLCLEAN, POOLCLEAN_FPS } from "./PoolCleanReel";
import { OV5, OV5_FPS } from "./OpenVillage5Reel";
import { SMARTWIN, SW_FPS } from "./SmartWindowReel";
import { SMARTWIN2, SW2_FPS } from "./SmartWindow2Reel";
import { RUSLAN, RUSLAN_FPS } from "./RuslanReel";
import { CURTAINS, CURT_FPS } from "./CurtainsReel";
import { POOLROBOT, PR_FPS } from "./PoolRobotReel";
import { POOLFULL, PF_FPS } from "./PoolFullReel";
import { POOLZONE, PZ_FPS } from "./PoolZoneReel";
import { REELS11, REELS11_FPS } from "./Reels11";
import { Reel, REEL_DURATION, REEL_FPS } from "./Reel";
import { Vlog, VLOG_DURATION, VLOG_FPS } from "./Vlog";
import { HighlightCover } from "./HighlightCover";
import { Reel1437, REEL1437_DURATION, REEL1437_FPS } from "./Reel1437";
import { BirthdayReel, BDAY_DURATION, BDAY_FPS } from "./BirthdayReel";
import { WishReel, WISH_DURATION, WISH_FPS } from "./WishReel";
import { ShanghaiTeaser, TEASER_DURATION, TEASER_FPS } from "./ShanghaiTeaser";

export const MyComposition = () => {
  return (
    <>
      {POOL4.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={POOL_FPS} width={1080} height={1920} />
      ))}
      {REMONT.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={REMONT_FPS} width={1080} height={1920} />
      ))}
      {ANDREY.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={ANDREY_FPS} width={1080} height={1920} />
      ))}
      {TIHIE.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={TIHIE_FPS} width={1080} height={1920} />
      ))}
      {BENTLEY2.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={BENTLEY2_FPS} width={1080} height={1920} />
      ))}
      {FLAG.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={FLAG_FPS} width={1080} height={1920} />
      ))}
      <Composition id="wake-nick" component={WakeReel} durationInFrames={WAKE_DURATION} fps={WAKE_FPS} width={1080} height={1920} />
      {POOL97.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={POOL97_FPS} width={1080} height={1920} />
      ))}
      {POOLCLEAN.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={POOLCLEAN_FPS} width={1080} height={1920} />
      ))}
      {OV5.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={OV5_FPS} width={1080} height={1920} />
      ))}
      {SMARTWIN.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={SW_FPS} width={1080} height={1920} />
      ))}
      {SMARTWIN2.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={SW2_FPS} width={1080} height={1920} />
      ))}
      {RUSLAN.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={RUSLAN_FPS} width={1080} height={1920} />
      ))}
      {CURTAINS.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={CURT_FPS} width={1080} height={1920} />
      ))}
      {POOLROBOT.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={PR_FPS} width={1080} height={1920} />
      ))}
      {POOLFULL.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={PF_FPS} width={1080} height={1920} />
      ))}
      {POOLZONE.map((r) => (
        <Composition key={r.id} id={r.id} component={r.component} durationInFrames={r.duration} fps={PZ_FPS} width={1080} height={1920} />
      ))}
      {REELS11.map((r) => (
        <Composition
          key={r.id}
          id={r.id}
          component={r.component}
          durationInFrames={r.duration}
          fps={REELS11_FPS}
          width={1080}
          height={1920}
        />
      ))}
      {CINEMA.map((r) => (
        <Composition
          key={r.id}
          id={r.id}
          component={r.component}
          durationInFrames={r.duration}
          fps={CINEMA_FPS}
          width={1080}
          height={1920}
        />
      ))}
      <Composition
        id="MotoReel"
        component={MotoReel}
        durationInFrames={MOTO_DURATION}
        fps={MOTO_FPS}
        width={1080}
        height={1920}
      />
      {REELS10.map((r) => (
        <Composition
          key={r.id}
          id={r.id}
          component={r.component}
          durationInFrames={r.duration}
          fps={REELS10_FPS}
          width={1080}
          height={1920}
        />
      ))}
      {REELS9.map((r) => (
        <Composition
          key={r.id}
          id={r.id}
          component={r.component}
          durationInFrames={r.duration}
          fps={REELS9_FPS}
          width={1080}
          height={1920}
        />
      ))}
      {REELS8.map((r) => (
        <Composition
          key={r.id}
          id={r.id}
          component={r.component}
          durationInFrames={r.duration}
          fps={REELS8_FPS}
          width={1080}
          height={1920}
        />
      ))}
      {REELS7.map((r) => (
        <Composition
          key={r.id}
          id={r.id}
          component={r.component}
          durationInFrames={r.duration}
          fps={REELS7_FPS}
          width={1080}
          height={1920}
        />
      ))}
      {REELS6.map((r) => (
        <Composition
          key={r.id}
          id={r.id}
          component={r.component}
          durationInFrames={r.duration}
          fps={REELS6_FPS}
          width={1080}
          height={1920}
        />
      ))}
      <Composition
        id="Reel"
        component={Reel}
        durationInFrames={REEL_DURATION}
        fps={REEL_FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Reel1437"
        component={Reel1437}
        durationInFrames={REEL1437_DURATION}
        fps={REEL1437_FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="ShanghaiTeaser"
        component={ShanghaiTeaser}
        durationInFrames={TEASER_DURATION}
        fps={TEASER_FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Wish"
        component={WishReel}
        durationInFrames={WISH_DURATION}
        fps={WISH_FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Birthday"
        component={BirthdayReel}
        durationInFrames={BDAY_DURATION}
        fps={BDAY_FPS}
        width={1080}
        height={1920}
      />
      <Still
        id="HighlightCover"
        component={HighlightCover}
        width={1080}
        height={1080}
      />
      <Composition
        id="Vlog"
        component={Vlog}
        durationInFrames={VLOG_DURATION}
        fps={VLOG_FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
