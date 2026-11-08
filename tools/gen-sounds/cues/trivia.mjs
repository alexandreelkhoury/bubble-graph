// Game cue manifest for `trivia` (GAME-TRIVIA §12.6). STUB created in milestone P: the trivia milestone's lane D adds its
// recipes here. Each entry is a CueDef (src/cues.ts) whose id starts with "trivia." (file names become trivia_*), e.g.
//   import { tone } from "../src/dsp.ts";
//   export const CUES = [{ id: "trivia.example", bus: "sfx", seconds: 0.2, targetDb: -20, render(b) { tone(b, { start: 0, dur: 0.2, f0: 440 }); } }];
// Platform cues (world stings, coins, answer lock…) and their game-doc aliases live in src/platform-cues.ts.

/** @type {readonly import("../src/cues").CueDef[]} */
export const CUES = [];
