// PAYMENTS-SPEC §4.4 / §5.2 view-driven billing effects of the TV mock: the downgrade and pool-exhausted toasts, the
// queued billing toast on the next LOBBY/RESULTS, the Store closing when the phase leaves LOBBY, and the §2.4 rule 1
// refreshes (load, page visible again).
import { useEffect, useRef } from "preact/hooks";
import type { TvView } from "@mishana/shared/protocol";
import { premiumEndedStep } from "../lib/premium";
import { billing } from "./billing";
import { closeShop, loadStoreCatalog } from "./shopState";
import { tvShop } from "./tvStore";
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

export function useBillingView(view: TvView | null): void {
  const prev = useRef<TvView | null>(null);
  const endedPending = useRef(false);
  const poolShownFor = useRef<string | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = view;
    if (!view || !billingEnabled.value) return;
    const sameRoom = p !== null && p.roomCode === view.roomCode;
    if (!sameRoom) endedPending.current = false;
    if (view.phase !== "LOBBY" && tvShop.value) closeShop();
    // Downgrade notice, once per flip (in LOBBY, or on the first LOBBY after the game). Never opens the Store.
    const ended = premiumEndedStep(endedPending.current, sameRoom ? p : null, view);
    endedPending.current = ended.pending;
    if (ended.show) billing.notify({ key: "lobby.premiumEnded", tone: "info" });
    // Free pool exhausted: once per room session.
    if (view.phase === "LOBBY" && view.poolExhausted && poolShownFor.current !== view.roomCode) {
      poolShownFor.current = view.roomCode;
      billing.notify({ key: "lobby.wordsRepeating", tone: "info" });
    }
    if (view.phase === "LOBBY" || view.phase === "RESULTS") billing.flushToasts();
  }, [view]);
}
