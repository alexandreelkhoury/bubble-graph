// GAME-BLUFF §5.4: the per-locale blocklists (shared/src/games/bluff/blocklist/<locale>.json).
import type { Locale } from "../../../constants";
import ar from "../blocklist/ar.json";
import en from "../blocklist/en.json";
import es from "../blocklist/es.json";
import fr from "../blocklist/fr.json";

export const BLOCKLIST: Readonly<Record<Locale, readonly string[]>> = { en: en.words, fr: fr.words, ar: ar.words, es: es.words };
