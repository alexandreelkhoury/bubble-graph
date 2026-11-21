// Bluff! on the Pixi TV (GAME-BLUFF §8 / §12, DESIGN-JAMAA §5.2, §7.6): ROUND_INTRO, WRITING, VOTING, HOLD, REVEAL,
// SCORES, AWARDS, RESULTS in the Liars' Café. It reads the same view model (games/bluff/model.ts, tvModel.ts), the same
// stage geometry and reveal timeline (games/bluff/choreo.ts on the shared `run` sampler) and plays the same sound cues
// as the DOM screens in games/bluff/tv, and draws them with Pixi: textures decoded once (bluffArt.ts), static Graphics,
// canvas Text built when a phase or a beat is built (never per frame), BitmapText digits for the odometers, and only
// transforms / alpha per frame. Secrecy is the DOM's: nothing here reads more than the TV projection, and nothing about
// an option (author, kind, votes, likes) is drawn before REVEAL. Design units: the 960 × 540 canvas (backed 2×).
import { BitmapFont, BitmapText, Container, FillGradient, Graphics, Sprite, Text } from "pixi.js";
import type { TextStyleOptions } from "pixi.js";
import { EXPRESSIONS, REACTION_HOLD_MS } from "@jamaa/shared/characters";
import type { Expression } from "@jamaa/shared/characters";
import { COLORS } from "@jamaa/shared/constants";
import type { ColorId } from "@jamaa/shared/constants";
import { run } from "@jamaa/shared/motion";
import type { Run } from "@jamaa/shared/motion";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { worldColor } from "@jamaa/shared/worlds";
import { dirOf, isolate, listOf, locale, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { reduced } from "../lib/motion";
import { clockOffset } from "../state/store";
import { backHintOn } from "../tv-mock/tvParts";
import { tvConn, tvPaused } from "../tv-mock/tvStore";
import { clearChoreo, resultsSettled, setChoreo } from "../tv-mock/tvPlatform";
import { stopAll } from "../tv-mock/sound/player";
import { odoWidth } from "../games/bluff/art";
import {
  activeSeats, awardAt, awardBodyKey, awardTitleKey, beatAt, bluffModel, deadlineOf, hintKey, isFinal, k, letterOf, optionLetters, placeOf,
  promptLines, ranked, revealPlan, roundIntroKey, roundNameKey, typeKey,
} from "../games/bluff/model";
import type { Award, Beat, BluffModel, Mark, Prompt, Reveal, RevealPlan, RevealStep, Seat } from "../games/bluff/model";
import { baseExpression, countedSeats, isWaiting, propOf, runningScores, seatExpression } from "../games/bluff/tvModel";
import {
  BOX, CARD, CARD_TOP, MAX_ENVELOPES, NAME_Y, PILL_Y, SEAT_Y, bezier, coinsOf, control, hopSize, hoppers, landing, revealTimeline, seatChar, seatX,
} from "../games/bluff/choreo";
import type { Coin, TimedBeat } from "../games/bluff/choreo";
import { revealElapsed } from "../games/bluff/tv/revealTime";
import { cue, riseRate, sfx } from "../games/bluff/tv/sfx";
import { charTexture } from "./art";
import { ArtSprite, LAMP_X, WINDOW_AT, WINDOW_LIGHTS, bigTexture, forgetBluffArt, loadBluffArt } from "./bluffArt";
import {
  H, W, autoRtl, barScale, bidi, boardCell, boardStyle, caps, clamp01, easeInOut, easeOut, envDrop, envelopeX, fanOf, hopPoint, knewAlpha, landed, markAt, mx,
  neonAlpha, overshoot, pickSize, podiumCols, podiumDropAt, popSpots, prog, raceCols, raceRowH, RACE, rowTops, stackHeight, tiltOf, twistCells,
} from "./bluffLayout";
import { Char, FONT } from "./kit";
import type { Scene } from "./stage";

// ---------------------------------------------------------------- palette (tv.css :root of .bf, the café world tokens)

const wc = (tok: "deep" | "stageTop" | "accent" | "glow" | "signal"): number => parseInt((worldColor("hakawati-cafe", tok, "web") ?? "#1C1209").slice(1), 16);
const BRASS = wc("accent"); // #E9A23B
const RED = wc("signal"); // #FF5A5F
const GOLDL = wc("glow"); // #FFE3A3
const PAPER = 0xf7ebd3;
const INK = 0x120a1f;
const CREAM = 0xfff7ec;
const TEXT2 = 0xe2d6f5;
const MUTED = 0xb8a8d6;
const SUCCESS = 0x3ddc97;
const STAMP_INK = { lie: 0xd63a3f, house: 0x6b4fd8, truth: 0x0f7a55, gold: 0x8a5a00 } as const;
const colorHex = (id: ColorId): number => parseInt((COLORS.find((c) => c.id === id) ?? COLORS[0]).hex.slice(1), 16);

const rtl = (): boolean => dirOf(locale.value) === "rtl";
const tk = (s: string, p?: Record<string, string | number>): string => t(k(s) as MessageKey, p);
const serverNow = (): number => Date.now() + clockOffset.value;
const nameList = (m: BluffModel, ids: readonly string[]): string => listOf(ids.map((id) => isolate(m.byId.get(id)?.name ?? "?")));
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- text

type Weight = "400" | "600" | "700" | "800" | "900";
interface TO {
  w?: Weight; fill?: number; ax?: number; ay?: number; align?: "left" | "center" | "right"; wrap?: number; maxW?: number; lh?: number;
  italic?: boolean; ls?: number; glow?: { color: number; blur: number; alpha?: number }; raw?: boolean;
  /** Player or prompt text: its own direction (the DOM's dir="auto"), not the UI's. */
  auto?: boolean;
}

/** Canvas text in Cairo; RTL strings get their bidi marks (bluffLayout.bidi); `maxW` squeezes one line, `wrap` wraps. */
function tx(s: string, size: number, o: TO = {}): Text {
  const r = rtl();
  const style: TextStyleOptions = {
    fontFamily: FONT, fontSize: size, fontWeight: o.w ?? "800", fill: o.fill ?? CREAM, align: o.align ?? "center",
    fontStyle: o.italic ? "italic" : "normal", letterSpacing: r ? 0 : (o.ls ?? 0) * size,
    ...(o.lh ? { lineHeight: Math.round(o.lh * size) } : {}),
    ...(o.wrap ? { wordWrap: true, wordWrapWidth: o.wrap, breakWords: true } : {}),
    ...(o.glow ? { dropShadow: { color: o.glow.color, blur: o.glow.blur, distance: 0, alpha: o.glow.alpha ?? 1, angle: 0 } } : {}),
    padding: o.glow ? Math.ceil(o.glow.blur * 1.5) : 2,
  };
  const t = new Text({ text: o.raw ? s : bidi(s, o.auto ? autoRtl(s, r) : r), style, resolution: 2 });
  t.anchor.set(o.ax ?? 0.5, o.ay ?? 0.5);
  if (o.maxW && t.width > o.maxW) t.scale.set(o.maxW / t.width);
  return t;
}

/** Steps a wrapped text down through `sizes` until it is at most `maxH` tall (then squeezes); returns the size used. */
function fitText(t: Text, sizes: readonly number[], maxH: number, lh: number): number {
  const s = pickSize(sizes, (sz) => {
    t.style.fontSize = sz;
    t.style.lineHeight = Math.round(sz * lh);
    return t.height <= maxH;
  });
  if (t.height > maxH) t.scale.set(maxH / t.height);
  return s;
}

/** Squeezes a text to `maxW` wide (one line labels; the DOM ellipsizes, the canvas never crops). */
function squeeze(t: Text | BitmapText, maxW: number): void {
  t.scale.set(1);
  if (t.width > maxW) t.scale.set(maxW / t.width);
}

/** A rounded box centred on 0,0 (`ring`: an inset outline like the DOM's inset box-shadows). */
function box(w: number, h: number, r: number, fill: number | FillGradient, alpha = 1, ring?: { color: number; width: number; alpha?: number }): Graphics {
  const g = new Graphics().roundRect(-w / 2, -h / 2, w, h, Math.min(r, h / 2, w / 2));
  if (typeof fill === "number") g.fill({ color: fill, alpha }); else g.fill(fill);
  if (ring) g.roundRect(-w / 2 + ring.width / 2, -h / 2 + ring.width / 2, w - ring.width, h - ring.width, Math.max(0, Math.min(r, h / 2, w / 2) - ring.width / 2)).stroke({ width: ring.width, color: ring.color, alpha: ring.alpha ?? 1 });
  return g;
}

/** A soft drop shadow (no blur filter: a few stacked translucent rounded rects). */
function shadow(w: number, h: number, r: number, dy: number, alpha = 0.5): Graphics {
  const g = new Graphics();
  for (let i = 0; i < 4; i++) {
    const g2 = 6 + i * 6;
    g.roundRect(-w / 2 - g2 / 2, -h / 2 + dy - g2 / 2 + 4, w + g2, h + g2, r + g2 / 2).fill({ color: 0x000000, alpha: alpha / 5 });
  }
  return g;
}

/** A pill chip: text on a fill, centred on 0,0; `.width` is its outer width. */
function chip(s: string, size: number, fg: number, bg: number, bgAlpha = 1, h = 26, padX = 12): Container {
  const c = new Container();
  const t = tx(s, size, { w: "800", fill: fg });
  const w = t.width + padX * 2;
  c.addChild(box(w, h, h / 2, bg, bgAlpha), t);
  return c;
}

/** The caption pill (.bfcap / .bfcap--big): wraps at 760, centred on its top edge. */
function caption(s: string, big: boolean, fill = CREAM): Container {
  const c = new Container();
  const size = big ? 26 : 18;
  const t = tx(s, size, { w: big ? "900" : "800", fill, wrap: 740, lh: big ? 1.25 : 1.3 });
  const padX = big ? 22 : 18, padY = big ? 8 : 6;
  const w = t.width + padX * 2, h = t.height + padY * 2;
  c.addChild(box(w, h, Math.min(h / 2, 30), INK, big ? 0.88 : 0.82, big ? { color: BRASS, width: 1.5, alpha: 0.45 } : undefined), t);
  t.y = 0;
  c.pivot.y = -h / 2;
  (c as Container & { boxH: number }).boxH = h;
  return c;
}
const boxH = (c: Container): number => (c as Container & { boxH?: number }).boxH ?? c.height;

// Shared gradients (one tiny texture each, reused by every Graphics that fills with them).
let grads: Record<"paper" | "gold" | "goldCard" | "final" | "brassClip" | "trophy" | "intro" | "introFinal" | "box" | "stepGold" | "step", FillGradient> | null = null;
function gradient(): NonNullable<typeof grads> {
  const lin = (a: string, b: string, c?: string, vertical = true): FillGradient => new FillGradient({
    type: "linear", start: { x: 0, y: 0 }, end: vertical ? { x: 0, y: 1 } : { x: 1, y: 1 },
    colorStops: c ? [{ offset: 0, color: a }, { offset: 0.6, color: b }, { offset: 1, color: c }] : [{ offset: 0, color: a }, { offset: 1, color: b }], textureSpace: "local",
  });
  const rad = (a: string, b: string): FillGradient => new FillGradient({
    type: "radial", center: { x: 0.5, y: 0 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0 }, outerRadius: 1.1,
    colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }], textureSpace: "local",
  });
  grads ??= {
    paper: lin("#FBF2E0", "#F7EBD3", "#EBD9B6", false),
    gold: lin("#FFE3A3", "#E9A23B", undefined, false),
    goldCard: lin("#FFF1C9", "#FFC94D", undefined, false),
    final: lin("#FFE9E9", "#F7D3D3", undefined, false),
    brassClip: lin("#F0C36A", "#B07A2A"),
    trophy: rad("#8A2445", "#4A1024"),
    intro: rad("rgba(74,52,24,0.95)", "rgba(28,18,9,0.95)"),
    introFinal: rad("rgba(70,14,22,0.96)", "rgba(18,10,31,0.96)"),
    box: lin("#7A4A1E", "#4A2E14"),
    stepGold: lin("#E9A23B", "#A8701E"),
    step: lin("#5B3A1E", "#3A2512"),
  };
  return grads;
}

// ---------------------------------------------------------------- digits (BitmapText: no texture upload per frame)

