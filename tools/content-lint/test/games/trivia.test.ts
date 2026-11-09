// GAME-TRIVIA §11.2–§11.3, JAMAA-PLATFORM §5.4–§5.5: the trivia content rules, on synthetic packs and on content/trivia.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bannedTerms, lint, lintTriviaRaw, TF_LABELS, type TriviaLintInput } from "../../src/games/trivia";

const CONTENT = join(import.meta.dirname, "../../../../content/trivia");
type Q = Record<string, unknown>;
type Locale = "en" | "fr" | "ar" | "es";

/** A valid 20-question quiz in one locale: answers spread 0..3, 15 hard + 5 easy (mean 2.5, stars 3), 2 tf (1 True). */
function quiz(locale: Locale, family = "fx-quiz", patch: (qs: Q[]) => void = () => {}): TriviaLintInput {
  const questions: Q[] = Array.from({ length: 20 }, (_, i) => ({
    id: `q${String(i + 1).padStart(3, "0")}`, type: "mc4", text: `Question number ${i + 1} about things?`,
    options: [`Alpha ${i}`, `Bravo ${i}`, `Charlie ${i}`, `Delta ${i}`], answer: i % 4,
    topic: i % 2 === 0 ? "music" : "food", difficulty: i < 15 ? 3 : 1, source: "https://example.org/fact",
  }));
  questions[18] = { ...questions[18], type: "tf", text: "This statement is accurate.", options: [...TF_LABELS[locale]], answer: 0 };
  questions[19] = { ...questions[19], type: "tf", text: "That statement is accurate.", options: [...TF_LABELS[locale]], answer: 1 };
  patch(questions);
  const raw = {
    id: `${family}-${locale}`, family, game: "trivia", version: 1, locale, script: locale === "ar" ? "Arab" : "Latn",
    title: { en: "Fixture", fr: "Fixture", ar: "Fixture", es: "Fixture" }, domain: "world", topics: ["music", "food"],
    featuredTopics: ["music"], stars: 3, ageRating: "all", tier: "free", license: "CC-BY-4.0", source: "original", status: "draft",
    reviewedBy: [], questions,
  };
  return { file: `trivia/${locale}/${raw.id}.json`, raw };
}
const family = (patch?: (qs: Q[], l: Locale) => void): TriviaLintInput[] =>
  (["en", "fr", "ar", "es"] as const).map((l) => quiz(l, "fx-quiz", patch ? (qs) => patch(qs, l) : undefined));
const errorsOf = (packs: TriviaLintInput[], release = false): string => lintTriviaRaw(packs, { release }).errors.join("\n");
const withHeader = (p: TriviaLintInput, h: Record<string, unknown>): TriviaLintInput => ({ ...p, raw: { ...p.raw, ...h } });

