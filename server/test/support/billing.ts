// Billing test support: a node:sqlite-backed BillingStorage (the DO's SQLite API shape), sample Google resources,
// and helpers. node:sqlite is flag-free in Node 22.22 (it prints an ExperimentalWarning).
import { DatabaseSync } from "node:sqlite";
import { BillingCore, storeFromCore } from "../../src/billing/billing-core";
import type { BillingStorage, BillingStore, SqlValue } from "../../src/billing/billing-core";
import { billingPacks } from "../../src/billing/catalog-info";
import { GoogleHttpError } from "../../src/billing/google";
import type { CallOpts, GoogleApi } from "../../src/billing/google";
import type { ProductPurchaseV2, SubscriptionPurchaseV2, VoidedPurchasesListResponse } from "../../src/billing/google-types";
import { sha256hex } from "../../src/tokens";

export function sqliteStorage(): BillingStorage & { db: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  let depth = 0;
  return {
    db,
    sql: {
      exec<T extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]) {
        const stmt = db.prepare(query);
        const isRead = /^\s*(SELECT|WITH)\b/i.test(query);
        const rows = isRead ? (stmt.all(...bindings) as T[]) : (stmt.run(...bindings), [] as T[]);
        return { toArray: () => rows };
      },
    },
    transactionSync<T>(fn: () => T): T {
      // Nested calls join the outer transaction (as the DO's transactionSync would under one closure).
      if (depth > 0) return fn();
      db.exec("BEGIN");
      depth++;
      try {
        const out = fn();
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      } finally {
        depth--;
      }
    },
  };
}

export function newCore(): { core: BillingCore; store: BillingStore; storage: ReturnType<typeof sqliteStorage> } {
  const storage = sqliteStorage();
  const core = new BillingCore(storage, billingPacks().premiumIds);
  return { core, store: storeFromCore(core), storage };
}

export const DAY = 86_400_000;
export const NOW = 1_790_000_000_000;
export const iso = (ms: number): string => new Date(ms).toISOString();

export const INSTALL_A = "0123456789abcdef0123456789abcdef";
export const INSTALL_B = "fedcba9876543210fedcba9876543210";
export const hashOf = (s: string): Promise<string> => sha256hex(s);

/** A realistic-looking Play purchase token (~150 chars). */
export function playToken(seed: string): string {
  return `${seed}abcdefghijkl.AO-J1Oz${"x".repeat(60)}${seed}_QwErTy-${"9".repeat(40)}`.slice(0, 150);
}

export function sub(over: Partial<SubscriptionPurchaseV2> & { expiryMs?: number; autoRenew?: boolean; trial?: boolean; basePlanId?: string } = {}): SubscriptionPurchaseV2 {
  const { expiryMs, autoRenew, trial, basePlanId, ...rest } = over;
  return {
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    startTime: iso(NOW - DAY),
    lineItems: [{
      productId: "premium",
      expiryTime: iso(expiryMs ?? NOW + 30 * DAY),
      autoRenewingPlan: { autoRenewEnabled: autoRenew ?? true },
      offerDetails: { basePlanId: basePlanId ?? "monthly", ...(trial ? { offerId: "trial-7d" } : {}) },
      offerPhase: trial ? { freeTrial: {} } : {},
    }],
    ...rest,
  };
}

export function product(over: Partial<ProductPurchaseV2> & { productId?: string; state?: string } = {}): ProductPurchaseV2 {
  const { productId, state, ...rest } = over;
  return {
    purchaseStateContext: { purchaseState: state ?? "PURCHASED" },
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    purchaseCompletionTime: iso(NOW - 60_000),
    productLineItem: [{ productId: productId ?? "pack_en_food_01" }],
    ...rest,
  };
}

type Handler<T> = T | GoogleHttpError | ((token: string) => T | GoogleHttpError);

/** A scripted GoogleApi: per-token responses or errors, with a call log (tokens are recorded only here, in memory). */
export class ScriptedGoogle implements GoogleApi {
  subs = new Map<string, Handler<SubscriptionPurchaseV2>>();
  products = new Map<string, Handler<ProductPurchaseV2>>();
  ackError: GoogleHttpError | null = null;
  voidedPages: (VoidedPurchasesListResponse | GoogleHttpError)[] = [];
  calls: { op: string; token?: string; startTimeMs?: number; pageToken?: string | undefined; opts?: CallOpts }[] = [];
  acked = new Set<string>();

  #resolve<T>(h: Handler<T> | undefined, token: string, op: "sub_get" | "product_get"): T {
    if (h === undefined) throw new GoogleHttpError(404, op);
    const v = typeof h === "function" ? (h as (t: string) => T | GoogleHttpError)(token) : h;
    if (v instanceof GoogleHttpError) throw v;
    return structuredClone(v);
  }
  async getSubscriptionV2(token: string, opts: CallOpts): Promise<SubscriptionPurchaseV2> {
    this.calls.push({ op: "sub_get", token, opts });
    const r = this.#resolve(this.subs.get(token), token, "sub_get");
    if (this.acked.has(token)) r.acknowledgementState = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
    return r;
  }
  async getProductV2(token: string, opts: CallOpts): Promise<ProductPurchaseV2> {
    this.calls.push({ op: "product_get", token, opts });
    const r = this.#resolve(this.products.get(token), token, "product_get");
    if (this.acked.has(token)) r.acknowledgementState = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
    return r;
  }
  async ackSubscription(token: string, opts: CallOpts): Promise<void> {
    this.calls.push({ op: "sub_ack", token, opts });
    if (this.ackError) throw this.ackError;
    this.acked.add(token);
  }
  async ackProduct(productId: string, token: string, opts: CallOpts): Promise<void> {
    this.calls.push({ op: "product_ack", token, opts });
    void productId;
    if (this.ackError) throw this.ackError;
    this.acked.add(token);
  }
  async listVoided(q: { startTimeMs: number; pageToken?: string | undefined }, opts: CallOpts): Promise<VoidedPurchasesListResponse> {
    this.calls.push({ op: "voided_list", startTimeMs: q.startTimeMs, pageToken: q.pageToken, opts });
    const page = this.voidedPages.shift() ?? {};
    if (page instanceof GoogleHttpError) throw page;
    return page;
  }
  count(op: string): number {
    return this.calls.filter((c) => c.op === op).length;
  }
}
