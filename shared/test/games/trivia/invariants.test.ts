// GAME-TRIVIA §13.3: assertInvariants accepts every reachable state (the property tests) and rejects each kind of
// corrupted state below.
import { describe, expect, it } from "vitest";
import { InvariantError } from "../../../src/games/trivia/engine/invariants";
import type { TriviaState } from "../../../src/games/trivia/engine/types";
import { DEF, openAt, playQuestion, startGame, tick, until, answer } from "./helpers";

type Mut = (s: TriviaState) => void;
const corrupt = (s: TriviaState, f: Mut): (() => void) => () => {
  const d = structuredClone(s);
  f(d);
  DEF.assertInvariants(d);
};

describe("assertInvariants rejects corrupted states", () => {
  const intro = startGame(3);
  const read = until(intro, "READ");
  const ans = answer(tick(read), "p1", 0, openAt(tick(read)) + 10);
  const rev = playQuestion(read, { p1: { ok: true, after: 0 }, p2: { ok: false, after: 10 } });
  const end = until(rev, "RESULTS");

  it("accepts the real states", () => {
    for (const s of [intro, read, ans, rev, end]) expect(() => DEF.assertInvariants(s)).not.toThrow();
  });

  const cases: [string, TriviaState, Mut][] = [
    ["schema", intro, (s) => { (s as { schema: number }).schema = 9; }],
    ["phase", intro, (s) => { (s as { phase: string }).phase = "LOBBY"; }],
    ["no questions", intro, (s) => { s.questionIds = []; }],
    ["duplicate question", intro, (s) => { s.questionIds[1] = s.questionIds[0]!; }],
    ["index", intro, (s) => { s.index = 99; }],
    ["shown", intro, (s) => { s.shown = 99; }],
    ["usedKeys cap", intro, (s) => { s.usedKeys = Array.from({ length: 301 }, (_, i) => `k${i}`); }],
    ["missing deadline", read, (s) => { s.deadline = null; }],
    ["deadline kind", read, (s) => { s.deadline = { ...s.deadline!, kind: "ANSWER" }; }],
    ["RESULTS deadline", end, (s) => { s.deadline = { kind: "RESULTS", at: 1, durationMs: 1 }; }],
    ["HOLD deadline kind", intro, (s) => { s.phase = "HOLD"; s.deadline = { kind: "READ", at: 1, durationMs: 1 }; }],
    ["question missing", read, (s) => { s.cur = null; }],
    ["question in QUIZ_INTRO", intro, (s) => { s.cur = structuredClone(read.cur); }],
    ["cur not indexed", read, (s) => { s.cur!.id = "q999"; }],
    ["option count", read, (s) => { s.cur!.options = s.cur!.options.slice(0, 3); }],
    ["options unique", read, (s) => { s.cur!.options[1] = s.cur!.options[0]!; }],
    ["correct index", read, (s) => { s.cur!.correctIndex = 7; }],
    ["open in READ", read, (s) => { s.cur!.answerOpenAt = 1; }],
    ["ANSWER without open", ans, (s) => { s.cur!.answerOpenAt = null; }],
    ["not shown", read, (s) => { s.shown = 0; }],
    ["duplicate player", intro, (s) => { s.players[1] = { ...s.players[0]! }; }],
    ["too many players", intro, (s) => { s.players = Array.from({ length: 13 }, (_, i) => ({ ...s.players[0]!, id: `x${i}`, seat: i })); }],
    ["seat order", intro, (s) => { s.players.reverse(); }],
    ["negative score", intro, (s) => { s.players[0]!.score = -10; }],
    ["streak > best", intro, (s) => { s.players[0]!.streak = 2; }],
    ["negative counter", intro, (s) => { s.players[0]!.fastest = -1; }],
    ["left but connected", intro, (s) => { s.players[0]!.left = true; }],
    ["points without a correct answer", intro, (s) => { s.players[0]!.score = 500; }],
    ["answers outside ANSWER", read, (s) => { s.answers = { p1: { choice: 0, timeMs: 0 } }; }],
    ["answer from a stranger", ans, (s) => { s.answers.zz = { choice: 0, timeMs: 0 }; }],
    ["choice out of range", ans, (s) => { s.answers.p1!.choice = 9; }],
    ["timeMs out of range", ans, (s) => { s.answers.p1!.timeMs = 999_999; }],
    ["result ahead", rev, (s) => { s.last!.index = 5; }],
    ["result id", rev, (s) => { s.last!.questionId = "q999"; }],
    ["duplicate choice row", rev, (s) => { s.last!.choices.push({ ...s.last!.choices[0]! }); }],
    ["unknown choice row", rev, (s) => { s.last!.choices[0]!.id = "zz"; }],
    ["choice/time mismatch", rev, (s) => { s.last!.choices[0]!.timeMs = null; }],
    ["result timeMs", rev, (s) => { s.last!.choices[0]!.timeMs = 999_999; }],
    ["correct flag", rev, (s) => { s.last!.choices[1]!.correct = true; }],
    ["negative points", rev, (s) => { s.last!.choices[1]!.streakBonus = -1; }],
    ["points for a wrong answer", rev, (s) => { s.last!.choices[1]!.points = 10; }],
    ["points out of range", rev, (s) => { s.last!.choices[0]!.points = 1_010; }],
    ["streak bonus", rev, (s) => { s.last!.choices[0]!.streakBonus = 100; }],
    ["voided keeps points", rev, (s) => { s.last!.voided = true; }],
    ["voided keeps highlights", rev, (s) => { s.last!.voided = true; for (const c of s.last!.choices) { c.points = 0; c.streakBonus = 0; } s.last!.fastestIds = ["p1"]; }],
    ["fastest is not correct", rev, (s) => { s.last!.fastestIds = ["p2"]; }],
  ];
  it.each(cases)("%s", (_name, s, f) => {
    expect(corrupt(s, f)).toThrow(InvariantError);
  });
});
