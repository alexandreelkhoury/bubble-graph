// The reference of the Kotlin sampler that kotlin.ts writes into Choreo.kt, line for line, so the port can be checked
// in TypeScript against lane A's `sample()` (shared/src/motion/choreo.ts) and against shared/fixtures/v2/choreo.json.
// It is NOT a second sampler for the product: the web runs lane A's, the TV runs the generated Kotlin.
import type { EasingDef, StepDef } from "./model";

const NEWTON_ITERATIONS = 8;
const EPSILON = 1e-7;

/** cubic-bezier(x1, y1, x2, y2)(x) for x in [0, 1]: Newton on x(u), then bisection (UnitBezier). */
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

/** Damped spring from 0 to 1 at rest, after `tSec` seconds (closed form; under-, critically or over-damped). */
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
  // x(t) = 1 + A e^{r1 t} + B e^{r2 t} with x(0) = 0, x'(0) = 0.
  const a = r2 / (r1 - r2), b = -r1 / (r1 - r2);
  return 1 + a * Math.exp(r1 * tSec) + b * Math.exp(r2 * tSec);
}

/**
 * Progress of `step` at `tMs` (time since the moment started) for the element at `index` (stagger): 0 before the
 * step, exactly 1 from startMs + durationMs on (the spring's fixed settle time), the eased value in between.
 */
export function sample(easings: Readonly<Record<string, EasingDef>>, step: StepDef, tMs: number, index = 0): number {
  const local = tMs - step.startMs - (step.staggerMs ?? 0) * index;
  if (local <= 0) return 0;
  if (local >= step.durationMs) return 1;
  const e = easings[step.easing];
  if (!e) throw new Error(`unknown easing ${step.easing}`);
  return e.kind === "cubic" ? cubicBezier(e.x1, e.y1, e.x2, e.y2, local / step.durationMs) : spring(e.dampingRatio, e.stiffness, e.mass, local / 1000);
}
