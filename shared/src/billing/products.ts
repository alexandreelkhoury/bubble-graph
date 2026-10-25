// PAYMENTS-SPEC §1.3 / §1.6: Play product ids and the pack ↔ product mapping. Zod-free (safe for the web client at runtime).
// Mirrored exactly by tv-app `billing/Products.kt` (checked against shared/fixtures/billing.products.json).
import type { Settings } from "../engine/types";

/** Lifetime Premium: a one-time, non-consumable Play in-app product (owner decision 2026-10-26; no subscription). */
export const PREMIUM_PRODUCT_ID = "premium" as const;
export const PACK_PRODUCT_PREFIX = "pack_" as const;
export const PRODUCT_ID_MAX = 40;                                       // Play product id length limit
export const PREMIUM_PACK_ID_MAX = PRODUCT_ID_MAX - PACK_PRODUCT_PREFIX.length; // 35
export const PRODUCT_ID_REGEX = /^[a-z0-9][a-z0-9_.]{0,39}$/;

/** "lb-food-01" → "pack_lb_food_01". */
export function packProductId(packId: string): string {
  return PACK_PRODUCT_PREFIX + packId.replaceAll("-", "_");
}

/** "pack_lb_food_01" → "lb-food-01"; null for anything that is not a well-formed pack product id. */
export function packIdFromProductId(productId: string): string | null {
  if (!productId.startsWith(PACK_PRODUCT_PREFIX)) return null;
  const rest = productId.slice(PACK_PRODUCT_PREFIX.length);
  return /^[a-z0-9]+(_[a-z0-9]+)*$/.test(rest) ? rest.replaceAll("_", "-") : null;
}

/** §1.6: settings that only a premium room may change from DEFAULT_SETTINGS. Kotlin mirror: `Products.PREMIUM_SETTING_KEYS`. */
export const PREMIUM_SETTING_KEYS = ["points"] as const satisfies readonly (keyof Settings)[];
export type PremiumSettingKey = (typeof PREMIUM_SETTING_KEYS)[number];

/** True for every product id this app sells: `premium` or a well-formed `pack_*` id (all one-time products). */
export function isSellableProductId(productId: string): boolean {
  return productId === PREMIUM_PRODUCT_ID || packIdFromProductId(productId) !== null;
}

/** §4.7 `{email}`: the support address shown in `store.help` / `store.installLimit` (public on the landing page). */
export const SUPPORT_EMAIL: string = "alexkhoury@hotmail.com";
