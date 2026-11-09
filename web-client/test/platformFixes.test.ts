// Lane B platform review fixes: the optimistic portal's hold clock (§3.10 A), the cup sheet's competition ranks, the
// rules sheet's section snap, the Store's pack titles, the overlay hygiene on room transitions, and the burst drawings
// (DESIGN-JAMAA §4.3: 3 boil tracings per burst, no arcs).
import { describe, expect, it } from "vitest";
import { CHOREO, run } from "@jamaa/shared/motion";
import type { RunnerClock } from "@jamaa/shared/motion";
import { REACTION_BURST } from "@jamaa/shared/characters";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { archTransform, holdClock } from "../src/tv-mock/tvTransitions";
import { competitionRank } from "../src/tv-mock/tvHub";
import { snapScroll } from "../src/tv-mock/tvRules";
import { splitPackTitle } from "../src/tv-mock/tvShop";
import { roomTransition } from "../src/tv-mock/tvStore";
import { BOIL_TRACINGS, BURST_ART, boilPath, burstTracings } from "../src/components/bursts";

/** A manual frame clock: `step(ms)` fires the pending callback at now + ms. */
function manualClock(): RunnerClock & { step(ms: number): void } {
  let now = 0;
  let cb: ((n: number) => void) | null = null;
  return {
    request: (f) => { cb = f; return 1; },
    cancel: () => { cb = null; },
    step(ms) { now += ms; const f = cb; cb = null; f?.(now); },
  };
}

describe("optimistic portal hold clock", () => {
  const holdAt = CHOREO.portal.find((s) => s.id === "handoff")!.startMs;
  it("runs press, others-out and the arch at once, holds at the hand-off until ready, then finishes", () => {
    const raf = manualClock();
    let ready = false;
    const h = holdClock(holdAt, () => ready, raf);
    const seen: { t: number; arch: number; handoff: number }[] = [];
    let done = false;
    run(CHOREO.portal, (p, t) => seen.push({ t, arch: p("arch"), handoff: p("handoff") }), () => { done = true; }, 1, h.clock);
    for (let i = 0; i < 60; i++) raf.step(16); // ~1 s of frames without an answer
    expect(done).toBe(false);
    const last = seen.at(-1)!;
    expect(last.t).toBe(holdAt);
    expect(last.arch).toBe(1);
    expect(last.handoff).toBe(0);
    // Frames kept coming during the arch (no stall: one per tick).
    expect(seen.filter((s) => s.t > 120 && s.t < 700).length).toBeGreaterThanOrEqual(30);
    ready = true;
    for (let i = 0; i < 40 && !done; i++) raf.step(16);
    expect(done).toBe(true);
    expect(seen.some((s) => s.handoff > 0 && s.handoff < 1)).toBe(true); // the hand-off played, not cut
  });
  it("OK before the answer skips to the hold, never past it", () => {
    const raf = manualClock();
    const h = holdClock(holdAt, () => false, raf);
    let t = 0;
    run(CHOREO.portal, (_p, tm) => { t = tm; }, undefined, 1, h.clock);
    raf.step(16);
    h.skip();
    raf.step(16);
    expect(t).toBe(holdAt);
  });
});

describe("composited arch mask", () => {
  // Applies "translate(Xpx, Ypx) scale(A, B)" (origin 0 0) to a point.
  const apply = (t: string, x: number, y: number): [number, number] => {
    const n = [...t.matchAll(/-?[\d.]+(?:e-?\d+)?/g)].map((m) => Number(m[0]));
    return [n[0]! + n[2]! * x, n[1]! + n[3]! * y];
  };
  it("the world inside the moving arch stays put at canvas coordinates", () => {
    const base = { x: 72, y: 82, w: 227, h: 313 }, box = { x: -300, y: -200, w: 1200, h: 900 };
    const { outer, inner } = archTransform(base, box);
    for (const [qx, qy] of [[0, 0], [480, 270], [960, 540]] as const) {
      const [ix, iy] = apply(inner, qx, qy);               // inner coords → inner-local
      const [ox, oy] = apply(outer, ix - base.x, iy - base.y); // the inner box sits at (-base) in the arch
      expect(ox + base.x).toBeCloseTo(qx, 6);
      expect(oy + base.y).toBeCloseTo(qy, 6);
    }
    // And the arch itself covers `box`.
    const [x0, y0] = apply(outer, 0, 0), [x1, y1] = apply(outer, base.w, base.h);
    expect([x0 + base.x, y0 + base.y, x1 + base.x, y1 + base.y]).toEqual([box.x, box.y, box.x + box.w, box.y + box.h].map((v) => expect.closeTo(v, 6)));
  });
});

