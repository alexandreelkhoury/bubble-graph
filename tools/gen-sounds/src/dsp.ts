// Tiny deterministic synthesis toolkit for the game's sound cues (DESIGN §6.4). Everything is computed from
// oscillators, a seeded noise source and biquad filters: no samples, so there is nothing to license.
export const SR = 48_000;

/** mulberry32: a small seeded PRNG, so every render is bit-identical. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Buf {
  readonly data: Float32Array;
  constructor(readonly seconds: number) {
    this.data = new Float32Array(Math.round(seconds * SR));
  }
  get length(): number { return this.data.length; }
  add(i: number, v: number): void {
    if (i >= 0 && i < this.data.length) this.data[i] = (this.data[i] ?? 0) + v;
  }
  get(i: number): number { return this.data[i] ?? 0; }
}

export type Wave = "sine" | "tri" | "saw" | "square";

function osc(wave: Wave, phase: number): number {
  const p = phase - Math.floor(phase);
  switch (wave) {
    case "sine": return Math.sin(2 * Math.PI * p);
    case "tri": return 1 - 4 * Math.abs(p - 0.5);
    case "saw": return 2 * p - 1;
    case "square": return p < 0.5 ? 1 : -1;
  }
}

/** Attack (linear) then exponential decay with time constant `decay`; `release` fades the last seconds linearly. */
export function env(t: number, dur: number, attack: number, decay: number, release = 0.01): number {
  if (t < 0 || t >= dur) return 0;
  const a = attack > 0 && t < attack ? t / attack : 1;
  const d = decay > 0 ? Math.exp(-Math.max(0, t - attack) / decay) : 1;
  const r = release > 0 && t > dur - release ? (dur - t) / release : 1;
  return a * d * r;
}

export interface ToneOpts {
  start: number; dur: number; f0: number; f1?: number; wave?: Wave; amp?: number;
  attack?: number; decay?: number; release?: number;
  /** Glide time for f0 → f1 (exponential), default the whole duration. */
  glide?: number;
  vibratoHz?: number; vibratoCents?: number;
}

/** A pitched oscillator with an optional exponential glide and vibrato. */
export function tone(b: Buf, o: ToneOpts): void {
  const { start, dur, f0 } = o;
  const f1 = o.f1 ?? f0, wave = o.wave ?? "sine", amp = o.amp ?? 0.5;
  const glide = o.glide ?? dur;
  const i0 = Math.round(start * SR), n = Math.round(dur * SR);
  let phase = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const g = Math.min(1, t / glide);
    let f = f0 * Math.pow(f1 / f0, g);
    if (o.vibratoHz) f *= Math.pow(2, ((o.vibratoCents ?? 15) / 1200) * Math.sin(2 * Math.PI * o.vibratoHz * t));
    phase += f / SR;
    b.add(i0 + k, amp * env(t, dur, o.attack ?? 0.003, o.decay ?? 0, o.release ?? 0.01) * osc(wave, phase));
  }
}

export type FilterKind = "lp" | "hp" | "bp";

/** RBJ biquad with a per-block coefficient update, so cutoffs can sweep. */
export class Biquad {
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  constructor(private readonly kind: FilterKind) {}
  set(freq: number, q: number): void {
    const f = Math.min(Math.max(freq, 20), SR * 0.45);
    const w = (2 * Math.PI * f) / SR, cw = Math.cos(w), alpha = Math.sin(w) / (2 * q);
    let b0: number, b1: number, b2: number;
    if (this.kind === "lp") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
    else if (this.kind === "hp") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * cw) / a0; this.a2 = (1 - alpha) / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

export interface NoiseOpts {
  start: number; dur: number; amp?: number; attack?: number; decay?: number; release?: number;
  filter?: FilterKind; f0?: number; f1?: number; q?: number; seed?: number;
}

/** Filtered white noise (seeded) with an envelope; the cutoff sweeps f0 → f1 exponentially. */
export function noise(b: Buf, o: NoiseOpts): void {
  const rand = rng(o.seed ?? 1);
  const i0 = Math.round(o.start * SR), n = Math.round(o.dur * SR);
  const flt = o.filter ? new Biquad(o.filter) : null;
  const f0 = o.f0 ?? 1000, f1 = o.f1 ?? f0, q = o.q ?? 0.9;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    if (flt && k % 32 === 0) flt.set(f0 * Math.pow(f1 / f0, t / o.dur), q);
    let x = rand() * 2 - 1;
    if (flt) x = flt.run(x);
    b.add(i0 + k, (o.amp ?? 0.5) * env(t, o.dur, o.attack ?? 0.001, o.decay ?? 0, o.release ?? 0.005) * x);
  }
}

