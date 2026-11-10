// GAME-BLUFF lane B review fixes (G2): the carried odometer, frozen option letters, signed numbers in RTL, the ⓘ
// rules params, waiting late joiners, the /tv reveal's server-seeded start and the TV pause items with their ids.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { PlayerRoomView, TvRoomView } from "@jamaa/shared/protocol/v2";
import { loadCatalog, loadGameCatalog, translate } from "../../../src/i18n/t";
import { odoColumns, odoReading, odoWidth } from "../../../src/games/bluff/art";
import { bluffModel, optionLetters, resetOptionLetters, ruleParams, signed, WRITING_SECONDS } from "../../../src/games/bluff/model";
import { baseExpression, countedSeats, isWaiting, propOf } from "../../../src/games/bluff/tvModel";
import type { BluffModel } from "../../../src/games/bluff/model";
import { hopSize, landing, NAME_Y, PILL_Y, SEAT_Y, seatChar } from "../../../src/games/bluff/choreo";
import { pauseAction } from "../../../src/games/bluff/tv/pause";
import { revealElapsed } from "../../../src/games/bluff/tv/revealTime";

const DIR = join(__dirname, "../../../../shared/fixtures/v2/games/bluff");
const load = <T>(f: string): T => (JSON.parse(readFileSync(join(DIR, f), "utf8")) as { view: T }).view;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const model = (v: PlayerRoomView | TvRoomView): BluffModel => bluffModel(v)!;

describe("odometer (DESIGN-JAMAA §5.1)", () => {
  it("1060 → 1460 never reads a non-monotonic or out-of-range value, and the thousands column stays still", () => {
    const cols = odoWidth(1060, 1460);
    expect(cols).toBe(4);
    let last = -1;
    for (let i = 0; i <= 4000; i++) {
      const v = 1060 + (400 * i) / 4000;
      const c = odoColumns(v, cols);
      const read = odoReading(c);
      expect(read).toBeGreaterThanOrEqual(last);
      expect(read).toBeGreaterThanOrEqual(1060);
      expect(read).toBeLessThanOrEqual(1460);
      expect(read).toBe(Math.floor(v + 1e-9));
      expect(c[0]!.pos).toBe(1);
      c.forEach((x) => { expect(x.pos).toBeGreaterThanOrEqual(0); expect(x.pos).toBeLessThanOrEqual(10); });
      last = read;
    }
  });
  it("a column rolls only while the columns under it carry over", () => {
    // 1069.5: the ones roll 9 → 10 (the strip's second 0), the tens carry half-way, hundreds and thousands stay put.
    const c = odoColumns(1069.5, 4);
    expect(c.map((x) => x.pos)).toEqual([1, 0, 6.5, 9.5]);
    expect(odoColumns(1234, 4).map((x) => x.pos)).toEqual([1, 2, 3, 4]);
  });
  it("hides leading zeros (no '00' pills), and the new column fades in only while it carries", () => {
    expect(odoColumns(0, 3).map((x) => x.lead)).toEqual([true, true, false]);
    expect(odoColumns(70, 3).map((x) => x.lead)).toEqual([true, false, false]);
    expect(odoColumns(999.5, 4)[0]).toEqual({ pos: 0.5, lead: false });
    expect(odoColumns(998, 4)[0]!.lead).toBe(true);
  });
});

