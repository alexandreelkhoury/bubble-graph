// GAME-LIKELY §4–§7: the pure engine. No I/O, no Date.now(), no Math.random(): time comes from ctx.now and the RNG
// state lives in the state. reduce never mutates its input; it returns the SAME object when nothing changes, and the
// input state itself with every error.
import type { Locale } from "../../../constants";
import { MEMORY_MAX_KEYS } from "../../../constants";
import type { ErrorCode } from "../../../protocol/errors";
import { createRng } from "../../../room/rng";
import { competitionRanking } from "../../ranking";
import type { GameAction, GameActor, GameCtx, GameMemory, GameOutcome, GameReduceResult, RosterEntry } from "../../types";
import { LIKELY_LENGTHS, LIKELY_META, LIKELY_TIMING, likelyAwardsMs, likelyRevealMs, likelyVotingMs } from "../meta";
import type { LikelySettings } from "../meta";
import { computeAwards } from "./awards";
import { eligibleCards, textIn } from "./catalog";
import type { LikelyCatalog } from "./catalog";
import { drawCard, namedPool } from "./draw";
import { scoreCard, tally } from "./result";
import type { LikelyTally } from "./result";
import { MIN_CONNECTED, STATE_SCHEMA } from "./state";
import type { LikelyAwardEntry, LikelyBallot, LikelyCardResult, LikelyDelta, LikelyEngineOptions, LikelyIntent, LikelyPlayer, LikelyState } from "./state";

type R = GameReduceResult<LikelyState>;
const ok = (state: LikelyState): R => ({ ok: true, state });
const err = (error: ErrorCode, state: LikelyState): R => ({ ok: false, error, state });

// ---------- queries ----------

export const isAnonymous = (s: LikelyState): boolean => !s.settings.showVoters;
export const seatIds = (s: LikelyState): string[] => s.players.map((p) => p.id);
const inGame = (s: LikelyState): LikelyPlayer[] => s.players.filter((p) => !p.left && !p.waiting);
const connectedCount = (s: LikelyState): number => s.players.filter((p) => p.connected && !p.left).length;

/** Voters: non-left, dealt in. Disconnected voters simply abstain (§5 rule 1). */
export const isVoter = (p: LikelyPlayer): boolean => !p.left && !p.waiting;

/** Targets (§5 rule 2): non-left, dealt-in players, yourself and disconnected players included; never the named player. */
export function isTarget(s: LikelyState, id: string): boolean {
  const p = s.players.find((x) => x.id === id);
  return !!p && !p.left && !p.waiting && s.card?.namedPlayerId !== id;
}

/** A stored result's ballots as ids, voter seat order. */
export function resultBallots(s: LikelyState, r: LikelyCardResult): LikelyBallot[] {
  const byN = new Map(s.players.map((p) => [p.n, p.id]));
  const out: LikelyBallot[] = [];
  for (const p of s.players) {
    const t = r.picks[p.n] ?? -1;
    if (t >= 0) out.push({ voterId: p.id, targetId: byN.get(t) ?? "" });
  }
  return out;
}
/** A stored result's named player id (Spicy), or null. */
export function resultNamed(s: LikelyState, r: LikelyCardResult): string | null {
  return r.named === null ? null : (s.players.find((p) => p.n === r.named)?.id ?? null);
}
export function resultTally(s: LikelyState, r: LikelyCardResult): LikelyTally {
  return tally(resultBallots(s, r), seatIds(s));
}
/** Public-mode deltas of a stored result ([] in secret mode). */
export function resultDeltas(s: LikelyState, r: LikelyCardResult): LikelyDelta[] {
  if (isAnonymous(s)) return [];
  const b = resultBallots(s, r);
  return scoreCard(b, tally(b, seatIds(s)), seatIds(s));
}

/** The current vote of `id`: VOTING (live vote) or REVEAL (the revealed card's ballot); null otherwise. */
export function ownVote(s: LikelyState, id: string): string | null {
  if (s.phase === "VOTING") return s.votes[id] ?? null;
  if (s.phase === "REVEAL") {
    const r = s.results[s.results.length - 1];
    return r ? (resultBallots(s, r).find((b) => b.voterId === id)?.targetId ?? null) : null;
  }
  return null;
}

