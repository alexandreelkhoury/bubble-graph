// GAME-LIKELY §12.7 / DESIGN-JAMAA §6.4.3 "one layout math": the jury arc and the reveal conga lines, as pure functions
// in TV dp (the 864 × 486 safe area). The /tv mock uses them directly; the Kotlin TV mirrors them and both sides assert
// the same fixture (shared/fixtures/v2/games/likely/layout.json). Zod-free, engine-free, no Math.random.
//
// Kotlin parity notes: every coordinate is rounded with `r1` = Math.round(v * 10) / 10 (JS Math.round is floor(v + 0.5),
// which is what Kotlin's `kotlin.math.floor(v * 10 + 0.5) / 10` gives); trigonometry uses degrees converted with
// `deg * PI / 180`; nothing else is floating-point sensitive.

export interface LikelyPt { x: number; y: number }

export const LIKELY_STAGE = {
  width: 864,
  height: 486,
  /** Feet line of the jury arc at its centre. */
  arcY: 336,
  /** How much higher the two ends of the arc sit than its centre (a gentle smile). */
  arcLift: 28,
  /** Character box (dp); 12 characters at 72 dp fit the 792 dp spread. */
  charSize: 72,
  maxSpread: 792,
  maxStep: 104,
  /** Conga: the first 6 runners stand in a diagonal line behind the target, sideways and slightly up. 44 dp against a
   *  72 dp character keeps each runner's face clear of the one in front (G3 review: 30 dp hid ~58 % of it). */
  congaDx: 44,
  congaDy: -16,
  congaStraight: 6,
  /** After 6 the line curls: a shrinking spiral around a point above the 6th runner. */
  curlRadius: 40,
  curlShrink: 3,
  curlStepDeg: 52,
} as const;

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Seat-order positions of n characters on the jury arc (centre of the feet). RTL: seat 0 is on the right. */
export function likelyJuryArc(n: number, rtl = false): LikelyPt[] {
  const S = LIKELY_STAGE;
  if (n <= 0) return [];
  const cx = S.width / 2;
  const step = n > 1 ? Math.min(S.maxStep, S.maxSpread / (n - 1)) : 0;
  const half = (step * (n - 1)) / 2;
  const out: LikelyPt[] = [];
  for (let i = 0; i < n; i++) {
    const dx = -half + i * step;
    const u = half > 0 ? dx / half : 0;
    const x = rtl ? cx - dx : cx + dx;
    out.push({ x: r1(x), y: r1(S.arcY - S.arcLift * u * u) });
  }
  return out;
}

/** The x range a character's centre may take: its whole 72 dp box stays inside the 864 dp safe area. */
export const LIKELY_CONGA_MIN_X = LIKELY_STAGE.charSize / 2;
export const LIKELY_CONGA_MAX_X = LIKELY_STAGE.width - LIKELY_STAGE.charSize / 2;

/** How far sideways a straight line of `count` runners reaches from its target. */
const reach = (count: number): number => LIKELY_STAGE.congaDx * Math.min(Math.max(count, 1), LIKELY_STAGE.congaStraight);
const fits = (target: LikelyPt, side: 1 | -1, count: number): boolean => {
  const x = target.x + side * reach(count);
  return x >= LIKELY_CONGA_MIN_X && x <= LIKELY_CONGA_MAX_X;
};

/**
 * The side a line of `count` runners grows on: away from the stage centre (+1 right of centre, -1 otherwise), unless
 * that would leave the safe area while the other side fits (an outer seat then lines up toward the centre).
 */
export function likelyCongaSide(target: LikelyPt, count = 1): 1 | -1 {
  const out: 1 | -1 = target.x >= LIKELY_STAGE.width / 2 ? 1 : -1;
  if (fits(target, out, count) || !fits(target, (-out) as 1 | -1, count)) return out;
  return (-out) as 1 | -1;
}

/**
 * The k-th place (k ≥ 1) behind `target` in its conga line. Places 1..6 run diagonally sideways and up; from 7 on they
 * curl into a spiral around a point above place 6, turning away from the target. A place that would leave the safe
 * area is pinned to its edge and climbs instead (1 dp up per dp of overflow), so nobody walks off the stage. Mirroring
 * the target mirrors every place (the side follows the target), so RTL needs no extra flag.
 */
