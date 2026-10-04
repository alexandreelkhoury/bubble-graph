import { describe, expect, it } from "vitest";
import { CLUE_GRACE_MS, ELIMINATION_HOLD_MS, SEAT_HOLD_MS, TIE_LEAD_IN_MS, VERDICT_HOLD_MS } from "../../src/constants";
import { assertInvariants } from "../../src/engine/invariants";
import { nextWakeAt, reduce } from "../../src/engine/reduce";
import type { Action, SettingsPatch } from "../../src/engine/types";
import { findSeed, Game, inClues, lobby, P, pid, SYS, T0, TEST_CATALOG, TV } from "../../src/testing";

const NO_BLANK: SettingsPatch = { roleMode: "custom", undercoverCount: 1, blankCount: 0 };
const VIP = pid(0);

/** 4 players in VOTING after a full clue pass. */
function inVoting(settings: SettingsPatch = NO_BLANK, seed = 1): Game {
  const g = inClues(4, settings, seed);
  g.speakAll();
  expect(g.state.phase).toBe("VOTING");
  return g;
}

/** 2–2 split between seat 0 and seat 3 → TIE_BREAK. */
function toTieBreak(g: Game): [string, string, string, string] {
  const [a, b, c, d] = g.ids() as [string, string, string, string];
  g.p(a, { type: "CAST_VOTE", targetId: d });
  g.p(b, { type: "CAST_VOTE", targetId: d });
  g.p(c, { type: "CAST_VOTE", targetId: a });
  g.p(d, { type: "CAST_VOTE", targetId: a });
  expect(g.state.phase).toBe("TIE_BREAK");
  return [a, b, c, d];
}

/** 5 players (U1 B1 C3) with the Blank voted out, now in MR_WHITE_GUESS (PENDING). */
function inGuess(opts: { blankIsVip?: boolean; settings?: SettingsPatch } = {}): { g: Game; blank: string } {
  const settings = opts.settings;
  const seed = findSeed(5, settings, (x) => (x.byRole("BLANK")[0] === VIP) === Boolean(opts.blankIsVip));
  const g = lobby(5, settings, seed);
  g.tv({ type: "START" });
  g.readyAll();
  g.speakAll();
  const blank = g.byRole("BLANK")[0] as string;
  g.voteOut(blank);
  expect(g.state.phase).toBe("ELIMINATION");
  g.tv({ type: "HOST_ADVANCE" });
  expect(g.state.phase).toBe("MR_WHITE_GUESS");
  expect(g.state.guess?.status).toBe("PENDING");
  return { g, blank };
}

describe("LOBBY: JOIN", () => {
  it("first joiner becomes host; seats fill the smallest gap", () => {
    const g = lobby(3);
    expect(g.state.hostPlayerId).toBe(pid(0));
    expect(g.state.players.map((p) => p.seat)).toEqual([0, 1, 2]);
    g.p(pid(1), { type: "LEAVE" });
    g.join(5);
    expect(g.get(pid(5)).seat).toBe(1);
    expect(g.ids()).toEqual([pid(0), pid(5), pid(2)]);
    expect(g.get(pid(5))).toMatchObject({ connected: true, alive: true, left: false, score: 0, disconnectedAt: null });
  });
  it("errors: ROOM_LOCKED, ROOM_FULL, NAME_INVALID, NAME_TAKEN, COLOR_TAKEN, BAD_MESSAGE", () => {
    const g = lobby(12);
    expect(g.err({ type: "JOIN", by: SYS, playerId: pid(20), name: "X", color: "coral", locale: "en" })).toBe("ROOM_FULL");
    const h = lobby(3);
    const j = (name: string, color: "coral" | "mint", id = pid(30), locale: "en" | "xx" = "en") =>
      h.err({ type: "JOIN", by: SYS, playerId: id, name, color, locale: locale as "en" });
    expect(j("  ‎ ", "mint")).toBe("NAME_INVALID");
    expect(j("PLAYER0", "mint")).toBe("NAME_TAKEN");
    expect(j("Fresh", "coral")).toBe("COLOR_TAKEN");
    expect(j("Fresh", "mint", pid(0))).toBe("BAD_MESSAGE");
    expect(j("Fresh", "mint", pid(31), "xx")).toBe("BAD_MESSAGE");
    expect(h.err({ type: "JOIN", by: SYS, playerId: pid(32), name: "Fresh", color: "nope" as "coral", locale: "en" })).toBe("BAD_MESSAGE");
    h.tv({ type: "START" });
    expect(j("Late", "mint")).toBe("ROOM_LOCKED");
  });
  it("stores the sanitised name", () => {
    const g = new Game();
    g.do({ type: "JOIN", by: SYS, playerId: pid(1), name: "  Al‮ice  ", color: "aqua", locale: "fr" });
    expect(g.get(pid(1))).toMatchObject({ name: "Alice", locale: "fr", color: "aqua" });
  });
});

describe("system actions on unknown ids and no-ops", () => {
  it("RECONNECT/DISCONNECT for unknown ids return the same object", () => {
    const g = lobby(3);
    const s = g.state;
    for (const type of ["RECONNECT", "DISCONNECT"] as const) {
      const r = reduce(s, { type, by: SYS, playerId: pid(99) }, { now: T0, catalog: TEST_CATALOG });
      expect(r.ok).toBe(true);
      expect(r.state).toBe(s);
    }
  });
  it("RECONNECT/DISCONNECT for left players are no-ops", () => {
    const g = inClues(5);
    const victim = g.ids()[4] as string;
    g.tv({ type: "KICK", playerId: victim });
    const s = g.state;
    expect(reduce(s, { type: "RECONNECT", by: SYS, playerId: victim }, { now: g.now, catalog: TEST_CATALOG }).state).toBe(s);
    expect(reduce(s, { type: "DISCONNECT", by: SYS, playerId: victim }, { now: g.now, catalog: TEST_CATALOG }).state).toBe(s);
  });
  it("TICK with nothing due returns the same object; a repeated RECONNECT changes nothing", () => {
    const g = lobby(3);
    const s = g.state;
    expect(g.tick().state).toBe(s);
    expect(reduce(s, { type: "RECONNECT", by: SYS, playerId: pid(1) }, { now: g.now, catalog: TEST_CATALOG }).state).toBe(s);
    g.sys({ type: "DISCONNECT", playerId: pid(1) });
    const s2 = g.state;
    expect(reduce(s2, { type: "DISCONNECT", by: SYS, playerId: pid(1) }, { now: g.now + 5, catalog: TEST_CATALOG }).state).toBe(s2);
  });
  it("READY twice is a no-op with the same object; version increments only on change", () => {
    const g = lobby(3);
    g.tv({ type: "START" });
    const v = g.state.version;
    g.p(pid(0), { type: "READY" });
    expect(g.state.version).toBe(v + 1);
    const s = g.state;
    const r = reduce(s, { type: "READY", by: P(pid(0)) }, { now: g.now, catalog: TEST_CATALOG });
    expect(r.state).toBe(s);
  });
  it("reduce never mutates its input", () => {
    const g = lobby(4);
    const snap = JSON.stringify(g.state);
    reduce(g.state, { type: "START", by: TV }, { now: g.now, catalog: TEST_CATALOG });
    expect(JSON.stringify(g.state)).toBe(snap);
  });
  it("intents from unknown or left players → BAD_MESSAGE", () => {
    const g = inClues(5);
    expect(g.err({ type: "READY", by: P(pid(77)) })).toBe("BAD_MESSAGE");
    const victim = g.ids()[4] as string;
    g.tv({ type: "KICK", playerId: victim });
    expect(g.err({ type: "LEAVE", by: P(victim) })).toBe("BAD_MESSAGE");
  });
});

