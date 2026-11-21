// The Pixi Taqriban geometry (src/tv-pixi/taqribanLayout.ts) and the shared reveal timeline (games/taqriban/tv/timeline.ts):
// the same places and times as the DOM /tv (tv.css), RTL mirroring, and no colliding tags.
import { describe, expect, it } from "vitest";
import { endMs, sample } from "@jamaa/shared/motion";
import {
  AXIS_Y, LINE_W, LINE_X0, SAFE_X0, SAFE_X1, W, barFrac, boardCols, boardGeom, castLayout, clampCenter, laneY, lineX, mx, previousOrder, qFont,
  rowXs, spreadTags, winScale,
} from "../../../src/tv-pixi/taqribanLayout";
import { REVEAL_T, answerAt, dotAt, revealSteps, stampAt } from "../../../src/games/taqriban/tv/timeline";

describe("number line geometry (tv.css)", () => {
  it("the line spans 72..888 at y 340, lanes 52 dp apart above it", () => {
    expect(lineX(0)).toBe(LINE_X0);
    expect(lineX(1)).toBe(LINE_X0 + LINE_W);
    expect(LINE_X0 + LINE_W).toBe(888);
    expect(AXIS_Y).toBe(340);
    expect(laneY(0)).toBe(310);
    expect(laneY(3)).toBe(154);
  });
  it("question sizes 38 / 31 / 25 by length", () => {
    expect(qFont("x".repeat(70))).toBe(38);
    expect(qFont("x".repeat(71))).toBe(31);
    expect(qFont("x".repeat(111))).toBe(25);
  });
  it("clampCenter keeps a box inside the safe area", () => {
    expect(clampCenter(60, 50)).toBe(SAFE_X0 + 50);
    expect(clampCenter(900, 50)).toBe(SAFE_X1 - 50);
    expect(clampCenter(480, 50)).toBe(480);
    expect(clampCenter(480, 1000)).toBe(480);
  });
});

describe("rows and mirroring", () => {
  it("rowXs centres a flex row and mirrors it in RTL", () => {
    expect(rowXs([64, 100], 16, 480, false)).toEqual([480 - 90 + 32, 480 - 90 + 64 + 16 + 50]);
    const ltr = rowXs([40, 60, 20], 10, 300, false), rtl = rowXs([40, 60, 20], 10, 300, true);
    rtl.forEach((x, i) => expect(x).toBeCloseTo(600 - ltr[i]!, 9));
    expect(rtl[0]!).toBeGreaterThan(rtl[1]!);
    expect(mx(48, true)).toBe(W - 48);
    expect(mx(48, false)).toBe(48);
  });
  it("cast: 88 dp slots, shrinking to fit 12 players inside the safe area; 56 dp characters above 8", () => {
    const five = castLayout(5, false);
    expect(five.size).toBe(80);
    expect(five.slot).toBe(88);
    expect(five.xs[2]).toBe(480);
    const twelve = castLayout(12, false);
    expect(twelve.size).toBe(56);
    expect(twelve.xs[0]! - twelve.slot / 2).toBeGreaterThanOrEqual(SAFE_X0 - 1e-9);
    expect(twelve.xs[11]! + twelve.slot / 2).toBeLessThanOrEqual(SAFE_X1 + 1e-9);
    expect(castLayout(3, true).xs[0]).toBeGreaterThan(castLayout(3, true).xs[2]!);
  });
});

