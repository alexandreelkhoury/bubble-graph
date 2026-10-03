// Settings stepping (§3: "stepping down from min goes to off; up from off goes to min").
export interface Bound { min: number; max: number; step: number; off?: number }

export function stepValue(v: number, b: Bound, dir: 1 | -1): number {
  if (b.off !== undefined && v === b.off) return dir > 0 ? b.min : b.off;
  const n = v + dir * b.step;
  if (n < b.min) return b.off !== undefined ? b.off : b.min;
  if (n > b.max) return b.max;
  return n;
}

export function canStep(v: number, b: Bound, dir: 1 | -1): boolean {
  return stepValue(v, b, dir) !== v;
}
