// PAYMENTS-SPEC §4.4 / §4.5 / §5.2: the TV mock Store's layout and remote rules, against the real `wrangler dev` (the
// room, the lobby, the D-pad) with /api/billing/* answered by page.route. These checks are about the client only (what
// fits, what is focused, which button shows "Confirming…"), so they run whether or not the server has billing yet;
// the server's side of the purchase flow is payments.spec.ts.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page, Route } from "@playwright/test";

type Lang = "en" | "fr" | "ar";
const I18N: Record<Lang, Record<string, unknown>> = {
  en: JSON.parse(readFileSync(new URL("../../shared/i18n/en.json", import.meta.url), "utf8")) as Record<string, unknown>,
  fr: JSON.parse(readFileSync(new URL("../../shared/i18n/fr.json", import.meta.url), "utf8")) as Record<string, unknown>,
  ar: JSON.parse(readFileSync(new URL("../../shared/i18n/ar.json", import.meta.url), "utf8")) as Record<string, unknown>,
};
const text = (k: string, lang: Lang = "en"): string => {
  const v = I18N[lang][k];
  if (typeof v !== "string") throw new Error(`${lang}.json has no string ${k}`);
  return v;
};

const NOW = Date.now();
const DAY = 86_400_000;
const CATALOG = {
  mode: "fake", packageName: "app.mishana.tv",
  subscription: { productId: "premium", basePlanIds: ["monthly", "yearly"], trialOfferId: "trial-7d" },
  freePackIds: ["en-everyday-01", "fr-everyday-01", "ar-everyday-01"],
  packs: [
    { packId: "en-food-01", productId: "pack_en_food_01", locale: "en", language: "en", title: { en: "Food & drinks", fr: "À table", ar: "أكل وشرب" }, pairCount: 33, ageRating: "all" },
    { packId: "en-leisure-01", productId: "pack_en_leisure_01", locale: "en", language: "en", title: { en: "Leisure", fr: "Loisirs", ar: "تسلية" }, pairCount: 33, ageRating: "all" },
    { packId: "fr-food-01", productId: "pack_fr_food_01", locale: "fr", language: "fr", title: { en: "Food (FR)", fr: "Cuisine", ar: "أكل" }, pairCount: 33, ageRating: "all" },
    { packId: "fr-nature-01", productId: "pack_fr_nature_01", locale: "fr", language: "fr", title: { en: "Nature (FR)", fr: "Nature", ar: "طبيعة" }, pairCount: 31, ageRating: "all" },
    { packId: "lb-food-01", productId: "pack_lb_food_01", locale: "ar-LB", language: "ar", title: { en: "Lebanese food", fr: "Cuisine libanaise", ar: "أكل لبناني" }, pairCount: 27, ageRating: "all" },
  ],
};

interface Billing { posts: { url: string; body: unknown }[]; release(): void }

/** The fake store, in the page. `holdVerify` keeps /verify unanswered until `release()` (the "Confirming…" state). */
async function mockBilling(page: Page, opts: { holdVerify?: boolean } = {}): Promise<Billing> {
  let premium = false;
  const packs: string[] = [];
  let open: () => void = () => undefined;
  const gate = new Promise<void>((r) => { open = r; });
  const posts: Billing["posts"] = [];
  const ent = () => ({
    token: `fake.jwt.${posts.length}`, premium, premiumUntil: premium ? NOW + 30 * DAY : null, packs: [...packs].sort(), expiresAt: Date.now() + 8 * 3_600_000,
    subscription: premium ? { state: "SUBSCRIPTION_STATE_ACTIVE", basePlanId: "yearly", autoRenewing: true, inTrial: true, expiresAt: NOW + 7 * DAY } : null,
  });
  await page.route("**/api/billing/**", async (route: Route) => {
    const url = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON() as { productId?: string; purchases?: { productId: string }[] } | null;
    if (body) posts.push({ url, body });
    const json = (status: number, j: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(j) });
    if (url.endsWith("/catalog")) return json(200, CATALOG);
    if (url.endsWith("/fake/purchase")) return json(200, { purchaseToken: `fake.x.${body!.productId}.1` });
    if (url.endsWith("/verify")) {
      if (opts.holdVerify) await gate;
      for (const p of body!.purchases!) { if (p.productId === "premium") premium = true; else packs.push(p.productId.slice(5).replaceAll("_", "-")); }
      return json(200, { entitlement: ent(), results: body!.purchases!.map((p) => ({ productId: p.productId, result: "OK" })) }).catch(() => undefined);
    }
    if (url.endsWith("/entitlement")) return json(200, { entitlement: ent() });
    return json(404, { error: "BAD_REQUEST" });
  });
  return { posts, release: open };
}

