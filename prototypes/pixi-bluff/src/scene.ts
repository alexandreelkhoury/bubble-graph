// The Bluff! REVEAL moment (GAME-BLUFF §12.2) on fake local data: intro, each picked lie (spotlight, voters jump on,
// drumroll, LIE! stamp, the liar pops out "busted", coins fly into the liar's pill), the truth (camera push-in, gold,
// light sweep, TRUTH stamp, finders cheer, confetti), "Nobody bought it", and the finale. OK completes the running
// step or starts the next one.
import { Container, Graphics, Sprite } from "pixi.js";
import type { BitmapText, Texture } from "pixi.js";
import { Actor } from "./actor";
import type { Expr } from "./actor";
import type { Loaded } from "./assets";
import { FOOL_POINTS, NOTE, OPTIONS, PLAYERS, PROMPT, TRUTH_POINTS, revealOrder, unpicked } from "./data";
import type { Option, Player } from "./data";
import { BLUFF, CREAM, HUB, INK, PAPER, inkWord, panel, stamp, text } from "./draw";
import { Bursts, Confetti, Shake } from "./fx";
import type { BurstKind } from "./fx";
import { Timeline, lerp, qbez } from "./timeline";

export const W = 960;
export const H = 540;
const CARD_W = 200, CARD_H = 60;
const SLOTS = [[150, 132], [370, 132], [590, 132], [810, 132], [260, 206], [480, 206], [700, 206]] as const;
const ROW_Y = 466, ROW_X0 = 130, ROW_DX = 140, BODY = 54;
const SPOT = { x: 480, y: 300, k: 1.5 };
const Z = { card: 10, row: 20, pill: 22, dim: 50, cone: 52, author: 56, spot: 60, pillUp: 65, actorUp: 70, word: 90, fx: 92 };

interface Pt { x: number; y: number }

class CardView {
  readonly root = new Container();
  private readonly gold: Graphics;
  readonly label: BitmapText;
  stampView: Container | null = null;
  readonly slot: Pt;
  constructor(readonly opt: Option, i: number) {
    const s = SLOTS[i]!;
    this.slot = { x: s[0], y: s[1] };
    this.root.addChild(panel(new Graphics(), CARD_W, CARD_H, 10, 40 + i * 7, CREAM, { line: 2.6 }));
    this.gold = panel(new Graphics(), CARD_W, CARD_H, 10, 40 + i * 7, BLUFF.gold, { line: 2.6, shadow: 0 });
    this.gold.alpha = 0;
    this.root.addChild(this.gold);
    this.label = text(opt.text, 21, INK, { wrap: CARD_W - 24 });
    this.root.addChild(this.label);
    this.root.position.set(this.slot.x, this.slot.y);
    this.root.zIndex = Z.card;
  }
  set goldness(v: number) { this.gold.alpha = v; }
  addStamp(word: string, color: number, seed: number): Container {
    const s = stamp(word, color, seed, word.length > 5 ? 138 : 104, 46);
    // on the card's end, half off the paper; the answer slides toward the start to make room (stays readable)
    s.position.set(CARD_W / 2 - 4, 3);
    this.root.addChild(s);
    this.stampView = s;
    return s;
  }
}

class Pill {
  readonly root = new Container();
  private readonly scoreText: BitmapText;
  private shown: number;
  private target: number;
  private speed = 0;
  private pop = 0;
  constructor(readonly player: Player, x: number) {
    const g = panel(new Graphics(), 118, 30, 12, player.name.length * 13, HUB.elevated, { line: 2, shadow: 0.35 });
    // the player's colour as a printed tab on the pill's start edge
    g.circle(-46, 0, 6).fill({ color: player.hex }).circle(-46, 0, 6).stroke({ width: 1.6, color: INK });
    this.root.addChild(g);
    const name = text(player.name, 14, PAPER, { anchorX: 0, align: "left" });
    name.position.set(-36, -1);
    this.scoreText = text(String(player.score), 17, HUB.glow, { display: true, anchorX: 1, align: "right" });
    this.scoreText.position.set(52, -2);
    this.root.addChild(name, this.scoreText);
    this.root.position.set(x, ROW_Y + 30);
    this.root.zIndex = Z.pill;
    this.shown = this.target = player.score;
  }
  add(v: number): void {
    this.target += v;
    this.speed = Math.max(this.speed, (this.target - this.shown) / 0.45);
    this.pop = 1;
  }
  settle(): void {
    this.shown = this.target;
    this.scoreText.text = String(this.target);
  }
  get value(): number { return this.target; }
  update(dtMs: number): void {
    if (this.shown < this.target) {
      this.shown = Math.min(this.target, this.shown + (this.speed * dtMs) / 1000);
      this.scoreText.text = String(Math.round(this.shown));
    } else this.speed = 0;
    this.pop = Math.max(0, this.pop - dtMs / 260);
    this.root.scale.set(1 + 0.16 * Math.sin(this.pop * Math.PI));
  }
}

