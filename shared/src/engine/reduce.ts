import { COLORS, GUESS_MAX_CHARS, LOCALES, MAX_PLAYERS, SEAT_HOLD_MS, VERDICT_HOLD_MS } from "../constants";
import type { Locale } from "../constants";
import type { Draft } from "./flow";
import {
  checkAllReady,
  currentSpeakerId,
  expire,
  findPlayer,
  finishTurn,
  forfeit,
  inferKind,
  isInGame,
  markLeft,
  onDisconnect,
  removePlayer,
  resetToLobby,
  setDeadline,
  startGame,
} from "./flow";
import { isGuessCorrect } from "./normalize";
import { createRng } from "./rng";
import { nameKey, sanitizeName } from "./sanitize";
import { applySettingsPatch, defaultSettings } from "./settings";
import type { Action, EngineError, GameState, Player, ReduceCtx, ReduceResult } from "./types";
import { castVote } from "./votes";

export function createInitialState(args: { roomCode: string; joinUrl: string; seed: number; wordLocale: Locale }): GameState {
  const settings = defaultSettings();
  settings.wordLocale = args.wordLocale;
  return {
    schema: 1,
    roomCode: args.roomCode,
    joinUrl: args.joinUrl,
    version: 0,
    phase: "LOBBY",
    settings,
    players: [],
    hostPlayerId: null,
    gameNumber: 0,
    round: 0,
    roleCounts: null,
    pair: null,
    usedPairKeys: [],
    speakingOrder: [],
    turnIdx: 0,
    starterId: null,
    votes: {},
    revote: false,
    tieCandidates: [],
    lastVote: null,
    eliminated: null,
    guess: null,
    guessLog: [],
    result: null,
    history: [],
    deadline: null,
    deadlineSeq: 0,
    rngState: args.seed >>> 0,
  };
}

/** min(deadline.at, LOBBY seat expiries). */
export function nextWakeAt(state: GameState): number | null {
  let at: number | null = state.deadline?.at ?? null;
  if (state.phase === "LOBBY") {
    for (const p of state.players) {
      if (!p.connected && p.disconnectedAt !== null) {
        const t = p.disconnectedAt + SEAT_HOLD_MS;
        if (at === null || t < at) at = t;
      }
    }
  }
  return at;
}

type By = { kind: "tv" } | { kind: "player"; player: Player };

const isHost = (s: GameState, by: By): boolean => by.kind === "tv" || by.player.id === s.hostPlayerId;

