// PAYMENTS-SPEC §3.10: FAKE billing for local dev and e2e. FakeGoogleApi serves synthetic Google resources from the
// Billing DO's `fake_purchases` table, so /verify, RTDN-style re-reads, acks and the ack window run unchanged.
// Reachable only when billingModeForRequest() says "fake" (mode.ts): never in production.
import { packIdFromProductId, PREMIUM_PRODUCT_ID, SUB_STATES } from "@mishana/shared/billing";
import type { FakePurchaseRequestBody, FakeSetRequestBody } from "@mishana/shared/billing";
import { sha256hex } from "../tokens";
import type { BillingStore } from "./billing-core";
import { billingPacks } from "./catalog-info";
import { GoogleHttpError } from "./google";
import type { GoogleApi } from "./google";
import type { ProductPurchaseV2, SubscriptionPurchaseV2, VoidedPurchasesListResponse } from "./google-types";
import { refreshProduct, refreshSubscription } from "./rtdn";

export { FAKE_ENTITLEMENT_KEY } from "./fake-key";

const DAY_MS = 86_400_000;

export interface FakeRecord {
  kind: "sub" | "pack";
  productId: string;
  installHash: string;
  basePlanId: "monthly" | "yearly" | null;
  offerId: string | null;
  state: string;             // sub: SUB_STATES; pack: PURCHASED | PENDING | CANCELLED
  completedMs: number | null; // startTime / purchaseCompletionTime; null while pending
  expiryMs: number | null;
  autoRenew: boolean;
  acknowledged: boolean;
}

const iso = (ms: number): string => new Date(ms).toISOString();

export class FakeGoogleApi implements GoogleApi {
  constructor(private readonly store: BillingStore, private readonly now: () => number) {}

