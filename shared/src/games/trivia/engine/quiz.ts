// GAME-TRIVIA §2, §9, §9.1 and platform §5.3/§5.4: quiz families, the pack for a content language, the default quiz,
// quiz cards (stars, domain, featured topics) and the shelf (one row per domain) with filters. Pure.
import type { Locale } from "../../../constants";
import { DOMAINS } from "../../../content/vocab";
import type { Domain, Topic, TriviaCatalog, TriviaPack } from "./types";

export const familyOf = (p: Pick<TriviaPack, "id" | "family">): string => p.family ?? p.id;
/** Platform §5.3: packs in ar-LB count as ar. */
export const languageOf = (p: Pick<TriviaPack, "locale">): Locale => (p.locale === "ar-LB" ? "ar" : p.locale);

/** Quizzes playable in `locale`, one pack per family (the first in catalog order); adult packs are never served. */
export function quizzesFor(content: TriviaCatalog, locale: Locale): TriviaPack[] {
  const seen = new Set<string>();
  const out: TriviaPack[] = [];
  for (const p of content.packs) {
    if (languageOf(p) !== locale || p.ageRating === "adult" || p.questions.length === 0) continue;
    const f = familyOf(p);
    if (seen.has(f)) continue;
    seen.add(f);
    out.push(p);
  }
  return out;
}

/** The pack of `family` in `locale`, or undefined. */
export function packFor(content: TriviaCatalog, family: string, locale: Locale): TriviaPack | undefined {
  return quizzesFor(content, locale).find((p) => familyOf(p) === family);
}

/**
 * GAME-TRIVIA §9: `quizId` null = "the first featured quiz playable in the content language". JAMAA-GAP: the pack header
 * has no `featured` flag, so "featured" is: free quizzes first, then catalog (id) order. A family without a pack in the
 * locale resolves to undefined (start fails NO_CONTENT_AVAILABLE; the room's settings fit resets it to null first).
 */
export function resolveQuiz(content: TriviaCatalog, quizId: string | null, locale: Locale): TriviaPack | undefined {
  if (quizId !== null) return packFor(content, quizId, locale);
  const all = quizzesFor(content, locale);
  return all.find((p) => p.tier === "free") ?? all[0];
}

/** GAME-TRIVIA §9.1 quiz card (`setup.extras.quiz`, the shelf, the VIP list). */
export interface QuizCard {
  id: string;                   // the FAMILY
  title: { en: string; fr: string; ar: string; es?: string | undefined };
  stars: 1 | 2 | 3;
  domain: Domain;
  featuredTopics: Topic[];      // author order, ≤ 3
  moreTopics: number;           // the "+n" chip
  questionCount: number;
  tier: "free" | "premium";
}

export function quizCard(p: TriviaPack): QuizCard {
  const featured = p.featuredTopics.slice(0, 3);
  const title: QuizCard["title"] = { en: p.title.en, fr: p.title.fr, ar: p.title.ar };
  if (p.title.es !== undefined) title.es = p.title.es;
  return {
    id: familyOf(p), title, stars: p.stars, domain: p.domain, featuredTopics: [...featured],
    moreTopics: Math.max(0, p.topics.length - featured.length), questionCount: p.questions.length, tier: p.tier,
  };
}

export interface QuizFilter { stars?: readonly (1 | 2 | 3)[]; domain?: Domain; topics?: readonly Topic[] }

/** Filter by stars (any of), domain (equal) and topics (the quiz covers ALL listed topics). Catalog order is kept. */
export function filterQuizzes(content: TriviaCatalog, locale: Locale, f: QuizFilter = {}): QuizCard[] {
  return quizzesFor(content, locale)
    .filter((p) => (f.stars === undefined || f.stars.includes(p.stars))
      && (f.domain === undefined || p.domain === f.domain)
      && (f.topics === undefined || f.topics.every((t) => p.topics.includes(t))))
    .map(quizCard);
}

/** The TV shelf (§9.1): one row per domain in vocabulary order (empty rows dropped), cards in catalog order. */
export function quizShelf(content: TriviaCatalog, locale: Locale): { domain: Domain; cards: QuizCard[] }[] {
  const cards = quizzesFor(content, locale).map(quizCard);
  return DOMAINS.map((domain) => ({ domain, cards: cards.filter((c) => c.domain === domain) })).filter((r) => r.cards.length > 0);
}

/** Graphemes (READ duration, §4.1). */
const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export function graphemes(s: string): number {
  let n = 0;
  for (const _ of SEGMENTER.segment(s)) n++;
  return n;
}