describe("frozen option letters (a host hide never re-letters the board)", () => {
  it("keeps every remaining card's letter after a hide; the hidden letter stays unused", () => {
    resetOptionLetters();
    const v = load<TvRoomView>("s2c.state.tv.playing.bluff.voting.json");
    const m = model(v);
    const before = optionLetters(m);
    expect([...before.values()].slice(0, 3)).toEqual(["A", "B", "C"]);
    const hidden = m.pub.options[0]!.id;
    const after = clone(v);
    const g = after.game as Extract<NonNullable<TvRoomView["game"]>, { gameId: "bluff" }>;
    g.public.options = g.public.options.filter((o) => o.id !== hidden);
    g.public.hidesLeft -= 1;
    const l2 = optionLetters(model(after));
    for (const o of g.public.options) expect(l2.get(o.id)).toBe(before.get(o.id));
    expect(g.public.options.map((o) => l2.get(o.id))).not.toContain("A");
  });
  it("a new prompt letters from A again", () => {
    resetOptionLetters();
    const v = load<TvRoomView>("s2c.state.tv.playing.bluff.voting.json");
    optionLetters(model(v));
    const next = clone(v);
    const g = next.game as Extract<NonNullable<TvRoomView["game"]>, { gameId: "bluff" }>;
    g.public.promptIndex += 1;
    g.public.options = [...g.public.options].reverse();
    expect(optionLetters(model(next)).get(g.public.options[0]!.id)).toBe("A");
  });
});

