// GAME-BLUFF §12.2 / §12.2.1, DESIGN-JAMAA §5.2: the Bluff reveal as one step list for the shared sampler
// (@jamaa/shared/motion: the same deterministic `sample`, easings and springs the Kotlin TV runs). Step ids are
// `b<beat>.<name>`; the list depends on the public reveal only, so every TV (and the phone mirror) plays the same moment.
// Also the /tv stage geometry (960 × 540 canvas): seats, the spotlight card, landing spots and coin paths. Pure.
import type { Step } from "@jamaa/shared/motion";
import type { Beat, Reveal, RevealPlan } from "./model";

const S = (id: string, startMs: number, durationMs: number, easing: Step["easing"], staggerMs?: number, reduced: Step["reduced"] = "fade"): Step =>
  ({ id, startMs: Math.round(startMs), durationMs: Math.round(durationMs), easing, ...(staggerMs === undefined ? {} : { staggerMs: Math.round(staggerMs) }), reduced, lite: "keep" });

/** ≤ 24 moving sprites at once (GAME-BLUFF §12.7): coins beyond this ride as bundles. */
export const MAX_COINS = 24;
/** Envelopes dropped on a final answer (one per vote, capped; the counter carries the rest). */
export const MAX_ENVELOPES = 12;

/** Marks a renderer reacts to (expressions, sounds) with their beat-local time. */
export interface BeatMarks { land: number; stamp: number; pop: number; coins: number; tick: number }

/**
 * Local timings of one beat (ms from the beat start), before fitting into the beat. `voters` = characters that hop on
 * (lies: voters; truth: finders); `coins` = coin flights.
 */
function localSteps(b: Beat, r: Reveal, voters: number, coins: number): { steps: Step[]; marks: BeatMarks } {
  const steps: Step[] = [];
  const v = Math.max(0, voters);
  switch (b.kind) {
    case "intro":
      steps.push(S("dim", 0, 600, "ease.standard"));
      return { steps, marks: { land: 0, stamp: 0, pop: 0, coins: 0, tick: 0 } };
    case "quick": {
      steps.push(S("spot", 0, 220, "ease.decel"), S("faces", 120, 260, "ease.overshoot", 40), S("stamp", 380, 300, "ease.overshoot"));
      steps.push(S("coin", 620, 360, "ease.coin", 50, "skip"), S("tick", 980, 200, "ease.decel"));
      return { steps, marks: { land: 380, stamp: 380, pop: 620, coins: 620, tick: 980 } };
    }
    case "lie":
    case "truth": {
      const truth = b.kind === "truth";
      steps.push(S("spot", 0, 400, "ease.decel"));
      if (truth) steps.push(S("gold", 300, 500, "ease.standard"), S("sweep", 600, 500, "ease.standard"));
      const jumpAt = truth ? 900 : 400;
      steps.push(S("jump", jumpAt, 380, "spring.bouncy", 120, "fade"));
      const land = jumpAt + 120 * Math.max(0, v - 1) + 380;
      const drum = truth ? 0 : 600;
      if (!truth) steps.push(S("drum", land, drum, "linear", undefined, "skip"));
      const stamp = land + drum;
      steps.push(S("stamp", stamp, 400, "ease.overshoot"));
      if (truth) steps.push(S("confetti", stamp + 200, 1200, "linear", undefined, "skip"));
      const pop = stamp + 400;
      if (!truth) steps.push(S("pop", pop, 500, "spring.bouncy"));
      const coinAt = truth ? pop : pop + 500;
      steps.push(S("coin", coinAt, 450, "ease.coin", 80, "skip"));
      const tick = coinAt + 450;
      steps.push(S("tick", tick, 600 + 80 * Math.max(0, coins - 1), "ease.decel"));
      if (truth) steps.push(S("note", tick, 500, "ease.decel"));
      return { steps, marks: { land, stamp, pop, coins: coinAt, tick } };
    }
    case "answer": {
      steps.push(S("spot", 0, 400, "ease.decel"), S("env", 400, 420, "ease.accel", 90, "fade"));
      const n = Math.min(MAX_ENVELOPES, r.steps[b.steps[0] ?? -1]?.voteCount ?? 0);
      const land = 400 + 90 * Math.max(0, n - 1) + 420;
      steps.push(S("count", 400, land - 400, "ease.decel"), S("pop", land, 500, "spring.bouncy"));
      steps.push(S("coin", land + 400, 450, "ease.coin", 60, "skip"), S("tick", land + 850, 600, "ease.decel"));
      return { steps, marks: { land, stamp: land, pop: land, coins: land + 400, tick: land + 850 } };
    }
    case "crown":
      steps.push(S("spot", 0, 500, "ease.decel"), S("stamp", 500, 400, "ease.overshoot"), S("pop", 700, 500, "spring.bouncy"));
      steps.push(S("crown", 1000, 500, "spring.bouncy"), S("confetti", 1000, 1400, "linear", undefined, "skip"), S("tick", 1200, 700, "ease.decel"));
      return { steps, marks: { land: 500, stamp: 500, pop: 700, coins: 1000, tick: 1200 } };
    case "twist":
      steps.push(S("flip", 0, 600, "ease.standard", 60), S("stamp", 700, 400, "ease.overshoot"));
      return { steps, marks: { land: 0, stamp: 700, pop: 700, coins: 0, tick: 0 } };
    case "montage":
      steps.push(S("fan", 0, 600, "ease.decel", 50), S("fall", 1700, 700, "ease.accel", 40, "skip"));
      return { steps, marks: { land: 0, stamp: 0, pop: 0, coins: 0, tick: 0 } };
    case "likes":
      steps.push(S("heart", 0, 600, "ease.coin", 70, "skip"), S("tick", 600, 600, "ease.decel"));
      return { steps, marks: { land: 0, stamp: 0, pop: 0, coins: 0, tick: 600 } };
  }
}

