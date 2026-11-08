// JAMAA-PLATFORM §2.2: this game's own error codes (never fatal, no close code), merged into ErrorCode by
// protocol/errors.ts. Each `messageKey` is "error." + lowerCamel(code), in this game's i18n file (`error.staleCard`).
// GAME-LIKELY §13.1 also names INVALID_TARGET: it is already a platform code (Mish Ana!'s votes use it), so it is not
// repeated here (a duplicate across lists fails the platform test). WRONG_PHASE / NOT_HOST are platform codes too.
export const ERRORS = ["STALE_CARD"] as const;
