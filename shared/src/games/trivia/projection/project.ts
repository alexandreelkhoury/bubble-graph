// GAME-TRIVIA §8.1 secrecy, §13.2 views, §13.3 invariant 1 (leak oracles). Pure; server, sim and tests only.
// The correct position, any per-option correctness and other players' choices reach a view ONLY in REVEAL.
import type { Locale } from "../../../constants";
import type { GameMemory, RosterEntry } from "../../types";
import { LENGTHS, VIEW_VERSION } from "../constants";
import type { TriviaPhase } from "../meta";
import { memoryKey } from "../engine/draw";
import { familyOf, quizCard, quizzesFor, resolveQuiz } from "../engine/quiz";
import { awaitedPlayers, canPlay, isFinalIndex } from "../engine/reduce";
import { rankRows } from "../engine/scoring";
import type { TriviaCatalog, TriviaSettings, TriviaState } from "../engine/types";
import type { TriviaExtras, TriviaMe, TriviaPublic, TriviaRevealView, TriviaScoreView } from "../engine/view";

const QUESTION_PHASES: readonly TriviaPhase[] = ["READ", "ANSWER", "REVEAL"];
/** Phases where the current question's answer is not public yet. */
const SECRET_PHASES: readonly TriviaPhase[] = ["QUIZ_INTRO", "READ", "ANSWER", "HOLD"];

// ─── scores ──────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Row { id: string; seat: number; score: number; correct: number; timeSum: number }

/** Rank map (§5.3) over the players still in the game. */
function ranks(rows: readonly Row[]): Map<string, number> {
  return new Map(rankRows(rows).map((r) => [r.id, r.rank] as const));
}

export function scoreRows(s: TriviaState): TriviaScoreView[] {
  const active = s.players.filter((p) => !p.left);
  const now = ranks(active);
  // The "before" side: REVEAL = before this question (its points removed); LEADERBOARD = the previous board.
  const rev = s.phase === "REVEAL" ? s.last : null;
  const before = new Map<string, Row>();
  for (const p of active) {
    const c = rev?.choices.find((x) => x.id === p.id);
    const gained = c ? c.points + c.streakBonus : 0;
    const counted = c !== undefined && c.correct && !rev?.voided;
    before.set(p.id, {
      id: p.id, seat: p.seat, score: p.score - gained,
      correct: p.correct - (counted ? 1 : 0), timeSum: p.timeSum - (counted ? (c.timeMs as number) : 0),
    });
  }
  const beforeRanks = rev ? ranks([...before.values()]) : null;
  const row = (p: (typeof s.players)[number]): TriviaScoreView => {
    let scoreBefore = p.score;
    let rankBefore: number | null = now.get(p.id) ?? null;
    if (rev && !p.left) { scoreBefore = (before.get(p.id) as Row).score; rankBefore = beforeRanks?.get(p.id) ?? null; }
    else if (s.phase === "LEADERBOARD") { scoreBefore = p.boardScore; rankBefore = p.left ? null : p.boardRank; }
    if (p.left) rankBefore = null;
    return {
      playerId: p.id, score: p.score, scoreBefore, rankBefore, streak: p.streak, bestStreak: p.bestStreak,
      correct: p.correct, fastest: p.fastest, rank: p.left ? null : (now.get(p.id) ?? null), left: p.left,
    };
  };
  const ranked = rankRows(active).map((r) => row(s.players.find((p) => p.id === r.id) as (typeof s.players)[number]));
  return [...ranked, ...s.players.filter((p) => p.left).map(row)];
}

// ─── public / me / status ────────────────────────────────────────────────────────────────────────────────────────────

