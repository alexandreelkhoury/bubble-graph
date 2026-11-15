// GAME-TAQRIBAN §8: the pure view model both Taqriban surfaces read (phone `game-taqriban`, /tv
// `tv-mock-game-taqriban`): the keypad entry, number words, and the number-line layout. Zod-free, DOM-free, unit-tested
// (web-client/test/games/taqriban). Everything derives from the public projection plus this phone's own `me`.
import type { GameEnvelope, PlayerRoomView, RoomPublic, TvRoomView } from "@jamaa/shared/protocol/v2";
import { compactParts, GUESS_MAX, groupDigits, MAGNITUDES, validGuess } from "@jamaa/shared/games/taqriban/meta";
export { groupDigits };
import type { MagnitudeId } from "@jamaa/shared/games/taqriban/meta";
import { t } from "../../i18n/t";
import type { MessageKey } from "../../i18n/t";

type Env = Extract<GameEnvelope, { gameId: "taqriban" }>;
export type TaqPub = Env["public"];
export type TaqMe = NonNullable<Env["me"]>;
export type ScoreRow = TaqPub["scores"][number];
export type Reveal = NonNullable<TaqPub["reveal"]>;
export type Member = RoomPublic["members"][number];
export type { MagnitudeId };

export interface Taq { pub: TaqPub; me: TaqMe | null; n: number; over: boolean }
const of = (g: GameEnvelope | null): Taq | null => (g && g.gameId === "taqriban" ? { pub: g.public, me: g.me, n: g.n, over: g.over } : null);
export const taqOfPhone = (v: PlayerRoomView): Taq | null => of(v.game);
export const taqOfTv = (v: TvRoomView): Taq | null => of(v.game);

export const K = "game.taqriban";
export const tk = (k: string, p?: Record<string, string | number>): string => t(`${K}.${k}` as MessageKey, p);

export interface Player { id: string; name: string; color: Member["color"]; seat: number; connected: boolean; row: ScoreRow }

/** Every scored player in seat order (a member the room dropped keeps a neutral identity). */
export function playersOf(room: RoomPublic, pub: TaqPub): Player[] {
  const by = new Map(room.members.map((m) => [m.id, m]));
  return pub.scores.map((row) => {
    const m = by.get(row.playerId);
    return { id: row.playerId, name: m?.name ?? "", color: m?.color ?? "lilac", seat: m?.seat ?? 99, connected: !!m?.connected && !row.left, row };
  }).sort((a, b) => a.seat - b.seat);
}

/** Players by score (rank, then seat): the leaderboard order. */
export const ranked = (ps: readonly Player[]): Player[] =>
  ps.filter((p) => !p.row.left).sort((a, b) => (a.row.rank ?? 99) - (b.row.rank ?? 99) || a.seat - b.seat);

// ─── numbers ────────────────────────────────────────────────────────────────────────────────────────────────────────

export const magWord = (m: MagnitudeId): string => tk(`mag.${m}`);

/** "8.2 billion" / "384 thousand" / "8849" (always Western digits; the caller isolates it LTR). */
export function shortNum(v: number): string {
  const c = compactParts(v);
  return c.mag ? `${c.mantissa} ${magWord(c.mag)}` : groupDigits(v);
}
/** Value + unit ("330 m"); the unit stays outside the LTR number. */
export const withUnit = (num: string, unit: string): string => (unit ? `${num} ${unit}` : num);

// ─── keypad entry (§8.4) ────────────────────────────────────────────────────────────────────────────────────────────

export interface Entry { digits: string; mag: MagnitudeId | null }
export const EMPTY: Entry = { digits: "", mag: null };
const MAX_INT_DIGITS = 15;

/** One key: a digit, ".", "del" (backspace) or "clr". Refuses what cannot become a valid guess. */
export function press(e: Entry, key: string): Entry {
  if (key === "clr") return EMPTY;
  if (key === "del") return e.digits ? { ...e, digits: e.digits.slice(0, -1) } : { ...e, mag: null };
  const [int = "", dec] = e.digits.split(".");
  if (key === ".") return dec !== undefined ? e : { ...e, digits: `${int || "0"}.` };
  if (!/^\d$/.test(key)) return e;
  if (dec !== undefined) return dec.length >= (e.mag ? 3 : 2) ? e : { ...e, digits: e.digits + key };
  if (int === "0") return { ...e, digits: key };
  if (int.length >= MAX_INT_DIGITS) return e;
  return { ...e, digits: e.digits + key };
}

