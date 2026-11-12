// GAME-LIKELY §5.1: the result of a card and its percentages. Pure functions. (No scoring: the game has no points, §6.)
import { RESULT_MIN_VOTES } from "./state";
import type { LikelyBallot, LikelyCount } from "./state";

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
