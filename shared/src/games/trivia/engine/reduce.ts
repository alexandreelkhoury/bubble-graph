// GAME-TRIVIA §4–§7: the pure engine. No I/O, no Date.now(), no Math.random(): time comes from `ctx.now` / start's
// `now`, randomness is mulberry32 with its state in `rngState`. reduce never mutates its input, returns the SAME object
// when nothing changes, and returns the input state with every error.
import type { Locale } from "../../../constants";
import { MEMORY_MAX_KEYS } from "../../../constants";
import type { ErrorCode } from "../../../protocol/errors";
import { createRng } from "../../../room/rng";
import type { GameAction, GameActor, GameCtx, GameMemory, GameOutcome, GameReduceResult, RosterEntry } from "../../types";
import {
  answerMs, EARLY_END_MS, FINAL_INTRO_MS, LEADERBOARD_EVERY, LEADERBOARD_MS, MAX_PLAYERS, MIN_PLAYERS, QUIZ_INTRO_MS, readMs,
  REVEAL_EXPLAIN_MS, REVEAL_MS, STATE_SCHEMA,
} from "../constants";
import type { TriviaPhase } from "../meta";
import { displayOrder, drawQuestions, memoryKey } from "./draw";
import { familyOf, graphemes, resolveQuiz } from "./quiz";
import { answerTime, highlights, isOnFire, rankGroups, scoreAnswer } from "./scoring";
import type { ChoiceRow, TriviaCatalog, TriviaDeadline, TriviaIntent, TriviaPlayer, TriviaSettings, TriviaState } from "./types";

/** Phases the host may end early with HOST_ADVANCE (§4.1; READ and ANSWER never: fairness). */
export const ADVANCEABLE: readonly TriviaPhase[] = ["QUIZ_INTRO", "REVEAL", "LEADERBOARD", "FINAL_INTRO"];

type R = GameReduceResult<TriviaState>;
const ok = (state: TriviaState): R => ({ ok: true, state });
const err = (error: ErrorCode, state: TriviaState): R => ({ ok: false, error, state });
const clone = (s: TriviaState): TriviaState => structuredClone(s);

export const isFinalIndex = (s: Pick<TriviaState, "questionIds">, i: number): boolean => i === s.questionIds.length - 1;
/** May answer questions: dealt in (not waiting) and not left. */
export const canPlay = (p: TriviaPlayer): boolean => !p.left && !p.waiting;
/** Who the early end (and `awaitedIds`) waits for during ANSWER. */
export const awaitedPlayers = (s: TriviaState): TriviaPlayer[] =>
  s.phase === "ANSWER" ? s.players.filter((p) => canPlay(p) && p.connected && !s.answers[p.id]) : [];
const someoneHere = (s: TriviaState): boolean => s.players.some((p) => !p.left && p.connected);
const deadline = (kind: TriviaPhase, now: number, ms: number): TriviaDeadline => ({ kind, at: now + ms, durationMs: ms });

// ─── start ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export function startBlocker(roster: readonly RosterEntry[], settings: TriviaSettings, content: TriviaCatalog, locale: Locale): ErrorCode | null {
  if (roster.filter((r) => r.connected).length < MIN_PLAYERS) return "NOT_ENOUGH_PLAYERS";
  if (roster.length > MAX_PLAYERS) return "GAME_FULL";
  if (!resolveQuiz(content, settings.quizId, locale)) return "NO_CONTENT_AVAILABLE";
  return null;
}

export interface StartArgs {
  roster: readonly RosterEntry[]; settings: TriviaSettings; locale: Locale; memory: GameMemory;
  seed: number; now: number; graceMs: number; content: TriviaCatalog;
}