/** The playable history keys at start, then every card drawn this game (skips included), oldest dropped beyond 300 (§7). */
export function memory(s: LikelyState): GameMemory {
  return { usedKeys: s.memoryKeys.slice(-MEMORY_MAX_KEYS) };
}
/** Cards drawn this game (skips included), most recent last. */
export const drawnIds = (s: LikelyState): string[] => s.memoryKeys.slice(s.memoryKeys.length - s.drawnCount);

// ---------- start / startBlocker ----------

/** Cards the room can play for these settings (unnamed: a named card is never guaranteed a slot). */
export function playableCount(content: LikelyCatalog, s: LikelySettings, locale: Locale): number {
  return eligibleCards(content, s, locale).filter((c) => !c.card.namesPlayer).length;
}

export function startBlocker(roster: readonly RosterEntry[], settings: LikelySettings, content: LikelyCatalog, locale: Locale, opt: LikelyEngineOptions): ErrorCode | null {
  if (roster.filter((r) => r.connected).length < MIN_CONNECTED) return "NOT_ENOUGH_PLAYERS";
  if (settings.mode === "spicy" && !opt.spicyEnabled) return "NO_CONTENT_AVAILABLE";
  if (playableCount(content, settings, locale) < LIKELY_LENGTHS[settings.length]) return "NO_CONTENT_AVAILABLE";
  return null;
}

export interface LikelyStartArgs {
  roster: readonly RosterEntry[]; settings: LikelySettings; locale: Locale; memory: GameMemory; seed: number; now: number; graceMs: number; content: LikelyCatalog;
}

export function start(a: LikelyStartArgs, opt: LikelyEngineOptions): R {
  const roster = [...a.roster].sort((x, y) => x.seat - y.seat);
  const settings: LikelySettings = { ...a.settings, packIds: [...a.settings.packIds] };
  // Only the history keys this room's catalog can draw are kept (§2.6 state size: a 300-key memory of cards the room
  // cannot play would cost ~3 KB per write for nothing). Memory written back at the end keeps their order.
  const known = new Set(a.content.packs.flatMap((p) => p.cards.map((c) => c.id)));
  const s0: LikelyState = {
    schema: STATE_SCHEMA, phase: "CARD", settings, locale: a.locale,
    players: roster.map((r, n) => ({ id: r.id, n, seat: r.seat, connected: r.connected, left: false, waiting: false, firstCard: 0, namedCount: 0 })),
    cardIndex: 0, cardCount: LIKELY_LENGTHS[settings.length], deadline: null, earlyEnd: false, card: null, votes: {}, results: [],
    scores: Object.fromEntries(roster.map((r) => [r.id, 0])), memoryKeys: [...new Set(a.memory.usedKeys.filter((k) => known.has(k)))].slice(-MEMORY_MAX_KEYS), drawnCount: 0,
    rngState: a.seed >>> 0, lastNamedId: null, prevTags: null,
  };
  const blocker = startBlocker(roster, settings, a.content, a.locale, opt);
  if (blocker) return err(blocker, s0);
  const s1 = enterCard(s0, a.content, a.now, [], a.graceMs);
  return s1.phase === "CARD" ? ok(s1) : err("NO_CONTENT_AVAILABLE", s0);
}

// ---------- transitions ----------

