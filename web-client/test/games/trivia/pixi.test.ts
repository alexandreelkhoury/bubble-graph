// Quiz Night on the Pixi TV (/tv-pixi): the pure numbers behind tv-pixi/trivia.ts (tv-pixi/triviaPlan.ts). The
// geometry itself is layout.ts (tested in trivia.test.ts); these are the CSS-keyframe parities, the marquee chase,
// the chip wrap, the results podium columns and the race rows.
import { describe, expect, it } from "vitest";
import { endMs, sample } from "@jamaa/shared/motion";
import {
  ANSWER_STEPS, BOARD_X, BOARD_Y, FINAL_STEPS, INTRO_STEPS, PODIUM_BASE_Y, PODIUM_COL_W, READ_STEPS, STEP_H, boardRows, castXs, chaseOn, fitScale,
  fitSizes, podiumCharSize, podiumColumns, questionFont, rollValue, stampLook, startsRtl, wrapCentred,
} from "../../../src/tv-pixi/triviaPlan";
import { CANVAS } from "../../../src/games/trivia/layout";

describe("keyframe steps (tv.css parity)", () => {
  it("intro: the card lands in 400 ms, stars 150 ms apart from 450 ms, chips after the domain, the count at 1.15 s", () => {
    const by = new Map(INTRO_STEPS.map((s) => [s.id, s]));
    expect(by.get("card")).toMatchObject({ startMs: 0, durationMs: 400, easing: "ease.decel" });
    expect(sample(by.get("star")!, 450 + 150 * 2, 2)).toBe(0);
    expect(sample(by.get("star")!, 450 + 150 * 2 + 360, 2)).toBe(1);
    expect(by.get("dom")!.startMs).toBeLessThan(by.get("chip")!.startMs);
    expect(by.get("count")!.startMs).toBe(1150);
    expect(endMs(INTRO_STEPS, 3)).toBeLessThanOrEqual(1600);
  });
  it("read slams in 400 ms; answer tiles flip A→D 90 ms apart; the final stamps at 1.2 s", () => {
    expect(endMs(READ_STEPS)).toBe(400);
    const flip = ANSWER_STEPS[0]!;
    expect(sample(flip, 90, 1)).toBe(0);
    expect(sample(flip, 90 * 3 + 360, 3)).toBe(1);
    expect(FINAL_STEPS.find((s) => s.id === "stamp")!.startMs).toBe(1200);
  });
  it("every keyframe step is dropped in calm motion (the end state at once)", () => {
    for (const s of [...INTRO_STEPS, ...READ_STEPS, ...ANSWER_STEPS, ...FINAL_STEPS]) expect(s.reduced).toBe("skip");
  });
});

describe("marquee chase", () => {
  it("each bulb is on 70 % of a 2.7 s cycle, 100 ms after its neighbour", () => {
    let on = 0;
    for (let t = 0; t < 2700; t += 10) if (chaseOn(0, t)) on++;
    expect(on).toBe(189);
    expect(chaseOn(0, 0)).toBe(true);
    expect(chaseOn(0, 1890)).toBe(false);
    expect(chaseOn(1, 1890 + 100 - 1)).toBe(true);
    expect(chaseOn(1, 1990)).toBe(false);
  });
  it("runs three times faster in the final's heat", () => {
    expect(chaseOn(0, 700, true)).toBe(false);
    expect(chaseOn(0, 900, true)).toBe(true);
  });
});

describe("text", () => {
  it("question sizes follow the DOM classes (is-mid > 60, is-long > 90) and the squeezed reveal card", () => {
    expect([questionFont(40, false), questionFont(61, false), questionFont(91, false)]).toEqual([30, 26, 22]);
    expect([questionFont(40, true), questionFont(61, true), questionFont(91, true)]).toEqual([22, 20, 17]);
  });
  it("fit sizes step down by 2 and always end on the minimum", () => {
    expect(fitSizes(24, 13)).toEqual([24, 22, 20, 18, 16, 14, 13]);
    expect(fitSizes(16, 16)).toEqual([16]);
  });
  it("a tile's own direction comes from its first strong character", () => {
    expect(startsRtl("بيروت")).toBe(true);
    expect(startsRtl("1975 بيروت")).toBe(true);
    expect(startsRtl("Beyrouth (بيروت)")).toBe(false);
    expect(startsRtl("Élysée")).toBe(false);
    expect(startsRtl("42")).toBe(false);
  });
  it("blocks only ever scale down", () => {
    expect(fitScale(50, 100)).toBe(1);
    expect(fitScale(200, 100)).toBe(0.5);
    expect(fitScale(0, 100)).toBe(1);
  });
});

