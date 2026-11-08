// JAMAA-PLATFORM §2.5 / §2.6 / §2.8 (server): RoomCore on RoomState + RoomHistory (two keys), normalize-on-load and the
// schema guards, GAMES_ENABLED runtime rules, TV capability negotiation, the ephemeral HUB_FOCUS, and one full session
// over the real protocol.
import { describe, expect, it } from "vitest";
import { GAME_META } from "@jamaa/shared/games/meta";
import type { GameId } from "@jamaa/shared/games/ids";
import { Harness, seqs, strictlyIncreasing } from "./support/fakes";
import type { FakeConn, FakeStorage } from "./support/fakes";

const MISHANA_ONLY = [{ id: "mishana" as const, v: GAME_META.mishana.VIEW_VERSION }];
const room = (c: FakeConn) => c.lastView().room as { phase: string; setupGameId: string | null; focusedGameId: string; games: { id: string }[]; cup: { stars: Record<string, number> } };

/** Records which storage keys every put writes. */
function recordPuts(storage: FakeStorage): string[][] {
  const log: string[][] = [];
  const orig = storage.put.bind(storage);
  storage.put = async (k: string | Record<string, unknown>, v?: unknown) => {
    log.push(typeof k === "string" ? [k] : Object.keys(k));
    return orig(k, v);
  };
  return log;
}

describe("storage: two keys (§2.3, §2.6)", () => {
  it("`state` is rewritten on every change; `history` only at game end, REPLAY or ABORT", async () => {
    const h = await new Harness().init();
    const { tv, ps } = await h.startedGame({ n: 4, ready: true });
    const puts = recordPuts(h.storage);
    await h.game(tv, { type: "HOST_ADVANCE" });
    expect(puts.flat()).toContain("state");
    expect(puts.flat()).not.toContain("history");
    puts.length = 0;
    await h.playToResults(tv, ps);
    // The step that reached RESULTS wrote the cup history (and the memory) once.
    expect(puts.filter((k) => k.includes("history"))).toHaveLength(1);
    expect(h.history.games).toHaveLength(1);
    expect(h.history.memory.mishana?.usedKeys.length).toBe(1);
    puts.length = 0;
    await h.act(tv, { type: "REPLAY" });
    expect(puts.filter((k) => k.includes("history")).length).toBeLessThanOrEqual(1);
    puts.length = 0;
    await h.act(tv, { type: "ABORT_GAME" });
    expect(h.room.phase).toBe("SETUP");
    expect(h.history.memory.mishana?.usedKeys.length).toBe(2);
    expect(await h.storage.get("history")).toEqual(h.history);
  });

  it("a stored state without `schema: 2` (a v1 room) expires the room: ROOM_EXPIRED + 4010, storage wiped", async () => {
    const h = await new Harness().init();
    const state = (await h.storage.get<Record<string, unknown>>("state"))!;
    await h.storage.put({ state: { ...state, schema: 1, players: [], phase: "LOBBY" } });
    h.core = h.makeCore();
    const c = await h.connect();
    expect(c.errors()).toEqual(["ROOM_EXPIRED"]);
    expect(c.closeCode).toBe(4010);
    expect(h.storage.map.size).toBe(0);
    expect(h.logs.map((l) => l.code)).toContain("room_schema_expired");
  });

  it("a stale settings shape normalizes on load (missing, extra and wrong-typed keys; unknown and missing game slots)", async () => {
    const h = await new Harness().init();
    await h.tv();
    const state = (await h.storage.get<Record<string, unknown>>("state"))!;
    const gs = state.gameSettings as Record<string, Record<string, unknown>>;
    const stale = { ...gs.mishana, clueSeconds: "fast", legacy: true } as Record<string, unknown>;
    delete stale.voteSeconds;
    const { trivia: _t, ...rest } = gs;
    void _t;
    await h.storage.put({ state: { ...state, gameSettings: { ...rest, mishana: stale, chess: { depth: 3 } } } });
    h.core = h.makeCore();
    await h.core.start();
    const s = h.room.gameSettings;
    expect(Object.keys(s)).toEqual(["mishana", "bluff", "likely", "trivia"]);
    expect(s.mishana.clueSeconds).toBe(GAME_META.mishana.settings.defaults.clueSeconds);
    expect(s.mishana.voteSeconds).toBe(GAME_META.mishana.settings.defaults.voteSeconds);
    expect("legacy" in s.mishana).toBe(false);
    expect(s.trivia).toEqual(GAME_META.trivia.settings.defaults);
    // start() persisted the fixed records.
    expect((await h.storage.get<{ gameSettings: Record<string, unknown> }>("state"))!.gameSettings).toEqual(s);
  });

  it("a fifth GameId added by a deploy gets defaults (a slot missing from storage is filled per key)", async () => {
    const h = await new Harness().init();
    const state = (await h.storage.get<Record<string, unknown>>("state"))!;
    const gs = { ...(state.gameSettings as Record<string, unknown>) };
    const ss = { ...(state.settingsSchema as Record<string, unknown>) };
    delete gs.likely;
    delete ss.likely;
    await h.storage.put({ state: { ...state, gameSettings: gs, settingsSchema: ss } });
    h.core = h.makeCore();
    await h.core.start();
    expect(h.room.gameSettings.likely).toEqual(GAME_META.likely.settings.defaults);
    expect(h.room.settingsSchema.likely).toBe(GAME_META.likely.SETTINGS_SCHEMA);
  });

  it("a game-state schema mismatch aborts to SETUP on load (no stars, matchScores and memory kept) and logs game_schema_reset", async () => {
    const h = await new Harness().init();
    const { tv, ps } = await h.startedGame({ n: 4 });
    await h.playToResults(tv, ps);
    await h.act(tv, { type: "REPLAY" });
    const stars = { ...h.room.cup.stars };
    const scores = structuredClone(h.room.cup.matchScores);
    const memory = structuredClone(h.history.memory);
    const state = (await h.storage.get<{ game: { state: Record<string, unknown> } }>("state"))!;
    state.game.state.schema = 999;
    await h.storage.put({ state });
    h.core = h.makeCore();
    await h.core.start();
    expect(h.room.phase).toBe("SETUP");
    expect(h.room.game).toBeNull();
    expect(h.room.cup.stars).toEqual(stars);
    expect(h.room.cup.matchScores).toEqual(scores);
    expect(h.history.memory).toEqual(memory);
    expect(h.logs.find((l) => l.code === "game_schema_reset")?.fields).toEqual({ phase: "SETUP" });
    expect((await h.storage.get<{ phase: string }>("state"))!.phase).toBe("SETUP");
    expect((tv.lastView().room as { phase: string }).phase).toBe("SETUP");
  });
});

