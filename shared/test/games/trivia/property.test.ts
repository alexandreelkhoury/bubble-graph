// JAMAA-PLATFORM §2.8 (each game) and GAME-TRIVIA §13.3 / §13.4: property tests over 1–12 players with the host
// skipping or not ("timers on/off"), random AWAY/BACK/GONE events, late joins and noise intents: termination, the
// invariants after every reduce, the scoring invariants (checkTriviaStep), determinism, and no leak in any phase for
// the TV and every phone. Plus a golden snapshot of one seeded game.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { definition as DEF } from "../../../src/games/trivia/definition";
import { playTrivia, type TriviaBotOptions } from "../../../src/testing/bots/trivia";
import { TRIVIA_SYNTH_CATALOG } from "../../../src/testing/catalogs/trivia";

const arbOptions = fc.record({
  players: fc.integer({ min: 1, max: 12 }),
  seed: fc.integer({ min: 0, max: 0x7fffffff }),
  settings: fc.record({
    length: fc.constantFrom("short" as const, "normal" as const, "long" as const),
    pace: fc.constantFrom("relaxed" as const, "normal" as const, "fast" as const),
    quizId: fc.constantFrom(null, "syn-quiz"),
  }),
  locale: fc.constantFrom("en" as const, "fr" as const, "ar" as const, "es" as const),
  advanceRate: fc.constantFrom(0, 0.3, 1),       // never / sometimes / always skip what the host may skip
  awayRate: fc.constantFrom(0, 0.03, 0.2),
  goneRate: fc.constantFrom(0, 0.01),
  joinRate: fc.constantFrom(0, 0.02),
  voidRate: fc.constantFrom(0, 0.2),
  noiseRate: fc.constantFrom(0, 0.1),
  maxLatencyMs: fc.constantFrom(500, 18_000, 40_000),
});

describe("trivia properties", () => {
  it("every game terminates in RESULTS with the invariants, scoring checks and leak oracles green at every step", () => {
    fc.assert(
      fc.property(arbOptions, (o) => {
        const run = playTrivia({ ...o, content: TRIVIA_SYNTH_CATALOG });
        if (run.failure) throw new Error(`${run.failure} (${JSON.stringify(o)})`);
        expect(run.final.phase).toBe("RESULTS");
        const out = DEF.outcome(run.final)!;
        // Outcome: left and 0-point players never ranked; points are this instance's scores.
        for (const p of run.final.players) expect(out.points[p.id]).toBe(p.left ? 0 : p.score);
        for (const id of out.ranking.flat()) expect(out.points[id]).toBeGreaterThan(0);
        // Memory never exceeds the platform cap and only holds shown questions of this family.
        expect(DEF.memory(run.final).usedKeys.length).toBeLessThanOrEqual(300);
      }),
      { numRuns: 300 },
    );
  }, 180_000);

  it("determinism: the same seed and options give a JSON-equal game, step by step", () => {
    fc.assert(
      fc.property(arbOptions, (o) => {
        const a = playTrivia({ ...o, content: TRIVIA_SYNTH_CATALOG, leaks: false });
        const b = playTrivia({ ...o, content: TRIVIA_SYNTH_CATALOG, leaks: false });
        expect(JSON.stringify(b.steps)).toBe(JSON.stringify(a.steps));
        expect(JSON.stringify(b.final)).toBe(JSON.stringify(a.final));
      }),
      { numRuns: 60 },
    );
  }, 120_000);

  it("score conservation: each reveal's points equal the score deltas, voids restore exactly, no negative scores", () => {
    // checkTriviaStep runs inside playTrivia on every step; this pins a hostile configuration on many seeds.
    for (let seed = 1; seed <= 60; seed++) {
      const o: TriviaBotOptions = { players: 1 + (seed % 12), seed, content: TRIVIA_SYNTH_CATALOG, voidRate: 0.5, awayRate: 0.1, goneRate: 0.02, joinRate: 0.05, noiseRate: 0.3 };
      const run = playTrivia(o);
      expect(run.failure, `seed ${seed}`).toBeNull();
      for (const p of run.final.players) expect(p.score).toBeGreaterThanOrEqual(0);
    }
  }, 120_000);
});

describe("golden game", () => {
  it("seed 2026, 5 players, normal: the same phases, questions and final scores", () => {
    const run = playTrivia({ players: 5, seed: 2026, content: TRIVIA_SYNTH_CATALOG, awayRate: 0.02, goneRate: 0, joinRate: 0, voidRate: 0.05, noiseRate: 0 });
    expect(run.failure).toBeNull();
    const s = run.final;
    const golden = {
      questions: s.questionIds,
      scores: s.players.map((p) => [p.id, p.score, p.correct, p.bestStreak, p.fastest]),
      ranking: DEF.outcome(s)!.ranking,
      voided: s.voidedQuestionIds,
      steps: run.steps.length,
    };
    expect(golden).toMatchSnapshot();
  });
});
