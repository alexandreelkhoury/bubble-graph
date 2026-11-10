// JAMAA-PLATFORM §6.4 acceptance 5 (lane B): the /tv mock driven by the keyboard D-pad, OK, Back and `i` ONLY (no
// clicks on the TV), with phones joining and playing Mish Ana! inside the platform, against `wrangler dev`.
// Covers: hub → focus mirrored on phones; open Mish Ana! → first-time how-to → Start → full game → results →
// Play again → (benched late joiner dealt in) → Back → Rules → Back returns to the game, timers keep running → Quit
// (confirm, focus "Keep playing") → setup → hub; OK ×3 on a poster lands on HUB-03 never PLAYING; hub Back →
// "Close JAMAA?" focused on Stay; hub ⓘ = focused game's rules + "How JAMAA works"; setup ⓘ; the AR (RTL) run with
// Other games → hub; no secret word in any TV frame. SHOTS_DIR=<dir> saves screenshots.
import { mkdirSync } from "node:fs";
import { availableParallelism, loadavg } from "node:os";
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
    // Every keydown's creation time (event.timeStamp = when the key was pressed, not when a busy page handled it),
    // recorded before the app's capture listeners, which may swallow it (§3.10 E).
    const w = window as unknown as { __keys: number[] };
    w.__keys = [];
    window.addEventListener("keydown", (e) => { w.__keys.push(e.timeStamp); }, true);
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

/** Every WS view frame one phone received, plus its own secrets per game instance (for the secrecy check). */
interface Spy { name: string; frames: string[]; words: Set<string>; mine: Map<number, { word: string | null; role: string | null }> }
type FrameView = { me?: { id?: string } | null; game?: { n?: number; public?: {
  result?: unknown; players?: { id: string; alive?: boolean; left?: boolean; revealedRole?: unknown }[];
  eliminated?: { playerId: string } | null; history?: { eliminatedId: string | null; role: unknown }[];
}; me?: { id?: string; word?: { text?: string } | null; role?: string | null } | null } | null };

async function joinPhone(browser: Browser, code: string, name: string, locale: string, expectSel = ".screen--hub"): Promise<{ page: Page; words: Set<string>; spy: Spy }> {
  const ctx = await context(browser, "phone", locale);
  const page = await ctx.newPage();
  const spy: Spy = { name, frames: [], words: new Set(), mine: new Map() };
  page.on("websocket", (ws) => ws.on("framereceived", (f) => {
    if (typeof f.payload !== "string") return;
    spy.frames.push(f.payload);
    try {
      const g = (JSON.parse(f.payload)?.view as FrameView | undefined)?.game;
      if (!g?.me || typeof g.n !== "number") return;
      const w = g.me.word?.text ?? null;
      if (typeof w === "string") spy.words.add(w);
      const had = spy.mine.get(g.n);
      spy.mine.set(g.n, { word: w ?? had?.word ?? null, role: g.me.role ?? had?.role ?? null });
    } catch { /* ignore */ }
  }));
  await page.goto(`/${code}`);
  await page.locator("#name").fill(name);
  await page.locator(".actionbar .btn--primary").click();
  await expect(page.locator(expectSel).first()).toBeVisible();
  return { page, words: spy.words, spy };
}

/** Stringifies a game view without its `me` (the only place a receiver's own secrets may sit). */
function publicPart(g: NonNullable<FrameView["game"]>): string {
  const { me: _me, ...rest } = g;
  return JSON.stringify(rest);
}

/**
 * JAMAA-PLATFORM §6 acceptance 5: no secret (word, role or vote) reaches the TV or another phone. Per frame before the
 * instance's result: `game.me` is the receiver's own (TV: none); nothing outside `me` carries `isBlank` or `myVote`;
 * no living player's role is public (players, eliminated, history); and no other player's word (unless it is the
 * receiver's own word in that instance) appears anywhere in the frame.
 */
