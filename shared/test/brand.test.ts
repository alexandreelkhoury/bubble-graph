// JAMAA-PLATFORM §1.3 / §1.4: the platform brand is JAMAA; game #1 keeps its name under its game id.
import { describe, expect, it } from "vitest";
import { BRAND } from "../src/brand";
import { GAME1 } from "../src/games/mishana/meta";

describe("brand", () => {
  it("is the JAMAA platform brand", () => {
    expect(BRAND).toEqual({ name: "JAMAA", nameAr: "جماعة", slug: "jamaa", storagePrefix: "jamaa", androidAppId: "app.jamaa.tv" });
  });
  it("keeps game #1 as Mish Ana! with the internal id mishana", () => {
    expect(GAME1).toEqual({ id: "mishana", name: "Mish Ana!", nameAr: "مش أنا!" });
  });
});
