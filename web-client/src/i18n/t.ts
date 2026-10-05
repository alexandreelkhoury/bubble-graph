// §8.7 in-house t(): locale → en → key fallback, Intl.PluralRules plurals, {name} placeholders, latn digits.
// Only English (the fallback) ships in the entry chunk; FR and AR are fetched on demand (each player needs one).
import { signal } from "@preact/signals";
import en from "@mishana/shared/i18n/en.json";
import { LOCALES } from "@mishana/shared/constants";
import type { Locale } from "@mishana/shared/constants";

export type MessageKey = keyof typeof en;
type PluralValue = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
type Value = string | PluralValue;
type Catalog = Record<string, Value | undefined>;
export type Params = Record<string, string | number>;

const CATALOGS: Partial<Record<Locale, Catalog>> = { en };
const LOADERS: Record<Exclude<Locale, "en">, () => Promise<{ default: unknown }>> = {
  fr: () => import("@mishana/shared/i18n/fr.json"),
  ar: () => import("@mishana/shared/i18n/ar.json"),
};

/** Loads a locale's catalog (once). Until it is in, translate() falls back to English. */
export async function loadCatalog(l: Locale): Promise<void> {
  if (CATALOGS[l] || l === "en") return;
  CATALOGS[l] = (await LOADERS[l]()).default as Catalog;
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

export function translate(l: Locale, key: string, params?: Params): string {
  let value: Value | undefined = CATALOGS[l]?.[key];
  let used: Locale = l;
  if (value === undefined) {
    value = en[key as MessageKey];
    used = "en";
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
  return translate(locale.value, key, params);
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Default from navigator.languages: first match of ar/fr/en, else en (DESIGN PH-17). */
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
export const LOCALE_NATIVE_NAME: Readonly<Record<Locale, string>> = { en: "English", fr: "Français", ar: "العربية" };

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
    await loadCatalog(l);
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
