// GAME-TRIVIA §4, §5, §6, §13.1, §13.4 flow: every phase transition and intent error, the first deadline with the
// entrance grace, READ never skippable, the 600 ms early end, reconnects, HOLD, late joiners, VOID_QUESTION, END_GAME,
// server-time scoring, outcome and memory.
import { describe, expect, it } from "vitest";
import { MEMORY_MAX_KEYS } from "../../../src/constants";
import { EARLY_END_MS, FINAL_INTRO_MS, LEADERBOARD_MS, QUIZ_INTRO_MS, readMs, REVEAL_EXPLAIN_MS, REVEAL_MS } from "../../../src/games/trivia/constants";
import { memoryKey } from "../../../src/games/trivia/engine/draw";
import { graphemes } from "../../../src/games/trivia/engine/quiz";
import { leaderboardDue } from "../../../src/games/trivia/engine/reduce";
import type { TriviaState } from "../../../src/games/trivia/engine/types";
import { TriviaIntentSchema } from "../../../src/games/trivia/protocol";
import { synthPack } from "../../../src/testing/catalogs/trivia";
import {
  answer, CATALOG, DEF, GRACE, intent, openAt, pl, player, playQuestion, right, roster, score, startGame, step, stepErr, T0, tick, tryStep, tv, until, wrong,
} from "./helpers";

/** The phase sequence of a game where nobody answers. */
function trace(s0: TriviaState): string[] {
  const out = [s0.phase as string];
  let s = s0;
  while (s.phase !== "RESULTS") {
    s = tick(s);
    out.push(s.phase === "READ" ? `READ${s.index + 1}` : s.phase);
  }
  return out;
}

describe("start and QUIZ_INTRO (§4)", () => {
  it("the first phase is QUIZ_INTRO with deadline = now + ENTRANCE_GRACE_MS + 4 000; scores start at 0", () => {
    const s = startGame(3);
    expect(s.phase).toBe("QUIZ_INTRO");
    expect(s.deadline).toEqual({ kind: "QUIZ_INTRO", at: T0 + GRACE + QUIZ_INTRO_MS, durationMs: GRACE + QUIZ_INTRO_MS });
    expect(DEF.nextWakeAt(s)).toBe(T0 + GRACE + QUIZ_INTRO_MS);
    expect(s.questionIds).toHaveLength(10);
    expect(s.players.map((p) => p.score)).toEqual([0, 0, 0]);
    expect(s.quiz).toMatchObject({ id: "syn-quiz", packId: "syn-quiz-en", stars: 2, questionCount: 40 });
    expect(s.cur).toBeNull();
    expect(DEF.outcome(s)).toBeNull();
  });

  it("carry scores are ignored (carriesScore: false)", () => {
    const s = startGame(2, {}, { roster: roster(2).map((r) => ({ ...r, carryScore: 500 })) });
    expect(s.players.map((p) => p.score)).toEqual([0, 0]);
  });

  it("the host (TV or VIP) may skip QUIZ_INTRO; another player may not", () => {
    const s = startGame(3);
    expect(stepErr(s, intent({ type: "HOST_ADVANCE" }, player("p2")), T0 + 10)).toBe("NOT_HOST");
    const r = step(s, intent({ type: "HOST_ADVANCE" }, player("p1")), T0 + 10);
    expect(r.phase).toBe("READ");
    expect(r.deadline?.at).toBe(T0 + 10 + readMs(graphemes(r.cur!.text)));
    expect(step(s, intent({ type: "HOST_ADVANCE" }, tv), T0 + 10).phase).toBe("READ");
  });

  it("start blockers: nobody connected, too many players, no quiz in the content language, unknown family; solo works", () => {
    const base = { settings: { quizId: null, length: "normal" as const, pace: "normal" as const }, memory: { usedKeys: [] }, seed: 1, now: T0, graceMs: GRACE, content: CATALOG };
    expect(DEF.start({ ...base, roster: roster(2).map((r) => ({ ...r, connected: false })), locale: "en" })).toMatchObject({ ok: false, error: "NOT_ENOUGH_PLAYERS" });
    expect(DEF.startBlocker(roster(13), base.settings, CATALOG, "en")).toBe("GAME_FULL");
    expect(DEF.start({ ...base, roster: roster(2), locale: "en", content: { packs: CATALOG.packs.filter((p) => p.locale !== "en") } })).toMatchObject({ ok: false, error: "NO_CONTENT_AVAILABLE" });
    expect(DEF.start({ ...base, roster: roster(2), locale: "en", settings: { ...base.settings, quizId: "nope" } })).toMatchObject({ ok: false, error: "NO_CONTENT_AVAILABLE" });
    expect(DEF.startBlocker(roster(1), base.settings, CATALOG, "ar")).toBeNull();
    expect(DEF.startBlocker(roster(2).map((r, i) => ({ ...r, connected: i === 0 })), base.settings, CATALOG, "es")).toBeNull();
  });

  it("quizId is a family: the pack of the content language is used", () => {
    const s = startGame(2, { quizId: "syn-quiz" }, { locale: "fr" });
    expect(s.quiz.packId).toBe("syn-quiz-fr");
    const w = startGame(2, { quizId: "syn-world" }, { locale: "en" });
    expect(w.quiz).toMatchObject({ id: "syn-world", packId: "syn-world-en", domain: "world", stars: 1 });
  });
});

