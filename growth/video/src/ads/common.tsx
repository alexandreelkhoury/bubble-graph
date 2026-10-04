import React from 'react';
import {interpolate, Sequence, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import peaks from '../sfx-peaks.json';
import {C} from '../brand';
import {FONT, Words} from '../parts';
import {b, easeIn, FPS, prog, SPB} from '../time';

// Ads start exactly on the song's drop (song beat 59 = 28.917 s): full energy from frame 0.
// Ad beat k = song beat 59 + k. Beats 0..31 stay high-energy (the track dips after song beat 91).
export const AD_MUSIC_TRIM = Math.round((0.318 + 59 * SPB) * FPS);
export const AD_W = 1080;
export const AD_H = 1920;
/** Platform safe zone for 9:16 (TikTok / Reels UI): keep text and key action inside. */
export const SAFE = {top: 150, bottom: 1620, left: 60, right: 960};
export const SAFE_CX = (SAFE.left + SAFE.right) / 2; // 510: centre of the safe zone, not of the frame

export type SfxName = keyof typeof peaks;
export type Hit = {at: number; sfx: SfxName; vol?: number; max?: number};

/** Music bed from the drop + SFX placed so each measured peak lands on `at` (frames). */
export const AdSound: React.FC<{hits: Hit[]; duration: number; music?: number}> = ({hits, duration, music = 0.75}) => (
  <>
    <Audio
      src={staticFile('music/take-this-higher.mp3')}
      trimBefore={AD_MUSIC_TRIM}
      volume={(f) => music * interpolate(f, [duration - 20, duration - 1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
    />
    {hits.map((h, i) => {
      const p = peaks[h.sfx];
      const from = Math.max(0, Math.round(h.at - p.peak * FPS));
      const len = Math.min(Math.round(p.dur * FPS), h.max ?? 9999);
      return (
        <Sequence key={i} from={from} durationInFrames={len} layout="none">
          <Audio src={staticFile(`sfx/${h.sfx}.mp3`)} volume={h.vol ?? 0.7} />
        </Sequence>
      );
    })}
  </>
);

/**
 * Burned-in caption (SCRIPTS.md style): Cairo 900, cream with a violet stroke, *hot* words in magenta/amber.
 * Centred on the safe zone at `y` (frame px). Words rise from a mask line on `start`, leave on `end`.
 */
export const AdCaption: React.FC<{f: number; text: string; y: number; start: number; end?: number; size?: number; step?: number; accent?: string; rtl?: boolean}> = ({
  f, text, y, start, end, size = 78, step = b(0.12), accent = C.accent, rtl,
}) => (
  <div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: y - size, height: size * 2, display: 'flex', alignItems: 'center',
    justifyContent: 'center', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.04, color: C.text, zIndex: 90,
    letterSpacing: rtl ? 0 : '-0.01em', WebkitTextStroke: `${size * 0.075}px ${C.bg}`, paintOrder: 'stroke fill', direction: rtl ? 'rtl' : 'ltr'}}>
    {/* Arabic marks (dots, shadda) sit far above/below the line: give the rise mask more room */}
    <Words f={f} text={text} start={start} step={step} end={end} accent={accent} pad={rtl ? 0.45 : undefined} />
  </div>
);

/** Toggle-only overlay to check the safe zone in Studio (never on in renders). */
export const SafeGuide: React.FC<{on: boolean}> = ({on}) =>
  on ? (
    <div style={{position: 'absolute', left: SAFE.left, top: SAFE.top, width: SAFE.right - SAFE.left, height: SAFE.bottom - SAFE.top,
      outline: '3px dashed rgba(0,255,200,0.8)', zIndex: 999, pointerEvents: 'none'}} />
  ) : null;

export const AdBg: React.FC = () => (
  <div style={{position: 'absolute', inset: 0, background: `radial-gradient(120% 70% at 50% 0%, #22103A 0%, ${C.bg} 55%, ${C.bgDeep} 100%)`}} />
);

/**
 * Seamless hand-off to the end card: the ad background floods out of (x, y) and covers everything in ~0.35 s.
 * Put it last in a body with start = BODY_FRAMES - 22 so the body's final frame is exactly the end card's backdrop.
 */
export const BgFlood: React.FC<{f: number; start: number; x: number; y: number}> = ({f, start, x, y}) => {
  if (f < start) return null;
  const R = Math.hypot(Math.max(x, AD_W - x), Math.max(y, AD_H - y)) * 1.05;
  const r = R * prog(f, start, start + 21, easeIn);
  return (
    <div style={{position: 'absolute', inset: 0, zIndex: 200, clipPath: `circle(${r}px at ${x}px ${y}px)`}}>
      <AdBg />
    </div>
  );
};
