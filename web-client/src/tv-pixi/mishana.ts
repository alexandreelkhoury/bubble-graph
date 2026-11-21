// Mish Ana! on the Pixi TV: TV-04 role reveal, TV-05 clues (+ TV-08 tie overlay), TV-06 voting, TV-07 vote reveal +
// TV-09 elimination (with the random-pick wheel), TV-10 the Mole's guess and TV-11 results (stage 1 and 2). It reads
// the same TV view (games/mishana/view.ts), the same helpers (lib.ts, gameText.ts, the DOM screens' exported sizes) and
// the same TV-07/TV-09 timeline and sound marks as the DOM screens in games/mishana/tv, and draws them with Pixi:
// static Graphics, canvas Text, one Char sprite per player, a handful of cached canvas textures (glow, cone, icons,
// emblems, role cards), transforms and alpha only per frame. Design units are the 960 × 540 canvas (the host scales
// them 2×). The TV view carries no secret; this file never asks for more than it has.
import { Fragment, h } from "preact";
import { useCallback, useRef, useState } from "preact/hooks";
import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { Text } from "pixi.js";
import { COLORS } from "@jamaa/shared/constants";
import type { ColorId } from "@jamaa/shared/constants";
import { BODY_PATHS } from "@jamaa/shared/characters";
import type { Expression } from "@jamaa/shared/characters";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { worldColor } from "@jamaa/shared/worlds";
import { fmtNum, isolate, locale, t, titleIn } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { PHASE_KEY, ROLE_KEY, ROLE_WAS_KEY } from "../lib/keys";
import { remainingMs, timerTone } from "../lib/countdown";
import { ms, reduced } from "../lib/motion";
import { ellipsizeName } from "../lib/names";
import { clockOffset } from "../state/store";
import { Icon } from "../components/Icon";
import { avatarState } from "../components/PlayerChip";
import type { AvatarState } from "../components/PlayerChip";
import { mishanaTvView } from "../games/mishana/view";
import type { PublicPlayer, Role, TvView } from "../games/mishana/view";
import {
  afterElimination, byId, competitionRank, culprits, hadUndercover, playersOf, rankPlayers, tiedWithTally, topVoted, winnerMessage,
  TV_VERDICT_MS, TV_VOTE_REVEAL_MS,
} from "../games/mishana/lib";
import { revoteLine, tieLine } from "../games/mishana/gameText";
import { gameIntent } from "../games/mishana/act";
import { MISHANA_ICONS } from "../games/mishana/icons";
import { revealSizes, TIE_OVERLAY_MS } from "../games/mishana/tv/tvGame";
import { cardSize } from "../games/mishana/tv/tvElimination";
import { particleLanes, SB_ROWS, titleSize } from "../games/mishana/tv/tvResults";
import { useInGameOk, backHintOn, VOTE_NAME_MAX } from "../tv-mock/tvParts";
import { resultsSettled } from "../tv-mock/tvPlatform";
import { openDialog } from "../tv-mock/tvDialogs";
import { tvAct, tvConn, tvPaused } from "../tv-mock/tvStore";
import { chipRate, ROLE_STING, STAMP_LAND_MS, timelineCues } from "../tv-mock/sound/cues";
import type { TimelineMark } from "../tv-mock/sound/cues";
import { play, stopAll } from "../tv-mock/sound/player";
import { Char, CREAM, H, INK, SCALE, W, hex, setText, txt } from "./kit";
import type { TxtOpts } from "./kit";
import { PixiHost } from "./stage";
import type { Scene } from "./stage";
import {
  cardLabelSize, dashedRoundRect, elimTimeline, flightCurve, quad, revealRow, sbScroll, stripPlan, voteFlights, voteGrid, wheelIndex,
} from "./mishanaPlan";
import type { Box, ElimTimeline, Flight } from "./mishanaPlan";

// ------------------------------------------------------------------------------------------------ palette & type
const nm = (tok: "deep" | "stageTop" | "surface" | "accent" | "glow"): number => hex(worldColor("night-market", tok, "web") ?? "#1D1036");
const BG = nm("deep"), BG_TOP = nm("stageTop"), SURFACE = nm("surface"), PRIMARY = nm("accent"), ACCENT = nm("glow");
const BG_MID = 0x24124a, OUTLINE = 0x6b54a0, OUTLINE_STRONG = 0x9c88cc, TEXT = CREAM, SECONDARY = 0xe2d6f5, MUTED = 0xb8a8d6;
const SUCCESS = 0x3ddc97, DANGER = 0xff6b60, DEEP = 0x07040d;
const ROLE_HEX: Record<Role, number> = { CIVILIAN: 0x5ab8ff, UNDERCOVER: 0xff8a3d, BLANK: 0xece6f5 };
const css = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
const COLOR = Object.fromEntries(COLORS.map((c) => [c.id, c])) as Record<ColorId, (typeof COLORS)[number]>;

const isRtl = (): boolean => locale.value === "ar";
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const easeOut = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
const decel = (x: number): number => 1 - Math.pow(1 - clamp01(x), 4);
const overshoot = (x: number): number => { const c = 1.9, u = clamp01(x) - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
const smooth = (x: number): number => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const DEG = Math.PI / 180;

type TS = "displayL" | "displayM" | "displayS" | "headline" | "title" | "titleS" | "body" | "label" | "caption" | "timer" | "code";
/** The --tv-* scale (styles/tokens.css), with Arabic's larger display sizes and taller lines. */
function type(ts: TS): { size: number; weight: TxtOpts["weight"]; line: number } {
  const ar = isRtl();
  switch (ts) {
    case "displayL": return { size: ar ? 77.76 : 72, weight: "900", line: ar ? 96 : 80 };
    case "displayM": return { size: ar ? 60.48 : 56, weight: "900", line: ar ? 80 : 64 };
    case "displayS": return { size: 44, weight: "700", line: ar ? 64 : 52 };
    case "headline": return { size: 34, weight: "700", line: ar ? 52 : 42 };
    case "title": return { size: 26, weight: "700", line: ar ? 40 : 32 };
    case "titleS": return { size: 22, weight: "600", line: ar ? 34 : 28 };
    case "body": return { size: 20, weight: "600", line: ar ? 34 : 28 };
    case "label": return { size: 20, weight: "700", line: ar ? 30 : 24 };
    case "caption": return { size: 20, weight: "600", line: ar ? 30 : 26 };
    case "timer": return { size: 40, weight: "900", line: 44 };
    case "code": return { size: 20, weight: "900", line: 20 };
  }
}
/** Canvas text has no page direction: Arabic lines are wrapped in an RTL isolate so mixed runs order like the DOM. */
const bidi = (s: string): string => (isRtl() && s ? `⁧${s}⁩` : s);
const up = (s: string): string => (isRtl() ? s : s.toLocaleUpperCase(locale.value));

interface TO extends Omit<TxtOpts, "weight"> { weight?: TxtOpts["weight"]; ls?: number; upper?: boolean }
function fit(tx: Text, maxW?: number): void {
  if (maxW && tx.width > maxW) tx.scale.set(tx.scale.x * (maxW / tx.width));
}
/** A text in the TV type scale; `ls` is letter-spacing in em (dropped in Arabic, as the DOM does). */
function T(s: string, ts: TS, o: TO = {}): Text {
  const ty = type(ts);
  const { maxW, ls, upper, ...rest } = o;
  const tx = txt(bidi(upper ? up(s) : s), ty.size, { weight: o.weight ?? ty.weight, ...rest });
  if (ls && !isRtl()) tx.style.letterSpacing = ls * ty.size;
  fit(tx, maxW);
  return tx;
}
function setT(tx: Text, s: string, maxW?: number): void { setText(tx, bidi(s), maxW); }
/** One line ended with "…" (graphemes) when wider than `maxW`, like the DOM's text-overflow: ellipsis. */
function nameText(name: string, ts: TS, maxW: number, o: TO = {}): Text {
  const tx = T(name, ts, o);
  if (tx.width <= maxW) return tx;
  const n = [...name].length;
  for (let k = n - 1; k > 0; k--) {
    setT(tx, ellipsizeName(name, k));
    if (tx.width <= maxW) break;
  }
  return tx;
}

// ------------------------------------------------------------------------------------------------ cached textures
const TEX = new Map<string, Texture>();
/** A static drawing rasterised once (2× the design size, `k` extra) and shared by every scene. */
function ctex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, k = 1): Texture {
  const hit = TEX.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.ceil(w * SCALE * k)); cv.height = Math.max(1, Math.ceil(h * SCALE * k));
  const g = cv.getContext("2d")!;
  g.scale(SCALE * k, SCALE * k);
  draw(g);
  const tex = Texture.from(cv);
  TEX.set(key, tex);
  return tex;
}
function spr(tex: Texture, w: number, hh: number, ax = 0.5, ay = 0.5): Sprite {
  const s = new Sprite(tex);
  s.anchor.set(ax, ay);
  s.width = w; s.height = hh;
  return s;
}
/** A soft white disc (tinted for every glow, wash and spotlight). */
const glowTex = (): Texture => ctex("glow", 64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
function glow(color: number, w: number, hh: number, alpha: number): Sprite { const s = spr(glowTex(), w, hh); s.tint = color; s.alpha = alpha; return s; }
const dotTex = (): Texture => ctex("dot", 8, 8, (g) => { g.fillStyle = "#fff"; g.beginPath(); g.arc(4, 4, 4, 0, Math.PI * 2); g.fill(); });

const ICONS: Record<string, string> = {
  check: "M5 12.5l4.5 4.5L19 7.5", x: "M6 6l12 12M18 6L6 18", crown: "M3.5 8.5l4.5 3.8L12 5.5l4 6.8 4.5-3.8L18.8 18H5.2z",
  "chevron-forward": "M9.5 6l6 6-6 6", "chevron-down": "M6 9.5l6 6 6-6", "arrow-forward": "M5 12h14M13 6l6 6-6 6",
  "door-out": "M13 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H13M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5",
  "wifi-off": "M3 3l18 18M8.6 16.2a4.8 4.8 0 0 1 6.8 0M5.2 12.8a9.6 9.6 0 0 1 4.3-2.4M18.8 12.8a9.6 9.6 0 0 0-1.6-1.2M2 9.3a14 14 0 0 1 3.4-2.4M22 9.3A14 14 0 0 0 11.1 5.5M12 19.8h.01",
  trophy: "M8 4h8v5.5a4 4 0 0 1-8 0zM8 6H5.2a3 3 0 0 0 3.1 4.1M16 6h2.8a3 3 0 0 1-3.1 4.1M12 13.5V17M8.5 20h7M10 17h4",
  timer: "M12 5.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 1 0 0-15zM12 9.5V13l2.3 2.3M10 2.5h4M18.4 6.6l1.3-1.3",
  phone: "M8.5 2.5h7A2 2 0 0 1 17.5 4.5v15a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zM11 18.5h2",
  dice: MISHANA_ICONS.dice!,
};
/** components/Icon at `size` dp: 24 grid, 2 px round stroke (3.2 for the dice), mirrored on request (RTL arrows). */
function icon(name: string, size: number, color: number, o: { stroke?: number; mirror?: boolean } = {}): Sprite {
  const sw = o.stroke ?? (name === "dice" ? 3.2 : 2);
  const tex = ctex(`i:${name}:${color}:${sw}`, 24, 24, (g) => {
    g.strokeStyle = css(color); g.lineWidth = sw; g.lineCap = "round"; g.lineJoin = "round";
    g.stroke(new Path2D(ICONS[name] ?? ""));
  }, 3);
  const s = spr(tex, size, size);
  if (o.mirror) s.scale.x *= -1;
  return s;
}
const EMBLEM: Record<Exclude<Role, "BLANK">, string> = {
  CIVILIAN: "M24 6 42 20v22H29V30H19v12H6V20z",
  UNDERCOVER: "M3 19.5C3 14.8 7.5 12 13 12c4.8 0 7.6 2.6 11 2.6S30.2 12 35 12c5.5 0 10 2.8 10 7.5C45 28 39.8 35 33.5 35c-4.6 0-6.2-4.6-9.5-4.6S19.1 35 14.5 35C8.2 35 3 28 3 19.5zM9.5 22.2c1.9-3.6 8-3.9 10.4-.4-2.1 3.6-8.4 3.8-10.4.4zM28.1 21.8c2.4-3.5 8.5-3.2 10.4.4-2 3.4-8.3 3.2-10.4-.4z",
};
/** components/Role RoleEmblem (48 grid, filled; the Blank is a dashed card). */
function emblem(role: Role, size: number, color: number): Sprite {
  const tex = ctex(`e:${role}:${color}`, 48, 48, (g) => {
    g.fillStyle = css(color); g.strokeStyle = css(color);
    if (role === "BLANK") { g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); g.roundRect(9, 5, 30, 38, 5); g.stroke(); }
    else g.fill(new Path2D(EMBLEM[role]), "evenodd");
  }, 2.5);
  return spr(tex, size, size);
}
/** A role-coloured rounded panel with the role's pattern (Undercover stripes, Blank dots), or a player-colour card back. */
function panelTex(kind: Role | ColorId, w: number, hh: number, r: number): Texture {
  return ctex(`p:${kind}:${Math.round(w)}x${Math.round(hh)}:${r}`, w, hh, (g) => {
    const role = kind === "CIVILIAN" || kind === "UNDERCOVER" || kind === "BLANK" ? kind : null;
    g.beginPath(); g.roundRect(0, 0, w, hh, r); g.save(); g.clip();
    g.fillStyle = role ? css(ROLE_HEX[role]) : COLOR[kind as ColorId].hex; g.fillRect(0, 0, w, hh);
    if (role === "UNDERCOVER") {
      g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 6 / Math.SQRT2 * 1.0;
      for (let d = -hh; d < w + hh; d += 12 * Math.SQRT2) { g.beginPath(); g.moveTo(d, hh); g.lineTo(d + hh, 0); g.lineWidth = 6 * Math.SQRT2 / 2; g.stroke(); }
    } else if (role === "BLANK") {
      g.fillStyle = "rgba(18,10,31,0.1)";
      for (let y = 4; y < hh; y += 8) for (let x = 4; x < w; x += 8) { g.beginPath(); g.arc(x, y, 1, 0, Math.PI * 2); g.fill(); }
    } else if (!role) {
      const c = COLOR[kind as ColorId];
      const gs = Math.min(w, hh) * 0.5;
      g.translate(w / 2 - gs / 2, hh / 2 - gs / 2); g.scale(gs / 24, gs / 24);
      g.fillStyle = c.glyph === "ink" ? css(INK) : css(CREAM);
      g.fill(new Path2D(BODY_PATHS[c.shape]));
    }
    g.restore();
  });
}
/** A dashed rounded outline (the DOM's `border: dashed`), drawn once. */
function dashedTex(w: number, hh: number, r: number, color: number, width: number, dash: number, gap: number): Texture {
  return ctex(`d:${w}x${hh}:${r}:${color}:${width}:${dash}:${gap}`, w + width, hh + width, (g) => {
    g.strokeStyle = css(color); g.lineWidth = width; g.lineCap = "butt";
    for (const pts of dashedRoundRect(w, hh, r, dash, gap)) {
      g.beginPath(); g.moveTo(pts[0]! + width / 2, pts[1]! + width / 2);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]! + width / 2, pts[i + 1]! + width / 2);
      g.stroke();
    }
  });
}

