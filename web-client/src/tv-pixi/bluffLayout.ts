// Bluff on the Pixi TV: the pure layout and timing helpers (no Pixi, no DOM; unit-tested in web-client/test/games/bluff).
// Everything here mirrors a rule of the DOM screens (games/bluff/tv/*, tv.css) in the 960 × 540 design canvas, so the
// two renderers place the same things in the same spots; the Pixi scene (bluff.ts) only draws and animates them.
import type { BeatMarks } from "../games/bluff/choreo";
import type { Beat, Mark } from "../games/bluff/model";

export const W = 960;
export const H = 540;

// ---------------------------------------------------------------- text direction

const RLM = "‏";
/**
 * Canvas text has an LTR base direction (Pixi never sets `ctx.direction`), so an Arabic line that starts or ends with
 * a Latin name, a number or punctuation would put those at the wrong end. In RTL every word gets a leading RLM (a strong
 * RTL mark, zero width): neutrals and isolates between words then resolve RTL on every wrapped line, and LTR runs (names,
 * "+150") keep their own order inside. LTR locales are returned unchanged.
 */
export function bidi(s: string, rtl: boolean): string {
  if (!rtl || s === "") return s;
  return RLM + s.replace(/ /g, ` ${RLM}`).replace(/\n/g, `\n${RLM}`) + RLM;
}

/**
 * The DOM's `dir="auto"` for player and prompt text: RTL when the first strong letter is Arabic (or Hebrew), skipping
 * isolated runs (FSI/LRI/RLI … PDI, e.g. names inserted by `isolate`). No strong letter: the UI direction.
 */
export function autoRtl(s: string, uiRtl: boolean): boolean {
  let depth = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c === 0x2066 || c === 0x2067 || c === 0x2068) { depth++; continue; }
    if (c === 0x2069) { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0) continue;
    if ((c >= 0x0590 && c <= 0x08ff) || (c >= 0xfb1d && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfeff)) return true;
    if (/\p{L}/u.test(ch)) return false;
  }
  return uiRtl;
}

/** Uppercase titles (the DOM's `text-transform: uppercase`), never in Arabic. */
export const caps = (s: string, rtl: boolean): string => (rtl ? s : s.toLocaleUpperCase());

/** Mirrors an x of the LTR layout in RTL. */
export const mx = (x: number, rtl: boolean): number => (rtl ? W - x : x);

// ---------------------------------------------------------------- fit to the safe area

/**
 * The largest size of `sizes` (descending) whose block `fits`, or the last one. The DOM lets a box grow with its
 * content; on the canvas every block has a fixed room, so long text steps down a size instead of cropping.
 */
export function pickSize(sizes: readonly number[], fits: (size: number) => boolean): number {
  for (const s of sizes) if (fits(s)) return s;
  return sizes[sizes.length - 1]!;
}

/** Below this the canvas squeezes a single line (scale) rather than stepping the font down further. */
export const shrinkTo = (width: number, max: number): number => (width > max && width > 0 ? max / width : 1);

// ---------------------------------------------------------------- the corkboard (BL-TV-03, tv.css .bfboard)

export interface BoardStyle { dense: boolean; cols: 1 | 2; left: number; right: number; colW: number; gapX: number; gapY: number; minH: number; font: number; letter: number; padY: number }

/** The board's grid and note style for `count` options (≤ 6: one column; 7–13: two, GAME-BLUFF §8.2). */
export function boardStyle(count: number): BoardStyle {
  const dense = count > 6;
  const left = dense ? 64 : 216, right = W - left;
  const gapX = dense ? 14 : 0;
  const cols = dense ? 2 : 1;
  const colW = (right - left - gapX * (cols - 1)) / cols;
  const mid = count === 5 || count === 6;
  return {
    dense, cols, left, right, colW, gapX, gapY: dense ? 5 : 8,
    minH: count <= 3 ? 54 : dense || mid ? 33 : 40,
    font: dense ? 16 : mid ? 19 : 21,
    letter: dense ? 22 : 26,
    padY: dense || mid ? 4 : 7,
  };
}

