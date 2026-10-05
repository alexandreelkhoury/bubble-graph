// Remote-only /tv: the TV page is driven ONLY with the D-pad keys (arrows, Enter = OK, Escape = Back), never a pointer,
// through a whole game in EN and in AR (RTL). After every key the focus must be on a visible control inside the canvas,
// with the focus ring, not covered by another layer, and inside the topmost overlay when one is open (DESIGN §7).
// The phones are driven normally.
import { devices, expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

type Key = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Enter" | "Escape";

async function newPage(browser: Browser, kind: "tv" | "phone", locale: string): Promise<Page> {
  const ctx = await browser.newContext(
    kind === "tv" ? { viewport: { width: 1920, height: 1080 } } : { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
  );
  await ctx.addInitScript((l) => {
    try {
      if (!sessionStorage.getItem("e2e-init")) { localStorage.setItem("mishana:locale", l); sessionStorage.setItem("e2e-init", "1"); }
    } catch { /* ignore */ }
  }, locale);
  return ctx.newPage();
}

/** Every rule the remote depends on, as a list of problems (empty = fine). */
async function focusProblems(tv: Page): Promise<string[]> {
  return tv.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    const canvas = document.querySelector(".tv__canvas");
    if (!a || a === document.body || !canvas) return ["nothing focused"];
    const what = `${a.tagName.toLowerCase()}.${String(a.className).split(" ")[0]} "${(a.textContent ?? "").trim().slice(0, 30)}"`;
    const out: string[] = [];
    if (!canvas.contains(a)) out.push(`focus outside the canvas: ${what}`);
    const cs = getComputedStyle(a);
    if (!cs.boxShadow || cs.boxShadow === "none") out.push(`no focus ring: ${what}`);
    const r = a.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || cs.visibility === "hidden") out.push(`not visible: ${what}`);
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (top && !a.contains(top) && !top.contains(a)) out.push(`covered by ${String(top.className)}: ${what}`);
    const overlays = document.querySelectorAll(".tvoverlay");
    const last = overlays[overlays.length - 1];
    if (last && !last.contains(a)) out.push(`focus escaped the open overlay: ${what}`);
    return out;
  });
}

async function expectFocusOk(tv: Page, label: string): Promise<void> {
  await expect.poll(() => focusProblems(tv), { message: label, timeout: 2000 }).toEqual([]);
}

async function press(tv: Page, key: Key, label: string = key, wait = 200): Promise<void> {
  await tv.keyboard.press(key);
  await tv.waitForTimeout(wait);
  await expectFocusOk(tv, `${label} (${key})`);
}

const focused = (tv: Page, sel: string): Promise<boolean> => tv.evaluate((s) => document.activeElement?.matches(s) ?? false, sel);
const visible = (p: Page, sel: string): Promise<boolean> => p.locator(sel).first().isVisible().catch(() => false);

/** Presses `keys` in turn (each up to `n` times) until the focused element matches `sel`. */
async function reach(tv: Page, sel: string, keys: Key[], n = 6): Promise<void> {
  for (const k of keys) {
    for (let i = 0; i < n; i++) {
      if (await focused(tv, sel)) return;
      await press(tv, k, `reach ${sel}`);
    }
  }
  expect(await focused(tv, sel), `D-pad can reach ${sel}`).toBe(true);
}

/** OK twice on the focused action pill (arm, then confirm). */
async function pillTwice(tv: Page): Promise<void> {
  await reach(tv, ".tvpill", ["ArrowDown", "ArrowRight", "ArrowLeft"], 3);
  await press(tv, "Enter", "arm the pill", 120);
  // The first OK may only have skipped an animation (the TV-08 tie overlay): then the next one arms.
  if ((await tv.locator(".tvpill.is-armed").count()) === 0) await press(tv, "Enter", "arm the pill", 120);
  await expect(tv.locator(".tvpill.is-armed")).toHaveCount(1);
  await press(tv, "Enter", "confirm the pill", 500);
}

