// §8.7 in-house t(): locale → en → key fallback, Intl.PluralRules plurals, {name} placeholders, latn digits.
import { signal } from "@preact/signals";
import en from "@mishana/shared/i18n/en.json";
import fr from "@mishana/shared/i18n/fr.json";
import ar from "@mishana/shared/i18n/ar.json";
import { LOCALES } from "@mishana/shared/constants";
import type { Locale } from "@mishana/shared/constants";

export type MessageKey = keyof typeof en;
type PluralValue = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
type Value = string | PluralValue;
type Catalog = Record<string, Value | undefined>;
export type Params = Record<string, string | number>;

const CATALOGS: Record<Locale, Catalog> = { en, fr: fr as Catalog, ar: ar as Catalog };

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
  let value: Value | undefined = CATALOGS[l][key];
  let used: Locale = l;
  if (value === undefined) {
    value = CATALOGS.en[key];
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

/** Sets the locale and updates <html lang dir>. */
export function setLocale(l: Locale): void {
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
