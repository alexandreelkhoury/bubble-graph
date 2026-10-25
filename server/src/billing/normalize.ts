// PAYMENTS-SPEC §3.7: a Google one-time purchase (`purchases.productsv2`) → one flat shape the Billing DO stores.
// Every product is a one-time in-app product (lifetime `premium` and the `pack_*` packs); there is no subscription.
import { PURCHASE_STATES } from "@mishana/shared/billing";
import type { PurchaseState } from "@mishana/shared/billing";
import type { ProductPurchaseV2 } from "./google-types";

export interface NormalizedPurchase {
  productId: string; state: PurchaseState; acknowledged: boolean; test: boolean; obfuscatedAccountId: string | null;
  completedMs: number | null;   // Date.parse(purchaseCompletionTime); null while pending
  checkedMs: number;            // taken immediately BEFORE the Google fetch was sent
}

const parseTime = (s: string | undefined): number | null => {
  if (typeof s !== "string") return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};
const str = (s: unknown): string | null => (typeof s === "string" && s !== "" ? s : null);

export function normalizeProduct(r: ProductPurchaseV2, checkedMs: number): NormalizedPurchase {
  const raw = r.purchaseStateContext?.purchaseState ?? "";
  // PAY-GAP: PURCHASE_STATE_UNSPECIFIED (or an unknown value) is stored as CANCELLED: no access, no binding.
  const state: PurchaseState = (PURCHASE_STATES as readonly string[]).includes(raw) ? (raw as PurchaseState) : "CANCELLED";
  const items = Array.isArray(r.productLineItem) ? r.productLineItem : [];
  return {
    productId: str(items[0]?.productId) ?? "",
    state,
    acknowledged: r.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    test: r.testPurchaseContext !== undefined && r.testPurchaseContext !== null,
    obfuscatedAccountId: str(r.obfuscatedExternalAccountId),
    completedMs: state === "PURCHASED" ? parseTime(r.purchaseCompletionTime) : null,
    checkedMs,
  };
}
