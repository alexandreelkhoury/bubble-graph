// PAYMENTS-SPEC §3.12: /api/admin/grants (owner comps), merged into the normal signed entitlement.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENTITLEMENT_TTL_S } from "@mishana/shared/constants";
import { EntitlementResponse } from "@mishana/shared/billing";
import { ADMIN_TOKEN_MIN_CHARS, handleAdmin } from "../src/admin";
import type { AdminDeps } from "../src/admin";
import type { BillingStore } from "../src/billing/billing-core";
import { handleBilling } from "../src/billing/routes";
import type { BillingRouteDeps } from "../src/billing/routes";
import type { GoogleApi } from "../src/billing/google";
import { verifyEntitlementToken, verifyKeysFromSecret } from "../src/billing/token";
import type { Env } from "../src/env";
import { fakeEnv } from "./support/env";
import { INSTALL_A, INSTALL_B, NOW, ScriptedGoogle, hashOf, newCore } from "./support/billing";
import { jwksFor } from "./support/oidc";

const TOKEN = "a".repeat(24) + "-admin-token-" + "b".repeat(24);
const PREMIUM_PACK = "en-food-01";

async function keysJson(): Promise<string> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return JSON.stringify({ active: "k1", keys: [{ kid: "k1", x: jwk.x, d: jwk.d }] });
}

interface Ctx { google: ScriptedGoogle; env: Env; admin: AdminDeps; billing: BillingRouteDeps; store: BillingStore; db: ReturnType<typeof newCore>["storage"]["db"]; clock: { t: number }; host: string; limiterKeys: string[] }

async function setup(mode: "google" | "fake", over: Partial<Env> = {}): Promise<Ctx> {
  const { store, storage } = newCore();
  const clock = { t: NOW };
  const limiterKeys: string[] = [];
  const limiter = { limit: async ({ key }: { key: string }) => (limiterKeys.push(key), { success: true }) };
  const env = mode === "google"
    ? fakeEnv({ PLAY_SERVICE_ACCOUNT_JSON: "{\"client_email\":\"x\"}", ENTITLEMENT_KEYS: await keysJson(), ADMIN_TOKEN: TOKEN, BILLING_LIMITER: limiter, ...over })
    : fakeEnv({ BILLING_MODE: "fake", ALLOW_FAKE_BILLING: "1", ADMIN_TOKEN: TOKEN, BILLING_LIMITER: limiter, ...over });
  const google = new ScriptedGoogle();
  const billing: BillingRouteDeps = { store: () => store, google: () => google as GoogleApi, jwks: () => jwksFor(() => [], () => clock.t).jwks, now: () => clock.t };
  return { google, env, admin: { store: () => store, now: () => clock.t }, billing, store, db: storage.db, clock, host: mode === "google" ? "https://play.example" : "http://localhost:8787", limiterKeys };
}

