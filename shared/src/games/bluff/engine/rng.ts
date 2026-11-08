// GAME-BLUFF §4: randomness. mulberry32 is the platform generator (shared/src/room/rng.ts); its state lives in
// BluffState.rngState, so every reduce is deterministic.
import { createRng, type Rng } from "../../../room/rng";

export { createRng, type Rng };

/** Fisher–Yates, in place, driven by `rng`. */
export function shuffleInPlace<T>(rng: Rng, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const t = xs[i] as T;
    xs[i] = xs[j] as T;
    xs[j] = t;
  }
  return xs;
}

/** 8 lowercase hex chars from the RNG (option and prompt ids: no order or kind information). */
export function hexId(rng: Rng): string {
  return Math.floor(rng.next() * 0x1_0000_0000).toString(16).padStart(8, "0");
}

/** Weighted pick (weights > 0). Returns the index. */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i] as number;
    if (x < 0) return i;
  }
  return weights.length - 1;
}
