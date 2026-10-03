import type { Role } from "@mishana/shared/engine";
import type { MessageKey } from "../i18n/t";

export const ROLE_KEY: Record<Role, MessageKey> = { CIVILIAN: "role.civilian", UNDERCOVER: "role.undercover", BLANK: "role.blank" };
export const ROLE_WAS_KEY: Record<Role, MessageKey> = { CIVILIAN: "elim.wasCivilian", UNDERCOVER: "elim.wasUndercover", BLANK: "elim.wasBlank" };
