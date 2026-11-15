// JAMAA-PLATFORM §8.3 / §7.5: POST /api/client-errors (size cap, rate limit, scrub, AE + Stats) and the admin monitoring
// routes + page (auth, billing-independent, CSP).
import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_TOKEN_MIN_CHARS, handleAdmin } from "../../src/admin";
import type { AdminDeps } from "../../src/admin";
import type { BillingStore } from "../../src/billing/billing-core";
import type { Env } from "../../src/env";
import { handleAdminPage } from "../../src/monitor/admin-page";
import { CLIENT_ERROR_MAX_BYTES, handleClientErrors, MESSAGE_MAX, scrub } from "../../src/monitor/client-errors";
import { parseClientHeader } from "../../src/monitor/events";
import { forwardAllowed, resetMonitorBinding, SERVER_FORWARDS_PER_MIN } from "../../src/monitor/report";
import type { StatsApi } from "../../src/monitor/stats-api";
import type { StatsInput, StatsSnapshot } from "../../src/monitor/stats-core";
import { fakeEnv } from "../support/env";

const TOKEN = "t".repeat(ADMIN_TOKEN_MIN_CHARS + 8);

function fakeStats(snap?: Partial<StatsSnapshot>): StatsApi & { got: StatsInput[] } {
  const got: StatsInput[] = [];
  return {
    got,
    ingest: async (e) => void got.push(...e),
    snapshot: async () => ({ now: 0, live: { rooms: 2, games: 1, players: 4, byGame: { mishana: 1 } }, today: { rooms_created: 10, players_joined: 20 }, lastHour: {}, hours: [], errors: [], alerts: [], ...snap }),
    evaluate: async () => ({ incidents: {}, notify: [], open: [] }),
  };
}
function envWith(stats: StatsApi | null, over: Partial<Env> = {}): { env: Env; points: AnalyticsEngineDataPoint[] } {
  const points: AnalyticsEngineDataPoint[] = [];
  const ns = stats ? ({ getByName: () => stats } as unknown as Env["STATS"]) : undefined;
  const env = fakeEnv({ EVENTS: { writeDataPoint: (p) => void points.push(p ?? {}) }, ...(ns ? { STATS: ns } : {}), ...over });
  return { env, points };
}
function report(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://play.example/api/client-errors", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  resetMonitorBinding();
});

