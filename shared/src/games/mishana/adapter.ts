// JAMAA-PLATFORM §2.7: how Mish Ana! plugs into the platform. The engine's rules, scoring, normalisation and
// invariants are unchanged; this file only translates between the room and the engine (server, sim, tests only).
import { COLORS, MIN_PLAYERS, SETTINGS_BOUNDS } from "../../constants";
import type { ErrorCode } from "../../protocol/errors";
import type { GameAction, GameCtx, GameDefinition, GameMemory, GameOutcome, GameReduceResult, RosterEntry } from "../types";
import type { RoomAccess } from "../../content/types";
import type { Locale } from "../../constants";
import { candidatePairs } from "./engine/catalog";
import type { Catalog } from "./engine/catalog";
import { assertInvariants, InvariantError } from "./engine/invariants";
import { syncHost, seedScores, extendFirstDeadline } from "./engine/platform";
import { currentSpeakerId } from "./engine/queries";
import { createInitialState, nextWakeAt, reduce } from "./engine/reduce";
import { effectiveRoleCounts } from "./engine/roles";
import { applySettingsPatch, DEFAULT_PACK_IDS, DEFAULT_SETTINGS } from "./engine/settings";
import type { Action, EngineError, GameState, Settings } from "./engine/types";
import { fullAccess, projectForPlayer, projectPublic as projectEnginePublic } from "./projection/project";
import { competitionRanking } from "../ranking";
import { cloneJson, isBool, isStringArray, normalizeByDefaults, oneOf } from "../settings-util";
import { MISHANA_META, type MishanaSettings } from "./meta";
import type { MishanaExtras, MishanaIntent, MishanaMe, MishanaPublic } from "./protocol";

export type MishanaDefinition = GameDefinition<GameState, MishanaSettings, MishanaIntent, MishanaPublic, MishanaMe, Catalog, MishanaExtras>;

const TV = { kind: "tv" } as const;
const SYS = { kind: "system" } as const;

/** Room settings + content locale → engine settings, in the engine's key order. */
export function toEngineSettings(s: MishanaSettings, locale: Locale): Settings {
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = k === "wordLocale" ? locale : cloneJson((s as Record<string, unknown>)[k]);
  return out as unknown as Settings;
}

/** Engine settings → room settings (drops `wordLocale`). */
export function fromEngineSettings(e: Settings): MishanaSettings {
  const { wordLocale: _drop, ...rest } = e;
  void _drop;
  return rest;
}

function mapError(e: EngineError): ErrorCode {
  return e === "NO_WORDS_AVAILABLE" ? "NO_CONTENT_AVAILABLE" : e;
}

const B = SETTINGS_BOUNDS;
const int = (v: unknown, min: number, max: number): boolean => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const timer = (b: { off: number; min: number; max: number }) => (v: unknown): boolean => v === b.off || int(v, b.min, b.max);
const VALID: { [K in keyof MishanaSettings]: (v: unknown) => boolean } = {
  winRule: oneOf(["official", "parity"]),
  revealRoles: isBool,
  roleMode: oneOf(["auto", "custom"]),
  undercoverCount: (v) => int(v, B.undercoverCount.min, B.undercoverCount.max),
  blankCount: (v) => int(v, B.blankCount.min, B.blankCount.max),
  clueSeconds: timer(B.clueSeconds),
  voteSeconds: timer(B.voteSeconds),
  revealSeconds: timer(B.revealSeconds),
  guessSeconds: timer(B.guessSeconds),
  tieBreak: oneOf(["random", "none"]),
  blankGuess: isBool,
  packIds: isStringArray(new RegExp(B.packIds.idRegex), B.packIds.maxItems),
  difficulties: (v) => Array.isArray(v) && v.length > 0 && v.every((d, i) => (d === 1 || d === 2 || d === 3) && (i === 0 || d > (v[i - 1] as number))),
  familyFilter: isBool,
  swapSides: isBool,
  points: (v) => {
    if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
    const p = v as Record<string, unknown>;
    return Object.keys(p).sort().join(",") === "blank,civilian,undercover" && ["civilian", "undercover", "blank"].every((k) => int(p[k], B.points.min, B.points.max));
  },
};

function toAction(a: GameAction<MishanaIntent>): Action {
  switch (a.type) {
    case "INTENT": return { ...a.intent, by: a.by } as Action;
    case "TICK": return { type: "TICK", by: SYS };
    case "PLAYER_AWAY": return { type: "DISCONNECT", playerId: a.playerId, by: SYS };
    case "PLAYER_BACK": return { type: "RECONNECT", playerId: a.playerId, by: SYS };
    case "PLAYER_GONE":
      // The room has already checked the permission; KICK goes through the TV so the history records the right cause.
      return a.cause === "LEAVE" ? { type: "LEAVE", by: { kind: "player", playerId: a.playerId } } : { type: "KICK", playerId: a.playerId, by: TV };
  }
}

