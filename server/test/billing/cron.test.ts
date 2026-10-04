// PAYMENTS-SPEC §3.8 / §7.2: scheduled() dispatch, voided purchases, ack retries and alerts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CRON_DAILY, CRON_HOURLY, runCron } from "../../src/billing/cron";
import { GoogleHttpError } from "../../src/billing/google";
import { normalizeProduct, normalizeSubscription } from "../../src/billing/normalize";
import { DAY, NOW, ScriptedGoogle, hashOf, newCore, product, sub } from "../support/billing";

const GOOGLE_ENV = { BILLING_MODE: "google", ALLOW_FAKE_BILLING: "0", PLAY_SERVICE_ACCOUNT_JSON: "{}" };
const logs: string[] = [];
beforeEach(() => {
  logs.length = 0;
  for (const m of ["log", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(" ")));
});
afterEach(() => vi.restoreAllMocks());
const codes = (): string[] => logs.map((l) => (JSON.parse(l) as { code: string }).code);

async function setup(now = NOW) {
  const { core, store } = newCore();
  const google = new ScriptedGoogle();
  const run = (cron: string, env: Record<string, string> = GOOGLE_ENV, t = now) => runCron(env as typeof GOOGLE_ENV, cron, { store, api: google, now: () => t });
  return { core, store, google, run };
}

describe("cron", () => {
  it("dispatches on controller.cron; fake env → prune only; fake without the guard → nothing", async () => {
    const { google, run } = await setup();
    await run("5 5 * * *");
    expect(google.calls).toEqual([]);
    await run(CRON_DAILY, { BILLING_MODE: "fake", ALLOW_FAKE_BILLING: "1", PLAY_SERVICE_ACCOUNT_JSON: "" });
    expect(google.calls).toEqual([]);
    await run(CRON_DAILY, { BILLING_MODE: "fake", ALLOW_FAKE_BILLING: "0", PLAY_SERVICE_ACCOUNT_JSON: "" });
    expect(google.calls).toEqual([]);
    expect(codes()).toContain("BILLING_NOT_CONFIGURED");
  });

  it("voided: window start = max(now − 30 d + 1 h, cursor − 1 d), cursor moves after the last page", async () => {
    const { core, google, run } = await setup();
    google.voidedPages = [{ voidedPurchases: [], tokenPagination: { nextPageToken: "p2" } }, { voidedPurchases: [] }];
    await run(CRON_DAILY);
    const lists = google.calls.filter((c) => c.op === "voided_list");
    expect(lists.map((c) => [c.startTimeMs, c.pageToken])).toEqual([[NOW - 30 * DAY + 3_600_000, undefined], [NOW - 30 * DAY + 3_600_000, "p2"]]);
    expect(core.cursorGet()).toBe(NOW);
    google.calls = [];
    google.voidedPages = [{}];
    await run(CRON_DAILY, GOOGLE_ENV, NOW + DAY);
    expect(google.calls.find((c) => c.op === "voided_list")?.startTimeMs).toBe(NOW - DAY); // cursor − 1 d
  });

  it("pack → revoke; sub → re-read only, never revoke; unknown + one-time premium pack → tombstone; unknown + 404 → skip", async () => {
    const { core, google, run } = await setup();
    const packH = await hashOf("pack-a");
    await core.applyPurchase({ tokenHash: packH, kind: "pack", productId: "pack_en_food_01", n: normalizeProduct(product(), NOW - DAY), callerInstallHash: "1".repeat(64), rawTokenForAck: "pack-a", nowMs: NOW - DAY });
    const subH = await hashOf("sub-a");
    await core.applyPurchase({ tokenHash: subH, kind: "sub", productId: "premium", n: normalizeSubscription(sub(), NOW - DAY), callerInstallHash: "1".repeat(64), rawTokenForAck: "sub-a", nowMs: NOW - DAY });
    google.subs.set("sub-a", sub({ acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" }));
    google.products.set("unknown-pack", product({ productId: "pack_lb_food_01" }));
    google.voidedPages = [{ voidedPurchases: [{ purchaseToken: "pack-a" }, { purchaseToken: "sub-a" }, { purchaseToken: "unknown-pack" }, { purchaseToken: "unknown-sub" }] }];
    await run(CRON_DAILY);
    expect(core.rowFor(packH)?.revoked).toBe(1);
    expect(core.rowFor(subH)?.revoked).toBe(0);
    expect(google.calls.filter((c) => c.op === "sub_get").map((c) => c.token)).toEqual(["sub-a"]);
    expect(core.rowFor(await hashOf("unknown-pack"))).toMatchObject({ revoked: 1, product_id: null });
    expect(core.rowFor(await hashOf("unknown-sub"))).toBeNull();
    expect(core.cursorGet()).toBe(NOW);
  });

  it("a 5xx while resolving an unknown hash stops paging without moving the cursor", async () => {
    const { core, google, run } = await setup();
    google.products.set("x", new GoogleHttpError(503, "product_get"));
    google.voidedPages = [{ voidedPurchases: [{ purchaseToken: "x" }], tokenPagination: { nextPageToken: "n" } }, {}];
    await run(CRON_DAILY);
    expect(core.cursorGet()).toBeNull();
    expect(google.count("voided_list")).toBe(1);
  });

  it("401/403 or a token-endpoint failure while resolving an unknown hash stops paging; the cursor does not move", async () => {
    for (const e of [new GoogleHttpError(403, "product_get"), new GoogleHttpError(401, "product_get"), new GoogleHttpError(503, "token"), new GoogleHttpError(400, "token")]) {
      const { core, google, run } = await setup();
      core.cursorSet(NOW - 2 * DAY);
      google.products.set("chargeback", e);
      google.voidedPages = [{ voidedPurchases: [{ purchaseToken: "chargeback" }] }];
      await run(CRON_DAILY);
      expect(core.cursorGet()).toBe(NOW - 2 * DAY);
      expect(core.rowFor(await hashOf("chargeback"))).toBeNull();
    }
  });

  it("hourly ack retries; BILLING_ACK_OVERDUE after 48 h; BILLING_SUB_STALE count (daily)", async () => {
    const { core, google, run } = await setup();
    const h1 = await hashOf("ack-1");
    await core.applyPurchase({ tokenHash: h1, kind: "pack", productId: "pack_en_food_01", n: normalizeProduct(product({ purchaseCompletionTime: new Date(NOW - 50 * 3_600_000).toISOString() }), NOW - 50 * 3_600_000), callerInstallHash: null, rawTokenForAck: "ack-1", nowMs: NOW - 50 * 3_600_000 });
    google.ackError = new GoogleHttpError(503, "product_ack");
    await run(CRON_HOURLY);
    expect(google.count("product_ack")).toBe(1);
    expect(codes()).toContain("BILLING_ACK_OVERDUE");
    google.ackError = null;
    await run(CRON_HOURLY);
    expect(core.rowFor(h1)).toMatchObject({ acknowledged: 1, ack_token: null });
    // Stale subscription: ACTIVE, expired 2 h ago, never re-read since.
    const h2 = await hashOf("stale");
    await core.applyPurchase({ tokenHash: h2, kind: "sub", productId: "premium", n: normalizeSubscription(sub({ expiryMs: NOW - 2 * 3_600_000, acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" }), NOW - DAY), callerInstallHash: null, rawTokenForAck: null, nowMs: NOW - DAY });
    google.voidedPages = [{}];
    logs.length = 0;
    await run(CRON_DAILY);
    expect(logs.map((l) => JSON.parse(l))).toContainEqual({ code: "BILLING_SUB_STALE", count: 1 });
  });
});
