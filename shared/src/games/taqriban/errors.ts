// JAMAA-PLATFORM §2.2: Taqriban's own error codes (never fatal, no close code), merged into ErrorCode by
// protocol/errors.ts. Each `messageKey` is "error." + lowerCamel(code), in this game's i18n file. WRONG_PHASE,
// NOT_HOST, NOT_IN_GAME and NO_CONTENT_AVAILABLE are platform codes (a duplicate fails the platform test).
export const ERRORS = ["ALREADY_GUESSED", "STALE_QUESTION", "VALUE_INVALID"] as const;
