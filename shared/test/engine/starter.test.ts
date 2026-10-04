import { describe, expect, it } from "vitest";
import { blankOpensViolation, isOpening, lobby, playGame, TEST_CATALOG } from "../../src/testing";

describe("starter selection (§4.7 startRound)", () => {
  it("the Blank never speaks first: every round and every tie-break opens with a non-Blank", () => {
    const opened = { CLUES: 0, TIE_BREAK: 0, laterRounds: 0 };
    for (let n = 3; n <= 12; n++) {
      for (let seed = 1; seed <= 60; seed++) {
        playGame(TEST_CATALOG, { players: n, seed, churnRate: 0.02, kickRate: 0.01 }, (prev, _a, res) => {
          const s = res.state;
          if (!isOpening(prev, s)) return;
          expect(blankOpensViolation(s)).toBeNull();
          expect(s.speakingOrder[0]).toBe(s.phase === "CLUES" ? s.starterId : s.speakingOrder[0]);
          opened[s.phase as "CLUES" | "TIE_BREAK"]++;
          if (s.phase === "CLUES" && s.round > 1) opened.laterRounds++;
        });
      }
    }
    expect(opened.CLUES).toBeGreaterThan(500);
    expect(opened.laterRounds).toBeGreaterThan(200);
    expect(opened.TIE_BREAK).toBeGreaterThan(0);
  });

  it("blankOpensViolation flags a Blank opener only when a connected non-Blank could have opened", () => {
    const g = lobby(5, { roleMode: "custom", undercoverCount: 1, blankCount: 1 });
    g.tv({ type: "START" });
    g.readyAll();
    const blank = g.byRole("BLANK")[0] as string;
    const forged = { ...g.state, speakingOrder: [blank, ...g.state.speakingOrder.filter((id) => id !== blank)], turnIdx: 0 };
    expect(blankOpensViolation(forged)).toMatch(/the Blank opens CLUES/);
    const alone = { ...forged, players: forged.players.map((p) => (p.id === blank ? p : { ...p, connected: false })) };
    expect(blankOpensViolation(alone)).toBeNull();
  });

  it("later-round openers are drawn at random, not rotated by seat (no seat-skip leak)", () => {
    const starters = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      playGame(TEST_CATALOG, { players: 8, seed }, (prev, _a, res) => {
        const s = res.state;
        if (s.phase === "CLUES" && prev.phase !== "CLUES" && s.round === 2) {
          const a = prev.players.find((p) => p.id === prev.starterId)?.seat ?? -1;
          const b = s.players.find((p) => p.id === s.starterId)?.seat ?? -1;
          starters.add(String((b - a + 8) % 8));
        }
      });
    }
    // A fixed rotation would always give the same seat offset; random draws give many.
    expect(starters.size).toBeGreaterThan(3);
  });

  it("the opener is a connected non-Blank, so a disconnected opener never hands the first turn to the Blank", () => {
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

