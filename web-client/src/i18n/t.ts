// §8.7 in-house t(): locale → en → key fallback, Intl.PluralRules plurals, {name} placeholders, latn digits.
// JAMAA-PLATFORM §5.7: the root catalog (platform keys) and one catalog per game (shared/i18n/games/<id>/<locale>.json).
// Every catalog is a lazy chunk fetched on demand (JAMAA-PLATFORM §3.8 budget): a player needs ONE root locale plus
// the games of their room. Lane D's key-parity test keeps every locale complete, so a non-English player does not
// download English as a fallback; English loads only if a key is ever missing at runtime (then once, in the background).
import { signal } from "@preact/signals";
import type en from "@jamaa/shared/i18n/en.json";
import { LOCALES } from "@jamaa/shared/constants";
import type { Locale } from "@jamaa/shared/constants";
import type { GameId } from "@jamaa/shared/games/ids";
import type mishanaEn from "@jamaa/shared/i18n/games/mishana/en.json";
import type bluffEn from "@jamaa/shared/i18n/games/bluff/en.json";
import type likelyEn from "@jamaa/shared/i18n/games/likely/en.json";
import type triviaEn from "@jamaa/shared/i18n/games/trivia/en.json";

export type RootKey = keyof typeof en;
export type MessageKey = RootKey | keyof typeof mishanaEn | keyof typeof bluffEn | keyof typeof likelyEn | keyof typeof triviaEn;
type PluralValue = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
type Value = string | PluralValue;
type Catalog = Record<string, Value | undefined>;
export type Params = Record<string, string | number>;
type Loader = () => Promise<{ default: unknown }>;

/** Merged catalog per locale: the root file plus every game file loaded so far. */
const CATALOGS: Partial<Record<Locale, Catalog>> = {};
/** The phone part of each root catalog (lib/i18nSplit.ts: the TV-only `store.*`, `pass.*`, `tv.*` keys stay out). */
const ROOT_LOADERS: Record<Locale, Loader> = {
  en: () => import("virtual:jamaa-i18n/en"),
  fr: () => import("virtual:jamaa-i18n/fr"),
  ar: () => import("virtual:jamaa-i18n/ar"),
  es: () => import("virtual:jamaa-i18n/es"),
};
/** The TV part, registered by the /tv mock only (registerRootExtras), loaded with the phone part. */
let rootExtras: Record<Locale, Loader> | null = null;
export function registerRootExtras(loaders: Record<Locale, Loader>): Promise<void> {
  rootExtras = loaders;
  return Promise.all([...rootLoaded].map((l) => loaders[l]().then((m) => merge(l, m.default)))).then(() => undefined);
}
/** One lazy chunk per (game, locale). Literal paths so the bundler can split them. */
const GAME_LOADERS: Record<GameId, Record<Locale, Loader>> = {
  mishana: {
    en: () => import("@jamaa/shared/i18n/games/mishana/en.json"), fr: () => import("@jamaa/shared/i18n/games/mishana/fr.json"),
    ar: () => import("@jamaa/shared/i18n/games/mishana/ar.json"), es: () => import("@jamaa/shared/i18n/games/mishana/es.json"),
  },
  bluff: {
    en: () => import("@jamaa/shared/i18n/games/bluff/en.json"), fr: () => import("@jamaa/shared/i18n/games/bluff/fr.json"),
    ar: () => import("@jamaa/shared/i18n/games/bluff/ar.json"), es: () => import("@jamaa/shared/i18n/games/bluff/es.json"),
  },
  likely: {
    en: () => import("@jamaa/shared/i18n/games/likely/en.json"), fr: () => import("@jamaa/shared/i18n/games/likely/fr.json"),
    ar: () => import("@jamaa/shared/i18n/games/likely/ar.json"), es: () => import("@jamaa/shared/i18n/games/likely/es.json"),
  },
  trivia: {
    en: () => import("@jamaa/shared/i18n/games/trivia/en.json"), fr: () => import("@jamaa/shared/i18n/games/trivia/fr.json"),
    ar: () => import("@jamaa/shared/i18n/games/trivia/ar.json"), es: () => import("@jamaa/shared/i18n/games/trivia/es.json"),
  },
};
const rootLoaded = new Set<Locale>();
const gameLoaded = new Set<string>();
const inflight = new Map<string, Promise<void>>();
/** Bumps whenever a catalog lands, so components that rendered a fallback re-render (read inside t()). */
export const catalogRev = signal(0);

