// Taqriban! on the Pixi TV: the pure geometry (no Pixi, unit-tested in web-client/test/games/taqriban). Every number is
// the DOM /tv layout (games/taqriban/tv.css) in 960 × 540 design units, so both renderers put things in the same place.

export const W = 960;
export const H = 540;
/** The number line: always LTR (numbers grow to the right in every locale, GAME-TAQRIBAN §8.2). */
export const LINE_X0 = 72;
export const LINE_W = 816;
export const AXIS_Y = 340;
/** Safe-area edges (the 864 × 486 safe area of the 960 × 540 canvas). */
export const SAFE_X0 = 48;
export const SAFE_X1 = W - 48;

export const lineX = (x: number): number => LINE_X0 + x * LINE_W;
/** A guess disc's centre line for its lane (lane 0 sits just above the axis, up to 4 lanes). */
export const laneY = (lane: number): number => 310 - lane * 52;

/** The question font size (tv.css .tqbcard--l/m/s): 38 / 31 / 25 by length. */
export const qFont = (s: string): number => (s.length > 110 ? 25 : s.length > 70 ? 31 : 38);

/** Mirrors an x for RTL (the page's inline direction; the number line never mirrors). */
export const mx = (x: number, rtl: boolean): number => (rtl ? W - x : x);

/**
 * Centres of items laid out in one row (a flex row with `gap`, centred on `cx`): first item at the inline start, so in
 * RTL the first item is the rightmost.
 */
export function rowXs(widths: readonly number[], gap: number, cx: number, rtl: boolean): number[] {
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, widths.length - 1);
  let x = cx - total / 2;
  const out = widths.map((w) => { const c = x + w / 2; x += w + gap; return c; });
  return rtl ? out.map((c) => 2 * cx - c) : out;
}

/** Keeps a box of half-width `half` centred near `x` inside [lo, hi]. */
export function clampCenter(x: number, half: number, lo = SAFE_X0, hi = SAFE_X1): number {
  if (hi - lo < 2 * half) return (lo + hi) / 2;
  return Math.min(hi - half, Math.max(lo + half, x));
}

/**
 * Name + value tags that would overlap in one lane move apart (the DOM lets them collide): overlapping tags merge into
 * a group centred on its members' own x, laid out side by side with `gap`, then kept inside [lo, hi]. Returns each
 * tag's centre, in input order.
 */
export function spreadTags(tags: readonly { x: number; w: number; lane: number }[], gap = 6, lo = SAFE_X0 - 24, hi = SAFE_X1 + 24): number[] {
  const out = tags.map((t) => t.x);
  const lanes = new Map<number, number[]>();
  tags.forEach((t, i) => { const l = lanes.get(t.lane) ?? []; l.push(i); lanes.set(t.lane, l); });
  for (const idx of lanes.values()) {
    idx.sort((a, b) => tags[a]!.x - tags[b]!.x);
    type G = { items: number[]; width: number; want: number };
    const groups: G[] = [];
    const left = (g: G): number => Math.min(hi - g.width, Math.max(lo, g.want / g.items.length - g.width / 2));
    for (const i of idx) {
      groups.push({ items: [i], width: tags[i]!.w, want: tags[i]!.x });
      // merge while the last group overlaps the one before it
      while (groups.length > 1) {
        const b = groups[groups.length - 1]!, a = groups[groups.length - 2]!;
        if (left(a) + a.width + gap <= left(b)) break;
        groups.splice(-2, 2, { items: [...a.items, ...b.items], width: a.width + gap + b.width, want: a.want + b.want });
      }
    }
    for (const g of groups) {
      let x = left(g);
      for (const i of g.items) { out[i] = x + tags[i]!.w / 2; x += tags[i]!.w + gap; }
    }
  }
  return out;
}

/** The cast row (tv.css .tqbcast: 88 dp slots shrinking to fit 864 dp, gap 10; characters 80, or 56 above 8 players). */
export function castLayout(n: number, rtl: boolean): { size: number; slot: number; xs: number[] } {
  const size = n > 8 ? 56 : 80;
  const slot = n > 0 ? Math.min(88, (SAFE_X1 - SAFE_X0 - 10 * (n - 1)) / n) : 88;
  return { size, slot, xs: rowXs(Array.from({ length: n }, () => slot), 10, W / 2, rtl) };
}

/**
 * The standings list (tv.css .tqbboard: top 116, bottom 40, rows 46 / 30 compact, gap 8, vertically centred). Twelve
 * compact rows do not fit in 384 dp (the DOM list spills over the title): here the gap and then the rows tighten.
 */
export function boardGeom(n: number): { compact: boolean; h: number; slotY(i: number): number } {
  const compact = n > 8;
  const top = 116, bottom = H - 40, avail = bottom - top, gaps = Math.max(0, n - 1);
  let h = compact ? 30 : 46, gap = 8;
  if (n * h + gaps * gap > avail) gap = 4;
  if (n * h + gaps * gap > avail) h = (avail - gaps * gap) / n;
  const total = n * h + gaps * gap;
  const y0 = top + (bottom - top - total) / 2;
  return { compact, h, slotY: (i) => y0 + i * (h + gap) + h / 2 };
}

/**
 * The columns of one standings row in LTR coordinates (tv.css grid: rank, character, name, bar, "n won", score; padding
 * 12 inside x 96..864). Callers mirror with `mx` in RTL. `wonW` is the widest "n won" label.
 */
export function boardCols(compact: boolean, wonW: number): { rank: number; char: number; name: number; nameW: number; bar: number; barW: number; wonEnd: number; scoreEnd: number } {
  const x0 = 96 + 12, x1 = W - 96 - 12;
  const [rankW, charW, nameW, scoreW, gap] = compact ? [30, 32, 150, 70, 10] : [34, 44, 170, 76, 12];
  const rank = x0 + rankW / 2;
  const char = x0 + rankW + gap + charW / 2;
  const name = x0 + rankW + gap + charW + gap;
  const bar = name + nameW + gap;
  const wonEnd = x1 - scoreW - gap;
  const barW = Math.max(40, wonEnd - wonW - gap - bar);
  return { rank, char, name, nameW, bar, barW, wonEnd, scoreEnd: x1 };
}

/** Rows in the previous board's order (rank before this question, then seat): where each row glides from. */
export function previousOrder<T extends { seat: number; row: { rankBefore: number | null } }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.row.rankBefore ?? 99) - (b.row.rankBefore ?? 99) || a.seat - b.seat);
}

/** A bar's fill fraction (never quite empty, as the DOM's scaleX floor). */
export const barFrac = (score: number, max: number): number => Math.max(0.02, max > 0 ? score / max : 0);

/** The winner's peak-and-settle scale (tv.css tqb-win: 1 → 1.3 at half → 1.15). */
export function winScale(q: number): number {
  const u = Math.max(0, Math.min(1, q));
  return u < 0.5 ? 1 + 0.6 * u : 1.3 - 0.3 * (u - 0.5);
}
