// JAMAA-PLATFORM §2.2: this game's own error codes (never fatal, no close code), merged into ErrorCode by
// protocol/errors.ts. Each `messageKey` is "error." + lowerCamel(code), in this game's i18n file.
// Mish Ana!'s codes (NOT_YOUR_TURN, NOT_ALIVE, GUESS_INVALID, INVALID_ROLE_CONFIG…) predate the platform and stay platform codes.
export const ERRORS = [] as const;