function startBlocker(roster: readonly RosterEntry[], s: MishanaSettings, content: Catalog, locale: Locale): ErrorCode | null {
  if (roster.filter((r) => r.connected).length < MIN_PLAYERS) return "NOT_ENOUGH_PLAYERS";
  const e = toEngineSettings(s, locale);
  if (!effectiveRoleCounts(e, roster.length)) return "INVALID_ROLE_CONFIG";
  if (candidatePairs(content, e).length === 0) return "NO_CONTENT_AVAILABLE";
  return null;
}

function start(a: Parameters<MishanaDefinition["start"]>[0]): GameReduceResult<GameState> {
  const ctx = { now: a.now, catalog: a.content };
  const step = (s: GameState, action: Action): { ok: true; s: GameState } | { ok: false; error: ErrorCode } => {
    const r = reduce(s, action, ctx);
    return r.ok ? { ok: true, s: r.state } : { ok: false, error: mapError(r.error) };
  };
  let s = createInitialState({ roomCode: "", joinUrl: "", seed: a.seed, wordLocale: a.locale });
  // The room owns the host from the first JOIN on: the engine's reassignHost is bypassed, and reduce syncs the host.
  s = syncHost(s, null);
  const roster = [...a.roster].sort((x, y) => x.seat - y.seat);
  for (const [i, r] of roster.entries()) {
    const color = COLORS[i]?.id;
    if (!color) return { ok: false, error: "ROOM_FULL", state: s };
    const j = step(s, { type: "JOIN", playerId: r.id, name: `p${r.seat}`, color, locale: r.locale, by: SYS });
    if (!j.ok) return { ok: false, error: j.error, state: s };
    s = j.s;
  }
  for (const r of roster) {
    if (r.connected) continue;
    const d = step(s, { type: "DISCONNECT", playerId: r.id, by: SYS });
    /* v8 ignore next */
    if (!d.ok) return { ok: false, error: d.error, state: s };
    s = d.s;
  }
  s = syncHost(s, null);
  s = seedScores(s, Object.fromEntries(roster.map((r) => [r.id, r.carryScore])));
  s = { ...s, usedPairKeys: [...a.memory.usedKeys] };
  const u = step(s, { type: "UPDATE_SETTINGS", patch: toEngineSettings(a.settings, a.locale), by: TV });
  if (!u.ok) return { ok: false, error: u.error, state: s };
  const st = step(u.s, { type: "START", by: TV });
  if (!st.ok) return { ok: false, error: st.error, state: s };
  return { ok: true, state: extendFirstDeadline(st.s, a.graceMs) };
}

function gameReduce(s: GameState, a: GameAction<MishanaIntent>, ctx: GameCtx<Catalog>): GameReduceResult<GameState> {
  const synced = syncHost(s, ctx.hostPlayerId);
  const r = reduce(synced, toAction(a), { now: ctx.now, catalog: ctx.content });
  if (!r.ok) return { ok: false, error: mapError(r.error), state: s };
  return { ok: true, state: r.state };
}

function outcome(s: GameState): GameOutcome | null {
  if (s.phase !== "RESULTS" || !s.result) return null;
  const points: Record<string, number> = {};
  for (const p of s.players) points[p.id] = p.left ? 0 : (s.result.pointsAwarded[p.id] ?? 0);
  const left = new Set(s.players.filter((p) => p.left).map((p) => p.id));
  return { points, ranking: competitionRanking(points, s.players.map((p) => p.id), left) };
}

/** Today's PublicView minus the room-level keys, with only the game fields of each player (§2.5). */
function projectPublic(s: GameState, content: Catalog): MishanaPublic {
  const v = projectEnginePublic(s, content, fullAccess(content));
  return {
    phase: v.phase,
    gameNumber: v.gameNumber,
    round: v.round,
    settings: v.settings,
    players: v.players.map((p) => ({
      id: p.id, alive: p.alive, left: p.left, ready: p.ready, spoke: p.spoke, hasVoted: p.hasVoted, revealedRole: p.revealedRole, score: p.score,
    })),
    roleCounts: v.roleCounts,
    speakingOrder: v.speakingOrder,
    currentSpeakerId: v.currentSpeakerId,
    revote: v.revote,
    tieCandidates: v.tieCandidates,
    deadline: v.deadline,
    votesCast: v.votesCast,
    votesExpected: v.votesExpected,
    lastVote: v.lastVote,
    eliminated: v.eliminated,
    guess: v.guess,
    result: v.result,
    history: v.history,
  };
}

function projectStatus(s: GameState): { phase: string; doneIds: string[]; awaitedIds: string[] } {
  const live = s.players.filter((p) => !p.left);
  switch (s.phase) {
    case "ROLE_REVEAL":
      return { phase: s.phase, doneIds: live.filter((p) => p.ready).map((p) => p.id), awaitedIds: live.filter((p) => !p.ready && p.connected).map((p) => p.id) };
    case "CLUES":
    case "TIE_BREAK": {
      const sp = currentSpeakerId(s);
      return { phase: s.phase, doneIds: live.filter((p) => p.alive && p.spoke).map((p) => p.id), awaitedIds: sp ? [sp] : [] };
    }
    case "VOTING": {
      const voters = live.filter((p) => p.alive && p.connected);
      return { phase: s.phase, doneIds: voters.filter((p) => s.votes[p.id] !== undefined).map((p) => p.id), awaitedIds: voters.filter((p) => s.votes[p.id] === undefined).map((p) => p.id) };
    }
    case "MR_WHITE_GUESS":
      return { phase: s.phase, doneIds: [], awaitedIds: s.guess?.status === "PENDING" ? [s.guess.playerId] : [] };
    default:
      return { phase: s.phase, doneIds: [], awaitedIds: [] };
  }
}

