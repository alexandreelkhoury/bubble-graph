// JAMAA-PLATFORM §6 acceptance 7 (lane B), against a `wrangler dev` with the production default BILLING_ENABLED "0"
// (the "billing-off" Playwright project): no Pass UI anywhere (TV hub, setup, pack picker, phones), the billing and
// admin routes answer 404, setup locks no pack, and a game starts on a pack that is premium when billing is on.
// The TV is driven by the keyboard D-pad and OK only.
import { devices, expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

const PASS_TEXT = /JAMAA Pass|\bPass\b|premium/i;

async function context(browser: Browser, kind: "tv" | "phone"): Promise<BrowserContext> {
  const ctx = await browser.newContext(kind === "tv"
    ? { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }
    : { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    try {
      if (!sessionStorage.getItem("e2e-init")) {
        localStorage.setItem("jamaa:locale", "en");
        localStorage.setItem("jamaa:tv:introSeen:mishana", "1");
        sessionStorage.setItem("e2e-init", "1");
      }
    } catch { /* ignore */ }
  });
  return ctx;
}

const press = async (tv: Page, key: string, n = 1): Promise<void> => {
  for (let i = 0; i < n; i++) { await tv.keyboard.press(key); await tv.waitForTimeout(150); }
};
async function dpadTo(tv: Page, sel: string, key: string, max = 12): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await tv.locator(sel).evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await tv.keyboard.press(key);
    await tv.waitForTimeout(150);
  }
  await expect(tv.locator(sel)).toBeFocused();
}
async function noPassUi(p: Page, where: string): Promise<void> {
  await expect(p.locator("[data-pass], .tvshop, .tvpass, .tvpasschip, [data-locked-pack]"), where).toHaveCount(0);
  const text = await p.locator("body").innerText();
  expect(text, `${where}: Pass or premium text`).not.toMatch(PASS_TEXT);
}

interface SetupFrame { availablePacks: { id: string; tier: string }[]; lockedPacks: unknown[]; settings: { packIds?: string[] } }

test("BILLING_ENABLED=0: no Pass UI on the TV or the phones, nothing locked, a premium pack plays", async ({ browser, request }) => {
  test.setTimeout(240_000);
  // The billing and admin routes do not exist.
  for (const path of ["/api/billing/catalog", "/api/billing/entitlement", "/api/admin/grants"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }

  const tvCtx = await context(browser, "tv");
  const tv = await tvCtx.newPage();
  let setup: SetupFrame | null = null;
  tv.on("websocket", (ws) => ws.on("framereceived", (f) => {
    if (typeof f.payload !== "string" || !f.payload.includes('"availablePacks"')) return;
    try { const s = JSON.parse(f.payload)?.view?.room?.setup as SetupFrame | null; if (s) setup = s; } catch { /* ignore */ }
  }));
  await tv.goto("/tv");
  const big = tv.locator(".tvjoin .tvcode");
  await expect(big).toBeVisible({ timeout: 30_000 });
  const code = ((await big.getAttribute("aria-label")) ?? "").replace(/\s+/g, "");
  await expect(tv.locator(".tvposter.is-focused")).toBeFocused();

  const phones: Page[] = [];
  for (const name of ["Nora", "Sami", "Tala"]) {
    const page = await (await context(browser, "phone")).newPage();
    await page.goto(`/${code}`);
    await page.locator("#name").fill(name);
    await page.locator(".actionbar .btn--primary").click();
    await expect(page.locator(".screen--hub")).toBeVisible();
    phones.push(page);
  }
  await expect(tv.locator(".tvmember")).toHaveCount(3);
  await noPassUi(tv, "TV hub");
  for (const p of phones) await noPassUi(p, "phone hub");

  // Setup: every pack is available, none locked.
  await press(tv, "Enter");
  await expect(tv.locator(".tvsetup")).toBeVisible();
  await expect(tv.locator(".tvportal")).toHaveCount(0);
  await expect.poll(() => setup !== null).toBe(true);
  const s0 = setup as unknown as SetupFrame;
  expect(s0.lockedPacks).toEqual([]);
  const premium = s0.availablePacks.find((p) => p.tier === "premium");
  expect(premium, "a pack that is premium with billing on is available").toBeTruthy();
  await noPassUi(tv, "TV setup");
  for (const p of phones) await noPassUi(p, "phone setup");

  // Pack picker: turn the premium pack on, then every other pack off, so the game must deal from it.
  await tv.waitForTimeout(500);
  await dpadTo(tv, "[data-row=packIds]", "ArrowUp");
  await tv.waitForTimeout(450);
  await press(tv, "Enter");
  await expect(tv.locator(".tvpack").first()).toBeVisible();
  await noPassUi(tv, "TV pack picker");
  await tv.waitForTimeout(450);
  const row = (id: string): string => `[data-pack-row="${id}"]`;
  await dpadTo(tv, row(premium!.id), "ArrowDown", 30);
  if ((await tv.locator(row(premium!.id)).getAttribute("aria-checked")) !== "true") await press(tv, "Enter");
  await expect(tv.locator(row(premium!.id))).toHaveAttribute("aria-checked", "true");
  for (const p of s0.availablePacks) {
    if (p.id === premium!.id) continue;
    const r = tv.locator(row(p.id));
    if ((await r.getAttribute("aria-checked")) !== "true") continue;
    const dir = (await r.boundingBox())!.y < (await tv.locator(row(premium!.id)).boundingBox())!.y ? "ArrowUp" : "ArrowDown";
    await dpadTo(tv, row(p.id), dir, 30);
    await press(tv, "Enter");
    await expect(r).toHaveAttribute("aria-checked", "false");
  }
  // Only the premium pack is on in this content language (packIds may keep other languages' packs).
  await expect.poll(() => (setup as SetupFrame | null)?.settings.packIds ?? []).toContain(premium!.id);
  const on = await tv.locator('[data-pack-row][aria-checked="true"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-pack-row")));
  expect(on).toEqual([premium!.id]);
  await press(tv, "Escape");
  await expect(tv.locator(".tvpack")).toHaveCount(0);

  // Start (OK) → the game runs on the premium pack.
  await tv.waitForTimeout(450);
  await dpadTo(tv, "[data-start]", "ArrowDown");
  await press(tv, "Enter");
  await expect(tv.locator(".tvgamehost")).toBeVisible({ timeout: 15_000 });
  for (const p of phones) await expect(p.locator(".screen--setup, .screen--join")).toHaveCount(0);
  await noPassUi(tv, "TV in game");
  for (const p of [...phones, tv]) await p.context().close();
});
