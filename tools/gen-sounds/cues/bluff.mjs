// Game cue manifest for `bluff` (GAME-BLUFF §12.6, DESIGN-JAMAA §5.5). Owned by the G2 lane D. Original recipes over
// src/dsp.ts: synthesised from scratch (no samples, no melody or sound taken from any other game), so nothing to license.
// The café's colour is hijaz on D (D E♭ F♯ G A B♭ C), with a darbuka under the stings, like the platform's café sting.
// Aliases already served by the platform (src/platform-cues.ts): sting.bluffIntro → world_bluff_sting,
// bluff.coin → coin_land (stepped up a pentatonic by the player), bluff.truth → truth_reveal, bluff.stampHouse → house_got_you.
// GAME-BLUFF's `sting.noTruth` and `sting.award` are `bluff.noTruth` and `bluff.award` here: a game manifest only holds
// `bluff.*` ids (loadGameCues), and the platform alias table is not this lane's file.
import { brass, darbuka, fm, noise, note, pluck, snap, tone } from "../src/dsp.ts";

const D4 = note(-7), Eb4 = note(-6), Fs4 = note(-3), G4 = note(-2), A4 = note(0), Bb4 = note(1), C5 = note(3);
const D5 = note(5), E5 = note(7), Fs5 = note(9), A5 = note(12), D6 = note(17);

/** @type {readonly import("../src/cues").CueDef[]} */
export const CUES = [
  {
    // A lie slides into the envelope box (WRITING, `done`): a paper swish, then a soft cardboard thunk.
    id: "bluff.envelope", bus: "sfx", seconds: 0.5, targetDb: -21,
    render(b) {
      noise(b, { start: 0, dur: 0.3, amp: 0.45, filter: "bp", f0: 3200, f1: 1100, q: 1.1, attack: 0.06, decay: 0.16, release: 0.05, seed: 901 });
      noise(b, { start: 0.02, dur: 0.24, amp: 0.15, filter: "hp", f0: 5200, attack: 0.05, decay: 0.12, release: 0.04, seed: 902 });
      tone(b, { start: 0.29, dur: 0.16, f0: 170, f1: 85, glide: 0.05, amp: 0.55, attack: 0.001, decay: 0.05, release: 0.03 });
      noise(b, { start: 0.29, dur: 0.06, amp: 0.3, filter: "lp", f0: 700, decay: 0.015, seed: 903 });
    },
  },
  {
    // A character lands on a card in the reveal (§12.2 step 2). Short and woody; the TV raises the playback rate one
    // step per voter (pitch by order), so one file serves the whole run.
    id: "bluff.tok", bus: "sfx", seconds: 0.12, targetDb: -20,
    render(b) {
      fm(b, { start: 0, dur: 0.12, f: 640, ratio: 1.48, index: 1.3, amp: 0.6, decay: 0.022, attack: 0.0006 });
      noise(b, { start: 0, dur: 0.03, amp: 0.3, filter: "bp", f0: 1900, q: 3, decay: 0.006, seed: 911 });
    },
  },
  {
    // The red LIE! stamp (§12.2 step 4): a heavy rubber thud, an ink "splat", then a deflating low horn that tells the
    // fooled players they were had (playful, never mocking).
    id: "bluff.stampLie", bus: "sfx", seconds: 0.75, targetDb: -15,
    render(b) {
      noise(b, { start: 0, dur: 0.07, amp: 0.9, filter: "lp", f0: 1100, decay: 0.022, seed: 921 });
      tone(b, { start: 0, dur: 0.2, f0: 120, f1: 55, glide: 0.08, amp: 0.8, attack: 0.0008, decay: 0.07, release: 0.03 });
      snap(b, 0.012, 0.5, 922);
      noise(b, { start: 0.03, dur: 0.12, amp: 0.25, filter: "bp", f0: 2600, f1: 900, q: 1.6, decay: 0.04, seed: 923 });
      brass(b, { start: 0.2, dur: 0.5, f0: Bb4 / 2, f1: Fs4 / 2, cut0: 380, cut1: 1500, q: 2.6, amp: 0.2, attack: 0.03, decay: 0.3 });
    },
  },
  {
    // A heart drifting to an author in the like tally (§12.2): a soft rising pop with a tiny sparkle.
    id: "bluff.like", bus: "sfx", seconds: 0.22, targetDb: -23,
    render(b) {
      tone(b, { start: 0, dur: 0.12, f0: 480, f1: 1150, glide: 0.035, amp: 0.55, attack: 0.002, decay: 0.045, release: 0.02 });
      fm(b, { start: 0.04, dur: 0.18, f: A5, ratio: 2, index: 0.7, amp: 0.18, decay: 0.05 });
    },
  },
  {
    // Final round card, "There is no right answer" (§3, §12.6): a darbuka groove that stops dead for a beat (the music
    // drops out on the sentence), then a hushed hijaz line falls into a low doum and a question-mark pluck up top.
    id: "bluff.noTruth", bus: "sting", seconds: 2.8, targetDb: -16,
    render(b) {
      const groove = [[0, "doum"], [0.18, "tek"], [0.27, "tek"], [0.45, "doum"], [0.63, "tek"], [0.72, "ka"], [0.81, "tek"]];
      groove.forEach(([t, s], i) => darbuka(b, t, s, s === "doum" ? 0.75 : 0.5, 931 + i));
      // The drop: silence from 0.95 s to 1.45 s, only a held breath of air.
      noise(b, { start: 0.95, dur: 0.5, amp: 0.05, filter: "bp", f0: 900, f1: 2400, q: 0.8, attack: 0.3, release: 0.2, seed: 939 });
      [D5, C5, Bb4, A4, G4, Fs4, Eb4, D4].forEach((f, i) =>
        pluck(b, { start: 1.45 + i * 0.11, f, dur: 0.6, amp: 0.42 - i * 0.02, damp: 0.995, bright: 0.45, seed: 940 + i }));
      darbuka(b, 2.33, "doum", 0.8, 950);
      fm(b, { start: 2.33, dur: 0.45, f: D6, ratio: 3.01, index: 0.9, amp: 0.12, decay: 0.15 });
    },
  },
  {
    // An award card lands on its velvet stand (§12.5): darbuka roll, a bright brass fanfare up the major and a shimmer.
    id: "bluff.award", bus: "sting", seconds: 1.8, targetDb: -15,
    render(b) {
      for (let i = 0; i < 8; i++) darbuka(b, i * 0.045, i % 2 ? "ka" : "tek", 0.25 + i * 0.05, 960 + i);
      darbuka(b, 0.38, "doum", 0.85, 970);
      [[0.38, D5], [0.5, Fs5], [0.62, A5]].forEach(([t, f], i) =>
        brass(b, { start: t, dur: i === 2 ? 1.0 : 0.35, f0: f / 2, cut0: 600, cut1: 3400, q: 1.8, amp: 0.16, attack: 0.015, decay: i === 2 ? 0.55 : 0.18 }));
      [D6, E5 * 2, Fs5 * 2, A5 * 2].forEach((f, i) => fm(b, { start: 0.66 + i * 0.07, dur: 0.9, f, ratio: 3.5, index: 1.1, amp: 0.1, decay: 0.3 }));
      noise(b, { start: 0.62, dur: 1.1, amp: 0.07, filter: "hp", f0: 7000, attack: 0.05, decay: 0.5, release: 0.2, seed: 975 });
    },
  },
];
