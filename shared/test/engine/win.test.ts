import { describe, expect, it } from "vitest";
import { checkWinner } from "../../src/engine/win";
import { createInitialState } from "../../src/engine/reduce";
import type { GameState, Role } from "../../src/engine/types";
import { inClues, lobby } from "../../src/testing";

function stateWith(winRule: "official" | "parity", aliveC: number, aliveU: number, aliveB: number, dead = 0): GameState {
  const s = createInitialState({ roomCode: "TEST", joinUrl: "x", seed: 1, wordLocale: "en" });
  s.settings.winRule = winRule;
  const mk = (role: Role, alive: boolean, i: number) => ({
    id: `p${i}`, name: `n${i}`, color: "coral" as const, locale: "en" as const, seat: i, joinedAt: 0, connected: true, disconnectedAt: null,
    role, word: null, alive, left: false, ready: true, spoke: false, score: 0,
  });
  let i = 0;
  for (let k = 0; k < aliveC; k++) s.players.push(mk("CIVILIAN", true, i++));
  for (let k = 0; k < aliveU; k++) s.players.push(mk("UNDERCOVER", true, i++));
  for (let k = 0; k < aliveB; k++) s.players.push(mk("BLANK", true, i++));
  for (let k = 0; k < dead; k++) s.players.push(mk("CIVILIAN", false, i++));
  return s;
}

describe("checkWinner (§4.10)", () => {
  for (const winRule of ["official", "parity"] as const) {
    for (let n = 3; n <= 12; n++) {
      it(`${winRule} n=${n}: every alive composition`, () => {
        for (let c = 0; c <= n; c++) {
          for (let u = 0; u + c <= n; u++) {
            for (let b = 0; b <= 2 && b + u + c <= n; b++) {
              const w = checkWinner(stateWith(winRule, c, u, b, n - c - u - b));
              const i = u + b;
              const expected = i === 0 ? "CIVILIANS" : winRule === "official" ? (c <= 1 ? "INFILTRATORS" : null) : i >= c ? "INFILTRATORS" : null;
              expect(w).toBe(expected);
              // A game that continues has at least 3 alive players.
              if (w === null) expect(c + u + b).toBeGreaterThanOrEqual(3);
            }
          }
        }
      });
    }
  }
  it("players without a role (lobby) are ignored", () => {
    const g = lobby(4);
    expect(checkWinner(g.state)).toBe("CIVILIANS");
  });
  it("a correct Blank guess wins before the civilian count is checked", () => {
    // official, 3 players: 2 C, 1 B. The Blank is voted out and guesses right → BLANK, not CIVILIANS.
    const g = inClues(3, { roleMode: "custom", undercoverCount: 1, blankCount: 0 }, 1);
    expect(g.state.phase).toBe("CLUES");
    // (Covered end-to-end in transitions.test.ts: "correct guess → RESULTS(BLANK)".)
  });
  it("a forfeit that drops below 3 alive ends the game", () => {
    const g = inClues(3, { roleMode: "custom", undercoverCount: 1, blankCount: 0 });
    const civ = g.byRole("CIVILIAN")[0] as string;
    g.p(civ, { type: "LEAVE" });
    expect(g.state.phase).toBe("RESULTS");
    expect(g.state.result?.winner).toBe("INFILTRATORS");
  });
  it("parity: forfeit of the last infiltrator → CIVILIANS", () => {
    const g = inClues(4, { winRule: "parity", roleMode: "custom", undercoverCount: 1, blankCount: 0 });
    g.tv({ type: "KICK", playerId: g.byRole("UNDERCOVER")[0] as string });
    expect(g.state.result?.winner).toBe("CIVILIANS");
  });
});