const NUM_FONT = "bfNum";
let numFontReady = false;
function numFont(): string {
  if (!numFontReady) {
    BitmapFont.install({ name: NUM_FONT, style: { fontFamily: FONT, fontWeight: "900", fontSize: 44, fill: 0xffffff }, chars: "0123456789+×/ -", resolution: 2 });
    numFontReady = true;
  }
  return NUM_FONT;
}
function num(s: string, size: number, tint: number): BitmapText {
  const b = new BitmapText({ text: s, style: { fontFamily: numFont(), fontSize: size } });
  b.tint = tint;
  b.anchor.set(0.5, 0.5);
  return b;
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
/** The odometer (games/bluff/art Odo): each column rolls between two digits, unchanged columns stay still. */
class Odo extends Container {
  private cols: { a: BitmapText; b: BitmapText }[] = [];
  private v = -1;
  private readonly cw: number;
  constructor(private readonly size: number, ink: number, width: number) {
    super();
    this.cw = size * 0.62;
    for (let i = 0; i < width; i++) {
      const a = num("0", size, ink), b = num("0", size, ink);
      this.addChild(a, b);
      this.cols.push({ a, b });
    }
  }
  set(value: number): void {
    const v = Math.max(0, value);
    if (Math.abs(v - this.v) < 0.0005) return;
    this.v = v;
    // games/bluff/art odoColumns, inline (no allocation per frame): column k shows floor(v / 10^k) mod 10 and rolls
    // only while the columns under it carry over; a leading zero is hidden.
    const n = this.cols.length;
    let shown = 0;
    for (let k = n - 1; k >= 0; k--) if (!(k > 0 && v < 10 ** k - 1)) shown++;
    let x = -((shown - 1) * this.cw) / 2;
    const h = this.size * 0.5;
    for (let i = 0; i < n; i++) {
      const k = n - 1 - i, base = 10 ** k;
      const col = this.cols[i]!;
      if (k > 0 && v < base - 1) { col.a.visible = false; col.b.visible = false; continue; }
      const whole = Math.floor(v / base) % 10;
      const carry = k === 0 ? v - Math.floor(v) : Math.max(0, (v % base) - (base - 1));
      const pos = whole + carry;
      const d = Math.floor(pos + 1e-9), f = pos - d;
      const da = DIGITS[d % 10]!, db = DIGITS[(d + 1) % 10]!;
      if (col.a.text !== da) col.a.text = da;
      if (col.b.text !== db) col.b.text = db;
      // The old digit folds up and the next one unfolds from below, both inside the pill (no mask needed).
      col.a.visible = f < 0.999;
      col.a.position.set(x, -f * h);
      col.a.scale.y = 1 - f;
      col.b.visible = f > 0.001;
      col.b.position.set(x, (1 - f) * h);
      col.b.scale.y = f;
      x += this.cw;
    }
  }
  static widthFor(...vals: number[]): number { return odoWidth(...vals); }
}

// ---------------------------------------------------------------- the characters' body motion (platform.css .ch--*)

/** One keyframe track value at q (0..1) over stops [[at, v], …], linear between stops. */
function track(q: number, stops: readonly (readonly [number, number])[]): number {
  if (q <= stops[0]![0]) return stops[0]![1];
  for (let i = 1; i < stops.length; i++) {
    const [a, va] = stops[i - 1]!, [b, vb] = stops[i]!;
    if (q <= b) return va + (vb - va) * easeInOut((q - a) / Math.max(1e-6, b - a));
  }
  return stops[stops.length - 1]![1];
}

/** A character with the platform's expression body motion (breathe, hop, laugh, sink, jump, nod, think, lean). */
class Actor extends Container {
  readonly ch: Char;
  private age = 0;
  private e: Expression;
  private readonly seed: number;
  constructor(color: ColorId, readonly size: number, e: Expression = "idle", seed = 0) {
    super();
    this.e = e;
    this.seed = seed;
    this.ch = new Char(color, size, e);
    this.addChild(this.ch);
  }
  set expr(e: Expression) { if (e !== this.e) { this.e = e; this.ch.expression = e; this.age = 0; } }
  get expr(): Expression { return this.e; }
  tick(dt: number, calm: boolean): void {
    this.age += dt;
    const s = this.size, e = this.e, a = this.age;
    let x = 0, y = 0, sx = 1, sy = 1, rot = 0, alpha = 1;
    const fin = calm ? 1e9 : a;
    const dir = rtl() ? -1 : 1;
    switch (e) {
      case "idle": if (!calm) { const q = ((a + this.seed * 700) % 3200) / 3200; const b = Math.sin(q * Math.PI); sx = 1 + 0.025 * b; sy = 1 - 0.025 * b; } break;
      case "happy": case "cheer": {
        const dur = e === "cheer" ? 640 : 700, reps = e === "cheer" ? 2 : 1;
        if (fin < dur * reps) {
          const q = (fin % dur) / dur;
          y = track(q, [[0, 0], [0.4, -0.16], [0.7, 0], [1, 0]]) * s;
          sx = track(q, [[0, 1.06], [0.4, 0.95], [0.7, 1.05], [1, 1]]);
          sy = track(q, [[0, 0.92], [0.4, 1.06], [0.7, 0.95], [1, 1]]);
        }
        break;
      }
      case "laugh": if (fin < 760) { const q = (fin % 380) / 380; const b = Math.sin(q * Math.PI); y = -0.06 * s * b; rot = -3 * DEG * b; } break;
      case "sad": case "facepalm": { const q = easeOut(fin / 600); y = 0.06 * s * q; sx = 1 + 0.02 * q; sy = 1 - 0.04 * q; break; }
      case "shock": { const q = clamp01(fin / 420); x = track(q, [[0, 0], [0.35, -0.06], [1, -0.03]]) * s * dir; y = track(q, [[0, 0], [0.35, -0.1], [1, 0]]) * s; rot = track(q, [[0, 0], [0.35, -6], [1, 0]]) * DEG * dir; break; }
      case "point": rot = 6 * DEG * dir; break;
      case "shy": sx = 0.97; sy = 0.97; y = 0.02 * s; break;
      case "done": if (fin < 500) y = track(fin / 500, [[0, 0], [0.4, 0.04], [1, 0]]) * s; break;
      case "think": if (!calm) rot = -3 * DEG * Math.sin(((a + this.seed * 400) % 2400) / 2400 * Math.PI); break;
      case "smug": rot = -7 * DEG * dir * overshoot(fin / 700); break;
      case "away": alpha = 0.55; break;
      default: break;
    }
    this.ch.position.set(x, y);
    this.ch.scale.set(sx, sy);
    this.ch.rotation = rot;
    this.ch.alpha = alpha;
  }
}

/** Preloads every expression of these colours (a first-time texture decodes asynchronously: no blank frame later). */
function preloadChars(colors: Iterable<ColorId>): void {
  for (const c of new Set(colors)) for (const e of EXPRESSIONS) charTexture(c, e);
}

// ---------------------------------------------------------------- the café

interface CafeOpts { dim: boolean; board: boolean; neon: boolean; calmNeon: boolean }

class Cafe {
  readonly root = new Container();
  private readonly bg = new Sprite(bigTexture("cafe"));
  private readonly board = new Sprite(bigTexture("board"));
  private readonly cones: Sprite[] = [];
  private readonly lights: Graphics[] = [];
  private readonly neon = new Container();
  private readonly neonMain: Text;
  private readonly bang: Text;
  /** The DOM's `filter: brightness(.62)` as a tint on the whole café (no extra full-screen layer). */
  private dim = 0;
  private dimTarget = 0;
  private age = 0;
  private calmNeon = false;
  constructor() {
    this.bg.setSize(W, H);
    this.root.addChild(this.bg);
    for (const [x, y] of WINDOW_LIGHTS) {
      const g = new Graphics().rect(0, 0, 4, 5).fill(0xffc94d);
      g.position.set(WINDOW_AT.x + x, WINDOW_AT.y + y);
      this.lights.push(g);
      this.root.addChild(g);
    }
    this.board.position.set(192, 82);
    this.board.setSize(576, 276);
    this.root.addChild(this.board);
    for (const x of LAMP_X) {
      const c = new Sprite(bigTexture("cone"));
      c.position.set(x - 170, 64);
      c.setSize(340, 356);
      this.cones.push(c);
      this.root.addChild(c);
    }
    this.neonMain = tx("BLUFF", 30, { w: "900", fill: CREAM, ls: 0.04, raw: true, ax: 1, glow: { color: BRASS, blur: 10 } });
    this.bang = tx("!", 30, { w: "900", fill: RED, raw: true, ax: 0, glow: { color: RED, blur: 10 } });
    const halo = tx("BLUFF!", 30, { w: "900", fill: BRASS, ls: 0.04, raw: true, ax: 1, glow: { color: BRASS, blur: 22, alpha: 0.8 } });
    halo.alpha = 0.55;
    this.neon.addChild(halo, this.neonMain, this.bang);
    this.root.addChild(this.neon);
  }
  configure(o: CafeOpts): void {
    this.board.visible = o.board;
    this.neon.visible = o.neon;
    this.calmNeon = o.calmNeon;
    this.dimTarget = o.dim ? 0.38 : 0;
    const r = rtl();
    // .bfw__neon: top 74, inset-inline-end 22, rotated 4° (−4° in RTL).
    const bw = this.bang.width;
    this.neon.position.set(r ? 22 + this.neonMain.width + bw : W - 22 - bw, 74 + 16);
    this.bang.x = 0;
    this.neonMain.x = 0;
    (this.neon.children[0] as Text).x = bw;
    this.neon.rotation = (r ? -4 : 4) * DEG;
    if (o.calmNeon) { this.neonMain.style.fill = 0xffe9c2; this.neon.alpha = 0.82; }
  }
  tick(dt: number): void {
    this.age += dt;
    const calm = reduced();
    // Dim eases like the DOM's 600 ms filter transition.
    const d = this.dimTarget - this.dim;
    const was = this.dim;
    this.dim = calm || Math.abs(d) < 0.004 ? this.dimTarget : this.dim + d * Math.min(1, dt / 160);
    if (this.dim !== was || this.age === dt) { const v = Math.round(255 * (1 - this.dim)); this.root.tint = (v << 16) | (v << 8) | v; }
    if (!calm) {
      this.cones.forEach((c, i) => {
        const q = ((this.age + i * 2100) % 7000) / 7000;
        c.alpha = q < 0.48 ? 1 - 0.14 * (q / 0.48) : q < 0.5 ? 0.86 + 0.08 * ((q - 0.48) / 0.02) : 0.94 + 0.06 * ((q - 0.5) / 0.5);
      });
      this.lights.forEach((l, i) => { l.alpha = ((this.age + 6000 - i * 700) % 6000) / 6000 < 0.7 ? 1 : 0.25; });
    }
    if (this.neon.visible && !this.calmNeon) {
      const q = this.age / 900;
      this.neon.alpha = calm || q >= 0.45 ? 1 : q < 0.2 ? 0.1 : q < 0.3 ? 1 : 0.3;
      this.bang.alpha = !calm && this.age > 600 && this.age < 680 ? 0.3 : 1;
    }
  }
}

// ---------------------------------------------------------------- the top bar (.bftop)

class TopBar {
  readonly root = new Container();
  private readonly title = new Container();
  private readonly end = new Container();
  private readonly ring = new Graphics();
  private readonly secs = num("", 15, CREAM);
  private readonly ringBox = new Container();
  private readonly code: Text;
  private readonly hint = new Container();
  private readonly wifi = new Container();
  private sig = "";
  private ringKey = "";
  private m: BluffModel | null = null;
  private timer = false;
  private hintOn = false;
  private hintSig = "";
  private hintW = 0;
  private degraded = false;
  constructor() {
    this.code = tx("", 20, { w: "900", fill: BRASS, raw: true });
    this.ringBox.addChild(this.ring, this.secs);
    this.wifi.addChild(new Graphics().circle(0, 0, 18).fill(RED), new ArtSprite("wifiOff", 20, 20));
    this.end.addChild(this.wifi, this.ringBox, this.code, this.hint);
    this.root.addChild(this.title, this.end);
  }
  set(m: BluffModel, label: string | null, timer: boolean): void {
    this.m = m;
    this.timer = timer;
    const p = m.pub;
    const round = label ?? (isFinal(p) ? tk("round.final") : tk("round.number", { round: p.round }));
    const counter = tk("prompt.counter", { index: Math.min(p.promptIndex + 1, p.promptCount), count: p.promptCount });
    const sig = `${round}|${counter}|${p.multiplier}|${m.roomCode}|${locale.value}`;
    if (sig !== this.sig) { this.sig = sig; this.buildTitle(round, counter, p.multiplier === 2, m.roomCode); }
    this.layoutEnd();
  }
  private buildTitle(round: string, counter: string, x2: boolean, code: string): void {
    const r = rtl();
    this.title.removeChildren().forEach((c) => c.destroy({ children: true }));
    const parts: Container[] = [
      tx(caps(tk("title"), r), 18, { w: "900", fill: BRASS, ls: 0.06, glow: { color: BRASS, blur: 8, alpha: 0.5 } }),
      tx("·", 18, { w: "900", fill: TEXT2 }),
      tx(caps(round, r), 18, { w: "900", fill: TEXT2, ls: 0.06 }),
      tx("·", 18, { w: "900", fill: TEXT2 }),
      tx(counter, 18, { w: "900", fill: TEXT2, ls: 0.06 }),
    ];
    parts[1]!.alpha = 0.5; parts[3]!.alpha = 0.5;
    if (x2) parts.push(chip("×2", 18, INK, RED, 1, 24, 8));
    let x = 0;
    for (const c of parts) {
      const w = c.width;
      c.x = r ? -(x + w / 2) : x + w / 2;
      x += w + 8;
      this.title.addChild(c);
    }
    const max = 470;
    this.title.scale.set(x - 8 > max ? max / (x - 8) : 1);
    this.title.position.set(r ? W - 32 : 32, 42);
    this.code.text = code.split("").join(" ");
  }
  private layoutEnd(): void {
    const r = rtl();
    this.hintOn = backHintOn.value && !tvPaused.value;
    this.degraded = tvConn.value !== "open";
    const items: { c: Container; w: number }[] = [];
    if (this.hintOn) {
      // Built once per language (layoutEnd runs on every view update).
      const sig = locale.value;
      if (sig !== this.hintSig) {
        this.hintSig = sig;
        this.hint.removeChildren().forEach((c) => c.destroy({ children: true }));
        const label = tx(t("hint.backMenu"), 15, { w: "600", fill: MUTED });
        const icon = new ArtSprite("arrowBack", 18, 18);
        if (r) icon.scale.x *= -1;
        const w = label.width + 18 + 6 + 20;
        this.hint.addChild(box(w, 30, 15, 0x000000, 0.25));
        icon.x = r ? w / 2 - 10 - 9 : -w / 2 + 10 + 9;
        label.x = r ? icon.x - 15 - label.width / 2 : icon.x + 15 + label.width / 2;
        this.hint.addChild(icon, label);
        this.hintW = w;
      }
      items.push({ c: this.hint, w: this.hintW });
    }
    this.hint.visible = this.hintOn;
    items.push({ c: this.code, w: this.code.width });
    const live = this.m && (this.m.pub.phase === "WRITING" || this.m.pub.phase === "VOTING") && this.timer && this.m.pub.deadline !== null;
    this.ringBox.visible = !!live;
    if (live) items.push({ c: this.ringBox, w: 40 });
    this.wifi.visible = this.degraded;
    if (this.degraded) items.push({ c: this.wifi, w: 36 });
    // From the end edge inwards: hint (outermost), code, ring, wifi.
    let x = r ? 32 : W - 32;
    for (const it of items) {
      it.c.position.set(r ? x + it.w / 2 : x - it.w / 2, 42);
      x = r ? x + it.w + 12 : x - it.w - 12;
    }
  }
  tick(): void {
    const m = this.m;
    if (!m) return;
    if ((backHintOn.value && !tvPaused.value) !== this.hintOn || (tvConn.value !== "open") !== this.degraded) this.layoutEnd();
    if (!this.ringBox.visible) return;
    const dl = deadlineOf(m.pub, serverNow());
    if (!dl) return;
    const ms = Math.max(0, dl.at - serverNow());
    const secs = Math.ceil(ms / 1000);
    const frac = clamp01(ms / dl.durationMs);
    const key = `${secs}|${Math.round(frac * 160)}`;
    if (key === this.ringKey) return;
    this.ringKey = key;
    const danger = secs <= 5;
    const col = danger ? RED : BRASS;
    const g = this.ring.clear();
    g.circle(0, 0, 18).stroke({ width: 4, color: CREAM, alpha: 0.14 });
    if (frac > 0.004) g.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac).stroke({ width: 4, color: col, cap: "round" });
    this.secs.text = String(secs);
    this.ringBox.scale.set(danger && secs > 0 && !reduced() ? 1 + 0.06 * Math.max(0, Math.sin(((ms % 1000) / 1000) * Math.PI)) : 1);
  }
}

// ---------------------------------------------------------------- the café row (Seats)

interface SeatOpts {
  expression(s: Seat): Expression;
  prop?(s: Seat): "pencil" | "envelope" | "ballot" | null;
  pills?: boolean;
  spotlight?(s: Seat): boolean;
  pin?(s: Seat): string | null;
  crown?(s: Seat): boolean;
}

interface SeatView {
  s: Seat; x: number; root: Container; actor: Actor; prop: ArtSprite | null; propKind: string | null; propAge: number; pin: Container | null; pinText: string | null;
  glow: ArtSprite; pill: Container | null; odo: Odo | null; bump: number; react: number; reactN: number; burst: ArtSprite; waiting: Container | null; charBox: Container;
}

class SeatRow {
  readonly root = new Container();
  readonly views = new Map<string, SeatView>();
  readonly size: number;
  private age = 0;
  private o: SeatOpts;
  private m: BluffModel;
  constructor(m: BluffModel, o: SeatOpts) {
    this.m = m; this.o = o;
    const seats = m.seats.filter((s) => !s.left || s.score > 0);
    const r = rtl();
    this.size = seatChar(seats.length);
    const size = this.size;
    seats.forEach((s, i) => {
      const x = seatX(seats.length, i, r);
      const root = new Container();
      root.position.set(x, 0);
      // The marble table: top ellipse, its rim and a soft shadow (.bfseat__table).
      const table = new Graphics()
        .ellipse(0, SEAT_Y + 12, 44, 12).fill({ color: 0x000000, alpha: 0.28 })
        .ellipse(0, SEAT_Y + 6, 40, 8).fill(0x6b5b48)
        .ellipse(0, SEAT_Y, 40, 8).fill(0xd9d2c7)
        .ellipse(-8, SEAT_Y - 2, 22, 4).fill({ color: 0xffffff, alpha: 0.55 });
      const glow = new ArtSprite("glow", size + 40, size + 70, 0.5, 0.5);
      glow.position.set(0, SEAT_Y - size - 4);
      glow.alpha = 0.55;
      glow.visible = false;
      const charBox = new Container();
      charBox.position.set(0, SEAT_Y);
      const actor = new Actor(s.color, size, "idle", i);
      charBox.addChild(actor);
      const burst = new ArtSprite("r-laugh", Math.max(22, size * 0.42), Math.max(22, size * 0.42));
      burst.position.set(size * 0.42 * (r ? -1 : 1), -size * 1.02);
      burst.visible = false;
      charBox.addChild(burst);
      const name = tx(s.name, 14, { auto: true, w: "800", raw: false, glow: { color: 0x000000, blur: 3, alpha: 0.8 } });
      // 92 dp plates, narrower when ten or more players sit close (the canvas squeezes, never crops).
      squeeze(name, Math.min(92, (seats.length <= 6 ? 620 : 860) / seats.length - 6));
      name.position.set(0, NAME_Y + 9);
      root.addChild(glow, table, charBox, name);
      if (s.isNew) {
        const n = chip(tk("scores.new"), 10, INK, 0xff4f9a, 1, 14, 6);
        n.position.set((r ? 1 : -1) * (size / 2 + 8) + (r ? -n.width / 2 : n.width / 2), SEAT_Y - size - 12 + 7);
        charBox.addChild(n);
        n.position.y -= SEAT_Y;
      }
      let pill: Container | null = null, odo: Odo | null = null;
      if (o.pills) {
        pill = new Container();
        pill.addChild(box(72, 24, 12, INK, 0.75, { color: BRASS, width: 1.5, alpha: 0.6 }));
        odo = new Odo(16, GOLDL, Odo.widthFor(s.score, 999));
        odo.set(s.score);
        pill.addChild(odo);
        pill.position.set(0, PILL_Y);
        root.addChild(pill);
      }
      if (s.left) root.alpha = 0.4;
      this.root.addChild(root);
      this.views.set(s.id, { s, x, root, actor, prop: null, propKind: null, propAge: 0, pin: null, pinText: null, glow, pill, odo, bump: 0, react: 0, reactN: s.reaction?.n ?? 0, burst, waiting: null, charBox });
    });
    this.update(m, o);
  }
  update(m: BluffModel, o: SeatOpts = this.o): void {
    this.m = m; this.o = o;
    const r = rtl();
    for (const v of this.views.values()) {
      const s = m.byId.get(v.s.id) ?? v.s;
      v.s = s;
      // A new reaction: its expression and burst for 1.5 s (never replayed on mount).
      const n = s.reaction?.n ?? 0;
      if (n !== v.reactN) { v.reactN = n; if (s.reaction) { v.react = REACTION_HOLD_MS; v.burst.setKey(`r-${s.reaction.kind}`); } }
      const prop = o.prop?.(s) ?? null;
      if (prop !== v.propKind) {
        v.prop?.destroy();
        v.prop = null;
        v.propKind = prop;
        v.propAge = 0;
        if (prop) {
          const sz = prop === "envelope" ? 22 : 20;
          v.prop = new ArtSprite(prop, sz, sz, 0.5, 0.5);
          v.charBox.addChild(v.prop);
        }
      }
      const pin = o.pin?.(s) ?? null;
      if (pin !== v.pinText) {
        v.pin?.destroy({ children: true });
        v.pin = null;
        v.pinText = pin;
        if (pin) {
          const c = new Container();
          const tt = tx(pin, 11, { w: "900", fill: INK });
          c.addChild(box(tt.width + 16, 16, 8, GOLDL), tt);
          c.position.set(0, -this.size - 14 + 8);
          v.charBox.addChild(c);
          v.pin = c;
        }
      }
      const waiting = isWaiting(m, s);
      if (waiting && !v.waiting) {
        const c = new Container();
        c.addChild(new Graphics().circle(0, 0, 11).fill({ color: INK, alpha: 0.85 }).circle(0, 0, 10.25).stroke({ width: 1.5, color: BRASS, alpha: 0.6 }), new ArtSprite("timer", 14, 14));
        c.position.set((r ? -1 : 1) * (this.size / 2 - 2 - 11), -this.size - 6 + 11);
        v.charBox.addChild(c);
        v.waiting = c;
      } else if (!waiting && v.waiting) { v.waiting.destroy({ children: true }); v.waiting = null; }
      v.glow.visible = !!o.spotlight?.(s);
    }
  }
  setAway(id: string, away: boolean): void { const v = this.views.get(id); if (v) v.charBox.visible = !away; }
  pillValue(id: string, val: number): void { this.views.get(id)?.odo?.set(val); }
  bump(id: string): void { const v = this.views.get(id); if (v) v.bump = 160; }
  xOf(id: string): number | undefined { return this.views.get(id)?.x; }
  tick(dt: number): void {
    this.age += dt;
    const calm = reduced();
    const r = rtl();
    let i = 0;
    for (const v of this.views.values()) {
      const s = v.s;
      // Expression: away → reaction → the screen's own rule.
      if (v.react > 0) v.react -= dt;
      v.burst.visible = v.react > 0;
      v.actor.expr = !s.connected ? "away" : v.react > 0 && s.reaction ? s.reaction.kind : this.o.expression(s);
      v.actor.tick(dt, calm);
      // bf-seat-in: rise and grow in, 40 ms stagger.
      const q = calm ? 1 : prog(this.age, i * 40, 520);
      v.actor.alpha = Math.min(1, q * 2);
      v.actor.y = (1 - overshoot(q)) * 30;
      v.actor.scale.set(0.6 + 0.4 * overshoot(q));
      if (v.react > 0 && !calm) v.burst.scale.set(Math.abs(v.burst.scale.x) > 0 ? v.burst.scale.x : 1);
      // Props (.bfseat__prop): pencil scribbles, envelope drops in, ballot rises.
      if (v.prop) {
        v.propAge += dt;
        const pa = v.propAge, sz = this.size;
        const side = r ? -1 : 1;
        const px = side * (sz / 2 + 10 - 11), py = -sz + sz * 0.44 + 10;
        if (v.propKind === "pencil") {
          const w = calm ? 0 : Math.sin(((pa % 900) / 900) * Math.PI * 2);
          v.prop.position.set(px, py - (w > 0 ? 2 * w : 0));
          v.prop.rotation = (1 * (w * 9) + 1) * DEG * side;
        } else if (v.propKind === "envelope") {
          const p = calm ? 1 : prog(pa, 0, 700);
          v.prop.position.set(px, py - 26 * (1 - overshoot(p)));
          v.prop.rotation = -20 * (1 - overshoot(p)) * DEG * side;
          v.prop.alpha = Math.min(1, p * 2);
        } else {
          const p = calm ? 1 : prog(pa, 0, 500);
          v.prop.position.set(px, -sz - 6 + 10 + 20 * (1 - overshoot(p)));
          v.prop.scale.set((0.5 + 0.5 * overshoot(p)) * (20 / 48));
          v.prop.alpha = Math.min(1, p * 2);
        }
      }
      if (v.pill) {
        if (v.bump > 0) v.bump -= dt;
        v.pill.scale.set(v.bump > 0 && !calm ? 1 + 0.15 * Math.sin((1 - v.bump / 160) * Math.PI) : 1);
      }
      i++;
    }
  }
}

