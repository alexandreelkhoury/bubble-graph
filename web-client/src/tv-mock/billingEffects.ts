// PAYMENTS-SPEC §4.4 / §5.2 view-driven billing effects of the TV mock: the downgrade and pool-exhausted toasts, the
// queued billing toast outside a running game, the Store closing when a game starts, and the §2.4 rule 1 refreshes.
// JAMAA-PLATFORM §2.5: the pool-exhausted flag is Mish Ana!'s `room.setup.extras.poolExhausted`.
import { useEffect, useRef } from "preact/hooks";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { premiumEndedStep } from "../lib/premium";
import { billing } from "./billing";
import { closeShop, loadStoreCatalog } from "./shopState";
import { inRunningGame, tvShop } from "./tvStore";
import { billingEnabled } from "../lib/billingFlag";

/**
 * Boot: the catalog decides the mode, then a refresh; room creation waits for it at most `maxWaitMs`. With
 * BILLING_ENABLED off (lib/billingFlag.ts) nothing is fetched and the room is created at once.
 */
export async function bootBilling(maxWaitMs = 2500): Promise<void> {
  if (!billingEnabled.value) return;
  const boot = loadStoreCatalog().then(() => billing.refresh());
  await Promise.race([boot, new Promise((r) => setTimeout(r, maxWaitMs))]);
}

export function useBillingVisibility(): void {
  useEffect(() => {
    const on = (): void => { if (document.visibilityState === "visible" && billingEnabled.value) void billing.refresh(); };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
}

/** Mish Ana!'s free word pool is exhausted (setup extras, §2.5). */
export function poolExhausted(v: TvRoomView): boolean {
  const s = v.room.setup;
  return s?.gameId === "mishana" && s.extras.gameId === "mishana" && s.extras.poolExhausted;
}

export function useBillingView(view: TvRoomView | null): void {
  const prev = useRef<TvRoomView | null>(null);
  const endedPending = useRef(false);
  const poolShownFor = useRef<string | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = view;
    if (!view || !billingEnabled.value) return;
    const sameRoom = p !== null && p.room.roomCode === view.room.roomCode;
    if (!sameRoom) endedPending.current = false;
    if (inRunningGame(view) && tvShop.value) closeShop();
    // Downgrade notice, once per flip (outside a game, or on the first HUB/SETUP after it). Never opens the Store.
    const ended = premiumEndedStep(endedPending.current, sameRoom ? p.room : null, view.room);
    endedPending.current = ended.pending;
    if (ended.show) billing.notify({ key: "pass.ended", tone: "info" });
    // Free pool exhausted: once per room session.
    if (view.room.phase === "SETUP" && poolExhausted(view) && poolShownFor.current !== view.room.roomCode) {
      poolShownFor.current = view.room.roomCode;
      billing.notify({ key: "game.mishana.wordsRepeatingPass", tone: "info" });
    }
    if (!inRunningGame(view)) billing.flushToasts();
  }, [view]);
}
