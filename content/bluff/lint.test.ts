// Unit tests for the Bluff content-lint rules (tools/content-lint/src/games/bluff.ts, GAME-BLUFF §11.2–§11.3).
// They live here because the G2 lane D owns content/bluff/** and the rule module, not tools/content-lint/test/**.
import { describe, expect, it } from "vitest";
import { BLUFF_META } from "../../shared/src/games/bluff/meta";
import ar from "../../shared/i18n/games/bluff/ar.json";
import en from "../../shared/i18n/games/bluff/en.json";
import es from "../../shared/i18n/games/bluff/es.json";
import fr from "../../shared/i18n/games/bluff/fr.json";
import { collides, lintBluffI18n, lintBluffRaw, phaseKey, tooClose } from "../../tools/content-lint/src/games/bluff";

type Item = Record<string, unknown>;
const saying = (n: number, over: Item = {}): Item => ({
  id: `t-${String(n).padStart(3, "0")}`, type: "proverb_end", tier: "free", difficulty: 2, knownIn: [],
  prompt: { original: `Saying number ${n} starts…`, translit: null, display: {} },
  truth: { en: `Ends in way ${n}` }, truthAlt: {},
  houseLies: { en: [`Goes north ${n}`, `Sings at noon ${n}`, `Eats the moon ${n}`] },
  note: { en: "A note" }, review: { status: "draft", source: "[VERIFY] a book" }, ...over,
});
const packOf = (items: Item[], over: Item = {}): Item => ({
  schemaVersion: 1, id: "bluff-test", game: "bluff", title: { en: "T", fr: "T", ar: "ت" }, description: { en: "D", fr: "D", ar: "د" },
  sourceLocale: "en", playableIn: ["en"], ageRating: "all", fallbackHouseLies: {}, items, ...over,
});
const lint = (items: Item[], over: Item = {}, release = false) => lintBluffRaw([{ file: "bluff/bluff-test.json", raw: packOf(items, over) }], { release });
const base = (): Item[] => Array.from({ length: 20 }, (_, i) => saying(i + 1));

describe("bluff content-lint rules", () => {
  it("a clean pack passes", () => {
    expect(lint(base()).errors).toEqual([]);
  });

  it("rejects tashkeel, typographic quotes, trailing punctuation, emoji and lower-case starts in answers", () => {
    const items = base();
    items[0] = saying(1, { houseLies: { en: ["«Quoted»", "Ends here.", "Party 🎉"] } });
    items[1] = saying(2, { truth: { en: "lower case start" } });
    const e = lint(items).errors.join("\n");
    expect(e).toMatch(/guillemets/);
    expect(e).toMatch(/ends with/);
    expect(e).toMatch(/emoji/);
    expect(e).toMatch(/capital/);
    const ar = lintBluffRaw([{ file: "x", raw: packOf(Array.from({ length: 20 }, (_, i) => saying(i + 1, { prompt: { original: `مثل ${i}…`, translit: "x", display: {} }, truth: { ar: `جواب رقم ${i}` }, houseLies: { ar: ["كذبة أولى", "كِذبة تانية", "كذبة تالتة"] }, note: { ar: "ملاحظة" } })), { sourceLocale: "ar", playableIn: ["ar"] }) }]);
    expect(ar.errors.join("\n")).toMatch(/tashkeel/);
  });

  it("rejects a house lie that collides with or is too close to the truth (§5.2, §5.3)", () => {
    const items = base();
    items[0] = saying(1, { truth: { en: "Is a gazelle" }, houseLies: { en: ["Is a beautiful gazelle", "Is a lion", "Is a prince"] } });
    expect(lint(items).errors.join("\n")).toMatch(/too close/);
    expect(tooClose("Is a beautiful gazelle", "Is a gazelle")).toBe(true);
    expect(collides("Gazelle!", "gazelle")).toBe(true);
  });

  it("enforces the free-room thresholds: ≥ 30 % free and ≥ 7 free items not knownIn each playable locale", () => {
    const items = base().map((it, i) => ({ ...it, tier: i < 5 ? "free" : "pass" }));
    const e = lint(items).errors.join("\n");
    expect(e).toMatch(/items are free/);
    expect(e).toMatch(/only 5 free items/);
  });

  it("keeps finals in their own packs and without a truth", () => {
    const items = base();
    items[0] = { ...saying(1), type: "no_truth", prompt: { original: "Why?", translit: null, display: {} }, truth: {} };
    expect(lint(items).errors.join("\n")).toMatch(/only no_truth items/);
  });

  it("blocks other games' names, religion/politics tokens, profanity and famous myths", () => {
    const items = base();
    items[0] = saying(1, { note: { en: "Like in Fibbage" } });
    items[1] = saying(2, { houseLies: { en: ["Goes to church", "Sings at noon", "Eats the moon"] } });
    items[2] = { ...saying(3), type: "fact_blank", prompt: { original: "A goldfish memory lasts ___", translit: null, display: {} }, truth: { en: "Three second memory" } };
    const e = lint(items).errors.join("\n");
    expect(e).toMatch(/fibbage/);
    expect(e).toMatch(/religion/);
    expect(e).toMatch(/myth/);
  });

  it("requires a translation for every playable locale and a source before an item leaves draft", () => {
    const items = base();
    items[0] = saying(1, { review: { status: "native-reviewed", source: null } });
    const e = lint(items, { playableIn: ["en", "fr"] }).errors.join("\n");
    expect(e).toMatch(/prompt\.display\.fr is required/);
    expect(e).toMatch(/needs review\.source/);
  });

  it("warns when a fact's number is not in its source, or a round-2 truth repeats a prompt word", () => {
    const items = base();
    const fact = (n: number, prompt: string, truth: string, source: string): Item =>
      ({ ...saying(n), type: "fact_blank", prompt: { original: prompt, translit: null, display: {} }, truth: { en: truth }, review: { status: "draft", source } });
    items[0] = fact(1, "The tower can grow by up to ___", "15 centimetres", "[VERIFY] official site (up to 12 cm)");
    items[1] = fact(2, "A goatherd saw his ___ dancing", "Goats", "[VERIFY] legend");
    items[2] = fact(3, "The record plate weighed over ___", "10 tonnes", "[VERIFY] Guinness (10,452 kg, over 10 tonnes)");
    const w = lint(items).warnings.join("\n");
    expect(w).toMatch(/t-001: the truth's number 15 is not stated/);
    expect(w).toMatch(/t-002: truth\.en word "goats" already appears/);
    expect(w).not.toMatch(/t-003/);
  });

  it("treats free drafts as release blockers only with --release", () => {
    expect(lint(base(), {}, false).errors).toEqual([]);
    expect(lint(base(), {}, true).errors.join("\n")).toMatch(/reviewed before release/);
  });

  it("requires a display name for every phase in meta.phases, in every locale (the ⓘ sheet's \"You are here\")", () => {
    expect(phaseKey("ROUND_INTRO")).toBe("game.bluff.phase.roundIntro");
    expect(phaseKey("HOLD")).toBe("game.bluff.phase.hold");
    expect(lintBluffI18n(BLUFF_META.phases, { en, fr, ar, es }).errors).toEqual([]);
    const { ["game.bluff.phase.writing"]: _gone, ...noWriting } = fr as Record<string, unknown>;
    expect(lintBluffI18n(BLUFF_META.phases, { fr: noWriting }).errors.join("\n")).toMatch(/fr\.json: game\.bluff\.phase\.writing is missing/);
  });
});
