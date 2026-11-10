// GAME-LIKELY / JAMAA-PLATFORM §6.6 G3 (lane B): Most Likely through the hub, the /tv mock driven by the remote ONLY
// (D-pad, OK, Back, `i`), with 3–6 phones voting: self-votes, a changed vote, unanimous / chaos / tie cards, the
// reveal, the awards ceremony and the results; one secret-votes game (percentage board, no points) in Arabic (RTL).
// Secrecy is checked on the raw WebSocket frames: no ballot anywhere before REVEAL, and never a voter→target pair in
// secret mode, on the TV or any phone. SHOTS_DIR=<dir> saves every screen (TV 1920×1080, phone 390×844) per locale.
//
// Most Likely must be live on the server under test (GAMES_ENABLED containing "likely" and the registry entry enabled);
// otherwise every test here is skipped with that reason.
import { mkdirSync } from "node:fs";
import { devices, expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

const SHOTS = process.env.SHOTS_DIR;

async function newPage(browser: Browser, kind: "tv" | "phone", locale: string): Promise<Page> {
  const ctx = await browser.newContext(kind === "tv"
    ? { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }
    : { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((l) => {
    try {
      if (!sessionStorage.getItem("e2e-init")) { localStorage.setItem("jamaa:locale", l); sessionStorage.setItem("e2e-init", "1"); }
    } catch { /* ignore */ }
  }, locale);
  return ctx.newPage();
}

const press = async (tv: Page, key: string, n = 1): Promise<void> => {
  for (let i = 0; i < n; i++) { await tv.keyboard.press(key); await tv.waitForTimeout(130); }
};
async function dpadTo(tv: Page, sel: string, key: string, max = 10): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await tv.evaluate((s) => !!document.activeElement?.matches(s) || !!document.activeElement?.closest(s), sel).catch(() => false)) return;
    await tv.keyboard.press(key);
    await tv.waitForTimeout(160);
  }
  await expect(tv.locator(sel).first()).toBeFocused();
}
const visible = (p: Page, sel: string): Promise<boolean> => p.locator(sel).first().isVisible().catch(() => false);

interface Run {
  tv: Page; phones: Page[]; names: string[]; locale: string; tvFrames: string[]; phoneFrames: string[][];
  shot(p: Page, name: string, wait?: number): Promise<void>;
}

async function setup(browser: Browser, locale: string, names: string[]): Promise<Run> {
  const dir = SHOTS ? `${SHOTS}/${locale}` : null;
  if (dir) mkdirSync(dir, { recursive: true });
  const shot = async (p: Page, name: string, wait = 250): Promise<void> => {
    if (!dir) return;
    await p.waitForTimeout(wait);
    await p.screenshot({ path: `${dir}/${name}.png` });
  };
  const tv = await newPage(browser, "tv", locale);
  // Screenshot mode only: a frame-clock warp for the reveal. While a reveal is on screen the rAF clock (the shared
  // runner's time base) is frozen, and the test steps it forward to exact moments of the choreography, so a slow
  // full-HD screenshot never misses a beat. The server's timers are untouched; CSS animations run normally.
  if (SHOTS) await tv.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    let vt = 0, last = -1, frozen = false;
    window.requestAnimationFrame = (cb) => raf((now) => { if (last >= 0 && !frozen) vt += now - last; last = now; cb(vt); });
    (window as unknown as { __lkStep(ms: number): void }).__lkStep = (ms) => { vt += ms; };
    new MutationObserver(() => { frozen = !!document.querySelector('[data-reveal][data-running="1"]'); }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-running"] });
  });
  const tvFrames: string[] = [];
  tv.on("websocket", (ws) => ws.on("framereceived", (f) => { if (typeof f.payload === "string") tvFrames.push(f.payload); }));
  await tv.goto("/tv");
  const big = tv.locator(".tvjoin .tvcode");
  await expect(big).toBeVisible({ timeout: 30_000 });
  const code = ((await big.getAttribute("aria-label")) ?? "").replace(/\s+/g, "");
  const live = await tv.evaluate(async () => ((await (await fetch("/api/config")).json()) as { games: string[] }).games);
  test.skip(!live.includes("likely"), "Most Likely is not enabled on this server (GAMES_ENABLED + registry)");
  const phones: Page[] = [];
  const phoneFrames: string[][] = [];
  for (const n of names) {
    const p = await newPage(browser, "phone", locale);
    const frames: string[] = [];
    p.on("websocket", (ws) => ws.on("framereceived", (f) => { if (typeof f.payload === "string") frames.push(f.payload); }));
    await p.goto(`/${code}`);
    await p.locator("#name").fill(n);
    await p.locator(".actionbar .btn--primary").click();
    await expect(p.locator(".screen--hub")).toBeVisible();
    phones.push(p);
    phoneFrames.push(frames);
  }
  await expect(tv.locator(".tvmember")).toHaveCount(names.length);
  return { tv, phones, names, locale, tvFrames, phoneFrames, shot };
}