describe("GAMES_ENABLED at runtime (§2.6) and TV capability (§2.5)", () => {
  it("a game removed by a redeploy: a room in SETUP for it returns to HUB on its next write and it leaves room.games", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const p = await h.player(0);
    await h.open(tv);
    expect(h.room.phase).toBe("SETUP");
    h.enabledGames = [];
    h.core = h.makeCore();
    await h.core.start();
    // The next write happens on wake-up at the latest (start() or the alarm it schedules at once).
    if (h.room.phase === "SETUP") {
      expect(h.storage.alarm).toBe(h.now + 250);
      h.advance(250);
      await h.core.onAlarm();
    }
    expect(h.room.phase).toBe("HUB");
    expect((await h.storage.get<{ phase: string }>("state"))!.phase).toBe("HUB");
    expect(h.room.setupGameId).toBeNull();
    expect(room(p.conn).games).toEqual([]);
    await h.open(tv);
    expect(tv.errors()).toEqual(["GAME_DISABLED"]);
  });

  it("an instance already PLAYING finishes normally after its game leaves GAMES_ENABLED", async () => {
    const h = await new Harness().init();
    const { tv, ps } = await h.startedGame({ n: 4 });
    h.enabledGames = [];
    h.core = h.makeCore();
    await h.core.start();
    await h.playToResults(tv, ps);
    expect(h.room.phase).toBe("PLAYING");
    expect(h.room.cup.last?.gameId).toBe("mishana");
    await h.act(tv, { type: "BACK_TO_SETUP" });
    expect(h.room.phase).toBe("HUB"); // its SETUP is no longer offered
  });

  it("a TV without bluff never sees bluff in room.games, and OPEN_GAME bluff → GAME_UNAVAILABLE", async () => {
    const h = await new Harness({ enabledGames: ["mishana", "bluff"] as GameId[] }).init();
    const tv = await h.tv(MISHANA_ONLY);
    const p = await h.player(0);
    expect(h.room.tvGames).toEqual(MISHANA_ONLY);
    expect(room(tv).games.map((g) => g.id)).toEqual(["mishana"]);
    expect(room(p.conn).games.map((g) => g.id)).toEqual(["mishana"]);
    await h.open(tv, "bluff");
    await h.open(p.conn, "bluff");
    expect(tv.errors()).toEqual(["GAME_UNAVAILABLE"]);
    expect(p.conn.errors()).toEqual(["GAME_UNAVAILABLE"]);
    await h.act(tv, { type: "HUB_FOCUS", gameId: "bluff" });
    expect(tv.errors().at(-1)).toBe("GAME_UNAVAILABLE");
  });

  it("a TV whose view version differs from the server's does not get that game", async () => {
    const h = await new Harness().init();
    const tv = await h.tv([{ id: "mishana", v: GAME_META.mishana.VIEW_VERSION + 1 }]);
    expect(room(tv).games).toEqual([]);
    await h.open(tv);
    expect(tv.errors()).toEqual(["GAME_UNAVAILABLE"]);
    // A replacing TV build with the right version re-negotiates.
    const tv2 = await h.tv(MISHANA_ONLY);
    expect(room(tv2).games.map((g) => g.id)).toEqual(["mishana"]);
  });

  it("OPEN_GAME: UNKNOWN_GAME for an unknown id, GAME_DISABLED for a stub", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    await h.open(tv, "chess" as GameId);
    await h.open(tv, "trivia");
    expect(tv.errors()).toEqual(["UNKNOWN_GAME", "GAME_DISABLED"]);
  });

  it("GAME for another game → WRONG_GAME; outside PLAYING → NOT_IN_GAME", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    await h.act(tv, { type: "GAME", gameId: "mishana", i: { type: "HOST_ADVANCE" } });
    expect(tv.errors()).toEqual(["NOT_IN_GAME"]);
    const { ps } = await h.startedGame({ n: 3 });
    void ps;
    const tv2 = h.conns.all.find((c) => c.open && c.state?.role === "tv")!;
    await h.act(tv2, { type: "GAME", gameId: "trivia", i: { type: "END_GAME" } } as never);
    expect(tv2.errors().at(-1)).toBe("BAD_MESSAGE"); // stub intent schemas accept nothing (z.never)
    await h.act(tv2, { type: "GAME", gameId: "bluff", i: {} } as never);
    expect(tv2.errors().at(-1)).toBe("BAD_MESSAGE");
  });
});

