// GAME-TRIVIA §9 settings (normalize, apply, restrict, packIds), §11.3 the pack schema on the real lb-quiz-01 family,
// the content adapter (pack-level tiers, §13.3 invariant 5), and quiz selection (§9.1: families, cards, shelf, filters).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GameSettingsPatchSchema, GameSettingsSchema } from "../../../src/games/protocol";
import { content as adapter } from "../../../src/games/trivia/content";
import { filterQuizzes, packFor, quizCard, quizShelf, quizzesFor, resolveQuiz } from "../../../src/games/trivia/engine/quiz";
import { applySettings, normalizeSettings, restrictSettings } from "../../../src/games/trivia/engine/settings";
import type { TriviaPack } from "../../../src/games/trivia/engine/types";
import { TRIVIA_META } from "../../../src/games/trivia/meta";
import { TriviaPackSchema, toTriviaPack } from "../../../src/games/trivia/schema";
import { synthPack, TRIVIA_SYNTH_CATALOG as CAT } from "../../../src/testing/catalogs/trivia";
import { DEF } from "./helpers";

const DEFAULTS = TRIVIA_META.settings.defaults;

describe("settings (§9)", () => {
  it("defaults: quizId null, normal, normal; the schema and the patch schema accept them", () => {
    expect(DEFAULTS).toEqual({ quizId: null, length: "normal", pace: "normal" });
    expect(GameSettingsSchema.trivia.parse(DEFAULTS)).toEqual(DEFAULTS);
    expect(GameSettingsPatchSchema.trivia.safeParse({ quizId: "lb-quiz-01" }).success).toBe(true);
    expect(GameSettingsPatchSchema.trivia.safeParse({ quizId: "LB" }).success).toBe(false);
    expect(GameSettingsPatchSchema.trivia.safeParse({ rounds: 3 }).success).toBe(false);
  });
  it("normalize: missing, extra and wrong-typed keys fall back per key, in the defaults' key order", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULTS);
    expect(normalizeSettings([1, 2])).toEqual(DEFAULTS);
    expect(normalizeSettings({ length: "long", extra: true })).toEqual({ ...DEFAULTS, length: "long" });
    expect(normalizeSettings({ quizId: "Not A Family", length: 10, pace: "fast" })).toEqual({ ...DEFAULTS, pace: "fast" });
    expect(normalizeSettings({ quizId: "x".repeat(36) }).quizId).toBeNull();
    expect(Object.keys(normalizeSettings({ pace: "fast", quizId: "lb-quiz-01", length: "short" }))).toEqual(["quizId", "length", "pace"]);
    expect(DEF.settings.normalize({ quizId: "lb-quiz-01" }).quizId).toBe("lb-quiz-01");
  });
  it("apply: valid patches; the same object when nothing changes; null for an invalid value or a family without a pack in the language", () => {
    const s = { ...DEFAULTS };
    expect(applySettings(s, {}, CAT, "en")).toBe(s);
    expect(applySettings(s, { length: "normal" }, CAT, "en")).toBe(s);
    expect(applySettings(s, { length: "long", pace: "fast" }, CAT, "en")).toEqual({ quizId: null, length: "long", pace: "fast" });
    expect(applySettings(s, { quizId: "syn-world" }, CAT, "en")).toEqual({ ...DEFAULTS, quizId: "syn-world" });
    expect(applySettings(s, { quizId: "syn-world" }, CAT, "ar")).toBeNull();
    expect(applySettings(s, { quizId: "nope" }, CAT, "en")).toBeNull();
    expect(applySettings(s, { length: "huge" as never }, CAT, "en")).toBeNull();
    expect(applySettings(s, { other: 1 } as never, CAT, "en")).toBeNull();
    expect(applySettings(s, null as never, CAT, "en")).toBeNull();
    expect(applySettings(s, { length: undefined }, CAT, "en")).toBe(s);
    // After SET_CONTENT_LOCALE the room re-applies {}: a family with that locale is kept, one without gives null.
    const fam = { ...DEFAULTS, quizId: "syn-quiz" };
    expect(applySettings(fam, {}, CAT, "es")).toBe(fam);
    expect(applySettings({ ...DEFAULTS, quizId: "syn-world" }, {}, CAT, "es")).toBeNull();
  });
  it("restrict: a locked or missing family resets to null; the same object otherwise; no premium keys", () => {
    const s = { ...DEFAULTS, quizId: "syn-world" };
    expect(restrictSettings(s, { playableIds: new Set(["syn-world"]), premium: false }, CAT, "en")).toBe(s);
    expect(restrictSettings(s, { playableIds: new Set(["syn-quiz"]), premium: false }, CAT, "en")).toEqual(DEFAULTS);
    expect(restrictSettings(s, { playableIds: new Set(["syn-world"]), premium: true }, CAT, "ar")).toEqual(DEFAULTS);
    expect(restrictSettings(DEFAULTS, { playableIds: new Set(), premium: false }, CAT, "en")).toBe(DEFAULTS);
    expect(TRIVIA_META.settings.premiumKeys).toEqual([]);
  });
  it("packIds is the quiz FAMILY (platform §4.4)", () => {
    expect(DEF.settings.packIds({ ...DEFAULTS, quizId: "lb-quiz-01" })).toEqual(["lb-quiz-01"]);
    expect(DEF.settings.packIds(DEFAULTS)).toEqual([]);
  });
});