export function projectPublic(s: TriviaState): TriviaPublic {
  const q = s.cur;
  const inQuestion = q !== null && QUESTION_PHASES.includes(s.phase);
  const showOptions = q !== null && (s.phase === "ANSWER" || s.phase === "REVEAL");
  const r = s.phase === "REVEAL" ? s.last : null;
  let reveal: TriviaRevealView | null = null;
  if (r && q) {
    reveal = {
      correct: r.correctIndex,
      choices: r.choices.map((c) => ({ id: c.id, choice: c.choice, correct: c.correct, timeMs: c.timeMs, points: c.points, streakBonus: c.streakBonus })),
      fastestIds: [...r.fastestIds], onFireIds: [...r.onFireIds],
      stumped: r.stumped, genius: r.genius, tooSlow: r.choices.every((c) => c.choice === null),
      explain: q.explain, voided: r.voided,
    };
  }
  const quiz: TriviaPublic["quiz"] = {
    id: s.quiz.id, title: { ...s.quiz.title }, stars: s.quiz.stars, domain: s.quiz.domain,
    featuredTopics: [...s.quiz.featuredTopics], topicCount: s.quiz.topicCount, questionCount: s.quiz.questionCount,
  };
  return {
    schema: VIEW_VERSION,
    phase: s.phase,
    quiz,
    rerun: s.rerun,
    index: s.index,
    total: s.questionIds.length,
    isFinal: s.phase === "FINAL_INTRO" || (inQuestion && isFinalIndex(s, s.index)),
    deadline: s.deadline?.at ?? null,
    durationMs: s.deadline?.durationMs ?? null,
    question: inQuestion ? { id: q.id, text: q.text, type: q.type, topic: q.topic, difficulty: q.difficulty } : null,
    options: showOptions ? [...q.options] : [],
    answeredIds: s.phase === "ANSWER" ? s.players.filter((p) => s.answers[p.id] !== undefined).map((p) => p.id)
      : r ? r.choices.filter((c) => c.choice !== null).map((c) => c.id) : [],
    reveal,
    scores: scoreRows(s),
    newIds: inQuestion ? s.players.filter((p) => !p.left && p.newAt === s.index).map((p) => p.id) : [],
    waitingIds: s.players.filter((p) => !p.left && p.waiting).map((p) => p.id),
    endedEarly: s.endedEarly,
  };
}

/** That player's private part; null for an id not in this instance. Own choice only in ANSWER (after the tap) and REVEAL. */
export function projectMe(s: TriviaState, playerId: string): TriviaMe | null {
  const p = s.players.find((x) => x.id === playerId);
  if (!p) return null;
  let myChoice: number | null = null;
  let myTimeMs: number | null = null;
  if (s.phase === "ANSWER") {
    const a = s.answers[p.id];
    if (a) { myChoice = a.choice; myTimeMs = a.timeMs; }
  } else if (s.phase === "REVEAL") {
    const c = s.last?.choices.find((x) => x.id === p.id);
    if (c) { myChoice = c.choice; myTimeMs = c.timeMs; }
  }
  return { myChoice, myTimeMs, waitingForNext: p.waiting && !p.left };
}

/** Envelope status: who answered (never what) and who is still awaited, during ANSWER only. */
export function projectStatus(s: TriviaState): { phase: string; doneIds: string[]; awaitedIds: string[] } {
  if (s.phase !== "ANSWER") return { phase: s.phase, doneIds: [], awaitedIds: [] };
  return {
    phase: s.phase,
    doneIds: s.players.filter((p) => s.answers[p.id] !== undefined).map((p) => p.id),
    awaitedIds: awaitedPlayers(s).map((p) => p.id),
  };
}

/** SETUP extras (§2, §9, §9.1): the resolved quiz, its size, the "Rerun" hint, and the shelf list. */
export function projectSetup(s: TriviaSettings, _roster: readonly RosterEntry[], content: TriviaCatalog, locale: Locale, memory: GameMemory): TriviaExtras {
  const pack = resolveQuiz(content, s.quizId, locale);
  const available = pack?.questions.length ?? 0;
  const playCount = Math.min(LENGTHS[s.length], available);
  let rerun = false;
  if (pack) {
    const used = new Set(memory.usedKeys);
    const fam = familyOf(pack);
    rerun = pack.questions.filter((q) => !used.has(memoryKey(fam, q.id))).length < playCount;
  }
  return { gameId: "trivia", available, playCount, rerun, quiz: pack ? quizCard(pack) : null, quizzes: quizzesFor(content, locale).map(quizCard) };
}

// ─── leak oracles ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Platform forbidden keys (§13.3) plus the other state-only names. None of them is ever a view key. */
export const FORBIDDEN_KEYS = [
  "answers", "correctIndex", "order", "rngState", "usedKeys", "source", "questionIds", "prevStreak", "prevBest", "answerOpenAt",
  "boardScore", "boardRank", "timeSum",
] as const;

/**
 * Secret leaf values (whole-leaf equality; run on the synthetic unique-token catalog): in READ the options of the
 * question (they appear at ANSWER), and before REVEAL its "Did you know?" line. Questions not yet on screen are not in
 * the state at all (resolved from the pack at their READ).
 */
export function secretsFor(s: TriviaState, _viewer: string | null): readonly unknown[] {
  const q = s.cur;
  if (!q) return [];
  const out: unknown[] = [];
  if (s.phase === "READ") out.push(...q.options);
  if ((s.phase === "READ" || s.phase === "ANSWER") && q.explain !== null) out.push(q.explain);
  return out;
}

