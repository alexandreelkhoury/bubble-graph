import type { Draft } from "./flow";
import { enterElimination, enterTieBreak, findPlayer } from "./flow";
import type { EngineError, VoteOutcome, VoteSummary } from "./types";

/** CAST_VOTE body (actor already checked to be an alive player). */
export function castVote(d: Draft, voterId: string, targetId: string): EngineError | null {
  const s = d.s;
  const target = findPlayer(s, targetId);
  if (!target || !target.alive || targetId === voterId) return "INVALID_TARGET";
  if (s.revote && !s.tieCandidates.includes(targetId)) return "INVALID_TARGET";
  s.votes[voterId] = targetId;
  maybeCloseVote(d);
  return null;
}

/** Close the vote when every alive connected player has voted (and there is at least one). */
export function maybeCloseVote(d: Draft): void {
  const s = d.s;
  if (s.phase !== "VOTING") return;
  const voters = s.players.filter((p) => p.alive && p.connected);
  if (voters.length > 0 && voters.every((p) => s.votes[p.id] !== undefined)) closeVote(d);
}

export function closeVote(d: Draft): void {
  const s = d.s;
  const alive = s.players.filter((p) => p.alive);
  const aliveIds = new Set(alive.map((p) => p.id));
  const candidates = new Set(s.revote ? s.tieCandidates : alive.map((p) => p.id));
  const byTarget = new Map<string, string[]>();
  const validVoters = new Set<string>();
  for (const voter of alive) {
    const target = s.votes[voter.id];
    if (target === undefined || target === voter.id || !aliveIds.has(target) || !candidates.has(target)) continue;
    validVoters.add(voter.id);
    const list = byTarget.get(target) ?? [];
    list.push(voter.id); // alive is in seat order → voterIds in seat order
    byTarget.set(target, list);
  }
  const seatOf = (id: string): number => findPlayer(s, id)?.seat ?? 0;
  const tally = [...byTarget.entries()]
    .map(([targetId, voterIds]) => ({ targetId, voterIds }))
    .sort((a, b) => b.voterIds.length - a.voterIds.length || seatOf(a.targetId) - seatOf(b.targetId));
  const abstainIds = alive.filter((p) => !validVoters.has(p.id)).map((p) => p.id);
  const summary = (outcome: VoteOutcome, eliminatedId: string | null): VoteSummary => ({
    round: s.round, revote: s.revote, tally, abstainIds, outcome, eliminatedId,
  });

  let outcome: VoteOutcome;
  let eliminatedId: string | null = null;
  if (tally.length === 0) {
    outcome = "NO_ELIMINATION";
  } else {
    const max = tally[0]?.voterIds.length ?? 0;
    const top = tally.filter((t) => t.voterIds.length === max).map((t) => t.targetId).sort((a, b) => seatOf(a) - seatOf(b));
    if (top.length === 1) {
      outcome = "ELIMINATED";
      eliminatedId = top[0] as string;
    } else if (!s.revote) {
      s.lastVote = summary("TIE", null);
      enterTieBreak(d, top);
      return;
    } else if (s.settings.tieBreak === "random") {
      outcome = "RANDOM";
      eliminatedId = top[d.rng.int(top.length)] as string;
    } else {
      outcome = "NO_ELIMINATION";
    }
  }
  const out = findPlayer(s, eliminatedId);
  if (out && out.role) {
    out.alive = false;
    s.eliminated = { playerId: out.id, role: out.role };
    s.history.push({ round: s.round, eliminatedId: out.id, role: out.role, cause: outcome === "RANDOM" ? "RANDOM" : "VOTE" });
  } else {
    s.eliminated = null;
    s.history.push({ round: s.round, eliminatedId: null, role: null, cause: "NONE" });
  }
  s.lastVote = summary(outcome, eliminatedId);
  enterElimination(d);
}