describe("standings geometry", () => {
  it("rows are centred between y 116 and 500; compact above 8", () => {
    const g = boardGeom(5);
    expect(g.compact).toBe(false);
    expect(g.slotY(0) - g.h / 2 - 116).toBeCloseTo(500 - (g.slotY(4) + g.h / 2), 9);
    const c = boardGeom(12);
    expect(c.compact).toBe(true);
    expect(c.slotY(0) - c.h / 2).toBeGreaterThanOrEqual(116 - 1e-9);
    expect(c.slotY(11) + c.h / 2).toBeLessThanOrEqual(500 + 1e-9);
  });
  it("columns stay inside the row and the bar fills what is left", () => {
    for (const compact of [false, true]) {
      const c = boardCols(compact, 60);
      expect(c.rank).toBeGreaterThan(96);
      expect(c.bar).toBeGreaterThan(c.name + c.nameW - 1);
      expect(c.bar + c.barW + 60).toBeLessThanOrEqual(c.wonEnd);
      expect(c.scoreEnd).toBe(W - 108);
    }
    expect(barFrac(0, 100)).toBe(0.02);
    expect(barFrac(50, 100)).toBe(0.5);
    expect(barFrac(5, 0)).toBe(0.02);
  });
  it("previous order: rank before, then seat; unranked last", () => {
    const rows = [
      { id: "a", seat: 0, row: { rankBefore: 2 } }, { id: "b", seat: 1, row: { rankBefore: 1 } }, { id: "c", seat: 2, row: { rankBefore: null } },
      { id: "d", seat: 3, row: { rankBefore: 1 } },
    ];
    expect(previousOrder(rows).map((r) => r.id)).toEqual(["b", "d", "a", "c"]);
  });
});

describe("tags never collide in a lane", () => {
  it("separate tags stay on their dots; overlapping ones move apart around their mean", () => {
    expect(spreadTags([{ x: 200, w: 60, lane: 0 }, { x: 400, w: 60, lane: 0 }])).toEqual([200, 400]);
    const [a, b] = spreadTags([{ x: 300, w: 100, lane: 0 }, { x: 330, w: 100, lane: 0 }], 6) as [number, number];
    expect(b - a).toBeCloseTo(106, 9);
    expect((a + b) / 2).toBeCloseTo(315, 9);
    // other lanes are independent
    expect(spreadTags([{ x: 300, w: 100, lane: 0 }, { x: 330, w: 100, lane: 1 }])).toEqual([300, 330]);
  });
  it("a crowded cluster at the edge stays inside the bounds, in order", () => {
    const tags = Array.from({ length: 5 }, (_, i) => ({ x: 80 + i * 10, w: 90, lane: 0 }));
    const xs = spreadTags(tags, 6, 24, 936);
    expect(xs[0]! - 45).toBeGreaterThanOrEqual(24 - 1e-9);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(96 - 1e-9);
  });
});

describe("reveal timeline (shared with the DOM CSS delays)", () => {
  it("dots every 260 ms from 700, a 900 ms beat, the pin, the stamp 700 ms later", () => {
    expect(dotAt(0)).toBe(700);
    expect(dotAt(3)).toBe(700 + 3 * 260);
    expect(answerAt(5)).toBe(700 + 4 * 260 + 900);
    expect(answerAt(0)).toBe(1600);
    expect(stampAt(5)).toBe(answerAt(5) + REVEAL_T.stamp);
  });
  it("the step list samples those times and ends inside the shortest REVEAL window (9 s)", () => {
    for (const n of [0, 1, 5, 12]) {
      const steps = revealSteps(n);
      const by = new Map(steps.map((s) => [s.id, s]));
      expect(by.get("pin")!.startMs).toBe(answerAt(n));
      expect(by.get("stamp")!.startMs).toBe(stampAt(n));
      expect(by.has("dot")).toBe(n > 0);
      if (n > 0) {
        expect(sample(by.get("dot")!, dotAt(n - 1), n - 1)).toBe(0);
        expect(sample(by.get("dot")!, dotAt(n - 1) + 520, n - 1)).toBe(1);
      }
      expect(endMs(steps, Math.max(1, n))).toBeLessThan(9000);
      expect(steps.every((s) => s.reduced === "fade")).toBe(true);
    }
  });
  it("the winner grows to 1.3 and settles at 1.15", () => {
    expect(winScale(0)).toBe(1);
    expect(winScale(0.5)).toBeCloseTo(1.3, 9);
    expect(winScale(1)).toBeCloseTo(1.15, 9);
  });
});
