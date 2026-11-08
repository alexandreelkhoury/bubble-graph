// GAME-BLUFF §4.1, §5, §6 constants. Durations in ms for pace "normal".
export const ROUND_INTRO_MS = 4_000;
export const ROUND_INTRO_FINAL_MS = 6_000;
export const WRITING_MS = 60_000;
export const WRITING_FINAL_MS = 75_000;
export const SCORES_MS = 6_000;
export const SCORES_VOIDED_MS = 4_000;
export const LIKE_GRACE_MS = 3_000;
export const HIDE_MIN_REMAINING_MS = 10_000;
export const AWARDS_BASE_MS = 2_500;
export const AWARDS_PER_CARD_MS = 3_500;
export const PACE_FACTOR = { relaxed: 1.5, normal: 1, fast: 0.75 } as const;

export const MIN_CONNECTED = 3;
export { MAX_PLAYERS } from "../../../constants";
export const BIG_GROUP = 8;
export const MIN_LIES = 3;
export const MIN_FINAL_OPTIONS = 3;
export const LIE_EDITS_MAX = 5;
export const TOO_CLOSE_PROBES_MAX = 3;
export const SKIPS_PER_PROMPT_MAX = 2;
export const HIDES_PER_PROMPT_MAX = 3;
export const LIKES_MAX = 2;
export { MEMORY_MAX_KEYS } from "../../../constants";

// §6.3 (rounds 1–2, ×m) and §6.5 (final)
export const PTS = {
  SPOT_ON: 150,
  TRUTH: 100,
  FOOLED: 60,
  LIKE: 10,
  HELP_FEE: 40,
  FINAL_VOTE: 150,
  FINAL_TOP: 400,
  FINAL_LIKE: 20,
  FINAL_HELP_FEE: 60,
} as const;

/** Rounds coins down to a multiple of 10 (split credit, §5.3). */
export const floor10 = (x: number): number => Math.max(0, Math.floor(x / 10) * 10);
export const scaleSec = (ms: number, f: number): number => Math.round((ms * f) / 1000) * 1000;
export const votingMs = (optionCount: number, f: number): number =>
  scaleSec(Math.min(50_000, Math.max(26_000, 20_000 + 2_500 * optionCount)), f);
