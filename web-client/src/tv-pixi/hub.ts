// The Pixi hub (v1): the four game posters in a row (the focused one lifts), the join ticket (QR + room code) and the
// players strip. Pure drawing: the keys (Left/Right/OK) live in index.tsx and move the same `tvFocusGame` / OPEN_GAME
// the DOM hub uses. Geometry follows DESIGN-JAMAA §2.1 (posters 210 × 290, gap 28, first at 24, mirrored in RTL).
import { Container, FillGradient, Graphics } from "pixi.js";
import type { Text } from "pixi.js";
import type { ColorId } from "@jamaa/shared/constants";
import type { GameId } from "@jamaa/shared/games/ids";
import type { Expression } from "@jamaa/shared/characters";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { worldColor } from "@jamaa/shared/worlds";
import type { WorldId } from "@jamaa/shared/worlds";
import { isolateLtr, LOCALE_NATIVE_NAME, locale, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { ellipsizeName } from "../lib/names";
import { WORLD_OF } from "../lib/meta";
import { tvFocusGame } from "../tv-mock/tvStore";
import { carouselPos, hostOf } from "../tv-mock/tvHub";
import { Char, CREAM, GOLD, H, W, hex, qrPanel, setText, txt } from "./kit";
import type { Scene } from "./stage";

const POSTER_W = 210, POSTER_H = 290, STEP = 238, TOP = 96;
const CAST: Record<GameId, readonly [ColorId, Expression][]> = {
  mishana: [["azure", "point"], ["plum", "shock"], ["lemon", "point"]],
  bluff: [["jade", "think"], ["tangerine", "smug"], ["lilac", "think"]],
  likely: [["aqua", "point"], ["rose", "shy"], ["sand", "point"]],
  trivia: [["grape", "idle"], ["coral", "cheer"], ["mint", "idle"]],
};
const wc = (id: GameId, tok: "deep" | "stageTop" | "accent" | "glow" | "surface"): number => hex(worldColor(WORLD_OF[id] as WorldId, tok, "web") ?? "#222244");
const vgrad = (a: number, b: number): FillGradient => new FillGradient({
  type: "linear", start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: "local", colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }],
});

class Poster extends Container {
  readonly ring = new Graphics();
  readonly dim = new Graphics();
  tx = 0; ty = 0; ts = 1; cx = 0; cy = 0; cs = 1; snap = true;
  constructor(readonly id: GameId, title: string, tagline: string) {
    super();
    const g = new Graphics();
    g.roundRect(0, 0, POSTER_W, POSTER_H, 14).fill(vgrad(wc(id, "stageTop"), wc(id, "deep")));
    g.circle(POSTER_W / 2, 150, 92).fill({ color: wc(id, "glow"), alpha: 0.1 });
    g.rect(0, POSTER_H - 92, POSTER_W, 78).fill({ color: 0x000000, alpha: 0.38 });
    g.roundRect(0, POSTER_H - 28, POSTER_W, 28, 14).fill({ color: 0x000000, alpha: 0.38 });
    this.addChild(g);
    const sizes = [64, 76, 64];
    CAST[id].forEach(([c, e], i) => {
      const ch = new Char(c, sizes[i]!, e);
      ch.position.set(POSTER_W / 2 + (i - 1) * 62, 188 + (i === 1 ? 4 : 0));
      this.addChild(ch);
    });
    const tt = txt(title, 30, { weight: "900", maxW: POSTER_W - 24, fill: wc(id, "glow") });
    tt.position.set(POSTER_W / 2, POSTER_H - 66);
    const tg = txt(tagline, 13, { weight: "600", wrap: POSTER_W - 28, maxW: POSTER_W - 28 });
    tg.position.set(POSTER_W / 2, POSTER_H - 30);
    this.addChild(tt, tg);
    this.ring.roundRect(-3, -3, POSTER_W + 6, POSTER_H + 6, 17).stroke({ width: 4, color: wc(id, "glow") });
    this.ring.visible = false;
    this.dim.roundRect(0, 0, POSTER_W, POSTER_H, 14).fill({ color: 0x000000, alpha: 0.55 });
    this.dim.visible = false;
    this.addChild(this.ring, this.dim);
    this.pivot.set(POSTER_W / 2, POSTER_H);
  }
}