describe("LOBBY seat hold (TICK)", () => {
  it("removes a disconnected lobby seat after 120 s (host rule applies)", () => {
    const g = lobby(3);
    g.sys({ type: "DISCONNECT", playerId: VIP });
    const at = (g.get(VIP).disconnectedAt as number) + SEAT_HOLD_MS;
    expect(nextWakeAt(g.state)).toBe(at);
    expect(g.tick(at - 1).state.players.length).toBe(3);
    g.tick(at);
    expect(g.state.players.length).toBe(2);
    expect(g.state.hostPlayerId).toBe(pid(1));
  });
  it("a reconnect cancels the hold", () => {
    const g = lobby(3);
    g.sys({ type: "DISCONNECT", playerId: pid(2) });
    g.sys({ type: "RECONNECT", playerId: pid(2) });
    expect(nextWakeAt(g.state)).toBeNull();
    expect(g.tick(g.now + SEAT_HOLD_MS * 2).ok).toBe(true);
    expect(g.state.players.length).toBe(3);
  });
});

describe("UPDATE_SETTINGS / START permissions", () => {
  it("TV and VIP may update settings; others NOT_HOST; invalid → INVALID_SETTINGS; wrong phase", () => {
    const g = lobby(3);
    g.tv({ type: "UPDATE_SETTINGS", patch: { clueSeconds: 30 } });
    g.p(VIP, { type: "UPDATE_SETTINGS", patch: { voteSeconds: 60 } });
    expect(g.state.settings).toMatchObject({ clueSeconds: 30, voteSeconds: 60 });
    expect(g.err({ type: "UPDATE_SETTINGS", patch: { clueSeconds: 20 }, by: P(pid(1)) })).toBe("NOT_HOST");
    expect(g.err({ type: "UPDATE_SETTINGS", patch: { clueSeconds: 7 }, by: TV })).toBe("INVALID_SETTINGS");
    g.tv({ type: "START" });
    expect(g.err({ type: "UPDATE_SETTINGS", patch: { clueSeconds: 20 }, by: TV })).toBe("WRONG_PHASE");
    expect(g.err({ type: "START", by: TV })).toBe("WRONG_PHASE");
  });
  it("START by VIP ok; by non-host NOT_HOST", () => {
    const g = lobby(3);
    expect(g.err({ type: "START", by: P(pid(2)) })).toBe("NOT_HOST");
    g.p(VIP, { type: "START" });
    expect(g.state.phase).toBe("ROLE_REVEAL");
  });
  it("START errors: NOT_ENOUGH_PLAYERS, INVALID_ROLE_CONFIG, NO_WORDS_AVAILABLE", () => {
    expect(lobby(2).err({ type: "START", by: TV })).toBe("NOT_ENOUGH_PLAYERS");
    expect(lobby(4, { roleMode: "custom", undercoverCount: 2, blankCount: 0 }).err({ type: "START", by: TV })).toBe("INVALID_ROLE_CONFIG");
    expect(lobby(4, { difficulties: [3], packIds: ["test-en-01"], familyFilter: true })
      .try({ type: "START", by: TV }).ok).toBe(true);
    const g = lobby(4, { wordLocale: "fr" });
    g.tv({ type: "UPDATE_SETTINGS", patch: { packIds: ["test-fr-01"], difficulties: [3] } });
    expect(g.err({ type: "START", by: TV })).toBe("NO_WORDS_AVAILABLE");
  });
  it("START with 3 players but only 2 connected → NOT_ENOUGH_PLAYERS; disconnected seats are still dealt in", () => {
    const g = lobby(3);
    g.sys({ type: "DISCONNECT", playerId: pid(2) });
    expect(g.err({ type: "START", by: TV })).toBe("NOT_ENOUGH_PLAYERS");
    g.join(3);
    g.tv({ type: "START" });
    expect(g.state.players.every((p) => p.role !== null)).toBe(true);
    expect(g.get(pid(2)).ready).toBe(true); // disconnected → ready
    expect(g.state.roleCounts).toEqual({ civilian: 3, undercover: 1, blank: 0 });
  });
  it("START: compacts seats, deals words, pushes the pair key, sets REVEAL deadline", () => {
    const g = lobby(4);
    g.p(pid(1), { type: "LEAVE" });
    g.join(1);
    g.join(5);
    g.p(pid(2), { type: "LEAVE" });
    expect(g.state.players.map((p) => p.seat)).toEqual([0, 1, 3, 4]);
    g.tv({ type: "START" });
    const s = g.state;
    expect(s.players.map((p) => p.seat)).toEqual([0, 1, 2, 3]);
    expect(s.gameNumber).toBe(1);
    expect(s.round).toBe(0);
    expect(s.usedPairKeys).toEqual([s.pair?.key]);
    expect(s.deadline).toMatchObject({ kind: "REVEAL", durationMs: 30_000, at: g.now + 30_000 });
    for (const p of s.players) {
      if (p.role === "CIVILIAN") expect(p.word?.text).toBe(s.pair?.civilian.text);
      if (p.role === "UNDERCOVER") expect(p.word?.text).toBe(s.pair?.undercover.text);
    }
  });
  it("swapSides toggles sides about half the time; pairs do not repeat until the pool is exhausted", () => {
    let swapped = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = lobby(3, { packIds: ["test-en-01"], difficulties: [1] }, seed);
      g.tv({ type: "START" });
      if (g.state.pair?.civilian.text !== TEST_CATALOG.packs.find((p) => p.id === "test-en-01")?.pairs.find((q) => q.key === g.state.pair?.key)?.civilian.text) swapped++;
    }
    expect(swapped).toBeGreaterThan(5);
    expect(swapped).toBeLessThan(35);
    const g = lobby(3, { packIds: ["test-en-01"], difficulties: [1], swapSides: false });
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      g.tv({ type: "START" });
      seen.push(g.state.pair?.key as string);
      g.tv({ type: "BACK_TO_LOBBY" });
    }
    expect(new Set(seen.slice(0, 5)).size).toBe(5); // 5 difficulty-1 pairs
    expect(g.state.usedPairKeys.length).toBe(1); // reset after exhaustion, then 1 new
  });
});

