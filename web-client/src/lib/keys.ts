// Enum → message-key maps shared by the phone and the TV mock.
import type { Phase, Role } from "@mishana/shared/engine";
import type { MessageKey } from "../i18n/t";

export const ROLE_KEY: Record<Role, MessageKey> = { CIVILIAN: "role.civilian", UNDERCOVER: "role.undercover", BLANK: "role.blank" };
export const ROLE_WAS_KEY: Record<Role, MessageKey> = { CIVILIAN: "elim.wasCivilian", UNDERCOVER: "elim.wasUndercover", BLANK: "elim.wasBlank" };

export const PHASE_KEY: Record<Phase, MessageKey> = {
  LOBBY: "phase.lobby",
  ROLE_REVEAL: "phase.roleReveal",
  CLUES: "phase.clues",
  VOTING: "phase.voting",
  TIE_BREAK: "phase.tieBreak",
  ELIMINATION: "phase.elimination",
  MR_WHITE_GUESS: "phase.mrWhiteGuess",
  RESULTS: "phase.results",
};