interface Coin { root: Container; done: boolean }

export interface SceneOpts { loaded: Loaded; boil: () => boolean; onRunEnd: () => string; autoplay: boolean; holdMs: number }

export class RevealScene {
  readonly root = new Container(); // camera space
  readonly hud = new Container(); // screen space
  private readonly stage = new Container({ sortableChildren: true });
  private readonly dim = new Graphics();
  private readonly cone: Sprite;
  private readonly sweep: Sprite;
  private readonly glow: Sprite;
  private readonly bursts: Bursts;
  readonly confetti: Confetti;
  private readonly shake = new Shake();
  private readonly cam = { x: W / 2, y: H / 2, z: 1 };
  private readonly actors = new Map<string, Actor>();
  private readonly pills = new Map<string, Pill>();
  private readonly cards: CardView[] = [];
  private readonly home = new Map<string, Pt>();
  private readonly hint: Container;
  private readonly hintText: ReturnType<typeof text>;
  private readonly stepText: ReturnType<typeof text>;
  private readonly tex: (n: string) => Texture;
  private coins: Coin[] = [];
  private words: Container[] = [];
  private tl: Timeline | null = null;
  private step = -1;
  private readonly steps: (() => Timeline)[];
  private waitSince = 0;
  now = 0;
  finished = false;
  private summary: Container | null = null;

  constructor(private readonly o: SceneOpts) {
    this.tex = o.loaded.tex;
    const room = new Sprite(o.loaded.room);
    room.width = W;
    room.height = H;
    this.root.addChild(room);
    // the room is dimmed under the UI (hub mock: "The room is dimmed under the UI"), warmer toward the Bluff world
    const scrim = new Graphics().rect(-200, -200, W + 400, H + 400).fill({ color: HUB.deep, alpha: 0.42 });
    scrim.rect(-200, -200, W + 400, H + 400).fill({ color: BLUFF.deep, alpha: 0.12 });
    this.root.addChild(scrim, this.stage);

    this.dim.rect(-400, -400, W + 800, H + 800).fill({ color: 0x0d0718 });
    this.dim.alpha = 0;
    this.dim.zIndex = Z.dim;
    this.cone = new Sprite(this.tex("light/cone"));
    this.cone.anchor.set(0.5, 0);
    this.cone.tint = BLUFF.glow;
    this.cone.alpha = 0;
    this.cone.zIndex = Z.cone;
    this.glow = new Sprite(this.tex("light/glow"));
    this.glow.anchor.set(0.5);
    this.glow.tint = BLUFF.glow;
    this.glow.alpha = 0;
    this.glow.zIndex = Z.cone;
    this.glow.position.set(SPOT.x, SPOT.y);
    this.glow.scale.set(560 / 120, 260 / 120);
    this.sweep = new Sprite(this.tex("light/sweep"));
    this.sweep.anchor.set(0.5);
    this.sweep.alpha = 0;
    this.sweep.zIndex = Z.spot + 1;
    this.bursts = new Bursts(this.tex);
    this.bursts.layer.zIndex = Z.fx;
    this.stage.addChild(this.dim, this.cone, this.glow, this.sweep, this.bursts.layer);
    this.confetti = new Confetti(this.tex);
    this.root.addChild(this.confetti.layer);

    // prompt card
    const prompt = new Container();
    prompt.addChild(panel(new Graphics(), 720, 62, 14, 9, HUB.elevated, { line: 3 }));
    const tag = text("BLUFF!", 15, BLUFF.accent, { display: true, anchorX: 0, align: "left" });
    tag.position.set(-340, -14);
    const round = text("Round 1", 12, PAPER, { anchorX: 0, align: "left" });
    round.position.set(-340, 8);
    const q = text(PROMPT, 26, PAPER, { display: true });
    q.position.set(30, -2);
    prompt.addChild(tag, round, q);
    prompt.position.set(W / 2, 50);
    prompt.zIndex = Z.card;
    prompt.label = "prompt";
    this.stage.addChild(prompt);

    OPTIONS.forEach((op, i) => {
      const c = new CardView(op, i);
      this.cards.push(c);
      this.stage.addChild(c.root);
    });
    PLAYERS.forEach((p, i) => {
      const a = new Actor({ color: p.color, meta: o.loaded.char, tex: this.tex, bodyPx: BODY, seed: i + 1 });
      const x = ROW_X0 + i * ROW_DX;
      a.root.position.set(x, ROW_Y);
      a.root.zIndex = Z.row;
      this.home.set(p.id, { x, y: ROW_Y });
      this.actors.set(p.id, a);
      this.stage.addChild(a.root);
      const pill = new Pill(p, x);
      this.pills.set(p.id, pill);
      this.stage.addChild(pill.root);
    });

    // HUD: step label + OK hint
    this.stepText = text("", 13, PAPER, { anchorX: 1, anchorY: 0, align: "right" });
    this.stepText.position.set(W - 12, 6);
    this.stepText.alpha = 0.75;
    this.hint = new Container();
    this.hint.addChild(panel(new Graphics(), 150, 28, 12, 3, HUB.surface, { line: 2, shadow: 0.3 }));
    this.hintText = text("OK  next", 14, PAPER);
    this.hint.addChild(this.hintText);
    this.hint.position.set(W - 90, H - 22);
    this.hud.addChild(this.stepText, this.hint);

    const order = revealOrder();
    this.steps = [() => this.intro(), ...order.map((op) => () => (op.truth ? this.truth(op) : this.lie(op))), () => this.montage(), () => this.finale()];
  }

