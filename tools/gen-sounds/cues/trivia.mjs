// Game cue manifest for `trivia` (GAME-TRIVIA §12.1–§12.6, DESIGN-JAMAA §5.5). Original recipes over src/dsp.ts: nothing
// sampled, nothing borrowed from another show. The studio's voice: warm relay clunks, a bulb-arch shimmer, brass in
// rising fourths, and the platform's darbuka under the stings. File names become trivia_* (res/raw and web).
// Platform cues already cover the answer lock, correct and wrong (`trivia.buzz` → answer_lock, `trivia.correct` →
// quiz_correct, `trivia.wrong` → quiz_wrong) and the intro sting (`sting.triviaIntro` → world_trivia_sting).
// GAME-TRIVIA §12.6 names `sting.finalQuestion` and `sting.podium`; a game manifest may only define `trivia.*` ids, so
// they are `trivia.finalQuestion` and `trivia.podium` here (SPEC-GAP, reported by lane D).
import { brass, darbuka, fm, noise, note, pluck, snare, tone } from "../src/dsp.ts";

const C5 = note(3), E5 = note(7), G5 = note(10), C6 = note(15), E6 = note(19), G6 = note(22);
const D4 = note(-7), F4 = note(-4), A4 = note(0), Bb4 = note(1), D5 = note(5);

