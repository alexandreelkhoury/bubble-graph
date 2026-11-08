// JAMAA-PLATFORM §2.3–§2.5: the platform room engine. Pure: no I/O, no Date.now(), no Math.random(); time comes from
// ctx.now and randomness from RoomState.rngState. Never mutates its inputs and returns the SAME objects when nothing
// changed. Membership and host rules are SPEC §4.8 moved up one level.
import { COLORS, CUP_STARS, ENTRANCE_GRACE_MS, HISTORY_GAMES_MAX, LOCALES, MAX_PLAYERS, MEMORY_MAX_KEYS, REACTION_MIN_GAP_MS, SEAT_HOLD_MS } from "../constants";
import type { Locale } from "../constants";
import type { ContentCatalog } from "../content/catalog";
import { GAME_IDS, isGameId } from "../games/ids";
import type { GameId } from "../games/ids";
import { GAME_CONTENT, GAME_DEFS } from "../games/registry";
import { cloneJson } from "../games/settings-util";
import type { AnyGameDefinition, GameAction, GameActor, GameCtx, GameMemory, GameOutcome, RosterEntry } from "../games/types";
import { nameKey, sanitizeName } from "../games/mishana/engine/sanitize";
import type { ErrorCode } from "../protocol/errors";
import { REACTIONS } from "./types";
import type { Member, RoomAction, RoomActor, RoomCtx, RoomHistory, RoomIntent, RoomReduceResult, RoomState, RoomSystemAction } from "./types";
import { createRng } from "./rng";
import type { Rng } from "./rng";

export const ROOM_SCHEMA = 2 as const;

/** A new room in HUB with every game's default settings. */
export function createRoomState(a: { roomCode: string; joinUrl: string; seed: number; contentLocale: Locale }): RoomState {
  return {
    schema: ROOM_SCHEMA,
    roomCode: a.roomCode,
    joinUrl: a.joinUrl,
    version: 0,
    phase: "HUB",
    setupGameId: null,
    contentLocale: a.contentLocale,
    members: [],
    hostPlayerId: null,
    tvGames: [],
    gameSettings: {
      mishana: cloneJson(GAME_DEFS.mishana.meta.settings.defaults),
      bluff: cloneJson(GAME_DEFS.bluff.meta.settings.defaults),
      likely: cloneJson(GAME_DEFS.likely.meta.settings.defaults),
      trivia: cloneJson(GAME_DEFS.trivia.meta.settings.defaults),
    },
    settingsSchema: {
      mishana: GAME_DEFS.mishana.meta.SETTINGS_SCHEMA,
      bluff: GAME_DEFS.bluff.meta.SETTINGS_SCHEMA,
      likely: GAME_DEFS.likely.meta.SETTINGS_SCHEMA,
      trivia: GAME_DEFS.trivia.meta.SETTINGS_SCHEMA,
    },
    game: null,
    cup: { stars: {}, last: null, matchScores: {} },
    rngState: a.seed >>> 0,
  };
}

export function createRoomHistory(): RoomHistory {
  return { memory: {}, games: [] };
}

/** §2.5: `room.games` = enabled (GAMES_ENABLED ∩ registry) ∩ the TV's games at the server's VIEW_VERSION, GAME_IDS order. */
export function roomGames(state: RoomState, enabled: readonly GameId[]): GameId[] {
  return GAME_IDS.filter((id) => enabled.includes(id) && state.tvGames.some((g) => g.id === id && g.v === GAME_DEFS[id].meta.VIEW_VERSION));
}

/** §5.3: a game is available in a locale when its catalog has a pack whose languages include it. */
export function gameAvailable(content: ContentCatalog, id: GameId, locale: Locale): boolean {
  const adapter = GAME_CONTENT[id];
  return (content[id].packs as unknown[]).some((p) => adapter.meta(p).languages.includes(locale));
}

