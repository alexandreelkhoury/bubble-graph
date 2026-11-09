// GAME-TRIVIA §8.1 secrecy table, §13.2 views and §13.3 invariant 1: what each phase projects, the leak oracles
// (and that they catch planted leaks), differential secrecy, envelope status and setup extras.
import { describe, expect, it } from "vitest";
import type { TriviaState } from "../../../src/games/trivia/engine/types";
import { FORBIDDEN_KEYS, leakCheck, projectMe, projectPublic, secretsFor } from "../../../src/games/trivia/projection/project";
import { TriviaExtrasSchema, TriviaMeSchema, TriviaPublicSchema } from "../../../src/games/trivia/protocol";
import { findTriviaLeaks, triviaEnvelope } from "../../../src/testing/bots/trivia";
import { synthPack } from "../../../src/testing/catalogs/trivia";
import { answer, CATALOG, DEF, openAt, playQuestion, right, roster, startGame, tick, until, wrong } from "./helpers";

const pub = (s: TriviaState) => DEF.projectPublic(s, CATALOG);

describe("secrecy table (§8.1)", () => {
  it("QUIZ_INTRO: quiz card only; no question, options or reveal", () => {
    const p = pub(startGame(3));
    expect(TriviaPublicSchema.parse(p)).toEqual(p);
    expect(p).toMatchObject({ phase: "QUIZ_INTRO", index: 0, total: 10, isFinal: false, question: null, options: [], answeredIds: [], reveal: null });
    expect(p.quiz).toEqual({ id: "syn-quiz", title: CATALOG.packs[0]!.title, stars: 2, domain: "lebanon", featuredTopics: ["music", "geography", "football"], topicCount: 6, questionCount: 40 });
  });
  it("READ: the question for everyone, no options, no explain", () => {
    const s = until(startGame(3), "READ");
    const p = pub(s);
    expect(p.question).toEqual({ id: s.cur!.id, text: s.cur!.text, type: s.cur!.type, topic: s.cur!.topic, difficulty: s.cur!.difficulty });
    expect(p.options).toEqual([]);
    expect(JSON.stringify(p)).not.toContain("explain-");
    expect(secretsFor(s, null)).toEqual(expect.arrayContaining(s.cur!.options));
  });
  it("ANSWER: options in displayed order; who answered, never what; own choice only in own me", () => {
    let s = tick(until(startGame(3), "READ"));
    s = answer(s, "p2", wrong(s), openAt(s) + 2_000);
    const p = pub(s);
    expect(p.options).toEqual(s.cur!.options);
    expect(p.answeredIds).toEqual(["p2"]);
    expect(p.reveal).toBeNull();
    expect(projectMe(s, "p2")).toEqual({ myChoice: wrong(s), myTimeMs: 1_700, waitingForNext: false });
    expect(projectMe(s, "p1")).toEqual({ myChoice: null, myTimeMs: null, waitingForNext: false });
    expect(projectMe(s, "nobody")).toBeNull();
    expect(DEF.projectStatus(s)).toEqual({ phase: "ANSWER", doneIds: ["p2"], awaitedIds: ["p1", "p3"] });
    for (const r of p.scores) expect(r.score).toBe(r.scoreBefore);
  });
  it("REVEAL: the right position, every choice, times, points, highlights and the explain line for all", () => {
    let s = until(startGame(3, {}, { seed: 5 }), "READ");
    while (!s.cur!.explain) s = until(tick(s), "READ");
    s = playQuestion(s, { p1: { ok: true, after: 1_000 }, p2: { ok: true, after: 4_000 }, p3: { ok: false, after: 500 } });
    const p = pub(s);
    expect(p.reveal).toMatchObject({ correct: s.cur!.correctIndex, fastestIds: ["p1"], stumped: false, genius: false, tooSlow: false, voided: false, explain: s.cur!.explain });
    expect(p.reveal!.choices.map((c) => [c.id, c.correct])).toEqual([["p1", true], ["p2", true], ["p3", false]]);
    expect(p.answeredIds).toEqual(["p1", "p2", "p3"]);
    const top = p.scores[0]!;
    expect(top).toMatchObject({ playerId: "p1", scoreBefore: 0, rankBefore: 1, rank: 1, correct: 1, streak: 1 });
    expect(projectMe(s, "p3")).toEqual({ myChoice: s.last!.choices.find((c) => c.id === "p3")!.choice, myTimeMs: 200, waitingForNext: false });
    expect(projectMe(s, "p3")!.myChoice).not.toBe(right(s));
    expect(DEF.projectStatus(s)).toEqual({ phase: "REVEAL", doneIds: [], awaitedIds: [] });
  });
  it("LEADERBOARD / FINAL_INTRO / RESULTS: no question, options or choices; me carries no choice", () => {
    let s = until(startGame(2), "READ");
    s = playQuestion(s, { p1: { ok: true, after: 0 } });
    for (const phase of ["LEADERBOARD", "FINAL_INTRO", "RESULTS"] as const) {
      s = until(s, phase);
      const p = pub(s);
      expect(p).toMatchObject({ phase, question: null, options: [], reveal: null, answeredIds: [] });
      expect(projectMe(s, "p1")).toEqual({ myChoice: null, myTimeMs: null, waitingForNext: false });
      expect(p.isFinal).toBe(phase === "FINAL_INTRO");
    }
  });
  it("scores: best first, ties share a rank, left players last with rank null", () => {
    let s = until(startGame(3), "READ");
    s = playQuestion(s, { p3: { ok: true, after: 0 } });
    s = DEF.reduce(s, { type: "PLAYER_GONE", playerId: "p1", cause: "LEAVE" }, { now: s.deadline!.at - 1, content: CATALOG, isHost: () => true, hostPlayerId: null }).state;
    const rows = pub(s).scores;
    expect(rows.map((r) => [r.playerId, r.rank, r.left])).toEqual([["p3", 1, false], ["p2", 2, false], ["p1", null, true]]);
  });
});