type Env = { public: TriviaPublic; me: TriviaMe | null };
/** The game envelope of a room view ({game:{public,me}}), or a bare {public,me}. */
function envelope(view: unknown): Env | null {
  if (view === null || typeof view !== "object") return null;
  const v = view as Record<string, unknown>;
  const g = ("game" in v ? v.game : v) as Record<string, unknown> | null;
  if (!g || typeof g !== "object" || !("public" in g)) return null;
  return { public: g.public as TriviaPublic, me: (g.me ?? null) as TriviaMe | null };
}

/** Calls `on(key, path)` for every object key under `x` (`path` = the keys above it; a shared, mutated stack). */
function walkKeys(x: unknown, path: string[], on: (k: string, path: readonly string[]) => void): void {
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) {
      path.push(String(i));
      walkKeys(x[i], path, on);
      path.pop();
    }
  } else if (x !== null && typeof x === "object") {
    for (const k of Object.keys(x)) {
      on(k, path);
      path.push(k);
      walkKeys((x as Record<string, unknown>)[k], path, on);
      path.pop();
    }
  }
}

/** Keys that would carry the answer or someone's pick; legal only inside `public.reveal` (REVEAL) and `me`. */
const ANSWER_KEYS = new Set(["correct", "choice", "choices", "isCorrect", "answer", "myChoice", "myTimeMs", "timeMs", "points", "streakBonus"]);
const ME_KEYS = "myChoice,myTimeMs,waitingForNext";

/** Structural rules (§8.1, §13.3 invariant 1, platform §2.12) on the game envelope of one viewer's view. */
export function leakCheck(s: TriviaState, viewer: string | null, view: unknown): string[] {
  const env = envelope(view);
  if (!env) return [];
  const errs: string[] = [];
  const pub = env.public;
  const secret = SECRET_PHASES.includes(s.phase);

  // Answer-bearing keys: only under public.reveal (REVEAL) and the viewer's own me; `scores[i].correct` is a count.
  walkKeys(pub, ["public"], (k, path) => {
    if (!ANSWER_KEYS.has(k)) return;
    if (path[1] === "reveal") return;
    if (k === "correct" && path[1] === "scores" && path.length === 3) return;
    errs.push(`"${k}" at ${path.join(".")}`);
  });
  if (s.phase !== "REVEAL" && pub.reveal !== null) errs.push(`reveal in ${s.phase}`);
  if (secret && pub.reveal !== null) errs.push("reveal before REVEAL");
  for (const o of pub.options) if (typeof o !== "string") errs.push("an option is not a plain string");
  if (s.phase !== "ANSWER" && s.phase !== "REVEAL" && pub.options.length > 0) errs.push(`options in ${s.phase}`);
  if (s.phase === "READ" || s.phase === "ANSWER") {
    // Scores never move before the reveal (a moved score would tell who was right).
    for (const r of pub.scores) if (r.score !== r.scoreBefore) errs.push(`score of ${r.playerId} moved before REVEAL`);
    const answered = s.players.filter((p) => s.answers[p.id] !== undefined).map((p) => p.id);
    if (pub.answeredIds.join(",") !== answered.join(",")) errs.push("answeredIds differ from who answered");
  }

  const me = env.me;
  if (me !== null) {
    if (viewer === null) errs.push("me in a TV/spectator view");
    else {
      if (Object.keys(me).sort().join(",") !== ME_KEYS) errs.push(`me carries keys ${Object.keys(me).join(",")}`);
      let own: number | null = null;
      if (s.phase === "ANSWER") own = s.answers[viewer]?.choice ?? null;
      else if (s.phase === "REVEAL") own = s.last?.choices.find((c) => c.id === viewer)?.choice ?? null;
      if (me.myChoice !== own) errs.push(`me.myChoice is not ${viewer}'s own choice`);
      if (me.myChoice === null && me.myTimeMs !== null) errs.push("myTimeMs without a choice");
      const p = s.players.find((x) => x.id === viewer);
      if (p && me.waitingForNext !== (p.waiting && !p.left)) errs.push("waitingForNext mismatch");
    }
  }
  // Late joiners and left players never appear as having answered the current question.
  if (s.phase === "ANSWER") for (const id of pub.answeredIds) {
    const p = s.players.find((x) => x.id === id);
    if (!p || !canPlay(p)) errs.push(`answeredIds has ${id}`);
  }
  return errs;
}
