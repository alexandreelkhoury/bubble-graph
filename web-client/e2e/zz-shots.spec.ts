// TEMPORARY (lane B screenshot pass, deleted after): every new platform screen on /tv and the phone in EN/AR/ES.
import { mkdirSync } from "node:fs";
import { devices, expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

const ROOT = process.env.SHOTS_DIR ?? "/tmp/shots";
const LOCALES = (process.env.SHOT_LOCALES ?? "en,ar,es").split(",");

async function ctx(browser: Browser, kind: "tv" | "phone", locale: string): Promise<Page> {
  const c = await browser.newContext(kind === "tv"
    ? { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }
    : { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await c.addInitScript((l) => {
    try { if (!sessionStorage.getItem("i")) { localStorage.setItem("jamaa:locale", l); sessionStorage.setItem("i", "1"); } } catch { /* */ }
  }, locale);
  return c.newPage();
}
const press = async (p: Page, k: string, n = 1): Promise<void> => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(140); } };
const vis = (p: Page, s: string): Promise<boolean> => p.locator(s).first().isVisible().catch(() => false);
async function dpadTo(tv: Page, sel: string, key: string, max = 10): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await tv.locator(sel).first().evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await press(tv, key);
  }
}

for (const L of LOCALES) {
  test(`shots ${L}`, async ({ browser }) => {
    const dir = `${ROOT}/${L}`;
    const END = L === "ar" ? "ArrowLeft" : "ArrowRight", START = L === "ar" ? "ArrowRight" : "ArrowLeft";
    mkdirSync(dir, { recursive: true });
    const snap = async (p: Page, name: string, wait = 350): Promise<void> => { await p.waitForTimeout(wait); await p.screenshot({ path: `${dir}/${name}.png` }); };

    const tv = await ctx(browser, "tv", L);
    await tv.goto("/tv");
    await snap(tv, "tv-01-splash", 500);
    const big = tv.locator(".tvjoin .tvcode");
    await expect(big).toBeVisible({ timeout: 30_000 });
    const code = ((await big.getAttribute("aria-label")) ?? "").replace(/\s+/g, "");
    await snap(tv, "tv-02-hub-empty", 900);

    // Phones: the first one shows the character picker.
    const names = L === "ar" ? ["ليلى", "كريم", "نور", "سامي"] : L === "es" ? ["Lucía", "Mateo", "Sofía", "Diego"] : ["Leila", "Karim", "Nour", "Sami"];
    const phones: Page[] = [];
    for (const [i, n] of names.entries()) {
      const p = await ctx(browser, "phone", L);
      await p.goto(`/${code}`);
      await p.locator("#name").fill(n);
      if (i === 0) await snap(p, "ph-01-join-characters");
      await p.locator(".actionbar .btn--primary").click();
      await expect(p.locator(".screen--hub")).toBeVisible();
      phones.push(p);
    }
    await snap(phones[0]!, "ph-02-hub-vip", 600);
    await snap(phones[1]!, "ph-02-hub-follow");
    await phones[1]!.locator(".topbar__rules").click();
    await snap(phones[1]!, "ph-02c-hub-rules");
    await phones[1]!.keyboard.press("Escape");
    await snap(tv, "tv-03-hub-gang", 2600);
    await press(tv, END);
    await snap(tv, "tv-03b-hub-focus-next", 700);
    await press(tv, START);
    await tv.waitForTimeout(600);

    // Hub ⓘ (rules + How JAMAA works), Settings, Close confirm, the Pass store.
    await press(tv, "i");
    await snap(tv, "tv-04-hub-rules");
    await press(tv, "ArrowDown", 6);
    await snap(tv, "tv-04b-hub-rules-scrolled");
    await press(tv, "Escape");
    await press(tv, "ArrowUp");
    await dpadTo(tv, ".tvhubtop__end .tvround:last-child", END, 4);
    await press(tv, "Enter");
    await snap(tv, "tv-05-hub-settings");
    await press(tv, "Escape");
    await press(tv, "ArrowDown");
    await press(tv, "Escape");
    await snap(tv, "tv-06-close-confirm");
    await press(tv, "Escape");
    if (await tv.locator("[data-pass]").count()) {
      await press(tv, "ArrowUp");
      await dpadTo(tv, "[data-pass]", END, 4);
      await press(tv, "Enter");
      await snap(tv, "tv-07-pass-store", 900);
      await press(tv, END);
      await snap(tv, "tv-07b-pass-store-monthly");
      await press(tv, "Escape");
      await press(tv, "ArrowDown");
    }

    // Portal → first-time intro (full screen) → setup.
    await tv.waitForTimeout(500);
    await press(tv, "Enter");
    await tv.waitForTimeout(220);
    await tv.screenshot({ path: `${dir}/tv-08a-portal-mid.png` });
    await tv.waitForTimeout(250);
    await tv.screenshot({ path: `${dir}/tv-08b-portal-late.png` });
    await expect(tv.locator("[data-intro]")).toBeVisible();
    await snap(tv, "tv-09-intro-1", 900);
    await snap(phones[1]!, "ph-03-setup-intro-sheet", 200);
    await press(tv, "Enter");
    await snap(tv, "tv-09b-intro-2");
    for (let i = 0; i < 6 && (await vis(tv, "[data-intro-next]")); i++) await press(tv, "Enter");
    await snap(tv, "tv-09c-intro-last");
    await press(tv, "Enter");
    await snap(tv, "tv-10-setup", 900);
    for (const p of phones) {
      for (let i = 0; i < 6 && (await vis(p, ".introsheet")); i++) {
        const skip = p.locator(".introsheet__skip");
        if (await skip.isVisible().catch(() => false)) await skip.click(); else await p.locator(".introsheet .btn").first().click();
        await p.waitForTimeout(150);
      }
    }
    await snap(phones[0]!, "ph-04-setup-vip");
    await snap(phones[1]!, "ph-04b-setup-follow");
    await press(tv, "i");
    await snap(tv, "tv-11-setup-rules");
    await press(tv, "Escape");
    await tv.waitForTimeout(300);
    await tv.locator("[data-howto]").evaluate((el) => (el as HTMLElement).focus());
    await press(tv, END);
    await dpadTo(tv, "[data-row=packIds]", "ArrowDown", 6);
    if (await tv.locator("[data-row=packIds]").evaluate((el) => el === document.activeElement).catch(() => false)) {
      await press(tv, "Enter");
      await snap(tv, "tv-12-packs");
      await press(tv, "Escape");
    }
    await dpadTo(tv, "[data-row=advanced]", "ArrowDown", 4);
    if (await tv.locator("[data-row=advanced]").evaluate((el) => el === document.activeElement).catch(() => false)) {
      await press(tv, "Enter");
      await snap(tv, "tv-13-advanced");
      await press(tv, "Escape");
    }

    // Start → the world entrance; the phones flood.
    await dpadTo(tv, "[data-start]", "ArrowDown", 6);
    await press(tv, "Enter");
    await tv.waitForTimeout(450);
    await tv.screenshot({ path: `${dir}/tv-14a-entrance-door.png` });
    await phones[1]!.screenshot({ path: `${dir}/ph-05-flood.png` });
    await tv.waitForTimeout(700);
    await tv.screenshot({ path: `${dir}/tv-14b-entrance-title.png` });
    await tv.waitForTimeout(450);
    await tv.screenshot({ path: `${dir}/tv-14c-entrance-cast.png` });
    await snap(tv, "tv-15-ingame", 1500);
    await snap(phones[1]!, "ph-06-ingame-coach", 200);

    // A late joiner is benched.
    const late = await ctx(browser, "phone", L);
    await late.goto(`/${code}`);
    await late.locator("#name").fill(L === "ar" ? "رامي" : "Rami");
    await late.locator(".actionbar .btn--primary").click();
    await expect(late.locator(".screen--benched")).toBeVisible();
    await snap(late, "ph-07-benched");

    // Pause menu → Rules (in game, 360 dp).
    await press(tv, "Escape");
    await snap(tv, "tv-16-pause");
    await dpadTo(tv, "[data-pause-rules]", "ArrowDown", 6);
    await press(tv, "Enter");
    await snap(tv, "tv-17-ingame-rules");
    await press(tv, "Escape");

    // Phone ⓘ mid-game.
    await phones[2]!.locator(".topbar__rules").click();
    if (await vis(phones[2]!, ".rsheet")) { await snap(phones[2]!, "ph-08-rules-sheet"); await phones[2]!.keyboard.press("Escape"); }

    // Play to results.
    const deadline = Date.now() + 200_000;
    while (Date.now() < deadline && !(await vis(tv, "[data-results-bar]"))) {
      for (const p of phones) {
        if (await vis(p, ".wordcard")) {
          const box = await p.locator(".wordcard").boundingBox();
          if (box) { await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(200); await p.mouse.up(); }
          await p.locator(".actionbar .btn--primary").click().catch(() => undefined);
          continue;
        }
        if (await vis(p, ".donebtn.is-armed")) { await p.locator(".donebtn").click().catch(() => undefined); continue; }
        if (await vis(p, ".voterow")) { await p.locator(".voterow").first().click().catch(() => undefined); await p.locator(".actionbar .btn--primary").click().catch(() => undefined); continue; }
        if (await vis(p, ".input--big")) { await p.locator(".input--big").fill("zzwrong"); await p.locator(".actionbar .btn--primary").click().catch(() => undefined); }
      }
      await tv.waitForTimeout(250);
    }
    await tv.waitForTimeout(250);
    await tv.screenshot({ path: `${dir}/tv-18a-cup-flight.png` });
    await snap(tv, "tv-18-results-cup", 1800);
    await snap(phones[0]!, "ph-09-results-vip");
    await phones[1]!.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await snap(phones[1]!, "ph-09b-results-cup");
    await dpadTo(tv, "[data-back-hub]", END, 4);
    await press(tv, "Enter");
    await snap(tv, "tv-19-portal-back", 100);
    await snap(tv, "tv-20-hub-cup", 1200);
    await press(tv, "ArrowUp");
    await dpadTo(tv, ".tvcupchip", START, 4);
    await press(tv, "Enter");
    await snap(tv, "tv-21-cup-sheet");
    await press(tv, "Escape");
    await snap(phones[1]!, "ph-10-hub-after", 300);
    // Reactions on the hub (phone tap → TV burst).
    await phones[1]!.locator(".reactbar__btn").first().click().catch(() => undefined);
    await phones[2]!.locator(".reactbar__btn").nth(4).click().catch(() => undefined);
    await tv.waitForTimeout(250);
    await tv.screenshot({ path: `${dir}/tv-22-reactions.png` });
    await phones[1]!.screenshot({ path: `${dir}/ph-11-reaction.png` });
    for (const p of [...phones, late, tv]) await p.context().close();
  });
}