describe("leak oracles catch planted leaks", () => {
  const answering = (): TriviaState => {
    const s = tick(until(startGame(3), "READ"));
    return answer(s, "p2", right(s), openAt(s) + 900);
  };
  const env = (s: TriviaState, viewer: string | null) => triviaEnvelope(s, CATALOG, viewer);

  it("a real view passes for the TV and every player in every phase", () => {
    let s = until(startGame(3), "READ");
    expect(findTriviaLeaks(s, CATALOG)).toEqual([]);
    s = answering();
    expect(findTriviaLeaks(s, CATALOG)).toEqual([]);
  });
  it("flags the correct position, a per-option flag, others' choices, a moved score and a TV me", () => {
    const s = answering();
    const plant = (viewer: string | null, f: (v: ReturnType<typeof env>) => void): string[] => { const v = env(s, viewer); f(v); return leakCheck(s, viewer, v); };
    const P = (v: ReturnType<typeof env>) => v.game.public as Record<string, unknown>;
    expect(plant(null, (v) => { P(v).correct = 1; })).not.toEqual([]);
    expect(plant(null, (v) => { P(v).options = [{ text: "a", correct: true }]; })).not.toEqual([]);
    expect(plant(null, (v) => { P(v).reveal = { correct: 0 }; })).not.toEqual([]);
    expect(plant(null, (v) => { P(v).answeredIds = []; })).not.toEqual([]);
    expect(plant(null, (v) => { (P(v).scores as { score: number }[])[0]!.score += 10; })).not.toEqual([]);
    expect(plant(null, (v) => { v.game.me = { myChoice: 1, myTimeMs: 1, waitingForNext: false }; })).not.toEqual([]);
    expect(plant("p1", (v) => { v.game.me = { myChoice: right(s), myTimeMs: 600, waitingForNext: false }; })).not.toEqual([]);   // p2's pick
    expect(plant("p2", (v) => { (v.game.me as Record<string, unknown>).others = { p1: 0 }; })).not.toEqual([]);
    expect(plant("p2", (v) => { P(v).choices = [{ id: "p2", choice: 1 }]; })).not.toEqual([]);
    expect(leakCheck(s, null, null)).toEqual([]);
  });
  it("secretsFor: the options during READ and the explain line before REVEAL; nothing in other phases", () => {
    let s = until(startGame(2, {}, { seed: 2 }), "READ");
    while (!s.cur!.explain) s = until(tick(s), "READ");
    expect(secretsFor(s, null)).toEqual([...s.cur!.options, s.cur!.explain]);
    s = tick(s);
    expect(secretsFor(s, "p1")).toEqual([s.cur!.explain]);
    s = tick(s);
    expect(secretsFor(s, null)).toEqual([]);
    expect(secretsFor(startGame(1), null)).toEqual([]);
  });
  it("forbidden keys never appear in any view", () => {
    const s = answering();
    const text = JSON.stringify([env(s, null), env(s, "p1"), env(s, "p2")]);
    for (const k of FORBIDDEN_KEYS) expect(text).not.toContain(`"${k}"`);
  });
});