describe("ROLE_REVEAL", () => {
  it("READY by all connected → CLUES round 1; READY by TV → BAD_MESSAGE; wrong phase", () => {
    const g = lobby(3);
    expect(g.err({ type: "READY", by: P(VIP) })).toBe("WRONG_PHASE");
    g.tv({ type: "START" });
    expect(g.err({ type: "READY", by: TV })).toBe("BAD_MESSAGE");
    g.p(pid(0), { type: "READY" });
    g.p(pid(1), { type: "READY" });
    expect(g.state.phase).toBe("ROLE_REVEAL");
    g.p(pid(2), { type: "READY" });
    expect(g.state.phase).toBe("CLUES");
    expect(g.state.round).toBe(1);
  });
  it("REVEAL deadline → CLUES; HOST_ADVANCE (VIP) → CLUES; non-host → NOT_HOST", () => {
    const g = lobby(3);
    g.tv({ type: "START" });
    g.expire();
    expect(g.state.phase).toBe("CLUES");
    const h = lobby(3);
    h.tv({ type: "START" });
    expect(h.err({ type: "HOST_ADVANCE", by: P(pid(1)) })).toBe("NOT_HOST");
    h.p(VIP, { type: "HOST_ADVANCE" });
    expect(h.state.phase).toBe("CLUES");
  });
  it("a disconnect re-checks all-ready", () => {
    const g = lobby(4);
    g.tv({ type: "START" });
    for (const id of [pid(0), pid(1), pid(2)]) g.p(id, { type: "READY" });
    g.sys({ type: "DISCONNECT", playerId: pid(3) });
    expect(g.state.phase).toBe("CLUES");
  });
  it("revealSeconds 0 → no deadline", () => {
    const g = lobby(3, { revealSeconds: 0 });
    g.tv({ type: "START" });
    expect(g.state.deadline).toBeNull();
    expect(nextWakeAt(g.state)).toBeNull();
  });
});

describe("CLUES and turns", () => {
  it("CLUE_DONE by the current speaker advances; others NOT_YOUR_TURN; TV NOT_YOUR_TURN", () => {
    const g = inClues(4);
    const sp = g.speaker();
    const other = g.ids().find((id) => id !== sp) as string;
    expect(g.err({ type: "CLUE_DONE", by: P(other) })).toBe("NOT_YOUR_TURN");
    expect(g.err({ type: "CLUE_DONE", by: TV })).toBe("NOT_YOUR_TURN");
    g.p(sp, { type: "CLUE_DONE" });
    expect(g.get(sp).spoke).toBe(true);
    expect(g.state.turnIdx).toBe(1);
    expect(g.state.deadline?.kind).toBe("CLUE");
  });
  it("CLUE deadline and HOST_ADVANCE skip the speaker; the full pass enters VOTING", () => {
    const g = inClues(4);
    g.expire();
    expect(g.state.turnIdx).toBe(1);
    g.tv({ type: "HOST_ADVANCE" });
    g.p(VIP === g.speaker() ? VIP : g.speaker(), { type: "CLUE_DONE" });
    g.p(g.speaker(), { type: "CLUE_DONE" });
    expect(g.state.phase).toBe("VOTING");
    expect(g.state.deadline).toMatchObject({ kind: "VOTE", durationMs: 90_000 });
    expect(g.err({ type: "CLUE_DONE", by: P(VIP) })).toBe("WRONG_PHASE");
  });
  it("disconnected players are skipped when their turn starts", () => {
    const g = inClues(5);
    const order = g.state.speakingOrder;
    g.sys({ type: "DISCONNECT", playerId: order[1] as string });
    g.p(order[0] as string, { type: "CLUE_DONE" });
    expect(g.speaker()).toBe(order[2]);
    expect(g.get(order[1] as string).spoke).toBe(true);
  });
  it("speaker disconnecting mid-turn keeps the turn (deadline unchanged when the timer is on)", () => {
    const g = inClues(4);
    const sp = g.speaker();
    const dl = g.state.deadline;
    g.sys({ type: "DISCONNECT", playerId: sp });
    expect(g.speaker()).toBe(sp);
    expect(g.state.deadline).toEqual(dl);
  });
  it("speaker disconnecting mid-turn with the clue timer off gets the grace deadline", () => {
    const g = inClues(4, { clueSeconds: 0 });
    expect(g.state.deadline).toBeNull();
    const sp = g.speaker();
    g.sys({ type: "DISCONNECT", playerId: sp });
    expect(g.speaker()).toBe(sp);
    expect(g.state.deadline).toMatchObject({ kind: "CLUE", durationMs: CLUE_GRACE_MS });
    g.expire();
    expect(g.speaker()).not.toBe(sp);
    expect(g.state.deadline).toBeNull();
  });
  it("a reconnecting player who was skipped does not get another turn", () => {
    const g = inClues(4);
    const order = [...g.state.speakingOrder];
    g.sys({ type: "DISCONNECT", playerId: order[1] as string });
    g.p(order[0] as string, { type: "CLUE_DONE" });
    g.sys({ type: "RECONNECT", playerId: order[1] as string });
    expect(g.speaker()).toBe(order[2]);
  });
});

