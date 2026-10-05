import { describe, expect, it } from "vitest";
import { particleLanes } from "../src/tv-mock/tvResults";

describe("TV-11 civilian-win houses", () => {
  it("rise in two lanes that never overlap the title box", () => {
    const left = 245, right = 715; // "CIVILIANS WIN!" at displayL on the 960 dp canvas
    const xs = particleLanes(left, right);
    expect(xs).toHaveLength(12);
    for (const x of xs) expect(x + 28 <= left - 24 || x >= right + 24).toBe(true);
    for (const x of xs) expect(x >= 24 && x + 28 <= 960 - 24).toBe(true);
  });
  it("leaves a lane empty when the title is too wide for a house beside it", () => {
    expect(particleLanes(50, 910)).toEqual([]);
    expect(particleLanes(100, 910)).toHaveLength(6);
  });
});
