// Bluff (GAME-BLUFF §8, §12): the pure view model shared by the phone (`game-bluff`) and the /tv screens.
// Secrecy (§8.1, DESIGN-JAMAA §4.3): everything here reads the PUBLIC projection plus this phone's own `me`; no
// expression, position or number may depend on anything else. Zod-free and DOM-free (web-client/test/games/bluff).
import type { GameEnvelope, PlayerRoomView, RoomPublic, TvRoomView } from "@jamaa/shared/protocol/v2";
import type { Expression } from "@jamaa/shared/characters";
import { ENTRANCE_GRACE_MS } from "@jamaa/shared/constants";
import type { DeadlineView } from "../mishana/view";

type Env = Extract<GameEnvelope, { gameId: "bluff" }>;
export type BluffPub = Env["public"];
export type BluffMe = NonNullable<Env["me"]>;
export type Reveal = NonNullable<BluffPub["reveal"]>;
export type RevealStep = Reveal["steps"][number];
export type Award = BluffPub["awards"][number];
export type BluffPhase = BluffPub["phase"];
export type Prompt = NonNullable<BluffPub["prompt"]>;
export type Member = RoomPublic["members"][number];

/** A player of this game: the room member plus the game's public score. */
export interface Seat {
  id: string; name: string; color: Member["color"]; seat: number; connected: boolean; left: boolean; isHost: boolean;
  reaction: Member["reaction"]; score: number; scoreBefore: number; isNew: boolean;
}

export interface BluffModel {
  pub: BluffPub;
  /** This phone's own game data (null on the TV and for a benched phone). */
  me: BluffMe | null;
  myId: string | null;
  /** Players of this game in seat order. */
  seats: Seat[];
  byId: ReadonlyMap<string, Seat>;
  roomCode: string;
  joinUrl: string;
  over: boolean;
  doneIds: readonly string[];
  awaitedIds: readonly string[];
  n: number;
  hostId: string | null;
  contentLocale: string;
}

function seatsOf(room: RoomPublic, pub: BluffPub): Seat[] {
  const byId = new Map(room.members.map((m) => [m.id, m]));
  const out: Seat[] = [];
  for (const s of pub.scores) {
    const m = byId.get(s.playerId);
    out.push({
      id: s.playerId, name: m?.name ?? "", color: m?.color ?? "lilac", seat: m?.seat ?? 99, connected: m?.connected ?? false,
      left: m ? m.left : true, isHost: m?.isHost ?? false, reaction: m?.reaction ?? null, score: s.score, scoreBefore: s.scoreBefore,
      isNew: pub.newIds.includes(s.playerId),
    });
  }
  return out.sort((a, b) => a.seat - b.seat);
}

/** The Bluff model of a phone or TV view, or null when the room is not playing Bluff. */
export function bluffModel(view: PlayerRoomView | TvRoomView): BluffModel | null {
  const g = view.game;
  if (!g || g.gameId !== "bluff") return null;
  const seats = seatsOf(view.room, g.public);
  return {
    pub: g.public, me: g.me ?? null, myId: view.kind === "player" ? view.me?.id ?? null : null, seats,
    byId: new Map(seats.map((s) => [s.id, s])), roomCode: view.room.roomCode, joinUrl: view.room.joinUrl, over: g.over,
    doneIds: g.doneIds, awaitedIds: g.awaitedIds, n: g.n, hostId: view.room.hostPlayerId, contentLocale: view.room.contentLocale,
  };
}

/** Players still in the game. */
export const activeSeats = (m: BluffModel): Seat[] => m.seats.filter((s) => !s.left);
export const isHost = (m: BluffModel): boolean => m.myId !== null && m.hostId === m.myId;
export const isFinal = (pub: BluffPub): boolean => pub.roundKind === "noTruth";

// ---------------------------------------------------------------- copy keys

export const k = (s: string): `game.bluff.${string}` => `game.bluff.${s}`;
const TYPE_KEY: Record<Prompt["type"], string> = {
  proverb_end: "type.proverbEnd", fact_blank: "type.factBlank", word_meaning: "type.wordMeaning", expression_meaning: "type.expressionMeaning", no_truth: "type.noTruth",
};
export const typeKey = (t: Prompt["type"]): string => k(TYPE_KEY[t]);
export const roundNameKey = (pub: BluffPub): string => k(`round.${pub.roundKind}`);
export const roundIntroKey = (pub: BluffPub): string => k(`round.${pub.roundKind}.intro`);
export const hintKey = (h: Prompt["lengthHint"]): string => k(`hint.${h}`);