/** min(HUB/SETUP seat expiries, the active game's nextWakeAt). */
export function nextRoomWakeAt(state: RoomState): number | null {
  if (state.phase === "PLAYING") return state.game ? GAME_DEFS[state.game.id].nextWakeAt(state.game.state) : null;
  let at: number | null = null;
  for (const m of state.members) {
    if (!m.connected && m.disconnectedAt !== null) {
      const t = m.disconnectedAt + SEAT_HOLD_MS;
      if (at === null || t < at) at = t;
    }
  }
  return at;
}

/** The active game's outcome (null outside PLAYING or before its final phase). */
export function roomOutcome(state: RoomState): GameOutcome | null {
  return state.game ? GAME_DEFS[state.game.id].outcome(state.game.state) : null;
}

/** Members dealt into a new instance: not left, seat order (benched ones are dealt in by the caller first). */
export function rosterOf(state: RoomState, gameId: GameId): RosterEntry[] {
  const carry = GAME_DEFS[gameId].meta.carriesScore ? (state.cup.matchScores[gameId] ?? {}) : {};
  return state.members
    .filter((m) => !m.left && !m.benched)
    .map((m) => ({ id: m.id, seat: m.seat, locale: m.locale, connected: m.connected, carryScore: carry[m.id] ?? 0 }));
}

// ---------------------------------------------------------------- draft helpers

interface Draft { s: RoomState; h: RoomHistory; now: number; ctx: RoomCtx; rng: Rng }
type Err = ErrorCode | null;

const def = (id: GameId): AnyGameDefinition => GAME_DEFS[id];
const findMember = (s: RoomState, id: string): Member | undefined => s.members.find((m) => m.id === id);
const isHost = (s: RoomState, by: RoomActor): boolean => by.kind === "tv" || by.playerId === s.hostPlayerId;
const inGame = (m: Member): boolean => !m.left && !m.benched;

/** SPEC §4.8: the earliest joiner still here, connected first; while PLAYING, members in the game before benched ones. */
function reassignHost(s: RoomState): void {
  const live = s.members.filter((m) => !m.left).sort((a, b) => a.joinedAt - b.joinedAt || a.seat - b.seat);
  const playing = s.phase === "PLAYING";
  const pick =
    live.find((m) => m.connected && (!playing || !m.benched)) ??
    live.find((m) => !playing || !m.benched) ??
    live.find((m) => m.connected) ??
    live[0];
  s.hostPlayerId = pick?.id ?? null;
}

function removeMember(s: RoomState, id: string): void {
  s.members = s.members.filter((m) => m.id !== id);
  delete s.cup.stars[id];
  if (s.hostPlayerId === id) reassignHost(s);
}

function capMemory(m: GameMemory): GameMemory {
  return { usedKeys: m.usedKeys.slice(-MEMORY_MAX_KEYS) };
}

function gameCtx(d: Draft, id: GameId): GameCtx<unknown> {
  const host = d.s.hostPlayerId;
  return {
    now: d.now,
    content: d.ctx.content[id],
    isHost: (a: GameActor) => a.kind === "tv" || a.playerId === host,
    hostPlayerId: host,
  };
}

/** Sends one action into the active game; awards the outcome once, on the step that reaches it. */
function runGame(d: Draft, action: GameAction<unknown>): Err {
  const g = d.s.game;
  /* v8 ignore next */
  if (!g) return "NOT_IN_GAME";
  const gd = def(g.id);
  const before = gd.outcome(g.state);
  const r = gd.reduce(g.state, action, gameCtx(d, g.id));
  if (!r.ok) return r.error;
  g.state = r.state;
  if (before === null) {
    const out = gd.outcome(g.state);
    if (out !== null) award(d, g.id, g.n, out, gd.memory(g.state));
  }
  return null;
}

/**
 * §2.4: stars from a standard competition ranking (1, 1, 3): 1st place +3, 2nd +2, 3rd +1, by place (a tie shares the
 * place; the next group's place skips). With fewer than 3 ranked players only 1st place scores.
 */
export function cupStars(ranking: readonly (readonly string[])[]): Record<string, number> {
  const out: Record<string, number> = {};
  const ranked = ranking.reduce((k, grp) => k + grp.length, 0);
  let place = 1;
  for (const grp of ranking) {
    const stars = place <= CUP_STARS.length && (ranked >= 3 || place === 1) ? (CUP_STARS[place - 1] as number) : 0;
    if (stars > 0) for (const pid of grp) out[pid] = stars;
    place += grp.length;
  }
  return out;
}

