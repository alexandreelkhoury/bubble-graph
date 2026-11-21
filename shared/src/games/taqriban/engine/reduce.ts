// GAME-TAQRIBAN §4–§7: the pure engine. No I/O, no Date.now(), no Math.random(): time comes from ctx.now / start's
// `now`, randomness is mulberry32 with its state in `rngState`. reduce never mutates its input, returns the SAME object
// when nothing changes, and returns the input state with every error.
import type { Locale } from "../../../constants";
import type { ErrorCode } from "../../../protocol/errors";
import { createRng } from "../../../room/rng";
import type { GameAction, GameActor, GameCtx, GameMemory, GameOutcome, GameReduceResult, RosterEntry } from "../../types";
import {
  BULLSEYE_POINTS, CLOSEST_POINTS, errorOf, FINAL_MULTIPLIER, isBullseye, isWild, LEADERBOARD_EVERY, MAX_PLAYERS, MIN_PLAYERS,
  revealMs, sameError, STATE_SCHEMA, TAQ_LENGTHS, TAQ_MEMORY_MAX, TAQ_PACE_MS, TAQ_TIMING, validGuess, WILD_MIN_GUESSES,
} from "../constants";
import type { TaqribanPhase, TaqribanSettings } from "../meta";
import { drawQuestions, drawReplacement, eligibleItems, findItem, textIn } from "./catalog";
import type { TaqDeadline, TaqGuessRow, TaqPlayer, TaqribanCatalog, TaqribanIntent, TaqribanState } from "./types";

/** Phases the host may end early with HOST_ADVANCE (QUESTION never: fairness; a broken question is skipped instead). */
export const ADVANCEABLE: readonly TaqribanPhase[] = ["REVEAL", "LEADERBOARD", "FINAL_INTRO"];

type R = GameReduceResult<TaqribanState>;
const ok = (state: TaqribanState): R => ({ ok: true, state });
const err = (error: ErrorCode, state: TaqribanState): R => ({ ok: false, error, state });
const clone = (s: TaqribanState): TaqribanState => structuredClone(s);
const deadline = (now: number, ms: number): TaqDeadline => ({ at: now + ms, durationMs: ms });

export const isFinalIndex = (s: Pick<TaqribanState, "questionIds">, i: number): boolean => i === s.questionIds.length - 1;
/** May guess: dealt in (not waiting) and not left. */
export const canPlay = (p: TaqPlayer): boolean => !p.left && !p.waiting;
/** Who the early end (and `awaitedIds`) waits for during QUESTION. */
export const awaitedPlayers = (s: TaqribanState): TaqPlayer[] =>
  s.phase === "QUESTION" ? s.players.filter((p) => canPlay(p) && p.connected && s.guesses[p.id] === undefined) : [];
const someoneHere = (s: TaqribanState): boolean => s.players.some((p) => !p.left && p.connected);

// ─── start ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export function playableCount(content: TaqribanCatalog, s: TaqribanSettings, locale: Locale): number {
  return eligibleItems(content, s.packIds, locale).length;
}

export function startBlocker(roster: readonly RosterEntry[], settings: TaqribanSettings, content: TaqribanCatalog, locale: Locale): ErrorCode | null {
  if (roster.filter((r) => r.connected).length < MIN_PLAYERS) return "NOT_ENOUGH_PLAYERS";
  if (roster.length > MAX_PLAYERS) return "GAME_FULL";
  if (playableCount(content, settings, locale) < TAQ_LENGTHS[settings.length]) return "NO_CONTENT_AVAILABLE";
  return null;
}

export interface StartArgs {
  roster: readonly RosterEntry[]; settings: TaqribanSettings; locale: Locale; memory: GameMemory;
  seed: number; now: number; graceMs: number; content: TaqribanCatalog;
}

function newPlayer(r: RosterEntry, waiting: boolean): TaqPlayer {
  return { id: r.id, seat: r.seat, connected: r.connected, left: false, waiting, newAt: null, score: 0, closest: 0, bullseyes: 0, boardScore: 0, boardRank: null };
}

