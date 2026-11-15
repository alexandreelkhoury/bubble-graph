// JAMAA-PLATFORM §8.2: the Stats DO core — live counters (start/end/TTL), idempotency, batched writes, error ring.
import { describe, expect, it } from "vitest";
import type { RoomEvent } from "../../src/monitor/events";
import { ALERT_DEFAULTS } from "../../src/monitor/alerts";
import { ERRORS_KEPT, ERROR_DEDUPE_MS, FLUSH_DELAY_MS, GAME_LIVE_TTL_MS, HOUR_MS, ROOM_LIVE_TTL_MS, StatsCore } from "../../src/monitor/stats-core";
import type { StatsInput, StatsStorage } from "../../src/monitor/stats-core";

const T0 = Date.UTC(2026, 10, 15, 10, 5);

class MemStorage implements StatsStorage {
  map = new Map<string, unknown>();
  puts: string[][] = [];
  alarms: number[] = [];
  async get<T>(k: string): Promise<T | undefined> { return structuredClone(this.map.get(k)) as T | undefined; }
  async put(e: Record<string, unknown>): Promise<void> {
    this.puts.push(Object.keys(e).sort());
    for (const [k, v] of Object.entries(e)) this.map.set(k, structuredClone(v));
  }
  async setAlarm(at: number): Promise<void> { this.alarms.push(at); }
}

const room = (code: string, at = T0): RoomEvent => ({ t: "room_created", room: `${code}:${at}`, at, locale: "en", platform: "tv-android" });
const start = (code: string, n: number, at: number, players = 4): RoomEvent => ({
  t: "game_started", room: `${code}:${T0}`, game: `${code}:${T0}:${n}:${at}`, at, gameId: "mishana", players, locale: "en", platform: "tv-web", joins: players,
});
const end = (code: string, n: number, startAt: number, at: number, reason: "finished" | "aborted" = "finished"): RoomEvent => ({
  t: "game_ended", room: `${code}:${T0}`, game: `${code}:${T0}:${n}:${startAt}`, at, gameId: "mishana", players: 4, durationMs: at - startAt, reason, platform: "tv-web", joins: 0,
});

describe("StatsCore live counters", () => {
  it("start/end: rooms and games live now, today's counts by game", async () => {
    const c = new StatsCore(new MemStorage());
    await c.ingest([room("ABCD"), room("EFGH"), start("ABCD", 1, T0 + 1000)], T0 + 1000);
    let s = await c.snapshot(T0 + 2000);
    expect(s.live).toEqual({ rooms: 2, games: 1, players: 4, byGame: { mishana: 1 } });
    await c.ingest([end("ABCD", 1, T0 + 1000, T0 + 60_000)], T0 + 60_000);
    s = await c.snapshot(T0 + 60_000);
    expect(s.live.games).toBe(0);
    expect(s.today).toMatchObject({ rooms_created: 2, games_started: 1, "started:mishana": 1, "finished:mishana": 1, "ended:finished": 1, players_joined: 4 });
    await c.ingest([{ t: "room_closed", room: `ABCD:${T0}`, at: T0 + 70_000, reason: "expired", joins: 1 }], T0 + 70_000);
    s = await c.snapshot(T0 + 70_000);
    expect(s.live.rooms).toBe(1);
    expect(s.today.players_joined).toBe(5);
  });

  it("duplicated pings are counted once (idempotent ids)", async () => {
    const c = new StatsCore(new MemStorage());
    await c.ingest([room("ABCD"), room("ABCD"), start("ABCD", 1, T0), start("ABCD", 1, T0)], T0);
    await c.ingest([end("ABCD", 1, T0, T0 + 5), end("ABCD", 1, T0, T0 + 5)], T0 + 5);
    const s = await c.snapshot(T0 + 10);
    expect(s.today).toMatchObject({ rooms_created: 1, games_started: 1, "ended:finished": 1 });
  });

  it("TTL: a room or game whose end ping never came stops counting", async () => {
    const c = new StatsCore(new MemStorage());
    await c.ingest([room("ABCD"), start("ABCD", 1, T0)], T0);
    expect((await c.snapshot(T0 + GAME_LIVE_TTL_MS)).live).toMatchObject({ rooms: 1, games: 1 });
    expect((await c.snapshot(T0 + GAME_LIVE_TTL_MS + 1)).live).toMatchObject({ rooms: 1, games: 0 });
    expect((await c.snapshot(T0 + ROOM_LIVE_TTL_MS + 1)).live).toMatchObject({ rooms: 0, games: 0 });
  });

  it("room_closed also ends that room's live games", async () => {
    const c = new StatsCore(new MemStorage());
    await c.ingest([room("ABCD"), start("ABCD", 1, T0), { t: "room_closed", room: `ABCD:${T0}`, at: T0 + 1, reason: "expired", joins: 0 }], T0 + 1);
    expect((await c.snapshot(T0 + 2)).live).toMatchObject({ rooms: 0, games: 0 });
  });

  it("writes are batched: one alarm, one put of the changed keys; state survives a reload", async () => {
    const st = new MemStorage();
    const c = new StatsCore(st);
    for (let i = 0; i < 20; i++) await c.ingest([room(`R${String(i).padStart(3, "0")}`, T0 + i)], T0 + i);
    expect(st.puts).toHaveLength(0);
    expect(st.alarms).toEqual([T0 + FLUSH_DELAY_MS]);
    await c.flush();
    expect(st.puts).toEqual([["hours", "rooms", "seen"]]);
    await c.flush();
    expect(st.puts).toHaveLength(1); // nothing dirty
    const reloaded = new StatsCore(st);
    expect((await reloaded.snapshot(T0 + 100)).live.rooms).toBe(20);
  });

  it("player_joined / player_left are Analytics Engine only (no Stats write)", async () => {
    const st = new MemStorage();
    const c = new StatsCore(st);
    await c.ingest([{ t: "player_joined", room: "A:1", at: T0, platform: "tv-web" }], T0);
    expect(st.alarms).toHaveLength(0);
  });

  it("keeps HOURS_KEPT hours; lastHour is the previous complete hour", async () => {
    const c = new StatsCore(new MemStorage());
    await c.ingest([room("ABCD", T0)], T0);
    const s = await c.snapshot(T0 + HOUR_MS);
    expect(s.lastHour.rooms_created).toBe(1);
    expect(s.hours).toHaveLength(24);
    expect((await c.snapshot(T0 + 49 * HOUR_MS)).hours.every((h) => Object.keys(h.c).length === 0)).toBe(true);
  });
});

