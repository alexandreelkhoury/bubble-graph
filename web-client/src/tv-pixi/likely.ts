// Most Likely on the Pixi TV (GAME-LIKELY §8 / §12; draft 4: no points): CARD, VOTING, HOLD, REVEAL, AWARDS, RESULTS.
// It reads the same view model (games/likely/model.ts), the same layout (shared likelyRow / revealPlan) and the same
// timeline (tv/choreo.ts steps on the shared `run` sampler) as the DOM screens in games/likely/tv, and draws them with
// Pixi: static Graphics, canvas Text, one Char sprite per player, transforms only per frame. Design units are the
// 960 × 540 canvas; the host scales them 2×.
import { Container, Graphics } from "pixi.js";
import type { Text } from "pixi.js";
import type { Expression } from "@jamaa/shared/characters";
import { likelyRevealMs, likelyRow } from "@jamaa/shared/games/likely/meta";
import { run, variant } from "@jamaa/shared/motion";
import type { Run } from "@jamaa/shared/motion";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { worldColor } from "@jamaa/shared/worlds";
import { fmtNum, isolate, listOf, locale, t, tSplit } from "../i18n/t";
import { remainingMs } from "../lib/countdown";
import { reduced } from "../lib/motion";
import { clockOffset } from "../state/store";
import { resultsSettled } from "../tv-mock/tvPlatform";
import { stopAll } from "../tv-mock/sound/player";
import {
  CHAR, REVEAL_CHAR, activeSeats, againName, arcPoint, awardsOf, awardsStage, deadlineOf, extraAwards, fmtPercent, likelyModel, revealExpression,
  revealPlan, signatureRow, toCanvas,
} from "../games/likely/model";
import type { LikelyAward, LikelyModel, Seat } from "../games/likely/model";
import { awardText, k, promptLine } from "../games/likely/parts";
import { fitReveal, revealSteps } from "../games/likely/tv/choreo";
import { platformCue, riseRate, sfx } from "../games/likely/tv/sfx";
import { Char, CREAM, GOLD, H, INK, W, hex, qrPanel, rosette, setText, txt } from "./kit";
import type { Scene } from "./stage";