/** Players who hop onto the beat's card (lies: voters; truth: finders; quick hits: shown as faces). */
export function hoppers(r: Reveal, b: Beat): string[] {
  if (r.final || (b.kind !== "lie" && b.kind !== "truth" && b.kind !== "quick")) return [];
  const s = r.steps[b.steps[0] ?? -1];
  return s ? s.voterIds.slice(0, 12) : [];
}

/** Coin flights of a beat: `from` a player id (a voter on the card), "card" (truth → finders) or "box" (final ballots). */
export interface Coin { from: string; to: string; label: string | null }

export function coinsOf(r: Reveal, b: Beat): Coin[] {
  const s = r.steps[b.steps[0] ?? -1];
  const out: Coin[] = [];
  if (!s) return out;
  if (b.kind === "lie" || b.kind === "quick") {
    const authors = s.authorIds;
    if (authors.length === 0) return out; // a house lie: the house keeps it
    const each = s.deltas.find((d) => d.reason === "fooled")?.points ?? 0;
    s.voterIds.forEach((v, i) => { for (const a of authors) out.push({ from: v, to: a, label: i === 0 && each > 0 ? `+${each}` : null }); });
  } else if (b.kind === "truth") {
    for (const d of s.deltas) if (d.reason === "truth") out.push({ from: "card", to: d.playerId, label: `+${d.points}` });
  } else if (b.kind === "answer") {
    const pts = s.deltas.filter((d) => d.reason === "fooled").reduce((a, d) => a + d.points, 0);
    for (let i = 0; i < Math.min(s.voteCount, 6); i++) for (const a of s.authorIds) out.push({ from: "box", to: a, label: i === 0 && pts > 0 ? `+${pts}` : null });
  }
  return out.slice(0, MAX_COINS);
}

export interface TimedBeat { steps: Step[]; marks: BeatMarks }

