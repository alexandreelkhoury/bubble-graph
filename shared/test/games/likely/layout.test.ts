// GAME-LIKELY §12.2 / §12.7 layout math: one centred row, vote stacks under their targets that never leave the stage
// and never overlap a neighbour's stack (owner redesign 2026-11-12).
import { describe, expect, it } from "vitest";
import {
  LIKELY_STAGE, likelyPublicTokens, likelyRow, likelyRowStep, likelySecretTokens, likelyStackGrid, likelyStackSlot,
} from "../../../src/games/likely/layout";
import type { LikelyPt } from "../../../src/games/likely/layout";

const S = LIKELY_STAGE;

describe("the player row (§12.7)", () => {
  it("is centred, inside the stage, mirrored in RTL, flat in the reveal", () => {
    for (let n = 1; n <= 12; n++) {
      const ltr = likelyRow(n);
      const rtl = likelyRow(n, true);
      const rev = likelyRow(n, false, true);
      const mean = ltr.reduce((m, p) => m + p.x, 0) / n;
      expect(Math.abs(mean - S.width / 2)).toBeLessThan(0.2);
      for (let i = 0; i < n; i++) {
        const p = ltr[i] as LikelyPt;
        expect(p.x - S.charSize / 2).toBeGreaterThanOrEqual(0);
        expect(p.x + S.charSize / 2).toBeLessThanOrEqual(S.width);
        expect(Math.abs((rtl[i] as LikelyPt).x - (S.width - p.x))).toBeLessThan(0.11);
        expect((rev[i] as LikelyPt).y).toBe(S.revealRowY);
      }
    }
  });
  it("leaves room for every character: neighbours at least a reveal character apart", () => {
    for (let n = 2; n <= 12; n++) expect(likelyRowStep(n)).toBeGreaterThanOrEqual(S.revealChar);
  });
});

describe("vote stacks (§12.2)", () => {
  it("every token of every stack size stays inside the stage and inside its target's column (n = 3..12)", () => {
    for (let n = 3; n <= 12; n++) {
      const step = likelyRowStep(n);
      for (let m = 1; m <= n; m++) {
        const g = likelyStackGrid(n, m);
        expect(g.cell).toBeGreaterThanOrEqual(S.cellMin);
        for (const rtl of [false, true]) for (const target of likelyRow(n, rtl, true)) {
          for (let k = 0; k < m; k++) {
            const p = likelyStackSlot(target, k, m, g, rtl);
            expect(p.y - g.cell / 2, `n=${n} m=${m}`).toBeGreaterThanOrEqual(S.stackTop - 0.05);
            expect(p.y + g.cell / 2, `n=${n} m=${m}`).toBeLessThanOrEqual(S.stackBottom + 0.05);
            expect(p.x - g.cell / 2).toBeGreaterThanOrEqual(-0.05);
            expect(p.x + g.cell / 2).toBeLessThanOrEqual(S.width + 0.05);
            // Inside the column: a neighbour's stack never touches this one.
            expect(Math.abs(p.x - target.x) + g.cell / 2, `n=${n} m=${m} k=${k}`).toBeLessThanOrEqual(step / 2 + 0.05);
          }
        }
      }
    }
  });
  it("public tokens: one per ballot in ballot order, self-votes included, never two on one spot", () => {
    const ids = ["a", "b", "c", "d"];
    const ballots = [{ voterId: "a", targetId: "c" }, { voterId: "b", targetId: "c" }, { voterId: "c", targetId: "c" }, { voterId: "d", targetId: "a" }];
    const t = likelyPublicTokens(likelyRow(4, false, true), ids, ballots);
    expect(t.map((x) => [x.voterId, x.targetId, x.k])).toEqual([["a", "c", 0], ["b", "c", 1], ["c", "c", 2], ["d", "a", 0]]);
    expect(new Set(t.map((x) => `${x.at.x},${x.at.y}`)).size).toBe(4);
  });
  it("secret tokens depend on the tally only and grow side by side (round-robin)", () => {
    const ids = ["a", "b", "c"];
    const t = likelySecretTokens(likelyRow(3, false, true), ids, [{ playerId: "c", count: 2 }, { playerId: "a", count: 1 }]);
    expect(t.map((x) => [x.voterId, x.targetId, x.k])).toEqual([[null, "a", 0], [null, "c", 0], [null, "c", 1]]);
  });
});