describe("quiz selection (§9, §9.1)", () => {
  it("one pack per family and language; adult or empty packs never count; ar-LB counts as ar", () => {
    expect(quizzesFor(CAT, "en").map((p) => p.id)).toEqual(["syn-quiz-en", "syn-world-en"]);
    expect(quizzesFor(CAT, "ar").map((p) => p.id)).toEqual(["syn-quiz-ar"]);
    const odd = { packs: [{ ...synthPack({ family: "a" }), ageRating: "adult" as const }, { ...synthPack({ family: "b" }), questions: [] }, { ...synthPack({ family: "c", locale: "ar" }), locale: "ar-LB" as const }] };
    expect(quizzesFor(odd, "en")).toEqual([]);
    expect(quizzesFor(odd, "ar").map((p) => p.id)).toEqual(["c-ar"]);
    expect(packFor(CAT, "syn-world", "fr")?.id).toBe("syn-world-fr");
    expect(packFor(CAT, "syn-world", "es")).toBeUndefined();
  });
  it("null resolves to the first free quiz of the language (JAMAA-GAP: no `featured` flag), else the first", () => {
    expect(resolveQuiz(CAT, null, "en")?.id).toBe("syn-quiz-en");
    const premiumFirst = { packs: [synthPack({ family: "aa", tier: "premium" }), synthPack({ family: "zz" })] };
    expect(resolveQuiz(premiumFirst, null, "en")?.id).toBe("zz-en");
    expect(resolveQuiz({ packs: [synthPack({ family: "aa", tier: "premium" })] }, null, "en")?.id).toBe("aa-en");
    expect(resolveQuiz(CAT, "syn-world", "ar")).toBeUndefined();
  });
  it("cards carry stars, domain, ≤ 3 featured topics in author order, '+n', count and tier; the shelf has one row per domain", () => {
    const card = quizCard(packFor(CAT, "syn-quiz", "en") as TriviaPack);
    expect(card).toEqual({
      id: "syn-quiz", title: { en: "syn-quiz title en", fr: "syn-quiz title fr", ar: "syn-quiz title ar", es: "syn-quiz title es" },
      stars: 2, domain: "lebanon", featuredTopics: ["music", "geography", "football"], moreTopics: 3, questionCount: 40, tier: "free",
    });
    expect(quizShelf(CAT, "en").map((r) => [r.domain, r.cards.map((c) => c.id)])).toEqual([["lebanon", ["syn-quiz"]], ["world", ["syn-world"]]]);
    expect(filterQuizzes(CAT, "en", { stars: [1] }).map((c) => c.id)).toEqual(["syn-world"]);
    expect(filterQuizzes(CAT, "en", { domain: "lebanon" }).map((c) => c.id)).toEqual(["syn-quiz"]);
    expect(filterQuizzes(CAT, "en", { topics: ["science", "art"] }).map((c) => c.id)).toEqual(["syn-world"]);
    expect(filterQuizzes(CAT, "en").length).toBe(2);
    const noEs = quizCard({ ...synthPack(), title: { en: "a", fr: "b", ar: "c" } });
    expect("es" in noEs.title).toBe(false);
  });
});

