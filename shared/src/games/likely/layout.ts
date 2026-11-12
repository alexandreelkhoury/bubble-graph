// GAME-LIKELY §12.2 / §12.7 and DESIGN-JAMAA §6.4.3 "one layout math": where the card, the players and the votes stand
// on the TV, as pure functions in stage units (the 864 × 442 area under the 44 dp game header, inside the 864 × 486 safe
// area; 1 unit = 1 dp on a 960 × 540 dp TV). The /tv mock uses them directly; the Kotlin TV mirrors them and both sides
// assert the same fixture (shared/fixtures/v2/games/likely/layout.json). Zod-free, engine-free, no Math.random.
//
// The composition is centred and symmetric (owner decision 2026-11-12: no left/right split): the card on top, the players
// as ONE row of characters, and in the reveal each player's voters stack under them as small tokens, one by one.
//
// Kotlin parity notes: every coordinate is rounded with `r1` = Math.round(v * 10) / 10 (JS Math.round is floor(v + 0.5),
// which is what Kotlin's `kotlin.math.floor(v * 10 + 0.5) / 10` gives); nothing else is floating-point sensitive.

export interface LikelyPt { x: number; y: number }

export const LIKELY_STAGE = {
  width: 864,
  height: 442,
  /** CARD / VOTING: the card, centred at the top. */
  cardTop: 8,
  cardWidth: 700,
  cardHeight: 236,
  /** REVEAL: the card shrinks around its top centre to this scale (it stays readable; the award banner repeats it big). */
  cardRevealScale: 0.5,
  /** CARD / VOTING: feet line of the player row at its centre, and how much higher its two ends sit (a gentle smile). */
  rowY: 374,
  rowLift: 14,
  /** Character box in CARD / VOTING, and in the reveal row. */
  charSize: 72,
  revealChar: 64,
  /** The row spreads at most this wide (centre to centre), at most `maxStep` between neighbours. */
  maxSpread: 792,
  maxStep: 150,
  /** REVEAL: the result banner (award / chaos / no votes) between the shrunk card and the row. */
  bannerY: 146,
  /** REVEAL: feet line of the (flat) player row; the names sit under the feet. */
  revealRowY: 240,
  /** REVEAL: the voters' tokens stack under their target between these lines. */
  stackTop: 276,
  stackBottom: 442,
  /** Token cell size bounds and the most tokens side by side in one stack. */
  cellMax: 44,
  cellMin: 22,
  stackColsMax: 3,
} as const;

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Distance between two neighbours of a row of n characters. */
export function likelyRowStep(n: number): number {
  const S = LIKELY_STAGE;
  return n > 1 ? Math.min(S.maxStep, S.maxSpread / (n - 1)) : S.maxStep;
}

/**
 * Seat-order positions (centre of the feet) of n characters in one centred row. CARD / VOTING: a gentle arc at `rowY`;
 * REVEAL (`reveal`): flat at `revealRowY`. RTL: seat 0 is on the right.
 */
export function likelyRow(n: number, rtl = false, reveal = false): LikelyPt[] {
  const S = LIKELY_STAGE;
  if (n <= 0) return [];
  const cx = S.width / 2;
  const step = likelyRowStep(n);
  const half = (step * (n - 1)) / 2;
  const out: LikelyPt[] = [];
  for (let i = 0; i < n; i++) {
    const dx = -half + i * step;
    const u = half > 0 ? dx / half : 0;
    const x = rtl ? cx - dx : cx + dx;
    out.push({ x: r1(x), y: r1(reveal ? S.revealRowY : S.rowY - S.rowLift * u * u) });
  }
  return out;
}

/** The token grid of a reveal: `cols` tokens side by side, `cell` units per token (one size for every stack). */
export interface LikelyStackGrid { cols: number; cell: number }

/**
 * The grid for a room of `n` players whose biggest stack holds `maxCount` tokens: as many columns as the row step
 * allows (≤ 3, cells ≥ 30 wide), never more than the biggest stack needs; the cell is as big as fits the step, the
 * stage edges and the stack zone's height (≤ 44), so every stack stays in its column and on the stage.
 */
