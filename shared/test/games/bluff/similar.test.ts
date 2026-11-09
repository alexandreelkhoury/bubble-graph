import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { collides, hitsBlocklist, isTooClose, levenshtein, normalizeAnswer, tokens } from "../../../src/games/bluff/engine/similar";

// GAME-BLUFF §5.2 required vectors (truth, lie, expected)
const VECTORS: [string, string, boolean][] = [
  ["The smell of earth after rain", "smell of the earth after the rain", true],
  ["The smell of earth after rain", "The smell of rain", false],
  ["Ne pas venir à un rendez-vous", "ne pas venir a un rendez vous", true],
  ["Ne pas venir à un rendez-vous", "Venir en retard à un rendez-vous", false],
  ["مش متل اللي بيعدّها", "مش مثل اللي بيعدها", true],
  ["مش متل اللي بيعدّها", "بيوجعو أكتر", false],
  ["A warning shout before throwing water from a window", "warning shout before throwing water out a window", true],
  ["is a gazelle", "is a beautiful gazelle", true],
  ["غزال", "غزال حلو", true],
  ["ماتوا", "ماتو", true],
  ["ماتوا", "ماتوا كلّن", true],
  ["مات", "بات", true],
  ["se lo lleva la corriente", "se lo lleva la corriente!", true],
  ["se lo lleva la corriente", "lo lleva la corriente", true],
  ["se lo lleva la corriente", "se lo come el pez", false],
  ["ménage sa monture", "menage sa monture", true],
];

describe("isTooClose (§5.2 vectors)", () => {
  for (const [t, l, want] of VECTORS) it(`${t} ← ${l} = ${want}`, () => expect(isTooClose(l, [t])).toBe(want));
  it("Arabizi truthAlt catches the transliteration", () => {
    expect(isTooClose("ghazal", ["is a gazelle", "ghazal", "غزال"])).toBe(true);
    expect(isTooClose("a gazebo", ["is a gazelle", "ghazal"])).toBe(false);
  });
  it("source-locale truth is checked too (typing the Arabic ending in an EN room)", () => {
    expect(isTooClose("غزال", ["is a gazelle", "غزال"])).toBe(true);
  });
  it("Arabic diacritics, tatweel and hamza/alef variants collide", () => {
    expect(isTooClose("أكتر", ["اكتر"])).toBe(true);
    expect(isTooClose("بيعـــدها", ["بيعدّها"])).toBe(true);
    expect(isTooClose("مدرسة", ["مدرسه"])).toBe(true);
    expect(isTooClose("على", ["علي"])).toBe(true);
  });
  it("Arabic leading و/ف conjunction on long tokens", () => {
    expect(normalizeAnswer("والبيت")).toBe(normalizeAnswer("البيت"));
    expect(normalizeAnswer("فالولد")).toBe(normalizeAnswer("ولد"));
  });
  it("Spanish ñ folds to n and inverted punctuation is dropped ([VERIFY] in GAME-BLUFF §15 resolved)", () => {
    expect(normalizeAnswer("¡Mañana!")).toBe("manana");
    expect(normalizeAnswer("¿Qué más?")).toBe(normalizeAnswer("que mas"));
  });
  it("French elision l' d' qu' with straight or curly apostrophe", () => {
    expect(tokens("l’eau d'été")).toEqual(["eau", "ete"]);
    expect(normalizeAnswer("qu'il pleuve")).toBe(normalizeAnswer("il pleuve"));
  });
  it("property: isTooClose(x, [x]) for any text with ≥ 2 letters", () => {
    const alpha = fc.constantFrom(..."abcdefghijklmnopqrstuvwxyzéàñçابتثجحخدذرزسشصضطظعغفقكلمنهوي".split(""), " ", "'", "-", "!");
    fc.assert(fc.property(fc.array(alpha, { minLength: 2, maxLength: 40 }).map((a) => a.join("")), (x) => {
      fc.pre((x.match(/\p{L}/gu) ?? []).length >= 2);
      return isTooClose(x, [x]);
    }), { numRuns: 500 });
  });
  it("property: normalisation is idempotent-stable for matching (x ≈ its normalised form)", () => {
    fc.assert(fc.property(fc.stringMatching(/^[a-z]{2,12}( [a-z]{2,12}){0,4}$/), (x) => isTooClose(normalizeAnswer(x), [x]) || normalizeAnswer(x).length === 0));
  });
});

describe("collides (§5.3)", () => {
  it("equal after normalisation", () => expect(collides("A cat, sleeping!", "a cat sleeping")).toBe(true));
  it("one typo on a long answer (threshold 0.1)", () => expect(collides("an elephant umbrella", "an elephant umbrela")).toBe(true));
  it("two edits on a medium answer do not collide", () => expect(collides("blue whale", "blue snail")).toBe(false));
  it("distinct", () => expect(collides("a tiny hat", "a big boot")).toBe(false));
});

describe("levenshtein / blocklist", () => {
  it("levenshtein basics", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("مات", "بات")).toBe(1);
  });
  it("blocklist hits whole tokens and multi-word entries, not substrings", () => {
    expect(hitsBlocklist("You zzblockedword", ["zzblockedword"])).toBe(true);
    expect(hitsBlocklist("zzblockedwordy", ["zzblockedword"])).toBe(false);
    expect(hitsBlocklist("a very bad phrase here", ["bad phrase"])).toBe(true);
    expect(hitsBlocklist("anything", [])).toBe(false);
  });
});