/** The first QUESTION, its deadline including `graceMs` (ENTRANCE_GRACE_MS). Scores start at 0. */
export function start(a: StartArgs): R {
  const settings: TaqribanSettings = { packIds: [...a.settings.packIds], length: a.settings.length, pace: a.settings.pace };
  const blocker = startBlocker(a.roster, settings, a.content, a.locale);
  if (blocker) return { ok: false, error: blocker, state: null as unknown as TaqribanState };
  const pool = eligibleItems(a.content, settings.packIds, a.locale);
  const known = new Set(pool.map((c) => c.item.id));
  const usedKeys = [...new Set(a.memory.usedKeys.filter((k) => known.has(k)))].slice(-TAQ_MEMORY_MAX);
  const rng = createRng(a.seed >>> 0);
  const { picked, rerun } = drawQuestions(pool, TAQ_LENGTHS[settings.length], usedKeys, rng);
  const d: TaqribanState = {
    schema: STATE_SCHEMA, phase: "QUESTION", settings, locale: a.locale,
    questionIds: picked.map((c) => c.item.id), index: 0, shown: 0, deadline: null, cur: null, guesses: {}, last: null,
    players: [...a.roster].sort((x, y) => x.seat - y.seat).map((r) => newPlayer(r, false)),
    rerun, skippedIds: [], endedEarly: false, usedKeys, rngState: rng.state,
  };
  beginQuestion(d, 0, a.now, a.content, a.graceMs);
  return d.phase === "QUESTION" ? ok(d) : { ok: false, error: "NO_CONTENT_AVAILABLE", state: d };
}

// ─── transitions (on a draft) ────────────────────────────────────────────────────────────────────────────────────────

/** QUESTION `i`, or HOLD when nobody is connected, or RESULTS when the question left the playable catalog. */
function beginQuestion(d: TaqribanState, i: number, now: number, content: TaqribanCatalog, graceMs = 0): void {
  d.index = i;
  d.guesses = {};
  d.cur = null;
  if (!someoneHere(d)) {
    d.phase = "HOLD";
    d.deadline = null;
    return;
  }
  const found = findItem(content, d.questionIds[i] ?? "", d.locale);
  if (!found) {
    // JAMAA-GAP: the playable catalog lost this question mid-game (a Pass expired): the game ends with the points earned.
    d.endedEarly = true;
    toResults(d);
    return;
  }
  const { item } = found;
  for (const p of d.players) if (!p.left && p.waiting) { p.waiting = false; p.newAt = i; }
  d.cur = { id: item.id, text: textIn(item.text, d.locale), unit: item.unit[d.locale] ?? item.unit.en, answer: item.answer, source: item.source };
  d.phase = "QUESTION";
  d.shown = Math.max(d.shown, i + 1);
  d.deadline = deadline(now, TAQ_PACE_MS[d.settings.pace] + graceMs);
}

/** Every connected player who may guess has guessed → the deadline moves to now + 800 ms (never later). */
function maybeEarlyEnd(d: TaqribanState, now: number): void {
  if (d.phase !== "QUESTION" || !d.deadline) return;
  const eligible = d.players.filter((p) => canPlay(p) && p.connected);
  if (eligible.length === 0 || eligible.some((p) => d.guesses[p.id] === undefined)) return;
  const at = now + TAQ_TIMING.EARLY_END_MS;
  if (at < d.deadline.at) d.deadline = { at, durationMs: TAQ_TIMING.EARLY_END_MS };
}

