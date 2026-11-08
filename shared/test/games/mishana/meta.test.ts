// JAMAA-PLATFORM §0 / §1.3: game #1 keeps its name "Mish Ana!" under the internal game id "mishana".
import { describe, expect, it } from "vitest";
import { GAME1 } from "../../../src/games/mishana/meta";

describe("GAME1", () => {
  it("is Mish Ana! with the id mishana", () => {
    expect(GAME1).toEqual({ id: "mishana", name: "Mish Ana!", nameAr: "مش أنا!" });
  });
});
