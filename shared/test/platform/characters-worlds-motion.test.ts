// JAMAA-PLATFORM §3.7 characters, §3.4 worlds, §3.8 the choreography sampler and runner.
import { describe, expect, it } from "vitest";
import { COLORS } from "../../src/constants";
import { BODY_PATHS, CHARACTER_VIEWBOX, EXPRESSION_FEATURES, EXPRESSIONS, FACE_BOXES, FACE_SPACE, featureScale, REACTION_BURST, REACTION_EXPRESSION } from "../../src/characters";
import { CHOREO, EASINGS, endMs, sample, scaled, spring, springSettleMs, variant, PORTAL_REPEAT_SCALE } from "../../src/motion";
import type { Step } from "../../src/motion";
import { run } from "../../src/motion/runner";
import { REACTIONS } from "../../src/room/types";
import { WORLD_IDS, WORLD_PALETTES, WORLD_TOKENS, worldColor } from "../../src/worlds";
import { GAME_META } from "../../src/games/meta";

const nums = (d: string): number[] => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);

describe("characters (§3.7)", () => {
  it("every colour's shape has a body path in the 24-unit viewBox and a face box inside it", () => {
    expect(CHARACTER_VIEWBOX).toBe(24);
    expect(FACE_SPACE).toEqual({ w: 12, h: 9 });
    for (const c of COLORS) {
      const d = BODY_PATHS[c.shape];
      expect(d, c.shape).toMatch(/^M/);
      const b = FACE_BOXES[c.shape];
      expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= 24 && b.y + b.h <= 24, c.shape).toBe(true);
    }
  });
  it("13 expressions with features in the face space (absolute coordinates stay inside 12 × 9 with a small margin)", () => {
    expect(EXPRESSIONS).toHaveLength(13);
    for (const e of EXPRESSIONS) {
      const fs = EXPRESSION_FEATURES[e];
      expect(fs.length, e).toBeGreaterThan(0);
      expect(fs.some((f) => f.part === "eyes"), e).toBe(true);
      expect(fs.some((f) => f.part === "mouth"), e).toBe(true);
      for (const f of fs) {
        expect(f.d).toMatch(/^M/);
        if (f.style === "fill") expect(f.strokeWidth).toBeUndefined();
        for (const n of nums(f.d)) expect(Math.abs(n), `${e} ${f.d}`).toBeLessThanOrEqual(12);
      }
    }
  });
  it("REACTIONS ⊂ EXPRESSIONS: every reaction is its own expression and has a burst", () => {
    for (const r of REACTIONS) {
      expect(EXPRESSIONS).toContain(r);
      expect(REACTION_EXPRESSION[r]).toBe(r);
      expect(REACTION_BURST[r]).toMatch(/^burst\.[a-z]+$/);
    }
    expect(new Set(Object.values(REACTION_BURST)).size).toBe(REACTIONS.length);
  });
  it("the size floor: ×1.5 below 64, ×1.8 for the bolt and star faces", () => {
    expect(featureScale(72, "circle")).toBe(1);
    expect(featureScale(48, "circle")).toBe(1.5);
    expect(featureScale(48, "bolt")).toBe(1.8);
  });
});

// WCAG 2.x relative luminance contrast.
const lum = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