/** §5: closeness ranks, the closest (ties included), Bullseyes, Way off!. Pure. */
export function scoreQuestion(answer: number, guesses: readonly { id: string; value: number | null }[], isFinal: boolean): { rows: TaqGuessRow[]; closestIds: string[]; bullseyeIds: string[]; wildId: string | null } {
  const mult = isFinal ? FINAL_MULTIPLIER : 1;
  const errs = guesses.map((g) => (g.value === null ? null : errorOf(g.value, answer)));
  const valid = errs.filter((e): e is number => e !== null);
  const best = valid.length ? Math.min(...valid) : null;
  const rows: TaqGuessRow[] = guesses.map((g, k) => {
    const e = errs[k] ?? null;
    if (g.value === null || e === null) return { id: g.id, value: null, rank: null, closest: false, bullseye: false, points: 0 };
    const rank = 1 + valid.filter((x) => x < e && !sameError(x, e)).length;
    const closest = best !== null && sameError(e, best);
    const bullseye = isBullseye(g.value, answer);
    return { id: g.id, value: g.value, rank, closest, bullseye, points: mult * ((closest ? CLOSEST_POINTS : 0) + (bullseye ? BULLSEYE_POINTS : 0)) };
  });
  let wildId: string | null = null;
  if (valid.length >= WILD_MIN_GUESSES) {
    const worst = Math.max(...valid);
    const far = rows.filter((r, k) => r.value !== null && sameError(errs[k] as number, worst));
    const w = far[0];
    if (far.length === 1 && w && w.value !== null && !w.closest && isWild(w.value, answer)) wildId = w.id;
  }
  return { rows, closestIds: rows.filter((r) => r.closest).map((r) => r.id), bullseyeIds: rows.filter((r) => r.bullseye).map((r) => r.id), wildId };
}

function reveal(d: TaqribanState, now: number): void {
  const q = d.cur as NonNullable<TaqribanState["cur"]>;
  const isFinal = isFinalIndex(d, d.index);
  const sc = scoreQuestion(q.answer, d.players.filter(canPlay).map((p) => ({ id: p.id, value: d.guesses[p.id] ?? null })), isFinal);
  for (const r of sc.rows) {
    const p = d.players.find((x) => x.id === r.id) as TaqPlayer;
    p.score += r.points;
    if (r.closest) p.closest += 1;
    if (r.bullseye) p.bullseyes += 1;
  }
  d.last = { index: d.index, questionId: q.id, text: q.text, unit: q.unit, answer: q.answer, source: q.source, isFinal, ...sc };
  d.guesses = {};
  d.phase = "REVEAL";
  d.deadline = deadline(now, revealMs(sc.rows.filter((r) => r.value !== null).length));
}

/** After the REVEAL of question i (0-based): a LEADERBOARD every 3rd question, unless the final comes next. */
export function leaderboardDue(s: Pick<TaqribanState, "questionIds">, i: number): boolean {
  return (i + 1) % LEADERBOARD_EVERY === 0 && !isFinalIndex(s, i + 1) && !isFinalIndex(s, i);
}

function toResults(d: TaqribanState): void {
  d.phase = "RESULTS";
  d.deadline = null;
  d.guesses = {};
  d.cur = null;
}

/** Ranking order: score ↓, questions won ↓, Bullseyes ↓; still equal → shared place. */
export function rankGroups(players: readonly TaqPlayer[]): string[][] {
  const key = (p: TaqPlayer): string => `${p.score}/${p.closest}/${p.bullseyes}`;
  const sorted = [...players].sort((a, b) => b.score - a.score || b.closest - a.closest || b.bullseyes - a.bullseyes || a.seat - b.seat);
  const out: string[][] = [];
  let prev: string | null = null;
  for (const p of sorted) {
    if (key(p) === prev) (out[out.length - 1] as string[]).push(p.id);
    else out.push([p.id]);
    prev = key(p);
  }
  return out;
}

/** Competition ranks (1, 1, 3) of the non-left players. */
export function ranksOf(players: readonly TaqPlayer[]): Map<string, number> {
  const m = new Map<string, number>();
  let place = 1;
  for (const g of rankGroups(players.filter((p) => !p.left))) {
    for (const id of g) m.set(id, place);
    place += g.length;
  }
  return m;
}

