// JAMAA-PLATFORM §8.7–§8.9: admin history (AE SQL API + cache), content stats, game toggles (merge, audit, config and
// room creation honour them) and the room inspector route.
import { afterEach, describe, expect, it } from "vitest";
import { REGISTRY_ENABLED } from "@jamaa/shared/games/registry";
import { ADMIN_TOKEN_MIN_CHARS, handleAdmin } from "../../src/admin";
import type { AdminDeps, InspectStub } from "../../src/admin";
import type { BillingStore } from "../../src/billing/billing-core";
import { effectiveGames, GAMES_OVERRIDE_TTL_MS, gamesOverride, handleConfig, mergeGames, setGamesOverrideCache } from "../../src/config";
import type { Env } from "../../src/env";
import { createRoom } from "../../src/http";
import type { InitRoomArgs } from "../../src/room-core";
import { AdminStoreCore, AUDIT_KEPT, CACHE_KEYS_MAX, sanitizeOverride } from "../../src/monitor/admin-store";
import { AE_SQL_URL, aeDataset, CONNECT_HELP, contentSql, HISTORY_TTL_MS, historySql } from "../../src/monitor/history";
import type { AdminStoreApi, StatsApi } from "../../src/monitor/stats-api";
import type { StatsSnapshot } from "../../src/monitor/stats-core";
import { fakeEnv } from "../support/env";

const TOKEN = "t".repeat(ADMIN_TOKEN_MIN_CHARS + 8);
const ACCOUNT = "0e3069b0e41fcc0463f6f603c3a1a0d1";
const AE_TOKEN = "ae-read-token-0123456789abcdef";

class MapStorage {
  map = new Map<string, unknown>();
  async get<T>(k: string): Promise<T | undefined> { return structuredClone(this.map.get(k)) as T | undefined; }
  async put(e: Record<string, unknown>): Promise<void> { for (const [k, v] of Object.entries(e)) this.map.set(k, structuredClone(v)); }
}

/** The Stats DO's admin RPCs over AdminStoreCore, with a controllable clock (what stats-do.ts does with Date.now()). */
function fakeAdmin(clock = { now: 0 }): AdminStoreApi & { core: AdminStoreCore; clock: { now: number } } {
  const core = new AdminStoreCore(new MapStorage());
  return {
    core, clock,
    gamesOverride: () => core.gamesOverride(),
    setGame: (g, e) => core.setGame(g, e, clock.now),
    auditLog: () => core.audit(),
    cacheGet: async (k) => core.cacheGet(k, clock.now),
    cachePut: async (k, v, ttl) => core.cachePut(k, v, clock.now, ttl),
  };
}
function fakeStats(errors: StatsSnapshot["errors"] = []): StatsApi {
  return {
    ingest: async () => undefined,
    snapshot: async () => ({ now: 0, live: { rooms: 0, games: 0, players: 0, byGame: {} }, today: {}, lastHour: {}, hours: [], errors, alerts: [] }),
    evaluate: async () => ({ incidents: {}, notify: [], open: [] }),
  };
}
const store = (() => { throw new Error("billing store unused"); }) as unknown as () => BillingStore;
const req = (path: string, init: RequestInit & { auth?: string | null } = {}): Request =>
  new Request(`https://play.example/api/admin/${path}`, { ...init, headers: { ...(init.auth === null ? {} : { Authorization: init.auth ?? `Bearer ${TOKEN}` }), ...(init.body ? { "Content-Type": "application/json" } : {}) } });
const env = (over: Partial<Env> = {}): Env => fakeEnv({ ADMIN_TOKEN: TOKEN, BILLING_ENABLED: "0", GAMES_ENABLED: "mishana,bluff,trivia", ...over });

afterEach(() => setGamesOverrideCache(null));

describe("admin routes: auth", () => {
  it("every new route is 404 without ADMIN_TOKEN and 401 without the bearer", async () => {
    const deps: AdminDeps = { store, now: () => 0, admin: () => fakeAdmin(), stats: () => fakeStats(), room: async () => ({ adminInspect: async () => ({}) }) };
    for (const path of ["history", "content?days=30", "games", "room?code=KXRT"]) {
      expect((await handleAdmin(req(path), fakeEnv({ BILLING_ENABLED: "0" }), deps)).status).toBe(404);
      expect((await handleAdmin(req(path, { auth: null }), env(), deps)).status).toBe(401);
      expect((await handleAdmin(req(path, { auth: "Bearer wrong" }), env(), deps)).status).toBe(401);
      expect((await handleAdmin(req(path), env(), deps)).status).toBe(200);
    }
    expect((await handleAdmin(req("games", { method: "POST", auth: null, body: JSON.stringify({ gameId: "bluff", enabled: false }) }), env(), deps)).status).toBe(401);
    expect((await handleAdmin(req("history", { method: "DELETE" }), env(), deps)).status).toBe(405);
  });
});

