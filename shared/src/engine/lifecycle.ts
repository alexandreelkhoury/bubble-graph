// Game lifecycle: START, RESULTS and the return to LOBBY.
import { MIN_PLAYERS } from "../constants";
import { pickPair, toWordRef } from "./catalog";
import type { Draft } from "./draft";
import { setDeadline } from "./draft";
import { reassignHost } from "./membership";
import { assignRoles, effectiveRoleCounts } from "./roles";
import { awardPoints } from "./scoring";
import type { EngineError, GameState, Player, Winner } from "./types";

/** Per-round scratch: votes, tie state and the last vote / elimination / guess. */
export function clearRoundScratch(s: GameState): void {
  s.revote = false;
  s.tieCandidates = [];
  s.votes = {};
  s.lastVote = null;
  s.eliminated = null;
  s.guess = null;
}

/** Per-game scratch: the round scratch plus turn order, history, guesses and the result. */
function clearGameScratch(s: GameState): void {
  clearRoundScratch(s);
  s.result = null;
  s.history = [];
  s.guessLog = [];
  s.speakingOrder = [];
  s.turnIdx = 0;
  s.starterId = null;
}

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
  const pair = {
    key: cp.key, packId: cp.packId, packVersion: cp.packVersion, pairId: cp.pairId, packTitle: title,
    civilian: { text: civ.text, translit: civ.translit, alt: [...civ.alt] },
    undercover: { text: und.text, translit: und.translit, alt: [...und.alt] },
  };
  s.pair = pair;
  s.usedPairKeys = [...picked.usedPairKeys, cp.key];
  s.players.forEach((p, i) => { p.seat = i; });
  const roles = assignRoles(s.players.map((p) => p.id), counts, d.rng);
  for (const p of s.players) {
    const role = roles.get(p.id) ?? "CIVILIAN";
    p.role = role;
    p.word = role === "CIVILIAN" ? toWordRef(pair.civilian) : role === "UNDERCOVER" ? toWordRef(pair.undercover) : null;
    p.alive = true;
    p.left = false;
    p.spoke = false;
    p.ready = !p.connected;
  }
  s.gameNumber += 1;
  s.round = 0;
  s.roleCounts = counts;
  clearGameScratch(s);
  s.phase = "ROLE_REVEAL";
  setDeadline(d, "REVEAL", s.settings.revealSeconds * 1000);
  return null;
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
  const pointsAwarded = awardPoints(s, winnerIds);
  for (const p of s.players) p.score += pointsAwarded[p.id] ?? 0;
  s.result = {
    winner,
    winnerIds,
    civilianWord: toWordRef(pair.civilian),
    undercoverWord: toWordRef(pair.undercover),
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
  s.deadline = null;
  clearGameScratch(s);
}
