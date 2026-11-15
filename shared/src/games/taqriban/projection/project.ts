// GAME-TAQRIBAN §8.1 secrecy and §13.2 views. Before REVEAL nothing projected carries the answer or anyone's guess:
// the TV and the phones only learn WHO has guessed (`answeredIds`); a phone's own guess travels in its `me` alone.
import type { Locale } from "../../../constants";
import type { RoomAccess } from "../../../content/types";
import type { GameMemory, RosterEntry } from "../../types";
import { BULLSEYE_POINTS, modeOf, useLogLine } from "../constants";
import type { TaqribanSettings } from "../meta";
import { awaitedPlayers, canPlay, isFinalIndex, playableCount, ranksOf } from "../engine/reduce";
import type { TaqReveal, TaqScore, TaqribanCatalog, TaqribanExtras, TaqribanMe, TaqribanPublic, TaqribanState } from "../engine/types";

/** State-only keys (platform `forbiddenKeys`): never in any view. */
/** (`guesses` is not listed: the REVEAL view has a `guesses` list; leakCheck refuses it anywhere else.) */
export const FORBIDDEN_KEYS = ["rngState", "usedKeys", "questionIds", "skippedIds", "boardScore", "boardRank", "ref"] as const;

function revealOf(s: TaqribanState): TaqReveal | null {
  const r = s.last;
  if (s.phase !== "REVEAL" || !r) return null;
  const guessed = r.rows.filter((x) => x.value !== null);
  const seat = new Map(s.players.map((p) => [p.id, p.seat]));
  const guesses = guessed
    .map((x) => ({ id: x.id, value: x.value as number, rank: x.rank as number, closest: x.closest, bullseye: x.bullseye, points: x.points }))
    .sort((a, b) => a.value - b.value || (seat.get(a.id) ?? 0) - (seat.get(b.id) ?? 0));
  return {
    answer: r.answer, source: r.source, mode: modeOf(r.answer), logLine: useLogLine([r.answer, ...guesses.map((g) => g.value)]),
    guesses, missingIds: r.rows.filter((x) => x.value === null).map((x) => x.id),
    closestIds: [...r.closestIds], bullseyeIds: [...r.bullseyeIds], wildId: r.wildId,
  };
}

function scoresOf(s: TaqribanState): TaqScore[] {
  const ranks = ranksOf(s.players);
  const lastPts = new Map((s.phase === "REVEAL" && s.last ? s.last.rows : []).map((x) => [x.id, x.points]));
  // REVEAL: the score before this question's points; LEADERBOARD and RESULTS: the race from the previous board.
  const race = s.phase === "LEADERBOARD" || s.phase === "RESULTS";
  let before: Map<string, number> | null = null;
  if (s.phase === "REVEAL") {
    const prev = s.players.map((p) => ({ ...p, score: p.score - (lastPts.get(p.id) ?? 0), closest: p.closest - (s.last?.closestIds.includes(p.id) ? 1 : 0), bullseyes: p.bullseyes - (s.last?.bullseyeIds.includes(p.id) ? 1 : 0) }));
    before = ranksOf(prev);
  }
  return s.players.map((p) => ({
    playerId: p.id,
    score: p.score,
    scoreBefore: s.phase === "REVEAL" ? p.score - (lastPts.get(p.id) ?? 0) : race ? Math.min(p.boardScore, p.score) : p.score,
    rank: p.left ? null : (ranks.get(p.id) ?? null),
    rankBefore: p.left ? null : before ? (before.get(p.id) ?? null) : race ? p.boardRank : (ranks.get(p.id) ?? null),
    closest: p.closest,
    bullseyes: p.bullseyes,
    left: p.left,
  }));
}

export function projectPublic(s: TaqribanState): TaqribanPublic {
  const q = s.cur;
  const asking = s.phase === "QUESTION";
  return {
    schema: s.schema, phase: s.phase, index: s.index, total: s.questionIds.length,
    isFinal: isFinalIndex(s, s.phase === "FINAL_INTRO" ? s.index + 1 : s.index) && s.phase !== "LEADERBOARD",
    deadline: s.deadline?.at ?? null, durationMs: s.deadline?.durationMs ?? null,
    question: q ? { id: q.id, text: q.text, unit: q.unit } : null,
    answeredIds: asking ? s.players.filter((p) => s.guesses[p.id] !== undefined).map((p) => p.id) : [],
    reveal: revealOf(s),
    scores: scoresOf(s),
    newIds: q ? s.players.filter((p) => !p.left && p.newAt !== null && p.newAt > 0 && p.newAt === s.index).map((p) => p.id) : [],
    waitingIds: s.players.filter((p) => !p.left && p.waiting).map((p) => p.id),
    rerun: s.rerun,
    endedEarly: s.endedEarly,
  };
}

