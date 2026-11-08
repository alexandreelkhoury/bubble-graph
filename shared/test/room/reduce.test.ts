// JAMAA-PLATFORM §2.3–§2.5 / §2.8: the room engine (permission matrix, membership, cup, REACT, contentLocale,
// GAMES_ENABLED and TV capability).
import { describe, expect, it } from "vitest";
import { REACTION_MIN_GAP_MS, SEAT_HOLD_MS } from "../../src/constants";
import type { ColorId } from "../../src/constants";
import { contentCatalog } from "../../src/content/catalog";
import { cupStars, nextRoomWakeAt, reduceRoom, roomGames } from "../../src/room";
import type { RoomAction, RoomIntent } from "../../src/room";
import { ALL_TV_GAMES, pid, RoomHarness, TEST_CATALOG } from "../../src/testing";
import type { ErrorCode } from "../../src/protocol/errors";

const COLORS: ColorId[] = ["coral", "azure", "lemon", "jade", "grape", "tangerine", "aqua", "rose", "mint", "plum", "sand", "lilac"];
const intent = (i: unknown): RoomIntent => ({ type: "GAME", gameId: "mishana", i });

function withMembers(n: number, h = new RoomHarness({ seed: 3 })): RoomHarness {
  for (let i = 0; i < n; i++) {
    h.now += 10;
    h.join(pid(i), `Player${i}`, COLORS[i] as ColorId);
  }
  return h;
}

type PhaseKey = "HUB" | "SETUP" | "PLAYING" | "OVER";
/** 5 members (pid 0 = VIP); pid 4 is disconnected (dealt in absent) for KICK cases. */
function at(phase: PhaseKey): RoomHarness {
  const h = withMembers(5);
  h.sys({ type: "DISCONNECT", playerId: pid(4) });
  if (phase === "HUB") return h;
  h.tv({ type: "OPEN_GAME", gameId: "mishana" });
  if (phase === "SETUP") return h;
  h.tv({ type: "START_GAME" });
  if (phase === "PLAYING") return h;
  h.playMishanaToResults();
  return h;
}

const ACTORS = { tv: { kind: "tv" }, vip: { kind: "player", playerId: pid(0) }, other: { kind: "player", playerId: pid(1) } } as const;
type ActorKey = keyof typeof ACTORS;
type Expect = "ok" | ErrorCode;