// ---------------------------------------------------------------- the prompt card (.bfprompt)

/** The menu card on its brass clip: chips, the prompt, translit, translation, length hint. Top-centre at 0,0. */
function promptCard(p: Prompt, final: boolean, small: boolean, width: number, maxH: number): { c: Container; h: number } {
  const c = new Container();
  const lines = promptLines(p);
  const padX = small ? 18 : 30, padT = small ? 10 : 22, padB = small ? 10 : 20, gap = small ? 4 : 8;
  const inner = width - padX * 2;
  const items: Container[] = [];
  if (!small) {
    const row = new Container();
    const chips = [chip(t(typeKey(p.type) as MessageKey), 14, INK, BRASS)];
    if (final) chips.push(chip(tk("noTruth.chip"), 14, INK, RED));
    if (p.rerun) chips.push(chip(tk("prompt.rerun"), 14, BRASS, BRASS, 0.18));
    let x = 0;
    const total = chips.reduce((a, ch) => a + ch.width, 0) + 8 * (chips.length - 1);
    for (const ch of rtl() ? [...chips].reverse() : chips) { ch.x = -total / 2 + x + ch.width / 2; x += ch.width + 8; row.addChild(ch); }
    (row as Container & { boxH: number }).boxH = 26;
    items.push(row);
  }
  const main = tx(lines.main, small ? 20 : 36, { auto: true, w: "900", fill: INK, wrap: inner, lh: 1.18 });
  items.push(main);
  let translit: Text | null = null, sub: Text | null = null;
  if (lines.translit && !small) { translit = tx(lines.translit, 18, { w: "600", italic: true, fill: 0x120a1f, wrap: inner, lh: 1.3, raw: true }); translit.alpha = 0.6; items.push(translit); }
  if (lines.sub) { sub = tx(lines.sub, small ? 15 : 22, { auto: true, w: "800", fill: INK, wrap: inner, lh: 1.3 }); sub.alpha = 0.78; items.push(sub); }
  let hint: Container | null = null;
  if (!small) {
    hint = new Container();
    const ht = tx(t(hintKey(p.lengthHint) as MessageKey), 16, { w: "700", fill: 0x7a4a00 });
    const icon = new ArtSprite("info", 18, 18);
    const w = ht.width + 18 + 6 + 24;
    hint.addChild(box(w, 26, 13, INK, 0.08));
    const r = rtl();
    icon.x = (r ? 1 : -1) * (w / 2 - 12 - 9);
    ht.x = icon.x + (r ? -1 : 1) * (9 + 6 + ht.width / 2);
    hint.addChild(icon, ht);
    (hint as Container & { boxH: number }).boxH = 26;
    items.push(hint);
  }
  // Fit: the main line steps down (and the translation with it) until the card fits its room.
  const room = maxH - padT - padB - gap * (items.length - 1) - (small ? 0 : 26 + 26 + 4) - (translit?.height ?? 0);
  const mainSizes = small ? [20, 18, 16, 14] : [36, 32, 28, 25, 22, 20];
  pickSize(mainSizes, (sz) => {
    main.style.fontSize = sz; main.style.lineHeight = Math.round(sz * 1.18);
    if (sub) { const ss = Math.round(sz * (small ? 0.75 : 0.61)); sub.style.fontSize = ss; sub.style.lineHeight = Math.round(ss * 1.3); }
    return main.height + (sub?.height ?? 0) <= room;
  });
  const hOf = (it: Container): number => (it as Container & { boxH?: number }).boxH ?? it.height;
  let y = padT;
  for (const it of items) {
    const h = hOf(it);
    it.position.set(0, y + h / 2 + (it === hint ? 4 : 0));
    y += h + gap + (it === hint ? 4 : 0);
  }
  const h = Math.max(y - gap + padB, small ? 40 : 120);
  const bg = new Container();
  bg.addChild(shadow(width, h, 18, 24, small ? 0.4 : 0.55));
  const card = new Graphics().roundRect(-width / 2, 2, width, h, small ? 14 : 18).fill(0xc9ae82)
    .roundRect(-width / 2, 0, width, h, small ? 14 : 18).fill(final ? gradient().final : gradient().paper);
  if (final) card.roundRect(-width / 2 - 1.5, -1.5, width + 3, h + 3, small ? 15 : 19).stroke({ width: 3, color: RED });
  bg.addChild(card);
  (bg.children[0] as Graphics).y = h / 2;
  c.addChild(bg);
  if (!small) {
    const clip = new Graphics().roundRect(-32, -14, 64, 22, 5).fill(gradient().brassClip);
    c.addChild(new Graphics().roundRect(-32, -11, 64, 22, 5).fill({ color: 0x000000, alpha: 0.35 }), clip);
  }
  for (const it of items) c.addChild(it);
  return { c, h };
}

// ---------------------------------------------------------------- stamps, confetti, ink

/** A rubber stamp (LIE! red, HOUSE LIE violet, TRUTH green, MOST CONVINCING gold) centred on 0,0, unrotated. */
function stamp(s: string, tone: keyof typeof STAMP_INK, size = 34, maxW = 400, border = 5): Container {
  const c = new Container();
  const col = STAMP_INK[tone];
  const tt = tx(s, size, { w: "900", fill: col, ls: 0.04, wrap: maxW, lh: 1.05 });
  const w = tt.width + 36 + border * 2, h = tt.height + 12 + border * 2;
  const g = new Graphics().roundRect(-w / 2, -h / 2, w, h, 12).fill({ color: CREAM, alpha: 0.9 })
    .roundRect(-w / 2 + border / 2, -h / 2 + border / 2, w - border, h - border, 12 - border / 2).stroke({ width: border, color: col });
  c.addChild(g, tt);
  // Worn ink (the DOM's radial mask): a few paper-coloured nicks in the border and letters.
  const nick = new Graphics();
  for (let i = 0; i < 10; i++) {
    const along = ((i * 0.137 + 0.05) % 1) * (w - 24) - w / 2 + 12;
    const y = i % 2 ? -h / 2 + border / 2 : h / 2 - border / 2;
    nick.circle(along, y, 0.9 + (i % 3) * 0.5).fill({ color: CREAM, alpha: 0.8 });
  }
  c.addChild(nick);
  (c as Container & { boxW: number; boxH: number }).boxW = w;
  (c as Container & { boxW: number; boxH: number }).boxH = h;
  return c;
}
const stampSize = (c: Container): { w: number; h: number } => ({ w: (c as Container & { boxW?: number }).boxW ?? c.width, h: (c as Container & { boxH?: number }).boxH ?? c.height });

class Confetti {
  readonly root = new Container();
  private readonly bits: { g: Graphics; ox: number; a: number; d: number; delay: number }[] = [];
  constructor(n: number, width: number, colors: readonly number[], fromCorners = true) {
    for (let i = 0; i < n; i++) {
      const g = new Graphics().roundRect(-4, -6, 8, 12, 2).fill(colors[i % colors.length]!);
      g.visible = false;
      this.root.addChild(g);
      const ox = fromCorners ? (i % 4 < 2 ? -width / 2 : width / 2) : 0;
      this.bits.push({ g, ox, a: ((i * 47) % 360) * DEG, d: 60 + ((i * 29) % 120), delay: 0 });
    }
  }
  /** p: 0..1 of the burst (rotate(a) translateY(−p·d) rotate(p·540°), fading; a touch of gravity). */
  frame(p: number): void {
    const on = p > 0 && p < 1;
    for (const b of this.bits) {
      b.g.visible = on;
      if (!on) continue;
      const q = easeOut(p);
      b.g.position.set(b.ox + Math.sin(b.a) * b.d * q, -Math.cos(b.a) * b.d * q + 40 * p * p);
      b.g.rotation = b.a + p * 540 * DEG;
      b.g.alpha = 1 - p * 0.9;
    }
  }
}

/** Six ink dots bursting out of a stamp as it lands (DESIGN-JAMAA §5.2, 300 ms). */
class InkSplat {
  readonly root = new Container();
  private readonly dots: Graphics[] = [];
  constructor(color: number, private readonly r: number) {
    for (let i = 0; i < 6; i++) { const g = new Graphics().circle(0, 0, 3 + (i % 3)).fill(color); this.root.addChild(g); this.dots.push(g); }
    this.root.visible = false;
  }
  frame(ms: number): void {
    const q = ms / 300;
    this.root.visible = q > 0 && q < 1;
    if (!this.root.visible) return;
    this.dots.forEach((g, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const d = this.r * (0.7 + 0.5 * easeOut(q));
      g.position.set(Math.cos(a) * d * 1.3, Math.sin(a) * d * 0.8);
      g.alpha = 1 - q;
      g.scale.set(1 - 0.5 * q);
    });
  }
}

// ---------------------------------------------------------------- phases

interface Phase { root: Container; update(m: BluffModel): void; tick(dt: number): void; complete?(): void; destroy(): void }