describe("chip wrap", () => {
  it("centres one row and wraps when full", () => {
    expect(wrapCentred([100, 100], 300, 10, false)).toEqual([{ x: 45, row: 0 }, { x: 155, row: 0 }]);
    const two = wrapCentred([200, 200, 50], 420, 8, false);
    expect(two.map((p) => p.row)).toEqual([0, 0, 1]);
    expect(two[2]!.x).toBe((420 - 50) / 2);
  });
  it("runs from the right in RTL (the first chip is the rightmost)", () => {
    const r = wrapCentred([100, 60], 300, 10, true);
    expect(r[0]!.x).toBeGreaterThan(r[1]!.x);
  });
  it("a chip wider than the row still gets a row of its own", () => {
    expect(wrapCentred([500, 20], 300, 8, false).map((p) => p.row)).toEqual([0, 1]);
  });
});

describe("results podium", () => {
  it("steps 2-1-3 left to right, mirrored in RTL, centred on the canvas, 190 wide and 6 apart", () => {
    const l = podiumColumns(false), r = podiumColumns(true);
    expect(l.map((c) => c.step)).toEqual([2, 1, 3]);
    expect(r.map((c) => c.step)).toEqual([3, 1, 2]);
    expect(l[1]!.cx).toBe(CANVAS.w / 2);
    expect(l[1]!.cx - l[0]!.cx).toBe(PODIUM_COL_W + 6);
    expect(r.find((c) => c.step === 2)!.cx).toBe(CANVAS.w - l.find((c) => c.step === 2)!.cx);
  });
  it("heights 130 / 96 / 70 on y = 434; the top step stays under the stat cards", () => {
    expect(STEP_H).toEqual({ 1: 130, 2: 96, 3: 70 });
    expect(PODIUM_BASE_Y).toBe(434);
    expect(PODIUM_BASE_Y - STEP_H[1] - podiumCharSize(1, 1)).toBeGreaterThan(104 + 38);
  });
  it("tied characters share 170 dp and stand side by side", () => {
    expect(podiumCharSize(1, 1)).toBe(96);
    expect(podiumCharSize(2, 1)).toBe(76);
    expect(podiumCharSize(1, 3)).toBe(56);
    const xs = castXs(480, 3, 56);
    expect(xs[1]).toBe(480);
    expect(xs[2]! - xs[0]!).toBeLessThan(170);
  });
});

describe("leaderboard race", () => {
  it("8 players fit comfortable rows and 12 compact rows on the canvas (as the DOM board)", () => {
    const a = boardRows(8), b = boardRows(12);
    expect(a.compact).toBe(false);
    expect(BOARD_Y + 8 * (a.h + a.gap)).toBeLessThanOrEqual(CANVAS.h);
    expect(b.compact).toBe(true);
    expect(BOARD_Y + 12 * (b.h + b.gap)).toBeLessThanOrEqual(CANVAS.h);
    expect(BOARD_X * 2).toBeLessThan(CANVAS.w);
  });
  it("scores roll from the old total to the new one and never past it", () => {
    expect(rollValue(100, 970, 0)).toBe(100);
    expect(rollValue(100, 970, 0.5)).toBe(535);
    expect(rollValue(100, 970, 1)).toBe(970);
    expect(rollValue(100, 970, 1.2)).toBe(970);
    expect(rollValue(0, 0, 0.3)).toBe(0);
  });
});

describe("Time! stamp", () => {
  it("lands from 1.6× and fades with the wrong tiles", () => {
    expect(stampLook(0, 0)).toEqual({ scale: 1.6, alpha: 0 });
    expect(stampLook(1, 0)).toEqual({ scale: 1, alpha: 1 });
    expect(stampLook(1, 1).alpha).toBe(0);
  });
});