const wcol = (tok: "deep" | "stageTop" | "accent" | "glow" | "signal"): number => hex(worldColor("rooftop", tok, "web") ?? "#071A24");
const isRtl = (): boolean => locale.value === "ar";
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const easeOut = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
const overshoot = (x: number): number => { const c = 1.9, u = clamp01(x) - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

interface Phase { root: Container; update(m: LikelyModel): void; tick(dtMs: number): void; complete?(): void; destroy(): void }

// ------------------------------------------------------------------------------------------------ the rooftop world
function buildWorld(): Container {
  const c = new Container();
  const bg = new Graphics().rect(0, 0, W, H).fill({ color: wcol("deep") });
  bg.rect(0, 0, W, 300).fill({ color: wcol("stageTop"), alpha: 0.55 });
  bg.rect(0, 120, W, 180).fill({ color: wcol("stageTop"), alpha: 0.35 });
  bg.ellipse(W / 2, H, 520, 160).fill({ color: wcol("accent"), alpha: 0.12 });
  for (let i = 0; i < 34; i++) bg.circle((i * 283) % 960, 40 + ((i * 131) % 200), i % 5 === 0 ? 1.4 : 0.8).fill({ color: CREAM, alpha: 0.7 });
  c.addChild(bg);
  const sky = new Graphics();
  sky.svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540"><path fill="#0a2230" d="M0 470 V430 h40 v-22 h26 v30 h30 v-48 h22 v-14 h10 v14 h18 v56 h34 v-36 h44 v-18 h8 v18 h30 v46 h26 v-70 h36 v70 h22 v-30 h40 v-26 h12 v26 h24 v44 h30 v-58 h20 v-10 h16 v10 h14 v58 h40 v-34 h36 v-20 h26 v54 h22 v-42 h34 v42 h40 v-64 h28 v64 h26 v-28 h40 v40 h28 v-24 h30 V540 H0z"/></svg>');
  c.addChild(sky);
  const lights = new Graphics();
  for (let i = 1; i < 22; i++) { const u = i / 22; lights.circle(-10 + 980 * u, -26 + 6 + 160 * u * (1 - u), 4.2).fill({ color: 0xffd36e, alpha: 0.85 }); }
  for (let i = 1; i < 16; i++) { const u = i / 16; lights.circle(120 + 860 * u, -20 + 6 + 120 * u * (1 - u), 4.2).fill({ color: 0xffd36e, alpha: 0.85 }); }
  for (let i = 0; i < 26; i++) lights.rect(20 + ((i * 97) % 920), 448 + ((i * 37) % 60), 5, 7).fill({ color: 0xffe7a0, alpha: i % 3 ? 0.35 : 0.8 });
  c.addChild(lights);
  return c;
}

/** The in-game top bar: "Most Likely · 3/8" and the room code. */
class Top {
  readonly root = new Container();
  private readonly title = txt("", 18, { weight: "700", anchorX: 0, maxW: 420 });
  private readonly code = txt("", 20, { weight: "900", anchorX: 1, fill: GOLD });
  private last = "";
  constructor() { this.root.addChild(this.title, this.code); }
  set(m: LikelyModel, label: string | null): void {
    const text = label ?? `${t(k("card.counter"), { index: Math.min(m.pub.cardIndex + 1, m.pub.cardCount), count: m.pub.cardCount })}`;
    const sig = `${text}|${m.roomCode}|${locale.value}`;
    if (sig === this.last) return;
    this.last = sig;
    const rtl = isRtl();
    setText(this.title, `${t(k("title"))}  ·  ${text}`, 460);
    this.title.anchor.x = rtl ? 1 : 0;
    this.title.position.set(rtl ? W - 48 : 48, 44);
    this.code.text = m.roomCode.split("").join(" ");
    this.code.anchor.x = rtl ? 0 : 1;
    this.code.position.set(rtl ? 48 : W - 48, 44);
  }
}

// ------------------------------------------------------------------------------------------------ shared pieces
function seatLayout(m: LikelyModel): { seats: Seat[]; pts: { x: number; y: number }[] } {
  const seats = m.seats.filter((s) => !s.left);
  return { seats, pts: likelyRow(seats.length, isRtl()).map(toCanvas) };
}

function juryExpression(m: LikelyModel, s: Seat): Expression {
  if (!s.connected) return "away";
  if (m.pub.card?.namedPlayerId === s.id) return "shy";
  if (m.pub.phase === "VOTING") return m.pub.votedIds.includes(s.id) ? "done" : "think";
  return "idle";
}

function nameTag(s: string, size = 13): Text { return txt(s, size, { weight: "700", maxW: 84 }); }

/** The gold bulb arch behind the card. */
function arch(cx: number, cy: number): Graphics {
  const g = new Graphics();
  const n = 19;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (i / (n - 1));
    g.circle(cx - 300 * Math.cos(a), cy - 130 * Math.sin(a), 6).fill({ color: GOLD, alpha: 0.9 });
  }
  return g;
}

/** The question card (CARD / VOTING; `small` is the lifted one of the reveal). */
function buildCard(m: LikelyModel, w: number, h: number, small: boolean): Container {
  const c = new Container();
  const card = m.pub.card;
  if (!card) return c;
  c.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, 16).fill(0xfff7ec).stroke({ width: 3, color: GOLD }));
  const [before, after] = tSplit(k("card.question"), "prompt", { prompt: "" });
  const n = [...card.prompt].length;
  const big = small ? 20 : n <= 26 ? 40 : n <= 44 ? 34 : 28;
  const lead = txt(before.trim(), small ? 13 : 17, { weight: "600", fill: 0x6b5a86, maxW: w - 40 });
  lead.position.set(0, small ? -h / 2 + 13 : -h / 2 + 28);
  const q = txt(`${card.prompt}${after.trimEnd()}`, big, { weight: "900", fill: INK, wrap: w - 48, maxW: w - 48, lineHeight: big * 1.15 });
  q.position.set(0, small ? 1 : -4);
  const room = small ? h - 44 : h - 80;
  if (q.height > room) q.scale.set(q.scale.x * (room / q.height));
  const aw = txt(card.award, small ? 14 : 18, { weight: "700", fill: 0xb07a00, maxW: w - 80 });
  aw.position.set(0, h / 2 - (small ? 12 : 24));
  c.addChild(lead, q, aw);
  if (card.spicy || card.rerun) {
    const tag = txt(card.spicy ? t(k("spicy.tag")) : t(k("card.rerun")), 12, { weight: "900", fill: 0xffffff });
    const bg = new Graphics().roundRect(-tag.width / 2 - 8, -11, tag.width + 16, 22, 11).fill(card.spicy ? 0xd6333a : 0x29a89a);
    const holder = new Container();
    holder.addChild(bg, tag);
    holder.position.set(w / 2 - 50, -h / 2);
    c.addChild(holder);
  }
  return c;
}