export class HubScene implements Scene {
  readonly root = new Container();
  private readonly bg = new Graphics().rect(0, 0, W, H).fill(vgrad(0x2b1650, 0x1d1036));
  private readonly glow = new Graphics();
  private posters = new Map<GameId, Poster>();
  private readonly row = new Container();
  private readonly meta = txt("", 17, { weight: "600", fill: 0xdad2f5 });
  private readonly dynamic = new Container();
  private sig = "";
  private ids: GameId[] = [];
  private focused: GameId = "mishana";
  private rtl = false;
  private lang = "";

  constructor() {
    this.root.addChild(this.bg, this.glow, this.row, this.meta, this.dynamic);
    this.meta.position.set(W / 2, TOP + POSTER_H + 36);
    this.root.addChild(this.mark, this.ar);
  }
  private readonly mark = txt("JAMAA", 30, { weight: "900", fill: GOLD, anchorX: 0 });
  private readonly ar = txt("جماعة", 30, { weight: "900", fill: CREAM, anchorX: 0 });

  set(view: TvRoomView): void {
    const room = view.room;
    const games = room.games;
    this.ids = games.map((g) => g.id);
    const local = tvFocusGame.value;
    this.focused = local && this.ids.includes(local) ? local : this.ids.includes(room.focusedGameId) ? room.focusedGameId : this.ids[0] ?? "mishana";
    this.rtl = document.documentElement.dir === "rtl" || locale.value === "ar";
    const span = this.mark.width + 14 + this.ar.width;
    this.mark.position.set(this.rtl ? W - 40 - span : 40, 40);
    this.ar.position.set(this.mark.x + this.mark.width + 14, 40);
    const posterSig = `${this.ids.join(",")}|${locale.value}|${room.contentLocale}|${games.map((g) => g.available).join("")}`;
    if (posterSig !== this.lang) {
      this.lang = posterSig;
      this.row.removeChildren().forEach((c) => c.destroy({ children: true }));
      this.posters.clear();
      for (const g of games) {
        const p = new Poster(g.id, t(`game.${g.id}.title` as MessageKey), t(`game.${g.id}.tagline` as MessageKey));
        p.dim.visible = !g.available;
        if (!g.available) {
          const m = txt(t("hub.notAvailable", { language: LOCALE_NATIVE_NAME[room.contentLocale] }), 15, { wrap: 170, maxW: 180 });
          m.position.set(POSTER_W / 2, 120);
          p.addChild(m);
        }
        this.posters.set(g.id, p);
        this.row.addChild(p);
      }
    }
    const fi = Math.max(0, this.ids.indexOf(this.focused));
    const n = this.ids.length;
    this.ids.forEach((id, i) => {
      const p = this.posters.get(id)!;
      const pos = n > 1 ? carouselPos(i, fi, n) : 0;
      const x = 24 + pos * STEP;
      const isF = id === this.focused;
      p.tx = (this.rtl ? W - x - POSTER_W : x) + POSTER_W / 2;
      p.ty = TOP + POSTER_H + (isF ? -12 : 0);
      p.ts = isF ? 1.08 : 1;
      p.ring.visible = isF;
      if (p.snap || Math.abs(p.tx - p.cx) > STEP * 1.5) { p.cx = p.tx; p.cy = p.ty; p.cs = p.ts; p.snap = false; this.place(p); }
    });
    const card = games.find((g) => g.id === this.focused);
    const members = room.members.filter((m) => !m.left);
    if (card) {
      const needs = members.length < card.minPlayers;
      setText(this.meta, `${needs ? t("hub.needsPlayers", { count: card.minPlayers }) : t("hub.players", { min: card.minPlayers, max: card.maxPlayers })}  ·  ${t("hub.minutes", { min: card.durationMinutes[0], max: card.durationMinutes[1] })}`, 700);
      this.meta.style.fill = needs ? 0xff8a8a : 0xdad2f5;
    }
    this.drawGlow();
    const sig = `${room.joinUrl}|${room.roomCode}|${locale.value}|${members.map((m) => `${m.id}${m.name}${m.color}${m.isHost}`).join(",")}`;
    if (sig !== this.sig) { this.sig = sig; this.drawBottom(view, members); }
  }