async function tvPage(browser: Browser, lang: Lang, init?: () => void): Promise<{ ctx: BrowserContext; tv: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript((l) => { try { localStorage.setItem("mishana:locale", l); } catch { /* storage blocked */ } }, lang);
  if (init) await ctx.addInitScript(init);
  const tv = await ctx.newPage();
  return { ctx, tv };
}

async function openLobby(tv: Page): Promise<void> {
  await tv.goto("/tv");
  await expect(tv.locator(".tvlobby .tvcode--big")).toBeVisible({ timeout: 30_000 });
}

const focusId = (p: Page): Promise<string | null> => p.evaluate(() => {
  const a = document.activeElement as HTMLElement | null;
  return a ? (a.getAttribute("data-focus") ?? a.getAttribute("data-lobby") ?? a.getAttribute("data-test") ?? a.className) : null;
});

/** Lobby → Premium (D-pad only; in RTL the bar runs right to left) → the Store with the yearly plan focused. */
async function openStore(tv: Page, lang: Lang): Promise<void> {
  const back = lang === "ar" ? "ArrowRight" : "ArrowLeft";
  for (let i = 0; i < 6 && (await focusId(tv)) !== "premium"; i++) { await tv.keyboard.press(i === 0 ? "ArrowDown" : back); await tv.waitForTimeout(120); }
  expect(await focusId(tv)).toBe("premium");
  await tv.keyboard.press("Enter");
  await expect(tv.locator(".tvshop__body")).toBeVisible();
  await expect.poll(() => focusId(tv)).toBe("plan:yearly");
}

type Box = { top: number; bottom: number; left: number; right: number };
const box = (p: Page, sel: string): Promise<Box | null> => p.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
}, sel);
const overlap = (a: Box, b: Box): boolean => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

/** §4.4 "fits without scrolling": nothing in the Store reaches past the 540 dp canvas, and the card sits above the packs. */
async function expectStoreFits(tv: Page, what: string): Promise<void> {
  const r = await tv.evaluate(() => {
    const canvas = document.querySelector(".tv__canvas")!.getBoundingClientRect();
    const shop = document.querySelector(".tvshop")!;
    let lowest = 0;
    let who = "";
    for (const e of shop.querySelectorAll("*")) {
      const b = e.getBoundingClientRect();
      if (b.height > 0 && b.bottom > lowest) { lowest = b.bottom; who = e.className.toString(); }
    }
    const card = document.querySelector(".tvshop__card")!.getBoundingClientRect();
    const packs = document.querySelector(".tvshop__packs")!.getBoundingClientRect();
    return { canvasBottom: canvas.bottom, lowest, who, cardBottom: card.bottom, packsTop: packs.top };
  });
  expect(r.lowest, `${what}: ${r.who} ends below the canvas`).toBeLessThanOrEqual(r.canvasBottom + 0.5);
  expect(r.cardBottom, `${what}: the Premium card runs into the packs row`).toBeLessThanOrEqual(r.packsTop + 0.5);
}

/** A visible toast covers neither a pack card nor a footer control (DESIGN: never over the focused element). */
async function expectToastClear(tv: Page, what: string): Promise<void> {
  const t = await box(tv, ".tvshop .tvtoast");
  if (!t) return;
  const controls = await tv.evaluate(() => [...document.querySelectorAll(".tvshop__pack, .tvshop__foot button")].map((e) => {
    const r = e.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  }));
  for (const c of controls) expect(overlap(t, c), `${what}: the toast covers a Store control`).toBe(false);
}

