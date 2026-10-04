import React from 'react';
import {interpolate, Sequence, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import peaks from '../sfx-peaks.json';
import {C} from '../brand';
import {StageBg} from '../bg';
import {FONT, Words} from '../parts';
import {b, clamp, easeIn, FPS, prog, SPB} from '../time';

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
/** A voiceover line: an audio file in public/ (e.g. 'vo/m1-en-01.mp3'), placed at frame `at`, lasting `dur` frames. */
export type VoLine = {at: number; dur: number; src?: string};

/**
 * Reading rule (DECISIONS.md #3): a caption stays ≥ 1.2 s (key lines ≥ 1.8 s), and longer lines get
 * 0.5 s + 0.3 s per word. Returns frames. Use it for `end - start` of every AdCaption.
 */
export const holdFrames = (words: number, key = false) => Math.round(FPS * Math.max(key ? 1.8 : 1.2, 0.5 + 0.3 * words));

const POPS = new Set<SfxName>(['pop_a', 'pop_b', 'pop_hard']);
const PITCH = [0.94, 1, 1.06];

/** Music gain multiplier under the voiceover: −9 dB (×0.35), 6-frame attack starting 4 frames early, 18-frame release. */
const duckAt = (f: number, vo: VoLine[]) => {
  let g = 1;
  for (const l of vo) {
    const a0 = l.at - 4 - 6, a1 = l.at - 4, r0 = l.at + l.dur, r1 = r0 + 18;
    if (f < a0 || f > r1) continue;
    const k = f < a1 ? (f - a0) / 6 : f <= r0 ? 1 : 1 - (f - r0) / 18;
    g = Math.min(g, 1 - 0.65 * clamp(k));
  }
  return g;
};

/**
 * Music bed from the drop + SFX placed so each measured peak lands on `at` (frames) + optional voiceover.
 * v2 mix (DECISIONS.md #10): music 0.5, ducked −9 dB under VO, pops at most 0.45 with alternating pitch (−6 dB more
 * under VO), music fades out over the last 54 frames.
 */
export const AdSound: React.FC<{hits: Hit[]; duration: number; music?: number; vo?: VoLine[]}> = ({hits, duration, music = 0.5, vo = []}) => {
  let popIndex = 0;
  return (
    <>
      <Audio
        src={staticFile('music/take-this-higher.mp3')}
        trimBefore={AD_MUSIC_TRIM}
        volume={(f) => music * duckAt(f, vo) * interpolate(f, [duration - 54, duration - 1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
      {hits.map((h, i) => {
        const p = peaks[h.sfx];
        const from = Math.max(0, Math.round(h.at - p.peak * FPS));
        const len = Math.min(Math.round(p.dur * FPS), h.max ?? 9999);
        const pop = POPS.has(h.sfx);
        const underVo = vo.some((l) => h.at >= l.at - 4 && h.at <= l.at + l.dur);
        const vol = (pop ? Math.min(h.vol ?? 0.45, 0.45) : h.vol ?? 0.7) * (pop && underVo ? 0.5 : 1);
        return (
          <Sequence key={i} from={from} durationInFrames={len} layout="none">
            <Audio src={staticFile(`sfx/${h.sfx}.mp3`)} volume={vol} toneFrequency={pop ? PITCH[popIndex++ % PITCH.length] : 1} />
          </Sequence>
        );
      })}
      {vo.filter((l) => l.src).map((l, i) => (
        <Sequence key={`vo${i}`} from={l.at} durationInFrames={l.dur + 30} layout="none">
          <Audio src={staticFile(l.src as string)} volume={1} />
        </Sequence>
      ))}
    </>
  );
};

/**
 * Burned-in caption v2 (DECISIONS.md #4): Cairo 900 cream with a soft dark shadow; *hot* words sit in ink on a
 * tilted colour box. Two sizes only: 96 (hooks, payoffs) and 84 (everything else). Centred on the safe zone at `y`.
 * Words rise from a mask line on `start`, leave on `end` (respect holdFrames()).
 */
export const AdCaption: React.FC<{f: number; text: string; y: number; start: number; end?: number; size?: 84 | 96 | number; step?: number; accent?: string; rtl?: boolean}> = ({
  f, text, y, start, end, size = 84, step = b(0.12), accent = C.accent, rtl,
}) => (
  <div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: y - size * 1.1, height: size * 2.2, display: 'flex', alignItems: 'center',
    justifyContent: 'center', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.08, color: C.text, zIndex: 90,
    letterSpacing: rtl ? 0 : '-0.01em', textShadow: `0 ${size * 0.05}px ${size * 0.22}px rgba(14,6,28,0.75), 0 0 ${size * 0.04}px rgba(14,6,28,0.9)`,
    direction: rtl ? 'rtl' : 'ltr'}}>
    {/* Arabic marks (dots, shadda) sit far above/below the line: give the rise mask more room */}
    <Words f={f} text={text} start={start} step={step} end={end} accent={accent} pad={rtl ? 0.45 : undefined} boxed />
  </div>
);

/** Toggle-only overlay to check the safe zone in Studio (never on in renders). */
export const SafeGuide: React.FC<{on: boolean}> = ({on}) =>
  on ? (
    <div style={{position: 'absolute', left: SAFE.left, top: SAFE.top, width: SAFE.right - SAFE.left, height: SAFE.bottom - SAFE.top,
      outline: '3px dashed rgba(0,255,200,0.8)', zIndex: 999, pointerEvents: 'none'}} />
  ) : null;

export const AdBg: React.FC = () => <StageBg />;

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