/** §2.5 permission matrix: intent → phase → actor → expected result. */
const MATRIX: { name: string; a: RoomIntent; exp: Record<PhaseKey, Record<ActorKey, Expect>> }[] = (() => {
  const host = (okPhases: PhaseKey[], wrong: ErrorCode = "WRONG_PHASE") => Object.fromEntries(
    (["HUB", "SETUP", "PLAYING", "OVER"] as PhaseKey[]).map((p) => [p, okPhases.includes(p) ? { tv: "ok", vip: "ok", other: "NOT_HOST" } : { tv: wrong, vip: wrong, other: wrong }]),
  ) as Record<PhaseKey, Record<ActorKey, Expect>>;
  const everyone = (tv: Expect) => ({ HUB: { tv, vip: "ok", other: "ok" }, SETUP: { tv, vip: "ok", other: "ok" }, PLAYING: { tv, vip: "ok", other: "ok" }, OVER: { tv, vip: "ok", other: "ok" } }) as Record<PhaseKey, Record<ActorKey, Expect>>;
  return [
    { name: "OPEN_GAME", a: { type: "OPEN_GAME", gameId: "mishana" }, exp: host(["HUB"]) },
    { name: "CLOSE_GAME", a: { type: "CLOSE_GAME" }, exp: host(["SETUP"]) },
    { name: "SET_CONTENT_LOCALE", a: { type: "SET_CONTENT_LOCALE", locale: "fr" }, exp: host(["HUB", "SETUP"]) },
    { name: "UPDATE_GAME_SETTINGS", a: { type: "UPDATE_GAME_SETTINGS", gameId: "mishana", patch: { revealRoles: true } }, exp: host(["SETUP"]) },
    { name: "START_GAME", a: { type: "START_GAME" }, exp: host(["SETUP"]) },
    {
      name: "GAME HOST_ADVANCE", a: intent({ type: "HOST_ADVANCE" }),
      exp: {
        HUB: { tv: "NOT_IN_GAME", vip: "NOT_IN_GAME", other: "NOT_IN_GAME" }, SETUP: { tv: "NOT_IN_GAME", vip: "NOT_IN_GAME", other: "NOT_IN_GAME" },
        PLAYING: { tv: "ok", vip: "ok", other: "NOT_HOST" }, OVER: { tv: "WRONG_PHASE", vip: "WRONG_PHASE", other: "WRONG_PHASE" },
      },
    },
    { name: "REPLAY", a: { type: "REPLAY" }, exp: host(["OVER"]) },
    { name: "BACK_TO_SETUP", a: { type: "BACK_TO_SETUP" }, exp: host(["OVER"]) },
    { name: "BACK_TO_HUB", a: { type: "BACK_TO_HUB" }, exp: host(["SETUP", "OVER"]) },
    { name: "ABORT_GAME", a: { type: "ABORT_GAME" }, exp: host(["PLAYING"]) },
    { name: "REACT", a: { type: "REACT", kind: "laugh" }, exp: everyone("BAD_MESSAGE") },
    { name: "LEAVE", a: { type: "LEAVE" }, exp: everyone("BAD_MESSAGE") },
    {
      name: "KICK (an absent member)", a: { type: "KICK", playerId: pid(4) },
      exp: Object.fromEntries((["HUB", "SETUP", "PLAYING", "OVER"] as PhaseKey[]).map((p) => [p, { tv: "ok", vip: "ok", other: "NOT_HOST" }])) as Record<PhaseKey, Record<ActorKey, Expect>>,
    },
    {
      name: "HUB_FOCUS", a: { type: "HUB_FOCUS", gameId: "mishana" },
      exp: Object.fromEntries((["HUB", "SETUP", "PLAYING", "OVER"] as PhaseKey[]).map((p) => [p, { tv: p === "HUB" ? "ok" : "WRONG_PHASE", vip: "NOT_HOST", other: "NOT_HOST" }])) as Record<PhaseKey, Record<ActorKey, Expect>>,
    },
  ];
})();

describe("room permission matrix (§2.5)", () => {
  const cases = MATRIX.flatMap((row) => (["HUB", "SETUP", "PLAYING", "OVER"] as PhaseKey[]).flatMap((phase) => (Object.keys(ACTORS) as ActorKey[]).map((actor) => [row.name, phase, actor, row] as const)));
  it.each(cases)("%s in %s by %s", (_n, phase, actor, row) => {
    const h = at(phase);
    const r = h.try({ ...row.a, by: ACTORS[actor] } as RoomAction);
    expect(r.ok ? "ok" : r.error).toBe(row.exp[phase][actor]);
  });
});