/** §2.4: native points into matchScores, stars from the competition ranking, the cup entry and the history. */
function award(d: Draft, id: GameId, n: number, out: GameOutcome, memory: GameMemory): void {
  const s = d.s;
  const scores = { ...(s.cup.matchScores[id] ?? {}) };
  for (const [pid, pts] of Object.entries(out.points)) if (findMember(s, pid)) scores[pid] = (scores[pid] ?? 0) + pts;
  s.cup.matchScores[id] = scores;
  for (const [pid, stars] of Object.entries(cupStars(out.ranking))) if (findMember(s, pid)) s.cup.stars[pid] = (s.cup.stars[pid] ?? 0) + stars;
  const ranking = out.ranking.map((grp) => [...grp]);
  s.cup.last = { gameId: id, n, ranking, points: { ...out.points } };
  d.h.games = [...d.h.games, { gameId: id, n, ranking, endedAt: d.now }].slice(-HISTORY_GAMES_MAX);
  d.h.memory[id] = capMemory(memory);
}

/** Ends the active instance (REPLAY, BACK_TO_SETUP, BACK_TO_HUB, ABORT_GAME): left members go, benched ones come in. */
function endInstance(d: Draft): void {
  const s = d.s;
  const g = s.game;
  if (g) d.h.memory[g.id] = capMemory(def(g.id).memory(g.state));
  s.game = null;
  for (const m of s.members.filter((x) => x.left)) removeMember(s, m.id);
  for (const m of s.members) {
    m.benched = false;
    if (!m.connected) m.disconnectedAt = d.now;   // the HUB/SETUP seat hold restarts
  }
}

function nextInstanceNumber(d: Draft): number {
  return Math.max(d.s.cup.last?.n ?? 0, d.h.games[d.h.games.length - 1]?.n ?? 0, d.s.game?.n ?? 0) + 1;
}

/** Deals a new instance of the setup game (START_GAME and REPLAY). */
function startInstance(d: Draft, n: number): Err {
  const s = d.s;
  const id = s.setupGameId;
  /* v8 ignore next */
  if (!id) return "WRONG_PHASE";
  const gd = def(id);
  for (const m of s.members) m.benched = false;
  const roster = rosterOf(s, id);
  if (roster.length > gd.meta.maxPlayers) return "GAME_FULL";
  const settings = s.gameSettings[id];
  const content = d.ctx.content[id];
  const blocker = gd.startBlocker(roster, settings, content, s.contentLocale);
  if (blocker) return blocker;
  const seed = Math.floor(d.rng.next() * 4294967296) >>> 0;
  const memory = d.h.memory[id] ?? { usedKeys: [] };
  const r = gd.start({ roster, settings, locale: s.contentLocale, memory, seed, now: d.now, graceMs: ENTRANCE_GRACE_MS, content });
  if (!r.ok) return r.error;
  s.game = { id, n, state: r.state };
  s.phase = "PLAYING";
  return null;
}

/** Keeps a game's settings valid for the content language (§2.5 SET_CONTENT_LOCALE): pack filters that do not fit reset. */
function fitSettings(d: Draft, id: GameId): void {
  const s = d.s;
  const gd = def(id);
  const cur = s.gameSettings[id];
  const content = d.ctx.content[id];
  if (gd.settings.apply(cur, {}, content, s.contentLocale) !== null) return;
  const defaults = gd.meta.settings.defaults as Record<string, unknown>;
  const packReset: Record<string, unknown> = {};
  for (const f of [...gd.meta.settings.basic, ...gd.meta.settings.advanced]) if (f.kind === "packs" && f.key in defaults) packReset[f.key] = cloneJson(defaults[f.key]);
  const fixed = gd.settings.apply(cur, packReset, content, s.contentLocale);
  (s.gameSettings as Record<GameId, unknown>)[id] = fixed ?? cloneJson(defaults);
}

