// Zod-free: the web client and i18n helpers may import this at runtime.
import type { EngineError } from "../engine/types";

export const ERROR_CODES = [
  "BAD_MESSAGE", "UNSUPPORTED_VERSION", "NOT_AUTHENTICATED", "TV_AUTH_FAILED", "ROOM_NOT_FOUND", "ROOM_EXPIRED",
  "ROOM_FULL", "ROOM_LOCKED", "ALREADY_JOINED", "NAME_INVALID", "NAME_TAKEN", "COLOR_TAKEN", "RESUME_INVALID",
  "KICKED", "REPLACED", "NOT_HOST", "WRONG_PHASE", "NOT_YOUR_TURN", "NOT_ALIVE", "INVALID_TARGET",
  "INVALID_SETTINGS", "NOT_ENOUGH_PLAYERS", "INVALID_ROLE_CONFIG", "NO_WORDS_AVAILABLE", "GUESS_INVALID",
  "RATE_LIMITED", "INTERNAL",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** §6.4: fatal errors are followed by a close with `closeCode`. RATE_LIMITED closes 4008 only after 3 strikes. */
export const ERROR_INFO: Record<ErrorCode, { fatal: boolean; closeCode: number | null }> = {
  BAD_MESSAGE: { fatal: false, closeCode: null },
  UNSUPPORTED_VERSION: { fatal: true, closeCode: 4002 },
  NOT_AUTHENTICATED: { fatal: false, closeCode: null },
  TV_AUTH_FAILED: { fatal: true, closeCode: 4003 },
  ROOM_NOT_FOUND: { fatal: true, closeCode: 4004 },
  ROOM_EXPIRED: { fatal: true, closeCode: 4010 },
  ROOM_FULL: { fatal: false, closeCode: null },
  ROOM_LOCKED: { fatal: false, closeCode: null },
  ALREADY_JOINED: { fatal: false, closeCode: null },
  NAME_INVALID: { fatal: false, closeCode: null },
  NAME_TAKEN: { fatal: false, closeCode: null },
  COLOR_TAKEN: { fatal: false, closeCode: null },
  RESUME_INVALID: { fatal: false, closeCode: null },
  KICKED: { fatal: true, closeCode: 4006 },
  REPLACED: { fatal: true, closeCode: 4005 },
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
  RATE_LIMITED: { fatal: false, closeCode: 4008 },
  INTERNAL: { fatal: false, closeCode: null },
};

/** Other close codes (§6.4). */
export const CLOSE_CODES = {
  BAD_CID: 4000,
  HELLO_TIMEOUT: 4001,
  UNSUPPORTED_VERSION: 4002,
  TV_AUTH_FAILED: 4003,
  ROOM_NOT_FOUND: 4004,
  REPLACED: 4005,
  KICKED: 4006,
  RATE_LIMITED: 4008,
  CAPACITY: 4009,
  ROOM_EXPIRED: 4010,
} as const;

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
