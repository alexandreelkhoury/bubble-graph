import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { effectiveRoleCounts } from "../../src/engine/roles";
import type { SettingsPatch } from "../../src/engine/types";
import { playGame } from "../support/bots";
import { TEST_CATALOG } from "../support/test-catalog";

const settingsArb: fc.Arbitrary<SettingsPatch> = fc.record({
  winRule: fc.constantFrom("official" as const, "parity" as const),
  tieBreak: fc.constantFrom("random" as const, "none" as const),
  revealRoles: fc.boolean(),
  blankGuess: fc.boolean(),
  swapSides: fc.boolean(),
  clueSeconds: fc.constantFrom(0, 10, 45),
  voteSeconds: fc.constantFrom(0, 15, 90),
  revealSeconds: fc.constantFrom(0, 10, 30),
  guessSeconds: fc.constantFrom(0, 10, 45),
  difficulties: fc.constantFrom([1, 2, 3] as (1 | 2 | 3)[], [1] as (1 | 2 | 3)[], [2, 3] as (1 | 2 | 3)[]),
});

describe("engine properties (fast-check)", () => {
  it("random games terminate, invariants hold after every step, role counts are respected", { timeout: 120_000 }, () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 12 }),
        fc.integer({ min: 0, max: 0xffffffff }),
        settingsArb,
        fc.constantFrom(0, 0.05, 0.2),
        fc.constantFrom(0, 0.02, 0.1),
        (n, seed, settings, noiseRate, churnRate) => {
          let checkedStart = false;
          const out = playGame(TEST_CATALOG, { players: n, seed, settings, noiseRate, churnRate, kickRate: 0.01 }, (prev, action, res) => {
            if (action.type === "START" && res.ok) {
              const counts = { civilian: 0, undercover: 0, blank: 0 };
              for (const p of res.state.players) counts[p.role === "CIVILIAN" ? "civilian" : p.role === "UNDERCOVER" ? "undercover" : "blank"]++;
              expect(counts).toEqual(effectiveRoleCounts(prev.settings, prev.players.length));
              checkedStart = true;
            }
          });
          expect(out.failure).toBeNull();
          expect(checkedStart).toBe(true);
          expect(out.log.length).toBeLessThanOrEqual(5000);
          expect(out.rounds).toBeLessThanOrEqual(60);
          expect(["LOBBY"]).toContain(out.final.phase); // RESULTS → PLAY_AGAIN, or stalemate → LOBBY
        },
      ),
      { numRuns: 300, seed: 20261003 },
    );
  });

  it("determinism: same seed + same actions → deep-equal states", { timeout: 120_000 }, () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 12 }), fc.integer({ min: 0, max: 0xffffffff }), settingsArb, (n, seed, settings) => {
        const a = playGame(TEST_CATALOG, { players: n, seed, settings, noiseRate: 0.05 });
        const b = playGame(TEST_CATALOG, { players: n, seed, settings, noiseRate: 0.05 });
        expect(b.final).toEqual(a.final);
        expect(b.log).toEqual(a.log);
      }),
      { numRuns: 60, seed: 7 },
    );
  });
});