describe("structure (§4)", () => {
  it("normal (10): leaderboards after q3, q6, q9 (the last also precedes the final)", () => {
    expect(trace(startGame(2))).toEqual([
      "QUIZ_INTRO", "READ1", "ANSWER", "REVEAL", "READ2", "ANSWER", "REVEAL", "READ3", "ANSWER", "REVEAL", "LEADERBOARD",
      "READ4", "ANSWER", "REVEAL", "READ5", "ANSWER", "REVEAL", "READ6", "ANSWER", "REVEAL", "LEADERBOARD",
      "READ7", "ANSWER", "REVEAL", "READ8", "ANSWER", "REVEAL", "READ9", "ANSWER", "REVEAL", "LEADERBOARD", "FINAL_INTRO",
      "READ10", "ANSWER", "REVEAL", "RESULTS",
    ]);
  });
  it("short (7): leaderboards after q3 and q6 (before the final)", () => {
    const t = trace(startGame(2, { length: "short" }));
    expect(t.filter((p) => p === "LEADERBOARD")).toHaveLength(2);
    expect(t.slice(-7)).toEqual(["REVEAL", "LEADERBOARD", "FINAL_INTRO", "READ7", "ANSWER", "REVEAL", "RESULTS"]);
  });
  it("long (15): leaderboards after 3, 6, 9, 12 and 14 (before the final)", () => {
    const t = trace(startGame(2, { length: "long" }));
    const lbAfter = t.flatMap((p, i) => (p === "LEADERBOARD" ? [t.slice(0, i).filter((x) => x.startsWith("READ")).length] : []));
    expect(lbAfter).toEqual([3, 6, 9, 12, 14]);
  });
  it("a quiz capped at 2 questions: REVEAL → FINAL_INTRO with no leaderboard", () => {
    const tiny = { packs: [synthPack({ n: 2 })] };
    const s = DEF.start({ roster: roster(1), settings: { quizId: null, length: "short", pace: "normal" }, locale: "en", memory: { usedKeys: [] }, seed: 3, now: T0, graceMs: GRACE, content: tiny });
    if (!s.ok) throw new Error("start");
    let x = s.state;
    const out = [x.phase as string];
    while (x.phase !== "RESULTS") { x = tick(x, 0, tiny); out.push(x.phase); }
    expect(out).toEqual(["QUIZ_INTRO", "READ", "ANSWER", "REVEAL", "FINAL_INTRO", "READ", "ANSWER", "REVEAL", "RESULTS"]);
    expect(leaderboardDue({ questionIds: ["a", "b", "c"] }, 1)).toBe(false);
  });
  it("durations: READ from the question length, ANSWER by type and pace, REVEAL (+3 s with explain), LEADERBOARD 6 s, FINAL_INTRO 4 s; all from the expiring tick's now", () => {
    let x = until(startGame(2, { pace: "fast" }), "READ");
    const seen = new Set<string>();
    while (x.phase !== "RESULTS") {
      const now = x.deadline!.at + 37; // a late alarm
      const y = step(x, { type: "TICK" }, now);
      if (y.phase === "READ") expect(y.deadline!.at - now).toBe(Math.min(7_000, Math.max(3_000, 2_500 + 40 * graphemes(y.cur!.text))));
      if (y.phase === "ANSWER") { expect(openAt(y)).toBe(now); expect(y.deadline!.at - now).toBe(y.cur!.type === "mc4" ? 10_000 : 7_000); seen.add(y.cur!.type); }
      if (y.phase === "REVEAL") { expect(y.deadline!.at - now).toBe(REVEAL_MS + (y.cur!.explain ? REVEAL_EXPLAIN_MS : 0)); seen.add(y.cur!.explain ? "explain" : "plain"); }
      if (y.phase === "LEADERBOARD") { expect(y.deadline!.at - now).toBe(LEADERBOARD_MS); seen.add("LB"); }
      if (y.phase === "FINAL_INTRO") { expect(y.deadline!.at - now).toBe(FINAL_INTRO_MS); seen.add("FI"); }
      x = y;
    }
    expect([...seen].sort()).toEqual(["FI", "LB", "explain", "mc4", "plain", "tf"].sort());
    expect(readMs(0)).toBe(3_000);
    expect(readMs(1_000)).toBe(7_000);
  });
  it("a TICK before the deadline changes nothing (same object); RESULTS never wakes", () => {
    const s = startGame(2);
    expect(tryStep(s, { type: "TICK" }, s.deadline!.at - 1)).toEqual({ ok: true, state: s });
    const end = until(s, "RESULTS");
    expect(DEF.nextWakeAt(end)).toBeNull();
    expect(tryStep(end, { type: "TICK" }, end.players.length + 1e15).state).toBe(end);
  });
});

