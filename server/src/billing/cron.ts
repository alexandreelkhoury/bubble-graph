// PAYMENTS-SPEC §3.8: scheduled(). Hourly: ack retries + overdue alert. Daily: voided purchases, stale-sub alert, prune.
import { ACK_OVERDUE_ALERT_MS } from "@mishana/shared/constants";
import { packIdFromProductId } from "@mishana/shared/billing";
import { sha256hex } from "../tokens";
import type { BillingStore } from "./billing-core";
import { billingPacks } from "./catalog-info";
import { ackPurchase, GOOGLE_CALL_TIMEOUT_BACKGROUND_MS, GoogleHttpError } from "./google";
import type { GoogleApi } from "./google";
import { billingLog } from "./log";
import { fakeAllowedByEnv } from "./mode";
import type { BillingModeEnv } from "./mode";
import { isGone, refreshSubscription } from "./rtdn";

export const CRON_HOURLY = "23 * * * *";
export const CRON_DAILY = "17 3 * * *";
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MAX_VOIDED_PAGES = 50;

export interface CronDeps { store: BillingStore; api: GoogleApi | null; now: () => number }

export async function runCron(env: BillingModeEnv, cron: string, deps: CronDeps): Promise<void> {
  const now = deps.now();
  if (fakeAllowedByEnv(env)) {
    await deps.store.prune(now);
    return;
  }
  if (env.BILLING_MODE !== "google" || !deps.api) {
    billingLog("BILLING_NOT_CONFIGURED", { op: "cron" }, "error");
    if (env.BILLING_MODE === "google") await deps.store.prune(now);
    return;
  }
  const api = deps.api;
  if (cron === CRON_HOURLY) {
    await hourly(deps.store, api, deps.now);
  } else if (cron === CRON_DAILY) {
    await voided(deps.store, api, deps.now);
    const stale = await deps.store.staleSubs(deps.now());
    if (stale > 0) billingLog("BILLING_SUB_STALE", { count: stale }, "warn");
    await deps.store.prune(deps.now());
  }
}

async function hourly(store: BillingStore, api: GoogleApi, now: () => number): Promise<void> {
  const rows = await store.pendingAcks(now());
  const o = { timeoutMs: GOOGLE_CALL_TIMEOUT_BACKGROUND_MS };
  let overdue = 0;
  for (const r of rows) {
    const res = await ackPurchase(api, store, r.kind, r.productId, r.token, r.tokenHash, o);
    if (res === "kept" && r.windowStartMs < now() - ACK_OVERDUE_ALERT_MS) overdue++;
  }
  if (overdue > 0) billingLog("BILLING_ACK_OVERDUE", { count: overdue }, "error");
}

/** Voided purchases since the cursor. A transient Google error stops paging without moving the cursor. */
async function voided(store: BillingStore, api: GoogleApi, now: () => number): Promise<void> {
  const t = now();
  const cursor = await store.cursorGet();
  const start = Math.max(t - 30 * DAY_MS + HOUR_MS, cursor === null ? -Infinity : cursor - DAY_MS);
  const o = { timeoutMs: GOOGLE_CALL_TIMEOUT_BACKGROUND_MS };
  const c = { store, api, now, opts: o };
  let pageToken: string | undefined;
  try {
    for (let page = 0; page < MAX_VOIDED_PAGES; page++) {
      const res = await api.listVoided({ startTimeMs: start, pageToken }, o);
      for (const v of res.voidedPurchases ?? []) {
        if (typeof v.purchaseToken !== "string" || v.purchaseToken === "") continue;
        const h = await sha256hex(v.purchaseToken);
        const kind = await store.kindOf(h);
        if (kind === "pack") {
          await store.markRevoked(h, now());
        } else if (kind === "sub") {
          await refreshSubscription(c, v.purchaseToken); // never markRevoked a subscription
        } else {
          // Unknown hash: VoidedPurchase has no product type. A one-time token of a premium pack → tombstone.
          try {
            const p = await api.getProductV2(v.purchaseToken, o);
            const id = packIdFromProductId(p.productLineItem?.[0]?.productId ?? "");
            if (id && billingPacks().premiumIds.has(id)) await store.markRevoked(h, now());
          } catch (e) {
            // [VERIFY] productsv2 answers 404/410 for a subscription token (§3.8). Only the purchases API's own
            // 400/404/410 means "skip"; 401/403, token-endpoint failures, 429 and 5xx stop paging without moving
            // the cursor, so a voided pack is never skipped during an auth outage.
            if (isGone(e)) continue;
            throw e;
          }
        }
      }
      pageToken = res.tokenPagination?.nextPageToken;
      if (!pageToken) {
        await store.cursorSet(t);
        return;
      }
    }
    // PAY-GAP: more than MAX_VOIDED_PAGES pages in one run: keep the cursor so the next run resumes from it.
  } catch (e) {
    billingLog("BILLING_UPSTREAM", { op: "voided_list", status: e instanceof GoogleHttpError ? e.status : 0 }, "warn");
  }
}
