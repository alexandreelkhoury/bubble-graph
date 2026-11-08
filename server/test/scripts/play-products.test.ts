// PAYMENTS-SPEC rev 4 §1.4 / JAMAA-PLATFORM §4.1: the Play Console product CSV.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTENT } from "@jamaa/content";
import { GAME_IDS as SHARED_GAME_IDS } from "@jamaa/shared/games/ids";
import { packProductId as sharedPackProductId, PASS_PRODUCT_ID as SHARED_PASS } from "@jamaa/shared/billing/products";
import { GAME_IDS, HEADER, listedPackFiles, packProductId, PASS_PRODUCT_ID, productRows } from "../../scripts/play-products.mjs";

const ROOT = new URL("../../../content", import.meta.url).pathname;

describe("play-products", () => {
  it("mirrors the shared constants", () => {
    expect(GAME_IDS).toEqual([...SHARED_GAME_IDS]);
    expect(PASS_PRODUCT_ID).toBe(SHARED_PASS);
    expect(packProductId("lb-food-01")).toBe(sharedPackProductId("lb-food-01"));
  });

  it("reads exactly the packs content/<game>/index.ts lists", () => {
    for (const g of GAME_IDS) {
      const files = listedPackFiles(ROOT, g);
      expect(files.map((f) => JSON.parse(readFileSync(f, "utf8")).id).sort()).toEqual(CONTENT[g as keyof typeof CONTENT].map((p) => (p as { id: string }).id).sort());
    }
  });

  it("row 1 is the JAMAA Pass subscription; then one row per sellable family (free packs skipped), JAMAA titles", () => {
    const pack = (id: string, o: Record<string, unknown> = {}) => ({ id, locale: "en", title: { en: `T ${id}`, fr: `F ${id}`, ar: `ع ${id}` }, pairs: [], ...o });
    const lines = productRows([
      { gameId: "mishana", pack: pack("en-food-01") },
      { gameId: "mishana", pack: pack("en-everyday-01", { tier: "free" }) },
      { gameId: "trivia", pack: pack("lb-quiz-02-en", { family: "lb-quiz-02" }) },
      { gameId: "trivia", pack: pack("lb-quiz-02-fr", { family: "lb-quiz-02", locale: "fr" }) },
      { gameId: "bluff", pack: { id: "bluff-x", sourceLocale: "ar", playableIn: ["ar", "en"], title: { en: "Bx, y", fr: "B", ar: "ب" }, items: [{ tier: "free" }, { tier: "pass" }] } },
    ]);
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe("jamaa_pass,subscription,*,*,*,JAMAA Pass,JAMAA Pass,JAMAA Pass,JAMAA Pass");
    expect(lines.slice(2)).toEqual([
      "pack_en_food_01,one-time,mishana,en-food-01,en,JAMAA – T en-food-01,JAMAA – F en-food-01,JAMAA – ع en-food-01,JAMAA – T en-food-01",
      'pack_bluff_x,one-time,bluff,bluff-x,en ar,"JAMAA – Bx, y",JAMAA – B,JAMAA – ب,"JAMAA – Bx, y"',
      "pack_lb_quiz_02,one-time,trivia,lb-quiz-02,en fr,JAMAA – T lb-quiz-02-en,JAMAA – F lb-quiz-02-en,JAMAA – ع lb-quiz-02-en,JAMAA – T lb-quiz-02-en",
    ]);
  });

  it("refuses an id Play would refuse and a family shared by two games", () => {
    expect(() => productRows([{ gameId: "mishana", pack: { id: "x".repeat(36), locale: "en", title: {} } }])).toThrow(/invalid product id/);
    expect(() => productRows([{ gameId: "mishana", pack: { id: "a", locale: "en" } }, { gameId: "trivia", pack: { id: "b", family: "a", locale: "en" } }])).toThrow(/used by/);
  });

  it("the shipped content gives the Pass plus one row per premium Mish Ana! pack (word-pack product ids unchanged, §4.6)", () => {
    const packs = GAME_IDS.flatMap((g) => CONTENT[g as keyof typeof CONTENT].map((p) => ({ gameId: g, pack: p as Record<string, unknown> })));
    const lines = productRows(packs);
    expect(lines[1]?.startsWith("jamaa_pass,")).toBe(true);
    expect(lines).toContain(lines.find((l) => l.startsWith("pack_en_food_01,one-time,mishana,en-food-01,en,")));
    expect(lines.some((l) => l.startsWith("pack_en_everyday_01,"))).toBe(false);
  });
});
