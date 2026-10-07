import { describe, expect, it } from "vitest";
import { assertInvariants, InvariantError } from "../../src/engine/invariants";
import type { GameState } from "../../src/engine/types";
import { inClues, lobby, pid } from "../../src/testing";

function expectBroken(s: GameState, n: number): void {
  try {
    assertInvariants(s);
  } catch (e) {
    expect(e).toBeInstanceOf(InvariantError);
    expect((e as Error).message).toMatch(new RegExp(`^invariant ${n}:`));
    return;
  }
  throw new Error(`invariant ${n} not detected`);
}

const clone = (s: GameState): GameState => structuredClone(s);

describe("assertInvariants detects each violation", () => {
  const L = lobby(4).state;
  const C = inClues(5, { roleMode: "custom", undercoverCount: 1, blankCount: 1 }).state;

  it("1: size, uniqueness, order", () => {
    let s = clone(L);
    s.players.push(...Array.from({ length: 9 }, (_, i) => ({ ...s.players[0]!, id: `x${i}`, seat: 10 + i, name: `n${i}`, color: "mint" as const })));
    expectBroken(s, 1);
    s = clone(L); s.players[1]!.id = s.players[0]!.id; expectBroken(s, 1);
    s = clone(L); s.players[1]!.seat = 0; expectBroken(s, 1);
    s = clone(L); s.players[1]!.name = s.players[0]!.name.toUpperCase(); expectBroken(s, 1);
    s = clone(L); s.players[1]!.color = s.players[0]!.color; expectBroken(s, 1);
    s = clone(L); s.players.reverse(); expectBroken(s, 1);
  });
  it("2: host must exist and not be left", () => {
    const s = clone(L); s.hostPlayerId = "nobody"; expectBroken(s, 2);
  });
  it("3: lobby must be reset", () => {
    let s = clone(L); s.players[1]!.left = true; expectBroken(s, 3);
    s = clone(L); s.players[0]!.role = "CIVILIAN"; expectBroken(s, 3);
    s = clone(L); s.round = 1; expectBroken(s, 3);
    s = clone(L); s.roleCounts = { civilian: 1, undercover: 1, blank: 0 }; expectBroken(s, 3);
  });
  it("4: roles and words in-game", () => {
    let s = clone(C); s.pair = null; expectBroken(s, 4);
    s = clone(C); s.players[0]!.role = null; expectBroken(s, 4);
    s = clone(C);
    const civ = s.players.find((p) => p.role === "CIVILIAN")!; civ.word = { text: "zz", translit: null }; expectBroken(s, 4);
    s = clone(C);
    const und = s.players.find((p) => p.role === "UNDERCOVER")!; und.word = { text: "zz", translit: null }; expectBroken(s, 4);
    s = clone(C);
    const blank = s.players.find((p) => p.role === "BLANK")!; blank.word = { text: "zz", translit: null }; expectBroken(s, 4);
    s = clone(C); s.roleCounts = { civilian: 4, undercover: 1, blank: 0 }; expectBroken(s, 4);
  });
  it("5: current speaker", () => {
    let s = clone(C); s.turnIdx = 99; expectBroken(s, 5);
    s = clone(C); s.players.find((p) => p.id === s.speakingOrder[0])!.spoke = true; expectBroken(s, 5);
    s = clone(C); s.players.find((p) => p.id === s.speakingOrder[0])!.connected = false; s.deadline = null; expectBroken(s, 5);
  });
  it("6/7: votes and tie candidates", () => {
    const g = inClues(5);
    g.speakAll();
    const V = g.state;
    let s = clone(V); s.votes[pid(0)] = pid(0); expectBroken(s, 6);
    s = clone(V); s.votes[pid(0)] = "ghost"; expectBroken(s, 6);
    s = clone(V); s.revote = true; s.tieCandidates = [pid(1), pid(2)]; s.votes[pid(0)] = pid(3); expectBroken(s, 6);
    s = clone(V); s.revote = true; s.tieCandidates = [pid(1)]; expectBroken(s, 7);
  });
  it("8: no winner while playing; 13: at least 3 alive", () => {
    const g = inClues(5, { roleMode: "custom", undercoverCount: 1, blankCount: 1 });
    g.speakAll();
    const V = g.state;
    let s = clone(V);
    for (const p of s.players) if (p.role !== "CIVILIAN") p.alive = false;
    expectBroken(s, 8);
    s = clone(V);
    const civs = s.players.filter((p) => p.role === "CIVILIAN");
    s.settings.winRule = "parity";
    civs[0]!.alive = false; civs[1]!.alive = false; // 1 C + U + B alive → parity win → 8
    expectBroken(s, 8);
  });
  it("9/10: results and deadlines", () => {
    let s = clone(C); s.result = { winner: "CIVILIANS", winnerIds: [], civilianWord: { text: "a", translit: null }, undercoverWord: { text: "b", translit: null }, pack: { id: "x", version: 1, title: { en: "", fr: "", ar: "" } }, pointsAwarded: {}, guesses: [] };
    expectBroken(s, 9);
    s = clone(C); s.deadline = { id: 1, kind: "VOTE", at: 0, durationMs: 1 }; expectBroken(s, 10);
    s = clone(C); s.phase = "ELIMINATION"; s.deadline = null; expectBroken(s, 10);
  });
  it("11: rng, version, scores", () => {
    let s = clone(L); s.rngState = -1; expectBroken(s, 11);
    s = clone(L); s.version = -1; expectBroken(s, 11);
    s = clone(L); s.players[0]!.score = -2; expectBroken(s, 11);
  });
  it("12: guesser must be the Blank", () => {
    let s = clone(C); s.phase = "MR_WHITE_GUESS"; s.guess = null; s.deadline = { id: 1, kind: "VERDICT", at: 0, durationMs: 1 }; expectBroken(s, 12);
    s = clone(C); s.phase = "MR_WHITE_GUESS"; s.deadline = { id: 1, kind: "GUESS", at: 0, durationMs: 1 };
    s.guess = { playerId: s.players.find((p) => p.role === "CIVILIAN")!.id, status: "PENDING", text: null, overridden: false };
    expectBroken(s, 12);
  });
  it("14: left players are disconnected (and dead in-game)", () => {
    let s = clone(C); s.players[1]!.left = true; expectBroken(s, 14);
    s = clone(C); s.players[1]!.left = true; s.players[1]!.connected = false; expectBroken(s, 14);
  });
  it("15: result ids exist", () => {
    const g = inClues(4, { roleMode: "custom", undercoverCount: 1, blankCount: 0 });
    g.speakAll();
    g.voteOut(g.byRole("UNDERCOVER")[0] as string);
    g.expire();
    const s = clone(g.state);
    s.result!.winnerIds.push("ghost");
    expectBroken(s, 15);
  });
});
