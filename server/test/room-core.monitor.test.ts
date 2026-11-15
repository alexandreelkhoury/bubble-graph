// JAMAA-PLATFORM §8.1: the room lifecycle events RoomCore emits (a diff of what #persist writes, never per message).
import { describe, expect, it } from "vitest";
import { ROOM_TV_GONE_TTL_MS } from "@jamaa/shared/constants";
import type { RoomEvent } from "../src/monitor/events";
import { ROOM, Harness } from "./support/fakes";

const of = <T extends RoomEvent["t"]>(h: Harness, t: T): Extract<RoomEvent, { t: T }>[] =>
  h.events.filter((e): e is Extract<RoomEvent, { t: T }> => e.t === t);

describe("room monitoring events", () => {
  it("room_created once, with an idempotent id (code:createdAt) and the platform", async () => {
    const h = new Harness();
    await h.core.initRoom({ tvTokenHash: "0".repeat(64), joinUrl: `https://x.test/${ROOM}`, locale: "fr", now: h.now, entitlement: null, billingMode: "google", platform: "tv-android" });
    expect(h.events).toEqual([{ t: "room_created", room: `${ROOM}:${h.now}`, at: h.now, locale: "fr", platform: "tv-android" }]);
    expect(h.core.peek().meta).toMatchObject({ platform: "tv-android", joins: 0, joinsSent: 0, gameStartedAt: null });
  });

  it("joins, game start and finish: one event each, joins counted once, duration from the stored start time", async () => {
    const h = await new Harness().init();
    const { tv, ps } = await h.startedGame({ n: 3, ready: true });
    expect(of(h, "player_joined")).toHaveLength(3);
    const [started] = of(h, "game_started");
    expect(of(h, "game_started")).toHaveLength(1);
    expect(started).toMatchObject({ gameId: "mishana", players: 3, joins: 3, platform: "unknown", locale: "en" });
    expect(started?.game).toBe(`${ROOM}:${h.core.peek().meta!.createdAt}:${h.room.game!.n}:${started!.at}`);
    const startedAt = h.core.peek().meta!.gameStartedAt!;
    expect(startedAt).toBe(started!.at);
    expect((await h.storage.get<{ gameStartedAt: number }>("meta"))!.gameStartedAt).toBe(startedAt); // same atomic write
    await h.playToResults(tv, ps);
    const ended = of(h, "game_ended");
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({ reason: "finished", gameId: "mishana", players: 3, joins: 0, game: started!.game });
    expect(ended[0]!.durationMs).toBe(ended[0]!.at - startedAt);
    // Leaving the results screen ends no second time.
    await h.act(tv, { type: "BACK_TO_SETUP" });
    expect(of(h, "game_ended")).toHaveLength(1);
  });

  it("ABORT_GAME → aborted; REPLAY after a finish → a new instance", async () => {
    const h = await new Harness().init();
    const { tv, ps } = await h.startedGame({ n: 3, ready: true });
    await h.act(tv, { type: "ABORT_GAME" });
    expect(of(h, "game_ended").map((e) => e.reason)).toEqual(["aborted"]);
    await h.act(tv, { type: "START_GAME" });
    await h.playToResults(tv, ps);
    await h.act(tv, { type: "REPLAY" });
    expect(of(h, "game_ended").map((e) => e.reason)).toEqual(["aborted", "finished"]);
    const ids = of(h, "game_started").map((e) => e.game);
    expect([ids.length, tv.errors()]).toEqual([3, []]);
    expect(new Set(ids).size).toBe(3);
  });

  it("LEAVE → player_left; expiry → game_ended expired + room_closed with the unsent joins", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const a = await h.player(0);
    await h.player(1);
    await h.act(a.conn, { type: "LEAVE" });
    expect(of(h, "player_left")).toHaveLength(1);
    tv.open = false;
    await h.core.onClose(tv);
    h.advance(ROOM_TV_GONE_TTL_MS + 1);
    await h.core.onAlarm();
    const closed = of(h, "room_closed");
    expect(closed).toEqual([{ t: "room_closed", room: `${ROOM}:${closed[0]!.room.split(":")[1]}`, at: h.now, reason: "expired", joins: 2 }]);
    expect(of(h, "game_ended")).toHaveLength(0); // no game was running
  });

  it("a running game at expiry ends as expired", async () => {
    const h = await new Harness().init();
    const { tv } = await h.startedGame({ n: 3, ready: true });
    tv.open = false;
    await h.core.onClose(tv);
    h.advance(ROOM_TV_GONE_TTL_MS + 1);
    await h.core.onAlarm();
    expect(of(h, "game_ended").map((e) => e.reason)).toEqual(["expired"]);
    expect(of(h, "room_closed")[0]!.joins).toBe(0); // already reported with game_started
  });

  it("a throwing monitor never breaks the room", async () => {
    const h = new Harness();
    h.events = { push: () => { throw new Error("boom"); } } as unknown as RoomEvent[];
    await h.init();
    await h.tv();
    await h.player(0);
    expect(h.room.members).toHaveLength(1);
  });
});