  private place(p: Poster): void { p.position.set(p.cx, p.cy); p.scale.set(p.cs); }

  private drawGlow(): void {
    const id = this.focused;
    const p = this.posters.get(id);
    this.glow.clear();
    const c = wc(id, "accent");
    const x = p ? p.cx : W / 2;
    for (let i = 0; i < 6; i++) this.glow.circle(x, TOP + 150, 230 - i * 30).fill({ color: c, alpha: 0.035 });
  }

  private drawBottom(view: TvRoomView, members: TvRoomView["room"]["members"]): void {
    const room = view.room;
    this.dynamic.removeChildren().forEach((c) => c.destroy({ children: true }));
    const flip = (x: number, w = 0): number => (this.rtl ? W - x - w : x);
    const y0 = 436;
    // The join ticket: QR panel, "Join on your phone", the code, the address.
    const panel = 96;
    const qr = qrPanel(room.joinUrl, panel);
    qr.position.set(flip(40, panel), y0);
    const head = txt(t("hub.joinOnPhone"), 14, { weight: "600", anchorX: this.rtl ? 1 : 0, fill: 0xdad2f5, maxW: 200 });
    head.position.set(flip(40 + panel + 16), y0 + 12);
    const code = txt(room.roomCode.split("").join(" "), 40, { weight: "900", anchorX: this.rtl ? 1 : 0, fill: GOLD });
    code.position.set(flip(40 + panel + 16), y0 + 48);
    const url = txt(isolateLtr(`${hostOf(room.joinUrl)}/${room.roomCode}`), 12, { weight: "400", anchorX: this.rtl ? 1 : 0, fill: 0xb8aee0, maxW: 200 });
    url.position.set(flip(40 + panel + 16), y0 + 82);
    this.dynamic.addChild(qr, head, code, url);
    // The players strip.
    const x0 = 330, slot = 50;
    if (members.length === 0) {
      const w = txt(t("hub.waitingGang"), 16, { weight: "600", fill: 0xb8aee0, anchorX: this.rtl ? 1 : 0, maxW: 560 });
      w.position.set(flip(x0), y0 + 60);
      this.dynamic.addChild(w);
    }
    const perRow = Math.floor((W - 40 - x0) / slot);
    members.slice(0, perRow * 2).forEach((m, i) => {
      const col = i % perRow, rowI = Math.floor(i / perRow);
      const cx = flip(x0 + col * slot + slot / 2);
      const ch = new Char(m.color, 40, m.connected ? "happy" : "away");
      ch.position.set(cx, y0 + 40 + rowI * 62);
      const nm: Text = txt(ellipsizeName(m.name, members.length > 8 ? 6 : 8), 11, { weight: "600", maxW: slot - 4 });
      nm.position.set(cx, y0 + 50 + rowI * 62);
      this.dynamic.addChild(ch, nm);
    });
  }

  tick(dtMs: number): void {
    const k = 1 - Math.exp(-dtMs / 70);
    let moved = false;
    for (const p of this.posters.values()) {
      const dx = p.tx - p.cx, dy = p.ty - p.cy, ds = p.ts - p.cs;
      if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(ds) < 0.002) continue;
      p.cx += dx * k; p.cy += dy * k; p.cs += ds * k;
      this.place(p);
      moved = true;
    }
    if (moved) this.drawGlow();
  }

  destroy(): void { this.root.destroy({ children: true }); }
}
