import type { Locale } from "../constants";
import { LOCALES } from "../constants";
import type { Rng } from "./rng";
import type { LocalizedTitle, Settings, WordRef, WordSide } from "./types";

export const AGE_RATINGS = ["all", "teen", "adult"] as const;
export type AgeRating = (typeof AGE_RATINGS)[number];

export interface CatalogPair {
  key: string; packId: string; packVersion: number; pairId: string; difficulty: 1 | 2 | 3;
  civilian: WordSide; undercover: WordSide;
}
export interface CatalogPack {
  id: string; version: number; locale: string; language: Locale;
  title: LocalizedTitle;
  ageRating: AgeRating;
  pairs: CatalogPair[];
}
export interface Catalog { packs: CatalogPack[] }          // language = locale.split("-")[0]

interface WordSideLike { text: string; translit?: string | null | undefined; alt?: string[] | undefined }
/** Structural re-declaration of `z.infer<typeof WordPackSchema>` (the engine never imports zod). */
export interface WordPackLike {
  id: string;
  version: number;
  locale: "en" | "fr" | "ar" | "ar-LB";
  script: "Latn" | "Arab";
  title: LocalizedTitle;
  tags: string[];
  ageRating: AgeRating;
  license: string;
  source: string;
  status: "draft" | "reviewed";
  pairs: {
    id: string;
    civilian: WordSideLike;
    undercover: WordSideLike;
    difficulty: 1 | 2 | 3;
    reviewedBy: string[];
    notes?: string | undefined;
  }[];
}

function toSide(s: WordSideLike): WordSide {
  return { text: s.text, translit: s.translit ?? null, alt: s.alt ? [...s.alt] : [] };
}

/** The public word of a side (never its `alt` spellings). */
export function toWordRef(side: WordSide): WordRef {
  return { text: side.text, translit: side.translit };
}

/** UI language of a pack locale ("ar-LB" → "ar"). */
export function languageOf(locale: string): Locale {
  const lang = locale.split("-")[0];
  const found = LOCALES.find((l) => l === lang);
  // SPEC-GAP: a pack whose language is not en/fr/ar cannot be produced by WordPackSchema; fall back to "en" defensively.
  return found ?? "en";
}

const byStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function buildCatalog(packs: readonly WordPackLike[]): Catalog {
  const out: CatalogPack[] = packs.map((p) => ({
    id: p.id,
    version: p.version,
    locale: p.locale,
    language: languageOf(p.locale),
    title: { en: p.title.en, fr: p.title.fr, ar: p.title.ar },
    ageRating: p.ageRating,
    pairs: p.pairs
      .map((q) => ({
        key: `${p.id}:${q.id}`,
        packId: p.id,
        packVersion: p.version,
        pairId: q.id,
        difficulty: q.difficulty,
        civilian: toSide(q.civilian),
        undercover: toSide(q.undercover),
      }))
      .sort((a, b) => byStr(a.pairId, b.pairId)),
  }));
  out.sort((a, b) => byStr(a.id, b.id));
  return { packs: out };
}

/** Packs served for these settings, ignoring `packIds` (§12.4 step 1, minus the id filter). "adult" is never served in v1. */
export function packAllowedByAge(pack: CatalogPack, settings: Settings): boolean {
  return pack.ageRating === "all" || (!settings.familyFilter && pack.ageRating === "teen");
}

export function eligiblePacks(catalog: Catalog, settings: Settings): CatalogPack[] {
  return catalog.packs.filter(
    (p) =>
      p.language === settings.wordLocale &&
      packAllowedByAge(p, settings) &&
      (settings.packIds.length === 0 || settings.packIds.includes(p.id)),
  );
}

/** All pairs passing the settings filter, ordered by pack id then pair id (§12.4 step 2). */
export function candidatePairs(catalog: Catalog, settings: Settings): CatalogPair[] {
  const out: CatalogPair[] = [];
  for (const p of eligiblePacks(catalog, settings)) {
    for (const q of p.pairs) if (settings.difficulties.includes(q.difficulty)) out.push(q);
  }
  return out;
}

export type PickResult = { pair: CatalogPair; usedPairKeys: string[] } | null;

/** §12.4. Returns the pair and the (possibly reset) used-key list, or null for NO_WORDS_AVAILABLE. */
export function pickPair(catalog: Catalog, settings: Settings, usedPairKeys: readonly string[], rng: Rng): PickResult {
  const all = candidatePairs(catalog, settings);
  if (all.length === 0) return null;
  let used = [...usedPairKeys];
  let candidates = all.filter((q) => !used.includes(q.key));
  if (candidates.length === 0) {
    const filterKeys = new Set(all.map((q) => q.key));
    used = used.filter((k) => !filterKeys.has(k));
    candidates = all;
  }
  const pair = candidates[rng.int(candidates.length)];
  /* v8 ignore next */
  if (!pair) return null;
  return { pair, usedPairKeys: used };
}