describe("VOTING", () => {
  it("CAST_VOTE rules: NOT_ALIVE, INVALID_TARGET (self, dead, unknown), overwrite, TV", () => {
    const g = inVoting();
    const [a, b, c] = g.ids() as [string, string, string];
    expect(g.err({ type: "CAST_VOTE", targetId: a, by: P(a) })).toBe("INVALID_TARGET");
    expect(g.err({ type: "CAST_VOTE", targetId: pid(99), by: P(a) })).toBe("INVALID_TARGET");
    expect(g.err({ type: "CAST_VOTE", targetId: a, by: TV })).toBe("NOT_ALIVE");
    g.p(a, { type: "CAST_VOTE", targetId: b });
    g.p(a, { type: "CAST_VOTE", targetId: c });
    expect(g.state.votes[a]).toBe(c);
  });
  it("closes when all alive connected players voted (unique max → ELIMINATION)", () => {
    const g = inVoting();
    const target = g.byRole("UNDERCOVER")[0] as string;
    g.voteOut(target);
    expect(g.state.phase).toBe("ELIMINATION");
    expect(g.state.lastVote).toMatchObject({ outcome: "ELIMINATED", eliminatedId: target, revote: false, abstainIds: [] });
    expect(g.state.lastVote?.tally[0]).toMatchObject({ targetId: target });
    expect(g.state.eliminated).toEqual({ playerId: target, role: "UNDERCOVER" });
    expect(g.state.history.at(-1)).toEqual({ round: 1, eliminatedId: target, role: "UNDERCOVER", cause: "VOTE" });
    expect(g.state.deadline).toMatchObject({ kind: "ELIMINATION", durationMs: ELIMINATION_HOLD_MS });
    expect(g.err({ type: "CAST_VOTE", targetId: target, by: P(g.ids()[0] as string) })).toBe("WRONG_PHASE");
    expect(g.err({ type: "CAST_VOTE", targetId: g.ids()[0] as string, by: P(target) })).toBe("WRONG_PHASE");
  });
  it("dead players cannot vote (NOT_ALIVE)", () => {
    const g = inClues(5, NO_BLANK);
    g.speakAll();
    const civ = g.byRole("CIVILIAN");
    g.voteOut(civ[0] as string);
    g.tv({ type: "HOST_ADVANCE" });
    g.speakAll();
    expect(g.err({ type: "CAST_VOTE", targetId: civ[1] as string, by: P(civ[0] as string) })).toBe("NOT_ALIVE");
  });
  it("disconnect re-checks the close; VOTE deadline closes with abstentions", () => {
    const g = inVoting();
    const [a, b, c, d] = g.ids() as [string, string, string, string];
    g.p(a, { type: "CAST_VOTE", targetId: b });
    g.p(b, { type: "CAST_VOTE", targetId: a });
    g.p(c, { type: "CAST_VOTE", targetId: b });
    g.sys({ type: "DISCONNECT", playerId: d });
    expect(g.state.phase).toBe("ELIMINATION");
    expect(g.state.lastVote?.abstainIds).toEqual([d]);
    expect(g.state.lastVote?.tally).toEqual([{ targetId: b, voterIds: [a, c] }, { targetId: a, voterIds: [b] }]);
    const h = inVoting();
    h.p(h.ids()[0] as string, { type: "CAST_VOTE", targetId: h.ids()[1] as string });
    h.expire();
    expect(h.state.phase).toBe("ELIMINATION");
    expect(h.state.lastVote?.abstainIds.length).toBe(3);
  });
  it("zero valid votes → NO_ELIMINATION", () => {
    const g = inVoting();
    g.tv({ type: "HOST_ADVANCE" });
    expect(g.state.lastVote).toMatchObject({ outcome: "NO_ELIMINATION", eliminatedId: null, tally: [] });
    expect(g.state.eliminated).toBeNull();
    expect(g.state.history.at(-1)?.cause).toBe("NONE");
    g.expire();
    expect(g.state.phase).toBe("CLUES");
    expect(g.state.round).toBe(2);
  });
  it("voteSeconds 0 → no deadline in VOTING", () => {
    const g = inVoting({ ...NO_BLANK, voteSeconds: 0 });
    expect(g.state.deadline).toBeNull();
  });
});

describe("TIE_BREAK and re-vote", () => {
  it("tie → TIE_BREAK with lead-in; tied players re-clue; re-vote restricted to candidates", () => {
    const g = inVoting();
    const [a, b, c, d] = toTieBreak(g);
    expect(g.state.tieCandidates).toEqual([a, d]);
    // Opener is drawn at random among the tied (never the Blank); order is a rotation of [a, d].
    expect([...g.state.speakingOrder].sort()).toEqual([a, d].sort());
    const [first, second] = g.state.speakingOrder as [string, string];
    expect(g.state.lastVote).toMatchObject({ outcome: "TIE", eliminatedId: null });
    expect(g.state.deadline?.durationMs).toBe(45_000 + TIE_LEAD_IN_MS);
    g.p(first, { type: "CLUE_DONE" });
    expect(g.state.deadline?.durationMs).toBe(45_000);
    g.p(second, { type: "CLUE_DONE" });
    expect(g.state.phase).toBe("VOTING");
    expect(g.state.revote).toBe(true);
    expect(g.err({ type: "CAST_VOTE", targetId: b, by: P(c) })).toBe("INVALID_TARGET");
    g.p(a, { type: "CAST_VOTE", targetId: d });
    g.p(b, { type: "CAST_VOTE", targetId: d });
    g.p(c, { type: "CAST_VOTE", targetId: d });
    g.p(d, { type: "CAST_VOTE", targetId: a });
    expect(g.state.phase).toBe("ELIMINATION");
    expect(g.state.lastVote).toMatchObject({ revote: true, outcome: "ELIMINATED", eliminatedId: d });
  });
  it("no lead-in when the clue timer is off", () => {
    const g = inVoting({ ...NO_BLANK, clueSeconds: 0 });
    toTieBreak(g);
    expect(g.state.deadline).toBeNull();
  });
  it("re-vote tie with tieBreak random → RANDOM elimination", () => {
    const g = inVoting();
    const [a, b, c, d] = toTieBreak(g);
    g.speakAll();
    g.p(a, { type: "CAST_VOTE", targetId: d });
    g.p(b, { type: "CAST_VOTE", targetId: d });
    g.p(c, { type: "CAST_VOTE", targetId: a });
    g.p(d, { type: "CAST_VOTE", targetId: a });
    expect(g.state.lastVote?.outcome).toBe("RANDOM");
    expect([a, d]).toContain(g.state.lastVote?.eliminatedId);
    expect(g.state.history.at(-1)?.cause).toBe("RANDOM");
  });
  it("re-vote tie with tieBreak none → NO_ELIMINATION", () => {
    const g = inVoting({ ...NO_BLANK, tieBreak: "none" });
    const [a, b, c, d] = toTieBreak(g);
    g.speakAll();
    g.p(a, { type: "CAST_VOTE", targetId: d });
    g.p(b, { type: "CAST_VOTE", targetId: d });
    g.p(c, { type: "CAST_VOTE", targetId: a });
    g.p(d, { type: "CAST_VOTE", targetId: a });
    expect(g.state.lastVote?.outcome).toBe("NO_ELIMINATION");
  });
  it("tied candidates all disconnected → straight to the re-vote", () => {
    const g = inVoting();
    const [a, b, c, d] = g.ids() as [string, string, string, string];
    g.p(a, { type: "CAST_VOTE", targetId: d });
    g.p(b, { type: "CAST_VOTE", targetId: d });
    g.p(c, { type: "CAST_VOTE", targetId: a });
    g.sys({ type: "DISCONNECT", playerId: a });
    g.sys({ type: "DISCONNECT", playerId: d });
    // a and d disconnected: b and c have voted → closes; a's vote (d) still counts, d did not vote → 2–1 for d
    expect(g.state.phase).toBe("ELIMINATION");
  });
  /** Seed where seats 0 and 3 are civilians (the undercover sits at seat 1 or 2). */
  const tieSeed = (): number => findSeed(4, NO_BLANK, (x) => x.get(x.ids()[0] as string).role === "CIVILIAN" && x.get(x.ids()[3] as string).role === "CIVILIAN");
  it("forfeit of a TIE_BREAK speaker who is also a tie candidate → regular vote (§4.8 order)", () => {
    const g = lobby(4, NO_BLANK, tieSeed());
    g.tv({ type: "START" });
    g.readyAll();
    g.speakAll();
    const [a, , , d] = toTieBreak(g);
    expect(g.speaker()).toBe(a);
    const hist = g.state.history.length;
    g.p(a, { type: "LEAVE" });
    expect(g.get(a)).toMatchObject({ left: true, alive: false, connected: false });
    expect(g.state.history.length).toBe(hist + 1);
    expect(g.state.history.at(-1)).toMatchObject({ eliminatedId: a, cause: "LEAVE", role: "CIVILIAN" });
    expect(g.state.phase).toBe("VOTING");
    expect(g.state.revote).toBe(false);
    expect(g.state.tieCandidates).toEqual([]);
    expect(g.get(d).alive).toBe(true);
  });
  it("forfeit of a candidate during the re-vote with 2 candidates → regular vote", () => {
    const g = lobby(4, NO_BLANK, tieSeed());
    g.tv({ type: "START" });
    g.readyAll();
    g.speakAll();
    const [a, b, , d] = toTieBreak(g);
    g.speakAll();
    expect(g.state.revote).toBe(true);
    g.p(b, { type: "CAST_VOTE", targetId: a });
    g.tv({ type: "KICK", playerId: d });
    expect(g.state.phase).toBe("VOTING");
    expect(g.state.revote).toBe(false);
    expect(g.state.votes).toEqual({});
    expect(g.state.deadline?.kind).toBe("VOTE");
  });
});

