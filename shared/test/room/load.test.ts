// JAMAA-PLATFORM §2.6 normalize-on-load (shared/room `normalizeLoaded`): schema guard, settings normalize, game-state
// schema reset, unknown ids dropped. The server tests drive the same code through RoomCore.
import { describe, expect, it } from "vitest";
import { GAME_META } from "../../src/games/meta";
import { createRoomHistory, normalizeLoaded } from "../../src/room";
import { pid, RoomHarness } from "../../src/testing";

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function playing(): RoomHarness {
  const h = new RoomHarness({ seed: 3 });
  for (let i = 0; i < 4; i++) h.join(pid(i), `P${i}`, (["coral", "azure", "lemon", "jade"] as const)[i]!);
  h.tv({ type: "OPEN_GAME", gameId: "mishana" });
  h.tv({ type: "START_GAME" });
  return h;
}

describe("normalizeLoaded (§2.6)", () => {
  it("a state without schema 2 (or not an object) → expired", () => {
    expect(normalizeLoaded({ schema: 1 }, null, 0)).toEqual({ ok: false, reason: "SCHEMA" });
    expect(normalizeLoaded(null, null, 0)).toEqual({ ok: false, reason: "SCHEMA" });
    expect(normalizeLoaded("x", null, 0)).toEqual({ ok: false, reason: "SCHEMA" });
  });
  it("returns the same objects when nothing needs fixing", () => {
    const h = playing();
    const r = normalizeLoaded(h.state, h.history, h.now);
    expect(r.ok && r.state === h.state && r.history === h.history && !r.changed && !r.gameSchemaReset).toBe(true);
  });
  it("a missing history becomes an empty one (changed)", () => {
    const h = new RoomHarness();
    const r = normalizeLoaded(h.state, null, h.now);
    expect(r.ok && r.changed).toBe(true);
    if (r.ok) expect(r.history).toEqual(createRoomHistory());
  });
  it("normalizes settings slots, drops unknown ids from tvGames, the cup, history and the setup game", () => {
    const h = new RoomHarness();
    const s = clone(h.state) as unknown as Record<string, unknown> & { gameSettings: Record<string, unknown>; tvGames: unknown[]; cup: Record<string, unknown> };
    s.gameSettings = { mishana: { clueSeconds: "x" }, chess: {} };
    s.tvGames = [...s.tvGames, { id: "chess", v: 1 }];
    s.cup = { stars: {}, last: { gameId: "chess", n: 1, ranking: [], points: {} }, matchScores: { chess: {} } };
    s.setupGameId = "chess";
    s.phase = "SETUP";
    const hist = { memory: { chess: { usedKeys: [] } }, games: [{ gameId: "chess", n: 1, ranking: [], endedAt: 0 }] };
    const r = normalizeLoaded(s, hist, 0);
    if (!r.ok) throw new Error("expired");
    expect(r.changed).toBe(true);
    expect(r.state.gameSettings.mishana.clueSeconds).toBe(GAME_META.mishana.settings.defaults.clueSeconds);
    expect(Object.keys(r.state.gameSettings)).toEqual(["mishana", "bluff", "likely", "trivia"]);
    expect(r.state.tvGames.some((g) => (g.id as string) === "chess")).toBe(false);
    expect(r.state.cup.last).toBeNull();
    expect(r.state.cup.matchScores).toEqual({});
    expect(r.state.phase).toBe("HUB");
    expect(r.state.setupGameId).toBeNull();
    expect(r.history).toEqual({ memory: {}, games: [] });
    expect(r.state.version).toBe(h.state.version + 1);
  });
  it("a game-state schema mismatch aborts to SETUP: left members removed, benched dealt back, absent seats restart", () => {
    const h = playing();
    h.join(pid(9), "Late", "grape");                          // benched
    h.p(pid(3), { type: "LEAVE" });                            // left
    h.sys({ type: "DISCONNECT", playerId: pid(2) });
    const s = clone(h.state);
    (s.game!.state as { schema: number }).schema = 999;
    const r = normalizeLoaded(s, h.history, h.now + 5);
    if (!r.ok) throw new Error("expired");
    expect(r.gameSchemaReset).toBe(true);
    expect(r.state.phase).toBe("SETUP");
    expect(r.state.game).toBeNull();
    expect(r.state.members.map((m) => m.id)).not.toContain(pid(3));
    expect(r.state.members.find((m) => m.id === pid(9))?.benched).toBe(false);
    expect(r.state.members.find((m) => m.id === pid(2))?.disconnectedAt).toBe(h.now + 5);
  });
  it("an unknown running game id resets too", () => {
    const h = playing();
    const s = clone(h.state) as unknown as { game: { id: string }; setupGameId: string };
    s.game.id = "chess";
    const r = normalizeLoaded(s, h.history, h.now);
    expect(r.ok && r.gameSchemaReset).toBe(true);
  });
});
