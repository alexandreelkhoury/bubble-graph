// PAYMENTS-SPEC §2.2: Google purchase state → access. Pure and zod-free.

/** `SubscriptionPurchaseV2.subscriptionState` (discovery enum). */
export const SUB_STATES = [
  "SUBSCRIPTION_STATE_UNSPECIFIED", "SUBSCRIPTION_STATE_PENDING", "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_PAUSED", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_CANCELED",
  "SUBSCRIPTION_STATE_EXPIRED", "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED",
] as const;
export type SubState = (typeof SUB_STATES)[number];

/** `ProductPurchaseV2.purchaseStateContext.purchaseState`. */
export const PACK_STATES = ["PURCHASED", "PENDING", "CANCELLED"] as const;
export type PackState = (typeof PACK_STATES)[number];

/** Keeps a token issued just before an auto-renewal valid until the TV fetches a fresh one (§2.2). */
export const RENEWAL_SLACK_MS = 6 * 3600_000;

/**
 * Latest instant (ms) until which a subscription grants Premium, or null when it grants nothing now.
 * Subscriptions have no `revoked` input: Google's state is the only source of truth (§2.2, §3.6).
 */
export function subscriptionAccessUntil(
  s: { state: SubState; expiryMs: number | null; autoRenew: boolean },
  nowMs: number,
): number | null {
  if (s.expiryMs === null) return null;
  let until: number;
  switch (s.state) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      until = s.expiryMs + (s.autoRenew ? RENEWAL_SLACK_MS : 0);
      break;
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      until = s.expiryMs + RENEWAL_SLACK_MS;
      break;
    case "SUBSCRIPTION_STATE_CANCELED":
      until = s.expiryMs;
      break;
    default:
      return null;
  }
  return until > nowMs ? until : null;
}

/** A one-time pack grants access only when PURCHASED and never revoked (revoked is sticky, §3.5). */
export function packOwned(p: { state: PackState; revoked: boolean }): boolean {
  return p.state === "PURCHASED" && !p.revoked;
}
