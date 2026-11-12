// Most Likely (GAME-LIKELY §8, §12): the pure view model shared by the phone (`game-likely`) and the /tv screens.
// Everything here reads the PUBLIC projection plus this phone's own `me` (DESIGN-JAMAA §4.3 secrecy rule): no expression,
// position or number may depend on anything else. Zod-free, DOM-free (unit-tested in web-client/test/games/likely).
import type { GameEnvelope, PlayerRoomView, RoomPublic, TvRoomView } from "@jamaa/shared/protocol/v2";
import type { Expression } from "@jamaa/shared/characters";
import { ENTRANCE_GRACE_MS } from "@jamaa/shared/constants";
import {
  LIKELY_STAGE, LIKELY_TIMING, likelyAwardsMs, likelyPublicTokens, likelyRevealMs, likelyRow, likelySecretTokens, likelyVotingMs,
} from "@jamaa/shared/games/likely/meta";
import type { LikelyPt, LikelyToken } from "@jamaa/shared/games/likely/meta";
import { likelyStackGrid } from "@jamaa/shared/games/likely/meta";
/** The shared timer components' deadline shape (typed by the platform from Mish Ana!'s view; only `at`/`durationMs` are read). */
import type { DeadlineView } from "../mishana/view";

type Env = Extract<GameEnvelope, { gameId: "likely" }>;
export type LikelyPub = Env["public"];
export type LikelyMe = NonNullable<Env["me"]>;
export type LikelyReveal = NonNullable<LikelyPub["reveal"]>;
export type LikelyAward = LikelyPub["awards"][number];
export type LikelyPhase = LikelyPub["phase"];
export type Member = RoomPublic["members"][number];

/** A player of this game (the room member). Most Likely has no points (GAME-LIKELY §6), so a seat has no score. */
export interface Seat {
  id: string; name: string; color: Member["color"]; seat: number; connected: boolean; left: boolean; isHost: boolean;
  reaction: Member["reaction"];
}

export interface LikelyModel {
  pub: LikelyPub;
  /** This phone's own game data (null on the TV and for a benched phone). */
  me: LikelyMe | null;
  myId: string | null;
  /** Players of this game in seat order. */
  seats: Seat[];
  byId: ReadonlyMap<string, Seat>;
  roomCode: string;
  joinUrl: string;
  over: boolean;
  doneIds: readonly string[];
  awaitedIds: readonly string[];
  /** Instance number (a replay is a new instance). */
  n: number;
  hostId: string | null;
}

function seatsOf(room: RoomPublic, pub: LikelyPub): Seat[] {
  const byId = new Map(room.members.map((m) => [m.id, m]));
  const out: Seat[] = [];
  for (const s of pub.scores) {
    const m = byId.get(s.playerId);
    // A player the room already dropped keeps a neutral identity, so a screen never crashes on a stale id.
    out.push({
      id: s.playerId, name: m?.name ?? "", color: m?.color ?? "lilac", seat: m?.seat ?? 99, connected: m?.connected ?? false,
      left: m ? m.left : true, isHost: m?.isHost ?? false, reaction: m?.reaction ?? null,
    });
  }
  return out.sort((a, b) => a.seat - b.seat);
}

/** The Most Likely model of a phone or TV view, or null when the room is not playing Most Likely. */
export function likelyModel(view: PlayerRoomView | TvRoomView): LikelyModel | null {
  const g = view.game;
  if (!g || g.gameId !== "likely") return null;
  const seats = seatsOf(view.room, g.public);
  return {
    pub: g.public, me: g.me ?? null, myId: view.kind === "player" ? view.me?.id ?? null : null, seats,
    byId: new Map(seats.map((s) => [s.id, s])), roomCode: view.room.roomCode, joinUrl: view.room.joinUrl, over: g.over, doneIds: g.doneIds,
    awaitedIds: g.awaitedIds, n: g.n, hostId: view.room.hostPlayerId,
  };
}

/** Players still in the game (not `left`). */
export function activeSeats(m: LikelyModel): Seat[] {
  return m.seats.filter((s) => !s.left);
}

/** The full length of the current phase (GAME-LIKELY §4.1), so a countdown bar can show its fraction. */
export function phaseDurationMs(pub: LikelyPub, players: number): number | null {
  switch (pub.phase) {
    case "CARD": return LIKELY_TIMING.CARD_MS + (pub.cardIndex === 0 ? ENTRANCE_GRACE_MS : 0);
    case "VOTING": return likelyVotingMs(players);
    case "REVEAL": {
      const r = pub.reveal;
      return r ? likelyRevealMs(r.votesCast, r.unanimous, r.topIds.length) : LIKELY_TIMING.REVEAL_MIN_MS;
    }
    case "AWARDS": return likelyAwardsMs(players);
    default: return null;
  }
}

