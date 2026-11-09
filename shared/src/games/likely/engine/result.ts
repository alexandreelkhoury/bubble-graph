// GAME-LIKELY §5.1 (the result of a card, percentages) and §6 ("Read the Room" scoring). Pure functions.
import { AGREE_CAP, AGREE_POINTS, RESULT_MIN_VOTES, SELF_AWARE_BONUS, SELF_AWARE_MIN_OTHERS, UNANIMOUS_BONUS } from "./state";
import type { LikelyBallot, LikelyCount, LikelyDelta } from "./state";

export interface LikelyTally {
  votesCast: number;
  counts: { playerId: string; count: number }[];   // targets with ≥ 1 vote, seat order
  topIds: string[];                                 // seat order; [] on chaos or no vote
  unanimous: boolean;
  chaos: boolean;
}

/** round(100 × count / votesCast), half up, in integers (no float drift). 0 when nobody voted. */
export function percentOf(count: number, votesCast: number): number {
  if (votesCast <= 0) return 0;
  return Math.floor((200 * count + votesCast) / (2 * votesCast));
}

/** `seatOrder` = every player id in seat order. The result never depends on the ballots' order. */
export function tally(ballots: readonly LikelyBallot[], seatOrder: readonly string[]): LikelyTally {
  const by = new Map<string, number>();
  for (const b of ballots) by.set(b.targetId, (by.get(b.targetId) ?? 0) + 1);
  const counts = seatOrder.filter((id) => by.has(id)).map((id) => ({ playerId: id, count: by.get(id) as number }));
  const votesCast = ballots.length;
  const max = counts.reduce((m, c) => Math.max(m, c.count), 0);
  const chaos = votesCast >= RESULT_MIN_VOTES && counts.every((c) => c.count === 1);
  const unanimous = votesCast >= RESULT_MIN_VOTES && counts.length === 1;
  const topIds = chaos || max < 1 ? [] : counts.filter((c) => c.count === max).map((c) => c.playerId);
  return { votesCast, counts, topIds, unanimous, chaos };
}

/** Counts with percentages, ordered percent desc, then count desc, then seat (§5.1). Tallies only. */
export function withPercent(t: LikelyTally): LikelyCount[] {
  const seat = new Map(t.counts.map((c, i) => [c.playerId, i]));
  return t.counts
    .map((c) => ({ playerId: c.playerId, count: c.count, percent: percentOf(c.count, t.votesCast) }))
    .sort((a, b) => b.percent - a.percent || b.count - a.count || (seat.get(a.playerId) as number) - (seat.get(b.playerId) as number));
}

/**
 * Public-mode deltas of one card, in voter seat order then reason order (agree, unanimous, selfAware). Only positive
 * deltas are listed. Secret mode never calls this (no points at all, §6).
 */
export function scoreCard(ballots: readonly LikelyBallot[], t: LikelyTally, seatOrder: readonly string[]): LikelyDelta[] {
  const countOf = new Map(t.counts.map((c) => [c.playerId, c.count]));
  const seat = new Map(seatOrder.map((id, i) => [id, i]));
  const sorted = [...ballots].sort((a, b) => (seat.get(a.voterId) ?? 0) - (seat.get(b.voterId) ?? 0));
  const out: LikelyDelta[] = [];
  for (const b of sorted) {
    const others = (countOf.get(b.targetId) ?? 0) - 1;
    const agree = t.unanimous ? AGREE_CAP : Math.min(AGREE_CAP, AGREE_POINTS * others);
    if (agree > 0) out.push({ playerId: b.voterId, points: agree, reason: "agree" });
    if (t.unanimous) out.push({ playerId: b.voterId, points: UNANIMOUS_BONUS, reason: "unanimous" });
    if (b.voterId === b.targetId && others >= SELF_AWARE_MIN_OTHERS) out.push({ playerId: b.voterId, points: SELF_AWARE_BONUS, reason: "selfAware" });
  }
  return out;
}
