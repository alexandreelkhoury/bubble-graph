// GAME-TRIVIA §11.3: a quiz pack = the platform PackHeader (JAMAA-PLATFORM §5.2) with Trivia's required metadata
// (domain, topics, stars; §5.4) + the question array. Zod; server, sim, tests and content-lint only. Packs live in
// content/trivia/<locale>/<pack-id>.json and are read through ./content.ts. The style/balance rules (tf True share,
// index spread, region balance, ★★★ count, sensitivity list…) are content-lint's (lane D); this schema enforces what the
// engine relies on.
import * as z from "zod";
import { PackHeaderShape } from "../../content/schema";
import { DOMAINS, REGIONS, TOPICS } from "../../content/vocab";
import { LOCALES } from "../../constants";
import { MIN_QUESTIONS } from "./constants";
import type { TriviaPack, TriviaQuestion } from "./engine/types";

const graphemes = (s: string): number => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)].length;
const text = (min: number, max: number) => z.string().min(min).refine((s) => graphemes(s) <= max, `longer than ${max} graphemes`);

export const TriviaQuestionSchema = z.strictObject({
  id: z.string().regex(/^q\d{3,4}$/),                    // same id across the -en/-fr/-ar/-es packs of a family
  type: z.enum(["mc4", "tf"]),
  text: text(5, 160),
  options: z.union([z.tuple([text(1, 48), text(1, 48), text(1, 48), text(1, 48)]), z.tuple([text(1, 48), text(1, 48)])]),
  answer: z.number().int().min(0).max(3),                 // AUTHORED index (the engine reshuffles mc4 for display)
  topic: z.enum(TOPICS),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  easyIn: z.array(z.enum(LOCALES)).default([]),
  region: z.enum(REGIONS).optional(),
  explain: text(1, 200).optional(),
  source: z.string().min(1),                              // never projected
}).superRefine((q, ctx) => {
  const want = q.type === "mc4" ? 4 : 2;
  if (q.options.length !== want) ctx.addIssue({ code: "custom", message: `${q.id}: ${q.type} needs ${want} options` });
  if (q.answer >= q.options.length) ctx.addIssue({ code: "custom", message: `${q.id}: answer out of range` });
  if (new Set(q.options.map((o) => o.trim().toLocaleLowerCase())).size !== q.options.length) ctx.addIssue({ code: "custom", message: `${q.id}: options not unique` });
});

export const TriviaPackSchema = z.strictObject({
  ...PackHeaderShape,
  game: z.literal("trivia"),
  domain: z.enum(DOMAINS),                                // required for a quiz (platform §5.4)
  topics: z.array(z.enum(TOPICS)).min(1).max(16),
  stars: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  questions: z.array(TriviaQuestionSchema).min(MIN_QUESTIONS),
}).superRefine((p, ctx) => {
  const arab = p.locale === "ar" || p.locale === "ar-LB";
  if ((p.script === "Arab") !== arab) ctx.addIssue({ code: "custom", message: "script does not match locale" });
  if (p.ageRating === "adult") ctx.addIssue({ code: "custom", message: "a quiz is never adult (family-friendly by default)" });
  for (const t of p.featuredTopics) if (!p.topics.includes(t)) ctx.addIssue({ code: "custom", message: `featured topic ${t} not in topics` });
  const ids = new Set<string>();
  for (const q of p.questions) {
    if (ids.has(q.id)) ctx.addIssue({ code: "custom", message: `duplicate question id ${q.id}` });
    ids.add(q.id);
    if (!p.topics.includes(q.topic)) ctx.addIssue({ code: "custom", message: `${q.id}: topic ${q.topic} not in the pack topics` });
  }
});

/** Parsed pack → the engine's zod-free shape (defaults applied, optional keys only when present). */
export function toTriviaPack(raw: unknown): TriviaPack {
  const p = TriviaPackSchema.parse(raw);
  const questions: TriviaQuestion[] = p.questions.map((q) => {
    const out: TriviaQuestion = {
      id: q.id, type: q.type, text: q.text, options: [...q.options], answer: q.answer, topic: q.topic,
      difficulty: q.difficulty, easyIn: [...q.easyIn], source: q.source,
    };
    if (q.region !== undefined) out.region = q.region;
    if (q.explain !== undefined) out.explain = q.explain;
    return out;
  });
  const title: TriviaPack["title"] = { en: p.title.en, fr: p.title.fr, ar: p.title.ar };
  if (p.title.es !== undefined) title.es = p.title.es;
  const pack: TriviaPack = {
    id: p.id, game: "trivia", version: p.version, locale: p.locale, script: p.script, title, domain: p.domain,
    topics: [...p.topics], featuredTopics: [...p.featuredTopics], stars: p.stars, ageRating: p.ageRating, tier: p.tier,
    license: p.license, source: p.source, status: p.status, reviewedBy: [...p.reviewedBy], tags: [...p.tags], questions,
  };
  if (p.family !== undefined) pack.family = p.family;
  if (p.description !== undefined) pack.description = { ...p.description };
  return pack;
}
