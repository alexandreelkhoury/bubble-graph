// Game cue manifest for `taqriban` (GAME-TAQRIBAN §12.2). Original recipes over src/dsp.ts (oscillators, seeded noise,
// FM): no samples, nothing to license. File names become taqriban_*. The world fanfare (`sting.taqribanIntro`) is the
// platform cue `world_taqriban_sting` (src/platform-cues.ts ALIASES).
//
// The observatory: guesses land on a brass ruler like soft weights, then the true answer's pin drops with a deep thud and
// a bell; "Closest!" is a bright two-note chime.
import { fm, noise, note, tone } from "../src/dsp.ts";

const E5 = note(7), A5 = note(12), C6 = note(15), E6 = note(19);

/** @type {readonly import("../src/cues").CueDef[]} */
export const CUES = [
  {
    // §8.3: one guess lands on the line: a short woody plink (the client may pitch it up per guess).
    id: "taqriban.drop", bus: "sfx", seconds: 0.22, targetDb: -21,
    render(b) {
      fm(b, { start: 0, dur: 0.2, f: 660, ratio: 2.01, index: 1.2, amp: 0.55, decay: 0.035, attack: 0.0006, indexDecay: 0.02 });
      noise(b, { start: 0, dur: 0.02, amp: 0.2, filter: "bp", f0: 3200, q: 2.2, decay: 0.004, seed: 501 });
    },
  },
  {
    // §8.3: the true answer's pin falls: an air drop, a deep thud on the ruler, then a single observatory bell.
    id: "taqriban.pin", bus: "sfx", seconds: 1.3, targetDb: -15,
    render(b) {
      noise(b, { start: 0, dur: 0.3, amp: 0.35, filter: "bp", f0: 4200, f1: 900, q: 0.9, attack: 0.2, release: 0.05, seed: 511 });
      tone(b, { start: 0.3, dur: 0.5, f0: 120, f1: 55, amp: 0.9, attack: 0.002, decay: 0.12, release: 0.1 });
      noise(b, { start: 0.3, dur: 0.08, amp: 0.4, filter: "lp", f0: 1600, q: 0.8, decay: 0.02, seed: 512 });
      fm(b, { start: 0.32, dur: 0.95, f: A5, ratio: 3.5, index: 1.6, amp: 0.32, decay: 0.3, attack: 0.001 });
    },
  },
  {
    // §8.3: "Closest!" stamps: two bright rising bell notes and a sparkle.
    id: "taqriban.closest", bus: "sfx", seconds: 0.9, targetDb: -16,
    render(b) {
      [E5, C6].forEach((f, i) => fm(b, { start: i * 0.1, dur: 0.6, f, ratio: 3.5, index: 1.3, amp: 0.38, decay: 0.2, attack: 0.0008 }));
      for (let i = 0; i < 5; i++) tone(b, { start: 0.2 + i * 0.07, dur: 0.1, f0: E6 * (1 + 0.05 * i), amp: 0.05, attack: 0.002, decay: 0.03, release: 0.03 });
    },
  },
];
