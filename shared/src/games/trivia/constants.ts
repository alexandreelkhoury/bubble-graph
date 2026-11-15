// GAME-TRIVIA §3, §4, §4.1, §5, §9, §11.4 numbers in one place (zod-free, engine-free: clients may import it through
// meta.ts, e.g. for timer rings and the "points" rule copy).

export const STATE_SCHEMA = 1;
export const SETTINGS_SCHEMA = 1;
export const VIEW_VERSION = 1;

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 12;

export const QUESTION_TYPES = ["mc4", "tf"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** §4: lengths, capped by the quiz pool. */
export const LENGTHS = { short: 7, normal: 10, long: 15 } as const;
export type LengthId = keyof typeof LENGTHS;
export const LENGTH_IDS = ["short", "normal", "long"] as const satisfies readonly LengthId[];

/** §4.1 / §9: ANSWER duration per pace for mc4; tf gets 2/3 of it, rounded to the second. */
export const PACE_MC4_MS = { relaxed: 20_000, normal: 15_000, fast: 10_000 } as const;
export type PaceId = keyof typeof PACE_MC4_MS;
export const PACE_IDS = ["relaxed", "normal", "fast"] as const satisfies readonly PaceId[];

export function answerMs(type: QuestionType, pace: PaceId): number {
  const mc4 = PACE_MC4_MS[pace];
  return type === "mc4" ? mc4 : Math.round((mc4 * 2) / 3 / 1_000) * 1_000;
}

/** §4.1 phase durations (ms). */
export const QUIZ_INTRO_MS = 4_000;           // + ENTRANCE_GRACE_MS (start's graceMs)
export const READ_BASE_MS = 2_500;
export const READ_PER_CHAR_MS = 40;
export const READ_MIN_MS = 3_000;
export const READ_MAX_MS = 7_000;
/** READ = clamp(2 500 + 40 × questionChars, 3 000, 7 000); questionChars = graphemes in the content language. */
export function readMs(questionChars: number): number {
  return Math.min(READ_MAX_MS, Math.max(READ_MIN_MS, READ_BASE_MS + READ_PER_CHAR_MS * questionChars));
}
export const EARLY_END_MS = 600;              // every awaited player answered → deadline = now + 600
export const REVEAL_MS = 6_000;
export const REVEAL_EXPLAIN_MS = 3_000;       // + when the question has an `explain`
export const LEADERBOARD_MS = 6_000;
export const FINAL_INTRO_MS = 4_000;

/** §5.1 / §5.2 scoring. */
export const GRACE_MS = 300;
export const BASE_POINTS: Readonly<Record<QuestionType, number>> = { mc4: 500, tf: 250 };
export const SPEED_MAX: Readonly<Record<QuestionType, number>> = { mc4: 500, tf: 250 };
export const FINAL_MULTIPLIER = 2;
export const STREAK_STEP = 100;
export const STREAK_CAP = 300;

/** §4: a LEADERBOARD interlude follows every 3rd question (and precedes the final). */
export const LEADERBOARD_EVERY = 3;

/** §5.4 highlights. */
export const FASTEST_MIN_CORRECT = 2;
export const GENIUS_MIN_ANSWERS = 3;
export const ON_FIRE_MIN = 3;                 // 3, 5, 7…

/** §11.4 draw: first 30 % easy, last 30 % hard. */
export const EASY_SHARE = 0.3;
export const HARD_SHARE = 0.3;

/**
 * §9 "featured" order (owner decision, JAMAA-GAP: the pack header has no `featured` flag): these families come first,
 * in this order, on the shelf and as the `quizId: null` default. Families not listed follow in catalog order.
 */
export const FEATURED_QUIZ_IDS: readonly string[] = ["world-mix-01"];

/** Platform §5.2 table: a Trivia pack has ≥ 20 questions. */
export const MIN_QUESTIONS = 20;