/** Hub → Most Likely poster → OK → (first-time intro) → setup, by remote only. */
async function openLikely(r: Run, opts: { secret: boolean; short: boolean }): Promise<void> {
  const { tv, phones, locale } = r;
  const fwd = locale === "ar" ? "ArrowLeft" : "ArrowRight";
  const back = locale === "ar" ? "ArrowRight" : "ArrowLeft";
  await dpadTo(tv, '.tvposter.is-focused[data-game="likely"]', fwd, 6);
  for (const p of phones) await expect(p.locator('.hubph__card .poster[data-world="rooftop"]')).toBeVisible();
  await r.shot(tv, "tv-00-hub-likely", 600);
  await press(tv, "Enter");
  await expect(tv.locator(".tvsetup")).toBeVisible();
  await expect(tv.locator(".tvportal")).toHaveCount(0);
  // The first-time intro opens once the portal has landed (per TV); wait for it or for the setup focus.
  await expect(tv.locator("[data-intro], [data-start]:focus, [data-howto]:focus").first()).toBeVisible();
  await tv.waitForTimeout(400);
  if (await visible(tv, "[data-intro]")) {
    await r.shot(tv, "tv-01-howto", 900);
    for (let i = 0; i < 6 && (await visible(tv, "[data-intro-next]")); i++) await press(tv, "Enter");
    await expect(tv.locator("[data-intro-done]")).toBeFocused();
    await press(tv, "Enter");
    await expect(tv.locator("[data-intro]")).toHaveCount(0);
  }
  for (const p of phones) if (await visible(p, ".introsheet__skip")) await p.locator(".introsheet__skip").click();
  await tv.waitForTimeout(500);
  // ⓘ from setup: Most Likely's rules, Back closes.
  await expect(tv.locator(".tvportal")).toHaveCount(0);
  for (let i = 0; i < 4 && !(await visible(tv, ".tvrules[data-rules=likely]")); i++) { await press(tv, "i"); await tv.waitForTimeout(500); }
  await expect(tv.locator(".tvrules[data-rules=likely]")).toBeVisible();
  await r.shot(tv, "tv-02-rules", 500);
  await press(tv, "Escape");
  await expect(tv.locator(".tvrules")).toHaveCount(0);
  await tv.waitForTimeout(600); // the setup ignores the D-pad for INPUT_GUARD_MS after the sheet closes
  // Settings column: Short length (Left/Right steps the value), secret votes (OK toggles).
  await dpadTo(tv, "[data-howto]", back, 3).catch(() => undefined);
  await press(tv, fwd);
  if (opts.short) {
    await dpadTo(tv, "[data-row=length]", "ArrowUp", 8).catch(async () => dpadTo(tv, "[data-row=length]", "ArrowDown", 8));
    await press(tv, back, 1);
  }
  if (opts.secret) {
    await dpadTo(tv, "[data-row=showVoters]", "ArrowDown", 8).catch(async () => dpadTo(tv, "[data-row=showVoters]", "ArrowUp", 8));
    await press(tv, "Enter");
  }
  await tv.waitForTimeout(400);
  await r.shot(tv, "tv-03-setup", 300);
  await r.shot(phones[0]!, "ph-03-setup-vip");
  await dpadTo(tv, "[data-start]", "ArrowDown", 10);
  await press(tv, "Enter");
  await expect(tv.locator(".tvgamehost[data-game=likely]")).toBeVisible();
}