function snapshotBoard(d: TaqribanState): void {
  const ranks = ranksOf(d.players);
  for (const p of d.players) { p.boardScore = p.score; p.boardRank = ranks.get(p.id) ?? null; }
}

function next(d: TaqribanState, now: number, content: TaqribanCatalog): void {
  if (isFinalIndex(d, d.index + 1)) { d.phase = "FINAL_INTRO"; d.deadline = deadline(now, TAQ_TIMING.FINAL_INTRO_MS); return; }
  beginQuestion(d, d.index + 1, now, content);
}

/** The phase's deadline passed (TICK) or the host advanced it (HOST_ADVANCE expires inline). */
function expire(d: TaqribanState, now: number, content: TaqribanCatalog): void {
  switch (d.phase) {
    case "QUESTION": reveal(d, now); return;
    case "REVEAL":
      d.cur = null;
      if (isFinalIndex(d, d.index)) { snapshotBoard(d); toResults(d); return; }
      if (leaderboardDue(d, d.index)) { d.phase = "LEADERBOARD"; d.deadline = deadline(now, TAQ_TIMING.LEADERBOARD_MS); return; }
      next(d, now, content);
      return;
    case "LEADERBOARD": snapshotBoard(d); next(d, now, content); return;
    case "FINAL_INTRO": beginQuestion(d, d.index + 1, now, content); return;
    case "HOLD": beginQuestion(d, d.index, now, content); return;
    /* v8 ignore next 2 */
    case "RESULTS": return;
  }
}

// ─── reduce ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export function reduce(s: TaqribanState, a: GameAction<TaqribanIntent>, ctx: GameCtx<TaqribanCatalog>): R {
  const now = ctx.now;
  switch (a.type) {
    case "TICK": {
      if (s.deadline === null || now < s.deadline.at) return ok(s);
      const d = clone(s);
      if (d.phase === "HOLD" && !someoneHere(d)) { d.deadline = null; return ok(d); }
      expire(d, now, ctx.content);
      return ok(d);
    }
    case "PLAYER_AWAY":
    case "PLAYER_BACK":
    case "PLAYER_GONE": {
      const i = s.players.findIndex((p) => p.id === a.playerId);
      const p = s.players[i];
      if (!p || p.left) return ok(s);
      if (a.type === "PLAYER_AWAY" && !p.connected) return ok(s);
      if (a.type === "PLAYER_BACK" && p.connected) return ok(s);
      const d = clone(s);
      const dp = d.players[i] as TaqPlayer;
      if (a.type === "PLAYER_AWAY") dp.connected = false;
      else if (a.type === "PLAYER_BACK") dp.connected = true;
      else { dp.left = true; dp.connected = false; delete d.guesses[dp.id]; }
      if (d.phase === "HOLD" && a.type === "PLAYER_BACK") beginQuestion(d, d.index, now, ctx.content);
      maybeEarlyEnd(d, now);
      return ok(d);
    }
    case "INTENT":
      return intent(s, a.intent, a.by, ctx);
  }
}

