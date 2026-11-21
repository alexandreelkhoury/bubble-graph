// Owner request (2026-11): at most one question per `family` ("the area of…", "the population of…") in a game.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { drawQuestions, drawReplacement, eligibleItems } from "../../../src/games/taqriban/engine/catalog";
import type { Candidate } from "../../../src/games/taqriban/engine/catalog";
import { TaqribanPackSchema } from "../../../src/games/taqriban/schema";
import type { TaqribanPack } from "../../../src/games/taqriban/schema";
import { createRng } from "../../../src/room/rng";
import { taqribanPack } from "../../../src/testing/catalogs/taqriban";

/** 20 items: 6 "area", 6 "population", 8 without a family. */
function familyPack(): TaqribanPack {
  const p = taqribanPack({ n: 20 });
  p.items.forEach((it, i) => { if (i < 6) it.family = "area"; else if (i < 12) it.family = "population"; });
  return p;
}
const pool = (p: TaqribanPack): Candidate[] => eligibleItems({ packs: [p] }, [], "en");
const famCount = (cs: readonly Candidate[], f: string): number => cs.filter((c) => c.item.family === f).length;

describe("one question per family", () => {
  it("a draw of 10 never holds two items of a family (500 seeds)", () => {
    const cands = pool(familyPack());
    for (let seed = 1; seed <= 500; seed++) {
      const { picked, rerun } = drawQuestions(cands, 10, [], createRng(seed));
      expect(picked).toHaveLength(10);
      expect(new Set(picked.map((c) => c.item.id)).size).toBe(10);
      expect(famCount(picked, "area")).toBeLessThanOrEqual(1);
      expect(famCount(picked, "population")).toBeLessThanOrEqual(1);
      expect(rerun).toBe(false);
    }
  });
  it("prefers an old item of a new family over a second item of a family, and only repeats a family when nothing else is left", () => {
    const cands = pool(familyPack());
    const noFam = cands.filter((c) => c.item.family === undefined).map((c) => c.item.id);
    // every family-less item already played: 10 = 1 area + 1 population + 8 old family-less ones
    const { picked, rerun } = drawQuestions(cands, 10, noFam, createRng(7));
    expect(famCount(picked, "area")).toBe(1);
    expect(famCount(picked, "population")).toBe(1);
    expect(rerun).toBe(true);
    // 12 > 8 + 2 families: two more must come from a family
    expect(drawQuestions(cands, 12, [], createRng(3)).picked).toHaveLength(12);
  });
  it("a replacement avoids the families of the game's other questions while it can", () => {
    const cands = pool(familyPack());
    for (let seed = 1; seed <= 200; seed++) {
      const rep = drawReplacement(cands, new Set(["sq-000"]), [], createRng(seed), new Set(["area", "population"]));
      expect(rep?.item.family).toBeUndefined();
    }
    const onlyFam = cands.filter((c) => c.item.family === "area");
    expect(drawReplacement(onlyFam, new Set(), [], createRng(1), new Set(["area"]))?.item.family).toBe("area");
  });
});

describe("shipped packs", () => {
  const dir = join(import.meta.dirname, "..", "..", "..", "..", "content", "taqriban");
  const packs = ["taqriban-christmas.json", "taqriban-levant.json", "taqriban-world.json"].map((f) => TaqribanPackSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))));
  it("tag the area and population questions", () => {
    const all = packs.flatMap((p) => p.items);
    expect(all.filter((i) => i.family === "area").length).toBe(6);
    expect(all.filter((i) => i.family === "population").length).toBe(13);
    for (const i of all.filter((x) => x.family === "area")) expect(i.text.en).toMatch(/\barea\b/i);
    for (const i of all.filter((x) => x.family === "population")) expect(i.text.en).toMatch(/population|people lived/i);
  });
  it("the Christmas pack tags its repeated templates (record heights, years to No. 1, record weights and lengths, copies)", () => {
    const xmas = packs[0]!.items;
    const fams = (f: string): number => xmas.filter((i) => i.family === f).length;
    expect([fams("record-height"), fams("years-to-no1"), fams("record-weight"), fams("record-length"), fams("copies")]).toEqual([4, 2, 3, 4, 4]);
    // the Levant hummus and tabbouleh records share the record-weight family
    expect(packs[1]!.items.filter((i) => i.family === "record-weight").map((i) => i.id)).toEqual(["tl-002", "tl-003"]);
  });
  it("a normal game from all packs has at most one of each family (300 seeds)", () => {
    const cands = packs.flatMap((p) => pool(p));
    const families = [...new Set(packs.flatMap((p) => p.items.flatMap((i) => (i.family ? [i.family] : []))))];
    for (let seed = 1; seed <= 300; seed++) {
      const { picked } = drawQuestions(cands, 10, [], createRng(seed));
      for (const f of families) expect(famCount(picked, f), f).toBeLessThanOrEqual(1);
    }
  });
});