describe("trivia lint: synthetic packs", () => {
  it("accepts a valid family in en/fr/ar/es", () => {
    expect(lintTriviaRaw(family())).toEqual({ errors: [], warnings: [] });
  });

  it("question schema: id, type, text length, option count, empty and duplicate options, answer range, source", () => {
    const e = errorsOf([quiz("en", "a", (qs) => {
      qs[0] = { ...qs[0], id: "Q1" };
      qs[1] = { ...qs[1], type: "order" };
      qs[2] = { ...qs[2], text: "Hi?" };
      qs[3] = { ...qs[3], options: ["One", "Two", "Three"] };
      qs[4] = { ...qs[4], options: ["One", " ", "Three", "Four"] };
      qs[5] = { ...qs[5], options: ["Same", "same", "Three", "Four"] };
      qs[6] = { ...qs[6], answer: 4 };
      qs[7] = { ...qs[7], source: "" };
      qs[8] = { ...qs[8], extra: true };
      qs[9] = { ...qs[9], explain: "x".repeat(201) };
    })]);
    for (const m of ["id must match", 'type must be "mc4" or "tf"', "text must be 5–160", "mc4 needs 4 options", "option 2 is empty", 'option "same" is listed twice',
      "mc4 answer must be 0–3", "source is required", 'unknown field "extra"', "explain must be a string of ≤ 200"]) expect(e).toContain(m);
  });

  it("tf options are the locale's True/False labels and the answer is 0 or 1", () => {
    const e = errorsOf([quiz("fr", "a", (qs) => {
      qs[18] = { ...qs[18], options: ["True", "False"] };
      qs[19] = { ...qs[19], answer: 2 };
    })]);
    expect(e).toContain('tf options must be the fr labels ["Vrai","Faux"]');
    expect(e).toContain("tf answer must be 0 (True) or 1 (False)");
  });

  it("35–65 % of tf answers are True (from 4 tf questions on)", () => {
    const fourTf = (trueCount: number) => quiz("en", "a", (qs) => {
      for (let k = 0; k < 4; k++) qs[16 + k] = { ...qs[16 + k], type: "tf", text: `Statement ${k} holds.`, options: ["True", "False"], answer: k < trueCount ? 0 : 1 };
    });
    expect(errorsOf([fourTf(2)])).not.toContain("tf answers are True");
    expect(errorsOf([fourTf(3)])).toContain("75 % of tf answers are True (3/4)");
    expect(errorsOf([fourTf(1)])).toContain("25 % of tf answers are True (1/4)");
    // 2 tf in the base fixture: the rule does not apply yet.
    expect(errorsOf([quiz("en", "b", (qs) => void (qs[19] = { ...qs[19], answer: 0 }))])).not.toContain("tf answers are True");
  });

  it("no mc4 answer index above 40 %", () => {
    const e = errorsOf([quiz("en", "a", (qs) => qs.forEach((q, i) => { if (i < 18) q.answer = i < 8 ? 2 : i % 4; }))]);
    expect(e).toMatch(/the correct mc4 answer is option 3 in \d+ % of questions/);
  });

  it("topics are exactly the question topics; featured ⊂ topics, 1–3; vocabulary membership", () => {
    const base = quiz("en");
    expect(errorsOf([withHeader(base, { topics: ["music", "food", "art"] })])).toContain('topics lists "art" but no question uses it');
    expect(errorsOf([withHeader(base, { topics: ["music"], featuredTopics: ["music"] })])).toContain('topic "food" is not in the pack\'s topics');
    expect(errorsOf([withHeader(base, { featuredTopics: ["art"] })])).toContain('featuredTopics "art" is not in topics');
    expect(errorsOf([withHeader(base, { featuredTopics: [] })])).toContain("featuredTopics must list 1 to 3 topics");
    expect(errorsOf([withHeader(base, { domain: null })])).toContain("domain is required");
    expect(errorsOf([withHeader(base, { stars: null })])).toContain("stars is required");
    expect(errorsOf([quiz("en", "a", (qs) => void (qs[0] = { ...qs[0], topic: "politics" }))])).toContain('topic "politics" is not a vocabulary topic');
    expect(errorsOf([quiz("en", "a", (qs) => void (qs[0] = { ...qs[0], easyIn: ["de"] }))])).toContain("easyIn must list locales");
    expect(errorsOf([withHeader(base, { script: "Arab" })])).toContain("script must be Latn");
  });

  it("stars: |stars − mean difficulty| ≤ 0.67", () => {
    expect(errorsOf([withHeader(quiz("en"), { stars: 1 })])).toContain("stars 1 but the mean question difficulty is 2.50");
    expect(errorsOf([withHeader(quiz("en"), { stars: 2 })])).not.toContain("mean question difficulty");
  });

  it("a pack that offers Long (≥ 15 questions) has ≥ 15 difficulty-3 questions", () => {
    const e = errorsOf([quiz("en", "a", (qs) => qs.forEach((q, i) => { if (i < 3) q.difficulty = 2; }))]);
    expect(e).toContain("has only 12 difficulty-3 questions (needs ≥ 15)");
  });

  it("regions: lebanon only, and no region above 35 % of the tagged questions", () => {
    expect(errorsOf([quiz("en", "a", (qs) => void (qs[0] = { ...qs[0], region: "beirut" }))])).toContain("region tags are for lebanon-domain quizzes only");
    const lb = withHeader(quiz("en", "b", (qs) => qs.slice(0, 10).forEach((q, i) => { q.region = i < 4 ? "bekaa" : (["beirut", "north", "south"] as const)[i % 3]; })), { domain: "lebanon" });
    expect(errorsOf([lb])).toContain('region "bekaa" has 40 % of the region-tagged questions (max 35 %)');
    expect(errorsOf([quiz("en", "c", (qs) => void (qs[0] = { ...qs[0], region: "atlantis" }))])).toContain('region "atlantis" is not a vocabulary region');
  });

  it("§11.2 sensitivity list on every visible string, in all four languages", () => {
    const e = errorsOf([quiz("en", "a", (qs) => {
      qs[0] = { ...qs[0], text: "Which army marched here first?" };
      qs[1] = { ...qs[1], explain: "Built after the civil war." };
      qs[2] = { ...qs[2], options: ["Hariri Airport", "B", "C", "D"] };
    })]);
    expect(e).toContain('q001: sensitive term "army"');
    expect(e).toContain('q002: sensitive term "civil war"');
    expect(e).toContain('q003: sensitive term "hariri"');
    expect(errorsOf([withHeader(quiz("en"), { title: { en: "Parliament night", fr: "x", ar: "x", es: "x" } })])).toContain('title.en: sensitive term "parliament"');
  });

  it("the giveaway hint warns when only the correct option repeats a long word of the question", () => {
    const w = lintTriviaRaw([quiz("en", "a", (qs) => void (qs[1] = { ...qs[1], text: "Which river flows through the valley?", options: ["Lake", "Valley river", "Sea", "Pond"], answer: 1 }))]).warnings;
    expect(w.join("\n")).toContain('q002: the correct option shares "valley", "river" with the question');
  });

  it("[VERIFY] sources: a warning in development, an error with --release", () => {
    const p = quiz("en", "a", (qs) => void (qs[0] = { ...qs[0], source: "[VERIFY] Britannica" }));
    expect(lintTriviaRaw([p]).warnings).toContain("a-en: 1 question source(s) still marked [VERIFY]");
    expect(errorsOf([p], true)).toContain("1 question source(s) still marked [VERIFY]");
  });

  it("family: same header metadata and the same type/answer/topic/difficulty/easyIn/region per question id", () => {
    const e = errorsOf(family((qs, l) => {
      if (l === "ar") qs[0] = { ...qs[0], answer: 1 };
      if (l === "es") qs[2] = { ...qs[2], easyIn: ["es"] };
    }));
    expect(e).toContain("family fx-quiz: fx-quiz-ar q001 differs from fx-quiz-en");
    expect(e).toContain("family fx-quiz: fx-quiz-es q003 differs from fx-quiz-en");
    const [en, fr] = family();
    expect(errorsOf([en as TriviaLintInput, withHeader(fr as TriviaLintInput, { stars: 2 })])).toContain("fx-quiz-fr has a different stars from fx-quiz-en");
    expect(lintTriviaRaw([en as TriviaLintInput]).warnings).toContain("family fx-quiz: no pack for fr, ar, es (launch quizzes ship in all four locales, §6)");
  });

  it("the GameLint hook delegates to the raw rules", () => {
    const p = quiz("en");
    const meta = { id: "fx-quiz-en" } as never;
    expect(lint([{ file: p.file, raw: p.raw, meta }], {})).toEqual(lintTriviaRaw([p]));
  });
});

