// JAMAA-PLATFORM §3.8 web runner: one requestAnimationFrame loop over the sampler. `complete()` jumps to the end state
// (the TV input rule: OK completes a running choreography, §3.10 E). JAMAA-GAP: moves to `@jamaa/shared/motion` (lane A).
import { endMs, sample } from "./choreo";
import type { Step } from "./choreo";

export interface Run {
  /** Jumps to the end state and calls onDone (once). */
  complete(): void;
  /** Stops without calling onDone. */
  cancel(): void;
  readonly running: boolean;
}

export type Frame = (p: (id: string, index?: number) => number, tMs: number) => void;

/** Runs `steps`: `frame` gets a sampler of each step's progress at the current time; `onDone` once at the end. */
export function run(steps: readonly Step[], frame: Frame, onDone?: () => void, count = 1): Run {
  const total = endMs(steps, count);
  const byId = new Map(steps.map((s) => [s.id, s]));
  const at = (t: number) => (id: string, index = 0): number => {
    const s = byId.get(id);
    return s ? sample(s, t, index) : 1;
  };
  let raf = 0;
  let done = false;
  let t0 = -1;
  const finish = (): void => {
    if (done) return;
    done = true;
    if (raf) cancelAnimationFrame(raf);
    frame(at(total), total);
    onDone?.();
  };
  const tick = (now: number): void => {
    if (done) return;
    if (t0 < 0) t0 = now;
    const t = now - t0;
    if (t >= total) { finish(); return; }
    frame(at(t), t);
    raf = requestAnimationFrame(tick);
  };
  if (total <= 0 || typeof requestAnimationFrame === "undefined") {
    queueMicrotask(finish);
  } else {
    frame(at(0), 0);
    raf = requestAnimationFrame(tick);
  }
  return {
    complete: finish,
    cancel: () => { if (!done) { done = true; if (raf) cancelAnimationFrame(raf); } },
    get running() { return !done; },
  };
}
