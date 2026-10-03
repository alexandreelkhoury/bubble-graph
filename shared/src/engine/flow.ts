import {
  CLUE_GRACE_MS,
  ELIMINATION_HOLD_MS,
  MAX_NO_ELIMINATION_STREAK,
  MIN_PLAYERS,
  TIE_LEAD_IN_MS,
  VERDICT_HOLD_MS,
} from "../constants";
import type { Catalog } from "./catalog";
import { pickPair } from "./catalog";
import type { Rng } from "./rng";
import { assignRoles, effectiveRoleCounts } from "./roles";
import { awardPoints } from "./scoring";
import type { DeadlineKind, EngineError, GameState, HistoryCause, Player, Winner } from "./types";
import { closeVote, maybeCloseVote } from "./votes";
import { checkWinner } from "./win";

/** Mutable working copy used inside one `reduce` call. */
export interface Draft { s: GameState; now: number; rng: Rng; catalog: Catalog }

export const IN_GAME_PHASES = ["ROLE_REVEAL", "CLUES", "VOTING", "TIE_BREAK", "ELIMINATION", "MR_WHITE_GUESS"] as const;
export function isInGame(phase: GameState["phase"]): boolean {
  return (IN_GAME_PHASES as readonly string[]).includes(phase);
}

export function findPlayer(s: GameState, id: string | null | undefined): Player | undefined {
  return id == null ? undefined : s.players.find((p) => p.id === id);
}

export function setDeadline(d: Draft, kind: DeadlineKind, ms: number): void {
  if (ms <= 0) {
    d.s.deadline = null;
    return;
  }
  d.s.deadlineSeq += 1;
  d.s.deadline = { id: d.s.deadlineSeq, kind, at: d.now + ms, durationMs: ms };
}

export function currentSpeakerId(s: GameState): string | null {
  if (s.phase !== "CLUES" && s.phase !== "TIE_BREAK") return null;
  return s.speakingOrder[s.turnIdx] ?? null;
}

// ---------------------------------------------------------------- START

export function startGame(d: Draft): EngineError | null {
  const s = d.s;
  if (s.players.filter((p) => p.connected).length < MIN_PLAYERS) return "NOT_ENOUGH_PLAYERS";
  const counts = effectiveRoleCounts(s.settings, s.players.length);
  if (!counts) return "INVALID_ROLE_CONFIG";
  const picked = pickPair(d.catalog, s.settings, s.usedPairKeys, d.rng);
  if (!picked) return "NO_WORDS_AVAILABLE";
  const cp = picked.pair;
  let civ = cp.civilian;
  let und = cp.undercover;
  if (s.settings.swapSides && d.rng.next() < 0.5) [civ, und] = [und, civ];
  const pack = d.catalog.packs.find((p) => p.id === cp.packId);
  /* v8 ignore next */
  const title = pack ? { ...pack.title } : { en: cp.packId, fr: cp.packId, ar: cp.packId };
  s.pair = {
    key: cp.key, packId: cp.packId, packVersion: cp.packVersion, pairId: cp.pairId, packTitle: title,
    civilian: { text: civ.text, translit: civ.translit, alt: [...civ.alt] },
    undercover: { text: und.text, translit: und.translit, alt: [...und.alt] },
  };
  s.usedPairKeys = [...picked.usedPairKeys, cp.key];
  s.players.forEach((p, i) => { p.seat = i; });
  const roles = assignRoles(s.players.map((p) => p.id), counts, d.rng);
  for (const p of s.players) {
    const role = roles.get(p.id) ?? "CIVILIAN";
    p.role = role;
    p.word =
      role === "CIVILIAN" ? { text: s.pair.civilian.text, translit: s.pair.civilian.translit }
      : role === "UNDERCOVER" ? { text: s.pair.undercover.text, translit: s.pair.undercover.translit }
      : null;
    p.alive = true;
    p.left = false;
    p.spoke = false;
    p.ready = !p.connected;
  }
  s.gameNumber += 1;
  s.round = 0;
  s.roleCounts = counts;
  s.history = [];
  s.lastVote = null;
  s.eliminated = null;
  s.guess = null;
  s.guessLog = [];
  s.result = null;
  s.votes = {};
  s.tieCandidates = [];
  s.revote = false;
  s.speakingOrder = [];
  s.turnIdx = 0;
  s.starterId = null;
  s.phase = "ROLE_REVEAL";
  setDeadline(d, "REVEAL", s.settings.revealSeconds * 1000);
  return null;
}

/** ROLE_REVEAL: if every connected player is ready → startRound(1). */
export function checkAllReady(d: Draft): void {
  if (d.s.phase !== "ROLE_REVEAL") return;
  if (d.s.players.every((p) => !p.connected || p.ready)) startRound(d, 1);
}

// ---------------------------------------------------------------- rounds and turns