/** Grid cell of note `i` (row, visual column; the first card is at the start side, so RTL mirrors the columns). */
export function boardCell(i: number, cols: 1 | 2, rtl: boolean): { row: number; col: number } {
  const row = Math.floor(i / cols), c = i % cols;
  return { row, col: rtl && cols === 2 ? 1 - c : c };
}

/** Row tops for a board whose rows are `heights` tall (each row: its tallest note), from `top` with `gap`. */
export function rowTops(heights: readonly number[], top: number, gap: number): number[] {
  const out: number[] = [];
  let y = top;
  for (const h of heights) { out.push(y); y += h + gap; }
  return out;
}

/** Total height of rows `heights` with `gap` between them. */
export const stackHeight = (heights: readonly number[], gap: number): number => heights.reduce((a, h) => a + h, 0) + gap * Math.max(0, heights.length - 1);

/** Card tilt on the corkboard: by position (never by option id), the DOM's TILT. Degrees. */
export const TILT = [-1.4, 0.9, -0.6, 1.3, -1.1, 0.5, 1.0, -0.8, 0.7, -1.3, 1.2, -0.4, 0.8] as const;
export const tiltOf = (i: number): number => TILT[i % TILT.length]!;

// ---------------------------------------------------------------- the scores race (BL-TV-06)

export const RACE = { left: 150, right: W - 150, top: 112, rowMax: 44, room: 400 } as const;
/** Row height for `rows` rows (12 fit in 400 dp). */
export const raceRowH = (rows: number): number => Math.min(RACE.rowMax, Math.floor(RACE.room / Math.max(1, Math.min(rows, 12))));

/** Column x's of a race row in LTR (place end, character centre, name start, track start/end, score end, delta start). */
export function raceCols(chipW: number): { placeEnd: number; char: number; name: number; nameW: number; trackA: number; trackB: number; scoreEnd: number; delta: number } {
  const placeEnd = RACE.left + 22;
  const char = placeEnd + 10 + 20;
  const name = char + 20 + 10;
  const nameW = 120;
  const trackA = name + nameW + 10 + (chipW > 0 ? chipW + 10 : 0);
  const delta = RACE.right - 54;
  const scoreEnd = delta - 10;
  const trackB = scoreEnd - 64 - 10;
  return { placeEnd, char, name, nameW, trackA, trackB, scoreEnd, delta };
}

/** The bar's horizontal scale (a 1.5 % stub at zero, like the DOM). */
export const barScale = (v: number, max: number): number => Math.max(0.015, v / Math.max(1, max));

// ---------------------------------------------------------------- the podium (BL-TV-08)

/** Podium columns in visual order [2nd, 1st, 3rd] (RTL mirrors), centre x, step height, character size. */
export function podiumCols(rtl: boolean): { i: 0 | 1 | 2; x: number; step: number; char: number }[] {
  const xs = [288, 480, 672];
  const order = [1, 0, 2] as const;
  return order.map((i, k) => ({ i, x: rtl ? W - xs[k]! : xs[k]!, step: i === 0 ? 150 : i === 1 ? 104 : 72, char: i === 0 ? 112 : 84 }));
}
/** Steps 3, 2, 1 land in that order (§12.5): has podium index `i` landed after `step` drops? */
export const landed = (i: number, step: number): boolean => [2, 1, 0].indexOf(i) < step;
/** When drop `k` (0..2) happens on the results screen, ms from mount. */
export const podiumDropAt = (k: number): number => 500 + k * 650;

// ---------------------------------------------------------------- the reveal

/** The reveal sub-moment at `tMs` of beat `beat` (the DOM's frameAt rule). */
export function markAt(marks: BeatMarks, beat: Beat, tMs: number): Mark {
  return tMs >= marks.tick && marks.tick > beat.start ? 4 : tMs >= marks.pop ? 3 : tMs >= marks.stamp ? 2 : tMs >= marks.land ? 1 : 0;
}

/** A hopper's feet along its jump: horizontal by the raw (springy) progress, the 120 dp arc by the clamped one. */
export function hopPoint(x0: number, y0: number, x1: number, y1: number, p: number): { x: number; y: number } {
  const c = Math.min(1, Math.max(0, p));
  return { x: x0 + (x1 - x0) * p, y: y0 + (y1 - y0) * p - 480 * c * (1 - c) };
}

