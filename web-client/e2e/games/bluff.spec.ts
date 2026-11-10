// GAME-BLUFF / JAMAA-PLATFORM §6.5 G2 lane B e2e: full Bluff games through the hub with the /tv mock driven by the
// keyboard D-pad, OK, Back and `i` ONLY (no clicks on the TV) and 3–6 phones, in EN, AR (RTL) and ES.
// Covers: open Bluff from the hub → first-time how-to → Length: Short → Start → round cards → writing (Spot on in
// round 1, a "too close" probe in round 2 whose truth vote then scores 0, "Help me", a same-lie merge) → voting (own
// answer disabled, likes, a VIP hide by long-press) → the reveal (OK completes it) → scores → final "No truth" →
// awards → results (Play again focused); in game Back → Rules → Back returns to the game; a late joiner waits for the
// next prompt; no truth, other player's lie or authorship reaches the TV or another phone before its time.
// Bluff is registry-disabled until the owner enables it (G2 lane A); the spec skips unless /api/config lists it.
// SHOTS_DIR=<dir> saves every screen: <dir>/<locale>/{tv,ph}-*.png (TV 1920 × 1080, phones 390 × 844).
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { devices, expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

type Loc = "en" | "ar" | "es";
const SHOTS = process.env.SHOTS_DIR;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
/**
 * The /tv pause menu sends Bluff's "Skip prompt" / "Hide an answer" with their ids only once the platform PauseMenu
 * routes game items through the game module's `runPauseAction` (JAMAA-GAP G2, lane B report); until then those steps
 * are reported as skipped instead of failing on BAD_MESSAGE.
 */
const PAUSE_WIRED = readFileSync(join(ROOT, "web-client", "src", "tv-mock", "tvDialogs.tsx"), "utf8").includes("runPauseAction");

// ---------------------------------------------------------------- content: the truths (to play Spot on / too close)

interface Truth { text: string; alts: string[]; type: string }
function loadTruths(locale: Loc): Map<string, Truth> {
  const out = new Map<string, Truth>();
  const dir = join(ROOT, "content", "bluff");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const pack = JSON.parse(readFileSync(join(dir, f), "utf8")) as { sourceLocale: string; items: { type: string; prompt: { original: string; display: Record<string, string> }; truth?: Record<string, string>; truthAlt?: Record<string, string[]> }[] };
    for (const it of pack.items ?? []) {
      const text = it.truth?.[locale] ?? it.truth?.[pack.sourceLocale];
      const t: Truth = { text: text ?? "", alts: it.truthAlt?.[locale] ?? [], type: it.type };
      out.set(norm(it.prompt.original), t);
      for (const d of Object.values(it.prompt.display ?? {})) out.set(norm(d), t);
    }
  }
  return out;
}
const norm = (s: string): string => s.normalize("NFC").replace(/[ً-ٰٟـ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// ---------------------------------------------------------------- lies (valid script per room language, all distinct)

const LIE_A: Record<Loc, string[]> = {
  en: ["Brings its own umbrella", "Never pays the bill", "Sings at breakfast", "Forgets the keys", "Dances with the neighbours", "Sleeps until noon", "Bakes for the street"],
  ar: ["بيضحك", "بينام", "بيرقص", "بيغني", "بياكل كبة", "بيحكي", "بيزعل"],
  es: ["Baila", "Canta", "Duerme", "Come pan", "Llora", "Se ríe", "Silba"],
};
const LIE_B: Record<Loc, string[]> = {
  en: ["on Tuesdays", "in the rain", "with grandma", "after midnight", "in silence", "at weddings"],
  ar: ["عالسطح", "بالمطبخ", "مع الجيران", "تحت الشتي", "قبل الفطور", "بالسيارة"],
  es: ["en la azotea", "con los vecinos", "bajo la lluvia", "antes del desayuno", "en el coche", "junto al mar"],
};
let lieN = 0;
const nextLie = (l: Loc): string => { const n = lieN++; return `${LIE_A[l][n % LIE_A[l].length]} ${LIE_B[l][Math.floor(n / LIE_A[l].length) % LIE_B[l].length]}`; };

// ---------------------------------------------------------------- browser helpers

async function context(browser: Browser, kind: "tv" | "phone", locale: Loc) {
  const ctx = await browser.newContext(kind === "tv"
    ? { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }
    : { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((l) => {
    try { if (!sessionStorage.getItem("e2e-init")) { localStorage.setItem("jamaa:locale", l); sessionStorage.setItem("e2e-init", "1"); } } catch { /* */ }
  }, locale);
  return ctx;
}

interface Phone { page: Page; name: string; frames: string[] }

async function openTv(browser: Browser, locale: Loc): Promise<{ tv: Page; code: string; frames: string[] }> {
  const tv = await (await context(browser, "tv", locale)).newPage();
  const frames: string[] = [];
  tv.on("websocket", (ws) => ws.on("framereceived", (f) => { if (typeof f.payload === "string") frames.push(f.payload); }));
  await tv.goto("/tv");
  const big = tv.locator(".tvjoin .tvcode");
  await expect(big).toBeVisible({ timeout: 30_000 });
  const code = ((await big.getAttribute("aria-label")) ?? "").replace(/\s+/g, "");
  return { tv, code, frames };
}

async function joinPhone(browser: Browser, code: string, name: string, locale: Loc, expectSel = ".screen--hub"): Promise<Phone> {
  const page = await (await context(browser, "phone", locale)).newPage();
  const frames: string[] = [];
  page.on("websocket", (ws) => {
    ws.on("framereceived", (f) => {
      if (typeof f.payload !== "string") return;
      if (f.payload.includes('"bluff"')) frames.push(f.payload);
      if (process.env.BLUFF_E2E_DEBUG && f.payload.includes('"t":"error"')) console.log(name, "error frame", f.payload);
    });
    if (process.env.BLUFF_E2E_DEBUG) ws.on("framesent", (f) => { if (typeof f.payload === "string" && f.payload.includes("SUBMIT")) console.log(name, "sent", f.payload); });
  });
  await page.goto(`/${code}`);
  await page.locator("#name").fill(name);
  await page.locator(".actionbar .btn--primary").click();
  await expect(page.locator(expectSel).first()).toBeVisible();
  return { page, name, frames };
}

const press = async (tv: Page, key: string, n = 1): Promise<void> => { for (let i = 0; i < n; i++) { await tv.keyboard.press(key); await tv.waitForTimeout(130); } };
async function dpadSoft(tv: Page, sel: string, key: string, max = 10): Promise<boolean> {
  for (let i = 0; i < max; i++) {
    if (await tv.locator(sel).first().evaluate((el) => el === document.activeElement).catch(() => false)) return true;
    if (!(await tv.locator(sel).first().isVisible().catch(() => false))) return false;
    await tv.keyboard.press(key);
    await tv.waitForTimeout(160);
  }
  return false;
}
async function dpadTo(tv: Page, sel: string, key: string, max = 10): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await tv.locator(sel).first().evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await tv.keyboard.press(key);
    await tv.waitForTimeout(160);
  }
  await expect(tv.locator(sel).first()).toBeFocused();
}
const visible = (p: Page, sel: string): Promise<boolean> => p.locator(sel).first().isVisible().catch(() => false);
/** Waits up to `ms` for `sel` to show (Locator.isVisible never waits). */
const appears = (p: Page, sel: string, ms: number): Promise<boolean> => p.locator(sel).first().waitFor({ state: "visible", timeout: ms }).then(() => true, () => false);

const shotsTaken = new Set<string>();
async function shot(p: Page, locale: Loc, name: string, wait = 350): Promise<void> {
  if (!SHOTS) return;
  const key = `${locale}/${name}`;
  if (shotsTaken.has(key)) return;
  shotsTaken.add(key);
  mkdirSync(join(SHOTS, locale), { recursive: true });
  await p.waitForTimeout(wait);
  await p.screenshot({ path: join(SHOTS, locale, `${name}.png`) });
}

/** HUB-06 pause menu → an item (D-pad + OK), e.g. "next" (HOST_ADVANCE) or the rules. */
async function pauseItem(tv: Page, sel: string): Promise<boolean> {
  await press(tv, "Escape");
  if (!(await visible(tv, ".tvdialog--menu"))) return false;
  if (!(await visible(tv, sel))) { await press(tv, "Escape"); return false; }
  // The phase may end while the menu is open (the item then leaves the menu): close it and carry on.
  if (!(await dpadSoft(tv, sel, "ArrowDown", 10))) { if (await visible(tv, ".tvdialog--menu")) await press(tv, "Escape"); return false; }
  await press(tv, "Enter");
  return true;
}

/** Letter → card text on the TV corkboard (letters are frozen for the whole VOTING: a hide never re-letters). */
async function tvLetters(tv: Page): Promise<Map<string, string>> {
  const rows = await tv.locator(".bf--voting .bfnote").evaluateAll((els) => els.map((e) => [
    (e.querySelector(".bfnote__text")?.textContent ?? "").trim(), (e.querySelector(".bfnote__letter")?.textContent ?? "").trim(),
  ] as [string, string]));
  return new Map(rows);
}

/**
 * RTL number direction, as rendered (DOM text is "+150" either way): every "+<digit>" must PAINT with the plus sign
 * before the digit in reading-independent order (left of it), never as "150+".
 */
async function signedNumbersPaintLtr(p: Page): Promise<string[]> {
  return p.evaluate(() => {
    const bad: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? "";
      const el = n.parentElement;
      if (!el || el.closest("[aria-hidden=true]") || el.getClientRects().length === 0) continue;
      for (const m of text.matchAll(/\+(\d)/g)) {
        const r1 = document.createRange(); r1.setStart(n, m.index!); r1.setEnd(n, m.index! + 1);
        const r2 = document.createRange(); r2.setStart(n, m.index! + 1); r2.setEnd(n, m.index! + 2);
        const a = r1.getBoundingClientRect(), b = r2.getBoundingClientRect();
        if (a.width === 0 || b.width === 0) continue;
        if (a.left > b.left) bad.push(text.trim().slice(0, 40));
      }
    }
    return bad;
  });
}

async function tvPhase(tv: Page): Promise<string> {
  if (await visible(tv, "[data-results-bar]")) return "END";
  return (await tv.locator("[data-bf-phase]").first().getAttribute("data-bf-phase", { timeout: 500 }).catch(() => null)) ?? "";
}

// ---------------------------------------------------------------- one full game

interface Plan { locale: Loc; names: string[]; lateJoiner?: string; shots: boolean }

async function playGame(browser: Browser, plan: Plan): Promise<void> {
  const L = plan.locale;
  const truths = loadTruths(L);
  const { tv, code, frames } = await openTv(browser, L);
  const phones: Phone[] = [];
  for (const n of plan.names) phones.push(await joinPhone(browser, code, n, L));
  await expect(tv.locator(".tvmember")).toHaveCount(plan.names.length);

  // Hub → Bluff (D-pad along the carousel; the reading direction follows the locale), OK → portal → setup.
  const fwd = L === "ar" ? "ArrowLeft" : "ArrowRight";
  await expect(tv.locator(".tvposter.is-focused")).toBeFocused();
  for (let i = 0; i < 6 && (await tv.locator(".tvposter.is-focused").getAttribute("data-game")) !== "bluff"; i++) { await press(tv, fwd); await tv.waitForTimeout(250); }
  await expect(tv.locator(".tvposter.is-focused")).toHaveAttribute("data-game", "bluff");
  await shot(tv, L, "tv-00-hub-bluff", 900);
  await press(tv, "Enter");
  await expect(tv.locator(".tvsetup")).toBeVisible();
  if (await appears(tv, "[data-intro]", 2500)) {
    await shot(tv, L, "tv-01-howto", 700);
    for (let i = 0; i < 6 && (await visible(tv, "[data-intro-next]")); i++) await press(tv, "Enter");
    await expect(tv.locator("[data-intro-done]")).toBeFocused();
    await press(tv, "Enter");
  }
  for (const p of phones) if (await visible(p.page, ".introsheet__skip")) await p.page.locator(".introsheet__skip").click();
  // Length: Short (Left steps back in reading order; RTL mirrors it).
  await tv.waitForTimeout(500);
  await press(tv, L === "ar" ? "ArrowLeft" : "ArrowRight");
  await dpadTo(tv, "[data-row=length]", "ArrowDown");
  await press(tv, L === "ar" ? "ArrowRight" : "ArrowLeft");
  await tv.waitForTimeout(400);
  await shot(tv, L, "tv-02-setup", 300);
  await shot(phones[0]!.page, L, "ph-02-setup-vip");
  await dpadTo(tv, "[data-start]", "ArrowDown");
  await press(tv, "Enter");
  await expect(tv.locator(".tvgamehost")).toBeVisible();
  await expect(tv.locator("[data-entrance]")).toHaveCount(0, { timeout: 6000 });

  const ids = new Map<string, string>(); // name → player id (from the TV's own frames)
  for (const f of frames) { try { for (const m of JSON.parse(f)?.view?.room?.members ?? []) ids.set(m.name, m.id); } catch { /* */ } }
  const done = new Set<string>();
  const once = (k: string): boolean => (done.has(k) ? false : (done.add(k), true));
  let spotOn = false, tooClose: string | null = null, hid = false, merged = false, helped = false, rulesChecked = false, late: Phone | null = null;
  let tvSkipped = false, tvHid = false;
  const myLies = new Map<string, string[]>(); // prompt id → lies typed (for the phone secrecy check)
  const truthByPid = new Map<string, Truth | null>();
  const truthOf = async (): Promise<Truth | null> => {
    const txt = await tv.locator(".bfprompt__text").first().textContent().catch(() => null);
    return txt ? truths.get(norm(txt)) ?? null : null;
  };
  const deadline = Date.now() + 420_000;
  let shotIntro = 0;

  while (Date.now() < deadline) {
    const phase = await tvPhase(tv);
    if (phase === "END") break;
    const pid = (await tv.locator("[data-bf-phase]").first().getAttribute("data-pid", { timeout: 300 }).catch(() => null)) ?? "";

    if (phase === "ROUND_INTRO") {
      const finalCard = await visible(tv, ".bf--intro.is-final");
      const k = `intro:${finalCard ? "final" : await tv.locator(".bfintro__num").textContent()}`;
      if (once(k)) {
        shotIntro++;
        await shot(tv, L, `tv-03-round-intro-${shotIntro}`, 1100);
        await shot(phones[1]!.page, L, `ph-03-round-intro-${shotIntro}`, 0);
        if (!rulesChecked) {
          // In game: Back → pause menu → Rules → Back returns to the game, the timer kept running.
          rulesChecked = true;
          await press(tv, "Escape");
          await expect(tv.locator(".tvdialog--menu")).toBeVisible();
          await shot(tv, L, "tv-04-pause-menu", 200);
          await dpadTo(tv, "[data-pause-rules]", "ArrowDown");
          await press(tv, "Enter");
          await expect(tv.locator(".tvrules[data-rules=bluff]")).toBeVisible();
          await shot(tv, L, "tv-05-rules-in-game", 300);
          await press(tv, "Escape");
          await expect(tv.locator(".tvrules")).toHaveCount(0);
          await expect(tv.locator("[data-bf-phase]").first()).toBeVisible();
        } else {
          await pauseItem(tv, "[data-pause-item=next]");
        }
      }
      await tv.waitForTimeout(250);
      continue;
    }

    if (phase === "WRITING" && pid && once(`write:${pid}`)) {
      const truth = await truthOf();
      truthByPid.set(pid, truth);
      const round = truth?.type === "proverb_end" ? 1 : truth?.type === "no_truth" ? 3 : 2;
      // Host skip from the TV pause menu (round 2, once): SKIP_PROMPT carries the prompt id; a new prompt is dealt.
      if (round === 2 && !tvSkipped) {
        tvSkipped = true;
        if (PAUSE_WIRED && (await pauseItem(tv, "[data-pause-item=skipPrompt]"))) {
          await expect.poll(() => tv.locator("[data-bf-phase]").first().getAttribute("data-pid").catch(() => pid), { timeout: 8000 }).not.toBe(pid);
          await shot(tv, L, "tv-13-skipped", 600);
          continue;
        }
        if (!PAUSE_WIRED) test.info().annotations.push({ type: "JAMAA-GAP", description: "pause-menu Skip prompt not wired to runPauseAction (tvDialogs.tsx)" });
      }
      await shot(tv, L, `tv-10-writing-r${round}`, 900);
      const lies: string[] = [];
      myLies.set(pid, lies);
      const active: Phone[] = late ? [...phones, late] : phones;
      for (const [i, p] of active.entries()) {
        const pg = p.page;
        if (!(await appears(pg, ".bf-input", 4000))) {
          if (p === late && (await visible(pg, ".bf-ph--center"))) await shot(pg, L, "ph-19-late-waiting", 0);
          continue;
        }
        if (i === 0) await shot(pg, L, `ph-10-write-r${round}`, 200);
        // Round 1: the second phone knows the real ending → Spot on (+150, sits the vote out).
        if (round === 1 && i === 1 && !spotOn && truth?.text) {
          await pg.locator(".bf-input").fill(truth.text);
          await pg.locator("[data-bf-lock]").click();
          await expect(pg.locator(".bf-spoton")).toBeVisible();
          await shot(pg, L, "ph-12-spot-on", 200);
          spotOn = true;
          continue;
        }
        // Round 2: the first phone types the truth → "too close" (inline + persistent line), then writes a real lie.
        if (round === 2 && i === 0 && !tooClose && truth?.text) {
          await pg.locator(".bf-input").fill(truth.text);
          await pg.locator("[data-bf-lock]").click();
          await expect(pg.locator(".bf-err")).toBeVisible();
          await expect(pg.locator(".bf-warnline")).toBeVisible();
          await shot(pg, L, "ph-13-too-close", 100);
          tooClose = pid;
        }
        // One stuck player asks the house for help (the suggestion fills the field).
        if (i === 2 && !helped && (await visible(pg, ".bf-help"))) {
          await pg.locator(".bf-help").click();
          await expect(pg.locator(".bf-helped")).toBeVisible();
          await shot(pg, L, "ph-14-help", 200);
          helped = true;
          await pg.locator("[data-bf-lock]").click();
          await expect(pg.locator(".bf-locked, .bf-ph--vote").first()).toBeVisible();
          continue;
        }
        // Same lie from two phones (round 1, once) → one merged option with both authors credited.
        const text = !merged && round === 1 && i === 3 && lies.length > 0 ? lies[lies.length - 1]! : nextLie(L);
        if (i === 3 && round === 1 && !merged && lies.length > 0) merged = true;
        // A random lie can still land "too close" (GAME-BLUFF §5.2 rule 5: "pays" ≈ "paws"): then write another one.
        let typed = text;
        for (let attempt = 0; attempt < 3; attempt++) {
          lies.push(typed);
          await pg.locator(".bf-input").fill(typed);
          await pg.locator("[data-bf-lock]").click();
          await pg.waitForTimeout(500);
          const ok = pg.locator(".bf-locked, .bf-ph--vote, .bf-ph--reveal").first();
          // "Too famous!" (GAME-BLUFF §4.2) swaps the prompt itself when half the table hits the truth: start over.
          const tvPid = (): Promise<string | null> => tv.locator("[data-bf-phase]").first().getAttribute("data-pid").catch(() => pid);
          await expect.poll(async () => (await tvPid()) !== pid || (await ok.isVisible()) || (await visible(pg, ".bf-err")), { timeout: 15_000 }).toBe(true);
          if ((await tvPid()) !== pid) break;
          if (await ok.isVisible()) break;
          typed = nextLie(L);
        }
        if ((await tv.locator("[data-bf-phase]").first().getAttribute("data-pid").catch(() => pid)) !== pid) {
          await shot(pg, L, "ph-15-too-famous", 0);
          await shot(tv, L, "tv-12-too-famous", 0);
          break;
        }
        await expect(pg.locator(".bf-locked, .bf-ph--vote, .bf-ph--reveal").first(), `${p.name} locks "${typed}"`).toBeVisible().catch(async (e) => {
          if (SHOTS) await pg.screenshot({ path: join(SHOTS, `fail-${p.name}.png`) });
          throw e;
        });
        if (i === 0) await shot(pg, L, `ph-11-write-locked-r${round}`, 300);
      }
      await shot(tv, L, `tv-11-writing-in-r${round}`, 400);
      // A late joiner after the first prompt: waits with "You're in!" and plays from the next WRITING.
      if (plan.lateJoiner && !late) {
        late = await joinPhone(browser, code, plan.lateJoiner, L, ".bf-ph, .screen--benched");
        // GAME-BLUFF §7: a late joiner is in at once ("You're in!") and plays from the next WRITING.
        await expect(late.page.locator(".bf-ph--center").first()).toBeVisible();
        await shot(late.page, L, "ph-19-late-waiting", 300);
      }
      continue;
    }

    if (phase === "VOTING" && pid && once(`vote:${pid}`)) {
      await tv.waitForTimeout(1700); // the "Knew it!" banner
      await shot(tv, L, `tv-20-voting-${await visible(tv, ".bf--voting .bfchip--signal") ? "final" : "r"}`, 300);
      const truth = truthByPid.get(pid) ?? null;
      const opts = tv.locator(".bfnote__text");
      const texts = (await opts.allTextContents()).map((s) => s.trim());
      expect(new Set(texts.map(norm)).size).toBe(texts.length); // merged duplicates show once
      const active: Phone[] = late ? [...phones, late] : phones;
      // Host hide from the TV pause menu (once): the picker shows the board in order; D-pad to a lie, OK hides it.
      if (PAUSE_WIRED && !tvHid && texts.length >= 4 && truth?.text) {
        const letters = await tvLetters(tv);
        if (await pauseItem(tv, "[data-pause-item=hideOption]")) {
          tvHid = true;
          await expect(tv.locator("[data-bf-hidepicker]")).toBeVisible();
          await expect(tv.locator("[data-hide-option]").first()).toBeFocused();
          await shot(tv, L, "tv-22-hide-picker", 300);
          // Move off any card that holds the truth (hiding the truth voids the prompt).
          for (let k = 0; k < 4; k++) {
            const focusedText = ((await tv.locator("[data-hide-option]:focus .bfhide__text").textContent().catch(() => "")) ?? "").trim();
            if (norm(focusedText) !== norm(truth.text)) break;
            await press(tv, "ArrowDown");
          }
          const hiddenText = ((await tv.locator("[data-hide-option]:focus .bfhide__text").textContent()) ?? "").trim();
          await press(tv, "Enter");
          await expect(tv.locator("[data-bf-hidepicker]")).toHaveCount(0);
          await expect(tv.locator(".bf--voting .bfnote")).toHaveCount(texts.length - 1);
          const after = await tvLetters(tv);
          expect(after.has(hiddenText)).toBe(false);
          for (const [text, letter] of after) expect(letter, `"${text}" keeps its letter`).toBe(letters.get(text));
          texts.splice(texts.indexOf(hiddenText), 1);
        }
      } else if (!PAUSE_WIRED && !tvHid) {
        tvHid = true;
        test.info().annotations.push({ type: "JAMAA-GAP", description: "pause-menu Hide an answer not wired to runPauseAction (tvDialogs.tsx)" });
      }
      // VIP hide (long-press any card → "Hide this answer"): a lie, never the truth here (hiding it voids the prompt).
      if (!hid && texts.length >= 4 && truth?.text) {
        const lettersBefore = await tvLetters(tv);
        const vip = phones[0]!.page;
        const target = vip.locator(".bf-opt:not(.is-mine) .bf-opt__main").filter({ hasNotText: truth.text }).first();
        const box = await target.boundingBox();
        if (box) {
          await vip.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await vip.mouse.down(); await vip.waitForTimeout(800); await vip.mouse.up();
          await expect(vip.locator("[data-bf-hide]")).toBeVisible();
          await shot(vip, L, "ph-22-hide-sheet", 200);
          await vip.locator("[data-bf-hide]").click();
          await expect(tv.locator(".bfnote")).toHaveCount(texts.length - 1);
          hid = true;
          // Frozen letters: every remaining card keeps the letter the room agreed on, on the TV and on the phone.
          const lettersAfter = await tvLetters(tv);
          for (const [text, letter] of lettersAfter) expect(letter, `TV "${text}" keeps its letter`).toBe(lettersBefore.get(text));
          await expect(vip.locator(".bf-opt")).toHaveCount(texts.length - 1);
          const phRows = await vip.locator(".bf-opt").evaluateAll((els) => els.map((e) => [
            (e.querySelector(".bf-opt__text")?.textContent ?? "").trim(), (e.querySelector(".bf-opt__letter")?.textContent ?? "").trim(),
          ] as [string, string]));
          for (const [text, letter] of phRows) expect(letter, `phone "${text}" matches the TV letter`).toBe(lettersAfter.get(text));
        }
      }
      for (const [i, p] of active.entries()) {
        const pg = p.page;
        if (!(await appears(pg, ".bf-opts", 3000))) continue;
        if (await visible(pg, ".bf-opt.is-mine")) {
          // Own answer: greyed "Yours", not votable.
          await expect(pg.locator(".bf-opt.is-mine .bf-opt__main").first()).toHaveAttribute("aria-disabled", "true");
          await pg.locator(".bf-opt.is-mine .bf-opt__main").first().click({ force: true, timeout: 3000 });
          await expect(pg.locator(".bf-opt.is-mine.is-picked")).toHaveCount(0);
        }
        if (await pg.locator(".bf-opt__main[aria-disabled=true]").count() === (await pg.locator(".bf-opt").count())) {
          await shot(pg, L, "ph-21-vote-spot-on-watch", 100);
          continue; // Spot on: watches, likes only
        }
        // The "too close" phone votes for the truth (it must score 0 there); the others vote the first card not theirs.
        // Votes spread over the cards (phone i takes the i-th card that is not its own), so lies get fooled voters.
        const mine = pg.locator(".bf-opt:not(.is-mine) .bf-opt__main");
        let choice = mine.nth(i % Math.max(1, await mine.count()));
        if (pid === tooClose && i === 0 && truth?.text) choice = pg.locator(".bf-opt:not(.is-mine) .bf-opt__main").filter({ hasText: truth.text }).first();
        await choice.click();
        await expect(pg.locator(".bf-opt.is-picked")).toHaveCount(1);
        if (i === 1) await pg.locator(".bf-opt:not(.is-mine) [data-like]").last().click();
        if (i === 0) await shot(pg, L, `ph-20-vote${(await visible(tv, ".bf--voting .bfchip--signal")) ? "-final" : ""}`, 400);
      }
      continue;
    }

    if (phase === "REVEAL" && once(`reveal:${pid}:${await tv.locator("[data-beat]").first().getAttribute("data-beat").catch(() => "")}`)) {
      const final = (await tv.locator(".bfrv .bfprompt.is-final").count()) > 0;
      // Watch the choreography while any of its signature beats still lacks a screenshot (beats differ per prompt).
      const beatsOf = final ? ["answer", "crown", "twist", "montage", "likes"] : ["lie", "quick", "truth", "montage", "likes"];
      const watchFull = !!SHOTS && beatsOf.some((b) => !shotsTaken.has(`${L}/tv-31-reveal-${b}${final ? "-final" : ""}`));
      if (watchFull) {
        // Let the choreography run and capture its signature beats on the TV and the phone mirror.
        await shot(tv, L, `tv-30-reveal-intro${final ? "-final" : ""}`, 500);
        const sfx = final ? "-final" : "";
        const want: Record<string, string> = final
          ? { answer: "[data-beat=answer] .bfpop", crown: "[data-beat=crown] .bf-stamp", twist: "[data-beat=twist] .bftwist__stamp", montage: "[data-beat=montage] .bfmcard", likes: "[data-beat=likes] .bfcap" }
          : { lie: "[data-beat=lie] .bfpop", quick: "[data-beat=quick] .bfcard__stamp", truth: "[data-beat=truth] .bfcard__stamp", montage: "[data-beat=montage] .bfmcard", likes: "[data-beat=likes] .bfcap" };
        const until = Date.now() + 40_000;
        while (Date.now() < until && (await tvPhase(tv)) === "REVEAL" && !(await visible(tv, "[data-beat=end]"))) {
          for (const [b, sel] of Object.entries(want)) {
            if (shotsTaken.has(`${L}/tv-31-reveal-${b}${sfx}`) || !(await visible(tv, sel))) continue;
            await shot(tv, L, `tv-31-reveal-${b}${sfx}`, b === "twist" ? 700 : 450);
            await shot(phones[0]!.page, L, `ph-30-reveal-${b}${sfx}`, 0);
            await shot(phones[1]!.page, L, `ph-31-reveal-${b}${sfx}-p2`, 0);
          }
          await tv.waitForTimeout(150);
        }
      } else {
        await tv.waitForTimeout(1200);
      }
      if ((await tvPhase(tv)) !== "REVEAL") continue;
      // OK completes the reveal locally (§3.10 E): the end state shows at once.
      if (!(await visible(tv, "[data-beat=end]"))) await press(tv, "Enter");
      // The server timer may end REVEAL meanwhile (it never waits for the TV): that is fine too.
      await expect.poll(async () => (await visible(tv, "[data-beat=end]")) || (await tvPhase(tv)) !== "REVEAL", { timeout: 3000 }).toBe(true);
      if ((await tvPhase(tv)) !== "REVEAL") continue;
      await shot(tv, L, `tv-33-reveal-end${final ? "-final" : ""}`, 400);
      await phones[0]!.page.waitForTimeout(300);
      await shot(phones[0]!.page, L, `ph-33-reveal-total${final ? "-final" : ""}`, 0);
      if (L === "ar") {
        expect(await signedNumbersPaintLtr(tv), "TV: a signed number painted as N+").toEqual([]);
        expect(await signedNumbersPaintLtr(phones[0]!.page), "phone: a signed number painted as N+").toEqual([]);
      }
      await pauseItem(tv, "[data-pause-item=next]");
      continue;
    }

    if (phase === "SCORES" && pid && once(`scores:${pid}`)) {
      // The phone first (its odometer settles in ~1 s), then the TV once the race has re-sorted.
      await shot(phones[0]!.page, L, "ph-40-scores", 1200);
      await shot(tv, L, "tv-40-scores", 700);
      if (L === "ar") expect(await signedNumbersPaintLtr(tv), "TV scores: a signed number painted as N+").toEqual([]);
      await pauseItem(tv, "[data-pause-item=next]");
      continue;
    }

    if (phase === "AWARDS" && once("awards")) {
      await expect(tv.locator(".bftrophy").first()).toBeVisible({ timeout: 8000 }).catch(() => undefined);
      await shot(tv, L, "tv-50-awards", 900);
      await shot(phones[0]!.page, L, "ph-50-awards", 0);
      await pauseItem(tv, "[data-pause-item=next]");
      continue;
    }
    await tv.waitForTimeout(300);
  }

  // RESULTS: the podium settles, then the platform bar with Play again focused (OK mashing never replays).
  await expect(tv.locator("[data-results-bar].is-ready")).toBeVisible({ timeout: 20_000 });
  await expect(tv.locator("[data-replay]")).toBeFocused({ timeout: 4000 });
  await shot(tv, L, "tv-60-results", 300);
  await shot(phones[0]!.page, L, "ph-60-results-vip", 400);
  await shot(phones[1]!.page, L, "ph-61-results", 0);

  // ---- assertions on the frames ----
  const tvStates = frames.map((f) => { try { return JSON.parse(f); } catch { return null; } }).filter((x) => x?.t === "state" && x.view?.game?.gameId === "bluff");
  expect(tvStates.length).toBeGreaterThan(10);
  for (const s of tvStates) {
    const g = s.view.game;
    const raw = JSON.stringify(g.public);
    if (g.public.phase === "WRITING" || g.public.phase === "VOTING") {
      // Nothing marks authorship, kind, votes or likes before REVEAL (the TV gets counts of who is done only).
      expect(raw).not.toContain('"authorIds"');
      expect(raw).not.toContain('"voterIds"');
      expect(g.public.reveal).toBeNull();
      expect(g.me ?? null).toBeNull();
    }
    if (g.public.phase === "WRITING") {
      const t = g.public.prompt ? truths.get(norm(g.public.prompt.display ?? g.public.prompt.original)) : null;
      if (t?.text && t.text.length >= 4) expect(raw.toLowerCase()).not.toContain(`"${t.text.toLowerCase()}"`);
      for (const l of myLies.get(g.public.prompt?.id) ?? []) expect(raw).not.toContain(l);
      expect(g.public.options).toEqual([]);
      expect(g.public.spotOnIds).toEqual([]);
    }
  }
  // Phones never see another phone's lie before VOTING.
  for (const [i, p] of phones.entries()) {
    for (const f of p.frames) {
      let s; try { s = JSON.parse(f); } catch { continue; }
      const g = s?.view?.game;
      if (!g || g.public?.phase !== "WRITING") continue;
      const lies = myLies.get(g.public.prompt?.id) ?? [];
      const mine = g.me?.myLie ?? null;
      for (const l of lies) if (l !== mine) expect(JSON.stringify(g), `phone ${i} saw another lie`).not.toContain(l);
    }
  }
  // The "too close" prompt: the probing phone found the truth early and its truth vote paid nothing.
  if (tooClose) {
    const rev = tvStates.map((s) => s.view.game.public).find((p) => p.phase === "REVEAL" && p.prompt?.id === tooClose && p.reveal);
    const me0 = ids.get(plan.names[0]!);
    expect(rev).toBeTruthy();
    const truthStep = rev.reveal.steps.find((x: { kind: string }) => x.kind === "truth");
    if (truthStep?.voterIds.includes(me0)) {
      expect(truthStep.foundEarlyIds).toContain(me0);
      expect(truthStep.deltas.some((d: { playerId: string; reason: string }) => d.playerId === me0 && d.reason === "truth")).toBe(false);
    }
  }
  expect(spotOn || L !== "en", "Spot on was played in round 1").toBe(true);
  for (const p of [...phones, ...(late ? [late] : [])]) await p.page.context().close();
  await tv.context().close();
}

test.describe("Bluff (G2 lane B)", () => {
  test.beforeAll(async ({ request }) => {
    const cfg = await (await request.get("/api/config")).json().catch(() => ({ games: [] }));
    test.skip(!(cfg.games as string[]).includes("bluff"), "Bluff is not enabled on this server (registry enabled:false / GAMES_ENABLED)");
  });

  test("EN: 4 phones + a late joiner, remote-only TV, full Short game", async ({ browser }) => {
    test.setTimeout(600_000);
    await playGame(browser, { locale: "en", names: ["Rami", "Maya", "Karim", "Nour"], lateJoiner: "Lina", shots: true });
  });

  test("AR (RTL): 3 phones, remote-only TV, full Short game", async ({ browser }) => {
    test.setTimeout(600_000);
    await playGame(browser, { locale: "ar", names: ["رامي", "مايا", "كريم"], shots: true });
  });

  test("ES: 6 phones, remote-only TV, full Short game", async ({ browser }) => {
    test.setTimeout(600_000);
    await playGame(browser, { locale: "es", names: ["Lucía", "Mateo", "Sofía", "Diego", "Valeria", "Pablo"], shots: true });
  });
});