function secretsFor(s: GameState, viewer: string | null): readonly unknown[] {
  const out = new Set<string>();
  const pair = s.pair;
  const results = s.phase === "RESULTS";
  const me = viewer === null ? undefined : s.players.find((p) => p.id === viewer);
  const own = new Set<string>();
  if (me?.word) {
    own.add(me.word.text);
    if (me.word.translit) own.add(me.word.translit);
  }
  if (pair) {
    const texts = new Set<string>();
    for (const side of [pair.civilian, pair.undercover]) {
      texts.add(side.text);
      if (side.translit) texts.add(side.translit);
    }
    for (const side of [pair.civilian, pair.undercover]) for (const a of side.alt) if (!texts.has(a)) out.add(a);
    if (!results) for (const t of texts) if (!own.has(t)) out.add(t);
  }
  if (!results) for (const g of [...s.guessLog, ...(s.guess ? [s.guess] : [])]) if (g.text && !own.has(g.text)) out.add(g.text);
  return [...out];
}

interface EnvelopeLike { public: MishanaPublic; me: MishanaMe | null }
function leakCheck(s: GameState, viewer: string | null, view: unknown): string[] {
  const errs: string[] = [];
  const env = (view as { game?: EnvelopeLike | null } | null)?.game;
  if (!env) return errs;
  const results = s.phase === "RESULTS";
  const v = env.public;
  if (!results && v.guess && v.guess.text !== null) errs.push("guess.text before RESULTS");
  if (!results && v.result !== null) errs.push("result before RESULTS");
  for (const p of v.players) if (p.alive && !results && p.revealedRole !== null) errs.push(`alive role revealed for ${p.id}`);
  const me = env.me;
  if (me !== null && me.id !== viewer) errs.push(`me of ${me.id} in the view of ${viewer ?? "tv"}`);
  const mp = me === null ? undefined : s.players.find((p) => p.id === me.id);
  if (me && mp && !results && me.role !== null && !s.settings.revealRoles && mp.alive) errs.push("own role shown while alive");
  if (me && me.myVote !== null && s.phase !== "VOTING") errs.push("myVote outside VOTING");
  return errs;
}

export const mishanaDefinition: MishanaDefinition = {
  meta: MISHANA_META,
  enabled: true,
  stateSchema: 1,   // engine GameState.schema
  settings: {
    apply(s, patch, content, locale) {
      if ("wordLocale" in patch) return null;
      const next = applySettingsPatch(toEngineSettings(s, locale), patch, content);
      return next ? fromEngineSettings(next) : null;
    },
    normalize(raw) {
      return normalizeByDefaults(raw, MISHANA_META.settings.defaults, (k, v) => VALID[k](v));
    },
    restrict(s, a) {
      const ids = new Set([...a.playableIds, ...DEFAULT_PACK_IDS]);
      const packIds = s.packIds.filter((id) => ids.has(id));
      const resetPoints = !a.premium && JSON.stringify(s.points) !== JSON.stringify(MISHANA_META.settings.defaults.points);
      if (packIds.length === s.packIds.length && !resetPoints) return s;
      return { ...s, packIds, points: resetPoints ? { ...MISHANA_META.settings.defaults.points } : s.points };
    },
    packIds(s) {
      return s.packIds;
    },
  },
  start,
  reduce: gameReduce,
  nextWakeAt,
  outcome,
  memory(s): GameMemory {
    return { usedKeys: [...s.usedPairKeys] };
  },
  startBlocker,
  projectSetup(s, roster, content, access: RoomAccess, locale, memory): MishanaExtras {
    const e = toEngineSettings(s, locale);
    let poolExhausted = false;
    if (!access.premium) {
      const pool = candidatePairs(content, e);
      const used = new Set(memory.usedKeys);
      poolExhausted = pool.length > 0 && pool.every((q) => used.has(q.key));
    }
    return { gameId: "mishana", roleCounts: effectiveRoleCounts(e, roster.length), poolExhausted };
  },
  projectPublic,
  projectMe(s, playerId, content) {
    if (!s.players.some((p) => p.id === playerId)) return null;
    return projectForPlayer(s, content, playerId, fullAccess(content)).me;
  },
  projectStatus,
  assertInvariants(s) {
    assertInvariants(s);
    if (s.phase === "LOBBY") throw new InvariantError("mishana: engine phase LOBBY while PLAYING");
  },
  secretsFor,
  leakCheck,
  forbiddenKeys: ["votes", "guessLog", "pair", "alt", "rngState", "usedPairKeys", "deadlineSeq", "disconnectedAt", "joinedAt", "externalHost", "turnIdx", "starterId"],
};