/**
 * What a prompt card shows: an Arabic original keeps its place with the transliteration and the room-language
 * translation under it (GAME-BLUFF §8.2); any other translated prompt shows the translation only.
 */
export function promptLines(p: Prompt): { main: string; translit: string | null; sub: string | null } {
  if (p.translit) return { main: p.original, translit: p.translit, sub: p.display };
  return { main: p.display ?? p.original, translit: null, sub: null };
}

// ---------------------------------------------------------------- timers

/** GAME-BLUFF §4.1 nominal durations (pace "normal"); WRITING and VOTING scale by the room pace (0.75 / 1 / 1.5). */
export const NOMINAL = {
  ROUND_INTRO: 4_000, ROUND_INTRO_FINAL: 6_000, WRITING: 60_000, WRITING_FINAL: 75_000, SCORES: 6_000, SCORES_VOIDED: 4_000,
  AWARDS_BASE: 2_500, AWARDS_PER_CARD: 3_500,
} as const;
export const PACES = [0.75, 1, 1.5] as const;
export const votingNominalMs = (optionCount: number): number => Math.round(Math.min(50_000, Math.max(26_000, 20_000 + 2_500 * optionCount)) / 1000) * 1000;

/** The full length of the current phase at pace "normal" (null: no deadline). */
export function nominalMs(pub: BluffPub): number | null {
  const fin = isFinal(pub);
  switch (pub.phase) {
    case "ROUND_INTRO": return (fin ? NOMINAL.ROUND_INTRO_FINAL : NOMINAL.ROUND_INTRO) + (pub.promptIndex === 0 ? ENTRANCE_GRACE_MS : 0);
    case "WRITING": return fin ? NOMINAL.WRITING_FINAL : NOMINAL.WRITING;
    case "VOTING": return votingNominalMs(pub.options.length);
    case "REVEAL": return pub.reveal?.durationMs ?? null;
    case "SCORES": return pub.voided ? NOMINAL.SCORES_VOIDED : NOMINAL.SCORES;
    case "AWARDS": return NOMINAL.AWARDS_BASE + NOMINAL.AWARDS_PER_CARD * pub.awards.length;
    default: return null;
  }
}

/**
 * The bar's full length: the room pace is not in the view, so pick the smallest paced candidate that still covers what
 * was left when this deadline was first seen (a deadline moved by the like grace or a hide reads as nearly spent).
 */
export function fullMs(pub: BluffPub, firstRemainingMs: number): number | null {
  const base = nominalMs(pub);
  if (base === null) return null;
  const paced = pub.phase === "WRITING" || pub.phase === "VOTING";
  const cands = paced ? PACES.map((f) => Math.round((base * f) / 1000) * 1000) : [base];
  return cands.find((c) => c >= firstRemainingMs - 1_500) ?? Math.max(base, firstRemainingMs);
}

const seen = new Map<number, number>();
/** The server deadline as the shared timer components read it. `serverNow` = Date.now() + clock offset. */
export function deadlineOf(pub: BluffPub, serverNow: number): DeadlineView | null {
  const at = pub.deadline;
  if (at === null) return null;
  let first = seen.get(at);
  if (first === undefined) {
    first = Math.max(0, at - serverNow);
    if (seen.size > 64) seen.clear();
    seen.set(at, first);
  }
  const d = fullMs(pub, first);
  return d === null ? null : { kind: "VOTE", at, durationMs: d } as DeadlineView;
}

// ---------------------------------------------------------------- characters (public view only)

/** A character's expression outside the reveal: away → done → think → idle (DESIGN-JAMAA §4.3, GAME-BLUFF §12.4). */
export function baseExpression(m: BluffModel, s: Seat): Expression {
  if (!s.connected) return "away";
  const p = m.pub.phase;
  if (p === "WRITING") return m.pub.submittedIds.includes(s.id) ? "done" : "think";
  if (p === "VOTING") {
    if (m.pub.spotOnIds.includes(s.id)) return "happy";
    return m.pub.votedIds.includes(s.id) ? "done" : "think";
  }
  if (p === "SCORES") return s.score > s.scoreBefore ? "happy" : "idle";
  return "idle";
}

