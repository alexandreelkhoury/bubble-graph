// Pure core of tools/pack-lint (SPEC §12.5). No I/O here; see main.ts.
import { normalizeGuess } from "@mishana/shared/engine";
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

/** M4 drafting targets (§12.2). Missing them is only a warning. */
export const M4_TARGETS: Readonly<Record<string, number>> = { en: 150, fr: 150, ar: 100, "ar-LB": 40 };

const languageOf = (locale: string): string => locale.split("-")[0] ?? locale;

function sideWords(side: WordPack["pairs"][number]["civilian"]): string[] {
  return [side.text, ...(side.alt ?? []), ...(side.translit ? [side.translit] : [])];
}

/**
 * Lints a set of pack files.
 * @param registered pack files listed in word-packs/index.ts (relative to the word-packs root); `null` skips that check.
 */
export function lintPacks(entries: readonly PackEntry[], registered: readonly string[] | null = null): LintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const counts: Record<string, number> = { en: 0, fr: 0, ar: 0, "ar-LB": 0 };
  const packIds = new Map<string, string>();
  const pairsByLanguage = new Map<string, string>(); // `${lang}:${a}|${b}` → "pack/pair"

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
    if ((pack.script === "Arab") !== (lang === "ar")) warnings.push(`${pack.id}: script ${pack.script} looks wrong for locale ${pack.locale}`);

    const pairIds = new Set<string>();
    let fewReviewers = 0;
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

      const key = `${lang}:${[a, b].sort().join("|")}`;
      const seen = pairsByLanguage.get(key);
      if (seen !== undefined) errors.push(`${at}: same pair as ${seen} ("${pair.civilian.text}" / "${pair.undercover.text}")`);
      else pairsByLanguage.set(key, at);

      if (pair.reviewedBy.length < 2) fewReviewers += 1;
    }
    if (fewReviewers > 0) warnings.push(`${pack.id}: ${fewReviewers}/${pack.pairs.length} pairs have fewer than 2 reviewers`);

    counts[lang] = (counts[lang] ?? 0) + pack.pairs.length;
    if (pack.locale === "ar-LB") counts["ar-LB"] = (counts["ar-LB"] ?? 0) + pack.pairs.length;
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