export function likelyCongaSlot(target: LikelyPt, k: number, side: 1 | -1 = likelyCongaSide(target)): LikelyPt {
  const S = LIKELY_STAGE;
  let x: number;
  let y: number;
  if (k <= S.congaStraight) {
    x = target.x + side * S.congaDx * k;
    y = target.y + S.congaDy * k;
  } else {
    const p6 = { x: target.x + side * S.congaDx * S.congaStraight, y: target.y + S.congaDy * S.congaStraight };
    const c = { x: p6.x, y: p6.y - S.curlRadius };
    const j = k - S.congaStraight;                          // 1, 2, …
    const radius = Math.max(8, S.curlRadius - S.curlShrink * j);
    // Angle 90° points down (screen y grows downward): place 6 sits at 90°; the curl turns outward, then up and back.
    const deg = 90 - side * S.curlStepDeg * j;
    const rad = (deg * Math.PI) / 180;
    x = c.x + radius * Math.cos(rad);
    y = c.y + radius * Math.sin(rad);
  }
  const over = x < LIKELY_CONGA_MIN_X ? LIKELY_CONGA_MIN_X - x : x > LIKELY_CONGA_MAX_X ? x - LIKELY_CONGA_MAX_X : 0;
  if (over > 0) {
    x = x < LIKELY_CONGA_MIN_X ? LIKELY_CONGA_MIN_X : LIKELY_CONGA_MAX_X;
    y -= over;
  }
  return { x: r1(x), y: r1(y) };
}

/** Places 1..count behind `target`. */
export function likelyConga(target: LikelyPt, count: number, side: 1 | -1 = likelyCongaSide(target, count)): LikelyPt[] {
  const out: LikelyPt[] = [];
  for (let k = 1; k <= count; k++) out.push(likelyCongaSlot(target, k, side));
  return out;
}

/**
 * The side of every line in a reveal (`lines`: target id → runners, in any order; `at`: target id → arc position).
 * Each line first takes `likelyCongaSide`. Then, left to right, two neighbouring lines that would run into each other
 * (one grows toward the other and reaches it) are turned apart: the left one turns left and the right one turns right,
 * each only where it still fits the safe area. Ties of neighbours therefore fan out instead of crossing.
 */
export function likelyCongaSides(lines: ReadonlyMap<string, number>, at: ReadonlyMap<string, LikelyPt>): Map<string, 1 | -1> {
  const half = LIKELY_STAGE.charSize / 2;
  const ids = [...lines.keys()].filter((id) => at.has(id) && (lines.get(id) ?? 0) > 0)
    .sort((a, b) => (at.get(a) as LikelyPt).x - (at.get(b) as LikelyPt).x || (a < b ? -1 : a > b ? 1 : 0));
  const side = new Map<string, 1 | -1>(ids.map((id) => [id, likelyCongaSide(at.get(id) as LikelyPt, lines.get(id) as number)]));
  for (let i = 1; i < ids.length; i++) {
    const a = ids[i - 1] as string;
    const b = ids[i] as string;
    const pa = at.get(a) as LikelyPt;
    const pb = at.get(b) as LikelyPt;
    const ca = lines.get(a) as number;
    const cb = lines.get(b) as number;
    const gap = pb.x - pa.x - half;
    const clash = (side.get(a) === 1 && reach(ca) >= gap) || (side.get(b) === -1 && reach(cb) >= gap);
    if (!clash) continue;
    if (side.get(a) === 1 && fits(pa, -1, ca)) side.set(a, -1);
    if (side.get(b) === -1 && fits(pb, 1, cb)) side.set(b, 1);
  }
  return side;
}

/**
 * Public-mode reveal (GAME-LIKELY §12.2 step 2): where each voter's character ends. `seatIds` are the jury arc's ids in
 * seat order (same length as `arc`); `ballots` come in voter seat order (as the view sends them). A self-voter stays in
 * its seat (`pointSelf`); every other voter joins the line behind its target in ballot order, on the side chosen by
 * `likelyCongaSides`. Unknown ids are skipped.
 */
export function likelyRevealPositions(arc: readonly LikelyPt[], seatIds: readonly string[], ballots: readonly { voterId: string; targetId: string }[]): Record<string, LikelyPt> {
  const at = new Map<string, LikelyPt>();
  seatIds.forEach((id, i) => {
    const p = arc[i];
    if (p) at.set(id, p);
  });
  const lines = new Map<string, number>();
  for (const b of ballots) if (b.voterId !== b.targetId && at.has(b.voterId) && at.has(b.targetId)) lines.set(b.targetId, (lines.get(b.targetId) ?? 0) + 1);
  const sides = likelyCongaSides(lines, at);
  const lineLen = new Map<string, number>();
  const out: Record<string, LikelyPt> = {};
  for (const b of ballots) {
    const target = at.get(b.targetId);
    const seat = at.get(b.voterId);
    if (!target || !seat) continue;
    if (b.voterId === b.targetId) {
      out[b.voterId] = { x: seat.x, y: seat.y };
      continue;
    }
    const k = (lineLen.get(b.targetId) ?? 0) + 1;
    lineLen.set(b.targetId, k);
    out[b.voterId] = likelyCongaSlot(target, k, sides.get(b.targetId) ?? likelyCongaSide(target));
  }
  return out;
}