/** The prop a seated character holds (DESIGN-JAMAA §4.5): pencil while writing, envelope once in, ballot once voted. */
export function propOf(m: BluffModel, s: Seat): "pencil" | "envelope" | "ballot" | null {
  if (!s.connected || s.left) return null;
  if (m.pub.phase === "WRITING") return m.pub.submittedIds.includes(s.id) ? "envelope" : "pencil";
  if (m.pub.phase === "VOTING" && m.pub.votedIds.includes(s.id)) return "ballot";
  return null;
}

// ---------------------------------------------------------------- ranking

/** Seats by score (desc), ties in seat order. */
export function ranked(seats: readonly Seat[], by: "score" | "scoreBefore" = "score"): Seat[] {
  return [...seats].filter((s) => !s.left || s[by] > 0).sort((a, b) => b[by] - a[by] || a.seat - b.seat);
}
/** Competition ranking: equal scores share the place (GAME-BLUFF §6.6). */
export function placeOf(list: readonly Seat[], id: string, by: "score" | "scoreBefore" = "score"): number {
  const me = list.find((s) => s.id === id);
  if (!me) return 0;
  return 1 + list.filter((s) => s[by] > me[by]).length;
}

// ---------------------------------------------------------------- reveal plan (GAME-BLUFF §12.2, §12.2.1)

export type BeatKind = "intro" | "quick" | "lie" | "truth" | "answer" | "crown" | "twist" | "montage" | "likes";
export interface Beat {
  kind: BeatKind;
  start: number;
  dur: number;
  /** Indexes into `reveal.steps` this beat shows. */
  steps: number[];
}
export interface RevealPlan { beats: Beat[]; total: number; scale: number }

export const BEAT_MS = {
  intro: 1500, quick: 1200, lieBase: 3500, liePerVoter: 120, truth: 4500, answer: 2800, crown: 3000, twist: 2000, montage: 2500, likes: 1500,
} as const;

export const hasLikes = (r: Reveal): boolean => r.steps.some((s) => s.likerIds.length > 0) || r.unpicked.some((u) => u.likerIds.length > 0);

/**
 * The beats of a reveal, in the server's step order (lies fewest votes first, the truth last; final: answers fewest
 * votes first). Durations follow the §12.2 formula, scaled to fit `durationMs` (the server timer never waits);
 * reduced motion halves every beat (DESIGN §6.3).
 */
export function revealPlan(r: Reveal, reducedMotion = false): RevealPlan {
  const raw: Omit<Beat, "start">[] = [{ kind: "intro", dur: BEAT_MS.intro, steps: [] }];
  if (r.final) {
    r.steps.forEach((s, i) => { if (s.voteCount > 0) raw.push({ kind: "answer", dur: BEAT_MS.answer, steps: [i] }); });
    const top = r.steps.map((s, i) => (s.top ? i : -1)).filter((i) => i >= 0);
    raw.push({ kind: "crown", dur: BEAT_MS.crown, steps: top });
    raw.push({ kind: "twist", dur: BEAT_MS.twist, steps: r.steps.map((_, i) => i) });
  } else {
    r.steps.forEach((s, i) => {
      if (s.kind === "truth") raw.push({ kind: "truth", dur: BEAT_MS.truth, steps: [i] });
      else if (s.quick) raw.push({ kind: "quick", dur: BEAT_MS.quick, steps: [i] });
      else if (s.voteCount > 0) raw.push({ kind: "lie", dur: BEAT_MS.lieBase + BEAT_MS.liePerVoter * s.voterIds.length, steps: [i] });
    });
  }
  if (r.unpicked.length > 0) raw.push({ kind: "montage", dur: BEAT_MS.montage, steps: [] });
  if (hasLikes(r)) raw.push({ kind: "likes", dur: BEAT_MS.likes, steps: [] });
  const nominal = raw.reduce((a, b) => a + b.dur, 0);
  let scale = reducedMotion ? 0.5 : 1;
  if (r.durationMs > 0 && nominal * scale > r.durationMs) scale = r.durationMs / nominal;
  let t = 0;
  const beats: Beat[] = raw.map((b) => {
    const out = { ...b, start: Math.round(t), dur: Math.round(b.dur * scale) };
    t += b.dur * scale;
    return out;
  });
  return { beats, total: Math.round(t), scale };
}