describe("cup sheet ranks", () => {
  it("ties share a competition rank (1, 2, 2, 2, 5)", () => {
    const rows = [{ stars: 3 }, { stars: 0 }, { stars: 0 }, { stars: 0 }, { stars: -1 }];
    expect(rows.map((_, i) => competitionRank(rows, i))).toEqual([1, 2, 2, 2, 5]);
  });
});

describe("rules sheet scroll snap", () => {
  it("stops on a section start inside the step, else moves the plain step", () => {
    expect(snapScroll(0, 1, [0, 120, 400], 1000)).toBe(112);
    expect(snapScroll(112, 1, [0, 120, 400], 1000)).toBe(292);
    expect(snapScroll(292, -1, [0, 120, 400], 1000)).toBe(112);
    expect(snapScroll(900, 1, [], 1000)).toBe(1000);
    expect(snapScroll(50, -1, [], 1000)).toBe(0);
  });
});

describe("store pack titles", () => {
  it("moves the difficulty into a chip and keeps the full name", () => {
    expect(splitPackTitle("Hard · Food & drink")).toEqual(["Hard", "Food & drink"]);
    expect(splitPackTitle("Classics")).toEqual([null, "Classics"]);
  });
});

describe("overlay hygiene on room transitions", () => {
  const v = (phase: string, over: boolean | null): TvRoomView => ({ room: { phase }, game: over === null ? null : { over, n: 1 } } as unknown as TvRoomView);
  it("closes dialogs on a phase change or when the outcome arrives, not on in-game updates", () => {
    expect(roomTransition(v("HUB", null), v("SETUP", null))).toBe(true);
    expect(roomTransition(v("PLAYING", false), v("PLAYING", true))).toBe(true);
    expect(roomTransition(v("PLAYING", false), v("PLAYING", false))).toBe(false);
    expect(roomTransition(v("PLAYING", true), v("PLAYING", true))).toBe(false);
    expect(roomTransition(null, v("HUB", null))).toBe(false);
  });
});

describe("reaction burst drawings", () => {
  it("draws every shared burst with 3 boil tracings that differ but keep their commands", () => {
    for (const id of Object.values(REACTION_BURST)) {
      const key = id.slice(6);
      expect(BURST_ART[key], key).toBeDefined();
      const tr = burstTracings(key);
      expect(tr).toHaveLength(BOIL_TRACINGS);
      for (const [i, p] of BURST_ART[key]!.entries()) {
        expect(p.d).not.toMatch(/[Aa]/); // no arcs: a jittered arc flag would break the path
        const cmds = (d: string): string => d.replace(/[^MLCZmlcz]/g, "");
        expect(cmds(tr[1]![i]!.d)).toBe(cmds(p.d));
        expect(tr[1]![i]!.d).not.toBe(p.d);
        expect(tr[2]![i]!.d).not.toBe(tr[1]![i]!.d);
      }
    }
  });
  it("tracing 0 is the base drawing and tracings are deterministic", () => {
    expect(boilPath("M1 2L3 4Z", 0, 1)).toBe("M1 2L3 4Z");
    expect(boilPath("M1 2L3 4Z", 1, 5)).toBe(boilPath("M1 2L3 4Z", 1, 5));
  });
});
