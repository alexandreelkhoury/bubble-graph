// PAYMENTS-SPEC §5.1: what the phone shows about a room's premium state. Pure, zod-free (main bundle).
// The phone never sells: locked packs are rows with "Unlock on the TV", never a buy button, a price or a product id.
import { PREMIUM_SETTING_KEYS } from "@mishana/shared/billing/products";
import type { Locale } from "@mishana/shared/constants";
import type { Phase, Settings } from "@mishana/shared/engine";
import type { LockedPackInfo, PublicView } from "@mishana/shared/protocol";

/** One locked-pack row on the phone: exactly what it renders, nothing it could sell with. */
export interface LockedPackRow { id: string; title: string; pairCount: number; trailingKey: "settings.unlockOnTv" }

export function lockedPackRows(packs: readonly LockedPackInfo[], l: Locale): LockedPackRow[] {
  return packs.map((p) => ({ id: p.id, title: p.title[l], pairCount: p.pairCount, trailingKey: "settings.unlockOnTv" }));
}

/** §1.6: a premium-only setting is locked in a room without premium. */
export function settingLocked(view: Pick<PublicView, "premium">, key: keyof Settings): boolean {
  return !view.premium && (PREMIUM_SETTING_KEYS as readonly string[]).includes(key);
}

type FlipView = Pick<PublicView, "premium"> & { phase: Phase };

/**
 * §4.4 / §5.1 downgrade notice, once per flip: premium true → false shows the notice at once in LOBBY, otherwise on
 * the first LOBBY after the game. `pending` carries a flip that happened mid-game; a re-upgrade cancels it.
 */
export function premiumEndedStep(pending: boolean, prev: FlipView | null, next: FlipView): { show: boolean; pending: boolean } {
  if (next.premium) return { show: false, pending: false };
  const flipped = prev !== null && prev.premium;
  if (!flipped && !pending) return { show: false, pending: false };
  return next.phase === "LOBBY" ? { show: true, pending: false } : { show: false, pending: true };
}

/** §5.1: the VIP's Start stays enabled while the TV is in the store, with the `error.tvBusy` hint under it. */
export function tvBusyHint(view: Pick<PublicView, "tvBusy"> & { phase: Phase }, isVip: boolean): boolean {
  return isVip && view.phase === "LOBBY" && view.tvBusy;
}
