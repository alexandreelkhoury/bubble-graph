import { describe, expect, it } from "vitest";
import { isGuessCorrect, normalizeGuess } from "../../src/engine/normalize";

const VECTORS: [string, string][] = [
  ["Crème Brûlée", "cremebrulee"],
  ["creme brulee", "cremebrulee"],
  ["L'Œuf", "oeuf"],
  ["The Ice-Cream", "icecream"],
  ["Straße", "strasse"],
  ["  KA'KE  ", "kake"],
  ["مَنْقُوشَة", "منقوشه"],
  ["منقوشة", "منقوشه"],
  ["مـــنقوشة", "منقوشه"],
  ["الحمّص", "حمص"],
  ["أرز", "ارز"],
  ["إبريق", "ابريق"],
  ["آذان", "اذان"],
  ["مستشفى", "مستشفي"],
  ["فؤاد", "فواد"],
  ["سائق", "سايق"],
  ["٣ قطط", "3قطط"],
  ["ﻻ", "لا"],
];

describe("normalizeGuess (§4.12)", () => {
  it.each(VECTORS)("%s → %s", (input, out) => {
    expect(normalizeGuess(input)).toBe(out);
  });
  it("extended digits, ligatures and stop-word edge cases", () => {
    expect(normalizeGuess("۴")).toBe("4");
    expect(normalizeGuess("Æther łódź")).toBe("aetherlodz");
    expect(normalizeGuess("the")).toBe("the"); // a lone stop word is kept
    expect(normalizeGuess("le la")).toBe("lela"); // all stop words → keep them
    expect(normalizeGuess("ال")).toBe("ال"); // too short to strip
    expect(normalizeGuess("   ")).toBe("");
  });
});

describe("isGuessCorrect", () => {
  const side = { text: "Ice Cream", translit: null, alt: ["Gelato"] };
  it("matches text, alt and translit", () => {
    expect(isGuessCorrect("ice-cream", side)).toBe(true);
    expect(isGuessCorrect("GELATO", side)).toBe(true);
    expect(isGuessCorrect("sorbet", side)).toBe(false);
    expect(isGuessCorrect("!!!", side)).toBe(false);
    const ar = { text: "منقوشة", translit: "Man2oushe", alt: [] };
    expect(isGuessCorrect("man2oushe", ar)).toBe(true);
    expect(isGuessCorrect("منقوشه", ar)).toBe(true);
  });
});
