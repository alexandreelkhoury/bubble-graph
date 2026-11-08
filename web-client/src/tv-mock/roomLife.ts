// TV room lifetime helpers: TV-13e (SPEC §7.5 / §9.8) re-creation and the Settings → About install id (PAYMENTS-SPEC §3.12).
import { CLOSE_CODES } from "@jamaa/shared/constants";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";

type LifeView = { room: Pick<TvRoomView["room"], "phase">; game: Pick<NonNullable<TvRoomView["game"]>, "over"> | null };

/**
 * ROOM_EXPIRED (4010) or ROOM_NOT_FOUND (4004) outside a running game (HUB, SETUP, a finished game, or no view yet) →
 * re-create the room and toast `tv.newCode`; a running game and every other fatal code keep the Fatal screen.
 */
export function recreatesRoomOnFatal(code: number, view: LifeView | null): boolean {
  if (code !== CLOSE_CODES.ROOM_EXPIRED && code !== CLOSE_CODES.ROOM_NOT_FOUND) return false;
  return view === null || view.room.phase !== "PLAYING" || (view.game?.over ?? false);
}

/** Settings → About: the install id in eight groups of four ("0123 4567 …"), as the TV app shows it. */
export function displayInstallId(id: string): string {
  return id.replace(/(.{4})(?=.)/g, "$1 ");
}
