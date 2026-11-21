// Quiz Night on the Pixi TV: the pure numbers behind tv-pixi/trivia.ts (no Pixi, no DOM, unit-tested in
// web-client/test/games/trivia/pixi.test.ts). The geometry comes from games/trivia/layout.ts (the DOM screens' own
// coordinates); this file only adds what the DOM gets from CSS: the intro / read / answer / final keyframes as shared
// motion steps (same delays and easings as tv.css), the marquee chase, the flex-wrap of the quiz chips, the podium
// columns of the results and the leaderboard race rows.
import type { Step } from "@jamaa/shared/motion";
import { CANVAS } from "../games/trivia/layout";

const S = (id: string, startMs: number, durationMs: number, easing: Step["easing"], staggerMs?: number): Step =>
  ({ id, startMs, durationMs, easing, ...(staggerMs === undefined ? {} : { staggerMs }), reduced: "skip", lite: "keep" });

/** TR-TV-01 (tv.css tq-marquee / tq-star / tq-pop): the card drops from the marquee, stars fill, chips pop, the count. */
export const INTRO_STEPS: readonly Step[] = [
  S("card", 0, 400, "ease.decel"),
  S("star", 450, 360, "ease.overshoot", 150),
  S("dom", 840, 300, "ease.overshoot"),
  S("chip", 900, 300, "ease.overshoot", 60),
  S("count", 1150, 300, "ease.decel"),
];
/** READ (tq-slam): the question card slams in from above. */
export const READ_STEPS: readonly Step[] = [S("slam", 0, 400, "ease.overshoot")];
/** ANSWER (tq-flip): the tiles flip in A→D, 90 ms apart. */
export const ANSWER_STEPS: readonly Step[] = [S("flip", 0, 360, "ease.decel", 90)];
/** REVEAL (tq-squeeze): the card squeezes to open the verdict band. */
export const SQUEEZE_STEPS: readonly Step[] = [S("squeeze", 0, 300, "ease.standard")];
/** FINAL_INTRO (tq-slam 500 ms after 200 ms, tq-stamp 600 ms after 1.2 s). */
export const FINAL_STEPS: readonly Step[] = [S("title", 200, 500, "ease.overshoot"), S("stamp", 1200, 600, "ease.overshoot")];
/** The "Did you know?" card (tq-flipdown). */
export const EXPLAIN_STEPS: readonly Step[] = [S("flip", 0, 420, "ease.decel")];

/** The marquee chase (tqs-chase): each of the 34 bulbs is on for the first 70 % of a 2.7 s cycle (0.9 s in the final's
 *  heat), bulb `i` delayed 100 ms after bulb `i - 1`. */
export function chaseOn(i: number, tMs: number, heat = false): boolean {
  const period = heat ? 900 : 2700;
  const delay = i * 100;
  const ph = ((((tMs - delay) % period) + period) % period) / period;
  return ph < 0.7;
}

/** The question card's starting font size (tv.css .tqcard is-mid / is-long, and the squeezed reveal card); the Pixi
 *  card then shrinks it further until the text fits (never cropped). */
export function questionFont(len: number, reveal: boolean): number {
  if (reveal) return len > 90 ? 17 : len > 60 ? 20 : 22;
  return len > 90 ? 22 : len > 60 ? 26 : 30;
}

/** Shrink steps for auto-fit: from `max` down to `min`, 2 dp at a time (then the block scales as a whole). */
export function fitSizes(max: number, min: number): number[] {
  const out: number[] = [];
  for (let s = max; s > min; s -= 2) out.push(s);
  out.push(min);
  return out;
}

/** True when the first strong character of `s` is right-to-left (Arabic, Hebrew): the text's own direction inside a
 *  tile (`dir="auto"`), independent of the UI locale. */
export function startsRtl(s: string): boolean {
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if ((c >= 0x0590 && c <= 0x08ff) || (c >= 0xfb1d && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfeff)) return true;
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c <= 0x24f) || (c >= 0x370 && c <= 0x52f)) return false;
  }
  return false;
}

