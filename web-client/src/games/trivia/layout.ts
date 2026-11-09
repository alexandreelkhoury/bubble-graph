// GAME-TRIVIA §12.7 / DESIGN-JAMAA §7.9: the TV studio's fixed geometry on the 960 × 540 dp canvas. Every moving
// piece (characters jumping onto tiles, coins flying to the tower, the bulb ring) uses these precomputed numbers, never
// a DOM measurement, so the browser TV and the Compose TV (lane C) can share one set of coordinates. Pure; unit-tested.
import type { Step } from "@jamaa/shared/motion";

export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

export const CANVAS = { w: 960, h: 540 } as const;
/** The leaderboard tower (end side; the start side in RTL, DESIGN-JAMAA §7.9). */
export const TOWER_W = 196;
const EDGE = 28;
const GAP = 16;
export const CARD_Y = 66;
export const CARD_H = 106;
export const TILE_Y = 184;
export const TILE_H = 104;
export const TILE_GAP = 10;
/** Podium row: characters stand on podiums along the bottom of the stage. */
export const PODIUM_TOP = 414;
export const PODIUM_CHAR = 56;
export const TOWER_ROW_H = 34;
export const TOWER_ROW_GAP = 3;
export const TOWER_HEAD = 34;
/** Rows shown in the tower; more players page every 2 s (§6 "TV pages the rest in 2 s"). */
export const TOWER_ROWS = 8;
export const CROWD_CHAR = 40;
export const CROWD_PER_ROW = 6;

/** The main column (question card + tiles), beside the tower. */
export function mainRect(rtl: boolean): Rect {
  const w = CANVAS.w - 2 * EDGE - TOWER_W - GAP;
  return { x: rtl ? EDGE + TOWER_W + GAP : EDGE, y: CARD_Y, w, h: TILE_Y + 2 * TILE_H + TILE_GAP - CARD_Y };
}
export function towerRect(rtl: boolean): Rect {
  return { x: rtl ? EDGE : CANVAS.w - EDGE - TOWER_W, y: CARD_Y, w: TOWER_W, h: TILE_Y + 2 * TILE_H + TILE_GAP - CARD_Y };
}
export function cardRect(rtl: boolean): Rect {
  const m = mainRect(rtl);
  return { x: m.x, y: CARD_Y, w: m.w, h: CARD_H };
}

/**
 * §8.2: tile `i` (displayed position). mc4 is a 2 × 2 grid A top-left, B top-right, C bottom-left, D bottom-right; tf is
 * two tall tiles, True left and False right. **Never mirrored in RTL**: the grid sits in the main column, which moves
 * with the tower, but the tiles keep their left-to-right order on every device.
 */
export function tileRect(i: number, type: "mc4" | "tf", rtl: boolean): Rect {
  const m = mainRect(rtl);
  const w = (m.w - TILE_GAP) / 2;
  const col = i % 2;
  if (type === "tf") return { x: m.x + col * (w + TILE_GAP), y: TILE_Y, w, h: 2 * TILE_H + TILE_GAP };
  const row = Math.floor(i / 2);
  return { x: m.x + col * (w + TILE_GAP), y: TILE_Y + row * (TILE_H + TILE_GAP), w, h: TILE_H };
}

/** The bulb ring (§12.2): `n` bulbs evenly spaced around the question card's edge, clockwise from the top-left corner
 *  (the same order in every locale: they go dark one by one, clockwise). */
export function bulbs(rect: Rect, n = 20, inset = -8): Pt[] {
  const r = { x: rect.x + inset, y: rect.y + inset, w: rect.w - 2 * inset, h: rect.h - 2 * inset };
  const per = 2 * (r.w + r.h);
  const out: Pt[] = [];
  for (let k = 0; k < n; k++) {
    let d = (k / n) * per;
    if (d < r.w) { out.push({ x: r.x + d, y: r.y }); continue; }
    d -= r.w;
    if (d < r.h) { out.push({ x: r.x + r.w, y: r.y + d }); continue; }
    d -= r.h;
    if (d < r.w) { out.push({ x: r.x + r.w - d, y: r.y + r.h }); continue; }
    d -= r.w;
    out.push({ x: r.x, y: r.y + r.h - d });
  }
  return out;
}

/** How many bulbs are still lit: the ring empties with the server deadline (ceil, so the last bulb holds to 0). */
export function bulbsLit(leftMs: number, durationMs: number, n = 20): number {
  if (durationMs <= 0) return 0;
  return Math.max(0, Math.min(n, Math.ceil((leftMs / durationMs) * n)));
}

/** Podium slot centres for `count` characters along the bottom (seat order; reading order mirrors in RTL). */
export function podiumSlots(count: number, rtl: boolean): Pt[] {
  const span = CANVAS.w - 2 * EDGE;
  const step = Math.min(120, span / Math.max(1, count));
  const total = step * count;
  const x0 = EDGE + (span - total) / 2 + step / 2;
  return Array.from({ length: count }, (_, i) => {
    const k = rtl ? count - 1 - i : i;
    return { x: x0 + k * step, y: PODIUM_TOP + PODIUM_CHAR / 2 };
  });
}

/**
 * Where the k-th character choosing a tile lands (§12.3 jump-on): a crowd along the tile's bottom edge, 6 per row,
 * the second row standing 16 dp behind and higher (12 on one tile fit). Returns the character's CENTRE.
 */
