// JAMAA-PLATFORM §6.7 G4 acceptance (lane B): Quiz Night played end to end against `wrangler dev`, the /tv mock driven
// by the keyboard D-pad, OK and Back ONLY, with 3–6 phones: hub → Quiz Night poster → setup (Short, Relaxed) → entrance →
// quiz intro → questions → reveal (OK completes it) → leaderboard after q3 → final → podium → cup. Checks GAME-TRIVIA
// §8.4 (first tap locks, all four tiles fade equally, a second tap sends nothing), the verdict screens, the late joiner
// (waits for the next READ), the pause menu "Next" in REVEAL, the unmirrored A–D grid in Arabic on the TV and phones,
// and the secrecy rules of §8.1 on every frame the TV and the phones received.
//
// Timing (review of 2026-11-10): every phone taps only once ITS OWN pad has been visible for 300 ms (the pad ignores
// taps for PAD_GUARD_MS = 250 after it mounts), each tap is checked to have locked, one phone is held back unanswered
// until the lock/opacity checks are done (all answered ends ANSWER early), and screenshots are taken only after the
// taps. Relaxed pace gives the slow CI machine room; the board index comes from the TV's own `public.index`.
//
// Trivia is registry-disabled until the owner ships it (shared/src/games/trivia/definition.ts `enabled: false`) and the
// Worker needs its packs emitted (`pnpm lint:content --emit`), so this spec skips itself unless GET /api/config lists
// "trivia". Run it against a Worker with trivia on: E2E_BASE_URL=http://127.0.0.1:<port> pnpm --filter
// @jamaa/web-client exec playwright test e2e/games/trivia.spec.ts. SHOTS_DIR=<dir> saves every screen (TV 1920×1080,
// phone 390×844) under <dir>/<locale>/.
import { mkdirSync } from "node:fs";
import { devices, expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

const SHOTS = process.env.SHOTS_DIR;

interface Frames { recv: string[]; sent: string[] }
interface Phone { page: Page; name: string; frames: Frames }

async function newPage(browser: Browser, kind: "tv" | "phone", locale: string): Promise<{ page: Page; frames: Frames }> {
  const ctx = await browser.newContext(kind === "tv"
    ? { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }
    : { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((l) => {
    try { if (!sessionStorage.getItem("e2e-init")) { localStorage.setItem("jamaa:locale", l); sessionStorage.setItem("e2e-init", "1"); } } catch { /* */ }
  }, locale);
  const page = await ctx.newPage();
  const frames: Frames = { recv: [], sent: [] };
  page.on("websocket", (ws) => {
    ws.on("framereceived", (f) => { if (typeof f.payload === "string") frames.recv.push(f.payload); });
    ws.on("framesent", (f) => { if (typeof f.payload === "string") frames.sent.push(f.payload); });
  });
  return { page, frames };
}

const press = async (p: Page, key: string, n = 1): Promise<void> => { for (let i = 0; i < n; i++) { await p.keyboard.press(key); await p.waitForTimeout(140); } };
const vis = (p: Page, sel: string): Promise<boolean> => p.locator(sel).first().isVisible().catch(() => false);
async function dpadTo(tv: Page, sel: string, key: string, max = 10): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await tv.locator(sel).first().evaluate((el) => el === document.activeElement, undefined, { timeout: 300 }).catch(() => false)) return;
    await press(tv, key);
  }
  if (process.env.E2E_DEBUG_DIR) await tv.screenshot({ path: `${process.env.E2E_DEBUG_DIR}/dpad-miss.png` });
  await expect(tv.locator(sel).first()).toBeFocused();
}

/** Screenshots, once per name. */
function shooter(locale: string): (p: Page, name: string, wait?: number) => Promise<void> {
  const done = new Set<string>();
  const dir = SHOTS ? `${SHOTS}/${locale}` : null;
  if (dir) mkdirSync(dir, { recursive: true });
  return async (p, name, wait = 300) => {
    if (!dir || done.has(name)) return;
    done.add(name);
    await p.waitForTimeout(wait);
    await p.screenshot({ path: `${dir}/${name}.png` });
  };
}