for (const lang of ["en", "fr", "ar"] as const) {
  test(`${lang}: the Store fits, the disclosure stays above the packs, the footer row ends where it ends`, async ({ browser }) => {
    const { ctx, tv } = await tvPage(browser, lang);
    await mockBilling(tv);
    await openLobby(tv);
    await openStore(tv, lang);
    await expectStoreFits(tv, `${lang} plans`);
    // §4.5: the trial wording (a new install), at most three lines of 20 sp text.
    const legal = tv.locator(".tvshop__legal");
    await expect(legal).toContainText(text("store.legalCancelTrial", lang));
    const lines = await legal.evaluate((e) => Math.round((e as HTMLElement).offsetHeight / parseFloat(getComputedStyle(e).lineHeight)));
    expect(lines, `${lang} disclosure lines`).toBeLessThanOrEqual(3);
    await expect(tv.locator(".tvshop__badge")).toHaveCount(2);

    // Down to the footer, then along it: Restore → Expire → Refund, and either end of the row stays put.
    const inFoot = (): Promise<boolean> => tv.evaluate(() => !!document.activeElement?.closest(".tvshop__foot"));
    for (let i = 0; i < 4 && !(await inFoot()); i++) { await tv.keyboard.press("ArrowDown"); await tv.waitForTimeout(120); }
    expect(await inFoot(), `${lang}: Down reaches the footer`).toBe(true);
    const fwd = lang === "ar" ? "ArrowLeft" : "ArrowRight";
    const back = lang === "ar" ? "ArrowRight" : "ArrowLeft";
    for (let i = 0; i < 3; i++) { await tv.keyboard.press(back); await tv.waitForTimeout(120); }
    expect(await focusId(tv), `${lang}: Back along the footer stops at Restore`).toBe("restore");
    const path: (string | null)[] = [];
    for (let i = 0; i < 4; i++) { await tv.keyboard.press(fwd); await tv.waitForTimeout(120); path.push(await focusId(tv)); }
    expect(path, `${lang} footer path`).toEqual(["expire", "refund", "refund", "refund"]);
    await tv.keyboard.press("Escape");
    await expect(tv.locator(".tvshop")).toHaveCount(0);
    await ctx.close();
  });
}

for (const lang of ["en", "ar"] as const) {
  test(`${lang}: a plan purchase in flight — only that plan confirms, nothing grows past the canvas, then verifyFailed`, async ({ browser }) => {
    test.setTimeout(90_000);
    const { ctx, tv } = await tvPage(browser, lang);
    const billing = await mockBilling(tv, { holdVerify: true });
    await openLobby(tv);
    await openStore(tv, lang);
    await tv.keyboard.press("Enter"); // yearly
    const yearly = tv.locator('[data-focus="plan:yearly"]');
    const monthly = tv.locator('[data-focus="plan:monthly"]');
    await expect(yearly.locator(".tvshop__busy")).toHaveText(text("store.confirming", lang));
    await expect(monthly.locator(".tvshop__busy")).toHaveCount(0);
    expect((billing.posts.find((p) => p.url.endsWith("/fake/purchase"))?.body as { offerId?: unknown }).offerId).toBe("trial-7d");
    await expectStoreFits(tv, `${lang} plan confirming`);
    // §4.4: after 15 s the button says verifyFailed (one line), and the same sentence is a toast in its own slot.
    await expect(yearly.locator(".tvshop__busy")).toHaveAttribute("title", text("store.verifyFailed", lang), { timeout: 20_000 });
    await expectStoreFits(tv, `${lang} plan verify slow`);
    await expect(tv.locator(".tvshop .tvtoast")).toHaveText(text("store.verifyFailed", lang));
    await expectToastClear(tv, `${lang} plan verify slow`);
    billing.release();
    await expect(tv.locator(".tvshop__active")).toBeVisible();
    await ctx.close();
  });

  test(`${lang}: a pack purchase in flight replaces the Buy label on one line`, async ({ browser }) => {
    test.setTimeout(90_000);
    const { ctx, tv } = await tvPage(browser, lang);
    const billing = await mockBilling(tv, { holdVerify: true });
    await openLobby(tv);
    await openStore(tv, lang);
    for (let i = 0; i < 3 && !((await focusId(tv)) ?? "").startsWith("pack:"); i++) { await tv.keyboard.press("ArrowDown"); await tv.waitForTimeout(120); }
    const id = (await focusId(tv))!;
    expect(id).toMatch(/^pack:/);
    const card = tv.locator(`[data-focus="${id}"]`);
    // Layout height (offsetHeight ignores the focus scale and its transition).
    const height = (): Promise<number> => card.evaluate((e) => (e as HTMLElement).offsetHeight);
    const before = await height();
    await tv.keyboard.press("Enter");
    await expect(card.locator(".tvshop__busy")).toBeVisible();
    await expect(card.locator(".tvshop__buy")).toHaveCount(0);
    const busyLines = async (): Promise<number> => card.locator(".tvshop__busytext").evaluate((e) => Math.round((e as HTMLElement).offsetHeight / parseFloat(getComputedStyle(e).lineHeight)));
    expect(await busyLines()).toBe(1);
    expect(await height()).toBe(before);
    await expectStoreFits(tv, `${lang} pack confirming`);
    await expect(card.locator(".tvshop__busy")).toHaveAttribute("title", text("store.verifyFailed", lang), { timeout: 20_000 });
    expect(await busyLines()).toBe(1);
    expect(await height()).toBe(before);
    await expectStoreFits(tv, `${lang} pack verify slow`);
    await expectToastClear(tv, `${lang} pack verify slow`);
    billing.release();
    await expect(card.locator(".tvshop__chip--ok")).toBeVisible();
    await ctx.close();
  });
}

