// PAYMENTS-SPEC §3.8 / §7.2: scheduled() dispatch, voided purchases, ack retries and alerts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CRON_DAILY, CRON_HOURLY, runCron } from "../../src/billing/cron";
import { GoogleHttpError } from "../../src/billing/google";
import { normalizeProduct } from "../../src/billing/normalize";
import { DAY, NOW, ScriptedGoogle, hashOf, newCore, product } from "../support/billing";

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

  it("voided premium and packs → sticky revoke; unknown tokens → tombstone, with no Google re-read", async () => {
    const { core, google, run } = await setup();
    const inst = "1".repeat(64);
    const packH = await hashOf("pack-a");
    core.applyPurchase({ tokenHash: packH, productId: "pack_en_food_01", n: normalizeProduct(product(), NOW - DAY), callerInstallHash: inst, rawTokenForAck: "pack-a", nowMs: NOW - DAY });
    const premH = await hashOf("premium-a");
    core.applyPurchase({ tokenHash: premH, productId: "premium", n: normalizeProduct(product({ productId: "premium" }), NOW - DAY), callerInstallHash: inst, rawTokenForAck: "premium-a", nowMs: NOW - DAY });
    expect(core.entitlementFor(inst, NOW)).toMatchObject({ packs: ["en-food-01"] });
    expect(core.entitlementFor(inst, NOW).premiumUntilMs).not.toBeNull();
    google.voidedPages = [{ voidedPurchases: [{ purchaseToken: "pack-a" }, { purchaseToken: "premium-a" }, { purchaseToken: "unknown" }, {}] }];
    await run(CRON_DAILY);
    expect(core.rowFor(packH)?.revoked).toBe(1);
    expect(core.rowFor(premH)?.revoked).toBe(1);
    expect(core.entitlementFor(inst, NOW)).toEqual({ premiumUntilMs: null, packs: [] });
    expect(core.rowFor(await hashOf("unknown"))).toMatchObject({ revoked: 1, product_id: null });
    expect(google.count("product_get")).toBe(0);
    expect(core.cursorGet()).toBe(NOW);
  });

  it("a 5xx or auth failure on the voided list stops paging without moving the cursor", async () => {
    for (const e of [new GoogleHttpError(503, "voided_list"), new GoogleHttpError(403, "voided_list"), new GoogleHttpError(503, "token")]) {
      const { core, google, run } = await setup();
      core.cursorSet(NOW - 2 * DAY);
      google.voidedPages = [{ voidedPurchases: [{ purchaseToken: "a" }], tokenPagination: { nextPageToken: "n" } }, e];
      await run(CRON_DAILY);
      expect(core.cursorGet()).toBe(NOW - 2 * DAY);
      expect(google.count("voided_list")).toBe(2);
      expect(codes()).toContain("BILLING_UPSTREAM");
    }
  });

  it("hourly ack retries; BILLING_ACK_OVERDUE after 48 h", async () => {
    const { core, google, run } = await setup();
    const h1 = await hashOf("ack-1");
    core.applyPurchase({ tokenHash: h1, productId: "pack_en_food_01", n: normalizeProduct(product({ purchaseCompletionTime: new Date(NOW - 50 * 3_600_000).toISOString() }), NOW - 50 * 3_600_000), callerInstallHash: null, rawTokenForAck: "ack-1", nowMs: NOW - 50 * 3_600_000 });
    google.ackError = new GoogleHttpError(503, "product_ack");
    await run(CRON_HOURLY);
    expect(google.count("product_ack")).toBe(1);
    expect(codes()).toContain("BILLING_ACK_OVERDUE");
    google.ackError = null;
    await run(CRON_HOURLY);
    expect(core.rowFor(h1)).toMatchObject({ acknowledged: 1, ack_token: null });
  });
});
