// PAYMENTS-SPEC §3.12: owner-only admin endpoints (/api/admin/grants) to comp premium and/or packs for specific
// installs without a Google purchase. Off (404) unless the optional ADMIN_TOKEN secret is set. The token travels only
// in the Authorization header, is compared in constant time and is never logged; grants are stored by install-id
// hash only (Billing DO `grants` table) and merged into the normal signed entitlement (BillingCore.entitlementFor).
import * as z from "zod";
import { MAX_TOKEN_PACKS, ROOM_CODE_REGEX } from "@jamaa/shared/constants";
import { GAME_IDS } from "@jamaa/shared/games/ids";
import { REGISTRY_ENABLED } from "@jamaa/shared/games/registry";
import { InstallIdSchema } from "@jamaa/shared/billing";
import type { BillingStore, Grant } from "./billing/billing-core";
import { billingPacks } from "./billing/catalog-info";
import { readJson } from "./billing/routes";
import { billingEnabled, enabledGames, mergeGames, parseGamesEnabled, setGamesOverrideCache } from "./config";
import type { Env } from "./env";
import { alertConfig, estimateRequests } from "./monitor/alerts";
import { analyticsReady, CONTENT_WINDOWS, contentBody, historyBody } from "./monitor/history";
import type { HistoryDeps } from "./monitor/history";
import { alertMailReady } from "./monitor/notify";
import { logServerError } from "./monitor/report";
import { adminStub, statsStub } from "./monitor/stats-api";
import type { AdminStoreApi, StatsApi } from "./monitor/stats-api";
import { clientIp, notFound } from "./request";
import { sha256hex, timingSafeEqualHex } from "./tokens";

export const ADMIN_PREFIX = "/api/admin/";
/** A shorter ADMIN_TOKEN counts as unset (the endpoints stay 404): `openssl rand -hex 32` gives 64 characters. */
export const ADMIN_TOKEN_MIN_CHARS = 32;
export const GRANT_NOTE_MAX_CHARS = 200;

const HEX64 = /^[0-9a-f]{64}$/;

export const GrantRequest = z
  .strictObject({
    installId: InstallIdSchema,
    premium: z.boolean().optional(),
    packs: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64)).max(MAX_TOKEN_PACKS).optional(),
    /** ms since the epoch; null or absent = no end date. */
    expiresAt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
    note: z.string().max(GRANT_NOTE_MAX_CHARS).optional(),
  })
  .refine((b) => b.premium === true || (b.packs?.length ?? 0) > 0, { message: "premium:true or packs required" });

/** Revoke by the raw install id (what the TV shows) or by the hash (what `GET` lists). */
export const RevokeRequest = z.union([z.strictObject({ installId: InstallIdSchema }), z.strictObject({ installHash: z.string().regex(HEX64) })]);

/** JAMAA-PLATFORM §8.7: a toggle names a known game; `enabled: null` drops the override (back to GAMES_ENABLED). */
export const GameToggleRequest = z.strictObject({ gameId: z.enum(GAME_IDS), enabled: z.boolean().nullable() });

/** The Room DO's admin RPC (room.ts `adminInspect`), injected by index.ts (this module never imports partyserver). */
export type InspectStub = { adminInspect(): Promise<Record<string, unknown>> };

export interface AdminDeps {
  store: () => BillingStore; now: () => number; stats?: (env: Env) => StatsApi | null;
  admin?: (env: Env) => AdminStoreApi | null; room?: (code: string) => Promise<InspectStub>; fetch?: typeof fetch;
}

export type AdminErrorCode = "UNAUTHORIZED" | "RATE_LIMITED" | "BAD_REQUEST" | "UNKNOWN_PACK" | "EXPIRED" | "INTERNAL";

function respond(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}
function adminError(code: AdminErrorCode, status: number, extra: Record<string, unknown> = {}): Response {
  return respond({ error: code, ...extra }, status, status === 401 ? { "WWW-Authenticate": "Bearer" } : {});
}