const tvPhase = (tv: Page): Promise<string | null> => tv.locator(".tqtv").first().getAttribute("data-phase", { timeout: 500 }).catch(() => null);

/** Every trivia view in a list of frames. */
function views(frames: string[]): { game: { phase: string; public: Record<string, unknown> & { reveal: unknown; phase: string }; me: Record<string, unknown> | null } }[] {
  const out = [];
  for (const f of frames) {
    try {
      const v = JSON.parse(f)?.view;
      if (v?.game?.gameId === "trivia") out.push(v);
    } catch { /* not JSON */ }
  }
  return out;
}

/** GAME-TRIVIA §8.1 / §13.3: before REVEAL no projection carries the correct position, per-option correctness or anybody's
 *  choice; the TV never gets a `me`; a phone's `me.myChoice` is its own (checked against what it sent). */
function checkSecrecy(tvFrames: string[], phones: Phone[]): void {
  const tvViews = views(tvFrames);
  expect(tvViews.length).toBeGreaterThan(10);
  for (const v of tvViews) {
    expect(v.game.me ?? null).toBeNull();
    if (v.game.public.phase !== "REVEAL") expect(v.game.public.reveal, `TV ${v.game.public.phase} carries a reveal`).toBeNull();
  }
  for (const ph of phones) {
    const sent = ph.frames.sent.filter((s) => s.includes('"ANSWER"')).map((s) => (JSON.parse(s) as { a?: { i?: { choice?: number } } }).a?.i?.choice);
    for (const v of views(ph.frames.recv)) {
      if (v.game.public.phase !== "REVEAL") expect(v.game.public.reveal, `${ph.name} ${v.game.public.phase} carries a reveal`).toBeNull();
      const raw = JSON.stringify(v.game.public);
      for (const k of ["correctIndex", "answers", "rngState", "usedKeys", "\"source\""]) expect(raw.includes(k), `${ph.name} sees ${k}`).toBe(false);
      const mine = v.game.me?.myChoice;
      if (typeof mine === "number" && sent.length > 0) expect(sent).toContain(mine);
    }
  }
}

async function joinPhone(browser: Browser, code: string, name: string, locale: string, expectSel = ".screen--hub"): Promise<Phone> {
  const { page, frames } = await newPage(browser, "phone", locale);
  await page.goto(`/${code}`);
  await page.locator("#name").fill(name);
  await page.locator(".actionbar .btn--primary").click();
  await expect(page.locator(expectSel).first()).toBeVisible({ timeout: 20_000 });
  return { page, name, frames };
}