function applyIntent(d: Draft, action: Extract<Action, { by: { kind: "tv" } | { kind: "player" } }>, by: By): EngineError | null {
  const s = d.s;
  const phase = s.phase;
  const me = by.kind === "player" ? by.player : null;
  switch (action.type) {
    case "UPDATE_SETTINGS": {
      if (phase !== "LOBBY") return "WRONG_PHASE";
      if (!isHost(s, by)) return "NOT_HOST";
      const next = applySettingsPatch(s.settings, action.patch, d.catalog);
      if (!next) return "INVALID_SETTINGS";
      s.settings = next;
      return null;
    }
    case "START": {
      if (phase !== "LOBBY") return "WRONG_PHASE";
      if (!isHost(s, by)) return "NOT_HOST";
      return startGame(d);
    }
    case "READY": {
      if (phase !== "ROLE_REVEAL") return "WRONG_PHASE";
      // SPEC-GAP: READY from the TV (not a player) is rejected with BAD_MESSAGE.
      if (!me) return "BAD_MESSAGE";
      me.ready = true;
      checkAllReady(d);
      return null;
    }
    case "CLUE_DONE": {
      if (phase !== "CLUES" && phase !== "TIE_BREAK") return "WRONG_PHASE";
      if (!me || currentSpeakerId(s) !== me.id) return "NOT_YOUR_TURN";
      finishTurn(d);
      return null;
    }
    case "CAST_VOTE": {
      if (phase !== "VOTING") return "WRONG_PHASE";
      if (!me || !me.alive) return "NOT_ALIVE";
      return castVote(d, me.id, action.targetId);
    }
    case "SUBMIT_GUESS": {
      if (phase !== "MR_WHITE_GUESS") return "WRONG_PHASE";
      const g = s.guess;
      if (!me || !g || g.playerId !== me.id) return "NOT_YOUR_TURN";
      if (g.status !== "PENDING") return "WRONG_PHASE";
      const text = action.text.trim();
      const len = [...text].length;
      if (len < 1 || len > GUESS_MAX_CHARS) return "GUESS_INVALID";
      g.text = text;
      g.status = s.pair && isGuessCorrect(text, s.pair.civilian) ? "CORRECT" : "WRONG";
      setDeadline(d, "VERDICT", VERDICT_HOLD_MS);
      return null;
    }
    case "HOST_OVERRIDE_GUESS": {
      if (phase !== "MR_WHITE_GUESS") return "WRONG_PHASE";
      const g = s.guess;
      if (!g || g.overridden) return "WRONG_PHASE";
      if (action.accept) {
        if (g.status !== "WRONG" || g.text === null) return "WRONG_PHASE";
        if (!(by.kind === "tv" || (by.player.id === s.hostPlayerId && by.player.id !== g.playerId))) return "NOT_HOST";
        g.status = "CORRECT";
      } else {
        if (g.status !== "CORRECT") return "WRONG_PHASE";
        if (by.kind !== "tv") return "NOT_HOST";
        g.status = "WRONG";
      }
      g.overridden = true;
      setDeadline(d, "VERDICT", VERDICT_HOLD_MS);
      return null;
    }
    case "HOST_ADVANCE": {
      if (!isInGame(phase)) return "WRONG_PHASE";
      if (!isHost(s, by)) return "NOT_HOST";
      if (phase === "MR_WHITE_GUESS" && s.guess?.status === "PENDING" && by.kind === "player") {
        const guesser = findPlayer(s, s.guess.playerId);
        if (by.player.id === s.guess.playerId || guesser?.connected) return "NOT_HOST";
      }
      const kind = inferKind(s);
      /* v8 ignore next */
      if (!kind) return "WRONG_PHASE";
      expire(d, kind);
      return null;
    }
    case "KICK": {
      if (!isHost(s, by)) return "NOT_HOST";
      const target = findPlayer(s, action.playerId);
      if (!target || target.left) return "INVALID_TARGET";
      if (me && target.id === me.id) return "INVALID_TARGET";
      if (me && isInGame(phase) && target.connected) return "INVALID_TARGET";
      if (phase === "LOBBY") removePlayer(s, target.id);
      else if (phase === "RESULTS") markLeft(d, target);
      else forfeit(d, target, "KICK");
      return null;
    }
    case "PLAY_AGAIN": {
      if (phase !== "RESULTS") return "WRONG_PHASE";
      if (!isHost(s, by)) return "NOT_HOST";
      resetToLobby(d);
      return null;
    }
    case "BACK_TO_LOBBY": {
      if (phase === "LOBBY") return "WRONG_PHASE";
      if (by.kind !== "tv") return "NOT_HOST";
      resetToLobby(d);
      return null;
    }
    case "LEAVE": {
      // SPEC-GAP: LEAVE from the TV (not a player) is rejected with BAD_MESSAGE.
      if (!me) return "BAD_MESSAGE";
      if (phase === "LOBBY") removePlayer(s, me.id);
      else if (phase === "RESULTS") markLeft(d, me);
      else forfeit(d, me, "LEAVE");
      return null;
    }
  }
}

