// JAMAA-PLATFORM §3.8 budget: the root catalog ships in two parts. Phones download only the phone part; the /tv mock
// adds the TV part (the Pass store, the Pass and the TV-only strings: `store.*`, `pass.*`, `tv.*`), about a third of
// every root catalog. The JSON files stay whole (lane D's key parity); vite.config.ts splits them at build time
// (`virtual:jamaa-i18n/<locale>` and `virtual:jamaa-i18n-tv/<locale>`). test/i18nSplit.test.ts keeps phone code off
// the TV-only prefixes.

/** Root-catalog prefixes only the TV renders. */
export const TV_ONLY_PREFIXES = ["store.", "pass.", "tv."] as const;
/** TV-only-prefixed keys the phone does show (the VIP's "the Pass ended" toast). */
export const PHONE_ALSO = new Set(["pass.endedPhone"]);

export function isTvOnlyKey(k: string): boolean {
  return !PHONE_ALSO.has(k) && TV_ONLY_PREFIXES.some((p) => k.startsWith(p));
}

/** The phone (`tv` = false) or TV-extra (`tv` = true) part of a root catalog. */
export function splitCatalog(table: Readonly<Record<string, unknown>>, tv: boolean): Record<string, unknown> {
  return Object.fromEntries(Object.entries(table).filter(([k]) => isTvOnlyKey(k) === tv));
}
