import React from 'react';
import {AbsoluteFill, Composition, Folder, Sequence} from 'remotion';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {FPS} from '../time';
import {AD_H, AD_W, AdBg, AdSound, Hit, SafeGuide} from './common';
import {EC_FRAMES, ecHits, EndCard, Lang} from './EndCard';
import {M1_BODY_FRAMES, M1_HITS, M1Body} from './M1';
import {M2_BODY_FRAMES, M2_HITS, M2Body} from './M2';
import {M3_BODY_FRAMES, M3_HITS, M3Body} from './M3';
import {M4_BODY_FRAMES, M4_HITS, M4Body} from './M4';
import {M5_BODY_FRAMES, M5_HITS, M5Body} from './M5';
import {M6_BODY_FRAMES, M6_HITS, M6Body} from './M6';

type AdProps = {blur: number; guide: boolean};

/** An ad = its body, then the shared end card on the next frame, one music bed under both. */
const makeAd = (Body: React.FC, bodyFrames: number, hits: Hit[], lang: Lang = 'en') => {
  const total = bodyFrames + EC_FRAMES;
  const Ad: React.FC<AdProps> = ({blur, guide}) => {
    const visual = (
      <AbsoluteFill>
        <AdBg />
        <Sequence durationInFrames={bodyFrames} layout="none"><Body /></Sequence>
        <Sequence from={bodyFrames} layout="none"><EndCard lang={lang} /></Sequence>
      </AbsoluteFill>
    );
    return (
      <AbsoluteFill style={{overflow: 'hidden'}}>
        {blur > 1 ? <CameraMotionBlur samples={blur} shutterAngle={180}>{visual}</CameraMotionBlur> : visual}
        <AdSound hits={[...hits, ...ecHits(bodyFrames)]} duration={total} />
        <SafeGuide on={guide} />
      </AbsoluteFill>
    );
  };
  return {Ad, total};
};

const ADS = [
  {id: 'MA-A-M1-PIZZA', ...makeAd(M1Body, M1_BODY_FRAMES, M1_HITS)},
  {id: 'MA-E-M2-CHECKLIST', ...makeAd(M2Body, M2_BODY_FRAMES, M2_HITS)},
  {id: 'MA-C-M3-SPOT-THE-MOLE', ...makeAd(M3Body, M3_BODY_FRAMES, M3_HITS)},
  {id: 'MA-B-M4-PASS-THE-PHONE', ...makeAd(M4Body, M4_BODY_FRAMES, M4_HITS)},
  {id: 'MA-D-M5-TONIGHT', ...makeAd(M5Body, M5_BODY_FRAMES, M5_HITS)},
  {id: 'MA-F-M6-AR-FAMILY', ...makeAd(M6Body, M6_BODY_FRAMES, M6_HITS, 'ar')},
];

const EcOnly: React.FC<AdProps> = ({guide}) => (
  <AbsoluteFill><AdBg /><EndCard /><AdSound hits={ecHits(0)} duration={EC_FRAMES} /><SafeGuide on={guide} /></AbsoluteFill>
);

const EcOnlyAr: React.FC<AdProps> = ({guide}) => (
  <AbsoluteFill><AdBg /><EndCard lang="ar" /><AdSound hits={ecHits(0)} duration={EC_FRAMES} /><SafeGuide on={guide} /></AbsoluteFill>
);

export const AdCompositions: React.FC = () => (
  <Folder name="Ads-9x16">
    <Composition id="EC-AR" component={EcOnlyAr} durationInFrames={EC_FRAMES} fps={FPS} width={AD_W} height={AD_H} defaultProps={{blur: 0, guide: false}} />
    <Composition id="EC-EN" component={EcOnly} durationInFrames={EC_FRAMES} fps={FPS} width={AD_W} height={AD_H} defaultProps={{blur: 0, guide: false}} />
    {ADS.map((a) => (
      <Composition key={a.id} id={a.id} component={a.Ad} durationInFrames={a.total} fps={FPS} width={AD_W} height={AD_H} defaultProps={{blur: 0, guide: false}} />
    ))}
  </Folder>
);
