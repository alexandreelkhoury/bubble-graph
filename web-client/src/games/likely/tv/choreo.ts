// GAME-LIKELY §12.2 / DESIGN-JAMAA §5.3: the Most Likely reveal as a step list for the shared sampler
// (@jamaa/shared/motion: one deterministic `sample`, the same easings and springs the Kotlin TV runs). The list depends
// on the card's public result only (votes, chaos, unanimous), so every TV plays the same moment. Kotlin mirror:
// tv-app/.../games/likely/LikelyChoreo.kt (`revealSteps`, `fitReveal`), line for line.
//
// The redesigned reveal (owner, 2026-11-12): the card lifts to the top and the players glide into one centred row
// ("dim"); then the votes land under their targets ONE BY ONE ("token": public mode, each voter's own character in
// miniature flies from the voter to its pick; secret votes, identical envelopes drop from the card); the counts pop
// ("count"); the room dims around the most-voted ("spot"); the award stamp lands ("stamp"). Chaos: a scramble instead
// of the spotlight. The rest of the server window is the "hold": the finished picture stays readable.
import { endMs, scaled } from "@jamaa/shared/motion";
import type { Step } from "@jamaa/shared/motion";

const S = (id: string, startMs: number, durationMs: number, easing: Step["easing"], reduced: Step["reduced"] = "skip", staggerMs?: number): Step =>
  ({ id, startMs, durationMs, easing, ...(staggerMs === undefined ? {} : { staggerMs }), reduced, lite: "keep" });

export interface RevealShape {
  /** Votes landing under their targets (one token each). */
  tokens: number;
  chaos: boolean;
  none: boolean;
  unanimous: boolean;
}

/** The card lifts, the row glides up (0–700 ms). */
export const LIFT_MS = 700;
/** One token's flight; tokens leave one after the other. */
export const TOKEN_MS = 520;
export const TOKEN_AT = 750;
/** The whole build takes about 2.4 s whatever the room size, each token 160–320 ms after the previous one. */
export const TOKEN_WINDOW_MS = 2400;
export const SCRAMBLE_MS = 1000;
export const CONFETTI_MS = 1200;

export function tokenStagger(tokens: number): number {
  return tokens <= 1 ? 320 : Math.min(320, Math.max(160, TOKEN_WINDOW_MS / (tokens - 1)));
}

/** The reveal timeline. Ids: dim, token (per vote), count, spot, stamp, confetti, scramble, hold. */
export function revealSteps(o: RevealShape): Step[] {
  const steps: Step[] = [S("dim", 0, LIFT_MS, "ease.standard", "fade")];
  if (o.none || o.tokens === 0) return [...steps, S("hold", LIFT_MS, 400, "ease.decel", "fade")];
  const st = tokenStagger(o.tokens);
  steps.push(S("token", TOKEN_AT, TOKEN_MS, "ease.decel", "skip", st));
  let t = TOKEN_AT + st * (o.tokens - 1) + TOKEN_MS + 100;
  steps.push(S("count", t, 400, "ease.overshoot", "fade"));
  t += 400;
  if (o.chaos) {
    steps.push(S("scramble", t, SCRAMBLE_MS, "linear"));
    t += SCRAMBLE_MS;
    return [...steps, S("hold", t, 400, "ease.decel", "fade")];
  }
  steps.push(S("spot", t, 600, "ease.decel", "fade"));
  steps.push(S("stamp", t + 300, 600, "ease.overshoot", "fade"));
  if (o.unanimous) steps.push(S("confetti", t + 600, CONFETTI_MS, "linear"));
  t += 900;
  return [...steps, S("hold", t, 400, "ease.decel", "fade")];
}

/** The first time (ms) a step starts (unknown id → Infinity). */
export function startOf(steps: readonly Step[], id: string): number {
  const s = steps.find((x) => x.id === id);
  return s ? s.startMs : Infinity;
}

/** Time kept free at the end of the server's REVEAL window (network slack before the next card is dealt). */
export const REVEAL_TAIL_MS = 1000;
/** The finished picture (who voted for whom, or the percentages) stays at least this long when the window allows it. */
export const HOLD_MIN_MS = 2000;
/** The beats before the hold are never squeezed below this fraction of their natural speed to make room for it. */
export const MIN_SCALE = 0.7;
/** Shortest hold step (its visual fade-in; the picture then stays until the server deals the next card). */
const HOLD_FLOOR_MS = 400;

/**
 * Fits the reveal to the server's REVEAL window (likelyRevealMs; the server never waits for the TV). Everything before
 * the hold is scaled down in time with the shared `scaled` when it would leave the hold less than HOLD_MIN_MS of
 * `windowMs − REVEAL_TAIL_MS`, but never below MIN_SCALE (the floor of `budget − HOLD_FLOOR_MS` still applies); then
 * `hold` starts where the beats end and fills the rest of the budget.
 */
export function fitReveal(steps: readonly Step[], windowMs: number, count: number): Step[] {
  const budget = Math.max(2000, windowMs - REVEAL_TAIL_MS);
  const hold = steps.find((s) => s.id === "hold");
  const core = steps.filter((s) => s.id !== "hold");
  const holdAt = hold ? hold.startMs : endMs(core, count);
  const want = Math.max(budget - HOLD_MIN_MS, holdAt * MIN_SCALE);
  const k = Math.min(1, want / Math.max(1, holdAt), (budget - HOLD_FLOOR_MS) / Math.max(1, endMs(core, count)));
  const fitted = k < 1 ? scaled(core, k) : [...core];
  if (!hold) return fitted;
  const start = holdAt * Math.min(1, k);
  return [...fitted, { ...hold, startMs: start, durationMs: Math.max(HOLD_FLOOR_MS, budget - start) }];
}
