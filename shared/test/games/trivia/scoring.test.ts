// GAME-TRIVIA §5 / §13.4: the scoring table, streaks, the ×2 final, ranking tie-breaks and per-question highlights.
import { describe, expect, it } from "vitest";
import { answerMs, GRACE_MS } from "../../../src/games/trivia/constants";
import { answerPoints, answerTime, highlights, isOnFire, rankGroups, rankRows, scoreAnswer, speedBonus, streakBonus } from "../../../src/games/trivia/engine/scoring";

const T = 15_000;

describe("answer time (§5.1)", () => {
  it("t = clamp(receivedAt − answerOpenAt − 300, 0, T): the grace absorbs jitter, never negative, never past T", () => {
    expect(answerTime(1_000, 1_000, T)).toBe(0);
    expect(answerTime(1_000 + GRACE_MS, 1_000, T)).toBe(0);           // grace boundary
    expect(answerTime(1_000 + GRACE_MS + 1, 1_000, T)).toBe(1);
    expect(answerTime(1_000 + 7_800, 1_000, T)).toBe(7_500);
    expect(answerTime(1_000 + T + GRACE_MS + 50_000, 1_000, T)).toBe(T);
  });
});

describe("points (§5.2)", () => {
  it.each([
    // [type, t, T, base + round10(max × (1 − t/T))] — worked by hand from §5.2
    ["mc4", 0, 15_000, 1000], ["mc4", 7_500, 15_000, 750], ["mc4", 15_000, 15_000, 500],
    ["mc4", 1, 15_000, 1000],          // 499.97 → 500
    ["mc4", 150, 15_000, 1000],        // 495 → 500 (half up)
    ["mc4", 450, 15_000, 990],         // 485 → 490
    ["mc4", 3_210, 15_000, 890],       // 393 → 390
    ["tf", 0, 10_000, 500], ["tf", 5_000, 10_000, 380], ["tf", 10_000, 10_000, 250],
  ] as const)("%s at t=%i of %i → %i", (type, t, TT, want) => {
    expect(answerPoints(type, t, TT)).toBe(want);
  });
  it("round10 rounds half up exactly (integer arithmetic, no float drift)", () => {
    // 500 × (1 − 150/15000) = 495 → 500 (half up); 500 × (1 − 450/15000) = 485 → 490.
    expect(speedBonus("mc4", 150, T)).toBe(500);
    expect(speedBonus("mc4", 450, T)).toBe(490);
    // tf: 250 × (1 − 5000/10000) = 125 → 130.
    expect(speedBonus("tf", 5_000, 10_000)).toBe(130);
    expect(speedBonus("mc4", 0, 0)).toBe(0);
    // Every t gives a multiple of 10 in range.
    for (let t = 0; t <= T; t += 37) {
      const p = answerPoints("mc4", t, T);
      expect(p % 10).toBe(0);
      expect(p).toBeGreaterThanOrEqual(500);
      expect(p).toBeLessThanOrEqual(1000);
    }
  });
  it("a slow correct answer (≥ 500) always beats a fast wrong one (0); tf scores half", () => {
    expect(scoreAnswer({ correct: true, type: "mc4", t: T, T, isFinal: false, prevStreak: 0 }).points).toBe(500);
    expect(scoreAnswer({ correct: false, type: "mc4", t: 0, T, isFinal: false, prevStreak: 4 })).toEqual({ points: 0, streakBonus: 0, streak: 0 });
    expect(scoreAnswer({ correct: true, type: "tf", t: 0, T: 10_000, isFinal: false, prevStreak: 0 }).points).toBe(500);
    expect(scoreAnswer({ correct: true, type: "tf", t: 10_000, T: 10_000, isFinal: false, prevStreak: 0 }).points).toBe(250);
  });
  it("no answer: 0 and the streak resets", () => {
    expect(scoreAnswer({ correct: false, type: "mc4", t: null, T, isFinal: true, prevStreak: 3 })).toEqual({ points: 0, streakBonus: 0, streak: 0 });
    expect(scoreAnswer({ correct: true, type: "mc4", t: null, T, isFinal: false, prevStreak: 3 })).toEqual({ points: 0, streakBonus: 0, streak: 0 });
  });
  it("the final doubles base + speed but not the streak bonus", () => {
    const r = scoreAnswer({ correct: true, type: "mc4", t: 0, T, isFinal: true, prevStreak: 5 });
    expect(r).toEqual({ points: 2000, streakBonus: 300, streak: 6 });
    expect(scoreAnswer({ correct: true, type: "tf", t: 10_000, T: 10_000, isFinal: true, prevStreak: 0 }).points).toBe(500);
  });
  it("streak bonus: 0, 100, 200, 300, then capped at +300 (streaks 1..8)", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(streakBonus)).toEqual([0, 100, 200, 300, 300, 300, 300, 300]);
    expect(streakBonus(0)).toBe(0);
    let prev = 0;
    const bonuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = scoreAnswer({ correct: true, type: "mc4", t: 0, T, isFinal: false, prevStreak: prev });
      bonuses.push(r.streakBonus);
      prev = r.streak;
    }
    expect(bonuses).toEqual([0, 100, 200, 300, 300, 300, 300, 300]);
    expect(prev).toBe(8);
  });
  it("pace: tf gets 2/3 of the mc4 window, rounded to the second", () => {
    expect([answerMs("mc4", "relaxed"), answerMs("mc4", "normal"), answerMs("mc4", "fast")]).toEqual([20_000, 15_000, 10_000]);
    expect([answerMs("tf", "relaxed"), answerMs("tf", "normal"), answerMs("tf", "fast")]).toEqual([13_000, 10_000, 7_000]);
  });
  it("on fire at streaks 3, 5, 7…", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].filter(isOnFire)).toEqual([3, 5, 7, 9]);
  });
});

