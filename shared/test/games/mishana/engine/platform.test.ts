// JAMAA-PLATFORM §2.7: the three engine additions (syncHost, seedScores, extendFirstDeadline).
import { describe, expect, it } from "vitest";
import { extendFirstDeadline, seedScores, syncHost } from "../../../../src/games/mishana/engine/platform";
import { assertInvariants } from "../../../../src/games/mishana/engine/invariants";
import { lobby, pid, P } from "../../../../src/testing";
import { reduce } from "../../../../src/games/mishana/engine/reduce";
import { TEST_FREE_CATALOG } from "../../../../src/testing";

describe("syncHost", () => {
  it("sets the host, marks externalHost, and returns the same object when already in sync", () => {
    const g = lobby(4);
    const s = syncHost(g.state, pid(2));
    expect(s.hostPlayerId).toBe(pid(2));
    expect(s.externalHost).toBe(true);
    expect(s.version).toBe(g.state.version + 1);
    expect(syncHost(s, pid(2))).toBe(s);
    expect(g.state.externalHost).toBeUndefined();
  });
  it("maps an id that is not a live player to null", () => {
    const g = lobby(3);
    expect(syncHost(g.state, "p_ffffffffffffffffffffffff").hostPlayerId).toBeNull();
    expect(syncHost(g.state, null).hostPlayerId).toBeNull();
  });
  it("bypasses reassignHost: a leaving external host leaves the engine host null (the room re-syncs)", () => {
    const g = lobby(4);
    g.tv({ type: "START" });
    const s = syncHost(g.state, pid(1));
    const r = reduce(s, { type: "LEAVE", by: P(pid(1)) }, { now: g.now + 1, catalog: TEST_FREE_CATALOG });
    expect(r.ok).toBe(true);
    expect(r.state.hostPlayerId).toBeNull();
    assertInvariants(r.state);
    // Engine-only states keep the old behaviour.
    const r2 = reduce(g.state, { type: "LEAVE", by: P(g.state.hostPlayerId as string) }, { now: g.now + 1, catalog: TEST_FREE_CATALOG });
    expect(r2.state.hostPlayerId).not.toBeNull();
  });
});

describe("seedScores", () => {
  it("sets listed scores and returns the same object when nothing changes", () => {
    const g = lobby(3);
    const s = seedScores(g.state, { [pid(0)]: 12, [pid(1)]: 0 });
    expect(s.players.map((p) => p.score)).toEqual([12, 0, 0]);
    expect(seedScores(s, { [pid(0)]: 12 })).toBe(s);
    expect(seedScores(s, {})).toBe(s);
  });
});

describe("extendFirstDeadline", () => {
  it("adds ms to deadline.at and keeps durationMs; no-op without a deadline or for ms <= 0", () => {
    const g = lobby(3);
    expect(extendFirstDeadline(g.state, 2500)).toBe(g.state);
    g.tv({ type: "START" });
    const d = g.state.deadline;
    if (!d) throw new Error("deadline");
    const s = extendFirstDeadline(g.state, 2500);
    expect(s.deadline).toEqual({ ...d, at: d.at + 2500 });
    expect(extendFirstDeadline(g.state, 0)).toBe(g.state);
    assertInvariants(s);
  });
});