/** Deals a card into CARD, or HOLD when fewer than 3 are connected. Waiting players are dealt in here (§7). */
function enterCard(s: LikelyState, content: LikelyCatalog, now: number, excludeIds: readonly string[], graceMs = 0): LikelyState {
  const players = s.players.map((p) => (p.waiting && !p.left ? { ...p, waiting: false, firstCard: s.cardIndex } : p));
  const base: LikelyState = { ...s, players, votes: {}, earlyEnd: false, card: null };
  if (connectedCount(base) < MIN_CONNECTED) return { ...base, phase: "HOLD", deadline: null };
  const rng = createRng(base.rngState);
  const pool = namedPool(base.players, base.lastNamedId);
  const d = drawCard({
    content, settings: base.settings, locale: base.locale, position: base.cardIndex,
    recency: base.memoryKeys, drawnIds: drawnIds(base), usedKeys: base.memoryKeys.slice(0, base.memoryKeys.length - base.drawnCount),
    prevTags: base.prevTags, namedHistory: base.results.map((r) => r.named !== null),
    playersInGame: inGame(base).length, namedCandidates: pool.length, excludeIds,
  }, rng);
  // Unreachable after startBlocker (the catalog is fixed for the instance); HOLD is the safe place if it ever happens.
  if (!d) return { ...base, phase: "HOLD", deadline: null };
  const { pack, card } = d.candidate;
  const namedPlayerId = card.namesPlayer ? (pool[rng.int(pool.length)] as string) : null;
  return {
    ...base, phase: "CARD", rngState: rng.state,
    memoryKeys: [...base.memoryKeys.filter((id) => id !== card.id), card.id],
    drawnCount: drawnIds(base).includes(card.id) ? base.drawnCount : base.drawnCount + 1,
    card: {
      cardId: card.id, packId: pack.id, prompt: textIn(card.prompt, base.locale), award: textIn(card.award, base.locale),
      tags: [...card.tags], spicy: card.spice > 0, namedPlayerId, rerun: d.rerun,
    },
    deadline: now + LIKELY_TIMING.CARD_MS + graceMs,
  };
}

function toVoting(s: LikelyState, now: number): LikelyState {
  return maybeEarlyEnd({ ...s, phase: "VOTING", deadline: now + likelyVotingMs(inGame(s).length), votes: {}, earlyEnd: false }, now);
}

/** §4.1: once every connected voter has voted, VOTING ends 1 s later (votes can still change in that window). */
function maybeEarlyEnd(s: LikelyState, now: number): LikelyState {
  if (s.phase !== "VOTING" || s.earlyEnd) return s;
  if (s.players.some((p) => isVoter(p) && p.connected && s.votes[p.id] === undefined)) return s;
  return { ...s, earlyEnd: true, deadline: Math.min(s.deadline ?? Number.MAX_SAFE_INTEGER, now + LIKELY_TIMING.EARLY_END_MS) };
}

function toReveal(s: LikelyState, now: number): LikelyState {
  const card = s.card as NonNullable<LikelyState["card"]>;
  const nOf = new Map(s.players.map((p) => [p.id, p.n]));
  const voters = s.players.filter((p) => s.votes[p.id] !== undefined);
  const picks: number[] = new Array<number>(s.players.reduce((m, p) => Math.max(m, p.n + 1), 0)).fill(-1);
  for (const p of voters) picks[p.n] = nOf.get(s.votes[p.id] as string) as number;
  const result: LikelyCardResult = {
    cardId: card.cardId, prompt: card.prompt, award: card.award,
    named: card.namedPlayerId === null ? null : (nOf.get(card.namedPlayerId) ?? null), picks,
  };
  const ballots = voters.map((p) => ({ voterId: p.id, targetId: s.votes[p.id] as string }));
  const t = tally(ballots, seatIds(s));
  const scores = { ...s.scores };
  if (!isAnonymous(s)) for (const d of scoreCard(ballots, t, seatIds(s))) scores[d.playerId] = (scores[d.playerId] ?? 0) + d.points;
  const players = card.namedPlayerId ? s.players.map((p) => (p.id === card.namedPlayerId ? { ...p, namedCount: p.namedCount + 1 } : p)) : s.players;
  return {
    ...s, phase: "REVEAL", players, scores, results: [...s.results, result], votes: {}, earlyEnd: false, prevTags: [...card.tags],
    lastNamedId: card.namedPlayerId ?? s.lastNamedId,
    deadline: now + likelyRevealMs(t.votesCast, t.unanimous, t.topIds.length),
  };
}

