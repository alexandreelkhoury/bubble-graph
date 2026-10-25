// PAYMENTS-SPEC §3.5 / §7.2: BillingCore against real SQLite (node:sqlite). Every purchase is a one-time product.
import { describe, expect, it } from "vitest";
import { ENTITLEMENT_TTL_S, INSTALL_ACTIVE_WINDOW_MS, RATE_MAP_MAX_ENTRIES } from "@mishana/shared/constants";
import type { ApplyInput } from "../../src/billing/billing-core";
import { normalizeProduct } from "../../src/billing/normalize";
import { DAY, NOW, iso, newCore, product } from "../support/billing";

const H = (c: string): string => c.repeat(64).slice(0, 64); // fake 64-hex hashes
const INST = (i: number): string => i.toString(16).padStart(64, "0");
const LIFETIME = (now: number): number => now + ENTITLEMENT_TTL_S * 1000;

function packInput(tokenHash: string, p = product(), caller: string | null = INST(1), checkedMs = NOW): ApplyInput {
  return { tokenHash, productId: "pack_en_food_01", n: normalizeProduct(p, checkedMs), callerInstallHash: caller, rawTokenForAck: "raw-" + tokenHash.slice(0, 6), nowMs: checkedMs };
}
function premiumInput(tokenHash: string, over: Parameters<typeof product>[0] = {}, caller: string | null = INST(1), checkedMs = NOW): ApplyInput {
  return { ...packInput(tokenHash, product({ productId: "premium", ...over }), caller, checkedMs), productId: "premium" };
}

