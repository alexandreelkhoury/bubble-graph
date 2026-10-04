// PAYMENTS-SPEC §3.5 / §7.2: BillingCore against real SQLite (node:sqlite).
import { describe, expect, it } from "vitest";
import { INSTALL_ACTIVE_WINDOW_MS, RATE_MAP_MAX_ENTRIES } from "@mishana/shared/constants";
import { SILENT_GRACE_MS } from "@mishana/shared/billing";
import type { ApplyInput } from "../../src/billing/billing-core";
import { normalizeProduct, normalizeSubscription } from "../../src/billing/normalize";
import { DAY, NOW, hashOf, iso, newCore, product, sub } from "../support/billing";

const H = (c: string): string => c.repeat(64).slice(0, 64); // fake 64-hex hashes
const INST = (i: number): string => i.toString(16).padStart(64, "0");

function subInput(tokenHash: string, s = sub(), caller: string | null = INST(1), checkedMs = NOW, raw: string | null = "raw-" + tokenHash.slice(0, 6)): ApplyInput {
  return { tokenHash, kind: "sub", productId: "premium", n: normalizeSubscription(s, checkedMs), callerInstallHash: caller, rawTokenForAck: raw, nowMs: checkedMs };
}
function packInput(tokenHash: string, p = product(), caller: string | null = INST(1), checkedMs = NOW): ApplyInput {
  return { tokenHash, kind: "pack", productId: "pack_en_food_01", n: normalizeProduct(p, checkedMs), callerInstallHash: caller, rawTokenForAck: "raw-" + tokenHash.slice(0, 6), nowMs: checkedMs };
}

