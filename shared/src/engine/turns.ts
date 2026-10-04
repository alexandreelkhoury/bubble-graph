// Rounds, speaking turns, voting, elimination and the Blank's guess: every in-game phase transition.
import {
  CLUE_GRACE_MS,
  ELIMINATION_HOLD_MS,
  MAX_NO_ELIMINATION_STREAK,
  TIE_LEAD_IN_MS,
  VERDICT_HOLD_MS,
} from "../constants";
import type { Draft } from "./draft";
import { setDeadline } from "./draft";
import { clearRoundScratch, enterResults, resetToLobby } from "./lifecycle";
import { currentSpeakerId, findPlayer } from "./queries";
import type { DeadlineKind, Player } from "./types";
import { allVotesIn, resolveVote } from "./votes";
import { checkWinner } from "./win";

/** ROLE_REVEAL: if every connected player is ready → startRound(1). */
export function checkAllReady(d: Draft): void {
  if (d.s.phase !== "ROLE_REVEAL") return;
  if (d.s.players.every((p) => !p.connected || p.ready)) startRound(d, 1);
}

export function startRound(d: Draft, r: number): void {
  const s = d.s;
  s.round = r;
  s.phase = "CLUES";
  clearRoundScratch(s);
  const alive = s.players.filter((p) => p.alive);
  for (const p of alive) p.spoke = false;
  const ids = alive.map((p) => p.id);
  s.speakingOrder = openingOrder(d, ids);
  s.starterId = s.speakingOrder[0] ?? null;
  s.turnIdx = 0;
  beginTurn(d, false);
}

/**
 * Rotate `ids` (seat order) so a random non-Blank player opens. The Blank never speaks first, in any
 * round or tie-break. The opener is drawn at random rather than rotated by seat, so skipping the Blank
 * never publicly reveals their seat. Connected players are preferred because beginTurn skips a
 * disconnected opener, which could otherwise hand the first turn to the Blank. The last fallback
 * (anyone) only matters when no non-Blank remains, i.e. a forfeit cascade that ends the game.
 */
function openingOrder(d: Draft, ids: readonly string[]): string[] {
  const ps = ids.map((id) => findPlayer(d.s, id)).filter((p): p is Player => p !== undefined);
  const cands = ps.filter((p) => p.role !== "BLANK");
  const conn = cands.filter((p) => p.connected);
  const pool = conn.length > 0 ? conn : cands.length > 0 ? cands : ps;
  if (pool.length === 0) return [...ids];
  const k = ids.indexOf((pool[d.rng.int(pool.length)] as Player).id);
  return [...ids.slice(k), ...ids.slice(0, k)];
}

/** Skips speakers who cannot speak (dead, disconnected, already spoke); opens the vote when the pass is over. */
export function beginTurn(d: Draft, leadIn: boolean): void {
  const s = d.s;
  while (s.turnIdx < s.speakingOrder.length) {
    const p = findPlayer(s, s.speakingOrder[s.turnIdx]);
    if (p && p.alive && p.connected && !p.spoke) break;
    if (p) p.spoke = true;
    s.turnIdx++;
  }
  if (s.turnIdx >= s.speakingOrder.length) {
    enterVoting(d, s.phase === "TIE_BREAK");
    return;
  }
  const base = s.settings.clueSeconds * 1000;
  setDeadline(d, "CLUE", base > 0 && leadIn ? base + TIE_LEAD_IN_MS : base);
}

/** Current speaker finished (CLUE_DONE, CLUE expiry, or forfeit). */
export function finishTurn(d: Draft): void {
  const p = findPlayer(d.s, currentSpeakerId(d.s));
  if (p) p.spoke = true;
  d.s.turnIdx++;
  beginTurn(d, false);
}

/** A speaker who drops mid-turn with the clue timer off gets a grace deadline so the turn cannot stall. */
export function armClueGrace(d: Draft): void {
  if (d.s.deadline === null) setDeadline(d, "CLUE", CLUE_GRACE_MS);
}