function adminReq(c: Ctx, method: string, body?: unknown, auth: string | null = `Bearer ${TOKEN}`, path = "grants"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth !== null) headers.Authorization = auth;
  return new Request(`${c.host}/api/admin/${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

async function entitlement(c: Ctx, installId = INSTALL_A) {
  const res = await handleBilling(new Request(`${c.host}/api/billing/entitlement`, {
    method: "POST", body: JSON.stringify({ installId }), headers: { "Content-Type": "application/json" },
  }), c.env, c.billing);
  expect(res.status).toBe(200);
  return EntitlementResponse.parse(await res.json()).entitlement;
}

afterEach(() => vi.restoreAllMocks());

describe("/api/admin/grants auth", () => {
  it("ADMIN_TOKEN unset (or too short) → 404 for every method, even with a token", async () => {
    for (const ADMIN_TOKEN of [undefined, "", "x".repeat(ADMIN_TOKEN_MIN_CHARS - 1)]) {
      const c = await setup("google", { ADMIN_TOKEN });
      for (const m of ["GET", "POST", "DELETE"]) {
        const r = await handleAdmin(adminReq(c, m, m === "GET" ? undefined : { installId: INSTALL_A, premium: true }, `Bearer ${ADMIN_TOKEN ?? TOKEN}`), c.env, c.admin);
        expect(r.status).toBe(404);
      }
      expect(c.limiterKeys).toEqual([]);
    }
  });

  it("missing, malformed or wrong token → 401 (WWW-Authenticate), nothing stored", async () => {
    const c = await setup("google");
    for (const auth of [null, "", TOKEN, `Basic ${TOKEN}`, `Bearer ${TOKEN}x`, `Bearer ${TOKEN.slice(0, -1)}`, "Bearer ", `bearer ${TOKEN}`]) {
      const r = await handleAdmin(adminReq(c, "POST", { installId: INSTALL_A, premium: true }, auth), c.env, c.admin);
      expect(r.status).toBe(401);
      expect(r.headers.get("WWW-Authenticate")).toBe("Bearer");
      expect(await r.json()).toEqual({ error: "UNAUTHORIZED" });
    }
    expect(await c.store.grantList()).toEqual([]);
    expect((await entitlement(c)).premium).toBe(false);
  });

  it("rate-limited per IP under its own key, before the token is checked", async () => {
    const c = await setup("google", { BILLING_LIMITER: { limit: async () => ({ success: false }) } });
    const r = await handleAdmin(adminReq(c, "GET", undefined, null), c.env, c.admin);
    expect(r.status).toBe(429);
    const c2 = await setup("google");
    await handleAdmin(new Request(`${c2.host}/api/admin/grants`, { headers: { Authorization: `Bearer ${TOKEN}`, "CF-Connecting-IP": "203.0.113.9" } }), c2.env, c2.admin);
    expect(c2.limiterKeys).toEqual(["admin:203.0.113.9"]);
  });

  it("unknown admin paths → 404; unsupported method → 405", async () => {
    const c = await setup("google");
    expect((await handleAdmin(adminReq(c, "GET", undefined, `Bearer ${TOKEN}`, "other"), c.env, c.admin)).status).toBe(404);
    expect((await handleAdmin(adminReq(c, "PUT", {}), c.env, c.admin)).status).toBe(405);
  });

  it("never logs the token or the install id", async () => {
    const lines: string[] = [];
    for (const k of ["log", "warn", "error", "info", "debug"] as const) vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(" ")));
    const c = await setup("google");
    await handleAdmin(adminReq(c, "POST", { installId: INSTALL_A, premium: true, note: "living room" }), c.env, c.admin);
    await handleAdmin(adminReq(c, "GET"), c.env, c.admin);
    await handleAdmin(adminReq(c, "POST", { installId: INSTALL_A, premium: true }, "Bearer wrong-token-wrong-token-wrong-token"), c.env, c.admin);
    const broken = { ...c.admin, store: () => { throw new Error(`boom ${INSTALL_A} ${TOKEN}`); } };
    expect((await handleAdmin(adminReq(c, "GET"), c.env, broken)).status).toBe(500);
    const all = lines.join("\n");
    expect(all).not.toContain(TOKEN);
    expect(all).not.toContain(INSTALL_A);
    expect(all).not.toContain("wrong-token");
  });
});

describe.each(["google", "fake"] as const)("grants in %s mode", (mode) => {
  it("grant premium → the signed entitlement has premium (pu = exp when open-ended); revoke → gone", async () => {
    const c = await setup(mode);
    const r = await handleAdmin(adminReq(c, "POST", { installId: INSTALL_A, premium: true, note: "owner TV" }), c.env, c.admin);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ grant: { installHash: await hashOf(INSTALL_A), premium: true, packs: [], expiresAt: null, note: "owner TV", createdAt: NOW, active: true } });
    const e = await entitlement(c);
    expect(e.premium).toBe(true);
    expect(e.premiumUntil).toBe(e.expiresAt);
    expect(e.expiresAt).toBe((Math.floor(NOW / 1000) + ENTITLEMENT_TTL_S) * 1000);
    expect(e.subscription).toBeNull();
    const keys = await verifyKeysFromSecret(c.env.ENTITLEMENT_KEYS);
    const v = await verifyEntitlementToken(e.token, keys, NOW, mode === "fake", new Set([PREMIUM_PACK]));
    expect(v).toMatchObject({ sub: await hashOf(INSTALL_A), mode, premiumUntilMs: e.premiumUntil });
    // Other installs get nothing.
    expect((await entitlement(c, INSTALL_B)).premium).toBe(false);
    // A later refresh renews it.
    c.clock.t += 7 * 3_600_000;
    expect((await entitlement(c)).premium).toBe(true);
    const del = await handleAdmin(adminReq(c, "DELETE", { installId: INSTALL_A }), c.env, c.admin);
    expect(await del.json()).toEqual({ revoked: true, installHash: await hashOf(INSTALL_A) });
    expect((await entitlement(c)).premium).toBe(false);
    expect(await (await handleAdmin(adminReq(c, "DELETE", { installId: INSTALL_A }), c.env, c.admin)).json()).toMatchObject({ revoked: false });
  });

  it("grant packs (and premium+packs) → token packs; unknown or free packs → 400", async () => {
    const c = await setup(mode);
    expect((await handleAdmin(adminReq(c, "POST", { installId: INSTALL_A, packs: [PREMIUM_PACK] }), c.env, c.admin)).status).toBe(200);
    const e = await entitlement(c);
    expect(e).toMatchObject({ premium: false, packs: [PREMIUM_PACK] });
    const bad = await handleAdmin(adminReq(c, "POST", { installId: INSTALL_A, packs: ["en-everyday-01", "zz-nope-01"] }), c.env, c.admin);
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "UNKNOWN_PACK", packs: ["en-everyday-01", "zz-nope-01"] });
    // The failed request left the earlier grant untouched; a new one replaces it.
    expect((await entitlement(c)).packs).toEqual([PREMIUM_PACK]);
    await handleAdmin(adminReq(c, "POST", { installId: INSTALL_A, premium: true, packs: [PREMIUM_PACK] }), c.env, c.admin);
    expect(await entitlement(c)).toMatchObject({ premium: true, packs: [PREMIUM_PACK] });
  });

  it("expiry is respected: premiumUntil = expiresAt; after it, nothing; a past date is refused", async () => {
    const c = await setup(mode);
    const until = NOW + 3_600_000;
    await handleAdmin(adminReq(c, "POST", { installId: INSTALL_A, premium: true, packs: [PREMIUM_PACK], expiresAt: until }), c.env, c.admin);
    expect(await entitlement(c)).toMatchObject({ premium: true, premiumUntil: until, packs: [PREMIUM_PACK] });
    c.clock.t = until;
    expect(await entitlement(c)).toMatchObject({ premium: false, premiumUntil: null, packs: [] });
    const list = (await (await handleAdmin(adminReq(c, "GET"), c.env, c.admin)).json()) as { grants: { active: boolean }[] };
    expect(list.grants).toHaveLength(1);
    expect(list.grants[0]?.active).toBe(false);
    expect((await handleAdmin(adminReq(c, "POST", { installId: INSTALL_A, premium: true, expiresAt: c.clock.t }), c.env, c.admin)).status).toBe(400);
  });

  it("stores the install-id hash only; list shows hashes; revoke by hash works", async () => {
    const c = await setup(mode);
    await handleAdmin(adminReq(c, "POST", { installId: INSTALL_A, premium: true }), c.env, c.admin);
    await handleAdmin(adminReq(c, "POST", { installId: INSTALL_B, packs: [PREMIUM_PACK], note: "kitchen" }), c.env, c.admin);
    const tables = c.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
    for (const { name } of tables) {
      const dump = JSON.stringify(c.db.prepare(`SELECT * FROM "${name}"`).all());
      expect(dump).not.toContain(INSTALL_A);
      expect(dump).not.toContain(INSTALL_B);
    }
    const rows = c.db.prepare("SELECT install_hash FROM grants ORDER BY install_hash").all() as { install_hash: string }[];
    expect(rows.map((r) => r.install_hash).sort()).toEqual([await hashOf(INSTALL_A), await hashOf(INSTALL_B)].sort());
    const list = JSON.stringify(await (await handleAdmin(adminReq(c, "GET"), c.env, c.admin)).json());
    expect(list).not.toContain(INSTALL_A);
    expect(list).toContain(await hashOf(INSTALL_B));
    const del = await handleAdmin(adminReq(c, "DELETE", { installHash: await hashOf(INSTALL_B) }), c.env, c.admin);
    expect(await del.json()).toMatchObject({ revoked: true });
    expect((await entitlement(c, INSTALL_B)).packs).toEqual([]);
  });

  it("grants never touch purchases or bindings (no install-limit slot, no Google)", async () => {
    const c = await setup(mode);
    await handleAdmin(adminReq(c, "POST", { installId: INSTALL_A, premium: true }), c.env, c.admin);
    await entitlement(c);
    for (const t of ["purchases", "bindings"]) expect((c.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).all()[0] as { n: number }).n).toBe(0);
    for (const op of ["sub_get", "product_get", "sub_ack", "product_ack"] as const) expect(c.google.count(op)).toBe(0);
  });

  it("bad bodies → 400", async () => {
    const c = await setup(mode);
    for (const body of [
      { installId: INSTALL_A }, { installId: INSTALL_A, premium: false }, { installId: INSTALL_A, packs: [] }, { installId: "nope", premium: true },
      { installId: INSTALL_A, premium: true, extra: 1 }, { installId: INSTALL_A, premium: true, note: "x".repeat(201) },
      { installId: INSTALL_A, premium: true, expiresAt: "2027-01-01" },
    ]) {
      expect((await handleAdmin(adminReq(c, "POST", body), c.env, c.admin)).status).toBe(400);
    }
    expect((await handleAdmin(adminReq(c, "DELETE", { installHash: "abc" }), c.env, c.admin)).status).toBe(400);
  });
});
