// GAME-BLUFF §5.4: the per-locale blocklists (shared/src/games/bluff/blocklist/<locale>.json) plus a cross-locale
// `universal.json` checked in every room (a slur typed in another room language, or Arabizi in a Latin room).
// Compiled once at module load (hardened matching: similar.ts hitsBlocklist).
import type { Locale } from "../../../constants";
import ar from "../blocklist/ar.json";
import en from "../blocklist/en.json";
import es from "../blocklist/es.json";
import fr from "../blocklist/fr.json";
import universal from "../blocklist/universal.json";
import { type CompiledBlocklist, compileBlocklist } from "./similar";

const ROOM = { en, fr, ar, es } as const;
const compile = (locale: Locale): CompiledBlocklist =>
  compileBlocklist([
    { list: ROOM[locale], suffixes: [locale] },
    { list: universal, suffixes: ["en", "fr", "es"] },
  ]);

export const BLOCKLIST: Readonly<Record<Locale, CompiledBlocklist>> = { en: compile("en"), fr: compile("fr"), ar: compile("ar"), es: compile("es") };
