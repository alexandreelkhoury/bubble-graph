// GAME-TAQRIBAN §8.3 TQ-TV-02: the number-line reveal timeline, shared by the DOM /tv (../tv.tsx: CSS delays) and the Pixi
// TV (tv-pixi/taqriban.ts: steps on the shared `run` sampler), so both play the same moment at the same times. Pure.
import type { Step } from "@jamaa/shared/motion";

/** Reveal timeline (ms): guesses start, one every STEP, then a beat, then the answer pin, then the stamp. */
export const REVEAL_T = { lineIn: 300, firstDot: 700, step: 260, beat: 900, stamp: 700 } as const;
/** When guess `i` (seat order) starts dropping. */
export const dotAt = (i: number): number => REVEAL_T.firstDot + REVEAL_T.step * i;
/** When the answer pin starts falling, for `n` guesses. */
export const answerAt = (n: number): number => REVEAL_T.firstDot + REVEAL_T.step * Math.max(0, n - 1) + REVEAL_T.beat;
/** When "Closest!" stamps in (and the winners light up). */
export const stampAt = (n: number): number => answerAt(n) + REVEAL_T.stamp;

const S = (id: string, startMs: number, durationMs: number, easing: Step["easing"], staggerMs?: number): Step =>
  ({ id, startMs, durationMs, easing, ...(staggerMs === undefined ? {} : { staggerMs }), reduced: "fade", lite: "keep" });

/**
 * The reveal as a step list (the same durations and delays as tv.css): `axis` (the line draws), `ticks`, `log`, `dot`
 * (one per guess, staggered by STEP: run it with count = guesses), `pin` (the answer falls), `land` (its impact),
 * `stamp` (the verdict), `win` (closest glow / others dim), `pts`, `wild` ("Way off!"), `settle` (the ambient tail).
 */
export function revealSteps(n: number): Step[] {
  const a = answerAt(n), s = stampAt(n);
  return [
    S("axis", REVEAL_T.lineIn, 600, "ease.decel"),
    S("ticks", 700, 400, "ease.standard"),
    S("log", 900, 400, "ease.standard"),
    ...(n > 0 ? [S("dot", REVEAL_T.firstDot, 520, "ease.overshoot", REVEAL_T.step)] : []),
    S("pin", a, 700, "ease.overshoot"),
    // ease.overshoot first reaches 1 at ~40 % of its time: the pin touches the line 280 ms into its fall.
    S("land", a + 280, 600, "ease.decel"),
    S("stamp", s, 480, "ease.overshoot"),
    S("win", s, 600, "ease.decel"),
    S("pts", s, 360, "ease.overshoot"),
    S("wild", s + 700, 500, "ease.standard"),
    S("settle", s, 1300, "linear"),
  ];
}
