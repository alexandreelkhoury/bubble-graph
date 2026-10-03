import { describe, expect, it } from "vitest";
import { playGame } from "../support/bots";
import { lobby } from "../support/helpers";
import { TEST_CATALOG } from "../support/test-catalog";

describe("starter selection (§4.7 startRound)", () => {
  it("round-1 starter is never BLANK; round>1 starter is the next alive seat after the previous starter", () => {
    let checkedR1 = 0;
    let checkedNext = 0;
    for (let n = 5; n <= 12; n++) {
      for (let seed = 1; seed <= 40; seed++) {
        playGame(TEST_CATALOG, { players: n, seed, churnRate: 0.02, kickRate: 0.01 }, (prev, _a, res) => {
          const s = res.state;
          const entered = s.phase === "CLUES" && (prev.phase !== "CLUES" || prev.round !== s.round);
          if (!entered) return;
          const starter = s.players.find((p) => p.id === s.starterId);
          expect(starter).toBeDefined();
          if (s.round === 1) {
            expect(starter?.role).not.toBe("BLANK");
            checkedR1++;
          } else {
            const prevStarter = prev.players.find((p) => p.id === prev.starterId);
            const alive = s.players.filter((p) => p.alive);
            const expected = alive.find((p) => p.seat > (prevStarter?.seat ?? -1)) ?? alive[0];
            expect(s.starterId).toBe(expected?.id);
            expect(s.speakingOrder[0]).toBe(s.starterId);
            checkedNext++;
          }
        });
      }
    }
    expect(checkedR1).toBeGreaterThan(200);
    expect(checkedNext).toBeGreaterThan(200);
  });

  it("SPEC-GAP: the round-1 starter is a connected non-Blank, so the Blank never actually speaks first", () => {
    let hits = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const g = lobby(5, undefined, seed);
      g.tv({ type: "START" });
      const blank = g.get(g.byRole("BLANK")[0] as string);
      const n = g.state.players.length;
      const before = g.state.players.find((p) => p.seat === (blank.seat + n - 1) % n);
      if (!before) continue;
      g.sys({ type: "DISCONNECT", playerId: before.id });
      g.readyAll();
      expect(g.state.phase).toBe("CLUES");
      const s = g.state;
      const first = s.players.find((p) => p.id === s.speakingOrder[s.turnIdx]);
      expect(first?.role).not.toBe("BLANK");
      expect(s.starterId).not.toBe(before.id);
      expect(s.players.find((p) => p.id === s.starterId)?.connected).toBe(true);
      hits++;
    }
    expect(hits).toBeGreaterThan(300);
  });
});

