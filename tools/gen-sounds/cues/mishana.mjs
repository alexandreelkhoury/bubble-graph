// Game cue manifest for `mishana` (DESIGN §6.4 (its M2 cues stay in src/cues.ts with unprefixed names)). STUB created in milestone P: the mishana milestone's lane D adds its
// recipes here. Each entry is a CueDef (src/cues.ts) whose id starts with "mishana." (file names become mishana_*), e.g.
//   import { tone } from "../src/dsp.ts";
//   export const CUES = [{ id: "mishana.example", bus: "sfx", seconds: 0.2, targetDb: -20, render(b) { tone(b, { start: 0, dur: 0.2, f0: 440 }); } }];
// Platform cues (world stings, coins, answer lock…) and their game-doc aliases live in src/platform-cues.ts.

/** @type {readonly import("../src/cues").CueDef[]} */
export const CUES = [];
