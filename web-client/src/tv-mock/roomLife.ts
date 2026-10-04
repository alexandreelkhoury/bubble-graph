// TV room lifetime helpers: TV-13e (SPEC §7.5 / §9.8) re-creation and the Settings → About install id (PAYMENTS-SPEC §3.12).
import { CLOSE_CODES } from "@mishana/shared/constants";
import type { TvView } from "@mishana/shared/protocol";

/**
 * ROOM_EXPIRED (4010) or ROOM_NOT_FOUND (4004) while the TV shows LOBBY or RESULTS (or no view yet) → re-create the
 * room and toast `tv.newCode`; in-game phases and every other fatal code keep the Fatal screen.
 */
export function recreatesRoomOnFatal(code: number, view: Pick<TvView, "phase"> | null): boolean {
  if (code !== CLOSE_CODES.ROOM_EXPIRED && code !== CLOSE_CODES.ROOM_NOT_FOUND) return false;
  return view === null || view.phase === "LOBBY" || view.phase === "RESULTS";
}

/** Settings → About: the install id in eight groups of four ("0123 4567 …"), as the TV app shows it. */
export function displayInstallId(id: string): string {
  return id.replace(/(.{4})(?=.)/g, "$1 ");
}
