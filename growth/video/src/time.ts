import {spring} from 'remotion';

// "Take this Higher" (Mixkit), 123.78 BPM, first beat at 0.318 s. Measured by tools/beats.py.
export const FPS = 60;
export const BPM = 123.78;
export const SPB = 60 / BPM;
const SONG_BEAT0 = 0.318;
// The film starts 16 beats before the song's first drop (song beat 59 -> film beat 16).
export const SONG_START_BEAT = 43;
export const MUSIC_TRIM_FRAMES = Math.round((SONG_BEAT0 + SONG_START_BEAT * SPB) * FPS);
export const DROP = 16;
export const BEATS = 48;

/** Frame (float) of film beat `beat`. */
export const b = (beat: number) => beat * SPB * FPS;
export const DURATION = Math.round(b(BEATS)) + 30;

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, c: number, t: number) => a + (c - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;
export const linear = (t: number) => t;

/** 0..1 progress between frames f0 and f1, eased. */
export const prog = (f: number, f0: number, f1: number, e: (t: number) => number = easeInOut) =>
  e(clamp((f - f0) / (f1 - f0)));

export type SpringCfg = {damping?: number; stiffness?: number; mass?: number};
// v2 (review-v2/polish.md): calmer springs read as premium. TEXT ≈ no overshoot, POP ≈ 9 %, SNAPPY ≈ 4 %.
export const TEXT: SpringCfg = {damping: 26, stiffness: 220, mass: 1};
export const SNAPPY: SpringCfg = {damping: 20, stiffness: 200, mass: 1};
export const POP: SpringCfg = {damping: 17, stiffness: 240, mass: 0.8};
export const SOFT: SpringCfg = {damping: 22, stiffness: 120, mass: 1};
export const HEAVY: SpringCfg = {damping: 16, stiffness: 140, mass: 1.6};

/** Closed-form spring step response starting at frame `start` (0 before it). */
export const spr = (f: number, start: number, cfg: SpringCfg = SNAPPY) =>
  f < start ? 0 : spring({frame: f - start, fps: FPS, config: cfg});

/** Colour lerp for #rrggbb. */
export const mix = (c1: string, c2: string, t: number) => {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1), d = p(c2);
  return '#' + a.map((v, i) => Math.round(lerp(v, d[i], clamp(t))).toString(16).padStart(2, '0')).join('');
};