function playableIds(d: Draft, id: GameId): ReadonlySet<string> {
  const adapter = GAME_CONTENT[id];
  return new Set((d.ctx.content[id].packs as unknown[]).map((p) => adapter.meta(p).family));
}

function restrict(d: Draft, id: GameId): void {
  const s = d.s;
  const cur = s.gameSettings[id];
  const next = def(id).settings.restrict(cur, { playableIds: playableIds(d, id), premium: d.ctx.access.premium }, d.ctx.content[id], s.contentLocale);
  if (next !== cur) (s.gameSettings as Record<GameId, unknown>)[id] = next;
}

/** LEAVE / KICK: removed at once in HUB, SETUP or when benched; marked left (and the game told) while in a game. */
function depart(d: Draft, m: Member, cause: "LEAVE" | "KICK"): Err {
  const s = d.s;
  if (s.phase !== "PLAYING" || m.benched) {
    removeMember(s, m.id);
    return null;
  }
  m.left = true;
  m.connected = false;
  m.disconnectedAt = d.now;
  if (s.hostPlayerId === m.id) reassignHost(s);
  return runGame(d, { type: "PLAYER_GONE", playerId: m.id, cause });
}

// ---------------------------------------------------------------- intents

function applyIntent(d: Draft, a: RoomIntent, by: RoomActor): Err {
  const s = d.s;
  const me = by.kind === "player" ? (findMember(s, by.playerId) as Member) : null;
  const host = isHost(s, by);
  const outcome = (): GameOutcome | null => roomOutcome(s);
  switch (a.type) {
    case "HUB_FOCUS":
      /* v8 ignore next */
      return null; // validated (and kept out of the state) by reduceRoom
    case "OPEN_GAME": {
      if (s.phase !== "HUB") return "WRONG_PHASE";
      if (!host) return "NOT_HOST";
      if (!isGameId(a.gameId)) return "UNKNOWN_GAME";
      if (!d.ctx.enabledGames.includes(a.gameId)) return "GAME_DISABLED";
      if (!roomGames(s, d.ctx.enabledGames).includes(a.gameId)) return "GAME_UNAVAILABLE";
      if (!gameAvailable(d.ctx.content, a.gameId, s.contentLocale)) return "GAME_UNAVAILABLE";
      s.phase = "SETUP";
      s.setupGameId = a.gameId;
      fitSettings(d, a.gameId);
      return null;
    }
    case "CLOSE_GAME":
      if (s.phase !== "SETUP") return "WRONG_PHASE";
      if (!host) return "NOT_HOST";
      s.phase = "HUB";
      s.setupGameId = null;
      return null;
    case "SET_CONTENT_LOCALE":
      if (s.phase === "PLAYING") return "WRONG_PHASE";
      if (!host) return "NOT_HOST";
      if (!(LOCALES as readonly string[]).includes(a.locale)) return "BAD_MESSAGE";
      s.contentLocale = a.locale;
      for (const id of GAME_IDS) fitSettings(d, id);
      return null;
    case "UPDATE_GAME_SETTINGS": {
      if (s.phase !== "SETUP") return "WRONG_PHASE";
      if (!host) return "NOT_HOST";
      if (a.gameId !== s.setupGameId) return "WRONG_GAME";
      const next = def(a.gameId).settings.apply(s.gameSettings[a.gameId], a.patch, d.ctx.content[a.gameId], s.contentLocale);
      if (next === null) return "INVALID_SETTINGS";
      (s.gameSettings as Record<GameId, unknown>)[a.gameId] = next;
      return null;
    }
    case "START_GAME":
      if (s.phase !== "SETUP") return "WRONG_PHASE";
      if (!host) return "NOT_HOST";
      return startInstance(d, nextInstanceNumber(d));
    case "GAME": {
      if (s.phase !== "PLAYING" || !s.game) return "NOT_IN_GAME";
      if (a.gameId !== s.game.id) return "WRONG_GAME";
      if (me && !inGame(me)) return "NOT_IN_GAME";
      return runGame(d, { type: "INTENT", intent: a.i, by });
    }
    case "REPLAY": {
      if (s.phase !== "PLAYING" || outcome() === null) return "WRONG_PHASE";
      if (!host) return "NOT_HOST";
      const n = nextInstanceNumber(d);
      endInstance(d);
      return startInstance(d, n);
    }
    case "BACK_TO_SETUP":
      if (s.phase !== "PLAYING" || outcome() === null) return "WRONG_PHASE";
      if (!host) return "NOT_HOST";
      endInstance(d);
      s.phase = "SETUP";
      return null;
    case "BACK_TO_HUB":
      if (!(s.phase === "SETUP" || (s.phase === "PLAYING" && outcome() !== null))) return "WRONG_PHASE";
      if (!host) return "NOT_HOST";
      endInstance(d);
      s.phase = "HUB";
      s.setupGameId = null;
      return null;
    case "ABORT_GAME":
      if (s.phase !== "PLAYING" || outcome() !== null) return "WRONG_PHASE";
      if (!host) return "NOT_HOST";
      endInstance(d);   // no stars, matchScores unchanged, memory kept
      s.phase = "SETUP";
      return null;
    case "REACT": {
      if (!me) return "BAD_MESSAGE";
      if (!(REACTIONS as readonly string[]).includes(a.kind)) return "BAD_MESSAGE";
      if (me.reaction && d.now - me.reaction.at < REACTION_MIN_GAP_MS) return "REACTION_TOO_FAST";
      me.reaction = { kind: a.kind, at: d.now, n: (me.reaction?.n ?? 0) + 1 };
      return null;
    }
    case "KICK": {
      if (!host) return "NOT_HOST";
      const t = findMember(s, a.playerId);
      if (!t || t.left) return "INVALID_TARGET";
      if (me && t.id === me.id) return "INVALID_TARGET";
      if (me && s.phase === "PLAYING" && inGame(t) && t.connected) return "INVALID_TARGET";  // VIP: only absent players
      return depart(d, t, "KICK");
    }
    case "LEAVE":
      if (!me) return "BAD_MESSAGE";
      return depart(d, me, "LEAVE");
  }
}