describe("StatsCore error ring", () => {
  const cerr = (at: number, message = "x is undefined"): StatsInput => ({ t: "client_error", at, entry: { code: "TypeError", platform: "phone", message } });

  it("dedupes the same error within ERROR_DEDUPE_MS, counts every report", async () => {
    const c = new StatsCore(new MemStorage());
    await c.ingest([cerr(T0), cerr(T0 + 1000), cerr(T0 + 2000, "other")], T0 + 2000);
    await c.ingest([cerr(T0 + 2000 + ERROR_DEDUPE_MS)], T0 + 2000 + ERROR_DEDUPE_MS);
    const s = await c.snapshot(T0 + 2000 + ERROR_DEDUPE_MS);
    expect(s.errors.map((e) => [e.message, e.n])).toEqual([["x is undefined", 1], ["other", 1], ["x is undefined", 2]]);
    expect(s.today.client_errors).toBe(4);
  });

  it("keeps the last ERRORS_KEPT", async () => {
    const c = new StatsCore(new MemStorage());
    const evs: StatsInput[] = [];
    for (let i = 0; i < ERRORS_KEPT + 20; i++) evs.push({ t: "server_error", at: T0, entry: { code: `E${i}` } });
    await c.ingest(evs, T0);
    const s = await c.snapshot(T0);
    expect(s.errors).toHaveLength(ERRORS_KEPT);
    expect(s.errors[0]!.code).toBe(`E${ERRORS_KEPT + 19}`);
    expect(s.today.server_errors).toBe(ERRORS_KEPT + 20);
  });
});

describe("StatsCore.evaluate", () => {
  it("stores the incidents and notifies once", async () => {
    const st = new MemStorage();
    const c = new StatsCore(st);
    const evs: StatsInput[] = [];
    for (let i = 0; i < 25; i++) evs.push({ t: "server_error", at: T0, entry: { code: "INTERNAL", message: `m${i}` } });
    await c.ingest(evs, T0);
    const r1 = await c.evaluate(T0 + HOUR_MS, ALERT_DEFAULTS);
    expect(r1.notify.map((i) => i.rule)).toEqual(["server_errors"]);
    expect(st.map.has("alerts")).toBe(true);
    const r2 = await new StatsCore(st).evaluate(T0 + HOUR_MS + 1, ALERT_DEFAULTS);
    expect(r2.notify).toEqual([]);
    expect(r2.open).toHaveLength(1);
  });
});
