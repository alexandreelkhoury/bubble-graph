// Taqriban! on the Pixi TV (GAME-TAQRIBAN §8.3, TQ-TV-01..05 + HOLD): QUESTION, REVEAL (the number line), LEADERBOARD,
// FINAL_INTRO, RESULTS, HOLD. It reads the same view model as the DOM screens in games/taqriban/tv.tsx (playersOf,
// ranked, layoutLine, shortNum, groupDigits), the same reveal timeline (games/taqriban/timeline.ts on the shared `run`
// sampler), the same sound cues (games/taqriban/sfx.ts) and the same geometry (taqribanLayout.ts = tv.css in numbers),
// and draws them with Pixi: static Graphics, canvas Text, one Char sprite per player, transforms only per frame. Design
// units are the 960 × 540 canvas; the host scales them 2×. Secrecy: like the DOM, nothing here can show an answer or
// a guess before REVEAL, because the TV projection does not contain one.
import { CanvasTextMetrics, Container, FillGradient, Graphics, Sprite, Texture } from "pixi.js";
import type { Text } from "pixi.js";
import { h } from "preact";
import { useCallback, useRef, useState } from "preact/hooks";
import { COLORS } from "@jamaa/shared/constants";
import { BODY_PATHS } from "@jamaa/shared/characters";
import type { ColorId } from "@jamaa/shared/constants";
import { run, variant } from "@jamaa/shared/motion";
import type { Run, Step } from "@jamaa/shared/motion";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { worldColor } from "@jamaa/shared/worlds";
import type { WorldToken } from "@jamaa/shared/worlds";
import { fmtNum, isolate, isolateLtr, locale } from "../i18n/t";
import { remainingMs } from "../lib/countdown";
import { reduced } from "../lib/motion";
import { clockOffset } from "../state/store";
import { resultsSettled } from "../tv-mock/tvPlatform";
import { useInGameOk } from "../tv-mock/tvParts";
import { groupDigits, layoutLine, playersOf, ranked, shortNum, taqOfTv, tk, withUnit } from "../games/taqriban/phone";
import type { Player, Taq } from "../games/taqriban/model";
import { revealSteps } from "../games/taqriban/tv/timeline";
import { dropRate, sfx } from "../games/taqriban/tv/sfx";
import { Char, CREAM, INK, hex, setText, txt } from "./kit";
import type { TxtOpts } from "./kit";
import { PixiHost } from "./stage";
import type { Scene } from "./stage";
import {
  AXIS_Y, H, LINE_W, LINE_X0, SAFE_X0, SAFE_X1, W, barFrac, boardCols, boardGeom, castLayout, clampCenter, laneY, lineX, mx,
  previousOrder, qFont, rowXs, spreadTags, winScale,
} from "./taqribanLayout";

// ------------------------------------------------------------------------------------------------ palette + helpers
const wc = (tok: WorldToken): number => hex(worldColor("observatory", tok, "web") ?? "#06161A");
const DEEP = wc("deep"), TOP = wc("stageTop"), SURF = wc("surface"), ELEV = wc("elevated");
const ACC = wc("accent"), ACC_T = wc("accentText"), GLOW = wc("glow"), SIG = wc("signal");
/** --color-text-secondary / --color-text-muted (tokens.css). */
const TEXT2 = 0xe2d6f5, MUTED = 0xb8a8d6;
const playerHex = (c: ColorId): number => hex(COLORS.find((x) => x.id === c)?.hex ?? "#888888");

const isRtl = (): boolean => locale.value === "ar";
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const easeOut = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
const overshoot = (x: number): number => { const c = 1.7, u = clamp01(x) - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
const lerp = (a: number, b: number, q: number): number => a + (b - a) * q;
const RLI = "⁧", PDI = "⁩";
/** Canvas text has an LTR base direction: an RTL sentence is wrapped in RLI…PDI so it reads right to left (names and
 *  numbers inside keep their own FSI / LRI isolates, as in the DOM). */
const bidi = (s: string): string => (isRtl() && s ? `${RLI}${s}${PDI}` : s);

/** A single-line string in the page direction, shrunk to `maxW`. */
function line(s: string, size: number, o: TxtOpts = {}): Text { return txt(bidi(s), size, o); }

/** A wrapped paragraph: in RTL every wrapped line is isolated RTL (Pixi draws line by line). Scaled to fit `maxH`. */
function para(s: string, size: number, o: TxtOpts & { wrap: number; balance?: boolean }, maxH?: number): Text {
  const t = txt(s, size, { ...o, maxW: undefined });
  if (o.balance) {
    // CSS text-wrap: balance: the narrowest wrap width that keeps the same number of lines.
    const n = CanvasTextMetrics.measureText(s, t.style).lines.length;
    if (n > 1) {
      let lo = o.wrap / n, hi = o.wrap;
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2;
        t.style.wordWrapWidth = mid;
        if (CanvasTextMetrics.measureText(s, t.style).lines.length > n) lo = mid; else hi = mid;
      }
      t.style.wordWrapWidth = Math.ceil(hi) + 1;
    }
  }
  if (isRtl()) {
    const lines = CanvasTextMetrics.measureText(s, t.style).lines;
    t.style.wordWrap = false;
    t.text = lines.map((l) => `${RLI}${l.trim()}${PDI}`).join("\n");
  }
  if (maxH && t.height > maxH) t.scale.set(maxH / t.height);
  if (o.maxW && t.width > o.maxW) t.scale.set(t.scale.x * (o.maxW / t.width));
  return t;
}

/** A soft round glow (white radial gradient, drawn once): tinted sprites, additive, no filters (weak TV GPUs). */
let glowTex: Texture | null = null;
function glow(color: number, radius: number, alpha = 1): Sprite {
  if (!glowTex) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const g = cv.getContext("2d")!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.35, "rgba(255,255,255,0.45)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    glowTex = Texture.from(cv);
  }
  const s = new Sprite(glowTex);
  s.anchor.set(0.5);
  s.tint = color;
  s.width = s.height = radius * 2;
  s.alpha = alpha;
  s.blendMode = "add";
  return s;
}

/** The sky (tv.css .tqbtv: radial-gradient(70% 60% at 50% 0%, stageTop, deep 75%)), drawn once, small, upscaled. */
let skyTex: Texture | null = null;
function skyTexture(): Texture {
  if (skyTex) return skyTex;
  const cw = 320, ch = 180;
  const cv = document.createElement("canvas");
  cv.width = cw; cv.height = ch;
  const g = cv.getContext("2d")!;
  const css = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
  g.fillStyle = css(DEEP);
  g.fillRect(0, 0, cw, ch);
  const rx = 0.7 * cw, ry = 0.6 * ch;
  g.save();
  g.translate(cw / 2, 0);
  g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, css(TOP));
  gr.addColorStop(0.75, css(DEEP));
  g.fillStyle = gr;
  g.fillRect(-cw / 2, 0, cw, (ch * rx) / ry);
  g.restore();
  skyTex = Texture.from(cv);
  return skyTex;
}