export function crowdSlot(tile: Rect, k: number, of: number): Pt {
  const row = Math.floor(k / CROWD_PER_ROW);
  const inRow = Math.min(CROWD_PER_ROW, of - row * CROWD_PER_ROW);
  const col = k % CROWD_PER_ROW;
  const step = Math.min(50, (tile.w - 24) / CROWD_PER_ROW);
  const rowW = step * (inRow - 1);
  // The crowd sits at the tile's end side of the bottom edge, so the answer text (start side, top) stays readable.
  const xEnd = tile.x + tile.w - 14 - CROWD_CHAR / 2;
  return { x: xEnd - rowW + col * step - (row === 1 ? step / 2 : 0), y: tile.y + tile.h - CROWD_CHAR / 2 - 6 - row * 16 };
}

/** Tower row pitch: 8 comfortable rows; 9–12 players switch to compact rows so everyone stays on screen. */
export function towerRowH(count: number): { h: number; gap: number } {
  return count <= TOWER_ROWS ? { h: TOWER_ROW_H, gap: TOWER_ROW_GAP } : { h: 22, gap: 2 };
}
/** The tower as drawn: as tall as its rows need (never taller than the column). */
export function towerBox(rtl: boolean, count: number): Rect {
  const t = towerRect(rtl);
  const { h, gap } = towerRowH(count);
  return { ...t, h: Math.min(t.h, TOWER_HEAD + count * (h + gap) + 8) };
}
/** The tower row of the player at `index` (coins land on its score). */
export function towerRowRect(index: number, rtl: boolean, count = TOWER_ROWS): Rect {
  const t = towerRect(rtl);
  const { h, gap } = towerRowH(count);
  return { x: t.x + 8, y: t.y + TOWER_HEAD + index * (h + gap), w: t.w - 16, h };
}
/** The coin target: the score badge at the row's end. */
export function towerScorePoint(index: number, rtl: boolean, count = TOWER_ROWS): Pt {
  const r = towerRowRect(index, rtl, count);
  return { x: rtl ? r.x + 34 : r.x + r.w - 34, y: r.y + r.h / 2 };
}

/** DESIGN-JAMAA §5.1 coin path: a quadratic Bézier with its control point 90 dp above the chord midpoint (below it
 *  when both ends are in the top half). */
export function coinPoint(a: Pt, b: Pt, p: number): Pt {
  const top = a.y < CANVAS.h / 2 && b.y < CANVAS.h / 2;
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + (top ? 90 : -90) };
  const u = 1 - p;
  return { x: u * u * a.x + 2 * u * p * c.x + p * p * b.x, y: u * u * a.y + 2 * u * p * c.y + p * p * b.y };
}

/** A hop from `a` to `b`: linear in x, a 100 dp arc in y (§5.4 "100 dp arcs"). `p` may overshoot 1 (spring landing). */
export function hopPoint(a: Pt, b: Pt, p: number, arc = 100): Pt {
  const q = Math.min(1, Math.max(0, p));
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p - arc * Math.sin(Math.PI * q) };
}

// ---------- the reveal timeline (GAME-TRIVIA §12.3; staging DESIGN-JAMAA §5.4) ----------

const S = (id: string, startMs: number, durationMs: number, easing: Step["easing"], staggerMs?: number): Step =>
  ({ id, startMs, durationMs, easing, ...(staggerMs === undefined ? {} : { staggerMs }), reduced: "skip", lite: "keep" });

/** REVEAL 6 s: Time! → wrong out → jump-on → fastest finger → points fly → tower re-sort. Runs on the shared sampler. */
export const REVEAL_STEPS: readonly Step[] = [
  S("time", 0, 300, "ease.overshoot"),
  S("out", 300, 600, "ease.accel"),
  S("spin", 300, 500, "ease.standard"),
  S("jump", 900, 420, "spring.hop", 60),
  S("bolt", 2400, 600, "ease.overshoot"),
  S("coin", 3000, 450, "ease.coin", 70),
  S("counter", 3450, 600, "ease.decel"),
  S("sort", 4500, 400, "ease.standard"),
];
/** The steps a reveal actually runs (stagger depends on the character/coin count: at most 12 each). */
export const REVEAL_END_MS = 4900;
/** The "Did you know?" card slides up after the 6 s script (+3 s, §4.1). */
export const EXPLAIN_AT_MS = 5200;

/** LEADERBOARD race (§12.4): bars grow 1.2 s (odometers), then re-sort with a spring, crown and climber arrow. */
export const BOARD_STEPS: readonly Step[] = [
  S("grow", 200, 1200, "ease.decel"),
  S("sort", 1500, 520, "spring.bouncy"),
  S("crown", 2100, 360, "ease.overshoot"),
  S("climb", 2300, 400, "ease.overshoot"),
];

/** RESULTS podium (§12.5): characters jump onto steps 3, 2, 1 (in that order), the trophy, then the stat cards. */
export const PODIUM_STEPS: readonly Step[] = [
  S("steps", 0, 500, "ease.decel"),
  S("hop3", 500, 520, "spring.bouncy"),
  S("hop2", 900, 520, "spring.bouncy"),
  S("hop1", 1350, 620, "spring.bouncy"),
  S("trophy", 1900, 400, "ease.overshoot"),
  S("stats", 2300, 360, "ease.decel", 220),
];