describe("applyPurchase / bindings", () => {
  it("lifetime premium: binds the caller, OK + ackDue; premiumUntil is the token's own exp", () => {
    const { core } = newCore();
    const r = core.applyPurchase(premiumInput(H("a")));
    expect(r).toEqual({ result: "OK", ackDue: true });
    const e = core.entitlementFor(INST(1), NOW);
    expect(e).toEqual({ premiumUntilMs: LIFETIME(NOW), packs: [] });
    expect(core.rowFor(H("a"))).toMatchObject({ kind: "product", product_id: "premium", ack_token: "raw-aaaaaa" });
    core.markAcked(H("a"));
    expect(core.rowFor(H("a"))).toMatchObject({ acknowledged: 1, ack_token: null });
    // Lifetime: still on a year later, as long as the binding stays active.
    expect(core.bindOnly({ tokenHash: H("a"), callerInstallHash: INST(1), nowMs: NOW + 365 * DAY })).toBe("OK");
    expect(core.entitlementFor(INST(1), NOW + 365 * DAY).premiumUntilMs).toBe(LIFETIME(NOW + 365 * DAY));
  });

  it("pending premium: PENDING, no access, ack token kept while it may become due", () => {
    const { core } = newCore();
    const r = core.applyPurchase(premiumInput(H("p"), { state: "PENDING", purchaseCompletionTime: undefined }));
    expect(r).toEqual({ result: "PENDING", ackDue: false });
    expect(core.rowFor(H("p"))?.ack_token).not.toBeNull();
    expect(core.entitlementFor(INST(1), NOW).premiumUntilMs).toBeNull();
    // Completed later → access.
    expect(core.applyPurchase(premiumInput(H("p"), {}, INST(1), NOW + 1000)).result).toBe("OK");
    expect(core.entitlementFor(INST(1), NOW + 1000).premiumUntilMs).toBe(LIFETIME(NOW + 1000));
  });

  it("refunded premium (CANCELLED re-read) and revoked premium lose access", () => {
    const { core } = newCore();
    core.applyPurchase(premiumInput(H("c")));
    core.applyPurchase(premiumInput(H("c"), { state: "CANCELLED" }, null, NOW + 10));
    expect(core.entitlementFor(INST(1), NOW + 20).premiumUntilMs).toBeNull();
    core.applyPurchase(premiumInput(H("r")));
    core.markRevoked(H("r"), NOW + 30);
    expect(core.entitlementFor(INST(1), NOW + 40).premiumUntilMs).toBeNull();
    expect(core.applyPurchase(premiumInput(H("r"), {}, INST(1), NOW + 50)).result).toBe("REVOKED");
  });

  it("INSTALL_LIMIT at the 11th active binding, the row is still stored and ackDue still returned", () => {
    const { core } = newCore();
    for (let i = 1; i <= 10; i++) expect(core.applyPurchase(premiumInput(H("b"), {}, INST(i))).result).toBe("OK");
    const r = core.applyPurchase(premiumInput(H("b"), {}, INST(11)));
    expect(r).toEqual({ result: "INSTALL_LIMIT", ackDue: true });
    expect(core.entitlementFor(INST(11), NOW).premiumUntilMs).toBeNull();
    // An existing install keeps refreshing fine.
    expect(core.applyPurchase(premiumInput(H("b"), {}, INST(3))).result).toBe("OK");
  });

  it("a binding older than 30 days gives no access and its slot is reusable", () => {
    const { core } = newCore();
    for (let i = 1; i <= 10; i++) core.applyPurchase(premiumInput(H("c"), {}, INST(i)));
    const later = NOW + INSTALL_ACTIVE_WINDOW_MS + 1000;
    expect(core.entitlementFor(INST(1), later).premiumUntilMs).toBeNull();
    // Install 11 can now bind (the 10 old ones are inactive).
    expect(core.bindOnly({ tokenHash: H("c"), callerInstallHash: INST(11), nowMs: later })).toBe("OK");
    expect(core.entitlementFor(INST(11), later).premiumUntilMs).not.toBeNull();
  });

  it("entitlementFor never refreshes last_seen_ms", () => {
    const { core } = newCore();
    core.applyPurchase(premiumInput(H("d")));
    const before = core.bindingsFor(H("d"));
    core.entitlementFor(INST(1), NOW + DAY);
    expect(core.bindingsFor(H("d"))).toEqual(before);
  });

  it("a stale checkedMs never overwrites a newer read; stale PURCHASED after stored CANCELLED → NOT_OWNED, no new binding", () => {
    const { core } = newCore();
    core.applyPurchase(packInput(H("e"), product({ state: "CANCELLED" }), INST(1), NOW + 5000));
    const r = core.applyPurchase(packInput(H("e"), product(), INST(2), NOW + 1000));
    expect(r.result).toBe("NOT_OWNED");
    expect(core.rowFor(H("e"))?.state).toBe("CANCELLED");
    expect(core.bindingsFor(H("e")).map((b) => b.install_hash)).toEqual([]);
  });

  it("revoke is sticky: verify after revoke → REVOKED; a stale or fresh PURCHASED read cannot clear it", () => {
    const { core } = newCore();
    core.applyPurchase(packInput(H("f")));
    expect(core.entitlementFor(INST(1), NOW).packs).toEqual(["en-food-01"]);
    core.markRevoked(H("f"), NOW + 10);
    expect(core.applyPurchase(packInput(H("f"), product(), INST(1), NOW + 20)).result).toBe("REVOKED");
    expect(core.applyPurchase(packInput(H("f"), product(), INST(2), NOW + 1)).result).toBe("REVOKED");
    expect(core.rowFor(H("f"))?.revoked).toBe(1);
    expect(core.entitlementFor(INST(1), NOW + 30).packs).toEqual([]);
  });

  it("void before verify → tombstone → REVOKED; prune keeps revoked tombstones", () => {
    const { core } = newCore();
    core.markRevoked(H("g"), NOW);
    expect(core.rowFor(H("g"))).toMatchObject({ kind: "product", product_id: null, state: "CANCELLED", revoked: 1, google_checked_ms: 0 });
    expect(core.applyPurchase(premiumInput(H("g"))).result).toBe("REVOKED");
    core.prune(NOW + 800 * DAY);
    expect(core.rowFor(H("g"))?.revoked).toBe(1);
  });

  it("RTDN obfuscated-id binding: only for a token with no binding", () => {
    const { core } = newCore();
    core.applyPurchase(premiumInput(H("s"), { obfuscatedExternalAccountId: INST(5) }, null));
    expect(core.bindingsFor(H("s")).map((b) => b.install_hash)).toEqual([INST(5)]);
    expect(core.entitlementFor(INST(5), NOW).premiumUntilMs).toBe(LIFETIME(NOW));
    core.applyPurchase(premiumInput(H("t"), {}, INST(1)));
    core.applyPurchase(premiumInput(H("t"), { obfuscatedExternalAccountId: INST(6) }, null, NOW + 1));
    expect(core.bindingsFor(H("t")).map((b) => b.install_hash)).toEqual([INST(1)]);
  });
});

