// Quiz Night on the Pixi TV (GAME-TRIVIA §8 / §12, DESIGN-JAMAA §5.4 + §7.9): QUIZ_INTRO, READ, ANSWER, REVEAL,
// LEADERBOARD, FINAL_INTRO, HOLD and RESULTS, drawn by PixiJS in "The Studio". It reads the same view model
// (games/trivia/model.ts), the same fixed geometry (layout.ts: cardRect, tileRect, towerBox, podiumSlots, crowdSlot,
// coinPoint, hopPoint…), the same reveal plan (tv/reveal.tsx revealPlan) and the same timelines (REVEAL / BOARD /
// PODIUM steps on the shared `run` sampler, with the same sound marks of cues.ts) as the DOM screens in
// games/trivia/tv; what the DOM gets from CSS keyframes is in triviaPlan.ts as shared motion steps with the same
// delays. Static Graphics, canvas Text, one sprite per character, transforms only per frame. Secrecy (§8.1): the
// TV projection carries no correct answer before REVEAL and nothing here invents one; before REVEAL a podium only
// lights white (and its "done" badge is cream, never the jade that means "correct"). The tiles are never mirrored.
// Design units are the 960 × 540 canvas; the host scales them 2×.
import { Container, FillGradient, Graphics, Sprite, Texture } from "pixi.js";
import type { Text } from "pixi.js";
import { BODY_PATHS, REACTION_EXPRESSION, REACTION_HOLD_MS } from "@jamaa/shared/characters";
import type { Expression } from "@jamaa/shared/characters";
import { COLORS } from "@jamaa/shared/constants";
import type { ColorId } from "@jamaa/shared/constants";
import { run, sample, variant } from "@jamaa/shared/motion";
import type { Run, Step } from "@jamaa/shared/motion";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { worldColor } from "@jamaa/shared/worlds";
import type { WorldToken } from "@jamaa/shared/worlds";
import { fmtNum, isolate, listOf, locale, t, titleIn } from "../i18n/t";
import { reduced } from "../lib/motion";
import { ellipsizeName } from "../lib/names";
import { clockOffset } from "../state/store";
import { backHintOn } from "../tv-mock/tvParts";
import { tvConn, tvPaused } from "../tv-mock/tvStore";
import { resultsSettled } from "../tv-mock/tvPlatform";
import { play, stopAll } from "../tv-mock/sound/player";
import { timelineCues } from "../tv-mock/sound/cues";
import type { TimelineMark } from "../tv-mock/sound/cues";
import {
  activePlayers, biggestClimb, expressionFor, flameLevel, leftMs, letterOf, playersOf, podiumOf, questionNumber, resultsStats, standings, tokensOf,
  triviaOfTv,
} from "../games/trivia/model";
import type { Player, Trivia, TriviaPub, TokenId } from "../games/trivia/model";
import { BOARD_MARKS, PODIUM_MARKS, answerTickCue, revealMarks } from "../games/trivia/cues";
import {
  BOARD_STEPS, CARD_H, CARD_Y, CROWD_CHAR, EXPLAIN_AT_MS, PODIUM_CHAR, PODIUM_STEPS, PODIUM_TOP, REVEAL_CARD_H, REVEAL_STEPS, TILE_Y, bulbs, bulbsLit,
  cardRect, coinPoint, hopPoint, podiumSlots, tileRect, towerBox, towerRowH, verdictBand,
} from "../games/trivia/layout";
import type { Pt, Rect } from "../games/trivia/layout";
import { TOKEN_HEX } from "../games/trivia/tokens";
import { revealPlan } from "../games/trivia/tv/reveal";
import { tk, topicLabel } from "../games/trivia/tv/parts";
import { domainLabel } from "../games/trivia/vocab";
import { CHAR_ASPECT, charSvg, charTexture } from "./art";
import { CREAM, GOLD, H, INK, SCALE, W, hex, setText as kitSetText, txt as kitTxt } from "./kit";
import type { TxtOpts } from "./kit";
import type { Scene } from "./stage";
import {
  ANSWER_STEPS, BOARD_X, BOARD_Y, EXPLAIN_STEPS, FINAL_STEPS, INTRO_STEPS, PODIUM_BASE_Y, PODIUM_COL_W, READ_STEPS, SQUEEZE_STEPS, STEP_H, boardRows,
  castXs, chaseOn, fitScale, fitSizes, podiumCharSize, podiumColumns, questionFont, rollValue, stampLook, startsRtl, wrapCentred,
} from "./triviaPlan";

// ------------------------------------------------------------------------------------------------ palette + helpers
const wc = (tok: WorldToken): string => worldColor("quiz-studio", tok, "web") ?? "#0A0F2E";
const wcol = (tok: WorldToken): number => hex(wc(tok));
const TEXT2 = 0xe2d6f5;
const MUTED = 0xb8a8d6;
const JADE = 0x3ddc97;
const isRtl = (): boolean => locale.value === "ar";
/** Pixi draws text on detached canvases whose base direction is not the page's: in RTL every string is wrapped in
 *  RLMs so a mixed line ("نور 3,710", "Rami: …") orders exactly as the DOM's RTL paragraph does. */
const bidi = (s: string): string => (isRtl() && s ? `\u200F${s}\u200F` : s);
const txt = (s: string, size: number, o?: TxtOpts): Text => kitTxt(bidi(s), size, o);
const setText = (t: Text, s: string, maxW?: number): void => kitSetText(t, bidi(s), maxW);
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const playerHex = (c: ColorId): string => (COLORS.find((x) => x.id === c) ?? COLORS[0]).hex;
const lineK = (): number => (isRtl() ? 1.4 : 1.22);
const upper = (s: string): string => (isRtl() ? s : s.toLocaleUpperCase(locale.value));
const nowMs = (): number => performance.now();

/** Steps sampled by this phase's own clock (CSS-keyframe parity; not OK-completable, like the DOM). */
class Clock {
  t = 0;
  private readonly by: Map<string, Step>;
  constructor(steps: readonly Step[]) { this.by = new Map(variant(steps, { reduced: reduced() }).map((s) => [s.id, s])); }
  p(id: string, i = 0): number { const s = this.by.get(id); return s ? sample(s, this.t, i) : 1; }
}

/** A canvas Text that wraps inside `w` and shrinks (size steps, then a uniform scale) until it fits `w × h`. */
function fitPara(t: Text, s: string, w: number, h: number, max: number, min: number): void {
  t.scale.set(1);
  t.text = bidi(s);
  t.style.wordWrap = true;
  t.style.breakWords = false;
  for (const size of fitSizes(max, min)) {
    t.style.fontSize = size;
    t.style.lineHeight = Math.round(size * lineK());
    t.style.wordWrapWidth = w;
    if (t.height <= h && t.width <= w + 0.5) return;
  }
  t.scale.set(Math.min(fitScale(t.width, w), fitScale(t.height, h)));
}
function para(s: string, w: number, h: number, max: number, min: number, o: TxtOpts = {}): Text {
  const t = txt("", max, { ...o, wrap: w });
  fitPara(t, s, w, h, max, min);
  return t;
}

// ------------------------------------------------------------------------------------------------ SVG textures
const svgCache = new Map<string, Texture>();
const svgWait = new Map<string, ((t: Texture) => void)[]>();
/** An SVG string rasterised once into a texture (empty until it decodes; `onReady` swaps the real one in). */
function svgTexture(key: string, svg: string, pxW: number, pxH: number, onReady: (t: Texture) => void): Texture {
  const hit = svgCache.get(key);
  if (hit) return hit;
  const list = svgWait.get(key);
  if (list) { list.push(onReady); return Texture.EMPTY; }
  svgWait.set(key, [onReady]);
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas");
    cv.width = pxW; cv.height = pxH;
    cv.getContext("2d")!.drawImage(img, 0, 0, pxW, pxH);
    const tex = Texture.from(cv);
    tex.source.autoGenerateMipmaps = true;
    svgCache.set(key, tex);
    for (const f of svgWait.get(key) ?? []) f(tex);
    svgWait.delete(key);
  };
  img.onerror = () => { svgWait.delete(key); };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return Texture.EMPTY;
}

/** A sprite of an SVG drawing, `w × h` dp, anchored at its centre unless told otherwise. */
class Icon extends Sprite {
  constructor(key: string, svg: string, private readonly w0: number, private readonly h0: number, ax = 0.5, ay = 0.5, px = 3) {
    super();
    this.anchor.set(ax, ay);
    const pw = Math.ceil(w0 * SCALE * px / 2) * 2, ph = Math.ceil(h0 * SCALE * px / 2) * 2;
    this.texture = svgTexture(`${key}@${pw}x${ph}`, svg, pw, ph, (tx) => { if (!this.destroyed) { this.texture = tx; this.fit(); } });
    this.fit();
  }
  private fit(): void { this.width = this.w0; this.height = this.h0; }
}

const SVG = (vb: string, body: string, w = 24, h = 24): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">${body}</svg>`;
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4, r1 = 7.6, r2 = 10.4;
  return `M${(12 + r1 * Math.cos(a)).toFixed(2)} ${(12 + r1 * Math.sin(a)).toFixed(2)}L${(12 + r2 * Math.cos(a)).toFixed(2)} ${(12 + r2 * Math.sin(a)).toFixed(2)}`;
}).join("");
/** The answer tokens (tokens.tsx TokenShape, same drawings). */
function tokenSvg(id: TokenId, color: string): string {
  const body = id === "a" ? `<g fill="${color}" stroke="${color}"><circle cx="12" cy="12" r="5.2" stroke="none"/><path d="${RAYS}" stroke-width="2.2" stroke-linecap="round" fill="none"/></g>`
    : id === "b" ? `<path d="M2.5 9.2c2.4-2.6 4.8-2.6 7.2 0s4.8 2.6 7.2 0 3.6-2 4.6-1.4M2.5 15.6c2.4-2.6 4.8-2.6 7.2 0s4.8 2.6 7.2 0 3.6-2 4.6-1.4" fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round"/>`
      : id === "c" ? `<path d="M4.2 19.8C3.6 10.4 9.6 3.8 20.6 3.4c.6 10.6-5.8 16.8-16.4 16.4z" fill="${color}"/><path d="M5.6 18.4C9.4 14 12.6 10.8 16.6 7.6" fill="none" stroke="${color === "#120A1F" ? "#FFF7EC" : "#120A1F"}" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>`
        : id === "d" ? `<path d="M12 1.6l2.5 7.9 7.9 2.5-7.9 2.5-2.5 7.9-2.5-7.9L1.6 12l7.9-2.5z" fill="${color}" stroke="${color}" stroke-width="1" stroke-linejoin="round"/>`
          : id === "true" ? `<path d="M4.6 12.6l4.8 4.8L19.6 7" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`
            : `<path d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round"/>`;
  return SVG("0 0 24 24", body);
}
const tokenIcon = (id: TokenId, size: number, color = "#120A1F"): Icon => new Icon(`tok-${id}-${color}`, tokenSvg(id, color), size, size);
const boltIcon = (size: number): Icon => new Icon("bolt", SVG("0 0 24 24", '<path d="M13.6 1.8L4.6 13.4h6.2l-1.6 8.8 9.4-12.2h-6.4z" fill="#FFF04D" stroke="#120A1F" stroke-width="1.1" stroke-linejoin="round"/>'), size, size);
const FLAME_SVG = SVG("0 0 24 32", '<path d="M12 1.5c1.2 4.6 6.6 7.6 7.8 13.4 1.2 6-2.8 15.2-7.8 15.2S2.8 25.6 4 19.8c.8-3.6 3.2-5 3.8-8.2 2.2 2 2.4 4 2.4 4C12.4 11.8 10.6 6 12 1.5z" fill="#FF7A1F"/><path d="M12.2 13.6c.8 3 4.4 4.8 4.4 9 0 3.6-2.2 5.8-4.6 5.8s-4.6-2.2-4.2-5.4c.4-2.4 2-3.4 2.6-5.4 1 1 1.4 2.2 1.4 2.2.8-2 .2-4.2.4-6.2z" fill="#FFF04D"/>', 24, 32);
const flameIcon = (w: number, ax = 0.5, ay = 0.5): Icon => new Icon("flame", FLAME_SVG, w, (w * 32) / 24, ax, ay);
const starIcon = (size: number, on: boolean): Icon => new Icon(`star-${on ? 1 : 0}`, SVG("0 0 24 24", `<path d="M12 2.2l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.2l-6 3.3 1.3-6.7-5-4.6 6.8-.8z" stroke-width="1.6" stroke-linejoin="round" stroke="#FFC94D" fill="${on ? "#FFC94D" : "rgba(255,255,255,.1)"}"/>`), size, size);
const trophyIcon = (size: number): Icon => new Icon("trophy", SVG("0 0 32 32", '<path d="M9 4h14v7a7 7 0 01-14 0z" fill="#FFC94D" stroke="#120A1F" stroke-width="1.2"/><path d="M9 7H5c0 4 2 6 5 6M23 7h4c0 4-2 6-5 6" fill="none" stroke="#FFC94D" stroke-width="2"/><path d="M14 18h4v5h-4z" fill="#E9A23B"/><rect x="10" y="23" width="12" height="4" rx="1.5" fill="#FFC94D" stroke="#120A1F" stroke-width="1.2"/><path d="M13 7.5v4" stroke="#FFF7EC" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>', 32, 32), size, size);
const checkIcon = (size: number, color: string): Icon => new Icon(`check-${color}`, SVG("0 0 24 24", `<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`), size, size);
const wifiIcon = (size: number): Icon => new Icon("wifi-off", SVG("0 0 24 24", '<g fill="none" stroke="#FFF7EC" stroke-width="2.2" stroke-linecap="round"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M3 3l18 18"/></g><circle cx="12" cy="19" r="1.4" fill="#FFF7EC"/>'), size, size);
const backIcon = (size: number): Icon => new Icon("arrow-back", SVG("0 0 24 24", '<path d="M15 5l-7 7 7 7" fill="none" stroke="#B8A8D6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'), size, size);

