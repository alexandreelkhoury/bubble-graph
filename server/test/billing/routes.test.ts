// PAYMENTS-SPEC §3.4 / §3.10 / §7.2: /api/billing/* handlers (real SQLite core, scripted or fake Google).
import { describe, expect, it } from "vitest";
import { CatalogResponse, EntitlementResponse, VerifyResponse } from "@mishana/shared/billing";
import type { BillingStore } from "../../src/billing/billing-core";
import { GoogleHttpError } from "../../src/billing/google";
import type { GoogleApi } from "../../src/billing/google";
import { normalizeProduct } from "../../src/billing/normalize";
import { handleBilling, networkPrefix } from "../../src/billing/routes";
import type { BillingRouteDeps } from "../../src/billing/routes";
import { verifyEntitlementToken, verifyKeysFromSecret } from "../../src/billing/token";
import type { Env } from "../../src/env";
import { fakeEnv } from "../support/env";
import { INSTALL_A, INSTALL_B, NOW, ScriptedGoogle, hashOf, newCore, product, sub } from "../support/billing";
import { jwksFor } from "../support/oidc";

async function keysJson(): Promise<string> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return JSON.stringify({ active: "k1", keys: [{ kid: "k1", x: jwk.x, d: jwk.d }] });
}

interface Ctx { env: Env; deps: BillingRouteDeps; store: BillingStore; core: ReturnType<typeof newCore>["core"]; google: ScriptedGoogle; clock: { t: number } }

async function google(over: Partial<Env> = {}, opts: { store?: BillingStore } = {}): Promise<Ctx> {
  const { core, store } = newCore();
  const g = new ScriptedGoogle();
  const clock = { t: NOW };
  const env = fakeEnv({ PLAY_SERVICE_ACCOUNT_JSON: "{\"client_email\":\"x\"}", ENTITLEMENT_KEYS: await keysJson(), ...over });
  const s = opts.store ?? store;
  const deps: BillingRouteDeps = { store: () => s, google: () => g as GoogleApi, jwks: () => jwksFor(() => [], () => clock.t).jwks, now: () => clock.t };
  return { env, deps, store: s, core, google: g, clock };
}

function fakeMode(): Promise<Ctx> {
  return google({ BILLING_MODE: "fake", ALLOW_FAKE_BILLING: "1", PLAY_SERVICE_ACCOUNT_JSON: "", ENTITLEMENT_KEYS: undefined });
}

