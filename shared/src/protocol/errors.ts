// Zod-free: the web client and i18n helpers may import this at runtime.
import { CLOSE_CODES as C } from "../constants";
import type { EngineError } from "../games/mishana/engine/types";
import { ERRORS as BLUFF_ERRORS } from "../games/bluff/errors";
import { ERRORS as LIKELY_ERRORS } from "../games/likely/errors";
import { ERRORS as MISHANA_ERRORS } from "../games/mishana/errors";
import { ERRORS as TRIVIA_ERRORS } from "../games/trivia/errors";

export const PLATFORM_ERROR_CODES = [
  "BAD_MESSAGE", "UNSUPPORTED_VERSION", "NOT_AUTHENTICATED", "TV_AUTH_FAILED", "ROOM_NOT_FOUND", "ROOM_EXPIRED",
  "ROOM_FULL", "ROOM_LOCKED", "ALREADY_JOINED", "NAME_INVALID", "NAME_TAKEN", "COLOR_TAKEN", "RESUME_INVALID",
  "KICKED", "REPLACED", "NOT_HOST", "WRONG_PHASE", "NOT_YOUR_TURN", "NOT_ALIVE", "INVALID_TARGET",
  "INVALID_SETTINGS", "NOT_ENOUGH_PLAYERS", "INVALID_ROLE_CONFIG", "NO_WORDS_AVAILABLE", "GUESS_INVALID",
  "RATE_LIMITED", "INTERNAL",
  // PAYMENTS-SPEC §3.11 (all non-fatal)
  "PREMIUM_REQUIRED", "PACK_LOCKED", "ENTITLEMENT_INVALID", "TV_BUSY",
  // JAMAA-PLATFORM §2.2 platform codes (all non-fatal)
  "UNKNOWN_GAME", "GAME_DISABLED", "GAME_UNAVAILABLE", "WRONG_GAME", "NOT_IN_GAME", "GAME_FULL", "NO_CONTENT_AVAILABLE",
  "REACTION_TOO_FAST",
] as const;
export type PlatformErrorCode = (typeof PLATFORM_ERROR_CODES)[number];

/** JAMAA-PLATFORM §2.2: each registered game's own codes (games/<id>/errors.ts). A duplicate across lists fails a test. */
export const GAME_ERROR_CODES = {
  mishana: MISHANA_ERRORS, bluff: BLUFF_ERRORS, likely: LIKELY_ERRORS, trivia: TRIVIA_ERRORS,
} as const;
type GameErrorCode = (typeof GAME_ERROR_CODES)[keyof typeof GAME_ERROR_CODES][number];

export const ERROR_CODES = [
  ...PLATFORM_ERROR_CODES,
  ...GAME_ERROR_CODES.mishana, ...GAME_ERROR_CODES.bluff, ...GAME_ERROR_CODES.likely, ...GAME_ERROR_CODES.trivia,
] as const;
export type ErrorCode = PlatformErrorCode | GameErrorCode;

/** §6.4: fatal errors are followed by a close with `closeCode`. RATE_LIMITED closes 4008 only after 3 strikes. */
const PLATFORM_ERROR_INFO: Record<PlatformErrorCode, { fatal: boolean; closeCode: number | null }> = {
  BAD_MESSAGE: { fatal: false, closeCode: null },
  UNSUPPORTED_VERSION: { fatal: true, closeCode: C.UNSUPPORTED_VERSION },
  NOT_AUTHENTICATED: { fatal: false, closeCode: null },
  TV_AUTH_FAILED: { fatal: true, closeCode: C.TV_AUTH_FAILED },
  ROOM_NOT_FOUND: { fatal: true, closeCode: C.ROOM_NOT_FOUND },
  ROOM_EXPIRED: { fatal: true, closeCode: C.ROOM_EXPIRED },
  ROOM_FULL: { fatal: false, closeCode: null },
  ROOM_LOCKED: { fatal: false, closeCode: null },
  ALREADY_JOINED: { fatal: false, closeCode: null },
  NAME_INVALID: { fatal: false, closeCode: null },
  NAME_TAKEN: { fatal: false, closeCode: null },
  COLOR_TAKEN: { fatal: false, closeCode: null },
  RESUME_INVALID: { fatal: false, closeCode: null },
  KICKED: { fatal: true, closeCode: C.KICKED },
  REPLACED: { fatal: true, closeCode: C.REPLACED },
  NOT_HOST: { fatal: false, closeCode: null },
  WRONG_PHASE: { fatal: false, closeCode: null },
  NOT_YOUR_TURN: { fatal: false, closeCode: null },
  NOT_ALIVE: { fatal: false, closeCode: null },
  INVALID_TARGET: { fatal: false, closeCode: null },
  INVALID_SETTINGS: { fatal: false, closeCode: null },
  NOT_ENOUGH_PLAYERS: { fatal: false, closeCode: null },
  INVALID_ROLE_CONFIG: { fatal: false, closeCode: null },
  NO_WORDS_AVAILABLE: { fatal: false, closeCode: null },
  GUESS_INVALID: { fatal: false, closeCode: null },
  RATE_LIMITED: { fatal: false, closeCode: C.RATE_LIMITED },
  INTERNAL: { fatal: false, closeCode: null },
  PREMIUM_REQUIRED: { fatal: false, closeCode: null },
  PACK_LOCKED: { fatal: false, closeCode: null },
  ENTITLEMENT_INVALID: { fatal: false, closeCode: null },
  TV_BUSY: { fatal: false, closeCode: null },
  UNKNOWN_GAME: { fatal: false, closeCode: null },
  GAME_DISABLED: { fatal: false, closeCode: null },
  GAME_UNAVAILABLE: { fatal: false, closeCode: null },
  WRONG_GAME: { fatal: false, closeCode: null },
  NOT_IN_GAME: { fatal: false, closeCode: null },
  GAME_FULL: { fatal: false, closeCode: null },
  NO_CONTENT_AVAILABLE: { fatal: false, closeCode: null },
  REACTION_TOO_FAST: { fatal: false, closeCode: null },
};

/** Per-game codes are never fatal and carry no close code (§2.2). */
export const ERROR_INFO: Record<ErrorCode, { fatal: boolean; closeCode: number | null }> = {
  ...PLATFORM_ERROR_INFO,
  ...(Object.fromEntries(
    ERROR_CODES.filter((c) => !(c in PLATFORM_ERROR_INFO)).map((c) => [c, { fatal: false, closeCode: null }]),
  ) as Record<GameErrorCode, { fatal: boolean; closeCode: number | null }>),
};

export { CLOSE_CODES } from "../constants";

/** "NOT_YOUR_TURN" → "notYourTurn". */
export function lowerCamel(code: string): string {
  return code.toLowerCase().replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
}

/** `messageKey` = "error." + lowerCamel(code). */
export function errorMessageKey(code: ErrorCode): `error.${string}` {
  return `error.${lowerCamel(code)}`;
}

// Compile-time check: every engine error is a wire error code.
type _EngineErrorsAreCodes = EngineError extends ErrorCode ? true : never;
export const _engineErrorsAreCodes: _EngineErrorsAreCodes = true;