/**
 * The awards (§6.2), derived from the results in AWARDS and RESULTS (never stored: §2.6 size). Holders: every dealt-in
 * player (a player still waiting for their first card never played this instance and only watches the ceremony).
 */
export function awardsOf(s: LikelyState): LikelyAwardEntry[] {
  if (s.phase !== "AWARDS" && s.phase !== "RESULTS") return [];
  const ids = s.players.filter((p) => !p.waiting).map((p) => p.id);
  const left = new Set(s.players.filter((p) => p.left).map((p) => p.id));
  return computeAwards(ids, s.results.map((r) => resultTally(s, r)), !isAnonymous(s), s.results.map((r) => resultDeltas(s, r)), s.scores, left);
}

function toAwards(s: LikelyState, now: number): LikelyState {
  const holders = s.players.filter((p) => !p.waiting).length;
  return { ...s, phase: "AWARDS", card: null, votes: {}, earlyEnd: false, deadline: now + likelyAwardsMs(holders, !isAnonymous(s)) };
}

/** The phase's deadline passed, or the host pressed Next (HOST_ADVANCE expires the phase inline, §4.1). */
function expire(s: LikelyState, content: LikelyCatalog, now: number): LikelyState {
  switch (s.phase) {
    case "CARD": return toVoting(s, now);
    case "VOTING": return toReveal(s, now);
    case "REVEAL": {
      const next: LikelyState = { ...s, cardIndex: s.cardIndex + 1, card: null };
      return next.cardIndex >= s.cardCount ? toAwards(next, now) : enterCard(next, content, now, []);
    }
    case "AWARDS": return { ...s, phase: "RESULTS", deadline: null };
    default: return s;
  }
}

/** SKIP_CARD, or the named player left: a new card, votes discarded, counter unchanged (§7). */
function voidCard(s: LikelyState, content: LikelyCatalog, now: number): LikelyState {
  return enterCard(s, content, now, s.card ? [s.card.cardId] : []);
}

const setPlayer = (s: LikelyState, id: string, f: (p: LikelyPlayer) => LikelyPlayer): LikelyState => ({ ...s, players: s.players.map((p) => (p.id === id ? f(p) : p)) });

// ---------- reduce ----------

export function reduce(s: LikelyState, a: GameAction<LikelyIntent>, ctx: GameCtx<LikelyCatalog>): R {
  switch (a.type) {
    case "TICK": {
      if (s.phase === "HOLD") return ok(connectedCount(s) >= MIN_CONNECTED ? enterCard(s, ctx.content, ctx.now, []) : s);
      if (s.deadline === null || ctx.now < s.deadline) return ok(s);
      return ok(expire(s, ctx.content, ctx.now));
    }
    case "PLAYER_AWAY": {
      const p = s.players.find((x) => x.id === a.playerId);
      if (!p || !p.connected) return ok(s);
      return ok(maybeEarlyEnd(setPlayer(s, a.playerId, (x) => ({ ...x, connected: false })), ctx.now));
    }
    case "PLAYER_BACK": {
      const p = s.players.find((x) => x.id === a.playerId);
      if (!p || p.connected || p.left) return ok(s);
      const next = setPlayer(s, a.playerId, (x) => ({ ...x, connected: true }));
      if (next.phase === "HOLD" && connectedCount(next) >= MIN_CONNECTED) return ok(enterCard(next, ctx.content, ctx.now, []));
      return ok(next);
    }
    case "PLAYER_GONE": {
      const p = s.players.find((x) => x.id === a.playerId);
      if (!p || p.left) return ok(s);
      const next = setPlayer(s, a.playerId, (x) => ({ ...x, left: true, connected: false }));
      // §7: a named player who leaves voids the card like a skip. Otherwise the leaver's own vote stays, and votes
      // already cast ON them stay too ("not a target from the next card on"): dropping them would show the table, through
      // votedIds, who had picked the leaver. New votes for them are refused (INVALID_TARGET).
      if ((next.phase === "CARD" || next.phase === "VOTING") && next.card?.namedPlayerId === a.playerId) return ok(voidCard(next, ctx.content, ctx.now));
      return ok(maybeEarlyEnd(next, ctx.now));
    }
    case "INTENT":
      return reduceIntent(s, a.intent, a.by, ctx);
    default:
      return ok(s);
  }
}