// ------------------------------------------------------------------------------------------------ characters
const CROWN = '<path d="M7.5 -1.5l2 1.6L12 -3.6l2.5 3.7 2-1.6-.9 4.5H8.4z" fill="#FFC94D" stroke="#120A1F" stroke-width=".5" stroke-linejoin="round"/>';
/** The character texture: the shared one (art.ts), except Quiz Night's cream "done" badge (jade means "correct", so
 *  before REVEAL the lock cue is neutral, §8.1) and the leader's crown. */
function actorTexture(color: ColorId, e: Expression, crown: boolean, onReady: (t: Texture) => void): Texture {
  if (!crown && e !== "done") return charTexture(color, e, onReady);
  let svg = charSvg(color, e);
  if (e === "done") svg = svg.replace('fill="#3DDC97"', 'fill="#FFF7EC"');
  if (crown) svg = svg.replace("</svg>", `${CROWN}</svg>`);
  return svgTexture(`ch-${color}-${e}-${crown ? 1 : 0}`, svg, 240, 256, onReady);
}
/** A cream silhouette a little bigger than the body (the DOM's drop-shadow contour on the reveal's jumpers, so a jade
 *  player never vanishes into the jade leaf). */
function outlineTexture(color: ColorId, onReady: (t: Texture) => void): Texture {
  const shape = (COLORS.find((x) => x.id === color) ?? COLORS[0]).shape;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -5 30 32" width="240" height="256"><path d="${BODY_PATHS[shape]}" fill="#FFF7EC" stroke="#FFF7EC" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  return svgTexture(`outline-${shape}`, svg, 240, 256, onReady);
}

type Key = [number, number, number, number, number, number]; // t, dy, sx, sy, rot(deg), dx (fractions of the size)
/** platform.css character rigs as keyframes (fractions of the character size). */
const RIGS: Partial<Record<Expression, { ms: number; reps: number; hold: boolean; keys: Key[] }>> = {
  happy: { ms: 700, reps: 1, hold: false, keys: [[0, 0, 1.06, 0.92, 0, 0], [0.4, -0.16, 0.95, 1.06, 0, 0], [0.7, 0, 1.05, 0.95, 0, 0], [1, 0, 1, 1, 0, 0]] },
  cheer: { ms: 640, reps: 2, hold: false, keys: [[0, 0, 1.06, 0.92, 0, 0], [0.4, -0.16, 0.95, 1.06, 0, 0], [0.7, 0, 1.05, 0.95, 0, 0], [1, 0, 1, 1, 0, 0]] },
  laugh: { ms: 380, reps: 2, hold: false, keys: [[0, 0, 1, 1, 0, 0], [0.5, -0.06, 1, 1, -3, 0], [1, 0, 1, 1, 0, 0]] },
  sad: { ms: 600, reps: 1, hold: true, keys: [[0, 0, 1, 1, 0, 0], [1, 0.06, 1.02, 0.96, 0, 0]] },
  shock: { ms: 420, reps: 1, hold: true, keys: [[0, 0, 1, 1, 0, 0], [0.35, -0.1, 1, 1, -6, -0.06], [1, 0, 1, 1, 0, -0.03]] },
  done: { ms: 500, reps: 1, hold: false, keys: [[0, 0, 1, 1, 0, 0], [0.4, 0.04, 1, 1, 0, 0], [1, 0, 1, 1, 0, 0]] },
};
function keyAt(keys: Key[], u: number): Key {
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!, b = keys[i]!;
    if (u <= b[0]) { const k = (u - a[0]) / Math.max(1e-6, b[0] - a[0]); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; return a.map((v, j) => v + (b[j]! - v) * e) as Key; }
  }
  return keys[keys.length - 1]!;
}

/** A player's character by its feet: expression rigs (breathe, hop, nod, sink…), streak flame, crown, contour. */
class Actor extends Container {
  readonly rig = new Container();
  private readonly spr = new Sprite();
  private readonly outline: Sprite | null = null;
  private flame: Icon | null = null;
  private flameH = 0;
  private expr: Expression;
  private crown = false;
  private age = 0;
  private animAt = 0;
  private readonly seed: number;
  constructor(private readonly color: ColorId, private readonly size: number, e: Expression, o: { outline?: boolean; flame?: number } = {}) {
    super();
    this.expr = e;
    this.seed = (color.charCodeAt(0) * 37 + color.length * 101) % 1000;
    this.addChild(this.rig);
    if (o.flame) this.setFlame(o.flame);
    if (o.outline) {
      const ol = new Sprite();
      ol.anchor.set(0.5, 1);
      ol.texture = outlineTexture(color, (tx) => { if (!ol.destroyed) { ol.texture = tx; this.fitSprite(ol, 1.07); } });
      this.fitSprite(ol, 1.07);
      ol.alpha = 0.95;
      this.outline = ol;
      this.rig.addChild(ol);
    }
    this.spr.anchor.set(0.5, 1);
    this.rig.addChild(this.spr);
    this.refresh();
    this.animAt = 0;
  }
  private fitSprite(s: Sprite, k = 1): void { s.width = this.size * CHAR_ASPECT * k; s.height = this.size * k; s.y = this.size * (k - 1) * 0.12; }
  private refresh(): void {
    const e = this.expr, c = this.crown;
    this.spr.texture = actorTexture(this.color, e, c, (tx) => { if (!this.destroyed && this.expr === e && this.crown === c) { this.spr.texture = tx; this.fitSprite(this.spr); } });
    this.fitSprite(this.spr);
    this.rig.alpha = e === "away" ? 0.55 : 1;
  }
  setFlame(level: number): void {
    if (level <= 0) { if (this.flame) { this.flame.destroy(); this.flame = null; } return; }
    if (!this.flame) { this.flame = flameIcon(this.size * 0.9, 0.5, 1); this.addChildAt(this.flame, 0); }
    const k = level === 3 ? 1.4 : level === 2 ? 1.2 : 1;
    this.flame.width = this.size * 0.9 * 1.6 * k;
    this.flameH = this.size * 0.9 * (32 / 24) * 1.5 * k;
    this.flame.height = this.flameH;
    this.flame.y = -2;
  }
  set(e: Expression, crown = false): void {
    if (e === this.expr && crown === this.crown) return;
    const changed = e !== this.expr;
    this.expr = e; this.crown = crown;
    this.refresh();
    if (changed) this.animAt = this.age;
  }
  get expression(): Expression { return this.expr; }
  tick(dt: number): void {
    this.age += dt;
    const calm = reduced();
    let dy = 0, sx = 1, sy = 1, rot = 0, dx = 0;
    const rig = RIGS[this.expr];
    if (this.expr === "point") rot = isRtl() ? -6 : 6;
    else if (this.expr === "shy") { sx = sy = 0.97; dy = 0.02; }
    if (rig) {
      const local = this.age - this.animAt;
      const total = rig.ms * rig.reps;
      if (calm) { if (rig.hold) [, dy, sx, sy, rot, dx] = rig.keys[rig.keys.length - 1]!; }
      else if (local < total) [, dy, sx, sy, rot, dx] = keyAt(rig.keys, (local % rig.ms) / rig.ms);
      else if (rig.hold) [, dy, sx, sy, rot, dx] = rig.keys[rig.keys.length - 1]!;
    } else if (!calm && this.expr === "idle") {
      const u = Math.sin(((nowMs() + this.seed * 3.2) / 3200) * Math.PI * 2);
      sx = 1 + 0.0125 * (1 - u); sy = 1 - 0.0125 * (1 - u);
    } else if (!calm && this.expr === "think") {
      rot = -1.5 * (1 - Math.cos(((nowMs() + this.seed * 2.4) / 2400) * Math.PI * 2));
    }
    this.rig.position.set(dx * this.size, dy * this.size);
    this.rig.scale.set(sx, sy);
    this.rig.rotation = (rot * Math.PI) / 180;
    // tq-flicker: scaleY 0.92 <-> 1.08 every 380 ms (alternate).
    if (this.flame) this.flame.height = this.flameH * (calm ? 1 : 1 + 0.08 * Math.sin((nowMs() / 380) * Math.PI - Math.PI / 2));
  }
}

/** Platform reactions (REACT): the reaction's expression holds 1.5 s, keyed by `reaction.n` (Character useReaction). */
class Reactions {
  private readonly seen = new Map<string, number>();
  private readonly until = new Map<string, { e: Expression; at: number }>();
  update(ps: readonly Player[]): void {
    for (const p of ps) {
      const n = p.reaction?.n ?? 0;
      const was = this.seen.get(p.id);
      this.seen.set(p.id, n);
      if (was !== undefined && p.reaction && n !== was) this.until.set(p.id, { e: REACTION_EXPRESSION[p.reaction.kind], at: Date.now() + REACTION_HOLD_MS });
    }
  }
  of(id: string): Expression | null {
    const r = this.until.get(id);
    return r && r.at > Date.now() ? r.e : null;
  }
}