describe("bannedTerms", () => {
  it("matches whole words after folding accents, and Arabic tokens with clitics", () => {
    expect(bannedTerms("La guerre des boutons")).toEqual(["guerre"]);
    expect(bannedTerms("Une ÉGLISE romane")).toEqual(["eglise"]);
    expect(bannedTerms("El ejército del aire")).toEqual(["ejercito"]);
    expect(bannedTerms("بالحرب")).toEqual(["حرب"]);
    expect(bannedTerms("والجيش")).toEqual(["جيش"]);
    expect(bannedTerms("مجلس النوّاب")).toEqual(["مجلس النواب"]);
  });
  it("does not flag innocent look-alikes", () => {
    for (const s of ["The warm war-drum? no: warmth", "Award-winning", "Partido de fútbol", "سنين طويلة", "الحيوانات البرّية", "Jabal Terbol", "Byblos Castle", "صحراء", "Sectional sofa"]) {
      expect(bannedTerms(s).filter((t) => t !== "war"), s).toEqual([]);
    }
    expect(bannedTerms("Award-winning")).toEqual([]);
  });
});

describe("trivia lint: content/trivia", () => {
  const packs: TriviaLintInput[] = [];
  for (const l of readdirSync(CONTENT)) {
    if (!statSync(join(CONTENT, l)).isDirectory()) continue;
    for (const f of readdirSync(join(CONTENT, l))) if (f.endsWith(".json")) packs.push({ file: `trivia/${l}/${f}`, raw: JSON.parse(readFileSync(join(CONTENT, l, f), "utf8")) as Record<string, unknown> });
  }

  it("ships lb-quiz-01 and world-mix-01 in en, fr, ar and es with 75 questions each", () => {
    expect(packs.map((p) => p.raw.id).sort()).toEqual(["lb-quiz-01-ar", "lb-quiz-01-en", "lb-quiz-01-es", "lb-quiz-01-fr", "world-mix-01-ar", "world-mix-01-en", "world-mix-01-es", "world-mix-01-fr"]);
    for (const p of packs) expect((p.raw.questions as unknown[]).length, String(p.raw.id)).toBe(75);
  });

  it("passes every trivia rule; the only warnings are the open [VERIFY] notes", () => {
    const { errors, warnings } = lintTriviaRaw(packs);
    expect(errors).toEqual([]);
    expect(warnings.every((w) => w.includes("[VERIFY]")), warnings.join("\n")).toBe(true);
  });

  it("is still a draft: --release refuses it until every fact is verified and the packs are reviewed", () => {
    expect(errorsOf(packs, true)).toContain("lb-quiz-01-en: 75 question source(s) still marked [VERIFY]");
    for (const p of packs) expect(p.raw.status).toBe("draft");
  });

  it("lb-quiz-01 matches the GAME-TRIVIA §11.5 / platform §5.4 plan", () => {
    for (const p of packs.filter((x) => x.raw.family === "lb-quiz-01")) {
      expect(p.raw.domain).toBe("lebanon");
      expect(p.raw.featuredTopics).toEqual(["music", "dance", "football"]);
      expect(p.raw.stars).toBe(2);
      expect(p.raw.tier).toBe("free");
      expect(p.raw.ageRating).toBe("all");
      expect([...(p.raw.topics as string[])].sort()).toEqual(["celebrities", "cinema-tv", "culture", "dance", "food", "football", "geography", "history", "music", "nature", "sports"]);
      expect(p.raw.title).toEqual({ en: "Lebanon: the big quiz", fr: "Liban\u202f: le grand quiz", ar: "لبنان: المسابقة الكبيرة", es: "Líbano: el gran quiz" });
      const qs = p.raw.questions as { topic: string }[];
      // ≥ 5 topics with ≥ 4 questions each, football and dance included (platform §5.4).
      const counts = new Map<string, number>();
      for (const q of qs) counts.set(q.topic, (counts.get(q.topic) ?? 0) + 1);
      expect([...counts.values()].filter((n) => n >= 4).length).toBeGreaterThanOrEqual(5);
      expect(counts.get("football")).toBeGreaterThanOrEqual(4);
      expect(counts.get("dance")).toBeGreaterThanOrEqual(4);
    }
  });

  it("never names a Jackbox game or another quiz brand", () => {
    const all = JSON.stringify(packs.map((p) => p.raw)).toLowerCase();
    for (const b of ["jackbox", "fibbage", "quiplash", "trivia murder", "you don't know jack", "kahoot", "drawful"]) expect(all).not.toContain(b);
  });
});
