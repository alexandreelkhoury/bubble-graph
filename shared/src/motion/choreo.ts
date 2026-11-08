// JAMAA-PLATFORM §3.8: the shared choreography. Every platform moment is a step list, and ONE deterministic sampler
// (`sample(step, tMs, index)`) implements the DESIGN §6.1 / DESIGN-JAMAA §8 cubic-bezier easings and an analytic damped
// spring. The web runs this file (runner.ts); the TV runs the Kotlin port tools/gen-characters writes into Choreo.kt;
// shared/fixtures/v2/choreo.json pins sampled values so both sides are checked against the same numbers. Zod-free, pure.
//
// Semantics (binding for the Kotlin port): a step's local time is `tMs − startMs − staggerMs × index`; progress is 0
// up to local 0, exactly 1 from local `durationMs` on, and the eased value in between. Cubic easings take
// `local / durationMs`; springs run on REAL seconds (`local / 1000`, closed form from 0 to 1 at rest), so a spring step's
// `durationMs` is its fixed settle time (it snaps to exactly 1 there; durations are chosen ≥ the 2 % settle time).

export type EasingDef =
  | { kind: "cubic"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "spring"; dampingRatio: number; stiffness: number; mass: number };

/** DESIGN §6.1 + DESIGN-JAMAA §8. `spring.bouncy` = Compose `spring(0.55f, Spring.StiffnessMediumLow)` (400). */
export const EASINGS = {
  linear: { kind: "cubic", x1: 0, y1: 0, x2: 1, y2: 1 },
  "ease.standard": { kind: "cubic", x1: 0.2, y1: 0, x2: 0, y2: 1 },
  "ease.decel": { kind: "cubic", x1: 0.05, y1: 0.7, x2: 0.1, y2: 1 },
  "ease.accel": { kind: "cubic", x1: 0.3, y1: 0, x2: 0.8, y2: 0.15 },
  "ease.overshoot": { kind: "cubic", x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
  "ease.coin": { kind: "cubic", x1: 0.4, y1: -0.15, x2: 0.2, y2: 1 },
  "ease.door": { kind: "cubic", x1: 0.6, y1: 0, x2: 0.15, y2: 1 },
  "spring.hop": { kind: "spring", dampingRatio: 0.5, stiffness: 500, mass: 1 },
  "spring.bouncy": { kind: "spring", dampingRatio: 0.55, stiffness: 400, mass: 1 },
} as const satisfies Record<string, EasingDef>;
export type EasingId = keyof typeof EASINGS;

export interface Step {
  id: string;
  startMs: number;
  durationMs: number;
  easing: EasingId;
  /** Per-element delay for the element at `index` (cards, panes, coins, characters). */
  staggerMs?: number;
  /** Calm / reduced motion: this step is replaced by the 150 ms crossfade ("fade"), dropped ("skip") or kept. */
  reduced: "fade" | "skip" | "keep";
  /** Lite motion (low-end TVs): kept or dropped. */
  lite: "keep" | "drop";
}

const NEWTON_ITERATIONS = 8;
const EPSILON = 1e-7;

/** cubic-bezier(x1, y1, x2, y2)(x) for x in [0, 1]: Newton on x(u), then bisection (the UnitBezier method). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u: number): number => ((ax * u + bx) * u + cx) * u;
  const dx = (u: number): number => (3 * ax * u + 2 * bx) * u + cx;
  const sy = (u: number): number => ((ay * u + by) * u + cy) * u;
  let u = x;
  for (let i = 0; i < NEWTON_ITERATIONS; i++) {
    const err = sx(u) - x;
    if (Math.abs(err) < EPSILON) return sy(u);
    const d = dx(u);
    if (Math.abs(d) < 1e-6) break;
    u -= err / d;
  }
  let lo = 0, hi = 1;
  u = x;
  while (lo < hi) {
    const v = sx(u);
    if (Math.abs(v - x) < EPSILON) break;
    if (x > v) lo = u;
    else hi = u;
    u = (lo + hi) / 2;
    if (hi - lo < EPSILON) break;
  }
  return sy(u);
}

/** A damped spring from 0 to 1 at rest, after `tSec` seconds (closed form: under-, critically or over-damped). */
export function spring(dampingRatio: number, stiffness: number, mass: number, tSec: number): number {
  if (tSec <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const z = dampingRatio;
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * tSec) * (Math.cos(wd * tSec) + ((z * w0) / wd) * Math.sin(wd * tSec));
  }
  if (z === 1) return 1 - Math.exp(-w0 * tSec) * (1 + w0 * tSec);
  const s = w0 * Math.sqrt(z * z - 1);
  const r1 = -z * w0 + s, r2 = -z * w0 - s;
  const a = r2 / (r1 - r2), b = -r1 / (r1 - r2);
  return 1 + a * Math.exp(r1 * tSec) + b * Math.exp(r2 * tSec);
}

/** Seconds until a spring stays within 2 % of 1 (the envelope bound 4 / (ζ ω0) for under-damped springs). */
export function springSettleMs(e: { dampingRatio: number; stiffness: number; mass: number }): number {
  const w0 = Math.sqrt(e.stiffness / e.mass);
  return (4 / (Math.min(e.dampingRatio, 1) * w0)) * 1000;
}