describe("answering (§5.1, §13.1)", () => {
  it("READ is never skippable, and nobody can answer before ANSWER opens", () => {
    const r = until(startGame(3), "READ");
    expect(stepErr(r, intent({ type: "HOST_ADVANCE" }), T0)).toBe("WRONG_PHASE");
    expect(stepErr(r, intent({ type: "ANSWER", choice: 0 }, player("p2")), r.deadline!.at - 1)).toBe("WRONG_PHASE");
    const a = tick(r);
    expect(stepErr(a, intent({ type: "HOST_ADVANCE" }), openAt(a) + 1)).toBe("WRONG_PHASE");
  });

  it("first tap locks (ALREADY_ANSWERED); ANSWER_INVALID out of range and 2–3 on tf; the TV and strangers are NOT_IN_GAME", () => {
    let s = tick(until(startGame(3), "READ"));
    const t = openAt(s);
    s = answer(s, "p1", 0, t + 1_000);
    expect(stepErr(s, intent({ type: "ANSWER", choice: 1 }, player("p1")), t + 1_200)).toBe("ALREADY_ANSWERED");
    expect(stepErr(s, intent({ type: "ANSWER", choice: 4 }, player("p2")), t + 1_200)).toBe("ANSWER_INVALID");
    expect(stepErr(s, intent({ type: "ANSWER", choice: -1 }, player("p2")), t + 1_200)).toBe("ANSWER_INVALID");
    expect(stepErr(s, intent({ type: "ANSWER", choice: 1.5 }, player("p2")), t + 1_200)).toBe("ANSWER_INVALID");
    expect(stepErr(s, intent({ type: "ANSWER", choice: 0 }, tv), t + 1_200)).toBe("NOT_IN_GAME");
    expect(stepErr(s, intent({ type: "ANSWER", choice: 0 }, player("zz")), t + 1_200)).toBe("NOT_IN_GAME");
    // tf: positions 0..1 only
    let x = until(startGame(2, {}, { seed: 1 }), "READ");
    while (x.cur!.type !== "tf") x = until(tick(x), "READ");
    x = tick(x);
    expect(stepErr(x, intent({ type: "ANSWER", choice: 2 }, player("p1")), openAt(x) + 10)).toBe("ANSWER_INVALID");
    expect(answer(x, "p1", 1, openAt(x) + 10).answers.p1).toEqual({ choice: 1, timeMs: 0 });
  });

  it("time comes from ctx.now at receipt (minus the 300 ms grace); the intent carries no client time", () => {
    let s = tick(until(startGame(2), "READ"));
    const t = openAt(s);
    s = answer(s, "p1", right(s), t + 3_300);
    expect(s.answers.p1!.timeMs).toBe(3_000);
    s = answer(s, "p2", right(s), t + 100);
    expect(s.answers.p2!.timeMs).toBe(0);
    const r = tick(s, 0);
    // The early end fired: both answered.
    const row = (id: string) => r.last!.choices.find((c) => c.id === id)!;
    expect(row("p2").points).toBe(1000);
    expect(row("p1").points).toBe(500 + 400); // speed 500 × (1 − 3000/15000) = 400
    // The schema refuses any client-supplied time.
    expect(TriviaIntentSchema.safeParse({ type: "ANSWER", choice: 1 }).success).toBe(true);
    expect(TriviaIntentSchema.safeParse({ type: "ANSWER", choice: 1, t: 12 }).success).toBe(false);
    expect(TriviaIntentSchema.safeParse({ type: "ANSWER", choice: 1, sentAt: T0 }).success).toBe(false);
  });

  it("all connected players answered → deadline = now + 600 (never later than the original)", () => {
    let s = tick(until(startGame(3), "READ"));
    const t = openAt(s);
    const original = s.deadline!.at;
    s = answer(s, "p1", 0, t + 1_000);
    s = answer(s, "p2", 0, t + 2_000);
    expect(s.deadline!.at).toBe(original);
    s = answer(s, "p3", 1, t + 3_000);
    expect(s.deadline).toEqual({ kind: "ANSWER", at: t + 3_000 + EARLY_END_MS, durationMs: EARLY_END_MS });
    // At the very end of the window, the early end never extends it.
    let e = tick(until(startGame(1), "READ"));
    e = answer(e, "p1", 0, e.deadline!.at - 100);
    expect(e.deadline!.at).toBe(openAt(e) + 15_000);
  });

  it("disconnected players are not awaited; a player who drops makes the early end fire for the others", () => {
    let s = tick(until(startGame(3), "READ"));
    const t = openAt(s);
    s = answer(s, "p1", 0, t + 500);
    s = answer(s, "p2", 0, t + 600);
    s = step(s, { type: "PLAYER_AWAY", playerId: "p3" }, t + 700);
    expect(s.deadline!.at).toBe(t + 700 + EARLY_END_MS);
    expect(DEF.projectStatus(s)).toEqual({ phase: "ANSWER", doneIds: ["p1", "p2"], awaitedIds: [] });
  });

  it("an answer after the deadline (alarm not yet run) is WRONG_PHASE; so is one after REVEAL", () => {
    const s = tick(until(startGame(2), "READ"));
    expect(stepErr(s, intent({ type: "ANSWER", choice: 0 }, player("p1")), s.deadline!.at + 1)).toBe("WRONG_PHASE");
    const r = tick(s);
    expect(stepErr(r, intent({ type: "ANSWER", choice: 0 }, player("p1")), r.deadline!.at - 1)).toBe("WRONG_PHASE");
  });

  it("reconnecting mid-ANSWER can still answer; time still counts from the original answerOpenAt", () => {
    let s = until(startGame(2), "READ");
    s = step(s, { type: "PLAYER_AWAY", playerId: "p2" }, s.deadline!.at - 500);
    s = tick(s);
    const t = openAt(s);
    s = step(s, { type: "PLAYER_BACK", playerId: "p2" }, t + 5_000);
    expect(openAt(s)).toBe(t);
    s = answer(s, "p2", 0, t + 6_300);
    expect(s.answers.p2!.timeMs).toBe(6_000);
    // AWAY/BACK no-ops return the same object.
    expect(tryStep(s, { type: "PLAYER_BACK", playerId: "p2" }, t + 6_400).state).toBe(s);
    const away = step(s, { type: "PLAYER_AWAY", playerId: "p1" }, t + 6_500);
    expect(tryStep(away, { type: "PLAYER_AWAY", playerId: "p1" }, t + 6_600).state).toBe(away);
    expect(tryStep(away, { type: "PLAYER_AWAY", playerId: "nobody" }, t + 6_600).state).toBe(away);
  });
});

