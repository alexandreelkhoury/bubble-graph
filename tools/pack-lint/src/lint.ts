// Pure core of tools/pack-lint (SPEC §12.5). No I/O here; see main.ts.
import { packProductId, PREMIUM_PACK_ID_MAX, PRODUCT_ID_REGEX } from "@mishana/shared/billing/products";
import { languageOf, normalizeGuess } from "@mishana/shared/engine";
import { WordPackSchema, type WordPack } from "@mishana/shared/packs";

export interface PackEntry {
  /** Path relative to the word-packs root, e.g. `packs/en/en-everyday-01.json`. */
  file: string;
  /** Parsed JSON, or the JSON parse error message. */
  data: unknown;
  parseError?: string;
}

export interface LintResult {
  errors: string[];
  warnings: string[];
  /** Pair counts per language (`en`, `fr`, `ar`) plus `ar-LB`. */
  counts: Record<string, number>;
}

/** PAYMENTS-SPEC §1.2 release gate: every free starter pack needs at least this many pairs (error with --release). */
export const STARTER_MIN_PAIRS = 40;
/** PAYMENTS-SPEC §1.5: a premium pack below this is only a warning. */
export const PREMIUM_MIN_PAIRS = 20;

export interface LintOptions {
  /** `--release` (run by `pnpm deploy`): a free pack below STARTER_MIN_PAIRS is an error instead of a warning. */
  release?: boolean;
}

/** M4 drafting targets (§12.2). Missing them is only a warning. */
export const M4_TARGETS: Readonly<Record<string, number>> = { en: 150, fr: 150, ar: 100, "ar-LB": 40 };

type Side = WordPack["pairs"][number]["civilian"];

function sideWords(side: Side): string[] {
  return [side.text, ...(side.alt ?? []), ...(side.translit ? [side.translit] : [])];
}

/** Every normalised form a guess is matched against (`isGuessCorrect`: text, alt, translit). */
function sideKeys(side: Side): Set<string> {
  return new Set(sideWords(side).map((w) => normalizeGuess(w)).filter((w) => w !== ""));
}

/**
 * Small EN/FR profanity lists, matched against whole Latin-script tokens (lowercase, accents dropped).
 * Arabic-script packs are checked against both, because translit and Latin alts are read by EN and FR speakers.
 */
export const PROFANITY: Readonly<Record<"en" | "fr", readonly string[]>> = {
  en: ["arse", "arsehole", "ass", "asshole", "bastard", "bitch", "bollocks", "cock", "crap", "cunt", "dick", "fag", "fuck", "fucker", "fucking", "piss", "prick", "shit", "shite", "shitty", "slut", "twat", "wank", "wanker", "whore"],
  fr: ["bite", "bordel", "branleur", "chier", "con", "conasse", "connard", "connasse", "conne", "couille", "couilles", "cul", "encule", "enculer", "foutre", "merde", "nique", "niquer", "pd", "pute", "putain", "salaud", "salope", "zob"],
};

const latinTokens = (w: string): string[] =>
  w.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Returns the profane tokens in `w` for the given lists. */
export function profaneTokens(w: string, langs: readonly ("en" | "fr")[]): string[] {
  const bad = new Set(langs.flatMap((l) => PROFANITY[l]));
  const toks = latinTokens(w);
  const out = toks.filter((t) => bad.has(t));
  const joined = toks.join("");
  if (toks.length > 1 && bad.has(joined)) out.push(joined);
  return out;
}

/** Plural-looking Latin word: some token ends in -s/-x (not the usual singular endings -ss, -us, -is, -os, -as, -ys) or in -aux/-eux/-oux. */
export function looksPlural(text: string): boolean {
  return latinTokens(text).some((t) => t.length > 3 && ((/[^su]s$/.test(t) && !/(is|os|as|ys)$/.test(t)) || /(aux|eux|oux)$/.test(t)));
}

/**
 * Lints a set of pack files.
 * @param registered pack files listed in word-packs/index.ts (relative to the word-packs root); `null` skips that check.
 */
