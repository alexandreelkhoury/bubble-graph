// Small hand-drawn helpers on Pixi Graphics: wobbly rounded rects (same wonk every run: seeded), riso double-print
// lettering, the rubber stamp. Everything here batches with the sprites (Graphics + BitmapText share the batcher).
import { BitmapText, Container, Graphics } from "pixi.js";
import { FONT_BODY, FONT_DISPLAY } from "./assets";

export const INK = 0x160b26;
export const PAPER = 0xfff1dc;
export const CREAM = 0xfff7ec;
export const HUB = { deep: 0x1d1036, top: 0x2b1650, surface: 0x3a2266, elevated: 0x4a2e7a, glow: 0xffc94d };
// Bluff = hakawati-cafe (shared/src/worlds): accent amber, signal red.
export const BLUFF = { accent: 0xe9a23b, glow: 0xffe3a3, signal: 0xff5a5f, deep: 0x1c1209, lie: 0xd6333a, truth: 0x2f7d55, gold: 0xffc94d };

export function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rounded rect centred on 0,0 with a low-frequency closed wobble (the drawn edge). Flat [x0,y0,x1,y1…]. */
export function handRect(w: number, h: number, r: number, seed: number, amp = 1.1): number[] {
  const rand = rng(seed);
  const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
  const pts: number[] = [];
  const hw = w / 2 - r, hh = h / 2 - r;
  const corners: [number, number, number][] = [[hw, hh, 0], [-hw, hh, Math.PI / 2], [-hw, -hh, Math.PI], [hw, -hh, (3 * Math.PI) / 2]];
  // walk the outline: each corner arc then the straight edge to the next corner
  const raw: [number, number][] = [];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      raw.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    // straight edge samples are added implicitly by the next corner; add midpoints for wobble room
  }
  const dense: [number, number][] = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]!, b = raw[(i + 1) % raw.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / 14));
    for (let k = 0; k < n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const N = dense.length;
  dense.forEach(([x, y], i) => {
    const u = i / N;
    const d = amp * (0.55 * Math.sin(2 * Math.PI * 2 * u + ph[0]!) + 0.3 * Math.sin(2 * Math.PI * 3 * u + ph[1]!) + 0.15 * Math.sin(2 * Math.PI * 5 * u + ph[2]!));
    const l = Math.hypot(x, y) || 1;
    pts.push(x + (x / l) * d, y + (y / l) * d);
  });
  return pts;
}

/** A printed panel: ink drop shadow, flat fill offset off its line (riso misregistration), brush-ish ink line. */
export function panel(g: Graphics, w: number, h: number, r: number, seed: number, fill: number, o: { line?: number; shadow?: number; ink?: number; mis?: number } = {}): Graphics {
  const ink = o.ink ?? INK;
  const pts = handRect(w, h, r, seed);
  const mis = o.mis ?? 1.4;
  if (o.shadow !== 0) g.poly(pts.map((v, i) => v + (i % 2 ? 5 : 3)), true).fill({ color: ink, alpha: o.shadow ?? 0.45 });
  g.poly(pts.map((v, i) => v + (i % 2 ? mis * 0.8 : mis)), true).fill({ color: fill });
  if ((o.line ?? 3) > 0) g.poly(pts, true).stroke({ width: o.line ?? 3, color: ink, join: "round", alignment: 0.5 });
  return g;
}

export function text(t: string, size: number, color: number, o: { display?: boolean; anchorX?: number; anchorY?: number; align?: "left" | "center" | "right"; wrap?: number } = {}): BitmapText {
  const bt = new BitmapText({
    text: t,
    style: { fontFamily: o.display ? FONT_DISPLAY : FONT_BODY, fontSize: size, align: o.align ?? "center", ...(o.wrap ? { wordWrap: true, wordWrapWidth: o.wrap } : {}) },
  });
  bt.tint = color;
  bt.anchor.set(o.anchorX ?? 0.5, o.anchorY ?? 0.5);
  return bt;
}

/** Display word printed twice: an ink pass offset down-right, then the colour pass (lettering stand-in, ART-DIRECTION §7). */
export function inkWord(t: string, size: number, color: number, ink = INK): Container {
  const c = new Container();
  const back = text(t, size, ink, { display: true });
  back.position.set(size * 0.05, size * 0.07);
  c.addChild(back, text(t, size, color, { display: true }));
  return c;
}

/** Rubber stamp: double ink ring + lettering, uneven coverage faked with a few paper-coloured gaps. */
export function stamp(word: string, color: number, seed: number, w = 168, h = 66): Container {
  const c = new Container();
  const g = new Graphics();
  const outer = handRect(w, h, 12, seed, 1.6);
  const inner = handRect(w - 14, h - 14, 8, seed + 1, 1.2);
  g.poly(outer, true).fill({ color: PAPER, alpha: 0.16 });
  g.poly(outer, true).stroke({ width: 5, color, join: "round" });
  g.poly(inner, true).stroke({ width: 2, color, join: "round" });
  c.addChild(g);
  const t = text(word, h * 0.62, color, { display: true });
  t.position.set(0, -1);
  c.addChild(t);
  // ink gaps: short paper ticks across the print
  const gaps = new Graphics();
  const r = rng(seed + 9);
  for (let i = 0; i < 7; i++) {
    const x = (r() - 0.5) * w * 0.85, y = (r() - 0.5) * h * 0.7, l = 6 + r() * 14;
    gaps.moveTo(x, y).lineTo(x + l, y + (r() - 0.5) * 3);
  }
  gaps.stroke({ width: 2.2, color: PAPER, alpha: 0.55, cap: "round" });
  c.addChild(gaps);
  c.rotation = (-8 * Math.PI) / 180;
  return c;
}
