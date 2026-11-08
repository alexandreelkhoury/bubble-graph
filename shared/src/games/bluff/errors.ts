// JAMAA-PLATFORM §2.2: Bluff's own error codes (never fatal, no close code), merged into ErrorCode by
// protocol/errors.ts. Each `messageKey` is "error." + lowerCamel(code), in shared/i18n/games/bluff/<locale>.json.
// GAME-BLUFF §5.1 (CANNOT_VOTE_SPOT_ON is the draft-3 addition). Platform codes used as well: WRONG_PHASE, NOT_HOST,
// INVALID_TARGET, NOT_IN_GAME, GAME_FULL, ALREADY_JOINED, NOT_ENOUGH_PLAYERS, NO_CONTENT_AVAILABLE, BAD_MESSAGE.
export const ERRORS = [
  "LIE_EMPTY", "LIE_TOO_LONG", "LIE_TOO_CLOSE", "LIE_WRONG_SCRIPT", "LIE_BLOCKED_WORD", "TOO_MANY_EDITS",
  "CANNOT_VOTE_OWN", "CANNOT_VOTE_SPOT_ON", "CANNOT_HIDE", "STALE_PROMPT",
] as const;