/** QUIZ_INTRO, deadline = now + graceMs (ENTRANCE_GRACE_MS) + 4 000 (§4). Scores start at 0 (`carriesScore: false`). */
export function start(a: StartArgs): R {
  const blocker = startBlocker(a.roster, a.settings, a.content, a.locale);
  if (blocker) return { ok: false, error: blocker, state: null as unknown as TriviaState };
  const pack = resolveQuiz(a.content, a.settings.quizId, a.locale) as NonNullable<ReturnType<typeof resolveQuiz>>;
  const rng = createRng(a.seed >>> 0);
  const { questions, rerun } = drawQuestions(pack, a.settings.length, a.memory.usedKeys, a.locale, rng);
  const state: TriviaState = {
    schema: STATE_SCHEMA,
    phase: "QUIZ_INTRO",
    settings: { quizId: a.settings.quizId, length: a.settings.length, pace: a.settings.pace },
    locale: a.locale,
    quiz: {
      id: familyOf(pack), packId: pack.id, title: { ...pack.title }, stars: pack.stars, domain: pack.domain,
      featuredTopics: pack.featuredTopics.slice(0, 3), topicCount: pack.topics.length, questionCount: pack.questions.length,
    },
    questionIds: questions.map((q) => q.id),
    index: 0,
    shown: 0,
    deadline: deadline("QUIZ_INTRO", a.now, a.graceMs + QUIZ_INTRO_MS),
    cur: null,
    answers: {},
    last: null,
    players: [...a.roster].sort((x, y) => x.seat - y.seat).map((r) => newPlayer(r, false)),
    rerun,
    voidedQuestionIds: [],
    endedEarly: false,
    usedKeys: a.memory.usedKeys.slice(-MEMORY_MAX_KEYS),
    rngState: rng.state,
  };
  return ok(state);
}

function newPlayer(r: RosterEntry, waiting: boolean): TriviaPlayer {
  return {
    id: r.id, seat: r.seat, connected: r.connected, left: false, waiting, newAt: null,
    score: 0, streak: 0, bestStreak: 0, correct: 0, timeSum: 0, fastest: 0, boardScore: 0, boardRank: null,
  };
}

// ─── transitions (on a draft) ────────────────────────────────────────────────────────────────────────────────────────

/** READ of question `i`, or HOLD when nobody is connected (§4), or RESULTS when the quiz pack is gone (access change). */
function beginQuestion(d: TriviaState, i: number, now: number, content: TriviaCatalog): void {
  d.index = i;
  d.answers = {};
  d.cur = null;
  if (!someoneHere(d)) {
    d.phase = "HOLD";
    d.deadline = null;
    return;
  }
  const pack = content.packs.find((p) => p.id === d.quiz.packId);
  const q = pack?.questions.find((x) => x.id === d.questionIds[i]);
  if (!q) {
    // JAMAA-GAP: the playable catalog lost this quiz mid-game (a Pass expired). Questions are resolved per READ to keep
    // the stored state small (§2.6), so the game ends here with the points already earned.
    d.endedEarly = true;
    toResults(d);
    return;
  }
  const rng = createRng(d.rngState);
  const order = displayOrder(q, rng);
  d.rngState = rng.state;
  for (const p of d.players) if (!p.left && p.waiting) { p.waiting = false; p.newAt = i; }
  d.cur = {
    id: q.id, type: q.type, text: q.text, options: order.map((k) => q.options[k] as string), correctIndex: order.indexOf(q.answer),
    topic: q.topic, difficulty: q.difficulty, explain: q.explain ?? null, answerMs: answerMs(q.type, d.settings.pace), answerOpenAt: null,
  };
  d.phase = "READ";
  d.shown = Math.max(d.shown, i + 1);
  d.deadline = deadline("READ", now, readMs(graphemes(q.text)));
}

function openAnswer(d: TriviaState, now: number): void {
  const cur = d.cur as NonNullable<TriviaState["cur"]>;
  cur.answerOpenAt = now;
  d.phase = "ANSWER";
  d.deadline = deadline("ANSWER", now, cur.answerMs);
}

/** Every connected player who may answer has answered → deadline = now + 600 (once; never later than the original). */
function maybeEarlyEnd(d: TriviaState, now: number): void {
  if (d.phase !== "ANSWER" || !d.deadline) return;
  const eligible = d.players.filter((p) => canPlay(p) && p.connected);
  if (eligible.length === 0 || eligible.some((p) => !d.answers[p.id])) return;
  const at = now + EARLY_END_MS;
  if (at < d.deadline.at) d.deadline = { kind: "ANSWER", at, durationMs: EARLY_END_MS };
}

