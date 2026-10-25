// PAYMENTS-SPEC §3.6 / §7.2: the RTDN push endpoint end to end (real SQLite core, scripted Google, real OIDC check).
import { describe, expect, it } from "vitest";
import { GoogleHttpError } from "../../src/billing/google";
import { normalizeProduct } from "../../src/billing/normalize";
import { handleRtdn, parsePush } from "../../src/billing/rtdn";
import type { RtdnEnv } from "../../src/billing/rtdn";
import { DAY, INSTALL_A, NOW, ScriptedGoogle, hashOf, newCore, product } from "../support/billing";
import { AUD, EMAIL, jwksFor, oidcToken, rsaKey } from "../support/oidc";

const SUBSCRIPTION = "projects/mish-ana-billing/subscriptions/play-rtdn-push"; // the Pub/Sub subscription
const PKG = "app.mishana.tv";

function env(over: Partial<RtdnEnv> = {}): RtdnEnv {
  return { RTDN_LIMITER: { limit: async () => ({ success: true }) }, RTDN_AUDIENCE: AUD, RTDN_SA_EMAIL: EMAIL, RTDN_SUBSCRIPTION: SUBSCRIPTION, PLAY_PACKAGE_NAME: PKG, ...over };
}

function pushBody(notification: Record<string, unknown>, messageId = "136969346945", subscription = SUBSCRIPTION): string {
  const data = btoa(JSON.stringify({ version: "1.0", packageName: PKG, eventTimeMillis: "1790000000000", ...notification }));
  return JSON.stringify({ message: { attributes: {}, data, messageId, publishTime: "2026-10-04T00:00:00Z" }, subscription });
}

async function setup() {
  const k = await rsaKey("g1");
  const { jwks } = jwksFor(() => [k], () => NOW);
  const { core, store } = newCore();
  const google = new ScriptedGoogle();
  const call = async (body: string, e = env(), auth?: string): Promise<Response> => {
    const req = new Request("https://play.example/api/billing/rtdn", {
      method: "POST", body, headers: { Authorization: auth ?? `Bearer ${await oidcToken(k, NOW)}`, "Content-Type": "application/json" },
    });
    return handleRtdn(req, e, { store, api: google, jwks, now: () => NOW, ip: "1.2.3.4" });
  };
  return { core, store, google, call };
}

// oneTimeProductNotification types: 1 = PURCHASED, 2 = CANCELED.
const otp = (purchaseToken: string, notificationType = 1, sku = "premium") => ({ oneTimeProductNotification: { version: "1.0", notificationType, purchaseToken, sku } });
const voided = (purchaseToken: string, productType = 2, refundType = 1) => ({ voidedPurchaseNotification: { purchaseToken, orderId: "GPA.1", productType, refundType } });
const premium = (over: Parameters<typeof product>[0] = {}) => product({ productId: "premium", ...over });

describe("RTDN parsing", () => {
  it("accepts eventTimeMillis as a string or a number; garbage → null", () => {
    expect(parsePush(pushBody(otp("t")))?.n.oneTimeProductNotification?.purchaseToken).toBe("t");
    expect(parsePush(pushBody({ ...otp("t"), eventTimeMillis: 1790000000000 }))?.messageId).toBe("136969346945");
    expect(parsePush("{")).toBeNull();
    expect(parsePush(JSON.stringify({ message: { data: "!!!", messageId: "1" }, subscription: "s" }))).toBeNull();
  });
});

