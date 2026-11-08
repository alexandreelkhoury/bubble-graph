// JAMAA-PLATFORM §6.4 acceptance 5 (lane B): the /tv mock driven by the keyboard D-pad, OK, Back and `i` ONLY (no
// clicks on the TV), with phones joining and playing Mish Ana! inside the platform, against `wrangler dev`.
// Covers: hub → focus mirrored on phones; open Mish Ana! → first-time how-to → Start → full game → results →
// Play again → (benched late joiner dealt in) → Back → Rules → Back returns to the game, timers keep running → Quit
// (confirm, focus "Keep playing") → setup → hub; OK ×3 on a poster lands on HUB-03 never PLAYING; hub Back →
// "Close JAMAA?" focused on Stay; hub ⓘ = focused game's rules + "How JAMAA works"; setup ⓘ; the AR (RTL) run with
// Other games → hub; no secret word in any TV frame. SHOTS_DIR=<dir> saves screenshots.
import { mkdirSync } from "node:fs";
import { devices, expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

const SHOTS = process.env.SHOTS_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function context(browser: Browser, kind: "tv" | "phone", locale: string): Promise<BrowserContext> {
  const ctx = await browser.newContext(kind === "tv"
    ? { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }
    : { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((l) => {
    try {
      if (!sessionStorage.getItem("e2e-init")) { localStorage.setItem("jamaa:locale", l); sessionStorage.setItem("e2e-init", "1"); }
    } catch { /* ignore */ }
  }, locale);
  return ctx;
}

/** The TV page plus every WS frame it receives (for the secrecy check). */
async function openTv(browser: Browser, locale: string): Promise<{ tv: Page; code: string; frames: string[] }> {
  const ctx = await context(browser, "tv", locale);
  const tv = await ctx.newPage();
  const frames: string[] = [];
  tv.on("websocket", (ws) => ws.on("framereceived", (f) => { if (typeof f.payload === "string") frames.push(f.payload); }));
  await tv.goto("/tv");
  const big = tv.locator(".tvjoin .tvcode");
  await expect(big).toBeVisible({ timeout: 30_000 });
  const code = ((await big.getAttribute("aria-label")) ?? "").replace(/\s+/g, "");
  expect(code).toMatch(/^[A-Z]{4}$/);
  await expect(tv.locator(".tvposter.is-focused")).toBeFocused();
  return { tv, code, frames };
}

async function joinPhone(browser: Browser, code: string, name: string, locale: string, expectSel = ".screen--hub"): Promise<{ page: Page; words: Set<string> }> {
  const ctx = await context(browser, "phone", locale);
  const page = await ctx.newPage();
  const words = new Set<string>();
  page.on("websocket", (ws) => ws.on("framereceived", (f) => {
    if (typeof f.payload !== "string" || !f.payload.includes('"word"')) return;
    try {
      const w = JSON.parse(f.payload)?.view?.game?.me?.word?.text;
      if (typeof w === "string") words.add(w);
    } catch { /* ignore */ }
  }));
  await page.goto(`/${code}`);
  await page.locator("#name").fill(name);
  await page.locator(".actionbar .btn--primary").click();
  await expect(page.locator(expectSel).first()).toBeVisible();
  return { page, words };
}

const press = async (tv: Page, key: string, n = 1): Promise<void> => {
  for (let i = 0; i < n; i++) { await tv.keyboard.press(key); await tv.waitForTimeout(120); }
};
/** Moves focus with the D-pad until `sel` is focused (or fails). */
async function dpadTo(tv: Page, sel: string, key: string, max = 8): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await tv.locator(sel).evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await tv.keyboard.press(key);
    await tv.waitForTimeout(150);
  }
  await expect(tv.locator(sel)).toBeFocused();
}
async function visible(p: Page, sel: string): Promise<boolean> {
  return p.locator(sel).first().isVisible().catch(() => false);
}

/** Opens Mish Ana! from the hub with OK, walks the first-time intro with OK, and lands on HUB-03. */
async function openGameWithRemote(tv: Page, introExpected: boolean): Promise<void> {
  await press(tv, "Enter");
  await expect(tv.locator(".tvsetup")).toBeVisible();
  if (introExpected) {
    await expect(tv.locator("[data-intro]")).toBeVisible();
    await shot(tv, "tv-intro");
    for (let i = 0; i < 6 && (await visible(tv, "[data-intro-next]")); i++) await press(tv, "Enter");
    await expect(tv.locator("[data-intro-done]")).toBeFocused();
    await press(tv, "Enter");
    await expect(tv.locator("[data-intro]")).toHaveCount(0);
    await expect(tv.locator("[data-howto]")).toBeFocused(); // first visit: focus returns to the how-to pane
  }
}

/** Plays the running Mish Ana! game to its results with the phones (TV untouched). */
async function playToResults(tv: Page, phones: Page[]): Promise<void> {
  // Reveal: hold the card, then "Got it".
  for (const p of phones) {
    if (!(await visible(p, ".wordcard"))) continue;
    const box = await p.locator(".wordcard").boundingBox();
    if (box) { await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(250); await p.mouse.up(); }
    if (await visible(p, ".actionbar .btn--primary")) await p.locator(".actionbar .btn--primary").click().catch(() => undefined);
  }
  const deadline = Date.now() + 200_000;
  while (Date.now() < deadline) {
    if (await visible(tv, "[data-results-bar]")) return;
    for (const p of phones) {
      if (await visible(p, ".wordcard")) {
        const box = await p.locator(".wordcard").boundingBox();
        if (box) { await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(200); await p.mouse.up(); }
        await p.locator(".actionbar .btn--primary").click().catch(() => undefined);
        continue;
      }
      if (await visible(p, ".donebtn.is-armed")) { await p.locator(".donebtn").click().catch(() => undefined); continue; }
      if (await visible(p, ".voterow")) {
        await p.locator(".voterow").first().click().catch(() => undefined);
        await p.locator(".actionbar .btn--primary").click().catch(() => undefined);
        continue;
      }
      if (await visible(p, ".input--big")) {
        await p.locator(".input--big").fill("zzwrong");
        await p.locator(".actionbar .btn--primary").click().catch(() => undefined);
      }
    }
    await tv.waitForTimeout(250);
  }
  throw new Error("the game did not reach its results");
}

test("remote-only platform tour (EN): hub, intro, full game, cup, replay, benched join, rules in game, quit, hub", async ({ browser }) => {
  test.setTimeout(480_000);
  const { tv, code, frames } = await openTv(browser, "en");
  const joined = [];
  for (const n of ["Rami", "Lina", "Karim"]) joined.push(await joinPhone(browser, code, n, "en"));
  const phones = joined.map((j) => j.page);
  await expect(tv.locator(".tvmember")).toHaveCount(3);
  // Hub focus is mirrored on the phones (PHH-02): every phone shows the TV's focused game.
  const focused = await tv.locator(".tvposter.is-focused").getAttribute("data-game");
  for (const p of phones) await expect(p.locator(".hubph__card .poster")).toHaveAttribute("data-world", "night-market");
  expect(focused).toBe("mishana");
  await shot(tv, "en-tv-hub");
  await shot(phones[0]!, "en-phone-hub-vip");

  // HUB-07 from the hub: `i` opens the focused game's rules ending with "How JAMAA works"; Back closes it.
  await press(tv, "i");
  await expect(tv.locator(".tvrules[data-rules=mishana]")).toBeVisible();
  await expect(tv.locator(".tvrules .rules__jamaa")).toBeVisible();
  await expect(tv.locator("[data-rules-close]")).toBeFocused();
  await press(tv, "Escape");
  await expect(tv.locator(".tvrules")).toHaveCount(0);
  // Up from the carousel → ⓘ (always), OK opens the same sheet; Down returns to the poster.
  await press(tv, "ArrowUp");
  await expect(tv.locator("[data-hub-info]")).toBeFocused();
  await press(tv, "Enter");
  await expect(tv.locator(".tvrules .rules__jamaa")).toBeVisible();
  await press(tv, "Escape");
  await press(tv, "ArrowDown");
  await expect(tv.locator(".tvposter.is-focused")).toBeFocused();

  // Hub Back → "Close JAMAA?" with the initial focus on Stay; Stay keeps the room.
  await press(tv, "Escape");
  await expect(tv.locator(".tvdialog")).toBeVisible();
  await expect(tv.locator(".tvdialog [data-default-focus]")).toBeFocused();
  await expect(tv.locator(".tvdialog [data-default-focus]")).toContainText("Stay");
  await press(tv, "Enter");
  await expect(tv.locator(".tvdialog")).toHaveCount(0);

  // OK on the poster → portal → HUB-03 with the first-time intro; phones follow to PHH-03 with their intro sheet.
  await openGameWithRemote(tv, true);
  for (const p of phones) await expect(p.locator(".introsheet, .screen--setup").first()).toBeVisible();
  for (const p of phones) if (await visible(p, ".introsheet__skip")) await p.locator(".introsheet__skip").click();
  // Setup ⓘ: Up from the how-to pane → ⓘ → OK → rules (no "How JAMAA works" outside the hub).
  await press(tv, "ArrowUp");
  await expect(tv.locator("[data-setup-info]")).toBeFocused();
  await press(tv, "Enter");
  await expect(tv.locator(".tvrules[data-rules=mishana]")).toBeVisible();
  await expect(tv.locator(".tvrules .rules__jamaa")).toHaveCount(0);
  await press(tv, "Escape");
  await shot(tv, "en-tv-setup");
  // Down from ⓘ → how-to; Right → the settings column; Down to Start; OK → entrance → in game.
  await press(tv, "ArrowDown");
  await expect(tv.locator("[data-howto]")).toBeFocused();
  await press(tv, "ArrowRight");
  await dpadTo(tv, "[data-start]", "ArrowDown");
  await press(tv, "Enter");
  await expect(tv.locator("[data-entrance]")).toBeVisible();
  await expect(tv.locator(".tvgamehost")).toBeVisible();
  await expect(tv.locator("[data-entrance]")).toHaveCount(0, { timeout: 5000 });
  await expect(tv.locator(".tvhint")).toBeVisible(); // "◁ Back: menu & rules" during round 1

  // A late phone joins while PLAYING → benched (PHH-04).
  const late = await joinPhone(browser, code, "Maya", "en", ".screen--benched");
  await shot(late.page, "en-phone-benched");

  await playToResults(tv, phones);
  // HUB-05: the results bar, Play again focused only after the cup choreography + guard.
  await expect(tv.locator("[data-results-bar].is-ready")).toBeVisible({ timeout: 20_000 });
  await expect(tv.locator("[data-replay]")).toBeFocused({ timeout: 3000 });
  for (const p of phones) await expect(p.locator(".cup")).toBeVisible();
  await shot(tv, "en-tv-results");
  await shot(phones[0]!, "en-phone-results-vip");
  // No secret: no word any phone received ever reached the TV (whole-leaf, inside a JSON string).
  const words = new Set(joined.flatMap((j) => [...j.words]));
  expect(words.size).toBeGreaterThan(0);
  for (const f of frames) {
    let v: { game?: { public?: { result?: unknown }; me?: unknown } | null } | undefined;
    try { v = JSON.parse(f)?.view; } catch { continue; }
    if (!v?.game) continue;
    expect(v.game.me ?? null).toBeNull(); // the TV never gets a `me`
    if (v.game.public?.result) continue; // RESULTS reveals both words to everyone
    for (const w of words) expect(f.includes(`"${w}"`), `TV frame leaks ${w}`).toBe(false);
  }

  // Play again → a new instance; the benched phone is dealt in.
  await press(tv, "Enter");
  await expect(tv.locator("[data-results-bar]")).toHaveCount(0);
  await expect(late.page.locator(".screen--benched")).toHaveCount(0, { timeout: 10_000 });
  await expect(late.page.locator(".wordcard, .ingame").first()).toBeVisible();

  // In game: Back → pause menu (Resume focused) → Rules → Back returns straight to the game; timers keep running.
  await tv.waitForTimeout(600);
  const timer = tv.locator("[role=timer]").first();
  const before = await timer.textContent().catch(() => null);
  await press(tv, "Escape");
  await expect(tv.locator(".tvdialog--menu")).toBeVisible();
  await expect(tv.locator(".tvdialog--menu [data-default-focus]")).toBeFocused();
  await dpadTo(tv, "[data-pause-rules]", "ArrowDown");
  await press(tv, "Enter");
  await expect(tv.locator(".tvrules--game")).toBeVisible();
  await expect(tv.locator(".tvdialog--menu")).toHaveCount(0);
  // The phone ⓘ mid-game does not stop anything either.
  await phones[1]!.locator(".topbar__rules").click();
  await expect(phones[1]!.locator(".rsheet")).toBeVisible();
  await tv.waitForTimeout(2200);
  if (before !== null) expect(await timer.textContent()).not.toBe(before);
  await phones[1]!.locator(".rsheet__close").click();
  await press(tv, "Escape");
  await expect(tv.locator(".tvrules")).toHaveCount(0);
  await expect(tv.locator(".tvdialog--menu")).toHaveCount(0); // back to the game, not to the menu

  // Quit game: confirm with the initial focus on "Keep playing", then confirm → SETUP (ABORT_GAME).
  await press(tv, "Escape");
  await dpadTo(tv, "[data-pause-quit]", "ArrowDown", 10);
  await press(tv, "Enter");
  await expect(tv.locator(".tvdialog:not(.tvdialog--menu) [data-default-focus]")).toBeFocused();
  await expect(tv.locator(".tvdialog:not(.tvdialog--menu) [data-default-focus]")).toContainText("Keep playing");
  await press(tv, "ArrowRight");
  await press(tv, "Enter");
  await expect(tv.locator(".tvsetup")).toBeVisible();
  // Setup Back → hub (reverse portal).
  await tv.waitForTimeout(500);
  await press(tv, "Escape");
  await expect(tv.locator(".tvhub")).toBeVisible();
  for (const p of phones) await expect(p.locator(".screen--hub")).toBeVisible();
  for (const p of [...phones, late.page, tv]) await p.context().close();
});

test("OK pressed 3 times within 300 ms on a poster ends on HUB-03, never PLAYING", async ({ browser }) => {
  const { tv, code } = await openTv(browser, "en");
  const phones = [];
  for (const n of ["A1", "B2", "C3"]) phones.push((await joinPhone(browser, code, n, "en")).page);
  // Mark the intro as seen on this TV so Start would be the initial focus if the guard failed.
  await tv.evaluate(() => localStorage.setItem("jamaa:tv:introSeen:mishana", "1"));
  await tv.keyboard.press("Enter");
  await tv.waitForTimeout(90);
  await tv.keyboard.press("Enter");
  await tv.waitForTimeout(90);
  await tv.keyboard.press("Enter");
  await expect(tv.locator(".tvsetup")).toBeVisible();
  await tv.waitForTimeout(2500);
  await expect(tv.locator(".tvsetup")).toBeVisible();
  await expect(tv.locator(".tvgamehost")).toHaveCount(0);
  await expect(tv.locator("[data-start]")).toBeFocused();
  for (const p of [...phones, tv]) await p.context().close();
});

test("AR (RTL) remote-only run: hub, intro, game, results → Other games → hub", async ({ browser }) => {
  test.setTimeout(420_000);
  const { tv, code } = await openTv(browser, "ar");
  await expect(tv.locator(".tv")).toHaveAttribute("dir", "rtl");
  const phones = [];
  for (const n of ["رامي", "Léa", "نور"]) phones.push((await joinPhone(browser, code, n, "ar")).page);
  await shot(tv, "ar-tv-hub");
  await press(tv, "i");
  await expect(tv.locator(".tvrules .rules__jamaa")).toBeVisible();
  await press(tv, "Escape");
  await openGameWithRemote(tv, true);
  for (const p of phones) if (await visible(p, ".introsheet__skip")) await p.locator(".introsheet__skip").click();
  await shot(tv, "ar-tv-setup");
  // RTL: the settings column sits on the LEFT, so "toward the column" is ArrowLeft.
  await press(tv, "ArrowLeft");
  await dpadTo(tv, "[data-start]", "ArrowDown");
  await press(tv, "Enter");
  await expect(tv.locator(".tvgamehost")).toBeVisible();
  await playToResults(tv, phones);
  await expect(tv.locator("[data-replay]")).toBeFocused({ timeout: 20_000 });
  // RTL: the next button in reading order is to the LEFT.
  await press(tv, "ArrowLeft", 2);
  await expect(tv.locator("[data-back-hub]")).toBeFocused();
  await press(tv, "Enter");
  await expect(tv.locator(".tvhub")).toBeVisible();
  await expect(tv.locator(".tvcupchip")).toBeVisible(); // Tonight's cup after the first game
  for (const p of phones) await expect(p.locator(".screen--hub")).toBeVisible();
  for (const p of [...phones, tv]) await p.context().close();
});

test("JAMAA Pass with fake billing: the store opens from the hub on the Yearly plan; Monthly with the trial unlocks the room", async ({ browser }) => {
  const { tv, code } = await openTv(browser, "en");
  const vip = (await joinPhone(browser, code, "Pay", "en")).page;
  const pass = tv.locator("[data-pass]");
  test.skip((await pass.count()) === 0, "BILLING_ENABLED is off on this server");
  await press(tv, "ArrowUp");
  await dpadTo(tv, "[data-pass]", "ArrowRight", 4);
  await press(tv, "Enter");
  await expect(tv.locator(".tvpass")).toBeVisible();
  await expect(tv.locator('[data-focus="plan:yearly"]')).toBeFocused();
  await expect(tv.locator(".tvplan__save")).toContainText("%");
  await expect(tv.locator(".tvplan__trial").first()).toBeVisible();
  await shot(tv, "en-tv-store");
  await press(tv, "ArrowRight");
  await expect(tv.locator('[data-focus="plan:monthly"]')).toBeFocused();
  await press(tv, "Enter");
  await expect(tv.locator(".tvshop__active")).toBeVisible({ timeout: 20_000 });
  await press(tv, "Escape");
  // The hub drops the Pass button once the room is a Pass room; the VIP phone never shows a price.
  await expect(tv.locator("[data-pass]")).toHaveCount(0, { timeout: 15_000 });
  expect(await vip.content()).not.toMatch(/\$\d/);
  for (const p of [vip, tv]) await p.context().close();
});
