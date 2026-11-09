// Bluff inside the room (JAMAA-PLATFORM §2.3–§2.5, §2.8): hub → setup → play over `GAME {gameId:"bluff", i}` → cup →
// REPLAY with no repeated prompt; benched late joiner admitted through `join`; LEAVE while playing; ABORT keeps memory;
// host powers from the VIP; the generic room leak checker after every step (synthetic token catalog).
import { describe, expect, it } from "vitest";
import type { BluffState } from "../../../src/games/bluff/engine/state";
import type { RoomAction } from "../../../src/room/types";
import { bluffProgressIntent } from "../../../src/testing/bots/bluff";
import { bluffTokenCatalog } from "../../../src/testing/catalogs/bluff";
import { findRoomLeaks, RoomHarness } from "../../../src/testing";
import { TEST_CATALOG, TEST_FREE_CATALOG } from "../../../src/testing/test-catalog";
import { withBluff } from "./fixture-scenario";

const COLORS = ["coral", "azure", "jade", "lemon", "grape", "tangerine"] as const;
const id = (i: number): string => `p_b100${String(i).padStart(2, "0")}`;

function room(players = 4): RoomHarness {
  const cat = bluffTokenCatalog();
  const h = new RoomHarness({ seed: 99, content: withBluff(TEST_FREE_CATALOG, cat), fullContent: withBluff(TEST_CATALOG, cat), enabledGames: ["mishana", "bluff"] });
  for (let i = 0; i < players; i++) h.join(id(i), `Bot ${i}`, COLORS[i] as (typeof COLORS)[number]);
  return h;
}
const game = (h: RoomHarness): BluffState => (h.state.game as { state: BluffState }).state;
function step(h: RoomHarness, a: RoomAction): void {
  h.do(a);
  h.now += 500;
  expect(findRoomLeaks(h)).toEqual([]);
}
/** Plays the active instance to RESULTS through the room; the VIP (first member) sends the host intents. */
function playToResults(h: RoomHarness, vip = false): void {
  for (let guard = 0; guard < 600; guard++) {
    const s = game(h);
    if (s.phase === "RESULTS") return;
    const n = bluffProgressIntent(s);
    if (n === null) {
      h.tick(Math.max(0, (s.deadline ?? h.now) - h.now));
      expect(findRoomLeaks(h)).toEqual([]);
      continue;
    }
    const by = n.by === null ? (vip && h.state.hostPlayerId ? { kind: "player" as const, playerId: h.state.hostPlayerId } : { kind: "tv" as const }) : { kind: "player" as const, playerId: n.by };
    step(h, { type: "GAME", gameId: "bluff", i: n.i, by } as RoomAction);
  }
  throw new Error("Bluff instance did not finish");
}

