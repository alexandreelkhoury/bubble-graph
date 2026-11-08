// Zod-free: types + helpers over the UI strings. JAMAA-PLATFORM §5.7: the root files (shared/i18n/<locale>.json) hold
// the platform keys and each game owns shared/i18n/games/<id>/<locale>.json; MESSAGES merges them per locale.
// A duplicate key, or a `game.<id>.` key in the root file, is an error (thrown at load, asserted by shared/test/i18n).
import ar from "../../i18n/ar.json";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import fr from "../../i18n/fr.json";
import bluffAr from "../../i18n/games/bluff/ar.json";
import bluffEn from "../../i18n/games/bluff/en.json";
import bluffEs from "../../i18n/games/bluff/es.json";
import bluffFr from "../../i18n/games/bluff/fr.json";
import likelyAr from "../../i18n/games/likely/ar.json";
import likelyEn from "../../i18n/games/likely/en.json";
import likelyEs from "../../i18n/games/likely/es.json";
import likelyFr from "../../i18n/games/likely/fr.json";
import mishanaAr from "../../i18n/games/mishana/ar.json";
import mishanaEn from "../../i18n/games/mishana/en.json";
import mishanaEs from "../../i18n/games/mishana/es.json";
import mishanaFr from "../../i18n/games/mishana/fr.json";
import triviaAr from "../../i18n/games/trivia/ar.json";
import triviaEn from "../../i18n/games/trivia/en.json";
import triviaEs from "../../i18n/games/trivia/es.json";
import triviaFr from "../../i18n/games/trivia/fr.json";
import type { ErrorCode } from "../protocol/errors";
import { errorMessageKey } from "../protocol/errors";

type EnMerged = typeof en & typeof mishanaEn & typeof bluffEn & typeof likelyEn & typeof triviaEn;
export type MessageKey = keyof EnMerged;
export type MessageValue = string | Partial<Record<"zero" | "one" | "two" | "few" | "many" | "other", string>>;
export type Messages = Record<MessageKey, MessageValue>;
type Table = Record<string, MessageValue>;

/** The per-game files of each locale, in GAME_IDS order. */
export const GAME_MESSAGES: Record<"en" | "fr" | "ar" | "es", Record<"mishana" | "bluff" | "likely" | "trivia", Table>> = {
  en: { mishana: mishanaEn, bluff: bluffEn, likely: likelyEn, trivia: triviaEn },
  fr: { mishana: mishanaFr, bluff: bluffFr, likely: likelyFr, trivia: triviaFr },
  ar: { mishana: mishanaAr, bluff: bluffAr, likely: likelyAr, trivia: triviaAr },
  es: { mishana: mishanaEs, bluff: bluffEs, likely: likelyEs, trivia: triviaEs },
};
export const ROOT_MESSAGES: Record<"en" | "fr" | "ar" | "es", Table> = { en, fr, ar, es };

/** Root + every game file; throws on a duplicate key or a `game.<id>.` key in the root file. */
export function mergeMessages(root: Table, games: Record<string, Table>): Table {
  const out: Table = {};
  for (const k of Object.keys(root)) {
    if (/^game\.[a-z]+\./.test(k)) throw new Error(`i18n: game key ${k} in the root file`);
    out[k] = root[k] as MessageValue;
  }
  for (const [id, table] of Object.entries(games)) {
    for (const k of Object.keys(table)) {
      if (k in out) throw new Error(`i18n: duplicate key ${k} (games/${id})`);
      out[k] = table[k] as MessageValue;
    }
  }
  return out;
}

const merged = (l: "en" | "fr" | "ar" | "es"): Messages => mergeMessages(ROOT_MESSAGES[l], GAME_MESSAGES[l]) as Messages;
export const MESSAGES: { en: Messages; fr: Messages; ar: Messages; es: Messages } = { en: merged("en"), fr: merged("fr"), ar: merged("ar"), es: merged("es") };

export function errorKey(code: ErrorCode): MessageKey {
  return errorMessageKey(code) as MessageKey;
}
