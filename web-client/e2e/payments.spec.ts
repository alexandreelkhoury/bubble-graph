// PAYMENTS-SPEC §5.3: premium end to end with FAKE billing (the webServer runs `wrangler dev` with BILLING_MODE:fake and
// ALLOW_FAKE_BILLING:1 on 127.0.0.1, so the Worker picks fake mode per request). The TV mock is the host; the phones
// never see a price or a buy button. Every TV and phone WS frame of the free room is checked for premium words.
import { readdirSync, readFileSync } from "node:fs";
import { devices, expect, test } from "@playwright/test";
import type { APIRequestContext, Browser, BrowserContext, Page } from "@playwright/test";

// ------------------------------------------------------------------------------------------------ fixtures

const EN = JSON.parse(readFileSync(new URL("../../shared/i18n/en.json", import.meta.url), "utf8")) as Record<string, unknown>;
const text = (k: string): string => {
  const v = EN[k];
  if (typeof v !== "string") throw new Error(`en.json has no string ${k}`);
  return v;
};

interface PackJson { id: string; tier?: string; pairs: { civilian: { text: string; translit?: string | null }; undercover: { text: string; translit?: string | null } }[] }
function loadPacks(): PackJson[] {
  const root = new URL("../../word-packs/packs/", import.meta.url);
  const out: PackJson[] = [];
  for (const dir of readdirSync(root)) {
    for (const f of readdirSync(new URL(`${dir}/`, root))) {
      if (f.endsWith(".json")) out.push(JSON.parse(readFileSync(new URL(`${dir}/${f}`, root), "utf8")) as PackJson);
    }
  }
  return out;
}

/**
 * The JSON needles of every premium word (`"text":"…"` exactly as a view would carry it), minus words that a free pack
 * also has (a shared word is not a leak). A premium pack is any pack whose `tier` is not "free" (§1.2 default).
 */
function premiumNeedles(): string[] {
  const packs = loadPacks();
  const words = (p: PackJson): string[] => p.pairs.flatMap((x) => [x.civilian, x.undercover]).flatMap((w) => [w.text, w.translit ?? null]).filter((w): w is string => !!w);
  const free = new Set(packs.filter((p) => p.tier === "free").flatMap(words));
  const prem = new Set(packs.filter((p) => p.tier !== "free").flatMap(words).filter((w) => !free.has(w)));
  return [...prem].map((w) => `"text":${JSON.stringify(w)}`);
}

// ------------------------------------------------------------------------------------------------ pages

interface Client { page: Page; ctx: BrowserContext; frames: string[]; inject(msg: unknown): void }

/**
 * A page whose party socket goes through Playwright: every server frame is recorded, and `inject` sends a frame to the
 * server as this page ("via the page's socket"); the server's answer reaches the page as usual.
 */
async function client(browser: Browser, kind: "tv" | "phone"): Promise<Client> {
  const ctx = await browser.newContext(kind === "tv"
    ? { viewport: { width: 1920, height: 1080 } }
    : { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    try {
      if (!sessionStorage.getItem("e2e-init")) { localStorage.setItem("mishana:locale", "en"); sessionStorage.setItem("e2e-init", "1"); }
    } catch { /* ignore */ }
    // Count every toast that appears (TV and phone), to check "shown once".
    const seen: string[] = [];
    (window as unknown as { __toasts: string[] }).__toasts = seen;
    new MutationObserver((list) => {
      for (const m of list) for (const n of m.addedNodes) {
        if (n instanceof HTMLElement && (n.matches(".toast, .tvtoast"))) seen.push(n.textContent ?? "");
      }
    }).observe(document, { childList: true, subtree: true });
  });
  const frames: string[] = [];
  let server: { send(m: string): void } | null = null;
  await ctx.routeWebSocket(/\/parties\//, (ws) => {
    const s = ws.connectToServer();
    ws.onMessage((m) => s.send(m));
    s.onMessage((m) => { frames.push(String(m)); ws.send(m); });
    server = s;
  });
  const page = await ctx.newPage();
  return {
    page, ctx, frames,
    inject: (msg) => {
      if (!server) throw new Error("no socket yet");
      server.send(JSON.stringify(msg));
    },
  };
}

