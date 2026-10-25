// PAYMENTS-SPEC §1.4: `billing:products` CSV: the lifetime `premium` product first, then every premium pack, with prices.
import { describe, expect, it } from "vitest";
import { HEADER, productLines } from "../../scripts/play-products.mjs";

const pack = (id: string, pairs: number, tier?: string) => ({ id, locale: "en", ...(tier ? { tier } : {}), pairs: Array<unknown>(pairs).fill({}), title: { en: `T ${id}`, fr: "F, x", ar: "ع" } });

describe("play-products.mjs", () => {
  it("premium first at 7.99, then premium packs only: 1.99, or 2.99 from 60 pairs", () => {
    const lines = productLines([pack("en-food-01", 35), pack("en-everyday-01", 80, "free"), pack("en-big-01", 60), pack("en-mid-01", 59)]);
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe("premium,lifetime,7.99,,,,Mish Ana Premium,Mish Ana Premium,Mish Ana Premium");
    expect(lines.slice(2)).toEqual([
      'pack_en_food_01,pack,1.99,35,en-food-01,en,T en-food-01,"F, x",ع',
      'pack_en_big_01,pack,2.99,60,en-big-01,en,T en-big-01,"F, x",ع',
      'pack_en_mid_01,pack,1.99,59,en-mid-01,en,T en-mid-01,"F, x",ع',
    ]);
  });

  it("a pack id that maps to an invalid product id throws", () => {
    expect(() => productLines([pack("x".repeat(40), 1)])).toThrow(/invalid product id/);
  });
});
