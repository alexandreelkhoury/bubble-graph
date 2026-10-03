// End-to-end: one TV-mock page plus 4 phone contexts play a full game against `wrangler dev` (§14.3).
// SHOTS_DIR=<dir> also saves screenshots of the key phone and TV screens (EN and AR runs).
import { mkdirSync } from "node:fs";
import { devices, expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

const SHOTS = process.env.SHOTS_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const taken = new Set<string>();

async function shot(page: Page, name: string, force = false): Promise<void> {
  if (!SHOTS || (taken.has(name) && !force)) return;
  taken.add(name);
  await page.waitForTimeout(450); // let the phase transition settle
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function context(browser: Browser, kind: "tv" | "phone", locale: string): Promise<BrowserContext> {
  const ctx = await browser.newContext(
    kind === "tv" ? { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } : { ...devices["Pixel 7"] },
  );
  await ctx.addInitScript((l) => {
    try {
      if (!sessionStorage.getItem("e2e-init")) {
        localStorage.setItem("mishana:locale", l);
        sessionStorage.setItem("e2e-init", "1");
      }
    } catch {
      /* ignore */
    }
  }, locale);
  return ctx;
}

async function openTv(browser: Browser, locale: string): Promise<{ tv: Page; code: string }> {
  const ctx = await context(browser, "tv", locale);
  const tv = await ctx.newPage();
  await tv.goto("/tv");
  const big = tv.locator(".tvlobby .tvcode--big");
  await expect(big).toBeVisible({ timeout: 30_000 });
  const code = ((await big.getAttribute("aria-label")) ?? "").replace(/\s+/g, "");
  expect(code).toMatch(/^[A-Z]{4}$/);
  return { tv, code };
}

async function joinPhone(browser: Browser, code: string, name: string, locale: string): Promise<Page> {
  const ctx = await context(browser, "phone", locale);
  const p = await ctx.newPage();
  await p.goto(`/${code.toLowerCase()}`); // non-canonical case → replaced with upper case
  await expect(p).toHaveURL(new RegExp(`/${code}$`));
  await expect(p.locator("#name")).toBeVisible();
  await p.locator("#name").fill(name);
  await p.locator(".actionbar .btn--primary").click();
  await expect(p.locator(".screen--lobby")).toBeVisible();
  return p;
}

async function visible(page: Page, sel: string): Promise<boolean> {
  return page.locator(sel).first().isVisible().catch(() => false);
}

async function holdCard(p: Page): Promise<void> {
  const card = p.locator(".wordcard");
  const box = await card.boundingBox();
  if (!box) return;
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await expect(p.locator(".wordface")).toBeVisible();
}

async function playFullGame(browser: Browser, locale: string, tag: string): Promise<void> {
  const { tv, code } = await openTv(browser, locale);
  const names = locale === "ar" ? ["رامي", "Léa", "نور", "Sam"] : ["Rami", "Léa", "Nour", "Sam"];
  const phones: Page[] = [];
  // Phone PH-01 home and PH-02 join (before anyone joins).
  if (SHOTS) {
    const ctx = await context(browser, "phone", locale);
    const home = await ctx.newPage();
    await home.goto("/");
    await home.locator("#code").pressSequentially(code.slice(0, 3).toLowerCase());
    await shot(home, `${tag}-phone-01-enter-code`);
    await home.goto(`/${code}`);
    await home.locator("#name").fill(names[0]!);
    await shot(home, `${tag}-phone-02-join`);
    await ctx.close();
  }
  for (const n of names) phones.push(await joinPhone(browser, code, n, locale));
  const [vip, ...others] = phones as [Page, ...Page[]];
  await expect(tv.locator(".tvgrid .tile--btn")).toHaveCount(4);
  await expect(vip.locator(".actionbar .btn--primary")).toBeEnabled();
  await tv.waitForTimeout(700);
  await shot(tv, `${tag}-tv-02-lobby`);
  await shot(vip, `${tag}-phone-03-lobby-vip`);
  await shot(others[0]!, `${tag}-phone-03-lobby-player`);
  if (SHOTS) {
    await vip.locator(".card--link").click();
    await expect(vip.locator(".settings")).toBeVisible();
    await shot(vip, `${tag}-phone-03b-settings`);
    await vip.keyboard.press("Escape");
    await tv.locator(".tvbottom--lobby .tvbtn").first().click();
    await expect(tv.locator(".tvsettings")).toBeVisible();
    await tv.waitForTimeout(500);
    await shot(tv, `${tag}-tv-03-settings`);
    await tv.keyboard.press("Escape");
    await expect(tv.locator(".tvlobby")).toBeVisible();
  }

  // START from the VIP phone.
  await vip.locator(".actionbar .btn--primary").click();
  await expect(tv.locator(".tvreveal")).toBeVisible();
  for (const [i, p] of phones.entries()) {
    await expect(p.locator(".wordcard")).toBeVisible();
    if (i === 0) await shot(p, `${tag}-phone-04-reveal-hidden`);
    await holdCard(p);
    if (i === 0) await shot(p, `${tag}-phone-04-reveal-held`);
    await p.mouse.up();
    await expect(p.locator(".wordface")).toHaveCount(0);
    if (i < 3) {
      await p.locator(".actionbar .btn--primary").click();
      await expect(p.locator(".waiting--ok")).toBeVisible();
    }
  }
  await tv.waitForTimeout(500);
  await shot(tv, `${tag}-tv-04-role-reveal`);
  // Resume: reload one phone mid-game, it must come back to its seat (not the Join form).
  const last = phones[3]!;
  await last.reload();
  // Back on its seat: role reveal again, or already the clues if everyone connected was ready.
  await expect(last.locator(".wordcard, .screen--clues, .screen--turn").first()).toBeVisible();
  await expect(last.locator("#name")).toHaveCount(0);
  if (await visible(last, ".wordcard")) {
    await holdCard(last);
    await last.mouse.up();
    await last.locator(".actionbar .btn--primary").click();
  }

  // Main loop: speakers tap Done, everyone votes for the first listed candidate, the Blank guesses wrong.
  const deadline = Date.now() + 200_000;
  let sawVote = false;
  let sawElim = false;
  while (Date.now() < deadline) {
    if (await visible(tv, ".tvresults")) break;
    if (await visible(tv, ".tvclues")) {
      await shot(tv, `${tag}-tv-05-clues`);
      if (await visible(tv, ".tvtie")) await shot(tv, `${tag}-tv-08-tie`);
    }
    if (await visible(tv, ".tvvote")) await shot(tv, `${tag}-tv-06-voting`);
    if (await visible(tv, ".tvelim") && !sawElim) {
      sawElim = true;
      await tv.waitForTimeout(1300);
      await shot(tv, `${tag}-tv-07-vote-reveal`);
      await tv.waitForTimeout(4200);
      await shot(tv, `${tag}-tv-09-elimination`);
      for (const p of phones) {
        if (await visible(p, ".screen--elim")) { await shot(p, `${tag}-phone-08b-elimination`); break; }
      }
      for (const p of phones) {
        if (await visible(p, ".outpanel--me")) { await shot(p, `${tag}-phone-10-eliminated`); break; }
      }
    }
    if (await visible(tv, ".tvguess")) await shot(tv, `${tag}-tv-10-guess`);
    for (const p of phones) {
      if (await visible(p, ".donebtn.is-armed")) {
        await shot(p, `${tag}-phone-06-your-turn`);
        await p.locator(".donebtn").click();
        continue;
      }
      if (await visible(p, ".screen--clues .speaker")) await shot(p, `${tag}-phone-05-clues`);
      if (await visible(p, ".screen--out")) await shot(p, `${tag}-phone-10-out`);
      if (await visible(p, ".voterow")) {
        sawVote = true;
        await p.locator(".voterow").first().click();
        await shot(p, `${tag}-phone-07-vote`);
        await p.locator(".actionbar .btn--primary").click();
        await expect(p.locator(".screen--locked, .screen--looktv, .screen--elim, .outpanel, .screen--watch, .screen--guess, .screen--clues").first()).toBeVisible();
        if (await visible(p, ".screen--locked")) await shot(p, `${tag}-phone-08-vote-locked`);
        continue;
      }
      if (await visible(p, ".input--big")) {
        await shot(p, `${tag}-phone-11-guess`);
        await p.locator(".input--big").fill("zzwrong");
        await p.locator(".actionbar .btn--primary").click();
        continue;
      }
      if (await visible(p, ".screen--watch")) await shot(p, `${tag}-phone-12-watch`);
    }
    await tv.waitForTimeout(250);
  }
  expect(sawVote).toBe(true);
  await expect(tv.locator(".tvresults")).toBeVisible();
  await shot(tv, `${tag}-tv-11-results-stage1`);
  await expect(tv.locator(".tvresults.is-stage2")).toBeVisible({ timeout: 10_000 });
  await tv.waitForTimeout(900);
  await shot(tv, `${tag}-tv-11-results`);
  for (const p of phones) await expect(p.locator(".screen--results")).toBeVisible();
  await vip.waitForTimeout(1200);
  await shot(vip, `${tag}-phone-13-results-vip`);
  await shot(others[1]!, `${tag}-phone-13-results-player`);

  // The pause menu on the TV (local only).
  if (SHOTS) {
    await tv.keyboard.press("Escape");
    await expect(tv.locator(".tvdialog--menu")).toBeVisible();
    await shot(tv, `${tag}-tv-12-pause`);
    await tv.keyboard.press("Escape");
  }

  // Play again from the VIP phone → everyone is back in the lobby with their scores.
  await vip.locator(".actionbar .btn--primary").click();
  for (const p of phones) await expect(p.locator(".screen--lobby")).toBeVisible();
  await expect(tv.locator(".tvlobby")).toBeVisible();

  // Kick from the VIP phone → the kicked phone lands on PH-14 Kicked.
  await vip.locator(".plist__row--btn").last().click();
  await vip.locator(".sheet .btn--danger").click();
  await expect(phones[3]!.locator(".screen--end")).toBeVisible();
  await shot(phones[3]!, `${tag}-phone-14-kicked`);

  for (const p of [...phones, tv]) await p.context().close();
}

test("4 players + TV mock play a full game (EN)", async ({ browser }) => {
  await playFullGame(browser, "en", "en");
});

test("full game in Arabic (RTL)", async ({ browser }) => {
  test.skip(!SHOTS && !process.env.E2E_AR, "the AR run is for screenshots; set SHOTS_DIR or E2E_AR=1");
  await playFullGame(browser, "ar", "ar");
});