describe("history (Analytics Engine SQL API)", () => {
  it("SQL: fixed dataset, event filter, weighted counts, integer window, JSON format", () => {
    const q = historySql(90);
    expect(Object.keys(q).sort()).toEqual(["ends", "gamesPerDay", "languages", "platforms", "players", "roomsPerDay"]);
    expect(q.gamesPerDay).toBe("SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, blob2 AS game, SUM(_sample_interval) AS n FROM jamaa_events WHERE index1 = 'game_started' AND timestamp > NOW() - INTERVAL '90' DAY GROUP BY day, game ORDER BY day FORMAT JSON");
    expect(q.ends).toContain("SUM(_sample_interval * double2) AS dur FROM jamaa_events WHERE index1 = 'game_ended'");
    expect(q.platforms).toContain("blob4 AS platform");
    expect(q.players).toContain("double1 AS players");
    expect(historySql(7.9).roomsPerDay).toContain("INTERVAL '7' DAY");
    expect(contentSql(30)).toBe("SELECT blob2 AS game, blob7 AS pack, blob8 AS item, blob5 AS action, SUM(_sample_interval) AS n FROM jamaa_events WHERE index1 = 'content_flag' AND timestamp > NOW() - INTERVAL '30' DAY GROUP BY game, pack, item, action ORDER BY n DESC LIMIT 100 FORMAT JSON");
  });

  it("SQL dataset: the AE_DATASET var (production jamaa_events_prod); unset or not an identifier → jamaa_events", () => {
    expect(aeDataset({ AE_DATASET: "jamaa_events_prod" })).toBe("jamaa_events_prod");
    expect(aeDataset({})).toBe("jamaa_events");
    expect(aeDataset({ AE_DATASET: "x; DROP" })).toBe("jamaa_events");
    expect(historySql(90, "jamaa_events_prod").roomsPerDay).toContain("FROM jamaa_events_prod WHERE");
    expect(contentSql(30, "jamaa_events_prod")).toContain("FROM jamaa_events_prod WHERE");
  });

  it("no token → connect help (no API call); with it → one POST per panel to the account's SQL URL, then cached 5 min", async () => {
    const calls: { url: string; auth: string | null; body: string }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url, auth: new Headers(init.headers).get("Authorization"), body: String(init.body) });
      return new Response(JSON.stringify({ data: [{ game: "bluff", n: "3", day: "2026-11-14 00:00:00" }] }));
    }) as unknown as typeof fetch;
    const admin = fakeAdmin();
    const deps: AdminDeps = { store, now: () => admin.clock.now, admin: () => admin, fetch: f };
    const off = await (await handleAdmin(req("history"), env(), deps)).json();
    expect(off).toEqual({ connected: false, help: CONNECT_HELP });
    expect(CONNECT_HELP).toContain("Account › Account Analytics › Read");
    expect(calls).toEqual([]);
    const on = env({ CF_ACCOUNT_ID: ACCOUNT, CF_ANALYTICS_TOKEN: AE_TOKEN });
    const a = (await (await handleAdmin(req("history"), on, deps)).json()) as Record<string, unknown>;
    expect(a).toMatchObject({ connected: true, cached: false, days: 90, gamesPerDay: [{ game: "bluff", n: 3, day: "2026-11-14 00:00:00" }] });
    expect(calls).toHaveLength(6);
    expect(new Set(calls.map((c) => c.url))).toEqual(new Set([AE_SQL_URL(ACCOUNT)]));
    expect(calls.every((c) => c.auth === `Bearer ${AE_TOKEN}`)).toBe(true);
    expect(JSON.stringify(a)).not.toContain(AE_TOKEN);
    admin.clock.now += HISTORY_TTL_MS - 1;
    expect(await (await handleAdmin(req("history"), on, deps)).json()).toMatchObject({ cached: true, at: 0 });
    expect(calls).toHaveLength(6);
    admin.clock.now += 1;
    await handleAdmin(req("history"), on, deps);
    expect(calls).toHaveLength(12);
  });

  it("API errors are reported (not cached); content takes days 30 or 90 only", async () => {
    let status = 403;
    const f = (async () => (status === 200 ? new Response(JSON.stringify({ data: [{ game: "trivia", pack: "world-mix-01-en", item: "q007", action: "void", n: 4 }] })) : new Response("no", { status }))) as unknown as typeof fetch;
    const admin = fakeAdmin();
    const deps: AdminDeps = { store, now: () => 0, admin: () => admin, fetch: f };
    const on = env({ CF_ACCOUNT_ID: ACCOUNT, CF_ANALYTICS_TOKEN: AE_TOKEN });
    expect(await (await handleAdmin(req("history"), on, deps)).json()).toEqual({ connected: true, error: "AE_HTTP_403: no" });
    expect(await (await handleAdmin(req("content?days=30"), on, deps)).json()).toEqual({ connected: true, error: "AE_HTTP_403: no" });
    status = 200;
    expect(await (await handleAdmin(req("content?days=90"), on, deps)).json()).toMatchObject({ connected: true, days: 90, items: [{ game: "trivia", pack: "world-mix-01-en", item: "q007", action: "void", n: 4 }] });
    for (const d of ["7", "abc", "-30"]) expect((await handleAdmin(req(`content?days=${d}`), on, deps)).status).toBe(400);
  });

  it("the cache keeps at most CACHE_KEYS_MAX keys and expires by TTL", () => {
    const c = new AdminStoreCore(new MapStorage());
    c.cachePut("a", 1, 0, 100);
    expect(c.cacheGet("a", 99)).toEqual({ at: 0, value: 1 });
    expect(c.cacheGet("a", 100)).toBeNull();
    for (let i = 0; i < CACHE_KEYS_MAX + 5; i++) c.cachePut(`k${i}`, i, 0, 1000);
    expect(c.cacheGet("k0", 1)).toBeNull();
    expect(c.cacheGet(`k${CACHE_KEYS_MAX + 4}`, 1)).toEqual({ at: 0, value: CACHE_KEYS_MAX + 4 });
  });
});