function assertNoSecretLeaks(tvFrames: readonly string[], spies: readonly Spy[]): void {
  const wordsIn = new Map<number, Map<string, string>>(); // n → word → whose (first)
  for (const s of spies) for (const [n, m] of s.mine) if (m.word) { const t = wordsIn.get(n) ?? new Map(); if (!t.has(m.word)) t.set(m.word, s.name); wordsIn.set(n, t); }
  expect([...wordsIn.values()].some((m) => m.size > 0), "the phones received words").toBe(true);
  const check = (who: string, frames: readonly string[], own: Spy | null): void => {
    for (const f of frames) {
      let v: FrameView | undefined;
      try { v = JSON.parse(f)?.view; } catch { continue; }
      const g = v?.game;
      if (!g || typeof g.n !== "number") continue;
      if (own === null) expect(g.me ?? null, `${who}: the TV never gets a game me`).toBeNull();
      else if (g.me && v?.me?.id) expect(g.me.id, `${who}: game.me is its own`).toBe(v.me.id);
      if (g.public?.result) continue; // RESULTS reveals words and roles to everyone
      const pub = publicPart(g);
      for (const k of ['"isBlank":', '"myVote":']) expect(pub.includes(k), `${who}: ${k} outside me (n=${g.n})`).toBe(false);
      // Roles: only an eliminated (or departed) player's role is public before the result.
      const alive = new Set((g.public?.players ?? []).filter((p) => p.alive && !p.left).map((p) => p.id));
      for (const p of g.public?.players ?? []) if (p.alive) expect(p.revealedRole ?? null, `${who}: alive player's role revealed`).toBeNull();
      const el = g.public?.eliminated;
      if (el) expect(alive.has(el.playerId), `${who}: role of a living player in eliminated`).toBe(false);
      for (const h of g.public?.history ?? []) if (h.role != null && h.eliminatedId) expect(alive.has(h.eliminatedId), `${who}: role of a living player in history`).toBe(false);
      const mineWord = own?.mine.get(g.n)?.word ?? null;
      for (const [w, whose] of wordsIn.get(g.n) ?? []) {
        if (w === mineWord) continue;
        expect(f.includes(`"${w}"`), `${who} frame (n=${g.n}) leaks ${whose}'s word`).toBe(false);
      }
    }
  };
  check("TV", tvFrames, null);
  for (const s of spies) check(s.name, s.frames, s);
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
/** §3.10 E: D-pad is ignored while a transition runs and for INPUT_GUARD_MS after it; wait that out. */
async function settle(tv: Page): Promise<void> {
  await expect(tv.locator(".tvportal")).toHaveCount(0);
  await tv.waitForTimeout(500);
}
/**
 * Trusted keys straight through CDP at exact gaps (Playwright's traced keyboard.press costs ~0.4 s per call, which
 * would spread presses past the 400 ms guard). Each entry: the key and the delay before it.
 */
const CDP_KEYS: Record<string, { key: string; code: string; windowsVirtualKeyCode: number; text?: string }> = {
  Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
  Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 },
};
async function burst(tv: Page, seq: readonly [string, number][]): Promise<number[]> {
  const cdp = await tv.context().newCDPSession(tv);
  const before = await tv.evaluate(() => (window as unknown as { __keys: number[] }).__keys.length);
  const sends: Promise<unknown>[] = [];
  for (const [k, delay] of seq) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const d = CDP_KEYS[k]!;
    const base = { key: d.key, code: d.code, windowsVirtualKeyCode: d.windowsVirtualKeyCode, nativeVirtualKeyCode: d.windowsVirtualKeyCode };
    sends.push(cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...(d.text ? { text: d.text, unmodifiedText: d.text } : {}), ...base }));
    sends.push(cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...base }));
  }
  await Promise.all(sends);
  await cdp.detach();
  return tv.evaluate((n) => (window as unknown as { __keys: number[] }).__keys.slice(n), before);
}

async function visible(p: Page, sel: string): Promise<boolean> {
  return p.locator(sel).first().isVisible().catch(() => false);
}

