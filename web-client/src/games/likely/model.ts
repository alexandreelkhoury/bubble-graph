// Most Likely (GAME-LIKELY §8, §12): the pure view model shared by the phone (`game-likely`) and the /tv screens.
// Everything here reads the PUBLIC projection plus this phone's own `me` (DESIGN-JAMAA §4.3 secrecy rule): no expression,
// position or number may depend on anything else. Zod-free, DOM-free (unit-tested in web-client/test/games/likely).
import type { GameEnvelope, PlayerRoomView, RoomPublic, TvRoomView } from "@jamaa/shared/protocol/v2";
import type { Expression } from "@jamaa/shared/characters";
import { ENTRANCE_GRACE_MS } from "@jamaa/shared/constants";
import {
  LIKELY_STAGE, LIKELY_TIMING, likelyAwardsMs, likelyJuryArc, likelyRevealMs, likelyRevealPositions, likelyVotingMs,
} from "@jamaa/shared/games/likely/meta";
import type { LikelyPt } from "@jamaa/shared/games/likely/meta";
/** The shared timer components' deadline shape (typed by the platform from Mish Ana!'s view; only `at`/`durationMs` are read). */
import type { DeadlineView } from "../mishana/view";

type Env = Extract<GameEnvelope, { gameId: "likely" }>;
export type LikelyPub = Env["public"];
export type LikelyMe = NonNullable<Env["me"]>;
export type LikelyReveal = NonNullable<LikelyPub["reveal"]>;
export type LikelyAward = LikelyPub["awards"][number];
export type LikelyPhase = LikelyPub["phase"];
export type Member = RoomPublic["members"][number];

/** A player of this game: the room member plus the game's public score. */
export interface Seat {
  id: string; name: string; color: Member["color"]; seat: number; connected: boolean; left: boolean; isHost: boolean;
  reaction: Member["reaction"]; score: number; scoreBefore: number;
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
      left: m ? m.left : true, isHost: m?.isHost ?? false, reaction: m?.reaction ?? null, score: s.score, scoreBefore: s.scoreBefore,
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
    case "AWARDS": return likelyAwardsMs(players, pub.showVoters);
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
  /** Others who picked the same target (public mode, from the public ballots; 0 in secret mode). */
  agreed: number;
  agreePoints: number;
  unanimousPoints: number;
  selfAwarePoints: number;
  total: number;
  scoreBefore: number;
  score: number;
}

export function myReveal(m: LikelyModel): MyReveal | null {
  const r = m.pub.reveal;
  const id = m.myId;
  if (!r || !id) return null;
  const c = r.counts.find((x) => x.playerId === id);
  const votedFor = m.me?.myVote ?? null;
  const pts = (reason: string): number => r.deltas.filter((d) => d.playerId === id && d.reason === reason).reduce((a, d) => a + d.points, 0);
  const agreed = r.ballots && votedFor ? r.ballots.filter((b) => b.voterId !== id && b.targetId === votedFor).length : 0;
  const agreePoints = pts("agree"), unanimousPoints = pts("unanimous"), selfAwarePoints = pts("selfAware");
  const s = m.byId.get(id);
  return {
    votedFor, got: c?.count ?? 0, percent: c?.percent ?? 0, top: r.topIds.includes(id), agreed,
    agreePoints, unanimousPoints, selfAwarePoints, total: agreePoints + unanimousPoints + selfAwarePoints,
    scoreBefore: s?.scoreBefore ?? 0, score: s?.score ?? 0,
  };
}

/** The awards of one player (signature or mystery first, then the extras in the server's order). */
export function awardsOf(pub: LikelyPub, playerId: string): LikelyAward[] {
  const mine = pub.awards.filter((a) => a.playerIds.includes(playerId));
  const rank = (a: LikelyAward): number => (a.kind === "signature" || a.kind === "mystery" ? 0 : 1);
  return [...mine].sort((a, b) => rank(a) - rank(b));
}

/**
 * The awards a phone shows for its player: during AWARDS the Mind Reader stays hidden (it is the TV ceremony's last
 * beat; the phone learns it with everyone at RESULTS).
 */
