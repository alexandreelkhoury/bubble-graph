import React from 'react';
import {AbsoluteFill, Composition, Folder, Img, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {C} from '../brand';
import {FONT} from '../parts';
import {FPS, spr, SNAPPY} from '../time';
import {VO_ENABLED} from '../vo-config';
import {AD_H, AD_W, AdBg, AdSound, Hit, SafeGuide, SAFE, VoLine} from './common';
import {EC_FRAMES, EcMode, ecHits, EndCard, Lang} from './EndCard';
import * as M1 from './M1';
import * as M2 from './M2';
import * as M3 from './M3';
import * as M4 from './M4';
import * as M5 from './M5';
import * as M6 from './M6';
import * as M7 from './M7';

type AdProps = {blur: number; guide: boolean};

/**
 * Brand + category from frame 0 (DECISIONS.md #6): "Mish Ana! · party game for your TV", top-left inside the safe
 * zone, for the whole body (the end card carries the full logo).
 */
const BrandChip: React.FC<{lang: Lang}> = ({lang}) => {
  const f = useCurrentFrame();
  const k = spr(f, -30, SNAPPY);
  return (
    <div style={{position: 'absolute', top: SAFE.top + 6, left: SAFE.left, right: AD_W - SAFE.right, display: 'flex',
      justifyContent: lang === 'ar' ? 'flex-end' : 'flex-start', zIndex: 95, pointerEvents: 'none', transform: `translateY(${(1 - k) * -40}px)`}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px 8px 10px', borderRadius: 999, background: 'rgba(20,9,40,0.55)',
        border: '1.5px solid rgba(255,247,236,0.18)', fontFamily: FONT, fontWeight: 800, fontSize: 30, color: C.text, direction: lang === 'ar' ? 'rtl' : 'ltr'}}>
        <Img src={staticFile('mark.svg')} style={{width: 44, height: 44, borderRadius: 10}} />
        {lang === 'ar' ? <span>مش أنا! · <span style={{color: C.text2, fontWeight: 700}}>لعبة سهرات للتلفزيون</span></span>
          : <span>Mish Ana! · <span style={{color: C.text2, fontWeight: 700}}>party game for your TV</span></span>}
      </div>
    </div>
  );
};

type AdModule = {Body: React.FC; frames: number; hits: Hit[]; vo: VoLine[]};

/** An ad = its body (+ brand chip), then the shared end card on the next frame, one music bed under both. */
const makeAd = ({Body, frames, hits, vo}: AdModule, lang: Lang, mode: EcMode) => {
  const total = frames + EC_FRAMES;
  const voLines = VO_ENABLED ? vo.filter((l) => l.src) : [];
  const Ad: React.FC<AdProps> = ({blur, guide}) => {
    const visual = (
      <AbsoluteFill>
        <AdBg />
        <Sequence durationInFrames={frames} layout="none"><Body /><BrandChip lang={lang} /></Sequence>
        <Sequence from={frames} layout="none"><EndCard lang={lang} mode={mode} /></Sequence>
      </AbsoluteFill>
    );
    return (
      <AbsoluteFill style={{overflow: 'hidden'}}>
        {blur > 1 ? <CameraMotionBlur samples={blur} shutterAngle={120}>{visual}</CameraMotionBlur> : visual}
        <AdSound hits={[...hits, ...ecHits(frames, mode)]} duration={total} vo={voLines} />
        <SafeGuide on={guide} />
      </AbsoluteFill>
    );
  };
  return {Ad, total};
};

const mod = (m: {[k: string]: unknown}, n: string): AdModule => ({
  Body: m[`${n}Body`] as React.FC,
  frames: m[`${n}_BODY_FRAMES`] as number,
  hits: (m[`${n}_HITS`] as Hit[]) ?? [],
  vo: (m[`${n}_VO`] as VoLine[]) ?? [],
});

const ADS: Array<{id: string; m: AdModule; lang: Lang}> = [
  {id: 'MA-A-M1-PIZZA', m: mod(M1, 'M1'), lang: 'en'},
  {id: 'MA-E-M2-HOW-IT-WORKS', m: mod(M2, 'M2'), lang: 'en'},
  {id: 'MA-C-M3-SPOT-THE-MOLE', m: mod(M3, 'M3'), lang: 'en'},
  {id: 'MA-B-M4-PASS-THE-PHONE', m: mod(M4, 'M4'), lang: 'en'},
  {id: 'MA-D-M5-TONIGHT', m: mod(M5, 'M5'), lang: 'en'},
  {id: 'MA-F-M6-AR-FAMILY', m: mod(M6, 'M6'), lang: 'ar'},
  {id: 'MA-G-M7-TEAM-PARTY', m: mod(M7, 'M7'), lang: 'en'},
];

const EcOnly = (lang: Lang, mode: EcMode): React.FC<AdProps> => ({guide}) => (
  <AbsoluteFill><AdBg /><EndCard lang={lang} mode={mode} /><AdSound hits={ecHits(0, mode)} duration={EC_FRAMES} /><SafeGuide on={guide} /></AbsoluteFill>
);

export const AdCompositions: React.FC = () => (
  <>
    <Folder name="Ads-9x16-prelaunch">
      {(['en', 'ar'] as const).map((l) => (
        <Composition key={l} id={`EC-${l.toUpperCase()}`} component={EcOnly(l, 'prelaunch')} durationInFrames={EC_FRAMES} fps={FPS} width={AD_W} height={AD_H}
          defaultProps={{blur: 0, guide: false}} />
      ))}
      {ADS.map((a) => {
        const {Ad, total} = makeAd(a.m, a.lang, 'prelaunch');
        return <Composition key={a.id} id={a.id} component={Ad} durationInFrames={total} fps={FPS} width={AD_W} height={AD_H} defaultProps={{blur: 0, guide: false}} />;
      })}
    </Folder>
    <Folder name="Ads-9x16-live">
      {(['en', 'ar'] as const).map((l) => (
        <Composition key={l} id={`EC-${l.toUpperCase()}-LIVE`} component={EcOnly(l, 'live')} durationInFrames={EC_FRAMES} fps={FPS} width={AD_W} height={AD_H}
          defaultProps={{blur: 0, guide: false}} />
      ))}
      {ADS.map((a) => {
        const {Ad, total} = makeAd(a.m, a.lang, 'live');
        return <Composition key={a.id} id={`${a.id}-LIVE`} component={Ad} durationInFrames={total} fps={FPS} width={AD_W} height={AD_H} defaultProps={{blur: 0, guide: false}} />;
      })}
    </Folder>
  </>
);