// ─── the real content (lane D's lb-quiz-01 and world-mix-01 families) ────────────────────────────────────────────────

const CONTENT_DIR = join(import.meta.dirname, "..", "..", "..", "..", "content", "trivia");
const realRaw = (): { file: string; raw: unknown }[] => {
  const out: { file: string; raw: unknown }[] = [];
  for (const loc of readdirSync(CONTENT_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of readdirSync(join(CONTENT_DIR, loc.name)).filter((x) => x.endsWith(".json"))) {
      out.push({ file: `${loc.name}/${f}`, raw: JSON.parse(readFileSync(join(CONTENT_DIR, loc.name, f), "utf8")) as unknown });
    }
  }
  return out;
};

describe("pack schema on the shipped quizzes (§11.3)", () => {
  const raws = realRaw();
  it("finds the lb-quiz-01 and world-mix-01 families in en/fr/ar/es", () => {
    const ids = raws.map((r) => (r.raw as { id: string }).id);
    for (const l of ["en", "fr", "ar", "es"]) for (const f of ["lb-quiz-01", "world-mix-01"]) expect(ids).toContain(`${f}-${l}`);
  });
  it("world-mix-01 is featured: first on the shelf and the default quiz in every language", () => {
    const catalog = { packs: raws.map((r) => adapter.parse(r.raw)) };
    for (const l of ["en", "fr", "ar", "es"] as const) {
      expect(quizzesFor(catalog, l).map((p) => p.family)).toEqual(["world-mix-01", "lb-quiz-01"]);
      expect(resolveQuiz(catalog, null, l)?.id).toBe(`world-mix-01-${l}`);
      expect(packFor(catalog, "lb-quiz-01", l)?.id).toBe(`lb-quiz-01-${l}`);
    }
  });
  it.each(raws.map((r) => [r.file, r.raw] as const))("%s parses through the adapter", (_f, raw) => {
    const p = adapter.parse(raw);
    expect(p.game).toBe("trivia");
    expect(p.questions.length).toBeGreaterThanOrEqual(20);
    for (const q of p.questions) {
      expect(q.options).toHaveLength(q.type === "mc4" ? 4 : 2);
      expect(q.answer).toBeLessThan(q.options.length);
    }
  });
  it("every family is consistent across its locales (ids, type, answer position, topic, difficulty, easyIn, region)", () => {
    const packs = raws.map((r) => toTriviaPack(r.raw));
    const fams = new Map<string, TriviaPack[]>();
    for (const p of packs) fams.set(p.family ?? p.id, [...(fams.get(p.family ?? p.id) ?? []), p]);
    for (const [fam, ps] of fams) {
      const key = (p: TriviaPack) => p.questions.map((q) => [q.id, q.type, q.answer, q.topic, q.difficulty, [...q.easyIn].sort().join("+"), q.region ?? ""].join("|"));
      for (const p of ps.slice(1)) expect(key(p), `${fam}: ${p.id} vs ${ps[0]!.id}`).toEqual(key(ps[0]!));
    }
  });
  it("the whole lb-quiz-01 is free (Trivia's starter content, §2)", () => {
    for (const r of raws.filter((x) => (x.raw as { family?: string }).family === "lb-quiz-01")) expect(adapter.meta(adapter.parse(r.raw)).tier).toBe("free");
  });
  it("rejects malformed packs: wrong game, too few questions, bad option counts, unknown topics, duplicate ids, script mismatch, adult", () => {
    const base = structuredClone(raws.find((r) => r.file.startsWith("en/"))!.raw) as Record<string, unknown> & { questions: Record<string, unknown>[] };
    const bad = (f: (p: typeof base) => void): boolean => { const p = structuredClone(base); f(p); return TriviaPackSchema.safeParse(p).success; };
    expect(bad(() => undefined)).toBe(true);
    expect(bad((p) => { p.game = "bluff"; })).toBe(false);
    expect(bad((p) => { p.questions = p.questions.slice(0, 19); })).toBe(false);
    expect(bad((p) => { const q = p.questions.find((x) => x.type === "mc4")!; q.options = ["a", "b"]; })).toBe(false);
    expect(bad((p) => { const q = p.questions.find((x) => x.type === "tf")!; q.options = ["a", "b", "c", "d"]; })).toBe(false);
    expect(bad((p) => { const q = p.questions.find((x) => x.type === "tf")!; q.answer = 3; })).toBe(false);
    expect(bad((p) => { p.questions[0]!.topic = "astrology"; })).toBe(false);
    expect(bad((p) => { p.questions[0]!.topic = "art"; p.topics = (p.topics as string[]).filter((t) => t !== "art"); })).toBe(false);
    expect(bad((p) => { p.questions[1]!.id = p.questions[0]!.id; })).toBe(false);
    expect(bad((p) => { p.script = "Arab"; })).toBe(false);
    expect(bad((p) => { p.ageRating = "adult"; })).toBe(false);
    expect(bad((p) => { p.stars = null; })).toBe(false);
    expect(bad((p) => { p.domain = null; })).toBe(false);
    expect(bad((p) => { p.questions[0]!.options = ["Same", "same", "x", "y"]; p.questions[0]!.type = "mc4"; })).toBe(false);
    expect(bad((p) => { p.questions[0]!.text = "x".repeat(161); })).toBe(false);
    expect(bad((p) => { p.questions[0]!.extra = 1; })).toBe(false);
    expect(bad((p) => { p.featuredTopics = ["art"]; p.topics = (p.topics as string[]).filter((t) => t !== "art"); p.questions.forEach((q) => { if (q.topic === "art") q.topic = (p.topics as string[])[0]; }); })).toBe(false);
  });
});