test("en: no trial offer once this install had Premium — price wording, no badge, no offer id", async ({ browser }) => {
  const { ctx, tv } = await tvPage(browser, "en", () => {
    try {
      const id = "ab".repeat(16);
      localStorage.setItem("mishana:installId", id);
      localStorage.setItem("mishana:trialUsed", id);
    } catch { /* storage blocked */ }
  });
  const billing = await mockBilling(tv);
  await openLobby(tv);
  await openStore(tv, "en");
  const legal = tv.locator(".tvshop__legal");
  await expect(legal).toContainText(text("store.legalCancel"));
  await expect(legal).not.toContainText(text("store.legalCancelTrial"));
  await expect(legal).toContainText("$29.99");
  await expect(tv.locator(".tvshop__badge")).toHaveCount(0);
  await tv.keyboard.press("Enter");
  await expect(tv.locator(".tvshop__active")).toBeVisible();
  expect((billing.posts.find((p) => p.url.endsWith("/fake/purchase"))?.body as { offerId?: unknown }).offerId).toBeNull();
  await ctx.close();
});

// The 20 dp between the grid's last row and the bar cannot hold a 20 sp label, so the focus tooltip of the icon-only
// Premium button overlaps the last row's first tile while focus is on that button; it must at least be drawn on top
// of the tile, on a solid chip, and stay inside the canvas.
for (const lang of ["en", "ar"] as const) {
  test(`${lang}: the icon-only Premium button's tooltip is drawn above the grid and inside the canvas`, async ({ browser }) => {
    const { ctx, tv } = await tvPage(browser, lang);
    await mockBilling(tv);
    await openLobby(tv);
    const back = lang === "ar" ? "ArrowRight" : "ArrowLeft";
    for (let i = 0; i < 6 && (await focusId(tv)) !== "premium"; i++) { await tv.keyboard.press(i === 0 ? "ArrowDown" : back); await tv.waitForTimeout(120); }
    const tip = tv.locator("[data-lobby=premium] .tvtip");
    await expect(tip).toHaveCSS("opacity", "1");
    await expect(tip).toHaveText(text("lobby.premium", lang));
    const onTop = await tip.evaluate((e) => {
      (e as HTMLElement).style.pointerEvents = "auto"; // hit-testing skips pointer-events:none
      const r = e.getBoundingClientRect();
      const pts = [0.2, 0.5, 0.8].flatMap((fx) => [0.3, 0.7].map((fy) => [r.left + fx * r.width, r.top + fy * r.height]));
      return pts.every(([x, y]) => { const hit = document.elementFromPoint(x!, y!); return hit !== null && e.contains(hit); });
    });
    expect(onTop, `${lang}: a tile is drawn over the tooltip`).toBe(true);
    expect(await tip.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toMatch(/rgba\(.*, 0(\.\d+)?\)$/);
    const t = (await box(tv, "[data-lobby=premium] .tvtip"))!;
    const canvas = (await box(tv, ".tv__canvas"))!;
    expect(t.top).toBeGreaterThanOrEqual(canvas.top);
    expect(t.left).toBeGreaterThanOrEqual(canvas.left);
    expect(t.right).toBeLessThanOrEqual(canvas.right);
    await ctx.close();
  });
}
