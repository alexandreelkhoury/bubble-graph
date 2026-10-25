// PAYMENTS-SPEC §2.2: Google purchase state → access. Pure and zod-free.
// Every product is a one-time in-app product (lifetime `premium` and the `pack_*` packs); there is no subscription.

/** `ProductPurchaseV2.purchaseStateContext.purchaseState`. */
export const PURCHASE_STATES = ["PURCHASED", "PENDING", "CANCELLED"] as const;
export type PurchaseState = (typeof PURCHASE_STATES)[number];

/** A one-time purchase grants access only when PURCHASED and never revoked (revoked is sticky, §3.5). */
export function purchaseOwned(p: { state: PurchaseState; revoked: boolean }): boolean {
  return p.state === "PURCHASED" && !p.revoked;
}
