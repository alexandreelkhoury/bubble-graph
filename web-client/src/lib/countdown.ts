// Countdown math (§8.5): remaining = deadline.at − (Date.now() + clockOffset).
// clockOffset = the largest of the last 5 samples of (serverNow − Date.now()) taken at receipt.

export class ClockOffset {
  private samples: number[] = [];
  constructor(private readonly size = 5) {}
  /** Adds a sample taken when a `state` arrives. */
  add(serverNow: number, localNow: number): number {
    this.samples.push(serverNow - localNow);
    if (this.samples.length > this.size) this.samples.shift();
    return this.value;
  }
  get value(): number {
    return this.samples.length === 0 ? 0 : Math.max(...this.samples);
  }
  reset(): void { this.samples = []; }
}

/** Milliseconds left before `at` on the server clock (never negative). */
export function remainingMs(at: number, localNow: number, offset: number): number {
  return Math.max(0, at - (localNow + offset));
}

/** Whole seconds shown on a timer: ceil, so "1" shows until the very end. */
export function secondsLeft(at: number, localNow: number, offset: number): number {
  return Math.ceil(remainingMs(at, localNow, offset) / 1000);
}

/** Fraction of the deadline still left, 0..1. */
export function fractionLeft(at: number, durationMs: number, localNow: number, offset: number): number {
  if (durationMs <= 0) return 0;
  return Math.min(1, remainingMs(at, localNow, offset) / durationMs);
}

export type TimerTone = "normal" | "warn" | "danger";
/** DESIGN TV-05: `text` until 10 s, `accent` until 5 s, then `danger`. */
export function timerTone(seconds: number): TimerTone {
  return seconds <= 5 ? "danger" : seconds <= 10 ? "warn" : "normal";
}
