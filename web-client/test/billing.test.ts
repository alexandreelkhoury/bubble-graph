// PAYMENTS-SPEC §7.3 (TV mock store): the state machine, nextRefreshAt, the toast queue, storeOpen sends, fake-mode
// gating from the catalog response, the purchase sequence calls in order, and the token persisted with try/catch.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogResponseBody, EntitlementBody } from "@mishana/shared/billing";
import { BillingController, BILLING_KEYS, STORE_OPEN_RESEND_MS } from "../src/tv-mock/billing/controller";
import type { BillingDeps, BillingRoomLink, BillingToast } from "../src/tv-mock/billing/controller";
import {
  afterPackPurchase, backoffMs, inflightKey, initialFocus, nextRefreshAt, packState, pitchParams, planPurchaseRequest,
  premiumCard, splitPacks, tokenForCreate, ToastGate, trialOffered,
} from "../src/tv-mock/billing/model";

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = 1_790_000_000_000;

const CATALOG = (mode: "fake" | "google"): CatalogResponseBody => ({
  mode, packageName: "app.mishana.tv",
  subscription: { productId: "premium", basePlanIds: ["monthly", "yearly"], trialOfferId: "trial-7d" },
  freePackIds: ["en-everyday-01", "fr-everyday-01", "ar-everyday-01"],
  packs: [
    { packId: "en-food-01", productId: "pack_en_food_01", locale: "en", language: "en", title: { en: "Food", fr: "Cuisine", ar: "أكل" }, pairCount: 33, ageRating: "all" },
    { packId: "fr-food-01", productId: "pack_fr_food_01", locale: "fr", language: "fr", title: { en: "Food FR", fr: "Cuisine", ar: "أكل" }, pairCount: 33, ageRating: "all" },
    { packId: "lb-food-01", productId: "pack_lb_food_01", locale: "ar-LB", language: "ar", title: { en: "Lebanese food", fr: "Cuisine libanaise", ar: "أكل لبناني" }, pairCount: 27, ageRating: "all" },
  ],
});

function body(over: Partial<EntitlementBody> = {}): EntitlementBody {
  return { token: "tok.free", premium: false, premiumUntil: null, packs: [], expiresAt: NOW + 8 * HOUR, subscription: null, ...over };
}