export function phoneAwards(pub: LikelyPub, playerId: string, results: boolean): LikelyAward[] {
  return awardsOf(pub, playerId).filter((a) => results || a.kind !== "mindReader");
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

/** Extra award cards (Tonight's Star, Self-aware; Mind Reader is its own podium). */
export function extraAwards(pub: LikelyPub): LikelyAward[] {
  return pub.awards.filter((a) => a.kind === "star" || a.kind === "selfAware");
}

export function mindReader(pub: LikelyPub): LikelyAward | null {
  return pub.showVoters ? pub.awards.find((a) => a.kind === "mindReader") ?? null : null;
}

/** AWARDS (§12.4): which trio is on the podium `elapsedMs` into the phase (3 s intro, 4 s per trio, then Mind Reader). */
export function awardsStage(players: number, publicMode: boolean, elapsedMs: number): { kind: "intro" } | { kind: "trio"; index: number } | { kind: "mindReader" } {
  const t = LIKELY_TIMING;
  if (elapsedMs < t.AWARDS_BASE_MS) return { kind: "intro" };
  const trios = Math.max(1, Math.ceil(players / 3));
  const i = Math.floor((elapsedMs - t.AWARDS_BASE_MS) / t.AWARDS_TRIO_MS);
  if (i < trios) return { kind: "trio", index: i };
  return publicMode ? { kind: "mindReader" } : { kind: "trio", index: trios - 1 };
}

/** Mind Reader ranking (public mode): score desc, then seat. */
export function ranking(m: LikelyModel): Seat[] {
  return [...m.seats].sort((a, b) => b.score - a.score || a.seat - b.seat);
}

/** Competition ranking (GAME-LIKELY §6: ties share; 700, 700, 700, 500 → 1, 1, 1, 4), in `ranking` order. */
export function rankRows(seats: readonly Seat[]): { seat: Seat; rank: number }[] {
  const sorted = [...seats].sort((a, b) => b.score - a.score || a.seat - b.seat);
  return sorted.map((seat) => ({ seat, rank: 1 + sorted.filter((o) => o.score > seat.score).length }));
}

/**
 * The Mind Reader podium (players still in the game): step 1, 2 and 3 hold everyone of competition rank 1, 2 and 3, so
 * tied players stand on the same step and a step a tie skipped stays empty.
 */
export function podiumSteps(m: LikelyModel): [Seat[], Seat[], Seat[]] {
  const rows = rankRows(m.seats.filter((s) => !s.left));
  const at = (r: number): Seat[] => rows.filter((x) => x.rank === r).map((x) => x.seat);
  return [at(1), at(2), at(3)];
}

// ---------------------------------------------------------------- the TV reveal plan (§12.2, DESIGN-JAMAA §5.3)

/** The /tv canvas is 960 × 540; the shared layout works in the 864 × 486 safe area (5 % overscan margins). */
export const SAFE = { x: 48, y: 27 } as const;
export const toCanvas = (p: LikelyPt): LikelyPt => ({ x: p.x + SAFE.x, y: p.y + SAFE.y });

export interface Coin { voterId: string; targetId: string; points: number; from: LikelyPt; to: LikelyPt }

export interface RevealPlan {
  /** Seat positions (feet, canvas px) of every seat id. */
  arc: Record<string, LikelyPt>;
  /** Where each character ends (public mode: conga lines; otherwise its seat). */
  ends: Record<string, LikelyPt>;
  /** Voters who run to a line, in ballot order (public mode only; not self-voters, not players who received votes). */
  runners: string[];
  selfVoters: string[];
  /** Agreement coins (public mode): from the head of the voter's line (its pick) to the voter's character. */
  coins: Coin[];
  /** Points each voter collects on this card (sum of its deltas). */
  gains: Record<string, number>;
  counts: Record<string, number>;
}

/** Character box size on the TV stage (dp = canvas px). */
export const CHAR = LIKELY_STAGE.charSize;

export function revealPlan(m: LikelyModel, rtl: boolean): RevealPlan {
  const ids = m.seats.map((s) => s.id);
  const arcPts = likelyJuryArc(ids.length, rtl);
  const arc: Record<string, LikelyPt> = {};
  ids.forEach((id, i) => { arc[id] = toCanvas(arcPts[i]!); });
  const r = m.pub.reveal;
  const ends: Record<string, LikelyPt> = { ...arc };
  const runners: string[] = [], selfVoters: string[] = [];
  const counts: Record<string, number> = {};
  for (const c of r?.counts ?? []) counts[c.playerId] = c.count;
  const gains: Record<string, number> = {};
  for (const d of r?.deltas ?? []) gains[d.playerId] = (gains[d.playerId] ?? 0) + d.points;
  const coins: Coin[] = [];
  if (r?.ballots) {
    // A player who received votes heads a line, so it stays in its seat (and points at its own pick from there); only
    // the other voters run. The positions are the shared layout's for exactly those runners.
    const targeted = new Set(r.counts.map((c) => c.playerId));
    const running = r.ballots.filter((b) => b.voterId !== b.targetId && !targeted.has(b.voterId) && b.voterId in arc && b.targetId in arc);
    const pos = likelyRevealPositions(arcPts, ids, running);
    for (const b of r.ballots) if (b.voterId === b.targetId && b.voterId in arc) selfVoters.push(b.voterId);
    for (const b of running) {
      runners.push(b.voterId);
      const p = pos[b.voterId];
      if (p) ends[b.voterId] = toCanvas(p);
    }
    for (const b of r.ballots) {
      const pts = gains[b.voterId] ?? 0;
      if (pts <= 0 || !(b.targetId in arc)) continue;
      const head = arc[b.targetId]!, me = ends[b.voterId]!;
      coins.push({ voterId: b.voterId, targetId: b.targetId, points: pts, from: { x: head.x, y: head.y - CHAR }, to: { x: me.x, y: me.y - CHAR * 0.6 } });
    }
  }
  return { arc, ends, runners, selfVoters, coins, gains, counts };
}

/** Quadratic Bézier point (DESIGN-JAMAA §5.1 coin path: control point 90 dp above the chord midpoint). */
export function coinPoint(from: LikelyPt, to: LikelyPt, p: number): LikelyPt {
  const top = from.y < 270 && to.y < 270;
  const c = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + (top ? 90 : -90) };
  const u = 1 - p;
  return { x: u * u * from.x + 2 * u * p * c.x + p * p * to.x, y: u * u * from.y + 2 * u * p * c.y + p * p * to.y };
}

/**
 * A character's expression on the TV (DESIGN-JAMAA §4.3; public data only). `stage` is how far the local reveal has
 * come: before "stamp" nobody reacts; after it, the top target(s) turn shy / smug (self-vote, public mode) / shock
 * (unanimous), runners point, self-voters point at themselves (`point` with the look toward the camera).
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
  if (own) return stage === "end" && (m.pub.reveal?.deltas.some((d) => d.playerId === id) ?? false) ? "happy" : "point";
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
