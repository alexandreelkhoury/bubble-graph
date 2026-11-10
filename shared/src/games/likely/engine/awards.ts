// GAME-LIKELY §6.2 awards. Signature, Mystery and Tonight's Star read per-card TALLIES only (safe in secret mode);
// Self-aware and Mind Reader read ballots and points and exist in public mode only.
import { RESULT_MIN_VOTES, RUNNER_UP_MIN_VOTES, RUNNER_UP_VALUE, SELF_AWARE_AWARD_MIN, STAR_MIN_TOPS } from "./state";
import type { LikelyAwardEntry, LikelyDelta } from "./state";
import type { LikelyTally } from "./result";

interface Pick { count: number; votesCast: number; index: number }

/**
 * The signature ranking (GAME-LIKELY §6.2 rule 1, as amended by the owner in the G3 review, 2026-11-10):
 * 1. a card with ≥ 3 votes cast beats one with fewer (a 1-of-1 "100 %" never beats a real 5-of-12 majority);
 * 2. then the higher vote share (compared exactly, cross-multiplied);
 * 3. then more votes (3 of 3 beats 2 of 2);
 * 4. then the later card.
 */
function better(a: Pick, b: Pick): boolean {
  const solidA = a.votesCast >= RESULT_MIN_VOTES ? 1 : 0;
  const solidB = b.votesCast >= RESULT_MIN_VOTES ? 1 : 0;
  if (solidA !== solidB) return solidA > solidB;
  const share = a.count * b.votesCast - b.count * a.votesCast;
  if (share !== 0) return share > 0;
  if (a.count !== b.count) return a.count > b.count;
  return a.index > b.index;
}

/**
 * Rule 2 (amended): a player who was never top but got ≥ 2 votes on a card (not Chaos) takes that card's award as a
 * runner-up signature (`value: RUNNER_UP_VALUE`, ranked like rule 1); only a player who never got 2 votes anywhere gets
 * the Mystery Award. Tallies only, so it stays safe in secret mode.
 *
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
    let best: Pick | null = null;
    let runnerUp: Pick | null = null;
    tallies.forEach((t, index) => {
      const count = t.counts.find((x) => x.playerId === id)?.count ?? 0;
      const pick: Pick = { count, votesCast: t.votesCast, index };
      if (t.topIds.includes(id)) {
        tops.set(id, (tops.get(id) ?? 0) + 1);
        if (best === null || better(pick, best)) best = pick;
      } else if (!t.chaos && count >= RUNNER_UP_MIN_VOTES && (runnerUp === null || better(pick, runnerUp))) {
        runnerUp = pick;
      }
    });
    const b = best as Pick | null;
    const r = runnerUp as Pick | null;
    if (b) out.push({ kind: "signature", playerIds: [id], cardIndex: b.index, value: null });
    else if (r) out.push({ kind: "signature", playerIds: [id], cardIndex: r.index, value: RUNNER_UP_VALUE });
    else out.push({ kind: "mystery", playerIds: [id], cardIndex: null, value: null });
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
