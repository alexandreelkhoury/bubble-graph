// GAME-TAQRIBAN §3–§5 numbers and the closeness rule in one place. Zod-free and engine-free: the web client, the TV
// generators and the engine all import it (through meta.ts), so the doc, the clients and the server share one copy.

export const STATE_SCHEMA = 1;
export const SETTINGS_SCHEMA = 1;
export const VIEW_VERSION = 1;

/** §2: a duel works (closest of two), so 2 is the minimum; 12 is the platform maximum. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;

/** §3: questions per game; the last one is the double-points final. */
export const TAQ_LENGTHS = { short: 6, normal: 10, long: 14 } as const;
export type TaqLength = keyof typeof TAQ_LENGTHS;
export const TAQ_LENGTH_IDS = ["short", "normal", "long"] as const satisfies readonly TaqLength[];

/** §4.1: how long the phones may type, per pace. */
export const TAQ_PACE_MS = { relaxed: 45_000, normal: 30_000, fast: 20_000 } as const;
export type TaqPace = keyof typeof TAQ_PACE_MS;
export const TAQ_PACE_IDS = ["relaxed", "normal", "fast"] as const satisfies readonly TaqPace[];

/** §4.1 phase timings (ms). */
export const TAQ_TIMING = {
  EARLY_END_MS: 800,          // every awaited player guessed → QUESTION ends 0.8 s later
  REVEAL_BASE_MS: 9_000,      // the number line: guesses drop, the answer pin falls, the stamp, the points
  REVEAL_PER_GUESS_MS: 250,
  REVEAL_MAX_MS: 13_000,
  LEADERBOARD_MS: 6_000,
  FINAL_INTRO_MS: 4_000,
} as const;

/** §4: a LEADERBOARD interlude follows every 3rd question (never right before the final intro or after the final). */
export const LEADERBOARD_EVERY = 3;

export function revealMs(guesses: number): number {
  const t = TAQ_TIMING;
  return Math.min(t.REVEAL_MAX_MS, t.REVEAL_BASE_MS + t.REVEAL_PER_GUESS_MS * guesses);
}

// ─── §5 scoring ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const CLOSEST_POINTS = 1_000;
export const BULLSEYE_POINTS = 500;
export const FINAL_MULTIPLIER = 2;
/** §5.1: answers at or above this are judged by ratio (|ln(guess / answer)|); below it, by absolute distance. */
export const RATIO_FROM = 100;
/** §5.2: a guess within ±2 % of the answer is a Bullseye. */
export const BULLSEYE_SHARE = 0.02;
/** §5.1: two errors this close count as a tie (float noise of ln). */
export const TIE_EPSILON = 1e-9;
/** §5.4 "Way off!": the farthest guess, when ≥ 3 guesses and it is ≥ 10× off (ratio) or ≥ 2× the answer away (absolute). */
export const WILD_MIN_GUESSES = 3;
export const WILD_RATIO = 10;

/** §6.2: what a phone may send. Integers or decimals, never negative; 10^15 covers every answer with room to spare. */
export const GUESS_MAX = 1e15;

/**
 * §7 no-repeat memory: at most this many question ids per room (≈ 8 Normal games; the launch catalog has 140). Below the
 * platform's MEMORY_MAX_KEYS so a fifth game keeps the room history within the §2.6 budget (34 KiB). Ids are short
 * (`ITEM_ID`, ≤ 9 characters) for the same reason.
 */
export const TAQ_MEMORY_MAX = 120;
export const ITEM_ID = /^[a-z]{1,4}-\d{3,4}$/;
export const ANSWER_MAX = 1e15;

export type TaqMode = "ratio" | "absolute";

export const modeOf = (answer: number): TaqMode => (answer >= RATIO_FROM ? "ratio" : "absolute");

/**
 * §5.1 closeness error (lower is closer). Ratio mode: |ln(guess / answer)|, so half and double are equally far, and a
 * guess of 0 is infinitely far. Absolute mode: |guess − answer|.
 */
export function errorOf(guess: number, answer: number): number {
  if (modeOf(answer) === "absolute") return Math.abs(guess - answer);
  return guess > 0 ? Math.abs(Math.log(guess / answer)) : Number.POSITIVE_INFINITY;
}

export const isBullseye = (guess: number, answer: number): boolean => Math.abs(guess - answer) <= BULLSEYE_SHARE * answer + 1e-12;

export const sameError = (a: number, b: number): boolean => a === b || Math.abs(a - b) <= TIE_EPSILON;

/** §5.4 "Way off!" threshold for one guess. */
export function isWild(guess: number, answer: number): boolean {
  if (modeOf(answer) === "absolute") return Math.abs(guess - answer) >= Math.max(answer, 1);
  return errorOf(guess, answer) >= Math.log(WILD_RATIO);
}

/** A valid guess: a finite number in [0, GUESS_MAX] with at most 2 decimals (the phone keypad's precision). */
export function validGuess(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= GUESS_MAX && Math.abs(Math.round(v * 100) - v * 100) < 1e-6;
}

// ─── §8.3 number line + number words (client helpers, pure) ─────────────────────────────────────────────────────────

/** §8.3: the reveal line is logarithmic when the largest positive value is ≥ 20× the smallest one. */
export const LOG_LINE_SPREAD = 20;

export function useLogLine(values: readonly number[]): boolean {
  const pos = values.filter((v) => v > 0);
  if (pos.length < 2) return false;
  return Math.max(...pos) / Math.min(...pos) >= LOG_LINE_SPREAD;
}

/** Magnitude words a phone chip or a TV label may use (i18n `game.taqriban.mag.<id>`). */
export const MAGNITUDES = [
  { id: "thousand", exp: 3 },
  { id: "million", exp: 6 },
  { id: "billion", exp: 9 },
  { id: "trillion", exp: 12 },
] as const;
export type MagnitudeId = (typeof MAGNITUDES)[number]["id"];

/**
 * A number as "mantissa + magnitude word" for labels ("8.2" + billion). Values under 10 000 keep their digits (no word);
 * the mantissa keeps 3 significant digits and drops trailing zeros ("1.5", "330", "25"). Returns null mag below 10 000.
 */
export function compactParts(v: number): { mantissa: string; mag: MagnitudeId | null } {
  if (!(v >= 10_000)) return { mantissa: trimNum(v), mag: null };
  let pick: (typeof MAGNITUDES)[number] = MAGNITUDES[0];
  for (const m of MAGNITUDES) if (v >= 10 ** m.exp) pick = m;
  const x = v / 10 ** pick.exp;
  const digits = x >= 100 ? 0 : x >= 10 ? 1 : 2;
  return { mantissa: trimNum(Number(x.toFixed(digits))), mag: pick.id };
}

/** Plain digits with at most 2 decimals, trailing zeros dropped, no grouping ("8.5", "330", "0.25"). */
export function trimNum(v: number): string {
  if (!Number.isFinite(v)) return "0";
  const s = (Math.round(v * 100) / 100).toFixed(2);
  return s.replace(/\.?0+$/, "");
}

/** Western digits grouped by 3 with a thin space ("8 000 000 000"); always LTR, in every locale (§8.2). */
export function groupDigits(v: number): string {
  const [int, dec] = trimNum(v).split(".");
  const g = (int ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec ? `${g}.${dec}` : g;
}