/** Deterministic pseudo-random in [0, 1) (stable star field). */
const rnd = (i: number): number => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** The observatory night: the sky, a static star field, twinkling stars, now and then a shooting star. */
class Sky {
  readonly root = new Container();
  private readonly twinkles: { s: Container; ph: number }[] = [];
  private readonly shoot = new Container();
  private age = 0;
  constructor() {
    const bg = new Sprite(skyTexture());
    bg.width = W; bg.height = H;
    this.root.addChild(bg);
    const stars = new Graphics();
    // The DOM's six painted stars (tv.css .tqbsky), then a sparse field in the upper sky.
    const dom: [number, number, number, number][] = [[0.12, 0.18, 1.5, GLOW], [0.33, 0.09, 1, CREAM], [0.71, 0.14, 1.5, GLOW], [0.88, 0.31, 1, CREAM], [0.52, 0.24, 1, CREAM], [0.06, 0.44, 1.5, CREAM]];
    for (const [x, y, r, c] of dom) stars.circle(x * W, y * H, r / 2 + 0.3).fill({ color: c, alpha: 0.7 });
    for (let i = 0; i < 46; i++) stars.circle(rnd(i) * W, rnd(i + 100) * rnd(i + 200) * H * 0.75, rnd(i + 300) < 0.2 ? 0.9 : 0.55).fill({ color: rnd(i + 400) < 0.3 ? GLOW : CREAM, alpha: 0.25 + 0.4 * rnd(i + 500) });
    this.root.addChild(stars);
    const tw: [number, number][] = [[0.22, 0.12], [0.64, 0.07], [0.91, 0.2], [0.4, 0.16], [0.8, 0.05], [0.15, 0.3]];
    tw.forEach(([x, y], i) => {
      const s = new Container();
      s.addChild(glow(GLOW, 6, 0.8), new Graphics().circle(0, 0, 1).fill(GLOW));
      s.position.set(x * W, y * H);
      this.root.addChild(s);
      this.twinkles.push({ s, ph: i / 3 });
    });
    const trail = new Graphics();
    for (let i = 0; i < 12; i++) trail.circle(-i * 7, -i * 2.2, 1.3 - i * 0.08).fill({ color: CREAM, alpha: 0.9 - i * 0.07 });
    this.shoot.addChild(trail, glow(GLOW, 8, 0.9));
    this.shoot.visible = false;
    this.root.addChild(this.shoot);
  }
  tick(dt: number): void {
    this.age += dt;
    const calm = reduced();
    for (const t of this.twinkles) t.s.alpha = calm ? 0.7 : 0.2 + 0.8 * (0.5 + 0.5 * Math.sin((this.age / 3000 + t.ph) * Math.PI * 2));
    // A shooting star every 9 s (700 ms), never in calm motion.
    const cycle = this.age % 9000, k = Math.floor(this.age / 9000);
    const on = !calm && this.age > 4000 && cycle < 700;
    this.shoot.visible = on;
    if (on) {
      const q = cycle / 700, x0 = 160 + rnd(k) * 520, y0 = 30 + rnd(k + 9) * 80;
      this.shoot.position.set(x0 + 220 * q, y0 + 70 * q);
      this.shoot.alpha = Math.sin(Math.PI * q);
    }
  }
}

/** The small-avatar glyph (components/PlayerChip.tsx Glyph: the body shape, 62 % of a 30 dp tile, ink or cream). */
function glyph(c: ColorId, size: number): Graphics {
  const col = COLORS.find((x) => x.id === c) ?? COLORS[0];
  const fill = col.glyph === "ink" ? INK : CREAM;
  if (col.shape === "circle") return new Graphics().circle(0, 0, (9 / 24) * size).fill(fill);
  const g = new Graphics().svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${BODY_PATHS[col.shape]}" fill="${col.glyph === "ink" ? "#120A1F" : "#FFF7EC"}"/></svg>`);
  g.scale.set(size / 24);
  g.position.set(-size / 2, -size / 2);
  return g;
}

/** A crown on a character (components/Character.tsx `crown`: the same path, in the character's viewBox). */
function crown(size: number): Graphics {
  const u = size / 32;
  const pts = [7.5, -1.5, 9.5, 0.1, 12, -3.6, 14.5, 0.1, 16.5, -1.5, 15.6, 3, 8.4, 3];
  return new Graphics().poly(pts.map((v, i) => (i % 2 ? (v - 27) * u : (v - 12) * u))).fill(0xffc94d).stroke({ width: Math.max(1, u * 0.5), color: INK, join: "round" });
}

// ------------------------------------------------------------------------------------------------ shared pieces
interface Phase { root: Container; update(tq: Taq, ps: Player[]): void; tick(dtMs: number): void; complete?(): void; destroy(): void }

/** The in-game top bar (tv.css .tqbtop): the title at the inline start, "Question 3 of 10" (+ ×2) at the end. */
class Top {
  readonly root = new Container();
  private readonly title = txt("", 22, { weight: "900", fill: ACC_T });
  private readonly count = txt("", 20, { weight: "600", fill: TEXT2 });
  private readonly x2 = new Container();
  private last = "";
  constructor() {
    const chip = txt("×2", 18, { weight: "900", fill: INK });
    this.x2.addChild(new Graphics().roundRect(-chip.width / 2 - 10, -13, chip.width + 20, 26, 13).fill(SIG), chip);
    this.root.addChild(this.title, this.count, this.x2);
  }
  set(tq: Taq): void {
    const pub = tq.pub;
    const label = pub.isFinal ? tk("show.final") : tk("show.question", { n: fmtNum(pub.index + 1), total: fmtNum(pub.total) });
    const sig = `${label}|${pub.isFinal}|${locale.value}`;
    if (sig === this.last) return;
    this.last = sig;
    const rtl = isRtl();
    this.title.style.letterSpacing = rtl ? 0 : 0.9; // never on Arabic: it breaks the joins
    setText(this.title, bidi(tk("title")), 360);
    this.title.anchor.x = rtl ? 1 : 0;
    this.title.position.set(mx(48, rtl), 45);
    setText(this.count, bidi(label), 380);
    this.count.anchor.x = rtl ? 0 : 1;
    this.count.position.set(mx(W - 48, rtl), 45);
    this.x2.visible = pub.isFinal;
    const cw = this.count.width, xw = this.x2.width;
    this.x2.position.set(rtl ? 48 + cw + 10 + xw / 2 : W - 48 - cw - 10 - xw / 2, 45);
  }
}

/** The ring timer (tv.css .tqbring: r 26, 6 dp stroke, accent → signal at ≤ 5 s), the server deadline. */
class Ring {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly num = txt("", 22, { weight: "900" });
  private key = "";
  constructor() { this.root.addChild(this.g, this.num); }
  tick(tq: Taq): void {
    const pub = tq.pub;
    if (pub.deadline === null || !pub.durationMs) { this.root.visible = false; return; }
    this.root.visible = true;
    const ms = remainingMs(pub.deadline, Date.now(), clockOffset.value);
    const secs = Math.ceil(ms / 1000);
    const frac = clamp01(ms / pub.durationMs);
    const key = `${secs}|${Math.round(frac * 160)}`;
    if (key === this.key) return;
    this.key = key;
    const low = secs <= 5;
    const g = this.g.clear();
    g.circle(0, 0, 26).stroke({ width: 6, color: 0xffffff, alpha: 0.1 });
    if (frac > 0.004) g.moveTo(0, -26).arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac).stroke({ width: 6, color: low ? SIG : ACC, cap: "round" });
    setText(this.num, fmtNum(secs));
    this.num.style.fill = low ? SIG : CREAM;
  }
}

