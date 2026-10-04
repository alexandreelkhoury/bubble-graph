// DESIGN §2.2 / §5.3: role = colour + emblem + pattern + label. Emblems on a 48 grid, filled.
import type { Role } from "@mishana/shared/engine";
import { t } from "../i18n/t";
import { ROLE_KEY } from "../lib/keys";

export function RoleEmblem({ role, size = 32 }: { role: Role; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false" class={`emblem emblem--${role.toLowerCase()}`}>
      {role === "CIVILIAN" && <path fill="currentColor" fill-rule="evenodd" d="M24 6 42 20v22H29V30H19v12H6V20z" />}
      {role === "UNDERCOVER" && (
        <path fill="currentColor" fill-rule="evenodd"
          d="M3 19.5C3 14.8 7.5 12 13 12c4.8 0 7.6 2.6 11 2.6S30.2 12 35 12c5.5 0 10 2.8 10 7.5C45 28 39.8 35 33.5 35c-4.6 0-6.2-4.6-9.5-4.6S19.1 35 14.5 35C8.2 35 3 28 3 19.5zM9.5 22.2c1.9-3.6 8-3.9 10.4-.4-2.1 3.6-8.4 3.8-10.4.4zM28.1 21.8c2.4-3.5 8.5-3.2 10.4.4-2 3.4-8.3 3.2-10.4-.4z" />
      )}
      {role === "BLANK" && (
        <rect x="9" y="5" width="30" height="38" rx="5" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="6 5" />
      )}
    </svg>
  );
}

/** Emblem + label chip, e.g. "[house] Civilian". */
export function RoleChip({ role, size = 20 }: { role: Role; size?: number }) {
  return (
    <span class={`role-chip role-chip--${role.toLowerCase()}`}>
      <RoleEmblem role={role} size={size} />
      <span>{t(ROLE_KEY[role])}</span>
    </span>
  );
}