async function remoteOnlyGame(browser: Browser, locale: "en" | "ar"): Promise<void> {
  const rtl = locale === "ar";
  const fwd: Key = rtl ? "ArrowLeft" : "ArrowRight";
  const bwd: Key = rtl ? "ArrowRight" : "ArrowLeft";
  const tv = await newPage(browser, "tv", locale);
  await tv.goto("/tv");
  const big = tv.locator(".tvlobby .tvcode--big");
  await expect(big).toBeVisible({ timeout: 30_000 });
  const code = ((await big.getAttribute("aria-label")) ?? "").replace(/\s+/g, "");
  await expectFocusOk(tv, "lobby initial");
  expect(await focused(tv, ".tvbtn--start"), "SPEC §9.6: Start is the initial focus (NOT_ENOUGH_PLAYERS)").toBe(true);

  const names = rtl ? ["رامي", "Léa", "نور", "Sam", "مايا"] : ["Rami", "Léa", "Nour", "Sam", "Maya"];
  const phones: Page[] = [];
  for (const n of names) {
    const p = await newPage(browser, "phone", locale);
    await p.goto(`/${code}`);
    await p.locator("#name").fill(n);
    await p.locator(".actionbar .btn--primary").click();
    await expect(p.locator(".screen--lobby")).toBeVisible();
    phones.push(p);
  }
  await expect(tv.locator(".tvgrid .tile--btn")).toHaveCount(names.length);

  // TV-02: Up enters the grid; OK on a tile opens the kick dialog on its safe option; arrows stay trapped; Back closes
  // it and gives focus back to the tile.
  await reach(tv, ".tile--btn", ["ArrowUp"], 2);
  for (const k of [fwd, fwd, "ArrowDown", "ArrowUp", bwd] as Key[]) await press(tv, k, "grid");
  await press(tv, "Enter", "kick dialog", 350);
  await expect(tv.locator(".tvoverlay .tvdialog")).toBeVisible();
  for (const k of ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"] as Key[]) await press(tv, k, "kick dialog trap");
  await press(tv, "Escape", "cancel kick", 350);
  await expect(tv.locator(".tvoverlay")).toHaveCount(0);
  expect(await focused(tv, ".tile--btn")).toBe(true);

  // Language list: opens on the current language, Back closes it.
  await reach(tv, ".tvbottom--lobby .tvbtn", ["ArrowDown"], 3);
  await reach(tv, ".tvbottom--lobby [aria-haspopup=dialog]", [bwd, fwd], 3);
  await press(tv, "Enter", "language list", 350);
  expect(await focused(tv, ".tvmenu__item.is-on")).toBe(true);
  await press(tv, "Escape", "close language list", 350);
  await expect(tv.locator(".tvoverlay")).toHaveCount(0);

  // TV-03 Settings: into the rows, a value steps, Up from the first row reaches Done, Down stops at the last row,
  // Back walks rows → categories → lobby.
  await reach(tv, ".tvbottom--lobby .tvbtn:not([aria-haspopup]):not(.tvbtn--start)", [bwd], 3);
  await press(tv, "Enter", "open settings", 450);
  await expect(tv.locator(".tvsettings")).toBeVisible();
  expect(await focused(tv, ".tvcat")).toBe(true);
  await press(tv, fwd, "into rows");
  expect(await focused(tv, ".setrowtv")).toBe(true);
  const value = (): Promise<string | null> => tv.evaluate(() => document.activeElement?.querySelector(".setrowtv__value")?.textContent ?? null);
  const before = await value();
  await press(tv, fwd, "step +", 400);
  expect(await value()).not.toBe(before);
  await press(tv, bwd, "step −", 400);
  expect(await value()).toBe(before);
  for (let i = 0; i < 8; i++) await press(tv, "ArrowDown", "rows down", 120);
  expect(await focused(tv, ".setrowtv"), "Down never leaves the rows").toBe(true);
  for (let i = 0; i < 8; i++) await press(tv, "ArrowUp", "rows up", 120);
  expect(await focused(tv, ".tvsettings__head .tvbtn"), "Up from the first row reaches Done").toBe(true);
  // The mute toggle sits next to Done (a TV device setting); OK flips it, and it is remembered.
  await press(tv, bwd, "Done → sound");
  expect(await focused(tv, "[data-sound-toggle]")).toBe(true);
  const pressed = (): Promise<string | null> => tv.evaluate(() => document.activeElement?.getAttribute("aria-pressed") ?? null);
  expect(await pressed()).toBe("true");
  await press(tv, "Enter", "mute");
  expect(await pressed()).toBe("false");
  expect(await tv.evaluate(() => localStorage.getItem("mishana:tvSound"))).toBe("off");
  await press(tv, "Enter", "unmute");
  expect(await pressed()).toBe("true");
  // The first key press unlocked audio: every cue file was fetched (DESIGN §6.4, TV only).
  expect(await tv.evaluate(() => performance.getEntriesByType("resource").filter((e) => e.name.includes("/sounds/")).length)).toBeGreaterThanOrEqual(26);
  await press(tv, fwd, "sound → Done");
  await press(tv, "ArrowDown", "Done → rows");
  expect(await focused(tv, ".setrowtv")).toBe(true);
  await press(tv, "Escape", "rows → categories", 300);
  expect(await focused(tv, ".tvcat")).toBe(true);
  // TV-03 About (PAYMENTS-SPEC §3.12): the last category shows the install id; nothing in it takes focus.
  await reach(tv, ".tvcat[data-cat=about]", ["ArrowDown"]);
  await expect(tv.locator("[data-install-id]")).toHaveText(/^([0-9a-f]{4} ){7}[0-9a-f]{4}$/);
  await press(tv, fwd, "About has no rows", 200);
  expect(await focused(tv, ".tvcat[data-cat=about]")).toBe(true);
  await press(tv, "Escape", "settings → lobby", 450);
  await expect(tv.locator(".tvlobby")).toBeVisible();

  // Start from the TV; Back in a game opens the pause menu (focus trapped), Back resumes.
  await reach(tv, ".tvbtn--start", [fwd, "ArrowDown"], 4);
  await press(tv, "Enter", "start", 900);
  await expect(tv.locator(".tvreveal")).toBeVisible();
  await press(tv, "Escape", "pause", 350);
  await expect(tv.locator(".tvdialog--menu")).toBeVisible();
  await expect(tv.locator(".tvdialog--menu [data-sound-toggle]")).toBeVisible();
  for (let i = 0; i < 7; i++) await press(tv, "ArrowDown", "pause trap", 100);
  for (const k of ["ArrowLeft", "ArrowRight"] as Key[]) await press(tv, k, "pause trap", 100);
  await press(tv, "Escape", "resume", 350);
  await expect(tv.locator(".tvoverlay")).toHaveCount(0);

  // The phones read their cards; the Blank is the one everybody votes for.
  let blank: string | null = null;
  for (const [i, p] of phones.entries()) {
    const box = await p.locator(".wordcard").boundingBox();
    if (box) {
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await p.mouse.down();
      await expect(p.locator(".wordface")).toBeVisible();
      if (await visible(p, ".wordface--blank")) blank = names[i]!;
      await p.mouse.up();
    }
    if (i < phones.length - 1) await p.locator(".actionbar .btn--primary").click();
  }
  await pillTwice(tv); // "Start now" for the last phone
  await expect(tv.locator(".tvclues")).toBeVisible();

  // The game, TV by remote only: skip turns with the pill, skip the reveal with OK, continue with the pill.
  const until = Date.now() + 240_000;
  let elimSkipped = false;
  while (Date.now() < until && !(await visible(tv, ".tvresults"))) {
    if (await visible(tv, ".tvclues")) await pillTwice(tv);
    for (const p of phones) {
      if (await visible(p, ".voterow")) {
        const pick = blank ? p.locator(".voterow", { hasText: blank }) : p.locator(".voterow");
        await ((await pick.count()) > 0 ? pick : p.locator(".voterow")).first().click();
        await p.locator(".actionbar .btn--primary").click().catch(() => undefined);
      } else if (await visible(p, ".input--big")) {
        await p.locator(".input--big").fill("zzwrong");
        await p.locator(".actionbar .btn--primary").click();
      }
    }
    if (await visible(tv, ".tvelim") && !elimSkipped) {
      elimSkipped = true;
      await press(tv, "Enter", "skip the vote reveal", 300);
    }
    if (await visible(tv, ".tvguess.is-wrong, .tvguess.is-correct, .tvguess.is-timeout")) await pillTwice(tv);
    await expectFocusOk(tv, "game loop");
    await tv.waitForTimeout(250);
  }
  await expect(tv.locator(".tvresults")).toBeVisible();

  // TV-11: stage 1 already has Play again focused; OK only skips to stage 2. Up reaches the scoreboard rows, Down
  // walks them (5 rows show; more scroll), and walks back out to the actions.
  await expectFocusOk(tv, "results stage 1");
  expect(await focused(tv, ".tvbottom--results .tvbtn--primary")).toBe(true);
  await press(tv, "Enter", "stage 2", 600);
  await expect(tv.locator(".tvresults.is-stage2")).toBeVisible();
  await expect(tv.locator(".tvlobby")).toHaveCount(0);
  await press(tv, "ArrowUp", "into the scoreboard");
  expect(await focused(tv, ".tvsb__row")).toBe(true);
  await reach(tv, ".tvsb__row:last-child", ["ArrowDown"], 6);
  if ((await tv.locator(".tvsb__body .tvsb__row").count()) > 5) expect(await tv.locator(".tvsb__body").evaluate((b) => b.scrollTop)).toBeGreaterThan(0);
  await press(tv, "ArrowDown", "out of the scoreboard");
  expect(await focused(tv, ".tvbottom--results .tvbtn")).toBe(true);
  await reach(tv, ".tvbottom--results .tvbtn--primary", [bwd, fwd], 3);
  await press(tv, "Enter", "play again", 1200);
  await expect(tv.locator(".tvlobby")).toBeVisible();
  await expectFocusOk(tv, "lobby after play again");

  // Back in the lobby exits (DESIGN TV-02), but with players in the room the browser TV asks first, "Keep room"
  // focused: Back keeps the room, Close exits to a remote-friendly splash whose focused button opens a new room.
  await press(tv, "Escape", "close room?", 400);
  await expect(tv.locator(".tvdialog")).toBeVisible();
  expect(await focused(tv, ".tvdialog__actions .tvbtn:not(.tvbtn--danger)")).toBe(true);
  await press(tv, "Escape", "keep room", 400);
  await expect(tv.locator(".tvdialog")).toHaveCount(0);
  await expect(tv.locator(".tvlobby")).toBeVisible();
  await press(tv, "Escape", "close room?", 400);
  await reach(tv, ".tvdialog__actions .tvbtn--danger", [fwd], 2);
  await press(tv, "Enter", "exit", 400);
  await expect(tv.locator(".tvfatal")).toBeVisible();
  await press(tv, "Enter", "open again", 400);
  await expect(tv.locator(".tvlobby .tvcode--big")).toBeVisible({ timeout: 30_000 });
  await expectFocusOk(tv, "new lobby");
}

test("TV remote only: a full game with the D-pad, OK and Back (EN)", async ({ browser }) => {
  test.setTimeout(360_000);
  await remoteOnlyGame(browser, "en");
});

test("TV remote only: a full game with the D-pad, OK and Back (AR, RTL)", async ({ browser }) => {
  test.setTimeout(360_000);
  await remoteOnlyGame(browser, "ar");
});
