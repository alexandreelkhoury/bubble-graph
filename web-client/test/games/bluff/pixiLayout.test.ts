// The Pixi Bluff TV's pure layout helpers (src/tv-pixi/bluffLayout.ts): they must place things where the DOM screens
// (games/bluff/tv/*, tv.css) do, mirror in RTL, keep text off the canvas edges and follow the shared reveal timeline.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import {
  H, W, autoRtl, barScale, bidi, boardCell, boardStyle, caps, envDrop, fanOf, hopPoint, knewAlpha, landed, markAt, mx, neonAlpha, pickSize, podiumCols,
  podiumDropAt, popSpots, raceCols, raceRowH, RACE, rowTops, stackHeight, tiltOf, twistCells,
} from "../../../src/tv-pixi/bluffLayout";
import { bluffModel, revealPlan } from "../../../src/games/bluff/model";
import { CARD, CARD_TOP, SEAT_Y, landing, popSpot, revealTimeline } from "../../../src/games/bluff/choreo";

const DIR = join(__dirname, "../../../../shared/fixtures/v2/games/bluff");
const load = (f: string): TvRoomView => (JSON.parse(readFileSync(join(DIR, f), "utf8")) as { view: TvRoomView }).view;

describe("bidi (canvas text has an LTR base direction)", () => {
  it("leaves LTR locales untouched", () => {
    expect(bidi("Rami fooled 2!", false)).toBe("Rami fooled 2!");
    expect(bidi("", true)).toBe("");
  });
  it("puts a strong RTL mark at both ends and before every word and line", () => {
    const s = bidi("خدع Rami ٢\nلاعبين", true);
    expect(s.startsWith("‏")).toBe(true);
    expect(s.endsWith("‏")).toBe(true);
    expect(s).toBe("‏خدع ‏Rami ‏٢\n‏لاعبين‏");
    // Nothing but marks is added: the visible text is unchanged.
    expect(s.replace(/‏/g, "")).toBe("خدع Rami ٢\nلاعبين");
  });
  it("reads player text's own direction like dir=auto, skipping isolated names", () => {
    expect(autoRtl("بكرا بيدوب التلج…", false)).toBe(true);
    expect(autoRtl("Becomes a philosopher", true)).toBe(false);
    expect(autoRtl("\u2068Rami\u2069 خدع", false)).toBe(true);
    expect(autoRtl("123 …", true)).toBe(true);
    expect(autoRtl("123 …", false)).toBe(false);
  });
  it("uppercases titles except in Arabic", () => {
    expect(caps("Round 1", false)).toBe("ROUND 1");
    expect(caps("الجولة ١", true)).toBe("الجولة ١");
  });
  it("mirrors x in RTL", () => {
    expect(mx(100, false)).toBe(100);
    expect(mx(100, true)).toBe(W - 100);
  });
});

describe("fit to the safe area", () => {
  it("picks the largest size that fits, else the smallest", () => {
    expect(pickSize([36, 30, 24], (s) => s <= 30)).toBe(30);
    expect(pickSize([36, 30, 24], () => true)).toBe(36);
    expect(pickSize([36, 30, 24], () => false)).toBe(24);
  });
});

describe("the corkboard (tv.css .bfboard)", () => {
  it("one column up to 6 cards, two from 7, inside the safe margins", () => {
    for (let n = 2; n <= 13; n++) {
      const st = boardStyle(n);
      expect(st.cols).toBe(n > 6 ? 2 : 1);
      expect(st.left).toBeGreaterThanOrEqual(48);
      expect(st.right).toBeLessThanOrEqual(W - 48);
      expect(st.colW * st.cols + st.gapX * (st.cols - 1)).toBeCloseTo(st.right - st.left);
    }
    expect(boardStyle(3).minH).toBe(54);
    expect(boardStyle(5).font).toBe(19);
    expect(boardStyle(9).font).toBe(16);
  });
  it("fills rows start → end and mirrors the columns in RTL", () => {
    expect(boardCell(0, 2, false)).toEqual({ row: 0, col: 0 });
    expect(boardCell(1, 2, false)).toEqual({ row: 0, col: 1 });
    expect(boardCell(0, 2, true)).toEqual({ row: 0, col: 1 });
    expect(boardCell(5, 2, true)).toEqual({ row: 2, col: 0 });
    expect(boardCell(4, 1, true)).toEqual({ row: 4, col: 0 });
  });
  it("stacks rows with gaps", () => {
    expect(rowTops([40, 54, 40], 126, 8)).toEqual([126, 174, 236]);
    expect(stackHeight([40, 54, 40], 8)).toBe(150);
    expect(stackHeight([], 8)).toBe(0);
  });
  it("tilts by position, never by option", () => {
    expect(tiltOf(0)).toBe(-1.4);
    expect(tiltOf(13)).toBe(tiltOf(0));
  });
});

