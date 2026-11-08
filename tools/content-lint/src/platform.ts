// Platform-level content checks (JAMAA-PLATFORM §5.1, §5.4, §5.5): the per-game registry, the controlled vocabulary
// and i18n completeness for game.<id>.* keys and vocabulary labels. Pure; main.ts does the I/O.

export const GAME_IDS = ["mishana", "bluff", "likely", "trivia"] as const;
export type GameId = (typeof GAME_IDS)[number];
export const I18N_LOCALES = ["en", "fr", "ar", "es"] as const;
export type I18nLocale = (typeof I18N_LOCALES)[number];

export interface Findings { errors: string[]; warnings: string[] }

/** `content/index.ts` must import every game's `./<id>/index` (P creates all four, §6.1). */
export function lintRootIndex(src: string): Findings {
  const errors: string[] = [];
  for (const id of GAME_IDS) {
    if (!new RegExp(`from\\s+["']\\./${id}/index(\\.ts)?["']`).test(src)) errors.push(`content/index.ts: does not import ./${id}/index`);
  }
  if (!/export const CONTENT\b/.test(src)) errors.push("content/index.ts: must export CONTENT (§5.1)");
  return { errors, warnings: [] };
}

/** Pack files a game index imports (`./<path>.json`), relative to the content root (`<game>/<path>.json`). */
export function registeredGameFiles(gameIndexSrc: string, game: string): string[] {
  const out: string[] = [];
  for (const m of gameIndexSrc.matchAll(/from\s+["']\.\/([^"']+\.json)["']/g)) out.push(`${game}/${m[1] as string}`);
  return out;
}

/** JSON files under a game folder that its index.ts does not import (they would not ship). */
export function unlistedFiles(files: readonly string[], registered: readonly string[]): string[] {
  const reg = new Set(registered);
  return files.filter((f) => !reg.has(f));
}

export interface Vocab { domains: string[]; topics: string[]; regions: string[] }
export type MessageFile = Record<string, unknown>;
export type I18nFiles = Record<I18nLocale, MessageFile>;

const KEBAB = /^[a-z]+(-[a-z]+)*$/;
/** `middle-east` → `middleEast` (an i18n key segment). */
export const camel = (id: string): string => id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** vocab.json shape plus a label in every locale for each domain and topic (§5.4). Regions have no label. */
export function lintVocab(raw: unknown, root: I18nFiles | null): Findings {
  const errors: string[] = [];
  const v = raw as Partial<Vocab> | null;
  for (const field of ["domains", "topics", "regions"] as const) {
    const list = v?.[field];
    if (!Array.isArray(list) || list.some((x) => typeof x !== "string")) {
      errors.push(`vocab.json: ${field} must be an array of strings`);
      continue;
    }
    const seen = new Set<string>();
    for (const id of list) {
      if (!KEBAB.test(id)) errors.push(`vocab.json: ${field} "${id}" is not kebab-case`);
      if (seen.has(id)) errors.push(`vocab.json: ${field} "${id}" is listed twice`);
      seen.add(id);
    }
  }
  if (root && errors.length === 0) {
    for (const [field, ns] of [["domains", "domain"], ["topics", "topic"]] as const) {
      for (const id of (v as Vocab)[field]) {
        for (const loc of I18N_LOCALES) {
          const key = `content.${ns}.${camel(id)}`;
          if (typeof root[loc][key] !== "string") errors.push(`i18n ${loc}: missing label ${key} for vocab ${field} "${id}"`);
        }
      }
    }
  }
  return { errors, warnings: [] };
}

/** §5.5 i18n completeness: every game.<id>.* key exists in en, fr, ar and es, and lives in that game's file. */
export function lintGameI18n(root: I18nFiles, games: Partial<Record<GameId, I18nFiles>>): Findings {
  const errors: string[] = [];
  for (const loc of I18N_LOCALES) {
    for (const k of Object.keys(root[loc])) if (k.startsWith("game.")) errors.push(`i18n ${loc}: root file has game key "${k}" (move it to shared/i18n/games/<id>/)`);
  }
  for (const id of GAME_IDS) {
    const files = games[id];
    if (!files) {
      errors.push(`i18n: shared/i18n/games/${id}/ is missing (every game has one, §5.7)`);
      continue;
    }
    const all = new Set(I18N_LOCALES.flatMap((loc) => Object.keys(files[loc]).filter((k) => k.startsWith(`game.${id}.`))));
    for (const k of all) for (const loc of I18N_LOCALES) if (!(k in files[loc])) errors.push(`i18n games/${id} ${loc}: missing "${k}"`);
    for (const loc of I18N_LOCALES) {
      for (const k of Object.keys(files[loc])) {
        const other = GAME_IDS.find((g) => g !== id && k.startsWith(`game.${g}.`));
        if (other) errors.push(`i18n games/${id} ${loc}: "${k}" belongs to games/${other}`);
      }
    }
    if (!(`game.${id}.title` in files.en)) errors.push(`i18n games/${id}: missing game.${id}.title (hub poster)`);
  }
  return { errors, warnings: [] };
}