describe("scoring through the engine (§5)", () => {
  it("streaks build, cap at +300, reset on a wrong answer; points never go negative; the final doubles", () => {
    let s = until(startGame(2), "READ");
    const bonus: number[] = [];
    for (let q = 0; q < 10; q++) {
      const okP1 = q !== 5; // p1 misses q6
      s = playQuestion(s, { p1: { ok: okP1, after: 300 }, p2: { ok: false, after: 400 } });
      const row = s.last!.choices.find((c) => c.id === "p1")!;
      bonus.push(row.streakBonus);
      expect(row.points).toBe(okP1 ? (s.last!.isFinal ? 2 : 1) * (s.cur!.type === "mc4" ? 1000 : 500) : 0);
      if (s.last!.isFinal) break;
      s = until(tick(s), "READ");
    }
    expect(bonus).toEqual([0, 100, 200, 300, 300, 0, 0, 100, 200, 300]);
    expect(pl(s, "p2").score).toBe(0);
    expect(pl(s, "p1").bestStreak).toBe(5);
    expect(pl(s, "p1").streak).toBe(4);
  });

  it("highlights: fastest finger (≥ 2 correct), stumped, genius (≥ 3 answers), on fire; points fly = score deltas", () => {
    let s = until(startGame(3), "READ");
    s = playQuestion(s, { p1: { ok: true, after: 1_000 }, p2: { ok: true, after: 2_000 }, p3: { ok: false, after: 50 } });
    expect(s.last).toMatchObject({ fastestIds: ["p1"], stumped: false, genius: false });
    s = playQuestion(until(tick(s), "READ"), { p1: { ok: false, after: 10 }, p2: { ok: false, after: 20 } });
    expect(s.last).toMatchObject({ fastestIds: [], stumped: true, genius: false });
    s = playQuestion(until(tick(s), "READ"), { p1: { ok: true, after: 900 }, p2: { ok: true, after: 900 }, p3: { ok: true, after: 900 } });
    expect(s.last).toMatchObject({ fastestIds: ["p1", "p2", "p3"], genius: true });
    expect(pl(s, "p1").fastest).toBe(2);
    // p1: right, wrong, right → no fire; three in a row gives on fire.
    let f = until(startGame(1), "READ");
    for (let i = 0; i < 3; i++) f = until(tick(playQuestion(f, { p1: { ok: true, after: 0 } })), "READ");
    expect(tick(tick(f)).last!.onFireIds).toEqual([]); // 4th: no answer → streak broken
    let g = until(startGame(1, {}, { seed: 9 }), "READ");
    for (let i = 0; i < 2; i++) g = until(tick(playQuestion(g, { p1: { ok: true, after: 0 } })), "READ");
    expect(playQuestion(g, { p1: { ok: true, after: 0 } }).last!.onFireIds).toEqual(["p1"]);
  });
});