/** Card index (0-based) as the TV shows it ("3 / 8"). */
async function tvCardIndex(tv: Page): Promise<number> {
  const s = await tv.evaluate(() => document.querySelector(".lktop__title .tnum")?.textContent ?? "").catch(() => "");
  const m = /(\d+)\s*\/\s*(\d+)/.exec(s);
  return m ? Number(m[1]) - 1 : -1;
}

type Plan = (card: number, voter: number, n: number) => number | null;
/** Card 0: everyone on player 0 (player 0 votes for themself → unanimous, self-aware); card 1: chaos (each votes the
 *  next); card 2: a tie; then a mix. null = abstain. */
const PLAN: Plan = (card, i, n) => {
  if (card === 0) return 0;
  if (card === 1) return (i + 1) % n;
  if (card === 2) return i % 2 === 0 ? 1 : 2 % n;
  return (card + (i < n / 2 ? 0 : 1)) % n;
};

async function playToResults(r: Run, opts: { shots: boolean; changeVote?: boolean; nextVia?: boolean; secret?: boolean }): Promise<void> {
  const { tv, phones } = r;
  const n = phones.length;
  const voted = new Set<string>();
  const shotCards = new Set<string>();
  const deadline = Date.now() + 540_000;
  let seenAwards = false;
  let usedOk = false;
  // The reveals of cards 0–2 (unanimous, chaos, tie) are shot by a watcher running beside the voting loop, at fixed
  // offsets into the choreography (run, spotlight + rosette, coins/board + caption).
  const watcher = opts.shots ? (async () => {
    // Cards 0–2 follow PLAN (unanimous, chaos, tie); each reveal is labelled by the card index the TV shows.
    const labels = ["unanimous", "chaos", "tie"];
    const done = new Set<number>();
    while (done.size < labels.length) {
      await tv.locator('[data-reveal][data-running="1"]').waitFor({ timeout: 120_000 });
      const card = await tvCardIndex(tv);
      const label = labels[card];
      if (!label || done.has(card)) { await tv.locator("[data-reveal]").waitFor({ state: "detached", timeout: 30_000 }); if (card > 2) break; continue; }
      done.add(card);
      // The TV's reveal clock is frozen in screenshot mode: its three beats are stepped and shot first, then the
      // phones, which keep their own reveal for the whole server window.
      const step = (ms: number): Promise<void> => tv.evaluate((x) => (window as unknown as { __lkStep(ms: number): void }).__lkStep(x), ms);
      // Phones are shot in parallel (their reveal is static once its entrance has played).
      const phoneShots = Promise.all([r.shot(phones[0]!, `ph-12-reveal-${label}-p0`, 1000), r.shot(phones[1]!, `ph-12-reveal-${label}-p1`, 1000)]);
      // Two TV frames fit in the server's REVEAL window even when a full-HD screenshot is slow: the spotlight beat
      // (lines formed, counts rolled, rosette landing) and the end state (coins / percentage board, caption).
      await step(3200);
      await r.shot(tv, `tv-12-reveal-${label}-b-spot`, 60);
      await step(2600);
      await r.shot(tv, `tv-12-reveal-${label}-c-end`, 60);
      await step(5000);
      await phoneShots;
      await tv.locator("[data-reveal]").waitFor({ state: "detached", timeout: 30_000 });
    }
  })().catch(() => undefined) : Promise.resolve();
  while (Date.now() < deadline) {
    if (await visible(tv, "[data-results]")) break;
    const card = await tvCardIndex(tv);
    // Phones: vote on VOTING (tile order = seat order = join order).
    for (const [i, p] of phones.entries()) {
      if (!(await visible(p, ".lk-ph--vote"))) continue;
      const key = `${card}:${i}`;
      if (voted.has(key)) continue;
      const pick = PLAN(card, i, n);
      voted.add(key);
      if (pick === null) continue;
      const tiles = p.locator(".lk-tile");
      if (opts.changeVote && card === 0 && i === 1) {
        // Change of mind: first a different tile, then the planned one; the pick shows only an outline + check.
        await tiles.nth((pick + 1) % n).click();
        await expect(tiles.nth((pick + 1) % n)).toHaveAttribute("aria-checked", "true");
        if (opts.shots) await r.shot(p, "ph-11-vote-picked");
      }
      await tiles.nth(pick).click();
      // A tap that lands while the phone is still re-rendering can be lost (a real player taps again): one retry.
      if (!(await expect(tiles.nth(pick)).toHaveAttribute("aria-checked", "true", { timeout: 4000 }).then(() => true).catch(() => false))) {
        if (!(await visible(p, ".lk-ph--vote"))) continue;
        await tiles.nth(pick).click();
        await expect(tiles.nth(pick)).toHaveAttribute("aria-checked", "true");
      }
    }
    if (opts.shots && card >= 0) {
      const phase = await tv.evaluate(() => (document.querySelector<HTMLElement>(".lkplay")?.dataset.phase ?? (document.querySelector("[data-reveal]") ? "REVEAL" : null))).catch(() => null);
      const tag = `${card}:${phase}`;
      if (phase && !shotCards.has(tag) && card <= 2) {
        shotCards.add(tag);
        if (phase === "CARD" && card === 0) {
          await r.shot(tv, "tv-10-card", 1300);
          await r.shot(phones[1]!, "ph-10-card", 0);
        }
        if (phase === "VOTING" && card === 0) {
          await r.shot(tv, "tv-11-voting", 0);
          await phones[2]!.locator(".lk-tile").first().waitFor({ timeout: 5000 }).catch(() => undefined);
          await r.shot(phones[2]!, "ph-11-vote", 700);
        }
      }
    }
    // Remote only: on card 4 OK completes the running reveal to its end state (§3.10 E rule 5).
    if (opts.nextVia && card === 4 && !usedOk && (await visible(tv, '[data-reveal][data-running="1"]'))) {
      usedOk = true;
      await press(tv, "Enter");
      await expect(tv.locator('[data-reveal][data-running="0"]')).toBeVisible({ timeout: 2000 });
    }
    if (!seenAwards && (await visible(tv, "[data-awards]"))) {
      seenAwards = true;
      if (opts.shots) {
        // Each beat of the ceremony is shot when the TV reaches it (the trio on screen follows the server deadline).
        const beat = async (key: string, name: string, wait: number): Promise<void> => {
          if (await tv.locator(`[data-awards="${key}"]`).waitFor({ timeout: 9000 }).then(() => true).catch(() => false)) await r.shot(tv, name, wait);
        };
        // Phones in parallel (their award card is static once flipped in).
        const phoneShots = Promise.all([r.shot(phones[0]!, "ph-20-award", 1500), r.shot(phones[3 % n]!, "ph-21-award-other", 1500)]);
        await beat("intro", "tv-20-awards-intro", 900);
        await beat("t0", "tv-21-awards-trio", 1200);
        await phoneShots;
        if (n > 3 && !opts.nextVia) await beat("t1", "tv-22-awards-trio2", 1500);
        if (!opts.secret && !opts.nextVia) await beat("mindReader", "tv-23-awards-mindreader", 1600);
      }
      // Remote only: Back → pause menu → "Next" (HOST_ADVANCE) ends the ceremony early → RESULTS.
      if (opts.nextVia && (await visible(tv, "[data-awards]"))) {
        await press(tv, "Escape");
        await expect(tv.locator(".tvdialog--menu")).toBeVisible();
        await dpadTo(tv, "[data-pause-item=next]", "ArrowDown", 6);
        await press(tv, "Enter");
        await expect(tv.locator("[data-results]")).toBeVisible({ timeout: 5000 });
      }
    }
    await tv.waitForTimeout(200);
  }
  await expect(tv.locator("[data-results]")).toBeVisible();
  await watcher;
}

