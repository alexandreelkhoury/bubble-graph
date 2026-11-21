import { describe, expect, it } from "vitest";
import {
  cardLabelSize, dashedRoundRect, elimTimeline, flightCurve, quad, revealRow, sbScroll, stripPlan, voteFlights, voteGrid, wheelIndex,
} from "../src/tv-pixi/mishanaPlan";

const id = (n: number): number => n;
const half = (n: number): number => Math.round(n / 2);

describe("Pixi Mish Ana! TV-07/TV-09 timeline", () => {
  it("matches the DOM's T (votes 3 s, verdict 2.4 s, grow 400, hold 600, flip 800)", () => {
    const T = elimTimeline(false, id);
    expect(T).toMatchObject({ arrows: 300, arrowsEnd: 1800, suspense: 1800, verdict: 2400, votesEnd: 3000, wheel: 0, cardStart: 3000 });
    expect(T.holdAt).toBe(3400);
    expect(T.flipAt).toBe(4000);
    expect(T.flipEnd).toBe(4800);
    expect(T.reaction).toBe(5000);
    expect(T.total).toBe(5600);
  });
  it("adds the 2 s wheel and speeds the card up (× 0.6) on a random pick; reduced motion halves everything", () => {
    const T = elimTimeline(true, id);
    expect(T.cardStart).toBe(5000);
    expect(T.flipAt - T.cardStart).toBe(Math.round(400 * 0.6 + 600 * 0.6));
    const R = elimTimeline(false, half);
    expect(R.votesEnd).toBe(1500);
    expect(R.total).toBe(2800);
  });
});

describe("vote flights", () => {
  const lv = { tally: [{ targetId: "b", voterIds: ["a", "c"] }, { targetId: "a", voterIds: ["b"] }], abstainIds: ["d"] };
  it("go in seat order, stack per target and send abstentions to the bin", () => {
    const f = voteFlights(["a", "b", "c", "d"], lv, { arrows: 300, arrowsEnd: 1800 }, 420);
    expect(f.map((x) => [x.voterId, x.to, x.k])).toEqual([["a", "b", 0], ["b", "a", 0], ["c", "b", 1], ["d", "__bin", 0]]);
    expect(f[0]!.delay).toBe(300);
    expect(f[3]!.delay).toBeCloseTo(300 + 3 * 375);
    expect(f[0]!.dur).toBe(600);
  });
  it("curve: from the voter's centre to above the target, bowing down when both are low on the board", () => {
    const a = { x: 0, y: 220, w: 100, h: 100 }, b = { x: 300, y: 230, w: 100, h: 100 };
    const c = flightCurve(a, b, 2);
    expect([c.x0, c.y0]).toEqual([50, 270]);
    expect([c.x1, c.y1]).toEqual([340, 216]);
    expect(c.cy).toBeGreaterThan((c.y0 + c.y1) / 2);
    expect(flightCurve({ ...a, y: 10 }, b, 0).cy).toBeLessThan((10 + 50 + 224) / 2);
    expect(quad(0, 5, 10, 0)).toBe(0);
    expect(quad(0, 5, 10, 1)).toBe(10);
  });
});

describe("tile grids", () => {
  it("rows of 4 centred (6 compact tiles above 8), last row centred, mirrored in RTL", () => {
    const g = voteGrid(5, 480, 267, false);
    expect(g.big).toBe(false);
    expect(g.tiles[0]).toEqual({ x: 480 - (4 * 136 + 3 * 16) / 2, y: 267 - (2 * 112 + 16) / 2, w: 136, h: 112 });
    expect(g.tiles[4]!.x + 68).toBe(480);
    const r = voteGrid(5, 480, 267, true);
    expect(r.tiles[0]!.x).toBe(g.tiles[3]!.x);
    const big = voteGrid(12, 480, 267, false);
    expect(big.big).toBe(true);
    expect(big.tiles[6]!.y - big.tiles[0]!.y).toBe(96 + 16);
    for (const tl of big.tiles) expect(tl.x >= 58 && tl.x + tl.w <= 902).toBe(true);
  });
  it("TV-04 row: 104 dp tiles, 6 per row, centred", () => {
    const xs = revealRow(7, 480, false);
    expect(xs.filter((x) => x.row === 0)).toHaveLength(6);
    expect(xs[6]).toEqual({ x: 480, row: 1 });
    expect(xs[0]!.x).toBe(480 - (6 * 104 + 5 * 24) / 2 + 52);
    expect(revealRow(7, 480, true)[0]!.x).toBe(xs[5]!.x);
  });
});

describe("TV-05 order strip", () => {
  it("lays everything with chevrons when it fits, from the inline start", () => {
    const p = stripPlan(5, 0, 864, 48, false);
    expect(p.items).toHaveLength(5);
    expect(p.chevrons).toHaveLength(4);
    expect(p.items[0]).toBe(48 + 52);
    expect(p.chevrons[0]).toBe(48 + 104 + 12);
    expect(stripPlan(5, 0, 864, 48, true).items[0]).toBe(48 + 864 - 52);
  });
  it("windows long orders around the current speaker with +n counters", () => {
    const p = stripPlan(12, 9, 864, 48, false);
    expect(p.chevrons).toHaveLength(0);
    expect(p.before).not.toBeNull();
    expect(p.end - p.start).toBe(p.items.length);
    expect(p.start).toBeLessThanOrEqual(9);
    expect(p.end).toBeGreaterThan(9);
    const right = Math.max(...p.items, p.after ?? 0, p.before ?? 0);
    expect(right).toBeLessThanOrEqual(48 + 864);
  });
});

describe("misc", () => {
  it("the wheel lands on the target after three laps", () => {
    expect(wheelIndex(2000, 2000, 3, 2)).toBe(2);
    expect(wheelIndex(0, 2000, 3, 2)).toBe(0);
    expect(wheelIndex(9999, 2000, 4, 1)).toBe(1);
  });
  it("the role label steps down with its length inside 22–56", () => {
    expect(cardLabelSize(186, "MOLE")).toBe(55.25);
    expect(cardLabelSize(186, "CIVILIAN")).toBeCloseTo(27.6, 1);
    expect(cardLabelSize(186, "UNDERCOVER AGENT")).toBe(22);
    expect(cardLabelSize(400, "X")).toBe(56);
  });
  it("the scoreboard glides only past five rows: hold, scroll, hold, back", () => {
    expect(sbScroll(5000, 5, 5)).toBe(0);
    expect(sbScroll(1000, 8, 5)).toBe(0);
    expect(sbScroll(2600 + 2100, 8, 5)).toBe(3);
    expect(sbScroll(2600 + 2100 + 2000, 8, 5)).toBe(3);
    const mid = sbScroll(2600 + 1050, 8, 5);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(3);
    expect(sbScroll(2 * (2600 + 2100), 8, 5)).toBe(0);
  });
  it("dashes follow the rounded outline and stay inside the box", () => {
    const d = dashedRoundRect(100, 60, 16, 6, 5);
    expect(d.length).toBeGreaterThan(20);
    for (const pts of d) for (let i = 0; i < pts.length; i += 2) {
      expect(pts[i]!).toBeGreaterThanOrEqual(-0.001); expect(pts[i]!).toBeLessThanOrEqual(100.001);
      expect(pts[i + 1]!).toBeGreaterThanOrEqual(-0.001); expect(pts[i + 1]!).toBeLessThanOrEqual(60.001);
    }
  });
});