describe("the scores race and the podium", () => {
  it("fits 12 rows in 400 dp and keeps 44 dp rows when few", () => {
    expect(raceRowH(4)).toBe(44);
    expect(raceRowH(12) * 12).toBeLessThanOrEqual(400);
    expect(raceRowH(20)).toBe(raceRowH(12));
  });
  it("keeps the race columns in order inside its band", () => {
    for (const chip of [0, 48]) {
      const c = raceCols(chip);
      expect(c.placeEnd).toBeGreaterThan(RACE.left);
      expect(c.name).toBeGreaterThan(c.char);
      expect(c.trackA).toBeGreaterThanOrEqual(c.name + c.nameW);
      expect(c.trackB).toBeGreaterThan(c.trackA + 100);
      expect(c.scoreEnd).toBeLessThan(c.delta);
      expect(c.delta + 54).toBeLessThanOrEqual(RACE.right);
    }
  });
  it("stubs empty bars at 1.5 %", () => {
    expect(barScale(0, 0)).toBe(0.015);
    expect(barScale(500, 1000)).toBe(0.5);
  });
  it("orders the podium 2-1-3 (mirrored in RTL) and lands steps 3, 2, 1", () => {
    const ltr = podiumCols(false), rtl = podiumCols(true);
    expect(ltr.map((c) => c.i)).toEqual([1, 0, 2]);
    expect(ltr[1]!.x).toBe(W / 2);
    expect(rtl[0]!.x).toBe(W - ltr[0]!.x);
    expect(ltr.find((c) => c.i === 0)!.step).toBeGreaterThan(ltr.find((c) => c.i === 2)!.step);
    expect(landed(2, 1)).toBe(true);
    expect(landed(0, 2)).toBe(false);
    expect(landed(0, 3)).toBe(true);
    expect(podiumDropAt(2)).toBe(1800);
  });
});

describe("the reveal", () => {
  const view = load("s2c.state.tv.playing.bluff.reveal.json");
  const m = bluffModel(view)!;
  const r = m.pub.reveal!;
  const plan = revealPlan(r);
  const tl = revealTimeline(r, plan);
  it("marks follow the beat's timeline (0 → 4)", () => {
    const i = plan.beats.findIndex((b) => b.kind === "lie");
    const b = plan.beats[i]!, mk = tl.beats[i]!.marks;
    expect(markAt(mk, b, b.start)).toBe(0);
    expect(markAt(mk, b, mk.land)).toBe(1);
    expect(markAt(mk, b, mk.stamp)).toBe(2);
    expect(markAt(mk, b, mk.pop)).toBe(3);
    expect(markAt(mk, b, mk.tick)).toBe(4);
  });
  it("a hop starts at the seat, lands on the card and arcs 120 dp at mid-flight", () => {
    const land = landing(0, 2);
    expect(hopPoint(100, SEAT_Y, land.x, land.y, 0)).toEqual({ x: 100, y: SEAT_Y });
    expect(hopPoint(100, SEAT_Y, land.x, land.y, 1)).toEqual(land);
    const mid = hopPoint(100, SEAT_Y, land.x, land.y, 0.5);
    expect(mid.y).toBeCloseTo((SEAT_Y + land.y) / 2 - 120);
    expect(land.y).toBe(CARD_TOP + 2);
  });
  it("pop spots start at the DOM's popSpot and never leave the canvas", () => {
    for (const rtl of [false, true]) {
      expect(popSpots(1, rtl, CARD)[0]).toEqual(popSpot(rtl, 0));
      for (const p of popSpots(3, rtl, CARD)) { expect(p.x - 42).toBeGreaterThanOrEqual(8); expect(p.x + 42).toBeLessThanOrEqual(W - 8); }
    }
  });
  it("the twist grid fits between the margins and mirrors in RTL", () => {
    const cells = twistCells(9, false), rc = twistCells(9, true);
    expect(cells).toHaveLength(9);
    for (const c of cells) { expect(c.x).toBeGreaterThanOrEqual(70); expect(c.x + c.w).toBeLessThanOrEqual(W - 70 + 0.01); }
    expect(rc[0]!.x + rc[0]!.w).toBeCloseTo(W - cells[0]!.x);
    expect(twistCells(5, false)[3]!.y).toBeGreaterThan(cells[0]!.y);
  });
  it("the montage fans symmetrically", () => {
    expect(fanOf(0, 3, 1)).toEqual({ rot: -12, dx: -70 });
    expect(fanOf(1, 3, 1)).toEqual({ rot: 0, dx: 0 });
    expect(fanOf(2, 3, 0)).toEqual({ rot: 0, dx: 0 });
  });
});

describe("keyframe equivalents", () => {
  it("neon switches on with the DOM's flicker and stays on", () => {
    expect(neonAlpha(0, 0)).toBe(0.15);
    expect(neonAlpha(200, 0)).toBe(1);
    expect(neonAlpha(300, 0)).toBe(0.35);
    expect(neonAlpha(900, 0)).toBe(1);
  });
  it("the Knew-it flash fades in, holds and goes", () => {
    expect(knewAlpha(0)).toBe(0);
    expect(knewAlpha(750)).toBe(1);
    expect(knewAlpha(1500)).toBe(0);
  });
  it("an envelope falls into the slot and disappears", () => {
    const a = envDrop(0), b = envDrop(700);
    expect(a.y).toBe(-70);
    expect(a.a).toBe(0);
    expect(b.a).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(14);
  });
  it("stays inside the 960 × 540 canvas", () => { expect([W, H]).toEqual([960, 540]); });
});

describe("truth caption: the Arabic original only when it is Arabic", () => {
  it("shows an Arabic-script original, hides an English or identical one", async () => {
    const { showArabicOriginal } = await import("../../../src/games/bluff/tv/revealTime");
    expect(showArabicOriginal({ text: "Le loup", original: "الديب" })).toBe(true);
    expect(showArabicOriginal({ text: "Des humains", original: "Human ones" })).toBe(false);
    expect(showArabicOriginal({ text: "Human ones", original: "Human ones" })).toBe(false);
    expect(showArabicOriginal({ text: "x", original: null })).toBe(false);
  });
});