// ------------------------------------------------------------------------------------------------ world & chrome
/** The night-market stage (the DOM's --stage-tv: top → mid → base gradient, a gold glow low right, a pink glow left) and
 *  a few slow bokeh lights. */
class World {
  readonly root = new Container();
  private readonly lights: { s: Sprite; x: number; y: number; r: number; p: number }[] = [];
  private age = 0;
  constructor() {
    const grad = ctex("stage-grad", 4, 135, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 135);
      gr.addColorStop(0, css(BG_TOP)); gr.addColorStop(0.55, css(BG_MID)); gr.addColorStop(1, css(BG));
      g.fillStyle = gr; g.fillRect(0, 0, 4, 135);
    });
    this.root.addChild(spr(grad, W, H, 0, 0));
    const a = glow(ACCENT, W * 1.4, H * 0.9, 0.16); a.position.set(W * 1.05, H); this.root.addChild(a);
    const p = glow(PRIMARY, W * 1.2, H, 0.13); p.position.set(-W * 0.1, H * 0.6); this.root.addChild(p);
    const cols = [ACCENT, PRIMARY, 0xffd6e4, ACCENT, PRIMARY, CREAM, ACCENT];
    for (let i = 0; i < cols.length; i++) {
      const r = 60 + ((i * 37) % 70);
      const s = glow(cols[i]!, r, r, 0.05 + (i % 3) * 0.015);
      const L = { s, x: 80 + ((i * 151) % 820), y: 120 + ((i * 97) % 360), r: 10 + (i % 4) * 6, p: i * 1.7 };
      s.position.set(L.x, L.y);
      this.lights.push(L);
      this.root.addChild(s);
    }
  }
  tick(dt: number): void {
    if (reduced()) return;
    this.age += dt / 1000;
    for (const L of this.lights) L.s.position.set(L.x + Math.sin(this.age * 0.13 + L.p) * L.r * 2, L.y + Math.cos(this.age * 0.1 + L.p) * L.r);
  }
}

/** TvTopBar: "ROUND 1 · CLUES" at the start; at the end the room code, "5 alive", the Back hint and the offline chip. */
class TopBar {
  readonly root = new Container();
  private readonly title: Text;
  private readonly end = new Container();
  private sig = "";
  constructor() {
    this.title = T("", "titleS", { weight: "900", fill: SECONDARY, anchorX: 0 });
    this.root.addChild(this.title, this.end);
  }
  set(v: TvView, title: string | null, stillAlive: string | null): void {
    const alive = v.players.filter((p) => (p.alive || p.id === stillAlive) && !p.left).length;
    const label = title ?? (v.phase === "ROLE_REVEAL" ? t("game.mishana.title") : `${t("round.label", { count: v.round })} · ${t(PHASE_KEY[v.phase])}`);
    const hint = backHintOn.value && !tvPaused.value;
    const degraded = tvConn.value !== "open";
    const sig = `${label}|${v.roomCode}|${v.phase === "RESULTS" ? -1 : alive}|${hint}|${degraded}|${locale.value}`;
    if (sig === this.sig) return;
    this.sig = sig;
    const rtl = isRtl();
    {
      setT(this.title, up(label), 520);
      if (!rtl) this.title.style.letterSpacing = 0.06 * 22; else this.title.style.letterSpacing = 0;
      fit(this.title, 520);
      this.title.anchor.x = rtl ? 1 : 0;
      this.title.position.set(rtl ? W - 48 : 48, 51);
    }
    this.end.removeChildren().forEach((c) => c.destroy({ children: true }));
    const items: Container[] = [];
    if (degraded) {
      const c = new Container();
      c.addChild(new Graphics().circle(0, 0, 18).fill(DANGER), icon("wifi-off", 20, INK));
      c.position.x = 18; const box = new Container(); box.addChild(c); (box as Container & { w?: number }).w = 36; items.push(box);
    }
    const code = txt(v.roomCode.split("").join(" "), 20, { weight: "900", fill: ACCENT, anchorX: 0 });
    items.push(code);
    if (v.phase !== "RESULTS") {
      items.push(T("·", "caption", { fill: OUTLINE_STRONG, anchorX: 0 }));
      items.push(T(t("common.aliveCount", { count: alive }), "caption", { fill: SECONDARY, anchorX: 0 }));
    }
    if (hint) {
      const c = new Container();
      const label2 = T(t("hint.backMenu"), "caption", { weight: "600", fill: MUTED, anchorX: 0 });
      label2.style.fontSize = 15; fit(label2, 260);
      const ic = icon("arrow-forward", 18, MUTED, { mirror: !rtl });
      const w = 10 + 18 + 6 + label2.width + 10;
      c.addChild(new Graphics().roundRect(0, -15, w, 30, 15).fill({ color: 0x000000, alpha: 0.25 }));
      if (rtl) { label2.anchor.x = 0; label2.position.set(10, 0); ic.position.set(w - 10 - 9, 0); }
      else { ic.position.set(10 + 9, 0); label2.position.set(10 + 18 + 6, 0); }
      c.addChild(ic, label2);
      (c as Container & { w?: number }).w = w;
      items.push(c);
    }
    const widths = items.map((it) => (it as Container & { w?: number }).w ?? it.width);
    const total = widths.reduce((a, b) => a + b, 0) + 12 * (items.length - 1);
    const order = rtl ? items.map((_, i) => items.length - 1 - i) : items.map((_, i) => i);
    let x = rtl ? 48 : W - 48 - total;
    for (const i of order) {
      const it = items[i]!;
      it.position.set(x, 51);
      if ("anchor" in it) (it as Text).anchor.set(0, 0.5);
      this.end.addChild(it);
      x += widths[i]! + 12;
    }
  }
}

