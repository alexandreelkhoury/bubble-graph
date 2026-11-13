// Regression: hub → OK on a poster → setup → Back (the Android activity forwards the remote's Back as a synthetic
// keydown Escape on `window`) → the TV must leave the setup screen for the hub and keep the poster it came from.
// Runs on the DOM mock (/tv) and on the Pixi skin (/tv-pixi); keyboard only, no phones (the TV is the host).
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

for (const path of ["/tv", "/tv-pixi"]) {
  test(`setup → Back → hub keeps the opened game (${path})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const tv = await ctx.newPage();
    const sent: { a?: { type?: string; gameId?: string } }[] = [];
    tv.on("websocket", (ws) => ws.on("framesent", (f) => {
      try { const m = JSON.parse(String(f.payload)) as { t?: string; a?: { type?: string; gameId?: string } }; if (m.t === "action") sent.push(m); } catch { /* not JSON */ }
    }));
    await tv.goto(path);
    const hubUp = path === "/tv" ? tv.locator(".tvposter.is-focused") : tv.locator(".tvpixi canvas");
    await expect(hubUp).toBeVisible({ timeout: 30_000 });
    await tv.waitForTimeout(1500); // the splash and the first-frame input guard

    await tv.keyboard.press("ArrowRight");
    await tv.waitForTimeout(300);
    await tv.keyboard.press("ArrowRight");
    await tv.waitForTimeout(500);
    await tv.keyboard.press("Enter");
    await expect(tv.locator(".tvsetup")).toBeVisible({ timeout: 15_000 });
    const opened = sent.find((m) => m.a?.type === "OPEN_GAME")?.a?.gameId;
    expect(opened).toBeTruthy();
    await tv.waitForTimeout(1500); // the portal hand-off, the first-time intro

    // Back until the setup screen is gone (the first Back may close the intro sheet): exactly what the remote does.
    for (let i = 0; i < 3 && (await tv.locator(".tvsetup").count()) > 0; i++) {
      await backKey(tv);
      await tv.waitForTimeout(1200);
    }
    expect(sent.some((m) => m.a?.type === "CLOSE_GAME")).toBe(true);
    await expect(tv.locator(".tvsetup")).toHaveCount(0, { timeout: 10_000 });
    await expect(hubUp).toBeVisible();

    // The hub still stands on the poster we came from: OK opens that game again (not the first one).
    await tv.waitForTimeout(2500); // the reverse portal and the input guard
    sent.length = 0;
    await tv.keyboard.press("Enter");
    await expect.poll(() => sent.find((m) => m.a?.type === "OPEN_GAME")?.a?.gameId ?? null, { timeout: 10_000 }).toBe(opened);
    await ctx.close();
  });
}

/** The Android WebView app's Back: a synthetic KeyboardEvent dispatched on `window`. */
async function backKey(page: Page): Promise<void> {
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
}
