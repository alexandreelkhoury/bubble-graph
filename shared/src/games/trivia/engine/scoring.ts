// GAME-TRIVIA §5: answer time, speed points, final ×2, capped streaks, ranking with tie-breaks, per-question highlights.
// Integer arithmetic only (no float rounding surprises at the round10 boundaries).
import { BASE_POINTS, FASTEST_MIN_CORRECT, FINAL_MULTIPLIER, GENIUS_MIN_ANSWERS, GRACE_MS, ON_FIRE_MIN, SPEED_MAX, STREAK_CAP, STREAK_STEP, type QuestionType } from "../constants";

/** §5.1: t = clamp(receivedAt − answerOpenAt − GRACE_MS, 0, T). receivedAt is ctx.now (server receipt); never a client clock. */
export function answerTime(receivedAt: number, answerOpenAt: number, T: number): number {
  return Math.min(T, Math.max(0, receivedAt - answerOpenAt - GRACE_MS));
}

/** round10(max × (1 − t/T)), half up, in integers: floor((2·(max/10)·(T−t) + T) / (2T)) × 10. */
export function speedBonus(type: QuestionType, t: number, T: number): number {
  if (T <= 0) return 0;
  const tenths = SPEED_MAX[type] / 10;
  return Math.floor((2 * tenths * (T - t) + T) / (2 * T)) * 10;
}

/** Base + speed (before the final multiplier). mc4 500..1000, tf 250..500. */
export function answerPoints(type: QuestionType, t: number, T: number): number {
  return BASE_POINTS[type] + speedBonus(type, t, T);
}

/** §5.2: streak s counts this answer; bonus min(100 × (s − 1), 300). */
export function streakBonus(streak: number): number {
  return streak <= 1 ? 0 : Math.min(STREAK_STEP * (streak - 1), STREAK_CAP);
}

export interface Scored { points: number; streakBonus: number; streak: number }
/** One player's result for one question. Wrong or no answer: 0 and the streak resets. Never negative. */
export function scoreAnswer(a: { correct: boolean; type: QuestionType; t: number | null; T: number; isFinal: boolean; prevStreak: number }): Scored {
  if (!a.correct || a.t === null) return { points: 0, streakBonus: 0, streak: 0 };
  const streak = a.prevStreak + 1;
  return { points: answerPoints(a.type, a.t, a.T) * (a.isFinal ? FINAL_MULTIPLIER : 1), streakBonus: streakBonus(streak), streak };
}

export const isOnFire = (streak: number): boolean => streak >= ON_FIRE_MIN && streak % 2 === 1;

// ─── ranking (§5.3) ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface RankRow { id: string; seat: number; score: number; correct: number; timeSum: number }
/** Total points ↓, correct answers ↓, summed correct time ↑; still equal → shared place (competition 1, 1, 3). */
export function rankRows<R extends RankRow>(rows: readonly R[]): (R & { rank: number })[] {
  const cmp = (a: R, b: R) => b.score - a.score || b.correct - a.correct || a.timeSum - b.timeSum;
  const sorted = [...rows].sort((a, b) => cmp(a, b) || a.seat - b.seat);
  const out: (R & { rank: number })[] = [];
  sorted.forEach((r, i) => {
    const prev = out[i - 1];
    out.push({ ...r, rank: prev && cmp(prev, r) === 0 ? prev.rank : i + 1 });
  });
  return out;
}

/** Groups of ids by shared place, best first. */
export function rankGroups(rows: readonly RankRow[]): string[][] {
  const groups: string[][] = [];
  let last = -1;
  for (const r of rankRows(rows)) {
    if (r.rank !== last) { groups.push([]); last = r.rank; }
    groups[groups.length - 1]!.push(r.id);
  }
  return groups;
}

// ─── highlights (§5.4) ───────────────────────────────────────────────────────────────────────────────────────────────

export interface HighlightRow { id: string; choice: number | null; correct: boolean; timeMs: number | null }
export function highlights(choices: readonly HighlightRow[]): { fastestIds: string[]; stumped: boolean; genius: boolean; tooSlow: boolean } {
  const answered = choices.filter((c) => c.choice !== null);
  const right = answered.filter((c) => c.correct);
  let fastestIds: string[] = [];
  if (right.length >= FASTEST_MIN_CORRECT) {
    const best = Math.min(...right.map((c) => c.timeMs as number));
    fastestIds = right.filter((c) => c.timeMs === best).map((c) => c.id);
  }
  return {
    fastestIds,
    stumped: right.length === 0,
    genius: answered.length >= GENIUS_MIN_ANSWERS && right.length === answered.length,
    tooSlow: answered.length === 0,
  };
}
