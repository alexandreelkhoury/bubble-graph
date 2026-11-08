// JAMAA-PLATFORM §2.2 / §2.12, GAME-TRIVIA §13.1: Trivia's own error codes (never fatal, no close code), merged into
// ErrorCode by protocol/errors.ts. Each `messageKey` is "error." + lowerCamel(code), in this game's i18n file
// (`error.answerInvalid`, `error.alreadyAnswered`). WRONG_PHASE, NOT_HOST, NOT_IN_GAME, NOT_ENOUGH_PLAYERS and
// NO_CONTENT_AVAILABLE are platform codes.
export const ERRORS = ["ANSWER_INVALID", "ALREADY_ANSWERED"] as const;
export type TriviaErrorCode = (typeof ERRORS)[number];
