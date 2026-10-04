// Zod-free: types + helpers over the UI strings in shared/i18n/*.json.
import ar from "../../i18n/ar.json";
import en from "../../i18n/en.json";
import fr from "../../i18n/fr.json";
import type { ErrorCode } from "../protocol/errors";
import { errorMessageKey } from "../protocol/errors";

export type MessageKey = keyof typeof en;
export type MessageValue = string | Partial<Record<"zero" | "one" | "two" | "few" | "many" | "other", string>>;
export type Messages = Record<MessageKey, MessageValue>;
export const MESSAGES: { en: Messages; fr: Messages; ar: Messages } = { en, fr: fr as Messages, ar: ar as Messages };

export function errorKey(code: ErrorCode): MessageKey {
  return errorMessageKey(code) as MessageKey;
}