describe("membership (§2.3)", () => {
  it("join while PLAYING → benched (public view, no me) → dealt in at REPLAY", () => {
    const h = at("PLAYING");
    h.join(pid(9), "Late", "lilac");
    expect(h.state.members.find((m) => m.id === pid(9))).toMatchObject({ benched: true });
    expect(h.mishana().players.some((p) => p.id === pid(9))).toBe(false);
    const v = h.playerView(pid(9));
    expect(v.me).toEqual({ id: pid(9), benched: true });
    expect(v.game?.me).toBeNull();
    expect(v.game?.public).toEqual(h.tvView().game?.public);
    expect(h.err({ ...intent({ type: "READY" }), by: { kind: "player", playerId: pid(9) } })).toBe("NOT_IN_GAME");
    h.playMishanaToResults();
    h.tv({ type: "REPLAY" });
    expect(h.state.members.find((m) => m.id === pid(9))?.benched).toBe(false);
    expect(h.mishana().players.some((p) => p.id === pid(9))).toBe(true);
  });
  it("a benched member is removed at once by LEAVE; an in-game one is marked left and removed when the game ends", () => {
    const h = at("PLAYING");
    h.join(pid(9), "Late", "lilac");
    h.p(pid(9), { type: "LEAVE" });
    expect(h.state.members.some((m) => m.id === pid(9))).toBe(false);
    h.p(pid(2), { type: "LEAVE" });
    expect(h.state.members.find((m) => m.id === pid(2))).toMatchObject({ left: true, connected: false });
    expect(h.err({ type: "REACT", kind: "laugh", by: { kind: "player", playerId: pid(2) } })).toBe("BAD_MESSAGE");
    h.playMishanaToResults();
    h.tv({ type: "BACK_TO_SETUP" });
    expect(h.state.members.some((m) => m.id === pid(2))).toBe(false);
  });
  it("seats are held SEAT_HOLD_MS in HUB/SETUP, and for the whole game while PLAYING", () => {
    const h = withMembers(4);
    h.sys({ type: "DISCONNECT", playerId: pid(3) });
    expect(nextRoomWakeAt(h.state)).toBe(h.now + SEAT_HOLD_MS);
    h.tick(SEAT_HOLD_MS - 1);
    expect(h.state.members).toHaveLength(4);
    h.tick(1);
    expect(h.state.members).toHaveLength(3);
    const p = at("PLAYING");
    p.sys({ type: "DISCONNECT", playerId: pid(3) });
    p.now += SEAT_HOLD_MS * 3;
    p.sys({ type: "TICK" });
    expect(p.state.members.some((m) => m.id === pid(3))).toBe(true);
    p.sys({ type: "RECONNECT", playerId: pid(3) });
    expect(p.mishana().players.find((x) => x.id === pid(3))?.connected).toBe(true);
  });
  it("host: first joiner; reassigned to the earliest connected joiner on leave and on seat expiry", () => {
    const h = withMembers(3);
    expect(h.state.hostPlayerId).toBe(pid(0));
    h.sys({ type: "DISCONNECT", playerId: pid(1) });
    h.p(pid(0), { type: "LEAVE" });
    expect(h.state.hostPlayerId).toBe(pid(2));
    h.sys({ type: "DISCONNECT", playerId: pid(2) });
    h.tick(SEAT_HOLD_MS);
    expect(h.state.members).toHaveLength(0);
    expect(h.state.hostPlayerId).toBeNull();
  });
  it("while PLAYING the next host is a member in the game before a benched one", () => {
    const h = at("PLAYING");
    h.join(pid(9), "Late", "lilac");
    for (const i of [1, 2, 3]) h.sys({ type: "DISCONNECT", playerId: pid(i) });
    h.p(pid(0), { type: "LEAVE" });
    expect(h.state.hostPlayerId).toBe(pid(1));
  });
  it("join errors: ROOM_FULL, NAME_TAKEN, COLOR_TAKEN, NAME_INVALID, BAD_MESSAGE", () => {
    const h = withMembers(12);
    expect(h.err({ type: "JOIN", playerId: pid(20), name: "X", color: "coral", locale: "en", by: { kind: "system" } })).toBe("ROOM_FULL");
    const g = withMembers(2);
    expect(g.err({ type: "JOIN", playerId: pid(20), name: "player0", color: "plum", locale: "en", by: { kind: "system" } })).toBe("NAME_TAKEN");
    expect(g.err({ type: "JOIN", playerId: pid(20), name: "New", color: "coral", locale: "en", by: { kind: "system" } })).toBe("COLOR_TAKEN");
    expect(g.err({ type: "JOIN", playerId: pid(20), name: "  ", color: "plum", locale: "en", by: { kind: "system" } })).toBe("NAME_INVALID");
    expect(g.err({ type: "JOIN", playerId: pid(0), name: "Dup", color: "plum", locale: "en", by: { kind: "system" } })).toBe("BAD_MESSAGE");
    expect(g.err({ type: "JOIN", playerId: pid(20), name: "New", color: "nope" as ColorId, locale: "en", by: { kind: "system" } })).toBe("BAD_MESSAGE");
  });
  it("an unknown player actor is BAD_MESSAGE; system events for unknown members are no-ops", () => {
    const h = withMembers(1);
    expect(h.err({ type: "REACT", kind: "laugh", by: { kind: "player", playerId: pid(7) } })).toBe("BAD_MESSAGE");
    const before = h.state;
    h.sys({ type: "DISCONNECT", playerId: pid(7) });
    h.sys({ type: "RECONNECT", playerId: pid(0) });
    expect(h.state).toBe(before);
  });
  it("VIP KICK: only absent members while PLAYING, never themselves", () => {
    const h = at("PLAYING");
    expect(h.err({ type: "KICK", playerId: pid(2), by: ACTORS.vip })).toBe("INVALID_TARGET");
    expect(h.err({ type: "KICK", playerId: pid(0), by: ACTORS.vip })).toBe("INVALID_TARGET");
    expect(h.err({ type: "KICK", playerId: pid(8), by: ACTORS.tv })).toBe("INVALID_TARGET");
    const s = at("SETUP");
    s.p(pid(0), { type: "KICK", playerId: pid(2) });
    expect(s.state.members.some((m) => m.id === pid(2))).toBe(false);
  });
});