function intent(s: TaqribanState, i: TaqribanIntent, by: GameActor, ctx: GameCtx<TaqribanCatalog>): R {
  const now = ctx.now;
  switch (i.type) {
    case "GUESS": {
      if (by.kind !== "player") return err("NOT_IN_GAME", s);
      const p = s.players.find((x) => x.id === by.playerId);
      if (!p || p.left) return err("NOT_IN_GAME", s);
      if (s.phase !== "QUESTION" || !s.cur || !s.deadline || p.waiting) return err("WRONG_PHASE", s);
      // The window is closed once its deadline passed, even if the alarm's TICK has not run yet.
      if (now > s.deadline.at) return err("WRONG_PHASE", s);
      if (s.cur.id !== i.questionId) return err("STALE_QUESTION", s);
      if (!validGuess(i.value)) return err("VALUE_INVALID", s);
      if (s.guesses[p.id] !== undefined) return err("ALREADY_GUESSED", s);
      const d = clone(s);
      d.guesses[p.id] = i.value;
      maybeEarlyEnd(d, now);
      return ok(d);
    }
    case "SKIP_QUESTION": {
      if (!ctx.isHost(by)) return err("NOT_HOST", s);
      if (s.phase !== "QUESTION" || !s.cur) return err("WRONG_PHASE", s);
      if (i.questionId !== undefined && i.questionId !== s.cur.id) return err("STALE_QUESTION", s);
      const pool = eligibleItems(ctx.content, s.settings.packIds, s.locale);
      const d = clone(s);
      const rng = createRng(d.rngState);
      // At most one question per family: the game's other questions' families are avoided (the skipped one's is not).
      const others = d.questionIds.filter((_, k) => k !== d.index);
      const families = new Set(pool.filter((c) => others.includes(c.item.id)).map((c) => c.item.family).filter((f): f is string => f !== undefined));
      const rep = drawReplacement(pool, new Set([...d.questionIds, ...d.skippedIds]), d.usedKeys, rng, families);
      if (!rep) return err("NO_CONTENT_AVAILABLE", s);
      d.rngState = rng.state;
      d.skippedIds.push(s.cur.id);
      d.questionIds[d.index] = rep.item.id;
      beginQuestion(d, d.index, now, ctx.content);
      return ok(d);
    }
    case "HOST_ADVANCE": {
      if (!ctx.isHost(by)) return err("NOT_HOST", s);
      if (s.phase === "QUESTION") return ok(s);   // ignored: nobody gets cut off by a remote press
      if (!ADVANCEABLE.includes(s.phase)) return err("WRONG_PHASE", s);
      const d = clone(s);
      expire(d, now, ctx.content);
      return ok(d);
    }
    case "END_GAME": {
      if (!ctx.isHost(by)) return err("NOT_HOST", s);
      if (s.phase !== "HOLD") return err("WRONG_PHASE", s);
      const d = clone(s);
      snapshotBoard(d);
      toResults(d);
      return ok(d);
    }
    default:
      return err("WRONG_PHASE", s);
  }
}

// ─── platform hooks ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A member who joined while PLAYING: plays from the next QUESTION with 0 points (`me.waitingForNext` until then). In
 * HOLD a connected newcomer makes the game due at once (an already-past HOLD deadline; `join` has no clock).
 */
export function join(s: TaqribanState, entry: RosterEntry): R {
  if (s.players.some((p) => p.id === entry.id)) return ok(s);
  if (s.phase === "RESULTS") return err("WRONG_PHASE", s);
  if (s.players.filter((p) => !p.left).length >= MAX_PLAYERS) return err("GAME_FULL", s);
  const d = clone(s);
  d.players.push(newPlayer(entry, true));
  d.players.sort((x, y) => x.seat - y.seat);
  if (d.phase === "HOLD" && entry.connected && d.deadline === null) d.deadline = { at: 0, durationMs: 0 };
  return ok(d);
}

export const nextWakeAt = (s: TaqribanState): number | null => s.deadline?.at ?? null;

/** Non-null once in RESULTS. Left players and 0-point players are excluded from the ranking (no stars). */
export function outcome(s: TaqribanState): GameOutcome | null {
  if (s.phase !== "RESULTS") return null;
  const points: Record<string, number> = {};
  for (const p of s.players) points[p.id] = p.left ? 0 : p.score;
  return { points, ranking: rankGroups(s.players.filter((p) => !p.left && p.score > 0)) };
}

/** The questions shown in this instance appended to the room history; oldest dropped past TAQ_MEMORY_MAX (120). */
export function memory(s: TaqribanState): GameMemory {
  const played = [...s.questionIds.slice(0, s.shown), ...s.skippedIds];
  const set = new Set(played);
  return { usedKeys: [...s.usedKeys.filter((k) => !set.has(k)), ...played].slice(-TAQ_MEMORY_MAX) };
}