/** No ballot before REVEAL anywhere (TV or phone); never a voter→target pair in secret mode, in any phase. */
function checkSecrecy(r: Run, secret: boolean): void {
  type V = { game?: { gameId?: string; phase?: string; public?: { phase?: string; reveal?: { ballots?: unknown } | null }; me?: unknown } | null };
  const parse = (f: string): V | null => { try { return (JSON.parse(f) as { view?: V }).view ?? null; } catch { return null; } };
  let ballotsSeen = 0;
  for (const f of r.tvFrames) {
    const v = parse(f);
    if (v?.game?.gameId !== "likely") continue;
    expect(v.game.me ?? null).toBeNull();
    const ph = v.game.public?.phase;
    const ballots = v.game.public?.reveal?.ballots ?? null;
    if (ph === "CARD" || ph === "VOTING") expect(v.game.public?.reveal ?? null).toBeNull();
    if (secret) expect(ballots).toBeNull();
    if (ballots) ballotsSeen++;
    if (secret) expect(f).not.toMatch(/"voterId"/);
  }
  if (!secret) expect(ballotsSeen).toBeGreaterThan(0);
  for (const frames of r.phoneFrames) {
    for (const f of frames) {
      const v = parse(f);
      if (v?.game?.gameId !== "likely") continue;
      const ph = v.game.public?.phase;
      if (ph === "CARD" || ph === "VOTING") expect(v.game.public?.reveal ?? null).toBeNull();
      if (secret) expect(f).not.toMatch(/"voterId"/);
    }
  }
}

