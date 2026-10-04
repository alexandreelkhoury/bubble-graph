import { describe, expect, it } from "vitest";
import { findLeaks, makeTokenCatalog, playGame } from "../../src/testing";

const catalog = makeTokenCatalog(40);
const BATCHES = Array.from({ length: 10 }, (_, i) => [i * 100 + 1, i * 100 + 100] as const);

describe("secret-leak property (§5.4): 1,000 seeded games with a synthetic token catalog", () => {
  it.each(BATCHES)("seeds %i..%i", { timeout: 120_000 }, (from, to) => {
    let steps = 0;
    for (let seed = from; seed <= to; seed++) {
      const n = 3 + (seed % 10);
      const out = playGame(
        catalog,
        { players: n, seed, correctGuessRate: 0.3, settings: { revealRoles: seed % 7 === 0, blankGuess: true } },
        (_prev, action, res) => {
          steps++;
          const leaks = findLeaks(res.state, catalog);
          if (leaks.length) throw new Error(`seed ${seed} after ${action.type}: ${leaks.slice(0, 3).join("; ")}`);
        },
      );
      expect(out.failure).toBeNull();
    }
    expect(steps).toBeGreaterThan(1000);
  });

  it("the checker catches leaks (self-test)", () => {
    const out = playGame(catalog, { players: 5, seed: 3 });
    // Find a mid-game state and plant a leak in a copy of it.
    let found = false;
    playGame(catalog, { players: 5, seed: 3 }, (_p, _a, res) => {
      if (found || res.state.phase !== "CLUES") return;
      found = true;
      const s = structuredClone(res.state);
      expect(findLeaks(s, catalog)).toEqual([]);
      const civ = s.players.find((p) => p.role === "CIVILIAN");
      if (civ && s.pair) civ.name = s.pair.undercover.text; // a secret word in a public field
      expect(findLeaks(s, catalog).length).toBeGreaterThan(0);
      // A guess text in state is stripped by the projection before RESULTS.
      const s2 = structuredClone(res.state);
      s2.guessLog.push({ playerId: s2.players[0]!.id, status: "WRONG", text: "zzsecretguess", overridden: false });
      s2.players[1]!.name = "zzsecretguess";
      expect(findLeaks(s2, catalog).some((e) => e.includes("secret"))).toBe(true);
    });
    expect(found).toBe(true);
    expect(out.failure).toBeNull();
  });
});