type View = {
  phase: string; premium: boolean; lockedPacks: { id: string; productId: string }[]; tvBusy: boolean;
  settings: { packIds: string[]; points: { civilian: number; undercover: number; blank: number } };
  availablePacks: { id: string }[]; result: { pack: { id: string } } | null;
};
function lastView(frames: readonly string[]): View | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const f = frames[i]!;
    if (!f.startsWith("{")) continue;
    const m = JSON.parse(f) as { t?: string; view?: View };
    if (m.t === "state" && m.view) return m.view;
  }
  return null;
}
const errors = (frames: readonly string[]): string[] => frames.filter((f) => f.includes('"t":"error"')).map((f) => (JSON.parse(f) as { code: string }).code);

async function expectView(c: Client, pred: (v: View) => boolean, msg: string): Promise<View> {
  await expect.poll(() => { const v = lastView(c.frames); return v !== null && pred(v); }, { message: msg, timeout: 20_000 }).toBe(true);
  return lastView(c.frames)!;
}

const visible = (p: Page, sel: string): Promise<boolean> => p.locator(sel).first().isVisible().catch(() => false);
const toastsOf = (p: Page): Promise<string[]> => p.evaluate(() => (window as unknown as { __toasts: string[] }).__toasts.slice());

let action = 0;
const act = (a: unknown): unknown => ({ v: 1, t: "action", id: `e2e-${++action}`, a });

async function openTv(browser: Browser): Promise<{ tv: Client; code: string }> {
  const tv = await client(browser, "tv");
  await tv.page.goto("/tv");
  const big = tv.page.locator(".tvlobby .tvcode--big");
  await expect(big).toBeVisible({ timeout: 30_000 });
  const code = ((await big.getAttribute("aria-label")) ?? "").replace(/\s+/g, "");
  return { tv, code };
}

async function joinPhones(browser: Browser, code: string, names: string[]): Promise<Client[]> {
  const out: Client[] = [];
  for (const n of names) {
    const c = await client(browser, "phone");
    await c.page.goto(`/${code}`);
    await c.page.locator("#name").fill(n);
    await c.page.locator(".actionbar .btn--primary").click();
    await expect(c.page.locator(".screen--lobby")).toBeVisible();
    out.push(c);
  }
  return out;
}

async function holdCard(p: Page): Promise<void> {
  const box = await p.locator(".wordcard").boundingBox();
  if (!box) return;
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await expect(p.locator(".wordface")).toBeVisible();
  await p.mouse.up();
}

/** OK twice on the TV action pill (arm, confirm); a first press may only skip an animation. */
async function pillTwice(tv: Page): Promise<void> {
  const pill = tv.locator(".tvpill").first();
  if (!(await pill.isVisible().catch(() => false))) return;
  await pill.click().catch(() => undefined);
  if ((await tv.locator(".tvpill.is-armed").count()) === 0) await pill.click().catch(() => undefined);
  await pill.click().catch(() => undefined);
}

/** Plays the current game to RESULTS: cards read, turns skipped from the TV, everyone votes, the Blank guesses wrong. */
async function playToResults(tv: Page, phones: readonly Client[]): Promise<void> {
  const until = Date.now() + 200_000;
  while (Date.now() < until) {
    if (await visible(tv, ".tvresults")) return;
    for (const { page: p } of phones) {
      if (await visible(p, ".wordcard") && !(await visible(p, ".waiting--ok"))) {
        await holdCard(p);
        await p.locator(".actionbar .btn--primary").click({ timeout: 2000 }).catch(() => undefined);
      } else if (await visible(p, ".donebtn.is-armed")) {
        await p.locator(".donebtn").click().catch(() => undefined);
      } else if (await visible(p, ".voterow")) {
        await p.locator(".voterow").first().click().catch(() => undefined);
        await p.locator(".actionbar .btn--primary").click({ timeout: 2000 }).catch(() => undefined);
      } else if (await visible(p, ".input--big")) {
        await p.locator(".input--big").fill("zzwrong");
        await p.locator(".actionbar .btn--primary").click({ timeout: 2000 }).catch(() => undefined);
      }
    }
    if (await visible(tv, ".tvreveal, .tvclues, .tvguess.is-wrong, .tvguess.is-correct, .tvguess.is-timeout")) await pillTwice(tv);
    await tv.waitForTimeout(250);
  }
  await expect(tv.locator(".tvresults")).toBeVisible();
}

/** VIP phone: Play again from RESULTS, back to the lobby everywhere. */
async function playAgain(tv: Page, vip: Page): Promise<void> {
  await expect(vip.locator(".screen--results")).toBeVisible();
  await vip.locator(".actionbar .btn--primary").click();
  await expect(tv.locator(".tvlobby")).toBeVisible();
}