/** GAME-LIKELY §6: equal scores print the same (competition) rank in the Mind Reader ranking. */
async function expectSharedRanks(tv: Page): Promise<void> {
  const rows = await tv.locator(".lkres__row").evaluateAll((els) => els.map((e) => ({ rank: Number((e as HTMLElement).dataset.rank), score: e.querySelector(".lkres__score")?.textContent ?? "" })));
  expect(rows.length).toBeGreaterThan(0);
  rows.forEach((row, i) => {
    if (i === 0) expect(row.rank).toBe(1);
    else if (row.score === rows[i - 1]!.score) expect(row.rank).toBe(rows[i - 1]!.rank);
    else expect(row.rank).toBe(i + 1);
  });
}

test.describe.configure({ mode: "serial" });

test("Most Likely EN, public votes, 4 phones, remote-only TV: unanimous self-vote, chaos, tie, changed vote, Next via pause, awards, results", async ({ browser }) => {
  test.setTimeout(900_000);
  const r = await setup(browser, "en", ["Rami", "Lina", "Karim", "Maya"]);
  await openLikely(r, { secret: false, short: true });
  // Phones follow into the game with the rooftop world.
  for (const p of r.phones) await expect(p.locator('.ingame[data-world="rooftop"]')).toBeVisible();
  // In game: Back → pause menu (Resume focused) → Rules → Back returns to the game.
  await expect(r.tv.locator(".lkplay")).toBeVisible({ timeout: 10_000 });
  // GAME-LIKELY §4/§12.1: the first card waits for the world entrance (no deal under the curtain and title).
  // Sampled in one frame (the entrance is ≤ 2 s): while the overlay is up there is never a dealt card.
  expect(await r.tv.evaluate(() => !document.querySelector("[data-entrance]") || (!document.querySelector(".lkplay .lkcard") && !!document.querySelector(".lkplay[data-gated]")))).toBe(true);
  await r.tv.locator("[data-entrance]").waitFor({ state: "detached", timeout: 10_000 });
  await expect(r.tv.locator(".lkplay .lkcard")).toBeVisible();
  await expect(r.tv.locator(".lkplay[data-gated]")).toHaveCount(0);
  await press(r.tv, "Escape");
  await expect(r.tv.locator(".tvdialog--menu")).toBeVisible();
  await expect(r.tv.locator(".tvdialog--menu [data-default-focus]")).toBeFocused();
  await expect(r.tv.locator("[data-pause-item=skipCard]")).toBeVisible();
  await r.shot(r.tv, "tv-04-pause", 200);
  await dpadTo(r.tv, "[data-pause-rules]", "ArrowDown", 8);
  await press(r.tv, "Enter");
  await expect(r.tv.locator(".tvrules--game")).toBeVisible();
  await press(r.tv, "Escape");
  await expect(r.tv.locator(".tvrules")).toHaveCount(0);
  await expect(r.tv.locator(".tvdialog--menu")).toHaveCount(0);
  await playToResults(r, { shots: true, changeVote: true, nextVia: true });
  await r.shot(r.tv, "tv-30-results", 1600);
  await expect(r.tv.locator("[data-results-bar].is-ready")).toBeVisible({ timeout: 20_000 });
  await expect(r.tv.locator("[data-replay]")).toBeFocused({ timeout: 4000 });
  await r.shot(r.tv, "tv-31-results-bar", 300);
  await r.shot(r.phones[0]!, "ph-30-results-vip", 0);
  await r.shot(r.phones[2]!, "ph-31-results", 0);
  await expect(r.tv.locator(".lkres__rank")).toBeVisible();
  await expectSharedRanks(r.tv);
  checkSecrecy(r, false);
  // Other games → hub, by remote.
  await press(r.tv, "ArrowRight", 2);
  await expect(r.tv.locator("[data-back-hub]")).toBeFocused();
  await press(r.tv, "Enter");
  await expect(r.tv.locator(".tvhub")).toBeVisible();
  for (const p of [...r.phones, r.tv]) await p.context().close();
});