describe("ELIMINATION and next round", () => {
  it("ELIMINATION deadline → next round (starter rotates); HOST_ADVANCE by VIP works", () => {
    const g = inClues(6, NO_BLANK);
    g.speakAll();
    const firstStarter = g.state.starterId;
    const civ = g.byRole("CIVILIAN").find((id) => id !== VIP) as string;
    g.voteOut(civ);
    g.p(VIP, { type: "HOST_ADVANCE" });
    expect(g.state.phase).toBe("CLUES");
    expect(g.state.round).toBe(2);
    expect(g.state.starterId).not.toBe(firstStarter);
  });
  it("eliminating the last undercover → RESULTS(CIVILIANS) with points", () => {
    const g = inVoting();
    const und = g.byRole("UNDERCOVER")[0] as string;
    g.voteOut(und);
    g.expire();
    expect(g.state.phase).toBe("RESULTS");
    const r = g.state.result!;
    expect(r.winner).toBe("CIVILIANS");
    expect(r.winnerIds).toEqual(g.byRole("CIVILIAN"));
    for (const id of g.ids()) expect(r.pointsAwarded[id]).toBe(id === und ? 0 : 2);
    expect(g.get(und).score).toBe(0);
    expect(g.state.deadline).toBeNull();
    expect(r.civilianWord.text).toBe(g.state.pair?.civilian.text);
  });
  it("official: civilians down to 1 → INFILTRATORS", () => {
    const g = inVoting();
    const civ = g.byRole("CIVILIAN");
    g.voteOut(civ[0] as string);
    g.expire();
    g.speakAll();
    g.voteOut(civ[1] as string);
    g.expire();
    expect(g.state.result?.winner).toBe("INFILTRATORS");
    expect(g.state.result?.pointsAwarded[g.byRole("UNDERCOVER")[0] as string]).toBe(10);
  });
  it("stalemate: 3 consecutive no-elimination rounds → LOBBY, no points", () => {
    const g = inVoting();
    for (let r = 1; r <= 3; r++) {
      if (r > 1) g.speakAll();
      g.tv({ type: "HOST_ADVANCE" }); // close with zero votes
      expect(g.state.lastVote?.outcome).toBe("NO_ELIMINATION");
      g.tv({ type: "HOST_ADVANCE" });
    }
    expect(g.state.phase).toBe("LOBBY");
    expect(g.state.players.every((p) => p.score === 0 && p.role === null)).toBe(true);
    expect(g.state.gameNumber).toBe(1);
  });
  it("the stalemate streak is broken by an elimination", () => {
    const g = inClues(6, NO_BLANK);
    g.speakAll();
    g.tv({ type: "HOST_ADVANCE" });
    g.tv({ type: "HOST_ADVANCE" });
    g.speakAll();
    g.voteOut(g.byRole("CIVILIAN")[0] as string);
    g.tv({ type: "HOST_ADVANCE" });
    g.speakAll();
    g.tv({ type: "HOST_ADVANCE" });
    g.tv({ type: "HOST_ADVANCE" });
    expect(g.state.phase).toBe("CLUES");
  });
});

