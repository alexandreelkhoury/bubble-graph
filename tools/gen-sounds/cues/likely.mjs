// Game cue manifest for `likely` (GAME-LIKELY §12.6), owned by the G3 lane D. Original recipes over src/dsp.ts
// (oscillators, seeded noise, Karplus–Strong, FM): no samples, nothing to license. File names become likely_*.
// The world fanfare (`sting.likelyIntro`) is the platform cue `world_likely_sting` (src/platform-cues.ts ALIASES).
//
// The rooftop awards night: a golden, slightly ridiculous ceremony. Cards flick off a deck, the jury hops into conga
// lines (tok, a woodblock the client may pitch up per line length), a spotlight drops, a rosette chimes, confetti pops.
import { darbuka, fm, noise, note, pluck, snap, tone } from "../src/dsp.ts";

const G5 = note(10), C6 = note(15), E6 = note(19), G6 = note(22);

/** @type {readonly import("../src/cues").CueDef[]} */
export const CUES = [
  {
    // §12.3: the card flicks off the golden deck, spins and lands with a soft paper slap.
    id: "likely.deal", bus: "sfx", seconds: 0.42, targetDb: -19,
    render(b) {
      noise(b, { start: 0, dur: 0.24, amp: 0.7, filter: "bp", f0: 900, f1: 4800, q: 1.4, attack: 0.09, decay: 0.06, release: 0.04, seed: 301 });
      noise(b, { start: 0.05, dur: 0.18, amp: 0.25, filter: "bp", f0: 6200, f1: 2600, q: 2.2, attack: 0.04, decay: 0.05, release: 0.03, seed: 302 });
      noise(b, { start: 0.27, dur: 0.12, amp: 0.55, filter: "lp", f0: 1400, q: 0.8, decay: 0.02, release: 0.04, seed: 303 });
      tone(b, { start: 0.27, dur: 0.1, f0: 220, f1: 140, amp: 0.3, attack: 0.001, decay: 0.025, release: 0.03 });
    },
  },
  {
    // §12.2 step 2: one hop landing behind a target. A hollow woodblock "tok"; the client raises playback pitch per
    // conga length, so the recipe stays short and dry.
    id: "likely.tok", bus: "sfx", seconds: 0.16, targetDb: -21,
    render(b) {
      fm(b, { start: 0, dur: 0.15, f: 820, ratio: 1.47, index: 1.8, amp: 0.6, decay: 0.022, attack: 0.0005, indexDecay: 0.01 });
      tone(b, { start: 0, dur: 0.12, f0: 410, f1: 360, amp: 0.25, attack: 0.0005, decay: 0.03, release: 0.03 });
      noise(b, { start: 0, dur: 0.015, amp: 0.2, filter: "bp", f0: 3800, q: 2.5, decay: 0.003, seed: 311 });
    },
  },
  {
    // §12.2 step 4: the stage dims and a spotlight drops: a deep "thoom", the rig's metal clunk, a short air hiss.
    id: "likely.spot", bus: "sfx", seconds: 1.05, targetDb: -15,
    render(b) {
      fm(b, { start: 0, dur: 0.16, f: 190, ratio: 2.76, index: 3.2, amp: 0.35, decay: 0.04, attack: 0.0005, indexDecay: 0.03 });
      tone(b, { start: 0.02, dur: 1.0, f0: 92, f1: 41, glide: 0.35, amp: 0.95, attack: 0.004, decay: 0.32, release: 0.2 });
      tone(b, { start: 0.02, dur: 0.7, f0: 184, f1: 82, glide: 0.3, amp: 0.2, attack: 0.004, decay: 0.15, release: 0.15 });
      noise(b, { start: 0.02, dur: 0.9, amp: 0.3, filter: "lp", f0: 2400, f1: 300, q: 0.7, attack: 0.01, decay: 0.25, release: 0.2, seed: 321 });
    },
  },
  {
    // §12.2 step 5: the golden rosette lands on the winner: a bright three-bell chime and a sparkle tail.
    id: "likely.rosette", bus: "sfx", seconds: 1.1, targetDb: -16,
    render(b) {
      snap(b, 0, 0.6, 331);
      [G5, C6, E6].forEach((f, i) => {
        fm(b, { start: 0.02 + i * 0.07, dur: i === 2 ? 1.0 : 0.6, f, ratio: 3.5, index: 1.4, amp: 0.4, decay: i === 2 ? 0.32 : 0.16, attack: 0.0008 });
        fm(b, { start: 0.02 + i * 0.07, dur: 0.5, f: f * 2, ratio: 1.0, index: 0.3, amp: 0.08, decay: 0.12 });
      });
      for (let i = 0; i < 7; i++) {
        tone(b, { start: 0.25 + i * 0.07, dur: 0.12, f0: G6 * (1 + 0.06 * i), amp: 0.06, attack: 0.002, decay: 0.03, release: 0.03 });
      }
    },
  },
  {
    // §12.2 step 6 (Unanimous): the confetti cannon: a padded pop, then paper fluttering down.
    id: "likely.confetti", bus: "sfx", seconds: 1.4, targetDb: -15,
    render(b) {
      tone(b, { start: 0, dur: 0.18, f0: 150, f1: 60, amp: 0.8, attack: 0.0008, decay: 0.05, release: 0.04 });
      noise(b, { start: 0, dur: 0.14, amp: 0.8, filter: "lp", f0: 3200, f1: 600, q: 0.7, decay: 0.035, release: 0.03, seed: 341 });
      let t = 0.12, i = 0;
      while (t < 1.25) {
        const g = 1 - t / 1.3;
        noise(b, { start: t, dur: 0.03, amp: 0.25 * g, filter: "bp", f0: 2600 + ((i * 937) % 3400), q: 3, decay: 0.006, seed: 350 + i });
        t += 0.018 + ((i * 53) % 7) * 0.006;
        i++;
      }
      fm(b, { start: 0.1, dur: 0.9, f: C6, ratio: 4, index: 0.8, amp: 0.1, decay: 0.3 });
    },
  },
  {
    // §12.2 Chaos: everyone runs the wrong way: scurrying feet, slide whistles crossing, one comic bump at the end.
    id: "likely.scramble", bus: "sfx", seconds: 1.3, targetDb: -17,
    render(b) {
      for (let i = 0; i < 16; i++) {
        const s = i * 0.065 + (i % 2 ? 0.012 : 0);
        noise(b, { start: s, dur: 0.035, amp: 0.45, filter: "bp", f0: i % 2 ? 1500 : 1100, q: 2.2, decay: 0.008, seed: 360 + i });
        tone(b, { start: s, dur: 0.04, f0: i % 2 ? 640 : 520, wave: "tri", amp: 0.12, attack: 0.001, decay: 0.01 });
      }
      tone(b, { start: 0.05, dur: 0.85, f0: 520, f1: 1300, wave: "tri", amp: 0.16, attack: 0.04, decay: 0, release: 0.08, vibratoHz: 9, vibratoCents: 40 });
      tone(b, { start: 0.1, dur: 0.85, f0: 1250, f1: 480, wave: "tri", amp: 0.14, attack: 0.04, decay: 0, release: 0.08, vibratoHz: 7, vibratoCents: 40 });
      darbuka(b, 1.06, "doum", 0.7, 380);
      tone(b, { start: 1.06, dur: 0.22, f0: 300, f1: 170, wave: "tri", amp: 0.35, attack: 0.002, decay: 0.07, release: 0.05 });
    },
  },
  {
    // §12.2 anonymous mode: the ballot box shakes, then the envelopes burst out.
    id: "likely.ballot", bus: "sfx", seconds: 1.0, targetDb: -17,
    render(b) {
      for (let i = 0; i < 9; i++) {
        noise(b, { start: i * 0.055, dur: 0.05, amp: 0.3 + 0.04 * i, filter: "bp", f0: 2100 + (i % 3) * 400, q: 1.6, decay: 0.012, seed: 390 + i });
        tone(b, { start: i * 0.055, dur: 0.04, f0: i % 2 ? 330 : 270, amp: 0.12, attack: 0.001, decay: 0.012 });
      }
      noise(b, { start: 0.52, dur: 0.4, amp: 0.7, filter: "bp", f0: 700, f1: 5200, q: 1.1, attack: 0.02, decay: 0.12, release: 0.08, seed: 399 });
      for (let k = 0; k < 5; k++) pluck(b, { start: 0.56 + k * 0.05, f: note(3 + 2 * k), dur: 0.3, amp: 0.18, damp: 0.99, bright: 0.7, seed: 400 + k });
    },
  },
  {
    // §12.4: the Mystery Award's "?" puff of smoke: a soft whoosh and a quizzical upward "hm?".
    id: "likely.puff", bus: "sfx", seconds: 0.8, targetDb: -19,
    render(b) {
      noise(b, { start: 0, dur: 0.5, amp: 0.7, filter: "lp", f0: 600, f1: 2200, q: 0.8, attack: 0.05, decay: 0.15, release: 0.12, seed: 411 });
      tone(b, { start: 0.3, dur: 0.45, f0: 330, f1: 495, glide: 0.3, wave: "tri", amp: 0.35, attack: 0.03, decay: 0.3, release: 0.1, vibratoHz: 6, vibratoCents: 25 });
    },
  },
  {
    // §12.4: the golden glint sweeping across each award card.
    id: "likely.glint", bus: "sfx", seconds: 0.55, targetDb: -22,
    render(b) {
      for (let i = 0; i < 6; i++) fm(b, { start: i * 0.045, dur: 0.3, f: note(15 + 2 * i), ratio: 3.01, index: 0.9, amp: 0.22, decay: 0.07, attack: 0.001 });
      noise(b, { start: 0, dur: 0.35, amp: 0.12, filter: "hp", f0: 6500, f1: 9000, q: 0.7, attack: 0.08, decay: 0.12, release: 0.06, seed: 421 });
    },
  },
];