/** Progress of `step` at `tMs` (time since the moment started) for the element at `index`. May overshoot 1 in between. */
export function sample(step: Step, tMs: number, index = 0): number {
  const local = tMs - step.startMs - (step.staggerMs ?? 0) * index;
  if (local <= 0) return 0;
  if (local >= step.durationMs) return 1;
  const e: EasingDef = EASINGS[step.easing];
  return e.kind === "cubic" ? cubicBezier(e.x1, e.y1, e.x2, e.y2, local / step.durationMs) : spring(e.dampingRatio, e.stiffness, e.mass, local / 1000);
}

/** The end of a step list, with `count` staggered elements. */
export function endMs(steps: readonly Step[], count = 1): number {
  let end = 0;
  for (const s of steps) end = Math.max(end, s.startMs + (s.staggerMs ?? 0) * Math.max(0, count - 1) + s.durationMs);
  return end;
}

/** A step list scaled in time (the 700 ms repeat portal = the 1 100 ms one × 0.64, DESIGN-JAMAA §3.1). Spring steps
 *  keep their duration (their settle time is physical) but move with the timeline. */
export function scaled(steps: readonly Step[], k: number): Step[] {
  return steps.map((s) => {
    const spr = EASINGS[s.easing].kind === "spring";
    const out: Step = { ...s, startMs: s.startMs * k, durationMs: spr ? s.durationMs : s.durationMs * k };
    if (s.staggerMs !== undefined) out.staggerMs = s.staggerMs * k;
    return out;
  });
}

const S = (id: string, startMs: number, durationMs: number, easing: EasingId, reduced: Step["reduced"] = "skip", lite: Step["lite"] = "keep", staggerMs?: number): Step =>
  ({ id, startMs, durationMs, easing, ...(staggerMs === undefined ? {} : { staggerMs }), reduced, lite });

/** Every platform moment (JAMAA-PLATFORM §3.10, DESIGN-JAMAA §3, §5.1, §8). Ids are stable: Choreo.kt and the fixture use them. */
export const CHOREO = {
  /** A. The Bab portal, first open of a game in the session: 1 100 ms (DESIGN-JAMAA §3.1). */
  portal: [
    S("press", 0, 120, "ease.standard"),
    S("othersOut", 0, 240, "ease.accel"),
    S("arch", 120, 580, "ease.decel"),
    S("parallax", 200, 600, "ease.decel"),
    S("handoff", 700, 200, "ease.standard", "fade"),
    S("title", 800, 200, "ease.overshoot", "fade"),
    S("panes", 900, 80, "ease.decel", "fade", "keep", 60),
  ],
  /** Back (setup → hub): the reverse in 600 ms. */
  portalBack: [S("panes", 0, 150, "ease.accel"), S("arch", 100, 400, "ease.accel", "fade"), S("othersIn", 300, 300, "ease.decel")],
  /** B. The world entrance, ≤ 2 000 ms (DESIGN-JAMAA §3.2); `characters` lands up to 12 with a 40 ms stagger. */
  entrance: [
    S("panesOut", 0, 130, "ease.accel", "skip", "keep", 60),
    S("darken", 0, 250, "ease.accel", "fade"),
    S("door", 250, 750, "ease.door"),
    S("title", 1000, 250, "ease.overshoot", "fade"),
    S("characters", 1100, 400, "spring.bouncy", "skip", "keep", 40),
    S("titleSettle", 1800, 200, "ease.standard", "fade"),
  ],
  /** The phone's matching 600 ms flood in the world accent. */
  flood: [S("flood", 0, 600, "ease.decel", "fade"), S("title", 200, 300, "ease.overshoot", "fade")],
  /** C. One award: coins (450 ms, 70 ms stagger, ≤ 24), then the badge pop and the counter tick (§3.10 C, DESIGN-JAMAA §5.1). */
  points: [S("coin", 0, 450, "ease.coin", "skip", "keep", 70), S("badgePop", 450, 160, "ease.overshoot"), S("counter", 450, 600, "ease.decel")],
  /** FLIP reorder after a ranking change (400 ms). Reduced: a 200 ms crossfade (the renderer's). */
  reorder: [S("reorder", 0, 400, "ease.standard", "fade")],
  /** D. Cup: stars fly from the podium to "Tonight's cup" (coin geometry, 3 stars max per player). */
  cup: [S("star", 0, 450, "ease.coin", "skip", "keep", 70), S("cupPop", 450, 160, "ease.overshoot")],
  /** A REACT: the burst pops, the expression holds 1.5 s (§3.7). */
  reaction: [S("burst", 0, 300, "spring.hop", "keep"), S("hold", 0, 1500, "linear", "keep")],
  /** A character hop (`happy`, join drop landing). */
  hop: [S("hop", 0, 260, "spring.hop")],
  /** Calm / reduced motion: every moment becomes this 150 ms crossfade. */
  crossfade: [S("fade", 0, 150, "ease.standard", "keep")],
} as const satisfies Record<string, readonly Step[]>;
export type MomentId = keyof typeof CHOREO;

/** The 700 ms repeat portal (DESIGN-JAMAA §3.1). */
export const PORTAL_REPEAT_SCALE = 0.64;

/**
 * The variant of a moment to run: reduced (Calm animations or `prefers-reduced-motion`) → the crossfade when any step
 * of the moment is "fade" or "keep", else nothing; lite → steps marked "drop" removed.
 */
export function variant(steps: readonly Step[], o: { reduced: boolean; lite?: boolean }): Step[] {
  if (o.reduced) return steps.some((s) => s.reduced !== "skip") ? [...CHOREO.crossfade] : [];
  return o.lite ? steps.filter((s) => s.lite === "keep") : [...steps];
}