/** D-pad to an element matching `sel`, pressing each key up to `n` times. */
async function reach(tv: Page, sel: string, keys: string[], n = 6): Promise<void> {
  for (const k of keys) {
    for (let i = 0; i < n; i++) {
      if (await tv.evaluate((s) => document.activeElement?.matches(s) ?? false, sel)) return;
      await tv.keyboard.press(k);
      await tv.waitForTimeout(150);
    }
  }
  expect(await tv.evaluate((s) => document.activeElement?.matches(s) ?? false, sel), `D-pad reaches ${sel}`).toBe(true);
}

/** Lobby → Premium (D-pad) → the Store opens with the yearly plan focused. */
async function openStoreByRemote(tv: Page): Promise<void> {
  await reach(tv, "[data-lobby=premium]", ["ArrowDown", "ArrowLeft"]);
  await tv.keyboard.press("Enter");
  await expect(tv.locator(".tvshop__body")).toBeVisible();
}

async function closeStore(tv: Page): Promise<void> {
  await tv.keyboard.press("Escape");
  await expect(tv.locator(".tvshop")).toHaveCount(0);
}

// ------------------------------------------------------------------------------------------------ gate

// A server without billing routes FAILS this file: a missing or broken /api/billing must never pass as "skipped".
// E2E_ALLOW_NO_BILLING=1 is the explicit opt-out for a run against a server from before PAYMENTS-SPEC Phase 1
// (implementer A); the store layout and remote rules are still covered by store-layout.spec.ts with a mocked store.
let gate: string | null = null;
test.beforeAll(async ({ playwright, baseURL }) => {
  const req: APIRequestContext = await playwright.request.newContext({ baseURL });
  const r = await req.get("/api/billing/catalog");
  // 404/405: the Worker has no billing routes at all (unknown /api paths answer 405 before Phase 1).
  if (r.status() === 404 || r.status() === 405) {
    const why = `the server has no /api/billing routes (GET /api/billing/catalog → ${r.status()}; PAYMENTS-SPEC Phase 1, implementer A)`;
    await req.dispose();
    if (process.env.E2E_ALLOW_NO_BILLING !== "1") throw new Error(`${why}. Set E2E_ALLOW_NO_BILLING=1 only to run e2e against a pre-Phase-1 server.`);
    gate = why;
    return;
  }
  const j = (await r.json().catch(() => null)) as { mode?: string } | null;
  await req.dispose();
  // A server with billing that is not in fake mode here is a misconfiguration: fail, never skip.
  expect(j?.mode, "the e2e server must run with BILLING_MODE:fake and ALLOW_FAKE_BILLING:1").toBe("fake");
});
test.beforeEach(() => { test.skip(gate !== null, gate ?? ""); });

// ------------------------------------------------------------------------------------------------ tests

test("1. a free room cannot get premium packs: locked rows only, PACK_LOCKED, no premium word in any frame", async ({ browser }) => {
  test.setTimeout(600_000);
  const needles = premiumNeedles();
  expect(needles.length).toBeGreaterThan(100);
  const { tv, code } = await openTv(browser);
  const phones = await joinPhones(browser, code, ["Rami", "Léa", "Nour", "Sam"]);
  const vip = phones[0]!;
  const lobby = await expectView(tv, (v) => v.phase === "LOBBY" && v.lockedPacks.length > 0, "lockedPacks listed");
  expect(lobby.premium).toBe(false);
  expect(lobby.availablePacks.map((p) => p.id)).not.toContain("en-food-01");

  // The VIP's settings: locked rows, "Unlock on the TV", no price, no buy button, no product id.
  await vip.page.locator(".card--link").click();
  await vip.page.locator("#set-words summary").click();
  const rows = vip.page.locator(".lockedrow--pack");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBe(lobby.lockedPacks.length);
  const sheet = await vip.page.locator(".sheet").innerText();
  expect(sheet).toContain(text("settings.unlockOnTv"));
  expect(sheet).not.toMatch(/\$|€|£|pack_|Buy|buy/);
  await rows.first().click();
  await expect(vip.page.locator(".toast", { hasText: text("error.packLocked") })).toBeVisible();
  // Locked points (the Game section is open by default): a tap explains, nothing is sent.
  await vip.page.locator(".lockedrow--stepper").first().click();
  await expect(vip.page.locator(".toast", { hasText: text("error.premiumRequired") })).toBeVisible();
  await vip.page.keyboard.press("Escape");

  // A crafted UPDATE_SETTINGS from the VIP's own socket is refused.
  vip.inject(act({ type: "UPDATE_SETTINGS", patch: { packIds: ["en-food-01"] } }));
  await expect.poll(() => errors(vip.frames)).toContain("PACK_LOCKED");
  vip.inject(act({ type: "UPDATE_SETTINGS", patch: { points: { civilian: 5, undercover: 5, blank: 5 } } }));
  await expect.poll(() => errors(vip.frames)).toContain("PREMIUM_REQUIRED");
  expect(lastView(tv.frames)!.settings.packIds).toEqual([]);

  for (let g = 0; g < 3; g++) {
    await vip.page.locator(".actionbar .btn--primary").click();
    await playToResults(tv.page, phones);
    if (g < 2) await playAgain(tv.page, vip.page);
  }
  for (const c of [tv, ...phones]) {
    const all = c.frames.join("\n");
    const hit = needles.find((n) => all.includes(n));
    expect(hit, "a premium word reached a client of a free room").toBeUndefined();
  }
  for (const c of [tv, ...phones]) await c.ctx.close();
});