describe("MR_WHITE_GUESS", () => {
  it("SPEC-GAP: a Blank who LEFT during ELIMINATION times out at once (no dead GUESS window)", () => {
    for (const how of ["LEAVE", "KICK"] as const) {
      const seed = findSeed(5, undefined, (x) => x.byRole("BLANK")[0] !== VIP);
      const g = lobby(5, undefined, seed);
      g.tv({ type: "START" });
      g.readyAll();
      g.speakAll();
      const blank = g.byRole("BLANK")[0] as string;
      g.voteOut(blank);
      expect(g.state.phase).toBe("ELIMINATION");
      if (how === "LEAVE") g.p(blank, { type: "LEAVE" });
      else g.tv({ type: "KICK", playerId: blank });
      g.expire();
      expect(g.state.phase).toBe("MR_WHITE_GUESS");
      expect(g.state.guess?.status).toBe("TIMEOUT");
      expect(g.state.deadline).toMatchObject({ kind: "VERDICT", durationMs: VERDICT_HOLD_MS });
    }
  });
  it("SUBMIT_GUESS: wrong → WRONG + VERDICT; only the guesser; trimmed 1..40; text hidden", () => {
    const { g, blank } = inGuess();
    expect(g.state.deadline).toMatchObject({ kind: "GUESS", durationMs: 45_000 });
    expect(g.err({ type: "SUBMIT_GUESS", text: "x", by: P(VIP) })).toBe("NOT_YOUR_TURN");
    expect(g.err({ type: "SUBMIT_GUESS", text: "x", by: TV })).toBe("NOT_YOUR_TURN");
    expect(g.err({ type: "SUBMIT_GUESS", text: "   ", by: P(blank) })).toBe("GUESS_INVALID");
    expect(g.err({ type: "SUBMIT_GUESS", text: "x".repeat(41), by: P(blank) })).toBe("GUESS_INVALID");
    g.p(blank, { type: "SUBMIT_GUESS", text: "  zzwrong  " });
    expect(g.state.guess).toMatchObject({ status: "WRONG", text: "zzwrong", overridden: false });
    expect(g.state.deadline).toMatchObject({ kind: "VERDICT", durationMs: VERDICT_HOLD_MS });
    expect(g.err({ type: "SUBMIT_GUESS", text: "again", by: P(blank) })).toBe("WRONG_PHASE");
    g.expire();
    expect(g.state.guessLog).toHaveLength(1);
    expect(["CLUES", "RESULTS"]).toContain(g.state.phase);
  });
  it("correct guess → RESULTS(BLANK) beats the civilian count", () => {
    const { g, blank } = inGuess();
    g.p(blank, { type: "SUBMIT_GUESS", text: g.state.pair?.civilian.text.toUpperCase() as string });
    expect(g.state.guess?.status).toBe("CORRECT");
    g.expire();
    expect(g.state.phase).toBe("RESULTS");
    expect(g.state.result).toMatchObject({ winner: "BLANK", winnerIds: [blank] });
    expect(g.state.result?.pointsAwarded[blank]).toBe(6);
    expect(g.state.result?.guesses).toEqual([{ playerId: blank, status: "CORRECT", text: g.state.pair?.civilian.text.toUpperCase(), overridden: false }]);
  });
  it("GUESS deadline → TIMEOUT + VERDICT; TIMEOUT cannot be overridden", () => {
    const { g } = inGuess();
    g.expire();
    expect(g.state.guess?.status).toBe("TIMEOUT");
    expect(g.state.deadline?.kind).toBe("VERDICT");
    expect(g.err({ type: "HOST_OVERRIDE_GUESS", accept: true, by: TV })).toBe("WRONG_PHASE");
    expect(g.err({ type: "HOST_OVERRIDE_GUESS", accept: false, by: TV })).toBe("WRONG_PHASE");
    g.tv({ type: "HOST_ADVANCE" }); // not PENDING → VERDICT
    expect(g.state.phase).not.toBe("MR_WHITE_GUESS");
  });
  it("HOST_OVERRIDE accept:true on WRONG by TV; second override refused", () => {
    const { g, blank } = inGuess();
    expect(g.err({ type: "HOST_OVERRIDE_GUESS", accept: true, by: TV })).toBe("WRONG_PHASE"); // PENDING
    g.p(blank, { type: "SUBMIT_GUESS", text: "zzwrong" });
    expect(g.err({ type: "HOST_OVERRIDE_GUESS", accept: false, by: TV })).toBe("WRONG_PHASE"); // not CORRECT
    g.tv({ type: "HOST_OVERRIDE_GUESS", accept: true });
    expect(g.state.guess).toMatchObject({ status: "CORRECT", overridden: true });
    expect(g.state.deadline?.kind).toBe("VERDICT");
    expect(g.err({ type: "HOST_OVERRIDE_GUESS", accept: false, by: TV })).toBe("WRONG_PHASE");
    g.expire();
    expect(g.state.result?.winner).toBe("BLANK");
  });
  it("HOST_OVERRIDE accept:true by VIP ≠ guesser ok; by a non-host player NOT_HOST", () => {
    const { g, blank } = inGuess();
    g.p(blank, { type: "SUBMIT_GUESS", text: "zzwrong" });
    const other = g.ids().find((id) => id !== VIP && id !== blank) as string;
    expect(g.err({ type: "HOST_OVERRIDE_GUESS", accept: true, by: P(other) })).toBe("NOT_HOST");
    g.p(VIP, { type: "HOST_OVERRIDE_GUESS", accept: true });
    expect(g.state.guess?.status).toBe("CORRECT");
  });
  it("HOST_OVERRIDE accept:true by the VIP who is the guesser → NOT_HOST", () => {
    const { g, blank } = inGuess({ blankIsVip: true });
    expect(blank).toBe(VIP);
    g.p(blank, { type: "SUBMIT_GUESS", text: "zzwrong" });
    expect(g.err({ type: "HOST_OVERRIDE_GUESS", accept: true, by: P(VIP) })).toBe("NOT_HOST");
  });
  it("HOST_OVERRIDE accept:false on CORRECT: TV only", () => {
    const { g, blank } = inGuess();
    g.p(blank, { type: "SUBMIT_GUESS", text: g.state.pair?.civilian.text as string });
    expect(g.err({ type: "HOST_OVERRIDE_GUESS", accept: false, by: P(VIP) })).toBe("NOT_HOST");
    expect(g.err({ type: "HOST_OVERRIDE_GUESS", accept: true, by: TV })).toBe("WRONG_PHASE");
    g.tv({ type: "HOST_OVERRIDE_GUESS", accept: false });
    expect(g.state.guess).toMatchObject({ status: "WRONG", overridden: true });
    expect(g.err({ type: "HOST_OVERRIDE_GUESS", accept: true, by: TV })).toBe("WRONG_PHASE");
  });
  it("HOST_ADVANCE while PENDING: TV ok; VIP refused while the guesser is connected, allowed when disconnected", () => {
    const { g, blank } = inGuess();
    expect(g.err({ type: "HOST_ADVANCE", by: P(VIP) })).toBe("NOT_HOST");
    g.sys({ type: "DISCONNECT", playerId: blank });
    expect(g.state.guess?.status).toBe("PENDING"); // disconnect changes nothing in MR_WHITE_GUESS
    g.p(VIP, { type: "HOST_ADVANCE" });
    expect(g.state.guess?.status).toBe("TIMEOUT");
    const h = inGuess();
    h.g.tv({ type: "HOST_ADVANCE" });
    expect(h.g.state.guess?.status).toBe("TIMEOUT");
  });
  it("HOST_ADVANCE by the VIP who is the (disconnected) guesser → NOT_HOST", () => {
    const { g, blank } = inGuess({ blankIsVip: true });
    g.sys({ type: "DISCONNECT", playerId: blank });
    expect(g.err({ type: "HOST_ADVANCE", by: P(VIP) })).toBe("NOT_HOST");
  });
  it("disconnected guesser with guessSeconds 0 → TIMEOUT immediately", () => {
    const seed = findSeed(5, { guessSeconds: 0 }, (x) => x.byRole("BLANK")[0] !== VIP);
    const g = lobby(5, { guessSeconds: 0 }, seed);
    g.tv({ type: "START" });
    g.readyAll();
    g.speakAll();
    const blank = g.byRole("BLANK")[0] as string;
    g.voteOut(blank);
    g.sys({ type: "DISCONNECT", playerId: blank });
    g.tv({ type: "HOST_ADVANCE" });
    expect(g.state.guess?.status).toBe("TIMEOUT");
    expect(g.state.deadline?.kind).toBe("VERDICT");
  });
  it("guessSeconds 0 with a connected guesser → no deadline; blankGuess false skips the guess", () => {
    const seed = findSeed(5, { guessSeconds: 0 }, () => true);
    const g = lobby(5, { guessSeconds: 0 }, seed);
    g.tv({ type: "START" });
    g.readyAll();
    g.speakAll();
    g.voteOut(g.byRole("BLANK")[0] as string);
    g.tv({ type: "HOST_ADVANCE" });
    expect(g.state.guess?.status).toBe("PENDING");
    expect(g.state.deadline).toBeNull();
    const h = lobby(5, { blankGuess: false });
    h.tv({ type: "START" });
    h.readyAll();
    h.speakAll();
    h.voteOut(h.byRole("BLANK")[0] as string);
    h.tv({ type: "HOST_ADVANCE" });
    expect(h.state.phase).toBe("CLUES");
  });
  it("guesser forfeits while PENDING → TIMEOUT (no second history entry)", () => {
    const { g, blank } = inGuess();
    const hist = g.state.history.length;
    g.p(blank, { type: "LEAVE" });
    expect(g.state.guess?.status).toBe("TIMEOUT");
    expect(g.state.history.length).toBe(hist);
    expect(g.get(blank).left).toBe(true);
  });
  it("wrong phase for guess intents", () => {
    const g = inClues(3);
    expect(g.err({ type: "SUBMIT_GUESS", text: "x", by: P(VIP) })).toBe("WRONG_PHASE");
    expect(g.err({ type: "HOST_OVERRIDE_GUESS", accept: true, by: TV })).toBe("WRONG_PHASE");
  });
});