/** Karplus–Strong plucked string: a seeded burst through a damped delay line. */
export function pluck(b: Buf, o: { start: number; f: number; dur: number; amp?: number; damp?: number; bright?: number; seed?: number }): void {
  const rand = rng(o.seed ?? 7);
  const period = Math.max(2, Math.round(SR / o.f));
  const line = new Float32Array(period);
  const bright = o.bright ?? 0.5;
  let prev = 0;
  for (let i = 0; i < period; i++) {
    const r = rand() * 2 - 1;
    prev = bright * r + (1 - bright) * prev; // a duller excitation for low brightness
    line[i] = prev;
  }
  const damp = o.damp ?? 0.996;
  const i0 = Math.round(o.start * SR), n = Math.round(o.dur * SR);
  let idx = 0;
  for (let k = 0; k < n; k++) {
    const cur = line[idx] ?? 0, next = line[(idx + 1) % period] ?? 0;
    const y = damp * 0.5 * (cur + next);
    line[idx] = y;
    idx = (idx + 1) % period;
    b.add(i0 + k, (o.amp ?? 0.6) * cur * env(k / SR, o.dur, 0, 0, 0.02));
  }
}

/** Two-operator FM (bells, marimba, glass): the modulation index decays faster than the carrier. */
export function fm(b: Buf, o: { start: number; dur: number; f: number; ratio: number; index: number; amp?: number; decay: number; indexDecay?: number; attack?: number }): void {
  const i0 = Math.round(o.start * SR), n = Math.round(o.dur * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const idx = o.index * Math.exp(-t / (o.indexDecay ?? o.decay / 3));
    const m = Math.sin(2 * Math.PI * o.f * o.ratio * t);
    const y = Math.sin(2 * Math.PI * o.f * t + idx * m);
    b.add(i0 + k, (o.amp ?? 0.5) * env(t, o.dur, o.attack ?? 0.002, o.decay) * y);
  }
}

/** A bright saw through a sweeping resonant low-pass: brass "wah" and muted horns. */
export function brass(b: Buf, o: { start: number; dur: number; f0: number; f1?: number; cut0: number; cut1: number; q?: number; amp?: number; attack?: number; decay?: number; vibratoHz?: number }): void {
  const tmp = new Buf(o.dur);
  tone(tmp, { start: 0, dur: o.dur, f0: o.f0, f1: o.f1, wave: "saw", amp: 1, attack: o.attack ?? 0.02, decay: o.decay ?? 0, release: 0.04, vibratoHz: o.vibratoHz, vibratoCents: 12 });
  // A second, slightly detuned saw thickens the section.
  tone(tmp, { start: 0, dur: o.dur, f0: o.f0 * 1.004, f1: (o.f1 ?? o.f0) * 1.004, wave: "saw", amp: 0.7, attack: o.attack ?? 0.02, decay: o.decay ?? 0, release: 0.04 });
  const lp = new Biquad("lp");
  const i0 = Math.round(o.start * SR);
  for (let k = 0; k < tmp.length; k++) {
    const t = k / SR;
    if (k % 32 === 0) {
      const g = t / o.dur;
      const shape = Math.sin(Math.PI * Math.min(1, g * 1.2)); // opens then closes: the "wah"
      lp.set(o.cut0 + (o.cut1 - o.cut0) * shape, o.q ?? 3);
    }
    b.add(i0 + k, (o.amp ?? 0.3) * lp.run(tmp.get(k)));
  }
}

