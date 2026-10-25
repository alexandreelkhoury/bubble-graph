// PAYMENTS-SPEC §3.7 / §7.2: Google one-time purchases → NormalizedPurchase (samples shaped like the discovery schemas).
import { describe, expect, it } from "vitest";
import { normalizeProduct } from "../../src/billing/normalize";
import { NOW, product } from "../support/billing";

describe("normalizeProduct", () => {
  it("PURCHASED / PENDING / CANCELLED, completion time, test purchase", () => {
    expect(normalizeProduct(product(), 5)).toEqual({ productId: "pack_en_food_01", state: "PURCHASED", completedMs: NOW - 60_000, test: false, checkedMs: 5, acknowledged: false, obfuscatedAccountId: null });
    expect(normalizeProduct(product({ productId: "premium" }), 0)).toMatchObject({ productId: "premium", state: "PURCHASED" });
    expect(normalizeProduct(product({ state: "PENDING", purchaseCompletionTime: undefined }), 0)).toMatchObject({ state: "PENDING", completedMs: null });
    expect(normalizeProduct(product({ state: "CANCELLED" }), 0).state).toBe("CANCELLED");
    expect(normalizeProduct(product({ state: "PURCHASE_STATE_UNSPECIFIED" }), 0).state).toBe("CANCELLED");
    expect(normalizeProduct(product({ testPurchaseContext: { fopType: "TEST" }, obfuscatedExternalAccountId: "c".repeat(64) }), 0)).toMatchObject({ test: true, obfuscatedAccountId: "c".repeat(64) });
    expect(normalizeProduct(product({ acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" }), 0).acknowledged).toBe(true);
  });
});
