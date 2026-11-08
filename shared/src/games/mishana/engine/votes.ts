// Ballots and their tally. Pure bookkeeping: the phase change that follows a closed vote lives in turns.ts.
import { findPlayer } from "./queries";
import type { Draft } from "./draft";
import type { EngineError, GameState, VoteOutcome, VoteSummary } from "./types";

/** CAST_VOTE body (actor already checked to be an alive player). Records the ballot; never closes the vote. */
export function castVote(d: Draft, voterId: string, targetId: string): EngineError | null {
  const s = d.s;
  const target = findPlayer(s, targetId);
  if (!target || !target.alive || targetId === voterId) return "INVALID_TARGET";
  if (s.revote && !s.tieCandidates.includes(targetId)) return "INVALID_TARGET";
  s.votes[voterId] = targetId;
  return null;
}

/** Every alive connected player has voted (and there is at least one). */
export function allVotesIn(s: GameState): boolean {
  const voters = s.players.filter((p) => p.alive && p.connected);
  return voters.length > 0 && voters.every((p) => s.votes[p.id] !== undefined);
}

/** What closing the vote led to: a first-ballot tie (→ TIE_BREAK) or a settled ballot (→ ELIMINATION). */
export type VoteResolution = { kind: "TIE"; candidates: string[] } | { kind: "SETTLED" };

/** Tallies the ballots and records `lastVote` (plus the elimination and its history entry when settled). */
export function resolveVote(d: Draft): VoteResolution {
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
      return { kind: "TIE", candidates: top };
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
  return { kind: "SETTLED" };
}