describe("HOLD (§4, §6)", () => {
  it("nobody connected at question start → HOLD; a reconnect starts the READ; the host may end it", () => {
    let s = until(startGame(2), "REVEAL");
    s = step(s, { type: "PLAYER_AWAY", playerId: "p1" }, s.deadline!.at - 10);
    s = step(s, { type: "PLAYER_AWAY", playerId: "p2" }, s.deadline!.at - 5);
    s = tick(s);
    expect(s.phase).toBe("HOLD");
    expect(s.deadline).toBeNull();
    expect(DEF.nextWakeAt(s)).toBeNull();
    expect(s.index).toBe(1);
    expect(stepErr(s, intent({ type: "HOST_ADVANCE" }), T0)).toBe("WRONG_PHASE");
    expect(stepErr(s, intent({ type: "END_GAME" }, player("p2")), T0)).toBe("NOT_HOST");
    const back = step(s, { type: "PLAYER_BACK", playerId: "p2" }, 5e6);
    expect(back.phase).toBe("READ");
    expect(back.index).toBe(1);
    const end = step(s, intent({ type: "END_GAME" }), 5e6);
    expect(end.phase).toBe("RESULTS");
    expect(DEF.outcome(end)).not.toBeNull();
    expect(stepErr(back, intent({ type: "END_GAME" }), 5e6)).toBe("WRONG_PHASE");
  });

  it("from QUIZ_INTRO too; a late joiner who is connected wakes a held game", () => {
    let s = startGame(1);
    s = step(s, { type: "PLAYER_AWAY", playerId: "p1" }, T0 + 1);
    s = tick(s);
    expect(s.phase).toBe("HOLD");
    const j = DEF.join!(s, { id: "p9", seat: 9, locale: "en", connected: true, carryScore: 0 });
    if (!j.ok) throw new Error("join");
    expect(DEF.nextWakeAt(j.state)).toBe(0);
    const r = step(j.state, { type: "TICK" }, 9e6);
    expect(r.phase).toBe("READ");
    expect(pl(r, "p9")).toMatchObject({ waiting: false, newAt: 0 });
    // A TICK in HOLD with nobody back just clears the stray wake time.
    const k = DEF.join!(s, { id: "p8", seat: 8, locale: "en", connected: false, carryScore: 0 });
    if (!k.ok) throw new Error("join");
    expect(k.state.deadline).toBeNull();
  });
});

