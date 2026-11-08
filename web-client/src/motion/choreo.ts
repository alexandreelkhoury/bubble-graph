// JAMAA-PLATFORM §3.8 choreography sampler: step lists, the DESIGN §6.1 / DESIGN-JAMAA §8 cubic-bezier easings and an
// analytic damped spring (fixed settle time), so every renderer samples the same curve.
// JAMAA-GAP: lane A owns the shared sampler (`shared/src/motion/choreo.ts` + `choreo.json` fixture). It had not landed
// when lane B built P2, so this module mirrors the spec's contract (`Step`, `sample(step, tMs)`); switch the imports to
// `@jamaa/shared/motion` once it exists (same names) and delete this file.

export type EasingId = "linear" | "standard" | "decel" | "accel" | "overshoot" | "coin" | "door" | "spring.hop" | "spring.bouncy";
export interface Step {
  id: string;
  startMs: number;
  durationMs: number;
  easing: EasingId;
  staggerMs?: number;
  /** Calm / reduced motion: crossfade instead ("fade"), drop the step ("skip") or keep it. */
  reduced: "fade" | "skip" | "keep";
  /** Lite motion (low-end TVs): keep or drop. */
  lite: "keep" | "drop";
}

const BEZIER: Record<string, readonly [number, number, number, number]> = {
  standard: [0.2, 0, 0, 1],
  decel: [0.05, 0.7, 0.1, 1],
  accel: [0.3, 0, 0.8, 0.15],
  overshoot: [0.34, 1.56, 0.64, 1],
  coin: [0.4, -0.15, 0.2, 1],
  door: [0.6, 0, 0.15, 1],
};

/** Cubic-bezier y(x) by Newton steps on x(t) with a bisection fallback (CSS semantics). */
export function bezier(p: readonly [number, number, number, number], x: number): number {
  const [x1, y1, x2, y2] = p;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const fx = (t: number): number => ((ax * t + bx) * t + cx) * t;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const d = (3 * ax * t + 2 * bx) * t + cx;
    const e = fx(t) - x;
    if (Math.abs(e) < 1e-6) break;
    if (Math.abs(d) < 1e-6) break;
    t -= e / d;
  }
  if (t < 0 || t > 1 || Math.abs(fx(t) - x) > 1e-4) {
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      if (fx(t) < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
  }
  return ((ay * t + by) * t + cy) * t;
}

/** DESIGN-JAMAA §8: spring.hop ζ 0.5 / stiffness 500; spring.bouncy ζ 0.55 / Compose StiffnessMediumLow (400). Mass 1. */
const SPRINGS: Record<string, { zeta: number; k: number }> = { "spring.hop": { zeta: 0.5, k: 500 }, "spring.bouncy": { zeta: 0.55, k: 400 } };

/** Closed-form under-damped response x(τ) (0 → 1) over a normalised time 0..1 of the step (the step's duration is
 *  its fixed settle time), corrected so the last frame lands exactly on 1. */
export function spring(id: string, x: number): number {
  const s = SPRINGS[id] ?? SPRINGS["spring.bouncy"]!;
  const w0 = Math.sqrt(s.k);
  const wd = w0 * Math.sqrt(1 - s.zeta * s.zeta);
  const settle = 4 / (s.zeta * w0); // seconds to a ~2 % envelope
  const raw = (u: number): number => {
    const t = u * settle;
    return 1 - Math.exp(-s.zeta * w0 * t) * (Math.cos(wd * t) + ((s.zeta * w0) / wd) * Math.sin(wd * t));
  };
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // The residual at the settle time is spread linearly, so the curve ends exactly on 1 with no jump.
  return raw(x) + (1 - raw(1)) * x;
}

/** Progress (0 → 1, may overshoot) of `step` at `tMs` after the choreography started; `index` staggers. */
export function sample(step: Step, tMs: number, index = 0): number {
  const start = step.startMs + (step.staggerMs ?? 0) * index;
  if (tMs <= start) return 0;
  if (step.durationMs <= 0 || tMs >= start + step.durationMs) return 1;
  const x = (tMs - start) / step.durationMs;
  if (step.easing === "linear") return x;
  if (step.easing.startsWith("spring.")) return spring(step.easing, x);
  return bezier(BEZIER[step.easing]!, x);
}

/** The end time of a step list (stagger included for `count` items). */
export function endMs(steps: readonly Step[], count = 1): number {
  let end = 0;
  for (const s of steps) end = Math.max(end, s.startMs + (s.staggerMs ?? 0) * Math.max(0, count - 1) + s.durationMs);
  return end;
}

/** A step list scaled in time (the 700 ms repeat portal = the 1 100 ms one × 0.64, DESIGN-JAMAA §3.1). */
export function scaled(steps: readonly Step[], k: number): Step[] {
  return steps.map((s) => ({ ...s, startMs: s.startMs * k, durationMs: s.durationMs * k, staggerMs: s.staggerMs === undefined ? undefined : s.staggerMs * k }));
}

const S = (id: string, startMs: number, durationMs: number, easing: EasingId, reduced: Step["reduced"] = "skip", lite: Step["lite"] = "keep", staggerMs?: number): Step =>
  ({ id, startMs, durationMs, easing, reduced, lite, ...(staggerMs === undefined ? {} : { staggerMs }) });

/** DESIGN-JAMAA §3.1: the Bab portal, first open in a session (1 100 ms). */
export const PORTAL: readonly Step[] = [
  S("press", 0, 120, "standard"),
  S("others", 0, 300, "accel"),
  S("arch", 120, 580, "decel"),
  S("parallax", 200, 600, "decel", "skip", "drop"),
  S("handoff", 700, 200, "standard", "fade"),
  S("title", 800, 200, "overshoot"),
  S("panes", 900, 200, "decel", "skip", "keep", 60),
];
/** DESIGN-JAMAA §3.1: Back plays the reverse in 600 ms. */
export const PORTAL_BACK: readonly Step[] = [S("panes", 0, 150, "accel"), S("arch", 100, 400, "accel"), S("others", 300, 300, "decel")];
/** DESIGN-JAMAA §3.2: the world entrance (≤ 2 000 ms). */
export const ENTRANCE: readonly Step[] = [
  S("darken", 0, 250, "accel", "fade"),
  S("door", 250, 750, "door"),
  S("title", 1000, 250, "overshoot", "fade"),
  S("characters", 1100, 400, "spring.bouncy", "skip", "keep", 40),
  S("settle", 1800, 200, "standard", "fade"),
];
/** JAMAA-PLATFORM §3.10 C: one coin flight (450 ms, 70 ms stagger) and the counter tick (600 ms). */
export const POINTS: readonly Step[] = [S("coin", 0, 450, "coin", "skip", "keep", 70), S("counter", 450, 600, "decel", "skip")];
/** The phone's 600 ms world flood (DESIGN-JAMAA §3.2 "Phone"). */
export const FLOOD: readonly Step[] = [S("flood", 0, 600, "decel", "fade"), S("title", 200, 300, "overshoot", "fade")];
/** Calm/reduced variant: a 150 ms crossfade. */
export const CROSSFADE: readonly Step[] = [S("fade", 0, 150, "standard", "keep")];

/** The variant to run: reduced motion maps "fade" steps to the crossfade and drops "skip" steps; lite drops "drop". */
export function variant(steps: readonly Step[], o: { reduced: boolean; lite?: boolean }): Step[] {
  if (o.reduced) return steps.some((s) => s.reduced !== "skip") ? [...CROSSFADE] : [];
  return o.lite ? steps.filter((s) => s.lite === "keep") : [...steps];
}