describe("differential secrecy: the answer cannot be read from ANSWER/READ views", () => {
  it("states that differ only in the correct position (and in other players' picks) give identical TV views", () => {
    for (let seed = 1; seed <= 30; seed++) {
      let s = tick(until(startGame(4, {}, { seed }), "READ"));
      s = answer(s, "p1", 0, openAt(s) + 100);
      s = answer(s, "p2", 1, openAt(s) + 200);
      const n = s.cur!.options.length;
      for (let k = 0; k < n; k++) {
        const alt: TriviaState = { ...s, cur: { ...s.cur!, correctIndex: k }, answers: { p1: { choice: (k + 1) % n, timeMs: 0 }, p2: { choice: k, timeMs: 0 } } };
        expect(JSON.stringify(projectPublic(alt))).toBe(JSON.stringify(projectPublic(s)));
        expect(JSON.stringify(DEF.projectStatus(alt))).toBe(JSON.stringify(DEF.projectStatus(s)));
        expect(projectMe(alt, "p3")).toEqual(projectMe(s, "p3"));
      }
      const r = { ...s, phase: "READ" as const, answers: {}, cur: { ...s.cur!, answerOpenAt: null } };
      for (let k = 0; k < n; k++) expect(JSON.stringify(projectPublic({ ...r, cur: { ...r.cur, correctIndex: k } }))).toBe(JSON.stringify(projectPublic(r)));
    }
  });
});

describe("schemas and setup extras", () => {
  it("every projected view in a whole game matches the zod view schemas", () => {
    let s = startGame(3);
    while (s.phase !== "RESULTS") {
      TriviaPublicSchema.parse(pub(s));
      for (const id of ["p1", "p2", "p3"]) TriviaMeSchema.parse(projectMe(s, id));
      if (s.phase === "ANSWER") s = answer(s, "p1", 0, openAt(s) + 50);
      s = tick(s);
    }
    TriviaPublicSchema.parse(pub(s));
  });
  it("projectSetup: the resolved quiz card, its size, the play count, the Rerun hint and the shelf list", () => {
    const access = { premium: false, packs: new Set<string>() };
    const s = DEF.meta.settings.defaults;
    const e = DEF.projectSetup(s, roster(2), CATALOG, access, "en", { usedKeys: [] });
    expect(TriviaExtrasSchema.parse(e)).toEqual(e);
    expect(e).toMatchObject({ gameId: "trivia", available: 40, playCount: 10, rerun: false, quiz: { id: "syn-quiz" } });
    expect(e.quizzes.map((q) => q.id)).toEqual(["syn-quiz", "syn-world"]);
    const capped = DEF.projectSetup({ ...s, length: "long" }, roster(2), { packs: [synthPack({ n: 7 })] }, access, "en", { usedKeys: [] });
    expect(capped).toMatchObject({ available: 7, playCount: 7 });
    const used = { usedKeys: Array.from({ length: 35 }, (_, i) => `syn-quiz:q${String(i + 1).padStart(3, "0")}`) };
    expect(DEF.projectSetup(s, roster(2), CATALOG, access, "en", used).rerun).toBe(true);
    expect(DEF.projectSetup(s, roster(2), { packs: [] }, access, "en", { usedKeys: [] })).toEqual({ gameId: "trivia", available: 0, playCount: 0, rerun: false, quiz: null, quizzes: [] });
    expect(DEF.projectSetup({ ...s, quizId: "syn-world" }, roster(2), CATALOG, access, "ar", { usedKeys: [] }).quiz).toBeNull();
  });
});