/** The configured token, or null when unset or too short (admin endpoints then answer 404). */
export function adminToken(env: Pick<Env, "ADMIN_TOKEN">): string | null {
  const t = env.ADMIN_TOKEN;
  return typeof t === "string" && t.length >= ADMIN_TOKEN_MIN_CHARS ? t : null;
}

/** Constant time: both sides are hashed first, so neither the length nor the content leaks through timing. */
export async function bearerMatches(req: Request, token: string): Promise<boolean> {
  const m = /^Bearer ([\x21-\x7e]{1,512})$/.exec(req.headers.get("Authorization") ?? "");
  const given = await sha256hex(m?.[1] ?? "");
  const want = await sha256hex(token);
  return timingSafeEqualHex(given, want) && m !== null;
}

function grantJson(g: Grant, nowMs: number): Record<string, unknown> {
  return { ...g, active: g.expiresAt === null || g.expiresAt > nowMs };
}

/** JAMAA-PLATFORM §8.5 monitoring routes (GET, same auth; `games` also POST). They work with billing off; `grants` needs billing on. */
export const MONITOR_ROUTES = ["overview", "errors", "history", "content", "games", "room"] as const;
type MonitorRoute = (typeof MONITOR_ROUTES)[number];

export async function handleAdmin(req: Request, env: Env, deps: AdminDeps): Promise<Response> {
  const token = adminToken(env);
  if (token === null) return notFound();
  const route = new URL(req.url).pathname.slice(ADMIN_PREFIX.length);
  const monitorRoute = (MONITOR_ROUTES as readonly string[]).includes(route);
  if (route !== "grants" && !monitorRoute) return notFound();
  if (route === "grants" && !billingEnabled(env)) return notFound();
  try {
    // Before the token check, so guessing is rate-limited too. Shares BILLING_LIMITER (per IP) under its own key.
    const { success } = await env.BILLING_LIMITER.limit({ key: `admin:${clientIp(req)}` });
    if (!success) return adminError("RATE_LIMITED", 429);
    if (!(await bearerMatches(req, token))) return adminError("UNAUTHORIZED", 401);
    if (monitorRoute) {
      if (req.method === "POST" && route === "games") {
        const body = await readJson(req, GameToggleRequest);
        if (!body) return adminError("BAD_REQUEST", 400);
        const stub = (deps.admin ?? adminStub)(env);
        if (!stub) return adminError("BAD_REQUEST", 409, { reason: "NO_STATS_BINDING" });
        const { override } = await stub.setGame(body.gameId, body.enabled);
        setGamesOverrideCache(override, deps.now());
        return respond(await gamesBody(env, deps));
      }
      if (req.method !== "GET") return adminError("BAD_REQUEST", 405);
      const url = new URL(req.url);
      if (route === "room") {
        const code = (url.searchParams.get("code") ?? "").trim().toUpperCase();
        if (!ROOM_CODE_REGEX.test(code)) return adminError("BAD_REQUEST", 400);
        if (!deps.room) return notFound();
        return respond(await roomBody(code, env, deps));
      }
      if (route === "content") {
        const days = Number(url.searchParams.get("days") ?? "30");
        if (!(CONTENT_WINDOWS as readonly number[]).includes(days)) return adminError("BAD_REQUEST", 400);
        return respond(await contentBody(env, days, historyDeps(env, deps)));
      }
      return respond(await monitorBody(route as Exclude<MonitorRoute, "room" | "content">, env, deps));
    }
    const store = deps.store();
    const now = deps.now();
    if (req.method === "GET") {
      return respond({ grants: (await store.grantList()).map((g) => grantJson(g, now)) });
    }
    if (req.method === "POST") {
      const body = await readJson(req, GrantRequest);
      if (!body) return adminError("BAD_REQUEST", 400);
      const premiumIds = billingPacks().premiumIds;
      const packs = [...new Set(body.packs ?? [])].sort();
      const unknown = packs.filter((id) => !premiumIds.has(id));
      if (unknown.length > 0) return adminError("UNKNOWN_PACK", 400, { packs: unknown });
      const expiresAt = body.expiresAt ?? null;
      if (expiresAt !== null && expiresAt <= now) return adminError("EXPIRED", 400);
      const grant: Grant = {
        installHash: await sha256hex(body.installId), premium: body.premium === true, packs, expiresAt,
        note: body.note ?? null, createdAt: now,
      };
      await store.grantPut(grant);
      return respond({ grant: grantJson(grant, now) });
    }
    if (req.method === "DELETE") {
      const body = await readJson(req, RevokeRequest);
      if (!body) return adminError("BAD_REQUEST", 400);
      const installHash = "installId" in body ? await sha256hex(body.installId) : body.installHash;
      return respond({ revoked: await store.grantDelete(installHash), installHash });
    }
    return adminError("BAD_REQUEST", 405);
  } catch {
    // Never log the request (it carries the token and install ids): only that it failed.
    logServerError("ADMIN_INTERNAL", { phase: route });
    return adminError("INTERNAL", 500);
  }
}