export function likelyStackGrid(n: number, maxCount: number): LikelyStackGrid {
  const S = LIKELY_STAGE;
  const step = likelyRowStep(n);
  const colsMax = Math.max(1, Math.min(S.stackColsMax, Math.floor(step / 30)));
  const m = Math.max(1, maxCount);
  const cols = Math.min(colsMax, m);
  const rows = Math.ceil(m / cols);
  // The outermost stacks stay on the stage: half the row's spread plus half a stack ≤ half the stage width.
  const edge = (2 * (S.width / 2 - (step * (Math.max(1, n) - 1)) / 2)) / cols;
  const cell = Math.max(S.cellMin, Math.min(S.cellMax, (step - 4) / cols, edge, (S.stackBottom - S.stackTop) / rows));
  return { cols, cell: Math.floor(cell * 10) / 10 };   // rounded down: the stacks never outgrow their bounds
}

/**
 * The centre of the k-th token (k ≥ 0, in arrival order) of a stack of `count` under `target` (its feet point). Tokens
 * fill rows top-down, each row centred under the target, in the reading direction (RTL: the first token on the right).
 */
export function likelyStackSlot(target: LikelyPt, k: number, count: number, grid: LikelyStackGrid, rtl = false): LikelyPt {
  const S = LIKELY_STAGE;
  const row = Math.floor(k / grid.cols);
  const col = k % grid.cols;
  const inRow = Math.min(grid.cols, count - row * grid.cols);
  const dx = (col - (inRow - 1) / 2) * grid.cell * (rtl ? -1 : 1);
  return { x: r1(target.x + dx), y: r1(S.stackTop + row * grid.cell + grid.cell / 2) };
}

/** One token of the reveal: a vote landing under its target (`voterId` null in secret mode: an anonymous envelope). */
export interface LikelyToken { voterId: string | null; targetId: string; k: number; at: LikelyPt }

/**
 * Public mode (GAME-LIKELY §12.2): every ballot becomes a token in the voter's colours under its target, in ballot order
 * (voter seat order, as the view sends them), self-votes included. Unknown ids are skipped. `ids` / `row` are the reveal
 * row in seat order.
 */
export function likelyPublicTokens(row: readonly LikelyPt[], ids: readonly string[], ballots: readonly { voterId: string; targetId: string }[], rtl = false): LikelyToken[] {
  const at = new Map<string, LikelyPt>();
  ids.forEach((id, i) => { const p = row[i]; if (p) at.set(id, p); });
  const valid = ballots.filter((b) => at.has(b.voterId) && at.has(b.targetId));
  const count = new Map<string, number>();
  for (const b of valid) count.set(b.targetId, (count.get(b.targetId) ?? 0) + 1);
  const grid = likelyStackGrid(ids.length, Math.max(0, ...count.values()));
  const seen = new Map<string, number>();
  return valid.map((b) => {
    const k = seen.get(b.targetId) ?? 0;
    seen.set(b.targetId, k + 1);
    return { voterId: b.voterId, targetId: b.targetId, k, at: likelyStackSlot(at.get(b.targetId) as LikelyPt, k, count.get(b.targetId) as number, grid, rtl) };
  });
}

/**
 * Secret votes: one anonymous envelope per vote, from the per-card TALLY only (`counts` gives each target's votes), so two games with the same tallies draw the same picture whoever voted for whom.
 */
export function likelySecretTokens(row: readonly LikelyPt[], ids: readonly string[], counts: readonly { playerId: string; count: number }[], rtl = false): LikelyToken[] {
  const at = new Map<string, LikelyPt>();
  ids.forEach((id, i) => { const p = row[i]; if (p) at.set(id, p); });
  const by = new Map(counts.filter((c) => at.has(c.playerId) && c.count > 0).map((c) => [c.playerId, c.count]));
  const grid = likelyStackGrid(ids.length, Math.max(0, ...by.values()));
  // Round-robin (every target's 1st envelope, then every 2nd…): the stacks grow side by side, the suspense holds.
  const out: LikelyToken[] = [];
  const most = Math.max(0, ...by.values());
  for (let k = 0; k < most; k++) for (const id of ids) {
    const c = by.get(id) ?? 0;
    if (k < c) out.push({ voterId: null, targetId: id, k, at: likelyStackSlot(at.get(id) as LikelyPt, k, c, grid, rtl) });
  }
  return out;
}