/** The magnitude chip: the same chip again removes it. */
export const withMag = (e: Entry, m: MagnitudeId): Entry => ({ ...e, mag: e.mag === m ? null : m });

const EXP: Record<MagnitudeId, number> = Object.fromEntries(MAGNITUDES.map((m) => [m.id, m.exp])) as Record<MagnitudeId, number>;

/** The number the entry means (null while empty); big values are integers, small ones keep 2 decimals. */
export function valueOf(e: Entry): number | null {
  if (e.digits === "" || e.digits === ".") return null;
  const x = Number(e.digits);
  if (!Number.isFinite(x)) return null;
  const v = e.mag ? x * 10 ** EXP[e.mag] : x;
  return v >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
}

export type EntryState = "empty" | "ok" | "tooBig";
export function entryState(e: Entry): EntryState {
  const v = valueOf(e);
  if (v === null) return "empty";
  return v > GUESS_MAX || !validGuess(v) ? "tooBig" : "ok";
}

// ─── number line (§8.3) ─────────────────────────────────────────────────────────────────────────────────────────────

export interface Dot { id: string; value: number; x: number; lane: number }
export interface Line { log: boolean; answerX: number; dots: Dot[]; ticks: { x: number; label: string }[] }

const niceStep = (span: number): number => {
  const raw = span / 5;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
};

/**
 * Positions in [0, 1] (inline start → end, always LTR: numbers grow to the right in every locale, §8.2). Log line:
 * log10 over the positive values ±0.15 decade; a guess of 0 sits at 0. Linear: from 0 (or a little under the smallest
 * value when every value is far from 0) to a little over the largest. Dots that would overlap stack into lanes (max 4).
 */
export function layoutLine(answer: number, guesses: readonly { id: string; value: number }[], log: boolean, lanes = 4, minGap = 0.07): Line {
  const vals = [answer, ...guesses.map((g) => g.value)];
  let x: (v: number) => number;
  let ticks: { x: number; label: string }[] = [];
  if (log) {
    const pos = vals.filter((v) => v > 0);
    const lo = Math.log10(Math.min(...pos)) - 0.15, hi = Math.log10(Math.max(...pos)) + 0.15;
    x = (v) => (v <= 0 ? 0 : (Math.log10(v) - lo) / (hi - lo));
    const first = Math.ceil(lo), last = Math.floor(hi);
    const every = Math.max(1, Math.ceil((last - first + 1) / 7));
    for (let d = first; d <= last; d += every) ticks.push({ x: x(10 ** d), label: shortNum(10 ** d) });
  } else {
    const max = Math.max(...vals), min = Math.min(...vals);
    const span = Math.max(max - min, max * 0.05, 1e-9);
    const lo = min - span * 0.12 < 0 || min < span * 0.5 ? Math.max(0, min - span * 0.12) : min - span * 0.12;
    const hi = max + span * 0.12;
    x = (v) => (v - lo) / (hi - lo);
    const step = niceStep(hi - lo);
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push({ x: x(v), label: shortNum(Math.round(v * 100) / 100) });
  }
  ticks = ticks.filter((tk) => tk.x >= 0 && tk.x <= 1);
  const sorted = guesses.map((g) => ({ id: g.id, value: g.value, x: Math.min(1, Math.max(0, x(g.value))) })).sort((a, b) => a.x - b.x || (a.id < b.id ? -1 : 1));
  const laneEnd: number[] = [];
  const dots: Dot[] = sorted.map((d) => {
    let lane = laneEnd.findIndex((end) => d.x - end >= minGap);
    if (lane < 0) lane = laneEnd.length < lanes ? laneEnd.length : laneEnd.indexOf(Math.min(...laneEnd));
    laneEnd[lane] = d.x;
    return { ...d, lane };
  });
  return { log, answerX: Math.min(1, Math.max(0, x(answer))), dots, ticks };
}