  private card(op: Option): CardView { return this.cards.find((c) => c.opt === op)!; }
  private actor(id: string): Actor { return this.actors.get(id)!; }
  private pill(id: string): Pill { return this.pills.get(id)!; }

  // ------------------------------------------------------------------ control
  get stepLabel(): string { return `${Math.max(0, this.step) + 1}/${this.steps.length}`; }
  get busy(): boolean { return !!this.tl && !this.tl.done; }

  start(): void { this.next(); }

  /** OK: complete the running step, else start the next one. */
  ok(): void {
    if (this.tl && !this.tl.done) {
      this.tl.finish();
      return;
    }
    this.next();
  }

  private next(): void {
    if (this.step + 1 >= this.steps.length) return;
    this.step++;
    this.tl = this.steps[this.step]!();
    this.stepText.text = ["Intro", "Reveal 1", "Reveal 2", "The truth", "Nobody bought it", "Finale"][this.step] ?? "";
  }

  update(dtMs: number): void {
    this.now += dtMs;
    const boil = this.o.boil();
    if (this.tl) {
      const wasDone = this.tl.done;
      this.tl.update(dtMs);
      if (!wasDone && this.tl.done) this.waitSince = this.now;
    }
    for (const a of this.actors.values()) a.update(this.now, boil);
    for (const p of this.pills.values()) p.update(dtMs);
    this.bursts.update(this.now, boil);
    this.confetti.update(dtMs, H);
    this.shake.update(this.now);
    this.root.pivot.set(this.cam.x, this.cam.y);
    this.root.scale.set(this.cam.z);
    this.root.position.set(W / 2 + this.shake.x, H / 2 + this.shake.y);
    const waiting = !!this.tl && this.tl.done;
    const last = this.step === this.steps.length - 1;
    if (waiting && last && !this.finished) {
      this.finished = true;
      this.showSummary(this.o.onRunEnd());
    }
    this.hint.visible = waiting;
    this.hintText.text = last ? "BACK  replay" : "OK  next";
    this.hint.alpha = 0.65 + 0.35 * Math.cos(((this.now - this.waitSince) / 900) * Math.PI);
    if (waiting && this.o.autoplay && !last && this.now - this.waitSince > this.o.holdMs) this.next();
  }

  destroy(): void {
    this.bursts.clear();
    this.confetti.clear();
    this.root.destroy({ children: true });
    this.hud.destroy({ children: true });
  }

