import { describe, expect, it } from "vitest";
import { createArrivals, isFresh, noteArrivals } from "../src/lib/arrivals";

describe("lobby arrivals", () => {
  it("animates only players who join after the first look, and rings the newest", () => {
    const a = createArrivals();
    noteArrivals(a, "ABCD", 0, [], 0);
    noteArrivals(a, "ABCD", 0, ["p1"], 100);
    expect(isFresh(a, "p1", 200)).toBe(true);
    expect(isFresh(a, "p1", 900)).toBe(false);
    expect(a.newest).toBe("p1");
    noteArrivals(a, "ABCD", 0, ["p1", "p2"], 1000);
    expect(a.newest).toBe("p2");
    expect(isFresh(a, "p1", 1000)).toBe(false);
  });
  it("a remount or a new game never re-animates; a new game clears the ring", () => {
    const a = createArrivals();
    noteArrivals(a, "ABCD", 0, [], 0);
    noteArrivals(a, "ABCD", 0, ["p1", "p2"], 10);
    noteArrivals(a, "ABCD", 1, ["p1", "p2"], 5000);
    expect(a.newest).toBeNull();
    expect(isFresh(a, "p1", 5000)).toBe(false);
  });
  it("a first look at a room with players (reload) marks them as already there", () => {
    const a = createArrivals();
    noteArrivals(a, "WXYZ", 0, ["p1", "p2"], 0);
    expect(isFresh(a, "p1", 0)).toBe(false);
    expect(a.newest).toBeNull();
  });
  it("the ring goes when the newest player leaves", () => {
    const a = createArrivals();
    noteArrivals(a, "ABCD", 0, [], 0);
    noteArrivals(a, "ABCD", 0, ["p1", "p2"], 10);
    noteArrivals(a, "ABCD", 0, ["p1"], 20);
    expect(a.newest).toBeNull();
  });
});