describe("worlds (§3.4)", () => {
  it("one palette per world, every game's world has one, #RRGGBB values, signal null only for night-market", () => {
    for (const id of Object.values(GAME_META).map((m) => m.rules.world)) expect(WORLD_IDS).toContain(id);
    for (const w of WORLD_IDS) {
      for (const t of WORLD_TOKENS) {
        for (const s of ["web", "native"] as const) {
          const v = worldColor(w, t, s);
          if (t === "signal" && w === "night-market") expect(v).toBeNull();
          else expect(v, `${w}.${t}.${s}`).toMatch(/^#[0-9A-F]{6}$/);
        }
      }
    }
    expect(Object.keys(WORLD_PALETTES)).toEqual([...WORLD_IDS]);
  });
  it("DESIGN §2.4 contrast: cream text on deep and surface ≥ 4.5, accentText on surface ≥ 4.5, onAccent on accent ≥ 4.5, accent on deep ≥ 3", () => {
    const CREAM = "#FFF7EC";
    for (const w of WORLD_IDS) {
      for (const s of ["web", "native"] as const) {
        const c = (t: (typeof WORLD_TOKENS)[number]) => worldColor(w, t, s) as string;
        expect(contrast(CREAM, c("deep")), `${w} ${s}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(CREAM, c("surface")), `${w} ${s}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(c("accentText"), c("surface")), `${w} ${s} accentText`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(c("onAccent"), c("accent")), `${w} ${s} onAccent`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(c("accent"), c("deep")), `${w} ${s} accent`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("choreography sampler (§3.8)", () => {
  const all = Object.entries(CHOREO).flatMap(([m, steps]) => (steps as readonly Step[]).map((s) => [m, s] as const));
  it("0 at the start, exactly 1 at the end, bounded in between, and monotone for decel/standard/accel/door", () => {
    for (const [m, s] of all) {
      expect(sample(s, s.startMs), `${m}.${s.id}`).toBe(0);
      expect(sample(s, s.startMs + s.durationMs), `${m}.${s.id}`).toBe(1);
      for (let f = 0.05; f < 1; f += 0.05) {
        const p = sample(s, s.startMs + f * s.durationMs);
        expect(p).toBeGreaterThan(-0.2);
        expect(p).toBeLessThan(1.4);
      }
    }
    const mono = all.filter(([, s]) => ["ease.decel", "ease.standard", "ease.accel", "ease.door", "linear"].includes(s.easing));
    for (const [, s] of mono) {
      let prev = 0;
      for (let f = 0; f <= 1.0001; f += 0.02) {
        const p = sample(s, s.startMs + f * s.durationMs);
        expect(p).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = p;
      }
    }
  });
  it("springs run on real seconds; the snap to 1 at durationMs is small (durations ≈ settle times)", () => {
    expect(spring(0.55, 400, 1, 0)).toBe(0);
    expect(springSettleMs(EASINGS["spring.bouncy"])).toBeCloseTo(363.6, 0);
    for (const [m, s] of all.filter(([, x]) => EASINGS[x.easing].kind === "spring")) {
      const before = sample(s, s.startMs + s.durationMs - 0.001);
      expect(Math.abs(1 - before), `${m}.${s.id}`).toBeLessThan(0.08);
    }
  });
  it("stagger = staggerMs × index; endMs counts the staggered elements", () => {
    const s = CHOREO.points[0];
    expect(sample(s, 70 + 225, 1)).toBeCloseTo(sample(s, 225, 0), 12);
    expect(endMs(CHOREO.points, 24)).toBe(23 * 70 + 450); // the 24th coin lands after the counter of the first
  });
  it("the binding totals: portal 1 100 ms (700 ms repeat), back 600 ms, entrance ≤ 2 000 ms with 12 characters", () => {
    expect(endMs(CHOREO.portal, 3)).toBe(1100);
    expect(Math.round(endMs(scaled(CHOREO.portal, PORTAL_REPEAT_SCALE), 3))).toBe(704);
    expect(endMs(CHOREO.portalBack)).toBe(600);
    expect(endMs(CHOREO.entrance, 12)).toBeLessThanOrEqual(2000);
    expect(endMs(CHOREO.entrance, 3)).toBe(2000);
  });
  it("variants: reduced → the 150 ms crossfade (or nothing), lite drops 'drop' steps", () => {
    expect(variant(CHOREO.portal, { reduced: true })).toEqual([...CHOREO.crossfade]);
    expect(variant(CHOREO.hop, { reduced: true })).toEqual([]);
    expect(variant(CHOREO.entrance, { reduced: false, lite: true })).toEqual([...CHOREO.entrance]);
  });
  it("the runner samples frames, and complete() jumps to the end state once", () => {
    const queue: ((t: number) => void)[] = [];
    const clock = { request: (cb: (t: number) => void) => queue.push(cb), cancel: () => undefined };
    const seen: number[] = [];
    let done = 0;
    const r = run(CHOREO.reorder, (p) => void seen.push(p("reorder")), () => void done++, 1, clock);
    queue.shift()?.(1000);
    queue.shift()?.(1200);
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBeGreaterThan(0);
    expect(r.running).toBe(true);
    r.complete();
    r.complete();
    expect(seen.at(-1)).toBe(1);
    expect(done).toBe(1);
    expect(r.running).toBe(false);
  });
});