/** @type {readonly import("../src/cues").CueDef[]} */
export const CUES = [
  {
    // §12.1: one studio spotlight snapping on (played 4 × 120 ms apart): a heavy relay "clunk" with a filament hum tail.
    id: "trivia.lightsOn", bus: "sfx", seconds: 0.34, targetDb: -18,
    render(b) {
      noise(b, { start: 0, dur: 0.035, amp: 0.7, filter: "bp", f0: 1400, q: 1.8, decay: 0.006, seed: 1101 });
      tone(b, { start: 0, dur: 0.16, f0: 110, f1: 52, glide: 0.04, amp: 0.7, attack: 0.0008, decay: 0.045, release: 0.02 });
      noise(b, { start: 0.012, dur: 0.05, amp: 0.25, filter: "lp", f0: 500, q: 0.8, decay: 0.015, seed: 1102 });
      tone(b, { start: 0.03, dur: 0.3, f0: 120, wave: "saw", amp: 0.035, attack: 0.02, decay: 0.12, release: 0.06 });
    },
  },
  {
    // §12.2 READ: the question card slams in from above: an air whoosh, then a wooden "thud" on the landing.
    id: "trivia.slam", bus: "sfx", seconds: 0.55, targetDb: -16,
    render(b) {
      noise(b, { start: 0, dur: 0.24, amp: 0.45, filter: "bp", f0: 500, f1: 3200, q: 1.1, attack: 0.18, release: 0.03, seed: 1111 });
      tone(b, { start: 0.22, dur: 0.3, f0: 140, f1: 48, glide: 0.07, amp: 0.85, attack: 0.0008, decay: 0.08, release: 0.04 });
      noise(b, { start: 0.22, dur: 0.07, amp: 0.4, filter: "lp", f0: 1200, q: 0.7, decay: 0.02, seed: 1112 });
      noise(b, { start: 0.225, dur: 0.03, amp: 0.25, filter: "bp", f0: 3000, q: 2, decay: 0.006, seed: 1113 });
    },
  },
  {
    // §12.2 ANSWER: one answer tile flipping in (four of them, 90 ms apart): a crisp card flick with a tiny wooden tick.
    id: "trivia.tileFlip", bus: "sfx", seconds: 0.12, targetDb: -23,
    render(b) {
      noise(b, { start: 0, dur: 0.07, amp: 0.55, filter: "bp", f0: 2200, f1: 5200, q: 1.6, attack: 0.012, decay: 0.02, release: 0.01, seed: 1121 });
      tone(b, { start: 0.04, dur: 0.06, f0: 1250, f1: 900, amp: 0.25, attack: 0.0005, decay: 0.012, release: 0.01 });
    },
  },
  {
    // §12.3 lock: "Time!" — the bulb arch flashes once: a short brass stab on a bright two-bell hit, final rather than sad.
    id: "trivia.timeUp", bus: "sfx", seconds: 0.75, targetDb: -16,
    render(b) {
      snare(b, 0, 0.55, 1131);
      for (const f of [D4, A4, D5]) brass(b, { start: 0, dur: 0.42, f0: f, cut0: 900, cut1: 3400, q: 1.4, amp: 0.14, attack: 0.006, decay: 0.16 });
      fm(b, { start: 0.005, dur: 0.7, f: D5 * 2, ratio: 3.5, index: 1.8, amp: 0.22, decay: 0.2 });
      fm(b, { start: 0.09, dur: 0.6, f: A4 * 2, ratio: 3.5, index: 1.4, amp: 0.16, decay: 0.18 });
    },
  },
  {
    // §12.3 Lightning thumb (the fastest correct answer): a lightning bolt on one character: a falling electric zap over a dry crackle (never a buzzer).
    id: "trivia.zap", bus: "sfx", seconds: 0.5, targetDb: -17,
    render(b) {
      tone(b, { start: 0, dur: 0.22, f0: 3200, f1: 260, glide: 0.18, wave: "saw", amp: 0.16, attack: 0.002, decay: 0.08, release: 0.03 });
      tone(b, { start: 0, dur: 0.22, f0: 1600, f1: 130, glide: 0.18, wave: "square", amp: 0.07, attack: 0.002, decay: 0.08, release: 0.03 });
      for (let i = 0; i < 7; i++) noise(b, { start: 0.01 + i * 0.045 + (i % 2) * 0.012, dur: 0.025, amp: 0.5 - i * 0.05, filter: "hp", f0: 3500 + i * 300, q: 0.8, decay: 0.006, seed: 1141 + i });
      tone(b, { start: 0.05, dur: 0.4, f0: 70, f1: 45, amp: 0.4, attack: 0.002, decay: 0.12, release: 0.05 });
    },
  },
  {
    // §12.3 / DESIGN-JAMAA streak: a flame catching around a character: a rising "fwoomp" with a few ember pops.
    id: "trivia.flame", bus: "sfx", seconds: 0.65, targetDb: -18,
    render(b) {
      noise(b, { start: 0, dur: 0.45, amp: 0.55, filter: "bp", f0: 250, f1: 1800, q: 1.3, attack: 0.12, decay: 0.2, release: 0.08, seed: 1151 });
      tone(b, { start: 0, dur: 0.4, f0: 70, f1: 140, amp: 0.3, attack: 0.08, decay: 0.15, release: 0.06 });
      for (const [s, f] of [[0.2, 2600], [0.31, 3400], [0.43, 2900], [0.52, 3900]]) noise(b, { start: s, dur: 0.02, amp: 0.3, filter: "bp", f0: f, q: 3, decay: 0.004, seed: 1152 + Math.round(f) });
    },
  },
  {
    // §5.4 / §12.3 Genius: everybody got it, the confetti cannon fires: a cork-like pop, then paper sparkle up high.
    id: "trivia.genius", bus: "sfx", seconds: 0.95, targetDb: -16,
    render(b) {
      tone(b, { start: 0, dur: 0.12, f0: 260, f1: 70, glide: 0.04, amp: 0.7, attack: 0.0005, decay: 0.03, release: 0.02 });
      noise(b, { start: 0, dur: 0.08, amp: 0.55, filter: "bp", f0: 1800, q: 1.1, decay: 0.02, seed: 1161 });
      noise(b, { start: 0.06, dur: 0.85, amp: 0.22, filter: "hp", f0: 6500, q: 0.7, attack: 0.05, decay: 0.3, release: 0.15, seed: 1162 });
      [C6, E6, G6, C6 * 2, G6, E6 * 2].forEach((f, i) => fm(b, { start: 0.08 + i * 0.06, dur: 0.32, f, ratio: 4.01, index: 0.9, amp: 0.13, decay: 0.08 }));
    },
  },
  {
    // §12.5 FINAL_INTRO: lights go red-amber and the drum builds: an accelerating snare roll and darbuka, a hijaz brass
    // swell, then the "×2" stamp lands on a big low hit.
    id: "trivia.finalQuestion", bus: "sting", seconds: 2.6, targetDb: -15,
    render(b) {
      let t = 0, gap = 0.16, i = 0;
      while (t < 1.75) {
        snare(b, t, 0.18 + 0.5 * (t / 1.75), 1171 + i);
        t += gap;
        gap = Math.max(0.035, gap * 0.9);
        i++;
      }
      for (const s of [0, 0.48, 0.9, 1.22, 1.46]) darbuka(b, s, "doum", 0.45, 1190);
      brass(b, { start: 0.3, dur: 1.5, f0: D4, f1: F4, cut0: 400, cut1: 2200, q: 1.6, amp: 0.1, attack: 1.0, decay: 0 });
      brass(b, { start: 0.3, dur: 1.5, f0: A4, f1: Bb4, cut0: 400, cut1: 2400, q: 1.6, amp: 0.08, attack: 1.0, decay: 0 });
      // The stamp: chord hit + doum + cymbal.
      for (const f of [D4, A4, D5, F4 * 2]) brass(b, { start: 1.8, dur: 0.75, f0: f, cut0: 1000, cut1: 4200, q: 1.2, amp: 0.12, attack: 0.008, decay: 0.32 });
      tone(b, { start: 1.8, dur: 0.5, f0: 90, f1: 42, glide: 0.08, amp: 0.8, attack: 0.001, decay: 0.12, release: 0.08 });
      darbuka(b, 1.8, "doum", 0.7, 1191);
      noise(b, { start: 1.8, dur: 0.78, amp: 0.3, filter: "hp", f0: 5200, q: 0.6, decay: 0.28, release: 0.2, seed: 1192 });
    },
  },
  {
    // §12.5 RESULTS: characters jump onto the podium (3-2-1), the winner lifts the trophy: three rising steps, a brass
    // fanfare in fourths, a darbuka flourish and a cymbal bloom.
    id: "trivia.podium", bus: "sting", seconds: 2.4, targetDb: -15,
    render(b) {
      [G5 / 2, C5, E5].forEach((f, i) => {
        pluck(b, { start: i * 0.22, f, dur: 0.3, amp: 0.5, damp: 0.994, bright: 0.6, seed: 1201 + i });
        darbuka(b, i * 0.22, i === 2 ? "doum" : "tek", 0.5, 1205 + i);
      });
      [[0.66, C5], [0.8, note(8)], [0.94, G5]].forEach(([s, f]) => brass(b, { start: s, dur: 0.18, f0: f, cut0: 800, cut1: 3200, q: 1.5, amp: 0.2, attack: 0.008 }));
      for (const f of [C5 / 2, G5 / 2, C5, E5, G5, C6]) brass(b, { start: 1.1, dur: 1.2, f0: f, cut0: 1000, cut1: 4000, q: 1.1, amp: 0.085, attack: 0.012, decay: 0.6 });
      for (const [s, k] of [[1.1, "doum"], [1.28, "tek"], [1.37, "tek"], [1.46, "doum"]]) darbuka(b, s, k, 0.55, 1210);
      noise(b, { start: 1.1, dur: 1.25, amp: 0.28, filter: "hp", f0: 5600, q: 0.6, attack: 0.02, decay: 0.45, release: 0.3, seed: 1211 });
      [C6, E6, G6].forEach((f, i) => fm(b, { start: 1.15 + i * 0.07, dur: 0.6, f, ratio: 3.5, index: 1.2, amp: 0.08, decay: 0.2 }));
    },
  },
];
