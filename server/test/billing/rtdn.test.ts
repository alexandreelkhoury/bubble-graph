// PAYMENTS-SPEC §3.6 / §7.2: the RTDN push endpoint end to end (real SQLite core, scripted Google, real OIDC check).
import { describe, expect, it } from "vitest";
import { GoogleHttpError } from "../../src/billing/google";
import { normalizeSubscription } from "../../src/billing/normalize";
import { handleRtdn, parsePush } from "../../src/billing/rtdn";
import type { RtdnEnv } from "../../src/billing/rtdn";
import { DAY, INSTALL_A, NOW, ScriptedGoogle, hashOf, newCore, product, sub } from "../support/billing";
import { AUD, EMAIL, jwksFor, oidcToken, rsaKey } from "../support/oidc";

const SUBSCRIPTION = "projects/mish-ana-billing/subscriptions/play-rtdn-push";
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

const subN = (purchaseToken: string, notificationType = 4) => ({ subscriptionNotification: { version: "1.0", notificationType, purchaseToken } });

describe("RTDN parsing", () => {
  it("accepts eventTimeMillis as a string or a number; garbage → null", () => {
    expect(parsePush(pushBody(subN("t")))?.n.subscriptionNotification?.purchaseToken).toBe("t");
    expect(parsePush(pushBody({ ...subN("t"), eventTimeMillis: 1790000000000 }))?.messageId).toBe("136969346945");
    expect(parsePush("{")).toBeNull();
    expect(parsePush(JSON.stringify({ message: { data: "!!!", messageId: "1" }, subscription: "s" }))).toBeNull();
  });
});