  // ------------------------------------------------------------------ helpers
  /** A hop along an arc: 1-step anticipation (0.94), stretch in the air, land 0.88 → 1.03 → 1 on 12 fps steps. */
  private hop(tl: Timeline, a: Actor, t0: number, to: Pt | (() => Pt), o: { dur?: number; height?: number; size?: number; z?: number } = {}): number {
    const dur = o.dur ?? 440, height = o.height ?? 70;
    let from: Pt = { x: 0, y: 0 }, dest: Pt = { x: 0, y: 0 }, s0 = 1;
    tl.at(t0, () => {
      from = { x: a.root.x, y: a.root.y };
      dest = typeof to === "function" ? to() : to;
      s0 = a.size;
      a.squash = 0.94;
      if (o.z !== undefined) a.root.zIndex = o.z;
    });
    tl.at(t0 + 83, () => (a.squash = 1.08));
    tl.tween(t0 + 83, dur, (v) => {
      a.root.x = lerp(from.x, dest.x, v);
      a.root.y = qbez(from.y, Math.min(from.y, dest.y) - height, dest.y, v);
      if (o.size !== undefined) a.size = lerp(s0, o.size, v);
    }, "ease.standard");
    const land = t0 + 83 + dur;
    tl.at(land, () => (a.squash = 0.88));
    tl.at(land + 83, () => (a.squash = 1.03));
    tl.at(land + 166, () => (a.squash = 1));
    return land + 166;
  }

  private burst(kind: BurstKind, a: Actor, size = 40, life = 1500): void {
    const h = a.head();
    this.bursts.spawn(kind, h.x + 18, h.y + 4, this.now, size, life);
  }

  private word(c: Container, x: number, y: number, rot: number): Container {
    c.position.set(x, y);
    c.rotation = rot;
    c.zIndex = Z.word;
    c.scale.set(0);
    this.stage.addChild(c);
    this.words.push(c);
    return c;
  }

  /** Fades out every display word on screen at time `t` (the list is taken when `t` comes, not when scheduled). */
  private clearWords(tl: Timeline, t: number): void {
    let ws: Container[] = [];
    tl.at(t, () => {
      ws = this.words;
      this.words = [];
    });
    tl.tween(t, 220, (v) => ws.forEach((w) => (w.alpha = Math.min(w.alpha, 1 - v))), "ease.accel");
    tl.at(t + 220, () => ws.forEach((w) => w.destroy({ children: true })));
  }

  /** Coin flight: from → pill, along an arc (ease.coin), the pill ticks up on arrival. */
  private coin(tl: Timeline, t0: number, from: () => Pt, toId: string, value: number): number {
    const dur = 620;
    let c: Coin | null = null;
    let a: Pt = { x: 0, y: 0 }, b: Pt = { x: 0, y: 0 };
    tl.at(t0, () => {
      const root = new Container();
      const s = new Sprite(this.tex(`coin/${Math.floor(Math.random() * 3)}`));
      s.anchor.set(0.5);
      s.scale.set(30 / 120);
      const lbl = text(`+${value}`, 15, HUB.glow, { display: true });
      lbl.position.set(0, -24);
      const lblInk = text(`+${value}`, 15, INK, { display: true });
      lblInk.position.set(1, -22.5);
      root.addChild(s, lblInk, lbl);
      root.zIndex = Z.fx;
      this.stage.addChild(root);
      c = { root, done: false };
      this.coins.push(c);
      a = from();
      const p = this.pill(toId).root;
      b = { x: p.x + 30, y: p.y };
    });
    tl.tween(t0, dur, (v) => {
      if (!c) return;
      c.root.x = lerp(a.x, b.x, v);
      c.root.y = qbez(a.y, Math.min(a.y, b.y) - 150, b.y, v);
      c.root.scale.set(1 + 0.35 * Math.sin(v * Math.PI));
      c.root.rotation = Math.sin(v * 9) * 0.2;
    }, "ease.coin");
    tl.at(t0 + dur, () => {
      if (c) c.root.destroy({ children: true });
      this.pill(toId).add(value);
    });
    return t0 + dur;
  }

