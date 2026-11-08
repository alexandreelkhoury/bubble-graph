import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { itemIds, legacyTags, lintCommon, type GameEntry } from "../src/common";
import { GAME_LINTS } from "../src/games";
import { readGameEntries } from "../src/main";

const REPO_CONTENT = join(import.meta.dirname, "../../../content");

function wordPack(id: string, locale: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, game: "mishana", version: 1, locale, script: locale.startsWith("ar") ? "Arab" : "Latn",
    title: { en: "T", fr: "T", ar: "T", es: "T" }, ageRating: "all", tier: "premium", license: "CC-BY-4.0", source: "original", status: "reviewed",
    pairs: Array.from({ length: 10 }, (_, i) => ({ id: `p${String(i + 1).padStart(3, "0")}`, civilian: { text: `A${i}` }, undercover: { text: `B${i}` }, difficulty: 1 })),
    ...extra,
  };
}
const e = (data: Record<string, unknown>, game: GameEntry["game"] = "mishana"): GameEntry => ({ game, file: `${game}/${String(data.locale)}/${String(data.id)}.json`, data });

describe("common checks (JAMAA-PLATFORM §5.5)", () => {
  it("accepts valid packs", () => {
    expect(lintCommon([e(wordPack("en-a-01", "en")), e(wordPack("fr-a-01", "fr"))])).toEqual({ errors: [], warnings: [] });
  });

  it("requires `game` and that it matches the folder", () => {
    const { game: _g, ...noGame } = wordPack("en-a-01", "en");
    void _g;
    expect(lintCommon([e(noGame)]).errors).toEqual(['mishana/en/en-a-01.json: "game" is required ("game": "mishana")']);
    const errs = lintCommon([{ game: "trivia", file: "trivia/en/en-a-01.json", data: wordPack("en-a-01", "en") }]).errors.join("\n");
    expect(errs).toContain('"game" is "mishana" but the file lives under content/trivia/');
    expect(errs).toContain("schema (trivia ContentAdapter)");
  });

  it("pack ids are unique across games", () => {
    const errs = lintCommon([e(wordPack("en-a-01", "en")), { game: "bluff", file: "bluff/en-a-01.json", data: { id: "en-a-01", game: "bluff" } }]).errors;
    expect(errs.some((x) => x.includes('pack id "en-a-01" is also used by mishana/en/en-a-01.json'))).toBe(true);
  });

  it("checks family consistency: tier, item ids and distinct locales", () => {
    const en = wordPack("q-en", "en", { family: "q" });
    const fr = wordPack("q-fr", "fr", { family: "q", tier: "free" });
    const es = wordPack("q-es", "es", { family: "q", pairs: (wordPack("x", "es").pairs as object[]).slice(0, 10).map((p, i) => ({ ...p, id: `p${900 + i}` })) });
    const en2 = wordPack("q-en2", "en", { family: "q" });
    const errs = lintCommon([e(en), e(fr), e(es), e(en2)]).errors;
    expect(errs).toContain("family q: q-fr has tier free but q-en has premium");
    expect(errs).toContain("family q: q-es does not have the same item ids as q-en");
    expect(errs).toContain("family q: q-en2 and q-en have the same locale en");
  });

  it("featuredTopics ⊂ topics", () => {
    expect(lintCommon([e(wordPack("en-a-01", "en", { topics: ["food"], featuredTopics: ["food", "music"] }))]).errors).toEqual([
      'en-a-01: featuredTopics "music" is not in topics',
    ]);
  });

  it("draft free packs fail --release only", () => {
    const p = wordPack("en-a-01", "en", { tier: "free", status: "draft" });
    expect(lintCommon([e(p)]).errors).toEqual([]);
    expect(lintCommon([e(p)], { release: true }).errors).toEqual(['en-a-01: a free pack must be "reviewed" for release (status is "draft")']);
  });

  it("helpers: item ids per game shape and the legacy tags report", () => {
    expect(itemIds({ questions: [{ id: "q001" }] })).toEqual(["q001"]);
    expect(itemIds({ cards: [{ id: "c1" }] })).toEqual(["c1"]);
    expect(itemIds(null)).toBeNull();
    expect(legacyTags({ tags: ["food", "seeded"] }, ["food"])).toEqual({ mapped: ["food"], dropped: ["seeded"] });
  });

  it("has a lint module for every game", () => {
    expect(Object.keys(GAME_LINTS).sort()).toEqual(["bluff", "likely", "mishana", "trivia"]);
  });

  it("the repo content passes, and every Mish Ana! pack carries game and only vocabulary topics", () => {
    const entries = readGameEntries(REPO_CONTENT);
    expect(entries.filter((x) => x.game === "mishana")).toHaveLength(23);
    expect(lintCommon(entries).errors).toEqual([]);
    for (const x of entries) expect((x.data as { game?: string }).game).toBe(x.game);
  });
});
