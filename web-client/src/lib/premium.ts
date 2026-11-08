// PAYMENTS-SPEC §5.1 / JAMAA-PLATFORM §4: what clients show about a room's JAMAA Pass state. Pure, zod-free.
// The phone never sells: locked packs are rows with "Unlock on the TV", never a buy button, a price or a product id.
import type { Locale } from "@jamaa/shared/constants";
import type { LockedPackInfoV2, RoomPublic } from "@jamaa/shared/protocol/v2";

/** One locked-pack row on the phone: exactly what it renders, nothing it could sell with. */
export interface LockedPackRow { id: string; title: string; pairCount: number; trailingKey: "settings.unlockOnTv" }

export function lockedPackRows(packs: readonly LockedPackInfoV2[], l: Locale): LockedPackRow[] {
  return packs.map((p) => ({ id: p.id, title: p.title[l] ?? p.title.en, pairCount: p.pairCount, trailingKey: "settings.unlockOnTv" }));
}

type FlipView = Pick<RoomPublic, "premium" | "phase">;

/**
 * §4.4 / §5.1 downgrade notice, once per flip: premium true → false shows the notice at once outside a game (HUB or
 * SETUP), otherwise on the first HUB/SETUP after the game. `pending` carries a mid-game flip; a re-upgrade cancels it.
 */
export function premiumEndedStep(pending: boolean, prev: FlipView | null, next: FlipView): { show: boolean; pending: boolean } {
  if (next.premium) return { show: false, pending: false };
  const flipped = prev !== null && prev.premium;
  if (!flipped && !pending) return { show: false, pending: false };
  return next.phase !== "PLAYING" ? { show: true, pending: false } : { show: false, pending: true };
}

/** §5.1: the VIP's Start stays enabled while the TV is in the store, with the `error.tvBusy` hint under it. */
export function tvBusyHint(room: Pick<RoomPublic, "tvBusy" | "phase">, isVip: boolean): boolean {
  return isVip && room.phase === "SETUP" && room.tvBusy;
}