describe("entitlementFor", () => {
  it("premium and owned premium packs together", () => {
    const { core } = newCore();
    core.applyPurchase(premiumInput(H("5")));
    core.applyPurchase(packInput(H("6")));
    core.applyPurchase({ ...packInput(H("7")), productId: "pack_lb_food_01", n: normalizeProduct(product({ productId: "pack_lb_food_01" }), NOW) });
    expect(core.entitlementFor(INST(1), NOW)).toEqual({ premiumUntilMs: LIFETIME(NOW), packs: ["en-food-01", "lb-food-01"] });
  });

  it("pending packs grant nothing and return PENDING", () => {
    const { core } = newCore();
    const r = core.applyPurchase(packInput(H("8"), product({ state: "PENDING", purchaseCompletionTime: undefined })));
    expect(r).toEqual({ result: "PENDING", ackDue: false });
    expect(core.rowFor(H("8"))?.ack_token).not.toBeNull(); // kept while it may become due
    expect(core.entitlementFor(INST(1), NOW).packs).toEqual([]);
  });

  it("admin grants still add premium (open-ended → token exp; dated → its end) and packs", () => {
    const { core } = newCore();
    core.grantPut({ installHash: INST(2), premium: true, packs: ["en-food-01"], expiresAt: null, note: null, createdAt: NOW });
    expect(core.entitlementFor(INST(2), NOW)).toEqual({ premiumUntilMs: LIFETIME(NOW), packs: ["en-food-01"] });
    core.grantPut({ installHash: INST(3), premium: true, packs: [], expiresAt: NOW + DAY, note: null, createdAt: NOW });
    expect(core.entitlementFor(INST(3), NOW).premiumUntilMs).toBe(NOW + DAY);
    expect(core.entitlementFor(INST(3), NOW + 2 * DAY).premiumUntilMs).toBeNull();
  });
});

describe("ack window, caches, limits, prune", () => {
  it("pendingAcks uses ack_window_start_ms: pending 5 days, then completed, is still retried", () => {
    const { core } = newCore();
    const t0 = NOW - 5 * DAY;
    core.applyPurchase(packInput(H("9"), product({ state: "PENDING", purchaseCompletionTime: undefined }), INST(1), t0));
    expect(core.pendingAcks(NOW)).toEqual([]);
    core.applyPurchase(packInput(H("9"), product({ purchaseCompletionTime: iso(NOW - 3_600_000) }), INST(1), NOW));
    expect(core.pendingAcks(NOW).map((p) => p.tokenHash)).toEqual([H("9")]);
    expect(core.pendingAcks(NOW).map((p) => p.productId)).toEqual(["pack_en_food_01"]);
    expect(core.pendingAcks(NOW + 3 * DAY)).toEqual([]); // the 3-day window has closed
  });

  it("pendingAcks: a purchase whose completion time is older than first sight is retried from created_ms", () => {
    const { core } = newCore();
    core.applyPurchase(premiumInput(H("8"), { purchaseCompletionTime: iso(NOW - 40 * DAY) }, INST(1), NOW));
    expect(core.pendingAcks(NOW + 2 * DAY).map((p) => p.tokenHash)).toEqual([H("8")]);
    expect(core.pendingAcks(NOW + 3 * DAY)).toEqual([]);
  });

  it("invalid_tokens TTL is 24 h and never shadows a purchase row", () => {
    const { core } = newCore();
    core.markInvalid(H("x"), NOW);
    expect(core.lookup(H("x"), NOW + DAY - 1).invalid).toBe(true);
    expect(core.lookup(H("x"), NOW + DAY + 1).invalid).toBe(false);
    core.applyPurchase(premiumInput(H("y")));
    core.markInvalid(H("y"), NOW);
    expect(core.lookup(H("y"), NOW).invalid).toBe(false);
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

  it("prune: rtdn ids after 30 days, ack tokens after the window, old bindings and dead rows", () => {
    const { core } = newCore();
    core.rtdnMark("m1", NOW);
    expect(core.rtdnSeen("m1")).toBe(true);
    core.applyPurchase(packInput(H("k"), product({ state: "CANCELLED" }), INST(1)));
    core.applyPurchase(packInput(H("l")));
    core.applyPurchase(premiumInput(H("m")));
    core.prune(NOW + 5 * DAY);
    expect(core.rowFor(H("l"))?.ack_token).toBeNull();
    core.prune(NOW + 31 * DAY);
    expect(core.rtdnSeen("m1")).toBe(false);
    core.prune(NOW + 402 * DAY);
    expect(core.rowFor(H("k"))).toBeNull();
    expect(core.rowFor(H("l"))).not.toBeNull(); // a purchased pack is never "dead"
    expect(core.rowFor(H("m"))).not.toBeNull(); // nor lifetime premium
  });

  it("voided cursor and fake counter persist in kv", () => {
    const { core } = newCore();
    expect(core.cursorGet()).toBeNull();
    core.cursorSet(NOW);
    expect(core.cursorGet()).toBe(NOW);
    expect([core.fakeNext(), core.fakeNext()]).toEqual([1, 2]);
  });
});