describe("KICK / LEAVE", () => {
  it("LOBBY: LEAVE and KICK remove the player; VIP leaving reassigns host by joinedAt among connected", () => {
    const g = lobby(4);
    g.sys({ type: "DISCONNECT", playerId: pid(1) });
    g.p(VIP, { type: "LEAVE" });
    expect(g.state.hostPlayerId).toBe(pid(2)); // pid(1) is disconnected
    g.p(pid(2), { type: "KICK", playerId: pid(3) });
    expect(g.ids()).toEqual([pid(1), pid(2)]);
    expect(g.err({ type: "KICK", playerId: pid(2), by: P(pid(2)) })).toBe("INVALID_TARGET");
    expect(g.err({ type: "KICK", playerId: pid(99), by: TV })).toBe("INVALID_TARGET");
    expect(g.err({ type: "KICK", playerId: pid(2), by: P(pid(1)) })).toBe("NOT_HOST");
    expect(g.err({ type: "LEAVE", by: TV })).toBe("BAD_MESSAGE");
  });
  it("host falls back to a disconnected player, then null", () => {
    const g = lobby(2);
    g.sys({ type: "DISCONNECT", playerId: pid(1) });
    g.p(VIP, { type: "LEAVE" });
    expect(g.state.hostPlayerId).toBe(pid(1));
    g.tv({ type: "KICK", playerId: pid(1) });
    expect(g.state.hostPlayerId).toBeNull();
    g.join(7);
    expect(g.state.hostPlayerId).toBe(pid(7));
  });
  it("in-game LEAVE/KICK mark left (role revealed via history), removed at resetToLobby, never dealt in again", () => {
    const g = inClues(6, NO_BLANK);
    const [x, y] = g.byRole("CIVILIAN").filter((id) => id !== VIP) as [string, string];
    g.p(x, { type: "LEAVE" });
    g.tv({ type: "KICK", playerId: y });
    expect(g.get(x)).toMatchObject({ left: true, alive: false, connected: false });
    expect(g.state.history.map((h) => h.cause)).toEqual(["LEAVE", "KICK"]);
    expect(g.err({ type: "KICK", playerId: x, by: TV })).toBe("INVALID_TARGET");
    g.tv({ type: "BACK_TO_LOBBY" });
    expect(g.ids()).not.toContain(x);
    expect(g.ids()).not.toContain(y);
    g.tv({ type: "START" });
    expect(g.state.players).toHaveLength(4);
  });
  it("RESULTS: LEAVE and KICK mark left; results stay; removed at PLAY_AGAIN", () => {
    const g = inVoting();
    g.voteOut(g.byRole("UNDERCOVER")[0] as string);
    g.expire();
    expect(g.state.phase).toBe("RESULTS");
    const result = structuredClone(g.state.result);
    g.p(VIP, { type: "LEAVE" });
    g.tv({ type: "KICK", playerId: pid(1) });
    expect(g.get(VIP)).toMatchObject({ left: true, connected: false });
    expect(g.state.hostPlayerId).toBe(pid(2));
    expect(g.state.result).toEqual(result);
    g.p(pid(2), { type: "PLAY_AGAIN" });
    expect(g.ids()).toEqual([pid(2), pid(3)]);
    expect(g.state.players.every((p) => p.score >= 0)).toBe(true);
  });
  it("VIP forfeit in-game → host reassigned", () => {
    const g = inClues(5);
    g.p(VIP, { type: "LEAVE" });
    expect(g.state.hostPlayerId).toBe(pid(1));
  });
  it("VIP KICK in-game: connected target refused, disconnected target allowed; VIP cannot kick itself", () => {
    const g = inClues(6, NO_BLANK);
    const t = g.ids()[3] as string;
    expect(g.err({ type: "KICK", playerId: t, by: P(VIP) })).toBe("INVALID_TARGET");
    expect(g.err({ type: "KICK", playerId: VIP, by: P(VIP) })).toBe("INVALID_TARGET");
    g.sys({ type: "DISCONNECT", playerId: t });
    g.p(VIP, { type: "KICK", playerId: t });
    expect(g.get(t).left).toBe(true);
  });
  it("forfeit of an already-dead player adds no second history entry and no win check", () => {
    const g = inClues(6, NO_BLANK);
    g.speakAll();
    const civ = g.byRole("CIVILIAN").find((id) => id !== VIP) as string;
    g.voteOut(civ);
    const hist = g.state.history.length;
    g.p(civ, { type: "LEAVE" });
    expect(g.state.history.length).toBe(hist);
    expect(g.get(civ)).toMatchObject({ left: true, alive: false });
    expect(g.state.phase).toBe("ELIMINATION");
  });
  it("forfeit of the current speaker passes the turn; forfeit in VOTING drops votes and re-checks the close", () => {
    const g = inClues(6, NO_BLANK);
    const sp = g.speaker();
    const next = g.state.speakingOrder[1];
    g.tv({ type: "KICK", playerId: sp });
    expect(g.speaker()).toBe(next);
    const h = inClues(6, NO_BLANK);
    h.speakAll();
    const ids = h.ids();
    const und = h.byRole("UNDERCOVER")[0] as string;
    const civs = ids.filter((id) => id !== und);
    for (const id of civs.slice(1)) h.p(id, { type: "CAST_VOTE", targetId: civs[0] as string });
    h.p(civs[0] as string, { type: "CAST_VOTE", targetId: civs[1] as string });
    expect(h.state.phase).toBe("VOTING"); // und has not voted
    h.tv({ type: "KICK", playerId: civs[0] as string }); // votes for/by civs[0] removed
    expect(h.state.phase).toBe("VOTING");
    expect(Object.values(h.state.votes)).not.toContain(civs[0]);
  });
  it("forfeit in ROLE_REVEAL re-checks all-ready; forfeit in ELIMINATION/MR_WHITE_GUESS defers the win check", () => {
    const g = lobby(4);
    g.tv({ type: "START" });
    for (const id of [pid(0), pid(1), pid(2)]) g.p(id, { type: "READY" });
    g.tv({ type: "KICK", playerId: pid(3) });
    expect(["CLUES", "RESULTS"]).toContain(g.state.phase);
    const h = inVoting();
    const und = h.byRole("UNDERCOVER")[0] as string;
    const civ = h.byRole("CIVILIAN");
    h.voteOut(civ[0] as string);
    h.tv({ type: "KICK", playerId: civ[1] as string }); // only 1 civ alive → would be INFILTRATORS, but deferred
    expect(h.state.phase).toBe("ELIMINATION");
    h.expire();
    expect(h.state.result?.winner).toBe("INFILTRATORS");
    expect(h.state.result?.winnerIds).toEqual([und]);
  });
  it("forfeit while VOTING closes the vote when the rest have voted", () => {
    const g = inClues(6, NO_BLANK);
    g.speakAll();
    const ids = g.ids();
    const und = g.byRole("UNDERCOVER")[0] as string;
    const civs = ids.filter((id) => id !== und);
    for (const id of civs) g.p(id, { type: "CAST_VOTE", targetId: id === civs[1] ? (civs[2] as string) : (civs[1] as string) });
    g.tv({ type: "KICK", playerId: und });
    expect(g.state.phase).toBe("RESULTS"); // last infiltrator left → CIVILIANS
    expect(g.state.result?.winnerIds).not.toContain(und);
  });
});