describe("session cup (§2.4)", () => {
  it("cupStars: competition ranking with ties; fewer than 3 ranked → only 1st", () => {
    expect(cupStars([["a"], ["b"], ["c"], ["d"]])).toEqual({ a: 3, b: 2, c: 1 });
    expect(cupStars([["a", "b", "c"]])).toEqual({ a: 3, b: 3, c: 3 });
    expect(cupStars([["a", "b"], ["c"], ["d"]])).toEqual({ a: 3, b: 3, c: 1 });
    expect(cupStars([["a"], ["b", "c"], ["d"]])).toEqual({ a: 3, b: 2, c: 2 });
    expect(cupStars([["a"], ["b"]])).toEqual({ a: 3 });
    expect(cupStars([])).toEqual({});
  });
  it("a finished instance awards stars once, updates matchScores, cup.last and history", () => {
    const h = at("PLAYING");
    h.playMishanaToResults();
    const out = h.state.cup.last;
    expect(out?.gameId).toBe("mishana");
    expect(out?.n).toBe(1);
    const stars = { ...h.state.cup.stars };
    expect(Object.values(stars).every((v) => v > 0)).toBe(true);
    const ranked = out?.ranking.flat() ?? [];
    for (const id of Object.keys(stars)) expect(ranked).toContain(id);
    for (const [id, pts] of Object.entries(out?.points ?? {})) if (pts === 0) expect(stars[id]).toBeUndefined();
    expect(h.state.cup.matchScores.mishana).toEqual(Object.fromEntries(Object.entries(out?.points ?? {})));
    expect(h.history.games).toHaveLength(1);
    expect(h.history.memory.mishana?.usedKeys.length).toBe(1);
    h.sys({ type: "TICK" });
    h.p(pid(1), { type: "REACT", kind: "cheer" });
    expect(h.state.cup.stars).toEqual(stars);   // never awarded twice
  });
  it("carriesScore: REPLAY seeds Mish Ana! scores from matchScores", () => {
    const h = at("PLAYING");
    h.playMishanaToResults();
    const ms = { ...h.state.cup.matchScores.mishana };
    h.tv({ type: "REPLAY" });
    for (const p of h.mishana().players) expect(p.score).toBe(ms[p.id] ?? 0);
  });
  it("ABORT gives no stars, keeps matchScores and keeps memory", () => {
    const h = at("PLAYING");
    h.tv({ type: "ABORT_GAME" });
    expect(h.state.phase).toBe("SETUP");
    expect(h.state.cup).toEqual({ stars: {}, last: null, matchScores: {} });
    expect(h.history.memory.mishana?.usedKeys).toHaveLength(1);
    expect(h.history.games).toEqual([]);
  });
  it("a removed member drops out of the cup", () => {
    const h = at("PLAYING");
    h.playMishanaToResults();
    const starred = Object.keys(h.state.cup.stars)[0] as string;
    h.tv({ type: "BACK_TO_HUB" });
    h.tv({ type: "KICK", playerId: starred });
    expect(h.state.cup.stars[starred]).toBeUndefined();
  });
});