  async #get(token: string, kind: "sub" | "pack", op: "sub_get" | "product_get"): Promise<FakeRecord> {
    const json = await this.store.fakeGet(token);
    const r = json ? (JSON.parse(json) as FakeRecord) : null;
    if (!r || r.kind !== kind) throw new GoogleHttpError(404, op);
    return r;
  }

  async getSubscriptionV2(token: string): Promise<SubscriptionPurchaseV2> {
    const r = await this.#get(token, "sub", "sub_get");
    return {
      subscriptionState: r.state,
      acknowledgementState: r.acknowledged ? "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" : "ACKNOWLEDGEMENT_STATE_PENDING",
      ...(r.completedMs !== null ? { startTime: iso(r.completedMs) } : {}),
      lineItems: [{
        productId: PREMIUM_PRODUCT_ID,
        ...(r.expiryMs !== null ? { expiryTime: iso(r.expiryMs) } : {}),
        autoRenewingPlan: { autoRenewEnabled: r.autoRenew },
        offerDetails: { basePlanId: r.basePlanId ?? "monthly", ...(r.offerId ? { offerId: r.offerId } : {}) },
        offerPhase: r.offerId === "trial-7d" ? { freeTrial: {} } : {},
      }],
      externalAccountIdentifiers: { obfuscatedExternalAccountId: r.installHash },
      testPurchase: {},
    };
  }

  async getProductV2(token: string): Promise<ProductPurchaseV2> {
    const r = await this.#get(token, "pack", "product_get");
    return {
      purchaseStateContext: { purchaseState: r.state },
      acknowledgementState: r.acknowledged ? "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" : "ACKNOWLEDGEMENT_STATE_PENDING",
      ...(r.completedMs !== null ? { purchaseCompletionTime: iso(r.completedMs) } : {}),
      productLineItem: [{ productId: r.productId }],
      obfuscatedExternalAccountId: r.installHash,
      testPurchaseContext: {},
    };
  }

  async #ack(token: string, kind: "sub" | "pack", op: "sub_ack" | "product_ack"): Promise<void> {
    const r = await this.#get(token, kind, op === "sub_ack" ? "sub_get" : "product_get");
    await this.store.fakePut(token, JSON.stringify({ ...r, acknowledged: true }));
  }
  ackSubscription(token: string): Promise<void> { return this.#ack(token, "sub", "sub_ack"); }
  ackProduct(_productId: string, token: string): Promise<void> { return this.#ack(token, "pack", "product_ack"); }
  async listVoided(): Promise<VoidedPurchasesListResponse> { return {}; }
}

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const badRequest = (): Response => jsonRes({ error: "BAD_REQUEST" }, 400);

/** POST /api/billing/fake/purchase → `{ purchaseToken: "fake.<kind>.<productId>.<n>" }`. */
export async function fakePurchase(body: FakePurchaseRequestBody, store: BillingStore, now: number): Promise<Response> {
  let kind: "sub" | "pack";
  if (body.productId === PREMIUM_PRODUCT_ID) kind = "sub";
  else {
    const packId = packIdFromProductId(body.productId);
    if (!packId || !billingPacks().premiumIds.has(packId)) return badRequest();
    kind = "pack";
  }
  const pending = body.outcome === "PENDING";
  const basePlanId = kind === "sub" ? (body.basePlanId ?? "monthly") : null;
  const rec: FakeRecord = {
    kind, productId: body.productId, installHash: await sha256hex(body.installId),
    basePlanId, offerId: kind === "sub" ? (body.offerId ?? null) : null,
    state: kind === "sub" ? (pending ? "SUBSCRIPTION_STATE_PENDING" : "SUBSCRIPTION_STATE_ACTIVE") : pending ? "PENDING" : "PURCHASED",
    completedMs: pending ? null : now,
    expiryMs: kind === "sub" ? now + (basePlanId === "yearly" ? 365 : 30) * DAY_MS : null,
    autoRenew: kind === "sub",
    acknowledged: false,
  };
  const token = `fake.${kind}.${body.productId}.${await store.fakeNext()}`;
  await store.fakePut(token, JSON.stringify(rec));
  return jsonRes({ purchaseToken: token });
}

/** POST /api/billing/fake/set → 204, then the same path as an RTDN for that token (markRevoked for REVOKED). */
export async function fakeSet(body: FakeSetRequestBody, store: BillingStore, now: () => number): Promise<Response> {
  const json = await store.fakeGet(body.purchaseToken);
  if (!json) return badRequest();
  const r = JSON.parse(json) as FakeRecord;
  const t = now();
  const isSubState = (SUB_STATES as readonly string[]).includes(body.state);
  if ((r.kind === "sub") !== isSubState) return badRequest();
  const next: FakeRecord = { ...r };
  if (r.kind === "sub") {
    next.state = body.state;
    if (body.state === "SUBSCRIPTION_STATE_EXPIRED") {
      next.expiryMs = t - 1000;
      next.autoRenew = false;
    } else if (body.state === "SUBSCRIPTION_STATE_CANCELED") {
      next.autoRenew = false;
    } else if (body.state === "SUBSCRIPTION_STATE_ACTIVE") {
      next.autoRenew = true;
      if (next.expiryMs === null || next.expiryMs <= t) next.expiryMs = t + (r.basePlanId === "yearly" ? 365 : 30) * DAY_MS;
    }
    if (next.completedMs === null && body.state !== "SUBSCRIPTION_STATE_PENDING") next.completedMs = t;
  } else {
    next.state = body.state === "REVOKED" ? "CANCELLED" : body.state;
    if (next.completedMs === null && body.state === "PURCHASED") next.completedMs = t;
  }
  await store.fakePut(body.purchaseToken, JSON.stringify(next));
  const api = new FakeGoogleApi(store, now);
  const c = { store, api, now, source: "fake" as const };
  if (r.kind === "sub") await refreshSubscription(c, body.purchaseToken);
  else {
    await refreshProduct(c, body.purchaseToken);
    if (body.state === "REVOKED") await store.markRevoked(await sha256hex(body.purchaseToken), t);
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
