// Owner report (2026-11-15): on a phone the Join screen's "Let me in!" button disappeared while typing the name and
// only flashed when a character was tapped. The on-screen keyboard covers the page (only the visual viewport shrinks)
// and the sticky action bar sat under it. Here, on a phone viewport: the button is always mounted and visible, says why
// it is disabled, stays put while characters are tapped, and rides above a (simulated) keyboard.
import { devices, expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

const KB = 330;   // the simulated keyboard's height

async function roomCode(browser: Browser): Promise<string> {
  const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await tv.goto("/tv");
  const big = tv.locator(".tvjoin .tvcode");
  await expect(big).toBeVisible({ timeout: 30_000 });
  return ((await big.getAttribute("aria-label")) ?? "").replace(/\s+/g, "");
}

/** A phone page; with `keyboard`, window.visualViewport reports a keyboard of KB px over the page. */
async function phone(browser: Browser, code: string, keyboard: boolean): Promise<Page> {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(({ kb, on }) => {
    try { localStorage.setItem("jamaa:locale", "en"); } catch { /* ignore */ }
    if (!on) return;
    const t = new EventTarget();
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: Object.defineProperties(t, { height: { get: () => document.documentElement.clientHeight - kb }, offsetTop: { value: 0 }, width: { value: 390 }, scale: { value: 1 } }),
    });
  }, { kb: KB, on: keyboard });
  const page = await ctx.newPage();
  await page.goto(`/${code}`);
  await expect(page.locator("#name")).toBeVisible();
  return page;
}

test("Join on a phone: the button never hides, says why it is disabled, and sits above the keyboard", async ({ browser }) => {
  const code = await roomCode(browser);
  const page = await phone(browser, code, false);
  const btn = page.locator(".actionbar .btn--primary");
  await page.locator("#name").fill("");
  await expect(btn).toBeVisible();
  await expect(btn).toBeDisabled();
  await expect(page.locator("#join-why")).toBeVisible();
  await page.locator("#name").fill("Rami");
  const box = await btn.boundingBox();
  for (const i of [3, 5, 0, 7]) {
    await page.locator(".charpick").nth(i).click();
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    await expect(btn).toBeInViewport();
    expect(await btn.boundingBox()).toEqual(box);   // the bar does not move or blink on a character tap
  }
  await expect(page.locator("#join-why")).toHaveCount(0);
  await btn.click();
  await expect(page.locator(".screen--hub").first()).toBeVisible();

  // The keyboard covers the bottom KB px of the page: the bar is lifted right above it.
  const kb = await phone(browser, code, true);
  await kb.locator("#name").fill("Lina");
  const b = await kb.locator(".actionbar .btn--primary").boundingBox();
  const vh = kb.viewportSize()!.height;
  expect(b).not.toBeNull();
  expect(b!.y + b!.height).toBeLessThanOrEqual(vh - KB);
  expect(b!.y).toBeGreaterThan(0);
});
