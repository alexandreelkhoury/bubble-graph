// PAYMENTS-SPEC §3.8: scheduled(). Hourly: ack retries + overdue alert. Daily: voided purchases, prune.
import { ACK_OVERDUE_ALERT_MS } from "@mishana/shared/constants";
import { sha256hex } from "../tokens";
import type { BillingStore } from "./billing-core";
import { ackPurchase, GOOGLE_CALL_TIMEOUT_BACKGROUND_MS, GoogleHttpError } from "./google";
import type { GoogleApi } from "./google";
import { billingLog } from "./log";
import { fakeAllowedByEnv } from "./mode";
import type { BillingModeEnv } from "./mode";

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
    await deps.store.prune(deps.now());
  }
}

async function hourly(store: BillingStore, api: GoogleApi, now: () => number): Promise<void> {
  const rows = await store.pendingAcks(now());
  const o = { timeoutMs: GOOGLE_CALL_TIMEOUT_BACKGROUND_MS };
  let overdue = 0;
  for (const r of rows) {
    const res = await ackPurchase(api, store, r.productId, r.token, r.tokenHash, o);
    if (res === "kept" && r.windowStartMs < now() - ACK_OVERDUE_ALERT_MS) overdue++;
  }
  if (overdue > 0) billingLog("BILLING_ACK_OVERDUE", { count: overdue }, "error");
}

/**
 * Voided purchases since the cursor (the list asks for type=0, one-time products only: lifetime `premium` and the
 * packs). Each token is revoked (sticky), or tombstoned when never seen, with no Google re-read: every in-app product
 * of this package is one this app sells. A transient Google error stops paging without moving the cursor.
 */
async function voided(store: BillingStore, api: GoogleApi, now: () => number): Promise<void> {
  const t = now();
  const cursor = await store.cursorGet();
  const start = Math.max(t - 30 * DAY_MS + HOUR_MS, cursor === null ? -Infinity : cursor - DAY_MS);
  const o = { timeoutMs: GOOGLE_CALL_TIMEOUT_BACKGROUND_MS };
  let pageToken: string | undefined;
  try {
    for (let page = 0; page < MAX_VOIDED_PAGES; page++) {
      const res = await api.listVoided({ startTimeMs: start, pageToken }, o);
      for (const v of res.voidedPurchases ?? []) {
        if (typeof v.purchaseToken !== "string" || v.purchaseToken === "") continue;
        await store.markRevoked(await sha256hex(v.purchaseToken), now());
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
