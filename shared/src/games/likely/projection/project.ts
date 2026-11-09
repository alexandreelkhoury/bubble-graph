// GAME-LIKELY §8.1 secrecy and §13.2 views. In secret mode nothing projected depends on the voter→target mapping beyond
// the per-card tallies (the anonymity property, JAMAA-PLATFORM §2.11): no ballots, no deltas, scores pinned at 0, no
// Self-aware or Mind Reader award, and every list is ordered by seat or by tally, never by ballot.
import type { Locale } from "../../../constants";
import type { RoomAccess } from "../../../content/types";
import type { GameMemory, RosterEntry } from "../../types";
import type { LikelySettings } from "../meta";
import type { LikelyCatalog } from "../engine/catalog";
import { awardsOf, isAnonymous, isVoter, ownVote, playableCount, resultBallots, resultDeltas, resultNamed, resultTally } from "../engine/reduce";
import { withPercent } from "../engine/result";
import { AGAIN_STREAK } from "../engine/state";
import type { LikelyAwardView, LikelyExtras, LikelyMe, LikelyPublic, LikelyReveal, LikelyState } from "../engine/state";

/** State-only keys (platform `forbiddenKeys`, GAME-LIKELY §13.2): never in any view. */
export const FORBIDDEN_KEYS = ["votes", "ballotsAll", "picks", "rngState", "usedKeys", "memoryKeys", "drawnCount", "namedCount", "earlyEnd"] as const;

function revealOf(s: LikelyState): LikelyReveal | null {
  if (s.phase !== "REVEAL") return null;
  const r = s.results[s.results.length - 1];
  if (!r) return null;
  const anon = isAnonymous(s);
  const t = resultTally(s, r);
  let againId: string | null = null;
  const last = s.results.slice(-AGAIN_STREAK);
  if (last.length === AGAIN_STREAK) {
    const tops = last.map((x) => resultTally(s, x).topIds);
    againId = t.topIds.find((id) => tops.every((ids) => ids.includes(id))) ?? null;
  }
  return {
    votesCast: t.votesCast, counts: withPercent(t), topIds: [...t.topIds], unanimous: t.unanimous, chaos: t.chaos,
    none: t.votesCast === 0, againId,
    ballots: anon ? null : resultBallots(s, r),
    deltas: anon ? [] : resultDeltas(s, r),
  };
}

export function projectPublic(s: LikelyState): LikelyPublic {
  const anon = isAnonymous(s);
  const reveal = revealOf(s);
  const gained = new Map<string, number>();
  if (reveal) for (const d of reveal.deltas) gained.set(d.playerId, (gained.get(d.playerId) ?? 0) + d.points);
  const scores = s.players.map((p) => {
    const score = anon ? 0 : (s.scores[p.id] ?? 0);
    return { playerId: p.id, score, scoreBefore: score - (gained.get(p.id) ?? 0) };
  });
  const c = s.card;
  const awards: LikelyAwardView[] = awardsOf(s)
    .filter((a) => !anon || (a.kind !== "selfAware" && a.kind !== "mindReader"))
    .map((a) => {
      const r = a.cardIndex === null ? undefined : s.results[a.cardIndex];
      return {
        kind: a.kind, playerIds: [...a.playerIds], value: a.value,
        card: r && a.cardIndex !== null ? { index: a.cardIndex, id: r.cardId, prompt: r.prompt, award: r.award, namedPlayerId: resultNamed(s, r) } : null,
      };
    });
  return {
    schema: s.schema, phase: s.phase, cardIndex: s.cardIndex, cardCount: s.cardCount, deadline: s.deadline,
    card: c ? { id: c.cardId, prompt: c.prompt, award: c.award, spicy: c.spicy, namedPlayerId: c.namedPlayerId, rerun: c.rerun } : null,
    newIds: c ? s.players.filter((p) => !p.left && p.firstCard !== null && p.firstCard > 0 && p.firstCard === s.cardIndex).map((p) => p.id) : [],
    votedIds: s.phase === "VOTING" ? s.players.filter((p) => s.votes[p.id] !== undefined).map((p) => p.id) : [],
    reveal, scores, awards, showVoters: s.settings.showVoters, mode: s.settings.mode,
  };
}

/** Own phone only. Null for an id this instance does not know (benched members and spectators get none). */
export function projectMe(s: LikelyState, playerId: string): LikelyMe | null {
  const p = s.players.find((x) => x.id === playerId);
  if (!p) return null;
  return { myVote: p.left ? null : ownVote(s, playerId), waitingForNext: p.waiting && !p.left };
}