  private spotlight(tl: Timeline, t0: number, card: CardView, inOut: "in" | "out", dur = 420): void {
    const r = card.root;
    let from = { x: 0, y: 0, k: 1 };
    tl.at(t0, () => {
      from = { x: r.x, y: r.y, k: r.scale.x };
      if (inOut === "in") r.zIndex = Z.spot;
    });
    const to = inOut === "in" ? SPOT : { ...card.slot, k: 1 };
    tl.tween(t0, dur, (v) => {
      r.x = lerp(from.x, to.x, v);
      r.y = lerp(from.y, to.y, v);
      r.scale.set(lerp(from.k, to.k, v));
      const d = inOut === "in" ? v : 1 - v;
      this.dim.alpha = 0.66 * d;
      this.glow.alpha = 0.42 * d;
      this.cone.alpha = 0.32 * d;
    }, inOut === "in" ? "ease.decel" : "ease.standard");
    tl.at(t0, () => {
      this.cone.position.set(SPOT.x, -30);
      this.cone.width = 460;
      this.cone.height = SPOT.y - CARD_H * 0.75 + 30 + 20;
    });
    if (inOut === "out") {
      tl.tween(t0, dur, (v) => card.stampView?.scale.set(lerp(1, 0.72, v)), "ease.standard");
      tl.at(t0 + dur, () => (r.zIndex = Z.card));
    }
  }

  private drumroll(tl: Timeline, t0: number, card: CardView, dur = 600): void {
    // card trembles on the 12 fps clock while the room holds its breath
    tl.tween(t0, dur, (_v, p) => {
      const step = Math.floor((p * dur) / 83);
      card.root.rotation = p >= 1 ? 0 : (step % 2 ? 1 : -1) * 0.012 * (1 + p * 2);
    }, "linear");
  }

  private stampOn(tl: Timeline, t: number, card: CardView, word: string, color: number, seed: number, shake: number): void {
    let s: Container | null = null;
    tl.at(t, () => {
      s = card.addStamp(word, color, seed);
      s.scale.set(2.4);
      s.alpha = 0;
    });
    const lx = card.label.x;
    tl.tween(t, 220, (v) => (card.label.x = lerp(lx, -26, v)), "ease.standard");
    tl.tween(t, 170, (v) => {
      if (!s) return;
      s.scale.set(lerp(2.4, 1, v));
      s.alpha = Math.min(1, v * 2);
    }, "ease.accel");
    tl.at(t + 170, () => {
      this.shake.start(shake, 220, this.now);
      card.root.scale.set(SPOT.k * 0.96);
    });
    tl.tween(t + 170, 200, (v) => card.root.scale.set(SPOT.k * lerp(0.96, 1, v)), "spring.hop");
  }

  // ------------------------------------------------------------------ steps
  private intro(): Timeline {
    const tl = new Timeline();
    const prompt = this.stage.children.find((c) => c.label === "prompt")!;
    tl.at(0, () => {
      prompt.y = -60;
      for (const c of this.cards) {
        c.root.position.set(W / 2, -80);
        c.root.alpha = 0;
      }
      for (const a of this.actors.values()) a.root.y = H + 90;
      for (const p of this.pills.values()) p.root.alpha = 0;
    });
    tl.tween(0, 520, (v) => (prompt.y = lerp(-60, 50, v)), "ease.overshoot");
    this.cards.forEach((c, i) => {
      const t = 250 + i * 70;
      tl.tween(t, 460, (v) => {
        c.root.x = lerp(W / 2, c.slot.x, v);
        c.root.y = lerp(-80, c.slot.y, v);
        c.root.rotation = (1 - v) * (i % 2 ? 0.4 : -0.4);
        c.root.alpha = Math.min(1, v * 3);
      }, "ease.decel");
    });
    PLAYERS.forEach((p, i) => {
      const a = this.actor(p.id);
      const t = 500 + i * 70;
      tl.at(t, () => a.root.position.set(this.home.get(p.id)!.x, H + 90));
      this.hop(tl, a, t, this.home.get(p.id)!, { height: 60, dur: 420 });
      tl.tween(t + 300, 300, (v) => (this.pill(p.id).root.alpha = v), "ease.standard");
    });
    const w = inkWord("Who fooled who?", 54, BLUFF.accent);
    tl.at(1300, () => this.word(w, W / 2, 330, -0.04));
    tl.tween(1300, 380, (v) => w.scale.set(v), "spring.bouncy");
    this.clearWords(tl, 2300);
    return tl;
  }