/**
 * Pop-out spots for `n` authors (feet), starting at the DOM's popSpot and kept on screen: when co-authors would run off
 * the end edge, the spacing tightens (the DOM's 64 dp step could put a third author half off the canvas).
 */
export function popSpots(n: number, rtl: boolean, card: { x: number; y: number; w: number; h: number }, half = 42): { x: number; y: number }[] {
  const first = card.w / 2 + 50;
  const room = W / 2 - 8 - half - first;
  const step = n <= 1 ? 0 : Math.min(64, room / (n - 1));
  return Array.from({ length: n }, (_, k) => {
    const dx = first + k * step;
    return { x: rtl ? card.x - dx : card.x + dx, y: card.y + card.h / 2 + 4 };
  });
}

/** The twist grid (final): 3 columns (4 from 7 cards) between 70 and 890, 62 dp cells, 10 dp gaps; RTL fills from the right. */
export function twistCells(n: number, rtl: boolean): { x: number; y: number; w: number; h: number }[] {
  const cols = n > 6 ? 4 : 3;
  const left = 70, width = W - 140, gap = 10;
  const w = (width - gap * (cols - 1)) / cols, h = 62;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const vc = rtl ? cols - 1 - c : c;
    return { x: left + vc * (w + gap), y: 128 + r * (h + gap), w, h };
  });
}

/** Envelope `i` of `n` falling onto a final answer card (offset from the card centre, the DOM's 30 dp spacing). */
export const envelopeX = (i: number, n: number): number => (i - (n - 1) / 2) * 30;

/** The montage hand: card `i` of `n` at fan progress `p` (rotation in degrees and x offset), around a pivot 260 dp below. */
export function fanOf(i: number, n: number, p: number): { rot: number; dx: number } {
  const k = i - (n - 1) / 2;
  return { rot: k * 12 * p, dx: k * 70 * p };
}

// ---------------------------------------------------------------- small easings (CSS keyframe equivalents)

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
export const easeOut = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
export const easeIn = (x: number): number => Math.pow(clamp01(x), 3);
export const easeInOut = (x: number): number => { const u = clamp01(x); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
/** cubic-bezier(0.34, 1.56, 0.64, 1)-like overshoot (the DOM's --ease-overshoot). */
export const overshoot = (x: number): number => { const c = 1.7, u = clamp01(x) - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
/** A step's progress from `startMs` over `durMs` at `tMs`. */
export const prog = (tMs: number, startMs: number, durMs: number): number => clamp01((tMs - startMs) / Math.max(1, durMs));

/** The neon "switch on" flicker (bf-neon-on: steps(1) keyframes 0 .15 · 18 % 1 · 26 % .35 · 40 % 1). */
export function neonAlpha(tMs: number, startMs: number, durMs = 900): number {
  const q = (tMs - startMs) / durMs;
  if (q < 0) return 0.15;
  return q < 0.18 ? 0.15 : q < 0.26 ? 1 : q < 0.4 ? 0.35 : 1;
}

/** The "Knew it!" flash (bf-knew, 1.5 s): fade in 12 %, hold to 82 %, fade out. */
export function knewAlpha(tMs: number, durMs = 1500): number {
  const q = tMs / durMs;
  if (q <= 0 || q >= 1) return 0;
  return q < 0.12 ? q / 0.12 : q < 0.82 ? 1 : (1 - q) / 0.18;
}

/** An envelope dropping into the ballot box slot (bf-env, 700 ms): y offset, rotation (deg), alpha. */
export function envDrop(tMs: number): { y: number; rot: number; a: number } {
  const q = clamp01(tMs / 700);
  const e = easeIn(q);
  if (q < 0.85) {
    const u = e / easeIn(0.85);
    return { y: -70 + 76 * u, rot: -18 * (1 - u), a: Math.min(1, q / 0.3) };
  }
  const u = (q - 0.85) / 0.15;
  return { y: 6 + 8 * u, rot: 0, a: 1 - u };
}