export function lintPacks(entries: readonly PackEntry[], registered: readonly string[] | null = null, opts: LintOptions = {}): LintResult {
  const errors: string[] = [];
  const tiers: { id: string; lang: string; locale: string; tier: "free" | "premium" }[] = [];
  const warnings: string[] = [];
  const counts: Record<string, number> = { en: 0, fr: 0, ar: 0, "ar-LB": 0 };
  const packIds = new Map<string, string>();
  const pairsByLanguage = new Map<string, string>(); // `${lang}:${a}|${b}` → "pack/pair"
  const expanded: { lang: string; at: string; civ: Set<string>; und: Set<string> }[] = [];

  for (const entry of entries) {
    const where = entry.file;
    if (entry.parseError !== undefined) {
      errors.push(`${where}: invalid JSON: ${entry.parseError}`);
      continue;
    }
    const parsed = WordPackSchema.safeParse(entry.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(`${where}: schema: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      continue;
    }
    const pack = parsed.data;
    const lang = languageOf(pack.locale);

    // SPEC-GAP: §12.5 does not list layout checks; §12.2 fixes the layout, so a wrong file name or directory is an error here.
    // Layout (§12.2): file name is `<id>.json` under packs/<language>/.
    const parts = where.split("/");
    if (parts[parts.length - 1] !== `${pack.id}.json`) errors.push(`${where}: file name must be ${pack.id}.json`);
    const dir = parts.length >= 2 ? parts[parts.length - 2] : undefined;
    if (dir !== undefined && dir !== lang) errors.push(`${where}: locale ${pack.locale} must live in packs/${lang}/`);
    if (registered !== null && !registered.includes(where)) warnings.push(`${where}: not listed in word-packs/index.ts (it will not ship)`);

    const prev = packIds.get(pack.id);
    if (prev !== undefined) errors.push(`${where}: duplicate pack id "${pack.id}" (also in ${prev})`);
    else packIds.set(pack.id, where);

    if (pack.status === "draft") warnings.push(`${pack.id}: status is "draft"`);

    // PAYMENTS-SPEC §1.5: tiers and Play product ids.
    tiers.push({ id: pack.id, lang, locale: pack.locale, tier: pack.tier });
    if (pack.tier === "free") {
      if (pack.locale !== "en" && pack.locale !== "fr" && pack.locale !== "ar") errors.push(`${pack.id}: a free pack must have locale en, fr or ar (starter packs are not regional), not ${pack.locale}`);
      if (pack.ageRating !== "all") errors.push(`${pack.id}: a free pack must have ageRating "all"`);
      if (pack.pairs.length < STARTER_MIN_PAIRS) {
        const msg = `${pack.id}: free starter pack has ${pack.pairs.length} pairs (release gate: at least ${STARTER_MIN_PAIRS})`;
        if (opts.release) errors.push(msg);
        else warnings.push(msg);
      }
    } else {
      if (pack.id.length > PREMIUM_PACK_ID_MAX) errors.push(`${pack.id}: a premium pack id must be at most ${PREMIUM_PACK_ID_MAX} characters (Play product id limit)`);
      if (pack.pairs.length < PREMIUM_MIN_PAIRS) warnings.push(`${pack.id}: premium pack has only ${pack.pairs.length} pairs (aim for at least ${PREMIUM_MIN_PAIRS})`);
    }
    const productId = packProductId(pack.id);
    if (!PRODUCT_ID_REGEX.test(productId)) errors.push(`${pack.id}: product id ${productId} is not a valid Play product id`);
    if ((pack.script === "Arab") !== (lang === "ar")) warnings.push(`${pack.id}: script ${pack.script} looks wrong for locale ${pack.locale}`);

    const pairIds = new Set<string>();
    let fewReviewers = 0;
    let shCount = 0;
    const chCount: string[] = [];
    for (const pair of pack.pairs) {
      const at = `${pack.id}/${pair.id}`;
      if (pairIds.has(pair.id)) errors.push(`${at}: duplicate pair id within the pack`);
      pairIds.add(pair.id);

      for (const w of [...sideWords(pair.civilian), ...sideWords(pair.undercover)]) {
        if (w.includes("%")) errors.push(`${at}: word "${w}" contains "%"`);
      }

      const a = normalizeGuess(pair.civilian.text);
      const b = normalizeGuess(pair.undercover.text);
      if (a === b) errors.push(`${at}: civilian "${pair.civilian.text}" and undercover "${pair.undercover.text}" normalise to the same string "${a}"`);
      else {
        // SPEC-GAP: §12.5 only compares civilian.text with undercover.text. Guesses match text, alt and translit
        // (isGuessCorrect), so any shared normalised form between the two sides makes a guess ambiguous: error.
        const civ = sideKeys(pair.civilian);
        const shared = [...sideKeys(pair.undercover)].filter((k) => civ.has(k));
        if (shared.length > 0) errors.push(`${at}: civilian and undercover share the guess form(s) ${shared.map((k) => `"${k}"`).join(", ")} (text/alt/translit)`);
      }

      // SPEC-GAP: the warnings below are not in §12.5; they protect the family rating and guess matching.
      const latinWords = [pair.civilian, pair.undercover].flatMap((side) =>
        pack.script === "Arab" ? [...(side.translit ? [side.translit] : []), ...(side.alt ?? []).filter((w) => /[A-Za-z]/.test(w))] : sideWords(side),
      );
      const profLangs: ("en" | "fr")[] = pack.script === "Arab" ? ["en", "fr"] : lang === "fr" ? ["fr"] : ["en"];
      for (const w of latinWords) {
        const bad = profaneTokens(w, profLangs);
        if (bad.length > 0) warnings.push(`${at}: "${w}" contains a profane word (${bad.join(", ")})`);
      }
      if (pack.script === "Latn") {
        for (const side of [pair.civilian, pair.undercover])
          if (looksPlural(side.text) && (side.alt ?? []).length === 0) warnings.push(`${at}: "${side.text}" looks plural but has no alt (add the singular form)`);
      } else {
        for (const side of [pair.civilian, pair.undercover]) {
          if (side.translit && /[0-9]/.test(side.translit)) warnings.push(`${at}: translit "${side.translit}" uses chat digits; use the readable form and put the digit form in alt`);
          if (side.translit) {
            const t = side.translit.toLowerCase();
            if (/sh/.test(t)) shCount += 1;
            if (/ch/.test(t)) chCount.push(side.translit);
          }
        }
      }

      const key = `${lang}:${[a, b].sort().join("|")}`;
      const seen = pairsByLanguage.get(key);
      if (seen !== undefined) errors.push(`${at}: same pair as ${seen} ("${pair.civilian.text}" / "${pair.undercover.text}")`);
      else pairsByLanguage.set(key, at);

      expanded.push({ lang, at, civ: sideKeys(pair.civilian), und: sideKeys(pair.undercover) });
      if (pair.reviewedBy.length < 2) fewReviewers += 1;
    }
    if (shCount > 0 && chCount.length > 0)
      warnings.push(`${pack.id}: translit mixes "sh" and "ch" for the same sound (${chCount.join(", ")}); use "sh" and put "ch" spellings in alt`);
    if (fewReviewers > 0) warnings.push(`${pack.id}: ${fewReviewers}/${pack.pairs.length} pairs have fewer than 2 reviewers`);

    counts[lang] = (counts[lang] ?? 0) + pack.pairs.length;
    if (pack.locale === "ar-LB") counts["ar-LB"] = (counts["ar-LB"] ?? 0) + pack.pairs.length;
  }

  // SPEC-GAP: near-duplicates (same unordered pair once alt/translit are expanded, e.g. "Pool" vs "Swimming pool" with
  // alt) are a warning; the exact §12.5 duplicate rule above stays the only error.
  for (let i = 0; i < expanded.length; i++) {
    const x = expanded[i] as (typeof expanded)[number];
    for (let j = i + 1; j < expanded.length; j++) {
      const y = expanded[j] as (typeof expanded)[number];
      if (x.lang !== y.lang) continue;
      const meets = (p: Set<string>, q: Set<string>): boolean => [...p].some((k) => q.has(k));
      const same = (meets(x.civ, y.civ) && meets(x.und, y.und)) || (meets(x.civ, y.und) && meets(x.und, y.civ));
      const exact = errors.some((e) => e.startsWith(`${y.at}: same pair as ${x.at}`));
      if (same && !exact) warnings.push(`${y.at}: near-duplicate of ${x.at} once alt/translit are expanded`);
    }
  }

  // PAYMENTS-SPEC §1.5: exactly one free pack per language; product ids unique.
  for (const lang of [...new Set(tiers.map((t) => t.lang))].sort()) {
    const free = tiers.filter((t) => t.lang === lang && t.tier === "free");
    if (free.length !== 1) errors.push(`language ${lang}: exactly one free (tier "free") pack is required, found ${free.length}${free.length ? ` (${free.map((t) => t.id).join(", ")})` : ""}`);
  }
  const byProduct = new Map<string, string>();
  for (const t of tiers) {
    const pid = packProductId(t.id);
    const other = byProduct.get(pid);
    if (other !== undefined && other !== t.id) errors.push(`${t.id}: product id ${pid} collides with ${other}`);
    else byProduct.set(pid, t.id);
  }

  for (const [scope, target] of Object.entries(M4_TARGETS)) {
    const n = counts[scope] ?? 0;
    if (n < target) warnings.push(`M4 target not met: ${scope} has ${n} pairs (target ${target})`);
  }
  return { errors, warnings, counts };
}

/** Extracts the pack files imported by word-packs/index.ts, relative to the word-packs root. */
export function registeredPackFiles(indexSource: string): string[] {
  const out: string[] = [];
  for (const m of indexSource.matchAll(/from\s+["']\.\/(packs\/[^"']+\.json)["']/g)) out.push(m[1] as string);
  return out;
}