/** The server deadline as the shared timer components read it ({at, durationMs}); never a local constant alone. */
export function deadlineOf(m: LikelyModel): DeadlineView | null {
  const at = m.pub.deadline;
  const d = phaseDurationMs(m.pub, activeSeats(m).length);
  return at === null || d === null ? null : { kind: "VOTE", at, durationMs: d };
}

/** Vote targets on this card (§5): every non-`left` player, yourself included, except the card's named player. */
export function targetsOf(m: LikelyModel): Seat[] {
  const named = m.pub.card?.namedPlayerId ?? null;
  return m.seats.filter((s) => !s.left && s.id !== named);
}

/** Whether this phone is a voter on the current card (not a late joiner waiting for the next card). */
export function canVote(m: LikelyModel): boolean {
  return !!m.me && !m.me.waitingForNext && m.pub.phase === "VOTING" && !!m.myId && !m.byId.get(m.myId)?.left;
}

const pctCache = new Map<string, Intl.NumberFormat>();
/** "50%", "50 %", "50 ‎%" with Western digits in every locale (DESIGN §3.5). */
export function fmtPercent(p: number, locale: string): string {
  let f = pctCache.get(locale);
  if (!f) {
    try { f = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, numberingSystem: "latn" }); }
    catch { f = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 0 }); }
    pctCache.set(locale, f);
  }
  return f.format(p / 100);
}

// ---------------------------------------------------------------- the phone's own reveal (GAME-LIKELY §8.2, LK-PH-03)

export interface MyReveal {
  /** Who this phone voted for (its own `me.myVote`; null = abstained). */
  votedFor: string | null;
  /** Votes and percentage this player received. */
  got: number;
  percent: number;
  top: boolean;
  /** Public mode only (from the public ballots; [] with secret votes): the others who voted for this player, seat order. */
  voters: Seat[];
  /** Public mode only: the others who picked the same person as this player, seat order. */
  samePick: Seat[];
}

export function myReveal(m: LikelyModel): MyReveal | null {
  const r = m.pub.reveal;
  const id = m.myId;
  if (!r || !id) return null;
  const c = r.counts.find((x) => x.playerId === id);
  const votedFor = m.me?.myVote ?? null;
  const seats = (ids: string[]): Seat[] => m.seats.filter((s) => ids.includes(s.id));
  const ballots = r.ballots ?? [];
  return {
    votedFor, got: c?.count ?? 0, percent: c?.percent ?? 0, top: r.topIds.includes(id),
    voters: seats(ballots.filter((b) => b.targetId === id && b.voterId !== id).map((b) => b.voterId)),
    samePick: votedFor ? seats(ballots.filter((b) => b.targetId === votedFor && b.voterId !== id).map((b) => b.voterId)) : [],
  };
}

/** The awards of one player (signature or mystery first, then the extras in the server's order). */
export function awardsOf(pub: LikelyPub, playerId: string): LikelyAward[] {
  const mine = pub.awards.filter((a) => a.playerIds.includes(playerId));
  const rank = (a: LikelyAward): number => (a.kind === "signature" || a.kind === "mystery" ? 0 : 1);
  return [...mine].sort((a, b) => rank(a) - rank(b));
}

/** The awards a phone shows for its player (its signature or mystery card, then Tonight's Star if it won it). */
export function phoneAwards(pub: LikelyPub, playerId: string): LikelyAward[] {
  return awardsOf(pub, playerId);
}

/** The card's award holder(s) (public `topIds`; none on chaos or with no votes), in seat order. */
export function winners(m: LikelyModel): Seat[] {
  const r = m.pub.reveal;
  if (!r || r.chaos || r.none) return [];
  return m.seats.filter((s) => r.topIds.includes(s.id));
}

/** The one signature (or mystery) award each player gets, in seat order: the AWARDS trios (§12.4). */
export function signatureRow(m: LikelyModel): { seat: Seat; award: LikelyAward | null }[] {
  return m.seats.map((seat) => ({ seat, award: m.pub.awards.find((a) => (a.kind === "signature" || a.kind === "mystery") && a.playerIds.includes(seat.id)) ?? null }));
}

/** The extra award card (Tonight's Star). */
export function extraAwards(pub: LikelyPub): LikelyAward[] {
  return pub.awards.filter((a) => a.kind === "star");
}

/** AWARDS (§12.4): which trio is on the podium `elapsedMs` into the phase (3 s intro, then 4 s per trio). */
export function awardsStage(players: number, elapsedMs: number): { kind: "intro" } | { kind: "trio"; index: number } {
  const t = LIKELY_TIMING;
  if (elapsedMs < t.AWARDS_BASE_MS) return { kind: "intro" };
  const trios = Math.max(1, Math.ceil(players / 3));
  return { kind: "trio", index: Math.min(trios - 1, Math.floor((elapsedMs - t.AWARDS_BASE_MS) / t.AWARDS_TRIO_MS)) };
}

// ---------------------------------------------------------------- the TV reveal plan (§12.2, DESIGN-JAMAA §5.3)