/** The beat running at `tMs` (the last one once the plan is over). */
export function beatAt(plan: RevealPlan, tMs: number): number {
  let i = 0;
  for (let j = 0; j < plan.beats.length; j++) if (tMs >= plan.beats[j]!.start) i = j;
  return i;
}

/** Points a beat pays to each player (the odometers roll by these): fooled/truth on their beat, convincing on the
 *  crown, likes on the like tally. Σ beats + spot-on = score − scoreBefore (GAME-BLUFF §13.3 invariant 3). */
export function beatDeltas(r: Reveal, b: Beat): Map<string, number> {
  const out = new Map<string, number>();
  const add = (id: string, p: number): void => { out.set(id, (out.get(id) ?? 0) + p); };
  if (b.kind === "likes") {
    for (const s of r.steps) for (const d of s.deltas) if (d.reason === "like") add(d.playerId, d.points);
    for (const u of r.unpicked) for (const d of u.deltas) if (d.reason === "like") add(d.playerId, d.points);
    return out;
  }
  if (b.kind === "intro" || b.kind === "twist" || b.kind === "montage") return out;
  for (const i of b.steps) {
    const s = r.steps[i];
    if (!s) continue;
    for (const d of s.deltas) {
      if (d.reason === "like") continue;
      if (b.kind === "crown" ? d.reason === "convincing" : d.reason !== "convincing") add(d.playerId, d.points);
    }
  }
  return out;
}

/** Each player's pill value at the start of every beat, and at the end (`[beats.length]`). */
export function runningScores(m: { pub: BluffPub; seats: readonly Seat[] }, plan: RevealPlan): Map<string, number>[] {
  const r = m.pub.reveal;
  const cur = new Map(m.seats.map((s) => [s.id, s.scoreBefore]));
  if (r) for (const d of r.spotOnDeltas) cur.set(d.playerId, (cur.get(d.playerId) ?? 0) + d.points);
  const out: Map<string, number>[] = [new Map(cur)];
  for (const b of plan.beats) {
    if (r) for (const [id, p] of beatDeltas(r, b)) cur.set(id, (cur.get(id) ?? 0) + p);
    out.push(new Map(cur));
  }
  return out;
}

/** Reveal sub-moments of a beat: 0 start, 1 landed, 2 stamped, 3 popped, 4 counting. */
export type Mark = 0 | 1 | 2 | 3 | 4;

/** Expression of a seated (or hopping) character at this point of the reveal: a function of the public reveal only. */
export function seatExpression(r: Reveal, beat: Beat, mark: Mark, s: Seat, ended: boolean): Expression {
  if (!s.connected) return "away";
  if (ended) return r.final ? "laugh" : s.score > s.scoreBefore ? "happy" : "idle";
  const step = r.steps[beat.steps[0] ?? -1];
  switch (beat.kind) {
    case "lie":
    case "quick":
      if (!step) return "idle";
      if (step.voterIds.includes(s.id)) return mark >= 2 ? (step.kind === "house" ? "shock" : "facepalm") : "think";
      if (step.authorIds.includes(s.id)) return mark >= 3 ? "smug" : "idle";
      return "idle";
    case "truth": {
      if (!step) return "idle";
      if (step.spotOnIds.includes(s.id)) return "happy";
      const nobody = step.voterIds.length === 0 && step.spotOnIds.length === 0;
      if (mark < 2) return step.voterIds.includes(s.id) ? "think" : "idle";
      if (nobody) return "shock";
      return step.voterIds.includes(s.id) ? "cheer" : "sad";
    }
    case "answer":
      return step && step.authorIds.includes(s.id) && mark >= 3 ? (step.top ? "laugh" : "smug") : "idle";
    case "crown":
      return beat.steps.some((i) => r.steps[i]?.authorIds.includes(s.id)) && mark >= 2 ? "cheer" : "idle";
    case "twist":
      return mark >= 2 ? "laugh" : "idle";
    case "montage": {
      const mine = r.unpicked.some((u) => u.authorIds.includes(s.id));
      return mine ? "sad" : "idle";
    }
    default:
      return "idle";
  }
}

/** The step a player voted for (rounds 1–2 only: final ballots stay anonymous). */
export function votedStep(r: Reveal, id: string): RevealStep | null {
  if (r.final) return null;
  return r.steps.find((s) => s.voterIds.includes(id)) ?? null;
}

