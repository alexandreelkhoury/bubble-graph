import { describe, expect, it } from "vitest";
import { SETTINGS_BOUNDS } from "../../src/constants";
import { applySettingsPatch, DEFAULT_PACK_IDS, DEFAULT_SETTINGS, defaultSettings, validateSettings } from "../../src/engine/settings";
import { eligiblePacks, selectedPackIds } from "../../src/engine/catalog";
import type { SettingsPatch } from "../../src/engine/types";
import { TEST_CATALOG } from "../../src/testing";

const apply = (patch: SettingsPatch, base = DEFAULT_SETTINGS) => applySettingsPatch(base, patch, TEST_CATALOG);

describe("settings", () => {
  it("defaults and key order (§4.4)", () => {
    expect(Object.keys(DEFAULT_SETTINGS)).toEqual([
      "winRule", "revealRoles", "roleMode", "undercoverCount", "blankCount", "clueSeconds", "voteSeconds", "revealSeconds",
      "guessSeconds", "tieBreak", "blankGuess", "wordLocale", "packIds", "difficulties", "familyFilter", "swapSides", "points",
    ]);
    expect(DEFAULT_SETTINGS).toMatchObject({
      winRule: "official", revealRoles: false, roleMode: "auto", undercoverCount: 0, blankCount: 1, clueSeconds: 45,
      voteSeconds: 90, revealSeconds: 30, guessSeconds: 45, tieBreak: "random", blankGuess: true, wordLocale: "en",
      packIds: ["en-everyday-01", "fr-everyday-01", "ar-everyday-01"], difficulties: [1, 2, 3], familyFilter: true, swapSides: true, points: { civilian: 2, undercover: 10, blank: 10 },
    });
    expect(validateSettings(DEFAULT_SETTINGS, TEST_CATALOG)).toBe(true);
  });

  const intBounds: [keyof typeof SETTINGS_BOUNDS, number, number][] = [
    ["undercoverCount", 0, 5], ["blankCount", 0, 5], ["clueSeconds", 10, 120], ["voteSeconds", 15, 300],
    ["revealSeconds", 10, 120], ["guessSeconds", 10, 120],
  ];
  it.each(intBounds)("%s accepts min/max, rejects min−1/max+1", (key, min, max) => {
    expect(apply({ [key]: min })).not.toBeNull();
    expect(apply({ [key]: max })).not.toBeNull();
    const off = (SETTINGS_BOUNDS[key] as { off?: number }).off;
    if (off === 0) {
      expect(apply({ [key]: 0 })).not.toBeNull();
      expect(apply({ [key]: min - 1 })).toBeNull();
    } else {
      expect(apply({ [key]: min - 1 })).toBeNull();
    }
    expect(apply({ [key]: max + 1 })).toBeNull();
    expect(apply({ [key]: min + 0.5 })).toBeNull();
  });
  it("points: each 0..20 and must be complete", () => {
    expect(apply({ points: { civilian: 0, undercover: 20, blank: 0 } })).not.toBeNull();
    expect(apply({ points: { civilian: -1, undercover: 10, blank: 6 } })).toBeNull();
    expect(apply({ points: { civilian: 2, undercover: 21, blank: 6 } })).toBeNull();
    expect(apply({ points: { civilian: 2, undercover: 10 } as never })).toBeNull();
    expect(apply({ points: null as never })).toBeNull();
  });
  it("enums and booleans", () => {
    expect(apply({ winRule: "parity", tieBreak: "none", roleMode: "custom" })).toMatchObject({ winRule: "parity", tieBreak: "none" });
    expect(apply({ winRule: "x" as never })).toBeNull();
    expect(apply({ tieBreak: "wheel" as never })).toBeNull();
    expect(apply({ roleMode: "x" as never })).toBeNull();
    expect(apply({ revealRoles: 1 as never })).toBeNull();
    expect(apply({ wordLocale: "de" as never })).toBeNull();
  });
  it("packIds: unique, regex, ≤50, exist with matching language", () => {
    expect(apply({ packIds: ["test-en-01"] })?.packIds).toEqual(["test-en-01"]);
    expect(apply({ packIds: ["test-en-01", "test-en-01"] })).toBeNull();
    expect(apply({ packIds: ["Bad_Id"] })).toBeNull();
    expect(apply({ packIds: ["missing-pack"] })).toBeNull();
    expect(apply({ packIds: ["test-fr-01"] })).toBeNull(); // wrong language
    expect(apply({ packIds: Array.from({ length: 51 }, (_, i) => `x${i}`) })).toBeNull();
    expect(apply({ packIds: "x" as never })).toBeNull();
    expect(apply({ wordLocale: "ar", packIds: ["test-ar-01"] })?.packIds).toEqual(["test-ar-01"]); // ar-LB → ar
  });
  it("difficulties: non-empty, unique, ascending subset of [1,2,3]", () => {
    expect(apply({ difficulties: [2] })?.difficulties).toEqual([2]);
    expect(apply({ difficulties: [1, 3] })).not.toBeNull();
    expect(apply({ difficulties: [] })).toBeNull();
    expect(apply({ difficulties: [3, 1] })).toBeNull();
    expect(apply({ difficulties: [1, 1] })).toBeNull();
    expect(apply({ difficulties: [4 as 1] })).toBeNull();
    expect(apply({ difficulties: "1" as never })).toBeNull();
  });
  it("changing wordLocale without packIds resets packIds to the default easy packs", () => {
    const withPack = apply({ packIds: ["test-en-01"] })!;
    expect(apply({ wordLocale: "fr" }, withPack)?.packIds).toEqual([...DEFAULT_PACK_IDS]);
    expect(apply({ wordLocale: "en" }, withPack)?.packIds).toEqual(["test-en-01"]); // same locale: kept
    expect(apply({ wordLocale: "fr", packIds: ["test-fr-01"] }, withPack)?.packIds).toEqual(["test-fr-01"]);
  });
  it("keeps key order and does not mutate the input; rejects unknown keys", () => {
    const out = apply({ points: { blank: 1, civilian: 1, undercover: 1 }, winRule: "parity" })!;
    expect(Object.keys(out)).toEqual(Object.keys(DEFAULT_SETTINGS));
    expect(DEFAULT_SETTINGS.winRule).toBe("official");
    expect(apply({ bogus: 1 } as never)).toBeNull();
  });
});

