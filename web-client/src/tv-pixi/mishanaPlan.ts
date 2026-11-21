// Mish Ana! on the Pixi TV: the pure geometry and timelines (no Pixi import, unit-tested in test/pixiMishana.test.ts).
// Every number mirrors the DOM screens in games/mishana/tv (tv.css boxes on the 960 × 540 canvas, the TV-07/TV-09
// timeline of tvElimination.tsx), so the two renderers show the same thing at the same moment.
import { orderWindow, ORDER_STRIP } from "../games/mishana/lib";

export interface Box { x: number; y: number; w: number; h: number }

/** TV-07 + TV-09 timeline (tvElimination.tsx `T`); `ms` halves times under reduced motion (lib/motion `ms`). */
export interface ElimTimeline {
  arrows: number; arrowsEnd: number; suspense: number; verdict: number; votesEnd: number; wheel: number;
  cardStart: number; holdAt: number; flipAt: number; flipEnd: number; reaction: number; total: number; flipDur: number; grow: number;
}
export function elimTimeline(random: boolean, ms: (n: number) => number, revealMs = 3000, verdictMs = 2400): ElimTimeline {
  const votesEnd = ms(revealMs);
  const wheel = random ? ms(2000) : 0;
  const k = random ? 0.6 : 1;
  const grow = ms(400 * k), hold = ms(600 * k), flip = ms(800 * k);
  const cardStart = votesEnd + wheel;
  return {
    arrows: ms(300), arrowsEnd: ms(1800), suspense: ms(1800), verdict: ms(verdictMs), votesEnd, wheel, cardStart,
    holdAt: cardStart + grow, flipAt: cardStart + grow + hold, flipEnd: cardStart + grow + hold + flip,
    reaction: cardStart + grow + hold + flip + ms(200), total: cardStart + grow + hold + flip + ms(800), flipDur: flip, grow,
  };
}

export interface LastVoteLike { tally: readonly { targetId: string; voterIds: readonly string[] }[]; abstainIds: readonly string[] }
export interface Flight { voterId: string; to: string; k: number; delay: number; dur: number }
/** One chip per voter in seat order (`seatOrder`: the view's players), to their target or "__bin" (abstained). */
export function voteFlights(seatOrder: readonly string[], lv: LastVoteLike, T: Pick<ElimTimeline, "arrows" | "arrowsEnd">, minDur: number): Flight[] {
  const target = new Map<string, string>();
  for (const x of lv.tally) for (const v of x.voterIds) target.set(v, x.targetId);
  for (const a of lv.abstainIds) target.set(a, "__bin");
  const voters = seatOrder.filter((id) => target.has(id));
  const per = voters.length ? (T.arrowsEnd - T.arrows) / voters.length : 0;
  const stack = new Map<string, number>();
  return voters.map((id, i) => {
    const to = target.get(id)!;
    const k = stack.get(to) ?? 0;
    stack.set(to, k + 1);
    return { voterId: id, to, k, delay: T.arrows + i * per, dur: Math.max(minDur, per * 1.6) };
  });
}

/** The chip's quadratic Bézier (tvElimination VoteBoard): voter tile centre → just above the target, bowed ±90. */
export function flightCurve(a: Box, b: Box, k: number): { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number } {
  const x0 = a.x + a.w / 2, y0 = a.y + a.h / 2;
  const x1 = b.x + b.w / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 10, y1 = b.y - 6 - k * 4;
  const below = a.y > 200 && b.y > 200;
  return { x0, y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 + (below ? 90 : -90), x1, y1 };
}
export function quad(p0: number, c: number, p1: number, e: number): number {
  return (1 - e) * (1 - e) * p0 + 2 * (1 - e) * e * c + e * e * p1;
}

/**
 * The TV-06/TV-07 tile grid (.tvvgrid): rows of 4 (6 when more than 8, the compact 120 × 96 tiles), gap 16, an
 * incomplete last row centred, the whole block centred on (cx, cy); RTL fills each row from the right (flex-wrap).
 */
export function voteGrid(n: number, cx: number, cy: number, rtl: boolean): { tiles: Box[]; big: boolean } {
  const big = n > 8;
  const per = big ? 6 : 4, w = big ? 120 : 136, h = big ? 96 : 112, gap = 16;
  const rows = Math.max(1, Math.ceil(n / per));
  const top = cy - (rows * h + (rows - 1) * gap) / 2;
  const tiles: Box[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / per), c = i % per;
    const inRow = Math.min(per, n - r * per);
    const rowW = inRow * w + (inRow - 1) * gap;
    const col = rtl ? inRow - 1 - c : c;
    tiles.push({ x: cx - rowW / 2 + col * (w + gap), y: top + r * (h + gap), w, h });
  }
  return { tiles, big };
}

/** TV-04 avatar rows (.tvrow): 104 dp tiles, 6 per row, gaps 24 × 10, rows centred; returns each tile's centre x and row. */
export function revealRow(n: number, cx: number, rtl: boolean, perRow = 6): { x: number; row: number }[] {
  const w = 104, gap = 24;
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / perRow), c = i % perRow;
    const inRow = Math.min(perRow, n - row * perRow);
    const rowW = inRow * w + (inRow - 1) * gap;
    const col = rtl ? inRow - 1 - c : c;
    return { x: cx - rowW / 2 + col * (w + gap) + w / 2, row };
  });
}