describe("ranking and ties (§5.3)", () => {
  const row = (id: string, seat: number, score: number, correct: number, timeSum: number) => ({ id, seat, score, correct, timeSum });
  it("points ↓, then correct answers ↓, then total correct time ↑; still equal → shared place (1, 1, 3)", () => {
    const rows = [
      row("a", 0, 1000, 2, 9_000),
      row("b", 1, 1000, 3, 9_000),   // more correct beats a
      row("c", 2, 1000, 2, 4_000),   // same correct as a, faster
      row("d", 3, 1000, 2, 9_000),   // identical to a: shared place
      row("e", 4, 2000, 1, 100),
      row("f", 5, 0, 0, 0),
    ];
    expect(rankRows(rows).map((r) => [r.id, r.rank])).toEqual([["e", 1], ["b", 2], ["c", 3], ["a", 4], ["d", 4], ["f", 6]]);
    expect(rankGroups(rows)).toEqual([["e"], ["b"], ["c"], ["a", "d"], ["f"]]);
  });
  it("a tie at the top shares first place", () => {
    expect(rankGroups([row("a", 0, 500, 1, 10), row("b", 1, 500, 1, 10)])).toEqual([["a", "b"]]);
  });
});

describe("highlights (§5.4)", () => {
  const c = (id: string, choice: number | null, correct: boolean, timeMs: number | null) => ({ id, choice, correct, timeMs });
  it("fastest finger needs ≥ 2 correct answers; ties all get it", () => {
    expect(highlights([c("a", 0, true, 100)]).fastestIds).toEqual([]);
    expect(highlights([c("a", 0, true, 100), c("b", 0, true, 300)]).fastestIds).toEqual(["a"]);
    expect(highlights([c("a", 0, true, 100), c("b", 0, true, 100), c("x", 1, false, 0)]).fastestIds).toEqual(["a", "b"]);
  });
  it("stumped = nobody correct; genius = everyone who answered is correct with ≥ 3 answers; too slow = nobody answered", () => {
    expect(highlights([c("a", 1, false, 10), c("b", null, false, null)])).toMatchObject({ stumped: true, genius: false, tooSlow: false });
    expect(highlights([c("a", 0, true, 1), c("b", 0, true, 2), c("d", 0, true, 3), c("e", null, false, null)])).toMatchObject({ stumped: false, genius: true });
    expect(highlights([c("a", 0, true, 1), c("b", 0, true, 2)]).genius).toBe(false);
    expect(highlights([c("a", null, false, null)])).toMatchObject({ stumped: true, tooSlow: true, genius: false });
  });
});