function merge(l: Locale, table: unknown): void {
  CATALOGS[l] = { ...CATALOGS[l], ...(table as Catalog) };
  catalogRev.value++;
}

function once(key: string, run: () => Promise<void>): Promise<void> {
  let p = inflight.get(key);
  if (!p) {
    p = run().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

/** Loads a locale's root catalog (once). Until it is in, translate() falls back to English. */
export async function loadCatalog(l: Locale): Promise<void> {
  if (rootLoaded.has(l)) return;
  await once(`root:${l}`, async () => {
    const [table, extra] = await Promise.all([ROOT_LOADERS[l](), rootExtras?.[l]()]);
    rootLoaded.add(l);
    merge(l, { ...(table.default as Catalog), ...(extra?.default as Catalog | undefined) });
  });
}

/** Loads one game's strings in `l` (once). English follows only on a runtime miss (see translate). */
export async function loadGameCatalog(id: GameId, l: Locale): Promise<void> {
  const one = (x: Locale): Promise<void> => {
    const key = `${id}:${x}`;
    if (gameLoaded.has(key)) return Promise.resolve();
    return once(key, async () => {
      const table = (await GAME_LOADERS[id][x]()).default;
      gameLoaded.add(key);
      merge(x, table);
    });
  };
  await one(l);
}

/** True once loadGameCatalog(id, l) has resolved. */
export function gameCatalogReady(id: GameId, l: Locale): boolean {
  return gameLoaded.has(`${id}:${l}`);
}

export const locale = signal<Locale>("en");

const pluralCache = new Map<Locale, Intl.PluralRules>();
const numberCache = new Map<Locale, Intl.NumberFormat>();
function plurals(l: Locale): Intl.PluralRules {
  let p = pluralCache.get(l);
  if (!p) pluralCache.set(l, (p = new Intl.PluralRules(l)));
  return p;
}
export function numberFormat(l: Locale): Intl.NumberFormat {
  let n = numberCache.get(l);
  if (!n) numberCache.set(l, (n = new Intl.NumberFormat(l, { numberingSystem: "latn" })));
  return n;
}

/** Formats a number with Western digits in every locale (DESIGN §3.5). */
export function fmtNum(n: number, l: Locale = locale.value): string {
  return numberFormat(l).format(n);
}

let englishRequested = false;
/** A key missing in the player's locale (should not happen: key parity is tested): fetch English once as the fallback. */
function missEnglish(key: string): void {
  if (englishRequested || (CATALOGS[locale.value] === undefined)) return;
  englishRequested = true;
  void loadCatalog("en").catch(() => undefined);
  const game = /^game\.([a-z]+)\./.exec(key)?.[1];
  for (const k of gameLoaded) {
    const id = k.split(":")[0] as GameId;
    if (!game || id === game) void loadGameCatalog(id, "en").catch(() => undefined);
  }
}

export function translate(l: Locale, key: string, params?: Params): string {
  let value: Value | undefined = CATALOGS[l]?.[key];
  let used: Locale = l;
  if (value === undefined) {
    value = CATALOGS.en?.[key];
    used = "en";
    if (value === undefined && l !== "en") missEnglish(key);
  }
  if (value === undefined) return key;
  let s: string;
  if (typeof value === "string") {
    s = value;
  } else {
    const count = typeof params?.count === "number" ? params.count : Number(params?.count ?? 0);
    s = value[plurals(used).select(count)] ?? value.other;
  }
  if (!params) return s;
  return s.replace(/\{([a-z][a-zA-Z0-9]*)\}/g, (m, name: string) => {
    const v = params[name];
    if (v === undefined) return m;
    return typeof v === "number" ? fmtNum(v, used) : v;
  });
}

/** Translates with the current locale. Reading `locale.value` subscribes the calling component. */
export function t(key: MessageKey, params?: Params): string {
  void catalogRev.value;
  return translate(locale.value, key, params);
}

/**
 * `key` when the loaded catalog has it, else `fallback`: lets the UI switch to a key lane D is adding (JAMAA-PLATFORM
 * §3.7 "the UI calls it the character": join.characterLabel / join.characterTaken) without ever showing a raw key.
 * Never triggers the English fallback fetch. Drop the call (plain t) once the key is in every catalog.
 */
export function tPrefer(key: string, fallback: MessageKey, params?: Params): string {
  void catalogRev.value;
  return CATALOGS[locale.value]?.[key] !== undefined ? translate(locale.value, key, params) : translate(locale.value, fallback, params);
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Default from navigator.languages: first match of ar/fr/es/en, else en (DESIGN PH-17). */
export function detectLocale(langs: readonly string[] | undefined): Locale {
  for (const raw of langs ?? []) {
    const base = raw.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "en";
}

export function dirOf(l: Locale): "rtl" | "ltr" {
  return l === "ar" ? "rtl" : "ltr";
}

/** Each locale's name in its own language (language pickers, the word-language setting, summaries). */
export const LOCALE_NATIVE_NAME: Readonly<Record<Locale, string>> = { en: "English", fr: "Français", ar: "العربية", es: "Español" };

/** A pack title in UI language [l]; `es` is optional in pack titles, so it falls back to English. */
export function titleIn(title: { en: string; fr: string; ar: string; es?: string | undefined }, l: Locale = locale.value): string {
  return title[l] ?? title.en;
}

/** Wraps user text (a name, a guess) in FSI…PDI so it never reorders the sentence around it (DESIGN §3.5). */
export function isolate(s: string): string {
  return "\u2068" + s + "\u2069";
}

/** "Ben and Eli" / "Ben or Eli" in the current locale (names bidi-isolated). */
export function listOf(names: readonly string[], type: "conjunction" | "disjunction" = "conjunction"): string {
  const parts = names.map(isolate);
  try {
    return new Intl.ListFormat(locale.value, { type }).format(parts);
  } catch {
    return parts.join(", ");
  }
}

/** Wraps always-LTR text (a URL, a room code) in LRI…PDI. */
export function isolateLtr(s: string): string {
  return "\u2066" + s + "\u2069";
}

/** Loads the catalog if needed, then sets the locale and updates <html lang dir> (one switch, no English flash). */
export async function setLocale(l: Locale): Promise<void> {
  try {
    // The root strings plus every game this page already shows (switching language never flashes English).
    const games = [...new Set([...gameLoaded].map((k) => k.split(":")[0] as GameId))];
    await Promise.all([loadCatalog(l), ...games.map((g) => loadGameCatalog(g, l))]);
  } catch {
    /* offline mid-switch: keep going, translate() falls back to English */
  }
  locale.value = l;
  if (typeof document !== "undefined") {
    document.documentElement.lang = l;
    document.documentElement.dir = dirOf(l);
  }
}

/** "NOT_YOUR_TURN" → "error.notYourTurn" (§6.4). */
export function errorKeyOf(code: string): MessageKey {
  return `error.${code.toLowerCase().replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())}` as MessageKey;
}

/** Splits a translated string around one placeholder so JSX can be slotted in: [before, after]. */
export function tSplit(key: MessageKey, slot: string, params?: Params): [string, string] {
  const s = translate(locale.value, key, { ...params, [slot]: "\u0000" });
  const i = s.indexOf("\u0000");
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
}
