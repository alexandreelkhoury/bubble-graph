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
            for (let b = 0; b <= 5 && b + u + c <= n; b++) {
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

/** Rules v2: the default game has Moles (BLANK) and no Undercover. Every end must still resolve. */
describe("Mole-only games (0 Undercovers, the default)", () => {
  const out = (g: ReturnType<typeof inClues>, id: string): void => {
    g.speakAll();
    g.voteOut(id);
    g.tv({ type: "HOST_ADVANCE" }); // ELIMINATION → guess or next step
  };
  it("defaults deal 1 Mole and no Undercover", () => {
    const g = inClues(4);
    expect(g.state.roleCounts).toEqual({ civilian: 3, undercover: 0, blank: 1 });
    expect(g.byRole("UNDERCOVER")).toEqual([]);
  });
  it("the Mole is caught and guesses wrong → Civilians win, +2 each", () => {
    const g = inClues(4);
    const mole = g.byRole("BLANK")[0] as string;
    out(g, mole);
    expect(g.state.phase).toBe("MR_WHITE_GUESS");
    g.p(mole, { type: "SUBMIT_GUESS", text: "zzwrong" });
    g.expire();
    expect(g.state.result?.winner).toBe("CIVILIANS");
    expect(g.state.result?.winnerIds).toEqual(g.byRole("CIVILIAN"));
    for (const c of g.byRole("CIVILIAN")) expect(g.state.result?.pointsAwarded[c]).toBe(2);
    expect(g.state.result?.pointsAwarded[mole]).toBe(0);
  });
  it("the Mole is caught and guesses right → the Mole wins, +10", () => {
    const g = inClues(4);
    const mole = g.byRole("BLANK")[0] as string;
    out(g, mole);
    g.p(mole, { type: "SUBMIT_GUESS", text: g.state.pair?.civilian.text as string });
    g.expire();
    expect(g.state.result).toMatchObject({ winner: "BLANK", winnerIds: [mole] });
    expect(g.state.result?.pointsAwarded[mole]).toBe(10);
  });
  it("the Mole survives to the end → infiltrators (the Mole) win, +10", () => {
    const g = inClues(3);
    const mole = g.byRole("BLANK")[0] as string;
    out(g, g.byRole("CIVILIAN")[0] as string);
    expect(g.state.result?.winner).toBe("INFILTRATORS");
    expect(g.state.result?.winnerIds).toEqual([mole]);
    expect(g.state.result?.pointsAwarded[mole]).toBe(10);
  });
  it("blankGuess off: catching the only Mole ends the game for the Civilians", () => {
    const g = inClues(4, { blankGuess: false });
    out(g, g.byRole("BLANK")[0] as string);
    expect(g.state.result?.winner).toBe("CIVILIANS");
  });
  it("two Moles (7 players): the game goes on until both are out", () => {
    const g = inClues(7);
    expect(g.state.roleCounts).toEqual({ civilian: 5, undercover: 0, blank: 2 });
    const [m1, m2] = g.byRole("BLANK") as [string, string];
    out(g, m1);
    g.p(m1, { type: "SUBMIT_GUESS", text: "zzwrong" });
    g.expire();
    expect(g.state.phase).toBe("CLUES");
    out(g, m2);
    g.p(m2, { type: "SUBMIT_GUESS", text: "zzwrong" });
    g.expire();
    expect(g.state.result?.winner).toBe("CIVILIANS");
  });
  it("an Undercover-only custom game still works (no Mole, no guess)", () => {
    const g = inClues(4, { roleMode: "custom", undercoverCount: 1, blankCount: 0 });
    out(g, g.byRole("UNDERCOVER")[0] as string);
    expect(g.state.result?.winner).toBe("CIVILIANS");
  });
});