// ---------------------------------------------------------------- system

function applySystem(d: Draft, a: RoomSystemAction): Err {
  const s = d.s;
  switch (a.type) {
    case "JOIN": {
      if (s.members.filter((m) => !m.left).length >= MAX_PLAYERS) return "ROOM_FULL";
      if (!COLORS.some((c) => c.id === a.color) || !(LOCALES as readonly string[]).includes(a.locale)) return "BAD_MESSAGE";
      if (findMember(s, a.playerId)) return "BAD_MESSAGE";
      const name = sanitizeName(a.name);
      if (name === null) return "NAME_INVALID";
      const key = nameKey(name);
      if (s.members.some((m) => nameKey(m.name) === key)) return "NAME_TAKEN";
      if (s.members.some((m) => m.color === a.color)) return "COLOR_TAKEN";
      const used = new Set(s.members.map((m) => m.seat));
      let seat = 0;
      while (used.has(seat)) seat++;
      const m: Member = {
        id: a.playerId, name, color: a.color, locale: a.locale, seat, joinedAt: d.now, connected: true, disconnectedAt: null,
        left: false, benched: s.phase === "PLAYING", reaction: null,
      };
      s.members.push(m);
      s.members.sort((x, y) => x.seat - y.seat);
      if (s.hostPlayerId === null) s.hostPlayerId = m.id;
      const g = s.game;
      const join = g ? def(g.id).join : undefined;
      if (g && join) {
        const r = join(g.state, { id: m.id, seat: m.seat, locale: m.locale, connected: true, carryScore: 0 });
        if (r.ok) {
          g.state = r.state;
          m.benched = false;
        }
      }
      return null;
    }
    case "RECONNECT": {
      const m = findMember(s, a.playerId) as Member;
      if (m.connected) return null;
      m.connected = true;
      m.disconnectedAt = null;
      if (s.phase === "PLAYING" && !m.benched) return runGame(d, { type: "PLAYER_BACK", playerId: m.id });
      return null;
    }
    case "DISCONNECT": {
      const m = findMember(s, a.playerId) as Member;
      if (!m.connected) return null;
      m.connected = false;
      m.disconnectedAt = d.now;
      if (s.phase === "PLAYING" && !m.benched) return runGame(d, { type: "PLAYER_AWAY", playerId: m.id });
      return null;
    }
    case "TICK": {
      if (s.phase === "PLAYING") {
        const at = nextRoomWakeAt(s);
        return at !== null && d.now >= at ? runGame(d, { type: "TICK" }) : null;
      }
      const expired = s.members.filter((m) => !m.connected && m.disconnectedAt !== null && m.disconnectedAt + SEAT_HOLD_MS <= d.now);
      for (const m of expired) removeMember(s, m.id);
      return null;
    }
    case "TV_GAMES": {
      const seen = new Set<GameId>();
      s.tvGames = [];
      for (const g of a.games) {
        if (!isGameId(g.id) || seen.has(g.id) || !Number.isInteger(g.v)) continue;
        seen.add(g.id);
        s.tvGames.push({ id: g.id, v: g.v });
      }
      return null;
    }
    case "RESTRICT_SETTINGS":
      if (s.phase === "SETUP" && s.setupGameId) restrict(d, s.setupGameId);
      else if (s.phase === "HUB") for (const id of GAME_IDS) restrict(d, id);
      return null;   // PLAYING: the running game finishes with what it started (§4.4)
  }
}

