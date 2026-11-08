// PAYMENTS-SPEC §1.3 / §1.6: Play product ids and the pack ↔ product mapping. Zod-free (safe for the web client at runtime).
// Mirrored exactly by tv-app `billing/Products.kt` (checked against shared/fixtures/billing.products.json).
import type { Settings } from "../games/mishana/engine/types";

/** JAMAA-PLATFORM §4.1: the JAMAA Pass subscription (base plans monthly/yearly, offer trial-7d on each). */
export const PASS_PRODUCT_ID = "jamaa_pass" as const;
/** @deprecated Use PASS_PRODUCT_ID. Kept one milestone so clients port without churn; the lifetime `premium` is gone. */
export const PREMIUM_PRODUCT_ID = PASS_PRODUCT_ID;
export const BASE_PLAN_IDS = ["monthly", "yearly"] as const;          // display order on the TV
export type BasePlanId = (typeof BASE_PLAN_IDS)[number];
export const TRIAL_OFFER_ID = "trial-7d" as const;
export const PACK_PRODUCT_PREFIX = "pack_" as const;
export const PRODUCT_ID_MAX = 40;                                       // Play limit for subscriptions; applied to packs too
/** §4.1: applies to content FAMILIES (`pack_<family>` ≤ 40). */
export const PREMIUM_PACK_ID_MAX = PRODUCT_ID_MAX - PACK_PRODUCT_PREFIX.length; // 35
export const PRODUCT_ID_REGEX = /^[a-z0-9][a-z0-9_.]{0,39}$/;

/** Family "lb-food-01" → "pack_lb_food_01" (§4.1: one product per content family; a word pack's family is its id). */
export function packProductId(family: string): string {
  return PACK_PRODUCT_PREFIX + family.replaceAll("-", "_");
}

/** "pack_lb_food_01" → family "lb-food-01"; null for anything that is not a well-formed pack product id. */
export function familyFromProductId(productId: string): string | null {
  if (!productId.startsWith(PACK_PRODUCT_PREFIX)) return null;
  const rest = productId.slice(PACK_PRODUCT_PREFIX.length);
  return rest.length <= PREMIUM_PACK_ID_MAX && /^[a-z0-9]+(_[a-z0-9]+)*$/.test(rest) ? rest.replaceAll("_", "-") : null;
}
/** @deprecated Use familyFromProductId (entitlements hold families, §4.2). */
export const packIdFromProductId = familyFromProductId;

/** §4.2: `jamaa_pass` and well-formed `pack_*` ids are sellable (whether the family exists is checked by the caller). */
export function isSellableProductId(productId: string): boolean {
  return productId === PASS_PRODUCT_ID || familyFromProductId(productId) !== null;
}

/** §1.6: Mish Ana! settings only a Pass room may change from the defaults (= MISHANA_META.settings.premiumKeys, checked by
 *  a test). Kotlin mirror: `Products.PREMIUM_SETTING_KEYS`. Other games declare theirs in `meta.settings.premiumKeys`. */
export const PREMIUM_SETTING_KEYS = ["points"] as const satisfies readonly (keyof Settings)[];
export type PremiumSettingKey = (typeof PREMIUM_SETTING_KEYS)[number];

/** §4.7 `{email}`: the support address shown in `store.help` / `store.installLimit`. The owner fills it (§8.D); empty hides help. */
export const SUPPORT_EMAIL: string = "alexkhoury@hotmail.com"; // owner value (lost by the P0 reverse diff of 78e9a01, restored in P2)
