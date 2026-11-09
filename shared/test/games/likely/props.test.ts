// JAMAA-PLATFORM §2.8 game properties over 3–12 players: termination, invariants after every reduce, determinism, no leak
// in any phase (TV and every phone), scores never go down, family never deals Spicy, a failed reduce returns its input.
// Two paces ("clock": phases end at their deadline; "eager": the host advances and everyone votes at once) stand in for
// timers on and off (Likely has no timer setting), with random AWAY/BACK/GONE events, late joins, skips and noise.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { resultTally } from "../../../src/games/likely/engine/reduce";
import { playLikelyGame } from "../../../src/testing/bots/likely";
import { likelyFreeCatalog } from "../../../src/testing/catalogs/likely";
import { DEF } from "./helpers";

const RUNS = Number(process.env.FC_RUNS ?? 200);

describe("random games (§2.8)", () => {
  it("terminate, keep every invariant, never leak, and are deterministic", { timeout: 600_000 }, () => {
    let named = 0;
    let unanimous = 0;
    let chaos = 0;
    let holds = 0;
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 2 ** 31 }), fc.integer({ min: 3, max: 12 }),
      fc.constantFrom<"short" | "normal" | "long">("short", "normal", "long"), fc.boolean(), fc.constantFrom<"family" | "spicy">("family", "spicy"),
      fc.constantFrom<"clock" | "eager">("clock", "eager"), fc.constantFrom<"en" | "fr" | "ar" | "es">("en", "fr", "ar", "es"), fc.integer({ min: 0, max: 2 }),
      (seed, n, length, showVoters, mode, pace, locale, away) => {
        const run = () => playLikelyGame({ players: n, seed, settings: { length, showVoters, mode }, spicy: true, pace, locale, disconnectedAtStart: Math.min(away, n - 3) }, (prev, _a, res) => {
          if (res.state.phase === "HOLD" && prev.phase !== "HOLD") holds++;
        });
        const a = run();
        expect(a.failure).toBeNull();
        const s = a.final;
        if (!s) throw new Error("no final state");
        expect(s.phase).toBe("RESULTS");
        const o = DEF.outcome(s);
        if (!o) throw new Error("no outcome");
        if (!showVoters) {
          expect(o.ranking).toEqual([]);
          expect(Object.values(o.points).every((x) => x === 0)).toBe(true);
        }
        for (const p of s.players.filter((x) => x.left)) expect(o.points[p.id]).toBe(0);
        for (const grp of o.ranking) for (const id of grp) expect(o.points[id]).toBeGreaterThan(0);
        expect(DEF.memory(s).usedKeys.length).toBeLessThanOrEqual(300);
        named += s.results.filter((r) => r.named !== null).length;
        for (const r of s.results) {
          const t = resultTally(s, r);
          if (t.unanimous) unanimous++;
          if (t.chaos) chaos++;
        }
        const b = run();
        expect(JSON.stringify(b.final)).toBe(JSON.stringify(a.final));
        expect(b.steps.length).toBe(a.steps.length);
      },
    ), { numRuns: RUNS });
    // The generator really reaches the interesting cases.
    expect(named).toBeGreaterThan(0);
    expect(unanimous).toBeGreaterThan(0);
    expect(chaos).toBeGreaterThan(0);
    expect(holds).toBeGreaterThan(0);
  });

  it("a free room's catalog only ever deals free Family cards", () => {
    const free = likelyFreeCatalog();
    const freeIds = new Set(free.packs.flatMap((p) => p.cards.map((c) => c.id)));
    for (let seed = 1; seed <= 40; seed++) {
      const out = playLikelyGame({ players: 3 + (seed % 10), seed, content: free, settings: { length: "short" } });
      expect(out.failure).toBeNull();
      for (const r of out.final?.results ?? []) expect(freeIds.has(r.cardId)).toBe(true);
    }
  });

  it("the shipped definition (Spicy compiled out) plays family games end to end", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const out = playLikelyGame({ players: 3 + (seed % 10), seed, settings: { showVoters: seed % 2 === 0 } });
      expect(out.failure).toBeNull();
      expect(out.final?.phase).toBe("RESULTS");
    }
  });
});