/** §2.6: a room in SETUP for a game that left `room.games` (redeploy without it) returns to HUB on its next write. */
function normalizeSetup(d: Draft): void {
  const s = d.s;
  if (s.phase === "SETUP" && s.setupGameId && !roomGames(s, d.ctx.enabledGames).includes(s.setupGameId)) {
    s.phase = "HUB";
    s.setupGameId = null;
  }
}

function hubFocusError(state: RoomState, a: { gameId: string }, by: RoomActor, enabled: readonly GameId[]): ErrorCode | null {
  if (by.kind !== "tv") return "NOT_HOST";
  if (state.phase !== "HUB") return "WRONG_PHASE";
  if (!isGameId(a.gameId)) return "UNKNOWN_GAME";
  if (!roomGames(state, enabled).includes(a.gameId)) return "GAME_UNAVAILABLE";
  return null;
}

export function reduceRoom(state: RoomState, action: RoomAction, ctx: RoomCtx): RoomReduceResult {
  const history = ctx.history;
  const fail = (error: ErrorCode): RoomReduceResult => ({ ok: false, error, state, history });
  const same: RoomReduceResult = { ok: true, state, history };
  const by = action.by;
  if (by.kind === "player") {
    const m = findMember(state, by.playerId);
    if (!m || m.left) return fail("BAD_MESSAGE");
  } else if (by.kind === "system" && (action.type === "RECONNECT" || action.type === "DISCONNECT")) {
    const m = findMember(state, action.playerId);
    if (!m || m.left) return same;
  }
  // HUB_FOCUS never changes RoomState: the TV's focus is ephemeral meta kept by the RoomCore (§2.3).
  if (action.type === "HUB_FOCUS") {
    const e = hubFocusError(state, action, action.by, ctx.enabledGames);
    return e ? fail(e) : same;
  }
  if (action.type === "TICK") {
    const at = nextRoomWakeAt(state);
    const stale = state.phase === "SETUP" && state.setupGameId !== null && !roomGames(state, ctx.enabledGames).includes(state.setupGameId);
    if (!stale && (at === null || ctx.now < at)) return same;
  }
  // RoomState and RoomHistory are plain JSON: a round-trip copy doubles as the change check.
  const beforeS = JSON.stringify(state);
  const beforeH = JSON.stringify(history);
  const d: Draft = { s: JSON.parse(beforeS) as RoomState, h: JSON.parse(beforeH) as RoomHistory, now: ctx.now, ctx, rng: createRng(state.rngState) };
  const err = action.by.kind === "system"
    ? applySystem(d, action as RoomSystemAction)
    : applyIntent(d, action as RoomIntent, action.by);
  if (err) return fail(err);
  normalizeSetup(d);
  d.s.rngState = d.rng.state >>> 0;
  const sameS = JSON.stringify(d.s) === beforeS;
  const sameH = JSON.stringify(d.h) === beforeH;
  if (!sameS) d.s.version = state.version + 1;
  return { ok: true, state: sameS ? state : d.s, history: sameH ? history : d.h };
}

