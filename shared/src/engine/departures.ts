// A player dropping out mid-game: forfeits (LEAVE / KICK) and disconnect side effects (§4.8).
import type { Draft } from "./draft";
import { enterResults } from "./lifecycle";
import { markLeft } from "./membership";
import { currentSpeakerId, isPlaying, isSpeakingPhase } from "./queries";
import { armClueGrace, beginTurn, checkAllReady, enterVoting, maybeCloseVote, timeoutGuess } from "./turns";
import type { HistoryCause, Player } from "./types";
import { checkWinner } from "./win";

export function forfeit(d: Draft, p: Player, cause: HistoryCause): void {
  const s = d.s;
  markLeft(d, p);
  if (!p.alive) {
    // A dead player's only pending duty is their own Blank guess.
    if (s.phase === "MR_WHITE_GUESS" && s.guess?.playerId === p.id && s.guess.status === "PENDING") timeoutGuess(d);
    return;
  }
  p.alive = false;
  s.history.push({ round: s.round, eliminatedId: p.id, role: p.role, cause });
  for (const [voter, target] of Object.entries(s.votes)) {
    if (voter === p.id || target === p.id) delete s.votes[voter];
  }
  s.tieCandidates = s.tieCandidates.filter((id) => id !== p.id);
  const wasSpeaker = currentSpeakerId(s) === p.id;
  if ((s.phase === "TIE_BREAK" || (s.phase === "VOTING" && s.revote)) && s.tieCandidates.length < 2) {
    enterVoting(d, false);
  } else if (s.phase === "ROLE_REVEAL") {
    checkAllReady(d);
  } else if (isSpeakingPhase(s.phase) && wasSpeaker) {
    p.spoke = true;
    s.turnIdx++;
    beginTurn(d, false);
  }
  // (the MR_WHITE_GUESS guesser is never alive, so the guess rule needs no branch here)
  if (isPlaying(s.phase)) {
    const w = checkWinner(s);
    if (w) {
      enterResults(d, w);
      return;
    }
  }
  maybeCloseVote(d);
}

/** DISCONNECT side effects by phase (§4.8). */
export function onDisconnect(d: Draft, p: Player): void {
  const s = d.s;
  if (isSpeakingPhase(s.phase) && currentSpeakerId(s) === p.id) armClueGrace(d);
  else if (s.phase === "ROLE_REVEAL") checkAllReady(d);
  else maybeCloseVote(d);
}