export function startRound(d: Draft, r: number): void {
  const s = d.s;
  s.round = r;
  s.phase = "CLUES";
  s.revote = false;
  s.tieCandidates = [];
  s.votes = {};
  s.lastVote = null;
  s.eliminated = null;
  s.guess = null;
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

export function enterVoting(d: Draft, revote: boolean): void {
  const s = d.s;
  s.phase = "VOTING";
  s.votes = {};
  s.revote = revote;
  if (!revote) s.tieCandidates = [];
  setDeadline(d, "VOTE", s.settings.voteSeconds * 1000);
}

/** Called from closeVote after a first-ballot tie. */
export function enterTieBreak(d: Draft, candidates: string[]): void {
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

export function enterElimination(d: Draft): void {
  d.s.phase = "ELIMINATION";
  setDeadline(d, "ELIMINATION", ELIMINATION_HOLD_MS);
}

export function afterElimination(d: Draft): void {
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

export function resolveGuess(d: Draft): void {
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

export function enterResults(d: Draft, winner: Winner, ids?: readonly string[]): void {
  const s = d.s;
  const pair = s.pair;
  /* v8 ignore next */
  if (!pair) return;
  const eligible = (p: Player): boolean => {
    if (p.left) return false;
    if (winner === "CIVILIANS") return p.role === "CIVILIAN";
    if (winner === "INFILTRATORS") return p.role === "UNDERCOVER" || p.role === "BLANK";
    return (ids ?? []).includes(p.id);
  };
  const winnerIds = s.players.filter(eligible).map((p) => p.id);
  const pointsAwarded = awardPoints(s, winner, winnerIds);
  for (const p of s.players) p.score += pointsAwarded[p.id] ?? 0;
  s.result = {
    winner,
    winnerIds,
    civilianWord: { text: pair.civilian.text, translit: pair.civilian.translit },
    undercoverWord: { text: pair.undercover.text, translit: pair.undercover.translit },
    pack: { id: pair.packId, version: pair.packVersion, title: { ...pair.packTitle } },
    pointsAwarded,
    guesses: s.guessLog.map((g) => ({ ...g })),
  };
  s.phase = "RESULTS";
  s.deadline = null;
}

export function resetToLobby(d: Draft): void {
  const s = d.s;
  const hostLeft = s.players.some((p) => p.left && p.id === s.hostPlayerId);
  s.players = s.players.filter((p) => !p.left);
  if (hostLeft) reassignHost(s);
  for (const p of s.players) {
    p.role = null;
    p.word = null;
    p.alive = true;
    p.ready = false;
    p.spoke = false;
    if (!p.connected) p.disconnectedAt = d.now;
  }
  s.phase = "LOBBY";
  s.round = 0;
  s.roleCounts = null;
  s.pair = null;
  s.lastVote = null;
  s.eliminated = null;
  s.guess = null;
  s.result = null;
  s.deadline = null;
  s.history = [];
  s.guessLog = [];
  s.speakingOrder = [];
  s.tieCandidates = [];
  s.votes = {};
  s.starterId = null;
  s.revote = false;
  s.turnIdx = 0;
}

/** Phase-inferred deadline kind (used by HOST_ADVANCE). */
export function inferKind(s: GameState): DeadlineKind | null {
  switch (s.phase) {
    case "ROLE_REVEAL": return "REVEAL";
    case "CLUES":
    case "TIE_BREAK": return "CLUE";
    case "VOTING": return "VOTE";
    case "ELIMINATION": return "ELIMINATION";
    case "MR_WHITE_GUESS": return s.guess?.status === "PENDING" ? "GUESS" : "VERDICT";
    default: return null;
  }
}

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

// ---------------------------------------------------------------- membership

export function reassignHost(s: GameState): void {
  const byJoin = (a: Player, b: Player): number => a.joinedAt - b.joinedAt || a.seat - b.seat;
  const live = s.players.filter((p) => !p.left).sort(byJoin);
  const pick = live.find((p) => p.connected) ?? live[0];
  s.hostPlayerId = pick?.id ?? null;
}

export function removePlayer(s: GameState, id: string): void {
  s.players = s.players.filter((p) => p.id !== id);
  if (s.hostPlayerId === id) reassignHost(s);
}

export function markLeft(d: Draft, p: Player): void {
  p.left = true;
  p.connected = false;
  p.disconnectedAt = d.now;
  if (d.s.hostPlayerId === p.id) reassignHost(d.s);
}

export function forfeit(d: Draft, p: Player, cause: HistoryCause): void {
  const s = d.s;
  markLeft(d, p);
  const guessRule = (): boolean => {
    if (s.phase === "MR_WHITE_GUESS" && s.guess?.playerId === p.id && s.guess.status === "PENDING") {
      timeoutGuess(d);
      return true;
    }
    return false;
  };
  if (!p.alive) {
    guessRule();
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
  } else if ((s.phase === "CLUES" || s.phase === "TIE_BREAK") && wasSpeaker) {
    p.spoke = true;
    s.turnIdx++;
    beginTurn(d, false);
  }
  // (the MR_WHITE_GUESS guesser is never alive, so the guess rule needs no branch here)
  if (s.phase !== "ELIMINATION" && s.phase !== "MR_WHITE_GUESS" && s.phase !== "RESULTS" && s.phase !== "LOBBY") {
    const w = checkWinner(s);
    if (w) {
      enterResults(d, w);
      return;
    }
  }
  if (s.phase === "VOTING") maybeCloseVote(d);
}

/** DISCONNECT side effects by phase (§4.8). */
export function onDisconnect(d: Draft, p: Player): void {
  const s = d.s;
  if ((s.phase === "CLUES" || s.phase === "TIE_BREAK") && currentSpeakerId(s) === p.id) {
    if (s.deadline === null) setDeadline(d, "CLUE", CLUE_GRACE_MS);
  } else if (s.phase === "ROLE_REVEAL") {
    checkAllReady(d);
  } else if (s.phase === "VOTING") {
    maybeCloseVote(d);
  }
}