test("2. purchase → premium → a premium pack plays (D-pad only on the TV)", async ({ browser }) => {
  test.setTimeout(400_000);
  const { tv, code } = await openTv(browser);
  const phones = await joinPhones(browser, code, ["Rami", "Léa", "Nour", "Sam"]);
  await openStoreByRemote(tv.page);
  await expect(tv.page.locator(".tvshop__test")).toHaveText(text("store.testMode"));
  // §4.5: the disclosure for the focused (yearly) plan is on screen.
  await expect(tv.page.locator(".tvshop__legal")).toContainText("$29.99");
  expect(await tv.page.evaluate(() => document.activeElement?.getAttribute("data-focus"))).toBe("plan:yearly");
  await tv.page.keyboard.press("Enter");
  // Premium without a new room.
  await expectView(tv, (v) => v.premium && v.lockedPacks.length === 0, "premium:true, nothing locked");
  await expect(tv.page.locator(".tvshop__active")).toBeVisible();
  await closeStore(tv.page);
  await expect(tv.page.locator(".tvlobby__premium")).toBeVisible();
  await expect(phones[0]!.page.locator(".premiumchip")).toBeVisible();
  tv.inject(act({ type: "UPDATE_SETTINGS", patch: { packIds: ["en-food-01"] } }));
  await expectView(tv, (v) => v.settings.packIds.join() === "en-food-01", "en-food-01 selected");
  await phones[0]!.page.locator(".actionbar .btn--primary").click();
  await playToResults(tv.page, phones);
  const res = await expectView(tv, (v) => v.phase === "RESULTS" && v.result !== null, "results");
  expect(res.result!.pack.id).toBe("en-food-01");
  for (const c of [tv, ...phones]) await c.ctx.close();
});

test("3. a single pack purchase unlocks only that pack", async ({ browser }) => {
  test.setTimeout(240_000);
  const { tv, code } = await openTv(browser);
  const phones = await joinPhones(browser, code, ["Rami", "Léa", "Nour"]);
  const before = await expectView(tv, (v) => v.lockedPacks.some((p) => p.id === "en-food-01"), "en-food-01 locked");
  // Settings → Words → Packs → the locked row opens the Store on that pack (D-pad).
  await reach(tv.page, "[data-lobby=settings]", ["ArrowDown", "ArrowLeft", "ArrowRight"]);
  await tv.page.keyboard.press("Enter");
  await expect(tv.page.locator(".tvsettings")).toBeVisible();
  await reach(tv.page, ".tvcat:last-child", ["ArrowDown"]);
  await tv.page.keyboard.press("ArrowRight");
  await reach(tv.page, "[data-row=packIds]", ["ArrowDown"]);
  await tv.page.keyboard.press("Enter");
  await reach(tv.page, "[data-locked-pack=en-food-01]", ["ArrowRight", "ArrowDown", "ArrowRight", "ArrowDown"], 10);
  await tv.page.keyboard.press("Enter");
  await expect(tv.page.locator(".tvshop__body")).toBeVisible();
  await expect.poll(() => tv.page.evaluate(() => document.activeElement?.getAttribute("data-focus"))).toBe("pack:pack_en_food_01");
  await tv.page.keyboard.press("Enter");
  const after = await expectView(tv, (v) => !v.lockedPacks.some((p) => p.id === "en-food-01"), "en-food-01 unlocked");
  expect(after.premium).toBe(false);
  expect(after.availablePacks.map((p) => p.id)).toContain("en-food-01");
  expect(after.lockedPacks.map((p) => p.id).sort()).toEqual(before.lockedPacks.map((p) => p.id).filter((id) => id !== "en-food-01").sort());
  await expect(tv.page.locator('[data-pack="en-food-01"] .tvshop__chip--ok')).toBeVisible();
  for (const c of [tv, ...phones]) await c.ctx.close();
});

