// PAYMENTS-SPEC §3.12: owner-only admin endpoints (/api/admin/grants) to comp premium and/or packs for specific
// installs without a Google purchase. Off (404) unless the optional ADMIN_TOKEN secret is set. The token travels only
// in the Authorization header, is compared in constant time and is never logged; grants are stored by install-id
// hash only (Billing DO `grants` table) and merged into the normal signed entitlement (BillingCore.entitlementFor).
import * as z from "zod";
import { MAX_TOKEN_PACKS } from "@mishana/shared/constants";
import { InstallIdSchema } from "@mishana/shared/billing";
import type { BillingStore, Grant } from "./billing/billing-core";
import { billingPacks } from "./billing/catalog-info";
import { readJson } from "./billing/routes";
import type { Env } from "./env";
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

export interface AdminDeps { store: () => BillingStore; now: () => number }

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

export async function handleAdmin(req: Request, env: Env, deps: AdminDeps): Promise<Response> {
  const token = adminToken(env);
  if (token === null) return notFound();
  const route = new URL(req.url).pathname.slice(ADMIN_PREFIX.length);
  if (route !== "grants") return notFound();
  try {
    // Before the token check, so guessing is rate-limited too. Shares BILLING_LIMITER (per IP) under its own key.
    const { success } = await env.BILLING_LIMITER.limit({ key: `admin:${clientIp(req)}` });
    if (!success) return adminError("RATE_LIMITED", 429);
    if (!(await bearerMatches(req, token))) return adminError("UNAUTHORIZED", 401);
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
    console.error(JSON.stringify({ code: "ADMIN_INTERNAL" }));
    return adminError("INTERNAL", 500);
  }
}