export function enterVoting(d: Draft, revote: boolean): void {
  const s = d.s;
  s.phase = "VOTING";
  s.votes = {};
  s.revote = revote;
  if (!revote) s.tieCandidates = [];
  setDeadline(d, "VOTE", s.settings.voteSeconds * 1000);
}

/** VOTING: close the vote once every alive connected player has voted. */
export function maybeCloseVote(d: Draft): void {
  if (d.s.phase === "VOTING" && allVotesIn(d.s)) closeVote(d);
}

export function closeVote(d: Draft): void {
  const r = resolveVote(d);
  if (r.kind === "TIE") enterTieBreak(d, r.candidates);
  else enterElimination(d);
}

/** After a first-ballot tie: the tied players speak again, then a re-vote among them. */
function enterTieBreak(d: Draft, candidates: string[]): void {
  const s = d.s;
  s.tieCandidates = candidates;
  s.phase = "TIE_BREAK";
  s.votes = {};
  s.speakingOrder = openingOrder(d, candidates);
  s.turnIdx = 0;
  for (const id of candidates) {
    const p = findPlayer(s, id);
    if (p) p.spoke = false;
  }
  beginTurn(d, true);
}

function enterElimination(d: Draft): void {
  d.s.phase = "ELIMINATION";
  setDeadline(d, "ELIMINATION", ELIMINATION_HOLD_MS);
}

function afterElimination(d: Draft): void {
  const s = d.s;
  if (s.eliminated?.role === "BLANK" && s.settings.blankGuess) {
    const guesser = findPlayer(s, s.eliminated.playerId);
    s.phase = "MR_WHITE_GUESS";
    s.guess = { playerId: s.eliminated.playerId, status: "PENDING", text: null, overridden: false };
    // SPEC-GAP: §4.7 only short-circuits a disconnected guesser when guessSeconds is 0. A guesser who
    // has LEFT (or was kicked) during ELIMINATION can never submit, so they time out immediately too.
    if (!guesser || guesser.left || (!guesser.connected && s.settings.guessSeconds === 0)) {
      s.guess.status = "TIMEOUT";
      setDeadline(d, "VERDICT", VERDICT_HOLD_MS);
    } else {
      setDeadline(d, "GUESS", s.settings.guessSeconds * 1000);
    }
    return;
  }
  const w = checkWinner(s);
  if (w) {
    enterResults(d, w);
    return;
  }
  const relevant = s.history.filter((h) => h.cause === "VOTE" || h.cause === "RANDOM" || h.cause === "NONE");
  const lastN = relevant.slice(-MAX_NO_ELIMINATION_STREAK);
  if (lastN.length === MAX_NO_ELIMINATION_STREAK && lastN.every((h) => h.cause === "NONE")) {
    resetToLobby(d);
    return;
  }
  startRound(d, s.round + 1);
}

export function timeoutGuess(d: Draft): void {
  if (!d.s.guess) return;
  d.s.guess.status = "TIMEOUT";
  setDeadline(d, "VERDICT", VERDICT_HOLD_MS);
}

function resolveGuess(d: Draft): void {
  const s = d.s;
  const g = s.guess;
  /* v8 ignore next */
  if (!g) return;
  s.guessLog.push({ ...g });
  if (g.status === "CORRECT") {
    enterResults(d, "BLANK", [g.playerId]);
    return;
  }
  const w = checkWinner(s);
  if (w) enterResults(d, w);
  else startRound(d, s.round + 1);
}

/** A deadline of `kind` ran out (TICK) or the host skipped it (HOST_ADVANCE). */
export function expire(d: Draft, kind: DeadlineKind): void {
  switch (kind) {
    case "REVEAL": startRound(d, 1); break;
    case "CLUE": finishTurn(d); break;
    case "VOTE": closeVote(d); break;
    case "ELIMINATION": afterElimination(d); break;
    case "GUESS": timeoutGuess(d); break;
    case "VERDICT": resolveGuess(d); break;
  }
}
