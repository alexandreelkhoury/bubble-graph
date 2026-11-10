// A JAMAA character as a sprite on the baked atlas: 3 boil tracings cycled on the 8 fps drawing clock (ART-DIRECTION
// §10.3), squash/stretch applied on 12 fps steps (volume kept: x = 1/√s), breathing on the UI clock while it waits.
import { Container, Sprite } from "pixi.js";
import type { Texture } from "pixi.js";
import type { CharMeta } from "./assets";

export type Expr = "idle" | "happy" | "smug" | "laugh" | "shock" | "cheer" | "sad" | "busted";

export interface ActorOpts { color: string; meta: CharMeta; tex: (n: string) => Texture; bodyPx: number; seed: number }

export class Actor {
  readonly root = new Container();
  private readonly sprite: Sprite;
  private expr: Expr = "idle";
  private exprUntil = 0;
  private exprAfter: Expr = "idle";
  /** Stepped squash (set by choreography on drawing-clock steps). 1 = rest, < 1 squashed, > 1 stretched. */
  squash = 1;
  /** Extra uniform scale (author pop-out is bigger). */
  size = 1;
  private readonly base: number;
  private readonly phase: number;
  private names = new Map<string, Texture>();
  private now = 0;

  constructor(private readonly o: ActorOpts) {
    this.sprite = new Sprite(o.tex(`${o.color}/idle/0`));
    this.sprite.anchor.set(o.meta.anchorX, o.meta.anchorY);
    this.base = o.bodyPx / (24 * o.meta.unitPx); // body is 24 units tall
    this.phase = (o.seed * 977) % 1000;
    this.root.addChild(this.sprite);
  }

  get color(): string { return this.o.color; }
  get expression(): Expr { return this.expr; }

  /** Switch expression now; with holdMs, fall back to `after` once the hold ends. */
  setExpr(e: Expr, holdMs = 0, after: Expr = "idle"): void {
    this.expr = e;
    this.exprUntil = holdMs > 0 ? this.now + holdMs : 0;
    this.exprAfter = after;
  }

  /** Top of the head, in the root's parent space (for bursts and coin origins). */
  head(): { x: number; y: number } {
    return { x: this.root.x, y: this.root.y - this.o.bodyPx * this.size * this.squash * 1.05 };
  }

  update(nowMs: number, boil: boolean): void {
    this.now = nowMs;
    if (this.exprUntil && nowMs >= this.exprUntil) {
      this.exprUntil = 0;
      this.expr = this.exprAfter;
    }
    const busted = this.expr === "busted";
    const fps = busted ? 12 : 8;
    const n = busted ? 2 : 3;
    const v = boil ? Math.floor((nowMs + this.phase) / (1000 / fps)) % n : 0;
    const key = `${this.o.color}/${this.expr}/${v}`;
    let t = this.names.get(key);
    if (!t) {
      t = this.o.tex(key);
      this.names.set(key, t);
    }
    if (this.sprite.texture !== t) this.sprite.texture = t;
    // breathing 1.00 ↔ 1.02 over 3.2 s when at rest (DESIGN-JAMAA: the held pose keeps living)
    const breathe = this.squash === 1 && boil ? 1 + 0.01 * (1 - Math.cos(((nowMs + this.phase * 3) / 3200) * Math.PI * 2)) : 1;
    const s = this.squash * breathe;
    const k = this.base * this.size;
    this.sprite.scale.set(k / Math.sqrt(s), k * s);
    // laugh shakes on 12 fps steps, not smoothly (ART-DIRECTION §8.3)
    this.sprite.x = this.expr === "laugh" && boil ? (Math.floor(nowMs / 83) % 2 ? 1.2 : -1.2) : busted ? (Math.floor(nowMs / 83) % 2 ? 1.5 : -1.5) : 0;
  }
}