/** Darbuka "doum" (low, open) or "tek" (rim, bright): a pitch-dropping membrane plus a filtered slap. */
export function darbuka(b: Buf, start: number, stroke: "doum" | "tek" | "ka", amp = 0.7, seed = 3): void {
  if (stroke === "doum") {
    tone(b, { start, dur: 0.35, f0: 150, f1: 92, glide: 0.06, amp: amp * 0.9, attack: 0.001, decay: 0.11, release: 0.03 });
    noise(b, { start, dur: 0.03, amp: amp * 0.25, filter: "bp", f0: 900, q: 1.2, decay: 0.008, seed });
  } else {
    const f = stroke === "tek" ? 520 : 470;
    tone(b, { start, dur: 0.12, f0: f * 1.3, f1: f, glide: 0.01, amp: amp * 0.35, attack: 0.0005, decay: 0.03 });
    noise(b, { start, dur: 0.08, amp: amp * 0.7, filter: "bp", f0: stroke === "tek" ? 3800 : 3000, q: 1.4, decay: 0.018, seed });
  }
}

/** Snare hit: a short body tone plus band-passed noise. */
export function snare(b: Buf, start: number, amp: number, seed: number): void {
  tone(b, { start, dur: 0.08, f0: 230, f1: 180, amp: amp * 0.35, attack: 0.0005, decay: 0.02 });
  noise(b, { start, dur: 0.12, amp, filter: "bp", f0: 2600, q: 0.8, decay: 0.035, seed });
}

/** Finger snap: a very short, bright noise crack with a resonant body. */
export function snap(b: Buf, start: number, amp = 0.8, seed = 11): void {
  noise(b, { start, dur: 0.05, amp, filter: "bp", f0: 2200, q: 2.5, decay: 0.009, seed });
  noise(b, { start, dur: 0.02, amp: amp * 0.5, filter: "hp", f0: 6000, decay: 0.004, seed: seed + 1 });
}

export const note = (semitonesFromA4: number): number => 440 * Math.pow(2, semitonesFromA4 / 12);

/**
 * Normalises a cue: removes DC, fades the tail, then scales so the RMS of the loudest 100 ms window hits the
 * target loudness without the peak exceeding `peakDb` (DESIGN: peaks ≤ −1 dBTP). Returns the applied gain.
 */
export function master(b: Buf, targetDb: number, peakDb = -1): number {
  const d = b.data;
  let mean = 0;
  for (const v of d) mean += v;
  mean /= d.length || 1;
  const fade = Math.min(d.length, Math.round(0.015 * SR));
  for (let i = 0; i < d.length; i++) {
    let v = (d[i] ?? 0) - mean;
    if (i < 48) v *= i / 48;
    if (i >= d.length - fade) v *= (d.length - i) / fade;
    d[i] = v;
  }
  let peak = 0;
  for (const v of d) peak = Math.max(peak, Math.abs(v));
  const win = Math.round(0.1 * SR);
  let best = 0, acc = 0;
  for (let i = 0; i < d.length; i++) {
    acc += (d[i] ?? 0) ** 2;
    if (i >= win) acc -= (d[i - win] ?? 0) ** 2;
    best = Math.max(best, acc / Math.min(i + 1, win));
  }
  const rms = Math.sqrt(best);
  if (peak === 0 || rms === 0) return 0;
  const gain = Math.min(Math.pow(10, targetDb / 20) / rms, Math.pow(10, peakDb / 20) / peak);
  for (let i = 0; i < d.length; i++) d[i] = (d[i] ?? 0) * gain;
  return gain;
}

/** 16-bit PCM mono WAV. */
export function wav(b: Buf): Buffer {
  const n = b.length;
  const out = Buffer.alloc(44 + n * 2);
  out.write("RIFF", 0); out.writeUInt32LE(36 + n * 2, 4); out.write("WAVE", 8);
  out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write("data", 36); out.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, b.get(i))) * 32767), 44 + i * 2);
  return out;
}