describe("content adapter (§5.2, §4.4)", () => {
  const free = synthPack();
  const pass = synthPack({ family: "pz", tier: "premium" });
  it("meta: family, language, stars, domain, topics; pack-level tier", () => {
    expect(adapter.meta(free)).toMatchObject({ id: "syn-quiz-en", family: "syn-quiz", gameId: "trivia", languages: ["en"], tier: "free", itemCount: 40, freeItemCount: 40, stars: 2, domain: "lebanon" });
    expect(adapter.meta(pass)).toMatchObject({ family: "pz", tier: "premium", freeItemCount: 0 });
    expect(adapter.meta({ ...free, locale: "ar-LB", script: "Arab" }).languages).toEqual(["ar"]);
  });
  it("playable: free quizzes always; a Pass-only quiz only with the Pass or its family purchase (never a partial quiz)", () => {
    expect(adapter.playable(free, { premium: false, ownedFamilies: new Set() })).toBe(free);
    expect(adapter.playable(pass, { premium: false, ownedFamilies: new Set() })).toBeNull();
    expect(adapter.playable(pass, { premium: true, ownedFamilies: new Set() })).toBe(pass);
    expect(adapter.playable(pass, { premium: false, ownedFamilies: new Set(["pz"]) })).toBe(pass);
  });
});
