// JAMAA platform cues (JAMAA-PLATFORM §3.11, DESIGN-JAMAA §5.5): hub, portal, world stings, points flight, cup,
// reactions and the shared answer/reveal cues. Original recipes over dsp.ts (no samples, nothing to license).
// Ids are the platform's own names (already res/raw-safe); game docs' names are ALIASES below.
import { brass, darbuka, fm, noise, note, pluck, snap, tone } from "./dsp";
import type { CueDef } from "./cues";

// Hijaz on D (D E♭ F♯ G A B♭ C): the café's colour; a major pentatonic for the bright platform moments.
const D4 = note(-7), Eb4 = note(-6), Fs4 = note(-3), G4 = note(-2), A4 = note(0), Bb4 = note(1);
const C5 = note(3), D5 = note(5), E5 = note(7), G5 = note(10), A5 = note(12), C6 = note(15), E6 = note(19), G6 = note(22);

export const PLATFORM_CUES: readonly CueDef[] = [
  {
    // A soft wooden tock for D-pad moves on the hub carousel: lower and rounder than ui.move.
    id: "hub_move", bus: "ui", seconds: 0.07, targetDb: -30,
    render(b) {
      fm(b, { start: 0, dur: 0.07, f: 1180, ratio: 1.5, index: 0.9, amp: 0.5, decay: 0.012, attack: 0.0008 });
      noise(b, { start: 0, dur: 0.025, amp: 0.15, filter: "bp", f0: 2600, q: 2.5, decay: 0.004, seed: 301 });
    },
  },
  {
    // The Bab portal opening (§3.10 A, 1 100 ms): an airy rising sweep with a pentatonic shimmer, landing on a doum.
    id: "portal_open", bus: "sfx", seconds: 1.1, targetDb: -17,
    render(b) {
      noise(b, { start: 0, dur: 0.75, amp: 0.5, filter: "bp", f0: 380, f1: 4200, q: 1.3, attack: 0.45, decay: 0, release: 0.2, seed: 311 });
      [C5, D5, E5, G5, A5, C6].forEach((f, i) =>
        fm(b, { start: 0.12 + i * 0.08, dur: 0.5, f, ratio: 3.01, index: 1.1, amp: 0.16 + i * 0.02, decay: 0.16, attack: 0.004 }));
      darbuka(b, 0.7, "doum", 0.55, 312);
      fm(b, { start: 0.7, dur: 0.38, f: G5, ratio: 2, index: 0.6, amp: 0.18, decay: 0.14 });
    },
  },
  {
    // Back to the hub (600 ms): the sweep falls and two plucks step down.
    id: "portal_close", bus: "sfx", seconds: 0.62, targetDb: -19,
    render(b) {
      noise(b, { start: 0, dur: 0.45, amp: 0.45, filter: "bp", f0: 3600, f1: 450, q: 1.3, attack: 0.08, decay: 0.2, release: 0.1, seed: 321 });
      pluck(b, { start: 0.18, f: G4 * 2, dur: 0.22, amp: 0.45, damp: 0.993, bright: 0.55, seed: 322 });
      pluck(b, { start: 0.3, f: C5, dur: 0.3, amp: 0.5, damp: 0.994, bright: 0.5, seed: 323 });
    },
  },
  {
    // Night market (Mish Ana!): the amber lamp drops on its cord, swings once and the stage lights up (§3.2 B).
    id: "world_mishana_sting", bus: "sting", seconds: 1.7, targetDb: -16,
    render(b) {
      tone(b, { start: 0, dur: 0.32, f0: 1400, f1: 360, wave: "tri", amp: 0.3, attack: 0.01, decay: 0.2, release: 0.05 });
      noise(b, { start: 0.3, dur: 0.32, amp: 0.25, filter: "bp", f0: 700, f1: 1800, q: 1.6, attack: 0.14, release: 0.12, seed: 331 });
      noise(b, { start: 0.62, dur: 0.28, amp: 0.18, filter: "bp", f0: 1600, f1: 800, q: 1.6, attack: 0.12, release: 0.1, seed: 332 });
      darbuka(b, 0.3, "doum", 0.7, 333);
      darbuka(b, 0.52, "tek", 0.45, 334);
      darbuka(b, 0.64, "tek", 0.4, 335);
      darbuka(b, 0.86, "doum", 0.75, 336);
      for (const f of [note(-9), note(-5), note(-2), note(3)]) brass(b, { start: 0.86, dur: 0.8, f0: f, cut0: 500, cut1: 2600, q: 1.6, amp: 0.11, attack: 0.02, decay: 0.45 });
      fm(b, { start: 0.86, dur: 0.8, f: note(15), ratio: 3.5, index: 1.4, amp: 0.12, decay: 0.3 });
    },
  },
  {
    // Hakawati café (Bluff): a door creak, an oud-like run in hijaz and one neon buzz-flicker (GAME-BLUFF §12.1).
    id: "world_bluff_sting", bus: "sting", seconds: 1.8, targetDb: -16,
    render(b) {
      noise(b, { start: 0, dur: 0.55, amp: 0.3, filter: "bp", f0: 520, f1: 980, q: 9, attack: 0.08, decay: 0.4, release: 0.08, seed: 341 });
      tone(b, { start: 0, dur: 0.55, f0: 210, f1: 330, wave: "saw", amp: 0.05, attack: 0.08, decay: 0.3, release: 0.08, vibratoHz: 23, vibratoCents: 80 });
      [D4, Eb4, Fs4, G4, A4].forEach((f, i) => pluck(b, { start: 0.42 + i * 0.09, f, dur: 0.4, amp: 0.55, damp: 0.992, bright: 0.65, seed: 342 + i }));
      pluck(b, { start: 0.9, f: D5, dur: 0.85, amp: 0.65, damp: 0.996, bright: 0.6, seed: 348 });
      pluck(b, { start: 0.9, f: D4, dur: 0.85, amp: 0.45, damp: 0.996, bright: 0.45, seed: 349 });
      darbuka(b, 0.9, "doum", 0.65, 350);
      for (const s of [1.05, 1.2]) tone(b, { start: s, dur: 0.06, f0: 120, wave: "square", amp: 0.05, attack: 0.002, release: 0.01 });
      tone(b, { start: 1.3, dur: 0.4, f0: 120, wave: "square", amp: 0.035, attack: 0.002, decay: 0.2, release: 0.06 });
    },
  },
  {
    // Rooftop (Most Likely): the curtain swoosh, a party hit with snaps and string lights twinkling (GAME-LIKELY §12.1).
    id: "world_likely_sting", bus: "sting", seconds: 1.8, targetDb: -16,
    render(b) {
      noise(b, { start: 0, dur: 0.25, amp: 0.4, filter: "bp", f0: 2600, f1: 600, q: 0.9, attack: 0.03, decay: 0.12, release: 0.05, seed: 361 });
      noise(b, { start: 0.25, dur: 0.5, amp: 0.4, filter: "bp", f0: 500, f1: 3600, q: 0.9, attack: 0.25, release: 0.15, seed: 362 });
      for (const f of [note(-10), note(-6), note(-3), note(2)]) brass(b, { start: 0.75, dur: 0.9, f0: f, cut0: 900, cut1: 3600, q: 1.2, amp: 0.11, attack: 0.012, decay: 0.5 });
      snap(b, 0.75, 0.8, 363);
      snap(b, 1.05, 0.55, 364);
      [E6, G6, C6, A5, E6].forEach((f, i) => fm(b, { start: 0.85 + i * 0.13, dur: 0.3, f, ratio: 4, index: 0.8, amp: 0.1, decay: 0.08 }));
    },
  },
  {
    // Quiz studio (Trivia): a show fanfare in rising fifths over a cymbal swell (spotlight clunks are trivia.lightsOn).
    id: "world_trivia_sting", bus: "sting", seconds: 1.8, targetDb: -15,
    render(b) {
      noise(b, { start: 0, dur: 0.7, amp: 0.35, filter: "hp", f0: 3500, f1: 6000, q: 0.7, attack: 0.6, release: 0.08, seed: 371 });
      [[0.0, note(-9)], [0.18, note(-2)], [0.36, note(5)]].forEach(([s, f]) =>
        brass(b, { start: s as number, dur: 0.22, f0: f as number, cut0: 700, cut1: 3000, q: 1.5, amp: 0.25, attack: 0.01 }));
      for (const f of [note(-9), note(-5), note(-2), note(3), note(7)]) brass(b, { start: 0.6, dur: 1.1, f0: f, cut0: 1000, cut1: 3800, q: 1.1, amp: 0.1, attack: 0.012, decay: 0.55 });
      noise(b, { start: 0.6, dur: 1.15, amp: 0.3, filter: "hp", f0: 5200, q: 0.6, decay: 0.4, release: 0.25, seed: 372 });
      tone(b, { start: 0.6, dur: 0.3, f0: 110, f1: 60, amp: 0.5, attack: 0.001, decay: 0.08 });
    },
  },
  {
    // One coin leaving its source (§3.10 C): a light airy flick with a rising glint.
    id: "coin_fly", bus: "sfx", seconds: 0.3, targetDb: -24,
    render(b) {
      noise(b, { start: 0, dur: 0.26, amp: 0.4, filter: "bp", f0: 1800, f1: 5200, q: 1.8, attack: 0.08, decay: 0.08, release: 0.05, seed: 381 });
      tone(b, { start: 0.04, dur: 0.22, f0: 2400, f1: 3600, amp: 0.12, attack: 0.03, decay: 0.08 });
    },
  },
  {
    // Coin landing on a score badge; the players step it up a pentatonic note per coin (Bluff's bluff.coin alias).
    id: "coin_land", bus: "sfx", seconds: 0.24, targetDb: -20,
    render(b) {
      fm(b, { start: 0, dur: 0.24, f: E6, ratio: 3.5, index: 1.6, amp: 0.45, decay: 0.06, attack: 0.0005 });
      fm(b, { start: 0.012, dur: 0.2, f: E6 * 1.5, ratio: 2.4, index: 0.6, amp: 0.15, decay: 0.045 });
    },
  },
  {
    // A counter tick (≤ 10 per award): a soft odometer click, lower than sfx.tick so it never reads as a timer.
    id: "counter_tick", bus: "sfx", seconds: 0.05, targetDb: -25,
    render(b) {
      noise(b, { start: 0, dur: 0.035, amp: 0.6, filter: "bp", f0: 2100, q: 3, decay: 0.004, seed: 391 });
      tone(b, { start: 0, dur: 0.03, f0: 900, amp: 0.2, attack: 0.0004, decay: 0.006 });
    },
  },
  {
    // New leader: a falling whistle, then the crown lands with a regal brass stab and a bell.
    id: "crown_drop", bus: "sfx", seconds: 0.95, targetDb: -16,
    render(b) {
      tone(b, { start: 0, dur: 0.3, f0: 2600, f1: 900, amp: 0.2, attack: 0.02, decay: 0.2, release: 0.04 });
      for (const f of [note(-9), note(-5), note(-2)]) brass(b, { start: 0.3, dur: 0.6, f0: f, cut0: 800, cut1: 3200, q: 1.4, amp: 0.14, attack: 0.008, decay: 0.3 });
      fm(b, { start: 0.3, dur: 0.6, f: G6, ratio: 3.5, index: 2, amp: 0.2, decay: 0.2 });
      darbuka(b, 0.3, "doum", 0.5, 401);
    },
  },
  {
    // A star flying into "Tonight's cup": a quick sparkle arpeggio over a shimmer.
    id: "cup_star", bus: "sfx", seconds: 0.55, targetDb: -19,
    render(b) {
      [G5, C6, E6, G6].forEach((f, i) => fm(b, { start: i * 0.05, dur: 0.38, f, ratio: 4.01, index: 1, amp: 0.22, decay: 0.1 }));
      noise(b, { start: 0, dur: 0.5, amp: 0.15, filter: "hp", f0: 7000, q: 0.7, attack: 0.05, decay: 0.15, release: 0.1, seed: 411 });
    },
  },
  {
    // A REACT burst over a character: a small bubble pop (the same for all six reactions; the icon carries the meaning).
    id: "reaction_pop", bus: "sfx", seconds: 0.14, targetDb: -22,
    render(b) {
      tone(b, { start: 0, dur: 0.1, f0: 420, f1: 1250, glide: 0.05, amp: 0.55, attack: 0.002, decay: 0.03 });
      noise(b, { start: 0.04, dur: 0.03, amp: 0.15, filter: "bp", f0: 3000, q: 2, decay: 0.006, seed: 421 });
    },
  },
  {
    // An answer locked in (Trivia; trivia.buzz alias): a short, solid "clack-dum" (never a harsh buzzer).
    id: "answer_lock", bus: "sfx", seconds: 0.26, targetDb: -18,
    render(b) {
      noise(b, { start: 0, dur: 0.04, amp: 0.45, filter: "bp", f0: 1800, q: 1.6, decay: 0.008, seed: 431 });
      tone(b, { start: 0, dur: 0.24, f0: 330, f1: 220, glide: 0.05, wave: "tri", amp: 0.45, attack: 0.001, decay: 0.07 });
    },
  },
  {
    // Bluff's truth revealed (bluff.truth alias): a warm major bell chord with a rising shimmer.
    id: "truth_reveal", bus: "sfx", seconds: 1.2, targetDb: -16,
    render(b) {
      noise(b, { start: 0, dur: 0.35, amp: 0.25, filter: "hp", f0: 4000, f1: 7500, q: 0.7, attack: 0.3, release: 0.05, seed: 441 });
      for (const [f, a] of [[C5, 0.25], [E5, 0.2], [G5, 0.2], [C6, 0.16]] as const) fm(b, { start: 0.32, dur: 0.85, f, ratio: 3.5, index: 1.4, amp: a, decay: 0.3 });
      pluck(b, { start: 0.32, f: C5 / 2, dur: 0.8, amp: 0.4, damp: 0.996, bright: 0.4, seed: 442 });
    },
  },
  {
    // "The house got you!" (bluff.stampHouse alias): a sly three-step chuckle down a hijaz line, then a doum.
    id: "house_got_you", bus: "sfx", seconds: 0.95, targetDb: -17,
    render(b) {
      [Bb4, A4, G4].forEach((f, i) => {
        tone(b, { start: i * 0.15, dur: 0.12, f0: f * 1.06, f1: f, wave: "tri", amp: 0.32, attack: 0.008, decay: 0.06, release: 0.02, vibratoHz: 9, vibratoCents: 40 });
        noise(b, { start: i * 0.15, dur: 0.1, amp: 0.12, filter: "bp", f0: f * 3, q: 4, attack: 0.008, decay: 0.05, seed: 451 + i });
      });
      pluck(b, { start: 0.48, f: Fs4, dur: 0.18, amp: 0.4, damp: 0.99, bright: 0.5, seed: 455 });
      pluck(b, { start: 0.6, f: D4, dur: 0.33, amp: 0.55, damp: 0.994, bright: 0.45, seed: 456 });
      darbuka(b, 0.6, "doum", 0.6, 457);
    },
  },
  {
    // Trivia correct (trivia.correct alias): a bright two-note "ding-ding" up a fifth.
    id: "quiz_correct", bus: "sfx", seconds: 0.7, targetDb: -15,
    render(b) {
      fm(b, { start: 0, dur: 0.3, f: C6, ratio: 3.5, index: 1.5, amp: 0.4, decay: 0.1 });
      fm(b, { start: 0.12, dur: 0.56, f: G6, ratio: 3.5, index: 1.5, amp: 0.4, decay: 0.2 });
      noise(b, { start: 0.12, dur: 0.4, amp: 0.1, filter: "hp", f0: 7000, decay: 0.12, release: 0.08, seed: 461 });
    },
  },
  {
    // Trivia wrong (trivia.wrong alias): a soft double low "bmm-bmm", kind rather than harsh.
    id: "quiz_wrong", bus: "sfx", seconds: 0.6, targetDb: -18,
    render(b) {
      for (const s of [0, 0.22]) {
        tone(b, { start: s, dur: 0.2, f0: 150, f1: 132, wave: "tri", amp: 0.5, attack: 0.01, decay: 0.12, release: 0.03 });
        tone(b, { start: s, dur: 0.2, f0: 75, f1: 66, amp: 0.3, attack: 0.01, decay: 0.12, release: 0.03 });
      }
    },
  },
];

/**
 * Game-doc cue names that are the platform's (DESIGN-JAMAA §5.5: "the platform names win"); the generator writes no
 * file for an alias, and the cue indexes map it to the platform file.
 */
export const ALIASES: Readonly<Record<string, string>> = {
  "sting.bluffIntro": "world_bluff_sting",
  "sting.likelyIntro": "world_likely_sting",
  "sting.triviaIntro": "world_trivia_sting",
  "bluff.coin": "coin_land",
  "bluff.truth": "truth_reveal",
  "bluff.stampHouse": "house_got_you",
  "trivia.buzz": "answer_lock",
  "trivia.correct": "quiz_correct",
  "trivia.wrong": "quiz_wrong",
};