describe("late joiners (§6)", () => {
  it("join waits for the next READ, starts at 0, gets the New ribbon, is ranked normally; never in RESULTS", () => {
    let s = tick(until(startGame(2), "READ"));
    const j = DEF.join!(s, { id: "p3", seat: 5, locale: "en", connected: true, carryScore: 900 });
    if (!j.ok) throw new Error("join");
    s = checked2(j.state);
    expect(pl(s, "p3")).toMatchObject({ waiting: true, score: 0 });
    expect(DEF.projectMe(s, "p3", CATALOG)).toEqual({ myChoice: null, myTimeMs: null, waitingForNext: true });
    expect(stepErr(s, intent({ type: "ANSWER", choice: 0 }, player("p3")), openAt(s) + 10)).toBe("WRONG_PHASE");
    expect(DEF.projectStatus(s).awaitedIds).toEqual(["p1", "p2"]);
    s = answer(s, "p1", 0, openAt(s) + 10);
    s = answer(s, "p2", 0, openAt(s) + 20);
    expect(s.deadline!.at).toBe(openAt(s) + 20 + EARLY_END_MS); // the waiting joiner is not awaited
    s = tick(s);
    expect(s.last!.choices.map((c) => c.id)).toEqual(["p1", "p2"]);
    s = until(tick(s), "READ");
    expect(pl(s, "p3")).toMatchObject({ waiting: false, newAt: 1 });
    expect(DEF.projectPublic(s, CATALOG).newIds).toEqual(["p3"]);
    // Same id again: no-op; RESULTS: refused; 12 active players: GAME_FULL.
    expect(DEF.join!(s, { id: "p3", seat: 5, locale: "en", connected: true, carryScore: 0 }).state).toBe(s);
    const end = until(s, "RESULTS");
    expect(DEF.join!(end, { id: "p4", seat: 6, locale: "en", connected: true, carryScore: 0 })).toMatchObject({ ok: false, error: "WRONG_PHASE" });
    const full = startGame(12);
    expect(DEF.join!(full, { id: "p13", seat: 13, locale: "en", connected: true, carryScore: 0 })).toMatchObject({ ok: false, error: "GAME_FULL" });
  });
});
const checked2 = (s: TriviaState): TriviaState => { DEF.assertInvariants(s); return s; };

describe("leaving (§6)", () => {
  it("a player who leaves keeps a frozen score, is never awaited nor scored again, and is out of the outcome", () => {
    let s = until(startGame(3), "READ");
    s = playQuestion(s, { p1: { ok: true, after: 0 }, p2: { ok: true, after: 100 }, p3: { ok: true, after: 200 } });
    const frozen = score(s, "p2");
    s = step(s, { type: "PLAYER_GONE", playerId: "p2", cause: "LEAVE" }, s.deadline!.at - 1);
    expect(pl(s, "p2")).toMatchObject({ left: true, connected: false });
    expect(tryStep(s, { type: "PLAYER_GONE", playerId: "p2", cause: "KICK" }, s.deadline!.at).state).toBe(s);
    expect(tryStep(s, { type: "PLAYER_BACK", playerId: "p2" }, s.deadline!.at).state).toBe(s);
    s = tick(until(tick(s), "READ"));
    expect(DEF.projectStatus(s).awaitedIds).toEqual(["p1", "p3"]);
    expect(stepErr(s, intent({ type: "ANSWER", choice: 0 }, player("p2")), openAt(s))).toBe("NOT_IN_GAME");
    const end = until(s, "RESULTS");
    expect(score(end, "p2")).toBe(frozen);
    const out = DEF.outcome(end)!;
    expect(out.points.p2).toBe(0);
    expect(out.ranking.flat()).not.toContain("p2");
  });
  it("leaving mid-ANSWER drops that answer and may end the window early", () => {
    let s = tick(until(startGame(2), "READ"));
    s = answer(s, "p1", 0, openAt(s) + 10);
    s = step(s, { type: "PLAYER_GONE", playerId: "p2", cause: "KICK" }, openAt(s) + 20);
    expect(s.deadline!.at).toBe(openAt(s) + 20 + EARLY_END_MS);
    let t = tick(until(startGame(2), "READ"));
    t = answer(t, "p2", 0, openAt(t) + 10);
    t = step(t, { type: "PLAYER_GONE", playerId: "p2", cause: "LEAVE" }, openAt(t) + 20);
    expect(t.answers.p2).toBeUndefined();
  });
});