describe("POST /api/client-errors", () => {
  it("accepts a compact report: 204, one structured log line, one AE point, one Stats entry", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const stats = fakeStats();
    const { env, points } = envWith(stats);
    const waits: Promise<unknown>[] = [];
    const res = await handleClientErrors(report({ p: "phone", v: "1.2.3", s: "PLAYING:mishana", k: "error", n: "TypeError", m: "x is undefined", st: "at f (https://a/assets/i.js:1:2)", r: "KXRT", c: 2 }), env, (p) => void waits.push(p), 1000);
    await Promise.all(waits);
    expect(res.status).toBe(204);
    const line = JSON.parse(String(warn.mock.calls[0]![0]));
    expect(line).toMatchObject({ code: "CLIENT_ERROR", platform: "phone", v: "1.2.3", screen: "PLAYING:mishana", name: "TypeError", roomCode: "KXRT", count: 2 });
    expect(points).toEqual([{ indexes: ["client_error"], blobs: ["client_error", "", "", "phone", "TypeError", "1.2.3", "PLAYING:mishana", "KXRT"], doubles: [0, 0, 2] }]);
    expect(stats.got).toEqual([{ t: "client_error", at: 1000, entry: expect.objectContaining({ code: "TypeError", platform: "phone", room: "KXRT" }) }]);
  });

  it("text/plain (sendBeacon) works; other content types, bad JSON and bad schema do not", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { env, points } = envWith(null);
    const noop = (): void => undefined;
    expect((await handleClientErrors(report({ p: "tv-web", m: "boom" }, { "Content-Type": "text/plain;charset=UTF-8" }), env, noop)).status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    // "Script error." (cross-origin, no details) and an empty report are accepted but not recorded.
    expect((await handleClientErrors(report({ p: "phone", m: "Script error." }), env, noop)).status).toBe(204);
    expect((await handleClientErrors(report({ p: "phone" }), env, noop)).status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    // The phone reporter omits `p`: it defaults to phone.
    expect((await handleClientErrors(report({ m: "from the phone", s: "/KXRT" }), env, noop)).status).toBe(204);
    expect(JSON.parse(String(warn.mock.calls[1]![0]))).toMatchObject({ platform: "phone", screen: "/KXRT" });
    expect(points).toHaveLength(2);
    expect((await handleClientErrors(report({ p: "tv-web" }, { "Content-Type": "application/x-www-form-urlencoded" }), env, noop)).status).toBe(415);
    expect((await handleClientErrors(report("{nope"), env, noop)).status).toBe(400);
    expect((await handleClientErrors(report({ p: "desktop" }), env, noop)).status).toBe(400);
    expect((await handleClientErrors(report({ p: "phone", r: "kxrt!" }), env, noop)).status).toBe(400);
    expect((await handleClientErrors(new Request("https://play.example/api/client-errors"), env, noop)).status).toBe(405);
  });

  it("size cap: a body over CLIENT_ERROR_MAX_BYTES is 413 (declared or streamed)", async () => {
    const { env } = envWith(null);
    const big = { p: "phone", m: "x".repeat(CLIENT_ERROR_MAX_BYTES) };
    expect((await handleClientErrors(report(big), env, () => undefined)).status).toBe(413);
  });

  it("rate limit per IP (CLIENT_ERROR_LIMITER) → 429 before the body is read; a foreign Origin → 403", async () => {
    const keys: string[] = [];
    const { env } = envWith(null, { CLIENT_ERROR_LIMITER: { limit: async ({ key }) => (keys.push(key), { success: false }) } });
    expect((await handleClientErrors(report({ p: "phone" }, { "CF-Connecting-IP": "203.0.113.9" }), env, () => undefined)).status).toBe(429);
    expect(keys).toEqual(["203.0.113.9"]);
    const { env: env2 } = envWith(null);
    expect((await handleClientErrors(report({ p: "phone" }, { Origin: "https://evil.example" }), env2, () => undefined)).status).toBe(403);
  });

  it("scrubs PII-shaped strings and truncates", async () => {
    expect(scrub("mail a.b@x.co at https://j.am/KXRT?t=secret#frag, token " + "a1".repeat(20) + " id 12345678", 500))
      .toBe("mail [email] at https://j.am/KXRT?[…] token [hex] id [n]");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await handleClientErrors(report({ p: "phone", m: "oops ".repeat(300), n: "Type<script>Error" }), envWith(null).env, () => undefined);
    const line = JSON.parse(String(warn.mock.calls[0]![0]));
    expect(line.message).toHaveLength(MESSAGE_MAX);
    expect(line.name).toBe("TypescriptError");
  });
});

describe("X-Jamaa-Client", () => {
  it("parses platform/version; anything else is unknown", () => {
    expect(parseClientHeader("tv-android/1.0.0")).toEqual({ platform: "tv-android", version: "1.0.0" });
    expect(parseClientHeader("tv-pixi/web")).toEqual({ platform: "tv-pixi", version: "web" });
    expect(parseClientHeader("ios/1")).toEqual({ platform: "unknown", version: null });
    expect(parseClientHeader(null)).toEqual({ platform: "unknown", version: null });
  });
});

describe("server error forwarding cap", () => {
  it("at most SERVER_FORWARDS_PER_MIN per isolate per minute", () => {
    let n = 0;
    for (let i = 0; i < 50; i++) if (forwardAllowed(1000)) n++;
    expect(n).toBe(SERVER_FORWARDS_PER_MIN);
    expect(forwardAllowed(61_000)).toBe(true);
  });
});