describe("signed numbers in RTL (GAME-BLUFF §10: an LRM before every number)", () => {
  beforeAll(async () => { await loadCatalog("ar"); await loadGameCatalog("bluff", "ar"); });
  it("signed() puts an LRM before the plus sign", () => {
    expect(signed(160)).toBe("‎+160");
  });
  it("the AR phone total reads +160 (LRM-led), never 160+", () => {
    const s = translate("ar", "game.bluff.reveal.thisPrompt", { points: signed(160) });
    expect(s).toContain("‎+160");
    expect(s).not.toMatch(/(^|[^‎])\+160/);
  });
  it("no Bluff source renders a bare signed number (Signed, dir=ltr or an isolated class only)", () => {
    const root = join(__dirname, "../../../src/games/bluff");
    const files = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(p) ? [p] : []; });
    const bad: string[] = [];
    for (const f of files(root)) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (/`\+\$\{|>\+\{|>\+</.test(line) && !/dir="ltr"/.test(line)) bad.push(`${f}:${i + 1}`);
        if (/results\.pointsEarned/.test(line)) bad.push(`${f}:${i + 1} (use <Signed>)`);
      });
    }
    expect(bad).toEqual([]);
  });
});

describe("ⓘ rules params (GAME-BLUFF §10.2 {seconds})", () => {
  it("SETUP pace → 90 / 60 / 45 s, remembered into the game", () => {
    const setupView = load<PlayerRoomView>("s2c.state.player.setup.bluff.host.json");
    for (const pace of ["relaxed", "normal", "fast"] as const) {
      const v = clone(setupView);
      const setup = v.room.setup as Extract<NonNullable<PlayerRoomView["room"]["setup"]>, { gameId: "bluff" }>;
      setup.settings.pace = pace;
      expect(ruleParams(v).seconds).toBe(WRITING_SECONDS[pace]);
      expect(ruleParams(load<TvRoomView>("s2c.state.tv.playing.bluff.voting.json")).seconds).toBe(WRITING_SECONDS[pace]);
    }
    expect(ruleParams(setupView).finalSeconds).toBeGreaterThan(0);
  });
  it("the copy has no raw placeholder once the params are passed", async () => {
    await loadGameCatalog("bluff", "en");
    for (const l of ["en", "ar"] as const) {
      await loadGameCatalog("bluff", l);
      expect(translate(l, "game.bluff.rules.writing.body", ruleParams(load<TvRoomView>("s2c.state.tv.playing.bluff.voting.json")))).not.toContain("{seconds}");
    }
  });
});

describe("waiting late joiners (GAME-BLUFF §7.1) are not shown as writing or voting", () => {
  it("idle, no pencil, not counted in the envelope box", () => {
    const v = clone(load<TvRoomView>("s2c.state.tv.playing.bluff.writing.json"));
    const m0 = model(v);
    const pending = m0.seats.find((s) => s.connected && !s.left && !m0.pub.submittedIds.includes(s.id))!;
    expect(pending).toBeDefined();
    expect(baseExpression(m0, pending)).toBe("think");
    expect(propOf(m0, pending)).toBe("pencil");
    const g = v.game as Extract<NonNullable<TvRoomView["game"]>, { gameId: "bluff" }>;
    g.awaitedIds = g.awaitedIds.filter((id) => id !== pending.id);
    const m = model(v);
    const s = m.byId.get(pending.id)!;
    expect(isWaiting(m, s)).toBe(true);
    expect(baseExpression(m, s)).toBe("idle");
    expect(propOf(m, s)).toBeNull();
    expect(countedSeats(m).map((x) => x.id)).not.toContain(pending.id);
    expect(countedSeats(m0).map((x) => x.id)).toContain(pending.id);
  });
});

describe("café row geometry (DESIGN-JAMAA §4.4)", () => {
  it("72 dp up to 8 players, 56 above; hoppers ≥ 56; plates and names 16 dp clear of the pills", () => {
    expect(seatChar(8)).toBe(72);
    expect(seatChar(9)).toBe(56);
    expect(hopSize(12)).toBeGreaterThanOrEqual(56);
    expect(PILL_Y - 12 - (NAME_Y + 18)).toBeGreaterThanOrEqual(16);
    expect(SEAT_Y + 8).toBeLessThan(NAME_Y);
    expect(PILL_Y + 12).toBeLessThanOrEqual(540);
    const xs = Array.from({ length: 12 }, (_, k) => landing(k, 12).x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(520);
  });
});

describe("/tv reveal starts where the server is (same rule as the phone and the native TV)", () => {
  it("elapsed = clamp(serverNow − (deadline − durationMs), 0, total)", () => {
    expect(revealElapsed(10_000, 8_000, 2_000, 7_500)).toBe(0);
    expect(revealElapsed(10_000, 8_000, 5_000, 7_500)).toBe(3_000);
    expect(revealElapsed(10_000, 8_000, 20_000, 7_500)).toBe(7_500);
    expect(revealElapsed(null, 8_000, 20_000, 7_500)).toBe(0);
  });
});

describe("TV pause items carry the ids the strict schema needs", () => {
  const writing = load<TvRoomView>("s2c.state.tv.playing.bluff.writing.json");
  const voting = load<TvRoomView>("s2c.state.tv.playing.bluff.voting.json");
  it("SKIP_PROMPT sends the live prompt id (WRITING, skips left)", () => {
    const m = model(writing);
    const a = pauseAction("SKIP_PROMPT", writing);
    if (m.pub.skipsLeft > 0) expect(a).toEqual({ kind: "send", intent: { type: "SKIP_PROMPT", promptId: m.pub.prompt!.id } });
    const none = clone(writing);
    (none.game as Extract<NonNullable<TvRoomView["game"]>, { gameId: "bluff" }>).public.skipsLeft = 0;
    expect(pauseAction("SKIP_PROMPT", none)).toEqual({ kind: "unavailable" });
    expect(pauseAction("SKIP_PROMPT", voting)).toEqual({ kind: "unavailable" });
  });
  it("HIDE_OPTION opens the picker in VOTING (hides left, > 2 cards), else unavailable", () => {
    const m = model(voting);
    expect(pauseAction("HIDE_OPTION", voting)).toEqual(m.pub.hidesLeft > 0 && m.pub.options.length > 2 ? { kind: "pickOptionToHide" } : { kind: "unavailable" });
    const none = clone(voting);
    (none.game as Extract<NonNullable<TvRoomView["game"]>, { gameId: "bluff" }>).public.hidesLeft = 0;
    expect(pauseAction("HIDE_OPTION", none)).toEqual({ kind: "unavailable" });
    expect(pauseAction("HIDE_OPTION", writing)).toEqual({ kind: "unavailable" });
  });
  it("Next and End game follow their phases", () => {
    expect(pauseAction("HOST_ADVANCE", writing)).toEqual({ kind: "unavailable" });
    expect(pauseAction("END_GAME", voting)).toEqual({ kind: "unavailable" });
    expect(pauseAction("BOGUS", voting)).toEqual({ kind: "unavailable" });
  });
});