describe("Bluff in the room", () => {
  it("hub → setup → a full game → stars from the outcome → REPLAY without repeating a prompt", () => {
    const h = room(4);
    step(h, { type: "OPEN_GAME", gameId: "bluff", by: { kind: "tv" } });
    const setup = h.tvView().room.setup as { extras: { gameId: string; available: number; bigGroup: boolean } } | null;
    expect(setup?.extras).toMatchObject({ gameId: "bluff", bigGroup: false });
    step(h, { type: "UPDATE_GAME_SETTINGS", gameId: "bluff", patch: { length: "short" }, by: { kind: "tv" } } as RoomAction);
    step(h, { type: "START_GAME", by: { kind: "tv" } });
    expect(h.state.phase).toBe("PLAYING");
    expect(game(h).phase).toBe("ROUND_INTRO");
    // Another game's intent is refused while Bluff runs.
    expect(h.err({ type: "GAME", gameId: "mishana", i: { type: "READY" }, by: { kind: "player", playerId: id(1) } } as RoomAction)).toBe("WRONG_GAME");
    playToResults(h, true);
    const out = h.state.cup.last;
    expect(out?.gameId).toBe("bluff");
    const pts = Object.fromEntries(game(h).players.map((p) => [p.id, p.score]));
    expect(out?.points).toEqual(pts);
    const first = new Set(game(h).drawn);
    step(h, { type: "REPLAY", by: { kind: "tv" } });
    expect(game(h).players.every((p) => p.score === 0)).toBe(true);           // carriesScore: false
    playToResults(h);
    for (const item of game(h).drawn) expect(first.has(item)).toBe(false);    // memory.usedKeys across REPLAY
    expect(h.history.memory.bluff?.usedKeys.length).toBeGreaterThanOrEqual(first.size * 2);
    step(h, { type: "BACK_TO_HUB", by: { kind: "tv" } });
    expect(h.state.game).toBeNull();
  });

  it("a late joiner is benched, admitted through `join`, waits for the next WRITING, then plays", () => {
    const h = room(3);
    step(h, { type: "OPEN_GAME", gameId: "bluff", by: { kind: "tv" } });
    step(h, { type: "START_GAME", by: { kind: "tv" } });
    h.tick(Math.max(0, (game(h).deadline ?? h.now) - h.now));
    expect(game(h).phase).toBe("WRITING");
    h.join(id(5), "Late", "tangerine");
    expect(h.state.members.find((m) => m.id === id(5))?.benched).toBe(false);
    const me = h.playerView(id(5)).game?.me as { waitingForNext: boolean } | null;
    expect(me?.waitingForNext).toBe(true);
    expect(findRoomLeaks(h)).toEqual([]);
    for (let k = 0; k < 40 && !(game(h).phase === "WRITING" && game(h).promptIndex === 1); k++) {
      const n = bluffProgressIntent(game(h));
      if (n) step(h, { type: "GAME", gameId: "bluff", i: n.i, by: n.by ? { kind: "player", playerId: n.by } : { kind: "tv" } } as RoomAction);
      else h.tick(Math.max(0, (game(h).deadline ?? h.now) - h.now));
    }
    expect((h.playerView(id(5)).game?.me as { waitingForNext: boolean }).waitingForNext).toBe(false);
    expect((h.tvView().game?.public as { newIds: string[] }).newIds).toEqual([id(5)]);
  });

  it("LEAVE while playing keeps the game going; ABORT keeps the memory and gives no stars", () => {
    const h = room(4);
    step(h, { type: "OPEN_GAME", gameId: "bluff", by: { kind: "tv" } });
    step(h, { type: "START_GAME", by: { kind: "tv" } });
    h.tick(Math.max(0, (game(h).deadline ?? h.now) - h.now));
    step(h, { type: "LEAVE", by: { kind: "player", playerId: id(3) } });
    expect(game(h).players.find((p) => p.id === id(3))?.left).toBe(true);
    const drawn = game(h).drawn;
    step(h, { type: "ABORT_GAME", by: { kind: "tv" } });
    expect(h.state.phase).toBe("SETUP");
    expect(h.state.cup.stars).toEqual({});
    for (const item of drawn) expect(h.history.memory.bluff?.usedKeys).toContain(item);
  });

  it("start is blocked under 3 connected players", () => {
    const h = room(2);
    step(h, { type: "OPEN_GAME", gameId: "bluff", by: { kind: "tv" } });
    expect(h.err({ type: "START_GAME", by: { kind: "tv" } })).toBe("NOT_ENOUGH_PLAYERS");
  });

  it("a room without bluff in its enabled games cannot open it", () => {
    const cat = bluffTokenCatalog();
    const h = new RoomHarness({ content: withBluff(TEST_FREE_CATALOG, cat), fullContent: withBluff(TEST_CATALOG, cat), enabledGames: ["mishana"] });
    expect(h.err({ type: "OPEN_GAME", gameId: "bluff", by: { kind: "tv" } })).toBe("GAME_DISABLED");
  });
});
