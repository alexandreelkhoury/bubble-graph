// Effects: reaction bursts (3 boil tracings), cut-paper confetti in a ParticleContainer (one draw call for hundreds of
// pieces), and the camera shake.
import { Container, Particle, ParticleContainer, Sprite } from "pixi.js";
import type { Texture } from "pixi.js";
import { ease } from "./timeline";

export type BurstKind = "exclaim" | "sweat" | "tears" | "raincloud" | "heart" | "confetti";

interface LiveBurst { s: Sprite; kind: BurstKind; born: number; life: number; size: number }

export class Bursts {
  readonly layer = new Container();
  private live: LiveBurst[] = [];
  constructor(private readonly tex: (n: string) => Texture) {}

  spawn(kind: BurstKind, x: number, y: number, now: number, size = 44, life = 1500): void {
    const s = new Sprite(this.tex(`burst/${kind}/0`));
    s.anchor.set(0.5, 0.8);
    s.position.set(x, y);
    this.layer.addChild(s);
    this.live.push({ s, kind, born: now, life, size });
  }

  update(now: number, boil: boolean): void {
    this.live = this.live.filter((b) => {
      const age = now - b.born;
      if (age > b.life) {
        b.s.destroy();
        return false;
      }
      const v = boil ? Math.floor(age / 125) % 3 : 0;
      b.s.texture = this.tex(`burst/${b.kind}/${v}`);
      const pop = ease("spring.hop", Math.min(1, age / 300), 300);
      const k = (b.size / 120) * Math.max(0.01, pop);
      b.s.scale.set(k);
      b.s.alpha = age > b.life - 200 ? (b.life - age) / 200 : 1;
      return true;
    });
  }

  clear(): void {
    for (const b of this.live) b.s.destroy();
    this.live = [];
  }
}

const SHAPES = ["circle", "square", "star", "triangle", "crescent", "drop", "diamond", "plus"];

interface Piece { p: Particle; vx: number; vy: number; spin: number; flip: number; flipV: number; size: number; age: number; life: number }

/** Cut-paper confetti (ART-DIRECTION §9.6): the players' colours and shapes, paper flutter, rotation on 12 fps steps. */
export class Confetti {
  readonly layer: ParticleContainer;
  private pieces: Piece[] = [];
  private readonly textures: Texture[];
  private t = 0;

  constructor(tex: (n: string) => Texture, private readonly max = 600) {
    this.textures = SHAPES.map((s) => tex(`confetti/${s}`));
    this.layer = new ParticleContainer({
      texture: this.textures[0],
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true, uvs: false },
    });
  }

  get count(): number { return this.pieces.length; }

  /** A burst from (x, y): `n` pieces fanned around `angle` (radians, 0 = right, -π/2 = up). */
  burst(x: number, y: number, n: number, colors: number[], o: { angle?: number; spread?: number; speed?: number; size?: number } = {}): void {
    const angle = o.angle ?? -Math.PI / 2, spread = o.spread ?? 1.1, speed = o.speed ?? 420, size = o.size ?? 9;
    for (let i = 0; i < n && this.pieces.length < this.max; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * (0.55 + Math.random() * 0.6);
      this.add(x, y, Math.cos(a) * v, Math.sin(a) * v, colors[i % colors.length]!, size * (0.6 + Math.random() * 0.7));
    }
  }

  /** Rain from above the screen across `width`. */
  rain(width: number, n: number, colors: number[], size = 9): void {
    for (let i = 0; i < n && this.pieces.length < this.max; i++) {
      this.add(Math.random() * width, -20 - Math.random() * 400, (Math.random() - 0.5) * 60, 40 + Math.random() * 80, colors[i % colors.length]!, size * (0.6 + Math.random() * 0.8));
    }
  }

  private add(x: number, y: number, vx: number, vy: number, tint: number, size: number): void {
    const texture = this.textures[Math.floor(Math.random() * this.textures.length)]!;
    const p = new Particle({ texture, x, y, anchorX: 0.5, anchorY: 0.5, tint, rotation: Math.random() * 6.28 });
    const sc = size / 110; // the cut piece fills ~90 % of its 120 px cell
    p.scaleX = sc;
    p.scaleY = sc;
    this.layer.addParticle(p);
    this.pieces.push({ p, vx, vy, spin: (Math.random() - 0.5) * 9, flip: Math.random() * 6.28, flipV: 6 + Math.random() * 8, size: sc, age: 0, life: 3200 + Math.random() * 1600 });
  }

  update(dtMs: number, floorY: number): void {
    const dt = Math.min(dtMs, 50) / 1000;
    this.t += dtMs;
    const step = Math.floor(this.t / 83) !== Math.floor((this.t - dtMs) / 83); // 12 fps drawing clock
    let removed = false;
    for (const q of this.pieces) {
      q.age += dtMs;
      q.vy += 520 * dt; // gravity
      q.vx *= 1 - 1.6 * dt; // paper drag
      q.vy *= 1 - 1.9 * dt;
      q.flip += q.flipV * dt;
      q.p.x += (q.vx + Math.sin(q.flip * 0.5) * 30) * dt;
      q.p.y += q.vy * dt;
      if (step) q.p.rotation += q.spin * 0.083;
      q.p.scaleX = q.size * Math.cos(q.flip); // paper flutter: the piece turns over
      if (q.age > q.life - 400) q.p.alpha = Math.max(0, (q.life - q.age) / 400);
      if (q.age > q.life || q.p.y > floorY + 60) removed = true;
    }
    if (removed) {
      const keep: Piece[] = [];
      for (const q of this.pieces) {
        if (q.age > q.life || q.p.y > floorY + 60) this.layer.removeParticle(q.p);
        else keep.push(q);
      }
      this.pieces = keep;
    }
  }

  clear(): void {
    this.layer.removeParticles();
    this.pieces = [];
  }
}

/** Screen shake: decaying, random direction per 1/30 s (reads as a thump, not a vibration). */
export class Shake {
  x = 0;
  y = 0;
  private amp = 0;
  private until = 0;
  private dur = 1;
  private nextAt = 0;
  start(amp: number, durMs: number, now: number): void {
    this.amp = amp;
    this.dur = durMs;
    this.until = now + durMs;
  }
  update(now: number): void {
    if (now >= this.until) {
      this.x = this.y = 0;
      return;
    }
    if (now >= this.nextAt) {
      const k = this.amp * ((this.until - now) / this.dur);
      this.x = (Math.random() - 0.5) * 2 * k;
      this.y = (Math.random() - 0.5) * 2 * k;
      this.nextAt = now + 33;
    }
  }
}