/** Hub → Quiz Night (D-pad) → setup (first-time intro walked with OK) → Short + Relaxed → Start → entrance. */
async function startQuiz(tv: Page, phones: Phone[], rtl: boolean, snap: (p: Page, n: string, w?: number) => Promise<void>): Promise<void> {
  const END = rtl ? "ArrowLeft" : "ArrowRight", START = rtl ? "ArrowRight" : "ArrowLeft";
  await dpadTo(tv, ".tvposter.is-focused[data-game=trivia]", END, 6);
  for (const p of phones) await expect(p.page.locator(".hubph__card .poster")).toHaveAttribute("data-world", "quiz-studio");
  await snap(tv, "tv-00-hub-quiz-night", 900);
  await press(tv, "Enter");
  await expect(tv.locator(".tvsetup")).toBeVisible();
  await tv.waitForTimeout(1300);
  if (await vis(tv, "[data-intro]")) {
    await snap(tv, "tv-01-howto", 400);
    for (let i = 0; i < 6 && (await vis(tv, "[data-intro-next]")); i++) await press(tv, "Enter");
    await press(tv, "Enter");
    await expect(tv.locator("[data-intro]")).toHaveCount(0);
  }
  for (const p of phones) if (await vis(p.page, ".introsheet__skip")) await p.page.locator(".introsheet__skip").click();
  await tv.waitForTimeout(700);
  // How-to pane → the settings column (Right in LTR, Left in RTL).
  for (let i = 0; i < 4 && !(await tv.evaluate(() => !!document.activeElement?.closest(".tvpane--settings"))); i++) await press(tv, END, 1);
  await expect.poll(() => tv.evaluate(() => !!document.activeElement?.closest(".tvpane--settings"))).toBe(true);
  // Up/Down in the settings column until `row` is focused (direction from the DOM order of the column's controls).
  const focusRow = async (row: string): Promise<void> => {
    for (let i = 0; i < 10; i++) {
      const d = await tv.evaluate((r) => {
        const all = [...document.querySelectorAll<HTMLElement>(".tvpane--settings [data-row], .tvpane--settings [data-start]")];
        const at = all.indexOf(document.activeElement as HTMLElement), want = all.findIndex((e) => e.dataset.row === r);
        return at < 0 || want < 0 ? 1 : Math.sign(want - at);
      }, row);
      if (d === 0) return;
      await press(tv, d > 0 ? "ArrowDown" : "ArrowUp");
    }
    await expect(tv.locator(`[data-row=${row}]`)).toBeFocused();
  };
  await focusRow("length");
  await press(tv, START); // Normal → Short
  await focusRow("pace");
  await press(tv, START); // Normal → Relaxed
  await tv.waitForTimeout(500);
  await snap(tv, "tv-02-setup", 300);
  await snap(phones[0]!.page, "ph-01-setup-vip", 0);
  await dpadTo(tv, "[data-start]", "ArrowDown", 6);
  await tv.waitForTimeout(450);
  await press(tv, "Enter");
  await expect(tv.locator("[data-entrance]")).toBeVisible({ timeout: 8000 });
  await snap(tv, "tv-03-entrance", 900);
  await expect(tv.locator(".tqtv")).toBeVisible({ timeout: 10_000 });
}

interface PlayOpts {
  snap: (p: Page, n: string, w?: number) => Promise<void>;
  /** Called once after the first leaderboard (e.g. a late joiner). */
  afterBoard?: () => Promise<void>;
  /** Extra phones that join mid-game (they answer too once they can). */
  extra?: Phone[];
  /** Exercise the remote: OK completes a reveal, pause menu "Next" in another one. */
  remote?: boolean;
  rtl?: boolean;
}

/** Plays to RESULTS: phones answer different tiles at different speeds; screenshots every screen once. */
/** Waits until this phone's own pad is up (late joiners and benched phones never get one) and past its tap guard. */
async function padReady(ph: Phone): Promise<boolean> {
  const ok = await ph.page.locator(".tq-pad:not(.is-locked)").first().waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false);
  if (ok) await ph.page.waitForTimeout(300);
  return ok;
}

/** Taps tile `n` and checks the pad locked; a tap the guard swallowed (no lock, nothing sent) is retried once. */
async function tapAndLock(ph: Phone, n: number): Promise<void> {
  const tiles = ph.page.locator(".tq-pad .tq-tile");
  const count = await tiles.count();
  if (count === 0) return; // ANSWER already closed on this phone
  for (let attempt = 0; attempt < 2; attempt++) {
    await tiles.nth(n % count).click({ timeout: 2000 }).catch(() => undefined);
    const locked = await ph.page.locator(".tq-pad.is-locked").first().waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false);
    if (locked || !(await vis(ph.page, ".tq-pad"))) return;
  }
  await expect(ph.page.locator(".tq-pad.is-locked")).toBeVisible({ timeout: 500 });
}

