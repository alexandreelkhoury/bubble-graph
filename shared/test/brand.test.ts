// JAMAA-PLATFORM §1.3 / §1.4: the platform brand is JAMAA.
import { describe, expect, it } from "vitest";
import { BRAND } from "../src/brand";

describe("brand", () => {
  it("is the JAMAA platform brand", () => {
    expect(BRAND).toEqual({ name: "JAMAA", nameAr: "جماعة", slug: "jamaa", storagePrefix: "jamaa", androidAppId: "app.jamaa.tv" });
  });
});
