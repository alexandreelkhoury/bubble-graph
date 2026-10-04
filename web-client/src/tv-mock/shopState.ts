// PAYMENTS-SPEC §4.4 / §5.2: opening and closing the mock Store overlay (LOBBY only), remembering what opened it.
import { billing } from "./billing";
import type { StoreEntry } from "./billing/model";
import { refocus } from "./dpad";
import { tvShop, tvView } from "./tvStore";
import { billingEnabled } from "../lib/billingFlag";

let opener: Element | null = null;
/** Bounds the catalog fetch while the Store shows "Loading" (§4.4: 10 s → unavailable). */
export const STORE_LOAD_TIMEOUT_MS = 10_000;

/** Loads (or reloads) the catalog; a fetch that hangs past the timeout counts as unavailable. */
export async function loadStoreCatalog(): Promise<void> {
  billing.mode.value = "unknown";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((r) => { timer = setTimeout(() => r(false), STORE_LOAD_TIMEOUT_MS); });
  const ok = await Promise.race([billing.loadCatalog(), timeout]);
  clearTimeout(timer);
  if (!ok && billing.mode.value === "unknown") billing.mode.value = "error";
}

export function openShop(entry: StoreEntry): void {
  if (tvView.value?.phase !== "LOBBY" || !billingEnabled.value) return;
  opener = document.activeElement;
  tvShop.value = entry;
  billing.setStoreVisible(true);
  const m = billing.mode.value;
  if (m === "error" || m === "unknown") void loadStoreCatalog().then(() => billing.refresh());
  else void billing.refresh(); // §2.4 rule 4: refresh when the Store opens
}

export function closeShop(): void {
  if (tvShop.value === null) return;
  tvShop.value = null;
  billing.setStoreVisible(false);
  refocus(opener);
}