/** The whole reveal as one step list (ids `b<i>.<name>`), each beat fitted into its slot of the plan. */
export function revealTimeline(r: Reveal, plan: RevealPlan): { steps: Step[]; beats: TimedBeat[] } {
  const all: Step[] = [];
  const beats: TimedBeat[] = [];
  plan.beats.forEach((b, i) => {
    const nHop = hoppers(r, b).length, nCoin = coinsOf(r, b).length;
    const { steps, marks } = localSteps(b, r, nHop, nCoin);
    const count = (id: string): number => (id === "coin" ? nCoin : id === "jump" || id === "faces" ? nHop : id === "env" ? MAX_ENVELOPES : id === "fan" || id === "fall" ? r.unpicked.length : 1);
    const end = steps.reduce((a, s) => Math.max(a, s.startMs + (s.staggerMs ?? 0) * Math.max(0, count(s.id) - 1) + s.durationMs), 0);
    // Fit: a beat never runs past its slot (the next beat and the server timer don't wait). Springs keep their physical
    // duration (the shared sampler's rule) and only move in time.
    const f = end > b.dur * 0.96 && end > 0 ? (b.dur * 0.96) / end : 1;
    const fit = (x: number): number => Math.round(x * f);
    const placed = steps.map((s) => {
      const spring = s.easing.startsWith("spring");
      const out: Step = { ...s, id: `b${i}.${s.id}`, startMs: b.start + fit(s.startMs), durationMs: spring ? s.durationMs : Math.max(1, fit(s.durationMs)) };
      if (s.staggerMs !== undefined) out.staggerMs = fit(s.staggerMs);
      return out;
    });
    all.push(...placed);
    beats.push({ steps: placed, marks: { land: b.start + fit(marks.land), stamp: b.start + fit(marks.stamp), pop: b.start + fit(marks.pop), coins: b.start + fit(marks.coins), tick: b.start + fit(marks.tick) } });
  });
  return { steps: all, beats };
}

// ---------------------------------------------------------------- stage geometry (960 × 540 canvas, dp)

export const W = 960;
export const H = 540;
/** Seated characters: feet on this line. */
export const SEAT_Y = 462;
export const SEAT_CHAR = 52;
/** The score pill row under the names. */
export const PILL_Y = 506;
/** The spotlight card (centre, size). */
export const CARD = { x: 480, y: 214, w: 560, h: 132 } as const;
export const CARD_TOP = CARD.y - CARD.h / 2;
/** Where the final's ballot box sits (start side of the card). */
export const BOX = { x: 160, y: 300 } as const;

export interface Pt { x: number; y: number }

/** Seat centres along the café row, start → end (mirrored in RTL). */
export function seatX(count: number, index: number, rtl: boolean): number {
  const n = Math.max(1, count);
  const span = n <= 6 ? 620 : 860;
  const x = (W - span) / 2 + (index + 0.5) * (span / n);
  return rtl ? W - x : x;
}

/** Where hopper `k` of `n` lands on top of the spotlight card (shoulder to shoulder). */
export function landing(k: number, n: number): Pt {
  const gap = n > 8 ? 40 : 48;
  return { x: CARD.x + (k - (n - 1) / 2) * gap, y: CARD_TOP + 2 };
}

/** The author's pop-out spot: behind the card's end corner. */
export function popSpot(rtl: boolean, k = 0): Pt {
  const dx = CARD.w / 2 - 34 - k * 70;
  return { x: rtl ? CARD.x - dx : CARD.x + dx, y: CARD_TOP + 18 };
}

/** The control point of a coin's quadratic Bézier: 90 dp above the chord midpoint (below when both ends are high). */
export function control(a: Pt, b: Pt): Pt {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const up = a.y > H / 2 || b.y > H / 2;
  return { x: mid.x, y: up ? Math.min(a.y, b.y) - 90 : Math.max(a.y, b.y) + 90 };
}

export function bezier(a: Pt, c: Pt, b: Pt, p: number): Pt {
  const u = 1 - p;
  return { x: u * u * a.x + 2 * u * p * c.x + p * p * b.x, y: u * u * a.y + 2 * u * p * c.y + p * p * b.y };
}