  private lie(op: Option): Timeline {
    const tl = new Timeline();
    const card = this.card(op);
    const author = this.actor(op.authorId!);
    const authorP = PLAYERS.find((p) => p.id === op.authorId)!;
    const voters = op.voterIds.map((id) => this.actor(id));
    const seed = op.id.charCodeAt(1);
    this.spotlight(tl, 0, card, "in");
    tl.at(0, () => (this.pill(authorP.id).root.zIndex = Z.pillUp));
    // 2. jump-on: each voter hops from the row onto the card top
    let t = 420;
    let landed = t;
    const top = SPOT.y - (CARD_H * SPOT.k) / 2 + 3;
    voters.forEach((v, j) => {
      const x = SPOT.x - 100 + j * 62;
      landed = this.hop(tl, v, t + j * 150, { x, y: top }, { height: 90, dur: 460, z: Z.actorUp });
    });
    // 3. drumroll
    t = landed + 80;
    this.drumroll(tl, t, card);
    // 4. LIE! stamp, voters react
    const S = t + 620;
    this.stampOn(tl, S, card, "LIE!", BLUFF.lie, seed, 4);
    tl.at(S + 200, () => {
      voters.forEach((v, j) => {
        v.setExpr(j % 2 ? "sad" : "shock");
        this.burst(j % 2 ? "sweat" : "exclaim", v);
      });
    });
    // 5. the liar pops out from behind the card: BUSTED (double line + shock for 1 s, ART-DIRECTION §10.4) + shake
    const P = S + 520;
    const ax = SPOT.x + 112, peekY = top + 2;
    tl.at(P, () => {
      author.root.zIndex = Z.author;
      author.root.position.set(ax, top + 110);
      author.size = 1.45;
      author.setExpr("busted");
    });
    tl.tween(P, 420, (v) => (author.root.y = lerp(top + 110, peekY, v)), "spring.bouncy");
    const busted = inkWord("BUSTED!", 58, BLUFF.signal);
    tl.at(P + 120, () => {
      this.shake.start(10, 480, this.now);
      this.word(busted, ax + 40, top - 112, 0.1);
    });
    tl.tween(P + 120, 300, (v) => busted.scale.set(v), "spring.bouncy");
    const R = P + 1100;
    const reaction: Expr = voters.length > 1 ? "laugh" : "smug";
    tl.at(R, () => {
      author.setExpr(reaction);
      this.burst(reaction === "laugh" ? "tears" : "heart", author, 50);
    });
    const caption = inkWord(`${authorP.name} fooled ${voters.length}!`, 40, HUB.glow);
    tl.at(R, () => this.word(caption, SPOT.x, SPOT.y + 92, -0.02));
    tl.tween(R, 320, (v) => caption.scale.set(v), "spring.bouncy");
    // 6. coins: from each fooled voter into the liar's pill
    const C = R + 380;
    let end = C;
    voters.forEach((v, j) => {
      end = this.coin(tl, C + j * 140, () => v.head(), authorP.id, FOOL_POINTS);
    });
    // hold, then everyone goes home and the card returns to the board with its stamp
    const back = end + 900;
    this.clearWords(tl, back);
    this.spotlight(tl, back, card, "out", 480);
    tl.at(back, () => {
      author.setExpr("idle");
      voters.forEach((v) => v.setExpr("idle"));
    });
    tl.tween(back, 300, (v) => (author.root.y = lerp(peekY, top + 120, v)), "ease.accel");
    tl.at(back + 300, () => {
      const h = this.home.get(authorP.id)!;
      author.size = 1;
      author.root.position.set(h.x, h.y + 70);
      author.root.zIndex = Z.row;
    });
    this.hop(tl, author, back + 300, this.home.get(authorP.id)!, { height: 30, dur: 300 });
    voters.forEach((v, j) => {
      const id = op.voterIds[j]!;
      this.hop(tl, v, back + 60 + j * 90, this.home.get(id)!, { height: 70, dur: 420 });
      tl.at(back + 800, () => (v.root.zIndex = Z.row));
    });
    tl.at(back + 600, () => (this.pill(authorP.id).root.zIndex = Z.pill));
    return tl;
  }