async function playQuiz(tv: Page, phones: Phone[], o: PlayOpts): Promise<{ boards: number; reveals: number }> {
  const { snap } = o;
  const seen = new Map<string, number>();
  let reveals = 0, boards = 0, lastKey = "";
  const tapped = new Set<Phone>();
  let lockChecked = false, okChecked = false, nextChecked = false, mirrorChecked = false;
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    const phase = await tvPhase(tv);
    if (await vis(tv, "[data-results-bar]")) break;
    const counter = (await tv.locator(".tqtop__title").first().textContent().catch(() => "")) ?? "";
    const key = `${phase}:${counter}`;
    const fresh = key !== lastKey;
    lastKey = key;
    const all = [...phones, ...(o.extra ?? [])];
    if (fresh && phase) seen.set(phase, (seen.get(phase) ?? 0) + 1);
    const n = seen.get(phase ?? "") ?? 0;
    switch (phase) {
      case "QUIZ_INTRO":
        if (fresh) {
          await snap(tv, "tv-10-quiz-intro", 1600);
          await snap(phones[0]!.page, "ph-10-quiz-intro", 0);
        }
        break;
      case "READ":
        if (fresh) {
          await snap(tv, n === 1 ? "tv-11-read" : "tv-11b-read-later", 700);
          await snap(phones[1]!.page, "ph-11-read", 0);
          if (counter.includes("×2") || (await vis(tv, ".tqtop .tqx2"))) await snap(tv, "tv-11c-read-final", 0);
        }
        break;
      case "ANSWER": {
        if (!fresh) break;
        tapped.clear();
        // 1. Which phones play this question: each waits for ITS OWN pad (+300 ms past the 250 ms tap guard).
        const ready = await Promise.all(all.map(padReady));
        const playing = all.filter((_, i) => ready[i]);
        expect(playing).toContain(phones[0]);
        if (o.rtl && !mirrorChecked) {
          // §8.2: A top-left, B top-right on every device, never mirrored (Arabic TV and phone).
          mirrorChecked = true;
          const a = await tv.locator(".tqtile--a, .tqtile--true").first().boundingBox();
          const b = await tv.locator(".tqtile--b, .tqtile--false").first().boundingBox();
          expect(a!.x).toBeLessThan(b!.x);
          const pa = await phones[0]!.page.locator(".tq-tile").nth(0).boundingBox();
          const pb = await phones[0]!.page.locator(".tq-tile").nth(1).boundingBox();
          expect(pa!.x).toBeLessThan(pb!.x);
        }
        // 2. One phone (never phones[0]) is held back so ANSWER stays open through the checks and the screenshots.
        const held = playing.length > 1 ? playing[playing.length - 1]! : null;
        const now = playing.filter((ph) => ph !== held);
        await Promise.all(now.map(async (ph, i) => {
          await ph.page.waitForTimeout(110 * i);
          await tapAndLock(ph, i + reveals);
          tapped.add(ph);
        }));
        const p0 = phones[0]!;
        if (!lockChecked && tapped.has(p0) && held) {
          // First tap locks; ALL tiles fade equally; a second tap sends nothing; the pick is a monochrome line glyph at
          // the end of the question row, not beside the lock check (§8.4).
          lockChecked = true;
          const tiles = p0.page.locator(".tq-tile");
          await expect(p0.page.locator(".tq-pad.is-locked")).toBeVisible();
          await p0.page.waitForTimeout(350);
          const op = await tiles.evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity));
          expect(op.length).toBeGreaterThan(1);
          expect(new Set(op).size).toBe(1);
          expect(Number(op[0])).toBeLessThan(0.5);
          await expect(p0.page.locator(".tq-pad__q .tq-pad__pick svg.tq-shape--line")).toBeVisible();
          await expect(p0.page.locator(".tq-pad__locked .tq-pad__pick")).toHaveCount(0);
          await expect(p0.page.locator(".coach")).toBeHidden();
          const before = p0.frames.sent.filter((x) => x.includes('"ANSWER"')).length;
          await tiles.nth(1).click({ force: true });
          await p0.page.waitForTimeout(250);
          expect(p0.frames.sent.filter((x) => x.includes('"ANSWER"')).length).toBe(before);
          // The held-back phone is still open: the TV shows "some in" (white podium rings, no hint of the choice).
          expect(await vis(held.page, ".tq-pad:not(.is-locked)")).toBe(true);
          await snap(p0.page, "ph-13-locked", 0);
          await snap(tv, "tv-13-answer-some-in", 0);
        }
        // 3. Screenshots only after the taps (they are slow); then the held-back phone answers.
        const n = seen.get("ANSWER") ?? 0;
        await snap(tv, n === 1 ? "tv-12-answer-open" : "tv-12b-answer-later", 0);
        if (held) await snap(held.page, n === 1 ? "ph-12-pad" : "ph-12b-pad-later", 0);
        if (held) { await tapAndLock(held, 0); tapped.add(held); }
        break;
      }
      case "REVEAL": {
        if (!fresh) break;
        reveals++;
        // The verdict paints at once (no opacity-0 entrance): every phone that answered shows a readable h1.
        await Promise.all([...tapped].map(async (ph) => {
          const h1 = ph.page.locator(".tq-verdict h1").first();
          await expect(h1).toBeVisible({ timeout: 1500 });
          const op = await h1.evaluate((e) => getComputedStyle(e.closest(".tq-verdict__hero") ?? e).opacity);
          expect(Number(op)).toBe(1);
        }));
        const verdictShots = async (): Promise<void> => {
          for (const ph of all) {
            const v = ph.page.locator(".tq-verdict").first();
            if (!(await v.isVisible().catch(() => false))) continue;
            const kind = (await v.getAttribute("class"))?.match(/tq-verdict--(\w+)/)?.[1] ?? "x";
            await snap(ph.page, `ph-14-verdict-${kind}`, 0);
          }
        };
        if (reveals === 1) {
          await Promise.all([
            (async () => {
              await snap(tv, "tv-14-reveal-jump", 1700);
              await snap(tv, "tv-15-reveal-coins", 1500);
              await snap(tv, "tv-16-reveal-settled", 2000);
            })(),
            verdictShots(),
          ]);
        }
        if (o.remote && reveals >= 2 && !okChecked && (await vis(tv, ".tqrv:not(.is-done)"))) {
          // §3.10 E: OK in game only completes the reveal choreography (it never activates anything). Pressed only
          // while the choreography still runs (the 4.9 s script), checked right after.
          okChecked = true;
          await press(tv, "Enter");
          await expect(tv.locator(".tqrv.is-done")).toBeVisible({ timeout: 1500 });
          await snap(tv, "tv-16b-reveal-ok-completed", 100);
        }
        if (o.remote && reveals === 3 && !nextChecked) {
          // Back → pause menu (REVEAL: Next + Void this question); "Next" advances (HOST_ADVANCE) with the remote only.
          nextChecked = true;
          await tv.waitForTimeout(1200);
          await press(tv, "Escape");
          await expect(tv.locator(".tvdialog--menu")).toBeVisible();
          await expect(tv.locator("[data-pause-item=voidQuestion]")).toBeVisible();
          await snap(tv, "tv-17-pause-reveal", 450); // a dialog ignores the D-pad for INPUT_GUARD_MS after it opens (§3.10 E)
          await dpadTo(tv, "[data-pause-item=next]", "ArrowDown", 4);
          await press(tv, "Enter");
          await expect(tv.locator(".tvdialog--menu")).toHaveCount(0);
          await expect.poll(() => tvPhase(tv), { timeout: 4000 }).not.toBe("REVEAL");
        }
        if (reveals > 1) await verdictShots();
        break;
      }
      case "LEADERBOARD":
        if (fresh) {
          boards++;
          await snap(tv, "tv-18-leaderboard", 2700);
          await snap(phones[0]!.page, "ph-15-standing", 0);
          await snap(phones[phones.length - 1]!.page, "ph-15b-standing-other", 0);
          if (boards === 1 && o.afterBoard) await o.afterBoard();
        }
        break;
      case "FINAL_INTRO":
        if (fresh) {
          await snap(tv, "tv-19-final-intro", 1900);
          await snap(phones[0]!.page, "ph-16-final", 0);
        }
        break;
      case "RESULTS":
        await snap(tv, "tv-20-podium", 2600);
        break;
      default:
        break;
    }
    await tv.waitForTimeout(fresh ? 60 : 200);
  }
  await expect(tv.locator("[data-results-bar]")).toBeVisible({ timeout: 20_000 });
  return { boards, reveals };
}