const post = (path: string, body: unknown, host = "play.example", headers: Record<string, string> = {}): Request =>
  new Request(`https://${host}/api/billing/${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "Content-Type": "application/json", ...headers } });
const localPost = (path: string, body: unknown): Request => new Request(`http://localhost:8787/api/billing/${path}`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

async function verifyCall(c: Ctx, purchases: { productId: string; purchaseToken: string }[], installId = INSTALL_A, ip?: string) {
  const res = await handleBilling(post("verify", { installId, purchases }, "play.example", ip ? { "CF-Connecting-IP": ip } : {}), c.env, c.deps);
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  return { status: res.status, body: res.status === 200 ? VerifyResponse.parse(await res.json()) : await res.json() };
}

describe("POST /api/billing/verify (google mode, scripted Google)", () => {
  it("happy path: sub + pack → OK, acked, signed token with premium and the pack", async () => {
    const c = await google();
    c.google.subs.set("sub-tok", sub({ trial: true, basePlanId: "yearly" }));
    c.google.products.set("pack-tok", product());
    const { status, body } = await verifyCall(c, [{ productId: "premium", purchaseToken: "sub-tok" }, { productId: "pack_en_food_01", purchaseToken: "pack-tok" }]);
    expect(status).toBe(200);
    const b = body as ReturnType<typeof VerifyResponse.parse>;
    expect(b.results).toEqual([{ productId: "premium", result: "OK" }, { productId: "pack_en_food_01", result: "OK" }]);
    expect(b.entitlement).toMatchObject({ premium: true, packs: ["en-food-01"], subscription: { state: "SUBSCRIPTION_STATE_ACTIVE", inTrial: true, basePlanId: "yearly" } });
    expect(c.google.count("sub_ack") + c.google.count("product_ack")).toBe(2);
    const keys = await verifyKeysFromSecret(c.env.ENTITLEMENT_KEYS);
    const e = await verifyEntitlementToken(b.entitlement.token, keys, NOW, false, new Set(["en-food-01"]));
    expect(e).toMatchObject({ sub: await hashOf(INSTALL_A), packs: ["en-food-01"], mode: "google" });
    expect(b.entitlement.expiresAt).toBe(e?.expMs);
  });

  it("UPSTREAM_ERROR keeps 200; unknown product / non-premium pack → INVALID without a Google call", async () => {
    const c = await google();
    c.google.subs.set("down", new GoogleHttpError(503, "sub_get"));
    const { status, body } = await verifyCall(c, [
      { productId: "premium", purchaseToken: "down" },
      { productId: "pack_en_everyday_01", purchaseToken: "free-pack" },
      { productId: "pack_nope_01", purchaseToken: "x" },
    ]);
    expect(status).toBe(200);
    expect((body as { results: unknown }).results).toEqual([
      { productId: "premium", result: "UPSTREAM_ERROR" }, { productId: "pack_en_everyday_01", result: "INVALID" }, { productId: "pack_nope_01", result: "INVALID" },
    ]);
    expect(c.google.count("sub_get")).toBe(1);
    expect(c.google.count("product_get")).toBe(0);
  });

  it("a fresh cached row → no Google call; Google 404 → INVALID and the negative cache answers next time", async () => {
    const c = await google();
    c.google.subs.set("sub-tok", sub({ acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" }));
    await verifyCall(c, [{ productId: "premium", purchaseToken: "sub-tok" }]);
    expect(c.google.count("sub_get")).toBe(1);
    const again = await verifyCall(c, [{ productId: "premium", purchaseToken: "sub-tok" }], INSTALL_B);
    expect((again.body as { results: unknown }).results).toEqual([{ productId: "premium", result: "OK" }]);
    expect(c.google.count("sub_get")).toBe(1);
    await verifyCall(c, [{ productId: "premium", purchaseToken: "bogus" }]);
    const r = await verifyCall(c, [{ productId: "premium", purchaseToken: "bogus" }]);
    expect((r.body as { results: unknown }).results).toEqual([{ productId: "premium", result: "INVALID" }]);
    expect(c.google.calls.filter((x) => x.token === "bogus")).toHaveLength(1);
  });

  it("a product mismatch → INVALID, not negative-cached: the real owner's verify still succeeds", async () => {
    const c = await google();
    c.google.products.set("pack-tok", product({ productId: "pack_fr_food_01" }));
    const r = await verifyCall(c, [{ productId: "pack_en_food_01", purchaseToken: "pack-tok" }]);
    expect((r.body as { results: unknown }).results).toEqual([{ productId: "pack_en_food_01", result: "INVALID" }]);
    const owner = await verifyCall(c, [{ productId: "pack_fr_food_01", purchaseToken: "pack-tok" }], INSTALL_B);
    expect((owner.body as { results: unknown }).results).toEqual([{ productId: "pack_fr_food_01", result: "OK" }]);
  });

  it("a pack token posted as premium (subscriptionsv2 404) does not poison it for the pack owner", async () => {
    const c = await google();
    c.google.subs.set("pk", new GoogleHttpError(404, "sub_get"));
    c.google.products.set("pk", product());
    const wrong = await verifyCall(c, [{ productId: "premium", purchaseToken: "pk" }]);
    expect((wrong.body as { results: unknown }).results).toEqual([{ productId: "premium", result: "INVALID" }]);
    const owner = await verifyCall(c, [{ productId: "pack_en_food_01", purchaseToken: "pk" }], INSTALL_B);
    expect((owner.body as { results: unknown }).results).toEqual([{ productId: "pack_en_food_01", result: "OK" }]);
  });

  it("an OAuth token-endpoint failure → UPSTREAM_ERROR and no negative cache (the next verify reads Google again)", async () => {
    const c = await google();
    c.google.subs.set("real", new GoogleHttpError(503, "token"));
    const r = await verifyCall(c, [{ productId: "premium", purchaseToken: "real" }]);
    expect((r.body as { results: unknown }).results).toEqual([{ productId: "premium", result: "UPSTREAM_ERROR" }]);
    expect(c.core.lookup(await hashOf("real"), "sub", NOW).invalid).toBe(false);
    // Even a 400 tagged op "token" (a client that did not remap it) is never "gone".
    c.google.subs.set("real", new GoogleHttpError(400, "token"));
    const r2 = await verifyCall(c, [{ productId: "premium", purchaseToken: "real" }]);
    expect((r2.body as { results: unknown }).results).toEqual([{ productId: "premium", result: "UPSTREAM_ERROR" }]);
    expect(c.core.lookup(await hashOf("real"), "sub", NOW).invalid).toBe(false);
    c.google.subs.set("real", sub());
    const ok = await verifyCall(c, [{ productId: "premium", purchaseToken: "real" }]);
    expect((ok.body as { results: unknown }).results).toEqual([{ productId: "premium", result: "OK" }]);
  });

  it("one IP cannot drain the global Google bucket: 10 reads/min per IP, other IPs unaffected", async () => {
    const c = await google();
    let junk = 0;
    const results: string[] = [];
    for (let i = 0; i < 4; i++) {
      const purchases = Array.from({ length: 5 }, () => ({ productId: "premium", purchaseToken: `junk-${junk++}` }));
      for (const p of purchases) c.google.subs.set(p.purchaseToken, new GoogleHttpError(404, "sub_get"));
      const r = await verifyCall(c, purchases, `${i.toString(16).padStart(32, "0")}`, "198.51.100.9");
      results.push(...(r.body as { results: { result: string }[] }).results.map((x) => x.result));
    }
    expect(c.google.count("sub_get")).toBe(10);
    expect(results.filter((x) => x === "UPSTREAM_ERROR")).toHaveLength(10);
    c.google.subs.set("buyer", sub());
    const buyer = await verifyCall(c, [{ productId: "premium", purchaseToken: "buyer" }], INSTALL_B, "203.0.113.50");
    expect((buyer.body as { results: unknown }).results).toEqual([{ productId: "premium", result: "OK" }]);
  });

  it("20 tokens → at most 5 Google reads, the rest UPSTREAM_ERROR", async () => {
    const c = await google();
    const purchases = Array.from({ length: 20 }, (_, i) => ({ productId: "premium", purchaseToken: `t${i}` }));
    for (const p of purchases) c.google.subs.set(p.purchaseToken, sub());
    const r = await verifyCall(c, purchases);
    const results = (r.body as { results: { result: string }[] }).results.map((x) => x.result);
    expect(results.filter((x) => x === "OK")).toHaveLength(5);
    expect(results.filter((x) => x === "UPSTREAM_ERROR")).toHaveLength(15);
    expect(c.google.count("sub_get")).toBe(5);
  });

  it("deadline exceeded → the remaining purchases get UPSTREAM_ERROR", async () => {
    const c = await google();
    c.google.subs.set("slow", () => {
      c.clock.t += 13_000;
      return sub();
    });
    c.google.subs.set("next", sub());
    const r = await verifyCall(c, [{ productId: "premium", purchaseToken: "slow" }, { productId: "premium", purchaseToken: "next" }]);
    expect((r.body as { results: { result: string }[] }).results.map((x) => x.result)).toEqual(["OK", "UPSTREAM_ERROR"]);
    expect(c.google.calls.some((x) => x.token === "next")).toBe(false);
  });

  it("an empty global bucket → UPSTREAM_ERROR", async () => {
    const c = await google();
    c.core.googleBudget(120, NOW);
    c.google.subs.set("t", sub());
    const r = await verifyCall(c, [{ productId: "premium", purchaseToken: "t" }]);
    expect((r.body as { results: unknown }).results).toEqual([{ productId: "premium", result: "UPSTREAM_ERROR" }]);
    expect(c.google.count("sub_get")).toBe(0);
  });

  it("the ack is sent for an INSTALL_LIMIT result", async () => {
    const c = await google();
    c.google.products.set("p", product());
    const ph = await hashOf("p");
    for (let i = 1; i <= 10; i++) {
      await c.core.applyPurchase({ tokenHash: ph, kind: "pack", productId: "pack_en_food_01", n: normalizeProduct(product(), NOW - 20 * 60_000), callerInstallHash: String(i).padStart(64, "0"), rawTokenForAck: "p", nowMs: NOW - 20 * 60_000 });
    }
    const r = await verifyCall(c, [{ productId: "pack_en_food_01", purchaseToken: "p" }]);
    expect((r.body as { results: unknown }).results).toEqual([{ productId: "pack_en_food_01", result: "INSTALL_LIMIT" }]);
    expect(c.google.count("product_ack")).toBe(1);
  });

  it("bad body → 400; IP limiter or per-install window → 429; foreign Origin → 403", async () => {
    const c = await google();
    for (const body of ["{", { installId: "XYZ", purchases: [] }, { installId: INSTALL_A, purchases: [{ productId: "premium", purchaseToken: "a" }], extra: 1 }]) {
      expect((await handleBilling(post("verify", body), c.env, c.deps)).status).toBe(400);
    }
    expect((await handleBilling(post("verify", "{}", "play.example", { "Content-Type": "text/plain" }), c.env, c.deps)).status).toBe(400);
    expect((await handleBilling(post("verify", { installId: INSTALL_A, purchases: [{ productId: "premium", purchaseToken: "x".repeat(20_000) }] }), c.env, c.deps)).status).toBe(400);
    const limited = { ...c.env, BILLING_LIMITER: { limit: async () => ({ success: false }) } };
    const res = await handleBilling(post("verify", { installId: INSTALL_A, purchases: [{ productId: "premium", purchaseToken: "a" }] }), limited, c.deps);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "RATE_LIMITED" });
    for (let i = 0; i < 20; i++) c.core.rateCheck(await hashOf(INSTALL_B), "verify", NOW);
    expect((await verifyCall(c, [{ productId: "premium", purchaseToken: "a" }], INSTALL_B)).status).toBe(429);
    expect((await handleBilling(post("entitlement", { installId: INSTALL_A }, "play.example", { Origin: "https://evil.example" }), c.env, c.deps)).status).toBe(403);
  });
});

describe("other routes", () => {
  it("GET /catalog lists premium packs only, catalog order, cacheable", async () => {
    const c = await google();
    const res = await handleBilling(new Request("https://play.example/api/billing/catalog"), c.env, c.deps);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    const body = CatalogResponse.parse(await res.json());
    expect(body.mode).toBe("google");
    expect(body.freePackIds).toEqual(["en-everyday-01", "fr-everyday-01", "ar-everyday-01"]);
    expect(body.packs.map((p) => p.packId)).not.toContain("en-everyday-01");
    expect(body.packs[0]).toMatchObject({ packId: "en-food-01", productId: "pack_en_food_01", language: "en" });
    expect(body.packs.find((p) => p.packId === "lb-food-01")).toMatchObject({ locale: "ar-LB", language: "ar" });
    expect(body.subscription).toEqual({ productId: "premium", basePlanIds: ["monthly", "yearly"], trialOfferId: "trial-7d" });
  });

  it("an installId used from more than 4 networks a day: /entitlement → 429 RATE_LIMITED, /verify still works", async () => {
    const c = await google();
    const ent = (ip: string) => handleBilling(post("entitlement", { installId: INSTALL_A }, "play.example", { "CF-Connecting-IP": ip }), c.env, c.deps);
    for (let i = 1; i <= 4; i++) expect((await ent(`198.51.${i}.7`)).status).toBe(200);
    expect((await ent("198.51.1.200")).status).toBe(200); // same /24 as the first
    const res = await ent("198.51.99.7");
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "RATE_LIMITED" });
    c.google.subs.set("tv-tok", sub());
    const v = await verifyCall(c, [{ productId: "premium", purchaseToken: "tv-tok" }], INSTALL_A, "198.51.100.7");
    expect(v.status).toBe(200);
    // Once flagged, the installId gets no /entitlement from any network while the window is full (the real TV keeps
    // getting its entitlement from /verify, which needs the purchase token).
    expect((await ent("198.51.1.7")).status).toBe(429);
  });

  it("networkPrefix: IPv4 /24, IPv6 /48", () => {
    expect(networkPrefix("203.0.113.77")).toBe("203.0.113");
    expect(networkPrefix("2001:db8:abcd:12::1")).toBe("2001:db8:abcd");
    expect(networkPrefix("2001:db8::1")).toBe("2001:db8:0");
    expect(networkPrefix("2001:0db8:00ab:1:2:3:4:5")).toBe("2001:db8:ab");
    expect(networkPrefix("local")).toBe("local");
  });

  it("POST /entitlement for an unknown install = free entitlement", async () => {
    const c = await google();
    const res = await handleBilling(post("entitlement", { installId: INSTALL_A }), c.env, c.deps);
    const b = EntitlementResponse.parse(await res.json());
    expect(b.entitlement).toMatchObject({ premium: false, premiumUntil: null, packs: [], subscription: null });
  });

  it("google mode without secrets → 503 NOT_CONFIGURED; unknown routes → 405; fake routes → 404", async () => {
    const c = await google({ PLAY_SERVICE_ACCOUNT_JSON: undefined });
    expect((await handleBilling(new Request("https://play.example/api/billing/catalog"), c.env, c.deps)).status).toBe(503);
    const c2 = await google();
    const r405 = await handleBilling(new Request("https://play.example/api/billing/verify"), c2.env, c2.deps);
    expect(r405.status).toBe(405);
    expect(await r405.json()).toEqual({ error: "BAD_REQUEST" });
    expect((await handleBilling(post("nope", {}), c2.env, c2.deps)).status).toBe(405);
    expect((await handleBilling(post("fake/purchase", { installId: INSTALL_A, productId: "premium" }), c2.env, c2.deps)).status).toBe(404);
  });
});

