import { describe, expect, it } from "vitest";
import { packOwned, PACK_STATES, RENEWAL_SLACK_MS, SUB_STATES, subscriptionAccessUntil } from "../../src/billing/entitlement";
import type { SubState } from "../../src/billing/entitlement";

const NOW = 1_790_000_000_000;
const FUTURE = NOW + 86_400_000;
const PAST = NOW - 1;
const S = (s: string): SubState => `SUBSCRIPTION_STATE_${s}` as SubState;

describe("subscriptionAccessUntil (PAYMENTS-SPEC §2.2)", () => {
  it("ACTIVE: expiry + slack only while auto-renewing", () => {
    expect(subscriptionAccessUntil({ state: S("ACTIVE"), expiryMs: FUTURE, autoRenew: true }, NOW)).toBe(FUTURE + RENEWAL_SLACK_MS);
    expect(subscriptionAccessUntil({ state: S("ACTIVE"), expiryMs: FUTURE, autoRenew: false }, NOW)).toBe(FUTURE);
    expect(subscriptionAccessUntil({ state: S("ACTIVE"), expiryMs: PAST, autoRenew: false }, NOW)).toBeNull();
    // Inside the slack window after the old expiry: still premium.
    expect(subscriptionAccessUntil({ state: S("ACTIVE"), expiryMs: PAST, autoRenew: true }, NOW)).toBe(PAST + RENEWAL_SLACK_MS);
  });
  it("IN_GRACE_PERIOD: expiry + slack regardless of autoRenew", () => {
    for (const autoRenew of [true, false]) {
      expect(subscriptionAccessUntil({ state: S("IN_GRACE_PERIOD"), expiryMs: FUTURE, autoRenew }, NOW)).toBe(FUTURE + RENEWAL_SLACK_MS);
    }
  });
  it("CANCELED: until expiry, no slack", () => {
    expect(subscriptionAccessUntil({ state: S("CANCELED"), expiryMs: FUTURE, autoRenew: true }, NOW)).toBe(FUTURE);
    expect(subscriptionAccessUntil({ state: S("CANCELED"), expiryMs: PAST, autoRenew: false }, NOW)).toBeNull();
    expect(subscriptionAccessUntil({ state: S("CANCELED"), expiryMs: NOW, autoRenew: false }, NOW)).toBeNull();
  });
  it("every other state grants nothing", () => {
    const granting = new Set([S("ACTIVE"), S("IN_GRACE_PERIOD"), S("CANCELED")]);
    for (const state of SUB_STATES.filter((s) => !granting.has(s))) {
      for (const expiryMs of [PAST, FUTURE, null]) for (const autoRenew of [true, false]) {
        expect(subscriptionAccessUntil({ state, expiryMs, autoRenew }, NOW), state).toBeNull();
      }
    }
  });
  it("no expiry → no access", () => {
    for (const state of SUB_STATES) expect(subscriptionAccessUntil({ state, expiryMs: null, autoRenew: true }, NOW)).toBeNull();
  });
});

describe("packOwned", () => {
  it("PURCHASED and not revoked only", () => {
    for (const state of PACK_STATES) for (const revoked of [true, false]) {
      expect(packOwned({ state, revoked }), `${state} ${revoked}`).toBe(state === "PURCHASED" && !revoked);
    }
  });
});