  private truth(op: Option): Timeline {
    const tl = new Timeline();
    const card = this.card(op);
    const finders = op.voterIds.map((id) => this.actor(id));
    const others = PLAYERS.filter((p) => !op.voterIds.includes(p.id)).map((p) => this.actor(p.id));
    this.spotlight(tl, 0, card, "in", 520);
    // camera push-in on the truth card
    tl.tween(0, 900, (v) => {
      this.cam.x = lerp(W / 2, SPOT.x, v);
      this.cam.y = lerp(H / 2, SPOT.y - 10, v);
      this.cam.z = lerp(1, 1.32, v);
    }, "ease.decel");
    this.drumroll(tl, 600, card, 700);
    // gold + light sweep
    tl.tween(1300, 260, (v) => (card.goldness = v), "ease.standard");
    tl.at(1300, () => {
      this.sweep.height = CARD_H * SPOT.k * 0.98;
      this.sweep.width = 70;
      this.sweep.tint = 0xffffff;
    });
    tl.tween(1300, 650, (v) => {
      this.sweep.x = lerp(SPOT.x - 130, SPOT.x + 130, v);
      this.sweep.y = SPOT.y;
      this.sweep.alpha = Math.sin(v * Math.PI) * 0.85;
    }, "ease.standard");
    this.stampOn(tl, 1750, card, "TRUTH", BLUFF.truth, 7, 3);
    tl.at(1950, () => {
      const cols = [BLUFF.gold, PAPER, BLUFF.accent, 0xffffff];
      const hw = (CARD_W * SPOT.k) / 2, hh = (CARD_H * SPOT.k) / 2;
      this.confetti.burst(SPOT.x - hw, SPOT.y - hh, 90, cols, { angle: -2.2, spread: 1.0, speed: 560, size: 14 });
      this.confetti.burst(SPOT.x + hw, SPOT.y - hh, 90, cols, { angle: -0.95, spread: 1.0, speed: 560, size: 14 });
      const w = inkWord("It's true!", 46, BLUFF.gold);
      this.word(w, SPOT.x, SPOT.y - 120, -0.05);
    });
    tl.tween(1950, 320, (v) => this.words.forEach((w) => w.scale.set(v)), "spring.bouncy");
    // camera pulls back; finders jump on and cheer, the rest sigh
    tl.tween(2500, 650, (v) => {
      this.cam.x = lerp(SPOT.x, W / 2, v);
      this.cam.y = lerp(SPOT.y - 10, H / 2, v);
      this.cam.z = lerp(1.32, 1, v);
    }, "ease.standard");
    this.clearWords(tl, 2500);
    tl.tween(2500, 400, (v) => (this.dim.alpha = lerp(0.66, 0.3, v)), "ease.standard");
    const top = SPOT.y - (CARD_H * SPOT.k) / 2 + 3;
    let landed = 2600;
    finders.forEach((f, j) => {
      landed = this.hop(tl, f, 2600 + j * 140, { x: SPOT.x - 80 + j * 80, y: top }, { height: 100, dur: 460, z: Z.actorUp });
      tl.at(2600 + j * 140 + 600, () => {
        f.setExpr("cheer");
        this.burst("confetti", f, 52, 1800);
      });
      tl.at(2600, () => (this.pill(op.voterIds[j]!).root.zIndex = Z.pillUp));
    });
    tl.at(2900, () => others.forEach((a) => {
      a.root.zIndex = Z.actorUp;
      a.setExpr("sad");
      this.burst("raincloud", a, 38, 2200);
    }));
    const note = new Container();
    note.addChild(panel(new Graphics(), 520, 34, 10, 77, INK, { line: 0, shadow: 0, mis: 0 }));
    note.addChild(text(NOTE, 15, PAPER));
    note.alpha = 0;
    tl.at(landed, () => this.word(note, SPOT.x, SPOT.y + 82, 0));
    tl.tween(landed, 300, (v) => {
      note.alpha = v;
      note.scale.set(1);
      note.y = SPOT.y + 92 - 10 * v;
    }, "ease.decel");
    let end = landed + 200;
    finders.forEach((f, j) => {
      end = this.coin(tl, landed + 200 + j * 140, () => f.head(), op.voterIds[j]!, TRUTH_POINTS);
    });
    const back = end + 1000;
    this.clearWords(tl, back);
    this.spotlight(tl, back, card, "out", 480);
    finders.forEach((f, j) => {
      this.hop(tl, f, back + 60 + j * 90, this.home.get(op.voterIds[j]!)!, { height: 70, dur: 420 });
      tl.at(back + 900, () => {
        f.root.zIndex = Z.row;
        f.setExpr("idle");
        this.pill(op.voterIds[j]!).root.zIndex = Z.pill;
      });
    });
    tl.at(back + 300, () => others.forEach((a) => {
      a.setExpr("idle");
      a.root.zIndex = Z.row;
    }));
    return tl;
  }