describe("game toggles", () => {
  it("merge: env is the default; the override turns any known game on or off; registry still applies", () => {
    expect(mergeGames(["mishana", "bluff"], {})).toEqual(REGISTRY_ENABLED.filter((g) => g === "mishana" || g === "bluff"));
    expect(mergeGames(["mishana", "bluff"], { bluff: false, taqriban: true })).toEqual(REGISTRY_ENABLED.filter((g) => g === "mishana" || g === "taqriban"));
    expect(sanitizeOverride({ bluff: false, chess: true, likely: "yes", trivia: true })).toEqual({ bluff: false, trivia: true });
    expect(sanitizeOverride(null)).toEqual({});
  });

  it("POST sets an override + audit entry; null resets; unknown ids and bad bodies are 400", async () => {
    const admin = fakeAdmin({ now: 5 });
    const deps: AdminDeps = { store, now: () => 5, admin: () => admin };
    const post = (body: unknown) => handleAdmin(req("games", { method: "POST", body: JSON.stringify(body) }), env(), deps);
    const r = (await (await post({ gameId: "bluff", enabled: false })).json()) as Record<string, unknown>;
    expect(r).toMatchObject({ env: ["mishana", "bluff", "trivia"], override: { bluff: false }, effective: REGISTRY_ENABLED.filter((g) => g === "mishana" || g === "trivia") });
    expect(r.audit).toEqual([{ at: 5, gameId: "bluff", enabled: false, before: null }]);
    await post({ gameId: "likely", enabled: true });
    const back = (await (await post({ gameId: "bluff", enabled: null })).json()) as Record<string, unknown>;
    expect(back.override).toEqual({ likely: true });
    expect((back.audit as unknown[])[0]).toEqual({ at: 5, gameId: "bluff", enabled: null, before: false });
    for (const bad of [{ gameId: "chess", enabled: true }, { gameId: "bluff" }, { gameId: "bluff", enabled: "on" }, { gameId: "bluff", enabled: true, x: 1 }]) {
      expect((await post(bad)).status).toBe(400);
    }
    expect((await handleAdmin(req("games", { method: "POST", body: JSON.stringify({ gameId: "bluff", enabled: true }) }), env(), { store, now: () => 0, admin: () => null })).status).toBe(409);
  });

  it("the audit log keeps the newest AUDIT_KEPT entries", async () => {
    const c = new AdminStoreCore(new MapStorage());
    for (let i = 0; i < AUDIT_KEPT + 3; i++) await c.setGame("bluff", i % 2 === 0, i);
    const a = await c.audit();
    expect(a).toHaveLength(AUDIT_KEPT);
    expect(a[0]!.at).toBe(AUDIT_KEPT + 2);
  });

  it("GET /api/config and room creation honour the override through a ≤ 60 s per-isolate cache; one Stats read per TTL", async () => {
    expect(GAMES_OVERRIDE_TTL_MS).toBeLessThanOrEqual(60_000);
    const admin = fakeAdmin();
    let reads = 0;
    const ns = { getByName: () => ({ ...admin, gamesOverride: () => (reads++, admin.gamesOverride()) }) } as unknown as Env["STATS"];
    const e = env({ STATS: ns });
    expect(await effectiveGames(e, 1000)).toEqual(REGISTRY_ENABLED.filter((g) => ["mishana", "bluff", "trivia"].includes(g)));
    await admin.setGame("trivia", false);
    expect(await effectiveGames(e, 1000 + GAMES_OVERRIDE_TTL_MS - 1)).toContain("trivia"); // still cached
    expect(reads).toBe(1);
    setGamesOverrideCache(null);
    const cfg = (await (await handleConfig(new Request("https://play.example/api/config"), e)).json()) as { games: string[] };
    expect(cfg.games).not.toContain("trivia");
    expect(reads).toBe(2);
    // POST /api/rooms stores the merged list in the room.
    let args: InitRoomArgs | null = null;
    const res = await createRoom(new Request("https://play.example/api/rooms", { method: "POST" }), e, {
      getStub: async () => ({ initRoom: async (a: InitRoomArgs) => ((args = a), { ok: true as const }) }), randomBytes: (n) => new Uint8Array(n).fill(7), now: () => Date.now(),
    });
    expect(res.status).toBe(201);
    expect(args!.enabledGames).toEqual(cfg.games);
  });

  it("a failing Stats read keeps the last known override; no STATS binding = none", async () => {
    let fail = false;
    const admin = fakeAdmin();
    await admin.setGame("bluff", false);
    const ns = { getByName: () => ({ gamesOverride: () => (fail ? Promise.reject(new Error("down")) : admin.gamesOverride()) }) } as unknown as Env["STATS"];
    expect(await gamesOverride({ STATS: ns }, 0)).toEqual({ bluff: false });
    fail = true;
    expect(await gamesOverride({ STATS: ns }, GAMES_OVERRIDE_TTL_MS)).toEqual({ bluff: false });
    setGamesOverrideCache(null);
    expect(await gamesOverride({}, 0)).toEqual({});
  });
});