function reduceIntent(s: LikelyState, i: LikelyIntent, by: GameActor, ctx: GameCtx<LikelyCatalog>): R {
  switch (i.type) {
    case "VOTE": {
      if (by.kind !== "player") return err("NOT_IN_GAME", s);
      const me = s.players.find((p) => p.id === by.playerId);
      if (!me || me.left) return err("NOT_IN_GAME", s);
      if (s.phase !== "VOTING" || me.waiting) return err("WRONG_PHASE", s);
      if (s.card?.cardId !== i.cardId) return err("STALE_CARD", s);
      if (!isTarget(s, i.targetId)) return err("INVALID_TARGET", s);
      if (s.votes[me.id] === i.targetId) return ok(s);
      return ok(maybeEarlyEnd({ ...s, votes: { ...s.votes, [me.id]: i.targetId } }, ctx.now));
    }
    case "SKIP_CARD": {
      if (!ctx.isHost(by)) return err("NOT_HOST", s);
      if (s.phase !== "CARD" && s.phase !== "VOTING") return err("WRONG_PHASE", s);
      if (s.card?.cardId !== i.cardId) return err("STALE_CARD", s);
      return ok(voidCard(s, ctx.content, ctx.now));
    }
    case "HOST_ADVANCE": {
      if (!ctx.isHost(by)) return err("NOT_HOST", s);
      if (s.phase === "VOTING") return ok(s);   // ignored: nobody gets cut off by a remote press (§4.1)
      if (s.phase !== "CARD" && s.phase !== "REVEAL" && s.phase !== "AWARDS") return err("WRONG_PHASE", s);
      return ok(expire(s, ctx.content, ctx.now));
    }
    case "END_GAME": {
      if (!ctx.isHost(by)) return err("NOT_HOST", s);
      if (s.phase !== "HOLD") return err("WRONG_PHASE", s);
      return ok(toAwards(s, ctx.now));
    }
    default:
      return err("WRONG_PHASE", s);
  }
}

// ---------- join, wake, outcome ----------

/**
 * Late joiner (§7): waits until the next CARD. JAMAA-GAP: `join` gets no `now`; when the newcomer completes a HOLD
 * quorum, `nextWakeAt` returns 0 so the room's inline expiry (or next alarm) TICKs the card in at once.
 */
export function join(s: LikelyState, e: RosterEntry): R {
  const existing = s.players.find((p) => p.id === e.id);
  if (existing) return existing.left ? err("NOT_IN_GAME", s) : ok(s);
  if (s.players.filter((p) => !p.left).length >= LIKELY_META.maxPlayers) return err("GAME_FULL", s);
  const n = s.players.reduce((m, p) => Math.max(m, p.n), -1) + 1;
  const p: LikelyPlayer = { id: e.id, n, seat: e.seat, connected: e.connected, left: false, waiting: true, firstCard: null, namedCount: 0 };
  const players = [...s.players, p].sort((x, y) => x.seat - y.seat);
  return ok({ ...s, players, scores: { ...s.scores, [e.id]: 0 } });
}

export function nextWakeAt(s: LikelyState): number | null {
  if (s.phase === "HOLD") return connectedCount(s) >= MIN_CONNECTED ? 0 : null;
  return s.deadline;
}

/** RESULTS only. Secret mode: every point is 0, so nobody is ranked and nobody gets stars (§6, platform §2.4). */
export function outcome(s: LikelyState): GameOutcome | null {
  if (s.phase !== "RESULTS") return null;
  const left = new Set(s.players.filter((p) => p.left).map((p) => p.id));
  const points = Object.fromEntries(s.players.map((p) => [p.id, isAnonymous(s) || p.left ? 0 : (s.scores[p.id] ?? 0)]));
  return { points, ranking: competitionRanking(points, seatIds(s), left) };
}
