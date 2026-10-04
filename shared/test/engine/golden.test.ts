import { describe, expect, it } from "vitest";
import { playGame, TEST_FREE_CATALOG } from "../../src/testing";

const CASES: [number, number, string][] = [
  [3, 101, "official"],
  [5, 202, "official"],
  [8, 303, "parity"],
  [12, 404, "official"],
];

describe("golden seeded games", () => {
  it.each(CASES)("n=%i seed=%i %s", { timeout: 120_000 }, (n, seed, winRule) => {
    // The free test catalog has exactly the pre-billing English pool, so the snapshots stay unchanged.
    const out = playGame(TEST_FREE_CATALOG, {
      players: n,
      seed,
      // Pinned to the original driver mix so the snapshots stay a pure engine regression check.
      leaveRate: 0,
      vipRate: 0,
      settings: { winRule: winRule as "official" | "parity" },
    });
    expect(out.failure).toBeNull();
    expect({
      final: out.final,
      winner: out.winner,
      stalemate: out.stalemate,
      actions: out.log.map((s) => ({ ...s.action, now: s.now, ok: s.ok, error: s.error })),
    }).toMatchSnapshot();
  });
});
