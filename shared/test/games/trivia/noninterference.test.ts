// GAME-TRIVIA §13.3 invariant 1 as NON-INTERFERENCE, not only structure. leakCheck/secretsFor/forbidden keys catch a
// secret that appears as a value; they cannot catch one ENCODED in another value (isFinal, a deadline, the score order,
// an option's whitespace). So: at every pre-reveal step of many seeded games, change only a secret and require every
// projection a non-owner receives to be deep-equal.
//   s'  = s with the shown question's correctIndex (and its explanation) changed      → TV and every phone unchanged
//   s'' = s with player x's pending answer (choice and time) changed, during ANSWER   → TV and every phone but x unchanged
import { describe, expect, it } from "vitest";
import { definition as DEF } from "../../../src/games/trivia/definition";
import type { TriviaPhase } from "../../../src/games/trivia/meta";
import type { TriviaState } from "../../../src/games/trivia/engine/types";
import { playTrivia, type TriviaBotOptions } from "../../../src/testing/bots/trivia";
import { TRIVIA_SYNTH_CATALOG as CAT } from "../../../src/testing/catalogs/trivia";

const PRE_REVEAL: readonly TriviaPhase[] = ["QUIZ_INTRO", "READ", "ANSWER", "HOLD", "FINAL_INTRO"];

/** Everything the room sends about the game: the shared public part, the status, and each player's own part. */
function seen(s: TriviaState, except: string | null = null): unknown {
  const me: Record<string, unknown> = {};
  for (const p of s.players) if (p.id !== except) me[p.id] = DEF.projectMe(s, p.id, CAT);
  return { pub: DEF.projectPublic(s, CAT), status: DEF.projectStatus(s), me };
}

function withOtherAnswer(s: TriviaState): TriviaState | null {
  if (!s.cur) return null;
  const d = structuredClone(s);
  d.cur!.correctIndex = (s.cur.correctIndex + 1) % s.cur.options.length;
  d.cur!.explain = s.cur.explain === null ? "another explanation" : `${s.cur.explain} (edited)`;
  return d;
}

function withOtherPick(s: TriviaState, x: string): TriviaState {
  const d = structuredClone(s);
  const a = d.answers[x]!;
  a.choice = (a.choice + 1) % s.cur!.options.length;
  a.timeMs += 1;
  return d;
}

function collect(o: TriviaBotOptions): TriviaState[] {
  const out: TriviaState[] = [];
  const run = playTrivia({ ...o, leaks: false }, (_prev, _step, next) => { if (PRE_REVEAL.includes(next.phase)) out.push(next); });
  if (run.failure) throw new Error(run.failure);
  return out;
}

const RUNS: TriviaBotOptions[] = [];
for (let seed = 1; seed <= 24; seed++) {
  RUNS.push({
    players: 1 + (seed % 12), seed, content: CAT,
    settings: { length: (["short", "normal", "long"] as const)[seed % 3], pace: (["relaxed", "normal", "fast"] as const)[(seed >> 1) % 3] },
    awayRate: seed % 4 === 0 ? 0.2 : 0.03, joinRate: 0.02, voidRate: 0.1, noiseRate: 0.05, advanceRate: seed % 2 ? 0.3 : 0,
  });
}

describe("trivia non-interference (§13.3 invariant 1)", () => {
  it("the right answer of the shown question changes nothing any viewer receives before REVEAL", () => {
    const phases = new Set<string>();
    let checked = 0;
    for (const o of RUNS) {
      for (const s of collect(o)) {
        const s1 = withOtherAnswer(s);
        if (!s1) continue;
        expect(seen(s1), `seed ${o.seed} ${s.phase}#${s.index}`).toEqual(seen(s));
        phases.add(s.phase);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(500);
    for (const p of ["READ", "ANSWER", "FINAL_INTRO"]) expect(phases.has(p), p).toBe(true);
  }, 120_000);

  it("a player's pending pick changes nothing the TV or the other phones receive before REVEAL", () => {
    let checked = 0;
    for (const o of RUNS) {
      for (const s of collect(o)) {
        if (s.phase !== "ANSWER") continue;
        for (const x of Object.keys(s.answers)) {
          const s2 = withOtherPick(s, x);
          expect(seen(s2, x), `seed ${o.seed} ANSWER#${s.index} x=${x}`).toEqual(seen(s, x));
          // The owner does see the change (so the mutation is real).
          expect(DEF.projectMe(s2, x, CAT)).not.toEqual(DEF.projectMe(s, x, CAT));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  }, 120_000);
});
