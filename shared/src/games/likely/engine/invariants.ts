// GAME-LIKELY §13.3 invariants (plus structural ones), checked after every reduce by tests, the sim and the room.
import { MEMORY_MAX_KEYS } from "../../../constants";
import { InvariantError } from "../../mishana/engine/invariants";
import { LIKELY_LENGTHS, LIKELY_PHASES } from "../meta";
import { awardsOf, isAnonymous, isTarget, resultBallots, resultNamed, resultDeltas, resultTally, seatIds } from "./reduce";
import { percentOf } from "./result";
import { MAX_CARD_POINTS, NAMED_MIN_PLAYERS, STATE_SCHEMA } from "./state";
import type { LikelyState } from "./state";

export function assertInvariants(s: LikelyState): void {
  const fail = (m: string): never => {
    throw new InvariantError(`likely: ${m}`);
  };
  if (s.schema !== STATE_SCHEMA) fail("schema");
  if (!(LIKELY_PHASES as readonly string[]).includes(s.phase)) fail(`phase ${s.phase}`);
  if (s.cardCount !== LIKELY_LENGTHS[s.settings.length]) fail("cardCount");
  const ids = seatIds(s);
  if (new Set(ids).size !== ids.length) fail("duplicate player");
  if (new Set(s.players.map((p) => p.n)).size !== s.players.length) fail("duplicate entry number");
  for (let k = 1; k < s.players.length; k++) if ((s.players[k - 1]?.seat ?? 0) >= (s.players[k]?.seat ?? 0)) fail("seat order");
  for (const p of s.players) {
    if (p.left && p.connected) fail(`left player ${p.id} connected`);
    if (p.waiting !== (p.firstCard === null)) fail(`waiting/firstCard of ${p.id}`);
    if (!(p.id in s.scores)) fail(`no score for ${p.id}`);
  }
  if (Object.keys(s.scores).length !== s.players.length) fail("score keys");
  if (new Set(s.memoryKeys).size !== s.memoryKeys.length) fail("memoryKeys not unique");
  if (s.drawnCount < 0 || s.drawnCount > s.memoryKeys.length || s.memoryKeys.length - s.drawnCount > MEMORY_MAX_KEYS) fail("drawnCount");

  // 1. One vote per voter; voters dealt in; targets are players who are not waiting and not the named player.
  //    (A target may have left after the vote was cast: §7 "not a target from the next card on".)
  if (s.phase !== "VOTING" && Object.keys(s.votes).length > 0) fail("votes outside VOTING");
  for (const [v, t] of Object.entries(s.votes)) {
    const pv = s.players.find((p) => p.id === v);
    const pt = s.players.find((p) => p.id === t);
    if (!pv || pv.waiting) fail(`voter ${v}`);
    if (!pt || pt.waiting || s.card?.namedPlayerId === t) fail(`target ${t}`);
    if (pt && !pt.left && !isTarget(s, t)) fail(`target ${t}`);
  }

  // Phase shape.
  const carded = s.phase === "CARD" || s.phase === "VOTING" || s.phase === "REVEAL";
  if (carded !== (s.card !== null)) fail("card presence");
  if ((s.phase === "HOLD" || s.phase === "RESULTS") !== (s.deadline === null)) fail("deadline presence");
  if (s.earlyEnd && s.phase !== "VOTING") fail("earlyEnd outside VOTING");
  if (s.cardIndex > s.cardCount || s.results.length !== s.cardIndex + (s.phase === "REVEAL" ? 1 : 0)) fail("card counter");
  if (s.card && s.memoryKeys[s.memoryKeys.length - 1] !== s.card.cardId) fail("the current card is not the last drawn");

  for (const [i, r] of s.results.entries()) {
    const b = resultBallots(s, r);
    if (b.some((x) => !x.voterId || !x.targetId)) fail(`ballot of an unknown player on card ${i}`);
    const t = resultTally(s, r);
    // 4.
    if (t.chaos && t.topIds.length > 0) fail("chaos with a top");
    if (t.unanimous && t.topIds.length !== 1) fail("unanimous top");
    // 7. Percentages come from the same tallies; independent rounding stays within ±1 per target of 100.
    const sum = t.counts.reduce((m, c) => m + percentOf(c.count, t.votesCast), 0);
    if (t.votesCast > 0 && Math.abs(sum - 100) > t.counts.length) fail(`percent sum ${sum} on card ${i}`);
    // 6. A named player is never a target on their card.
    const named = resultNamed(s, r);
    if (r.named !== null && named === null) fail(`unknown named player on card ${i}`);
    if (named !== null && b.some((x) => x.targetId === named)) fail("ballot on the named player");
    if (r.picks.some((t) => t >= 0 && !s.players.some((p) => p.n === t))) fail(`pick of an unknown player on card ${i}`);
    // 5. Per-card caps.
    const per = new Map<string, number>();
    for (const d of resultDeltas(s, r)) {
      if (d.points <= 0) fail("non-positive delta");
      per.set(d.playerId, (per.get(d.playerId) ?? 0) + d.points);
    }
    for (const v of per.values()) if (v > MAX_CARD_POINTS) fail("per-card cap");
  }
  // 5. Scores ≥ 0 and equal to the sum of the deltas.
  const sumD = s.results.reduce((m, r) => m + resultDeltas(s, r).reduce((x, d) => x + d.points, 0), 0);
  const sumS = Object.values(s.scores).reduce((m, x) => m + x, 0);
  if (sumD !== sumS) fail(`score sum ${sumS} ≠ deltas ${sumD}`);
  if (Object.values(s.scores).some((x) => !Number.isInteger(x) || x < 0)) fail("negative score");
  // 3. Secret votes: no points, no Self-aware / Mind Reader award.
  if (isAnonymous(s)) {
    if (Object.values(s.scores).some((x) => x !== 0)) fail("score in secret mode");
    if (awardsOf(s).some((a) => a.kind === "selfAware" || a.kind === "mindReader")) fail("ballot award in secret mode");
  }
  // 6. Family stays family; a named card has a named, non-left player in a game of ≥ 4.
  if (s.card) {
    if (s.settings.mode === "family" && (s.card.spicy || s.card.namedPlayerId !== null)) fail("spicy card in family mode");
    if (s.card.namedPlayerId !== null) {
      const np = s.players.find((p) => p.id === s.card?.namedPlayerId);
      if (!np || (np.left && s.phase !== "REVEAL")) fail("named player missing or left");
    }
  }
  if (s.settings.mode === "family" && s.results.some((r) => r.named !== null)) fail("named card in family mode");
  const named = s.results.map((r) => r.named !== null);
  if (s.card?.namedPlayerId && s.phase !== "REVEAL") named.push(true);
  for (let k = 1; k < named.length; k++) if (named[k] && (named[k - 1] || named[k - 2])) fail("named-card spacing");
  if (s.card?.namedPlayerId && s.players.filter((p) => !p.waiting).length < NAMED_MIN_PLAYERS) fail("named card with < 4 players");
  // Awards: exactly one signature-or-mystery card per dealt-in player.
  if (s.phase === "AWARDS" || s.phase === "RESULTS") {
    const sig = awardsOf(s).filter((a) => a.kind === "signature" || a.kind === "mystery");
    const holders = sig.map((a) => a.playerIds[0]);
    if (sig.some((a) => a.playerIds.length !== 1) || new Set(holders).size !== holders.length) fail("signature awards not one each");
    for (const h of holders) if (!s.players.some((p) => p.id === h)) fail(`award for unknown ${String(h)}`);
  }
}
