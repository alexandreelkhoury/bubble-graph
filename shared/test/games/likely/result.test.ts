// GAME-LIKELY §5.1 (result of a card, percentages): table tests. (No scoring: the game has no points, §6.)
import { describe, expect, it } from "vitest";
import { percentOf, tally, withPercent } from "../../../src/games/likely/engine/result";
import type { LikelyBallot } from "../../../src/games/likely/engine/state";
import { ids } from "./helpers";

const B = (pairs: [string, string][]): LikelyBallot[] => pairs.map(([voterId, targetId]) => ({ voterId, targetId }));

describe("result of a card (§5.1)", () => {
  it("chaos: n = 3..12, everyone picks someone different", () => {
    for (let n = 3; n <= 12; n++) {
      const p = ids(n);
      expect(tally(B(p.map((v, i) => [v, p[(i + 1) % n] as string])), p)).toMatchObject({ votesCast: n, chaos: true, unanimous: false, topIds: [] });
    }
  });
  it("unanimous: n = 3..12, all on one target", () => {
    for (let n = 3; n <= 12; n++) {
      const p = ids(n);
      expect(tally(B(p.map((v) => [v, "p2"])), p)).toMatchObject({ votesCast: n, chaos: false, unanimous: true, topIds: ["p2"] });
    }
  });
  it("ties share the top, in seat order", () => {
    const t = tally(B([["p1", "p4"], ["p2", "p4"], ["p3", "p2"], ["p4", "p2"], ["p5", "p6"], ["p6", "p1"]]), ids(6));
    expect(t.topIds).toEqual(["p2", "p4"]);
    expect(t.chaos).toBe(false);
  });
  it("one vote: top with count 1, not chaos", () => {
    expect(tally(B([["p1", "p3"]]), ids(3))).toMatchObject({ votesCast: 1, topIds: ["p3"], chaos: false, unanimous: false });
  });
  it("two different votes are a tie, not chaos (chaos needs ≥ 3)", () => {
    expect(tally(B([["p1", "p3"], ["p2", "p1"]]), ids(3))).toMatchObject({ topIds: ["p1", "p3"], chaos: false });
  });
  it("two votes on one target are not unanimous (needs ≥ 3)", () => {
    expect(tally(B([["p1", "p3"], ["p2", "p3"]]), ids(3))).toMatchObject({ topIds: ["p3"], unanimous: false });
  });
  it("no votes: nothing", () => {
    expect(tally([], ids(4))).toEqual({ votesCast: 0, counts: [], topIds: [], unanimous: false, chaos: false });
  });
  it("self-votes count like any vote", () => {
    expect(tally(B([["p1", "p1"], ["p2", "p1"], ["p3", "p1"]]), ids(3))).toMatchObject({ unanimous: true, topIds: ["p1"] });
  });
  it("is independent of ballot order", () => {
    const b = B([["p1", "p2"], ["p2", "p3"], ["p3", "p2"], ["p4", "p4"]]);
    expect(tally([...b].reverse(), ids(4))).toEqual(tally(b, ids(4)));
  });
});

describe("percentages (§5.1)", () => {
  it("round half up for 1..12 voters", () => {
    for (let v = 1; v <= 12; v++) {
      for (let c = 0; c <= v; c++) {
        // exact rational comparison: 100c/v has fraction ≥ 1/2  ⇔  2·(100c mod v) ≥ v
        const expected = Math.floor((100 * c) / v) + (2 * ((100 * c) % v) >= v ? 1 : 0);
        expect(percentOf(c, v), `${c}/${v}`).toBe(expected);
      }
    }
    expect(percentOf(1, 8)).toBe(13); // 12.5 → 13
    expect(percentOf(1, 6)).toBe(17);
    expect(percentOf(0, 0)).toBe(0);
  });
  it("3 × 1 vote → 33/33/33 (sum 99, accepted)", () => {
    expect(withPercent(tally(B([["p1", "p2"], ["p2", "p3"], ["p3", "p1"]]), ids(3))).map((c) => c.percent)).toEqual([33, 33, 33]);
  });
  it("ordered by percent desc, then seat", () => {
    expect(withPercent(tally(B([["p1", "p3"], ["p2", "p3"], ["p3", "p1"], ["p4", "p2"]]), ids(4)))).toEqual([
      { playerId: "p3", count: 2, percent: 50 },
      { playerId: "p1", count: 1, percent: 25 },
      { playerId: "p2", count: 1, percent: 25 },
    ]);
  });
});
