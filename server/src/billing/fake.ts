// PAYMENTS-SPEC §3.10: FAKE billing for local dev and e2e. FakeGoogleApi serves synthetic Google one-time purchases
// (lifetime `premium` and the packs) from the Billing DO's `fake_purchases` table, so /verify, RTDN-style re-reads,
// acks and the ack window run unchanged. Reachable only when billingModeForRequest() says "fake" (mode.ts): never in production.
import type { FakePurchaseRequestBody, FakeSetRequestBody, PurchaseState } from "@mishana/shared/billing";
import { sha256hex } from "../tokens";
import type { BillingStore } from "./billing-core";
import { isSoldProductId } from "./catalog-info";
import { GoogleHttpError } from "./google";
import type { GoogleApi } from "./google";
import type { ProductPurchaseV2, VoidedPurchasesListResponse } from "./google-types";
import { refreshProduct } from "./rtdn";

export { FAKE_ENTITLEMENT_KEY } from "./fake-key";

export interface FakeRecord {
  productId: string;
  installHash: string;
  state: PurchaseState;
  completedMs: number | null; // purchaseCompletionTime; null while pending
  acknowledged: boolean;
}

const iso = (ms: number): string => new Date(ms).toISOString();

export class FakeGoogleApi implements GoogleApi {
  constructor(private readonly store: BillingStore, private readonly now: () => number) {}

  async #get(token: string): Promise<FakeRecord> {
    const json = await this.store.fakeGet(token);
    if (!json) throw new GoogleHttpError(404, "product_get");
    return JSON.parse(json) as FakeRecord;
  }

  async getProductV2(token: string): Promise<ProductPurchaseV2> {
    const r = await this.#get(token);
    return {
      purchaseStateContext: { purchaseState: r.state },
      acknowledgementState: r.acknowledged ? "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" : "ACKNOWLEDGEMENT_STATE_PENDING",
      ...(r.completedMs !== null ? { purchaseCompletionTime: iso(r.completedMs) } : {}),
      productLineItem: [{ productId: r.productId }],
      obfuscatedExternalAccountId: r.installHash,
      testPurchaseContext: {},
    };
  }

  async ackProduct(_productId: string, token: string): Promise<void> {
    const r = await this.#get(token);
    await this.store.fakePut(token, JSON.stringify({ ...r, acknowledged: true }));
  }

  async listVoided(): Promise<VoidedPurchasesListResponse> { return {}; }
}

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const badRequest = (): Response => jsonRes({ error: "BAD_REQUEST" }, 400);

/** POST /api/billing/fake/purchase → `{ purchaseToken: "fake.<productId>.<n>" }` (`premium` or a premium pack). */
export async function fakePurchase(body: FakePurchaseRequestBody, store: BillingStore, now: number): Promise<Response> {
  if (!isSoldProductId(body.productId)) return badRequest();
  const pending = body.outcome === "PENDING";
  const rec: FakeRecord = {
    productId: body.productId, installHash: await sha256hex(body.installId),
    state: pending ? "PENDING" : "PURCHASED", completedMs: pending ? null : now, acknowledged: false,
  };
  const token = `fake.${body.productId}.${await store.fakeNext()}`;
  await store.fakePut(token, JSON.stringify(rec));
  return jsonRes({ purchaseToken: token });
}

/** POST /api/billing/fake/set → 204, then the same path as an RTDN for that token (markRevoked for REVOKED). */
export async function fakeSet(body: FakeSetRequestBody, store: BillingStore, now: () => number): Promise<Response> {
  const json = await store.fakeGet(body.purchaseToken);
  if (!json) return badRequest();
  const r = JSON.parse(json) as FakeRecord;
  const t = now();
  const next: FakeRecord = { ...r, state: body.state === "REVOKED" ? "CANCELLED" : body.state };
  if (next.completedMs === null && body.state === "PURCHASED") next.completedMs = t;
  await store.fakePut(body.purchaseToken, JSON.stringify(next));
  await refreshProduct({ store, api: new FakeGoogleApi(store, now), now, source: "fake" }, body.purchaseToken);
  if (body.state === "REVOKED") await store.markRevoked(await sha256hex(body.purchaseToken), t);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