/** flex-wrap, centred (the quiz chips): each item's left x and row, inside `maxW` starting at x = 0. In RTL the items
 *  run from the right. */
export function wrapCentred(widths: readonly number[], maxW: number, gap: number, rtl: boolean): { x: number; row: number }[] {
  const rows: number[][] = [[]];
  let used = 0;
  widths.forEach((w, i) => {
    const cur = rows[rows.length - 1]!;
    const need = cur.length === 0 ? w : used + gap + w;
    if (cur.length > 0 && need > maxW) { rows.push([i]); used = w; } else { cur.push(i); used = need; }
  });
  const out: { x: number; row: number }[] = new Array(widths.length);
  rows.forEach((idx, r) => {
    const total = idx.reduce((a, i) => a + widths[i]!, 0) + gap * Math.max(0, idx.length - 1);
    let x = (maxW - total) / 2;
    const seq = rtl ? [...idx].reverse() : idx;
    for (const i of seq) { out[i] = { x, row: r }; x += widths[i]! + gap; }
  });
  return out;
}

/** RESULTS podium (tv.css .tqres__podium): columns 190 wide, 6 apart, steps 2-1-3 left to right (3-1-2 in RTL, the
 *  flex row mirrors), heights 130 / 96 / 70, standing on y = 540 − 106. */
export const PODIUM_COL_W = 190;
export const PODIUM_BASE_Y = CANVAS.h - 106;
export const STEP_H: Record<1 | 2 | 3, number> = { 1: 130, 2: 96, 3: 70 };
export function podiumColumns(rtl: boolean): { step: 1 | 2 | 3; cx: number }[] {
  const order: (1 | 2 | 3)[] = rtl ? [3, 1, 2] : [2, 1, 3];
  const gap = 6;
  const total = 3 * PODIUM_COL_W + 2 * gap;
  const x0 = (CANVAS.w - total) / 2;
  return order.map((step, i) => ({ step, cx: x0 + i * (PODIUM_COL_W + gap) + PODIUM_COL_W / 2 }));
}
/** The characters on a step share 170 dp (96 on the top step, 76 on the others at most). */
export function podiumCharSize(step: 1 | 2 | 3, n: number): number {
  return Math.min(step === 1 ? 96 : 76, Math.floor(170 / Math.max(1, n)));
}
/** Centres of `n` characters standing side by side (2 dp apart) on a step centred on `cx`. */
export function castXs(cx: number, n: number, size: number): number[] {
  const w = size * (30 / 32) + 2;
  return Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * w);
}

/** LEADERBOARD race rows (tv.css .tqlb__rows: 110 dp in from each side, from y 118): 44 dp rows 8 apart up to 8
 *  players, then compact 30 / 4; the characters 40 / 26. */
export const BOARD_X = 110;
export const BOARD_Y = 118;
export function boardRows(n: number): { h: number; gap: number; char: number; compact: boolean } {
  return n <= 8 ? { h: 44, gap: 8, char: 40, compact: false } : { h: 30, gap: 4, char: 26, compact: true };
}

/** A score rolling from `from` to `to` with progress `p` (the odometer's value at that instant; never past `to`). */
export function rollValue(from: number, to: number, p: number): number {
  const q = Math.max(0, Math.min(1, p));
  return Math.round(from + (to - from) * q);
}

/** A whole block scaled down to fit (1 when it already fits). */
export function fitScale(size: number, room: number): number {
  return size > room && size > 0 ? room / size : 1;
}

/** "Time!" stamp (tv.css .tqstamp): scale 1.6 → 1 with the time step, faded in fast and out with the wrong tiles. */
export function stampLook(pTime: number, pOut: number): { scale: number; alpha: number } {
  return { scale: 1.6 - 0.6 * pTime, alpha: Math.min(1, pTime * 3) * (1 - Math.max(0, Math.min(1, pOut))) };
}
