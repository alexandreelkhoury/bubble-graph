// JAMAA-PLATFORM §2.8 "golden snapshot of one seeded game" (GAME-LIKELY): the whole action log and the final state of
// seeded bot games stay byte-stable, so any change to the draw, the scoring or the transitions shows up in review.
import { describe, expect, it } from "vitest";
import { definition } from "../../../src/games/likely/definition";
import { playLikelyGame } from "../../../src/testing/bots/likely";

const CASES: [players: number, seed: number, showVoters: boolean][] = [
  [3, 101, true],
  [6, 202, false],
  [12, 303, true],
];

describe("golden seeded games", () => {
  it.each(CASES)("n=%i seed=%i showVoters=%s", (players, seed, showVoters) => {
    const out = playLikelyGame({ players, seed, settings: { showVoters, length: "short" }, pace: "clock" });
    expect(out.failure).toBeNull();
    const final = out.final;
    if (!final) throw new Error("no final state");
    expect({
      outcome: definition.outcome(final),
      memory: definition.memory(final),
      final,
      steps: out.steps.map((s) => ({ ...s.action, now: s.now, ok: s.ok, error: s.error })),
    }).toMatchSnapshot();
  });
});
