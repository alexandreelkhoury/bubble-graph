// PAYMENTS-SPEC §3.7: Google purchase resources → one flat shape the Billing DO stores.
import { PACK_STATES, PREMIUM_PRODUCT_ID, SUB_STATES } from "@mishana/shared/billing";
import type { PackState, SubState } from "@mishana/shared/billing";
import type { ProductPurchaseV2, SubscriptionPurchaseV2 } from "./google-types";

export interface NormalizedPurchase {
  kind: "sub" | "pack"; productId: string; state: string; expiryMs: number | null; autoRenew: boolean; basePlanId: string | null;
  inTrial: boolean; acknowledged: boolean; test: boolean; obfuscatedAccountId: string | null;
  linkedPurchaseToken: string | null; outOfAppExpiredPurchaseToken: string | null; outOfAppExpiredObfuscatedAccountId: string | null;
  completedMs: number | null;   // Date.parse(purchaseCompletionTime) for packs, Date.parse(startTime) for subs; null while pending
  checkedMs: number;            // taken immediately BEFORE the Google fetch was sent
}

const parseTime = (s: string | undefined): number | null => {
  if (typeof s !== "string") return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};
const str = (s: unknown): string | null => (typeof s === "string" && s !== "" ? s : null);

export function normalizeSubscription(r: SubscriptionPurchaseV2, checkedMs: number): NormalizedPurchase {
  const state: SubState = (SUB_STATES as readonly string[]).includes(r.subscriptionState ?? "")
    ? (r.subscriptionState as SubState)
    : "SUBSCRIPTION_STATE_UNSPECIFIED";
  const items = Array.isArray(r.lineItems) ? r.lineItems : [];
  const premium = items.filter((i) => i.productId === PREMIUM_PRODUCT_ID);
  let expiryMs: number | null = null;
  let latest = premium[0];
  for (const i of premium) {
    const t = parseTime(i.expiryTime);
    if (t !== null && (expiryMs === null || t > expiryMs)) {
      expiryMs = t;
      latest = i;
    }
  }
  return {
    kind: "sub",
    // A response without a "premium" line item keeps the first product id, so the product check (§3.4 d) fails.
    productId: premium.length > 0 ? PREMIUM_PRODUCT_ID : (str(items[0]?.productId) ?? ""),
    state,
    expiryMs,
    autoRenew: premium.some((i) => i.autoRenewingPlan?.autoRenewEnabled === true),
    basePlanId: str(latest?.offerDetails?.basePlanId),
    inTrial: premium.some((i) => i.offerPhase?.freeTrial !== undefined && i.offerPhase.freeTrial !== null),
    acknowledged: r.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    test: r.testPurchase !== undefined && r.testPurchase !== null,
    obfuscatedAccountId: str(r.externalAccountIdentifiers?.obfuscatedExternalAccountId),
    linkedPurchaseToken: str(r.linkedPurchaseToken),
    outOfAppExpiredPurchaseToken: str(r.outOfAppPurchaseContext?.expiredPurchaseToken),
    outOfAppExpiredObfuscatedAccountId: str(r.outOfAppPurchaseContext?.expiredExternalAccountIdentifiers?.obfuscatedExternalAccountId),
    completedMs: parseTime(r.startTime),
    checkedMs,
  };
}

export function normalizeProduct(r: ProductPurchaseV2, checkedMs: number): NormalizedPurchase {
  const raw = r.purchaseStateContext?.purchaseState ?? "";
  // PAY-GAP: PURCHASE_STATE_UNSPECIFIED (or an unknown value) is stored as CANCELLED: no access, no binding.
  const state: PackState = (PACK_STATES as readonly string[]).includes(raw) ? (raw as PackState) : "CANCELLED";
  const items = Array.isArray(r.productLineItem) ? r.productLineItem : [];
  return {
    kind: "pack",
    productId: str(items[0]?.productId) ?? "",
    state,
    expiryMs: null,
    autoRenew: false,
    basePlanId: null,
    inTrial: false,
    acknowledged: r.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    test: r.testPurchaseContext !== undefined && r.testPurchaseContext !== null,
    obfuscatedAccountId: str(r.obfuscatedExternalAccountId),
    linkedPurchaseToken: null,
    outOfAppExpiredPurchaseToken: null,
    outOfAppExpiredObfuscatedAccountId: null,
    completedMs: state === "PURCHASED" ? parseTime(r.purchaseCompletionTime) : null,
    checkedMs,
  };
}