/** The /tv canvas is 960 × 540; the shared layout works in stage units: the 864 × 442 area under the 44 dp game header
 *  inside the 864 × 486 safe area (5 % overscan margins), so a stage point maps to the canvas at (+48, +27 + 44). */
export const SAFE = { x: 48, y: 27 + 44 } as const;
export const toCanvas = (p: LikelyPt): LikelyPt => ({ x: p.x + SAFE.x, y: p.y + SAFE.y });

/** Character box size on the TV stage (dp = canvas px), before and during the reveal. */
export const CHAR = LIKELY_STAGE.charSize;
export const REVEAL_CHAR = LIKELY_STAGE.revealChar;

export interface RevealPlan {
  /** Where every seat stands before the reveal (feet, canvas px), and in the reveal row. */
  seat: Record<string, LikelyPt>;
  row: Record<string, LikelyPt>;
  /** The votes landing under their targets, in arrival order (public: the voter's token; secret: an envelope). */
  tokens: LikelyToken[];
  /** Token size (canvas px). */
  cell: number;
  counts: Record<string, number>;
}

/**
 * GAME-LIKELY §12.2: one centred row; every vote becomes a token under its target, one by one. Public mode: the
 * voter's own character in miniature (who voted for whom); secret votes: identical envelopes from the tally only.
 */
export function revealPlan(m: LikelyModel, rtl: boolean): RevealPlan {
  const ids = m.seats.filter((s) => !s.left).map((s) => s.id);
  const before = likelyRow(ids.length, rtl).map(toCanvas);
  const rowPts = likelyRow(ids.length, rtl, true);
  const seat: Record<string, LikelyPt> = {}, row: Record<string, LikelyPt> = {};
  ids.forEach((id, i) => { seat[id] = before[i]!; row[id] = toCanvas(rowPts[i]!); });
  const r = m.pub.reveal;
  const counts: Record<string, number> = {};
  for (const c of r?.counts ?? []) counts[c.playerId] = c.count;
  const raw = !r || r.none ? [] : r.ballots ? likelyPublicTokens(rowPts, ids, r.ballots, rtl) : likelySecretTokens(rowPts, ids, r.counts, rtl);
  const tokens = raw.map((x) => ({ ...x, at: toCanvas(x.at) }));
  // The same grid the shared stacks were spaced with.
  const cell = likelyStackGrid(ids.length, Math.max(0, ...Object.values(counts))).cell;
  return { seat, row, tokens, cell, counts };
}

/** Quadratic Bézier point (a token's arc from its voter, or an envelope's from the card, to its slot). */
export function arcPoint(from: LikelyPt, to: LikelyPt, p: number, lift = 60): LikelyPt {
  const c = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
  const u = 1 - p;
  return { x: u * u * from.x + 2 * u * p * c.x + p * p * to.x, y: u * u * from.y + 2 * u * p * c.y + p * p * to.y };
}

/**
 * A character's expression on the TV (DESIGN-JAMAA §4.3; public data only). `stage` is how far the local reveal has
 * come: during the build nobody reacts but voters point (public mode); after the stamp, the top target(s) turn shy /
 * smug (voted for themselves, public mode) / shock (unanimous); chaos: shock then laugh.
 */
export function revealExpression(m: LikelyModel, id: string, stage: "run" | "stamp" | "end"): Expression {
  const s = m.byId.get(id);
  if (s && !s.connected) return "away";
  const r = m.pub.reveal;
  if (!r) return "idle";
  if (r.chaos) return stage === "run" ? "shock" : "laugh";
  if (r.none) return "shy";
  const top = r.topIds.includes(id);
  const own = r.ballots?.find((b) => b.voterId === id) ?? null;
  if (stage !== "run" && top) {
    if (own && own.targetId === id) return "smug";
    return r.unanimous ? "shock" : "shy";
  }
  if (own) return stage === "run" ? "point" : "happy";
  return "idle";
}

/** "{name} AGAIN?!" applies (public data). */
export function againName(m: LikelyModel): string | null {
  const id = m.pub.reveal?.againId ?? null;
  return id ? m.byId.get(id)?.name ?? null : null;
}

/** Percentage board lines (§12.2 secret votes; also the public tally): percent desc, then seat. */
export function percentLines(m: LikelyModel): { seat: Seat; count: number; percent: number }[] {
  const r = m.pub.reveal;
  if (!r) return [];
  const out: { seat: Seat; count: number; percent: number }[] = [];
  for (const c of r.counts) {
    const seat = m.byId.get(c.playerId);
    if (seat) out.push({ seat, count: c.count, percent: c.percent });
  }
  return out.sort((a, b) => b.percent - a.percent || a.seat.seat - b.seat.seat);
}

/** Whether the phone owes a vote now (the ⓘ sheet's "Your turn!" banner). */
export function needsVote(m: LikelyModel): boolean {
  return canVote(m) && m.me?.myVote === null;
}