describe("REACT (§2.5)", () => {
  it("increments n, and allows one per REACTION_MIN_GAP_MS per member", () => {
    const h = withMembers(2);
    h.p(pid(0), { type: "REACT", kind: "laugh" });
    expect(h.state.members[0]?.reaction).toEqual({ kind: "laugh", at: h.now, n: 1 });
    h.now += REACTION_MIN_GAP_MS - 1;
    expect(h.err({ type: "REACT", kind: "shock", by: ACTORS.vip })).toBe("REACTION_TOO_FAST");
    h.p(pid(1), { type: "REACT", kind: "sad" });
    h.now += 1;
    h.p(pid(0), { type: "REACT", kind: "shock" });
    expect(h.state.members[0]?.reaction).toMatchObject({ kind: "shock", n: 2 });
  });
});

describe("content language (§2.5 SET_CONTENT_LOCALE)", () => {
  it("resets pack filters that do not fit the new language", () => {
    const h = withMembers(3, new RoomHarness({ seed: 1, content: contentCatalog(TEST_CATALOG) }));
    h.tv({ type: "OPEN_GAME", gameId: "mishana" });
    h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "mishana", patch: { packIds: ["test-en-prem-01"] } });
    h.tv({ type: "SET_CONTENT_LOCALE", locale: "fr" });
    expect(h.state.contentLocale).toBe("fr");
    expect(h.state.gameSettings.mishana.packIds).toEqual(["en-everyday-01", "fr-everyday-01", "ar-everyday-01", "es-everyday-01"]);
    const keep = h.state.gameSettings.mishana;
    h.tv({ type: "SET_CONTENT_LOCALE", locale: "en" });
    expect(h.state.gameSettings.mishana).toEqual(keep);
  });
  it("UPDATE_GAME_SETTINGS: WRONG_GAME for another game; INVALID_SETTINGS from apply", () => {
    const h = at("SETUP");
    expect(h.err({ type: "UPDATE_GAME_SETTINGS", gameId: "bluff", patch: {}, by: ACTORS.tv })).toBe("WRONG_GAME");
    expect(h.err({ type: "UPDATE_GAME_SETTINGS", gameId: "mishana", patch: { clueSeconds: 1 }, by: ACTORS.tv })).toBe("INVALID_SETTINGS");
  });
});

describe("games offered (§2.5 TV capability, §2.6 GAMES_ENABLED)", () => {
  it("room.games = enabled ∩ the TV's games at the server VIEW_VERSION", () => {
    const h = new RoomHarness({ enabledGames: ["mishana", "bluff"], tvGames: [{ id: "mishana", v: 1 }] });
    expect(roomGames(h.state, h.enabledGames)).toEqual(["mishana"]);
    expect(h.err({ type: "OPEN_GAME", gameId: "bluff", by: ACTORS.tv })).toBe("GAME_UNAVAILABLE");
    expect(h.err({ type: "HUB_FOCUS", gameId: "bluff", by: ACTORS.tv })).toBe("GAME_UNAVAILABLE");
    h.sys({ type: "TV_GAMES", games: [{ id: "mishana", v: 1 }, { id: "bluff", v: 2 }] });
    expect(roomGames(h.state, h.enabledGames)).toEqual(["mishana"]);  // bluff at another VIEW_VERSION
    h.sys({ type: "TV_GAMES", games: [{ id: "mishana", v: 1 }, { id: "mishana", v: 1 }, { id: "chess" as "mishana", v: 1 }, { id: "bluff", v: 1 }] });
    expect(h.state.tvGames).toEqual([{ id: "mishana", v: 1 }, { id: "bluff", v: 1 }]);
    expect(roomGames(h.state, h.enabledGames)).toEqual(["mishana", "bluff"]);
    expect(h.tvView().room.games.map((g) => g.id)).toEqual(["mishana", "bluff"]);
  });
  it("OPEN_GAME: UNKNOWN_GAME, GAME_DISABLED, GAME_UNAVAILABLE without content in the language", () => {
    const h = withMembers(3);
    expect(h.err({ type: "OPEN_GAME", gameId: "chess", by: ACTORS.tv })).toBe("UNKNOWN_GAME");
    expect(h.err({ type: "HUB_FOCUS", gameId: "chess", by: ACTORS.tv })).toBe("UNKNOWN_GAME");
    expect(h.err({ type: "OPEN_GAME", gameId: "bluff", by: ACTORS.tv })).toBe("GAME_DISABLED");
    h.tv({ type: "SET_CONTENT_LOCALE", locale: "es" });
    expect(h.err({ type: "OPEN_GAME", gameId: "mishana", by: ACTORS.tv })).toBe("GAME_UNAVAILABLE");
    expect(h.tvView().room.games[0]?.available).toBe(false);
  });
  it("a room in SETUP for a game dropped from room.games returns to HUB on its next write; PLAYING finishes", () => {
    const h = at("SETUP");
    h.enabledGames = [];
    h.sys({ type: "TICK" });
    expect(h.state.phase).toBe("HUB");
    const p = at("PLAYING");
    p.enabledGames = [];
    p.tv(intent({ type: "HOST_ADVANCE" }));
    expect(p.state.phase).toBe("PLAYING");
  });
  it("HUB_FOCUS never changes RoomState (same object)", () => {
    const h = withMembers(2);
    const r = reduceRoom(h.state, { type: "HUB_FOCUS", gameId: "mishana", by: ACTORS.tv }, { now: h.now, content: h.content, enabledGames: h.enabledGames, access: h.access, history: h.history });
    expect(r.state).toBe(h.state);
    expect(r.history).toBe(h.history);
  });
  it("a TICK with nothing due returns the same objects", () => {
    const h = withMembers(2);
    const before = h.state;
    h.sys({ type: "TICK" });
    expect(h.state).toBe(before);
  });
  it("hello games of a current TV are every game at its VIEW_VERSION", () => {
    expect(ALL_TV_GAMES.map((g) => g.id)).toEqual(["mishana", "bluff", "likely", "trivia"]);
  });
});

