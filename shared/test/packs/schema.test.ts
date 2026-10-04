import { describe, expect, it } from "vitest";
import { WordPackSchema } from "../../src/packs/schema";
import { TEST_PACKS } from "../../src/testing";

const base = TEST_PACKS[0];

describe("WordPackSchema tier (PAYMENTS-SPEC §1.2)", () => {
  it("a pack without `tier` parses as premium", () => {
    const { tier: _omit, ...rest } = { ...base, tier: undefined };
    void _omit;
    expect(WordPackSchema.parse(rest).tier).toBe("premium");
  });
  it("keeps an explicit tier and rejects unknown values", () => {
    expect(WordPackSchema.parse({ ...base, tier: "free" }).tier).toBe("free");
    expect(WordPackSchema.parse({ ...base, tier: "premium" }).tier).toBe("premium");
    expect(WordPackSchema.safeParse({ ...base, tier: "gold" }).success).toBe(false);
  });
  it("is still a strict object", () => {
    expect(WordPackSchema.safeParse({ ...base, price: 1 }).success).toBe(false);
  });
});