describe("model", () => {
  it("nextRefreshAt: before premium ends for a renewing subscriber, never sooner than 1 min, never later than 6 h", () => {
    const sub = { state: "SUBSCRIPTION_STATE_ACTIVE" as const, basePlanId: "monthly", autoRenewing: true, inTrial: false, expiresAt: NOW + 2 * HOUR };
    const b = body({ premium: true, premiumUntil: NOW + 8 * HOUR, subscription: sub });
    const at = nextRefreshAt(b, NOW);
    expect(at).toBeLessThanOrEqual(sub.expiresAt + 10 * MIN);
    expect(at).toBeLessThanOrEqual(b.premiumUntil! - 30 * MIN);
    expect(at).toBe(sub.expiresAt + 10 * MIN);
    expect(nextRefreshAt(body({ expiresAt: NOW + 30 * MIN }), NOW)).toBe(NOW + MIN);
    expect(nextRefreshAt(body({ expiresAt: NOW + 48 * HOUR }), NOW)).toBe(NOW + 6 * HOUR);
    expect(nextRefreshAt(body(), NOW)).toBe(NOW + 6 * HOUR); // nulls ignored; token exp − 1 h = 7 h > 6 h
  });

  it("tokenForCreate: only with more than 60 s left", () => {
    expect(tokenForCreate(body({ expiresAt: NOW + 61_000 }), NOW)).toBe("tok.free");
    expect(tokenForCreate(body({ expiresAt: NOW + 60_000 }), NOW)).toBeNull();
    expect(tokenForCreate(null, NOW)).toBeNull();
  });

  it("the Premium card and the pack card states", () => {
    expect(premiumCard(null)).toBe("plans");
    expect(premiumCard(body())).toBe("plans");
    const sub = (state: NonNullable<EntitlementBody["subscription"]>["state"]) => ({ state, basePlanId: "yearly", autoRenewing: true, inTrial: false, expiresAt: NOW });
    expect(premiumCard(body({ premium: true, subscription: sub("SUBSCRIPTION_STATE_ACTIVE") }))).toBe("premium");
    expect(premiumCard(body({ premium: true, subscription: sub("SUBSCRIPTION_STATE_IN_GRACE_PERIOD") }))).toBe("grace");
    expect(premiumCard(body({ premium: false, subscription: sub("SUBSCRIPTION_STATE_ON_HOLD") }))).toBe("suspended");
    expect(premiumCard(body({ premium: false, subscription: sub("SUBSCRIPTION_STATE_PAUSED") }))).toBe("suspended");
    expect(premiumCard(body({ premium: false, subscription: sub("SUBSCRIPTION_STATE_EXPIRED") }))).toBe("plans");
    const none = new Set<string>();
    expect(packState("en-food-01", "pack_en_food_01", body({ packs: ["en-food-01"] }), none)).toBe("owned");
    expect(packState("en-food-01", "pack_en_food_01", body({ premium: true }), none)).toBe("included");
    expect(packState("en-food-01", "pack_en_food_01", body(), new Set(["pack_en_food_01"]))).toBe("pending");
    expect(packState("en-food-01", "pack_en_food_01", body(), none)).toBe("buy");
  });

  it("initial focus per entry and state", () => {
    const packs = ["pack_en_food_01"];
    expect(initialFocus({ focusProductId: null, origin: "LOBBY_BUTTON" }, { kind: "ready" }, "plans", packs)).toBe("plan:yearly");
    expect(initialFocus({ focusProductId: "premium", origin: "LOCKED_SETTING" }, { kind: "ready" }, "suspended", packs)).toBe("fix");
    expect(initialFocus({ focusProductId: "premium", origin: "LOCKED_SETTING" }, { kind: "ready" }, "grace", packs)).toBe("manage");
    expect(initialFocus({ focusProductId: null, origin: "LOBBY_BUTTON" }, { kind: "ready" }, "premium", packs)).toBe("manage");
    expect(initialFocus({ focusProductId: "pack_en_food_01", origin: "LOCKED_PACK" }, { kind: "ready" }, "plans", packs)).toBe("pack:pack_en_food_01");
    expect(initialFocus({ focusProductId: "pack_xx_01", origin: "LOCKED_PACK" }, { kind: "ready" }, "plans", packs)).toBe("plan:yearly");
    expect(initialFocus({ focusProductId: null, origin: "LOBBY_BUTTON" }, { kind: "unavailable" }, "plans", packs)).toBe("retry");
    expect(initialFocus({ focusProductId: null, origin: "LOBBY_BUTTON" }, { kind: "google" }, "plans", packs)).toBe("ok");
  });

  it("packs: room language first (ar-LB counts as ar), pitch rounded down to 10", () => {
    const { mine, other } = splitPacks(CATALOG("fake").packs, "ar");
    expect(mine.map((p) => p.packId)).toEqual(["lb-food-01"]);
    expect(other.map((p) => p.packId)).toEqual(["en-food-01", "fr-food-01"]);
    expect(pitchParams(CATALOG("fake"))).toEqual({ count: 3, pairs: 90 });
  });

  it("a pack bought from a locked row: added to a same-language filter, else a language hint, else nothing", () => {
    expect(afterPackPurchase({ packIds: ["en-everyday-01"], wordLocale: "en" }, true, "en-food-01", "en")).toEqual({ kind: "add", packIds: ["en-everyday-01", "en-food-01"] });
    expect(afterPackPurchase({ packIds: [], wordLocale: "en" }, true, "en-food-01", "en")).toEqual({ kind: "none" });
    expect(afterPackPurchase({ packIds: ["en-everyday-01"], wordLocale: "en" }, true, "lb-food-01", "ar-LB")).toEqual({ kind: "switch", lang: "ar" });
    expect(afterPackPurchase({ packIds: ["en-everyday-01"], wordLocale: "en" }, false, "en-food-01", "en")).toEqual({ kind: "none" });
  });

  it("the toast gate keeps only the latest toast and shows it on flush", () => {
    const shown: string[] = [];
    const g = new ToastGate<string>((x) => shown.push(x));
    g.offer("a", true);
    g.offer("b", false);
    g.offer("c", false);
    g.flush(false);
    expect(shown).toEqual(["a"]);
    g.flush(true);
    g.flush(true);
    expect(shown).toEqual(["a", "c"]);
  });

  it("§4.5 trial offer: only with a catalog trial offer, a fresh install and no subscription row", () => {
    const cat = CATALOG("fake");
    expect(trialOffered(cat, null, false)).toBe(true);
    expect(trialOffered(cat, body(), false)).toBe(true);
    expect(trialOffered(cat, body(), true)).toBe(false);
    const expired = { state: "SUBSCRIPTION_STATE_EXPIRED" as const, basePlanId: "yearly", autoRenewing: false, inTrial: false, expiresAt: NOW - HOUR };
    expect(trialOffered(cat, body({ subscription: expired }), false)).toBe(false);
    expect(trialOffered({ subscription: { ...cat.subscription, trialOfferId: "" } }, null, false)).toBe(false);
    expect(trialOffered(null, null, false)).toBe(false);
    expect(planPurchaseRequest("i", "monthly").offerId).toBe("trial-7d");
    expect(planPurchaseRequest("i", "monthly", false).offerId).toBeNull();
  });

  it("the in-flight key names the plan, so only the button the user pressed confirms", () => {
    expect(inflightKey("premium", "yearly")).toBe("premium:yearly");
    expect(inflightKey("premium", "monthly")).not.toBe(inflightKey("premium", "yearly"));
    expect(inflightKey("pack_en_food_01")).toBe("pack_en_food_01");
  });

  it("backoff: 1 s doubling, capped at 10 min", () => {
    expect([0, 1, 2].map(backoffMs)).toEqual([1000, 2000, 4000]);
    expect(backoffMs(30)).toBe(10 * MIN);
  });
});