/**
 * TV-05 order strip (Kotlin OrderStrip via `orderWindow`): item centres, chevron centres and the "+n" counters, laid
 * from the inline start of a bar `width` wide that begins at `x0` (the DOM strip is a flex row from the start edge).
 */
export interface StripPlan { start: number; end: number; items: number[]; chevrons: number[]; before: number | null; after: number | null }
export function stripPlan(n: number, current: number, width: number, x0: number, rtl: boolean): StripPlan {
  const { item, chevron, more } = ORDER_STRIP;
  const win = orderWindow(n, Math.max(0, current), width);
  let cur = 0;
  const at = (w: number): number => { const c = cur + w / 2; cur += w; return rtl ? x0 + width - c : x0 + c; };
  const before = win.start > 0 ? at(more) : null;
  const items: number[] = [];
  const chevrons: number[] = [];
  for (let i = win.start; i < win.end; i++) {
    if (i > win.start && win.chevrons) chevrons.push(at(chevron));
    items.push(at(item));
  }
  const after = n - win.end > 0 ? at(more) : null;
  return { start: win.start, end: win.end, items, chevrons, before, after };
}

/** TV-09 random pick (Wheel): the lit seat after `el` of `dur` ms, three laps then landing on `target`. */
export function wheelIndex(el: number, dur: number, n: number, target: number): number {
  const m = Math.max(1, n);
  const steps = m * 3 + Math.max(0, target);
  const p = Math.min(1, Math.max(0, el / Math.max(1, dur)));
  return Math.floor((1 - Math.pow(1 - p, 3)) * steps) % m;
}

/** TV-09 role label: `clamp(22px, 130cqw / chars, 56px)` on the card's inner width (8 dp padding each side). */
export function cardLabelSize(cardW: number, label: string): number {
  const chars = Math.max(1, [...label].length);
  return Math.max(22, Math.min(56, (1.3 * (cardW - 16)) / chars));
}

/**
 * TV-11 scoreboard: with more rows than fit, the list glides (hold at the top, scroll down, hold, back up) instead of the
 * DOM's focus scroll (the Pixi rows are not D-pad stops). Returns the scroll offset in rows at `t` ms.
 */
export function sbScroll(t: number, rows: number, visible: number, holdMs = 2600, perRowMs = 700): number {
  const extra = rows - visible;
  if (extra <= 0) return 0;
  const move = extra * perRowMs;
  const cycle = 2 * (holdMs + move);
  const u = ((t % cycle) + cycle) % cycle;
  const ease = (x: number): number => x * x * (3 - 2 * x);
  if (u < holdMs) return 0;
  if (u < holdMs + move) return extra * ease((u - holdMs) / move);
  if (u < 2 * holdMs + move) return extra;
  return extra * (1 - ease((u - 2 * holdMs - move) / move));
}

/** Points along a rounded rectangle's outline split into dashes (the DOM's `border: dashed`): [x0, y0, x1, y1] each. */
export function dashedRoundRect(w: number, h: number, r: number, dash: number, gap: number): number[][] {
  const rr = Math.min(r, w / 2, h / 2);
  const straight = [w - 2 * rr, h - 2 * rr, w - 2 * rr, h - 2 * rr];
  const arc = (Math.PI / 2) * rr;
  const per = straight[0]! + arc + straight[1]! + arc + straight[2]! + arc + straight[3]! + arc;
  const point = (s: number): [number, number] => {
    let d = ((s % per) + per) % per;
    // top edge (left → right), top-right arc, right edge, bottom-right arc, bottom edge, bottom-left arc, left edge, top-left arc
    const segs: ((u: number) => [number, number])[] = [
      (u) => [rr + u, 0],
      (u) => { const a = -Math.PI / 2 + u / rr; return [w - rr + Math.cos(a) * rr, rr + Math.sin(a) * rr]; },
      (u) => [w, rr + u],
      (u) => { const a = u / rr; return [w - rr + Math.cos(a) * rr, h - rr + Math.sin(a) * rr]; },
      (u) => [w - rr - u, h],
      (u) => { const a = Math.PI / 2 + u / rr; return [rr + Math.cos(a) * rr, h - rr + Math.sin(a) * rr]; },
      (u) => [0, h - rr - u],
      (u) => { const a = Math.PI + u / rr; return [rr + Math.cos(a) * rr, rr + Math.sin(a) * rr]; },
    ];
    const lens = [straight[0]!, arc, straight[1]!, arc, straight[2]!, arc, straight[3]!, arc];
    for (let i = 0; i < 8; i++) {
      if (d <= lens[i]! || i === 7) return segs[i]!(Math.min(d, lens[i]!));
      d -= lens[i]!;
    }
    return [0, 0];
  };
  const n = Math.max(1, Math.round(per / (dash + gap)));
  const step = per / n;
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const s = i * step;
    const k = 4;
    const pts: number[] = [];
    for (let j = 0; j <= k; j++) { const [x, y] = point(s + (dash * j) / k); pts.push(x, y); }
    out.push(pts);
  }
  return out;
}