function reveal(d: TriviaState, now: number): void {
  const q = d.cur as NonNullable<TriviaState["cur"]>;
  const isFinal = isFinalIndex(d, d.index);
  const choices: ChoiceRow[] = [];
  for (const p of d.players.filter(canPlay)) {
    const a = d.answers[p.id];
    const correct = a !== undefined && a.choice === q.correctIndex;
    const sc = scoreAnswer({ correct, type: q.type, t: a ? a.timeMs : null, T: q.answerMs, isFinal, prevStreak: p.streak });
    choices.push({
      id: p.id, choice: a ? a.choice : null, correct, timeMs: a ? a.timeMs : null, points: sc.points, streakBonus: sc.streakBonus,
      prevStreak: p.streak, prevBest: p.bestStreak,
    });
    p.score += sc.points + sc.streakBonus;
    p.streak = sc.streak;
    p.bestStreak = Math.max(p.bestStreak, sc.streak);
    if (correct && a) { p.correct += 1; p.timeSum += a.timeMs; }
  }
  const h = highlights(choices);
  for (const p of d.players) if (h.fastestIds.includes(p.id)) p.fastest += 1;
  d.last = {
    index: d.index, questionId: q.id, correctIndex: q.correctIndex, isFinal, choices, fastestIds: h.fastestIds,
    onFireIds: choices.filter((c) => c.correct && isOnFire(c.prevStreak + 1)).map((c) => c.id),
    stumped: h.stumped, genius: h.genius, voided: false,
  };
  d.answers = {};
  d.phase = "REVEAL";
  d.deadline = deadline("REVEAL", now, REVEAL_MS + (q.explain ? REVEAL_EXPLAIN_MS : 0));
}

/** §4: after the REVEAL of question i (0-based), a LEADERBOARD follows every 3rd question and precedes the final. */
export function leaderboardDue(s: Pick<TriviaState, "questionIds">, i: number): boolean {
  const played = i + 1;
  return played % LEADERBOARD_EVERY === 0 || (isFinalIndex(s, i + 1) && played >= LEADERBOARD_EVERY);
}

function toResults(d: TriviaState): void {
  d.phase = "RESULTS";
  d.deadline = null;
  d.answers = {};
}

/** Leaving a LEADERBOARD: the next race grows from these totals and ranks. */
function snapshotBoard(d: TriviaState): void {
  const ranked = new Map(rankGroups(d.players.filter((p) => !p.left)).flatMap((g, k, all) => {
    const rank = 1 + all.slice(0, k).reduce((n, x) => n + x.length, 0);
    return g.map((id) => [id, rank] as const);
  }));
  for (const p of d.players) { p.boardScore = p.score; p.boardRank = ranked.get(p.id) ?? null; }
}

function next(d: TriviaState, now: number, content: TriviaCatalog): void {
  if (isFinalIndex(d, d.index + 1)) { d.phase = "FINAL_INTRO"; d.deadline = deadline("FINAL_INTRO", now, FINAL_INTRO_MS); return; }
  beginQuestion(d, d.index + 1, now, content);
}

/** The phase's deadline passed (TICK) or the host advanced it (HOST_ADVANCE expires inline, platform §2.6). */
function expire(d: TriviaState, now: number, content: TriviaCatalog): void {
  switch (d.phase) {
    case "QUIZ_INTRO": beginQuestion(d, 0, now, content); return;
    case "READ": openAnswer(d, now); return;
    case "ANSWER": reveal(d, now); return;
    case "REVEAL":
      if (isFinalIndex(d, d.index)) { toResults(d); return; }
      if (leaderboardDue(d, d.index)) { d.phase = "LEADERBOARD"; d.deadline = deadline("LEADERBOARD", now, LEADERBOARD_MS); return; }
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

export function reduce(s: TriviaState, a: GameAction<TriviaIntent>, ctx: GameCtx<TriviaCatalog>): R {
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
      const dp = d.players[i] as TriviaPlayer;
      if (a.type === "PLAYER_AWAY") dp.connected = false;
      else if (a.type === "PLAYER_BACK") dp.connected = true;
      else { dp.left = true; dp.connected = false; delete d.answers[dp.id]; }
      if (d.phase === "HOLD" && a.type === "PLAYER_BACK") beginQuestion(d, d.index, now, ctx.content);
      maybeEarlyEnd(d, now);
      return ok(d);
    }
    case "INTENT":
      return intent(s, a.intent, a.by, ctx);
  }
}