// ---------------------------------------------------------------------------------------------------- controller

type Call = { url: string; body: unknown };
function harness(opts: { mode?: "fake" | "google"; catalogStatus?: number; purchaseResult?: string } = {}) {
  const calls: Call[] = [];
  const mem = new Map<string, string>();
  let now = NOW;
  let tok = 0;
  const timers: { fn: () => void; at: number; id: number }[] = [];
  let nextId = 1;
  const res = (status: number, json: unknown): Response => new Response(status === 204 ? null : JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
  const deps: BillingDeps = {
    fetch: async (url, init) => {
      const b = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body: b });
      switch (url) {
        case "/api/billing/catalog": return res(opts.catalogStatus ?? 200, CATALOG(opts.mode ?? "fake"));
        case "/api/billing/fake/purchase": return res(200, { purchaseToken: `fake.x.${(b as { productId: string }).productId}.${++tok}` });
        case "/api/billing/fake/set": return res(204, null);
        case "/api/billing/verify": {
          const purchases = (b as { purchases: { productId: string }[] }).purchases;
          const premium = purchases.some((p) => p.productId === "premium");
          return res(200, {
            entitlement: body({ token: `tok.v${calls.length}`, premium, premiumUntil: premium ? now + 30 * 86_400_000 : null, packs: purchases.filter((p) => p.productId.startsWith("pack_")).map((p) => p.productId.slice(5).replaceAll("_", "-")).sort(), expiresAt: now + 8 * HOUR }),
            results: purchases.map((p) => ({ productId: p.productId, result: opts.purchaseResult ?? "OK" })),
          });
        }
        case "/api/billing/entitlement": return res(200, { entitlement: body({ token: `tok.e${calls.length}`, expiresAt: now + 8 * HOUR }) });
        default: return res(404, { error: "BAD_REQUEST" });
      }
    },
    now: () => now,
    read: (k) => mem.get(k) ?? null,
    write: (k, v) => { mem.set(k, v); },
    remove: (k) => { mem.delete(k); },
    randomBytes: (n) => new Uint8Array(n).map((_, i) => i * 17),
    setTimeout: (fn, ms) => { const id = nextId++; timers.push({ fn, at: now + ms, id }); return id; },
    clearTimeout: (h) => { const i = timers.findIndex((x) => x.id === h); if (i >= 0) timers.splice(i, 1); },
  };
  const sent: unknown[] = [];
  const toasts: BillingToast[] = [];
  let open = true;
  let canToast = true;
  const link: BillingRoomLink = {
    send: (m) => { if (!open) return false; sent.push(m); return true; },
    canToast: () => canToast,
    showToast: (x) => toasts.push(x),
  };
  const c = new BillingController(deps);
  return {
    deps, c, calls, mem, sent, toasts, link, timers,
    setOpen: (v: boolean) => { open = v; },
    setCanToast: (v: boolean) => { canToast = v; },
    advance: (ms: number) => {
      now += ms;
      for (;;) {
        const due = timers.filter((x) => x.at <= now).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers.splice(timers.indexOf(due), 1);
        due.fn();
      }
    },
    urls: () => calls.map((x) => x.url),
  };
}