  private montage(): Timeline {
    const tl = new Timeline();
    const lies = unpicked();
    const cards = lies.map((op) => this.card(op));
    const n = cards.length;
    const title = inkWord("Nobody bought it…", 40, PAPER);
    tl.at(0, () => this.word(title, W / 2, 300, -0.03));
    tl.tween(0, 300, (v) => title.scale.set(v), "spring.bouncy");
    tl.tween(0, 300, (v) => (this.dim.alpha = 0.5 * v), "ease.standard");
    cards.forEach((c, i) => {
      const r = c.root;
      let from: Pt = { x: 0, y: 0 };
      const fan = (i - (n - 1) / 2);
      const to = { x: W / 2 + fan * 120, y: 400 + Math.abs(fan) * 14 };
      tl.at(100 + i * 80, () => {
        from = { x: r.x, y: r.y };
        r.zIndex = Z.spot + i;
        const a = this.actor(c.opt.authorId!);
        // the author's tiny sad face on the corner of their unbought lie
        const face = new Sprite(this.tex(`${a.color}/sad/0`));
        face.anchor.set(0.5);
        face.scale.set(0.24);
        face.position.set(CARD_W / 2 - 12, -CARD_H / 2 - 4);
        r.addChild(face);
      });
      tl.tween(100 + i * 80, 460, (v) => {
        r.x = lerp(from.x, to.x, v);
        r.y = lerp(from.y, to.y, v);
        r.rotation = fan * 0.16 * v;
      }, "ease.decel");
      // they fall off-screen together
      tl.tween(1500 + i * 60, 700, (v) => {
        r.y = to.y + v * 420;
        r.rotation = fan * 0.16 + v * fan * 0.5;
      }, "ease.accel");
    });
    this.clearWords(tl, 1900);
    tl.tween(2000, 400, (v) => (this.dim.alpha = 0.5 * (1 - v)), "ease.standard");
    return tl;
  }

  private finale(): Timeline {
    const tl = new Timeline();
    const ranked = [...PLAYERS].sort((a, b) => this.pill(b.id).value - this.pill(a.id).value);
    const leader = ranked[0]!;
    const banner = inkWord(`${leader.name} leads!`, 64, HUB.glow);
    tl.at(0, () => {
      this.confetti.rain(W, 200, PLAYERS.map((p) => p.hex).concat([PAPER, HUB.glow]), 10);
      this.word(banner, W / 2, 330, -0.05);
      banner.zIndex = Z.word + 10;
    });
    tl.tween(0, 420, (v) => banner.scale.set(v), "spring.bouncy");
    // the board steps back so the celebration reads
    tl.tween(0, 400, (v) => this.cards.forEach((c) => (c.root.alpha = 1 - 0.55 * v)), "ease.standard");
    tl.at(900, () => this.confetti.rain(W, 140, PLAYERS.map((p) => p.hex).concat([PAPER]), 9));
    PLAYERS.forEach((p, i) => {
      const a = this.actor(p.id);
      const home = this.home.get(p.id)!;
      const isLeader = p.id === leader.id;
      tl.at(100 + i * 60, () => a.setExpr(isLeader ? "cheer" : "happy"));
      for (let k = 0; k < (isLeader ? 4 : 2); k++) this.hop(tl, a, 150 + i * 60 + k * 620, home, { height: isLeader ? 60 : 30, dur: 380 });
    });
    tl.at(150 + 60 * 5 + 2 * 620 + 200, () => this.burst("confetti", this.actor(leader.id), 56, 2000));
    return tl;
  }

  private showSummary(lines: string): void {
    const c = new Container();
    const rows = lines.split("\n");
    c.addChild(panel(new Graphics(), 560, 34 + rows.length * 20, 12, 5, INK, { line: 2.5, shadow: 0.5, ink: HUB.glow }));
    rows.forEach((r, i) => {
      const t = text(r, i === 0 ? 17 : 14, i === 0 ? HUB.glow : PAPER);
      t.y = -((rows.length - 1) * 20) / 2 + i * 20;
      c.addChild(t);
    });
    c.position.set(W / 2, 150);
    this.hud.addChild(c);
    this.summary = c;
  }

  get summaryVisible(): boolean { return !!this.summary; }
}