/** Ring timer (server deadline) with the seconds inside. */
class Ring {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly num = txt("", 24, { weight: "900" });
  private lastKey = "";
  constructor(private readonly r: number) { this.root.addChild(this.g, this.num); }
  tick(m: LikelyModel): void {
    const dl = deadlineOf(m);
    if (!dl) { this.root.visible = false; return; }
    this.root.visible = true;
    const ms = remainingMs(dl.at, Date.now(), clockOffset.value);
    const secs = Math.ceil(ms / 1000);
    const frac = clamp01(ms / dl.durationMs);
    const key = `${secs}|${Math.round(frac * 120)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const col = secs <= 5 ? 0xff5a5f : secs <= 10 ? GOLD : wcol("accent");
    const g = this.g.clear();
    g.circle(0, 0, this.r).stroke({ width: 7, color: 0xffffff, alpha: 0.14 });
    if (frac > 0.005) g.arc(0, 0, this.r, -Math.PI / 2 + Math.PI * 2 * (1 - frac), Math.PI * 1.5).stroke({ width: 7, color: col, cap: "round" });
    setText(this.num, fmtNum(secs));
    this.num.style.fill = col;
  }
}

// ------------------------------------------------------------------------------------------------ CARD / VOTING
class PlayPhase implements Phase {
  readonly root = new Container();
  private readonly cardHold = new Container();
  private readonly ring = new Ring(30);
  private readonly voted = txt("", 20, { weight: "700", fill: 0xdad2f5 });
  private readonly jury = new Map<string, Char>();
  private age = 0;
  private m: LikelyModel;
  constructor(m: LikelyModel) {
    this.m = m;
    this.root.addChild(arch(W / 2, 262));
    this.cardHold.position.set(W / 2, 178);
    this.cardHold.addChild(buildCard(m, 450, 170, false));
    this.root.addChild(this.cardHold);
    this.ring.root.position.set(W / 2, 318);
    this.voted.position.set(W / 2, 362);
    this.root.addChild(this.ring.root, this.voted);
    const { seats, pts } = seatLayout(m);
    seats.forEach((s, i) => {
      const ch = new Char(s.color, CHAR, juryExpression(m, s));
      ch.position.set(pts[i]!.x, pts[i]!.y);
      const nm = nameTag(s.name);
      nm.position.set(pts[i]!.x, pts[i]!.y + 12);
      this.root.addChild(ch, nm);
      this.jury.set(s.id, ch);
    });
    this.update(m);
    sfx("deal");
  }
  update(m: LikelyModel): void {
    this.m = m;
    for (const s of m.seats) { const ch = this.jury.get(s.id); if (ch) ch.expression = juryExpression(m, s); }
    const voting = m.pub.phase === "VOTING";
    const voters = activeSeats(m).filter((s) => s.connected || m.pub.votedIds.includes(s.id)).length;
    this.voted.visible = voting;
    this.ring.root.visible = voting;
    if (voting) setText(this.voted, t(k("vote.progress"), { count: m.pub.votedIds.length, total: voters }), 400);
  }
  tick(dt: number): void {
    this.age += dt;
    const q = reduced() ? 1 : clamp01(this.age / 450);
    this.cardHold.scale.set(0.8 + 0.2 * overshoot(q));
    this.cardHold.alpha = Math.min(1, q * 2.5);
    if (this.m.pub.phase === "VOTING") this.ring.tick(this.m);
  }
  destroy(): void { this.root.destroy({ children: true }); }
}

class HoldPhase implements Phase {
  readonly root = new Container();
  private readonly title = txt("", 34, { weight: "900", maxW: 700 });
  private readonly chars: Char[] = [];
  constructor(m: LikelyModel) {
    const seats = activeSeats(m);
    seats.forEach((s, i) => {
      const ch = new Char(s.color, 72, s.connected ? "think" : "away");
      ch.position.set(W / 2 + (i - (seats.length - 1) / 2) * 80, 210);
      this.root.addChild(ch);
      this.chars.push(ch);
    });
    this.title.position.set(W / 2, 260);
    const body = txt(t(k("coach.hold")), 18, { weight: "600", fill: 0xdad2f5, maxW: 700 });
    body.position.set(W / 2, 300);
    const qr = qrPanel(m.joinUrl, 120);
    qr.position.set(W / 2 - 150, 340);
    const code = txt(m.roomCode.split("").join(" "), 44, { weight: "900", fill: GOLD, anchorX: 0 });
    code.position.set(W / 2 - 10, 400);
    this.root.addChild(this.title, body, qr, code);
    this.update(m);
  }
  update(m: LikelyModel): void { setText(this.title, t(k("hold.waiting"), { count: activeSeats(m).filter((s) => s.connected).length }), 700); }
  tick(): void { /* static */ }
  destroy(): void { this.root.destroy({ children: true }); }
}

// ------------------------------------------------------------------------------------------------ REVEAL
type Stage = "run" | "stamp" | "end";

class RevealPhase implements Phase {
  readonly root = new Container();
  private readonly plan: ReturnType<typeof revealPlan>;
  private readonly steps;
  private handle: Run | null = null;
  private m: LikelyModel;
  private stage: Stage = "run";
  private readonly cast = new Map<string, { box: Container; ch: Char }>();
  private readonly toks: { box: Container }[] = [];
  private readonly counts = new Map<string, Container>();
  private readonly spot = new Graphics();
  private readonly stampMarks = new Map<string, Container>();
  private readonly banner = new Container();
  private readonly caption: Text | null;
  private readonly confetti: { g: Graphics; x: number; y: number; r: number; left: boolean; d: number }[] = [];
  private readonly confLayer = new Container();
  constructor(m: LikelyModel, private readonly onRunning: (running: boolean) => void) {
    this.m = m;
    const r = m.pub.reveal!;
    const rtl = isRtl();
    const pub = m.pub.showVoters && !!r.ballots;
    const plan = revealPlan(m, rtl);
    this.plan = plan;
    const count = Math.max(1, plan.tokens.length);
    this.steps = fitReveal(revealSteps({ tokens: plan.tokens.length, chaos: r.chaos, none: r.none, unanimous: r.unanimous }),
      likelyRevealMs(r.votesCast, r.unanimous, r.topIds.length), count);
    const top = r.topIds.map((id) => m.byId.get(id)).filter((s): s is Seat => !!s && !!plan.row[s.id]);
    // The card lifts to the top (its final position; it eases up from the middle during `dim`).
    const card = buildCard(m, 420, 84, true);
    card.position.set(W / 2, 118);
    this.root.addChild(this.spot);
    // The players: one centred row.
    const seats = m.seats.filter((s) => plan.row[s.id]);
    for (const s of seats) {
      const box = new Container();
      const ch = new Char(s.color, REVEAL_CHAR, "idle");
      const nm = nameTag(s.name, 12);
      nm.position.set(0, 13);
      box.addChild(ch, nm);
      const p = plan.seat[s.id]!;
      box.position.set(p.x, p.y);
      this.root.addChild(box);
      this.cast.set(s.id, { box, ch });
      if (top.some((x) => x.id === s.id) && !r.chaos) {
        const ro = rosette(15);
        ro.position.set(-REVEAL_CHAR * 0.1, -REVEAL_CHAR - 20);
        ro.visible = false;
        box.addChild(ro);
        this.stampMarks.set(s.id, ro);
      }
    }
    // Counts above each voted player.
    if (!r.none) {
      for (const c of r.counts) {
        const p = plan.row[c.playerId];
        if (!p) continue;
        const b = new Container();
        b.addChild(new Graphics().roundRect(-24, -14, 48, 28, 14).fill(GOLD));
        const tx = txt(pub ? fmtNum(c.count) : fmtPercent(c.percent, locale.value), 16, { weight: "900", fill: INK, maxW: 44 });
        b.addChild(tx);
        b.position.set(p.x + REVEAL_CHAR * 0.42, p.y - REVEAL_CHAR - 7);
        b.visible = false;
        this.root.addChild(b);
        this.counts.set(c.playerId, b);
      }
    }
    // The votes: voter characters in miniature (public) or identical envelopes (secret).
    for (const tk of plan.tokens) {
      const box = new Container();
      const v = tk.voterId ? m.byId.get(tk.voterId) : null;
      if (v) { const ch = new Char(v.color, Math.round(plan.cell * 0.92), "point"); ch.position.set(0, plan.cell * 0.46); box.addChild(ch); }
      else {
        const e = Math.round(plan.cell * 0.9);
        box.addChild(new Graphics().roundRect(-e / 2, -e * 0.34, e, e * 0.68, 3).fill(0xfff1dc).stroke({ width: 1.2, color: INK }).poly([-e / 2, -e * 0.34, 0, e * 0.06, e / 2, -e * 0.34]).stroke({ width: 1.2, color: INK }));
      }
      box.position.set(tk.at.x, tk.at.y);
      box.visible = false;
      this.root.addChild(box);
      this.toks.push({ box });
    }
    this.root.addChild(card);
    // Banner: the award and its winner(s); or the chaos / no-votes caption.
    if (!r.chaos && !r.none && top.length > 0 && m.pub.card) {
      const line = [r.unanimous ? t(k("reveal.unanimous")) : "", m.pub.card.award, listOf(top.map((s) => isolate(s.name)))].filter(Boolean);
      const aw = txt(line.join("  ·  "), 22, { weight: "900", fill: GOLD, maxW: 760 });
      aw.position.set(W / 2, 176);
      this.banner.addChild(aw);
      const again = againName(m);
      if (again) { const a = txt(t(k("reveal.again"), { name: isolate(again) }), 16, { weight: "700", fill: 0xffd6e4, maxW: 600 }); a.position.set(W / 2, 202); this.banner.addChild(a); }
      this.banner.visible = false;
    }
    this.root.addChild(this.banner);
    const cap = r.none ? t(k("reveal.none")) : r.chaos ? t(k("reveal.chaos")) : "";
    this.caption = cap ? txt(cap, 24, { weight: "900", fill: r.chaos ? 0xff9a9a : 0xdad2f5, maxW: 760 }) : null;
    if (this.caption) { this.caption.position.set(W / 2, 190); this.caption.visible = false; this.root.addChild(this.caption); }
    if (r.unanimous) this.buildConfetti();
    this.root.addChild(this.confLayer);
    this.stage = reduced() ? "end" : "run";
    this.start();
    this.applyExpressions();
    if (reduced()) this.handle?.complete();
  }

  private buildConfetti(): void {
    const colors = [0xffc94d, 0xfff7ec, 0x29d3c2, 0xff7ab3, 0xffe7a0, 0xb8fff6];
    for (let i = 0; i < 36; i++) {
      const g = new Graphics().rect(-4, -2, 8, 4).fill(colors[i % colors.length]!);
      g.visible = false;
      this.confLayer.addChild(g);
      this.confetti.push({ g, left: i % 2 === 0, x: 180 + ((i * 53) % 320), y: 260 + ((i * 97) % 220), r: ((i * 67) % 720) * Math.PI / 180, d: (i % 6) * 0.03 });
    }
  }

  private expr(s: Seat): Expression {
    const r = this.m.pub.reveal!;
    return this.stage === "run" && !(r.ballots ?? []).some((b) => b.voterId === s.id) ? (s.connected ? "idle" : "away") : revealExpression(this.m, s.id, this.stage);
  }
  private applyExpressions(): void { for (const s of this.m.seats) { const c = this.cast.get(s.id); if (c) c.ch.expression = this.expr(s); } }
  private toStage(s: Stage): void { if (s !== this.stage) { this.stage = s; this.applyExpressions(); } }

  private start(): void {
    const { plan, m } = this;
    const r = m.pub.reveal!;
    const fired = new Set<string>();
    const once = (id: string, f: () => void): void => { if (!fired.has(id)) { fired.add(id); f(); } };
    const has = new Set(this.steps.map((x) => x.id));
    const eff = variant(this.steps, { reduced: reduced() });
    const landed = new Map<string, number>();
    const top = new Set(r.topIds);
    const count = Math.max(1, plan.tokens.length);
    let lastSpot = -1;
    platformCue("sfx.drumroll");
    this.onRunning(true);
    this.handle = run(eff, (p) => {
      const lift = clamp01(p("dim"));
      const spot = has.has("spot") ? p("spot") : 0;
      const stamp = has.has("stamp") ? p("stamp") : 0;
      const scr = has.has("scramble") ? p("scramble") : 0;
      let i = 0;
      for (const [id, c] of this.cast) {
        const a = plan.seat[id]!, b = plan.row[id]!;
        let x = a.x + (b.x - a.x) * lift, y = a.y + (b.y - a.y) * lift;
        if (scr > 0 && scr < 1) {
          x += 18 * Math.sin(2 * Math.PI * (scr * 3 + i * 0.37)) * Math.sin(Math.PI * scr);
          y -= 14 * Math.abs(Math.sin(2 * Math.PI * (scr * 2.5 + i * 0.21)));
        }
        const sc = (CHAR + (REVEAL_CHAR - CHAR) * lift) / REVEAL_CHAR;
        const isTop = top.has(id) && !r.chaos;
        const up = isTop ? easeOut(spot) : 0;
        c.box.position.set(x, y - up * 8);
        c.box.scale.set(sc * (1 + 0.12 * up));
        i++;
      }
      this.toks.forEach((e, n) => {
        const tk = plan.tokens[n]!;
        const q = clamp01(p("token", n));
        const from = tk.voterId ? { x: plan.row[tk.voterId]!.x, y: plan.row[tk.voterId]!.y - REVEAL_CHAR / 2 } : { x: 480, y: 150 };
        const pt = arcPoint(from, tk.at, q, tk.voterId === tk.targetId ? 20 : 70);
        e.box.position.set(pt.x, pt.y);
        e.box.scale.set(0.5 + 0.5 * q);
        e.box.visible = q > 0;
        if (q >= 1) once(`tok${n}`, () => {
          const c = (landed.get(tk.targetId) ?? 0) + 1;
          landed.set(tk.targetId, c);
          sfx("tok", riseRate(c - 1));
        });
      });
      const cnt = has.has("count") ? p("count") : 0;
      for (const [, b] of this.counts) { b.visible = cnt > 0; b.scale.set(cnt > 0 ? overshoot(cnt) : 0); }
      if (cnt > 0) once("count", () => platformCue("counter_tick"));
      if (scr > 0) once("scr", () => sfx("scramble"));
      // Spotlight: the room dims around the most-voted.
      const sq = Math.round(spot * 40);
      if (sq !== lastSpot) {
        lastSpot = sq;
        this.spot.clear();
        if (spot > 0 && top.size > 0 && !r.chaos) {
          this.spot.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.5 * spot });
          for (const id of top) { const b = plan.row[id]; if (b) this.spot.circle(b.x, b.y - REVEAL_CHAR / 2, 62).cut(); }
        }
      }
      if (spot > 0) once("spot", () => sfx("spot"));
      for (const [, mk] of this.stampMarks) { mk.visible = stamp > 0; mk.scale.set(stamp > 0 ? overshoot(stamp) : 0); }
      this.banner.visible = stamp > 0;
      this.banner.alpha = clamp01(stamp * 2);
      if (this.caption) this.caption.visible = (has.has("count") ? p("count") : 1) >= 1 || r.none;
      if (stamp > 0) once("stamp", () => { sfx("rosette"); this.toStage("stamp"); });
      const cf = has.has("confetti") ? p("confetti") : 0;
      if (cf > 0 && cf < 1) {
        once("conf", () => sfx("confetti"));
        for (const c of this.confetti) {
          const q = clamp01((cf - c.d) / (1 - c.d));
          c.g.visible = q > 0 && q < 1;
          c.g.position.set(c.left ? 20 + c.x * easeOut(q) : W - 20 - c.x * easeOut(q), H - 20 - c.y * easeOut(q) + 260 * q * q);
          c.g.rotation = c.r * q;
          c.g.alpha = 1 - clamp01((q - 0.8) / 0.2);
        }
      } else if (cf >= 1) for (const c of this.confetti) c.g.visible = false;
      if (has.has("hold") && p("hold") > 0) once("hold", () => { this.toStage("end"); this.onRunning(false); });
    }, () => { this.toStage("end"); this.onRunning(false); }, count);
  }

  update(m: LikelyModel): void { this.m = m; }
  tick(): void { /* the run drives itself (rAF) */ }
  complete(): void { stopAll(); this.handle?.complete(); }
  destroy(): void { this.handle?.cancel(); this.onRunning(false); this.root.destroy({ children: true }); }
}

// ------------------------------------------------------------------------------------------------ AWARDS / RESULTS
class AwardsPhase implements Phase {
  readonly root = new Container();
  private m: LikelyModel;
  private key = "";
  private age = 0;
  private skip = false;
  private readonly stage = new Container();
  private drops: Container[] = [];
  constructor(m: LikelyModel) { this.m = m; this.root.addChild(this.stage); this.update(m); }
  private elapsed(): number {
    const dl = deadlineOf(this.m);
    return dl ? Math.max(0, dl.durationMs - remainingMs(dl.at, Date.now(), clockOffset.value)) : 0;
  }
  update(m: LikelyModel): void { this.m = m; this.rebuild(); }
  private rebuild(): void {
    const m = this.m;
    const st = awardsStage(m.seats.length, this.elapsed());
    const key = st.kind === "trio" ? `t${st.index}` : st.kind;
    if (key === this.key) return;
    this.key = key; this.age = 0; this.skip = false;
    this.stage.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.drops = [];
    if (st.kind === "intro") {
      const lock = txt(t(k("title")), 56, { weight: "900", fill: GOLD, maxW: 700 });
      lock.position.set(W / 2, 200);
      const h = txt(t(k("awards.title")), 30, { weight: "700", maxW: 700 });
      h.position.set(W / 2, 262);
      this.stage.addChild(lock, h);
      const seats = activeSeats(m);
      seats.forEach((s, i) => { const ch = new Char(s.color, 56, "happy"); ch.position.set(W / 2 + (i - (seats.length - 1) / 2) * 62, 360); this.stage.addChild(ch); this.drops.push(ch); });
      sfx("glint");
      return;
    }
    const rows = signatureRow(m).slice(st.index * 3, st.index * 3 + 3);
    const xs = rows.length === 1 ? [W / 2] : rows.length === 2 ? [W / 2 - 150, W / 2 + 150] : [170, W / 2, W - 170];
    sfx(rows.some((r) => r.award?.kind === "mystery") ? "puff" : "rosette");
    rows.forEach((r, i) => {
      const box = new Container();
      const mystery = r.award?.kind === "mystery";
      const tx = r.award ? awardText(r.award) : null;
      box.addChild(new Graphics().ellipse(0, 6, 90, 14).fill({ color: GOLD, alpha: 0.35 }));
      const ch = new Char(r.seat.color, 130, r.seat.left ? "away" : mystery ? "smug" : "cheer");
      ch.position.set(0, 0);
      box.addChild(ch);
      if (mystery) { const p = new Graphics().circle(0, 0, 30).fill(0x6b4dd6).stroke({ width: 3, color: INK }); const q = txt("?", 40, { weight: "900" }); p.addChild(q); p.position.set(70, -120); box.addChild(p); }
      else { const ro = rosette(32); ro.position.set(70, -120); box.addChild(ro); }
      const nm = txt(r.seat.name, 24, { weight: "900", maxW: 270 });
      nm.position.set(0, 36);
      box.addChild(nm);
      if (tx) {
        const ti = txt(tx.title, 26, { weight: "900", fill: GOLD, wrap: 270, maxW: 270 });
        ti.position.set(0, 76 + ti.height / 2 - 14);
        box.addChild(ti);
        if (tx.line) {
          const li = txt(tx.line, 15, { weight: "600", fill: 0xdad2f5, wrap: 270, maxW: 270 });
          li.position.set(0, ti.y + ti.height / 2 + 8 + li.height / 2);
          if (li.height > 70) li.scale.set(li.scale.x * 70 / li.height);
          box.addChild(li);
        }
      }
      if (r.seat.left) { const l = txt(t(k("awards.left")), 14, { weight: "600", fill: 0xdad2f5 }); l.position.set(0, 60); box.addChild(l); }
      const ex = extraAwards(m.pub).filter((a) => a.playerIds.includes(r.seat.id));
      ex.forEach((a, j) => { const e = txt(`★ ${awardText(a).title}`, 14, { weight: "700", fill: 0xb8fff6, maxW: 270 }); e.position.set(0, 290 + j * 18); box.addChild(e); });
      box.position.set(xs[i]!, 200);
      this.stage.addChild(box);
      this.drops.push(box);
    });
  }
  tick(dt: number): void {
    this.age += dt;
    this.rebuild();
    this.drops.forEach((d, i) => {
      const q = this.skip || reduced() ? 1 : clamp01((this.age - i * 130) / 480);
      d.alpha = Math.min(1, q * 3);
      d.scale.set(0.7 + 0.3 * overshoot(q));
    });
  }
  complete(): void { this.skip = true; }
  destroy(): void { this.root.destroy({ children: true }); }
}

function wallDensity(n: number): "roomy" | "mid" | "dense" { return n <= 4 ? "roomy" : n <= 9 ? "mid" : "dense"; }

class ResultsPhase implements Phase {
  readonly root = new Container();
  private readonly timer: ReturnType<typeof setTimeout>;
  constructor(m: LikelyModel) {
    this.timer = setTimeout(() => { resultsSettled.value = true; }, reduced() ? 300 : 1400);
    const rows = signatureRow(m);
    const dense = wallDensity(rows.length);
    const cols = dense === "roomy" ? 2 : dense === "mid" ? 3 : 4;
    const gridRows = Math.max(1, Math.ceil(rows.length / cols));
    const x0 = 48, y0 = 128, cw = (W - 96) / cols, ch = Math.min(150, (H - 22 - y0 - 40) / gridRows);
    const head = txt(t(k("results.awardsWall")), 22, { weight: "900", fill: GOLD, maxW: 600 });
    head.position.set(W / 2, 100);
    this.root.addChild(head);
    const rtl = isRtl();
    const cs = dense === "roomy" ? 56 : dense === "mid" ? 40 : 34;
    rows.forEach((r, i) => {
      const col = i % cols, rw = Math.floor(i / cols);
      const cellX = rtl ? W - x0 - (col + 1) * cw : x0 + col * cw;
      const cell = new Container();
      cell.position.set(cellX, y0 + rw * ch);
      cell.addChild(new Graphics().roundRect(4, 2, cw - 8, ch - 8, 12).fill({ color: 0xffffff, alpha: 0.07 }));
      const ext = awardsOf(m.pub, r.seat.id).filter((a: LikelyAward) => a !== r.award);
      const main = r.award ?? ext.shift() ?? null;
      const line = main?.kind === "signature" && main.card ? promptLine(main.card.prompt) : main ? awardText(main).line : "";
      const c = new Char(r.seat.color, cs, r.award?.kind === "mystery" ? "smug" : "happy");
      c.position.set(rtl ? cw - 14 - cs / 2 : 14 + cs / 2, ch / 2 + cs / 2 - 6);
      cell.addChild(c);
      const tw = cw - cs - 44;
      const tx = rtl ? cw - 14 - cs - 12 : 14 + cs + 12;
      let y = 10;
      const items: Text[] = [];
      const nm = txt(r.seat.name, dense === "dense" ? 14 : 17, { weight: "900", anchorX: rtl ? 1 : 0, anchorY: 0, align: rtl ? "right" : "left", maxW: tw });
      items.push(nm);
      if (main) items.push(txt(awardText(main).title, dense === "dense" ? 13 : 16, { weight: "900", fill: GOLD, anchorX: rtl ? 1 : 0, anchorY: 0, align: rtl ? "right" : "left", wrap: tw }));
      for (const a of ext) items.push(txt(`★ ${awardText(a).title}`, 12, { weight: "700", fill: 0xb8fff6, anchorX: rtl ? 1 : 0, anchorY: 0, align: rtl ? "right" : "left", maxW: tw }));
      if (dense !== "dense" && line) items.push(txt(line, 12, { weight: "600", fill: 0xdad2f5, anchorX: rtl ? 1 : 0, anchorY: 0, align: rtl ? "right" : "left", wrap: tw }));
      const total = items.reduce((a, b) => a + b.height + 3, 0);
      const avail = ch - 22;
      const sc = total > avail ? avail / total : 1;
      for (const it of items) { it.scale.set(it.scale.x * sc); it.position.set(tx, y); y += (it.height + 3); cell.addChild(it); }
      this.root.addChild(cell);
    });
  }
  update(): void { /* static */ }
  tick(): void { /* static */ }
  destroy(): void { clearTimeout(this.timer); resultsSettled.value = false; this.root.destroy({ children: true }); }
}

// ------------------------------------------------------------------------------------------------ the scene
/** CARD → VOTING keeps the same stage (the card does not re-deal); a new card or phase group rebuilds (as screenKey). */
function phaseKey(m: LikelyModel): string {
  const p = m.pub.phase;
  const group = p === "CARD" || p === "VOTING" ? "play" : p === "REVEAL" && !m.pub.reveal ? "play" : p;
  return `${m.n}:${group}:${m.pub.cardIndex}:${m.pub.card?.id ?? ""}`;
}

export class LikelyScene implements Scene {
  readonly root = new Container();
  private readonly world = buildWorld();
  private readonly dim = new Graphics().rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.28 });
  private readonly top = new Top();
  private readonly layer = new Container();
  private phase: Phase | null = null;
  private key = "";
  private model: LikelyModel | null = null;
  constructor(private readonly onRunning: (running: boolean) => void, private readonly onComplete: (f: (() => void) | null) => void) {
    this.root.addChild(this.world, this.dim, this.layer, this.top.root);
  }

  set(view: TvRoomView): void {
    const m = likelyModel(view);
    if (!m) return;
    this.model = m;
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
    const p = m.pub.phase;
    this.dim.visible = p !== "CARD" && p !== "VOTING";
    this.top.set(m, p === "AWARDS" ? t(k("awards.title")) : p === "RESULTS" ? t(k("results.title")) : null);
  }

  private make(m: LikelyModel): Phase {
    switch (m.pub.phase) {
      case "REVEAL": if (m.pub.reveal) return new RevealPhase(m, this.onRunning); return new PlayPhase(m);
      case "HOLD": return new HoldPhase(m);
      case "AWARDS": { this.onRunning(true); return new AwardsPhase(m); }
      case "RESULTS": return new ResultsPhase(m);
      default: return new PlayPhase(m);
    }
  }

  tick(dtMs: number): void { this.phase?.tick(dtMs); }
  destroy(): void { this.phase?.destroy(); this.root.destroy({ children: true }); }
}
