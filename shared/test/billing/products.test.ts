import { describe, expect, it } from "vitest";
import {
  BASE_PLAN_IDS, packIdFromProductId, packProductId, PREMIUM_PACK_ID_MAX, PREMIUM_PRODUCT_ID, PREMIUM_SETTING_KEYS,
  PRODUCT_ID_MAX, PRODUCT_ID_REGEX, TRIAL_OFFER_ID,
} from "../../src/billing/products";
import { DEFAULT_SETTINGS } from "../../src/engine/settings";
import { TEST_CATALOG } from "../../src/testing";

describe("billing products (PAYMENTS-SPEC §1.3)", () => {
  it("constants", () => {
    expect(PREMIUM_PRODUCT_ID).toBe("premium");
    expect(BASE_PLAN_IDS).toEqual(["monthly", "yearly"]);
    expect(TRIAL_OFFER_ID).toBe("trial-7d");
    expect(PRODUCT_ID_MAX).toBe(40);
    expect(PREMIUM_PACK_ID_MAX).toBe(35);
    expect(PREMIUM_SETTING_KEYS).toEqual(["points"]);
    for (const k of PREMIUM_SETTING_KEYS) expect(DEFAULT_SETTINGS[k]).toBeDefined();
  });
  it("pack ↔ product id round trip", () => {
    expect(packProductId("lb-food-01")).toBe("pack_lb_food_01");
    expect(packIdFromProductId("pack_en_things_01")).toBe("en-things-01");
    for (const p of TEST_CATALOG.packs) {
      const pid = packProductId(p.id);
      expect(PRODUCT_ID_REGEX.test(pid), pid).toBe(true);
      expect(packIdFromProductId(pid)).toBe(p.id);
    }
  });
  it("rejects malformed pack product ids", () => {
    for (const bad of ["pack_", "pack_A", "premium", "pack__x", "pack_x_", "pack_-x", "pak_x", "pack_x.y"]) {
      expect(packIdFromProductId(bad), bad).toBeNull();
    }
  });
  it("PRODUCT_ID_REGEX follows the Play format", () => {
    for (const ok of ["premium", "pack_en_food_01", "a", "0a.b_c", "a".repeat(40)]) expect(PRODUCT_ID_REGEX.test(ok), ok).toBe(true);
    for (const bad of ["", "_a", ".a", "A", "a-b", "a".repeat(41), "pack_en-food"]) expect(PRODUCT_ID_REGEX.test(bad), bad).toBe(false);
  });
});