describe("VOID_QUESTION (§6, §13.3 invariant 4)", () => {
  it("restores scores, streaks, counters and highlights; reported once; only in REVEAL, only the shown question, host only", () => {
    let s = until(startGame(3), "READ");
    s = playQuestion(s, { p1: { ok: true, after: 0 }, p2: { ok: true, after: 50 }, p3: { ok: false, after: 0 } });
    s = until(tick(s), "READ");
    s = playQuestion(s, { p1: { ok: true, after: 10 }, p2: { ok: true, after: 900 }, p3: { ok: true, after: 0 } });
    const before = structuredClone(s.players);
    const qid = s.last!.questionId;
    expect(stepErr(s, intent({ type: "VOID_QUESTION", questionId: qid }, player("p2")), s.deadline!.at - 1)).toBe("NOT_HOST");
    expect(stepErr(s, intent({ type: "VOID_QUESTION", questionId: "q999" }), s.deadline!.at - 1)).toBe("WRONG_PHASE");
    const v = step(s, intent({ type: "VOID_QUESTION", questionId: qid }, player("p1")), s.deadline!.at - 1);
    expect(v.last).toMatchObject({ voided: true, fastestIds: [], onFireIds: [] });
    expect(v.voidedQuestionIds).toEqual([qid]);
    for (const p of v.players) {
      const b = before.find((x) => x.id === p.id)!;
      const c = s.last!.choices.find((x) => x.id === p.id)!;
      expect(p.score).toBe(b.score - c.points - c.streakBonus);
      expect(p.streak).toBe(c.prevStreak);
      expect(p.correct).toBe(b.correct - (c.correct ? 1 : 0));
    }
    expect(pl(v, "p1").streak).toBe(1);
    expect(pl(v, "p3").fastest).toBe(0);
    // A second void is a no-op (same object); the pub reveal shows 0 points; after REVEAL it is refused.
    expect(tryStep(v, intent({ type: "VOID_QUESTION", questionId: qid }), v.deadline!.at - 1).state).toBe(v);
    expect(DEF.projectPublic(v, CATALOG).reveal!.choices.every((c) => c.points === 0 && c.streakBonus === 0)).toBe(true);
    const next = tick(v);
    expect(stepErr(next, intent({ type: "VOID_QUESTION", questionId: qid }), next.deadline!.at - 1)).toBe("WRONG_PHASE");
    // The next correct answer continues the RESTORED streak.
    const after = playQuestion(until(next, "READ"), { p1: { ok: true, after: 0 } });
    expect(after.last!.choices.find((c) => c.id === "p1")!.streakBonus).toBe(100);
  });
});

describe("host intents and phases", () => {
  it("HOST_ADVANCE expires REVEAL, LEADERBOARD and FINAL_INTRO inline; END_GAME only in HOLD", () => {
    let s = until(startGame(2), "REVEAL");
    const at = s.deadline!.at - 3_000;
    s = step(s, intent({ type: "HOST_ADVANCE" }), at);
    expect(s.phase).toBe("READ");
    expect(s.deadline!.at - at).toBe(readMs(graphemes(s.cur!.text)));
    s = until(s, "LEADERBOARD");
    s = step(s, intent({ type: "HOST_ADVANCE" }), s.deadline!.at - 1);
    expect(s.phase).toBe("READ");
    s = until(s, "FINAL_INTRO");
    s = step(s, intent({ type: "HOST_ADVANCE" }), s.deadline!.at - 1);
    expect(s.phase).toBe("READ");
    expect(DEF.projectPublic(s, CATALOG).isFinal).toBe(true);
    expect(stepErr(s, intent({ type: "END_GAME" }), s.deadline!.at - 1)).toBe("WRONG_PHASE");
    const end = until(s, "RESULTS");
    expect(stepErr(end, intent({ type: "HOST_ADVANCE" }), 0)).toBe("WRONG_PHASE");
  });
  it("the board snapshot: the next LEADERBOARD grows from the previous totals and ranks", () => {
    let s = until(startGame(2), "READ");
    for (let i = 0; i < 3; i++) s = until(tick(playQuestion(s, { p1: { ok: true, after: 0 } })), i < 2 ? "READ" : "LEADERBOARD");
    const first = DEF.projectPublic(s, CATALOG);
    expect(first.scores.map((r) => [r.scoreBefore, r.rankBefore])).toEqual([[0, null], [0, null]]);
    s = tick(s);
    for (let i = 0; i < 3; i++) s = until(tick(playQuestion(s, { p2: { ok: true, after: 0 } })), i < 2 ? "READ" : "LEADERBOARD");
    const second = DEF.projectPublic(s, CATALOG);
    expect(second.scores.find((r) => r.playerId === "p1")).toMatchObject({ scoreBefore: score(s, "p1"), rankBefore: 1 });
    expect(second.scores.find((r) => r.playerId === "p2")).toMatchObject({ scoreBefore: 0, rankBefore: 2 });
  });
});

