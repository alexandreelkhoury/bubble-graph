// Shared Pixi helpers for the TV: canvas text (Cairo, 960 × 540 design units drawn at 2×), colours, a character sprite
// that swaps expression, the fps overlay.
import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { TextStyleOptions } from "pixi.js";
import type { ColorId } from "@jamaa/shared/constants";
import type { Expression } from "@jamaa/shared/characters";
import { qrMatrix } from "../tv-mock/Qr";
import { CHAR_ASPECT, charTexture } from "./art";

/** Design size (dp); the canvas backs it at 2× (1920 × 1080). */
export const W = 960;
export const H = 540;
export const SCALE = 2;
export const FONT = "Cairo, 'Noto Sans Arabic', system-ui, sans-serif";
export const hex = (s: string): number => parseInt(s.replace("#", ""), 16);
export const CREAM = 0xfff7ec;
export const INK = 0x120a1f;
export const GOLD = 0xffc94d;

export interface TxtOpts { weight?: "400" | "600" | "700" | "900"; fill?: number | string; align?: "left" | "center" | "right"; anchorX?: number; anchorY?: number; wrap?: number; stroke?: number; maxW?: number; lineHeight?: number }

/** A canvas Text (not BitmapText: Arabic shaping, any glyph). `maxW` shrinks one line to fit; `wrap` word-wraps. */
export function txt(s: string, size: number, o: TxtOpts = {}): Text {
  const style: TextStyleOptions = {
    fontFamily: FONT, fontSize: size, fontWeight: o.weight ?? "700", fill: o.fill ?? CREAM, align: o.align ?? "center",
    ...(o.wrap ? { wordWrap: true, wordWrapWidth: o.wrap, breakWords: false } : {}),
    ...(o.lineHeight ? { lineHeight: o.lineHeight } : {}),
    ...(o.stroke === undefined ? {} : { stroke: { color: o.stroke, width: Math.max(2, size / 8), join: "round" } }),
  };
  const t = new Text({ text: s, style, resolution: SCALE });
  t.anchor.set(o.anchorX ?? 0.5, o.anchorY ?? 0.5);
  fitText(t, o.maxW);
  return t;
}

export function setText(t: Text, s: string, maxW?: number): void {
  if (t.text !== s) { t.scale.set(1); t.text = s; }
  fitText(t, maxW);
}

function fitText(t: Text, maxW?: number): void {
  if (maxW && t.width > maxW) t.scale.set(t.scale.x * (maxW / t.width));
}

/** A character by its feet; `size` is the DOM box (dp), so it lines up with the shared layouts. */
export class Char extends Container {
  private readonly spr = new Sprite();
  private colorId: ColorId;
  private expr: Expression;
  private boxSize: number;
  constructor(color: ColorId, size: number, expression: Expression = "idle") {
    super();
    this.colorId = color; this.expr = expression; this.boxSize = size;
    this.spr.anchor.set(0.5, 1);
    this.addChild(this.spr);
    this.refresh();
  }
  private refresh(): void {
    const mine = this.expr;
    this.spr.texture = charTexture(this.colorId, mine, (t) => { if (!this.destroyed && this.expr === mine) { this.spr.texture = t; this.fit(); } });
    this.fit();
  }
  private fit(): void {
    this.spr.width = this.boxSize * CHAR_ASPECT;
    this.spr.height = this.boxSize;
  }
  set expression(e: Expression) { if (e !== this.expr) { this.expr = e; this.refresh(); } }
  get expression(): Expression { return this.expr; }
}

/** fps overlay: average fps and worst frame over the last half second; also a `[pixi-tv]` console line every 5 s (logcat). */
export class FpsOverlay extends Container {
  private readonly bg = new Graphics().roundRect(0, 0, 230, 52, 8).fill({ color: 0x000000, alpha: 0.72 });
  private readonly l1 = txt("", 15, { weight: "700", anchorX: 0, anchorY: 0, align: "left", fill: 0x3ddc97 });
  private readonly l2 = txt("", 12, { weight: "400", anchorX: 0, anchorY: 0, align: "left", fill: 0xc9bfff });
  private frames = 0; private acc = 0; private worst = 0; private since5 = 0; private f5 = 0;
  info = "";
  constructor() {
    super();
    this.addChild(this.bg, this.l1, this.l2);
    this.l1.position.set(10, 6); this.l2.position.set(10, 30);
    this.position.set(10, 10);
    this.visible = false;
  }
  frame(dtMs: number): void {
    this.frames++; this.acc += dtMs; this.worst = Math.max(this.worst, dtMs);
    this.since5 += dtMs; this.f5++;
    if (this.acc >= 500) {
      const fps = (this.frames * 1000) / this.acc;
      if (this.visible) {
        this.l1.text = `${fps.toFixed(1)} fps  ${(this.acc / this.frames).toFixed(1)} ms`;
        this.l1.style.fill = fps >= 55 ? 0x3ddc97 : fps >= 30 ? GOLD : 0xff5a5f;
        this.l2.text = `worst ${this.worst.toFixed(0)} ms  ${this.info}`;
      }
      this.frames = 0; this.acc = 0; this.worst = 0;
    }
    if (this.since5 >= 5000) {
      console.info(`[pixi-tv] fps ${((this.f5 * 1000) / this.since5).toFixed(1)} ${this.info}`);
      this.since5 = 0; this.f5 = 0;
    }
  }
}

/** The join QR (same matrix, quiet zone and module snapping as the DOM mock; one batched Graphics) on a cream panel. */
export function qrPanel(url: string, panel: number): Graphics {
  const qm = qrMatrix(url);
  const mod = Math.max(1, Math.floor((panel * SCALE) / (qm.size + 8))) / SCALE;
  const off = (panel - mod * qm.size) / 2;
  const g = new Graphics().roundRect(0, 0, panel, panel, 8).fill(CREAM);
  for (let r = 0; r < qm.size; r++) for (let c = 0; c < qm.size; c++) if (qm.dark(r, c)) g.rect(off + c * mod, off + r * mod, mod, mod);
  return g.fill(INK);
}

/** A gold rosette (the award mark): 12 petals, ink ring. Centred on 0,0. */
export function rosette(r: number): Graphics {
  const g = new Graphics();
  const pts: number[] = [];
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.8 : r; pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.poly(pts).fill(GOLD).stroke({ width: Math.max(1, r / 14), color: INK });
  g.circle(0, 0, r * 0.5).fill(0xffe7a0).stroke({ width: Math.max(1, r / 18), color: INK });
  g.poly([0, -r * 0.3, r * 0.1, -r * 0.08, r * 0.32, -r * 0.08, r * 0.14, r * 0.07, r * 0.2, r * 0.3, 0, r * 0.15, -r * 0.2, r * 0.3, -r * 0.14, r * 0.07, -r * 0.32, -r * 0.08, -r * 0.1, -r * 0.08]).fill(INK);
  return g;
}