// ------------------------------------------------------------------------------------------------ the studio
// Gradients are textures: each distinct one is made once and kept (a screen remounts on every phase change).
const grads = new Map<string, FillGradient>();
interface Stop { offset: number; color: string }
function linGrad(stops: Stop[], horizontal = false, reverse = false): FillGradient {
  const key = `l${horizontal ? "h" : "v"}${reverse ? "r" : ""}${JSON.stringify(stops)}`;
  let g = grads.get(key);
  if (!g) {
    const a = reverse ? 1 : 0, b = reverse ? 0 : 1;
    g = new FillGradient({ type: "linear", start: horizontal ? { x: a, y: 0 } : { x: 0, y: a }, end: horizontal ? { x: b, y: 0 } : { x: 0, y: b }, colorStops: stops, textureSpace: "local" });
    grads.set(key, g);
  }
  return g;
}
const lin = (a: string, b: string, at = 1, extra: Stop[] = []): FillGradient => linGrad([{ offset: 0, color: a }, { offset: at, color: b }, ...extra]);
function rad(stops: Stop[], cx = 0.5, cy = 0.5, r = 0.5): FillGradient {
  const key = `r${cx},${cy},${r}${JSON.stringify(stops)}`;
  let g = grads.get(key);
  if (!g) {
    g = new FillGradient({ type: "radial", center: { x: cx, y: cy }, innerRadius: 0, outerCenter: { x: cx, y: cy }, outerRadius: r, colorStops: stops, textureSpace: "local" });
    grads.set(key, g);
  }
  return g;
}
const rgba = (h: string, a: number): string => {
  const n = hex(h);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const COAST_A = [0, 360, 90, 300, 160, 334, 250, 262, 330, 318, 420, 276, 520, 330, 600, 296, 700, 344, 800, 286, 880, 322, 960, 300, 960, 420, 0, 420];
const COAST_B = [0, 384, 120, 344, 210, 372, 320, 330, 440, 374, 560, 350, 680, 380, 820, 340, 960, 368, 960, 430, 0, 430];

/** §12.1 The Studio: night navy stage, the chasing bulb marquee, two sweeping spotlights, the curved stage floor; the
 *  Lebanon quiz adds a stylised coast-and-mountains sunset. `heat` = FINAL_INTRO's red-amber lights; `dim` = boards. */
class Studio {
  readonly root = new Container();
  private readonly back = new Container();
  private readonly spots: Graphics[] = [];
  private readonly bulbs: { core: Graphics; glow: Graphics; on: boolean | null }[] = [];
  private readonly heatG: Graphics;
  private heat = false;
  private dim = false;
  constructor(coast: boolean) {
    const g = new Graphics().rect(0, 0, W, H).fill(lin(wc("stageTop"), wc("deep"), 0.62, [{ offset: 1, color: wc("deep") }]));
    g.rect(0, 0, W, H).fill(rad([{ offset: 0, color: rgba(wc("glow"), 0.16) }, { offset: 0.7, color: rgba(wc("glow"), 0) }, { offset: 1, color: rgba(wc("glow"), 0) }], 0.5, -0.05, 0.9));
    g.rect(0, 0, W, H).fill(rad([{ offset: 0, color: rgba(wc("accent"), 0.14) }, { offset: 0.7, color: rgba(wc("accent"), 0) }, { offset: 1, color: rgba(wc("accent"), 0) }], -0.1, 0.7, 0.6));
    g.rect(0, 0, W, H).fill(rad([{ offset: 0, color: rgba(wc("accent"), 0.1) }, { offset: 0.7, color: rgba(wc("accent"), 0) }, { offset: 1, color: rgba(wc("accent"), 0) }], 1.1, 0.7, 0.6));
    this.back.addChild(g);
    if (coast) {
      const c = new Graphics();
      c.circle(640, 356, 74).fill(rad([{ offset: 0, color: "rgba(255,176,102,0.7)" }, { offset: 1, color: "rgba(255,122,31,0)" }]));
      c.poly(COAST_A).fill(0x141c52);
      c.poly(COAST_B).fill(0x10184a);
      for (const [x1, x2, y] of [[560, 720, 404], [590, 690, 414], [612, 668, 424]] as const) c.moveTo(x1, y).lineTo(x2, y).stroke({ width: 2, color: 0xffd84d, alpha: 0.22, cap: "round" });
      c.alpha = 0.55;
      this.back.addChild(c);
    }
    const floor = new Graphics().ellipse(480, 530, 576, 130).fill(rad([{ offset: 0, color: "#2A357A" }, { offset: 0.6, color: "#161D4A" }, { offset: 1, color: "#0A0F2E" }], 0.5, 0.3, 0.6));
    floor.ellipse(480, 530, 574, 128).stroke({ width: 3, color: 0xffd84d, alpha: 0.35 });
    this.back.addChild(floor);
    const rail = new Graphics().moveTo(0, 8).quadraticCurveTo(480, 16, 960, 8).stroke({ width: 9, color: 0x222b63 });
    this.back.addChild(rail);
    this.root.addChild(this.back);
    // The static backdrop is one cached texture (a weak TV GPU then blends one quad instead of six gradient layers).
    this.back.cacheAsTexture({ resolution: SCALE, antialias: true });
    for (const x of [40, W - 40 - 300]) {
      const s = new Graphics().poly([132, 0, 168, 0, 300, 620, 0, 620]).fill(lin("rgba(255,216,77,0.22)", "rgba(255,216,77,0)", 0.8, [{ offset: 1, color: "rgba(255,216,77,0)" }]));
      s.pivot.set(150, 0);
      s.position.set(x + 150, -40);
      s.blendMode = "add";
      this.spots.push(s);
      this.root.addChild(s);
    }
    for (let i = 0; i < 34; i++) {
      const x = 14 + (i * 932) / 33, y = 7 + 3 * Math.sin((i / 33) * Math.PI);
      const glow = new Graphics().circle(0, 0, 7.5).fill({ color: 0xffd84d, alpha: 0.35 });
      glow.position.set(x, y);
      const core = new Graphics().circle(0, 0, 3.6).fill(0xffffff);
      core.position.set(x, y);
      this.root.addChild(glow, core);
      this.bulbs.push({ core, glow, on: null });
    }
    this.heatG = new Graphics().rect(0, 0, W, H).fill(rad([{ offset: 0, color: "rgba(255,122,31,0.42)" }, { offset: 0.55, color: "rgba(240,24,58,0.18)" }, { offset: 0.8, color: "rgba(240,24,58,0)" }, { offset: 1, color: "rgba(240,24,58,0)" }], 0.5, 0.3, 0.8));
    this.heatG.visible = false;
    this.root.addChild(this.heatG);
  }
  set(heat: boolean, dim: boolean): void { this.heat = heat; this.dim = dim; this.heatG.visible = heat; }
  tick(): void {
    const calm = reduced(), t = nowMs();
    this.spots.forEach((s, i) => {
      const a = i === 0 ? -16 : 16, b = i === 0 ? 6 : -6;
      const u = calm ? 0 : (1 - Math.cos(((t + (i === 1 ? 3500 : 0)) / 7000) * Math.PI * 2)) / 2;
      s.rotation = calm ? 0 : ((a + (b - a) * u) * Math.PI) / 180;
      s.alpha = this.dim ? 0.4 : 1;
      s.tint = this.heat ? 0xff9a50 : 0xffffff;
    });
    this.bulbs.forEach((b, i) => {
      const on = calm || chaseOn(i, t, this.heat);
      if (on === b.on) return;
      b.on = on;
      b.core.tint = on ? 0xffe9a0 : 0x7a6a3a;
      b.core.alpha = on ? 1 : 0.55;
      b.glow.visible = on;
    });
    if (this.heat) this.heatG.alpha = calm ? 1 : 0.85 + 0.15 * Math.sin((t / 1200) * Math.PI);
  }
}

// ------------------------------------------------------------------------------------------------ top bar
const TOP_LABEL: Partial<Record<TriviaPub["phase"], string>> = { FINAL_INTRO: "phase.finalIntro", HOLD: "phase.hold" };
function topLabel(pub: TriviaPub): string {
  const q = questionNumber(pub);
  const quiz = titleIn(pub.quiz.title);
  const key = TOP_LABEL[pub.phase];
  return pub.phase === "QUIZ_INTRO" ? tk("title")
    : pub.phase === "LEADERBOARD" ? `${quiz} · ${tk("read.questionOf", { index: q.index, total: q.total })}`
      : pub.phase === "RESULTS" ? quiz
        : key ? tk(key)
          : `${tk("read.questionOf", { index: q.index, total: q.total })}${pub.question ? ` · ${topicLabel(pub.question.topic)}` : ""}`;
}

/** The in-game top bar (y 14–54): what we are on (+ the final's ×2), the room code, the "◁ Back" hint, offline chip. */
class TopBar {
  readonly root = new Container();
  private readonly title = txt("", 22, { weight: "900", fill: wcol("accentText"), anchorX: 0 });
  private readonly x2 = new Container();
  private readonly code = txt("", 20, { weight: "900", fill: GOLD });
  private readonly hint = new Container();
  private readonly hintText = txt("", 15, { weight: "600", fill: MUTED, anchorX: 0 });
  private readonly conn = new Container();
  private sig = "";
  private pub: TriviaPub | null = null;
  private loc = "";
  private label = "";
  constructor() {
    // letterSpacing draws glyph by glyph (it would break Arabic shaping): Latin labels only, like tv.css.
    const x2t = txt(tk("final.stamp"), 18, { weight: "900", fill: INK });
    this.x2.addChild(new Graphics().roundRect(-x2t.width / 2 - 10, -13, x2t.width + 20, 26, 13).fill(0xff7a1f), x2t);
    this.hint.addChild(new Graphics(), backIcon(18), this.hintText);
    this.conn.addChild(new Graphics().roundRect(-18, -15, 36, 30, 15).fill(0xd6333a), wifiIcon(20));
    this.root.addChild(this.title, this.x2, this.code, this.hint, this.conn);
  }
  set(pub: TriviaPub, roomCode: string): void {
    const hintOn = backHintOn.value && !tvPaused.value;
    const off = tvConn.value !== "open";
    if (pub !== this.pub || locale.value !== this.loc) { this.pub = pub; this.loc = locale.value; this.label = topLabel(pub); }
    const label = this.label;
    const sig = `${label}|${pub.isFinal}|${pub.phase}|${roomCode}|${locale.value}|${hintOn}|${off}`;
    if (sig === this.sig) return;
    this.sig = sig;
    const rtl = isRtl();
    const y = 34;
    // The end cluster first (its width bounds the title).
    let end = W - 28;
    const place = (c: Container, w: number): void => { c.position.set(rtl ? W - end + w / 2 : end - w / 2, y); end -= w + 12; };
    this.code.text = roomCode.split("").join(" ");
    place(this.code, this.code.width);
    this.hint.visible = hintOn;
    if (hintOn) {
      setText(this.hintText, t("hint.backMenu"));
      const w = this.hintText.width + 18 + 6 + 20;
      const [bg, ic] = this.hint.children as [Graphics, Icon];
      bg.clear().roundRect(-w / 2, -15, w, 30, 15).fill({ color: 0x000000, alpha: 0.25 });
      ic.position.set(rtl ? w / 2 - 19 : -w / 2 + 19, 0);
      ic.scale.x = Math.abs(ic.scale.x) * (rtl ? -1 : 1);
      this.hintText.anchor.x = rtl ? 1 : 0;
      this.hintText.position.set(rtl ? w / 2 - 34 : -w / 2 + 34, 0);
      place(this.hint, w);
    }
    this.conn.visible = off;
    if (off) place(this.conn, 36);
    const endW = W - 28 - end;
    const showX2 = pub.isFinal && pub.phase !== "FINAL_INTRO" && pub.phase !== "RESULTS";
    const x2w = showX2 ? this.x2.width + 10 : 0;
    const ls = rtl || /[\u0590-\u08ff]/.test(label) ? 0 : 1.3;
    if (this.title.style.letterSpacing !== ls) { this.title.style.letterSpacing = ls; this.title.text = ""; }
    setText(this.title, upper(label), W - 56 - endW - x2w - 24);
    this.title.anchor.x = rtl ? 1 : 0;
    this.title.position.set(rtl ? W - 28 : 28, y);
    this.x2.visible = showX2;
    if (showX2) this.x2.position.set(rtl ? W - 28 - this.title.width - 10 - this.x2.width / 2 : 28 + this.title.width + 10 + this.x2.width / 2, y);
  }
}

// ------------------------------------------------------------------------------------------------ podiums
interface PodiumSeat { p: Player; slot: Pt; box: Container; ring: Graphics; actor: Actor | null; lit: number; litTo: number }

/** The podium row (§12.1): every active player behind a podium with its name plate; the plate's light ring turns on
 *  (white) once the player answered: no colour, no shape, no position, nothing hints at the choice (§8.1). */
class PodiumRow {
  readonly root = new Container();
  readonly seats: PodiumSeat[] = [];
  constructor(tr: Trivia, players: Player[], private readonly reacts: Reactions, actors = true) {
    const slots = podiumSlots(players.length, isRtl());
    const w = slots.length > 1 ? Math.min(104, Math.abs(slots[1]!.x - slots[0]!.x) - 8) : 104;
    players.forEach((p, i) => {
      const s = slots[i]!;
      const box = new Container();
      box.position.set(s.x, PODIUM_TOP);
      const by = PODIUM_CHAR - 4;
      const plate = new Graphics().roundRect(-w / 2, by + 6, w, 38, 10).fill({ color: 0x000000, alpha: 0.3 });
      plate.roundRect(-w / 2, by, w, 38, 10).fill(lin("#2C3878", "#1A2258"));
      plate.moveTo(-w / 2 + 10, by + 1).lineTo(w / 2 - 10, by + 1).stroke({ width: 2, color: 0xffffff, alpha: 0.12 });
      plate.roundRect(-w / 2 + 1, by + 1, w - 2, 36, 9).stroke({ width: 2, color: 0xffffff, alpha: 0.1 });
      const ring = new Graphics();
      ring.roundRect(-w / 2 - 3, by - 3, w + 6, 44, 13).stroke({ width: 4, color: CREAM, alpha: 0.25 });
      ring.roundRect(-w / 2 - 1, by - 1, w + 2, 40, 11).stroke({ width: 2, color: CREAM, alpha: 0.5 });
      ring.roundRect(-w / 2 + 1.25, by + 1.25, w - 2.5, 35.5, 9).fill({ color: CREAM, alpha: 0.08 }).stroke({ width: 2.5, color: CREAM });
      ring.alpha = 0;
      const name = txt(ellipsizeName(p.name, 10), 16, { weight: "700", maxW: w - 12 });
      name.position.set(0, by + 19);
      box.addChild(plate, ring, name);
      let actor: Actor | null = null;
      if (actors) {
        actor = new Actor(p.color, PODIUM_CHAR, expressionFor(tr, p), { flame: flameLevel(p.row.streak) });
        actor.position.set(0, PODIUM_CHAR);
        box.addChild(actor);
      }
      if (p.isNew) {
        const nt = txt(tk("pad.newRibbon"), 12, { weight: "900", fill: INK });
        const rib = new Container();
        rib.addChild(new Graphics().roundRect(-nt.width / 2 - 8, -8, nt.width + 16, 16, 8).fill(GOLD), nt);
        rib.position.set(isRtl() ? -w / 2 + 4 + nt.width / 2 + 8 : w / 2 - 4 - nt.width / 2 - 8, 2);
        rib.rotation = (6 * Math.PI) / 180;
        box.addChild(rib);
      }
      box.alpha = p.connected ? 1 : 0.6;
      this.root.addChild(box);
      this.seats.push({ p, slot: s, box, ring, actor, lit: 0, litTo: 0 });
    });
  }
  update(tr: Trivia, players: Player[], lit?: (p: Player) => boolean): void {
    const by = new Map(players.map((p) => [p.id, p]));
    for (const s of this.seats) {
      const p = by.get(s.p.id) ?? s.p;
      s.p = p;
      s.litTo = lit?.(p) ? 1 : 0;
      s.box.alpha = p.connected ? 1 : 0.6;
      if (s.actor) { s.actor.set(this.reacts.of(p.id) ?? expressionFor(tr, p)); s.actor.setFlame(flameLevel(p.row.streak)); }
    }
  }
  tick(dt: number, tr: Trivia): void {
    for (const s of this.seats) {
      if (s.lit !== s.litTo) s.lit = reduced() ? s.litTo : s.litTo > s.lit ? Math.min(s.litTo, s.lit + dt / 200) : Math.max(s.litTo, s.lit - dt / 200);
      s.ring.alpha = s.lit;
      if (s.actor) { const r = this.reacts.of(s.p.id); if (r || s.actor.expression !== expressionFor(tr, s.p)) s.actor.set(r ?? expressionFor(tr, s.p)); s.actor.tick(dt); }
    }
  }
}

// ------------------------------------------------------------------------------------------------ question card
type CardMode = "read" | "answer" | "reveal";

/** The question card (cardRect); ANSWER draws the timer as 20 bulbs on its border, READ a thin "get ready" bar. */
class QuestionCard {
  readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly text: Text;
  private readonly bulbs: { core: Graphics; glow: Graphics; pt: Pt }[] = [];
  private readonly badge = new Container();
  private readonly badgeBg = new Graphics();
  private readonly num = txt("", 20, { weight: "900", fill: wcol("glow") });
  private readonly ready = new Graphics();
  private readonly readyFill = new Graphics();
  private readonly clock: Clock;
  private readonly r: Rect;
  private prevMs: number | null = null;
  private prevDeadline: number | null = null;
  private lastKey = "";
  private drawnH = -1;
  constructor(private pub: TriviaPub, private readonly mode: CardMode) {
    const rtl = isRtl();
    this.r = cardRect(rtl, false);
    this.clock = new Clock(mode === "read" ? READ_STEPS : mode === "reveal" ? SQUEEZE_STEPS : []);
    this.root.position.set(this.r.x + this.r.w / 2, this.r.y);
    const s = pub.question?.text ?? "";
    const finalH = mode === "reveal" ? REVEAL_CARD_H : CARD_H;
    const padY = mode === "reveal" ? (s.length > 90 ? 4 : 8) : 14;
    const max = questionFont([...s].length, mode === "reveal");
    this.text = para(s, this.r.w - 124, finalH - 2 * padY, max, mode === "reveal" ? 12 : 16, { weight: "900", fill: CREAM, align: "center" });
    this.text.position.set(0, finalH / 2);
    this.root.addChild(this.bg, this.text);
    if (mode === "answer") {
      const pts = bulbs({ x: -this.r.w / 2, y: 0, w: this.r.w, h: this.r.h });
      for (const pt of pts) {
        const glow = new Graphics().circle(0, 0, 11).fill({ color: 0xffd84d, alpha: 0.32 });
        const core = new Graphics().circle(0, 0, 6).fill(0xffffff).circle(0, 0, 6).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
        glow.position.set(pt.x, pt.y); core.position.set(pt.x, pt.y);
        this.root.addChild(glow, core);
        this.bulbs.push({ core, glow, pt });
      }
      this.badge.addChild(this.badgeBg, this.num);
      this.badge.position.set(rtl ? -this.r.w / 2 + 38 : this.r.w / 2 - 38, 40);
      this.root.addChild(this.badge);
    }
    if (mode === "read") {
      const w = this.r.w - 56, x0 = -this.r.w / 2 + 28, y = CARD_H - 16;
      this.ready.roundRect(x0, y, w, 6, 3).fill({ color: 0xffffff, alpha: 0.12 });
      this.readyFill.roundRect(0, 0, w, 6, 3).fill(linGrad([{ offset: 0, color: wc("accent") }, { offset: 1, color: wc("glow") }], true, rtl));
      this.readyFill.pivot.x = rtl ? w : 0;
      this.readyFill.position.set(rtl ? x0 + w : x0, y);
      this.root.addChild(this.ready, this.readyFill);
    }
    this.draw(mode === "reveal" ? CARD_H : finalH);
    this.tick(0);
  }
  private draw(h: number): void {
    if (Math.abs(h - this.drawnH) < 0.25) return;
    this.drawnH = h;
    const w = this.r.w;
    this.bg.clear();
    this.bg.roundRect(-w / 2 + 4, 12, w - 8, h, 20).fill({ color: 0x000000, alpha: 0.3 });
    this.bg.roundRect(-w / 2, 0, w, h, 20).fill(lin("#232D6E", "#161D4A"));
    this.bg.roundRect(-w / 2 + 1, 1, w - 2, h - 2, 19).stroke({ width: 2, color: 0x8fa8ff, alpha: 0.35 });
    this.text.y = h / 2;
  }
  update(pub: TriviaPub): void { this.pub = pub; }
  tick(dt: number): void {
    this.clock.t += dt;
    const pub = this.pub;
    if (this.mode === "read") {
      const q = this.clock.p("slam");
      this.root.y = this.r.y - 160 * (1 - q);
      this.root.scale.set(1 + 0.06 * (1 - q));
      this.root.alpha = Math.min(1, q / 0.6);
      const ms = leftMs(pub.deadline, Date.now(), clockOffset.value);
      const frac = pub.durationMs ? Math.min(1, ms / pub.durationMs) : 0;
      this.readyFill.scale.x = Math.max(0.001, 1 - frac);
    } else if (this.mode === "reveal") {
      this.draw(CARD_H + (REVEAL_CARD_H - CARD_H) * this.clock.p("squeeze"));
    } else {
      const ms = leftMs(pub.deadline, Date.now(), clockOffset.value);
      if (this.prevDeadline !== pub.deadline) { this.prevDeadline = pub.deadline; this.prevMs = null; }
      const cue = answerTickCue(this.prevMs, ms);
      if (cue) play({ cue });
      this.prevMs = ms;
      const lit = bulbsLit(ms, pub.durationMs ?? 0);
      const low = ms > 0 && ms <= 5000;
      const calm = reduced();
      const pulse = low && !calm ? (1 - Math.cos(((ms % 1000) / 1000) * Math.PI * 2)) / 2 : 0;
      this.bulbs.forEach((b, i) => {
        const on = i < lit;
        b.core.tint = on ? (low ? 0xffc94d : 0xffe9a0) : 0x3a3f66;
        b.glow.visible = on;
        b.glow.scale.set(1 + 0.5 * pulse);
        b.glow.alpha = 1 + 0.6 * pulse;
        b.core.scale.set(on ? 1 + 0.18 * pulse : 1);
      });
      const secs = Math.ceil(ms / 1000);
      const key = `${secs}|${low}`;
      if (key !== this.lastKey) {
        this.lastKey = key;
        this.badgeBg.clear().circle(0, 0, 20).fill(low ? 0xffc94d : 0x0a0f2e).circle(0, 0, 19).stroke({ width: 2, color: wcol("glow") });
        setText(this.num, fmtNum(secs), 34);
        this.num.style.fill = low ? INK : wcol("glow");
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ answer tiles
interface TileView { root: Container; shape: Container; ok: Container | null; dim: Graphics | null; glow: Graphics | null; right: boolean; rect: Rect }
type TileMode = "ghost" | "answer" | "reveal";

/** The answer tiles (§8.2): fixed positions (tileRect), never mirrored; colour + shape + Latin letter; text auto-fits. */
class Tiles {
  readonly root = new Container();
  readonly tiles: TileView[] = [];
  private readonly clock = new Clock(ANSWER_STEPS);
  constructor(pub: TriviaPub, private readonly mode: TileMode) {
    const type = pub.question?.type ?? "mc4";
    const ids = tokensOf(type);
    const correct = pub.reveal?.correct ?? -1;
    ids.forEach((id, i) => {
      const r = tileRect(i, type, isRtl());
      const root = new Container();
      root.position.set(r.x + r.w / 2, r.y + r.h / 2);
      const w = r.w, h = r.h, x0 = -w / 2, y0 = -h / 2;
      const right = mode === "reveal" && i === correct;
      let glow: Graphics | null = null;
      if (right) {
        glow = new Graphics();
        for (let k = 0; k < 5; k++) glow.roundRect(x0 - 4 - k * 5, y0 - 4 - k * 5, w + 8 + k * 10, h + 8 + k * 10, 22 + k * 5).stroke({ width: 6, color: JADE, alpha: 0.22 - k * 0.04 });
        glow.roundRect(x0 - 2, y0 - 2, w + 4, h + 4, 20).stroke({ width: 4, color: JADE });
        glow.alpha = 0;
        root.addChild(glow);
      }
      const shape = new Container();
      if (mode === "ghost") {
        root.addChild(new Graphics().roundRect(x0 + 1, y0 + 1, w - 2, h - 2, 17).stroke({ width: 2, color: 0x8fa8ff, alpha: 0.28 }));
        const s = tokenIcon(id, 36, "#8FA8FF");
        s.alpha = 0.35;
        shape.addChild(s);
        root.addChild(shape);
      } else {
        const col = hex(TOKEN_HEX[id]);
        const g = new Graphics();
        g.roundRect(x0 + 3, y0 + 10, w - 6, h, 18).fill({ color: 0x000000, alpha: 0.28 });
        g.roundRect(x0, y0, w, h, 18).fill(col).roundRect(x0, y0, w, h, 18).fill({ color: 0x000000, alpha: 0.18 });
        g.roundRect(x0, y0, w, h - 6, 18).fill(col);
        g.moveTo(x0 + 16, y0 + 1.5).lineTo(x0 + w - 16, y0 + 1.5).stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
        if (id === "false") g.roundRect(x0 + 1, y0 + 1, w - 2, h - 2, 17).stroke({ width: 2, color: CREAM, alpha: 0.24 });
        root.addChild(g);
        const tf = type === "tf";
        const top = mode === "reveal";
        const letter = letterOf(id);
        if (letter) { const l = txt(letter, 22, { weight: "900", fill: INK, anchorX: 0, anchorY: 0 }); l.alpha = 0.7; l.position.set(x0 + 14, y0 + 8); root.addChild(l); }
        const cr = tf ? 54 : 29;
        shape.addChild(new Graphics().circle(0, 0, cr).fill({ color: 0xffffff, alpha: 0.28 }), tokenIcon(id, tf ? 76 : 46));
        const label = pub.options[i] || (id === "true" ? tk("tf.true") : id === "false" ? tk("tf.false") : "");
        const textRtl = startsRtl(label);
        let text: Text;
        if (tf) {
          text = para(label, w - 36, 60, 34, 16, { weight: "900", fill: INK, align: "center" });
          const total = 2 * cr + 14 + text.height;
          const sy = top ? y0 + 18 : -total / 2;
          shape.position.set(0, sy + cr);
          text.position.set(0, sy + 2 * cr + 14 + text.height / 2);
        } else {
          const tx = x0 + 46 + 58 + 14;
          const tw = w - (46 + 58 + 14) - 18 - (right ? 40 : 0);
          text = para(label, tw, h - 24, 24, 13, { weight: "900", fill: INK, align: textRtl ? "right" : "left", anchorX: textRtl ? 1 : 0 });
          shape.position.set(x0 + 46 + cr, top ? y0 + 12 + cr : 0);
          text.position.set(textRtl ? tx + tw : tx, top ? y0 + 12 + text.height / 2 : 0);
        }
        root.addChild(shape);
        if (id === "false") {
          const pill = new Graphics().roundRect(-text.width / 2 - 14, -text.height / 2 - 2, text.width + 28, text.height + 4, (text.height + 4) / 2).fill(CREAM);
          pill.position.copyFrom(text.position);
          if (text.anchor.x === 0) pill.x += text.width / 2;
          root.addChild(pill);
        }
        root.addChild(text);
      }
      let ok: Container | null = null, dim: Graphics | null = null;
      if (mode === "reveal") {
        if (right) {
          ok = new Container();
          ok.addChild(new Graphics().circle(0, 0, 17).fill(CREAM), checkIcon(26, "#1FA88A"));
          ok.position.set(w / 2 - 10 - 17, y0 + 8 + 17);
          ok.scale.set(0);
          root.addChild(ok);
        } else {
          dim = new Graphics().roundRect(x0, y0, w, h, 18).fill({ color: 0x4a4a62, alpha: 1 });
          dim.alpha = 0;
          root.addChild(dim);
        }
      }
      this.root.addChild(root);
      this.tiles.push({ root, shape, ok, dim, glow, right, rect: r });
    });
    if (mode === "reveal") {
      // The right tile draws above its neighbours (its glow spills over them).
      const rt = this.tiles.find((x) => x.right);
      if (rt) this.root.addChild(rt.root);
    }
    this.tick(0);
  }
  /** REVEAL: wrong tiles dim to 30 % and shrink 4 %, the right one glows, its shape spins once, the ✓ pops. */
  revealAt(pOut: number, pSpin: number): void {
    for (const t of this.tiles) {
      if (t.right) {
        if (t.glow) t.glow.alpha = clamp01(pOut);
        if (t.ok) t.ok.scale.set(Math.max(0, pOut));
        t.shape.rotation = Math.PI * 2 * pSpin;
        t.root.scale.set(1 + 0.03 * Math.sin(Math.PI * clamp01(pOut)));
      } else {
        t.root.alpha = 1 - 0.7 * clamp01(pOut);
        t.root.scale.set(1 - 0.04 * clamp01(pOut));
        if (t.dim) t.dim.alpha = 0.72 * clamp01(pOut);
      }
    }
  }
  tick(dt: number): void {
    if (this.mode !== "answer") return;
    this.clock.t += dt;
    this.tiles.forEach((t, i) => {
      const q = this.clock.p("flip", i);
      t.root.scale.x = Math.max(0.001, q);
      t.root.skew.y = 0.25 * (1 - q);
      t.root.alpha = 0.2 + 0.8 * q;
    });
  }
}

// ------------------------------------------------------------------------------------------------ the side tower
interface TowerRow { p: Player; root: Container; rank: Text; score: Text; scoreBox: Container; top: Graphics; bg: Graphics; base: number }

/** The leaderboard tower beside the board (towerBox; the start side in RTL). Compact rows above 8 players. */
class Tower {
  readonly root = new Container();
  readonly rows: TowerRow[] = [];
  readonly rowStep: number;
  constructor(order: Player[], rankOf: (p: Player) => number | null, scoreOf: (p: Player) => number) {
    const rtl = isRtl();
    const n = order.length;
    const box = towerBox(rtl, n);
    const { h, gap } = towerRowH(n);
    this.rowStep = h + gap;
    const compact = n > 8;
    const g = new Graphics();
    g.roundRect(box.x + 3, box.y + 10, box.w - 6, box.h, 18).fill({ color: 0x000000, alpha: 0.28 });
    g.roundRect(box.x, box.y, box.w, box.h, 18).fill(lin("rgba(34,43,99,0.92)", "rgba(22,29,74,0.92)"));
    g.roundRect(box.x + 0.75, box.y + 0.75, box.w - 1.5, box.h - 1.5, 17).stroke({ width: 1.5, color: 0x8fa8ff, alpha: 0.25 });
    const head = txt(upper(tk("leaderboard.title")), 15, { weight: "900", fill: wcol("glow"), maxW: box.w - 20 });
    if (!rtl && !/[\u0590-\u08ff]/.test(head.text)) head.style.letterSpacing = 1.8;
    head.position.set(box.x + box.w / 2, box.y + 17);
    this.root.addChild(g, head);
    const rw = box.w - 16;
    const X = (x: number): number => (rtl ? rw - x : x);
    order.forEach((p, i) => {
      const root = new Container();
      const base = box.y + 34 + i * (h + gap);
      root.position.set(box.x + 8, base);
      const bg = new Graphics().roundRect(0, 0, rw, h, 10).fill({ color: 0x0a0f2e, alpha: 0.55 });
      const top = new Graphics().roundRect(0, 0, rw, h, 10).fill({ color: 0xffd84d, alpha: 0.14 }).roundRect(0.5, 0.5, rw - 1, h - 1, 9.5).stroke({ width: 1, color: 0xffd84d, alpha: 0.35 });
      const fs = compact ? 13 : 16;
      const rank = txt("", fs, { weight: "900", fill: MUTED, maxW: 18 });
      rank.position.set(X(15), h / 2);
      const cs = compact ? 18 : 26;
      const ch = new Actor(p.color, cs, p.connected ? "idle" : "away");
      ch.position.set(X(24 + 6 + (cs * CHAR_ASPECT) / 2), h / 2 + cs / 2);
      const scoreBox = new Container();
      const score = txt(fmtNum(scoreOf(p)), fs, { weight: "900", anchorX: rtl ? 0 : 1 });
      scoreBox.addChild(score);
      scoreBox.position.set(X(rw - 6), h / 2);
      const nameX = 30 + cs * CHAR_ASPECT + 6;
      let nameEnd = rw - 6 - 52;
      if (p.row.streak >= 3 && !p.row.left) {
        const f = flameIcon(compact ? 10 : 13);
        f.position.set(X(nameEnd - 2), h / 2);
        root.addChild(f);
        nameEnd -= 20;
      }
      const name = txt(ellipsizeName(p.name, compact ? 9 : 10), fs, { weight: "700", anchorX: rtl ? 1 : 0, maxW: nameEnd - nameX });
      name.position.set(X(nameX), h / 2);
      root.addChild(bg, top, rank, ch, name, scoreBox);
      root.alpha = p.row.left ? 0.45 : 1;
      this.root.addChild(root);
      this.rows.push({ p, root, rank, score, scoreBox, top, bg, base });
    });
    this.setRanks(rankOf);
  }
  setRanks(rankOf: (p: Player) => number | null): void {
    for (const r of this.rows) {
      const rk = rankOf(r.p);
      setText(r.rank, r.p.row.left ? "–" : fmtNum(rk ?? 0), 18);
      r.top.visible = !r.p.row.left && r.p.row.score > 0 && rk === 1;
    }
  }
  setScore(r: TowerRow, v: number): void { setText(r.score, fmtNum(v)); }
}

// ------------------------------------------------------------------------------------------------ phases
interface Phase { root: Container; update(tr: Trivia, ps: Player[]): void; tick(dt: number): void; complete?(): void; destroy(): void }

/** Calm motion: a phase crossfades in (tv.css `fade-in` 150–200 ms) instead of travelling. */
function calmFade(root: Container, age: number): void { if (reduced()) root.alpha = Math.min(1, age / 180); }

// ---------- TR-TV-01 Quiz intro
class IntroPhase implements Phase {
  readonly root = new Container();
  private readonly card = new Container();
  private readonly stars: Icon[] = [];
  private readonly chips: Container[] = [];
  private dom: Container | null = null;
  private chipK = 1;
  private readonly count = new Container();
  private readonly clock = new Clock(INTRO_STEPS);
  private readonly pods: PodiumRow;
  private age = 0;
  constructor(private tr: Trivia, ps: Player[], private readonly reacts: Reactions) {
    const q = tr.pub.quiz;
    const rtl = isRtl();
    const cw = 500, chh = 326, x = 230, y = 66;
    // The card hangs from the marquee: it scales about a point 40 dp above its top centre.
    this.card.pivot.set(cw / 2, -40);
    this.card.position.set(x + cw / 2, y - 40);
    const g = new Graphics();
    for (let k = 0; k < 4; k++) g.roundRect(-6 - k * 8, -6 - k * 8, cw + 12 + k * 16, chh + 12 + k * 16, 30 + k * 8).fill({ color: 0xffd84d, alpha: 0.035 });
    g.roundRect(4, 16, cw - 8, chh, 26).fill({ color: 0x000000, alpha: 0.35 });
    g.roundRect(0, 0, cw, chh, 26).fill(lin("#222B63", "#161D4A"));
    this.card.addChild(g);
    // The cover: a sunset band with two mountain ridges (clipped to the card's rounded top).
    const cover = new Graphics();
    cover.roundRect(0, 0, cw, 92 + 26, 26).fill(linGrad([{ offset: 0, color: "#FF9A4D" }, { offset: (0.45 * 92) / 118, color: "#FF5E7A" }, { offset: 92 / 118, color: "#5B3FA8" }, { offset: 1, color: "#5B3FA8" }]));
    cover.rect(0, 92, cw, 26).fill(0x161d4a);
    const ridge = (x0: number, wd: number, hh: number, a: number): void => {
      const top = [[0, 1], [0.18, 0.38], [0.32, 0.64], [0.5, 0.18], [0.66, 0.58], [0.82, 0.3], [1, 0.7]].map(([px, py]) => [x0 + px! * wd, 92 + 2 - hh + py! * hh] as const);
      const yAt = (x: number): number => {
        for (let i = 1; i < top.length; i++) { const [ax, ay] = top[i - 1]!, [bx, by] = top[i]!; if (x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax); }
        return top[top.length - 1]![1];
      };
      const l = Math.max(0, x0), r = Math.min(cw, x0 + wd);
      const pts = [l, 92 + 2, l, yAt(l), ...top.filter(([x]) => x > l && x < r).flat(), r, yAt(r), r, 92 + 2];
      cover.poly(pts).fill({ color: 0x161d4a, alpha: a });
    };
    ridge(-cw * 0.1, cw * 0.7, 54, 0.6);
    ridge(cw * 0.4, cw * 0.7, 44, 0.8);
    cover.rect(0, 92 - 18 + 2, cw, 18).fill(lin("#2A357A", "#161D4A"));
    this.card.addChild(cover);
    const ring = new Graphics().roundRect(1, 1, cw - 2, chh - 2, 25).stroke({ width: 2, color: 0xffd84d, alpha: 0.4 });
    // Chips: the domain (filled), featured topics (outlined), "+N".
    const more = Math.max(0, q.topicCount - q.featuredTopics.length);
    const labels: { s: string; filled: boolean; num?: boolean }[] = [{ s: domainLabel(q.domain), filled: true }, ...q.featuredTopics.map((x) => ({ s: topicLabel(x), filled: false })), ...(more > 0 ? [{ s: `+${fmtNum(more)}`, filled: false, num: true }] : [])];
    const built = labels.map((l) => {
      const tx = (l.num ? kitTxt : txt)(l.s, 18, { weight: "700", fill: l.filled ? wcol("onAccent") : wcol("accentText"), maxW: cw - 56 - 32 });
      const w = tx.width + 32;
      const c = new Container();
      const bg = new Graphics().roundRect(-w / 2, -17, w, 34, 17);
      if (l.filled) bg.fill(wcol("accent")); else bg.roundRect(-w / 2 + 1, -16, w - 2, 32, 16).stroke({ width: 2, color: wcol("accentText") });
      c.addChild(bg, tx);
      return { c, w };
    });
    // Content column (flex column, gap 10, padding 0 28 20).
    const inner = cw - 56;
    // The chips are measured first: the title gets what the column has left (it shrinks before the chips do).
    const chipsH = ((): number => { const pre = wrapCentred(built.map((b) => b.w), inner, 8, rtl); const r = Math.max(1, ...pre.map((x) => x.row + 1)); return r * 34 + (r - 1) * 8; })();
    const titleRoom = Math.max(46, chh - 34 - 21 - 98 - 10 - 34 - 10 - chipsH);
    const title = para(titleIn(q.title), inner, titleRoom, 40, 20, { weight: "900", align: "center" });
    let cy = 92 + 6;
    title.position.set(cw / 2, cy + title.height / 2);
    cy += title.height + 10;
    this.card.addChild(title);
    // Stars then the difficulty word (a flex row: mirrored in RTL).
    const word = txt(tk(`diff.${q.stars}`), 20, { weight: "700", fill: TEXT2 });
    const rowW = 3 * 34 + 2 * 4 + 12 + word.width;
    const sx = cw / 2 - rowW / 2;
    const M = (x: number): number => (rtl ? cw - x : x);
    for (let i = 1; i <= 3; i++) {
      const s = starIcon(34, i <= q.stars);
      s.position.set(M(sx + 17 + (i - 1) * 38), cy + 17);
      this.card.addChild(s);
      if (i <= q.stars) this.stars.push(s);
    }
    word.position.set(M(sx + 3 * 34 + 2 * 4 + 12 + word.width / 2), cy + 17);
    this.card.addChild(word);
    cy += 34 + 10;
    const pos = wrapCentred(built.map((b) => b.w), inner, 8, rtl);
    const rows = Math.max(1, ...pos.map((p) => p.row + 1));
    const countY = chh - 20 - 14;
    const chipRoom = countY - 11 - 10 - cy;
    const chipK = fitScale(rows * 34 + (rows - 1) * 8, chipRoom);
    built.forEach((b, i) => {
      b.c.position.set(28 + (pos[i]!.x + b.w / 2), cy + 2 + 17 + pos[i]!.row * 42);
      this.card.addChild(b.c);
      if (i === 0) this.dom = b.c; else this.chips.push(b.c);
    });
    this.chipK = chipK;
    if (chipK < 1) for (const b of built) { b.c.x = cw / 2 + (b.c.x - cw / 2) * chipK; b.c.y = cy + (b.c.y - cy) * chipK; }
    // "10 questions" (+ "rerun").
    const ct = txt(tk("quiz.questions", { count: tr.pub.total }), 22, { weight: "900", fill: wcol("glow"), maxW: inner });
    this.count.addChild(ct);
    if (tr.pub.rerun) {
      const em = txt(tk("quiz.rerun"), 16, { weight: "900", fill: MUTED });
      const ew = em.width + 20;
      const e = new Container();
      e.addChild(new Graphics().roundRect(-ew / 2, -13, ew, 26, 10).fill(0x3a2266), em);
      const total = ct.width + 10 + ew;
      ct.x = rtl ? total / 2 - ct.width / 2 : -total / 2 + ct.width / 2;
      e.x = rtl ? -total / 2 + ew / 2 : total / 2 - ew / 2;
      this.count.addChild(e);
    }
    this.count.position.set(cw / 2, countY);
    this.card.addChild(this.count, ring);
    this.root.addChild(this.card);
    this.pods = new PodiumRow(tr, activePlayers(ps), reacts);
    this.root.addChild(this.pods.root);
    this.tick(0);
  }
  update(tr: Trivia, ps: Player[]): void { this.tr = tr; this.reacts.update(ps); this.pods.update(tr, activePlayers(ps)); }
  tick(dt: number): void {
    this.age += dt;
    this.clock.t += dt;
    const c = this.clock.p("card");
    this.card.scale.set(0.6 + 0.4 * c);
    this.card.y = 66 - 40 - 60 * (1 - c);
    this.card.alpha = c;
    // tq-star: scale 0.3 -> 1, rotate -40deg -> 0, brightness 0.4 -> 1.
    this.stars.forEach((s, i) => {
      const q = this.clock.p("star", i);
      s.width = s.height = 34 * Math.max(0.05, 0.3 + 0.7 * q);
      s.rotation = (-40 * (1 - q) * Math.PI) / 180;
      const v = Math.round(255 * (0.4 + 0.6 * clamp01(q)));
      s.tint = (v << 16) | (v << 8) | v;
    });
    const pop = (b: Container, q: number): void => { b.alpha = clamp01(q); b.scale.set(this.chipK * (0.6 + 0.4 * q)); };
    if (this.dom) pop(this.dom, this.clock.p("dom"));
    this.chips.forEach((ch, i) => pop(ch, this.clock.p("chip", i)));
    const cq = this.clock.p("count");
    this.count.alpha = cq; this.count.scale.set(0.6 + 0.4 * cq);
    this.pods.tick(dt, this.tr);
    calmFade(this.root, this.age);
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

// ---------- TR-TV-02a / 02 Read and Answer
class QuestionPhase implements Phase {
  readonly root = new Container();
  private readonly card: QuestionCard;
  private readonly tiles: Tiles;
  private readonly tower: Tower;
  private readonly pods: PodiumRow;
  private age = 0;
  constructor(private tr: Trivia, ps: Player[], private readonly answer: boolean, private readonly reacts: Reactions) {
    this.card = new QuestionCard(tr.pub, answer ? "answer" : "read");
    this.tiles = new Tiles(tr.pub, answer ? "answer" : "ghost");
    this.tower = new Tower(standings(ps), (p) => p.row.rank, (p) => p.row.score);
    this.pods = new PodiumRow(tr, activePlayers(ps), reacts);
    this.root.addChild(this.tiles.root, this.card.root, this.tower.root, this.pods.root);
    this.update(tr, ps);
  }
  update(tr: Trivia, ps: Player[]): void {
    this.tr = tr;
    this.reacts.update(ps);
    this.card.update(tr.pub);
    const answered = new Set([...tr.pub.answeredIds, ...tr.doneIds]);
    this.pods.update(tr, activePlayers(ps), this.answer ? (p) => answered.has(p.id) : undefined);
  }
  tick(dt: number): void {
    this.age += dt;
    this.card.tick(dt);
    this.tiles.tick(dt);
    this.pods.tick(dt, this.tr);
    calmFade(this.root, this.age);
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

// ---------- confetti (components/UI Confetti: pieces fall across the screen)
class Confetti {
  readonly root = new Container();
  private readonly bits: { g: Graphics; x: number; d: number; t: number; r: number; dx: number }[] = [];
  private age = 0;
  constructor(colors: number[], count: number) {
    for (let i = 0; i < count; i++) {
      const g = new Graphics().rect(-4, -6, 8, 12).fill(colors[i % colors.length]!);
      g.visible = false;
      this.root.addChild(g);
      this.bits.push({ g, x: ((i * 37) % 100) / 100 * W, d: (i % 9) * 60, t: 1400 + ((i * 53) % 700), r: (((i * 71) % 360) * Math.PI) / 180, dx: ((i * 29) % 60) - 30 });
    }
  }
  tick(dt: number): boolean {
    this.age += dt;
    let alive = false;
    for (const b of this.bits) {
      const q = (this.age - b.d) / b.t;
      b.g.visible = q > 0 && q < 1;
      if (q > 0 && q < 1) {
        alive = true;
        b.g.position.set(b.x + b.dx * q, -20 + (H + 40) * q);
        b.g.rotation = b.r + q * Math.PI * 4;
        b.g.scale.x = Math.cos(q * Math.PI * 6);
        b.g.alpha = q > 0.85 ? (1 - q) / 0.15 : 1;
      } else if (q < 0) alive = true;
    }
    return alive;
  }
}

/** A run of the shared sampler with sound marks; OK completes it (§3.10 E rule 5). Calm: the end state at once. */
function choreo(steps: readonly Step[], marks: readonly TimelineMark[], frame: (p: (id: string, i?: number) => number, t: number) => void, onDone: () => void, count = 1): Run | null {
  if (reduced()) { frame(() => 1, Number.MAX_SAFE_INTEGER); onDone(); return null; }
  let last = -1;
  return run(steps, (p, tm) => {
    frame(p, tm);
    for (const m of timelineCues(marks, last, tm)) play({ cue: m.cue, rate: m.rate });
    last = tm;
  }, onDone, count);
}

// ---------- TR-TV-03 Reveal
class RevealPhase implements Phase {
  readonly root = new Container();
  private readonly plan: ReturnType<typeof revealPlan>;
  private readonly card: QuestionCard;
  private readonly tiles: Tiles;
  private readonly tower: Tower;
  private readonly pods: PodiumRow;
  private readonly stays: { p: Player; a: Actor }[] = [];
  private readonly jumpers: { a: Actor; landed: boolean; flash: Graphics | null }[] = [];
  private readonly bolts: Container[] = [];
  private readonly coins: { c: Container; trail: Graphics[] }[] = [];
  private readonly stamp = new Container();
  private readonly band = new Container();
  private banner: Container | null = null;
  private fast: Container | null = null;
  private explain: Container | null = null;
  private readonly explainClock = new Clock(EXPLAIN_STEPS);
  private confetti: Confetti | null = null;
  private handle: Run | null = null;
  private explainTimer: ReturnType<typeof setTimeout> | null = null;
  private done = false;
  private age = 0;
  constructor(private tr: Trivia, ps: Player[], private readonly onRunning: (r: boolean) => void, private readonly reacts: Reactions) {
    const pub = tr.pub, r = pub.reveal!;
    const rtl = isRtl();
    const plan = revealPlan(tr, ps, rtl);
    this.plan = plan;
    const active = activePlayers(ps);
    const jumping = new Set(plan.jumpers.map((j) => j.p.id));
    const fastest = new Set(r.fastestIds);
    this.card = new QuestionCard(pub, "reveal");
    this.tiles = new Tiles(pub, "reveal");
    this.tower = new Tower(plan.before, (p) => p.row.rankBefore ?? p.row.rank, (p) => p.row.scoreBefore);
    this.pods = new PodiumRow(tr, active, reacts, false);
    this.root.addChild(this.tiles.root, this.card.root, this.tower.root, this.pods.root);
    // Podiums stay; characters that answered leave them for their tile, the rest stay (z, shock) at 85 %.
    const slots = podiumSlots(active.length, rtl);
    active.forEach((p, i) => {
      if (jumping.has(p.id)) return;
      const a = new Actor(p.color, PODIUM_CHAR, expressionFor(tr, p));
      a.position.set(slots[i]!.x, slots[i]!.y + PODIUM_CHAR / 2);
      a.alpha = 0.85;
      this.root.addChild(a);
      this.stays.push({ p, a });
    });
    for (const j of plan.jumpers) {
      const a = new Actor(j.p.color, PODIUM_CHAR, j.p.connected ? "idle" : "away", { outline: true, flame: flameLevel(j.p.row.streak) });
      a.position.set(j.home.x, j.home.y + PODIUM_CHAR / 2);
      let flash: Graphics | null = null;
      if (fastest.has(j.p.id)) {
        flash = new Graphics().circle(0, 0, 40).fill(rad([{ offset: 0, color: "rgba(255,255,255,0.9)" }, { offset: 0.65, color: "rgba(255,255,255,0)" }, { offset: 1, color: "rgba(255,255,255,0)" }]));
        flash.alpha = 0;
        a.addChild(flash);
        flash.y = -PODIUM_CHAR / 2;
      }
      this.root.addChild(a);
      this.jumpers.push({ a, landed: false, flash });
    }
    // Bolts over the fastest finger(s).
    for (const j of plan.jumpers.filter((x) => fastest.has(x.p.id))) {
      const b = new Container();
      const halo = new Graphics().circle(0, 0, 26).fill(rad([{ offset: 0, color: "rgba(255,240,77,0.75)" }, { offset: 1, color: "rgba(255,240,77,0)" }]));
      b.addChild(halo, boltIcon(40));
      b.position.set(j.to.x, j.to.y - CROWD_CHAR);
      b.alpha = 0;
      this.root.addChild(b);
      this.bolts.push(b);
    }
    // Coins: one per correct player, flying to its tower score.
    for (const c of plan.coins) {
      const box = new Container();
      const trail: Graphics[] = [];
      if (c.fire) for (let k = 3; k >= 1; k--) { const tg = new Graphics().circle(0, 0, 9 - k).fill({ color: 0xff7a1f, alpha: 0.5 - k * 0.12 }); trail.push(tg); this.root.addChild(tg); tg.visible = false; }
      const glow = new Graphics().circle(0, 0, c.fire ? 18 : 15).fill({ color: c.fire ? 0xff7a1f : 0xffd84d, alpha: c.fire ? 0.55 : 0.4 });
      const coin = new Graphics().circle(0, 0, 11).fill(CREAM).circle(0, 0, 9).fill(hex(playerHex(c.p.color)));
      // The coin label is `.num` in the DOM (LTR digits in every locale): no RTL wrapping.
      const lt = kitTxt(c.label, 18, { weight: "900", fill: INK });
      const label = new Container();
      const em = c.final ? kitTxt(tk("final.stamp"), 18, { weight: "900", fill: 0x7a2e00 }) : null;
      const inner = lt.width + (em ? 6 + em.width : 0);
      const lw = inner + 20;
      const pillG = new Graphics().roundRect(-lw / 2 + 2, -13 + 4, lw, 26, 12).fill({ color: 0x000000, alpha: 0.3 }).roundRect(-lw / 2, -13, lw, 26, 12).fill(JADE);
      lt.x = -inner / 2 + lt.width / 2;
      label.addChild(pillG, lt);
      if (em) { em.x = inner / 2 - em.width / 2; label.addChild(em); }
      label.position.set(12 + lw / 2, -30 + 13);
      box.addChild(glow, coin, label);
      box.visible = false;
      this.root.addChild(box);
      this.coins.push({ c: box, trail });
    }
    // "Time!" stamp.
    const st = txt(upper(tk("reveal.time")), 64, { weight: "900", fill: CREAM });
    const sw = st.width + 60, sh = st.height + 12;
    this.stamp.addChild(new Graphics().roundRect(-sw / 2 + 4, -sh / 2 + 12, sw, sh, 16).fill({ color: 0x000000, alpha: 0.4 }).roundRect(-sw / 2, -sh / 2, sw, sh, 16).fill({ color: 0xf0183a, alpha: 0.92 }).roundRect(-sw / 2 + 2.5, -sh / 2 + 2.5, sw - 5, sh - 5, 14).stroke({ width: 5, color: CREAM }), st);
    this.stamp.position.set(W / 2, 270);
    this.stamp.rotation = (-6 * Math.PI) / 180;
    this.stamp.alpha = 0;
    // The verdict band (between the squeezed card and the grid): the banner and the fastest pill, side by side.
    const vb = verdictBand(rtl);
    const bannerS = r.voided ? tk("pause.voided") : r.tooSlow ? tk("reveal.tooSlow") : r.stumped ? tk("reveal.stumped") : r.genius ? tk("reveal.genius") : null;
    const pill = (s: string, color: number, ring: number, icon: Icon | null): Container => {
      const c = new Container();
      const tx = txt(s, 20, { weight: "900", fill: color });
      const iw = icon ? 22 + 8 : 0;
      const w = tx.width + 32 + iw;
      c.addChild(new Graphics().roundRect(-w / 2 + 3, -17 + 6, w - 6, 34, 17).fill({ color: 0x000000, alpha: 0.35 }).roundRect(-w / 2, -17, w, 34, 17).fill({ color: 0x0a0f2e, alpha: 0.92 }).roundRect(-w / 2 + 1, -16, w - 2, 32, 16).stroke({ width: 2, color: ring, alpha: 0.65 }));
      if (icon) { icon.position.set(rtl ? w / 2 - 16 - 11 : -w / 2 + 16 + 11, 0); c.addChild(icon); tx.x = rtl ? -iw / 2 : iw / 2; }
      c.addChild(tx);
      (c as Container & { w: number }).w = w;
      return c;
    };
    if (bannerS) { this.banner = pill(bannerS, r.voided ? CREAM : r.genius ? 0xffc94d : 0xff8a80, r.genius ? 0xffc94d : r.voided ? 0x8fa8ff : 0xff6b60, null); this.band.addChild(this.banner); }
    const fastNames = plan.jumpers.filter((j) => fastest.has(j.p.id)).map((j) => j.p.name);
    if (fastNames.length > 0 && !r.voided) { this.fast = pill(tk("reveal.fastest", { name: listOf(fastNames) }), 0xfff04d, 0xfff04d, boltIcon(22)); this.band.addChild(this.fast); }
    const items = [this.banner, this.fast].filter((x): x is Container => !!x);
    const ws = items.map((x) => (x as Container & { w: number }).w);
    const total = ws.reduce((a, b) => a + b, 0) + 12 * Math.max(0, items.length - 1);
    const k = fitScale(total, vb.w - 8);
    let xx = -total / 2;
    const seq = rtl ? [...items].reverse() : items;
    seq.forEach((it) => { const w = (it as Container & { w: number }).w; it.position.set(xx + w / 2, 0); xx += w + 12; it.alpha = 0; });
    this.band.scale.set(k);
    this.band.position.set(vb.x + vb.w / 2, vb.y + vb.h / 2);
    this.root.addChild(this.band, this.stamp);
    if (r.genius) { this.confetti = new Confetti([0xffc94d, 0xffd84d, 0xfff7ec, 0x5b7cff], 42); this.root.addChild(this.confetti.root); this.confetti.root.visible = false; }
    if (r.explain) this.explainTimer = setTimeout(() => this.showExplain(), reduced() ? 0 : EXPLAIN_AT_MS);
    this.start();
  }

  private showExplain(): void {
    const r = this.tr.pub.reveal;
    if (this.explain || !r?.explain) return;
    const rtl = isRtl();
    const cr = cardRect(rtl);
    const h = TILE_Y - CARD_Y - 8;
    const c = new Container();
    c.position.set(cr.x + cr.w / 2, CARD_Y);
    const g = new Graphics().roundRect(-cr.w / 2 + 4, 12, cr.w - 8, h, 20).fill({ color: 0x000000, alpha: 0.4 })
      .roundRect(-cr.w / 2, 0, cr.w, h, 20).fill(lin("#2A357A", "#1A2258")).roundRect(-cr.w / 2 + 1, 1, cr.w - 2, h - 2, 19).stroke({ width: 2, color: 0xffd84d, alpha: 0.5 });
    const head = txt(upper(tk("reveal.didYouKnow")), 14, { weight: "900", fill: wcol("glow"), anchorX: rtl ? 1 : 0, anchorY: 0, maxW: cr.w - 48 });
    if (!rtl && !/[\u0590-\u08ff]/.test(head.text)) head.style.letterSpacing = 1.4;
    head.position.set(rtl ? cr.w / 2 - 24 : -cr.w / 2 + 24, 8);
    const textRtl = startsRtl(r.explain);
    const body = para(r.explain, cr.w - 48, h - 34, 20, 12, { weight: "700", align: textRtl ? "right" : "left", anchorX: textRtl ? 1 : 0, anchorY: 0 });
    body.position.set(textRtl ? cr.w / 2 - 24 : -cr.w / 2 + 24, 28 + Math.max(0, (h - 34 - body.height) / 2));
    c.addChild(g, head, body);
    this.explain = c;
    this.explainClock.t = 0;
    this.root.addChild(c);
  }

  private start(): void {
    const { plan, tr } = this;
    const r = tr.pub.reveal!;
    const leaderChanged = (plan.before[0]?.id ?? null) !== (plan.after[0]?.id ?? null) && (plan.after[0]?.row.score ?? 0) > 0;
    const marks = revealMarks(r, plan.coins.length, leaderChanged);
    const count = Math.max(1, plan.jumpers.length, plan.coins.length);
    const coinTo = new Set(plan.coins.map((c) => c.p.id));
    const step = this.tower.rowStep;
    let counted = false;
    const frame = (p: (id: string, i?: number) => number): void => {
      const pt = p("time"), po = p("out"), sp = p("spin"), pb = p("bolt"), ps2 = p("sort"), pc = p("counter");
      const sl = stampLook(pt, po);
      this.stamp.scale.set(sl.scale);
      this.stamp.alpha = sl.alpha;
      this.stamp.visible = sl.alpha > 0.001;
      this.tiles.revealAt(po, sp);
      plan.jumpers.forEach((j, i) => {
        const v = this.jumpers[i]!;
        const q = p("jump", i);
        const at = hopPoint(j.home, j.to, q);
        const s = 1 + (CROWD_CHAR / PODIUM_CHAR - 1) * clamp01(q);
        v.a.scale.set(s);
        v.a.position.set(at.x, at.y + (PODIUM_CHAR * s) / 2);
        if (q >= 1 && !v.landed) { v.landed = true; v.a.set(this.reacts.of(j.p.id) ?? expressionFor(this.tr, j.p)); }
        if (v.flash) v.flash.alpha = clamp01(pb * (1 - pb) * 4);
      });
      for (const b of this.bolts) { b.alpha = clamp01(pb); b.scale.set(0.4 + 0.6 * pb); b.rotation = ((-30 + 30 * pb) * Math.PI) / 180; }
      plan.coins.forEach((c, i) => {
        const v = this.coins[i]!;
        const q = p("coin", i);
        const at = coinPoint(c.from, c.to, q);
        v.c.position.set(at.x, at.y);
        v.c.visible = q > 0 && q < 1;
        v.trail.forEach((tg, k) => { const tq = q - (k + 1) * 0.06; const tp = coinPoint(c.from, c.to, clamp01(tq)); tg.position.set(tp.x, tp.y); tg.visible = v.c.visible && tq > 0; });
      });
      if (pc > 0 && !counted) counted = true;
      const pop = 1 + 0.15 * Math.sin(Math.PI * Math.min(1, pc * 2.5));
      plan.before.forEach((b, i) => {
        const row = this.tower.rows[i]!;
        const j = plan.after.findIndex((x) => x.id === b.id);
        const hop = j < i ? -8 * Math.sin(Math.PI * clamp01(ps2)) : 0;
        row.root.y = row.base + (j - i) * step * ps2 + hop;
        this.tower.setScore(row, rollValue(b.row.scoreBefore, b.row.score, pc));
        row.scoreBox.scale.set(coinTo.has(b.id) ? pop : 1);
      });
      if (this.banner) { this.banner.alpha = clamp01(po); this.banner.scale.set(0.8 + 0.2 * po); }
      if (this.fast) { this.fast.alpha = clamp01(pb); this.fast.scale.set(0.7 + 0.3 * pb); }
    };
    const finish = (): void => {
      if (this.done) return;
      this.done = true;
      this.tower.setRanks((p) => p.row.rank);
      for (let i = 0; i < this.jumpers.length; i++) { const v = this.jumpers[i]!; if (!v.landed) { v.landed = true; v.a.set(expressionFor(this.tr, plan.jumpers[i]!.p)); } }
      if (this.confetti) this.confetti.root.visible = true;
      this.onRunning(false);
    };
    if (reduced()) {
      frame(() => 1);
      play({ cue: r.stumped || r.tooSlow ? "quiz_wrong" : "quiz_correct" });
      finish();
      return;
    }
    this.onRunning(true);
    this.handle = choreo(REVEAL_STEPS, marks, frame, finish, count);
  }

  update(tr: Trivia, ps: Player[]): void {
    this.tr = tr;
    this.reacts.update(ps);
    for (const s of this.stays) { const p = ps.find((x) => x.id === s.p.id); if (p) s.p = p; }
  }
  tick(dt: number): void {
    this.age += dt;
    this.card.tick(dt);
    for (const s of this.stays) { s.a.set(this.reacts.of(s.p.id) ?? expressionFor(this.tr, s.p)); s.a.tick(dt); }
    for (const j of this.jumpers) j.a.tick(dt);
    if (this.confetti?.root.visible && !this.confetti.tick(dt)) { this.confetti.root.destroy({ children: true }); this.confetti = null; }
    if (this.explain) {
      this.explainClock.t += dt;
      const q = this.explainClock.p("flip");
      this.explain.scale.y = Math.max(0.001, 0.3 + 0.7 * q);
      this.explain.skew.x = 0;
      this.explain.alpha = clamp01(q);
    }
    calmFade(this.root, this.age);
  }
  complete(): void {
    stopAll();
    this.handle?.complete();
    if (this.tr.pub.reveal?.explain) { if (this.explainTimer) clearTimeout(this.explainTimer); this.showExplain(); }
  }
  destroy(): void {
    this.handle?.cancel();
    if (this.explainTimer) clearTimeout(this.explainTimer);
    this.onRunning(false);
    this.root.destroy({ children: true });
  }
}

// ---------- TR-TV-04 Leaderboard race
interface BoardRow { p: Player; root: Container; base: number; bar: Graphics; score: Text; rank: Text; ring: Graphics; actor: Actor; climb: Container | null }

class BoardPhase implements Phase {
  readonly root = new Container();
  private readonly rows: BoardRow[] = [];
  private handle: Run | null = null;
  private done = false;
  private age = 0;
  constructor(ps: Player[], private readonly onRunning: (r: boolean) => void) {
    const rtl = isRtl();
    const before = standings(ps, true), after = standings(ps);
    const n = before.length;
    const geo = boardRows(n);
    const max = Math.max(1, ...ps.map((p) => p.row.score));
    const climb = biggestClimb(ps);
    const leader = after[0];
    const title = txt(tk("leaderboard.title"), 40, { weight: "900", fill: wcol("glow"), maxW: W - 120 });
    title.position.set(W / 2, 82);
    this.root.addChild(glow(W / 2, 84, title.width * 0.75 + 40, 40, "#FFD84D", 0.3), title);
    const rw = W - 2 * BOARD_X;
    const X = (x: number): number => (rtl ? rw - x : x);
    const trackX0 = 10 + 30 + 14 + 210 + 14, trackX1 = rw - 14 - 110 - 14;
    const trackW = trackX1 - trackX0;
    const th = geo.compact ? 12 : 20;
    before.forEach((p, i) => {
      const root = new Container();
      const base = BOARD_Y + i * (geo.h + geo.gap);
      root.position.set(BOARD_X, base);
      const h = geo.h;
      const isLeader = leader?.id === p.id && p.row.score > 0;
      const bg = new Graphics().roundRect(0, 0, rw, h, 14).fill({ color: 0x161d4a, alpha: 0.88 }).roundRect(0.5, 0.5, rw - 1, h - 1, 13.5).stroke({ width: 1, color: 0x8fa8ff, alpha: 0.18 });
      const ring = new Graphics();
      if (isLeader) {
        for (let k = 0; k < 4; k++) ring.roundRect(-2 - k * 4, -2 - k * 4, rw + 4 + k * 8, h + 4 + k * 8, 16 + k * 4).stroke({ width: 4, color: 0xffd84d, alpha: 0.14 - k * 0.03 });
        ring.roundRect(1, 1, rw - 2, h - 2, 13).stroke({ width: 2, color: 0xffd84d });
        ring.alpha = 0.3 / 0.8;
      }
      const rank = txt("", geo.compact ? 18 : 24, { weight: "900", fill: MUTED, maxW: 30 });
      rank.position.set(X(10 + 15), h / 2);
      const actor = new Actor(p.color, geo.char, p.connected ? "idle" : "away");
      const cw = geo.char * CHAR_ASPECT;
      actor.position.set(X(10 + 30 + 14 + cw / 2), h / 2 + geo.char / 2);
      const nameX = 10 + 30 + 14 + cw + 10;
      let nameW = 210 - cw - 10;
      let rib: Container | null = null;
      if (p.isNew) {
        const nt = txt(tk("pad.newRibbon"), 12, { weight: "900", fill: INK });
        rib = new Container();
        rib.addChild(new Graphics().roundRect(-nt.width / 2 - 6, -8, nt.width + 12, 16, 6).fill(GOLD), nt);
        nameW -= nt.width + 12 + 8;
      }
      const name = txt(ellipsizeName(p.name, 14), geo.compact ? 18 : 22, { weight: "700", anchorX: rtl ? 1 : 0, maxW: nameW });
      name.position.set(X(nameX), h / 2);
      if (rib) rib.position.set(X(nameX + name.width + 8 + (rib.width) / 2), h / 2 - 2);
      const track = new Graphics().roundRect(Math.min(X(trackX0), X(trackX1)), (h - th) / 2, trackW, th, th / 2).fill({ color: 0xffffff, alpha: 0.07 });
      const bar = new Graphics();
      const col = playerHex(p.color);
      const barFill = linGrad([{ offset: 0, color: mix(col, "#0A0F2E", 0.7) }, { offset: 1, color: col }], true, rtl);
      bar.roundRect(0, -th / 2, trackW, th, th / 2).fill(barFill);
      bar.position.set(rtl ? X(trackX0) : trackX0, h / 2);
      bar.pivot.x = rtl ? trackW : 0;
      root.addChild(bg, ring, rank, actor, name, track, bar);
      if (rib) root.addChild(rib);
      if (p.row.streak >= 3) {
        const f = new Container();
        const fi = flameIcon(geo.compact ? 12 : 18);
        const ft = txt(fmtNum(p.row.streak), 14, { weight: "900", fill: 0xffb066 });
        fi.x = rtl ? ft.width / 2 + 1 + fi.width / 2 : -ft.width / 2 - 1 - fi.width / 2;
        f.addChild(fi, ft);
        f.position.set(X(trackX1 - 6 - ft.width / 2), h / 2);
        root.addChild(f);
      }
      const score = txt("", geo.compact ? 20 : 28, { weight: "900", anchorX: rtl ? 0 : 1 });
      score.position.set(X(rw - 14), h / 2);
      root.addChild(score);
      let climbC: Container | null = null;
      if (climb?.id === p.id) {
        climbC = new Container();
        const ct = txt(tk("leaderboard.climb", { count: climb.places }), 16, { weight: "900", fill: INK });
        const cwid = ct.width + 20;
        climbC.addChild(new Graphics().roundRect(-cwid / 2, -12, cwid, 24, 12).fill(JADE), ct);
        climbC.position.set(X(rw + 98 - cwid / 2), h / 2);
        climbC.alpha = 0;
        root.addChild(climbC);
      }
      root.alpha = p.row.left ? 0.45 : 1;
      this.root.addChild(root);
      this.rows.push({ p, root, base, bar, score, rank, ring, actor, climb: climbC });
    });
    const setBars = (g: number): void => {
      for (const r of this.rows) {
        const w = (r.p.row.scoreBefore + (r.p.row.score - r.p.row.scoreBefore) * clamp01(g)) / max;
        r.bar.scale.x = Math.max(0.015, w);
        setText(r.score, fmtNum(rollValue(r.p.row.scoreBefore, r.p.row.score, g)));
      }
    };
    const ranks = (fin: boolean): void => { for (const r of this.rows) setText(r.rank, r.p.row.left ? "–" : fmtNum((fin ? r.p.row.rank : r.p.row.rankBefore ?? r.p.row.rank) ?? 0), 30); };
    ranks(false);
    setBars(0);
    const step = geo.h + geo.gap;
    const frame = (p: (id: string, i?: number) => number): void => {
      setBars(p("grow"));
      const s = p("sort"), crown = p("crown"), cl = p("climb");
      this.rows.forEach((r, i) => {
        const j = after.findIndex((x) => x.id === r.p.id);
        r.root.y = r.base + (j - i) * step * s;
        if (leader?.id === r.p.id && r.p.row.score > 0) r.ring.alpha = (0.3 + 0.5 * crown) / 0.8;
        if (r.climb) { r.climb.alpha = clamp01(cl); r.climb.scale.set(0.5 + 0.5 * cl); }
      });
    };
    const finish = (): void => {
      if (this.done) return;
      this.done = true;
      ranks(true);
      for (const r of this.rows) if (leader?.id === r.p.id && r.p.row.score > 0) r.actor.set("cheer", true);
      this.onRunning(false);
    };
    this.onRunning(!reduced());
    this.handle = choreo(BOARD_STEPS, BOARD_MARKS, frame, finish);
  }
  update(): void { /* static: one board per broadcast */ }
  tick(dt: number): void { this.age += dt; for (const r of this.rows) r.actor.tick(dt); calmFade(this.root, this.age); }
  complete(): void { stopAll(); this.handle?.complete(); }
  destroy(): void { this.handle?.cancel(); this.onRunning(false); this.root.destroy({ children: true }); }
}

/** A soft elliptical glow (the DOM's text-shadow / box-shadow halos) centred on x, y. */
function glow(x: number, y: number, rx: number, ry: number, color: string, alpha: number): Graphics {
  const g = new Graphics().ellipse(0, 0, rx, ry).fill(rad([{ offset: 0, color: rgba(color, alpha) }, { offset: 1, color: rgba(color, 0) }]));
  g.position.set(x, y);
  return g;
}

/** color-mix(in srgb, a k, b). */
function mix(a: string, b: string, k: number): string {
  const x = hex(a), y = hex(b);
  const ch = (s: number): number => Math.round(((x >> s) & 255) * k + ((y >> s) & 255) * (1 - k));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

// ---------- TR-TV-05 Final intro
class FinalPhase implements Phase {
  readonly root = new Container();
  private readonly title: Text;
  private readonly stamp: Text;
  private readonly stampGlow: Graphics;
  private readonly clock = new Clock(FINAL_STEPS);
  private readonly pods: PodiumRow;
  private age = 0;
  constructor(private tr: Trivia, ps: Player[], private readonly reacts: Reactions) {
    this.title = para(tk("final.title"), 820, 130, 52, 28, { weight: "900", align: "center" });
    this.title.position.set(W / 2, 96 + this.title.height / 2);
    this.stamp = txt(tk("final.stamp"), 140, { weight: "900", fill: 0xff7a1f, stroke: 0x5a1e00 });
    this.stamp.style.stroke = { color: 0x5a1e00, width: 6, join: "round" };
    this.stamp.position.set(W / 2, 96 + this.title.height + 10 + 70);
    this.stampGlow = glow(0, 0, 200, 120, "#FF7A1F", 0.55);
    this.stampGlow.position.copyFrom(this.stamp.position);
    this.pods = new PodiumRow(tr, activePlayers(ps), reacts);
    this.root.addChild(glow(W / 2, this.title.y + 8, Math.min(460, this.title.width * 0.6 + 40), this.title.height * 0.9, "#FF7A1F", 0.35), this.title, this.stampGlow, this.stamp, this.pods.root);
    this.tick(0);
  }
  update(tr: Trivia, ps: Player[]): void { this.tr = tr; this.reacts.update(ps); this.pods.update(tr, activePlayers(ps)); }
  tick(dt: number): void {
    this.age += dt;
    this.clock.t += dt;
    const q = this.clock.p("title");
    this.title.y = 96 + this.title.height / 2 - 160 * (1 - q);
    this.title.scale.set(1 + 0.06 * (1 - q));
    this.title.alpha = Math.min(1, q / 0.6);
    const s = this.clock.p("stamp");
    this.stamp.alpha = clamp01(s * 1.5);
    this.stamp.scale.set(2 - s);
    this.stamp.rotation = (-8 * Math.PI) / 180;
    this.stampGlow.alpha = this.stamp.alpha;
    this.stampGlow.scale.set(this.stamp.scale.x);
    this.pods.tick(dt, this.tr);
    calmFade(this.root, this.age);
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

// ---------- Hold
class HoldPhase implements Phase {
  readonly root = new Container();
  private readonly pods: PodiumRow;
  private age = 0;
  constructor(private tr: Trivia, ps: Player[], private readonly reacts: Reactions) {
    const title = para(tk("hold.title"), 820, 110, 44, 26, { weight: "700", align: "center" });
    title.position.set(W / 2, 150 + title.height / 2);
    const body = para(tk("hold.body"), 820, 80, 20, 14, { weight: "600", fill: TEXT2, align: "center" });
    body.position.set(W / 2, 150 + title.height + 10 + body.height / 2);
    this.pods = new PodiumRow(tr, activePlayers(ps), reacts);
    this.root.addChild(title, body, this.pods.root);
  }
  update(tr: Trivia, ps: Player[]): void { this.tr = tr; this.reacts.update(ps); this.pods.update(tr, activePlayers(ps)); }
  tick(dt: number): void { this.age += dt; this.pods.tick(dt, this.tr); calmFade(this.root, this.age); }
  destroy(): void { this.root.destroy({ children: true }); }
}

// ---------- TR-TV-06 Results podium
interface Column { step: 1 | 2 | 3; cx: number; body: Graphics; place: Text; names: Container; cast: Container; actors: Actor[]; trophy: Icon | null; namesH: number }

class ResultsPhase implements Phase {
  readonly root = new Container();
  private readonly cols: Column[] = [];
  private readonly stats: Container[] = [];
  private confetti: Confetti | null = null;
  private handle: Run | null = null;
  private age = 0;
  private settled = false;
  constructor(ps: Player[], private readonly onRunning: (r: boolean) => void) {
    const rtl = isRtl();
    const title = txt(tk("results.title"), 36, { weight: "900", fill: wcol("glow"), maxW: W - 120 });
    title.position.set(W / 2, 76);
    this.root.addChild(title);
    // The stat cards ("Fastest finger: Rami ×4"…), centred, 290 dp max each.
    const statList = resultsStats(ps);
    const built = statList.map((s) => {
      const c = new Container();
      const label = s.key === "fastest" ? tk("results.fastestCount", { name: isolate(s.name), count: s.count })
        : s.key === "streak" ? tk("results.longestStreak", { name: isolate(s.name), count: s.count })
          : tk("results.mostCorrect", { name: isolate(s.name), count: s.count });
      let icon: Container;
      if (s.key === "fastest") icon = boltIcon(26);
      else if (s.key === "streak") icon = flameIcon(20);
      else { icon = new Container(); icon.addChild(new Graphics().circle(0, 0, 13).fill(hex(TOKEN_HEX.true)), tokenIcon("true", 18)); }
      const tx = txt(label, 17, { weight: "700", maxW: 290 - 28 - 26 - 8 });
      const w = 14 + 26 + 8 + tx.width + 14;
      c.addChild(new Graphics().roundRect(-w / 2, -19, w, 38, 14).fill({ color: 0x161d4a, alpha: 0.92 }).roundRect(-w / 2 + 0.75, -18.25, w - 1.5, 36.5, 13.25).stroke({ width: 1.5, color: 0x8fa8ff, alpha: 0.3 }));
      icon.position.set(rtl ? w / 2 - 14 - 13 : -w / 2 + 14 + 13, 0);
      tx.position.set(rtl ? -w / 2 + 14 + tx.width / 2 : w / 2 - 14 - tx.width / 2, 0);
      c.addChild(icon, tx);
      return { c, w };
    });
    const total = built.reduce((a, b) => a + b.w, 0) + 12 * Math.max(0, built.length - 1);
    const sk = fitScale(total, W - 80);
    let x = W / 2 - (total * sk) / 2;
    for (const b of rtl ? [...built].reverse() : built) {
      b.c.scale.set(sk);
      b.c.position.set(x + (b.w * sk) / 2, 123);
      x += (b.w + 12) * sk;
      b.c.alpha = 0;
      this.root.addChild(b.c);
    }
    this.stats.push(...built.map((b) => b.c));
    // The podium: steps 2-1-3 (3-1-2 in RTL), characters hop on 3, 2, 1.
    const steps = podiumOf(ps);
    for (const { step, cx } of podiumColumns(rtl)) {
      const list = steps.find((s) => s.step === step)?.players ?? [];
      const body = new Graphics();
      const place = txt(fmtNum(step), 30, { weight: "900", fill: wcol("glow") });
      const names = new Container();
      let ny = 0;
      for (const p of list) {
        const nm = txt(`${isolate(ellipsizeName(p.name, 12))} ${fmtNum(p.row.score)}`, 16, { weight: "700", maxW: PODIUM_COL_W - 16 });
        nm.position.set(0, ny + 10);
        ny += 20;
        names.addChild(nm);
      }
      const room = STEP_H[step] - 6 - 34;
      const nk = fitScale(ny, room);
      names.scale.set(nk);
      const size = podiumCharSize(step, list.length);
      const cast = new Container();
      const actors: Actor[] = [];
      let trophy: Icon | null = null;
      const xs = castXs(0, list.length, size);
      list.forEach((p, i) => {
        const a = new Actor(p.color, size, step === 1 ? "cheer" : "happy");
        if (step === 1) a.set("cheer", true);
        a.position.set(xs[i]!, 0);
        cast.addChild(a);
        actors.push(a);
        if (step === 1 && !trophy) {
          trophy = trophyIcon(40);
          trophy.position.set(xs[i]! + (rtl ? -1 : 1) * (size / 2 + 6), -6 - 20);
          trophy.scale.set(0);
        }
      });
      if (trophy) cast.addChild(trophy);
      this.root.addChild(body, place, names, cast);
      this.cols.push({ step, cx, body, place, names, cast, actors, trophy, namesH: ny * nk });
    }
    this.drawSteps(0);
    const frame = (p: (id: string, i?: number) => number): void => {
      this.drawSteps(p("steps"));
      for (const c of this.cols) {
        const hop = p(`hop${c.step}`);
        c.cast.y += 220 * (1 - hop);
        c.cast.alpha = Math.min(1, Math.max(0, hop * 4));
        if (c.trophy) { const tq = p("trophy"); c.trophy.width = 40 * Math.max(0, tq); c.trophy.height = 40 * Math.max(0, tq); c.trophy.rotation = (-20 * (1 - tq) * Math.PI) / 180; }
      }
      this.stats.forEach((s, i) => { const q = p("stats", i); s.alpha = clamp01(q); s.y = 123 - 24 * (1 - q); });
      if (p("hop1") >= 1 && !this.confetti && !reduced()) {
        this.confetti = new Confetti([0xffc94d, 0xffd84d, 0x478cff, 0x1fa88a, 0xff4f9a, 0xfff7ec], 48);
        this.root.addChild(this.confetti.root);
      }
    };
    const finish = (): void => { if (this.settled) return; this.settled = true; resultsSettled.value = true; this.onRunning(false); };
    this.onRunning(!reduced());
    this.handle = choreo(PODIUM_STEPS, PODIUM_MARKS, frame, finish, 3);
  }
  /** Steps rise (`p` = the "steps" progress): bodies, place numbers, names, and the casts standing on top. */
  private drawSteps(p: number): void {
    for (const c of this.cols) {
      const h = STEP_H[c.step] * clamp01(p);
      const x = c.cx - PODIUM_COL_W / 2, y = PODIUM_BASE_Y - h, w = PODIUM_COL_W;
      const g = c.body.clear();
      if (h > 0.5) {
        const r = Math.min(14, h);
        const top = c.step === 1;
        g.moveTo(x, PODIUM_BASE_Y).lineTo(x, y + r).arcTo(x, y, x + r, y, r).lineTo(x + w - r, y).arcTo(x + w, y, x + w, y + r, r).lineTo(x + w, PODIUM_BASE_Y).closePath()
          .fill(top ? lin("#4A4FA6", "#262F78") : lin("#2C3878", "#1A2258"));
        g.moveTo(x + r * 0.6, y + 1.5).lineTo(x + w - r * 0.6, y + 1.5).stroke({ width: 3, color: 0xffd84d, alpha: top ? 1 : 0.5 });
      }
      c.place.position.set(c.cx, y + 6 + 17);
      c.place.visible = h > 30;
      c.names.position.set(c.cx, y + 6 + 34);
      c.names.visible = h >= STEP_H[c.step] - 0.5 || h > 34 + c.namesH;
      c.cast.position.set(c.cx, y);
    }
  }
  update(): void { /* static */ }
  tick(dt: number): void {
    this.age += dt;
    for (const c of this.cols) for (const a of c.actors) a.tick(dt);
    if (this.confetti && !this.confetti.tick(dt)) { this.confetti.root.destroy({ children: true }); this.confetti = null; }
    calmFade(this.root, this.age);
  }
  complete(): void { stopAll(); this.handle?.complete(); }
  destroy(): void { this.handle?.cancel(); this.onRunning(false); resultsSettled.value = false; this.root.destroy({ children: true }); }
}

class EmptyPhase implements Phase {
  readonly root = new Container();
  update(): void { /* nothing to draw */ }
  tick(): void { /* nothing to draw */ }
  destroy(): void { this.root.destroy({ children: true }); }
}

// ------------------------------------------------------------------------------------------------ the scene
/** One phase per screen key (`n:phase:index`, as the DOM's screenKey). */
export class TriviaScene implements Scene {
  readonly root = new Container();
  private studio: Studio | null = null;
  private coast: boolean | null = null;
  private readonly top = new TopBar();
  private readonly layer = new Container();
  private readonly reacts = new Reactions();
  private phase: Phase | null = null;
  private key = "";
  private last: { pub: TriviaPub; code: string } | null = null;
  constructor(private readonly onRunning: (running: boolean) => void, private readonly onComplete: (f: (() => void) | null) => void) {
    this.root.addChild(this.layer, this.top.root);
  }

  set(view: TvRoomView): void {
    const tr = triviaOfTv(view);
    if (!tr) return;
    const pub = tr.pub;
    const ps = playersOf(view.room, pub);
    const coast = pub.quiz.domain === "lebanon";
    if (coast !== this.coast) {
      this.coast = coast;
      if (this.studio) { this.studio.root.destroy({ children: true }); }
      this.studio = new Studio(coast);
      this.root.addChildAt(this.studio.root, 0);
    }
    this.studio!.set(pub.phase === "FINAL_INTRO", pub.phase === "LEADERBOARD" || pub.phase === "RESULTS");
    const key = `${tr.n}:${pub.phase}:${pub.index}`;
    if (key !== this.key) {
      this.key = key;
      this.phase?.root.parent?.removeChild(this.phase.root);
      this.phase?.destroy();
      this.onRunning(false);
      this.reacts.update(ps);
      this.phase = this.make(tr, ps);
      this.layer.addChild(this.phase.root);
      this.onComplete(this.phase.complete ? () => this.phase?.complete?.() : null);
    } else this.phase?.update(tr, ps);
    this.last = { pub, code: view.room.roomCode };
    this.top.set(pub, view.room.roomCode);
  }

  private make(tr: Trivia, ps: Player[]): Phase {
    switch (tr.pub.phase) {
      case "QUIZ_INTRO": return new IntroPhase(tr, ps, this.reacts);
      case "READ": return new QuestionPhase(tr, ps, false, this.reacts);
      case "ANSWER": return new QuestionPhase(tr, ps, true, this.reacts);
      case "REVEAL": return tr.pub.reveal ? new RevealPhase(tr, ps, this.onRunning, this.reacts) : new EmptyPhase();
      case "LEADERBOARD": return new BoardPhase(ps, this.onRunning);
      case "FINAL_INTRO": return new FinalPhase(tr, ps, this.reacts);
      case "HOLD": return new HoldPhase(tr, ps, this.reacts);
      case "RESULTS": return new ResultsPhase(ps, this.onRunning);
      default: return new EmptyPhase();
    }
  }

  tick(dtMs: number): void {
    this.studio?.tick();
    this.phase?.tick(dtMs);
    // The hint and the connection chip are signals, not part of the view.
    if (this.last) this.top.set(this.last.pub, this.last.code);
  }
  destroy(): void { this.phase?.destroy(); this.phase = null; this.root.destroy({ children: true }); }
}
