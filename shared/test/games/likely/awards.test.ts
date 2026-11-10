// GAME-LIKELY §6.2 awards.
import { describe, expect, it } from "vitest";
import { computeAwards } from "../../../src/games/likely/engine/awards";
import type { LikelyTally } from "../../../src/games/likely/engine/result";
import { RUNNER_UP_VALUE } from "../../../src/games/likely/engine/state";
import type { LikelyDelta } from "../../../src/games/likely/engine/state";
import { LIKELY_RUNNER_UP_VALUE } from "../../../src/games/likely/meta";
import { ids } from "./helpers";

const card = (votesCast: number, counts: [string, number][], topIds: string[]): LikelyTally =>
  ({ votesCast, counts: counts.map(([playerId, count]) => ({ playerId, count })), topIds, unanimous: false, chaos: false });
const none = new Set<string>();

describe("awards (§6.2)", () => {
  const p = ids(4);
  it("signature = highest vote share; tie → the later card; never top → Mystery", () => {
    const results = [
      card(4, [["p1", 3], ["p2", 1]], ["p1"]),        // p1 75 %
      card(4, [["p1", 2], ["p3", 2]], ["p1", "p3"]),  // p1 50 %, p3 50 % (same share, same count, later: p3's pick)
      card(4, [["p3", 2], ["p2", 2]], ["p2", "p3"]),  // p3 50 %, p2 50 %
    ];
    expect(computeAwards(p, results, false, [], {}, none)).toEqual([
      { kind: "signature", playerIds: ["p1"], cardIndex: 0, value: null },
      { kind: "signature", playerIds: ["p2"], cardIndex: 2, value: null },
      { kind: "signature", playerIds: ["p3"], cardIndex: 2, value: null },
      { kind: "mystery", playerIds: ["p4"], cardIndex: null, value: null },
    ]);
  });
  it("equal share → more votes wins before the later card (3 of 3 beats a later 2 of 2)", () => {
    const results = [card(3, [["p1", 3]], ["p1"]), card(2, [["p1", 2]], ["p1"])];
    expect(computeAwards(["p1"], results, false, [], {}, none)[0]).toMatchObject({ kind: "signature", cardIndex: 0, value: null });
    const big = [card(12, [["p1", 6], ["p2", 6]], ["p1", "p2"]), card(6, [["p1", 3], ["p3", 3]], ["p1", "p3"])];
    expect(computeAwards(["p1"], big, false, [], {}, none)[0]).toMatchObject({ cardIndex: 0 });
  });
  it("a card with < 3 votes cast never beats a real majority (1 of 1 = 100 % loses to 5 of 12), unless it is the only top", () => {
    const results = [card(12, [["p1", 5], ["p2", 4], ["p3", 3]], ["p1"]), card(1, [["p1", 1]], ["p1"]), card(2, [["p2", 2]], ["p2"])];
    const a = computeAwards(["p1", "p2"], results, false, [], {}, none);
    expect(a[0]).toMatchObject({ playerIds: ["p1"], cardIndex: 0 });
    expect(a[1]).toMatchObject({ playerIds: ["p2"], cardIndex: 2, value: null });
  });
  it("runner-up: never top but ≥ 2 votes on a card → that card's award as a runner-up signature; else Mystery", () => {
    const results = [
      card(12, [["p1", 6], ["p2", 4], ["p3", 2]], ["p1"]),
      card(12, [["p1", 7], ["p2", 3], ["p3", 1], ["p4", 1]], ["p1"]),
      card(12, [["p1", 8], ["p3", 3], ["p4", 1]], ["p1"]),
    ];
    expect(computeAwards(ids(4), results, false, [], {}, none)).toEqual([
      { kind: "signature", playerIds: ["p1"], cardIndex: 2, value: null },
      { kind: "signature", playerIds: ["p2"], cardIndex: 0, value: RUNNER_UP_VALUE },   // 4/12 beats 3/12
      { kind: "signature", playerIds: ["p3"], cardIndex: 2, value: RUNNER_UP_VALUE },   // 3/12 beats 2/12
      { kind: "mystery", playerIds: ["p4"], cardIndex: null, value: null },             // never 2 votes
      { kind: "star", playerIds: ["p1"], cardIndex: null, value: 3 },
    ]);
    expect(RUNNER_UP_VALUE).toBe(LIKELY_RUNNER_UP_VALUE);
  });
  it("runner-up never comes from a Chaos card", () => {
    const chaos: LikelyTally = { votesCast: 3, counts: [{ playerId: "p1", count: 1 }, { playerId: "p2", count: 1 }, { playerId: "p3", count: 1 }], topIds: [], unanimous: false, chaos: true };
    expect(computeAwards(["p1"], [chaos], false, [], {}, none)[0]).toMatchObject({ kind: "mystery" });
  });
  it("live regression (3 players): a unanimous 3 of 3 beats a later 2 of 2 with one abstention", () => {
    const unanimous: LikelyTally = { votesCast: 3, counts: [{ playerId: "p1", count: 3 }], topIds: ["p1"], unanimous: true, chaos: false };
    expect(computeAwards(["p1"], [unanimous, card(2, [["p1", 2]], ["p1"])], false, [], {}, none)[0]).toMatchObject({ cardIndex: 0 });
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
