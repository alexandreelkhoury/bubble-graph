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
  /** Conga: the first 6 runners stand in a diagonal line behind the target, outward and slightly up. */
  congaDx: 30,
  congaDy: -12,
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

/** +1 when the line grows to the right of its target (targets right of centre), -1 otherwise: lines curl outward. */
export function likelyCongaSide(target: LikelyPt): 1 | -1 {
  return target.x >= LIKELY_STAGE.width / 2 ? 1 : -1;
}

/**
 * The k-th place (k ≥ 1) behind `target` in its conga line. Places 1..6 run diagonally outward and up; from 7 on they
 * curl into a spiral around a point above place 6, turning away from the stage centre. Mirroring the target mirrors
 * every place (the side follows the target), so RTL needs no extra flag.
 */
export function likelyCongaSlot(target: LikelyPt, k: number, side: 1 | -1 = likelyCongaSide(target)): LikelyPt {
  const S = LIKELY_STAGE;
  if (k <= S.congaStraight) return { x: r1(target.x + side * S.congaDx * k), y: r1(target.y + S.congaDy * k) };
  const p6 = { x: target.x + side * S.congaDx * S.congaStraight, y: target.y + S.congaDy * S.congaStraight };
  const c = { x: p6.x, y: p6.y - S.curlRadius };
  const j = k - S.congaStraight;                          // 1, 2, …
  const radius = Math.max(8, S.curlRadius - S.curlShrink * j);
  // Angle 90° points down (screen y grows downward): place 6 sits at 90°; the curl turns outward, then up and back.
  const deg = 90 - side * S.curlStepDeg * j;
  const rad = (deg * Math.PI) / 180;
  return { x: r1(c.x + radius * Math.cos(rad)), y: r1(c.y + radius * Math.sin(rad)) };
}

/** Places 1..count behind `target`. */
export function likelyConga(target: LikelyPt, count: number): LikelyPt[] {
  const side = likelyCongaSide(target);
  const out: LikelyPt[] = [];
  for (let k = 1; k <= count; k++) out.push(likelyCongaSlot(target, k, side));
  return out;
}

/**
 * Public-mode reveal (GAME-LIKELY §12.2 step 2): where each voter's character ends. `seatIds` are the jury arc's ids in
 * seat order (same length as `arc`); `ballots` come in voter seat order (as the view sends them). A self-voter stays in
 * its seat (`pointSelf`); every other voter joins the line behind its target in ballot order. Unknown ids are skipped.
 */
export function likelyRevealPositions(arc: readonly LikelyPt[], seatIds: readonly string[], ballots: readonly { voterId: string; targetId: string }[]): Record<string, LikelyPt> {
  const at = new Map(seatIds.map((id, i) => [id, arc[i]]));
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
    out[b.voterId] = likelyCongaSlot(target, k);
  }
  return out;
}