describe("BillingController", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fake mode comes only from the catalog: google mode never purchases nor refreshes", async () => {
    const h = harness({ mode: "google" });
    expect(await h.c.loadCatalog()).toBe(true);
    expect(h.c.mode.value).toBe("google");
    expect(await h.c.purchase("premium", "yearly")).toBeNull();
    expect(await h.c.refresh(true)).toBe(false);
    expect(h.urls()).toEqual(["/api/billing/catalog"]);
  });

  it("a catalog failure is 'error' (Try again), never fake", async () => {
    const h = harness({ catalogStatus: 404 });
    expect(await h.c.loadCatalog()).toBe(false);
    expect(h.c.mode.value).toBe("error");
    expect(await h.c.purchase("pack_en_food_01")).toBeNull();
  });

  it("purchase: fake/purchase → verify → token stored → entitlement sent; storeOpen true while in flight", async () => {
    const h = harness();
    await h.c.loadCatalog();
    h.c.attach(h.link);
    const result = await h.c.purchase("premium", "yearly");
    expect(result).toBe("OK");
    expect(h.urls()).toEqual(["/api/billing/catalog", "/api/billing/fake/purchase", "/api/billing/verify"]);
    const installId = h.mem.get(BILLING_KEYS.installId)!;
    expect(installId).toMatch(/^[0-9a-f]{32}$/);
    expect(h.calls[1]!.body).toEqual({ installId, productId: "premium", basePlanId: "yearly", offerId: "trial-7d" });
    expect(h.calls[2]!.body).toEqual({ installId, purchases: [{ productId: "premium", purchaseToken: "fake.x.premium.1" }] });
    const token = h.c.ent.value!.token;
    expect(h.mem.get(BILLING_KEYS.token)).toBe(token);
    expect(h.c.ent.value!.premium).toBe(true);
    expect(h.sent).toEqual([
      { v: 1, t: "storeOpen", open: true },
      { v: 1, t: "entitlement", token },
      { v: 1, t: "storeOpen", open: false },
    ]);
    expect(h.toasts.map((x) => x.key)).toEqual(["store.unlocked"]);
    expect(h.c.inflight.value).toBeNull();
  });

  it("a plan purchase marks only that plan in flight, and the trial is used once per install", async () => {
    const h = harness();
    await h.c.loadCatalog();
    h.c.attach(h.link);
    expect(h.c.trialOffered).toBe(true);
    const p = h.c.purchase("premium", "monthly");
    expect(h.c.inflight.value).toBe("premium:monthly");
    await p;
    expect(h.c.trialUsed.value).toBe(true);
    expect(h.mem.get(BILLING_KEYS.trialUsed)).toBe(h.mem.get(BILLING_KEYS.installId));
    // A new controller on the same storage (a reload) still knows; a different install id does not inherit it.
    expect(new BillingController(harnessDeps(h.mem)).trialUsed.value).toBe(true);
    const other = new Map(h.mem);
    other.set(BILLING_KEYS.installId, "f".repeat(32));
    expect(new BillingController(harnessDeps(other)).trialUsed.value).toBe(false);
    await h.c.testExpirePremium();
    await h.c.purchase("premium", "yearly");
    expect(h.calls.filter((x) => x.url === "/api/billing/fake/purchase").map((x) => (x.body as { offerId: unknown }).offerId)).toEqual(["trial-7d", null]);
  });

  it("the cached entitlement body is UI-only: only the stored token ever leaves the browser", async () => {
    const h = harness();
    // A viewer edits their own storage to claim Premium and every pack.
    h.mem.set(BILLING_KEYS.token, "tok.real");
    h.mem.set(BILLING_KEYS.body, JSON.stringify({ body: body({ token: "tok.real", premium: true, packs: ["en-food-01"] }), savedAt: NOW }));
    h.mem.set(BILLING_KEYS.verified, "forged");
    const c = new BillingController(h.deps);
    await c.loadCatalog();
    c.attach(h.link);
    await c.refresh(true);
    await c.purchase("pack_en_food_01");
    const bodies = JSON.stringify(h.calls.map((x) => x.body ?? null));
    expect(bodies).not.toContain("premiumUntil");
    expect(bodies).not.toContain("forged");
    expect(bodies).not.toMatch(/"premium":true/);
    for (const m of h.sent as { t: string }[]) expect(Object.keys(m).sort()).toEqual(m.t === "entitlement" ? ["t", "token", "v"] : ["open", "t", "v"]);
  });

  it("a pack purchase posts every remembered purchase; a PENDING one shows the pending chip and no toast", async () => {
    const h = harness({ purchaseResult: "PENDING" });
    await h.c.loadCatalog();
    h.c.attach(h.link);
    await h.c.purchase("pack_en_food_01");
    expect([...h.c.pending.value]).toEqual(["pack_en_food_01"]);
    expect(h.toasts).toEqual([]);
  });

  it("refresh rules: unchanged and fresh → nothing; stale → /entitlement; changed purchases → /verify", async () => {
    const h = harness();
    await h.c.loadCatalog();
    await h.c.refresh();
    expect(h.urls().slice(1)).toEqual(["/api/billing/entitlement"]);
    await h.c.refresh();
    expect(h.urls().length).toBe(2); // fresh and unchanged
    h.advance(HOUR + 1);
    await h.c.refresh();
    expect(h.urls().at(-1)).toBe("/api/billing/entitlement");
    h.mem.set(BILLING_KEYS.purchases, JSON.stringify([{ productId: "pack_en_food_01", purchaseToken: "fake.pack.pack_en_food_01.1", state: "PURCHASED" }]));
    await h.c.refresh();
    expect(h.urls().at(-1)).toBe("/api/billing/verify");
  });

  it("a token reloads from storage; a corrupt stored body is ignored", () => {
    const h = harness();
    h.mem.set(BILLING_KEYS.body, JSON.stringify({ body: body({ token: "stored" }), savedAt: NOW }));
    const again = new BillingController({ ...harnessDeps(h.mem) });
    expect(again.ent.value?.token).toBe("stored");
    h.mem.set(BILLING_KEYS.body, "{not json");
    expect(new BillingController({ ...harnessDeps(h.mem) }).ent.value).toBeNull();
  });

  it("a token refreshed while the socket is down is sent after the next open", async () => {
    const h = harness();
    await h.c.loadCatalog();
    h.c.attach(h.link);
    h.setOpen(false);
    await h.c.refresh(true);
    expect(h.sent).toEqual([]);
    h.setOpen(true);
    h.c.roomOpened();
    expect(h.sent).toEqual([{ v: 1, t: "entitlement", token: h.c.ent.value!.token }, { v: 1, t: "storeOpen", open: false }]);
  });

  it("storeOpen: on open, re-sent every 4 min while open, false on close, again after a reconnect", async () => {
    const h = harness();
    await h.c.loadCatalog();
    h.c.attach(h.link);
    h.c.setStoreVisible(true);
    expect(h.sent).toEqual([{ v: 1, t: "storeOpen", open: true }]);
    h.advance(STORE_OPEN_RESEND_MS);
    h.advance(STORE_OPEN_RESEND_MS);
    expect(h.sent.length).toBe(3);
    h.c.roomOpened();
    expect(h.sent.at(-1)).toEqual({ v: 1, t: "storeOpen", open: true });
    h.c.setStoreVisible(false);
    expect(h.sent.at(-1)).toEqual({ v: 1, t: "storeOpen", open: false });
    const n = h.sent.length;
    h.advance(10 * STORE_OPEN_RESEND_MS);
    expect(h.sent.length).toBe(n);
  });

  it("the in-room refresh timer fires at nextRefreshAt", async () => {
    const h = harness();
    await h.c.loadCatalog();
    h.c.attach(h.link);
    await h.c.refresh(true);
    const before = h.urls().length;
    h.advance(6 * HOUR - 1);
    expect(h.urls().length).toBe(before);
    h.advance(1);
    await Promise.resolve();
    expect(h.urls().length).toBe(before + 1);
  });

  it("billing toasts wait outside the Store/LOBBY/RESULTS and show on the next flush", async () => {
    const h = harness();
    h.c.attach(h.link);
    h.setCanToast(false);
    h.c.notify({ key: "store.unlocked", tone: "success" });
    h.c.notify({ key: "lobby.premiumEnded", tone: "info" });
    expect(h.toasts).toEqual([]);
    h.setCanToast(true);
    h.c.flushToasts();
    expect(h.toasts.map((x) => x.key)).toEqual(["lobby.premiumEnded"]);
  });

  it("test controls: Expire Premium now → fake/set EXPIRED → /entitlement → entitlement sent", async () => {
    const h = harness();
    await h.c.loadCatalog();
    h.c.attach(h.link);
    await h.c.purchase("premium", "monthly");
    h.sent.length = 0;
    expect(await h.c.testExpirePremium()).toBe(true);
    expect(h.urls().slice(-2)).toEqual(["/api/billing/fake/set", "/api/billing/entitlement"]);
    expect(h.calls.at(-2)!.body).toEqual({ purchaseToken: "fake.x.premium.1", state: "SUBSCRIPTION_STATE_EXPIRED" });
    expect(h.sent).toEqual([{ v: 1, t: "entitlement", token: h.c.ent.value!.token }]);
    expect(h.c.hasTestTarget("premium")).toBe(false);
  });

  it("the browser wiring survives storage that throws (SPEC §8.6)", async () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } });
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => a.fill(7) });
    const { billing } = await import("../src/tv-mock/billing");
    expect(billing.installId()).toBe("07".repeat(16));
    expect(billing.purchases()).toEqual([]);
  });
});

function harnessDeps(mem: Map<string, string>): BillingDeps {
  return {
    fetch: async () => new Response(null, { status: 404 }), now: () => NOW,
    read: (k) => mem.get(k) ?? null, write: (k, v) => { mem.set(k, v); }, remove: (k) => { mem.delete(k); },
    randomBytes: (n) => new Uint8Array(n), setTimeout: () => 0, clearTimeout: () => undefined,
  };
}
