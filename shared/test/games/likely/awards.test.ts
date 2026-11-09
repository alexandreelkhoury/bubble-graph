// GAME-LIKELY §6.2 awards.
import { describe, expect, it } from "vitest";
import { computeAwards } from "../../../src/games/likely/engine/awards";
import type { LikelyTally } from "../../../src/games/likely/engine/result";
import type { LikelyDelta } from "../../../src/games/likely/engine/state";
import { ids } from "./helpers";

const card = (votesCast: number, counts: [string, number][], topIds: string[]): LikelyTally =>
  ({ votesCast, counts: counts.map(([playerId, count]) => ({ playerId, count })), topIds, unanimous: false, chaos: false });
const none = new Set<string>();

describe("awards (§6.2)", () => {
  const p = ids(4);
  it("signature = highest vote share; tie → the later card; never top → Mystery", () => {
    const results = [
      card(4, [["p1", 3], ["p2", 1]], ["p1"]),        // p1 75 %
      card(4, [["p1", 2], ["p3", 2]], ["p1", "p3"]),  // p1 50 %, p3 50 %
      card(2, [["p3", 1], ["p2", 1]], ["p2", "p3"]),  // p3 50 % (later: wins the tie), p2 50 %
    ];
    expect(computeAwards(p, results, false, [], {}, none)).toEqual([
      { kind: "signature", playerIds: ["p1"], cardIndex: 0, value: null },
      { kind: "signature", playerIds: ["p2"], cardIndex: 2, value: null },
      { kind: "signature", playerIds: ["p3"], cardIndex: 2, value: null },
      { kind: "mystery", playerIds: ["p4"], cardIndex: null, value: null },
    ]);
  });
  it("vote share is compared exactly (2/3 beats 3/5)", () => {
    expect(computeAwards(["p1"], [card(3, [["p1", 2]], ["p1"]), card(5, [["p1", 3]], ["p1"])], false, [], {}, none)[0]).toMatchObject({ kind: "signature", cardIndex: 0 });
  });
  it("Tonight's Star: most cards topped, ≥ 3, ties share", () => {
    const two = [0, 1].map(() => card(3, [["p1", 2]], ["p1"]));
    expect(computeAwards(p, two, false, [], {}, none).some((x) => x.kind === "star")).toBe(false);
    const three = [0, 1, 2].map(() => card(3, [["p1", 1], ["p2", 1]], ["p1", "p2"]));
    expect(computeAwards(p, three, false, [], {}, none).find((x) => x.kind === "star")).toEqual({ kind: "star", playerIds: ["p1", "p2"], cardIndex: null, value: 3 });
  });
  it("Self-aware (≥ 2) and Mind Reader exist in public mode only", () => {
    const self: LikelyDelta = { playerId: "p2", points: 100, reason: "selfAware" };
    const deltas = [[self], [self]];
    const scores = { p1: 300, p2: 500, p3: 500, p4: 0 };
    const pub = computeAwards(p, [], true, deltas, scores, none);
    expect(pub.find((x) => x.kind === "selfAware")).toEqual({ kind: "selfAware", playerIds: ["p2"], cardIndex: null, value: 2 });
    expect(pub.find((x) => x.kind === "mindReader")).toEqual({ kind: "mindReader", playerIds: ["p2", "p3"], cardIndex: null, value: 500 });
    const anon = computeAwards(p, [], false, deltas, scores, none);
    expect(anon.some((x) => x.kind === "selfAware" || x.kind === "mindReader")).toBe(false);
    expect(computeAwards(p, [], true, [[self]], scores, none).some((x) => x.kind === "selfAware")).toBe(false);
  });
  it("no Mind Reader when nobody scored", () => {
    expect(computeAwards(p, [], true, [], {}, none).some((x) => x.kind === "mindReader")).toBe(false);
  });
  it("left players keep their (greyed) signature card but get no extra award", () => {
    const three = [0, 1, 2].map(() => card(3, [["p1", 3]], ["p1"]));
    const a = computeAwards(p, three, true, [], { p1: 900 }, new Set(["p1"]));
    expect(a[0]).toMatchObject({ kind: "signature", playerIds: ["p1"], cardIndex: 2 });
    expect(a.some((x) => x.kind === "star" || x.kind === "mindReader")).toBe(false);
  });
  it("signature, Mystery and Star depend on tallies only (identical whatever the ballots)", () => {
    const t = [card(3, [["p1", 2], ["p2", 1]], ["p1"])];
    expect(computeAwards(p, t, false, [], {}, none)).toEqual(computeAwards(p, t, false, [[{ playerId: "p3", points: 100, reason: "selfAware" }]], { p3: 900 }, none));
  });
});