function applySystem(d: Draft, action: Extract<Action, { by: { kind: "system" } }>): EngineError | null {
  const s = d.s;
  switch (action.type) {
    case "JOIN": {
      if (s.phase !== "LOBBY") return "ROOM_LOCKED";
      if (s.players.length >= MAX_PLAYERS) return "ROOM_FULL";
      // SPEC-GAP: malformed system JOIN fields (unknown colour/locale, duplicate id) → BAD_MESSAGE.
      if (!COLORS.some((c) => c.id === action.color) || !(LOCALES as readonly string[]).includes(action.locale)) return "BAD_MESSAGE";
      if (findPlayer(s, action.playerId)) return "BAD_MESSAGE";
      const name = sanitizeName(action.name);
      if (name === null) return "NAME_INVALID";
      const key = nameKey(name);
      if (s.players.some((p) => nameKey(p.name) === key)) return "NAME_TAKEN";
      if (s.players.some((p) => p.color === action.color)) return "COLOR_TAKEN";
      const used = new Set(s.players.map((p) => p.seat));
      let seat = 0;
      while (used.has(seat)) seat++;
      const p: Player = {
        id: action.playerId, name, color: action.color, locale: action.locale, seat, joinedAt: d.now,
        connected: true, disconnectedAt: null, role: null, word: null, alive: true, left: false,
        ready: false, spoke: false, score: 0,
      };
      s.players.push(p);
      s.players.sort((a, b) => a.seat - b.seat);
      if (s.hostPlayerId === null) s.hostPlayerId = p.id;
      return null;
    }
    case "RECONNECT": {
      const p = findPlayer(s, action.playerId);
      if (!p || p.left) return null;
      p.connected = true;
      p.disconnectedAt = null;
      return null;
    }
    case "DISCONNECT": {
      const p = findPlayer(s, action.playerId);
      // SPEC-GAP: a DISCONNECT for an already-disconnected player is a no-op (keeps the original disconnectedAt).
      if (!p || p.left || !p.connected) return null;
      p.connected = false;
      p.disconnectedAt = d.now;
      onDisconnect(d, p);
      return null;
    }
    case "TICK": {
      if (s.deadline && d.now >= s.deadline.at) expire(d, s.deadline.kind);
      if (s.phase === "LOBBY") {
        const expired = s.players.filter((p) => !p.connected && p.disconnectedAt !== null && p.disconnectedAt + SEAT_HOLD_MS <= d.now);
        for (const p of expired) removePlayer(s, p.id);
      }
      return null;
    }
  }
}

/** Fast path: a TICK with nothing due must return the same object without cloning. */
function tickIsNoop(state: GameState, now: number): boolean {
  const at = nextWakeAt(state);
  return at === null || now < at;
}

export function reduce(state: GameState, action: Action, ctx: ReduceCtx): ReduceResult {
  if (action.type === "TICK" && tickIsNoop(state, ctx.now)) return { ok: true, state };
  if (action.by.kind === "player") {
    const p = findPlayer(state, action.by.playerId);
    if (!p || p.left) return { ok: false, error: "BAD_MESSAGE", state };
  } else if (action.by.kind === "system") {
    if (action.type === "RECONNECT" || action.type === "DISCONNECT") {
      const p = findPlayer(state, action.playerId);
      if (!p || p.left) return { ok: true, state };
    }
  }
  // GameState is plain JSON; a JSON round-trip is much faster than structuredClone and doubles as the change check.
  const before = JSON.stringify(state);
  const s = JSON.parse(before) as GameState;
  const rng = createRng(s.rngState);
  const d: Draft = { s, now: ctx.now, rng, catalog: ctx.catalog };
  let err: EngineError | null;
  if (action.by.kind === "system") {
    err = applySystem(d, action as Extract<Action, { by: { kind: "system" } }>);
  } else {
    let by: By;
    if (action.by.kind === "player") {
      const id = action.by.playerId;
      by = { kind: "player", player: s.players.find((p) => p.id === id) as Player };
    } else {
      by = { kind: "tv" };
    }
    err = applyIntent(d, action as Extract<Action, { by: { kind: "tv" } | { kind: "player" } }>, by);
  }
  if (err) return { ok: false, error: err, state };
  s.rngState = rng.state >>> 0;
  if (JSON.stringify(s) === before) return { ok: true, state };
  s.version = state.version + 1;
  return { ok: true, state: s };
}
