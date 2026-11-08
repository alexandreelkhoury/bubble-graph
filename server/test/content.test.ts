// JAMAA-PLATFORM §5.6: the injected content loader (Worker: text modules; Node: the @jamaa/content JSON).
import { describe, expect, it } from "vitest";
import { CONTENT } from "@jamaa/content";
import { GAME_IDS } from "@jamaa/shared/games/ids";
import { createContent, serverContent } from "../src/content";
import { CONTENT_TEXT } from "../src/content-modules.gen";

describe("server content loader", () => {
  it("parses each game's packs once, on first use, and only that game", () => {
    const calls: string[] = [];
    const c = createContent((g) => (calls.push(g), CONTENT[g]));
    expect(calls).toEqual([]);
    expect(c.raw("mishana").length).toBe(CONTENT.mishana.length);
    c.raw("mishana");
    expect(calls).toEqual(["mishana"]);
    const cat = c.catalog();
    expect(c.catalog()).toBe(cat);
    expect(cat.mishana.packs.length).toBe(CONTENT.mishana.length);
    expect(calls.sort()).toEqual([...GAME_IDS].sort());
  });

  it("accepts JSON strings (text modules) as well as parsed values, with the same result", () => {
    const fromText = createContent((g) => CONTENT[g].map((p) => JSON.stringify(p))).catalog();
    expect(fromText).toEqual(serverContent().catalog());
  });

  it("an invalid pack throws at catalog() (never at install)", () => {
    const c = createContent((g) => (g === "mishana" ? [{ id: "broken" }] : []));
    expect(() => c.catalog()).toThrow();
  });

  it("the generated text-module index lists the same games, and (when emitted) the same packs as @jamaa/content", () => {
    expect(Object.keys(CONTENT_TEXT)).toEqual([...GAME_IDS]);
    for (const g of GAME_IDS) {
      const n = CONTENT_TEXT[g]?.length ?? 0;
      if (n === 0) continue; // content-dist not emitted in this checkout (typecheck-only)
      expect(n).toBe(CONTENT[g].length);
    }
  });
});