describe("fake mode (§3.10)", () => {
  it("fake purchase → verify → premium token (kid fake); fake/set EXPIRED ends premium", async () => {
    const c = await fakeMode();
    const cat = CatalogResponse.parse(await (await handleBilling(new Request("http://localhost:8787/api/billing/catalog"), c.env, c.deps)).json());
    expect(cat.mode).toBe("fake");
    const p = await handleBilling(localPost("fake/purchase", { installId: INSTALL_A, productId: "premium", basePlanId: "yearly", offerId: "trial-7d" }), c.env, c.deps);
    const { purchaseToken } = (await p.json()) as { purchaseToken: string };
    expect(purchaseToken).toBe("fake.sub.premium.1");
    const v = await handleBilling(localPost("verify", { installId: INSTALL_A, purchases: [{ productId: "premium", purchaseToken }] }), c.env, c.deps);
    const vb = VerifyResponse.parse(await v.json());
    expect(vb.results).toEqual([{ productId: "premium", result: "OK" }]);
    expect(vb.entitlement).toMatchObject({ premium: true, subscription: { basePlanId: "yearly", inTrial: true } });
    const e = await verifyEntitlementToken(vb.entitlement.token, new Map(), NOW, true, new Set());
    expect(e?.mode).toBe("fake");
    expect(await verifyEntitlementToken(vb.entitlement.token, new Map(), NOW, false, new Set())).toBeNull();
    expect((await handleBilling(localPost("fake/set", { purchaseToken, state: "SUBSCRIPTION_STATE_EXPIRED" }), c.env, c.deps)).status).toBe(204);
    const en = EntitlementResponse.parse(await (await handleBilling(localPost("entitlement", { installId: INSTALL_A }), c.env, c.deps)).json());
    expect(en.entitlement.premium).toBe(false);
  });

  it("pack purchase → verify → owned; fake/set REVOKED removes it for good", async () => {
    const c = await fakeMode();
    const p = await handleBilling(localPost("fake/purchase", { installId: INSTALL_A, productId: "pack_en_food_01" }), c.env, c.deps);
    const { purchaseToken } = (await p.json()) as { purchaseToken: string };
    expect(purchaseToken).toBe("fake.pack.pack_en_food_01.1");
    const v = VerifyResponse.parse(await (await handleBilling(localPost("verify", { installId: INSTALL_A, purchases: [{ productId: "pack_en_food_01", purchaseToken }] }), c.env, c.deps)).json());
    expect(v.entitlement.packs).toEqual(["en-food-01"]);
    await handleBilling(localPost("fake/set", { purchaseToken, state: "REVOKED" }), c.env, c.deps);
    const v2 = VerifyResponse.parse(await (await handleBilling(localPost("verify", { installId: INSTALL_A, purchases: [{ productId: "pack_en_food_01", purchaseToken }] }), c.env, c.deps)).json());
    expect(v2.results).toEqual([{ productId: "pack_en_food_01", result: "REVOKED" }]);
    expect(v2.entitlement.packs).toEqual([]);
  });

  it("PENDING outcome → PENDING; set PURCHASED later → OK", async () => {
    const c = await fakeMode();
    const { purchaseToken } = (await (await handleBilling(localPost("fake/purchase", { installId: INSTALL_A, productId: "pack_fr_food_01", outcome: "PENDING" }), c.env, c.deps)).json()) as { purchaseToken: string };
    const v = VerifyResponse.parse(await (await handleBilling(localPost("verify", { installId: INSTALL_A, purchases: [{ productId: "pack_fr_food_01", purchaseToken }] }), c.env, c.deps)).json());
    expect(v.results[0]?.result).toBe("PENDING");
    await handleBilling(localPost("fake/set", { purchaseToken, state: "PURCHASED" }), c.env, c.deps);
    const v2 = VerifyResponse.parse(await (await handleBilling(localPost("verify", { installId: INSTALL_A, purchases: [{ productId: "pack_fr_food_01", purchaseToken }] }), c.env, c.deps)).json());
    expect(v2.entitlement.packs).toEqual(["fr-food-01"]);
  });

  it("fake env on a public host → every billing route 503 (fail closed), fake routes included", async () => {
    const c = await fakeMode();
    expect((await handleBilling(post("fake/purchase", { installId: INSTALL_A, productId: "premium" }, "example.com"), c.env, c.deps)).status).toBe(503);
    expect((await handleBilling(new Request("https://example.com/api/billing/catalog"), c.env, c.deps)).status).toBe(503);
    expect((await handleBilling(localPost("fake/purchase", { installId: INSTALL_A, productId: "premium" }), { ...c.env, ALLOW_FAKE_BILLING: "0" }, c.deps)).status).toBe(503);
  });
});
