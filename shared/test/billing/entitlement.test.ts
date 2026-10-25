import { describe, expect, it } from "vitest";
import { PURCHASE_STATES, purchaseOwned } from "../../src/billing/entitlement";

describe("purchaseOwned (PAYMENTS-SPEC §2.2: lifetime premium and packs are one-time products)", () => {
  it("only PURCHASED and not revoked", () => {
    for (const state of PURCHASE_STATES) for (const revoked of [true, false]) {
      expect(purchaseOwned({ state, revoked }), `${state} ${revoked}`).toBe(state === "PURCHASED" && !revoked);
    }
  });
});
