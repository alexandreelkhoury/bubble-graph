import type { Catalog } from "./catalog";
import type { Rng } from "./rng";
import type { DeadlineKind, GameState } from "./types";

/** Mutable working copy used inside one `reduce` call. */
export interface Draft { s: GameState; now: number; rng: Rng; catalog: Catalog }

/** Arms a new deadline `ms` from now; `ms <= 0` means the timer is off (no deadline). */
export function setDeadline(d: Draft, kind: DeadlineKind, ms: number): void {
  if (ms <= 0) {
    d.s.deadline = null;
    return;
  }
  d.s.deadlineSeq += 1;
  d.s.deadline = { id: d.s.deadlineSeq, kind, at: d.now + ms, durationMs: ms };
}
