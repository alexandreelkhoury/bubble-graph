// GAME-LIKELY §12.2 / DESIGN-JAMAA §5.3: the Most Likely reveal as a step list for the shared sampler
// (@jamaa/shared/motion: one deterministic `sample`, the same easings and springs the Kotlin TV runs). The list depends
// on the card's public result only (voters, mode, chaos, unanimous), so every TV plays the same moment.
import { endMs, scaled } from "@jamaa/shared/motion";
import type { Step } from "@jamaa/shared/motion";

const S = (id: string, startMs: number, durationMs: number, easing: Step["easing"], reduced: Step["reduced"] = "skip", staggerMs?: number): Step =>
  ({ id, startMs, durationMs, easing, ...(staggerMs === undefined ? {} : { staggerMs }), reduced, lite: "keep" });

export interface RevealShape {
  /** Characters that run to a conga line (public mode, voters who did not pick themselves). */
  runners: number;
  /** Envelopes from the ballot box (secret mode: one per vote). */
  envelopes: number;
  publicMode: boolean;
  chaos: boolean;
  none: boolean;
  unanimous: boolean;
  coins: number;
}

/** Drumroll: lights dim, the card shrinks to the top (0–800 ms). */
export const DRUM_MS = 800;
/** Run to your pick: 100 ms per voter, the whole run ≤ 2 500 ms (§12.2 step 2). */
export const RUN_MS = 520;
export const RUN_WINDOW_MS = 2500 - RUN_MS;

export function runStagger(runners: number): number {
  return runners <= 1 ? 100 : Math.min(100, RUN_WINDOW_MS / (runners - 1));
}

/** The reveal timeline. Ids: dim, run (per runner), box, env (per envelope), scramble, count, spot, stamp, coin (per coin), tick, board, confetti, hold. */
export function revealSteps(o: RevealShape): Step[] {
  const steps: Step[] = [S("dim", 0, DRUM_MS, "ease.standard", "fade")];
  if (o.none) return [...steps, S("hold", DRUM_MS, 400, "ease.decel", "fade")];
  let t = DRUM_MS;
  if (o.chaos) {
    steps.push(S("scramble", t, 1200, "linear"));
    t += 1200;
    if (o.publicMode && o.runners > 0) {
      steps.push(S("run", t, RUN_MS, "spring.bouncy", "skip", runStagger(o.runners)));
      t += RUN_MS + runStagger(o.runners) * Math.max(0, o.runners - 1);
    }
    steps.push(S("count", t, 600, "ease.decel", "fade"));
    t += 600;
    if (!o.publicMode) { steps.push(S("board", t, 1200, "ease.decel", "fade", 120)); t += 600; }
    return [...steps, S("hold", t, 400, "ease.decel", "fade")];
  }
  if (o.publicMode) {
    const st = runStagger(o.runners);
    steps.push(S("run", t, RUN_MS, "ease.decel", "skip", st));
    t += o.runners > 0 ? RUN_MS + st * (o.runners - 1) : 200;
  } else {
    steps.push(S("box", t, 360, "ease.overshoot"));
    steps.push(S("env", t + 240, 450, "ease.coin", "skip", 70));
    t += 240 + 450 + 70 * Math.max(0, o.envelopes - 1);
  }
  t += 100;
  steps.push(S("count", t, 600, "ease.decel", "fade"));
  t += 600;
  steps.push(S("spot", t, 800, "ease.overshoot", "fade"));
  t += 800;
  steps.push(S("stamp", t, 600, "ease.overshoot", "fade"));
  if (o.unanimous) steps.push(S("confetti", t + 300, 1200, "linear"));
  t += 600;
  if (o.publicMode) {
    if (o.coins > 0) {
      steps.push(S("coin", t, 450, "ease.coin", "skip", 70));
      steps.push(S("tick", t + 450, 600, "ease.decel", "fade"));
      t += 450 + 70 * Math.max(0, o.coins - 1) + 600;
    }
  } else {
    steps.push(S("board", t, 600, "ease.decel", "fade", 120));
    t += 600;
  }
  steps.push(S("hold", t, 400, "ease.decel", "fade"));
  return steps;
}

/** The first time (ms) a step starts (unknown id → Infinity). */
export function startOf(steps: readonly Step[], id: string): number {
  const s = steps.find((x) => x.id === id);
  return s ? s.startMs : Infinity;
}

/** Time kept free at the end of the server's REVEAL window: the hold (≥ 1 s of "defend yourself") and network slack. */
export const REVEAL_TAIL_MS = 1000;

/**
 * The reveal must end inside the server's REVEAL window (likelyRevealMs, 6–9.5 s; the server never waits for the TV):
 * when the full list (with `count` staggered elements) runs past `windowMs − REVEAL_TAIL_MS`, the whole list is scaled
 * down in time with the shared `scaled` (springs keep their physical settle time).
 */
export function fitReveal(steps: readonly Step[], windowMs: number, count: number): Step[] {
  const budget = Math.max(2000, windowMs - REVEAL_TAIL_MS);
  const end = endMs(steps, count);
  return end <= budget ? [...steps] : scaled(steps, budget / end);
}
