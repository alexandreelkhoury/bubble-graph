import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BLOCKLIST } from "../../../src/games/bluff/engine/blocklist";
import { collides, hitsBlocklist, isSpotOn, isTooClose, levenshtein, normalizeAnswer, tokens } from "../../../src/games/bluff/engine/similar";
import { sanitizeLie } from "../../../src/games/bluff/engine/text";

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
  // Rule 5 is bounded (≤ truth tokens + 2, len(T)/len(L) ≥ 0.4): a list of guesses is not "too close" (review finding)
  ["Is a gazelle", "Is a lion, a tiger, a gazelle or a prince", false],
  ["Saves nine", "Saves time, saves money, saves nine lives", false],
  ["غزال", "ملك، أسد، غزال، أمير، نمر", false],
  ["Tal astilla", "Tal fuego, tal astilla, tal mesa", false],
  ["Cubes", "Cubes stars hearts squares marbles", false],
];

/** §5.0 Spot on (stricter rule-5 bound, len(T)/len(L) ≥ 0.5). [truth, first entry, Spot on?] */
const SPOT_ON: [string, string, boolean][] = [
  ["Is a gazelle", "is a gazelle", true],
  ["Is a gazelle", "gazelle", true],
  ["is a gazelle", "ghazal", false],                    // alone; with the Arabizi truthAlt it matches (below)
  ["ماتوا", "ماتوا كلّن", true],
  ["غزال", "غزال حلو", true],
  ["Is a gazelle", "Is a lion, a tiger, a gazelle or a prince", false],
  ["Is a gazelle", "a beautiful gazelle", false],      // too close (a probe), not Spot on
  ["Saves nine", "Saves time, saves money, saves nine lives", false],
  ["غزال", "ملك، أسد، غزال، أمير، نمر", false],
  ["Tal astilla", "Tal fuego, tal astilla, tal mesa", false],
  ["se lo lleva la corriente", "lo lleva la corriente", true],
];

describe("isTooClose (§5.2 vectors)", () => {
  for (const [t, l, want] of VECTORS) it(`${t} ← ${l} = ${want}`, () => expect(isTooClose(l, [t])).toBe(want));
  for (const [t, l, want] of SPOT_ON) {
    it(`Spot on: ${t} ← ${l} = ${want}`, () => {
      expect(isSpotOn(l, [t])).toBe(want);
      if (want) expect(isTooClose(l, [t])).toBe(true);    // Spot on ⊂ too close
    });
  }
  it("Spot on with the Arabizi truthAlt", () => expect(isSpotOn("ghazal", ["is a gazelle", "ghazal", "غزال"])).toBe(true));
  it("homoglyph clone matches the truth after confusable folding (defence in depth behind the script rule)", () => {
    expect(isTooClose("Ηumаn fасеs", ["Human faces"])).toBe(true);
    expect(collides("Ηumаn fасеs", "Human faces")).toBe(true);
  });
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
  it("blocklist (plain array) hits whole tokens and multi-word entries, not substrings", () => {
    expect(hitsBlocklist("You zzblockedword", ["zzblockedword"])).toBe(true);
    expect(hitsBlocklist("zzblockedwordy", ["zzblockedword"])).toBe(false);
    expect(hitsBlocklist("a very bad phrase here", ["bad phrase"])).toBe(true);
    expect(hitsBlocklist("anything", [])).toBe(false);
  });
});

// Review finding: evasions that reached the TV in live runs, and offline misses. Each is sanitised first, as submitLie does.
const blocked = (text: string, loc: "en" | "fr" | "es" | "ar"): boolean => hitsBlocklist(sanitizeLie(text), BLOCKLIST[loc]);

describe("blocklist evasions (§5.4 hardened)", () => {
  const MUST_BLOCK: [string, "en" | "fr" | "es" | "ar"][] = [
    ["n i g g e r", "en"], ["n-i-g-g-e-r", "en"], ["n1gger", "en"], ["N!gger".replace("!", "1"), "en"], ["nіgger", "en"] /* Cyrillic і */,
    ["younigger", "en"], ["ni gger", "en"], ["fa\u00ADggot", "en"], ["f@ggot", "en"], ["niggers", "en"], ["faggots", "en"],
    ["raped", "en"], ["retards", "en"], ["retarded", "en"], ["porn", "en"], ["white power", "en"], ["WhItE pOwEr", "en"],
    ["nègres", "fr"], ["pédés", "fr"], ["salopes", "fr"], ["enculés", "fr"],
    ["maricones", "es"], ["putas", "es"], ["sudacas", "es"],
    ["شرم\u200Bوطة", "ar"], ["شرموطة", "ar"], ["كسك", "ar"], ["كسمك", "ar"], ["زبي", "ar"], ["شراميط", "ar"], ["قحاب", "ar"],
    ["منايك", "ar"], ["ع ر ص", "ar"], ["ياشرموطة", "ar"], ["والشرموطة", "ar"], ["معرص", "ar"], ["قحبات", "ar"], ["كس اختك", "ar"],
    // cross-locale (universal list) and Arabizi in a Latin room
    ["nigger", "fr"], ["nigger", "es"], ["puta", "en"], ["ya sharmouta", "en"], ["a7ba", "fr"], ["manyak", "es"], ["kes ekhtak", "en"],
    ["sharmouta", "fr"], ["kesomak", "en"],
  ];
  for (const [t, loc] of MUST_BLOCK) it(`blocks ${JSON.stringify(t)} (${loc})`, () => expect(blocked(t, loc)).toBe(true));

  const MUST_PASS: [string, "en" | "fr" | "es" | "ar"][] = [
    ["Summa cum laude", "en"], ["He graduated cum laude", "en"], ["Es de puta madre", "es"], ["A spicy pickle", "en"],
    ["Spiced grapes", "en"], ["The therapist sniggered", "en"], ["A scraped knee", "en"], ["Il est en retard", "fr"],
    ["Un violon violet", "fr"], ["Le fromage râpé", "fr"], ["Un perro negro", "es"], ["La computadora", "es"], ["America", "es"],
    ["Una disputa", "es"], ["Mon zébu", "fr"], ["زبون", "ar"], ["زبيب", "ar"], ["كسرة خبز", "ar"], ["عصفور", "ar"],
    ["Grandma bakes tiny clouds", "en"], ["A niggardly host", "en"], ["Nigeria", "en"], ["Niger river", "en"],
  ];
  for (const [t, loc] of MUST_PASS) it(`allows ${JSON.stringify(t)} (${loc})`, () => expect(blocked(t, loc)).toBe(false));
});
