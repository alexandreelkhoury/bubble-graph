// GAME-TAQRIBAN §13.3 invariants (plus structural ones), checked after every reduce by tests, the sim and the room.
import { InvariantError } from "../../mishana/engine/invariants";
import { BULLSEYE_POINTS, CLOSEST_POINTS, FINAL_MULTIPLIER, STATE_SCHEMA, TAQ_LENGTHS, TAQ_MEMORY_MAX, validGuess } from "../constants";
import { TAQRIBAN_PHASES } from "../meta";
import { canPlay, isFinalIndex, scoreQuestion } from "./reduce";
import type { TaqribanState } from "./types";

export function assertInvariants(s: TaqribanState): void {
  const fail = (m: string): never => {
    throw new InvariantError(`taqriban: ${m}`);
  };
  if (s.schema !== STATE_SCHEMA) fail("schema");
  if (!(TAQRIBAN_PHASES as readonly string[]).includes(s.phase)) fail(`phase ${s.phase}`);
  if (s.questionIds.length !== TAQ_LENGTHS[s.settings.length]) fail("question count");
  if (new Set(s.questionIds).size !== s.questionIds.length) fail("duplicate question");
  if (s.skippedIds.some((id) => s.questionIds.includes(id))) fail("a skipped question is still in play");
  if (s.index < 0 || s.index >= s.questionIds.length) fail("index");
  if (s.shown > s.questionIds.length || s.shown < (s.phase === "QUESTION" ? s.index + 1 : 0)) fail("shown");
  if (s.usedKeys.length > TAQ_MEMORY_MAX) fail("usedKeys");
  const ids = s.players.map((p) => p.id);
  if (new Set(ids).size !== ids.length) fail("duplicate player");
  for (let k = 1; k < s.players.length; k++) if ((s.players[k - 1]?.seat ?? 0) >= (s.players[k]?.seat ?? 0)) fail("seat order");
  for (const p of s.players) {
    if (p.left && p.connected) fail(`left player ${p.id} connected`);
    if (p.score < 0 || p.closest < 0 || p.bullseyes < 0) fail(`negative tally for ${p.id}`);
    if (p.score % (BULLSEYE_POINTS) !== 0) fail(`score of ${p.id} is not a multiple of ${BULLSEYE_POINTS}`);
    if (p.waiting && p.newAt !== null) fail(`waiting player ${p.id} has newAt`);
  }

  // Phase shape.
  const asking = s.phase === "QUESTION";
  if ((asking || s.phase === "REVEAL") !== (s.cur !== null)) fail("question presence");
  if (s.phase === "REVEAL" && (!s.cur || !s.last || s.last.index !== s.index || s.last.questionId !== s.cur.id)) fail("reveal shape");
  if (s.phase === "RESULTS" && s.deadline !== null) fail("deadline in RESULTS");
  if (s.phase !== "RESULTS" && s.phase !== "HOLD" && s.deadline === null) fail(`no deadline in ${s.phase}`);
  if (s.cur && s.questionIds[s.index] !== s.cur.id) fail("current question is not questionIds[index]");

  // 1. Guesses only in QUESTION, from players who may play, valid values.
  if (!asking && Object.keys(s.guesses).length > 0) fail(`guesses outside QUESTION (${s.phase})`);
  for (const [id, v] of Object.entries(s.guesses)) {
    const p = s.players.find((x) => x.id === id);
    if (!p || !canPlay(p)) fail(`guess from ${id}`);
    if (!validGuess(v)) fail(`invalid guess ${String(v)}`);
  }

  // 2. The last result is self-consistent: points follow §5 exactly from the guesses and the answer.
  const r = s.last;
  if (r) {
    if (r.isFinal !== isFinalIndex(s, r.index)) fail("isFinal");
    const re = scoreQuestion(r.answer, r.rows.map((x) => ({ id: x.id, value: x.value })), r.isFinal);
    if (JSON.stringify(re.rows) !== JSON.stringify(r.rows) || re.wildId !== r.wildId) fail("result does not follow the scoring rule");
    const anyGuess = r.rows.some((x) => x.value !== null);
    if (anyGuess !== (r.closestIds.length > 0)) fail("closest presence");
    const mult = r.isFinal ? FINAL_MULTIPLIER : 1;
    for (const x of r.rows) if (x.points > mult * (CLOSEST_POINTS + BULLSEYE_POINTS)) fail("points cap");
  }
  // 3. Totals: questions won and Bullseyes never exceed the questions revealed.
  const revealed = s.phase === "QUESTION" || s.phase === "HOLD" ? s.index : s.index + 1;
  for (const p of s.players) if (p.closest > revealed || p.bullseyes > revealed) fail(`tally of ${p.id} > questions revealed`);
}