// ROUND_INTRO (BL-TV-01) --------------------------------------------------------------------------------------------
class IntroPhase implements Phase {
  readonly root = new Container();
  private readonly seats: SeatRow;
  private readonly panel = new Container();
  private readonly name: Text;
  private readonly x2: Container | null = null;
  private age = 0;
  constructor(m: BluffModel) {
    const fin = isFinal(m.pub);
    const r = rtl();
    const w = 640;
    const num = tx(caps(fin ? tk("round.final") : tk("round.number", { round: m.pub.round }), r), 20, { w: "900", fill: BRASS, ls: 0.18 });
    squeeze(num, w - 80);
    const glowCol = fin ? RED : BRASS;
    this.name = tx(t(roundNameKey(m.pub) as MessageKey), 56, { w: "900", fill: CREAM, wrap: w - 80, lh: 1.1, glow: { color: glowCol, blur: 16 } });
    fitText(this.name, [56, 48, 42, 36], 130, 1.1);
    const rule = tx(t(roundIntroKey(m.pub) as MessageKey), fin ? 24 : 22, { w: "700", fill: fin ? CREAM : TEXT2, wrap: w - 80, lh: 1.4 });
    // The panel must clear the café row (characters' heads at SEAT_Y − 72).
    const roomRule = SEAT_Y - 72 - 12 - 92 - 34 - 20 - 14 - this.name.height - 12 - 30;
    fitText(rule, fin ? [24, 22, 20, 18] : [22, 20, 18, 16], Math.max(40, roomRule), 1.4);
    let y = 34;
    num.position.set(0, y + 10); y += 20 + 14;
    this.name.position.set(0, y + this.name.height / 2); y += this.name.height + 12;
    rule.position.set(0, y + rule.height / 2); y += rule.height + 30;
    const h = y;
    this.panel.addChild(shadow(w, h, 28, 30, 0.6));
    (this.panel.children[0] as Graphics).y = h / 2;
    this.panel.addChild(new Graphics().roundRect(-w / 2, 0, w, h, 28).fill(fin ? gradient().introFinal : gradient().intro)
      .roundRect(-w / 2 + 1, 1, w - 2, h - 2, 27).stroke({ width: 2, color: fin ? RED : BRASS, alpha: fin ? 0.6 : 0.55 }));
    this.panel.addChild(num, this.name, rule);
    if (m.pub.multiplier === 2) {
      const x2 = chip("×2", 34, INK, RED, 1, 46, 16);
      x2.position.set(r ? -w / 2 + 18 : w / 2 - 18, -20 + 23);
      x2.rotation = 10 * DEG;
      this.panel.addChild(x2);
      this.x2 = x2;
    }
    this.panel.position.set(W / 2, 92);
    this.panel.pivot.set(0, 0);
    this.seats = new SeatRow(m, { expression: () => (fin ? "smug" : "happy") });
    this.root.addChild(this.panel, this.seats.root);
    this.tick(0);
  }
  update(m: BluffModel): void { this.seats.update(m); }
  tick(dt: number): void {
    this.age += dt;
    const calm = reduced();
    // bf-deal (720 ms overshoot): drops in from −60 dp with a −6° tilt.
    const q = calm ? 1 : prog(this.age, 0, 720);
    const e = overshoot(q);
    this.panel.alpha = Math.min(1, q / 0.6);
    this.panel.y = 92 - 60 * (1 - e);
    this.panel.rotation = -6 * DEG * (1 - e);
    this.panel.scale.set(0.9 + 0.1 * e);
    this.name.alpha = calm ? 1 : neonAlpha(this.age, 200);
    if (this.x2) {
      const s = calm ? 1 : prog(this.age, 500, 520);
      this.x2.alpha = s > 0 ? 1 : 0;
      this.x2.scale.set(2 - overshoot(s));
    }
    this.seats.tick(dt);
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

// WRITING (BL-TV-02) ------------------------------------------------------------------------------------------------
class WritingPhase implements Phase {
  readonly root = new Container();
  private readonly seats: SeatRow;
  private readonly card: Container | null = null;
  private readonly boxC = new Container();
  private readonly count: BitmapText;
  private readonly envs: { id: string; s: ArtSprite; age: number }[] = [];
  private readonly envLayer = new Container();
  private banner: Container | null = null;
  private waitingC: Container | null = null;
  private waitingKey = "";
  private age = 0;
  private late = false;
  private m: BluffModel;
  private lastCheck = -1e9;
  constructor(m: BluffModel) {
    this.m = m;
    const p = m.pub.prompt;
    if (p) {
      const { c } = promptCard(p, isFinal(m.pub), false, 620, SEAT_Y - 72 - 14 - 118);
      c.position.set(W / 2, 118);
      this.card = c;
      this.root.addChild(c);
    }
    // The ballot box (end side): brass box, slot, the count.
    const r = rtl();
    const bx = mx(W - 44 - 43, r);
    this.boxC.position.set(bx, 300 + 29);
    this.boxC.addChild(shadow(86, 58, 12, 10, 0.5));
    this.boxC.addChild(new Graphics().roundRect(-43, -29, 86, 58, 10).fill(gradient().box).rect(-41, -27, 82, 2).fill({ color: 0x9a6a34 }));
    this.envLayer.position.set(0, -29 - 20 + 13);
    this.boxC.addChild(this.envLayer, new Graphics().roundRect(-27, -29 - 20 + 26 - 9, 54, 5, 3).fill(0x1c1209));
    this.count = num("", 22, GOLDL);
    this.boxC.addChild(this.count);
    if (m.pub.notice === "tooFamous") {
      const b = new Container();
      const tt = tx(tk("prompt.tooFamous"), 24, { w: "900", fill: INK, maxW: 700 });
      b.addChild(shadow(tt.width + 44, 40, 12, 10, 0.5), box(tt.width + 44, 40, 12, RED), tt);
      b.position.set(W / 2, 70 + 20);
      b.rotation = -3 * DEG;
      this.banner = b;
    }
    this.seats = new SeatRow(m, this.seatOpts(m));
    this.root.addChild(this.boxC, this.seats.root);
    if (this.banner) this.root.addChild(this.banner);
    for (const id of m.pub.submittedIds.slice(-3)) this.addEnv(id);
    this.update(m);
  }
  private seatOpts(m: BluffModel): SeatOpts {
    return { expression: (s) => baseExpression(m, s), prop: (s) => propOf(m, s), spotlight: (s) => this.late && !m.pub.submittedIds.includes(s.id) && countedSeats(m).some((x) => x.id === s.id) };
  }
  private addEnv(id: string): void {
    if (this.envs.some((e) => e.id === id)) return;
    const s = new ArtSprite("envelope", 26, 26);
    this.envLayer.addChild(s);
    this.envs.push({ id, s, age: 0 });
  }
  update(m: BluffModel): void {
    const before = this.m.pub.submittedIds;
    this.m = m;
    for (const id of m.pub.submittedIds) if (!before.includes(id)) this.addEnv(id);
    const players = countedSeats(m);
    const inCount = m.pub.submittedIds.filter((id) => players.some((s) => s.id === id)).length;
    this.count.text = `${inCount}/${players.length}`;
    this.seats.update(m, this.seatOpts(m));
    this.refreshLate(true);
  }
  private refreshLate(force: boolean): void {
    const m = this.m;
    const left = m.pub.deadline ? m.pub.deadline - serverNow() : Infinity;
    const late = left <= 10_000;
    const waiting = late ? countedSeats(m).filter((s) => !m.pub.submittedIds.includes(s.id)) : [];
    const key = `${late}|${waiting.map((s) => s.id).join(",")}|${locale.value}`;
    if (!force && key === this.waitingKey) return;
    const changed = late !== this.late;
    this.late = late;
    if (changed) this.seats.update(m, this.seatOpts(m));
    if (key === this.waitingKey) return;
    this.waitingKey = key;
    this.waitingC?.destroy({ children: true });
    this.waitingC = null;
    if (waiting.length > 0) {
      const c = new Container();
      const tt = tx(`${tk("write.waitingFor")} ${listOf(waiting.map((s) => isolate(s.name)))}`, 20, { w: "800", fill: GOLDL, wrap: 820, lh: 1.2 });
      c.addChild(box(tt.width + 28, tt.height + 10, 18, INK, 0.72), tt);
      // Under the name plates (the pill row is empty while writing): it never covers a character, unlike the DOM's spot.
      c.position.set(W / 2, PILL_Y + 2);
      this.waitingC = c;
      this.root.addChild(c);
    }
  }
  tick(dt: number): void {
    this.age += dt;
    const calm = reduced();
    if (this.card) {
      const q = calm ? 1 : prog(this.age, 0, 640);
      const e = overshoot(q);
      this.card.alpha = Math.min(1, q / 0.6);
      this.card.y = 118 - 60 * (1 - e);
      this.card.rotation = -6 * DEG * (1 - e);
      this.card.scale.set(0.9 + 0.1 * e);
    }
    if (this.banner) {
      const q = calm ? 1 : prog(this.age, 0, 520);
      this.banner.alpha = Math.min(1, q * 2);
      this.banner.scale.set(1.8 - 0.8 * overshoot(q));
    }
    for (const e of this.envs) {
      e.age += dt;
      const d = envDrop(calm ? 700 : e.age);
      e.s.position.set(0, d.y);
      e.s.rotation = d.rot * DEG;
      e.s.alpha = d.a;
    }
    if (this.waitingC) this.waitingC.alpha = Math.min(1, this.waitingC.alpha + dt / 300);
    if (this.age - this.lastCheck > 250) { this.lastCheck = this.age; this.refreshLate(false); }
    this.seats.tick(dt);
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

// VOTING (BL-TV-03) -------------------------------------------------------------------------------------------------
/** The corkboard's notes (VOTING; mini and letterless in the reveal's intro beat). Returns the board and its bottom. */
function buildBoard(m: BluffModel, top: number, bottom: number, mini: boolean): { c: Container; notes: Container[]; bottom: number } {
  const opts = m.pub.options;
  const st = boardStyle(opts.length);
  const r = rtl();
  const letters = optionLetters(m);
  const c = new Container();
  const lw = mini ? 0 : st.letter + 12;
  const textW = st.colW - 12 - 16 - lw;
  const sizes = st.dense ? [16, 15, 14, 13] : [st.font, st.font - 2, st.font - 4, 15, 14];
  const texts = opts.map((o) => tx(o.text, st.font, { auto: true, w: "800", fill: INK, wrap: textW, lh: st.dense ? 1.15 : 1.2, align: mini ? "center" : r ? "right" : "left", ax: mini ? 0.5 : r ? 1 : 0 }));
  let heights: number[] = [];
  const measure = (sz: number): boolean => {
    for (const t2 of texts) { t2.style.fontSize = sz; t2.style.lineHeight = Math.round(sz * (st.dense ? 1.15 : 1.2)); }
    const noteH = texts.map((t2) => Math.max(st.minH, t2.height + st.padY * 2));
    heights = [];
    for (let i = 0; i < noteH.length; i += st.cols) heights.push(Math.max(noteH[i]!, noteH[i + 1] ?? 0));
    return top + stackHeight(heights, st.gapY) <= bottom;
  };
  pickSize(sizes, measure);
  measure(texts[0] ? texts[0].style.fontSize as number : st.font);
  const tops = rowTops(heights, top, st.gapY);
  const notes: Container[] = [];
  opts.forEach((o, i) => {
    const { row, col } = boardCell(i, st.cols, r);
    const h = heights[row]!;
    const x = st.left + col * (st.colW + st.gapX);
    const n = new Container();
    n.position.set(x + st.colW / 2, tops[row]! + h / 2);
    const w = st.colW;
    n.addChild(new Graphics().roundRect(-w / 2 + 2, -h / 2 + 8, w - 4, h, 6).fill({ color: 0x000000, alpha: 0.28 }));
    n.addChild(new Graphics().roundRect(-w / 2, -h / 2 + 2, w, h, 6).fill(0xc9ae82).roundRect(-w / 2, -h / 2, w, h, 6).fill(PAPER));
    if (!mini) {
      n.addChild(new Graphics().circle(1, -h / 2 + 1, 6).fill({ color: 0x000000, alpha: 0.4 }).circle(0, -h / 2, 6).fill(0xc8362f).circle(-1.8, -h / 2 - 1.8, 2.4).fill({ color: 0xff9a9d }));
      const lx = r ? w / 2 - 12 - st.letter / 2 : -w / 2 + 12 + st.letter / 2;
      const lt = tx(letters.get(o.id) ?? letterOf(i), st.dense ? 12 : 14, { w: "900", fill: GOLDL, raw: true });
      lt.x = lx;
      n.addChild(new Graphics().circle(lx, 0, st.letter / 2).fill(INK), lt);
    }
    const t2 = texts[i]!;
    t2.position.set(mini ? 0 : r ? w / 2 - 12 - lw : -w / 2 + 12 + lw, 0);
    n.addChild(t2);
    n.rotation = mini ? 0 : tiltOf(i) * DEG;
    c.addChild(n);
    notes.push(n);
  });
  // Still too tall at the smallest size (13 long answers): the whole board scales down from its top centre.
  const total = stackHeight(heights, st.gapY);
  const k = top + total > bottom ? (bottom - top) / total : 1;
  if (k < 1) { c.scale.set(k); c.position.set((W / 2) * (1 - k), top * (1 - k)); }
  return { c, notes, bottom: top + total * k };
}

class VotingPhase implements Phase {
  readonly root = new Container();
  private readonly seats: SeatRow;
  private readonly notes: Container[];
  private readonly baseY: number[];
  private readonly knew: Container | null = null;
  private age = 0;
  constructor(m: BluffModel) {
    const r = rtl();
    // The head strip (58–118 dp): the title row, then the prompt on its own line.
    const head = new Container();
    const fin = isFinal(m.pub);
    const title = tx(fin ? tk("vote.titleNoTruth") : tk("vote.title"), 24, { w: "900" });
    const parts: Container[] = [title];
    if (fin) parts.push(chip(tk("noTruth.chip"), 14, INK, RED));
    if (m.pub.options.length === 2) parts.push(chip(tk("vote.easyOne"), 14, BRASS, BRASS, 0.18));
    const total = parts.reduce((a, p) => a + p.width, 0) + 12 * (parts.length - 1);
    let x = 0;
    for (const p of r ? [...parts].reverse() : parts) { p.position.set(W / 2 - total / 2 + x + p.width / 2, 58 + 15); x += p.width + 12; head.addChild(p); }
    if (total > 840) head.scale.set(840 / total);
    if (m.pub.prompt) {
      const pt = tx(m.pub.prompt.display ?? m.pub.prompt.original, 18, { auto: true, w: "700" });
      squeeze(pt, 792);
      const pw = pt.width + 28;
      const pc = new Container();
      pc.addChild(box(pw, 28, 14, INK, 0.78), pt);
      pc.position.set(W / 2, 58 + 33 + 14);
      this.root.addChild(pc);
    }
    this.root.addChild(head);
    const board = buildBoard(m, 126, SEAT_Y - 72 - 14, false);
    this.notes = board.notes;
    this.baseY = board.notes.map((n) => n.y);
    this.root.addChild(board.c);
    this.seats = new SeatRow(m, {
      expression: (s) => baseExpression(m, s), prop: (s) => propOf(m, s),
      pin: (s) => (m.pub.spotOnIds.includes(s.id) ? tk("reveal.knewItPin") : null),
    });
    this.root.addChild(this.seats.root);
    if (m.pub.spotOnIds.length > 0 && !reduced()) {
      const k2 = new Container();
      k2.addChild(new Graphics().rect(0, 0, W, H).fill({ color: INK, alpha: 0.55 }));
      const names = listOf(m.pub.spotOnIds.map((id) => isolate(m.byId.get(id)?.name ?? "")));
      const tt = tx(tk("vote.knewIt", { names }), 34, { w: "900", fill: INK, wrap: 760, lh: 1.2 });
      const inner = new Container();
      inner.addChild(shadow(tt.width + 72, tt.height + 36, 22, 20, 0.45), box(tt.width + 72, tt.height + 36, 22, gradient().gold), tt);
      inner.position.set(W / 2, H / 2);
      inner.rotation = -3 * DEG;
      k2.addChild(inner);
      this.knew = k2;
      this.root.addChild(k2);
    }
    this.tick(0);
  }
  update(m: BluffModel): void {
    this.seats.update(m, {
      expression: (s) => baseExpression(m, s), prop: (s) => propOf(m, s),
      pin: (s) => (m.pub.spotOnIds.includes(s.id) ? tk("reveal.knewItPin") : null),
    });
  }
  tick(dt: number): void {
    this.age += dt;
    const calm = reduced();
    // bf-pin: each note drops onto the board (520 ms overshoot, 70 ms stagger).
    this.notes.forEach((n, i) => {
      const q = calm ? 1 : prog(this.age, i * 70, 520);
      const e = overshoot(q);
      n.alpha = Math.min(1, q * 2);
      n.y = this.baseY[i]! - 30 * (1 - e);
      n.rotation = tiltOf(i) * DEG * (1 + 3 * (1 - e));
      n.scale.set(0.92 + 0.08 * e);
    });
    if (this.knew) { const a = knewAlpha(this.age); this.knew.alpha = a; this.knew.visible = a > 0; }
    this.seats.tick(dt);
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

// HOLD --------------------------------------------------------------------------------------------------------------
class HoldPhase implements Phase {
  readonly root = new Container();
  private readonly seats: SeatRow;
  private readonly title: Text;
  constructor(m: BluffModel) {
    const w = 560;
    const panel = new Container();
    this.title = tx("", 30, { w: "900", wrap: w - 64, lh: 1.2 });
    const code = tx(m.roomCode.split("").join(" "), 72, { w: "900", fill: BRASS, raw: true, glow: { color: BRASS, blur: 24, alpha: 0.35 } });
    const url = tx(m.joinUrl.replace(/^https?:\/\//, ""), 18, { w: "700", fill: MUTED, raw: true });
    squeeze(url, w - 64);
    this.setTitle(m);
    let y = 32;
    this.title.position.set(0, y + 18); y += 36 + 18;
    code.position.set(0, y + 36); y += 72 + 18;
    url.position.set(0, y + 9); y += 18 + 32;
    panel.addChild(box(w, y, 26, 0x1c1209, 0.9, { color: BRASS, width: 2, alpha: 0.4 }));
    (panel.children[0] as Graphics).y = y / 2;
    panel.addChild(this.title, code, url);
    panel.position.set(W / 2, 120);
    this.seats = new SeatRow(m, { expression: (s) => (s.connected ? "think" : "away") });
    this.root.addChild(panel, this.seats.root);
  }
  private setTitle(m: BluffModel): void {
    const n = activeSeats(m).filter((s) => s.connected).length;
    this.title.text = bidi(tk("hold.waiting", { count: Math.min(3, n) }), rtl());
    squeeze(this.title, 496);
  }
  update(m: BluffModel): void { this.setTitle(m); this.seats.update(m); }
  tick(dt: number): void { this.seats.tick(dt); }
  destroy(): void { this.root.destroy({ children: true }); }
}

// SCORES (BL-TV-06) -------------------------------------------------------------------------------------------------
class ScoresPhase implements Phase {
  readonly root = new Container();
  private readonly rows: { s: Seat; c: Container; actor: Actor; bar: Graphics; place: BitmapText; delta: Container; from: number; to: number; up: boolean; y0: number; y1: number }[] = [];
  private stage = 0;
  private age = 0;
  private readonly notes = new Container();
  private readonly crowns: ArtSprite[] = [];
  private readonly calm = reduced();
  private readonly rowH: number;
  private readonly m: BluffModel;
  constructor(m: BluffModel) {
    this.m = m;
    if (m.pub.voided) {
      const c = new Container();
      const tt = tx(tk("prompt.voided"), 28, { w: "900", maxW: 700 });
      const icon = new ArtSprite("arrowFwd", 28, 28);
      const r = rtl();
      if (r) icon.scale.x *= -1;
      const w = tt.width + 28 + 12 + 68;
      c.addChild(box(w, 68, 20, 0x1c1209, 0.92, { color: CREAM, width: 2, alpha: 0.2 }));
      icon.x = (r ? 1 : -1) * (w / 2 - 34 - 14);
      tt.x = icon.x + (r ? -1 : 1) * (14 + 12 + tt.width / 2);
      c.addChild(icon, tt);
      c.position.set(W / 2, 200 + 34);
      this.root.addChild(c);
      this.rowH = 0;
      return;
    }
    const r = rtl();
    const head = tx(caps(tk("scores.title"), r), 26, { w: "900", fill: BRASS, ls: 0.08, maxW: 700 });
    head.position.set(W / 2, 70 + 13);
    this.root.addChild(head);
    const seats = m.seats.filter((s) => !s.left || s.score > 0);
    const before = ranked(seats, "scoreBefore"), after = ranked(seats, "score");
    const rows = Math.min(seats.length, 12);
    const rowH = raceRowH(rows);
    this.rowH = rowH;
    const max = Math.max(1, ...seats.map((s) => s.score));
    const cs = rowH >= 44 ? 40 : 28;
    for (const s of seats) {
      const c = new Container();
      const rb = before.findIndex((x) => x.id === s.id), ra = after.findIndex((x) => x.id === s.id);
      const chipC = s.isNew ? chip(tk("scores.new"), 13, BRASS, BRASS, 0.18, 22, 8) : null;
      const cols = raceCols(chipC ? chipC.width : 0);
      const cy = (rowH - 4) / 2;
      const place = num("", 16, MUTED);
      place.anchor.set(r ? 0 : 1, 0.5);
      place.position.set(mx(cols.placeEnd, r), cy);
      const actor = new Actor(s.color, cs, "idle", rb);
      actor.position.set(mx(cols.char, r), cy + cs / 2);
      const name = tx(s.name, 17, { auto: true, w: "800", ax: r ? 1 : 0, align: r ? "right" : "left" });
      squeeze(name, cols.nameW);
      name.position.set(mx(cols.name, r), cy);
      c.addChild(place, actor, name);
      if (chipC) { chipC.position.set(mx(cols.name + cols.nameW + 10 + chipC.width / 2, r), cy); c.addChild(chipC); }
      const tw = cols.trackB - cols.trackA;
      const trackX = r ? W - cols.trackB : cols.trackA;
      c.addChild(new Graphics().roundRect(trackX, cy - 9, tw, 18, 9).fill({ color: CREAM, alpha: 0.07 }));
      const bar = new Graphics().roundRect(0, -9, tw, 18, 9).fill(colorHex(s.color));
      bar.position.set(r ? W - cols.trackA : cols.trackA, cy);
      if (r) bar.scale.x = -1;
      c.addChild(bar);
      const score = num(String(s.score), 20, CREAM);
      score.anchor.set(r ? 0 : 1, 0.5);
      score.position.set(mx(cols.scoreEnd, r), cy);
      c.addChild(score);
      const delta = new Container();
      if (s.score > s.scoreBefore) {
        const d = num(`+${s.score - s.scoreBefore}`, 15, SUCCESS);
        d.anchor.set(r ? 1 : 0, 0.5);
        delta.addChild(d);
      }
      delta.position.set(mx(cols.delta, r), cy);
      delta.visible = false;
      c.addChild(delta);
      if (s.left) c.alpha = 0.45;
      const y0 = RACE.top + rb * rowH, y1 = RACE.top + ra * rowH;
      c.y = y0;
      this.root.addChild(c);
      const crown = new ArtSprite("crown", cs * 0.42, cs * 0.28, 0.5, 1);
      crown.position.set(0, -cs * 0.66);
      crown.visible = false;
      actor.addChild(crown);
      this.crowns.push(crown);
      this.rows.push({ s, c, actor, bar, place, delta, from: barScale(s.scoreBefore, max), to: barScale(s.score, max), up: ra < rb, y0, y1 });
    }
    this.root.addChild(this.notes);
    this.setStage(this.calm ? 2 : 0);
  }
  private setStage(st: number): void {
    this.stage = st;
    const m = this.m;
    const seats = m.seats.filter((s) => !s.left || s.score > 0);
    const before = ranked(seats, "scoreBefore"), after = ranked(seats, "score");
    const leader = after[0];
    for (const row of this.rows) {
      const s = row.s;
      row.place.text = String(placeOf(st === 2 ? after : before, s.id, st === 2 ? "score" : "scoreBefore"));
      const lead = st === 2 && s.id === leader?.id && s.score > 0;
      row.actor.expr = lead ? "cheer" : s.score > s.scoreBefore && st >= 1 ? "happy" : "idle";
      (row.actor.children.find((c) => c instanceof ArtSprite) as ArtSprite | undefined)!.visible = lead;
      if (st >= 1 && !row.delta.visible) { row.delta.visible = true; row.delta.scale.set(this.calm ? 1 : 0.6); }
    }
    if (st === 2) this.buildNotes(before, after);
    if (st === 0) for (const row of this.rows) row.bar.scale.x = (rtl() ? -1 : 1) * row.from;
  }
  private buildNotes(before: Seat[], after: Seat[]): void {
    const m = this.m;
    const leader = after[0], leaderBefore = before[0];
    const newLeader = !!leader && leader.score > 0 && leader.id !== leaderBefore?.id && after.filter((s) => s.score === leader.score).length === 1;
    const last = after[after.length - 1];
    const comeback = !!last && !!leader && leader.score - last.score > 400 && after.length > 2;
    const tease = m.pub.promptIndex + 2 === m.pub.promptCount;
    const bubbles: Container[] = [];
    if (newLeader && leader) {
      const b = new Container();
      const tt = tx(tk("scores.newLeader"), 18, { w: "800", fill: INK });
      const a = new Actor(leader.color, 28, "cheer");
      const w = tt.width + 28 + 8 + 36;
      b.addChild(box(w, 36, 18, gradient().gold));
      const r = rtl();
      a.position.set((r ? 1 : -1) * (w / 2 - 18 - 14), 14);
      const cr = new ArtSprite("crown", 16, 11, 0.5, 1);
      cr.position.set(0, -26);
      a.addChild(cr);
      tt.x = a.x + (r ? -1 : 1) * (14 + 8 + tt.width / 2);
      b.addChild(a, tt);
      bubbles.push(b);
    }
    if (comeback && last) {
      const b = new Container();
      const tt = tx(`${isolate(last.name)} · ${tk("scores.comeback")}`, 18, { w: "800" });
      b.addChild(box(tt.width + 36, 36, 18, INK, 0.8, { color: CREAM, width: 1.5, alpha: 0.2 }), tt);
      bubbles.push(b);
    }
    if (tease) {
      const b = new Container();
      const tt = tx(tk("scores.finalTease"), 18, { w: "800", fill: INK });
      b.addChild(box(tt.width + 36, 36, 18, RED), tt);
      bubbles.push(b);
    }
    this.layoutNotes(bubbles);
  }
  private layoutNotes(bubbles: Container[]): void {
    this.notes.removeChildren().forEach((c) => c.destroy({ children: true }));
    const r = rtl();
    const total = bubbles.reduce((a, b) => a + b.width, 0) + 16 * Math.max(0, bubbles.length - 1);
    let x = 0;
    for (const b of r ? [...bubbles].reverse() : bubbles) { b.position.set(W / 2 - total / 2 + x + b.width / 2, H - 40 - 18); x += b.width + 16; this.notes.addChild(b); }
    if (total > 900) { this.notes.scale.set(900 / total); this.notes.pivot.set(W / 2, H - 58); this.notes.position.set(W / 2, H - 58); }
    (this.notes as Container & { born: number }).born = this.age;
  }
  update(): void { /* the race plays from the snapshot */ }
  tick(dt: number): void {
    this.age += dt;
    if (this.rowH === 0) return;
    const calm = this.calm;
    if (!calm && this.stage === 0 && this.age >= 250) this.setStage(1);
    if (!calm && this.stage === 1 && this.age >= 1650) this.setStage(2);
    const r = rtl();
    const grow = calm ? 1 : easeOut(prog(this.age, 250, 1200));
    const sort = calm ? 1 : prog(this.age, 1650, 520);
    const so = overshoot(sort);
    for (const row of this.rows) {
      row.bar.scale.x = (r ? -1 : 1) * (row.from + (row.to - row.from) * grow);
      row.c.y = this.stage < 2 ? row.y0 : row.y0 + (row.y1 - row.y0) * so;
      row.actor.tick(dt, calm);
      if (row.up && this.stage === 2 && !calm) row.actor.y = (row.actor.y * 0) + ((this.rowH - 4) / 2 + row.actor.size / 2) - 14 * Math.sin(Math.PI * clamp01(sort));
      if (row.delta.visible && row.delta.scale.x < 1) row.delta.scale.set(Math.min(1, row.delta.scale.x + dt / 360 * 0.4));
    }
    const born = (this.notes as Container & { born?: number }).born;
    if (born !== undefined) { const q = calm ? 1 : prog(this.age, born, 420); this.notes.alpha = Math.min(1, q * 2); }
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

// REVEAL (BL-TV-05) -------------------------------------------------------------------------------------------------

const KEYS: Record<string, Record<string, string>> = {};
/** A step id `b<i>.<name>`, interned (built once, then read without allocating in the frame loop). */
function key(pid: string, name: string): string {
  const o = (KEYS[pid] ??= {});
  return (o[name] ??= `${pid}.${name}`);
}

/** One prebuilt beat: its pieces live in the reveal's z-layers and show together; `frame` drives them. */
interface BeatView {
  parts: Container[];
  frame(p: (id: string, i?: number) => number, tMs: number, mark: Mark): void;
}

function stampFor(s: RevealStep): { tone: "lie" | "house" | "truth"; key: string } {
  return s.kind === "truth" ? { tone: "truth", key: "reveal.truth" } : s.kind === "house" ? { tone: "house", key: "reveal.house" } : { tone: "lie", key: "reveal.lie" };
}

/** The spotlight card (.bfcard): paper, its text auto-sized, optionally gold; top-centre at 0,0. */
function spotCard(text: string, w: number, minH: number, maxText = 96): { c: Container; h: number; text: Text } {
  const c = new Container();
  const tt = tx(text, 34, { auto: true, w: "900", fill: INK, wrap: w - 68, lh: 1.2 });
  fitText(tt, [34, 30, 27, 24, 21, 19], maxText, 1.2);
  const h = Math.max(minH, tt.height + 44);
  const sh = shadow(w, h, 16, 30, 0.6);
  sh.y = h / 2;
  c.addChild(sh, new Graphics().roundRect(-w / 2, 3, w, h, 16).fill(0xc9ae82).roundRect(-w / 2, 0, w, h, 16).fill(PAPER));
  tt.position.set(0, h / 2);
  c.addChild(tt);
  return { c, h, text: tt };
}

class RevealPhase implements Phase {
  readonly root = new Container();
  private readonly lIntro = new Container();
  private readonly lSeats = new Container();
  private readonly lPop = new Container();
  private readonly lCard = new Container();
  private readonly lCap = new Container();
  private readonly lHop = new Container();
  private readonly lFly = new Container();
  private readonly seats: SeatRow;
  private readonly r: Reveal;
  private readonly plan: RevealPlan;
  private readonly tl: { beats: TimedBeat[] };
  private readonly scores: Map<string, number>[];
  private readonly views: (BeatView | null)[] = [];
  private readonly endView: Container;
  private readonly calm = reduced();
  private readonly rtl = rtl();
  private readonly pos: Map<string, number>;
  private readonly HOP: number;
  private bi = -1;
  private mark: Mark = 0;
  private ended = false;
  private endAge = 0;
  private shakeMs = 0;
  private readonly runner: Run;
  private readonly wrapped: Run;
  private m: BluffModel;
  private readonly actors: Actor[] = [];
  private beatT = 0;
  constructor(m: BluffModel, private readonly onRunning: (running: boolean) => void) {
    this.m = m;
    const r = m.pub.reveal!;
    this.r = r;
    this.plan = revealPlan(r, this.calm);
    const tl = revealTimeline(r, this.plan);
    this.tl = tl;
    this.scores = runningScores(m, this.plan);
    const seats = m.seats.filter((s) => !s.left || s.score > 0);
    this.pos = new Map(seats.map((s, i) => [s.id, seatX(seats.length, i, this.rtl)]));
    this.HOP = hopSize(seats.length);
    preloadChars(seats.map((s) => s.color));
    if (m.pub.prompt) {
      const { c } = promptCard(m.pub.prompt, r.final, true, 600, 64);
      c.position.set(W / 2, 58);
      this.lIntro.addChild(c);
    }
    this.seats = new SeatRow(m, { expression: (s) => this.exprOf(s), pills: true });
    for (const s of seats) this.seats.pillValue(s.id, this.scores[0]?.get(s.id) ?? s.score);
    this.lSeats.addChild(this.seats.root);
    this.root.addChild(this.lIntro, this.lSeats, this.lPop, this.lCard, this.lCap, this.lHop, this.lFly);
    this.plan.beats.forEach((b, i) => this.views.push(this.buildBeat(b, i)));
    this.endView = this.buildEnd();
    this.endView.visible = false;
    this.lCard.addChild(this.endView);
    for (const v of this.views) v?.parts.forEach((p) => { p.visible = false; });

    // The run (the DOM's TvReveal effect): joining mid-way starts at "now" in the reveal, old cues stay silent.
    const elapsed = revealElapsed(m.pub.deadline, r.durationMs, serverNow(), this.plan.total);
    const fired = new Set<string>();
    let silent = elapsed > 0;
    /** True the first time `id` fires (and not while catching up silently): the DOM's `once`, without a closure. */
    const fire = (id: string): boolean => { if (fired.has(id)) return false; fired.add(id); return !silent; };
    // Everything a frame needs per beat, built once (no string or array allocation per frame).
    const flights = this.likeFlights();
    const keys = this.plan.beats.map((beat, b) => {
      const coins = coinsOf(r, beat);
      const from = this.scores[b]!, to = this.scores[b + 1]!;
      return {
        tick: `b${b}.tick`, jump: `b${b}.jump`, coin: `b${b}.coin`, heart: `b${b}.heart`,
        hops: hoppers(r, beat).length, coins, step: r.steps[beat.steps[0] ?? -1],
        changed: [...to].some(([id, v]) => from.get(id) !== v),
        once: { intro: "intro", drum: `b${b}.drum`, st: `b${b}.st`, shake: `b${b}.shake`, crown: `b${b}.crown`, twist: `b${b}.twist`, pop: `b${b}.pop`, fly: `b${b}.fly`, tick: `b${b}.tickS`, m: `b${b}.m`, l: `b${b}.l` },
        tok: Array.from({ length: hoppers(r, beat).length }, (_, i) => `b${b}.tok${i}`),
        land: coins.map((_, i) => `b${b}.land${i}`), bump: coins.map((_, i) => `b${b}.bump${i}`), hb: flights.map((_, i) => `b${b}.hb${i}`),
      };
    });
    const ids = [...this.pos.keys()];
    let landedN = 0;
    let curBeat = -1;
    const frameAt = (p: (id: string, i?: number) => number, tMs: number): void => {
      const b = beatAt(this.plan, tMs);
      const tb = tl.beats[b]!;
      const beat = this.plan.beats[b]!;
      const kb = keys[b]!;
      const mk = markAt(tb.marks, beat, tMs);
      if (b !== curBeat) { curBeat = b; landedN = 0; }
      this.show(b, mk, tMs);
      this.views[b]?.frame(p, tMs, mk);
      // Odometers: this beat's running totals, rolled by its tick step.
      const from = this.scores[b]!, to = this.scores[b + 1]!;
      const kk = p(kb.tick);
      for (const id of ids) { const a = from.get(id) ?? 0, z = to.get(id) ?? a; this.seats.pillValue(id, a + (z - a) * clamp01(kk)); }
      // Sounds (DESIGN-JAMAA §5.5), the DOM's exact cues and order.
      const kind = beat.kind, step = kb.step, o = kb.once;
      if (kind === "intro" && fire(o.intro)) cue("sfx.drumroll");
      if (kind === "lie" || kind === "truth") for (let i = 0; i < kb.hops; i++) if (p(kb.jump, i) >= 0.95 && fire(kb.tok[i]!)) sfx("tok", riseRate(i));
      if (kind === "lie" && mk >= 1 && fire(o.drum)) cue("sfx.drumroll");
      if (mk >= 2 && step) {
        if (kind === "truth") { if (fire(o.st)) cue("truth_reveal"); }
        else if (kind === "lie" || kind === "quick") { if (fire(o.st)) { if (step.kind === "house") cue("house_got_you"); else sfx("stamp_lie"); } }
        else if (kind === "answer" && fire(o.st)) sfx("envelope");
      }
      if (mk >= 2 && (kind === "lie" || kind === "quick" || kind === "truth" || kind === "crown") && fire(o.shake)) this.shakeMs = 220;
      if (kind === "crown" && mk >= 2 && fire(o.crown)) cue("crown_drop");
      if (kind === "twist" && mk >= 2 && fire(o.twist)) cue("sfx.flip");
      if (mk >= 3 && (kind === "lie" || kind === "answer") && step && step.authorIds.length > 0 && fire(o.pop)) cue("reaction_pop");
      if (kb.coins.length > 0 && p(kb.coin) > 0 && fire(o.fly)) cue("coin_fly");
      for (let i = 0; i < kb.coins.length; i++) {
        if (p(kb.coin, i) < 1) continue;
        if (landedN < 10 && fire(kb.land[i]!)) { cue("coin_land"); landedN++; }
        if (fire(kb.bump[i]!)) this.seats.bump(kb.coins[i]!.to);
      }
      if (kk > 0 && kb.changed && fire(o.tick)) cue("counter_tick");
      if (kind === "montage" && fire(o.m)) cue("sfx.leave");
      if (kind === "likes") {
        if (p(kb.heart) > 0 && fire(o.l)) sfx("like");
        // Hearts landing bump the liked authors' pills.
        for (let i = 0; i < flights.length; i++) if (p(kb.heart, i) >= 1 && fire(kb.hb[i]!)) this.seats.bump(flights[i]!.to);
      }
    };
    const frame = (p: (id: string, i?: number) => number, tLocal: number): void => { frameAt(p, tLocal + elapsed); silent = false; };
    const steps = elapsed > 0 ? tl.steps.map((st) => ({ ...st, startMs: st.startMs - elapsed })) : tl.steps;
    this.onRunning(true);
    const runner = run(steps, frame, () => { clearChoreo(this.wrapped); this.finish(); });
    this.runner = runner;
    this.wrapped = { complete: () => { stopAll(); runner.complete(); }, cancel: runner.cancel, get running() { return runner.running; } };
    setChoreo(this.wrapped);
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.endAge = 0;
    for (const v of this.views) v?.parts.forEach((p) => { p.visible = false; });
    this.endView.visible = true;
    for (const s of this.m.seats) { this.seats.setAway(s.id, false); this.seats.pillValue(s.id, s.score); }
    this.onRunning(false);
  }

  private exprOf(s: Seat): Expression {
    if (this.ended || this.bi < 0) return seatExpression(this.r, { kind: "intro", start: 0, dur: 0, steps: [] }, 0, s, this.ended);
    return seatExpression(this.r, this.plan.beats[this.bi]!, this.mark, s, false);
  }

  /** Switches the visible beat; seats lifted onto the card hide in their chairs. */
  private show(b: number, mk: Mark, tMs: number): void {
    this.beatT = tMs;
    this.mark = mk;
    if (b === this.bi) return;
    const old = this.views[this.bi];
    old?.parts.forEach((p) => { p.visible = false; });
    this.bi = b;
    this.views[b]?.parts.forEach((p) => { p.visible = true; });
    const beat = this.plan.beats[b]!;
    const step = this.r.steps[beat.steps[0] ?? -1];
    const away = new Set([...hoppers(this.r, beat), ...(beat.kind === "truth" && step ? step.spotOnIds : [])]);
    for (const [id] of this.pos) this.seats.setAway(id, away.has(id));
  }

  private likeFlights(): { from: string; to: string }[] {
    const out: { from: string; to: string }[] = [];
    for (const s of [...this.r.steps, ...this.r.unpicked]) {
      if (s.likerIds.length === 0 || s.authorIds.length === 0) continue;
      for (const l of s.likerIds) for (const a of s.authorIds) out.push({ from: l, to: a });
    }
    return out.slice(0, 24);
  }

  private add(layer: Container, c: Container, parts: Container[]): void { layer.addChild(c); parts.push(c); }

  private actor(s: Seat, size: number, e: Expression): Actor { const a = new Actor(s.color, size, e, this.actors.length); this.actors.push(a); return a; }

  private buildBeat(b: Beat, i: number): BeatView | null {
    const r = this.r, m = this.m;
    const pid = `b${i}`;
    const step = r.steps[b.steps[0] ?? -1];
    switch (b.kind) {
      case "intro": return this.buildIntro(pid, b);
      case "lie": case "quick": case "truth": return step ? this.buildLie(pid, b, step) : null;
      case "answer": return step ? this.buildAnswer(pid, b, step) : null;
      case "crown": return this.buildCrown(pid, b);
      case "twist": return this.buildTwist(pid);
      case "montage": return this.buildMontage(pid);
      case "likes": return this.buildLikes(pid);
      default: void m; return null;
    }
  }

  // ------------------------------------------------ intro: the board slides down and dims; the host card asks the room
  private buildIntro(pid: string, b: Beat): BeatView {
    const r = this.r, m = this.m;
    const parts: Container[] = [];
    const board = buildBoard(m, 140, SEAT_Y - 80, true);
    const holder = new Container();
    holder.addChild(board.c);
    const cy = (140 + board.bottom) / 2;
    board.c.position.set(-W / 2, -cy);
    holder.position.set(W / 2, cy);
    this.add(this.lIntro, holder, parts);
    const houseOnly = !r.final && r.steps.every((s) => s.kind !== "lie") && r.unpicked.every((u) => u.authorIds.length === 0);
    const ask = r.final ? tk("reveal.finalIntro") : m.pub.notice === "allKnew" ? tk("reveal.allKnew") : houseOnly ? tk("write.houseDidAll") : tk("vote.title");
    const askC = new Container();
    const tt = tx(ask, 40, { w: "900", wrap: 640, lh: 1.2 });
    const w = tt.width + 80, h = tt.height + 30;
    askC.addChild(box(w + 20, h + 20, (h + 20) / 2, INK, 0.55), shadow(w, h, h / 2, 18, 0.7), box(w, h, h / 2, INK, 1, { color: BRASS, width: 2, alpha: 0.55 }), tt);
    askC.position.set(W / 2, 236 + h / 2);
    this.add(this.lCard, askC, parts);
    return {
      parts,
      frame: (p, tMs) => {
        const q = clamp01(p(key(pid, "dim")));
        holder.alpha = 1 - q * 0.72;
        holder.y = cy + q * 40;
        holder.scale.set(1 - q * 0.1);
        const a = this.calm ? 1 : prog(tMs - b.start, 650, 520);
        askC.alpha = Math.min(1, a * 2);
        askC.scale.set(this.calm ? 1 : 0.6 + 0.4 * overshoot(a));
      },
    };
  }

  // ------------------------------------------------ one lie (or the truth) in the spotlight
  private buildLie(pid: string, b: Beat, step: RevealStep): BeatView {
    const r = this.r, m = this.m;
    const parts: Container[] = [];
    const truth = step.kind === "truth", quick = b.kind === "quick";
    const st = stampFor(step);
    const R = this.rtl;
    const { c: cardInner, h } = spotCard(step.text, CARD.w, CARD.h);
    const card = new Container();
    card.addChild(cardInner);
    card.position.set(CARD.x, CARD_TOP);
    let gold: Graphics | null = null, sweep: Graphics | null = null;
    if (truth) {
      gold = new Graphics().roundRect(-CARD.w / 2, 0, CARD.w, h, 16).fill(gradient().gold);
      cardInner.addChildAt(gold, 2);
      const mask = new Graphics().roundRect(-CARD.w / 2, 0, CARD.w, h, 16).fill(0xffffff);
      sweep = new Graphics().poly([-20, -30, 20, -30, -20 + 0, h + 30, -60, h + 30]).fill({ color: 0xffffff, alpha: 0.85 });
      const sw = new Container();
      sw.addChild(sweep);
      sw.mask = mask;
      cardInner.addChildAt(sw, 3);
      cardInner.addChild(mask);
    }
    // The stamp sits on the top end corner (truth: the start corner), 26 dp out.
    const stp = stamp(tk(st.key), st.tone);
    const ss = stampSize(stp);
    const endSide = truth ? R : !R;
    stp.position.set(endSide ? CARD.w / 2 + 26 - ss.w / 2 : -CARD.w / 2 - 26 + ss.w / 2, -26 + ss.h / 2);
    stp.visible = false;
    const splat = new InkSplat(STAMP_INK[st.tone], ss.w / 2);
    splat.root.position.copyFrom(stp.position);
    cardInner.addChild(stp, splat.root);
    const conf = truth ? new Confetti(18, CARD.w, [CREAM, 0xffc94d]) : null;
    if (conf) { conf.root.y = 0; cardInner.addChild(conf.root); }
    card.pivot.set(0, 0);
    this.add(this.lCard, card, parts);
    // The liar pops out (smug, the moustache on a stick); a house lie: the house laughs.
    const pops: Container[] = [];
    if (!truth) {
      const authors = step.authorIds.slice(0, 3).map((id) => m.byId.get(id)).filter((s): s is Seat => !!s);
      const spots = popSpots(Math.max(1, authors.length), R, CARD);
      if (authors.length > 0) authors.forEach((s, k2) => {
        const pc = new Container();
        const a = this.actor(s, 84, "smug");
        const stick = new ArtSprite("moustache", 46, 46, 0.7, 1);
        stick.position.set((R ? -1 : 1) * (42 + 24 - 46 * 0.3), -2);
        if (R) stick.scale.x *= -1;
        pc.addChild(a, stick);
        pc.position.set(spots[k2]!.x, spots[k2]!.y);
        (pc as Container & { stick: ArtSprite }).stick = stick;
        pops.push(pc);
      });
      else {
        const pc = new Container();
        const hs = new ArtSprite("houseLaugh", 80, 80, 0.5, 1);
        pc.addChild(hs);
        pc.position.set(spots[0]!.x, spots[0]!.y);
        pops.push(pc);
      }
      for (const pc of pops) { pc.visible = false; this.add(this.lPop, pc, parts); }
    }
    // Captions under the card.
    const caps0: { c: Container; at: (mk: Mark) => boolean; note?: boolean }[] = [];
    const authors = step.authorIds;
    if (!truth && authors.length > 0) {
      const text = tk("reveal.fooled", { name: nameList(m, authors), count: step.voterIds.length });
      const cc = caption(text, true);
      if (step.helped) {
        const help = new Container();
        const ht = tx(tk("reveal.helped"), 15, { w: "700", fill: TEXT2 });
        const buoy = new ArtSprite("buoy", 18, 18);
        buoy.x = (R ? 1 : -1) * (ht.width / 2 + 4 + 9);
        help.addChild(buoy, ht);
        help.position.set(0, boxH(cc) / 2 + 14);
        const bg = box(Math.max(cc.width, ht.width + 50), 26, 13, INK, 0.82);
        bg.position.copyFrom(help.position);
        cc.addChild(bg, help);
      }
      caps0.push({ c: cc, at: (mk) => mk >= 3 });
      if (authors.length > 1) caps0.push({ c: caption(tk("reveal.sameLie"), false), at: (mk) => mk >= 3 });
    }
    if (!truth && authors.length === 0) caps0.push({ c: caption(tk("reveal.houseWrote"), true), at: (mk) => mk >= 3 });
    if (truth) {
      const eligible = m.seats.filter((s) => !s.left).length - step.spotOnIds.length;
      const finders = step.voterIds.length;
      const capText = m.pub.notice === "allKnew" ? tk("reveal.allKnew")
        : finders === 0 && step.spotOnIds.length === 0 ? tk("reveal.nobodyFound")
          : finders > 0 && finders >= eligible ? tk("reveal.tooEasy") : null;
      if (capText) caps0.push({ c: caption(capText, true), at: (mk) => mk >= 2 });
      if (r.truth?.note) caps0.push({ c: this.noteCaption(), at: (mk) => mk >= 4, note: true });
    }
    // Under the card; a tall stack (a caption plus the note) rides up over the card's empty lower part rather than
    // covering the café row's faces (the DOM lets it run into them).
    const stackH = caps0.reduce((a, cp) => a + boxH(cp.c) + 8, -8);
    let cy = Math.max(CARD_TOP + h / 2 + 34, Math.min(CARD_TOP + h + 18, SEAT_Y - seatChar(this.pos.size) - 6 - stackH));
    for (const cp of caps0) { cp.c.position.set(W / 2, cy); cy += boxH(cp.c) + 8; cp.c.visible = false; this.add(this.lCap, cp.c, parts); }
    // Hoppers: voters jump from their seats onto the card's top edge (finders on the truth); Spot-on players stand there.
    const hop = hoppers(r, b);
    const spotOn = truth ? step.spotOnIds : [];
    const ids = [...hop, ...spotOn];
    const hopViews: { id: string; c: Container; a: Actor; x0: number; land: { x: number; y: number }; fixed: boolean; k: number }[] = [];
    ids.forEach((id, k2) => {
      const s = m.byId.get(id);
      const x0 = this.pos.get(id);
      if (!s || x0 === undefined) return;
      const land = landing(k2, ids.length);
      const c = new Container();
      const a = this.actor(s, this.HOP, "idle");
      c.addChild(a);
      const fixed = k2 >= hop.length;
      if (fixed) {
        const pin = new Container();
        const pt = tx(tk("reveal.knewItPin"), 11, { w: "900", fill: INK });
        pin.addChild(box(pt.width + 16, 16, 8, GOLDL), pt);
        pin.y = -this.HOP - 14 + 8;
        c.addChild(pin);
      }
      if (truth && step.foundEarlyIds.includes(id)) {
        const pin = new Container();
        const pt = tx(tk("reveal.foundEarly"), 11, { w: "900" });
        pin.addChild(box(pt.width + 16, 16, 8, 0x3a2266), pt);
        pin.y = 16 + 8 - 8;
        c.addChild(pin);
      }
      this.add(this.lHop, c, parts);
      hopViews.push({ id, c, a, x0, land, fixed, k: k2 });
    });
    // Coins: from each fooled voter on the card (truth: from the card) into the scorer's pill.
    const coins = this.calm ? [] : this.coinViews(coinsOf(r, b), hop, parts);
    const tb = this.tl.beats[Number(pid.slice(1))]!;
    return {
      parts,
      frame: (p, tMs, mk) => {
        const sp = clamp01(p(key(pid, "spot")));
        card.alpha = sp;
        if (this.calm) { card.scale.set(1); card.y = CARD_TOP; }
        else {
          const sc = quick ? 0.62 + 0.14 * sp : 0.8 + 0.2 * sp;
          card.scale.set(sc);
          card.y = CARD_TOP + (1 - sp) * 40;
        }
        // The drumroll: the card trembles ±1 dp at 12 Hz between the landing and the stamp (DESIGN-JAMAA §5.2).
        card.x = CARD.x + (!this.calm && !truth && b.kind === "lie" && tMs >= tb.marks.land && tMs < tb.marks.stamp ? (Math.floor(tMs / 41.7) % 2 ? 1 : -1) : 0);
        if (gold) gold.alpha = clamp01(p(key(pid, "gold")));
        if (sweep) { const q = clamp01(p(key(pid, "sweep"))); sweep.visible = !this.calm && q > 0 && q < 1; sweep.x = -CARD.w / 2 - 60 + q * 700; sweep.alpha = 1 - q * q; }
        const s2 = p(key(pid, "stamp"));
        stp.visible = mk >= 2;
        if (stp.visible) {
          stp.alpha = Math.min(1, s2 * 3);
          stp.scale.set(this.calm ? 1 : 1.6 - 0.6 * overshoot(clamp01(s2)));
          stp.rotation = -8 * DEG;
        }
        splat.frame(this.calm ? -1 : tMs - tb.marks.stamp - 320);
        conf?.frame(mk >= 2 && !this.calm ? p(key(pid, "confetti")) : 0);
        const pp = clamp01(p(key(pid, "pop")));
        for (const pc of pops) {
          pc.visible = mk >= 3;
          pc.alpha = Math.min(1, pp * 2);
          const base = (pc as Container & { baseY?: number }).baseY ?? ((pc as Container & { baseY?: number }).baseY = pc.y);
          pc.y = base + (this.calm ? 0 : (1 - pp) * 70);
          const stick = (pc as Container & { stick?: ArtSprite }).stick;
          if (stick && !this.calm) stick.rotation = (this.rtl ? 12 : -12) * DEG * Math.sin(((tMs % 900) / 900) * Math.PI);
        }
        for (const cp of caps0) {
          cp.c.visible = cp.at(mk);
          if (cp.note) { const q = clamp01(p(key(pid, "note"))); cp.c.alpha = q; cp.c.pivot.y = -boxH(cp.c) / 2 - (1 - q) * 16; }
          else if (cp.c.visible) { const born = (cp.c as Container & { born?: number }).born ?? ((cp.c as Container & { born?: number }).born = performance.now()); const q = this.calm ? 1 : prog(performance.now(), born, 380); cp.c.alpha = Math.min(1, q * 2); cp.c.scale.set(0.6 + 0.4 * overshoot(q)); }
        }
        for (const hv of hopViews) {
          const s = m.byId.get(hv.id)!;
          hv.a.expr = s.connected ? seatExpression(r, b, mk, s, false) : "away";
          if (hv.fixed) { hv.c.position.set(hv.land.x, hv.land.y); continue; }
          const q = p(key(pid, quick ? "faces" : "jump"), hv.k);
          if (this.calm) { hv.c.position.set(hv.land.x, hv.land.y); hv.c.alpha = Math.min(1, clamp01(q) * 2); continue; }
          if (quick) { hv.c.position.set(hv.land.x, hv.land.y); hv.c.scale.set(0.3 + 0.7 * Math.min(1, q)); hv.c.alpha = Math.min(1, q * 3); continue; }
          const pt = hopPoint(hv.x0, SEAT_Y, hv.land.x, hv.land.y, q);
          hv.c.position.set(pt.x, pt.y);
        }
        this.flyCoins(coins, p, key(pid, "coin"));
      },
    };
  }

  private noteCaption(): Container {
    const r = this.r;
    const note = r.truth!.note!;
    const orig = r.truth?.original && r.truth.original !== r.truth.text ? ` · ${tk("reveal.inArabic")} ${isolate(r.truth.original)}` : "";
    const c = new Container();
    const tt = tx(`${tk("reveal.itMeans", { note })}${orig}`, 18, { w: "700", fill: GOLDL, wrap: 720, lh: 1.35 });
    const w = tt.width + 36, h = tt.height + 12;
    c.addChild(box(w, h, 16, INK, 0.82), tt);
    c.pivot.y = -h / 2;
    (c as Container & { boxH: number }).boxH = h;
    return c;
  }

  private coinViews(list: Coin[], hop: string[], parts: Container[]): { c: Container; a: { x: number; y: number }; z: { x: number; y: number }; ctl: { x: number; y: number } }[] {
    const out: { c: Container; a: { x: number; y: number }; z: { x: number; y: number }; ctl: { x: number; y: number } }[] = [];
    for (const c of list) {
      const to = this.m.byId.get(c.to);
      const x1 = this.pos.get(c.to);
      if (!to || x1 === undefined) continue;
      let a: { x: number; y: number };
      if (c.from === "card") a = { x: CARD.x, y: CARD.y };
      else if (c.from === "box") a = { x: mx(BOX.x, this.rtl), y: BOX.y };
      else { const kk = hop.indexOf(c.from); const l = kk >= 0 ? landing(kk, hop.length) : { x: CARD.x, y: CARD.y }; a = { x: l.x, y: l.y - 20 }; }
      const z = { x: x1, y: PILL_Y };
      const v = new Container();
      v.addChild(new ArtSprite(`coin-${to.color}`, 20, 20));
      if (c.label) {
        const lb = new Container();
        const lt = num(c.label, 15, INK);
        lb.addChild(box(lt.width + 16, 20, 10, GOLDL), lt);
        lb.position.set(14 + (lt.width + 16) / 2, -18 + 10);
        v.addChild(lb);
      }
      v.visible = false;
      this.add(this.lFly, v, parts);
      out.push({ c: v, a, z, ctl: control(a, z) });
    }
    return out;
  }

  private flyCoins(coins: { c: Container; a: { x: number; y: number }; z: { x: number; y: number }; ctl: { x: number; y: number } }[], p: (id: string, i?: number) => number, id: string): void {
    coins.forEach((cv, i) => {
      const q = p(id, i);
      cv.c.visible = q > 0 && q < 1;
      if (!cv.c.visible) return;
      const at = bezier(cv.a, cv.ctl, cv.z, clamp01(q));
      cv.c.position.set(at.x, at.y);
      cv.c.scale.set(1 + 0.25 * Math.sin(Math.PI * q));
    });
  }

  // ------------------------------------------------ final: one answer, its anonymous envelopes, the author pops out
  private buildAnswer(pid: string, b: Beat, step: RevealStep): BeatView {
    const m = this.m;
    const parts: Container[] = [];
    const R = this.rtl;
    const n = Math.min(MAX_ENVELOPES, step.voteCount);
    const house = step.authorIds.length === 0;
    const ballot = new Container();
    ballot.addChild(shadow(68, 60, 10, 10, 0.5), new Graphics().roundRect(-34, -30, 68, 60, 10).fill(gradient().step).rect(-32, -28, 64, 2).fill(0x7a4a1e), new ArtSprite("envelopeOpen", 30, 30));
    ballot.position.set(mx(BOX.x, R), BOX.y);
    this.add(this.lPop, ballot, parts);
    const { c: inner, h } = spotCard(step.text, CARD.w, CARD.h);
    const card = new Container();
    card.addChild(inner);
    card.position.set(CARD.x, CARD_TOP);
    const cnt = new Container();
    const ct = num("×0", 24, GOLDL);
    cnt.addChild(box(64, 32, 16, INK), ct);
    cnt.position.set(R ? CARD.w / 2 + 18 - 32 : -CARD.w / 2 - 18 + 32, -22 + 16);
    inner.addChild(cnt);
    const envs: ArtSprite[] = [];
    for (let i = 0; i < n; i++) { const e = new ArtSprite("envelope", 28, 28); e.position.set(envelopeX(i, n), -40 + 14); e.visible = false; inner.addChild(e); envs.push(e); }
    this.add(this.lCard, card, parts);
    const pops: Container[] = [];
    if (house) { const pc = new Container(); pc.addChild(new ArtSprite("houseLaugh", 80, 80, 0.5, 1)); const sp = popSpots(1, R, CARD)[0]!; pc.position.set(sp.x, sp.y); pops.push(pc); }
    else {
      const authors = step.authorIds.slice(0, 3).map((id) => m.byId.get(id)).filter((s): s is Seat => !!s);
      const spots = popSpots(authors.length, R, CARD);
      authors.forEach((s, k2) => { const pc = new Container(); pc.addChild(this.actor(s, 84, "smug")); pc.position.set(spots[k2]!.x, spots[k2]!.y); pops.push(pc); });
    }
    for (const pc of pops) { pc.visible = false; this.add(this.lPop, pc, parts); }
    const pts = step.deltas.filter((d) => d.reason === "fooled").reduce((a, d) => a + d.points, 0);
    const cap = caption(house ? tk("reveal.houseWrote") : `${nameList(m, step.authorIds)} · ⁦+${pts}⁩`, true);
    cap.position.set(W / 2, CARD_TOP + h + 18);
    cap.visible = false;
    this.add(this.lCap, cap, parts);
    const coins = this.calm ? [] : this.coinViews(coinsOf(this.r, b), [], parts);
    let shown = -1;
    return {
      parts,
      frame: (p, tMs, mk) => {
        const sp = clamp01(p(key(pid, "spot")));
        card.alpha = sp;
        card.scale.set(this.calm ? 1 : 0.8 + 0.2 * sp);
        card.y = CARD_TOP + (this.calm ? 0 : (1 - sp) * 40);
        const cv = Math.round(step.voteCount * Math.min(1, p(key(pid, "count"))));
        if (cv !== shown) { shown = cv; ct.text = `×${cv}`; }
        envs.forEach((e, i) => {
          const q = clamp01(p(key(pid, "env"), i));
          e.visible = q > 0;
          e.alpha = Math.min(1, q * 3);
          e.y = -40 + 14 + (this.calm ? 0 : (1 - q) * -150);
          e.rotation = this.calm ? 0 : ((1 - q) * -30 + (i - (n - 1) / 2) * 4) * DEG;
        });
        const pp = clamp01(p(key(pid, "pop")));
        for (const pc of pops) {
          pc.visible = mk >= 3;
          pc.alpha = Math.min(1, pp * 2);
          const base = (pc as Container & { baseY?: number }).baseY ?? ((pc as Container & { baseY?: number }).baseY = pc.y);
          pc.y = base + (this.calm ? 0 : (1 - pp) * 70);
        }
        cap.visible = mk >= 3;
        if (cap.visible) { const born = (cap as Container & { born?: number }).born ?? ((cap as Container & { born?: number }).born = performance.now()); const q = this.calm ? 1 : prog(performance.now(), born, 380); cap.alpha = Math.min(1, q * 2); cap.scale.set(0.6 + 0.4 * overshoot(q)); }
        this.flyCoins(coins, p, key(pid, "coin"));
      },
    };
  }

  // ------------------------------------------------ final: MOST CONVINCING, the crown hops onto the author(s), +400
  private buildCrown(pid: string, b: Beat): BeatView {
    const r = this.r, m = this.m;
    const parts: Container[] = [];
    const R = this.rtl;
    const tops = b.steps.map((i) => r.steps[i]!).filter(Boolean).slice(0, 3);
    if (tops.length === 0) {
      const c = caption(tk("reveal.noCrown"), true);
      c.position.set(W / 2, 170);
      this.add(this.lCard, c, parts);
      return { parts, frame: () => undefined };
    }
    const unanimous = tops.length === 1 && tops[0]!.voteCount > 0 && tops[0]!.voteCount === r.steps.reduce((a, s) => a + s.voteCount, 0) && r.steps.filter((s) => s.voteCount > 0).length === 1;
    const n = tops.length;
    const gap = 24;
    const cw = n === 1 ? 460 : n === 2 ? 400 : (W - 96 - gap * 2) / 3;
    const total = cw * n + gap * (n - 1);
    const top = 168;
    const cards: { c: Container; stamp: Container; who: { c: Container; crown: ArtSprite; a: Actor }[]; bonus: Container; h: number }[] = [];
    const textSizes = n === 3 ? [24, 21, 18, 16] : [28, 24, 21, 18];
    const maxTextH = 372 - top - 56 - 96;
    tops.forEach((s, i) => {
      const x = W / 2 - total / 2 + cw / 2 + (R ? n - 1 - i : i) * (cw + gap);
      const c = new Container();
      const tt = tx(s.text, textSizes[0]!, { auto: true, w: "900", fill: INK, wrap: cw - 52, lh: 1.2 });
      fitText(tt, textSizes, maxTextH, 1.2);
      const h = 56 + tt.height + 96;
      const sh = shadow(cw, h, 16, 30, 0.6); sh.y = h / 2;
      c.addChild(sh, new Graphics().roundRect(-cw / 2, 3, cw, h, 16).fill(0xc9ae82).roundRect(-cw / 2, 0, cw, h, 16).fill(gradient().goldCard));
      tt.position.set(0, 56 + tt.height / 2);
      c.addChild(tt);
      const stp = stamp(tk("reveal.mostConvincing"), "gold", n === 3 ? 18 : 22, cw * 0.72 - 40, 4);
      const ss = stampSize(stp);
      stp.position.set(R ? -cw / 2 + 8 + ss.w / 2 : cw / 2 - 8 - ss.w / 2, -30 + ss.h / 2);
      stp.rotation = -8 * DEG;
      stp.visible = false;
      c.addChild(stp);
      const who: { c: Container; crown: ArtSprite; a: Actor }[] = [];
      const authors = s.authorIds.map((id) => m.byId.get(id)).filter((p): p is Seat => !!p);
      const aw = 82;
      authors.forEach((p, j) => {
        const wc2 = new Container();
        const a = this.actor(p, 72, "idle");
        const crown = new ArtSprite("crown", 40, 27, 0.5, 1);
        crown.position.set(0, -72 * 0.7);
        const nm = tx(p.name, 16, { auto: true, w: "900" });
        squeeze(nm, 120);
        const nb = new Container();
        nb.addChild(box(nm.width + 20, 22, 11, INK, 0.85), nm);
        nb.position.set(0, 2 + 11);
        wc2.addChild(a, crown, nb);
        wc2.position.set((j - (authors.length - 1) / 2) * aw * (R ? -1 : 1), h + 22 - 24);
        c.addChild(wc2);
        who.push({ c: wc2, crown, a });
      });
      const bonus = chip("+400", 26, INK, RED, 1, 38, 14);
      bonus.position.set(R ? cw / 2 - 12 - bonus.width / 2 : -cw / 2 + 12 + bonus.width / 2, 12 + 19);
      bonus.rotation = -8 * DEG;
      bonus.visible = false;
      c.addChild(bonus);
      c.position.set(x, top);
      this.add(this.lCard, c, parts);
      cards.push({ c, stamp: stp, who, bonus, h });
    });
    const conf = new Confetti(18, total, [CREAM, 0xffc94d]);
    conf.root.position.set(W / 2, top);
    this.add(this.lCap, conf.root, parts);
    let note: Container | null = null;
    if (unanimous) {
      note = caption(tk("reveal.unanimous"), true);
      note.position.set(W / 2, Math.min(372, top + Math.max(...cards.map((c) => c.h)) + 30));
      note.visible = false;
      this.add(this.lCap, note, parts);
    }
    const tb = this.tl.beats[Number(pid.slice(1))]!;
    return {
      parts,
      frame: (p, tMs, mk) => {
        const sp = clamp01(p(key(pid, "spot")));
        const st = p(key(pid, "stamp"));
        const pp = clamp01(p(key(pid, "pop")));
        const cr = clamp01(p(key(pid, "crown")));
        for (const c of cards) {
          c.c.alpha = sp;
          c.c.scale.set(this.calm ? 1 : 0.8 + 0.2 * sp);
          c.stamp.visible = mk >= 2;
          c.stamp.alpha = Math.min(1, st * 3);
          c.stamp.scale.set(this.calm ? 1 : 1.6 - 0.6 * overshoot(clamp01(st)));
          for (const w of c.who) {
            w.a.expr = mk >= 2 ? "cheer" : "idle";
            w.c.alpha = Math.min(1, pp * 2);
            w.c.pivot.y = this.calm ? 0 : -(1 - pp) * 40;
            w.crown.alpha = Math.min(1, cr * 4);
            w.crown.y = -72 * 0.7 + (this.calm ? 0 : (1 - cr) * -90);
            w.crown.rotation = this.calm ? 0 : (1 - cr) * -40 * DEG;
          }
          c.bonus.visible = mk >= 3;
          if (c.bonus.visible) { const q = this.calm ? 1 : prog(tMs, tb.marks.pop, 520); c.bonus.scale.set(2 - overshoot(q)); c.bonus.alpha = Math.min(1, q * 3); }
        }
        conf.frame(mk >= 2 && !this.calm ? p(key(pid, "confetti")) : 0);
        if (note) note.visible = mk >= 2;
      },
    };
  }

  // ------------------------------------------------ final: every card flips to LIE!, then the "No truth" stamp
  private buildTwist(pid: string): BeatView {
    const r = this.r;
    const parts: Container[] = [];
    const all = [...r.steps.map((s) => s.text), ...r.unpicked.map((u) => u.text)];
    const cells = twistCells(all.length, this.rtl);
    const flips: { c: Container; front: Container; back: Container }[] = [];
    all.forEach((text, i) => {
      const cell = cells[i]!;
      const c = new Container();
      c.position.set(cell.x + cell.w / 2, cell.y + cell.h / 2);
      const front = new Container();
      const ft = tx(text, 16, { auto: true, w: "800", fill: INK, wrap: cell.w - 20, lh: 1.15 });
      fitText(ft, [16, 14, 13, 12], cell.h - 10, 1.15);
      front.addChild(box(cell.w, cell.h, 8, PAPER), ft);
      const back = new Container();
      back.addChild(box(cell.w, cell.h, 8, 0xd63a3f), tx(tk("reveal.lie"), 22, { w: "900", fill: CREAM, ls: 0.06, maxW: cell.w - 16 }));
      back.visible = false;
      c.addChild(front, back);
      this.add(this.lCard, c, parts);
      flips.push({ c, front, back });
    });
    const rows = Math.ceil(all.length / (all.length > 6 ? 4 : 3));
    const st = this.twistStamp();
    st.position.set(W / 2, 128 + rows * 72 - 10 + 22 + stampSize(st).h / 2);
    this.add(this.lCap, st, parts);
    return {
      parts,
      frame: (p) => {
        flips.forEach((f, i) => {
          const q = clamp01(p(key(pid, "flip"), i));
          if (this.calm) { f.c.scale.x = 1; f.front.visible = true; f.back.visible = false; return; }
          f.c.scale.x = Math.max(0.02, Math.abs(Math.cos(Math.PI * q)));
          f.front.visible = q < 0.5;
          f.back.visible = q >= 0.5;
        });
        const s2 = p(key(pid, "stamp"));
        st.alpha = Math.min(1, s2 * 3);
        st.scale.set(this.calm ? 1 : 1.8 - 0.8 * clamp01(s2));
      },
    };
  }

  private twistStamp(): Container {
    const c = new Container();
    const tt = tx(tk("reveal.noTruthStamp"), 34, { w: "900", fill: 0xd63a3f, wrap: 700, lh: 1.1 });
    const w = tt.width + 56 + 12, h = tt.height + 24 + 12;
    c.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, 16).fill({ color: CREAM, alpha: 0.95 }).roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 14).stroke({ width: 6, color: 0xd63a3f }), tt);
    c.rotation = -4 * DEG;
    (c as Container & { boxW: number; boxH: number }).boxW = w;
    (c as Container & { boxW: number; boxH: number }).boxH = h;
    return c;
  }

  // ------------------------------------------------ "Nobody bought it…": the unpicked lies fan out, then fall
  private buildMontage(pid: string): BeatView {
    const r = this.r, m = this.m;
    const parts: Container[] = [];
    const head = caption(tk("reveal.nobody"), true);
    head.position.set(W / 2, 132);
    this.add(this.lCap, head, parts);
    const cards = r.unpicked.slice(0, 6);
    const handTop = 132 + boxH(head) + 4;
    const views: { pivot: Container; fall: Container; i: number }[] = [];
    cards.forEach((u, i) => {
      const pivot = new Container();
      pivot.position.set(W / 2, handTop + 30 + 260);
      const holder = new Container();
      holder.position.set(0, -260);
      const fall = new Container();
      const tt = tx(u.text, 18, { auto: true, w: "800", fill: INK, wrap: 196, lh: 1.2 });
      fitText(tt, [18, 16, 14], 70, 1.2);
      const ch = tt.height + 14 + 10 + 6 + 40;
      const sh = shadow(220, ch, 10, 12, 0.5); sh.y = ch / 2;
      fall.addChild(sh, new Graphics().roundRect(-110, 0, 220, ch, 10).fill(PAPER));
      tt.position.set(0, 14 + tt.height / 2);
      fall.addChild(tt);
      const faces = new Container();
      if (u.authorIds.length === 0) faces.addChild(new ArtSprite("house", 36, 36, 0.5, 1));
      else u.authorIds.slice(0, 2).forEach((id, j, arr) => { const s = m.byId.get(id); if (!s) return; const a = this.actor(s, 40, "sad"); a.x = (j - (arr.length - 1) / 2) * 44; faces.addChild(a); });
      faces.position.set(0, ch - 8);
      fall.addChild(faces);
      holder.addChild(fall);
      pivot.addChild(holder);
      this.add(this.lCard, pivot, parts);
      views.push({ pivot, fall, i });
    });
    if (r.unpicked.length > 6) {
      const rest = tx(r.unpicked.slice(6).map((u) => u.text).join(" · "), 15, { auto: true, w: "600", fill: MUTED, wrap: 860, lh: 1.3 });
      rest.position.set(W / 2, Math.min(handTop + 230 + 10, 340));
      this.add(this.lCap, rest, parts);
    }
    return {
      parts,
      frame: (p) => {
        for (const v of views) {
          const f = this.calm ? { rot: 0, dx: 0 } : fanOf(v.i, views.length, clamp01(p(key(pid, "fan"), v.i)));
          v.pivot.rotation = f.rot * DEG;
          v.fall.x = f.dx;
          const q = this.calm ? 0 : clamp01(p(key(pid, "fall"), v.i));
          v.fall.y = 420 * q;
          v.fall.rotation = 30 * q * DEG;
          v.fall.alpha = 1 - 0.6 * q;
        }
      },
    };
  }

  // ------------------------------------------------ the like tally: hearts drift from likers to authors
  private buildLikes(pid: string): BeatView {
    const r = this.r;
    const parts: Container[] = [];
    const head = new Container();
    const tt = tx(tk("vote.like"), 26, { w: "900", fill: 0xff9ab0 });
    const heart = new ArtSprite("heart", 26, 26);
    const w = tt.width + 26 + 8 + 44;
    head.addChild(box(w, 50, 25, INK, 0.88, { color: BRASS, width: 1.5, alpha: 0.45 }));
    const R = this.rtl;
    heart.x = (R ? 1 : -1) * (w / 2 - 22 - 13);
    tt.x = heart.x + (R ? -1 : 1) * (13 + 8 + tt.width / 2);
    head.addChild(heart, tt);
    head.position.set(W / 2, 200 + 25);
    this.add(this.lCap, head, parts);
    const houseThanks = [...r.steps, ...r.unpicked].some((s) => s.likerIds.length > 0 && s.authorIds.length === 0);
    if (houseThanks) { const c = caption(tk("reveal.houseLike"), false); c.position.set(W / 2, 254 + 8); this.add(this.lCap, c, parts); }
    const size = seatChar(this.pos.size);
    const flights = this.likeFlights().map((f) => {
      const x0 = this.pos.get(f.from), x1 = this.pos.get(f.to);
      if (x0 === undefined || x1 === undefined) return null;
      const s = new ArtSprite("heart", 22, 22);
      s.visible = false;
      this.add(this.lFly, s, parts);
      const a = { x: x0, y: SEAT_Y - size }, z = { x: x1, y: PILL_Y };
      return { s, a, z, ctl: control(a, z) };
    });
    return {
      parts,
      frame: (p) => {
        flights.forEach((f, i) => {
          if (!f) return;
          const q = p(key(pid, "heart"), i);
          f.s.visible = !this.calm && q > 0 && q < 1;
          if (!f.s.visible) return;
          const at = bezier(f.a, f.ctl, f.z, clamp01(q));
          f.s.position.set(at.x, at.y);
          f.s.scale.set((22 / 56) * (1 + 0.3 * Math.sin(Math.PI * q)));
        });
      },
    };
  }

  // ------------------------------------------------ after the last beat (or OK): the truth with its note, or the twist line
  private buildEnd(): Container {
    const r = this.r, m = this.m;
    const c = new Container();
    if (r.final) {
      const st = this.twistStamp();
      st.position.set(W / 2, 150 + stampSize(st).h / 2);
      c.addChild(st);
      const tops = r.steps.filter((s) => s.top);
      if (tops.length > 0) {
        const cap = caption(`${tk("reveal.mostConvincing")} · ${nameList(m, tops.flatMap((s) => s.authorIds))}`, true);
        cap.position.set(W / 2, 150 + stampSize(st).h + 20);
        c.addChild(cap);
      }
      return c;
    }
    const { c: inner, h } = spotCard(r.truth?.text ?? "", CARD.w, CARD.h);
    inner.addChildAt(new Graphics().roundRect(-CARD.w / 2, 0, CARD.w, h, 16).fill(gradient().gold), 2);
    const stp = stamp(tk("reveal.truth"), "truth");
    const ss = stampSize(stp);
    stp.position.set(this.rtl ? CARD.w / 2 + 26 - ss.w / 2 : -CARD.w / 2 - 26 + ss.w / 2, -26 + ss.h / 2);
    stp.rotation = -8 * DEG;
    inner.addChild(stp);
    inner.position.set(CARD.x, CARD_TOP);
    c.addChild(inner);
    if (r.truth?.note) {
      const note = this.noteCaption();
      note.position.set(W / 2, CARD_TOP + h + 18);
      c.addChild(note);
    }
    return c;
  }

  update(m: BluffModel): void { this.m = m; this.seats.update(m); }
  tick(dt: number): void {
    const calm = this.calm;
    if (this.ended) {
      this.endAge += dt;
      const q = calm ? 1 : prog(this.endAge, 0, 400);
      this.endView.alpha = Math.min(1, q * 2);
      this.endView.scale.set(0.6 + 0.4 * overshoot(q));
      this.endView.pivot.set(W / 2, 260);
      this.endView.position.set(W / 2, 260);
    }
    // The stamp's thud: a short shake of the whole stage.
    if (this.shakeMs > 0 && !calm) {
      this.shakeMs -= dt;
      const a = Math.max(0, this.shakeMs / 220) * 3;
      this.root.position.set(Math.sin(this.shakeMs * 0.9) * a, Math.cos(this.shakeMs * 1.3) * a * 0.6);
    } else this.root.position.set(0, 0);
    for (const a of this.actors) if (a.visible && a.parent?.visible !== false) a.tick(dt, calm);
    void this.beatT;
    this.seats.tick(dt);
  }
  complete(): void { this.wrapped.complete(); }
  destroy(): void { this.runner.cancel(); clearChoreo(this.wrapped); this.onRunning(false); this.root.destroy({ children: true }); }
}

// AWARDS (BL-TV-07) -------------------------------------------------------------------------------------------------
class AwardsPhase implements Phase {
  readonly root = new Container();
  private shown: number;
  private age = 0;
  private readonly drum: Text;
  private card: Container | null = null;
  private cardAge = 0;
  private who: { c: Container; a: Actor; i: number }[] = [];
  private body: Text | null = null;
  private bodyN = -1;
  private readonly shelf = new Container();
  private readonly calm = reduced();
  private m: BluffModel;
  constructor(m: BluffModel, private readonly onRunning: (running: boolean) => void) {
    this.m = m;
    this.shown = this.calm ? m.pub.awards.length : 0;
    this.drum = tx(tk("awards.title"), 48, { w: "900", fill: CREAM, glow: { color: BRASS, blur: 18 }, maxW: 800 });
    this.drum.position.set(W / 2, 70 + 140 + 29);
    this.root.addChild(this.drum, this.shelf);
    this.onRunning(this.shown < m.pub.awards.length);
    this.rebuild();
  }
  private rebuild(): void {
    const m = this.m;
    const awards = m.pub.awards;
    const cur = this.shown > 0 ? awards[this.shown - 1] : undefined;
    this.drum.visible = !cur;
    this.card?.destroy({ children: true });
    this.card = null; this.who = []; this.body = null; this.bodyN = -1;
    if (cur) this.card = this.trophy(cur);
    this.shelf.removeChildren().forEach((c) => c.destroy({ children: true }));
    const earlier = awards.slice(0, Math.max(0, this.shown - 1));
    const chips = earlier.map((a) => {
      const c = new Container();
      const tt = tx(t(awardTitleKey(a) as MessageKey), 14, { w: "700", fill: GOLDL });
      const icon = new ArtSprite("trophy", 18, 18);
      const w = tt.width + 18 + 6 + 24;
      c.addChild(box(w, 26, 13, INK, 0.7));
      const R = rtl();
      icon.x = (R ? 1 : -1) * (w / 2 - 12 - 9);
      tt.x = icon.x + (R ? -1 : 1) * (9 + 6 + tt.width / 2);
      c.addChild(icon, tt);
      return c;
    });
    const total = chips.reduce((a, c) => a + c.width, 0) + 12 * Math.max(0, chips.length - 1);
    let x = 0;
    for (const c of rtl() ? [...chips].reverse() : chips) { c.position.set(W / 2 - total / 2 + x + c.width / 2, H - 22 - 13); x += c.width + 12; this.shelf.addChild(c); }
    if (total > 900) { this.shelf.scale.set(900 / total); this.shelf.pivot.set(W / 2, 0); this.shelf.x = W / 2; }
    this.onRunning(this.shown < awards.length);
  }
  private trophy(a: Award): Container {
    const m = this.m;
    const c = new Container();
    const w = 520;
    const items: Container[] = [];
    const cup = new ArtSprite("trophy", 44, 44);
    (cup as unknown as { boxH: number }).boxH = 44;
    items.push(cup);
    const title = tx(t(awardTitleKey(a) as MessageKey), 34, { w: "900", fill: GOLDL, wrap: w - 60, lh: 1.15 });
    fitText(title, [34, 30, 26], 80, 1.15);
    items.push(title);
    if (a.text) {
      const quote = new Container();
      const qt = tx(a.text, 22, { auto: true, w: "800", fill: INK, wrap: w - 100, lh: 1.25 });
      fitText(qt, [22, 19, 17], 60, 1.25);
      quote.addChild(box(qt.width + 36, qt.height + 16, 10, PAPER), qt);
      quote.rotation = -1.5 * DEG;
      (quote as Container & { boxH: number }).boxH = qt.height + 16;
      items.push(quote);
    }
    this.body = tx("", 20, { w: "700", fill: TEXT2, wrap: w - 60, lh: 1.3 });
    this.setBody(a);
    items.push(this.body);
    const hOf = (it: Container): number => (it as Container & { boxH?: number }).boxH ?? it.height;
    let y = 22;
    for (const it of items) { const h = hOf(it); it.position.set(0, y + h / 2); y += h + 8; }
    const ch = y - 8 + 26;
    const card = new Container();
    const sh = shadow(w, ch, 22, 28, 0.6); sh.y = ch / 2;
    card.addChild(sh, new Graphics().roundRect(-w / 2, 0, w, ch, 22).fill(gradient().trophy).roundRect(-w / 2 + 1, 1, w - 2, ch - 2, 21).stroke({ width: 2, color: GOLDL, alpha: 0.5 }));
    for (const it of items) card.addChild(it);
    const glow = new ArtSprite("glow", 120, 120);
    glow.position.set(0, 22 + 22);
    glow.alpha = 0.35;
    card.addChildAt(glow, 2);
    // The velvet stand, then the winners running in under a warm pool of light.
    const stand = new Graphics().roundRect(-150, -6, 300, 26, 14).fill(0x3a0e1c).rect(-150, -6, 300, 10).fill(0x5b1a2e);
    stand.y = ch;
    const big = a.playerIds.length > 2 ? 84 : 108;
    const whoY = ch + 20 + 14;
    // Fit everything above the shelf (y ≤ 480 from the card top at 80).
    const room = 480 - 80;
    const need = whoY + big + 26;
    const k2 = need > room ? room / need : 1;
    const pool = new ArtSprite("glow", 360, 150);
    pool.position.set(0, whoY + big - 20);
    pool.alpha = 0.34;
    c.addChild(pool, stand, card);
    a.playerIds.forEach((id, i, arr) => {
      const s = m.byId.get(id);
      if (!s) return;
      const pc = new Container();
      const actor = new Actor(s.color, big, "cheer", i);
      const nm = tx(s.name, 18, { auto: true, w: "900" });
      squeeze(nm, 160);
      nm.position.set(0, 4 + 9);
      pc.addChild(actor, nm);
      pc.position.set((i - (arr.length - 1) / 2) * (big * 0.94 + 22), whoY + big);
      c.addChild(pc);
      this.who.push({ c: pc, a: actor, i });
    });
    c.scale.set(k2);
    c.position.set(W / 2, 80);
    (c as Container & { card: Container }).card = card;
    this.root.addChild(c);
    this.cardAge = 0;
    return c;
  }
  private setBody(a: Award): void {
    if (!this.body) return;
    const n = a.id === "bluffOfTheNight" && !this.calm ? Math.min(a.value, Math.floor(this.cardAge / 260)) : a.value;
    if (n === this.bodyN) return;
    this.bodyN = n;
    this.body.text = bidi(t(awardBodyKey(a) as MessageKey, { count: n }), rtl());
  }
  update(m: BluffModel): void { this.m = m; }
  tick(dt: number): void {
    this.age += dt;
    const awards = this.m.pub.awards;
    let next = this.shown;
    while (next < awards.length && this.age >= awardAt(next)) next++;
    if (next !== this.shown) { this.shown = next; sfx("award"); this.rebuild(); }
    if (!this.card) { this.drum.alpha = this.calm ? 1 : neonAlpha(this.age, 0); return; }
    this.cardAge += dt;
    const a = awards[this.shown - 1]!;
    this.setBody(a);
    const card = (this.card as Container & { card: Container }).card;
    const q = this.calm ? 1 : prog(this.cardAge, 0, 700);
    card.alpha = Math.min(1, q * 2);
    card.y = -140 * (1 - overshoot(q));
    card.rotation = -4 * DEG * (1 - overshoot(q));
    const R = rtl();
    for (const w of this.who) {
      const r2 = this.calm ? 1 : prog(this.cardAge, 400 + w.i * 120, 700);
      w.c.alpha = Math.min(1, r2 * 2);
      const base = (w.c as Container & { bx?: number }).bx ?? ((w.c as Container & { bx?: number }).bx = w.c.x);
      w.c.x = base + (R ? 260 : -260) * (1 - overshoot(r2));
      w.a.tick(dt, this.calm);
    }
  }
  complete(): void {
    this.shown = this.m.pub.awards.length;
    this.rebuild();
    this.cardAge = 1e6;
  }
  destroy(): void { this.onRunning(false); this.root.destroy({ children: true }); }
}

// RESULTS (BL-TV-08) ------------------------------------------------------------------------------------------------
class ResultsPhase implements Phase {
  readonly root = new Container();
  private step: number;
  private age = 0;
  private readonly cols: { i: number; char: Container; a: Actor; crown: ArtSprite | null; score: BitmapText; scoreV: number; landAge: number }[] = [];
  private readonly conf: Confetti | null = null;
  private confAge = -1;
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly calm = reduced();
  constructor(m: BluffModel, private readonly onRunning: (running: boolean) => void) {
    const list = ranked(m.seats);
    const podium = list.slice(0, 3);
    this.step = this.calm ? 3 : 0;
    this.timer = setTimeout(() => { resultsSettled.value = true; }, this.calm ? 300 : 2600);
    const R = rtl();
    const bottom = 90 + 330;
    for (const col of podiumCols(R)) {
      const s = podium[col.i];
      if (!s) continue;
      const place = placeOf(list, s.id);
      const c = new Container();
      c.position.set(col.x, bottom);
      const stepTop = -col.step;
      const stepG = new Graphics().roundRect(-90, stepTop, 180, col.step + 12, 12).fill(col.i === 0 ? gradient().stepGold : gradient().step).rect(-88, stepTop + 2, 176, 2).fill({ color: 0x9a6a34 });
      const pl = num(String(place), 40, col.i === 0 ? INK : GOLDL);
      pl.position.set(0, stepTop + col.step / 2);
      c.addChild(stepG, pl);
      const score = num("0", 22, GOLDL);
      score.position.set(0, stepTop - 6 - 13);
      const nm = tx(s.name, 20, { auto: true, w: "900" });
      squeeze(nm, 170);
      nm.position.set(0, stepTop - 6 - 26 - 4 - 12);
      const charC = new Container();
      charC.position.set(0, stepTop - 6 - 26 - 4 - 24 - 2);
      const a = new Actor(s.color, col.char, "idle", col.i);
      charC.addChild(a);
      let crown: ArtSprite | null = null;
      if (col.i === 0) { crown = new ArtSprite("crown", col.char * 0.38, col.char * 0.26, 0.5, 1); crown.position.set(0, -col.char * 0.66); crown.visible = false; a.addChild(crown); }
      c.addChild(score, nm, charC);
      this.root.addChild(c);
      this.cols.push({ i: col.i, char: charC, a, crown, score, scoreV: s.score, landAge: -1 });
    }
    const winners = list.filter((s) => s.score === list[0]?.score && s.score > 0);
    if (winners.length > 0) {
      const conf = new Confetti(26, 0, [0xffc94d, CREAM, BRASS, RED], false);
      conf.root.position.set(W / 2, 90 + 40);
      this.conf = conf;
      this.root.addChild(conf.root);
    }
    // The rest of the table (places 4–12) on the end side.
    const rest = list.slice(3, 12);
    rest.forEach((s, i) => {
      const row = new Container();
      const w = 170, h = 32;
      row.addChild(box(w, h, 10, INK, 0.65));
      const pl = num(String(placeOf(list, s.id)), 14, CREAM);
      const a = new Actor(s.color, 28, "idle", i);
      const nm = tx(s.name, 14, { auto: true, w: "700", ax: R ? 1 : 0, align: R ? "right" : "left" });
      squeeze(nm, 72);
      const sc = num(String(s.score), 14, GOLDL);
      const sx = R ? -1 : 1;
      pl.position.set(sx * (-w / 2 + 8 + 8), 0);
      a.position.set(sx * (-w / 2 + 22 + 14), 14);
      nm.position.set(sx * (-w / 2 + 56), 0);
      sc.anchor.set(R ? 0 : 1, 0.5);
      sc.position.set(sx * (w / 2 - 8), 0);
      row.addChild(pl, a, nm, sc);
      if (s.left) row.alpha = 0.5;
      row.position.set(mx(W - 24 - w / 2, R), 92 + h / 2 + i * (h + 4));
      this.root.addChild(row);
    });
    this.onRunning(this.step < 3);
    this.apply();
  }
  private apply(): void {
    for (const c of this.cols) {
      const on = landed(c.i, this.step);
      if (on && c.landAge < 0) c.landAge = this.calm ? 1e6 : 0;
      c.a.expr = on ? (c.i === 0 ? "cheer" : "happy") : "idle";
      if (c.crown) c.crown.visible = on;
      c.score.text = String(on ? c.scoreV : 0);
    }
    if (this.step >= 3 && this.confAge < 0) this.confAge = this.calm ? 1e6 : 0;
    this.onRunning(this.step < 3);
  }
  update(): void { /* static */ }
  tick(dt: number): void {
    this.age += dt;
    if (!this.calm && this.step < 3) {
      let s = this.step;
      while (s < 3 && this.age >= podiumDropAt(s)) s++;
      if (s !== this.step) { this.step = s; this.apply(); }
    }
    for (const c of this.cols) {
      if (c.landAge < 0) { c.char.alpha = 0; continue; }
      c.landAge += dt;
      const q = prog(c.landAge, 0, 520);
      c.char.alpha = Math.min(1, c.landAge / 200);
      c.a.y = -120 * (1 - overshoot(q));
      c.a.tick(dt, this.calm);
    }
    if (this.conf && this.confAge >= 0) { this.confAge += dt; this.conf.frame(this.calm ? 0 : clamp01(this.confAge / 1600)); }
  }
  complete(): void { this.step = 3; this.apply(); }
  destroy(): void { clearTimeout(this.timer); resultsSettled.value = false; this.onRunning(false); this.root.destroy({ children: true }); }
}

class EmptyPhase implements Phase {
  readonly root = new Container();
  update(): void { /* nothing to draw */ }
  tick(): void { /* nothing to draw */ }
  destroy(): void { this.root.destroy(); }
}

// ---------------------------------------------------------------- the scene

/** The DOM's screenKey: a new phase, prompt or instance rebuilds the stage. */
function phaseKey(m: BluffModel): string {
  const reveal = m.pub.phase === "REVEAL" && !m.pub.reveal ? "VOTING" : m.pub.phase;
  return `${m.n}:${m.over ? "RESULTS" : reveal}:${m.pub.promptIndex}:${m.pub.prompt?.id ?? ""}`;
}

export class BluffScene implements Scene {
  readonly root = new Container();
  private cafe: Cafe | null = null;
  private top: TopBar | null = null;
  private readonly layer = new Container();
  private phase: Phase | null = null;
  private key = "";
  private view: TvRoomView | null = null;
  private ready = false;
  /** Until the café has decoded (first Bluff screen of the session only): its plain wall colour. */
  private readonly wall = new Graphics().rect(0, 0, W, H).fill(wc("deep"));
  private readonly onArt = (): void => {
    this.ready = true;
    this.cafe = new Cafe();
    this.wall.destroy();
    this.root.addChildAt(this.cafe.root, 0);
    this.top = new TopBar();
    this.root.addChild(this.top.root);
    if (this.view) this.set(this.view);
  };
  constructor(private readonly onRunning: (running: boolean) => void, private readonly onComplete: (f: (() => void) | null) => void) {
    this.root.addChild(this.wall, this.layer);
    loadBluffArt(this.onArt);
  }

  set(view: TvRoomView): void {
    this.view = view;
    const m = bluffModel(view);
    if (!m || !this.ready) return;
    preloadChars(m.seats.map((s) => s.color));
    const key = phaseKey(m);
    if (key !== this.key) {
      this.key = key;
      this.phase?.root.parent?.removeChild(this.phase.root);
      this.phase?.destroy();
      this.onRunning(false);
      this.phase = this.make(m);
      this.layer.addChild(this.phase.root);
      this.onComplete(this.phase.complete ? () => this.phase?.complete?.() : null);
    } else this.phase?.update(m);
    const p = m.over ? "RESULTS" : m.pub.phase;
    const live = p === "WRITING" || p === "VOTING" || (p === "REVEAL" && !m.pub.reveal);
    this.cafe?.configure({
      dim: p === "REVEAL" ? !!m.pub.reveal : p === "SCORES" || p === "HOLD" || p === "AWARDS" || p === "RESULTS" || (p === "ROUND_INTRO" && isFinal(m.pub)),
      board: p === "VOTING" || (p === "REVEAL" && !m.pub.reveal),
      neon: p !== "AWARDS" && p !== "RESULTS",
      calmNeon: live || p === "REVEAL" || p === "SCORES",
    });
    this.top?.set(m, p === "AWARDS" ? tk("awards.title") : p === "RESULTS" ? t("results.title") : null, live);
  }

  private make(m: BluffModel): Phase {
    if (m.over || m.pub.phase === "RESULTS") return new ResultsPhase(m, this.onRunning);
    switch (m.pub.phase) {
      case "ROUND_INTRO": return new IntroPhase(m);
      case "WRITING": return new WritingPhase(m);
      case "VOTING": return new VotingPhase(m);
      case "REVEAL": return m.pub.reveal ? new RevealPhase(m, this.onRunning) : new VotingPhase(m);
      case "SCORES": return new ScoresPhase(m);
      case "HOLD": return new HoldPhase(m);
      case "AWARDS": return new AwardsPhase(m, this.onRunning);
      default: return new EmptyPhase();
    }
  }

  /** Phase animations run on the wall clock (the Pixi ticker caps a frame at 100 ms; a slow frame must not slow them). */
  private last = -1;
  tick(_dtMs: number): void {
    const now = performance.now();
    const dt = this.last < 0 ? 16 : Math.min(1000, Math.max(0, now - this.last));
    this.last = now;
    this.cafe?.tick(dt);
    this.top?.tick();
    this.phase?.tick(dt);
  }
  destroy(): void { forgetBluffArt(this.onArt); this.phase?.destroy(); this.phase = null; this.root.destroy({ children: true }); }
}