function intent(s: TriviaState, i: TriviaIntent, by: GameActor, ctx: GameCtx<TriviaCatalog>): R {
  const now = ctx.now;
  switch (i.type) {
    case "ANSWER": {
      if (s.phase !== "ANSWER" || !s.cur || !s.deadline) return err("WRONG_PHASE", s);
      if (by.kind !== "player") return err("NOT_IN_GAME", s);
      const p = s.players.find((x) => x.id === by.playerId);
      if (!p || p.left) return err("NOT_IN_GAME", s);
      if (p.waiting) return err("WRONG_PHASE", s);
      // The window is closed once its deadline passed, even if the alarm's TICK has not run yet (§5.1 late answers).
      if (now > s.deadline.at) return err("WRONG_PHASE", s);
      if (!Number.isInteger(i.choice) || i.choice < 0 || i.choice >= s.cur.options.length) return err("ANSWER_INVALID", s);
      if (s.answers[p.id]) return err("ALREADY_ANSWERED", s);
      const d = clone(s);
      // Server receipt time only (§5.1, platform §2.12): the intent carries no client time.
      d.answers[p.id] = { choice: i.choice, timeMs: answerTime(now, s.cur.answerOpenAt as number, s.cur.answerMs) };
      maybeEarlyEnd(d, now);
      return ok(d);
    }
    case "HOST_ADVANCE": {
      if (!ctx.isHost(by)) return err("NOT_HOST", s);
      if (!ADVANCEABLE.includes(s.phase)) return err("WRONG_PHASE", s);
      const d = clone(s);
      expire(d, now, ctx.content);
      return ok(d);
    }
    case "VOID_QUESTION": {
      // JAMAA-GAP: §13.1 says "host", but Void is a TV pause-menu item only (§2, §6) and wipes everyone's points for the
      // question, so a VIP phone (which could void the questions it got wrong) is refused. TV only.
      if (by.kind !== "tv" || !ctx.isHost(by)) return err("NOT_HOST", s);
      const r = s.last;
      // No id (the platform pause menu's bare intent): the question in REVEAL. With an id, a stale pause menu (another
      // question) is refused like a wrong phase (JAMAA-GAP: no STALE code for Trivia).
      if (s.phase !== "REVEAL" || !r || (i.questionId !== undefined && r.questionId !== i.questionId)) return err("WRONG_PHASE", s);
      if (r.voided) return ok(s);
      const d = clone(s);
      const dr = d.last as NonNullable<TriviaState["last"]>;
      for (const c of dr.choices) {
        const p = d.players.find((x) => x.id === c.id) as TriviaPlayer;
        p.score -= c.points + c.streakBonus;
        if (c.correct) { p.correct -= 1; p.timeSum -= c.timeMs as number; }
        if (dr.fastestIds.includes(p.id)) p.fastest -= 1;
        p.streak = c.prevStreak;
        p.bestStreak = c.prevBest;
        c.points = 0;
        c.streakBonus = 0;
      }
      dr.fastestIds = [];
      dr.onFireIds = [];
      dr.voided = true;
      d.voidedQuestionIds.push(dr.questionId);
      return ok(d);
    }
    case "END_GAME": {
      if (!ctx.isHost(by)) return err("NOT_HOST", s);
      if (s.phase !== "HOLD") return err("WRONG_PHASE", s);
      const d = clone(s);
      toResults(d);
      return ok(d);
    }
  }
}

// ─── platform hooks ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A member who joined while PLAYING (§6): plays from the next READ with 0 points (`me.waitingForNext` until then).
 * In HOLD a connected newcomer makes the game due at once (deadline = now-ish): `join` has no clock, so it sets an
 * already-past HOLD deadline and the room's inline expiry / next alarm TICK starts the READ.
 */
export function join(s: TriviaState, entry: RosterEntry): R {
  if (s.players.some((p) => p.id === entry.id)) return ok(s);
  if (s.phase === "RESULTS") return err("WRONG_PHASE", s);
  if (s.players.filter((p) => !p.left).length >= MAX_PLAYERS) return err("GAME_FULL", s);
  const d = clone(s);
  d.players.push(newPlayer(entry, true));
  d.players.sort((x, y) => x.seat - y.seat);
  if (d.phase === "HOLD" && entry.connected && d.deadline === null) d.deadline = { kind: "HOLD", at: 0, durationMs: 0 };
  return ok(d);
}

export const nextWakeAt = (s: TriviaState): number | null => s.deadline?.at ?? null;

/**
 * Non-null once in RESULTS. Ranking: GAME-TRIVIA §5.3 order (points ↓, correct ↓, correct time ↑; still equal → shared
 * place) as a standard competition ranking; left players and 0-point players are excluded (no stars).
 */
export function outcome(s: TriviaState): GameOutcome | null {
  if (s.phase !== "RESULTS") return null;
  const points: Record<string, number> = {};
  for (const p of s.players) points[p.id] = p.left ? 0 : p.score;
  return { points, ranking: rankGroups(s.players.filter((p) => !p.left && p.score > 0)) };
}

/** The questions shown in this instance (READ reached) appended to the room history; oldest dropped past 300. */
export function memory(s: TriviaState): GameMemory {
  const played = s.questionIds.slice(0, s.shown).map((id) => memoryKey(s.quiz.id, id));
  const set = new Set(played);
  const keys = [...s.usedKeys.filter((k) => !set.has(k)), ...played];
  return { usedKeys: keys.slice(-MEMORY_MAX_KEYS) };
}