/** Opens Mish Ana! from the hub with OK, walks the first-time intro with OK, and lands on HUB-03. */
async function openGameWithRemote(tv: Page, introExpected: boolean): Promise<void> {
  // §3.10 A perf: the portal starts on OK (optimistic) and the arch step (120–700 ms on a first open) runs without a
  // stall: record every animation frame from the press on.
  await tv.evaluate(() => {
    const w = window as unknown as { __raf: number[] };
    w.__raf = [];
    const loop = (t: number): void => { w.__raf.push(t); if (w.__raf.length < 400) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await press(tv, "Enter");
  await expect(tv.locator(".tvsetup")).toBeVisible();
  if (introExpected) {
    const { keys, raf } = await tv.evaluate(() => {
      const w = window as unknown as { __raf: number[]; __keys: number[] };
      return { keys: w.__keys, raf: w.__raf };
    });
    const ok = keys.at(-1)!;
    const arch = raf.filter((t) => t >= ok + 120 && t <= ok + 700).length;
    // A frame budget only means something when the browser gets a CPU: on a saturated host (parallel builds, other
    // wrangler/Chromium runs) every frame is late, whatever the page does. Then the count is recorded, not asserted.
    const load = loadavg()[0]! / availableParallelism();
    if (load <= 1.5) expect(arch, "animation frames during the portal's arch step").toBeGreaterThanOrEqual(20);
    else test.info().annotations.push({ type: "perf-skipped", description: `arch step: ${arch} frames; host load ${load.toFixed(1)} per CPU` });
  }
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
    const box = await p.locator(".wordcard").boundingBox({ timeout: 1000 }).catch(() => null); // it may leave between the two calls
    if (box) { await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(250); await p.mouse.up(); }
    if (await visible(p, ".actionbar .btn--primary")) await p.locator(".actionbar .btn--primary").click().catch(() => undefined);
  }
  const deadline = Date.now() + 200_000;
  while (Date.now() < deadline) {
    if (await visible(tv, "[data-results-bar]")) return;
    for (const p of phones) {
      if (await visible(p, ".wordcard")) {
        const box = await p.locator(".wordcard").boundingBox({ timeout: 1000 }).catch(() => null); // it may leave between the two calls
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
  await expect(tv.locator(".tvrules")).toHaveCount(0);
  await expect(tv.locator("[data-hub-info]")).toBeFocused(); // focus goes back to the opener
  await press(tv, "ArrowDown");
  await expect(tv.locator(".tvposter.is-focused")).toBeFocused();

  // Hub Back → "Close JAMAA?" with the initial focus on Stay; Stay keeps the room.
  await press(tv, "Escape");
  await expect(tv.locator(".tvdialog")).toBeVisible();
  await expect(tv.locator(".tvdialog [data-default-focus]")).toBeFocused();
  await expect(tv.locator(".tvdialog [data-default-focus]")).toContainText("Stay");
  await tv.waitForTimeout(450); // §3.10 E rule 2: the opening dialog ignores OK for 400 ms
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
  // No secret (acceptance 5): words, roles and votes stay out of the TV's and the other phones' frames.
  assertNoSecretLeaks(frames, [...joined, late].map((j) => j.spy));

  // Rules access on the results (§1): the ⓘ is the row's end item; OK opens the rules, Back returns to the results.
  await dpadTo(tv, "[data-results-info]", "ArrowRight", 6);
  await tv.waitForTimeout(450);
  await press(tv, "Enter");
  await expect(tv.locator(".tvrules[data-rules=mishana]")).toBeVisible();
  await press(tv, "Escape");
  await expect(tv.locator(".tvrules")).toHaveCount(0);
  await expect(tv.locator("[data-results-bar]")).toBeVisible();
  // Back on the results opens the menu with Resume, Rules and Sound only (no game items, no Quit; native PauseMenuModel).
  await press(tv, "Escape");
  await expect(tv.locator(".tvdialog--menu")).toBeVisible();
  await expect(tv.locator(".tvdialog--menu [data-pause-rules]")).toBeVisible();
  await expect(tv.locator(".tvdialog--menu [data-pause-quit]")).toHaveCount(0);
  await expect(tv.locator(".tvdialog--menu [data-pause-item]")).toHaveCount(0);
  await tv.waitForTimeout(450);
  await press(tv, "Escape");
  await expect(tv.locator(".tvdialog--menu")).toHaveCount(0);
  await dpadTo(tv, "[data-replay]", "ArrowLeft", 6);
  await tv.waitForTimeout(450);

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
  await tv.waitForTimeout(450);
  await press(tv, "ArrowRight");
  await press(tv, "Enter");
  await expect(tv.locator(".tvsetup")).toBeVisible();
  // Setup Back → hub (reverse portal).
  await tv.waitForTimeout(500);
  await press(tv, "Escape");
  await expect(tv.locator(".tvhub")).toBeVisible();
  for (const p of phones) await expect(p.locator(".screen--hub")).toBeVisible();
  // Again over both instances (the replay dealt the benched phone in).
  assertNoSecretLeaks(frames, [...joined, late].map((j) => j.spy));
  for (const p of [...phones, late.page, tv]) await p.context().close();
});

test("OK pressed 3 times within 300 ms on a poster ends on HUB-03, never PLAYING", async ({ browser }) => {
  const { tv, code } = await openTv(browser, "en");
  const phones = [];
  for (const n of ["A1", "B2", "C3"]) phones.push((await joinPhone(browser, code, n, "en")).page);
  // Mark the intro as seen on this TV so Start would be the initial focus if the guard failed.
  await tv.evaluate(() => localStorage.setItem("jamaa:tv:introSeen:mishana", "1"));
  // Trusted key events straight through CDP: Playwright's traced keyboard.press costs ~0.4 s per call here (a trace
  // snapshot each), which would spread the presses past the 400 ms guard and test something else.
  const cdp = await tv.context().newCDPSession(tv);
  const ok = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
  const sends: Promise<unknown>[] = [];
  for (let i = 0; i < 3; i++) {
    sends.push(cdp.send("Input.dispatchKeyEvent", { type: "keyDown", text: "\r", unmodifiedText: "\r", ...ok }));
    sends.push(cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...ok }));
    if (i < 2) await new Promise((r) => setTimeout(r, 90));
  }
  await Promise.all(sends);
  const keys = await tv.evaluate(() => (window as unknown as { __keys: number[] }).__keys.slice(-3));
  expect(keys[2]! - keys[0]!, "the three OKs must land within 300 ms for this check to mean anything").toBeLessThan(300);
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
  await tv.waitForTimeout(450);
  await press(tv, "ArrowRight");
  await expect(tv.locator('[data-focus="plan:monthly"]')).toBeFocused();
  await press(tv, "Enter");
  await expect(tv.locator(".tvshop__active")).toBeVisible({ timeout: 20_000 });
  await press(tv, "Escape");
  // The hub drops the Pass button once the room is a Pass room; the VIP phone never shows a price.
  await expect(tv.locator("[data-pass]")).toHaveCount(0, { timeout: 15_000 });
  expect(await vip.content()).not.toMatch(/\$\d/);
  // Expiry mid-game: the running game finishes with what it started; the restriction applies back in SETUP/HUB.
  const others = [(await joinPhone(browser, code, "Two", "en")).page, (await joinPhone(browser, code, "Three", "en")).page];
  await press(tv, "Enter"); // open Mish Ana! (first visit: intro)
  await expect(tv.locator(".tvsetup")).toBeVisible();
  await settle(tv); // the first-visit intro mounts only after the portal (it never drops the arch's frames)
  if (await visible(tv, "[data-intro]")) await press(tv, "Escape"); // Back skips the intro
  await expect(tv.locator("[data-intro]")).toHaveCount(0);
  await settle(tv);
  await expect(tv.locator("[data-howto]")).toBeFocused(); // after a skipped first-visit intro, focus is on the how-to pane
  await press(tv, "ArrowRight");
  await dpadTo(tv, "[data-start]", "ArrowDown");
  await press(tv, "Enter");
  await expect(tv.locator(".tvgamehost")).toBeVisible();
  await tv.waitForTimeout(2500);
  await press(tv, "Escape");
  await dpadTo(tv, "[data-test=expire]", "ArrowDown", 10);
  await press(tv, "Enter");
  await tv.waitForTimeout(1500);
  await expect(tv.locator(".tvgamehost")).toBeVisible(); // still playing
  await press(tv, "Escape");
  await dpadTo(tv, "[data-pause-quit]", "ArrowDown", 10);
  await press(tv, "Enter");
  await expect(tv.locator(".tvdialog:not(.tvdialog--menu) [data-default-focus]")).toBeFocused(); // the guard runs from its mount
  await tv.waitForTimeout(450);
  await press(tv, "ArrowRight");
  await press(tv, "Enter");
  await expect(tv.locator(".tvsetup")).toBeVisible();
  await tv.waitForTimeout(600);
  await press(tv, "Escape");
  await expect(tv.locator("[data-pass]")).toBeVisible({ timeout: 15_000 }); // a free room again
  for (const p of [vip, ...others, tv]) await p.context().close();
});

test("a locked pack in setup opens the Pass store on that pack; buying it adds it to the game", async ({ browser }) => {
  const { tv, code } = await openTv(browser, "en");
  const vip = (await joinPhone(browser, code, "Pack", "en")).page;
  test.skip((await tv.locator("[data-pass]").count()) === 0, "BILLING_ENABLED is off on this server");
  await tv.evaluate(() => localStorage.setItem("jamaa:tv:introSeen:mishana", "1"));
  await press(tv, "Enter");
  await expect(tv.locator(".tvsetup")).toBeVisible();
  await tv.waitForTimeout(700);
  await dpadTo(tv, "[data-row=packIds]", "ArrowDown", 6); // 1 member: canStart is false, focus starts on the first row
  await press(tv, "Enter");
  const locked = tv.locator("[data-locked-pack]").first();
  await expect(locked).toBeVisible();
  const packId = await locked.getAttribute("data-locked-pack");
  await dpadTo(tv, `[data-locked-pack="${packId}"]`, "ArrowDown", 30);
  await press(tv, "Enter");
  await expect(tv.locator(".tvpass")).toBeVisible();
  const focusedPack = await tv.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.pack ?? null);
  expect(focusedPack).toBe(packId);
  await tv.waitForTimeout(450);
  await press(tv, "Enter");
  await expect(tv.locator(`[data-pack="${packId}"].is-owned`)).toBeVisible({ timeout: 20_000 });
  await press(tv, "Escape");
  // The pack is now playable (no longer a locked row) for this room.
  await expect(tv.locator(`[data-locked-pack="${packId}"]`)).toHaveCount(0, { timeout: 15_000 });
  for (const p of [vip, tv]) await p.context().close();
});

test("§3.10 E rule 2: an opening overlay ignores OK and the D-pad for 400 ms (Pass, Close JAMAA, kick)", async ({ browser }) => {
  const { tv, code } = await openTv(browser, "en");
  const phones = [];
  for (const n of ["G1", "G2", "G3"]) phones.push((await joinPhone(browser, code, n, "en")).page);
  await expect(tv.locator(".tvmember")).toHaveCount(3);
  await tv.waitForTimeout(500);

  // Hub Back, then Right and OK inside the guard: the dialog stays on "Stay" and the room stays open.
  await expect(tv.locator(".tvposter.is-focused")).toBeFocused();
  let keys = await burst(tv, [["Escape", 0], ["ArrowRight", 100], ["Enter", 100]]);
  expect(keys.at(-1)! - keys[0]!, "the keys must land inside the guard for this check to mean anything").toBeLessThan(400);
  await tv.waitForTimeout(800);
  await expect(tv.locator(".tvdialog")).toBeVisible();
  await expect(tv.locator(".tvdialog [data-default-focus]")).toBeFocused();
  await expect(tv.locator(".tvhub")).toBeVisible();
  await press(tv, "Escape");
  await expect(tv.locator(".tvdialog")).toHaveCount(0);

  // Kick confirm: OK on a member, then Right and OK inside the guard → nobody is kicked.
  await tv.waitForTimeout(450);
  await press(tv, "ArrowDown");
  await expect(tv.locator(".tvmember__btn").first()).toBeFocused();
  await tv.waitForTimeout(450);
  keys = await burst(tv, [["Enter", 0], ["ArrowRight", 100], ["Enter", 100]]);
  expect(keys.at(-1)! - keys[0]!).toBeLessThan(400);
  await tv.waitForTimeout(1000);
  await expect(tv.locator(".tvmember")).toHaveCount(3);
  await expect(tv.locator(".tvdialog")).toBeVisible();
  await press(tv, "Escape");
  await expect(tv.locator(".tvdialog")).toHaveCount(0);

  // JAMAA Pass: OK, then OK again 250 ms later, must not buy (billing on only).
  if ((await tv.locator("[data-pass]").count()) > 0) {
    await tv.waitForTimeout(450);
    await dpadTo(tv, "[data-hub-info]", "ArrowUp", 3); // member → poster → ⓘ
    await dpadTo(tv, "[data-pass]", "ArrowRight", 4);
    await tv.waitForTimeout(450);
    keys = await burst(tv, [["Enter", 0], ["Enter", 250]]);
    expect(keys.at(-1)! - keys[0]!).toBeLessThan(400);
    await expect(tv.locator(".tvpass")).toBeVisible();
    await tv.waitForTimeout(2000);
    await expect(tv.locator(".tvshop__active")).toHaveCount(0);
    await press(tv, "Escape");
  }
  for (const p of [...phones, tv]) await p.context().close();
});

test("first-visit intro: OK on Got it, then OK 150 ms later does not reopen the intro", async ({ browser }) => {
  const { tv, code } = await openTv(browser, "en");
  const phones = [];
  for (const n of ["I1", "I2", "I3"]) phones.push((await joinPhone(browser, code, n, "en")).page);
  await press(tv, "Enter");
  await expect(tv.locator("[data-intro]")).toBeVisible();
  for (let i = 0; i < 6 && (await visible(tv, "[data-intro-next]")); i++) await press(tv, "Enter");
  await expect(tv.locator("[data-intro-done]")).toBeFocused();
  await tv.waitForTimeout(450);
  await burst(tv, [["Enter", 0], ["Enter", 150]]);
  await tv.waitForTimeout(800);
  await expect(tv.locator("[data-intro]")).toHaveCount(0);
  await expect(tv.locator("[data-howto]")).toBeFocused();
  for (const p of [...phones, tv]) await p.context().close();
});
