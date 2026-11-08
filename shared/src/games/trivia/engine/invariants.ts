// GAME-TRIVIA §13.3 invariants (plus structural ones), checked after every reduce by tests, the sim and the room harness.
import { MEMORY_MAX_KEYS } from "../../../constants";
import { InvariantError } from "../../mishana/engine/invariants";
import { BASE_POINTS, FINAL_MULTIPLIER, MAX_PLAYERS, SPEED_MAX, STATE_SCHEMA } from "../constants";
import { TRIVIA_PHASES } from "../meta";
import type { TriviaPhase } from "../meta";
import { canPlay } from "./reduce";
import { streakBonus } from "./scoring";
import type { TriviaState } from "./types";

export { InvariantError };

const TIMED: readonly TriviaPhase[] = ["QUIZ_INTRO", "READ", "ANSWER", "REVEAL", "LEADERBOARD", "FINAL_INTRO"];

export function assertInvariants(s: TriviaState): void {
  const fail = (m: string): never => { throw new InvariantError(`trivia: ${m}`); };
  if (s.schema !== STATE_SCHEMA) fail("schema");
  if (!TRIVIA_PHASES.includes(s.phase)) fail(`phase ${String(s.phase)}`);
  const n = s.questionIds.length;
  if (n === 0) fail("no questions");
  if (new Set(s.questionIds).size !== n) fail("duplicate question id");
  if (s.index < 0 || s.index >= n) fail(`index ${s.index}`);
  if (s.shown < 0 || s.shown > n) fail("shown");
  if (s.usedKeys.length > MEMORY_MAX_KEYS) fail("usedKeys over the cap");

  // deadlines
  if (TIMED.includes(s.phase)) {
    if (!s.deadline) fail(`${s.phase} without a deadline`);
    else if (s.deadline.kind !== s.phase) fail(`deadline kind ${s.deadline.kind} in ${s.phase}`);
  }
  if (s.phase === "RESULTS" && s.deadline !== null) fail("RESULTS with a deadline");
  if (s.phase === "HOLD" && s.deadline !== null && s.deadline.kind !== "HOLD") fail("HOLD deadline kind");

  // the question on screen
  const q = s.cur;
  const qPhase = s.phase === "READ" || s.phase === "ANSWER" || s.phase === "REVEAL";
  if (qPhase && !q) fail(`${s.phase} without a question`);
  if ((s.phase === "QUIZ_INTRO" || s.phase === "HOLD") && q) fail(`a question on screen in ${s.phase}`);
  if (qPhase && q) {
    if (q.id !== s.questionIds[s.index]) fail("cur is not the indexed question");
    if (q.options.length !== (q.type === "mc4" ? 4 : 2)) fail(`${q.id}: option count`);
    if (new Set(q.options).size !== q.options.length) fail(`${q.id}: options not unique`);
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) fail(`${q.id}: correct index`);
    if (s.phase === "READ" && q.answerOpenAt !== null) fail("answer opened in READ");
    if (s.phase !== "READ" && q.answerOpenAt === null) fail(`${s.phase} without answerOpenAt`);
    if (s.index + 1 > s.shown) fail("current question not counted as shown");
  }

  // players
  if (new Set(s.players.map((p) => p.id)).size !== s.players.length) fail("duplicate player");
  if (s.players.filter((p) => !p.left).length > MAX_PLAYERS) fail("too many players");
  for (let i = 1; i < s.players.length; i++) if ((s.players[i]?.seat ?? 0) <= (s.players[i - 1]?.seat ?? 0)) fail("players not in seat order");
  for (const p of s.players) {
    if (p.score < 0) fail(`${p.id}: negative score`);
    if (p.streak < 0 || p.streak > p.bestStreak) fail(`${p.id}: streak ${p.streak} > best ${p.bestStreak}`);
    if (p.correct < 0 || p.timeSum < 0 || p.fastest < 0) fail(`${p.id}: negative counter`);
    if (p.left && p.connected) fail(`${p.id}: left but connected`);
    if (p.correct === 0 && p.score !== 0) fail(`${p.id}: points without a correct answer`);
  }

  // answers: ANSWER only, ≤ 1 per player, dealt-in players, timeMs ∈ [0, T]
  const answerIds = Object.keys(s.answers);
  if (s.phase !== "ANSWER" && answerIds.length > 0) fail(`answers kept in ${s.phase}`);
  for (const id of answerIds) {
    const a = s.answers[id] as { choice: number; timeMs: number };
    const p = s.players.find((x) => x.id === id);
    if (!p || !canPlay(p)) fail(`answer from ${id}`);
    if (!q || a.choice < 0 || a.choice >= q.options.length) fail("choice out of range");
    if (q && (a.timeMs < 0 || a.timeMs > q.answerMs)) fail("timeMs out of [0, T]");
  }

  // the last revealed question
  const r = s.last;
  if (r) {
    if (r.index > s.index) fail("result ahead of the index");
    if (r.questionId !== s.questionIds[r.index]) fail("result question id");
    if (new Set(r.choices.map((c) => c.id)).size !== r.choices.length) fail("duplicate choice row");
    const T = s.phase === "REVEAL" && q ? q.answerMs : Infinity;
    for (const c of r.choices) {
      if (!s.players.some((p) => p.id === c.id)) fail(`choice of unknown ${c.id}`);
      if ((c.choice === null) !== (c.timeMs === null)) fail("choice/time mismatch");
      if (c.timeMs !== null && (c.timeMs < 0 || c.timeMs > T)) fail("result timeMs");
      if (c.correct !== (c.choice !== null && c.choice === r.correctIndex)) fail("correct flag");
      if (c.points < 0 || c.streakBonus < 0) fail("negative points");
      if (!c.correct && (c.points > 0 || c.streakBonus > 0)) fail("points for a wrong answer");
      if (c.correct && !r.voided) {
        const mult = r.isFinal ? FINAL_MULTIPLIER : 1;
        if (c.points < BASE_POINTS.tf * mult || c.points > (BASE_POINTS.mc4 + SPEED_MAX.mc4) * mult || c.points % 10 !== 0) fail("points out of range");
        if (c.streakBonus !== streakBonus(c.prevStreak + 1)) fail("streak bonus");
      }
      if (r.voided && (c.points !== 0 || c.streakBonus !== 0)) fail("points kept on a voided question");
    }
    if (r.voided && (r.fastestIds.length > 0 || r.onFireIds.length > 0)) fail("highlights kept on a voided question");
    for (const id of r.fastestIds) if (!r.choices.some((c) => c.id === id && c.correct)) fail("fastest is not correct");
  }
}