function historyDeps(env: Env, deps: AdminDeps): HistoryDeps {
  return { fetch: deps.fetch ?? ((i, init) => fetch(i, init)), now: deps.now, store: (deps.admin ?? adminStub)(env) };
}

/** §8.7: the env default, the override, the merged list and the audit log (newest first). */
async function gamesBody(env: Env, deps: AdminDeps): Promise<Record<string, unknown>> {
  const stub = (deps.admin ?? adminStub)(env);
  const [override, audit] = stub ? await Promise.all([stub.gamesOverride(), stub.auditLog()]) : [{}, []];
  const envIds = enabledGames(env);
  return {
    known: GAME_IDS, registry: REGISTRY_ENABLED, env: envIds, envUnknown: parseGamesEnabled(env.GAMES_ENABLED).unknown,
    override, effective: mergeGames(envIds, override), audit: audit.slice(0, 50), stats: stub !== null,
  };
}

/** §8.8: the Room DO's read-only view plus the errors the Stats ring holds for that room code. */
async function roomBody(code: string, env: Env, deps: AdminDeps): Promise<Record<string, unknown>> {
  const stub = await (deps.room as (code: string) => Promise<InspectStub>)(code);
  const room = await stub.adminInspect();
  const snap = await (deps.stats ?? statsStub)(env)?.snapshot().catch(() => null);
  return { room, errors: (snap?.errors ?? []).filter((e) => e.room === code) };
}

/** The admin page's data. `stats: null` when the STATS binding is missing (the page says so). */
async function monitorBody(route: Exclude<MonitorRoute, "room" | "content">, env: Env, deps: AdminDeps): Promise<Record<string, unknown>> {
  if (route === "history") return historyBody(env, historyDeps(env, deps));
  if (route === "games") return gamesBody(env, deps);
  const stub = (deps.stats ?? statsStub)(env);
  const snap = stub ? await stub.snapshot() : null;
  if (route === "errors") return { errors: snap?.errors ?? [] };
  const cfg = alertConfig(env);
  const estimate = snap ? estimateRequests(snap.today) : 0;
  return {
    stats: snap,
    quota: { estimate, limit: cfg.dailyRequests, ratio: cfg.dailyRequests > 0 ? estimate / cfg.dailyRequests : 0, alertAt: cfg.quotaRatio, estimated: true },
    alerting: {
      email: alertMailReady(env), serverErrorsPerHour: cfg.serverErrorsPerHour, clientErrorsPerHour: cfg.clientErrorsPerHour,
      open: snap?.alerts.filter((a) => a.closedAt === null) ?? [],
    },
    bindings: { stats: stub !== null, events: env.EVENTS !== undefined, analytics: analyticsReady(env) },
    billing: billingEnabled(env),
  };
}