// ------------------------------------------------------------------------------------------------ avatars
/** DESIGN-JAMAA §4.1: the character is the avatar; DESIGN §5.2 badges (host crown, away, left, check, role when out). */
class Avatar extends Container {
  readonly ch: Char;
  private readonly badges = new Container();
  private sig = "";
  constructor(readonly color: ColorId, readonly size: number) {
    super();
    // .avatar--char > .ch: the character is drawn 1.3× its box, scaled about (50 %, 62 %), so its feet sit 0.114 × size
    // below the box bottom (y = 0 here) and the badges stay on the box.
    this.ch = new Char(color, size * 1.3);
    this.ch.position.y = size * 0.114;
    this.addChild(this.ch, this.badges);
  }
  set(state: AvatarState, o: { check?: boolean; host?: boolean; role?: Role | null; expression?: Expression } = {}): void {
    const away = state === "away", out = state === "out" || state === "left";
    const expr: Expression = o.expression ?? (away ? "away" : out ? "sad" : o.check ? "done" : "idle");
    const sig = `${state}|${o.check}|${o.host}|${o.role}|${expr}|${isRtl()}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.ch.expression = expr;
    this.ch.alpha = out ? 0.45 : 1;
    this.ch.tint = out ? 0x9a94a6 : 0xffffff;
    this.badges.removeChildren().forEach((c) => c.destroy({ children: true }));
    const s = this.size, b = Math.max(16, Math.round(s * 0.36)), rtl = isRtl();
    const endX = (s / 2 + s * 0.12 - b / 2) * (rtl ? -1 : 1);
    const badge = (bg: number, x: number, y: number, inner: Sprite | null): void => {
      const c = new Container();
      c.addChild(new Graphics().circle(0, 0, b / 2).fill(bg));
      if (inner) c.addChild(inner);
      c.position.set(x, y);
      this.badges.addChild(c);
    };
    if (o.host) badge(ACCENT, -endX * ((s / 2 + s * 0.04 - b / 2) / (s / 2 + s * 0.12 - b / 2)), -s - s * 0.04 + b / 2, icon("crown", b * 0.64, INK, { stroke: 3 }));
    if (state === "left") badge(MUTED, endX, -s - s * 0.12 + b / 2, icon("door-out", b * 0.64, INK, { stroke: 3, mirror: rtl }));
    else if (away) badge(DANGER, endX, -s - s * 0.12 + b / 2, icon("wifi-off", b * 0.64, INK, { stroke: 3 }));
    else if (o.check && expr !== "done") badge(SUCCESS, endX, -s - s * 0.12 + b / 2, icon("check", b * 0.64, INK, { stroke: 3 }));
    if (out && o.role) badge(ROLE_HEX[o.role], endX, s * 0.12 - b / 2, emblem(o.role, b * 0.7, INK));
  }
}
const tileState = (p: PublicPlayer): { state: AvatarState; host: boolean; role: Role | null } => ({ state: avatarState(p), host: p.isHost, role: p.revealedRole });

/** A one-shot "pop": scale 0.2 → 1 with overshoot (the DOM's `pop` keyframes), driven by `tick`. */
class Pop {
  private age = 1e9;
  constructor(private readonly target: Container, private readonly dur = 240, private readonly from = 0.2) {}
  start(): void { this.age = 0; }
  tick(dt: number): void {
    if (this.age > this.dur) return;
    this.age += dt;
    const q = reduced() ? 1 : clamp01(this.age / this.dur);
    this.target.scale.set(this.from + (1 - this.from) * overshoot(q));
    this.target.alpha = Math.min(1, q * 3);
  }
}

// ------------------------------------------------------------------------------------------------ timers
const CD = { secs: 0, frac: 0 };
/** The live countdown from the server deadline (one shared object: read it right away, never keep it). */
function countdown(v: Pick<TvView, "deadline">): { readonly secs: number; readonly frac: number } | null {
  const dl = v.deadline;
  if (!dl) return null;
  const rem = remainingMs(dl.at, Date.now(), clockOffset.value);
  CD.secs = Math.ceil(rem / 1000);
  CD.frac = dl.durationMs > 0 ? Math.min(1, rem / dl.durationMs) : 0;
  return CD;
}
const NO_DEADLINE: Pick<TvView, "deadline"> = { deadline: null };
const toneColor = (secs: number): number => { const tone = timerTone(secs); return tone === "danger" ? DANGER : tone === "warn" ? ACCENT : TEXT; };

/** TimerRing: depletes clockwise from 12 o'clock; text → accent (≤ 10 s) → danger + pulse (≤ 5 s); the seconds sit on the
 *  ring's top end corner (offset 36, −6). */
class Ring {
  readonly root = new Container();
  private readonly g = new Graphics();
  readonly content = new Container();
  private readonly num: Text;
  private key = -2;
  private age = 0;
  constructor(private readonly size: number, private readonly stroke = 8, private readonly showNumber = true) {
    this.num = T("", "timer");
    this.root.addChild(this.g, this.content, this.num);
  }
  tick(v: Pick<TvView, "deadline">, dt: number): void {
    this.age += dt;
    const c = countdown(v);
    const r = (this.size - this.stroke) / 2;
    if (!c) { if (this.key !== -1) { this.key = -1; this.g.clear(); this.num.visible = false; this.root.scale.set(1); } return; }
    const col = toneColor(c.secs);
    const key = c.secs * 1000 + Math.round(c.frac * 360);
    if (key !== this.key) {
      this.key = key;
      const g = this.g.clear();
      g.circle(0, 0, r).stroke({ width: this.stroke, color: TEXT, alpha: 0.1 });
      const a0 = -Math.PI / 2 + Math.PI * 2 * (1 - c.frac);
      if (c.frac > 0.003) g.moveTo(Math.cos(a0) * r, Math.sin(a0) * r).arc(0, 0, r, a0, Math.PI * 1.5).stroke({ width: this.stroke, color: col, cap: "round" });
      this.num.visible = this.showNumber;
      setT(this.num, fmtNum(c.secs));
      this.num.style.fill = col;
      const rtl = isRtl();
      this.num.anchor.set(rtl ? 0 : 1, 0);
      this.num.position.set((this.size / 2 + 36) * (rtl ? -1 : 1), -this.size / 2 - 6);
    }
    const pulse = timerTone(c.secs) === "danger" && !reduced() ? 1 + 0.03 * Math.sin((this.age / 1000) * Math.PI * 2) ** 2 : 1;
    this.root.scale.set(pulse);
  }
}

/** TvTimerBar: track + fill (scaleX from the inline start) + seconds; `w` is the whole bar. */
class TimerBar {
  readonly root = new Container();
  private readonly track = new Graphics();
  private readonly fill = new Graphics();
  private readonly secs: Text;
  private col = -1;
  private last = -1;
  constructor(private readonly w: number) {
    this.secs = T("", "timer");
    this.secs.style.fontSize = 32;
    this.root.addChild(this.track, this.fill, this.secs);
  }
  private get trackW(): number { return this.w - 14 - 44; }
  tick(v: Pick<TvView, "deadline">): void {
    const c = countdown(v);
    this.root.visible = !!c;
    if (!c) return;
    const rtl = isRtl();
    const tw = this.trackW;
    const col = toneColor(c.secs);
    if (col !== this.col) {
      this.col = col;
      this.track.clear().roundRect(0, -5, tw, 10, 5).fill({ color: TEXT, alpha: 0.1 });
      this.fill.clear().roundRect(0, -5, tw, 10, 5).fill(col);
      this.secs.style.fill = col;
      this.track.position.x = rtl ? 58 : 0;
      this.fill.pivot.x = rtl ? tw : 0;
      this.fill.position.x = rtl ? 58 + tw : 0;
      this.secs.anchor.set(rtl ? 0 : 1, 0.5);
      this.secs.position.x = rtl ? 0 : this.w;
    }
    this.fill.scale.x = Math.max(0.001, c.frac);
    if (c.secs !== this.last) { this.last = c.secs; setT(this.secs, fmtNum(c.secs)); }
  }
}

/** TimerChip: the timer icon and the seconds (32 px, tone colours). */
class TimerChip {
  readonly root = new Container();
  private readonly num: Text;
  private ic: Sprite | null = null;
  private last = -1;
  width = 0;
  constructor() { this.num = T("", "timer", { anchorX: 0 }); this.num.style.fontSize = 32; this.root.addChild(this.num); }
  tick(v: Pick<TvView, "deadline">): void {
    const c = countdown(v);
    this.root.visible = !!c;
    if (!c) return;
    const col = toneColor(c.secs);
    const key = c.secs;
    if (key === this.last) return;
    this.last = key;
    setT(this.num, fmtNum(c.secs));
    this.num.style.fill = col;
    this.ic?.destroy();
    this.ic = icon("timer", 24, col);
    this.root.addChild(this.ic);
    const rtl = isRtl();
    this.width = 24 + 8 + this.num.width;
    // Laid out from the chip's end edge (x = 0) towards the start.
    if (rtl) { this.num.anchor.x = 0; this.num.position.x = 0; this.ic.position.x = this.num.width + 8 + 12; }
    else { this.num.anchor.x = 1; this.num.position.x = 0; this.ic.position.x = -this.num.width - 8 - 12; }
  }
}

/** Stamp: thick border, rotated −8°, lands from 2.2× with an overshoot (400 ms). */
function stamp(text: string, tone: "primary" | "accent" | "muted", ts: TS, border = 6, padX = 22, padY = 6): Container {
  const col = tone === "primary" ? PRIMARY : tone === "accent" ? ACCENT : SECONDARY;
  const c = new Container();
  const tx = T(text, tone === "muted" && ts === "displayM" ? "displayS" : ts, { fill: col, upper: true });
  const w = tx.width + padX * 2 + border * 2, hh = type(ts).line + padY * 2 + border * 2 - (ts === "headline" ? 10 : 8);
  c.addChild(new Graphics().roundRect(-w / 2, -hh / 2, w, hh, 10).fill({ color: BG, alpha: 0.5 }).stroke({ width: border, color: col, alignment: 1 }), tx);
  c.rotation = -8 * DEG;
  return c;
}
function stampAnim(c: Container, q: number): void {
  if (reduced()) { c.scale.set(1); c.alpha = clamp01(q * 2); return; }
  c.scale.set(2.2 + (1 - 2.2) * overshoot(q));
  c.alpha = clamp01(q * 2.5);
}

/** A rounded badge (.tvbadge--accent): ink label on the accent pill, an optional icon. */
function badgePill(label: string, iconName: string | null, maxW = 820, sentence = false): Container {
  const c = new Container();
  const tx = T(label, "label", { weight: "900", fill: INK, upper: !sentence, ls: sentence ? 0 : 0.06, maxW: maxW - 40 });
  const ic = iconName ? icon(iconName, 18, INK) : null;
  const w = tx.width + 32 + (ic ? 24 : 0);
  c.addChild(new Graphics().roundRect(-w / 2, -18, w, 36, 18).fill(ACCENT));
  const rtl = isRtl();
  if (ic) { ic.position.x = (rtl ? 1 : -1) * (w / 2 - 16 - 9); tx.position.x = (rtl ? -1 : 1) * 12; c.addChild(ic); }
  c.addChild(tx);
  return c;
}

// ------------------------------------------------------------------------------------------------ phases
interface Phase {
  root: Container;
  update(v: TvView): void;
  tick(dt: number): void;
  /** OK while a local choreography runs (the DOM's in-game OK rule). */
  complete?(): void;
  /** Top bar override: title, and the player still counted alive (TV-07 suspense). */
  topTitle?: string | null;
  stillAlive?: string | null;
  destroy(): void;
}
type Running = (on: boolean) => void;

/** Rises 24 dp and fades in after `delay` (the DOM's tv-phase-in / hero-in), or just fades under reduced motion. */
function riseIn(c: Container, baseY: number, age: number, delay: number, dur = 400, dist = 24): void {
  const q = clamp01((age - delay) / (reduced() ? 200 : dur));
  c.alpha = q;
  c.position.y = baseY + (reduced() ? 0 : dist * (1 - decel(q)));
}

// ----------------------------------------------------------------------------- TV-04 role reveal
class RevealPhase implements Phase {
  readonly root = new Container();
  private age = 0;
  private phone: Sprite | null = null;
  private readonly blocks: { c: Container; y: number }[] = [];
  private readonly tiles = new Map<string, { box: Container; av: Avatar; y: number; i: number; pop: number; ring: Graphics }>();
  private readonly ready: Text;
  private readonly chip = new TimerChip();
  private readyKey = "";
  private readyPop: Pop;
  private v: TvView;
  constructor(v: TvView) {
    this.v = v;
    const rtl = isRtl();
    const active = v.players.filter((p) => !p.left);
    const blankHint = (v.roleCounts?.blank ?? 0) > 0;
    const size = revealSizes(active.length, blankHint, rtl);
    const GAP = 12, ROW_GAP = 10, nameLine = type("titleS").line;
    const rows = Math.max(1, Math.ceil(active.length / 6));
    const parts: { h: number; make: (y: number) => Container }[] = [];
    if (size.icon > 0) parts.push({ h: size.icon, make: (y) => { const c = new Container(); const ic = icon("phone", size.icon, ACCENT); c.addChild(ic); this.phone = ic; c.position.set(W / 2, y + size.icon / 2); return c; } });
    parts.push({ h: type("displayL").line, make: (y) => {
      const c = new Container();
      const tl = T(t("reveal.checkPhones"), "displayL", { upper: true, ls: -0.01, maxW: 840 });
      c.addChild(glow(PRIMARY, tl.width * 1.1, 150, 0.22), tl);
      c.position.set(W / 2, y + type("displayL").line / 2);
      return c;
    } });
    parts.push({ h: type("body").line, make: (y) => { const c = T(t("reveal.checkBody"), "body", { maxW: 840 }); c.position.set(W / 2, y + type("body").line / 2); return c; } });
    if (size.hint) parts.push({ h: type("body").line, make: (y) => { const c = T(t("reveal.blankHint"), "body", { fill: MUTED, maxW: 840 }); c.position.set(W / 2, y + type("body").line / 2); return c; } });
    const rowsH = rows * (size.avatar + 6 + nameLine) + (rows - 1) * ROW_GAP;
    parts.push({ h: rowsH, make: (y) => {
      const c = new Container();
      const xs = revealRow(active.length, W / 2, rtl);
      active.forEach((p, i) => {
        const box = new Container();
        const av = new Avatar(p.color, size.avatar);
        const st = tileState(p);
        av.set(st.state, { check: p.ready, host: st.host, role: st.role });
        const ring = new Graphics().circle(0, -size.avatar / 2, size.avatar * 0.55).stroke({ width: 3, color: SUCCESS });
        ring.alpha = 0;
        const nmT = nameText(p.name, "titleS", 104);
        nmT.position.set(0, 6 + nameLine / 2);
        box.addChild(ring, av, nmT);
        const rowY = y + xs[i]!.row * (size.avatar + 6 + nameLine + ROW_GAP) + size.avatar;
        box.position.set(xs[i]!.x, rowY);
        c.addChild(box);
        this.tiles.set(p.id, { box, av, y: rowY, i, pop: 1e9, ring });
      });
      return c;
    } });
    const total = parts.reduce((a, p) => a + p.h, 0) + GAP * (parts.length - 1);
    let y = 87 + (360 - total) / 2;
    for (const p of parts) {
      const c = p.make(y);
      const isRows = p === parts[parts.length - 1];
      this.blocks.push({ c, y: isRows ? 0 : c.position.y });
      this.root.addChild(c);
      y += p.h + GAP;
    }
    this.ready = T("", "body");
    this.readyPop = new Pop(this.ready, 240, 0.7);
    this.root.addChild(this.ready, this.chip.root);
    this.update(v);
  }
  update(v: TvView): void {
    this.v = v;
    for (const p of v.players) {
      const tl = this.tiles.get(p.id);
      if (!tl) continue;
      const st = tileState(p);
      const was = tl.av.ch.expression === "done";
      tl.av.set(st.state, { check: p.ready, host: st.host, role: st.role });
      if (p.ready && !was && this.age > 0) tl.pop = 0;
    }
    const active = v.players.filter((p) => !p.left);
    const text = t("reveal.readyCount", { ready: active.filter((p) => p.ready).length, total: active.length });
    if (text !== this.readyKey) { if (this.readyKey) this.readyPop.start(); this.readyKey = text; setT(this.ready, text); }
  }
  tick(dt: number): void {
    this.age += dt;
    const R = reduced();
    this.blocks.forEach((b, i) => { if (i < this.blocks.length - 1) riseIn(b.c, b.y, this.age, i * 70); else b.c.alpha = clamp01((this.age - 200) / 300); });
    if (this.phone && !R) this.phone.rotation = -Math.sin((this.age / 1800) * Math.PI * 2) * 8 * DEG;
    for (const tl of this.tiles.values()) {
      const q = R ? 1 : clamp01((this.age - 260 - tl.i * 60) / 420);
      tl.box.scale.set(0.6 + 0.4 * overshoot(q));
      tl.box.alpha = Math.min(1, q * 2.5);
      tl.box.position.y = tl.y + (R ? 0 : Math.sin(this.age / 700 + tl.i * 1.3) * 1.5);
      if (tl.pop < 600) {
        tl.pop += dt;
        const u = clamp01(tl.pop / 600);
        tl.av.scale.set(R ? 1 : 1 + 0.18 * Math.sin(Math.PI * clamp01(tl.pop / 320)));
        tl.ring.alpha = R ? 0 : (1 - u) * 0.9;
        tl.ring.scale.set(0.8 + 0.6 * decel(u));
      }
    }
    // The ready count is centred in the space left of the timer chip (never under it).
    this.chip.tick(this.v);
    const rtl = isRtl();
    const endEdge = rtl ? 48 : W - 48;
    this.chip.root.position.set(endEdge, 486);
    const chipW = this.chip.root.visible ? this.chip.width + 20 : 0;
    const start = rtl ? W - 48 : 48, end = rtl ? 48 + chipW : W - 48 - chipW;
    this.ready.position.set((start + end) / 2, 486);
    fit(this.ready, Math.abs(end - start));
    this.readyPop.tick(dt);
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

// ----------------------------------------------------------------------------- TV-05 clues + TV-08 tie overlay
class CluesPhase implements Phase {
  readonly root = new Container();
  private age = 0;
  private readonly cone: Sprite;
  private readonly rule = new Container();
  /** Speaker heroes under the strip and the TV-08 overlay (a new speaker mid-overlay must not draw over it). */
  private readonly heroes = new Container();
  private readonly top = new Container();
  private hero: { c: Container; ring: Ring | null; av: Avatar; glow: Sprite; id: string; born: number } | null = null;
  private oldHero: { c: Container; born: number } | null = null;
  private readonly strip = new Container();
  private readonly underline = new Graphics().roundRect(-14, -2, 28, 4, 2).fill(PRIMARY);
  private underX = { from: 0, to: 0, age: 1e9 };
  private stripSig = "";
  private curAv: { av: Avatar; age: number } | null = null;
  private overlay: { c: Container; age: number; dur: number; cards: Container[]; vs: Container[]; tallies: Container[]; st: Container; explain: Container } | null = null;
  private v: TvView;
  constructor(v: TvView, private readonly onRunning: Running) {
    this.v = v;
    const coneTex = ctex("cone", 130, 115, (g) => {
      g.beginPath(); g.moveTo(130 * 0.38, 0); g.lineTo(130 * 0.62, 0); g.lineTo(130, 115); g.lineTo(0, 115); g.closePath(); g.clip();
      const gr = g.createRadialGradient(65, 0, 0, 65, 0, 115);
      gr.addColorStop(0, "rgba(255,79,154,0.16)"); gr.addColorStop(0.8, "rgba(255,79,154,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 130, 115);
    });
    this.cone = spr(coneTex, 520, 460, 0.5, 0);
    this.cone.position.set(W / 2, 0);
    this.root.addChild(this.cone, this.rule, this.heroes, this.strip, this.top);
    this.strip.addChild(this.underline);
    const tie = v.phase === "TIE_BREAK";
    const rtl = isRtl();
    const lines: Text[] = [];
    lines.push(tie ? T(tieLine(v), "caption", { fill: SECONDARY, maxW: 864 }) : T(t("clues.rule"), "caption", { fill: MUTED, maxW: 864 }));
    const idx = v.currentSpeakerId ? v.speakingOrder.indexOf(v.currentSpeakerId) : -1;
    if (v.round === 1 && idx === 0 && !tie) lines.push(T(t("clues.firstHint"), "caption", { fill: SECONDARY, maxW: 864 }));
    const lh = type("caption").line;
    lines.forEach((l, i) => { l.position.set(W / 2, 72 + lh / 2 + i * lh); this.rule.addChild(l); });
    // Strip line (border-top of the 96 dp bar; 102 in Arabic).
    const top = 540 - 27 - (rtl ? 102 : 96);
    this.root.addChildAt(new Graphics().rect(48, top, W - 96, 1).fill({ color: OUTLINE }), 1);
    this.update(v);
    if (tie && v.round === (v.lastVote?.round ?? -1) && v.lastVote?.outcome === "TIE") this.openTie(v);
  }

  private buildHero(v: TvView, sp: PublicPlayer): void {
    const rtl = isRtl();
    const ringS = rtl ? 156 : 172, avS = rtl ? 112 : 124;
    const c = new Container();
    const stageTop = rtl ? 132 : 128;
    const gl = glow(PRIMARY, avS * 1.15, avS * 1.15, sp.connected ? 0.55 : 0);
    gl.position.set(0, ringS / 2 + avS * 0.08);
    c.addChild(gl);
    let ring: Ring | null = null;
    if (v.deadline) { ring = new Ring(ringS); ring.root.position.set(0, ringS / 2); c.addChild(ring.root); }
    const av = new Avatar(sp.color, avS);
    av.set(avatarState(sp));
    av.position.set(0, ringS / 2 + avS / 2);
    c.addChild(av);
    const nameLine = rtl ? 72 : 64;
    const name = T(t("clues.speaking", { name: isolate(sp.name) }), "displayM", { maxW: 820, ls: -0.01 });
    name.position.set(0, ringS + 4 + 2 + nameLine / 2);
    c.addChild(name);
    const idx = v.speakingOrder.indexOf(sp.id);
    const next = byId(v, v.speakingOrder[idx + 1]);
    const sub = T(v.deadline ? t("tv.cluesSub") : t("tv.cluesNoTimer"), "body", { fill: SECONDARY, anchorX: rtl ? 1 : 0 });
    const parts: Text[] = [sub];
    if (next) parts.push(T(` · ${t("clues.upNext", { name: isolate(next.name) })}`, "body", { fill: MUTED, anchorX: rtl ? 1 : 0 }));
    const total = parts.reduce((a, p) => a + p.width, 0);
    const k = total > 860 ? 860 / total : 1;
    let x = rtl ? (total * k) / 2 : -(total * k) / 2;
    const subY = ringS + 4 + 2 + nameLine + 4 + type("body").line / 2;
    for (const p of parts) { p.scale.set(k); p.position.set(x, subY); c.addChild(p); x += (rtl ? -1 : 1) * p.width; }
    c.position.set(W / 2, stageTop);
    this.heroes.addChild(c);
    this.hero = { c, ring, av, glow: gl, id: sp.id, born: this.age };
  }

  private buildStrip(v: TvView): void {
    const rtl = isRtl();
    const order = playersOf(v, v.speakingOrder);
    const cur = Math.max(0, order.findIndex((p) => p.id === v.currentSpeakerId));
    const sig = `${order.map((p) => `${p.id}:${p.spoke ? 1 : 0}:${avatarState(p)}`).join(",")}|${v.currentSpeakerId}|${locale.value}`;
    if (sig === this.stripSig) return;
    this.stripSig = sig;
    for (const ch of this.strip.removeChildren()) if (ch !== this.underline) ch.destroy({ children: true });
    const plan = stripPlan(order.length, cur, W - 96, 48, rtl);
    const nameLine = type("titleS").line;
    const avBottom = 513 - 10 - nameLine - 2;
    const nameY = 513 - 10 - nameLine / 2;
    const chevY = avBottom - 24;
    const more = (n: number, x: number): void => { const m = T(`+${fmtNum(n)}`, "titleS", { fill: MUTED }); m.position.set(x, chevY); this.strip.addChild(m); };
    if (plan.before !== null) more(plan.start, plan.before);
    for (const x of plan.chevrons) { const ch = icon("chevron-forward", 16, OUTLINE_STRONG, { mirror: rtl }); ch.position.set(x, chevY); this.strip.addChild(ch); }
    let curX = this.underX.to;
    order.slice(plan.start, plan.end).forEach((p, i) => {
      const x = plan.items[i]!;
      const isCur = p.id === v.currentSpeakerId;
      const done = p.spoke && !isCur;
      const who = new Container();
      const av = new Avatar(p.color, 48);
      av.set(avatarState(p), { check: done });
      av.position.set(0, avBottom - 513);
      const nmT = nameText(p.name, "titleS", 96, { fill: isCur ? TEXT : SECONDARY, weight: isCur ? "700" : "600" });
      nmT.position.set(0, nameY - 513);
      who.addChild(av, nmT);
      who.alpha = done ? 0.6 : 1;
      who.position.set(x, 513);
      this.strip.addChild(who);
      if (isCur) {
        curX = x;
        if (this.curAv?.av.color !== p.color || !this.curAv) this.curAv = { av, age: 0 };
        else this.curAv = { av, age: 1e9 };
      }
    });
    if (plan.after !== null) more(order.length - plan.end, plan.after);
    this.strip.addChild(this.underline);
    this.underline.position.y = 513 - 2 - 2;
    if (this.underX.age > 1e8 && this.underX.to === 0) this.underX = { from: curX, to: curX, age: 1e9 };
    else if (curX !== this.underX.to) this.underX = { from: this.underline.position.x, to: curX, age: 0 };
  }

  private openTie(v: TvView): void {
    const c = new Container();
    c.addChild(new Graphics().rect(0, 0, W, H).fill({ color: BG, alpha: 0.96 }));
    const rtl = isRtl();
    const tied = tiedWithTally(v);
    const st = stamp(t("tie.title"), "accent", "displayM");
    const cards: Container[] = [], vs: Container[] = [], tallies: Container[] = [];
    // Card widths: max(200, content + 48).
    const built = tied.map(({ player: p, votes }) => {
      const card = new Container();
      const nmT = nameText(p.name, "title", 260);
      const w = Math.max(200, Math.max(96, nmT.width) + 48), hh = 20 + 96 + 12 + type("title").line + 20;
      card.addChild(new Graphics().roundRect(-w / 2, 0, w, hh, 24).fill(SURFACE));
      const av = new Avatar(p.color, 96);
      av.set(avatarState(p));
      av.position.set(0, 20 + 96);
      card.addChild(av);
      const tally = new Container();
      const tv = T(fmtNum(votes), "title", { fill: INK });
      const tw = Math.max(40, tv.width + 16);
      tally.addChild(new Graphics().roundRect(-tw / 2, -20, tw, 40, 20).fill(ACCENT).stroke({ width: 3, color: BG, alignment: 1 }), tv);
      tally.position.set((rtl ? -1 : 1) * (48 + 14 - tw / 2 + 0), 20 - 14 + 20);
      card.addChild(tally);
      nmT.position.set(0, 20 + 96 + 12 + type("title").line / 2);
      card.addChild(nmT);
      return { card, w, hh, tally };
    });
    const vsW = tied.length > 1 ? T(t("tie.vs"), "headline", { fill: MUTED }).width : 0;
    const totalW = built.reduce((a, b) => a + b.w, 0) + Math.max(0, built.length - 1) * (vsW + 64);
    const k = totalW > 880 ? 880 / totalW : 1;
    const explain = T(t("tie.explain"), "body", { fill: SECONDARY, wrap: 560, align: "center", lineHeight: type("body").line });
    const cardH = built[0]?.hh ?? 160;
    const stH = type("displayM").line + 12 + 12;
    const colH = stH + 20 + cardH * k + 20 + explain.height;
    // Centred above the strip line (the DOM pads 120 at the bottom), but never under the top bar.
    let y = Math.max(84, (H - 120) / 2 - colH / 2 + 12);
    st.position.set(W / 2, y + stH / 2); y += stH + 20;
    let x = W / 2 - (totalW * k) / 2;
    const seq = rtl ? [...built].reverse() : built;
    seq.forEach((b, i) => {
      if (i > 0) {
        const vt = T(t("tie.vs"), "headline", { fill: MUTED });
        vt.scale.set(k);
        vt.position.set(x + (32 + vsW / 2) * k, y + (cardH * k) / 2);
        c.addChild(vt); vs.push(vt);
        x += (vsW + 64) * k;
      }
      b.card.scale.set(k);
      b.card.position.set(x + (b.w * k) / 2, y);
      c.addChild(b.card); cards.push(b.card); tallies.push(b.tally);
      x += b.w * k;
    });
    y += cardH * k + 20;
    explain.position.set(W / 2, y + explain.height / 2);
    c.addChild(st, explain);
    this.top.addChild(c);
    const dur = reduced() ? TIE_OVERLAY_MS / 2 : TIE_OVERLAY_MS;
    this.overlay = { c, age: 0, dur, cards, vs, tallies, st, explain };
    this.strip.visible = false;
    this.onRunning(true);
  }

  complete(): void { if (this.overlay) this.overlay.age = Math.max(this.overlay.age, this.overlay.dur - 250); }

  update(v: TvView): void {
    this.v = v;
    const sp = byId(v, v.currentSpeakerId);
    if (sp && this.hero?.id !== sp.id) {
      if (this.hero) { this.oldHero?.c.destroy({ children: true }); this.oldHero = { c: this.hero.c, born: this.age }; }
      this.buildHero(v, sp);
    } else if (sp && this.hero) {
      this.hero.av.set(avatarState(sp));
      this.hero.glow.alpha = sp.connected ? 0.55 : 0;
    } else if (!sp && this.hero) { this.hero.c.destroy({ children: true }); this.hero = null; }
    this.buildStrip(v);
  }

  tick(dt: number): void {
    this.age += dt;
    const R = reduced();
    this.rule.alpha = clamp01(this.age / 300);
    if (this.hero) {
      const hq = clamp01((this.age - this.hero.born) / (R ? 200 : 400));
      this.hero.c.alpha = hq;
      this.hero.c.position.y = (isRtl() ? 132 : 128) + (R ? 0 : 16 * (1 - decel(hq)));
      this.hero.c.scale.set(R ? 1 : 0.96 + 0.04 * decel(hq));
      this.hero.ring?.tick(this.v, dt);
      const br = R ? 1 : 1 + 0.03 * Math.sin((this.age / 1600) * Math.PI * 2) ** 2;
      this.hero.av.scale.set(br);
      this.hero.glow.scale.set(this.hero.glow.scale.x, this.hero.glow.scale.y);
    }
    if (this.oldHero) {
      const q = clamp01((this.age - this.oldHero.born) / 220);
      this.oldHero.c.alpha = 1 - q;
      this.oldHero.c.position.y = (isRtl() ? 132 : 128) - (R ? 0 : 12 * q);
      if (q >= 1) { this.oldHero.c.destroy({ children: true }); this.oldHero = null; }
    }
    // Underline glides to the new speaker; the current avatar grows to 1.12 from its feet.
    const u = this.underX;
    if (u.age < 1e8) { u.age += dt; this.underline.position.x = u.from + (u.to - u.from) * easeOut(R ? 1 : u.age / 300); }
    else this.underline.position.x = u.to;
    if (this.curAv) { this.curAv.age += dt; this.curAv.av.scale.set(1 + 0.12 * easeOut(R ? 1 : this.curAv.age / 240)); }
    this.strip.alpha = clamp01(this.age / 300);
    const o = this.overlay;
    if (o) {
      o.age += dt;
      const fadeIn = clamp01(o.age / 200), fadeOut = clamp01((o.dur - o.age) / 400);
      o.c.alpha = Math.min(fadeIn, fadeOut);
      stampAnim(o.st, clamp01(o.age / 400));
      const rtl = isRtl();
      o.cards.forEach((cd, i) => {
        const q = R ? 1 : clamp01((o.age - 150 - i * 90) / 450);
        const side = (i === 0 ? -1 : 1) * (rtl ? -1 : 1) * (o.cards.length > 1 ? 1 : 0);
        cd.alpha = q;
        cd.pivot.x = R ? 0 : -side * 60 * (1 - decel(q));
      });
      o.vs.forEach((vv) => { const q = R ? 1 : clamp01((o.age - 350) / 300); vv.alpha = q; });
      o.tallies.forEach((tl) => { const q = clamp01((o.age - 450) / 240); tl.scale.set(R ? 1 : 0.6 + 0.4 * overshoot(q)); tl.alpha = q; });
      o.explain.alpha = clamp01((o.age - 500) / 300);
      if (o.age >= o.dur) {
        o.c.destroy({ children: true });
        this.overlay = null;
        this.strip.visible = true;
        this.onRunning(false);
      }
    }
  }
  destroy(): void { if (this.overlay) this.onRunning(false); this.root.destroy({ children: true }); }
}

// ----------------------------------------------------------------------------- vote tiles (TV-06 / TV-07)
/** A .tile--vote: surface card, the character and its name cut to 12 graphemes. */
function voteTile(p: PublicPlayer, b: Box, big: boolean): { box: Container; av: Avatar; bg: Graphics } {
  const box = new Container();
  const bg = new Graphics().roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 24).fill(SURFACE);
  bg.rect(-b.w / 2 + 18, -b.h / 2, b.w - 36, 1).fill({ color: TEXT, alpha: 0.06 });
  const av = new Avatar(p.color, big ? 48 : 64);
  const line = isRtl() ? 34 : 28, gap = big ? 4 : 6, size = big ? 48 : 64;
  const top = -(size + gap + line) / 2;
  av.position.set(0, top + size);
  const nmT = nameText(ellipsizeName(p.name, VOTE_NAME_MAX), "title", big ? 108 : 120, { weight: "700" });
  nmT.style.fontSize = 20; fit(nmT, big ? 108 : 120);
  nmT.position.set(0, top + size + gap + line / 2);
  box.addChild(bg, av, nmT);
  box.position.set(b.x + b.w / 2, b.y + b.h / 2);
  return { box, av, bg };
}

// ----------------------------------------------------------------------------- TV-06 voting
class VotingPhase implements Phase {
  readonly root = new Container();
  private age = 0;
  private readonly head = new Container();
  private headY = 0;
  private readonly tiles = new Map<string, { box: Container; av: Avatar; i: number; hop: number; voted: boolean; spark: Graphics }>();
  private readonly bar = new TimerBar(520);
  private readonly progress: Text;
  private readonly pop: Pop;
  private progKey = -1e9;
  private v: TvView;
  constructor(v: TvView) {
    this.v = v;
    const rtl = isRtl();
    const cands = v.players.filter((p) => p.alive && !p.left && (!v.revote || v.tieCandidates.includes(p.id)));
    const big = cands.length > 8;
    const per = big ? 6 : 4, th = big ? 96 : 112;
    const rows = Math.max(1, Math.ceil(cands.length / per));
    const gridH = rows * th + (rows - 1) * 16;
    const titleLine = type("displayS").line;
    const badgeH = v.revote ? 36 : 0;
    const total = titleLine + (v.revote ? 20 + badgeH : 0) + 20 + gridH;
    let y = 87 + (360 - total) / 2;
    // Title + sub on one line (sub in headline, secondary, 12 dp after the title).
    const title = T(t("vote.title"), "displayS", { upper: true, anchorX: rtl ? 1 : 0 });
    const sub = T(t("vote.sub"), "headline", { fill: SECONDARY, anchorX: rtl ? 1 : 0 });
    const tw = title.width + 12 + sub.width;
    const k = tw > 844 ? 844 / tw : 1;
    title.scale.set(k); sub.scale.set(k);
    const x0 = W / 2 + (rtl ? 1 : -1) * (tw * k) / 2;
    title.position.set(x0, 0);
    sub.position.set(x0 + (rtl ? -1 : 1) * (title.width + 12 * k), 2);
    this.head.addChild(title, sub);
    this.headY = y + titleLine / 2;
    this.head.position.set(0, this.headY);
    this.root.addChild(this.head);
    y += titleLine + 20;
    if (v.revote) {
      const b = badgePill(revoteLine(v), null, 844, true);
      b.position.set(W / 2, y + 18);
      this.root.addChild(b);
      y += 36 + 20;
    }
    const grid = voteGrid(cands.length, W / 2, y + gridH / 2, rtl);
    cands.forEach((p, i) => {
      const { box, av } = voteTile(p, grid.tiles[i]!, grid.big);
      const st = tileState(p);
      av.set(st.state, { check: p.hasVoted, host: st.host, role: st.role });
      const spark = new Graphics().roundRect(-grid.tiles[i]!.w / 2, -grid.tiles[i]!.h / 2, grid.tiles[i]!.w, grid.tiles[i]!.h, 24).stroke({ width: 3, color: SUCCESS });
      spark.alpha = 0;
      box.addChild(spark);
      this.root.addChild(box);
      this.tiles.set(p.id, { box, av, i, hop: 1e9, voted: p.hasVoted, spark });
    });
    this.bar.root.position.set(rtl ? W - 48 - 520 : 48, 486);
    this.progress = T("", "title", { fill: ACCENT, anchorX: rtl ? 0 : 1 });
    this.progress.position.set(rtl ? 48 : W - 48, 486);
    this.pop = new Pop(this.progress, 240, 0.2);
    this.root.addChild(this.bar.root, this.progress);
    this.update(v);
  }
  update(v: TvView): void {
    this.v = v;
    for (const p of v.players) {
      const tl = this.tiles.get(p.id);
      if (!tl) continue;
      const st = tileState(p);
      tl.av.set(st.state, { check: p.hasVoted, host: st.host, role: st.role });
      if (p.hasVoted && !tl.voted) tl.hop = 0;
      tl.voted = p.hasVoted;
    }
  }
  tick(dt: number): void {
    this.age += dt;
    const R = reduced();
    riseIn(this.head, this.headY, this.age, 0, 400, -18);
    for (const tl of this.tiles.values()) {
      const q = R ? 1 : clamp01((this.age - 120 - tl.i * 45) / 420);
      let s = 0.7 + 0.3 * overshoot(q);
      tl.box.alpha = Math.min(1, q * 2.5);
      if (tl.hop < 700) {
        tl.hop += dt;
        const hq = clamp01(tl.hop / 420);
        s *= R ? 1 : 1 + 0.08 * Math.sin(Math.PI * hq);
        tl.spark.alpha = R ? 0 : 0.9 * (1 - clamp01(tl.hop / 700));
      }
      tl.box.scale.set(s);
    }
    this.bar.tick(this.v);
    const c = countdown(this.v);
    const v = this.v;
    const lastTen = !!c && c.secs <= 10 && c.secs > 0;
    const key = lastTen ? -1 - v.votesCast : v.votesCast * 100 + v.votesExpected;
    if (key !== this.progKey) {
      this.progKey = key;
      // With every phone asleep the server expects 0 votes: "0/0 voted" looks broken, so count the alive voters.
      const expected = v.votesExpected > 0 ? v.votesExpected : v.players.filter((p) => p.alive && !p.left).length;
      const text = lastTen ? t("vote.tenLeft") : t("vote.progress", { cast: v.votesCast, expected });
      setT(this.progress, text, 300);
      this.progress.style.fill = lastTen ? DANGER : ACCENT;
      this.pop.start();
    }
    this.pop.tick(dt);
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

// ----------------------------------------------------------------------------- TV-07 vote reveal + TV-09 elimination
const REACTION: Record<Role, MessageKey> = { CIVILIAN: "elim.reactionCivilian", UNDERCOVER: "elim.reactionUndercover", BLANK: "elim.reactionBlank" };
const TRAIL = 40;

class EliminationPhase implements Phase {
  readonly root = new Container();
  private el = 0;
  private prevEl = -1;
  private readonly T: ElimTimeline;
  private readonly total: number;
  private v: TvView;
  private readonly marks: TimelineMark[] = [];
  private readonly chipMarks: TimelineMark[] = [];
  private readonly random: boolean;
  private readonly outId: string | null;
  private readonly role: Role | null;
  // votes stage
  private readonly board = new Container();
  private readonly tiles = new Map<string, { box: Container; base: Box; isTop: boolean; tally: Container; tallyText: Text; n: number; popAge: number; ring: Container }>();
  private readonly counts = new Map<string, number>();
  private readonly flights: (Flight & { chip: Avatar; dots: Sprite[]; curve: ReturnType<typeof flightCurve> | null })[] = [];
  private bin: { c: Container; num: Text; n: number } | null = null;
  private outStamp: Container | null = null;
  private centerStamp: Container | null = null;
  private readonly skipHint: Text;
  // wheel stage
  private readonly wheel = new Container();
  private readonly seats: { c: Container; ring: Graphics; glow: Sprite }[] = [];
  private wheelTarget = 0;
  // card stage
  private readonly cardStage = new Container();
  private readonly card = new Container();
  private back: Sprite | null = null;
  private readonly face = new Container();
  private shadow: Sprite | null = null;
  private readonly nameRow = new Container();
  private reaction: Text | null = null;
  private wash: Sprite | null = null;
  private noneStamp: Container | null = null;
  private cardY: number = 0;
  private reactionY: number = 0;
  private readonly next: Text;
  private readonly next2: Text;
  private nextKey = -3;
  constructor(v: TvView, private readonly onRunning: Running) {
    this.v = v;
    const rtl = isRtl();
    const lv = v.lastVote;
    const out = byId(v, v.eliminated?.playerId);
    this.outId = out?.id ?? null;
    this.role = v.eliminated?.role ?? null;
    this.random = lv?.outcome === "RANDOM";
    this.T = elimTimeline(this.random, ms, TV_VOTE_REVEAL_MS, TV_VERDICT_MS);
    this.total = this.T.total;
    const TL = this.T;
    // Late mount (reconnect mid-phase) → the end state, silently.
    const dl = v.deadline;
    const late = dl ? Math.max(0, dl.durationMs - (dl.at - Date.now())) > 1500 : true;
    if (late) { this.el = TL.total; this.prevEl = TL.total; }
    if (lv) this.marks.push({ at: 0, cue: "sfx.drumroll" }, { at: TL.verdict + ms(STAMP_LAND_MS), cue: "sfx.stamp" });
    if (lv && this.random) this.marks.push({ at: TL.votesEnd, cue: "sfx.wheel" });
    if (v.eliminated) this.marks.push({ at: TL.holdAt, cue: "sfx.heartbeat" }, { at: TL.flipAt, cue: "sfx.flip" }, { at: TL.flipEnd, cue: ROLE_STING[v.eliminated.role] });

    // ---- TV-07 board
    if (lv) {
      const ids = new Set<string>([...lv.abstainIds, ...lv.tally.flatMap((x) => [x.targetId, ...x.voterIds])]);
      const shown = v.players.filter((p) => ids.has(p.id));
      const grid = voteGrid(shown.length, W / 2, 267, rtl);
      const top = lv.eliminatedId ?? null;
      const maxN = Math.max(0, ...lv.tally.map((x) => x.voterIds.length));
      const topIds = new Set(lv.outcome === "ELIMINATED" || lv.outcome === "RANDOM" ? lv.tally.filter((x) => x.voterIds.length === maxN).map((x) => x.targetId) : []);
      const boxes = new Map<string, Box>();
      shown.forEach((p, i) => {
        const b = grid.tiles[i]!;
        boxes.set(p.id, b);
        const { box, av } = voteTile(p, b, grid.big);
        av.set(p.id === top ? "normal" : avatarState(p));
        const isTop = lv.outcome === "RANDOM" ? topIds.has(p.id) : p.id === top;
        const ring = new Container();
        ring.addChild(glow(PRIMARY, b.w * 1.5, b.h * 1.5, 0.35), new Graphics().roundRect(-b.w / 2 - 2, -b.h / 2 - 2, b.w + 4, b.h + 4, 26).stroke({ width: 4, color: PRIMARY }));
        ring.alpha = 0;
        box.addChildAt(ring, 0);
        const tally = new Container();
        const tallyText = T("", "title", { fill: INK });
        tally.addChild(new Graphics(), tallyText);
        tally.position.set((rtl ? -1 : 1) * (b.w / 2 + 14 - 20), -b.h / 2 - 14 + 20);
        tally.visible = false;
        box.addChild(tally);
        this.board.addChild(box);
        this.tiles.set(p.id, { box, base: b, isTop, tally, tallyText, n: 0, popAge: 1e9, ring });
        if (isTop && lv.outcome === "ELIMINATED") {
          const s = stamp(t("stamp.out"), "primary", "headline", 4, 12, 2);
          s.position.set(0, 0); s.visible = false;
          box.addChild(s);
          this.outStamp = s;
        }
      });
      if (lv.abstainIds.length > 0) {
        const c = new Container();
        const bw = 104, bh = 6 + type("caption").line + 2 + 32 + 6;
        c.addChild(spr(dashedTex(bw, bh, 16, OUTLINE, 2, 6, 5), bw + 2, bh + 2, 0, 0));
        const cap = T(t("vote.noVote"), "caption", { fill: TEXT, maxW: bw - 12 });
        cap.position.set(bw / 2, 6 + type("caption").line / 2);
        const num = T(fmtNum(0), "title", { fill: MUTED });
        num.position.set(bw / 2, 6 + type("caption").line + 2 + 16);
        c.addChild(cap, num);
        c.position.set(rtl ? 58 : W - 58 - bw, 447 - bh);
        this.board.addChild(c);
        this.bin = { c, num, n: 0 };
        boxes.set("__bin", { x: c.position.x, y: c.position.y, w: bw, h: bh });
      }
      // Flights (board coordinates are the stage's: x − 58, y − 87, as the DOM measures them).
      const rel = (b: Box): Box => ({ x: b.x - 58, y: b.y - 87, w: b.w, h: b.h });
      const fl = voteFlights(v.players.map((p) => p.id), lv, TL, ms(420));
      const trail = new Container();
      const chips = new Container();
      for (const f of fl) {
        const voter = byId(v, f.voterId)!;
        const a = boxes.get(f.voterId), b = boxes.get(f.to);
        const curve = a && b ? flightCurve(rel(a), rel(b), f.k) : null;
        const chip = new Avatar(voter.color, 32);
        chip.set("normal");
        chip.visible = false;
        const dots: Sprite[] = [];
        if (curve && !reduced()) {
          for (let j = 0; j < TRAIL; j++) {
            const e = j / (TRAIL - 1);
            const d = spr(dotTex(), 5, 5);
            d.tint = hex(COLOR[voter.color].hex);
            d.position.set(58 + quad(curve.x0, curve.cx, curve.x1, e), 87 + quad(curve.y0, curve.cy, curve.y1, e));
            d.visible = false;
            trail.addChild(d);
            dots.push(d);
          }
        }
        chips.addChild(chip);
        this.flights.push({ ...f, chip, dots, curve });
      }
      trail.zIndex = 5; chips.zIndex = 6;
      this.board.addChild(trail, chips);
      if (lv.outcome === "NO_ELIMINATION" || lv.outcome === "RANDOM") {
        const s = lv.outcome === "RANDOM" ? stamp(t("stamp.tie"), "accent", "displayM") : stamp(t(lv.tally.length === 0 ? "vote.nobodyVoted" : "elim.noElimination"), "muted", "displayS");
        s.position.set(W / 2, 267); s.visible = false; s.zIndex = 8;
        this.board.addChild(s);
        this.centerStamp = s;
      }
      this.chipMarks = this.flights.map((f) => ({ at: f.delay + (reduced() ? 0 : f.dur), cue: "sfx.chipLand" as const, rate: chipRate(f.k + 1) }));
      if (reduced()) this.chipMarks = this.chipMarks.slice(0, 1);
    }
    this.board.sortableChildren = true;
    this.root.addChild(this.board);
    this.skipHint = T(t("tv.skipHintWeb"), "caption", { fill: MUTED, maxW: 860 });
    this.skipHint.position.set(W / 2, 486);
    this.root.addChild(this.skipHint);

    // ---- TV-09 wheel (random pick)
    if (this.random) {
      const tied = topVoted(v);
      this.wheelTarget = Math.max(0, tied.findIndex((p) => p.id === v.eliminated?.playerId));
      // The DOM ring (r 150, 96 dp seats) lets the top seat run into the headline; here r 110 keeps it clear.
      const headH = type("headline").line, R = 110;
      const y0 = 87 + 4;
      const head = new Container();
      const ht = T(t("elim.randomPick"), "headline", { fill: ACCENT });
      const ic = icon("dice", 28, ACCENT);
      const hw = 28 + 10 + ht.width;
      ic.position.set((rtl ? 1 : -1) * (hw / 2 - 14), 0);
      ht.position.set((rtl ? -1 : 1) * (14 + 5), 0);
      head.addChild(ic, ht);
      head.position.set(W / 2, y0 + headH / 2);
      this.wheel.addChild(head);
      const cx = W / 2, cy = y0 + headH + 14 + R + 56;
      const n = Math.max(1, tied.length);
      tied.forEach((p, i) => {
        const a = (i / n) * 2 * Math.PI - Math.PI / 2;
        const c = new Container();
        const gl = glow(ACCENT, 170, 170, 0.45);
        gl.position.set(0, 0);
        const ring = new Graphics().roundRect(-48 - 4, -48 - 4, 104, 104, 30).stroke({ width: 4, color: ACCENT });
        const av = new Avatar(p.color, 96);
        av.set("normal");
        av.position.set(0, 48);
        c.addChild(gl, ring, av);
        c.position.set(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        this.wheel.addChild(c);
        this.seats.push({ c, ring, glow: gl });
      });
      this.root.addChild(this.wheel);
    }

    // ---- TV-09 card
    const none = !v.eliminated;
    if (none) {
      const s = stamp(t(lv && lv.tally.length === 0 ? "vote.nobodyVoted" : "elim.noElimination"), "muted", "displayS");
      s.position.set(W / 2, 267);
      this.cardStage.addChild(s);
      this.noneStamp = s;
    } else if (out && this.role) {
      const role = this.role;
      const size = cardSize(rtl);
      const wash = glow(ROLE_HEX[role], 1100, 1000, 0.34);
      wash.position.set(W / 2, H * 0.55);
      wash.alpha = 0;
      this.cardStage.addChild(wash);
      this.wash = wash;
      const nameLine = type("displayS").line;
      const line = t(role === "BLANK" && !v.settings.blankGuess ? "elim.reactionBlankNoGuess" : REACTION[role]);
      const rts: TS = line.length > 30 ? "title" : "headline";
      const total = size.h + 4 + 4 + nameLine + 4 + type(rts).line;
      const y0 = 87 + (360 - total) / 2;
      this.cardY = y0 + size.h / 2;
      const shadow = glow(0x000000, size.w * 1.3, size.h * 0.9, 0.7);
      shadow.position.set(0, 30);
      this.shadow = shadow;
      const back = spr(panelTex(out.color, size.w, size.h, 32), size.w, size.h);
      this.back = back;
      const faceBg = spr(panelTex(role, size.w, size.h, 32), size.w, size.h);
      const emb = emblem(role, Math.round(size.h * 0.38), INK);
      const label = t(ROLE_KEY[role]);
      const lab = T(label, "displayM", { fill: INK, upper: true, ls: 0.02, maxW: size.w - 16 });
      lab.style.fontSize = cardLabelSize(size.w, label); lab.scale.set(1); fit(lab, size.w - 16);
      const gap = 14, stackH = emb.height + gap + lab.height;
      emb.position.set(0, -stackH / 2 + emb.height / 2);
      lab.position.set(0, stackH / 2 - lab.height / 2);
      this.face.addChild(faceBg, emb, lab);
      this.face.visible = false;
      this.card.addChild(shadow, back, this.face);
      this.card.position.set(W / 2, this.cardY);
      this.cardStage.addChild(this.card);
      if (this.random) {
        const b = badgePill(t("elim.randomPick"), "dice");
        b.position.set(0, -size.h / 2 + 3.6);
        this.card.addChild(b);
      }
      // "Omar is out!" with the character before the name.
      const av = new Avatar(out.color, 48);
      av.set("normal");
      const nt = T(t("elim.eliminated", { name: isolate(out.name) }), "displayS", { anchorX: rtl ? 1 : 0, maxW: 820 - 62 });
      const rowW = 48 * (30 / 32) + 14 + nt.width;
      const sx = W / 2 + (rtl ? 1 : -1) * rowW / 2;
      av.position.set(sx + (rtl ? -1 : 1) * 24 * (30 / 32), nameLine / 2 + 24);
      nt.position.set(sx + (rtl ? -1 : 1) * (48 * (30 / 32) + 14), nameLine / 2);
      this.nameRow.addChild(av, nt);
      this.nameRow.position.set(0, y0 + size.h + 4 + 4);
      this.cardStage.addChild(this.nameRow);
      const rx = T(line, rts, { maxW: 820 });
      this.reactionY = y0 + size.h + 8 + nameLine + 4 + type(rts).line / 2;
      rx.position.set(W / 2, this.reactionY);
      rx.alpha = 0;
      this.cardStage.addChild(rx);
      this.reaction = rx;
    }
    this.root.addChild(this.cardStage);
    this.next = T("", "body", { fill: SECONDARY });
    this.next2 = T("", "body", { fill: SECONDARY });
    this.root.addChild(this.next, this.next2);
    if (this.el < this.total) this.onRunning(true);
    this.apply(0);
  }

  /** Until the card flips the bar keeps "Votes are in" and still counts the voted-out player as alive. */
  topTitle: string | null = null;
  stillAlive: string | null = null;
  private flipped: boolean | null = null;
  private syncTop(): void {
    const f = this.el >= this.T.flipAt;
    if (f === this.flipped) return;
    this.flipped = f;
    this.topTitle = f ? null : `${t("round.label", { count: this.v.round })} · ${t("vote.votesIn")}`;
    this.stillAlive = f ? null : this.outId;
  }
  complete(): void { if (this.el < this.total) { this.el = this.total; } }
  update(v: TvView): void { this.v = v; }

  tick(dt: number): void {
    if (this.el < this.total) {
      this.el = Math.min(this.total, this.el + dt);
      if (this.el >= this.total) this.onRunning(false);
    }
    this.apply(dt);
  }

  private sounds(): void {
    const from = this.prevEl, el = this.el;
    if (el <= from) return;
    this.prevEl = el;
    for (const m of timelineCues(this.marks, from, el)) play({ cue: m.cue, rate: m.rate });
    if (from < this.T.votesEnd) for (const m of timelineCues(this.chipMarks, from, Math.min(el, this.T.votesEnd))) play({ cue: m.cue, rate: m.rate });
    if ((el >= this.total || el >= this.T.votesEnd && from < this.T.votesEnd) && el - from > 250) stopAll();
  }

  private apply(dt: number): void {
    this.sounds();
    this.syncTop();
    const TL = this.T, el = this.el, R = reduced();
    const lv = this.v.lastVote;
    const stage = el < TL.votesEnd ? "votes" : el < TL.cardStart ? "wheel" : "card";
    this.board.visible = stage === "votes" && !!lv;
    this.wheel.visible = stage === "wheel";
    this.cardStage.visible = stage === "card";
    this.skipHint.visible = stage === "votes" && el < this.total;
    if (stage === "votes" && lv) {
      const counts = this.counts;
      counts.clear();
      for (const f of this.flights) {
        if (el >= f.delay + (R ? 0 : f.dur)) counts.set(f.to, (counts.get(f.to) ?? 0) + 1);
        const c = f.curve;
        if (!c || el < f.delay) { f.chip.visible = false; for (const d of f.dots) d.visible = false; continue; }
        const p = clamp01((el - f.delay) / f.dur);
        const e = R ? 1 : 1 - Math.pow(1 - p, 2.2);
        f.chip.visible = true;
        f.chip.alpha = R ? clamp01((el - f.delay) / 200) : 1;
        f.chip.position.set(58 + quad(c.x0, c.cx, c.x1, e), 87 + quad(c.y0, c.cy, c.y1, e) + 16);
        const fade = R ? 0 : Math.max(0, 1 - (el - f.delay - f.dur) / ms(600));
        const shown = Math.floor(e * (TRAIL - 1));
        for (let j = 0; j < f.dots.length; j++) { const d = f.dots[j]!; d.visible = fade > 0 && j <= shown; d.alpha = 0.85 * Math.min(1, fade); }
      }
      const suspense = clamp01((el - TL.suspense) / 600);
      const verdict = el >= TL.verdict ? clamp01((el - TL.verdict) / 400) : -1;
      for (const [id, tl] of this.tiles) {
        const n = counts.get(id) ?? 0;
        if (n !== tl.n) {
          tl.n = n;
          tl.tally.visible = n > 0;
          if (n > 0) {
            setT(tl.tallyText, fmtNum(n));
            const w = Math.max(40, tl.tallyText.width + 16);
            (tl.tally.children[0] as Graphics).clear().roundRect(-w / 2, -20, w, 40, 20).fill(ACCENT).stroke({ width: 3, color: BG, alignment: 1 });
            tl.popAge = 0;
          }
        }
        if (tl.popAge < 240) {
          tl.popAge += dt;
          const q = R ? 1 : clamp01(tl.popAge / 200);
          tl.tally.scale.set(0.6 + 0.4 * overshoot(q));
          tl.tally.pivot.y = -8 * (1 - q);
          tl.tally.alpha = q;
        }
        tl.box.alpha = tl.isTop ? 1 : 1 - 0.65 * (el >= TL.suspense ? suspense : 0);
        const vq = tl.isTop && verdict >= 0 ? verdict : 0;
        tl.box.scale.set(1 + 0.15 * (R ? (vq > 0 ? 1 : 0) : overshoot(vq)));
        tl.ring.alpha = vq;
        tl.box.zIndex = tl.isTop ? 2 : 1;
      }
      if (this.outStamp) { this.outStamp.visible = verdict >= 0; if (verdict >= 0) stampAnim(this.outStamp, verdict); }
      if (this.centerStamp) { this.centerStamp.visible = verdict >= 0; if (verdict >= 0) stampAnim(this.centerStamp, verdict); }
      if (this.bin) {
        const n = counts.get("__bin") ?? 0;
        if (n !== this.bin.n) { this.bin.n = n; setT(this.bin.num, fmtNum(n)); }
      }
    }
    if (stage === "wheel") {
      const idx = wheelIndex(el - TL.votesEnd, TL.wheel, this.seats.length, this.wheelTarget);
      this.seats.forEach((s, i) => {
        const lit = i === idx;
        s.c.alpha = lit ? 1 : 0.5;
        s.c.scale.set(lit ? 1.15 : 1);
        s.ring.visible = lit; s.glow.visible = lit;
      });
      this.wheel.alpha = clamp01((el - TL.votesEnd) / 200);
    }
    if (stage === "card") {
      const k = el - TL.cardStart;
      if (this.noneStamp) stampAnim(this.noneStamp, clamp01(k / 400));
      if (this.back && this.shadow) {
        const g = R ? 1 : decel(k / Math.max(1, TL.grow));
        this.card.scale.set(0.4 + 0.6 * g);
        this.card.alpha = clamp01(k / Math.max(1, TL.grow) * 1.5);
        // The flip: the card turns on its vertical axis (scale.x = |cos θ|) and lifts a little at the edge.
        const fq = el < TL.flipAt ? 0 : R ? 1 : clamp01((el - TL.flipAt) / Math.max(1, TL.flipDur));
        const th = Math.PI * easeOut(fq);
        const sx = Math.abs(Math.cos(th));
        const faceUp = th > Math.PI / 2;
        this.back.visible = !faceUp;
        this.face.visible = faceUp;
        this.back.scale.x = Math.abs(this.back.scale.x) * 1;
        const base = this.card.scale.y;
        this.card.scale.x = base * Math.max(0.02, sx);
        this.card.position.y = this.cardY - Math.sin(th) * 14;
        this.shadow.alpha = 0.7 * (0.6 + 0.4 * sx);
        this.nameRow.alpha = clamp01(k / 400);
        if (this.reaction) {
          const rq = clamp01((el - TL.reaction) / 400);
          this.reaction.alpha = rq;
          this.reaction.position.y = this.reactionY + (R ? 0 : 8 * (1 - decel(rq)));
        }
        if (this.wash) {
          const wq = clamp01((k - 1800) / 1400);
          const a = clamp01(wq / 0.45);
          this.wash.alpha = 0.34 * a * (el >= this.total || k > 1800 ? 1 : 0);
          this.wash.scale.set(((0.4 + 1.0 * decel(a)) * 1100) / 64, ((0.4 + 1.0 * decel(a)) * 1000) / 64);
          if (el >= this.total && k < 1800) { this.wash.alpha = 0.34; this.wash.scale.set((1.4 * 1100) / 64, (1.4 * 1000) / 64); }
        }
      }
    }
    // Bottom bar: what comes next (only once the card is up).
    const c = stage === "card" ? countdown(this.v) : null;
    const key = stage === "card" ? (c ? c.secs : -1) : -2;
    if (key !== this.nextKey) {
      this.nextKey = key;
      const rtl = isRtl();
      let s1 = "", s2 = "", center = false;
      if (stage === "card") {
        const nx = afterElimination(this.v);
        if (nx === "NEXT_ROUND") { if (c) { s1 = t("elim.nextRound", { count: c.secs }); center = !this.v.eliminated; } }
        else {
          if (nx === "LAST_CHANCE") s1 = t("elim.lastChance");
          if (c) s2 = t("elim.nextIn", { count: c.secs });
        }
      }
      setT(this.next, s1, 520); setT(this.next2, s2, 300);
      this.next.style.fill = s1 === t("elim.lastChance") ? ROLE_HEX.BLANK : SECONDARY;
      if (center) { this.next.anchor.x = 0.5; this.next.position.set(W / 2, 486); }
      else { this.next.anchor.x = rtl ? 1 : 0; this.next.position.set(rtl ? W - 48 : 48, 486); }
      this.next2.anchor.x = rtl ? 0 : 1; this.next2.position.set(rtl ? 48 : W - 48, 486);
    }
  }
  destroy(): void { if (this.el < this.total) this.onRunning(false); this.root.destroy({ children: true }); }
}

// ----------------------------------------------------------------------------- TV-10 the Mole's guess
class GuessPhase implements Phase {
  readonly root = new Container();
  private age = 0;
  private readonly dark = new Graphics().rect(0, 0, W, H).fill(DEEP);
  private readonly spot: Sprite;
  private readonly hero = new Container();
  private readonly ring: Ring;
  private av: Avatar | null = null;
  private readonly texts = new Container();
  private readonly bar = new TimerBar(360);
  private readonly flash = new Graphics().rect(0, 0, W, H).fill(0xffffff);
  private readonly confetti: { g: Graphics; x: number; vx: number; vy: number; r: number; d: number }[] = [];
  private readonly confLayer = new Container();
  private status = "";
  private since = 0;
  private darkA = 0;
  private v: TvView;
  constructor(v: TvView) {
    this.v = v;
    this.dark.alpha = 0;
    this.spot = glow(ROLE_HEX.BLANK, 340, 340, 0);
    this.spot.position.set(W / 2, 60 + 170);
    this.ring = new Ring(220);
    this.flash.alpha = 0;
    this.root.addChild(this.dark, this.spot, this.hero, this.texts, this.bar.root, this.confLayer, this.flash);
    this.hero.addChild(this.ring.root);
    const p = byId(v, v.guess?.playerId);
    if (p) {
      this.ring.content.addChild(spr(dashedTex(152, 152, 46, ROLE_HEX.BLANK, 3, 7, 5), 155, 155));
      const av = new Avatar(p.color, 140);
      av.position.set(0, 70);
      this.ring.content.addChild(av);
      this.av = av;
    }
    const rtl = isRtl();
    this.bar.root.position.set(rtl ? W - 48 - 360 : 48, 486);
    this.update(v);
  }
  update(v: TvView): void {
    this.v = v;
    const g = v.guess, p = byId(v, g?.playerId);
    if (!g || !p) return;
    const sig = `${g.status}|${g.overridden}`;
    if (sig === this.status) return;
    const first = this.status === "";
    this.status = sig;
    this.since = 0;
    const pending = g.status === "PENDING";
    this.av?.set(avatarState({ ...p, alive: true }), { expression: pending ? "think" : g.status === "CORRECT" ? "cheer" : "sad" });
    this.texts.removeChildren().forEach((c) => c.destroy({ children: true }));
    const name = isolate(p.name);
    const items: { c: Container; h: number }[] = [];
    if (pending) {
      items.push({ c: T(t("guess.title"), "displayS", { maxW: 840 }), h: type("displayS").line });
      items.push({ c: T(t("guess.guessing", { name }), "body", { fill: SECONDARY, maxW: 840 }), h: type("body").line });
      items.push({ c: T(t("guess.sayAloud", { name }), "caption", { fill: ACCENT, maxW: 840 }), h: type("caption").line });
    } else {
      const col = g.status === "CORRECT" ? SUCCESS : g.status === "WRONG" ? DANGER : TEXT;
      items.push({ c: T(t(g.status === "CORRECT" ? "guess.correct" : g.status === "WRONG" ? "guess.wrong" : "guess.timeout"), "displayM", { fill: col, maxW: 840, ls: -0.01 }), h: type("displayM").line + 8 });
      if (g.overridden) items.push({ c: badgePill(t("guess.overridden"), null), h: 36 });
    }
    const total = 220 + items.reduce((a, b) => a + b.h + 8, 0);
    let y = 87 + (360 - total) / 2;
    this.hero.position.set(W / 2, y + 110);
    y += 220 + 8;
    for (const it of items) { it.c.position.set(W / 2, y + it.h / 2); this.texts.addChild(it.c); y += it.h + 8; }
    if (!first && g.status === "CORRECT") this.burst();
    if (first && g.status === "CORRECT") this.since = 1e6;
  }
  private burst(): void {
    if (reduced()) return;
    const cols = [ROLE_HEX.BLANK, ACCENT, TEXT];
    for (let i = 0; i < 48; i++) {
      const g = new Graphics().rect(-5, -2.5, 10, 5).fill(cols[i % 3]!);
      this.confLayer.addChild(g);
      this.confetti.push({ g, x: 80 + ((i * 197) % 800), vx: ((i * 37) % 60) - 30, vy: -((i * 53) % 220) - 120, r: ((i * 67) % 360) * DEG, d: (i % 8) * 60 });
    }
  }
  tick(dt: number): void {
    this.age += dt;
    this.since += dt;
    const g = this.v.guess;
    const pending = g?.status === "PENDING";
    const R = reduced();
    // Lights down while the Mole thinks (600 ms either way).
    const target = pending ? 1 : 0;
    this.darkA += (target - this.darkA) * Math.min(1, dt / (R ? 60 : 180));
    this.dark.alpha = this.darkA;
    this.spot.alpha = 0.3 * this.darkA;
    this.ring.tick(pending ? this.v : NO_DEADLINE, dt);
    const q = R ? 1 : clamp01(this.age / 450);
    this.hero.scale.set(0.85 + 0.15 * overshoot(q));
    this.texts.alpha = clamp01((this.since - 80) / 300);
    // WRONG shakes three times (360 ms); CORRECT flashes white and drops confetti.
    if (g?.status === "WRONG" && this.since < 360 && !R) {
      const u = this.since / 360;
      this.hero.position.x = W / 2 + 12 * Math.sin(u * Math.PI * 6) * (1 - u * 0.3);
    } else this.hero.position.x = W / 2;
    this.flash.alpha = g?.status === "CORRECT" && this.since < 500 && !R ? 0.25 * (this.since < 100 ? this.since / 100 : 1 - (this.since - 100) / 400) : 0;
    for (const c of this.confetti) {
      const s = Math.max(0, this.since - c.d) / 1000;
      c.g.visible = s > 0 && s < 3;
      c.g.position.set(c.x + c.vx * s, 60 + c.vy * s + 260 * s * s);
      c.g.rotation = c.r + s * 6;
      c.g.alpha = 1 - clamp01((s - 2.2) / 0.8);
    }
    this.bar.root.visible = !pending;
    if (!pending) this.bar.tick(this.v);
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

/** The host's guess override (DOM buttons over the canvas: the same `.tvbtn` the D-pad reaches, the same dialogs). */
function GuessOverride({ v }: { v: TvView }) {
  const g = v.guess;
  const p = byId(v, g?.playerId);
  if (v.phase !== "MR_WHITE_GUESS" || !g || !p || g.status === "PENDING" || g.overridden) return null;
  const name = isolate(p.name);
  if (g.status === "WRONG") {
    return h("div", { class: "tvbottom" }, h("button", {
      type: "button", class: "tvbtn",
      onClick: () => openDialog({ title: t("guess.acceptConfirm", { name }), confirm: t("guess.accept"), onConfirm: () => tvAct(gameIntent({ type: "HOST_OVERRIDE_GUESS", accept: true })) }),
    }, h(Icon, { name: "check" }), t("guess.accept")));
  }
  if (g.status === "CORRECT") {
    return h("div", { class: "tvbottom" }, h("button", {
      type: "button", class: "tvbtn tvbtn--danger",
      onClick: () => openDialog({ title: t("guess.rejectConfirm"), confirm: t("guess.reject"), danger: true, onConfirm: () => tvAct(gameIntent({ type: "HOST_OVERRIDE_GUESS", accept: false })) }),
    }, h(Icon, { name: "x" }), t("guess.reject")));
  }
  return null;
}

// ----------------------------------------------------------------------------- TV-11 results
interface Word { text: string; translit?: string | null }
/** Scoreboard row height: 36 (the DOM's 40 would run under the platform results bar at y 444). */
const RH = 36;
class ResultsPhase implements Phase {
  readonly root = new Container();
  private age = 0;
  private stage2 = false;
  private s2age = 0;
  private readonly title: Text;
  private readonly t1: { y: number; s: number };
  private readonly t2: { y: number; s: number };
  private readonly s1 = new Container();
  private readonly s2 = new Container();
  private readonly words: { c: Container; from: number }[] = [];
  private blankCard: Container | null = null;
  private readonly culpritsRow = new Container();
  private readonly houses: { s: Sprite; i: number; x: number }[] = [];
  private readonly masks: { s: Sprite; i: number }[] = [];
  private readonly rows: { c: Container; i: number }[] = [];
  private rowsTop: number = 0;
  private more: Sprite | null = null;
  private readonly fade: Graphics | null = null;
  private readonly strip = new Container();
  private meta: Text | null = null;
  private readonly head = new Container();
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly winColor: number;
  private readonly titleFit: number;
  constructor(private readonly v: TvView, private readonly onRunning: Running) {
    const r = v.result!;
    const rtl = isRtl();
    const winner = r.winner;
    this.winColor = winner === "CIVILIANS" ? ROLE_HEX.CIVILIAN : winner === "BLANK" ? ROLE_HEX.BLANK : ROLE_HEX.UNDERCOVER;
    // The wash (full bleed, behind everything).
    if (winner === "INFILTRATORS") {
      const a = glow(ROLE_HEX.UNDERCOVER, W * 1.3, H * 1.3, 0.22); a.position.set(0, 0);
      const b = glow(ROLE_HEX.BLANK, W * 1.3, H * 1.3, 0.1); b.position.set(W, H);
      this.root.addChild(a, b);
    } else {
      const w = glow(this.winColor, W * 1.4, H * 1.4, winner === "BLANK" ? 0.18 : 0.22);
      w.position.set(W / 2, H * 0.4);
      this.root.addChild(w);
    }
    const winnerName = winner === "BLANK" ? byId(v, r.winnerIds[0])?.name ?? "" : "";
    const win = winnerMessage(v);
    const titleStr = t(win.key, { count: win.count, name: isolate(winnerName) });
    const tcls = titleSize(titleStr);
    const ts: TS = tcls === "tvt-displayL" ? "displayL" : tcls === "tvt-displayM" ? "displayM" : "displayS";
    this.title = T(titleStr, ts, { fill: this.winColor, upper: true, ls: ts === "displayS" ? 0 : -0.01, maxW: 860 });
    this.titleFit = this.title.scale.x;
    // ---- stage 1 column
    const blankGuess = winner === "BLANK" ? r.guesses.find((g) => g.status === "CORRECT")?.text ?? null : null;
    const caught = culprits(v);
    const two = hadUndercover(v);
    const wordCard = (role: "CIVILIAN" | "UNDERCOVER", label: string, w: Word): { c: Container; w: number; h: number } => {
      const lab = T(label, "caption", { weight: "900", fill: INK, upper: true, ls: 0.08 });
      lab.alpha = 0.8;
      const tx = T(w.text, "displayM", { fill: INK, maxW: 380 });
      const tr = w.translit ? T(w.translit, "body", { fill: INK }) : null;
      if (tr) tr.alpha = 0.8;
      const cw = Math.max(300, Math.max(lab.width, tx.width, tr?.width ?? 0) + 56);
      const ch = 18 * 2 + type("caption").line + type("displayM").line + (tr ? type("body").line : 0);
      const c = new Container();
      c.addChild(spr(panelTex(role, cw, ch, 24), cw, ch));
      let y = -ch / 2 + 18;
      lab.position.set(0, y + type("caption").line / 2); y += type("caption").line;
      tx.position.set(0, y + type("displayM").line / 2); y += type("displayM").line;
      c.addChild(lab, tx);
      if (tr) { tr.position.set(0, y + type("body").line / 2); c.addChild(tr); }
      return { c, w: cw, h: ch };
    };
    const cards = [wordCard("CIVILIAN", t("results.civilianWord"), r.civilianWord)];
    if (two) cards.push(wordCard("UNDERCOVER", t("results.undercoverWord"), r.undercoverWord));
    const wordsW = cards.reduce((a, c) => a + c.w, 0) + 24 * (cards.length - 1);
    const wk = wordsW > 860 ? 860 / wordsW : 1;
    const wordsH = Math.max(...cards.map((c) => c.h)) * wk;
    let blankH = 0;
    if (blankGuess) {
      const bc = new Container();
      const em = emblem("BLANK", 64, INK);
      const tx = T(blankGuess, "displayS", { fill: INK, maxW: 600 });
      const bw = 28 + 64 + 16 + tx.width + 28, bh = Math.max(64, type("displayS").line) + 28;
      bc.addChild(spr(panelTex("BLANK", bw, bh, 24), bw, bh));
      em.position.set((rtl ? 1 : -1) * (bw / 2 - 28 - 32), 0);
      tx.position.set((rtl ? -1 : 1) * (bw / 2 - 28 - tx.width / 2) , 0);
      bc.addChild(em, tx);
      this.blankCard = bc;
      blankH = bh;
    }
    // Culprits: "Omar was the Mole" pills.
    const pills = caught.map((p) => {
      const c = new Container();
      const av = new Avatar(p.color, 48);
      av.set(p.left ? "left" : "normal");
      const tx = T(t(ROLE_WAS_KEY[p.revealedRole!], { name: isolate(p.name) }), "title", { anchorX: rtl ? 1 : 0, maxW: 600 });
      const pw = 4 + 48 + 12 + tx.width + 20, ph = 56;
      c.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, 28).fill(SURFACE).stroke({ width: 3, color: ROLE_HEX[p.revealedRole!], alignment: 1 }));
      const sx = (rtl ? 1 : -1) * pw / 2;
      av.position.set(sx + (rtl ? -1 : 1) * (4 + 24), 24);
      tx.position.set(sx + (rtl ? -1 : 1) * (4 + 48 + 12), 0);
      c.addChild(av, tx);
      return { c, w: pw };
    });
    const pillsW = pills.reduce((a, p) => a + p.w, 0) + 20 * Math.max(0, pills.length - 1);
    const pillsRows = pillsW > 840 ? 2 : 1;
    const culpritsH = pills.length ? pillsRows * 56 + (pillsRows - 1) * 12 : 0;
    const tLine = type(ts).line;
    const blocks = [tLine, blankH, wordsH, culpritsH].filter((x) => x > 0);
    const raw = blocks.reduce((a, b) => a + b, 0) + 14 * (blocks.length - 1);
    // The DOM column overflows its 372 dp stage with a long title, the Mole's card and the culprits; here the whole
    // column scales down to fit between the top bar and the bottom bar.
    const k = Math.min(1, 372 / raw);
    const total = raw * k;
    let y = 75 + (372 - total) / 2;
    this.t1 = { y: y + (tLine * k) / 2, s: k };
    y += (tLine + 14) * k;
    if (this.blankCard) { this.blankCard.scale.set(k); this.blankCard.position.set(W / 2, y + (blankH * k) / 2); this.s1.addChild(this.blankCard); y += (blankH + 14) * k; }
    let x = W / 2 - (wordsW * wk * k) / 2;
    const seq = rtl ? [...cards].reverse() : cards;
    seq.forEach((c) => {
      c.c.scale.set(wk * k);
      c.c.position.set(x + (c.w * wk * k) / 2, y + (wordsH * k) / 2);
      const isCiv = c === cards[0];
      // Civilian slides in from the inline start, Undercover from the end.
      this.words.push({ c: c.c, from: (isCiv ? -1 : 1) * (rtl ? -1 : 1) * 480 });
      this.s1.addChild(c.c);
      x += (c.w + 24) * wk * k;
    });
    y += (wordsH + 14) * k;
    if (pills.length) {
      // Wrap into rows of ≤ 840 (laid out at full size from y, then scaled by k about the row's top centre).
      this.culpritsRow.pivot.set(W / 2, y);
      this.culpritsRow.position.set(W / 2, y);
      this.culpritsRow.scale.set(k);
      let row: typeof pills = [], rowW = 0, ry = y + 28;
      const flush = (): void => {
        let px = W / 2 - rowW / 2;
        const ordered = rtl ? [...row].reverse() : row;
        for (const p of ordered) { p.c.position.set(px + p.w / 2, ry); this.culpritsRow.addChild(p.c); px += p.w + 20; }
        row = []; rowW = 0; ry += 56 + 12;
      };
      for (const p of pills) { if (row.length && rowW + 20 + p.w > 840) flush(); rowW += (row.length ? 20 : 0) + p.w; row.push(p); }
      if (row.length) flush();
      this.s1.addChild(this.culpritsRow);
    }
    // Particles: houses rise beside the title (civilians), masks peek from the corners (infiltrators).
    if (!reduced()) {
      if (winner === "CIVILIANS") {
        const left = W / 2 - this.title.width / 2, right = W / 2 + this.title.width / 2;
        particleLanes(left, right).forEach((px, i) => {
          const s = emblem("CIVILIAN", 28, ROLE_HEX.CIVILIAN);
          s.anchor.set(0, 0);
          s.position.set(px, H + 40 - 28);
          s.alpha = 0;
          this.s1.addChild(s);
          this.houses.push({ s, i, x: px });
        });
      } else if (winner === "INFILTRATORS") {
        const spots = [[-40, 127], [W - 56, 127], [-40, 404], [W - 56, 404]] as const;
        spots.forEach(([mx, my], i) => {
          const s = emblem("UNDERCOVER", 96, ROLE_HEX.UNDERCOVER);
          s.anchor.set(0.5, 0.5);
          s.position.set(mx + 48, my + 48);
          s.alpha = 0;
          this.s1.addChild(s);
          this.masks.push({ s, i });
        });
      }
    }
    this.root.addChild(this.s1);
    // ---- stage 2: the title shrinks to a headline, the words become a strip, the scoreboard rises.
    const ty2 = 75 + type("headline").line / 2;
    this.t2 = { y: ty2, s: type("headline").size / type(ts).size };
    const stripY = 75 + type("headline").line + 4 + 24;
    const chip = (role: "CIVILIAN" | "UNDERCOVER", label: string, w: Word): { c: Container; w: number } => {
      const c = new Container();
      const lab = T(label, "caption", { weight: "900", fill: INK, upper: true, ls: 0.08, anchorX: rtl ? 1 : 0 });
      lab.alpha = 0.8;
      const tx = T(w.text, "title", { fill: INK, anchorX: rtl ? 1 : 0, maxW: 260 });
      const tr = w.translit ? T(w.translit, "caption", { fill: INK, anchorX: rtl ? 1 : 0 }) : null;
      if (tr) tr.alpha = 0.8;
      const parts = [lab, tx, ...(tr ? [tr] : [])];
      const cw = 22 * 2 + parts.reduce((a, p) => a + p.width, 0) + 14 * (parts.length - 1);
      c.addChild(spr(panelTex(role, cw, 48, 24), cw, 48));
      let px = (rtl ? 1 : -1) * (cw / 2 - 22);
      for (const p of parts) { p.position.set(px, 0); c.addChild(p); px += (rtl ? -1 : 1) * (p.width + 14); }
      return { c, w: cw };
    };
    const chips = [chip("CIVILIAN", t("results.civilianWord"), r.civilianWord)];
    if (two) chips.push(chip("UNDERCOVER", t("results.undercoverWord"), r.undercoverWord));
    const chipsW = chips.reduce((a, c) => a + c.w, 0) + 12 * (chips.length - 1);
    let cx = W / 2 - chipsW / 2;
    for (const c of rtl ? [...chips].reverse() : chips) { c.c.position.set(cx + c.w / 2, stripY); this.strip.addChild(c.c); cx += c.w + 12; }
    this.s2.addChild(this.strip);
    const l = locale.value;
    const metaParts = [t("results.pack", { title: titleIn(r.pack.title, l) })];
    for (const g of r.guesses) { const gp = byId(v, g.playerId); if (gp && g.text !== null) metaParts.push(t("guess.guessed", { name: isolate(gp.name), text: isolate(g.text) })); }
    const metaY = stripY + 24 + 2 + type("body").line / 2;
    const meta = T(metaParts.join("  ·  "), "body", { fill: SECONDARY, maxW: 840 });
    meta.position.set(W / 2, metaY);
    this.s2.addChild(meta);
    this.meta = meta;
    // Scoreboard (760 wide; # | player | role | this game | total).
    const sbX = (W - 760) / 2, inner = sbX + 12;
    const cols = [44, 760 - 24 - 44 - 180 - 150 - 80 - 48, 180, 150, 80];
    const colStart: number[] = [];
    let acc = 0;
    for (const w of cols) { colStart.push(acc); acc += w + 12; }
    /** A cell's anchor x for `align` ("start" | "end") in column `i`, mirrored in RTL. */
    const cellX = (i: number, align: "start" | "end"): { x: number; ax: number } => {
      const s = colStart[i]!, w = cols[i]!;
      const ltrX = inner + (align === "start" ? s : s + w);
      return rtl ? { x: W - ltrX, ax: align === "start" ? 1 : 0 } : { x: ltrX, ax: align === "start" ? 0 : 1 };
    };
    const headY = metaY + type("body").line / 2 + 12;
    const heads = [t("results.colRank"), t("results.colPlayer"), t("results.colRole"), t("results.colGame"), t("results.colTotal")];
    heads.forEach((hs, i) => {
      const al = i >= 3 ? "end" : "start";
      const { x: hx, ax } = cellX(i, al);
      const ht = T(hs, "caption", { weight: "900", fill: MUTED, upper: true, ls: 0.06, anchorX: ax, maxW: cols[i] });
      ht.style.fontSize = 18; fit(ht, cols[i]);
      ht.position.set(hx, headY);
      this.head.addChild(ht);
    });
    this.s2.addChild(this.head);
    const ranked = rankPlayers(v.players);
    const rowsBox = new Container();
    this.s2.addChild(rowsBox);
    const rowsTop = headY + 12;
    this.rowsTop = rowsTop;
    ranked.forEach((p, i) => {
      const c = new Container();
      const pts = r.pointsAwarded[p.id] ?? 0;
      const rank = competitionRank(ranked, p);
      if (rank === 1) c.addChild(new Graphics().roundRect(sbX, 0, 760, RH, 10).fill({ color: ACCENT, alpha: 0.08 }));
      const rk = cellX(0, "start");
      if (rank === 1) { const tr = icon("trophy", 22, ACCENT); tr.position.set(rk.x + (rtl ? -11 : 11), RH / 2); c.addChild(tr); }
      else { const n = T(fmtNum(rank), "titleS", { anchorX: rk.ax }); n.position.set(rk.x, RH / 2); c.addChild(n); }
      const who = cellX(1, "start");
      const av = new Avatar(p.color, 32);
      av.set(p.left ? "left" : "normal");
      av.position.set(who.x + (rtl ? -16 : 16) * (30 / 32), RH / 2 + 16);
      const nmT = nameText(p.name, "titleS", cols[1]! - 44, { anchorX: who.ax });
      nmT.position.set(who.x + (rtl ? -1 : 1) * 42, RH / 2);
      c.addChild(av, nmT);
      if (p.revealedRole) {
        const ro = cellX(2, "start");
        const em = new Container();
        em.addChild(new Graphics().circle(0, 0, 13).fill(ROLE_HEX[p.revealedRole]), emblem(p.revealedRole, 20, INK));
        em.position.set(ro.x + (rtl ? -13 : 13), RH / 2);
        const rl = T(t(ROLE_KEY[p.revealedRole]), "body", { fill: SECONDARY, anchorX: ro.ax, maxW: cols[2]! - 34 });
        rl.position.set(ro.x + (rtl ? -1 : 1) * 34, RH / 2);
        c.addChild(em, rl);
      }
      const gm = cellX(3, "end");
      const pt = T(pts > 0 ? t("results.pointsEarned", { count: pts }) : fmtNum(0), "titleS", { fill: pts > 0 ? SUCCESS : MUTED, anchorX: gm.ax, maxW: cols[3] });
      pt.position.set(gm.x, RH / 2);
      const tt = cellX(4, "end");
      const tot = T(fmtNum(p.score), "titleS", { weight: "900", fill: ACCENT, anchorX: tt.ax });
      tot.position.set(tt.x, RH / 2);
      c.addChild(pt, tot);
      c.position.set(0, rowsTop + i * RH);
      rowsBox.addChild(c);
      this.rows.push({ c, i });
    });
    if (ranked.length > SB_ROWS) {
      // Five rows show (DESIGN TV-11); the rest glide through this window (one static mask, only when needed).
      const m = new Graphics().rect(sbX - 4, rowsTop, 768, SB_ROWS * RH).fill(0xffffff);
      this.s2.addChild(m);
      rowsBox.mask = m;
      const mv = icon("chevron-down", 20, SECONDARY);
      mv.position.set(W / 2, rowsTop + SB_ROWS * RH + 6);
      this.s2.addChild(mv);
      this.more = mv;
    }
    this.s2.visible = false;
    this.root.addChild(this.s2, this.title);
    this.title.position.set(W / 2, this.t1.y);
    this.timer = setTimeout(() => this.complete(), ms(5000));
    this.onRunning(true);
  }
  complete(): void {
    if (this.stage2) return;
    this.stage2 = true;
    this.s2age = 0;
    this.s2.visible = true;
    resultsSettled.value = true;
    this.onRunning(false);
  }
  update(): void { /* the result is final */ }
  tick(dt: number): void {
    this.age += dt;
    const R = reduced();
    const a = this.age;
    if (!this.stage2) {
      const q = R ? 1 : clamp01(a / 600);
      this.title.scale.set(this.titleFit * this.t1.s * (0.2 + 0.8 * overshoot(q)));
      this.title.alpha = clamp01(q * 3);
      if (this.blankCard) {
        const b = R ? 1 : clamp01(a / 800);
        this.blankCard.rotation = (R ? 0 : -200 * DEG) * (1 - overshoot(b));
        this.blankCard.scale.set(0.2 + 0.8 * overshoot(b));
        this.blankCard.alpha = clamp01(b * 3);
      }
      for (const w of this.words) {
        const q2 = R ? clamp01((a - 0) / 200) : clamp01((a - 600) / 800);
        w.c.pivot.x = R ? 0 : -w.from * (1 - decel(q2)) / w.c.scale.x;
        w.c.alpha = q2;
      }
      this.culpritsRow.alpha = clamp01((a - (R ? 0 : 1000)) / 400);
      for (const hs of this.houses) {
        const d = ((hs.i * 7) % 12) * 140;
        const u = clamp01((a - d) / 3000);
        const yy = H + 40 - 28 - 560 * decel(u);
        hs.s.position.y = yy;
        const fa = u < 0.2 ? (u / 0.2) * 0.8 : 0.8 * (1 - (u - 0.2) / 0.8);
        hs.s.alpha = u <= 0 ? 0 : fa * clamp01((yy - 87) / 30);
      }
      for (const m of this.masks) {
        const u = clamp01((a - m.i * 200) / 3000);
        m.s.alpha = u <= 0 ? 0 : u < 0.2 ? (u / 0.2) * 0.8 : 0.8 * (1 - (u - 0.2) / 0.8);
        const blink = u > 0.5 && u < 0.6 ? 1 - 0.9 * Math.sin(((u - 0.5) / 0.1) * Math.PI) : 1;
        m.s.scale.y = Math.abs(m.s.scale.x) * blink;
      }
    } else {
      this.s2age += dt;
      const k = R ? 1 : smooth(this.s2age / 500);
      const s = this.t1.s + (this.t2.s - this.t1.s) * k;
      this.title.scale.set(this.titleFit * s);
      this.title.alpha = 1;
      this.title.position.y = this.t1.y + (this.t2.y - this.t1.y) * k;
      this.s1.alpha = 1 - clamp01(this.s2age / 250);
      this.s1.visible = this.s1.alpha > 0;
      this.strip.alpha = clamp01((this.s2age - 200) / 300);
      riseIn(this.strip, 0, this.s2age, 200, 400, 12);
      if (this.meta) this.meta.alpha = clamp01((this.s2age - 300) / 300);
      this.head.alpha = clamp01((this.s2age - 350) / 300);
      // Rows: staggered rise; with more than five, the list glides (hold, scroll, hold, back).
      const off = sbScroll(Math.max(0, this.s2age - 2000), this.rows.length, SB_ROWS);
      for (const rw of this.rows) {
        const q = R ? 1 : clamp01((this.s2age - 400 - rw.i * 60) / 240);
        const yy = this.rowsTop + (rw.i - off) * RH + (R ? 0 : 24 * (1 - decel(q)));
        rw.c.position.y = yy;
        const rel = (yy - this.rowsTop) / RH;
        const edge = rel <= -1 || rel >= SB_ROWS ? 0 : 1;
        rw.c.alpha = q * edge;
        rw.c.visible = rw.c.alpha > 0.01;
      }
      if (this.more) {
        const atEnd = off >= this.rows.length - SB_ROWS - 0.05;
        this.more.alpha = atEnd ? 0 : clamp01((this.s2age - 600) / 300);
        this.more.position.y = this.rowsTop + SB_ROWS * RH + 6 + (R ? 0 : 3 * Math.sin(this.s2age / 255));
      }
    }
  }
  destroy(): void { clearTimeout(this.timer); resultsSettled.value = false; if (!this.stage2) this.onRunning(false); this.root.destroy({ children: true }); }
}

// ------------------------------------------------------------------------------------------------ the scene
/** One phase per screen (the DOM's screenKey: phase, round, game number); the guess keeps its stage across verdicts. */
function phaseKey(v: TvView): string { return `${v.phase}:${v.round}:${v.gameNumber}`; }

export class MishanaScene implements Scene {
  readonly root = new Container();
  private readonly world = new World();
  private readonly top = new TopBar();
  private readonly layer = new Container();
  private phase: Phase | null = null;
  private key = "";
  private v: TvView | null = null;
  constructor(private readonly onRunning: Running, private readonly onComplete: (f: (() => void) | null) => void) {
    this.root.addChild(this.world.root, this.layer, this.top.root);
  }
  set(view: TvRoomView): void {
    const v = mishanaTvView(view);
    if (!v) return;
    this.v = v;
    const key = phaseKey(v);
    if (key !== this.key) {
      this.key = key;
      this.phase?.root.parent?.removeChild(this.phase.root);
      this.phase?.destroy();
      this.onRunning(false);
      this.phase = this.make(v);
      if (this.phase) this.layer.addChild(this.phase.root);
      this.onComplete(this.phase?.complete ? () => this.phase?.complete?.() : null);
    } else this.phase?.update(v);
    this.syncTop();
  }
  private topV: TvView | null = null;
  private topTitle: string | null | undefined = undefined;
  private topAlive: string | null | undefined = undefined;
  private topHint = false;
  private topConn = "";
  /** The bar is rebuilt only when something it shows changed (the view, the phase's override, the hint, the link). */
  private syncTop(): void {
    const v = this.v;
    if (!v) return;
    const title = this.phase?.topTitle ?? null, alive = this.phase?.stillAlive ?? null;
    const hint = backHintOn.value && !tvPaused.value, conn = tvConn.value;
    if (v === this.topV && title === this.topTitle && alive === this.topAlive && hint === this.topHint && conn === this.topConn) return;
    this.topV = v; this.topTitle = title; this.topAlive = alive; this.topHint = hint; this.topConn = conn;
    this.top.set(v, v.phase === "RESULTS" ? t("results.title") : title, alive);
  }
  private make(v: TvView): Phase | null {
    switch (v.phase) {
      case "ROLE_REVEAL": return new RevealPhase(v);
      case "CLUES":
      case "TIE_BREAK": return new CluesPhase(v, this.onRunning);
      case "VOTING": return new VotingPhase(v);
      case "ELIMINATION": return new EliminationPhase(v, this.onRunning);
      case "MR_WHITE_GUESS": return new GuessPhase(v);
      case "RESULTS": return v.result ? new ResultsPhase(v, this.onRunning) : null;
      default: return null;
    }
  }
  tick(dtMs: number): void {
    const dt = Math.min(dtMs, 100);
    this.world.tick(dt);
    this.phase?.tick(dt);
    this.syncTop();
  }
  destroy(): void { this.phase?.destroy(); this.phase = null; this.root.destroy({ children: true }); }
}

/** /tv-pixi's Mish Ana!: the Pixi scene, the in-game OK rule (OK or a click completes a running choreography, as in the
 *  DOM screens) and the host's guess override buttons (DOM, D-pad reachable). */
export function PixiMishana({ view }: { view: TvRoomView }) {
  const [running, setRunning] = useState(false);
  const complete = useRef<(() => void) | null>(null);
  useInGameOk(running, () => complete.current?.());
  const make = useCallback(() => new MishanaScene(setRunning, (f) => { complete.current = f; }), []);
  const v = mishanaTvView(view);
  return h(Fragment, null,
    h("div", { class: "tvscreen", onClick: () => complete.current?.() }, h(PixiHost, { make, view, label: "mishana" })),
    v ? h(GuessOverride, { v }) : null);
}