describe("POST /api/billing/rtdn", () => {
  it("subscription notification → get + apply + ack; obfuscated id binds; dedupe by messageId", async () => {
    const { core, google, call } = await setup();
    const installHash = await hashOf(INSTALL_A);
    google.subs.set("sub-1", sub({ externalAccountIdentifiers: { obfuscatedExternalAccountId: installHash } }));
    expect((await call(pushBody(subN("sub-1")))).status).toBe(204);
    expect(google.count("sub_get")).toBe(1);
    expect(google.count("sub_ack")).toBe(1);
    expect(core.rowFor(await hashOf("sub-1"))).toMatchObject({ acknowledged: 1, ack_token: null });
    expect(core.entitlementFor(installHash, NOW).premiumUntilMs).not.toBeNull();
    expect((await call(pushBody(subN("sub-1")))).status).toBe(204);
    expect(google.count("sub_get")).toBe(1); // deduped
  });

  it("one-time product notification → get + apply + ack", async () => {
    const { core, google, call } = await setup();
    google.products.set("pack-1", product());
    expect((await call(pushBody({ oneTimeProductNotification: { version: "1.0", notificationType: 1, purchaseToken: "pack-1", sku: "pack_en_food_01" } }))).status).toBe(204);
    expect(google.count("product_ack")).toBe(1);
    expect(core.rowFor(await hashOf("pack-1"))?.state).toBe("PURCHASED");
  });

  it("voided product → revoked; unknown hash → tombstone, a later /verify-style apply → REVOKED", async () => {
    const { core, google, call } = await setup();
    google.products.set("pack-2", product());
    await call(pushBody({ oneTimeProductNotification: { notificationType: 1, purchaseToken: "pack-2" } }, "m1"));
    await call(pushBody({ voidedPurchaseNotification: { purchaseToken: "pack-2", orderId: "GPA.1", productType: 2, refundType: 1 } }, "m2"));
    expect(core.rowFor(await hashOf("pack-2"))?.revoked).toBe(1);
    await call(pushBody({ voidedPurchaseNotification: { purchaseToken: "never-seen", orderId: "GPA.2", productType: 2, refundType: 1 } }, "m3"));
    const h = await hashOf("never-seen");
    expect(core.rowFor(h)).toMatchObject({ revoked: 1, product_id: null });
    expect(core.bindOnly({ tokenHash: h, callerInstallHash: "1".repeat(64), nowMs: NOW })).toBe("REVOKED");
  });

  it("voided sub, refundType 1, Google returns ACTIVE → premium kept, revoked stays 0", async () => {
    const { core, google, call } = await setup();
    google.subs.set("sub-2", sub({ acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" }));
    const h = await hashOf("sub-2");
    await core.applyPurchase({ tokenHash: h, kind: "sub", productId: "premium", n: normalizeSubscription(sub(), NOW - 1000), callerInstallHash: "2".repeat(64), rawTokenForAck: "sub-2", nowMs: NOW - 1000 });
    expect((await call(pushBody({ voidedPurchaseNotification: { purchaseToken: "sub-2", orderId: "GPA.3..1", productType: 1, refundType: 1 } }))).status).toBe(204);
    expect(google.count("sub_get")).toBe(1);
    expect(core.rowFor(h)?.revoked).toBe(0);
    expect(core.entitlementFor("2".repeat(64), NOW).premiumUntilMs).not.toBeNull();
  });

  it("voided sub with Google EXPIRED → premium ends", async () => {
    const { core, google, call } = await setup();
    google.subs.set("sub-3", sub());
    await call(pushBody(subN("sub-3"), "a1"));
    const h = await hashOf("sub-3");
    core.bindOnly({ tokenHash: h, callerInstallHash: "3".repeat(64), nowMs: NOW });
    google.subs.set("sub-3", sub({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", expiryMs: NOW - 1000 }));
    await call(pushBody({ voidedPurchaseNotification: { purchaseToken: "sub-3", orderId: "GPA.4", productType: 1, refundType: 2 } }, "a2"));
    expect(core.rowFor(h)?.revoked).toBe(0);
    expect(core.entitlementFor("3".repeat(64), NOW + 1).premiumUntilMs).toBeNull();
  });

  it("RTDN obfuscated-id binding skipped when the token already has a binding or is at the limit", async () => {
    const { core, google, call } = await setup();
    google.subs.set("sub-4", sub({ externalAccountIdentifiers: { obfuscatedExternalAccountId: "9".repeat(64) } }));
    const h = await hashOf("sub-4");
    for (let i = 1; i <= 10; i++) await core.applyPurchase({ tokenHash: h, kind: "sub", productId: "premium", n: normalizeSubscription(sub(), NOW - 5000), callerInstallHash: String(i).padStart(64, "0"), rawTokenForAck: "sub-4", nowMs: NOW - 5000 });
    await call(pushBody(subN("sub-4")));
    expect(core.bindingsFor(h).some((b) => b.install_hash === "9".repeat(64))).toBe(false);
  });

  it("package mismatch → 204, no Google call; wrong subscription → 204; test notification → 204", async () => {
    const { google, call } = await setup();
    const other = JSON.stringify({ message: { data: btoa(JSON.stringify({ packageName: "com.other", ...subN("x") })), messageId: "p1" }, subscription: SUBSCRIPTION });
    expect((await call(other)).status).toBe(204);
    expect((await call(pushBody(subN("x"), "p2", "projects/x/subscriptions/evil"))).status).toBe(204);
    expect((await call(pushBody({ testNotification: { version: "1.0" } }, "p3"))).status).toBe(204);
    expect(google.calls).toEqual([]);
  });

  it("body > 16 KB → 413; limiter → 429; garbage → 204; unset subscription var → 503", async () => {
    const { call } = await setup();
    expect((await call("x".repeat(16_385))).status).toBe(413);
    expect((await call(pushBody(subN("x")), env({ RTDN_LIMITER: { limit: async () => ({ success: false }) } }))).status).toBe(429);
    expect((await call("not json")).status).toBe(204);
    expect((await call(pushBody(subN("x")), env({ RTDN_SUBSCRIPTION: "" }))).status).toBe(503);
    expect((await call(pushBody(subN("x")), env({ RTDN_AUDIENCE: "" }))).status).toBe(503);
  });

  it("Google 503 → 503 and no rtdnMark (redelivery retries); Google 404 → 204", async () => {
    const { core, google, call } = await setup();
    google.subs.set("sub-5", new GoogleHttpError(503, "sub_get"));
    expect((await call(pushBody(subN("sub-5"), "r1"))).status).toBe(503);
    expect(core.rtdnSeen("r1")).toBe(false);
    expect((await call(pushBody(subN("unknown-token"), "r2"))).status).toBe(204);
    expect(core.rtdnSeen("r2")).toBe(true);
  });

  it("an OAuth token-endpoint failure is never 'gone': 503 with no rtdnMark, for every notification kind", async () => {
    const { core, google, call } = await setup();
    for (const status of [503, 400]) {
      google.subs.set("sub-t", new GoogleHttpError(status, "token"));
      google.products.set("pack-t", new GoogleHttpError(status, "token"));
      expect((await call(pushBody(subN("sub-t"), `t${status}a`))).status).toBe(503);
      expect((await call(pushBody({ oneTimeProductNotification: { notificationType: 1, purchaseToken: "pack-t", sku: "pack_en_food_01" } }, `t${status}b`))).status).toBe(503);
      expect((await call(pushBody({ voidedPurchaseNotification: { purchaseToken: "sub-t", productType: 1, refundType: 1 } }, `t${status}c`))).status).toBe(503);
      for (const id of ["a", "b", "c"]) expect(core.rtdnSeen(`t${status}${id}`)).toBe(false);
    }
  });

  it("a failed ack → 204 with ack_token kept for the cron", async () => {
    const { core, google, call } = await setup();
    google.subs.set("sub-6", sub());
    google.ackError = new GoogleHttpError(500, "sub_ack");
    expect((await call(pushBody(subN("sub-6")))).status).toBe(204);
    expect(core.rowFor(await hashOf("sub-6"))).toMatchObject({ acknowledged: 0, ack_token: "sub-6" });
    expect(core.pendingAcks(NOW + DAY).length).toBe(1);
  });

  it("401 for a token signed by an unknown key", async () => {
    const { call } = await setup();
    const evil = await rsaKey("g1");
    expect((await call(pushBody(subN("x")), env(), `Bearer ${await oidcToken(evil, NOW)}`)).status).toBe(401);
  });
});