/** The cast row at the bottom (tv.css .tqbcast); `lit` marks who has guessed (never what): ✓, happy face, a hop. */
class Cast {
  readonly root = new Container();
  private items = new Map<string, { box: Container; ch: Char; ok: Container; lit: boolean; litQ: number; hop: number; away: boolean; i: number }>();
  private sig = "";
  private age = 0;
  constructor(ps: Player[], lit: ReadonlySet<string> | null) { this.update(ps, lit); }
  update(ps: Player[], lit: ReadonlySet<string> | null): void {
    const live = ps.filter((p) => !p.row.left);
    const sig = `${live.map((p) => p.id).join(",")}|${locale.value}`;
    if (sig !== this.sig) this.build(live, lit);
    for (const p of live) {
      const it = this.items.get(p.id);
      if (!it) continue;
      const on = !!lit?.has(p.id);
      if (on && !it.lit) it.hop = 1;
      it.lit = on;
      it.away = !p.connected;
      it.ch.expression = on ? "happy" : p.connected ? "think" : "away";
    }
  }
  private build(live: Player[], lit: ReadonlySet<string> | null): void {
    this.sig = `${live.map((p) => p.id).join(",")}|${locale.value}`;
    this.root.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.items.clear();
    const rtl = isRtl();
    const { size, slot, xs } = castLayout(live.length, rtl);
    live.forEach((p, i) => {
      const box = new Container();
      const ch = new Char(p.color, size, "think");
      const nm = txt(isolate(p.name), 15, { weight: "700", maxW: slot });
      nm.position.set(0, 13);
      const ok = new Container();
      ok.addChild(new Graphics().circle(0, 0, 11).fill(ACC), txt("✓", 13, { weight: "900", fill: INK }));
      ok.position.set((rtl ? -1 : 1) * (slot / 2 - 15), -size + 7);
      ok.scale.set(0);
      box.addChild(ch, nm, ok);
      box.position.set(xs[i]!, 491);
      this.root.addChild(box);
      const on = !!lit?.has(p.id);
      this.items.set(p.id, { box, ch, ok, lit: on, litQ: on ? 1 : 0, hop: 0, away: !p.connected, i });
    });
  }
  tick(dt: number): void {
    this.age += dt;
    const calm = reduced();
    for (const [, it] of this.items) {
      const target = it.lit ? 1 : 0;
      it.litQ = calm ? target : it.litQ + (target - it.litQ) * Math.min(1, dt / 90);
      it.hop = calm ? 0 : Math.max(0, it.hop - dt / 340);
      const hop = it.hop > 0 ? Math.sin(Math.PI * (1 - it.hop)) * 16 : 0;
      it.box.y = 491 - 6 * it.litQ - hop;
      it.box.alpha = it.away && !it.lit ? 0.35 : 0.7 + 0.3 * it.litQ;
      const pop = it.lit ? (calm ? 1 : overshoot(1 - it.hop)) : 0;
      it.ok.scale.set(it.lit ? Math.max(0, pop) : 0);
      // breathing: the waiting players think, the ones who guessed bounce a little
      const br = calm ? 0 : Math.sin(this.age / 700 + it.i * 1.3) * (it.lit ? 0.025 : 0.015);
      it.ch.scale.set(1 - br * 0.5, 1 + br);
    }
  }
}

/** A centred headline + body (tv.css .tqbcenter). */
function centerTitle(title: string, body: string | null, cy: number, color = CREAM): { title: Text; body: Text | null } {
  const t = line(title, 56, { weight: "900", fill: color, maxW: 864 });
  const b = body ? para(body, 34, { weight: "700", fill: TEXT2, wrap: 840, maxW: 864 }, 96) : null;
  const gap = 16, hT = 64, hB = b ? b.height : 0;
  const total = hT + (b ? gap + hB : 0);
  t.position.set(W / 2, cy - total / 2 + hT / 2);
  if (b) b.position.set(W / 2, cy + total / 2 - hB / 2);
  return { title: t, body: b };
}