describe("room inspector route", () => {
  it("validates the code, calls the Room DO's adminInspect, adds that room's errors only", async () => {
    const seen: string[] = [];
    const room = async (code: string): Promise<InspectStub> => (seen.push(code), { adminInspect: async () => ({ code, exists: true }) });
    const errors = [{ kind: "client" as const, at: 1, last: 1, n: 1, code: "TypeError", room: "KXRT" }, { kind: "client" as const, at: 1, last: 1, n: 1, code: "X", room: "ABCD" }];
    const deps: AdminDeps = { store, now: () => 0, stats: () => fakeStats(errors), room };
    const r = (await (await handleAdmin(req("room?code=kxrt"), env(), deps)).json()) as { room: unknown; errors: { room: string }[] };
    expect(seen).toEqual(["KXRT"]);
    expect(r.room).toEqual({ code: "KXRT", exists: true });
    expect(r.errors.map((e) => e.room)).toEqual(["KXRT"]);
    for (const bad of ["", "KX", "KXRTT", "KXR1", "IIII"]) expect((await handleAdmin(req(`room?code=${bad}`), env(), deps)).status).toBe(400);
    expect(seen).toEqual(["KXRT"]);
    expect((await handleAdmin(req("room?code=KXRT"), env(), { store, now: () => 0 })).status).toBe(404);
  });
});