describe("RESULTS / PLAY_AGAIN / BACK_TO_LOBBY", () => {
  it("PLAY_AGAIN: host only, RESULTS only; keeps scores/gameNumber/usedPairKeys", () => {
    const g = inVoting();
    expect(g.err({ type: "PLAY_AGAIN", by: TV })).toBe("WRONG_PHASE");
    g.voteOut(g.byRole("UNDERCOVER")[0] as string);
    g.expire();
    expect(g.err({ type: "HOST_ADVANCE", by: TV })).toBe("WRONG_PHASE");
    expect(g.err({ type: "PLAY_AGAIN", by: P(pid(1)) })).toBe("NOT_HOST");
    const scores = g.state.players.map((p) => p.score);
    g.tv({ type: "PLAY_AGAIN" });
    expect(g.state.phase).toBe("LOBBY");
    expect(g.state.players.map((p) => p.score)).toEqual(scores);
    expect(g.state.gameNumber).toBe(1);
    expect(g.state.usedPairKeys).toHaveLength(1);
  });
  it("BACK_TO_LOBBY: TV only, not in LOBBY, no points", () => {
    const g = inClues(3);
    expect(g.err({ type: "BACK_TO_LOBBY", by: P(VIP) })).toBe("NOT_HOST");
    g.tv({ type: "BACK_TO_LOBBY" });
    expect(g.state.phase).toBe("LOBBY");
    expect(g.err({ type: "BACK_TO_LOBBY", by: TV })).toBe("WRONG_PHASE");
    expect(g.err({ type: "HOST_ADVANCE", by: TV })).toBe("WRONG_PHASE");
  });
  it("resetToLobby restarts the seat hold for disconnected players", () => {
    const g = inClues(4);
    g.sys({ type: "DISCONNECT", playerId: pid(3) });
    g.tv({ type: "BACK_TO_LOBBY" });
    expect(g.get(pid(3)).disconnectedAt).toBe(g.now);
    expect(nextWakeAt(g.state)).toBe(g.now + SEAT_HOLD_MS);
  });
  it("a disconnected player in RESULTS for more than 120 s keeps invariants and results valid", () => {
    const g = inVoting();
    g.voteOut(g.byRole("UNDERCOVER")[0] as string);
    g.sys({ type: "DISCONNECT", playerId: pid(2) });
    g.expire();
    expect(g.state.phase).toBe("RESULTS");
    const s = g.state;
    expect(nextWakeAt(s)).toBeNull();
    const r = g.tick(g.now + SEAT_HOLD_MS * 5);
    expect(r.state).toBe(s);
    assertInvariants(r.state);
    expect(r.state.players.map((p) => p.id)).toContain(pid(2));
    expect(Object.keys(r.state.result?.pointsAwarded ?? {})).toContain(pid(2));
  });
});

describe("permission matrix: HOST_ADVANCE kinds and misc", () => {
  it("HOST_ADVANCE in every in-game phase by the TV", () => {
    const g = lobby(5);
    g.tv({ type: "START" });
    g.tv({ type: "HOST_ADVANCE" }); // REVEAL
    expect(g.state.phase).toBe("CLUES");
    for (let i = 0; i < 5; i++) g.tv({ type: "HOST_ADVANCE" }); // CLUE ×5
    expect(g.state.phase).toBe("VOTING");
    g.tv({ type: "HOST_ADVANCE" }); // VOTE
    expect(g.state.phase).toBe("ELIMINATION");
    g.tv({ type: "HOST_ADVANCE" }); // ELIMINATION
    expect(g.state.phase).toBe("CLUES");
  });
  it("the TV may KICK in any phase; non-host players may not", () => {
    const g = inClues(5);
    expect(g.err({ type: "KICK", playerId: pid(4), by: P(pid(3)) })).toBe("NOT_HOST");
    g.tv({ type: "KICK", playerId: pid(4) });
  });
  it("an action stream is deterministic", () => {
    const run = () => {
      const g = inClues(7, undefined, 42);
      g.speakAll();
      g.voteOut(g.ids()[2] as string);
      g.expire();
      return g.state;
    };
    expect(run()).toEqual(run());
  });
  it("an unknown action type changes nothing (defensive)", () => {
    const g = lobby(3);
    const r = reduce(g.state, { type: "NOPE", by: SYS } as unknown as Action, { now: g.now, catalog: TEST_CATALOG });
    expect(r.state).toBe(g.state);
  });
});
