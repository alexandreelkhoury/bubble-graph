// The cue catalogue (DESIGN §6.4 plus three remote UI cues): each cue is a short recipe over dsp.ts.
// Lebanese signature: a darbuka motif runs through the stings.
import { brass, darbuka, fm, noise, note, pluck, snap, snare, tone } from "./dsp";
import type { Buf } from "./dsp";

export type Bus = "sfx" | "sting" | "ui";

export interface CueDef {
  /** The DESIGN id, e.g. `sfx.allReady`. */
  id: string;
  bus: Bus;
  seconds: number;
  /** Loudness target (dB of the loudest 100 ms window RMS) before the −1 dB peak ceiling. */
  targetDb: number;
  render(b: Buf): void;
}

/** `sfx.allReady` → `sfx_all_ready` (an Android res/raw name and the web file name). */
export function fileName(id: string): string {
  return id.replace(/\./g, "_").replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}

const C5 = note(3), E5 = note(7), G5 = note(10), C6 = note(15);

export const CUES: readonly CueDef[] = [
  {
    id: "sfx.join", bus: "sfx", seconds: 0.45, targetDb: -16,
    render(b) {
      tone(b, { start: 0, dur: 0.06, f0: 280, f1: 950, glide: 0.035, amp: 0.6, attack: 0.001, decay: 0.03 });
      pluck(b, { start: 0.02, f: C5, dur: 0.43, amp: 0.7, damp: 0.996, bright: 0.75, seed: 21 });
      pluck(b, { start: 0.075, f: C5 * 1.5, dur: 0.37, amp: 0.35, damp: 0.995, bright: 0.6, seed: 22 });
    },
  },
  {
    id: "sfx.leave", bus: "sfx", seconds: 0.5, targetDb: -19,
    render(b) {
      pluck(b, { start: 0, f: note(7), dur: 0.3, amp: 0.6, damp: 0.994, bright: 0.6, seed: 31 });
      pluck(b, { start: 0.11, f: note(0), dur: 0.38, amp: 0.55, damp: 0.994, bright: 0.5, seed: 32 });
      tone(b, { start: 0, dur: 0.4, f0: 620, f1: 300, amp: 0.12, attack: 0.01, decay: 0.12 });
    },
  },
  {
    id: "sfx.ready", bus: "sfx", seconds: 0.14, targetDb: -20,
    render(b) {
      fm(b, { start: 0, dur: 0.14, f: 1150, ratio: 2.41, index: 2.2, amp: 0.6, decay: 0.025, attack: 0.0005 });
      noise(b, { start: 0, dur: 0.03, amp: 0.25, filter: "bp", f0: 2200, q: 2, decay: 0.006, seed: 41 });
    },
  },
  {
    id: "sfx.allReady", bus: "sfx", seconds: 0.62, targetDb: -16,
    render(b) {
      [C5, E5, G5].forEach((f, i) => {
        fm(b, { start: i * 0.1, dur: i === 2 ? 0.5 : 0.25, f, ratio: 4, index: 1.6, amp: 0.45, decay: i === 2 ? 0.18 : 0.09 });
        fm(b, { start: i * 0.1, dur: 0.2, f: f * 2, ratio: 3, index: 0.6, amp: 0.1, decay: 0.05 });
      });
    },
  },
  {
    id: "sfx.turn", bus: "sfx", seconds: 0.75, targetDb: -15,
    render(b) {
      snap(b, 0, 0.9, 51);
      fm(b, { start: 0.05, dur: 0.7, f: 880, ratio: 3.5, index: 2.6, amp: 0.45, decay: 0.22, indexDecay: 0.05 });
      fm(b, { start: 0.05, dur: 0.6, f: 1320, ratio: 1.0, index: 0.3, amp: 0.12, decay: 0.15 });
    },
  },
  {
    id: "sfx.tick", bus: "sfx", seconds: 0.07, targetDb: -21,
    render(b) {
      noise(b, { start: 0, dur: 0.05, amp: 0.7, filter: "bp", f0: 3400, q: 4, decay: 0.005, seed: 61 });
      tone(b, { start: 0, dur: 0.04, f0: 1700, amp: 0.25, attack: 0.0003, decay: 0.006 });
    },
  },
  {
    id: "sfx.tickLast", bus: "sfx", seconds: 0.1, targetDb: -18,
    render(b) {
      noise(b, { start: 0, dur: 0.06, amp: 0.7, filter: "bp", f0: 4600, q: 4, decay: 0.006, seed: 62 });
      tone(b, { start: 0, dur: 0.08, f0: 2500, amp: 0.35, attack: 0.0003, decay: 0.014 });
    },
  },
  {
    id: "sfx.timeUp", bus: "sfx", seconds: 0.8, targetDb: -17,
    render(b) {
      brass(b, { start: 0, dur: 0.32, f0: note(-11), cut0: 350, cut1: 1100, q: 2, amp: 0.35, attack: 0.02 });
      brass(b, { start: 0.3, dur: 0.48, f0: note(-14), f1: note(-15), cut0: 300, cut1: 900, q: 2, amp: 0.35, attack: 0.03, decay: 0.4 });
    },
  },
  {
    id: "sfx.voteCast", bus: "sfx", seconds: 0.16, targetDb: -21,
    render(b) {
      noise(b, { start: 0, dur: 0.12, amp: 0.8, filter: "bp", f0: 5200, f1: 1900, q: 1.1, decay: 0.03, seed: 71 });
      noise(b, { start: 0.005, dur: 0.02, amp: 0.25, filter: "hp", f0: 7000, decay: 0.004, seed: 72 });
    },
  },
  {
    id: "sfx.drumroll", bus: "sfx", seconds: 2.3, targetDb: -15,
    render(b) {
      // A snare roll accelerating and swelling into a cymbal choke (DESIGN §6.2-B: lock → suspense).
      let t = 0, i = 0;
      while (t < 1.85) {
        const g = t / 1.85;
        snare(b, t, 0.12 + 0.6 * g * g, 100 + i);
        t += 1 / (16 + 16 * g);
        i++;
      }
      snare(b, 1.9, 0.9, 99);
      tone(b, { start: 1.9, dur: 0.3, f0: 95, f1: 55, amp: 0.5, attack: 0.001, decay: 0.08 });
      noise(b, { start: 1.9, dur: 0.36, amp: 0.55, filter: "hp", f0: 5200, q: 0.7, decay: 0.12, release: 0.08, seed: 98 });
    },
  },
  {
    id: "sfx.chipLand", bus: "sfx", seconds: 0.22, targetDb: -21,
    render(b) {
      fm(b, { start: 0, dur: 0.22, f: C6, ratio: 4, index: 1.3, amp: 0.5, decay: 0.05, attack: 0.0005 });
      fm(b, { start: 0, dur: 0.15, f: C6 / 2, ratio: 1, index: 0.2, amp: 0.2, decay: 0.04 });
    },
  },
  {
    id: "sfx.stamp", bus: "sfx", seconds: 0.45, targetDb: -13,
    render(b) {
      tone(b, { start: 0, dur: 0.4, f0: 130, f1: 52, glide: 0.06, amp: 0.9, attack: 0.0008, decay: 0.09 });
      noise(b, { start: 0, dur: 0.12, amp: 0.5, filter: "lp", f0: 900, q: 0.8, decay: 0.03, seed: 81 });
      noise(b, { start: 0, dur: 0.05, amp: 0.22, filter: "bp", f0: 1800, q: 1.4, decay: 0.012, seed: 82 });
    },
  },
  {
    id: "sfx.flip", bus: "sfx", seconds: 0.42, targetDb: -18,
    render(b) {
      noise(b, { start: 0, dur: 0.36, amp: 0.7, filter: "bp", f0: 700, f1: 5200, q: 1.6, attack: 0.16, decay: 0.07, release: 0.05, seed: 91 });
      noise(b, { start: 0.3, dur: 0.06, amp: 0.25, filter: "bp", f0: 3000, q: 2, decay: 0.01, seed: 92 });
    },
  },
  {
    id: "sfx.heartbeat", bus: "sfx", seconds: 0.6, targetDb: -15,
    render(b) {
      for (const [s, a] of [[0, 0.95], [0.19, 0.7]] as const) {
        tone(b, { start: s, dur: 0.28, f0: 72, f1: 44, glide: 0.08, amp: a, attack: 0.004, decay: 0.07 });
        noise(b, { start: s, dur: 0.06, amp: a * 0.25, filter: "lp", f0: 260, q: 0.7, decay: 0.02, seed: 111 });
      }
    },
  },
  {
    id: "sfx.wheel", bus: "sfx", seconds: 2.0, targetDb: -19,
    render(b) {
      let t = 0, gap = 0.04, i = 0;
      while (t < 1.9) {
        noise(b, { start: t, dur: 0.02, amp: 0.6, filter: "bp", f0: 3200, q: 3, decay: 0.003, seed: 120 + i });
        tone(b, { start: t, dur: 0.02, f0: 1250, amp: 0.2, attack: 0.0003, decay: 0.004 });
        t += gap;
        gap *= 1.085;
        i++;
      }
    },
  },
  {
    id: "sfx.error", bus: "sfx", seconds: 0.36, targetDb: -19,
    render(b) {
      tone(b, { start: 0, dur: 0.15, f0: 247, wave: "tri", amp: 0.5, attack: 0.005, release: 0.03 });
      tone(b, { start: 0.16, dur: 0.2, f0: 185, wave: "tri", amp: 0.5, attack: 0.005, decay: 0.15, release: 0.04 });
    },
  },
  {
    id: "sting.civilian", bus: "sting", seconds: 1.6, targetDb: -16,
    render(b) {
      // A sympathetic "aww": two sagging brass wahs.
      darbuka(b, 0, "doum", 0.6, 131);
      brass(b, { start: 0.02, dur: 0.48, f0: note(-11), f1: note(-12), cut0: 300, cut1: 1600, q: 3, amp: 0.3, attack: 0.03 });
      brass(b, { start: 0.5, dur: 1.05, f0: note(-13), f1: note(-14.5), cut0: 280, cut1: 1400, q: 3, amp: 0.3, attack: 0.04, decay: 0.9, vibratoHz: 5.5 });
    },
  },
  {
    id: "sting.mole", bus: "sting", seconds: 1.3, targetDb: -16,
    render(b) {
      // A sly pizzicato "gotcha" (tiptoe up a chromatic line, then a low pounce).
      [note(-7), note(-4), note(-1), note(0)].forEach((f, i) =>
        pluck(b, { start: i * 0.13, f, dur: 0.25, amp: 0.6, damp: 0.985, bright: 0.55, seed: 140 + i }));
      pluck(b, { start: 0.62, f: note(-19), dur: 0.65, amp: 0.85, damp: 0.993, bright: 0.45, seed: 145 });
      darbuka(b, 0.62, "doum", 0.6, 146);
      snap(b, 0.62, 0.7, 147);
    },
  },
  {
    id: "sting.blank", bus: "sting", seconds: 1.8, targetDb: -17,
    render(b) {
      // A bowed, glassy "ooh": slow-attack partials with a gentle vibrato.
      for (const [f, a] of [[note(10), 0.35], [note(10) * 2.01, 0.1], [note(10) * 3.02, 0.05], [note(5), 0.22]] as const) {
        tone(b, { start: 0, dur: 1.75, f0: f, f1: f * 1.012, amp: a, attack: 0.45, decay: 0.9, release: 0.3, vibratoHz: 5, vibratoCents: 10 });
      }
      fm(b, { start: 0.05, dur: 1.5, f: note(22), ratio: 2.76, index: 0.8, amp: 0.06, decay: 0.5 });
    },
  },
  {
    id: "sting.correct", bus: "sting", seconds: 2.2, targetDb: -14,
    render(b) {
      // A gasp (an inhaled breath), then a crash cymbal and a doum.
      noise(b, { start: 0, dur: 0.42, amp: 0.45, filter: "bp", f0: 1100, f1: 2600, q: 1.2, attack: 0.3, decay: 0, release: 0.08, seed: 151 });
      darbuka(b, 0.44, "doum", 0.8, 152);
      noise(b, { start: 0.44, dur: 1.7, amp: 0.55, filter: "hp", f0: 4200, f1: 6500, q: 0.6, decay: 0.55, release: 0.3, seed: 153 });
      fm(b, { start: 0.44, dur: 1.5, f: note(15), ratio: 3.5, index: 2, amp: 0.2, decay: 0.45 });
    },
  },
  {
    id: "sting.wrong", bus: "sting", seconds: 0.95, targetDb: -16,
    render(b) {
      // A soft cartoon "bwomp": a wobbling, falling hum (never harsh).
      tone(b, { start: 0, dur: 0.9, f0: 330, f1: 105, glide: 0.55, wave: "tri", amp: 0.5, attack: 0.02, decay: 0.5, release: 0.15, vibratoHz: 7, vibratoCents: 60 });
      tone(b, { start: 0, dur: 0.9, f0: 165, f1: 52, glide: 0.55, amp: 0.4, attack: 0.02, decay: 0.5, release: 0.15 });
    },
  },
  {
    id: "sting.winCivilians", bus: "sting", seconds: 3.0, targetDb: -14,
    render(b) {
      // A maqsum darbuka groove (D T . T D . T .) into a major brass hit.
      const e = 0.2;
      const bar: (null | "doum" | "tek" | "ka")[] = ["doum", "tek", null, "tek", "doum", null, "tek", "ka"];
      for (let i = 0; i < 9; i++) {
        const s = bar[i % 8];
        if (s) darbuka(b, i * e, s, s === "doum" ? 0.75 : 0.5, 160 + i);
      }
      const hit = 8 * e;
      for (const f of [note(-9), note(-5), note(-2), note(3)]) {
        brass(b, { start: hit, dur: 1.35, f0: f, cut0: 900, cut1: 3200, q: 1.2, amp: 0.13, attack: 0.012, decay: 0.7 });
      }
      darbuka(b, hit, "doum", 0.9, 170);
      noise(b, { start: hit, dur: 1.2, amp: 0.2, filter: "hp", f0: 5000, decay: 0.4, release: 0.2, seed: 171 });
    },
  },
  {
    id: "sting.winInfiltrators", bus: "sting", seconds: 3.0, targetDb: -14,
    render(b) {
      // A sly walking bass with finger snaps on the off-beats and a light darbuka.
      const line: [number, number][] = [[0, -29], [0.36, -29], [0.6, -26], [0.84, -24], [1.08, -23], [1.32, -24], [1.56, -26], [1.92, -29]];
      line.forEach(([s, n], i) => pluck(b, { start: s, f: note(n), dur: i === line.length - 1 ? 1.05 : 0.34, amp: 0.85, damp: 0.995, bright: 0.35, seed: 180 + i }));
      for (const s of [0.24, 0.72, 1.2, 1.68]) snap(b, s, 0.75, 190 + Math.round(s * 10));
      for (const [s, k] of [[0, "doum"], [0.48, "tek"], [0.96, "doum"], [1.44, "tek"], [1.92, "doum"]] as const) darbuka(b, s, k, 0.45, 200 + Math.round(s * 10));
      snap(b, 2.04, 0.9, 210);
      pluck(b, { start: 1.92, f: note(-17), dur: 1.0, amp: 0.35, damp: 0.994, bright: 0.5, seed: 211 });
    },
  },
  {
    id: "ui.move", bus: "ui", seconds: 0.045, targetDb: -32,
    render(b) {
      tone(b, { start: 0, dur: 0.045, f0: 1900, f1: 2100, amp: 0.4, attack: 0.002, decay: 0.008 });
    },
  },
  {
    id: "ui.select", bus: "ui", seconds: 0.12, targetDb: -26,
    render(b) {
      noise(b, { start: 0, dur: 0.02, amp: 0.3, filter: "bp", f0: 3000, q: 2, decay: 0.004, seed: 221 });
      tone(b, { start: 0, dur: 0.12, f0: 1320, f1: 1760, glide: 0.04, amp: 0.4, attack: 0.002, decay: 0.035 });
    },
  },
  {
    id: "ui.back", bus: "ui", seconds: 0.12, targetDb: -27,
    render(b) {
      tone(b, { start: 0, dur: 0.12, f0: 1320, f1: 880, glide: 0.05, amp: 0.4, attack: 0.002, decay: 0.035 });
    },
  },
];