test("Most Likely AR (RTL), secret votes, 3 phones: percentage board, no points, awards without Mind Reader", async ({ browser }) => {
  test.setTimeout(900_000);
  const r = await setup(browser, "ar", ["رامي", "Léa", "نور"]);
  await expect(r.tv.locator(".tv")).toHaveAttribute("dir", "rtl");
  await openLikely(r, { secret: true, short: true });
  await playToResults(r, { shots: true, secret: true });
  await r.shot(r.tv, "tv-30-results", 1600);
  await expect(r.tv.locator(".lkres.is-secret")).toBeVisible();
  await expect(r.tv.locator(".lkres__rank")).toHaveCount(0);
  await expect(r.tv.locator("[data-replay]")).toBeFocused({ timeout: 20_000 });
  await r.shot(r.phones[0]!, "ph-30-results-vip", 0);
  checkSecrecy(r, true);
  for (const p of [...r.phones, r.tv]) await p.context().close();
});

test("Most Likely ES, public votes, 6 phones", async ({ browser }) => {
  test.setTimeout(900_000);
  const r = await setup(browser, "es", ["Lucía", "Mateo", "Sofía", "Diego", "Valentina", "Hugo"]);
  await openLikely(r, { secret: false, short: true });
  // Six phones under load: the pause menu's "Next" ends the ceremony early so the run stays well inside the timeout.
  await playToResults(r, { shots: true, nextVia: true });
  await r.shot(r.tv, "tv-30-results", 1600);
  await expect(r.tv.locator("[data-replay]")).toBeFocused({ timeout: 20_000 });
  await r.shot(r.phones[0]!, "ph-30-results-vip", 0);
  await expectSharedRanks(r.tv);
  checkSecrecy(r, false);
  for (const p of [...r.phones, r.tv]) await p.context().close();
});
