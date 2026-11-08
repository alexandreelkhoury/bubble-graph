// JAMAA-PLATFORM §3.8 web runner: one requestAnimationFrame loop over the shared sampler. `complete()` jumps to the end
// state (the TV input rule: OK completes a running choreography, §3.10 E). Zod-free; uses only browser globals at call time.
import { endMs, sample } from "./choreo";
import type { Step } from "./choreo";

export interface Run {
  /** Jumps to the end state and calls onDone (once). */
  complete(): void;
  /** Stops without calling onDone. */
  cancel(): void;
  readonly running: boolean;
}

/** `p(id, index)` = that step's progress for element `index` at time `tMs`; an unknown id reads as finished (1). */
export type Frame = (p: (id: string, index?: number) => number, tMs: number) => void;

export interface RunnerClock {
  request(cb: (nowMs: number) => void): number;
  cancel(handle: number): void;
}

/** The browser's rAF, read from globalThis (shared compiles without the DOM lib). */
const rafClock = (): RunnerClock | null => {
  const g = globalThis as { requestAnimationFrame?: (cb: (now: number) => void) => number; cancelAnimationFrame?: (h: number) => void };
  const req = g.requestAnimationFrame, can = g.cancelAnimationFrame;
  return req && can ? { request: (cb) => req(cb), cancel: (h) => can(h) } : null;
};

/** Runs `steps` (with `count` staggered elements): `frame` on every animation frame, `onDone` once at the end. */
export function run(steps: readonly Step[], frame: Frame, onDone?: () => void, count = 1, clock: RunnerClock | null = rafClock()): Run {
  const total = endMs(steps, count);
  const byId = new Map(steps.map((s) => [s.id, s]));
  const at = (t: number) => (id: string, index = 0): number => {
    const s = byId.get(id);
    return s ? sample(s, t, index) : 1;
  };
  let handle = 0;
  let done = false;
  let t0 = -1;
  const finish = (): void => {
    if (done) return;
    done = true;
    if (handle && clock) clock.cancel(handle);
    frame(at(total), total);
    onDone?.();
  };
  const tick = (now: number): void => {
    if (done) return;
    if (t0 < 0) t0 = now;
    const t = now - t0;
    if (t >= total) {
      finish();
      return;
    }
    frame(at(t), t);
    handle = clock ? clock.request(tick) : 0;
  };
  if (total <= 0 || !clock) {
    queueMicrotask(finish);
  } else {
    frame(at(0), 0);
    handle = clock.request(tick);
  }
  return {
    complete: finish,
    cancel: () => {
      if (!done) {
        done = true;
        if (handle && clock) clock.cancel(handle);
      }
    },
    get running() {
      return !done;
    },
  };
}