// ---------------------------------------------------------------- load (§2.6 room-store)

export type LoadedRoom =
  | { ok: true; state: RoomState; history: RoomHistory; changed: boolean; gameSchemaReset: boolean }
  | { ok: false; reason: "SCHEMA" };

/**
 * §2.6 normalize-on-load. A stored state without `schema: 2` → `{ok:false}` (the caller expires the room). Otherwise:
 * every `gameSettings[K]` passes through `GAMES[K].settings.normalize` (unknown or newly added GameIds get defaults,
 * unknown slots are dropped); a stored game state whose `schema` differs from the code's (or of an unknown game) is
 * aborted to SETUP (no stars, matchScores unchanged, memory kept); unknown ids are dropped from tvGames and the cup.
 * Returns the same objects (`changed: false`) when nothing needed fixing.
 */
export function normalizeLoaded(rawState: unknown, rawHistory: unknown, now: number): LoadedRoom {
  if (rawState === null || typeof rawState !== "object" || (rawState as { schema?: unknown }).schema !== ROOM_SCHEMA) return { ok: false, reason: "SCHEMA" };
  const state = rawState as RoomState;
  const historyIn = (rawHistory && typeof rawHistory === "object" ? rawHistory : createRoomHistory()) as RoomHistory;
  const s = JSON.parse(JSON.stringify(state)) as RoomState;
  const h = JSON.parse(JSON.stringify(historyIn)) as RoomHistory;
  if (!Array.isArray(h.games)) h.games = [];
  if (!h.memory || typeof h.memory !== "object") h.memory = {};
  for (const k of Object.keys(h.memory)) if (!isGameId(k)) delete (h.memory as Record<string, unknown>)[k];
  h.games = h.games.filter((g) => isGameId(g.gameId));
  const rawSettings = (s.gameSettings ?? {}) as Record<string, unknown>;
  const settings = {} as Record<GameId, unknown>;
  const schemas = {} as Record<GameId, number>;
  for (const id of GAME_IDS) {
    settings[id] = def(id).settings.normalize(rawSettings[id]);
    schemas[id] = def(id).meta.SETTINGS_SCHEMA;
  }
  s.gameSettings = settings as RoomState["gameSettings"];
  s.settingsSchema = schemas as RoomState["settingsSchema"];
  s.tvGames = (Array.isArray(s.tvGames) ? s.tvGames : []).filter((g) => isGameId(g.id));
  for (const k of Object.keys(s.cup.matchScores)) if (!isGameId(k)) delete (s.cup.matchScores as Record<string, unknown>)[k];
  if (s.cup.last && !isGameId(s.cup.last.gameId)) s.cup.last = null;
  if (s.setupGameId !== null && !isGameId(s.setupGameId)) {
    s.setupGameId = null;
    s.game = null;
    s.phase = "HUB";
  }
  let gameSchemaReset = false;
  const g = s.game;
  if (g && (!isGameId(g.id) || (g.state as { schema?: unknown } | null)?.schema !== def(g.id).stateSchema)) {
    gameSchemaReset = true;
    s.game = null;
    for (const m of s.members.filter((x) => x.left)) removeMember(s, m.id);
    for (const m of s.members) {
      m.benched = false;
      if (!m.connected) m.disconnectedAt = now;
    }
    s.phase = s.setupGameId ? "SETUP" : "HUB";
  }
  const sameS = JSON.stringify(s) === JSON.stringify(state);
  const sameH = JSON.stringify(h) === JSON.stringify(historyIn) && historyIn === rawHistory;
  if (!sameS) s.version = state.version + 1;
  return { ok: true, state: sameS ? state : s, history: sameH ? historyIn : h, changed: !sameS || !sameH, gameSchemaReset };
}
