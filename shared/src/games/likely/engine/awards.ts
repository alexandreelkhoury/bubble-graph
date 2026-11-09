// GAME-LIKELY §6.2 awards. Signature, Mystery and Tonight's Star read per-card TALLIES only (safe in secret mode);
// Self-aware and Mind Reader read ballots and points and exist in public mode only.
import { SELF_AWARE_AWARD_MIN, STAR_MIN_TOPS } from "./state";
import type { LikelyAwardEntry, LikelyDelta } from "./state";
import type { LikelyTally } from "./result";

/**
 * `playerIds`: the award holders in seat order (every dealt-in player, left ones included: their card is greyed).
 * `tallies[i]` and `deltas[i]` belong to result i. Extra awards (star, selfAware, mindReader) go to non-left players.
 */
export function computeAwards(
  playerIds: readonly string[],
  tallies: readonly LikelyTally[],
  publicMode: boolean,
  deltas: readonly (readonly LikelyDelta[])[],
  scores: Readonly<Record<string, number>>,
  left: ReadonlySet<string>,
): LikelyAwardEntry[] {
  const out: LikelyAwardEntry[] = [];
  const tops = new Map<string, number>();
  for (const id of playerIds) {
    let best: { count: number; votesCast: number; index: number } | null = null;
    tallies.forEach((t, index) => {
      if (!t.topIds.includes(id)) return;
      tops.set(id, (tops.get(id) ?? 0) + 1);
      const count = t.counts.find((x) => x.playerId === id)?.count ?? 0;
      // Vote share compared exactly (cross-multiplied); a tie goes to the later card.
      const cmp = best === null ? 1 : count * best.votesCast - best.count * t.votesCast;
      if (best === null || cmp > 0 || (cmp === 0 && index > best.index)) best = { count, votesCast: t.votesCast, index };
    });
    const b = best as { index: number } | null;
    out.push(b ? { kind: "signature", playerIds: [id], cardIndex: b.index, value: null } : { kind: "mystery", playerIds: [id], cardIndex: null, value: null });
  }
  const active = playerIds.filter((id) => !left.has(id));
  const maxTops = Math.max(0, ...active.map((id) => tops.get(id) ?? 0));
  if (maxTops >= STAR_MIN_TOPS) out.push({ kind: "star", playerIds: active.filter((id) => tops.get(id) === maxTops), cardIndex: null, value: maxTops });
  if (publicMode) {
    const self = new Map<string, number>();
    for (const card of deltas) for (const d of card) if (d.reason === "selfAware") self.set(d.playerId, (self.get(d.playerId) ?? 0) + 1);
    const maxSelf = Math.max(0, ...active.map((id) => self.get(id) ?? 0));
    if (maxSelf >= SELF_AWARE_AWARD_MIN) out.push({ kind: "selfAware", playerIds: active.filter((id) => self.get(id) === maxSelf), cardIndex: null, value: maxSelf });
    const maxPts = Math.max(0, ...active.map((id) => scores[id] ?? 0));
    if (maxPts > 0) out.push({ kind: "mindReader", playerIds: active.filter((id) => (scores[id] ?? 0) === maxPts), cardIndex: null, value: maxPts });
  }
  return out;
}