describe("default easy packs (DEFAULT_PACK_IDS)", () => {
  // TEST_CATALOG plus an easy pack per language, cloned from the test packs.
  const easy = (lang: "en" | "fr" | "ar") => {
    const src = TEST_CATALOG.packs.find((p) => p.id === `test-${lang}-01`)!;
    return { ...src, id: `${lang}-everyday-01` };
  };
  const cat = { packs: [...TEST_CATALOG.packs, easy("en"), easy("fr"), easy("ar")] };
  const ids = (s: typeof DEFAULT_SETTINGS) => eligiblePacks(cat, s).map((p) => p.id);
  it("selects only the room language's easy pack", () => {
    expect(validateSettings(DEFAULT_SETTINGS, cat)).toBe(true);
    expect(ids(DEFAULT_SETTINGS)).toEqual(["en-everyday-01"]);
    expect(ids({ ...DEFAULT_SETTINGS, wordLocale: "fr" })).toEqual(["fr-everyday-01"]);
    expect(ids({ ...DEFAULT_SETTINGS, wordLocale: "ar" })).toEqual(["ar-everyday-01"]);
  });
  it("a Hard pack can be ticked next to the easy one; [] still means all packs", () => {
    const s = applySettingsPatch(DEFAULT_SETTINGS, { packIds: [...DEFAULT_PACK_IDS, "test-en-prem-01"] }, cat)!;
    expect(ids(s)).toEqual(["test-en-prem-01", "en-everyday-01"]);
    expect(ids({ ...DEFAULT_SETTINGS, packIds: [] })).toContain("test-en-01");
  });
  it("default ids missing from the catalog are valid and ignored (all packs of the language)", () => {
    expect(validateSettings(DEFAULT_SETTINGS, TEST_CATALOG)).toBe(true);
    expect(selectedPackIds(TEST_CATALOG, DEFAULT_SETTINGS)).toEqual([]);
    expect(eligiblePacks(TEST_CATALOG, DEFAULT_SETTINGS).map((p) => p.id)).toEqual(["test-en-01", "test-en-prem-01"]);
    expect(applySettingsPatch(DEFAULT_SETTINGS, { packIds: ["fr-everyday-02"] }, TEST_CATALOG)).toBeNull(); // others still checked
  });
  it("defaultSettings() copies the list", () => {
    const a = defaultSettings();
    a.packIds.push("x");
    expect(DEFAULT_SETTINGS.packIds).toEqual([...DEFAULT_PACK_IDS]);
  });
});
