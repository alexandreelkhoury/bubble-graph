// GAME-LIKELY §12.7 layout math: the conga lines stay on the stage and neighbouring lines fan out (G3 review).
import { describe, expect, it } from "vitest";
import {
  LIKELY_CONGA_MAX_X, LIKELY_CONGA_MIN_X, LIKELY_STAGE, likelyConga, likelyCongaSide, likelyCongaSides, likelyJuryArc, likelyRevealPositions,
} from "../../../src/games/likely/layout";
import type { LikelyPt } from "../../../src/games/likely/layout";

const S = LIKELY_STAGE;
const inside = (p: LikelyPt): boolean =>
  p.x >= LIKELY_CONGA_MIN_X && p.x <= LIKELY_CONGA_MAX_X && p.y - S.charSize >= 0 && p.y <= S.height;

describe("conga lines (§12.7)", () => {
  it("every place stays inside the safe area for n = 3..12, every seat, every line length, LTR and RTL", () => {
    for (let n = 3; n <= 12; n++) for (const rtl of [false, true]) {
      const arc = likelyJuryArc(n, rtl);
      for (const target of arc) for (let count = 1; count < n; count++) {
        for (const p of likelyConga(target, count)) expect(inside(p), `n=${n} rtl=${rtl} target=${target.x} count=${count} → ${p.x},${p.y}`).toBe(true);
      }
    }
  });
  it("an outer seat lines up toward the centre when the outward side would leave the stage", () => {
    const arc = likelyJuryArc(12);
    const outer = arc[0] as LikelyPt;
    expect(likelyCongaSide(outer, 1)).toBe(1);   // outward (-1) does not fit even one runner
    const mid = arc[3] as LikelyPt;
    expect(likelyCongaSide(mid, 1)).toBe(-1);    // outward fits
    expect(likelyCongaSide(arc[11] as LikelyPt, 6)).toBe(-1);
  });
  it("runners do not hide each other: consecutive places are ≥ 44 dp apart sideways", () => {
    expect(S.congaDx).toBeGreaterThanOrEqual(44);
    const line = likelyConga(likelyJuryArc(12)[5] as LikelyPt, 6);
    for (let k = 1; k < line.length; k++) expect(Math.abs((line[k] as LikelyPt).x - (line[k - 1] as LikelyPt).x)).toBeGreaterThanOrEqual(44);
  });
  it("two neighbouring top targets (a tie) send their lines apart instead of crossing", () => {
    for (let n = 4; n <= 12; n++) {
      const arc = likelyJuryArc(n);
      for (let i = 1; i < n - 2; i++) {
        const at = new Map([["a", arc[i] as LikelyPt], ["b", arc[i + 1] as LikelyPt]]);
        const sides = likelyCongaSides(new Map([["a", 2], ["b", 2]]), at);
        const roomLeft = (arc[i] as LikelyPt).x - 2 * S.congaDx >= LIKELY_CONGA_MIN_X;
        const roomRight = (arc[i + 1] as LikelyPt).x + 2 * S.congaDx <= LIKELY_CONGA_MAX_X;
        // Apart wherever the stage allows it; at the very edge the outer line has to run inward (and the next one too).
        expect([sides.get("a"), sides.get("b")], `n=${n} i=${i}`).toEqual([roomLeft ? -1 : 1, roomRight ? 1 : -1]);
      }
    }
  });
  it("reveal positions: every runner inside the stage; tied lines never share a place (n = 3..12, all seats)", () => {
    for (let n = 3; n <= 12; n++) {
      const arc = likelyJuryArc(n);
      const ids = arc.map((_, i) => `p${i}`);
      for (let t = 0; t < n; t++) {
        // Everyone else on seat t (a unanimous-ish line), then a two-way tie with seat t+1.
        const one = ids.filter((id) => id !== ids[t]).map((voterId) => ({ voterId, targetId: ids[t] as string }));
        const tie = ids.map((voterId, i) => ({ voterId, targetId: ids[i % 2 === 0 ? t : (t + 1) % n] as string })).filter((b) => b.voterId !== b.targetId);
        for (const ballots of [one, tie]) {
          const pos = likelyRevealPositions(arc, ids, ballots);
          const seen = new Set<string>();
          for (const p of Object.values(pos)) {
            expect(inside(p), `n=${n} t=${t} ${p.x},${p.y}`).toBe(true);
            const key = `${p.x},${p.y}`;
            expect(seen.has(key), `n=${n} t=${t} duplicate place ${key}`).toBe(false);
            seen.add(key);
          }
        }
      }
    }
  });
});