describe("POST /api/billing/rtdn", () => {
  it("premium one-time notification → productsv2 get + apply + ack; obfuscated id binds lifetime premium; dedupe by messageId", async () => {
    const { core, google, call } = await setup();
    const installHash = await hashOf(INSTALL_A);
    google.products.set("prem-1", premium({ obfuscatedExternalAccountId: installHash }));
    expect((await call(pushBody(otp("prem-1")))).status).toBe(204);
    expect(google.count("product_get")).toBe(1);
    expect(google.count("product_ack")).toBe(1);
    expect(core.rowFor(await hashOf("prem-1"))).toMatchObject({ product_id: "premium", acknowledged: 1, ack_token: null });
    expect(core.entitlementFor(installHash, NOW).premiumUntilMs).not.toBeNull();
    expect((await call(pushBody(otp("prem-1")))).status).toBe(204);
    expect(google.count("product_get")).toBe(1); // deduped
  });

  it("pack one-time notification → get + apply + ack", async () => {
    const { core, google, call } = await setup();
    google.products.set("pack-1", product());
    expect((await call(pushBody(otp("pack-1", 1, "pack_en_food_01")))).status).toBe(204);
    expect(google.count("product_ack")).toBe(1);
    expect(core.rowFor(await hashOf("pack-1"))?.state).toBe("PURCHASED");
  });

  it("a product this app does not sell is ignored (204, no row)", async () => {
    const { core, google, call } = await setup();
    google.products.set("x-1", product({ productId: "pack_not_shipped_99" }));
    expect((await call(pushBody(otp("x-1", 1, "pack_not_shipped_99")))).status).toBe(204);
    expect(core.rowFor(await hashOf("x-1"))).toBeNull();
    expect(google.count("product_ack")).toBe(0);
  });

  it("premium refund via oneTimeProductNotification CANCELED → premium off", async () => {
    const { core, google, call } = await setup();
    const inst = "2".repeat(64);
    const h = await hashOf("prem-2");
    core.applyPurchase({ tokenHash: h, productId: "premium", n: normalizeProduct(premium(), NOW - 1000), callerInstallHash: inst, rawTokenForAck: "prem-2", nowMs: NOW - 1000 });
    expect(core.entitlementFor(inst, NOW).premiumUntilMs).not.toBeNull();
    google.products.set("prem-2", premium({ state: "CANCELLED" }));
    expect((await call(pushBody(otp("prem-2", 2)))).status).toBe(204);
    expect(core.rowFor(h)?.state).toBe("CANCELLED");
    expect(core.entitlementFor(inst, NOW + 1).premiumUntilMs).toBeNull();
  });

  it("voided premium → revoked (sticky): premium off, a later PURCHASED read → REVOKED", async () => {
    const { core, google, call } = await setup();
    const inst = "3".repeat(64);
    google.products.set("prem-3", premium());
    await call(pushBody(otp("prem-3"), "a1"));
    const h = await hashOf("prem-3");
    expect(core.bindOnly({ tokenHash: h, callerInstallHash: inst, nowMs: NOW })).toBe("OK");
    expect((await call(pushBody(voided("prem-3"), "a2"))).status).toBe(204);
    expect(core.rowFor(h)?.revoked).toBe(1);
    expect(core.entitlementFor(inst, NOW + 1).premiumUntilMs).toBeNull();
    await call(pushBody(otp("prem-3"), "a3"));
    expect(core.rowFor(h)?.revoked).toBe(1);
    expect(core.bindOnly({ tokenHash: h, callerInstallHash: inst, nowMs: NOW + 2 })).toBe("REVOKED");
  });

  it("voided pack → revoked; unknown hash → tombstone, a later /verify-style apply → REVOKED", async () => {
    const { core, google, call } = await setup();
    google.products.set("pack-2", product());
    await call(pushBody(otp("pack-2", 1, "pack_en_food_01"), "m1"));
    await call(pushBody(voided("pack-2"), "m2"));
    expect(core.rowFor(await hashOf("pack-2"))?.revoked).toBe(1);
    await call(pushBody(voided("never-seen"), "m3"));
    const h = await hashOf("never-seen");
    expect(core.rowFor(h)).toMatchObject({ revoked: 1, product_id: null });
    expect(core.bindOnly({ tokenHash: h, callerInstallHash: "1".repeat(64), nowMs: NOW })).toBe("REVOKED");
  });

  it("subscription notifications and voided productType 1 are not expected: acked (204), logged, ignored", async () => {
    const { core, google, call } = await setup();
    expect((await call(pushBody({ subscriptionNotification: { version: "1.0", notificationType: 4, purchaseToken: "s-1" } }, "s1"))).status).toBe(204);
    expect((await call(pushBody(voided("s-1", 1), "s2"))).status).toBe(204);
    expect(google.calls).toEqual([]);
    expect(core.rowFor(await hashOf("s-1"))).toBeNull();
    expect(core.rtdnSeen("s1") && core.rtdnSeen("s2")).toBe(true);
  });

  it("RTDN obfuscated-id binding skipped when the token already has a binding or is at the limit", async () => {
    const { core, google, call } = await setup();
    google.products.set("prem-4", premium({ obfuscatedExternalAccountId: "9".repeat(64) }));
    const h = await hashOf("prem-4");
    for (let i = 1; i <= 10; i++) core.applyPurchase({ tokenHash: h, productId: "premium", n: normalizeProduct(premium(), NOW - 5000), callerInstallHash: String(i).padStart(64, "0"), rawTokenForAck: "prem-4", nowMs: NOW - 5000 });
    await call(pushBody(otp("prem-4")));
    expect(core.bindingsFor(h).some((b) => b.install_hash === "9".repeat(64))).toBe(false);
  });

  it("package mismatch → 204, no Google call; wrong Pub/Sub subscription → 204; test notification → 204", async () => {
    const { google, call } = await setup();
    const other = JSON.stringify({ message: { data: btoa(JSON.stringify({ packageName: "com.other", ...otp("x") })), messageId: "p1" }, subscription: SUBSCRIPTION });
    expect((await call(other)).status).toBe(204);
    expect((await call(pushBody(otp("x"), "p2", "projects/x/subscriptions/evil"))).status).toBe(204);
    expect((await call(pushBody({ testNotification: { version: "1.0" } }, "p3"))).status).toBe(204);
    expect(google.calls).toEqual([]);
  });

  it("body > 16 KB → 413; limiter → 429; garbage → 204; unset Pub/Sub subscription var → 503", async () => {
    const { call } = await setup();
    expect((await call("x".repeat(16_385))).status).toBe(413);
    expect((await call(pushBody(otp("x")), env({ RTDN_LIMITER: { limit: async () => ({ success: false }) } }))).status).toBe(429);
    expect((await call("not json")).status).toBe(204);
    expect((await call(pushBody(otp("x")), env({ RTDN_SUBSCRIPTION: "" }))).status).toBe(503);
    expect((await call(pushBody(otp("x")), env({ RTDN_AUDIENCE: "" }))).status).toBe(503);
  });

  it("Google 503 → 503 and no rtdnMark (redelivery retries); Google 404 → 204", async () => {
    const { core, google, call } = await setup();
    google.products.set("prem-5", new GoogleHttpError(503, "product_get"));
    expect((await call(pushBody(otp("prem-5"), "r1"))).status).toBe(503);
    expect(core.rtdnSeen("r1")).toBe(false);
    expect((await call(pushBody(otp("unknown-token"), "r2"))).status).toBe(204);
    expect(core.rtdnSeen("r2")).toBe(true);
  });

  it("an OAuth token-endpoint failure is never 'gone': 503 with no rtdnMark", async () => {
    const { core, google, call } = await setup();
    for (const status of [503, 400]) {
      google.products.set("pack-t", new GoogleHttpError(status, "token"));
      expect((await call(pushBody(otp("pack-t", 1, "pack_en_food_01"), `t${status}`))).status).toBe(503);
      expect(core.rtdnSeen(`t${status}`)).toBe(false);
    }
  });

  it("a failed ack → 204 with ack_token kept for the cron", async () => {
    const { core, google, call } = await setup();
    google.products.set("prem-6", premium());
    google.ackError = new GoogleHttpError(500, "product_ack");
    expect((await call(pushBody(otp("prem-6")))).status).toBe(204);
    expect(core.rowFor(await hashOf("prem-6"))).toMatchObject({ acknowledged: 0, ack_token: "prem-6" });
    expect(core.pendingAcks(NOW + DAY).length).toBe(1);
  });

  it("401 for a token signed by an unknown key", async () => {
    const { call } = await setup();
    const evil = await rsaKey("g1");
    expect((await call(pushBody(otp("x")), env(), `Bearer ${await oidcToken(evil, NOW)}`)).status).toBe(401);
  });
});