// ------------------------------------------------------------------------------------------------ QUESTION (TQ-TV-01)
class QuestionPhase implements Phase {
  readonly root = new Container();
  private readonly card = new Container();
  private readonly ring = new Ring();
  private readonly label: Text;
  private readonly num: Text;
  private readonly cast: Cast;
  private readonly shine = new Graphics();
  private tq: Taq;
  private ps: Player[];
  private age = 0;
  private sig = "";
  constructor(tq: Taq, ps: Player[]) {
    this.tq = tq; this.ps = ps;
    const q = tq.pub.question;
    // The card (tv.css .tqbcard: top 76, inset 72, 228 tall, elevated → surface, accent hairline).
    const cw = 816, chh = 228;
    const grad = new FillGradient({ type: "linear", start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: ELEV }, { offset: 1, color: SURF }] });
    // tv.css box-shadow 0 20px 50px: a soft shadow from stacked translucent plates (no blur filter on a TV GPU).
    const shadow = new Graphics();
    for (let i = 0; i < 6; i++) shadow.roundRect(-cw / 2 - i * 5, -chh / 2 + 20 - i * 4, cw + i * 10, chh + i * 8, 24 + i * 5).fill({ color: 0x000000, alpha: 0.07 });
    this.card.addChild(shadow);
    this.card.addChild(new Graphics().roundRect(-cw / 2, -chh / 2, cw, chh, 24).fill(grad).stroke({ width: 2, color: ACC, alpha: 0.4, alignment: 1 }));
    // A slow brass glint sweeps the card's top edge.
    this.card.addChild(this.shine);
    const text = q?.text ?? "";
    const unit = q?.unit ?? "";
    const size = qFont(text);
    const unitH = unit ? 28 + 14 : 0;
    const qt = para(text, size, { weight: "900", wrap: cw - 72, lineHeight: Math.round(size * 1.2), balance: true }, chh - 40 - unitH);
    const blockH = qt.height + unitH;
    qt.position.set(0, -blockH / 2 + qt.height / 2);
    this.card.addChild(qt);
    if (unit) {
      const u = line(unit, 20, { weight: "900", fill: ACC_T, maxW: 600 });
      const chip = new Container();
      chip.addChild(new Graphics().roundRect(-u.width / 2 - 16, -14, u.width + 32, 28, 14).fill({ color: ACC, alpha: 0.16 }), u);
      chip.position.set(0, blockH / 2 - 14);
      this.card.addChild(chip);
    }
    this.card.position.set(W / 2, 76 + chh / 2);
    this.label = line("", 20, { weight: "700", fill: TEXT2 });
    this.num = txt("", 20, { weight: "900" });
    this.cast = new Cast(ps, new Set(tq.pub.answeredIds));
    this.root.addChild(this.card, this.ring.root, this.label, this.num, this.cast.root);
    this.update(tq, ps);
  }
  update(tq: Taq, ps: Player[]): void {
    this.tq = tq; this.ps = ps;
    const pub = tq.pub;
    const lit = new Set(pub.answeredIds);
    const playing = ps.filter((p) => !p.row.left && !pub.waitingIds.includes(p.id)).length;
    this.cast.update(ps, lit);
    const sig = `${lit.size}/${playing}|${locale.value}`;
    if (sig === this.sig) return;
    this.sig = sig;
    setText(this.label, bidi(tk("show.guessed")), 420);
    setText(this.num, isolateLtr(`${fmtNum(lit.size)}/${fmtNum(playing)}`));
    // tv.css .tqbstatus: [ring][label number] centred at y 350, gap 16; the row mirrors in RTL.
    const rtl = isRtl();
    const textW = this.label.width + 6 + this.num.width;
    const [rx, tx] = rowXs([64, textW], 16, W / 2, rtl) as [number, number];
    this.ring.root.position.set(rx, 350);
    const start = tx - (rtl ? -textW / 2 : textW / 2);
    const dir = rtl ? -1 : 1;
    this.label.position.set(start + dir * (this.label.width / 2), 350);
    this.num.position.set(start + dir * (this.label.width + 6 + this.num.width / 2), 350);
  }
  tick(dt: number): void {
    this.age += dt;
    const calm = reduced();
    // tv.css tqb-card: 520 ms, from 30 dp above at 94 %, overshoot.
    const q = calm ? 1 : clamp01(this.age / 520);
    const e = overshoot(q);
    this.card.y = 76 + 114 - 30 * (1 - e);
    this.card.scale.set(0.94 + 0.06 * e);
    this.card.alpha = clamp01(q * 2.2);
    const sw = calm ? -1 : ((this.age - 700) % 5200) / 1400;
    this.shine.clear();
    if (sw > 0 && sw < 1) {
      const x = -408 + 816 * easeOut(sw);
      this.shine.roundRect(x - 60, -114, 120, 3, 1.5).fill({ color: GLOW, alpha: 0.55 * Math.sin(Math.PI * sw) });
    }
    this.ring.tick(this.tq);
    this.cast.tick(dt);
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

// ------------------------------------------------------------------------------------------------ REVEAL (TQ-TV-02)
interface DotView {
  id: string; i: number; x: number; y: number; win: boolean;
  stem: Graphics; foot: Graphics; head: Container; tag: Container; halo: Sprite; ring: Graphics; pts: Container | null; ripple: Graphics;
  landT: number;
}

class RevealPhase implements Phase {
  readonly root = new Container();
  private readonly stage = new Container();
  private readonly axis = new Container();
  private readonly ticks = new Container();
  private readonly logTag: Text | null = null;
  private readonly dots: DotView[] = [];
  private readonly pin = new Container();
  private readonly trail = new Graphics();
  private readonly shock = new Graphics();
  private readonly flash: Sprite;
  private readonly gaps = new Graphics();
  private readonly verdict = new Container();
  private readonly wild: Text | null = null;
  private readonly sparks: { g: Graphics; x: number; y: number; a: number; d: number }[] = [];
  private readonly pinX: number;
  private handle: Run | null = null;
  private skipping = false;
  private readonly calm = reduced();
  private done = false;
  private age = 0;
  private readonly fired = new Set<string>();
  constructor(tq: Taq, ps: Player[], private readonly onRunning: (running: boolean) => void) {
    const pub = tq.pub;
    const r = pub.reveal!;
    const unit = pub.question?.unit ?? "";
    const rtl = isRtl();
    const byId = new Map(ps.map((p) => [p.id, p]));
    const ln = layoutLine(r.answer, r.guesses, r.logLine);
    const order = [...ln.dots].sort((a, b) => (byId.get(a.id)?.seat ?? 0) - (byId.get(b.id)?.seat ?? 0));
    const idx = new Map(order.map((d, i) => [d.id, i]));
    this.pinX = lineX(ln.answerX);
    this.root.addChild(this.stage);

    // The question, small (tv.css .tqbrq: top 70, 22 dp, 2 lines).
    // One line at 22 dp when it fits; else two lines at 18 dp, so it never runs into the verdict (the DOM's two 22 dp
    // lines reach y 125, under the stamp at 112).
    const qText = pub.question?.text ?? "";
    let qt = line(qText, 22, { weight: "700", fill: TEXT2, anchorY: 0 });
    const twoLines = qt.width > 816;
    if (twoLines) { qt.destroy(); qt = para(qText, 18, { weight: "700", fill: TEXT2, wrap: 816, anchorY: 0, lineHeight: 21, balance: true }, 44); }
    qt.position.set(W / 2, 70);
    this.stage.addChild(qt);

    // The axis (tv.css .tqbline__axis: 816 × 4 at y 338, glow in the middle, fading at the ends) + a soft halo.
    const stops = (a0: number, a1: number) => new FillGradient({
      type: "linear", start: { x: 0, y: 0 }, end: { x: 1, y: 0 },
      colorStops: [{ offset: 0, color: `rgba(255,231,176,${a0})` }, { offset: 0.5, color: `rgba(255,231,176,${a1})` }, { offset: 1, color: `rgba(255,231,176,${a0})` }],
    });
    const ax = new Graphics().roundRect(0, -2, LINE_W, 4, 2).fill(stops(0.25, 1));
    const halo = new Graphics().roundRect(0, -7, LINE_W, 14, 7).fill(stops(0, 0.12));
    this.axis.addChild(halo, ax);
    this.axis.position.set(LINE_X0, AXIS_Y);
    this.stage.addChild(this.axis);

    // Ticks + labels (always LTR), and "log scale" under the end of the line.
    const tg = new Graphics();
    this.ticks.addChild(tg);
    let lastEnd = -Infinity;
    for (const t of ln.ticks) {
      const x = lineX(t.x);
      tg.rect(x - 1, 334, 2, 12).fill({ color: GLOW, alpha: 0.5 });
      const lb = txt(isolateLtr(t.label), 14, { weight: "700", fill: MUTED, anchorY: 0 });
      lb.position.set(x, 350);
      // never let two labels collide (a log line over many decades)
      if (x - lb.width / 2 > lastEnd + 6) { this.ticks.addChild(lb); lastEnd = x + lb.width / 2; } else lb.destroy();
    }
    this.stage.addChild(this.ticks);
    if (r.logLine) {
      const lg = txt(bidi(tk("show.logScale")), 13, { weight: "600", fill: MUTED, anchorX: 1, anchorY: 0 });
      lg.style.fontStyle = "italic";
      lg.position.set(LINE_X0 + LINE_W, 372);
      this.logTag = lg;
      this.stage.addChild(lg);
    }

    // The winners' distance to the truth: a brass segment on the axis (drawn at the stamp).
    this.stage.addChild(this.gaps);

    // The guesses: a disc (seat colour, the small-avatar glyph as in the DOM, deep ring), a stem down to the line, name + value above.
    // Layers: ripples, stems, discs (the winners' last), then the tags, outlined (so a close neighbour's disc never
    // hides a name; tags that would collide in a lane move apart), the winners' tags and points on top.
    const L = { ripple: new Container(), stem: new Container(), disc: new Container(), tag: new Container(), winDisc: new Container(), winTag: new Container() };
    this.stage.addChild(L.ripple, L.stem, L.disc, L.winDisc, L.tag, L.winTag);
    const xs = ln.dots.map((d) => lineX(d.x));
    const tagW: { x: number; w: number; lane: number }[] = [];
    for (const d of ln.dots) {
      const p = byId.get(d.id);
      const g = r.guesses.find((x) => x.id === d.id)!;
      const col = p ? playerHex(p.color) : 0x888888;
      const win = r.closestIds.includes(d.id);
      const x = lineX(d.x), y = laneY(d.lane);
      const stem = new Graphics().rect(-1, 0, 2, 1).fill({ color: col, alpha: 0.6 });
      stem.position.set(x, y + 14);
      const foot = new Graphics().circle(0, 0, 3).fill(col);
      foot.position.set(x, AXIS_Y);
      L.stem.addChild(stem, foot);
      const head = new Container();
      head.position.set(x, y - 1);
      const haloS = glow(ACC, 34, 0);
      const ring = new Graphics().circle(0, 0, 19).stroke({ width: 4, color: ACC });
      ring.alpha = 0;
      head.addChild(haloS, new Graphics().circle(0, 0, 17).fill(col).stroke({ width: 3, color: DEEP, alignment: 0 }), ring);
      if (p) head.addChild(glyph(p.color, 19));
      (win ? L.winDisc : L.disc).addChild(head);
      const tag = new Container();
      // A deep outline keeps the text readable where a neighbour's disc passes behind it.
      const nm = txt(isolate(p?.name ?? ""), 13, { weight: "700", fill: TEXT2, maxW: 110, stroke: DEEP });
      const val = txt(isolateLtr(shortNum(g.value)), 16, { weight: "900", maxW: 130, stroke: DEEP });
      nm.position.set(0, -45); val.position.set(0, -28);
      const tw = Math.max(nm.width, val.width) + 6;
      tag.addChild(nm, val);
      tag.position.set(x, y);
      tagW.push({ x, w: tw, lane: d.lane });
      (win ? L.winTag : L.tag).addChild(tag);
      let pts: Container | null = null;
      if (win) {
        pts = new Container();
        const pt = txt(isolateLtr(`+${fmtNum(g.points)}`), 15, { weight: "900", fill: INK });
        pts.addChild(new Graphics().roundRect(-pt.width / 2 - 8, -11, pt.width + 16, 22, 10).fill(ACC), pt);
        // tv.css .tqbdot__pts: beside the disc, on the side with more room (never past the safe area).
        const others = xs.filter((v) => v !== x);
        const roomR = Math.min(SAFE_X1 + 24, ...others.filter((v) => v > x)) - x;
        const roomL = x - Math.max(SAFE_X0 - 24, ...others.filter((v) => v < x));
        const half = pt.width / 2 + 8;
        const right = roomR >= roomL ? x + 22 + 2 * half < SAFE_X1 + 24 : x - 22 - 2 * half < SAFE_X0 - 24;
        pts.position.set(x + (right ? 22 + half : -22 - half), y - 1);
        pts.scale.set(0);
        L.winTag.addChild(pts);
      }
      const ripple = new Graphics().ellipse(0, 0, 18, 5).stroke({ width: 2, color: col });
      ripple.position.set(x, AXIS_Y);
      ripple.visible = false;
      L.ripple.addChild(ripple);
      const parts = [stem, foot, head, tag];
      for (const o of parts) o.visible = false;
      this.dots.push({ id: d.id, i: idx.get(d.id) ?? 0, x, y, win, stem, foot, head, tag, halo: haloS, ring, pts, ripple, landT: -1 });
    }
    spreadTags(tagW).forEach((cx, i) => { this.dots[i]!.tag.x = cx; });

    // The answer pin (tv.css .tqbpin): a red needle from the line down, the flag under it (label, digits, words + unit).
    const needleGlow = glow(SIG, 22, 0.7);
    needleGlow.scale.y *= 2.2;
    needleGlow.position.set(0, 362);
    const needle = new Graphics().roundRect(-2, 340, 4, 44, 2).fill(SIG);
    const head = new Graphics().circle(0, 340, 5).fill(SIG).stroke({ width: 2, color: DEEP });
    const flag = new Container();
    const small = txt(bidi(tk("show.answer").toLocaleUpperCase(locale.value)), 13, { weight: "900", fill: INK });
    small.style.letterSpacing = isRtl() ? 0 : 0.8; // never on Arabic (it breaks the joins)
    const big = txt(isolateLtr(groupDigits(r.answer)), 30, { weight: "900", fill: INK, maxW: 400 });
    const words = shortNum(r.answer) !== groupDigits(r.answer) ? isolate(shortNum(r.answer)) : "";
    const emS = withUnit(words, unit).trim();
    const em = emS ? txt(bidi(emS), 15, { weight: "700", fill: INK, maxW: 400 }) : null;
    const fw = Math.max(small.width, big.width, em?.width ?? 0) + 32;
    const fh = 6 + 16 + 33 + (em ? 17 : 0) + 8;
    small.position.set(0, 6 + 8); big.position.set(0, 6 + 16 + 16); em?.position.set(0, 6 + 16 + 33 + 8);
    flag.addChild(new Graphics().roundRect(-fw / 2, 0, fw, fh, 14).fill(SIG), small, big);
    if (em) flag.addChild(em);
    flag.addChildAt(glow(SIG, fw * 0.7, 0.35), 0);
    flag.position.set(clampCenter(this.pinX, fw / 2) - this.pinX, 384);
    this.trail.pivot.set(0, 340);
    this.trail.position.set(0, 340);
    for (let i = 0; i < 10; i++) this.trail.rect(-1.5 + i * 0.1, 340 - (i + 1) * 22, 3 - i * 0.2, 22).fill({ color: SIG, alpha: 0.5 - i * 0.05 });
    this.pin.addChild(this.trail, needleGlow, flag, needle, head);
    this.pin.position.set(this.pinX, 0);
    this.pin.visible = false;
    this.shock.position.set(this.pinX, AXIS_Y);
    this.flash = glow(SIG, 90, 0);
    this.flash.position.set(this.pinX, AXIS_Y);
    this.stage.addChild(this.shock, this.flash, this.pin);

    // The verdict (tv.css .tqbverdict at y 134): the "Closest!" / "Tie!" stamp, the winners' names, "Bullseye!".
    const items: Container[] = [];
    const widths: number[] = [];
    const stamp = (s: string, bg: number, rot: number): Container => {
      const c = new Container();
      const t = line(s, 26, { weight: "900", fill: INK, maxW: 360 });
      const g = glow(bg, (t.width + 40) * 0.55, 0.16);
      g.scale.y *= 0.5;
      c.addChild(g, new Graphics().roundRect(-t.width / 2 - 20, -22, t.width + 40, 44, 12).fill(bg), t);
      c.rotation = rot;
      widths.push(t.width + 40);
      return c;
    };
    if (r.guesses.length === 0) items.push(stamp(tk("show.nobody"), ACC, (-4 * Math.PI) / 180));
    else {
      items.push(stamp(r.closestIds.length > 1 ? tk("show.tie") : tk("show.closest"), ACC, (-4 * Math.PI) / 180));
      const who = txt(r.closestIds.map((id) => isolate(byId.get(id)?.name ?? "")).join(" · "), 26, { weight: "900", maxW: 420 });
      const wc2 = new Container();
      wc2.addChild(who);
      items.push(wc2);
      widths.push(who.width);
      if (r.bullseyeIds.length > 0) items.push(stamp(tk("show.bullseye"), SIG, (3 * Math.PI) / 180));
    }
    rowXs(widths, 14, W / 2, rtl).forEach((x, i) => { items[i]!.position.set(x, 0); this.verdict.addChild(items[i]!); });
    this.verdict.position.set(W / 2, twoLines ? 140 : 134);
    this.verdict.pivot.set(W / 2, 0);
    this.verdict.visible = false;
    this.stage.addChild(this.verdict);

    // "Way off! Omar said 3 trees" (0.7 s after the stamp).
    const wildG = r.wildId ? r.guesses.find((g) => g.id === r.wildId) : undefined;
    if (wildG) {
      this.wild = line(tk("show.wayOff", { name: isolate(byId.get(wildG.id)?.name ?? ""), value: isolateLtr(withUnit(shortNum(wildG.value), unit)) }), 20, { weight: "700", fill: GLOW, maxW: 816 });
      this.wild.position.set(W / 2, twoLines ? 186 : 178);
      this.wild.alpha = 0;
      this.stage.addChild(this.wild);
    }
    const src = line(tk("show.source", { source: r.source }), 13, { weight: "600", fill: MUTED, maxW: 864 });
    src.position.set(W / 2, 505);
    this.stage.addChild(src);

    // Sparks around the winners (a burst at the stamp; ≤ 3 winners × 14).
    const colors = [ACC, GLOW, CREAM, 0xffd36e];
    this.dots.filter((d) => d.win).slice(0, 3).forEach((d, k) => {
      for (let i = 0; i < 14; i++) {
        const g = new Graphics().star(0, 0, 4, 4, 1.5).fill(colors[(i + k) % colors.length]!);
        g.visible = false;
        this.stage.addChild(g);
        this.sparks.push({ g, x: d.x, y: d.y - 1, a: (i / 14) * Math.PI * 2 + k, d: 34 + 26 * rnd(i + k * 31) });
      }
    });

    this.start(order.length);
  }

  private once(id: string, f: () => void): void { if (!this.fired.has(id)) { this.fired.add(id); f(); } }

  private start(n: number): void {
    const calm = reduced();
    const steps: Step[] = variant(revealSteps(n), { reduced: calm });
    const winners = this.dots.filter((d) => d.win);
    if (calm) { sfx("pin"); if (n > 0) sfx("closest"); this.fired.add("pin").add("stamp"); }
    this.onRunning(true);
    this.handle = run(steps, (p, t) => this.frame(p, t, winners, n), () => { this.done = true; this.onRunning(false); }, Math.max(1, n));
  }

  private frame(p: (id: string, index?: number) => number, t: number, winners: DotView[], n: number): void {
    // Skipped (OK) or calm motion: the end picture only, no transient effects (ripples, impact, sparks).
    const silent = this.skipping || this.calm;
    this.root.alpha = clamp01(p("fade"));
    this.axis.scale.x = Math.max(0.001, clamp01(p("axis")));
    this.axis.alpha = clamp01(p("axis") * 3);
    this.ticks.alpha = clamp01(p("ticks"));
    if (this.logTag) this.logTag.alpha = clamp01(p("log"));
    const win = p("win");
    for (const d of this.dots) {
      const q = n > 0 ? p("dot", d.i) : 1;
      const on = q > 0;
      d.stem.visible = d.foot.visible = d.head.visible = d.tag.visible = on;
      // tv.css tqb-drop: from 80 dp above (overshoot); the stem stretches from the disc to its fixed foot on the line.
      const dy = -80 * (1 - q);
      d.head.y = d.y - 1 + dy;
      d.tag.y = d.y + dy;
      d.stem.y = d.y + 14 + dy;
      d.stem.scale.y = Math.max(0, AXIS_Y - 2 - (d.y + 14 + dy));
      const dim = d.win ? 1 : 1 - 0.55 * clamp01(win);
      const a = clamp01(q * 1.6) * dim;
      d.head.alpha = d.tag.alpha = d.stem.alpha = a;
      d.foot.alpha = clamp01(q) * dim;
      if (q > 0) this.once(`drop${d.i}`, () => { if (!silent) sfx("drop", dropRate(d.i)); });
      if (q >= 1 && d.landT < 0) d.landT = t;
      // the landing ripple on the line (450 ms)
      const u = d.landT < 0 || silent ? 1 : (t - d.landT) / 450;
      d.ripple.visible = u < 1;
      if (u < 1) { d.ripple.scale.set(0.4 + 1.6 * easeOut(u)); d.ripple.alpha = 0.9 * (1 - u); }
      if (d.win) {
        d.head.scale.set(winScale(win));
        d.ring.alpha = clamp01(win * 2);
        d.halo.alpha = clamp01(win) * 0.9;
        if (d.pts) d.pts.scale.set(Math.max(0, p("pts") > 0 ? overshoot(clamp01(p("pts"))) : 0));
      }
    }
    // The pin falls 260 dp (tv.css tqb-pin), a red streak behind it; on touching the line: shockwave, flash, a jolt.
    const pq = p("pin");
    this.pin.visible = pq > 0;
    this.pin.y = Math.min(6, -260 * (1 - pq)); // a short bounce past the line, not the full overshoot
    this.pin.alpha = clamp01(pq * 1.7);
    this.trail.alpha = pq < 1 ? clamp01(1 - pq) : 0;
    this.trail.scale.y = 0.4 + 0.6 * clamp01(1 - pq);
    if (pq > 0) this.once("pin", () => { if (!silent) sfx("pin"); });
    const l = p("land");
    const impact = l > 0 && l < 1 && !silent;
    this.shock.clear();
    if (impact) {
      this.shock.ellipse(0, 0, 20 + 120 * easeOut(l), 6 + 26 * easeOut(l)).stroke({ width: 3, color: SIG, alpha: 1 - l });
      this.shock.ellipse(0, 0, 10 + 70 * easeOut(l), 3 + 14 * easeOut(l)).stroke({ width: 2, color: GLOW, alpha: 0.8 * (1 - l) });
    }
    this.flash.alpha = impact ? 0.9 * (1 - l) : 0;
    const jolt = impact ? Math.sin(l * Math.PI * 7) * (1 - l) * 4 : 0;
    this.stage.position.set(jolt * 0.4, jolt);
    // The winners' distance: a brass bar from their disc to the pin, drawn outward from the pin.
    this.gaps.clear();
    if (win > 0) for (const d of winners) {
      const x0 = this.pinX, x1 = lerp(this.pinX, d.x, easeOut(win));
      if (Math.abs(x1 - x0) > 1) this.gaps.rect(Math.min(x0, x1), AXIS_Y - 2.5, Math.abs(x1 - x0), 5).fill({ color: ACC, alpha: 0.7 });
    }
    // The stamp (tv.css tqb-stampin: from 2×).
    const sq = p("stamp");
    this.verdict.visible = sq > 0;
    this.verdict.scale.set(2 - sq);
    this.verdict.alpha = clamp01(sq * 2);
    if (sq > 0) this.once("stamp", () => { if (n > 0) sfx("closest"); });
    if (this.wild) this.wild.alpha = clamp01(p("wild"));
    const s = clamp01((p("settle") * 1300) / 800);
    for (const sp of this.sparks) {
      sp.g.visible = s > 0 && s < 1 && !silent;
      if (!sp.g.visible) continue;
      const e = easeOut(s);
      sp.g.position.set(sp.x + Math.cos(sp.a) * sp.d * e, sp.y + Math.sin(sp.a) * sp.d * e + 18 * s * s);
      sp.g.alpha = 1 - s;
      sp.g.rotation = s * 4;
      sp.g.scale.set(1.2 - 0.6 * s);
    }
  }

  update(): void { /* the reveal is fixed once it starts (the same public result) */ }
  tick(dt: number): void {
    this.age += dt;
    if (!this.done || reduced()) return;
    // After the show: the winners' halo breathes.
    for (const d of this.dots) if (d.win) d.halo.alpha = 0.65 + 0.25 * Math.sin(this.age / 380);
  }
  complete(): void { this.skipping = true; this.handle?.complete(); }
  destroy(): void { this.handle?.cancel(); this.onRunning(false); this.root.destroy({ children: true }); }
}

// ------------------------------------------------------------------------------------------------ STANDINGS / RESULTS
class BoardPhase implements Phase {
  readonly root = new Container();
  private readonly rows: { box: Container; fill: Graphics; score: Text; from: number; to: number; before: number; after: number; y0: number; y1: number; i0: number; shown: number; ch: Char; crown: Graphics | null }[] = [];
  private readonly title: Text;
  private readonly confetti: { g: Graphics; x: number; y: number; vx: number; r: number; d: number }[] = [];
  private handle: Run | null = null;
  private lastText = 0;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(tq: Taq, ps: Player[], private readonly results: boolean, private readonly onRunning: (running: boolean) => void) {
    const rtl = isRtl();
    const rows = ranked(ps);
    const max = Math.max(1, ...rows.map((p) => p.row.score));
    const top = rows.filter((p) => p.row.rank === 1 && p.row.score > 0);
    const geo = boardGeom(rows.length);
    const before = previousOrder(rows);
    const head = results
      ? (top.length === 1 ? tk("show.results.winner", { name: isolate(top[0]!.name) }) : top.length > 1 ? tk("show.results.tie") : tk("show.results.title"))
      : tk("show.standings");
    this.title = results ? line(head, 44, { weight: "900", maxW: 864 }) : line(head, 34, { weight: "900", fill: ACC_T, maxW: 864 });
    this.title.position.set(W / 2, results ? 60 : 87);
    this.root.addChild(this.title);
    const wonTexts = rows.map((p) => line(tk("show.won", { n: fmtNum(p.row.closest) }), 14, { weight: "700", fill: MUTED }));
    const cols = boardCols(geo.compact, Math.max(0, ...wonTexts.map((t) => t.width)));
    const fs = geo.compact ? 16 : 20, cs = geo.compact ? 30 : 40, rh = geo.h;
    const X = (x: number): number => mx(x, rtl);
    rows.forEach((p, i) => {
      const isTop = p.row.rank === 1 && p.row.score > 0;
      const box = new Container();
      const bg = new Graphics().roundRect(96, -rh / 2, W - 192, rh, geo.compact ? 10 : 14);
      if (isTop) bg.fill({ color: ACC, alpha: 0.16 }).stroke({ width: 2, color: ACC, alpha: 0.5, alignment: 1 });
      else bg.fill({ color: 0xffffff, alpha: 0.05 });
      box.addChild(bg);
      const rk = txt(isolateLtr(fmtNum(p.row.rank ?? 0)), geo.compact ? 16 : 22, { weight: "900", fill: TEXT2 });
      rk.position.set(X(cols.rank), 0);
      const ch = new Char(p.color, cs, isTop ? "cheer" : "idle");
      ch.position.set(X(cols.char), cs / 2);
      let cr: Graphics | null = null;
      if (results && isTop) { cr = crown(cs); ch.addChild(cr); }
      const nm = txt(isolate(p.name), fs, { weight: "700", anchorX: rtl ? 1 : 0, maxW: cols.nameW });
      nm.position.set(X(cols.name), 0);
      const track = new Graphics().roundRect(0, -6, cols.barW, 12, 6).fill({ color: 0xffffff, alpha: 0.06 });
      track.position.set(rtl ? X(cols.bar) - cols.barW : cols.bar, 0);
      const fill = new Graphics().roundRect(0, -6, cols.barW, 12, 6).fill(playerHex(p.color));
      fill.position.set(X(cols.bar), 0);
      const won = wonTexts[i]!;
      won.anchor.x = rtl ? 0 : 1;
      won.position.set(X(cols.wonEnd), 0);
      const sc = txt(isolateLtr(fmtNum(p.row.scoreBefore)), geo.compact ? 18 : 22, { weight: "900", anchorX: rtl ? 0 : 1 });
      sc.position.set(X(cols.scoreEnd), 0);
      box.addChild(rk, track, fill, nm, won, sc, ch);
      const i0 = before.indexOf(p);
      this.rows.push({
        box, fill, score: sc, ch, crown: cr, from: barFrac(p.row.scoreBefore, max), to: barFrac(p.row.score, max), before: p.row.scoreBefore, after: p.row.score,
        y0: geo.slotY(i0), y1: geo.slotY(i), i0, shown: p.row.scoreBefore,
      });
    });
    // Rows that climb glide over the others (added last); the rest keep their order.
    [...this.rows].sort((a, b) => (a.y1 < a.y0 ? 1 : 0) - (b.y1 < b.y0 ? 1 : 0) || a.y1 - b.y1).forEach((r) => this.root.addChild(r.box));
    if (results && tq.pub.endedEarly) {
      const e = line(tk("show.endedEarly"), 13, { weight: "600", fill: MUTED, maxW: 864 });
      e.position.set(W / 2, 505);
      this.root.addChild(e);
    }
    if (results && top.length > 0) {
      const colors = [ACC, GLOW, SIG, CREAM, 0x29d3c2, ...top.map((p) => playerHex(p.color))];
      for (let i = 0; i < 44; i++) {
        const g = new Graphics().rect(-4, -2, 8, 4).fill(colors[i % colors.length]!);
        g.visible = false;
        this.root.addChild(g);
        this.confetti.push({ g, x: 60 + rnd(i) * 840, y: -20 - rnd(i + 50) * 120, vx: (rnd(i + 90) - 0.5) * 80, r: rnd(i + 7) * 12, d: rnd(i + 13) * 0.35 });
      }
    }
    this.start(rows.length);
  }
  private start(n: number): void {
    const S = (id: string, startMs: number, durationMs: number, easing: Step["easing"], staggerMs?: number): Step =>
      ({ id, startMs, durationMs, easing, ...(staggerMs === undefined ? {} : { staggerMs }), reduced: "fade", lite: "keep" });
    // tv.css: rows rise in (420 ms, 70 ms apart), bars grow from the last board to now (900 ms from 300 ms); here the
    // rows also glide from their previous place to their new one and the points count up with the bars.
    const barsEnd = 300 + 70 * Math.max(0, n - 1) + 900;
    const steps: Step[] = [
      S("title", 0, 520, "ease.overshoot"), S("row", 0, 420, "ease.decel", 70), S("move", 420, 600, "ease.standard"),
      S("bar", 300, 900, "ease.decel", 70),
      ...(this.results ? [S("crown", barsEnd, 420, "ease.overshoot"), S("confetti", barsEnd, 2400, "linear")] : []),
    ];
    const settle = (): void => { if (this.results) resultsSettled.value = true; };
    this.onRunning(true);
    this.handle = run(variant(steps, { reduced: reduced() }), (p, t) => this.frame(p, t), () => { this.onRunning(false); settle(); }, Math.max(1, n));
    // The platform's results bar waits for the board, not for the confetti tail.
    if (this.results) this.settleTimer = setTimeout(settle, reduced() ? 300 : barsEnd + 450);
  }
  private frame(p: (id: string, index?: number) => number, t: number): void {
    this.root.alpha = clamp01(p("fade"));
    const tq = clamp01(p("title"));
    this.title.alpha = clamp01(tq * 2);
    this.title.scale.set(0.85 + 0.15 * overshoot(tq));
    const mv = clamp01(p("move"));
    const writeText = t - this.lastText > 45 || t === 0 || p("bar", this.rows.length - 1) >= 1;
    if (writeText) this.lastText = t;
    const rtl = isRtl();
    for (const r of this.rows) {
      const q = clamp01(p("row", r.i0));
      r.box.alpha = q;
      r.box.y = lerp(r.y0, r.y1, mv) + 14 * (1 - easeOut(q));
      // a climbing row lifts a little as it passes
      r.box.scale.set(r.y1 < r.y0 ? 1 + 0.035 * Math.sin(Math.PI * mv) : 1);
      r.box.pivot.x = W / 2; r.box.x = W / 2;
      const b = clamp01(p("bar", r.i0));
      r.fill.scale.x = (rtl ? -1 : 1) * lerp(r.from, r.to, b);
      const v = Math.round(lerp(r.before, r.after, b));
      if (writeText && v !== r.shown) { r.shown = v; setText(r.score, isolateLtr(fmtNum(v))); }
      if (r.crown) { const c = p("crown"); r.crown.visible = c > 0; r.crown.scale.set(Math.max(0, overshoot(clamp01(c)))); }
    }
    const cf = p("confetti");
    for (const c of this.confetti) {
      const u = clamp01((cf - c.d) / (1 - c.d));
      c.g.visible = u > 0 && u < 1;
      if (!c.g.visible) continue;
      c.g.position.set(c.x + c.vx * u + Math.sin(u * 9 + c.r) * 14, c.y + 640 * u);
      c.g.rotation = c.r + u * 10;
      c.g.alpha = 1 - clamp01((u - 0.85) / 0.15);
    }
  }
  update(): void { /* the board is fixed for this phase */ }
  tick(): void { /* the run drives itself */ }
  complete(): void { this.handle?.complete(); }
  destroy(): void {
    this.handle?.cancel();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    if (this.results) resultsSettled.value = false;
    this.onRunning(false);
    this.root.destroy({ children: true });
  }
}

// ------------------------------------------------------------------------------------------------ FINAL INTRO / HOLD
class FinalIntroPhase implements Phase {
  readonly root = new Container();
  private readonly head = new Container();
  private readonly body: Text | null;
  private readonly rings: Graphics[] = [];
  private age = 0;
  constructor() {
    const rtl = isRtl();
    const { title, body } = centerTitle(tk("show.finalIntro.title"), tk("show.finalIntro.body"), H / 2, SIG);
    const x2 = txt("×2", 56, { weight: "900", fill: ACC });
    const [tx, xx] = rowXs([title.width, x2.width], 14, W / 2, rtl) as [number, number];
    title.position.x = tx; x2.position.set(xx, title.y);
    for (let i = 0; i < 3; i++) {
      const g = new Graphics().circle(0, 0, 100).stroke({ width: 3, color: i % 2 ? ACC : SIG });
      g.position.set(W / 2, title.y);
      g.alpha = 0;
      this.rings.push(g);
      this.root.addChild(g);
    }
    const hl = glow(SIG, 260, 0.22);
    hl.position.set(W / 2, title.y);
    this.root.addChild(hl);
    this.head.addChild(title, x2);
    this.head.pivot.set(W / 2, title.y);
    this.head.position.set(W / 2, title.y);
    this.root.addChild(this.head);
    this.body = body;
    if (body) this.root.addChild(body);
  }
  update(): void { /* static copy */ }
  tick(dt: number): void {
    this.age += dt;
    const calm = reduced();
    const q = calm ? 1 : clamp01(this.age / 600);
    this.head.scale.set(2 - overshoot(q));
    this.head.alpha = clamp01(q * 2);
    if (this.body) this.body.alpha = calm ? 1 : clamp01((this.age - 350) / 400);
    this.rings.forEach((g, i) => {
      if (calm) { g.alpha = 0; return; }
      const u = ((this.age - 300 + i * 600) % 1800) / 1800;
      g.visible = this.age > 300;
      g.scale.set(0.8 + 3.2 * easeOut(u));
      g.alpha = 0.32 * (1 - u);
    });
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

class HoldPhase implements Phase {
  readonly root = new Container();
  private readonly cast: Cast;
  constructor(ps: Player[]) {
    // tv.css .tqbtv--hold .tqbcenter: centred above the 140 dp cast row.
    const { title } = centerTitle(tk("show.hold"), null, (H - 140) / 2);
    this.cast = new Cast(ps, null);
    this.root.addChild(title, this.cast.root);
  }
  update(_tq: Taq, ps: Player[]): void { this.cast.update(ps, null); }
  tick(dt: number): void { this.cast.tick(dt); }
  destroy(): void { this.root.destroy({ children: true }); }
}

class EmptyPhase implements Phase {
  readonly root = new Container();
  update(): void { /* nothing */ }
  tick(): void { /* nothing */ }
  destroy(): void { this.root.destroy({ children: true }); }
}

// ------------------------------------------------------------------------------------------------ the scene
/** The DOM's screenKey (games/taqriban/tv.tsx): a new phase, question or game rebuilds the stage. */
const phaseKey = (tq: Taq): string => `${tq.n}:${tq.pub.phase}:${tq.pub.index}:${tq.pub.question?.id ?? ""}:${locale.value}`;

export class TaqribanScene implements Scene {
  readonly root = new Container();
  private readonly sky = new Sky();
  private readonly top = new Top();
  private readonly layer = new Container();
  private phase: Phase | null = null;
  private key = "";
  private fadeIn = 1;
  constructor(private readonly onRunning: (running: boolean) => void, private readonly onComplete: (f: (() => void) | null) => void) {
    this.root.addChild(this.sky.root, this.layer, this.top.root);
  }

  set(view: TvRoomView): void {
    const tq = taqOfTv(view);
    if (!tq) return;
    const ps = playersOf(view.room, tq.pub);
    const key = phaseKey(tq);
    if (key !== this.key) {
      this.key = key;
      this.phase?.root.parent?.removeChild(this.phase.root);
      this.phase?.destroy();
      this.onRunning(false);
      this.phase = this.make(tq, ps);
      this.layer.addChild(this.phase.root);
      this.onComplete(this.phase.complete ? () => this.phase?.complete?.() : null);
      this.fadeIn = 0;
    } else this.phase?.update(tq, ps);
    const p = tq.pub.phase;
    this.top.root.visible = p === "QUESTION" || p === "REVEAL" || p === "LEADERBOARD";
    this.top.set(tq);
  }

  private make(tq: Taq, ps: Player[]): Phase {
    switch (tq.pub.phase) {
      case "QUESTION": return new QuestionPhase(tq, ps);
      case "REVEAL": return tq.pub.reveal ? new RevealPhase(tq, ps, this.onRunning) : new EmptyPhase();
      case "LEADERBOARD": return new BoardPhase(tq, ps, false, this.onRunning);
      case "RESULTS": return new BoardPhase(tq, ps, true, this.onRunning);
      case "FINAL_INTRO": return new FinalIntroPhase();
      case "HOLD": return new HoldPhase(ps);
      default: return new EmptyPhase();
    }
  }

  tick(dtMs: number): void {
    this.sky.tick(dtMs);
    this.fadeIn = Math.min(1, this.fadeIn + dtMs / 220);
    this.layer.alpha = reduced() ? 1 : easeOut(this.fadeIn);
    this.phase?.tick(dtMs);
  }
  destroy(): void { this.phase?.destroy(); this.root.destroy({ children: true }); }
}

/** The skin component (tv-pixi/skin.tsx): OK completes a running reveal / board (the in-game OK rule, GAME-TAQRIBAN
 *  §8.3 "OK completes it at once"), as the Pixi Most Likely does. */
export function PixiTaqriban({ view }: { view: TvRoomView }) {
  const [running, setRunning] = useState(false);
  const complete = useRef<(() => void) | null>(null);
  useInGameOk(running, () => complete.current?.());
  const make = useCallback(() => new TaqribanScene(setRunning, (f) => { complete.current = f; }), []);
  return h(PixiHost, { make, view, label: "taqriban" });
}