/** Envelope status: who has voted (never for whom) and who is awaited, in VOTING only. */
export function projectStatus(s: LikelyState): { phase: string; doneIds: string[]; awaitedIds: string[] } {
  if (s.phase !== "VOTING") return { phase: s.phase, doneIds: [], awaitedIds: [] };
  return {
    phase: s.phase,
    doneIds: s.players.filter((p) => s.votes[p.id] !== undefined).map((p) => p.id),
    awaitedIds: s.players.filter((p) => isVoter(p) && p.connected && s.votes[p.id] === undefined).map((p) => p.id),
  };
}

/** SETUP extras (JAMAA-PLATFORM §2.5): playable cards for these settings in the content language. */
export function projectSetup(settings: LikelySettings, _roster: readonly RosterEntry[], content: LikelyCatalog, _access: RoomAccess, locale: Locale, _memory?: GameMemory): LikelyExtras {
  return { gameId: "likely", available: playableCount(content, settings, locale) };
}

/** Likely has no secret leaf VALUE (player ids are public everywhere): its secrets are structural, see leakCheck. */
export function secretsFor(_s: LikelyState, _viewer: string | null): readonly unknown[] {
  return [];
}

// ---------- leakCheck ----------

interface Env { public: LikelyPublic; me: LikelyMe | null }

/** The game envelope of a room view ({game:{public,me}}), or a bare {public, me}. Null when the view holds no game. */
function envelope(view: unknown): Env | null {
  if (view === null || typeof view !== "object") return null;
  const v = view as Record<string, unknown>;
  const g = (v.game ?? v) as Record<string, unknown> | null;
  if (!g || typeof g !== "object" || !("public" in g)) return null;
  if ("gameId" in g && g.gameId !== "likely") return null;
  return { public: g.public as LikelyPublic, me: (g.me ?? null) as LikelyMe | null };
}

function walk(x: unknown, path: string[], on: (k: string, v: unknown, path: readonly string[]) => void): void {
  if (Array.isArray(x)) x.forEach((v, i) => walk(v, [...path, String(i)], on));
  else if (x !== null && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      on(k, v, path);
      walk(v, [...path, k], on);
    }
  }
}

/**
 * Structural leak rules (JAMAA-PLATFORM §2.11, GAME-LIKELY §8.1, §13.3): who voted for whom never before REVEAL and never
 * in secret mode (no `ballots`, `voterId`/`targetId` pair, delta, non-zero score or ballot-based award); a reveal only in
 * REVEAL; `votedIds` only in VOTING; `me` only on its owner's phone and holding only the owner's vote; family stays family.
 */
export function leakCheck(s: LikelyState, viewer: string | null, view: unknown): string[] {
  const env = envelope(view);
  if (!env) return [];
  const errs: string[] = [];
  const anon = isAnonymous(s);
  const pub = env.public;
  const revealing = s.phase === "REVEAL" && !anon;
  walk(pub, ["public"], (k, v, path) => {
    const at = [...path, k].join(".");
    if ((k === "ballots" && v !== null) || k === "voterId" || k === "targetId" || k === "myVote") {
      if (!revealing || k === "myVote") errs.push(`"${k}" at ${at}${anon ? " in secret mode" : ` in ${s.phase}`}`);
    }
    if (anon && (k === "score" || k === "scoreBefore") && v !== 0) errs.push(`score at ${at} in secret mode`);
    if (anon && k === "deltas" && Array.isArray(v) && v.length > 0) errs.push(`deltas at ${at} in secret mode`);
    if (anon && k === "kind" && (v === "selfAware" || v === "mindReader")) errs.push(`${String(v)} award at ${at} in secret mode`);
  });
  if (s.phase !== "REVEAL" && pub.reveal !== null) errs.push(`reveal in ${s.phase}`);
  if (s.phase !== "VOTING" && pub.votedIds.length > 0) errs.push(`votedIds in ${s.phase}`);
  if (s.phase === "VOTING" || s.phase === "CARD") {
    if (pub.scores.some((x) => x.score !== x.scoreBefore)) errs.push(`score moving in ${s.phase}`);
  }
  if (pub.mode === "family" && pub.card && (pub.card.spicy || pub.card.namedPlayerId !== null)) errs.push("spicy card in family mode");
  const me = env.me;
  if (me !== null) {
    if (viewer === null) errs.push("me in a TV, spectator or benched view");
    else {
      const mine = projectMe(s, viewer)?.myVote ?? null;
      if (me.myVote !== mine) errs.push(`myVote of ${viewer} is not their own vote`);
    }
    const keys = Object.keys(me).sort().join(",");
    if (keys !== "myVote,waitingForNext") errs.push(`me carries keys ${keys}`);
  }
  return errs;
}