// ---------------------------------------------------------------- the phone's own reveal (§8.2 REVEAL row)

export interface MyReveal {
  /** Players this phone's lie fooled (rounds 1–2), or votes its answer got (final). */
  fooled: number;
  believed: number;
  /** The step this phone fell for (a player lie or a house lie), with its authors. */
  fellFor: RevealStep | null;
  foundTruth: boolean;
  foundEarly: boolean;
  spotOn: boolean;
  top: boolean;
  total: number;
}

export function myReveal(m: BluffModel): MyReveal | null {
  const r = m.pub.reveal;
  const id = m.myId;
  if (!r || !id) return null;
  const mine = r.steps.filter((s) => s.authorIds.includes(id));
  const seat = m.byId.get(id);
  const voted = votedStep(r, id);
  const truth = r.steps.find((s) => s.kind === "truth") ?? null;
  return {
    fooled: r.final ? 0 : mine.reduce((a, s) => a + s.voterIds.length, 0),
    believed: r.final ? mine.reduce((a, s) => a + s.voteCount, 0) : 0,
    fellFor: voted && voted.kind !== "truth" ? voted : null,
    foundTruth: !!truth && truth.voterIds.includes(id),
    foundEarly: !!truth && truth.foundEarlyIds.includes(id),
    spotOn: r.spotOnDeltas.some((d) => d.playerId === id),
    top: mine.some((s) => s.top),
    total: seat ? seat.score - seat.scoreBefore : 0,
  };
}

// ---------------------------------------------------------------- awards (§6.6)

const AWARD_KEY: Record<Award["id"], string> = {
  bluffOfTheNight: "awards.bluffOfTheNight", lieDetector: "awards.lieDetector", crowdFavourite: "awards.crowdFavourite", hookLineSinker: "awards.hookLineSinker",
};
export const awardTitleKey = (a: Award): string => k(AWARD_KEY[a.id]);
export const awardBodyKey = (a: Award): string => k(`${AWARD_KEY[a.id]}.body`);

/** When award card `i` drops during AWARDS (2 500 ms intro beat, then one card per 3 500 ms, GAME-BLUFF §4.1). */
export const awardAt = (i: number): number => 900 + NOMINAL.AWARDS_PER_CARD * i;

// ---------------------------------------------------------------- phone helpers

/** Whether this phone owes an action now (the ⓘ sheet's "Your turn!" banner). */
export function needsAction(m: BluffModel): boolean {
  const me = m.me;
  if (!me || !m.myId || me.waitingForNext) return false;
  if (m.pub.phase === "WRITING") return me.myLieStatus === "none";
  if (m.pub.phase === "VOTING") return !me.spotOn && me.myVote === null && m.pub.options.some((o) => !me.myOptionIds.includes(o.id));
  return false;
}

/** Graphemes (the 60-character rule counts graphemes, §5.1). */
export function graphemes(s: string): number {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(x: string): Iterable<unknown> } }).Segmenter;
  if (!Seg) return [...s].length;
  let n = 0;
  for (const _ of new Seg(undefined, { granularity: "grapheme" }).segment(s)) n++;
  return n;
}
export const LIE_MAX = 60;
/** At least two letters (§5.1): the server says so too, the phone only avoids a pointless round trip. */
export const lieReady = (s: string): boolean => (s.match(/\p{L}/gu)?.length ?? 0) >= 2 && graphemes(s.trim()) <= LIE_MAX;

/** "LIE_TOO_CLOSE" → "game.bluff.error.lieTooClose" (the platform toast only knows the root `error.*` keys). */
export const errorKey = (code: string): string => k(`error.${code.toLowerCase().replace(/_([a-z])/g, (_x, c: string) => c.toUpperCase())}`);
export const BLUFF_ERRORS = [
  "LIE_EMPTY", "LIE_TOO_LONG", "LIE_TOO_CLOSE", "LIE_WRONG_SCRIPT", "LIE_BLOCKED_WORD", "TOO_MANY_EDITS", "CANNOT_VOTE_OWN",
  "CANNOT_VOTE_SPOT_ON", "CANNOT_HIDE", "STALE_PROMPT",
] as const;

/** Option letters stay Latin in every locale, like the room code (cards are also told apart by position). */
export const letterOf = (i: number): string => String.fromCharCode(65 + i);
