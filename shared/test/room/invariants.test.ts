// JAMAA-PLATFORM §2.8: assertRoomInvariants catches each broken shape (messages carry ids and phases only).
import { describe, expect, it } from "vitest";
import { assertRoomInvariants, RoomInvariantError } from "../../src/room";
import type { RoomHistory, RoomState } from "../../src/room";
import { pid, RoomHarness } from "../../src/testing";

function base(): { s: RoomState; h: RoomHistory } {
  const r = new RoomHarness({ seed: 2 });
  r.join(pid(0), "A", "coral");
  r.join(pid(1), "B", "azure");
  r.join(pid(2), "C", "lemon");
  r.tv({ type: "OPEN_GAME", gameId: "mishana" });
  r.tv({ type: "START_GAME" });
  return { s: JSON.parse(JSON.stringify(r.state)) as RoomState, h: JSON.parse(JSON.stringify(r.history)) as RoomHistory };
}

const BREAKS: [string, (s: RoomState, h: RoomHistory) => void][] = [
  ["schema", (s) => { (s as { schema: number }).schema = 1; }],
  ["phase", (s) => { (s as { phase: string }).phase = "LOBBY"; }],
  ["duplicate id", (s) => { (s.members[1] as { id: string }).id = pid(0); }],
  ["duplicate seat", (s) => { (s.members[1] as { seat: number }).seat = 0; }],
  ["duplicate colour", (s) => { (s.members[1] as { color: string }).color = "coral"; }],
  ["duplicate name", (s) => { (s.members[1] as { name: string }).name = "a"; }],
  ["unsorted", (s) => { s.members.reverse(); }],
  ["connected/disconnectedAt", (s) => { (s.members[0] as { disconnectedAt: number }).disconnectedAt = 5; }],
  ["reaction n", (s) => { (s.members[0] as { reaction: unknown }).reaction = { kind: "laugh", at: 0, n: 0 }; }],
  ["left and benched", (s) => { Object.assign(s.members[0] as object, { left: true, benched: true, connected: false, disconnectedAt: 1 }); }],
  ["host unknown", (s) => { s.hostPlayerId = pid(9); }],
  ["no host", (s) => { s.hostPlayerId = null; }],
  ["PLAYING shape", (s) => { s.game = null; }],
  ["settings schema", (s) => { s.settingsSchema.bluff = 9; }],
  ["settings slot", (s) => { delete (s.gameSettings as Partial<RoomState["gameSettings"]>).likely; }],
  ["duplicate tvGames", (s) => { s.tvGames = [{ id: "mishana", v: 1 }, { id: "mishana", v: 1 }]; }],
  ["stars of a stranger", (s) => { s.cup.stars[pid(9)] = 3; }],
  ["stars value", (s) => { s.cup.stars[pid(0)] = 0; }],
  ["instance n", (s) => { (s.game as { n: number }).n = 0; }],
  ["game invariants", (s) => { ((s.game as { state: { players: { seat: number }[] } }).state.players[1] as { seat: number }).seat = 0; }],
  ["history length", (_s, h) => { h.games = Array.from({ length: 21 }, (_, n) => ({ gameId: "mishana", n, ranking: [], endedAt: 0 })); }],
  ["memory length", (_s, h) => { h.memory.mishana = { usedKeys: Array.from({ length: 301 }, (_, i) => `k${i}`) }; }],
];

describe("assertRoomInvariants", () => {
  it("accepts a valid PLAYING room", () => {
    const { s, h } = base();
    expect(() => assertRoomInvariants(s, h)).not.toThrow();
  });
  it.each(BREAKS)("rejects: %s", (_n, brk) => {
    const { s, h } = base();
    brk(s, h);
    expect(() => assertRoomInvariants(s, h)).toThrow(Error);
  });
  it("rejects HUB/SETUP shapes and left members outside PLAYING", () => {
    const { s } = base();
    const hub = { ...s, phase: "HUB" as const };
    expect(() => assertRoomInvariants(hub)).toThrow(RoomInvariantError);
    const setup = { ...s, phase: "SETUP" as const };
    expect(() => assertRoomInvariants(setup)).toThrow(RoomInvariantError);
    const left = { ...s, phase: "SETUP" as const, game: null, members: s.members.map((m, i) => (i === 2 ? { ...m, left: true, connected: false, disconnectedAt: 1 } : m)) };
    expect(() => assertRoomInvariants(left)).toThrow(RoomInvariantError);
    const unknownGame = { ...s, phase: "SETUP" as const, game: null, setupGameId: "chess" as "mishana" };
    expect(() => assertRoomInvariants(unknownGame)).toThrow(RoomInvariantError);
  });
});