describe("outcome and memory (§2.2)", () => {
  it("outcome once in RESULTS: this instance's points; ranking with the §5.3 tie-breaks; 0-point and left players excluded", () => {
    let s = until(startGame(4), "READ");
    s = playQuestion(s, { p1: { ok: true, after: 0 }, p2: { ok: true, after: 0 }, p3: { ok: false, after: 0 } });
    const end = until(s, "RESULTS");
    const out = DEF.outcome(end)!;
    expect(out.points).toEqual({ p1: score(end, "p1"), p2: score(end, "p2"), p3: 0, p4: 0 });
    expect(out.ranking).toEqual([["p1", "p2"]]);
  });
  it("memory: questions that reached READ, appended to the room history with `<family>:<id>` keys, capped at 300", () => {
    const old = Array.from({ length: 299 }, (_, i) => `other:q${i}`);
    let s = startGame(2, {}, { usedKeys: old });
    expect(DEF.memory(s).usedKeys).toEqual(old);
    s = until(s, "READ");
    s = until(tick(s), "READ");
    const m = DEF.memory(s).usedKeys;
    expect(m).toHaveLength(MEMORY_MAX_KEYS);
    expect(m.slice(-2)).toEqual([memoryKey("syn-quiz", s.questionIds[0]!), memoryKey("syn-quiz", s.questionIds[1]!)]);
    expect(m[0]).toBe("other:q1");
    // A key played again moves to the end (most recent), never duplicated.
    const one = { packs: [synthPack({ n: 1 })] };
    const again = startGame(1, {}, { usedKeys: ["syn-quiz:q001", "x:1"], content: one });
    expect(DEF.memory(until(again, "READ", one)).usedKeys).toEqual(["x:1", "syn-quiz:q001"]);
  });
  it("a later game prefers fresh questions (no repeat across games until the pool runs out)", () => {
    let used: string[] = [];
    const seen = new Set<string>();
    for (let g = 0; g < 4; g++) {
      const s = until(startGame(1, {}, { usedKeys: used, seed: 100 + g }), "RESULTS");
      for (const id of s.questionIds) { expect(seen.has(id), `game ${g} repeats ${id}`).toBe(false); seen.add(id); }
      expect(s.rerun).toBe(false);
      used = DEF.memory(s).usedKeys;
    }
    const fifth = startGame(1, {}, { usedKeys: used, seed: 200 });
    expect(fifth.rerun).toBe(true);
  });
});

describe("content loss mid-game (access change)", () => {
  it("the quiz leaving the playable catalog ends the game at the next question with the points earned", () => {
    let s = until(startGame(2), "READ");
    s = playQuestion(s, { p1: { ok: true, after: 0 } });
    const gone = { packs: CATALOG.packs.filter((p) => p.id !== "syn-quiz-en") };
    const r = step(s, { type: "TICK" }, s.deadline!.at, gone);
    expect(r.phase).toBe("RESULTS");
    expect(r.endedEarly).toBe(true);
    expect(DEF.outcome(r)!.points.p1).toBe(score(s, "p1"));
    expect(DEF.projectPublic(r, gone).endedEarly).toBe(true);
  });
});

describe("determinism and purity", () => {
  it("the same seed and actions give a JSON-equal state; reduce never mutates its input", () => {
    const run = () => {
      let s = until(startGame(3, {}, { seed: 77 }), "READ");
      s = playQuestion(s, { p1: { ok: true, after: 120 }, p2: { ok: false, after: 900 } });
      return until(s, "RESULTS");
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    const s = tick(until(startGame(2), "READ"));
    const snap = JSON.stringify(s);
    answer(s, "p1", wrong(s), openAt(s) + 5);
    tick(s);
    expect(JSON.stringify(s)).toBe(snap);
  });
});