test("4. expiry mid-game: the game finishes with its pack, then the lobby falls back to free (notices once)", async ({ browser }) => {
  test.setTimeout(400_000);
  const { tv, code } = await openTv(browser);
  const phones = await joinPhones(browser, code, ["Rami", "Léa", "Nour", "Sam"]);
  const vip = phones[0]!;
  await openStoreByRemote(tv.page);
  await tv.page.keyboard.press("Enter");
  await expectView(tv, (v) => v.premium, "premium");
  await closeStore(tv.page);
  tv.inject(act({ type: "UPDATE_SETTINGS", patch: { packIds: ["en-food-01"], points: { civilian: 5, undercover: 7, blank: 9 } } }));
  await expectView(tv, (v) => v.settings.packIds.join() === "en-food-01" && v.settings.points.civilian === 5, "premium settings");
  await vip.page.locator(".actionbar .btn--primary").click();
  await expect(tv.page.locator(".tvreveal")).toBeVisible();
  // Mid-game: the pause menu's fake-mode test control (the Store opens only in the lobby).
  await tv.page.keyboard.press("Escape");
  await tv.page.locator(".tvmenu__item[data-test=expire]").click();
  await expectView(tv, (v) => !v.premium, "premium:false after expiry");
  await playToResults(tv.page, phones);
  const res = await expectView(tv, (v) => v.phase === "RESULTS" && v.result !== null, "results");
  expect(res.result!.pack.id).toBe("en-food-01");
  await playAgain(tv.page, vip.page);
  const lobby = await expectView(tv, (v) => v.phase === "LOBBY", "lobby");
  expect(lobby.premium).toBe(false);
  expect(lobby.settings.packIds).toEqual([]);
  expect(lobby.settings.points).toEqual({ civilian: 2, undercover: 10, blank: 6 });
  await expect.poll(async () => (await toastsOf(tv.page)).filter((x) => x === text("lobby.premiumEnded")).length).toBe(1);
  await expect.poll(async () => (await toastsOf(vip.page)).filter((x) => x === text("lobby.premiumEndedPhone")).length).toBe(1);
  for (const p of phones.slice(1)) expect((await toastsOf(p.page)).filter((x) => x === text("lobby.premiumEndedPhone"))).toEqual([]);
  await tv.page.waitForTimeout(1500);
  expect((await toastsOf(tv.page)).filter((x) => x === text("lobby.premiumEnded")).length).toBe(1);
  await vip.page.locator(".actionbar .btn--primary").click();
  await expect(tv.page.locator(".tvreveal")).toBeVisible();
  for (const c of [tv, ...phones]) await c.ctx.close();
});

test("5. fake billing is refused off-LAN (request level)", async ({ request }) => {
  const r = await request.post("/api/billing/fake/purchase", {
    headers: { Host: "example.com", "Content-Type": "application/json" },
    data: { installId: "0".repeat(32), productId: "premium", basePlanId: "yearly" },
  });
  expect([404, 503]).toContain(r.status());
});

test("6. no start behind the store: TV_BUSY while it is open, START works once it closes", async ({ browser }) => {
  test.setTimeout(240_000);
  const { tv, code } = await openTv(browser);
  const phones = await joinPhones(browser, code, ["Rami", "Léa", "Nour"]);
  const vip = phones[0]!;
  await openStoreByRemote(tv.page);
  await expectView(vip, (v) => v.tvBusy, "tvBusy on the phone");
  await expect(vip.page.locator(".blocker--busy")).toHaveText(text("error.tvBusy"));
  await vip.page.locator(".actionbar .btn--primary").click();
  await expect.poll(() => errors(vip.frames)).toContain("TV_BUSY");
  await expect(vip.page.locator(".toast", { hasText: text("error.tvBusy") })).toBeVisible();
  expect(lastView(tv.frames)!.phase).toBe("LOBBY");
  await closeStore(tv.page);
  await expectView(vip, (v) => !v.tvBusy, "busy cleared");
  await vip.page.locator(".actionbar .btn--primary").click();
  await expect(tv.page.locator(".tvreveal")).toBeVisible();
  for (const c of [tv, ...phones]) await c.ctx.close();
});
