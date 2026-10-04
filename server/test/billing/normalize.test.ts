// PAYMENTS-SPEC §3.7 / §7.2: Google resources → NormalizedPurchase (samples shaped like the discovery schemas).
import { describe, expect, it } from "vitest";
import { normalizeProduct, normalizeSubscription } from "../../src/billing/normalize";
import { DAY, NOW, iso, product, sub } from "../support/billing";

describe("normalizeSubscription", () => {
  it("new subscription in a free trial, ack pending", () => {
    const n = normalizeSubscription(sub({ trial: true, basePlanId: "yearly", expiryMs: NOW + 7 * DAY, startTime: iso(NOW - 1000) }), 123);
    expect(n).toEqual({
      kind: "sub", productId: "premium", state: "SUBSCRIPTION_STATE_ACTIVE", expiryMs: NOW + 7 * DAY, autoRenew: true, basePlanId: "yearly",
      inTrial: true, acknowledged: false, test: false, obfuscatedAccountId: null, linkedPurchaseToken: null,
      outOfAppExpiredPurchaseToken: null, outOfAppExpiredObfuscatedAccountId: null, completedMs: NOW - 1000, checkedMs: 123,
    });
  });
  it("grace, canceled with a future expiry, revoked → EXPIRED", () => {
    expect(normalizeSubscription(sub({ subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" }), 0).state).toBe("SUBSCRIPTION_STATE_IN_GRACE_PERIOD");
    const c = normalizeSubscription(sub({ subscriptionState: "SUBSCRIPTION_STATE_CANCELED", autoRenew: false, acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" }), 0);
    expect(c).toMatchObject({ state: "SUBSCRIPTION_STATE_CANCELED", autoRenew: false, acknowledged: true });
    expect(normalizeSubscription(sub({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", expiryMs: NOW - 1 }), 0)).toMatchObject({ state: "SUBSCRIPTION_STATE_EXPIRED", expiryMs: NOW - 1 });
    expect(normalizeSubscription(sub({ subscriptionState: "SOMETHING_NEW" }), 0).state).toBe("SUBSCRIPTION_STATE_UNSPECIFIED");
  });
  it("linked token, out-of-app resubscribe with expiredExternalAccountIdentifiers, test purchase, obfuscated id", () => {
    const n = normalizeSubscription(sub({
      linkedPurchaseToken: "old-token",
      outOfAppPurchaseContext: { expiredPurchaseToken: "expired-token", expiredExternalAccountIdentifiers: { obfuscatedExternalAccountId: "a".repeat(64) } },
      externalAccountIdentifiers: { obfuscatedExternalAccountId: "b".repeat(64) },
      testPurchase: {},
    }), 0);
    expect(n).toMatchObject({
      linkedPurchaseToken: "old-token", outOfAppExpiredPurchaseToken: "expired-token", outOfAppExpiredObfuscatedAccountId: "a".repeat(64),
      obfuscatedAccountId: "b".repeat(64), test: true,
    });
  });
  it("expiry = max over premium line items; no premium line item keeps the foreign product id; pending has no completedMs", () => {
    const s = sub();
    s.lineItems = [
      { productId: "premium", expiryTime: iso(NOW + DAY), offerDetails: { basePlanId: "monthly" } },
      { productId: "premium", expiryTime: iso(NOW + 9 * DAY), offerDetails: { basePlanId: "yearly" } },
      { productId: "addon", expiryTime: iso(NOW + 99 * DAY) },
    ];
    expect(normalizeSubscription(s, 0)).toMatchObject({ expiryMs: NOW + 9 * DAY, basePlanId: "yearly", autoRenew: false });
    expect(normalizeSubscription({ lineItems: [{ productId: "other" }] }, 0).productId).toBe("other");
    expect(normalizeSubscription({ subscriptionState: "SUBSCRIPTION_STATE_PENDING", lineItems: [{ productId: "premium" }] }, 0)).toMatchObject({ completedMs: null, expiryMs: null });
  });
});

describe("normalizeProduct", () => {
  it("PURCHASED / PENDING / CANCELLED, completion time, test purchase", () => {
    expect(normalizeProduct(product(), 5)).toMatchObject({ kind: "pack", productId: "pack_en_food_01", state: "PURCHASED", completedMs: NOW - 60_000, test: false, checkedMs: 5 });
    expect(normalizeProduct(product({ state: "PENDING", purchaseCompletionTime: undefined }), 0)).toMatchObject({ state: "PENDING", completedMs: null });
    expect(normalizeProduct(product({ state: "CANCELLED" }), 0).state).toBe("CANCELLED");
    expect(normalizeProduct(product({ state: "PURCHASE_STATE_UNSPECIFIED" }), 0).state).toBe("CANCELLED");
    expect(normalizeProduct(product({ testPurchaseContext: { fopType: "TEST" }, obfuscatedExternalAccountId: "c".repeat(64) }), 0)).toMatchObject({ test: true, obfuscatedAccountId: "c".repeat(64) });
    expect(normalizeProduct(product({ acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" }), 0).acknowledged).toBe(true);
  });
});