let enabled = true;
test.beforeAll(async ({ request }) => {
  const r = await request.get("/api/config").catch(() => null);
  const body = r && r.ok() ? ((await r.json()) as { games?: string[] }) : null;
  enabled = !!body?.games?.includes("trivia");
});

for (const [locale, names] of [
  ["en", ["Rami", "Lina", "Karim", "Maya"]],
  ["ar", ["ليلى", "كريم", "نور"]],
  ["es", ["Lucía", "Mateo", "Sofía", "Diego", "Vale", "Nico"]],
] as const) {
  test(`Quiz Night ${locale}: remote-only TV + ${names.length} phones, full game`, async ({ browser }) => {
    test.skip(!enabled, "trivia is not in GET /api/config games (registry-disabled or not in GAMES_ENABLED)");
    test.setTimeout(540_000);
    const snap = shooter(locale);
    const rtl = locale === "ar";
    const { page: tv, frames: tvFrames } = await newPage(browser, "tv", locale);
    await tv.goto("/tv");
    const big = tv.locator(".tvjoin .tvcode");
    await expect(big).toBeVisible({ timeout: 30_000 });
    const code = ((await big.getAttribute("aria-label")) ?? "").replace(/\s+/g, "");
    const phones: Phone[] = [];
    for (const n of names) phones.push(await joinPhone(browser, code, n, locale));
    await startQuiz(tv, phones, rtl, snap);

    const extra: Phone[] = [];
    const res = await playQuiz(tv, phones, {
      snap, rtl, remote: locale !== "ar", extra,
      afterBoard: locale === "en" ? async () => {
        // §6 late joiner: in at once via the `join` hook, waits for the next READ, then plays from 0 with a "New" ribbon.
        const late = await joinPhone(browser, code, "Nour", locale, ".tq-wait, .tq-read, .tq-pad, .tq-intro, .tq-final, .ingame");
        await snap(late.page, "ph-17-late-joiner", 200);
        extra.push(late);
      } : undefined,
    });
    // §4: Short = 7 questions → a leaderboard after q3 and q6 (q6 also precedes the final). Read from the TV's own
    // projection (`public.index` is 0-based), not from a counter polled off the screen.
    const boardIdx = [...new Set(views(tvFrames.recv).filter((v) => v.game.public.phase === "LEADERBOARD").map((v) => Number(v.game.public.index)))];
    expect(boardIdx.map((i) => i + 1)).toEqual([3, 6]);
    expect(res.boards).toBeGreaterThanOrEqual(1);
    expect(res.reveals).toBeGreaterThanOrEqual(6);
    if (extra[0]) {
      const lv = views(extra[0].frames.recv);
      expect(lv.some((v) => v.game.public.phase === "ANSWER" && v.game.me?.waitingForNext === false)).toBe(true);
    }
    // Results: the podium settles, then the platform bar (cup + Play again) and the phones' cup panel.
    await expect(tv.locator("[data-results-bar].is-ready")).toBeVisible({ timeout: 20_000 });
    await snap(tv, "tv-21-results-cup", 300);
    for (const [i, p] of phones.entries()) {
      await expect(p.page.locator(".tq-result")).toBeVisible();
      if (i < 2) await snap(p.page, i === 0 ? "ph-18-results-vip" : "ph-18b-results", 900);
    }
    checkSecrecy(tvFrames.recv, [...phones, ...extra]);
  });
}
