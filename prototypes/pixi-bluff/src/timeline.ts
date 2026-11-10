// A tiny timeline on the shared JAMAA easings (@jamaa/shared/motion: the same cubic-bezier + spring sampler the web and
// the native TV use). `finish()` jumps to the end state: the TV input rule "OK completes a running choreography".
import { EASINGS, cubicBezier, spring } from "@jamaa/shared/motion";
import type { EasingId } from "@jamaa/shared/motion";

export function ease(id: EasingId, p: number, durMs: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const e = EASINGS[id];
  return e.kind === "cubic" ? cubicBezier(e.x1, e.y1, e.x2, e.y2, p) : spring(e.dampingRatio, e.stiffness, e.mass, (p * durMs) / 1000);
}

interface Track { start: number; dur: number; easing: EasingId; fn: (v: number, p: number) => void; state: 0 | 1 | 2 }
interface Call { at: number; fn: () => void; fired: boolean; seq: number }

export class Timeline {
  t = 0;
  private tracks: Track[] = [];
  private calls: Call[] = [];
  private seq = 0;

  /** fn(easedValue, linearProgress) runs every frame from `start` until `start + dur` (always once at exactly 1). */
  tween(start: number, dur: number, fn: (v: number, p: number) => void, easing: EasingId = "ease.standard"): this {
    this.tracks.push({ start, dur: Math.max(1, dur), easing, fn, state: 0 });
    return this;
  }

  at(at: number, fn: () => void): this {
    this.calls.push({ at, fn, fired: false, seq: this.seq++ });
    return this;
  }

  get end(): number {
    let e = 0;
    for (const t of this.tracks) e = Math.max(e, t.start + t.dur);
    for (const c of this.calls) e = Math.max(e, c.at);
    return e;
  }

  get done(): boolean {
    return this.t >= this.end && this.tracks.every((t) => t.state === 2) && this.calls.every((c) => c.fired);
  }

  update(dt: number): void {
    this.t += dt;
    this.flush(this.t);
  }

  /** Jump to the end: every pending call and tween settles in time order. */
  finish(): void {
    this.t = Math.max(this.t, this.end);
    this.flush(this.t);
  }

  /**
   * Applies everything due at `now` in time order: calls at their time, finished tweens at their end time, running
   * tweens last. Interleaving matters for finish(): a call at 3 s must run after a tween that ended at 2 s.
   */
  private flush(now: number): void {
    const settled = new Set<Track>();
    for (;;) {
      let best: { key: number; call?: Call; track?: Track } | null = null;
      for (const c of this.calls) {
        if (c.fired || c.at > now) continue;
        if (!best || c.at < best.key || (c.at === best.key && best.call && c.seq < best.call.seq)) best = { key: c.at, call: c };
      }
      for (const tr of this.tracks) {
        if (tr.state === 2 || now < tr.start || settled.has(tr)) continue;
        const key = Math.min(now, tr.start + tr.dur);
        if (!best || key < best.key || (key === best.key && best.call)) best = { key, track: tr }; // a tween ending at t settles before a call at t
      }
      if (!best) return;
      if (best.call) {
        best.call.fired = true;
        best.call.fn();
      } else if (best.track) {
        const tr = best.track;
        const p = Math.min(1, (now - tr.start) / tr.dur);
        tr.state = p >= 1 ? 2 : 1;
        settled.add(tr);
        tr.fn(ease(tr.easing, p, tr.dur), p);
      }
    }
  }
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Quadratic Bézier, for arcs ("everything that travels uses an arc"). */
export const qbez = (a: number, c: number, b: number, t: number): number => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
/** Steps a time to the 12 fps drawing clock (83 ms). */
export const onTwelves = (ms: number): number => Math.floor(ms / 83.333) * 83.333;