describe("applyPurchase / bindings", () => {
  it("binds the caller, returns OK and ackDue; entitlement reflects it", async () => {
    const { core } = newCore();
    const r = await core.applyPurchase(subInput(H("a")));
    expect(r).toEqual({ result: "OK", ackDue: true, refreshLinked: false });
    const e = core.entitlementFor(INST(1), NOW);
    expect(e.premiumUntilMs).toBe(NOW + 30 * DAY + SILENT_GRACE_MS);
    expect(e.subscription).toMatchObject({ state: "SUBSCRIPTION_STATE_ACTIVE", basePlanId: "monthly", autoRenewing: true });
    const row = core.rowFor(H("a"));
    expect(row?.ack_token).toBe("raw-aaaaaa");
    core.markAcked(H("a"));
    expect(core.rowFor(H("a"))).toMatchObject({ acknowledged: 1, ack_token: null });
  });

  it("INSTALL_LIMIT at the 11th active binding, the row is still stored and ackDue still returned", async () => {
    const { core } = newCore();
    for (let i = 1; i <= 10; i++) expect((await core.applyPurchase(subInput(H("b"), sub(), INST(i)))).result).toBe("OK");
    const r = await core.applyPurchase(subInput(H("b"), sub(), INST(11)));
    expect(r).toEqual({ result: "INSTALL_LIMIT", ackDue: true, refreshLinked: false });
    expect(core.entitlementFor(INST(11), NOW).premiumUntilMs).toBeNull();
    // An existing install keeps refreshing fine.
    expect((await core.applyPurchase(subInput(H("b"), sub(), INST(3)))).result).toBe("OK");
  });

  it("a binding older than 30 days gives no access and its slot is reusable", async () => {
    const { core } = newCore();
    for (let i = 1; i <= 10; i++) await core.applyPurchase(subInput(H("c"), sub({ expiryMs: NOW + 90 * DAY }), INST(i)));
    const later = NOW + INSTALL_ACTIVE_WINDOW_MS + 1000;
    expect(core.entitlementFor(INST(1), later).premiumUntilMs).toBeNull();
    // Install 11 can now bind (the 10 old ones are inactive).
    expect(core.bindOnly({ tokenHash: H("c"), callerInstallHash: INST(11), nowMs: later })).toBe("OK");
    expect(core.entitlementFor(INST(11), later).premiumUntilMs).not.toBeNull();
  });

  it("entitlementFor never refreshes last_seen_ms", async () => {
    const { core } = newCore();
    await core.applyPurchase(subInput(H("d")));
    const before = core.bindingsFor(H("d"));
    core.entitlementFor(INST(1), NOW + DAY);
    expect(core.bindingsFor(H("d"))).toEqual(before);
  });

  it("a stale checkedMs never overwrites a newer read; stale ACTIVE after stored EXPIRED → NOT_OWNED, no new binding", async () => {
    const { core } = newCore();
    await core.applyPurchase(subInput(H("e"), sub({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", expiryMs: NOW - 1000 }), INST(1), NOW + 5000));
    const r = await core.applyPurchase(subInput(H("e"), sub(), INST(2), NOW + 1000));
    expect(r.result).toBe("NOT_OWNED");
    expect(core.rowFor(H("e"))?.state).toBe("SUBSCRIPTION_STATE_EXPIRED");
    expect(core.bindingsFor(H("e")).map((b) => b.install_hash)).toEqual([]);
  });

  it("revoke is sticky: verify after revoke → REVOKED; a stale or fresh PURCHASED read cannot clear it", async () => {
    const { core } = newCore();
    await core.applyPurchase(packInput(H("f")));
    expect(core.entitlementFor(INST(1), NOW).packs).toEqual(["en-food-01"]);
    core.markRevoked(H("f"), NOW + 10);
    expect((await core.applyPurchase(packInput(H("f"), product(), INST(1), NOW + 20))).result).toBe("REVOKED");
    expect((await core.applyPurchase(packInput(H("f"), product(), INST(2), NOW + 1))).result).toBe("REVOKED");
    expect(core.rowFor(H("f"))?.revoked).toBe(1);
    expect(core.entitlementFor(INST(1), NOW + 30).packs).toEqual([]);
  });

  it("void before verify → tombstone → REVOKED; prune keeps revoked tombstones", async () => {
    const { core } = newCore();
    core.markRevoked(H("g"), NOW);
    expect(core.rowFor(H("g"))).toMatchObject({ kind: "pack", product_id: null, state: "CANCELLED", revoked: 1, google_checked_ms: 0 });
    expect((await core.applyPurchase(packInput(H("g")))).result).toBe("REVOKED");
    core.prune(NOW + 800 * DAY);
    expect(core.rowFor(H("g"))?.revoked).toBe(1);
  });

  it("markRevoked on a subscription is a no-op", async () => {
    const { core } = newCore();
    await core.applyPurchase(subInput(H("h")));
    core.markRevoked(H("h"), NOW);
    expect(core.rowFor(H("h"))?.revoked).toBe(0);
    expect(core.entitlementFor(INST(1), NOW).premiumUntilMs).not.toBeNull();
  });
});

describe("link handling (§3.5)", () => {
  it("ACTIVE with a linked token supersedes the old row and copies its bindings", async () => {
    const { core } = newCore();
    const oldRaw = "old-token-1";
    const old = await hashOf(oldRaw);
    await core.applyPurchase(subInput(old, sub(), INST(1)));
    await core.applyPurchase(subInput(old, sub(), INST(2)));
    const r = await core.applyPurchase(subInput(H("n"), sub({ linkedPurchaseToken: oldRaw, basePlanId: "yearly", expiryMs: NOW + 365 * DAY }), null, NOW + 10));
    expect(r.refreshLinked).toBe(false);
    expect(core.rowFor(old)?.superseded_by).toBe(H("n"));
    expect(core.bindingsFor(H("n")).map((b) => b.install_hash)).toEqual([INST(1), INST(2)]);
    expect(core.entitlementFor(INST(2), NOW + 20).subscription?.basePlanId).toBe("yearly"); // superseded row excluded
  });

  it("linked + expired tokens with 10 bindings each: the purchaser binds first, copies stop at the limit", async () => {
    const { core } = newCore();
    const linkedRaw = "old-linked";
    const expiredRaw = "old-expired";
    const linked = await hashOf(linkedRaw);
    const expired = await hashOf(expiredRaw);
    for (let i = 0; i < 10; i++) await core.applyPurchase(subInput(linked, sub(), INST(100 + i)));
    for (let i = 0; i < 10; i++) await core.applyPurchase(subInput(expired, sub(), INST(200 + i)));
    // An inactive binding on the linked token is never copied.
    await core.applyPurchase(subInput(linked, sub(), INST(300), NOW - INSTALL_ACTIVE_WINDOW_MS - DAY));
    const r = await core.applyPurchase(subInput(H("u"), sub({
      linkedPurchaseToken: linkedRaw, outOfAppPurchaseContext: { expiredPurchaseToken: expiredRaw },
    }), INST(999), NOW + 10));
    expect(r.result).toBe("OK"); // the actual purchaser never gets INSTALL_LIMIT from copies
    const bound = core.bindingsFor(H("u")).map((b) => b.install_hash);
    expect(bound).toContain(INST(999));
    expect(bound).toHaveLength(10);
    expect(bound).not.toContain(INST(300));
  });

  it("PENDING copies the bindings without superseding", async () => {
    const { core } = newCore();
    const oldRaw = "old-token-2";
    const old = await hashOf(oldRaw);
    await core.applyPurchase(subInput(old));
    await core.applyPurchase(subInput(H("p"), sub({ subscriptionState: "SUBSCRIPTION_STATE_PENDING", linkedPurchaseToken: oldRaw, startTime: undefined }), null));
    expect(core.rowFor(old)?.superseded_by).toBeNull();
    expect(core.bindingsFor(H("p")).map((b) => b.install_hash)).toEqual([INST(1)]);
    expect(core.entitlementFor(INST(1), NOW).premiumUntilMs).not.toBeNull(); // the old sub still grants
  });

  it("PENDING_PURCHASE_CANCELED neither supersedes nor copies and asks for refreshLinked", async () => {
    const { core } = newCore();
    const oldRaw = "old-token-3";
    const old = await hashOf(oldRaw);
    await core.applyPurchase(subInput(old));
    const r = await core.applyPurchase(subInput(H("q"), sub({ subscriptionState: "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED", linkedPurchaseToken: oldRaw }), null));
    expect(r.refreshLinked).toBe(true);
    expect(core.rowFor(old)?.superseded_by).toBeNull();
    expect(core.bindingsFor(H("q"))).toEqual([]);
  });

  it("out-of-app resubscribe binds via expiredExternalAccountIdentifiers when the old row is gone", async () => {
    const { core } = newCore();
    const r = await core.applyPurchase(subInput(H("r"), sub({
      outOfAppPurchaseContext: { expiredPurchaseToken: "never-seen", expiredExternalAccountIdentifiers: { obfuscatedExternalAccountId: INST(7) } },
    }), null));
    expect(r.result).toBe("OK");
    expect(core.bindingsFor(H("r")).map((b) => b.install_hash)).toEqual([INST(7)]);
    expect(core.entitlementFor(INST(7), NOW).premiumUntilMs).not.toBeNull();
  });

  it("RTDN obfuscated-id binding: only for a token with no binding", async () => {
    const { core } = newCore();
    await core.applyPurchase(subInput(H("s"), sub({ externalAccountIdentifiers: { obfuscatedExternalAccountId: INST(5) } }), null));
    expect(core.bindingsFor(H("s")).map((b) => b.install_hash)).toEqual([INST(5)]);
    await core.applyPurchase(subInput(H("t"), sub(), INST(1)));
    await core.applyPurchase(subInput(H("t"), sub({ externalAccountIdentifiers: { obfuscatedExternalAccountId: INST(6) } }), null, NOW + 1));
    expect(core.bindingsFor(H("t")).map((b) => b.install_hash)).toEqual([INST(1)]);
  });

  it("ON_HOLD restore binds the caller (no access); RECOVERED later grants access", async () => {
    const { core } = newCore();
    const r = await core.applyPurchase(subInput(H("u"), sub({ subscriptionState: "SUBSCRIPTION_STATE_ON_HOLD", expiryMs: NOW - DAY })));
    expect(r.result).toBe("NOT_OWNED");
    expect(core.bindingsFor(H("u")).map((b) => b.install_hash)).toEqual([INST(1)]);
    expect(core.entitlementFor(INST(1), NOW).subscription?.state).toBe("SUBSCRIPTION_STATE_ON_HOLD");
    await core.applyPurchase(subInput(H("u"), sub(), null, NOW + 1000));
    expect(core.entitlementFor(INST(1), NOW + 2000).premiumUntilMs).not.toBeNull();
  });
});

describe("entitlementFor", () => {
  it("premium, packs and the subscription selection order (access > hold/paused/pending > latest expired)", async () => {
    const { core } = newCore();
    await core.applyPurchase(subInput(H("1"), sub({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", expiryMs: NOW - 5 * DAY })));
    await core.applyPurchase(subInput(H("2"), sub({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", expiryMs: NOW - 2 * DAY })));
    // EXPIRED rows are not bindable on /verify, so nothing is selected yet.
    expect(core.entitlementFor(INST(1), NOW).subscription).toBeNull();
    await core.applyPurchase(subInput(H("3"), sub({ subscriptionState: "SUBSCRIPTION_STATE_CANCELED", expiryMs: NOW - DAY, autoRenew: false })));
    expect(core.entitlementFor(INST(1), NOW).subscription?.expiresAt).toBe(NOW - DAY); // latest expired
    await core.applyPurchase(subInput(H("4"), sub({ subscriptionState: "SUBSCRIPTION_STATE_PAUSED", expiryMs: NOW - DAY })));
    expect(core.entitlementFor(INST(1), NOW).subscription?.state).toBe("SUBSCRIPTION_STATE_PAUSED");
    await core.applyPurchase(subInput(H("5"), sub({ trial: true, basePlanId: "yearly" })));
    const e = core.entitlementFor(INST(1), NOW);
    expect(e.subscription).toMatchObject({ state: "SUBSCRIPTION_STATE_ACTIVE", inTrial: true, basePlanId: "yearly" });
    await core.applyPurchase(packInput(H("6")));
    await core.applyPurchase({ ...packInput(H("7")), productId: "pack_lb_food_01", n: normalizeProduct(product({ productId: "pack_lb_food_01" }), NOW) });
    expect(core.entitlementFor(INST(1), NOW).packs).toEqual(["en-food-01", "lb-food-01"]);
  });

  it("pending packs grant nothing and return PENDING", async () => {
    const { core } = newCore();
    const r = await core.applyPurchase(packInput(H("8"), product({ state: "PENDING", purchaseCompletionTime: undefined })));
    expect(r).toEqual({ result: "PENDING", ackDue: false, refreshLinked: false });
    expect(core.rowFor(H("8"))?.ack_token).not.toBeNull(); // kept while it may become due
    expect(core.entitlementFor(INST(1), NOW).packs).toEqual([]);
  });
});

describe("ack window, caches, limits, prune", () => {
  it("pendingAcks uses ack_window_start_ms: pending 5 days, then completed, is still retried", async () => {
    const { core } = newCore();
    const t0 = NOW - 5 * DAY;
    await core.applyPurchase(packInput(H("9"), product({ state: "PENDING", purchaseCompletionTime: undefined }), INST(1), t0));
    expect(core.pendingAcks(NOW)).toEqual([]);
    await core.applyPurchase(packInput(H("9"), product({ purchaseCompletionTime: iso(NOW - 3_600_000) }), INST(1), NOW));
    expect(core.pendingAcks(NOW).map((p) => p.tokenHash)).toEqual([H("9")]);
    expect(core.pendingAcks(NOW + 3 * DAY)).toEqual([]); // the 3-day window has closed
  });

  it("pendingAcks: a new token whose startTime is the old grant time is retried from first sight (created_ms)", async () => {
    const { core } = newCore();
    await core.applyPurchase(subInput(H("8"), sub({ startTime: iso(NOW - 40 * DAY) }), INST(1), NOW));
    expect(core.pendingAcks(NOW + 2 * DAY).map((p) => p.tokenHash)).toEqual([H("8")]);
    expect(core.pendingAcks(NOW + 3 * DAY)).toEqual([]);
  });

  it("invalid_tokens TTL is 24 h and never shadows a purchase row", async () => {
    const { core } = newCore();
    core.markInvalid(H("x"), "sub", NOW);
    expect(core.lookup(H("x"), "sub", NOW + DAY - 1).invalid).toBe(true);
    expect(core.lookup(H("x"), "sub", NOW + DAY + 1).invalid).toBe(false);
    await core.applyPurchase(subInput(H("y")));
    core.markInvalid(H("y"), "sub", NOW);
    expect(core.lookup(H("y"), "sub", NOW).invalid).toBe(false);
  });

  it("the negative cache is per kind: a 404 as a subscription does not poison the pack token", () => {
    const { core } = newCore();
    core.markInvalid(H("k"), "sub", NOW);
    expect(core.lookup(H("k"), "sub", NOW).invalid).toBe(true);
    expect(core.lookup(H("k"), "pack", NOW).invalid).toBe(false);
  });

  it("ipReadCheck: 10 Google reads per IP key per minute, independent per key", () => {
    const { core } = newCore();
    for (let i = 0; i < 10; i++) expect(core.ipReadCheck("ip-a", NOW + i)).toBe(true);
    expect(core.ipReadCheck("ip-a", NOW + 100)).toBe(false);
    expect(core.ipReadCheck("ip-b", NOW + 100)).toBe(true);
    expect(core.ipReadCheck("ip-a", NOW + 60_001)).toBe(true);
  });

  it("installNetSeen: counts distinct prefixes per install over 24 h, capped", () => {
    const { core } = newCore();
    expect(core.installNetSeen(INST(1), "n1", NOW)).toBe(1);
    expect(core.installNetSeen(INST(1), "n1", NOW + 1)).toBe(1);
    for (let i = 2; i <= 8; i++) core.installNetSeen(INST(1), `n${i}`, NOW + i);
    expect(core.installNetSeen(INST(1), "n9", NOW + 10)).toBe(5); // INSTALL_PREFIXES_PER_DAY + 1
    expect(core.installNetSeen(INST(2), "n1", NOW)).toBe(1);
    expect(core.installNetSeen(INST(1), "n1", NOW + DAY + 100)).toBe(1); // old prefixes age out
  });

  it("rate map: sliding window per install and kind, LRU-evicted at RATE_MAP_MAX_ENTRIES", () => {
    const { core } = newCore();
    for (let i = 0; i < 20; i++) expect(core.rateCheck(INST(1), "verify", NOW + i)).toBe(true);
    expect(core.rateCheck(INST(1), "verify", NOW + 100)).toBe(false);
    expect(core.rateCheck(INST(1), "entitlement", NOW + 100)).toBe(true);
    expect(core.rateCheck(INST(1), "verify", NOW + 10 * 60_000 + 1)).toBe(true);
    for (let i = 0; i < RATE_MAP_MAX_ENTRIES + 50; i++) core.rateCheck(INST(1000 + i), "verify", NOW);
    expect(core.rateMapSize()).toBe(RATE_MAP_MAX_ENTRIES);
  });

  it("googleBudget: capacity 120, refill 60/min", () => {
    const { core } = newCore();
    expect(core.googleBudget(200, NOW)).toBe(120);
    expect(core.googleBudget(1, NOW)).toBe(0);
    expect(core.googleBudget(100, NOW + 30_000)).toBe(30);
    expect(core.googleBudget(1000, NOW + 30_000 + 10 * 60_000)).toBe(120);
  });

  it("prune: rtdn ids after 30 days, ack tokens after the window, old bindings and dead rows", async () => {
    const { core } = newCore();
    core.rtdnMark("m1", NOW);
    expect(core.rtdnSeen("m1")).toBe(true);
    await core.applyPurchase(subInput(H("k"), sub({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", expiryMs: NOW - DAY }), INST(1)));
    await core.applyPurchase(packInput(H("l")));
    core.prune(NOW + 5 * DAY);
    expect(core.rowFor(H("l"))?.ack_token).toBeNull();
    core.prune(NOW + 31 * DAY);
    expect(core.rtdnSeen("m1")).toBe(false);
    core.prune(NOW + 402 * DAY);
    expect(core.rowFor(H("k"))).toBeNull();
    expect(core.rowFor(H("l"))).not.toBeNull(); // a purchased pack is never "dead"
  });

  it("staleSubs counts ACTIVE rows past expiry that Google has not re-read since", async () => {
    const { core } = newCore();
    await core.applyPurchase(subInput(H("m"), sub({ expiryMs: NOW + DAY })));
    expect(core.staleSubs(NOW)).toBe(0);
    expect(core.staleSubs(NOW + DAY + 2 * 3_600_000)).toBe(1);
  });

  it("voided cursor and fake counter persist in kv", () => {
    const { core } = newCore();
    expect(core.cursorGet()).toBeNull();
    core.cursorSet(NOW);
    expect(core.cursorGet()).toBe(NOW);
    expect([core.fakeNext(), core.fakeNext()]).toEqual([1, 2]);
  });
});