describe("GAME routing", () => {
  it("WRONG_GAME for another game id; NOT_IN_GAME outside PLAYING", () => {
    const h = at("PLAYING");
    expect(h.err({ type: "GAME", gameId: "bluff", i: {}, by: ACTORS.tv })).toBe("WRONG_GAME");
    const s = at("SETUP");
    expect(s.err({ type: "GAME", gameId: "mishana", i: { type: "READY" }, by: ACTORS.vip })).toBe("NOT_IN_GAME");
  });
  it("START_GAME passes the game's start blocker through", () => {
    const h = withMembers(2);
    h.tv({ type: "OPEN_GAME", gameId: "mishana" });
    expect(h.err({ type: "START_GAME", by: ACTORS.tv })).toBe("NOT_ENOUGH_PLAYERS");
    expect(h.tvView().room.setup).toMatchObject({ canStart: false, startBlocker: "NOT_ENOUGH_PLAYERS" });
  });
  it("timers run through the room TICK (the game's nextWakeAt)", () => {
    const h = at("PLAYING");
    const at0 = nextRoomWakeAt(h.state) as number;
    expect(at0).toBe(h.mishana().deadline?.at);
    h.now = at0;
    h.sys({ type: "TICK" });
    expect(h.mishana().phase).toBe("CLUES");
  });
});

describe("access restriction (§4.4 RESTRICT_SETTINGS)", () => {
  it("resets premium keys and locked packs of the setup game in SETUP; never mid-game", () => {
    const h = at("SETUP");
    h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "mishana", patch: { points: { civilian: 5, undercover: 10, blank: 10 } } });
    h.sys({ type: "RESTRICT_SETTINGS" });
    expect(h.state.gameSettings.mishana.points.civilian).toBe(2);
    const before = h.state;
    h.sys({ type: "RESTRICT_SETTINGS" });
    expect(h.state).toBe(before);
    const hub = withMembers(1);
    const b2 = hub.state;
    hub.sys({ type: "RESTRICT_SETTINGS" });
    expect(hub.state).toBe(b2);
    const p = at("PLAYING");
    const b3 = p.state;
    p.sys({ type: "RESTRICT_SETTINGS" });
    expect(p.state).toBe(b3);
  });
});