describe("HUB_FOCUS (§2.3, §2.8 hub/meta)", () => {
  it("a focus change is broadcast without a write, and seq stays increasing across a reload", async () => {
    const h = await new Harness({ enabledGames: ["mishana", "bluff"] as GameId[] }).init();
    const tv = await h.tv();
    const p = await h.player(0);
    await h.act(tv, { type: "HUB_FOCUS", gameId: "bluff" }); // first focus after init: no headroom write needed
    expect(room(p.conn).focusedGameId).toBe("bluff");
    const puts = recordPuts(h.storage);
    await h.act(tv, { type: "HUB_FOCUS", gameId: "mishana" });
    await h.act(tv, { type: "HUB_FOCUS", gameId: "bluff" });
    expect(puts).toEqual([]);
    expect(room(p.conn).focusedGameId).toBe("bluff");
    expect(h.core.peek().focusedGameId).toBe("bluff");
    // Hibernation: the focus is ephemeral (back to the default), and the next frame is still higher.
    const last = seqs(p.conn).at(-1)!;
    h.core = h.makeCore();
    await h.act(tv, { type: "HUB_FOCUS", gameId: "mishana" });
    await h.act(tv, { type: "HUB_FOCUS", gameId: "bluff" });
    expect(seqs(p.conn).at(-1)!).toBeGreaterThan(last);
    expect(strictlyIncreasing(seqs(p.conn))).toBe(true);
    expect(strictlyIncreasing(seqs(tv))).toBe(true);
    // From a phone: NOT_HOST (the TV's carousel only); outside HUB: WRONG_PHASE.
    await h.act(p.conn, { type: "HUB_FOCUS", gameId: "mishana" });
    expect(p.conn.errors()).toEqual(["NOT_HOST"]);
    await h.open(tv);
    await h.act(tv, { type: "HUB_FOCUS", gameId: "mishana" });
    expect(tv.errors()).toEqual(["WRONG_PHASE"]);
  });
});

describe("one full session over the real protocol (§2.8 server)", () => {
  it("hub → mishana → replay → hub → bluff (a stub until G2: GAME_DISABLED), cup arithmetic and seq everywhere", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const ps = [];
    for (let i = 0; i < 4; i++) ps.push(await h.player(i));
    expect(room(tv).phase).toBe("HUB");
    await h.open(tv);
    await h.settings(tv, { clueSeconds: 0, voteSeconds: 0, revealSeconds: 0, guessSeconds: 0 });
    await h.act(tv, { type: "START_GAME" });
    expect(room(tv).phase).toBe("PLAYING");
    await h.playToResults(tv, ps);
    const first = h.room.cup.last!;
    expect(first.n).toBe(1);
    const stars1 = Object.values(h.room.cup.stars).reduce((a, b) => a + b, 0);
    expect(stars1).toBeGreaterThan(0);
    await h.act(tv, { type: "REPLAY" });
    expect(h.room.game?.n).toBe(2);
    // carriesScore: Mish Ana! seeds the new instance's scores from matchScores.
    for (const p of h.state.players) expect(p.score).toBe(h.room.cup.matchScores.mishana?.[p.id] ?? 0);
    await h.playToResults(tv, ps);
    expect(h.room.cup.last?.n).toBe(2);
    expect(h.history.games.map((g) => g.n)).toEqual([1, 2]);
    await h.act(tv, { type: "BACK_TO_HUB" });
    expect(room(tv).phase).toBe("HUB");
    expect(room(tv).focusedGameId).toBe("mishana");
    expect(Object.values(room(ps[0]!.conn).cup.stars).reduce((a, b) => a + b, 0)).toBeGreaterThan(stars1);
    await h.open(tv, "bluff");
    expect(tv.errors()).toEqual(["GAME_DISABLED"]);
    for (const c of [tv, ...ps.map((p) => p.conn)]) {
      expect(strictlyIncreasing(seqs(c))).toBe(true);
      expect(c.errors().filter((e) => e !== "GAME_DISABLED")).toEqual([]);
    }
  });
});