describe("admin monitoring routes", () => {
  const store = (() => { throw new Error("billing store unused"); }) as unknown as () => BillingStore;
  const deps = (stats: StatsApi | null): AdminDeps => ({ store, now: () => 0, stats: () => stats });
  const get = (path: string, auth: string | null = `Bearer ${TOKEN}`, method = "GET") =>
    new Request(`https://play.example/api/admin/${path}`, { method, headers: auth ? { Authorization: auth } : {} });

  it("token unset or short → 404; wrong token → 401; right token → 200, with billing OFF", async () => {
    for (const ADMIN_TOKEN of [undefined, "short"]) {
      expect((await handleAdmin(get("overview"), envWith(fakeStats(), { ADMIN_TOKEN, BILLING_ENABLED: "0" }).env, deps(fakeStats()))).status).toBe(404);
    }
    const { env } = envWith(fakeStats(), { ADMIN_TOKEN: TOKEN, BILLING_ENABLED: "0" });
    expect((await handleAdmin(get("overview", null), env, deps(fakeStats()))).status).toBe(401);
    expect((await handleAdmin(get("overview", "Bearer nope"), env, deps(fakeStats()))).status).toBe(401);
    const ok = await handleAdmin(get("overview"), env, deps(fakeStats()));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Cache-Control")).toBe("no-store");
    const body = await ok.json() as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.stats.live).toEqual({ rooms: 2, games: 1, players: 4, byGame: { mishana: 1 } });
    expect(body.quota).toMatchObject({ estimate: 10 * 4 + 20 * 4, limit: 100_000, estimated: true });
    expect(body.alerting.email).toBe(false);
    expect(body.billing).toBe(false);
    // grants stay billing-only
    expect((await handleAdmin(get("grants"), env, deps(fakeStats()))).status).toBe(404);
    expect((await handleAdmin(get("overview", `Bearer ${TOKEN}`, "POST"), env, deps(fakeStats()))).status).toBe(405);
  });

  it("errors route; a missing STATS binding still answers (the page says so)", async () => {
    const { env } = envWith(null, { ADMIN_TOKEN: TOKEN });
    const r = await handleAdmin(get("errors"), env, deps(null));
    expect(await r.json()).toEqual({ errors: [] });
    const o = (await (await handleAdmin(get("overview"), env, deps(null))).json()) as { stats: unknown; bindings: { stats: boolean } };
    expect(o).toMatchObject({ stats: null, bindings: { stats: false } });
  });

  it("the guess is rate-limited before the token check", async () => {
    const { env } = envWith(fakeStats(), { ADMIN_TOKEN: TOKEN, BILLING_LIMITER: { limit: async () => ({ success: false }) } });
    expect((await handleAdmin(get("overview"), env, deps(fakeStats()))).status).toBe(429);
  });
});

describe("GET /admin page", () => {
  it("404 without a token; HTML + script with a strict CSP; never the token in a URL", async () => {
    expect(handleAdminPage(new Request("https://play.example/admin"), fakeEnv()).status).toBe(404);
    const env = fakeEnv({ ADMIN_TOKEN: TOKEN });
    const page = handleAdminPage(new Request("https://play.example/admin"), env);
    expect(page.status).toBe(200);
    expect(page.headers.get("Content-Security-Policy")).toContain("script-src 'self'");
    expect(page.headers.get("Cache-Control")).toBe("no-store");
    const html = await page.text();
    expect(html).toContain('<script src="/admin/app.js"></script>');
    expect(html).not.toMatch(/<script>(?!<)/);
    const js = await handleAdminPage(new Request("https://play.example/admin/app.js"), env).text();
    expect(js).toContain("sessionStorage");
    expect(js).toContain('Authorization:"Bearer "+t');
    expect(js).not.toMatch(/[?&]token=/);
    expect(handleAdminPage(new Request("https://play.example/admin/other"), env).status).toBe(404);
  });
});