/** Own phone only. Null for an id this instance does not know. */
export function projectMe(s: TaqribanState, playerId: string): TaqribanMe | null {
  const p = s.players.find((x) => x.id === playerId);
  if (!p) return null;
  let myGuess: number | null = null;
  if (!p.left && s.phase === "QUESTION") myGuess = s.guesses[playerId] ?? null;
  if (!p.left && s.phase === "REVEAL") myGuess = s.last?.rows.find((x) => x.id === playerId)?.value ?? null;
  return { myGuess, waitingForNext: p.waiting && !p.left };
}

/** Envelope status: who has guessed (never what) and who is awaited, in QUESTION only. */
export function projectStatus(s: TaqribanState): { phase: string; doneIds: string[]; awaitedIds: string[] } {
  if (s.phase !== "QUESTION") return { phase: s.phase, doneIds: [], awaitedIds: [] };
  return {
    phase: s.phase,
    doneIds: s.players.filter((p) => canPlay(p) && s.guesses[p.id] !== undefined).map((p) => p.id),
    awaitedIds: awaitedPlayers(s).map((p) => p.id),
  };
}

export function projectSetup(settings: TaqribanSettings, _roster: readonly RosterEntry[], content: TaqribanCatalog, _access: RoomAccess, locale: Locale, _memory?: GameMemory): TaqribanExtras {
  return { gameId: "taqriban", available: playableCount(content, settings, locale) };
}

/**
 * Before REVEAL, the answer is a secret leaf for every viewer (whole-leaf equality on the number), unless it equals a
 * public counter of the same view (question index or total, a score, the timer), which whole-leaf equality cannot tell apart.
 */
export function secretsFor(s: TaqribanState, viewer: string | null): readonly unknown[] {
  if (s.phase !== "QUESTION" || !s.cur) return [];
  // A phone whose own guess is spot on carries that number in its `me`: not a leak.
  if (viewer !== null && s.guesses[viewer] === s.cur.answer) return [];
  const pub = new Set<number>([...Array.from({ length: 21 }, (_, k) => k), s.schema, s.index, s.questionIds.length, s.deadline?.at ?? -1, s.deadline?.durationMs ?? -1, ...s.players.flatMap((p) => [p.score, p.closest, p.bullseyes])]);
  // Points (this game's and the cup's) are multiples of 500: an answer that looks like a score is left to leakCheck.
  const scoreLike = s.cur.answer % BULLSEYE_POINTS === 0 && s.cur.answer <= 1_000_000;
  return pub.has(s.cur.answer) || scoreLike ? [] : [s.cur.answer];
}

// ---------- leakCheck ----------

interface Env { public: TaqribanPublic; me: TaqribanMe | null }

function envelope(view: unknown): Env | null {
  if (view === null || typeof view !== "object") return null;
  const v = view as Record<string, unknown>;
  const g = (v.game ?? v) as Record<string, unknown> | null;
  if (!g || typeof g !== "object" || !("public" in g)) return null;
  if ("gameId" in g && g.gameId !== "taqriban") return null;
  return { public: g.public as TaqribanPublic, me: (g.me ?? null) as TaqribanMe | null };
}

/**
 * Structural rules: no reveal (answer, guesses) outside REVEAL; `answeredIds` only in QUESTION and never with values;
 * `me` only on its owner's phone, holding only the owner's own guess.
 */
export function leakCheck(s: TaqribanState, viewer: string | null, view: unknown): string[] {
  const env = envelope(view);
  if (!env) return [];
  const errs: string[] = [];
  const pub = env.public;
  if (s.phase !== "REVEAL" && pub.reveal !== null) errs.push(`reveal in ${s.phase}`);
  if (s.phase !== "QUESTION" && pub.answeredIds.length > 0) errs.push(`answeredIds in ${s.phase}`);
  const walk = (x: unknown, path: string): void => {
    if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${path}.${i}`));
    else if (x !== null && typeof x === "object") {
      for (const [k, v] of Object.entries(x)) {
        if ((k === "answer" || k === "value" || k === "guesses") && !path.startsWith("public.reveal")) errs.push(`"${k}" at ${path}.${k}`);
        if (k === "myGuess") errs.push(`"myGuess" in the public view at ${path}`);
        walk(v, `${path}.${k}`);
      }
    }
  };
  walk(pub, "public");
  const me = env.me;
  if (me !== null) {
    if (viewer === null) errs.push("me in a TV, spectator or benched view");
    else if (me.myGuess !== (projectMe(s, viewer)?.myGuess ?? null)) errs.push(`myGuess of ${viewer} is not their own guess`);
    const keys = Object.keys(me).sort().join(",");
    if (keys !== "myGuess,waitingForNext") errs.push(`me carries keys ${keys}`);
  }
  return errs;
}
