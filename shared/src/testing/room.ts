// JAMAA-PLATFORM §2.1 / §2.8: the room harness for room tests, the fixture generator and the sim. A scripted clock,
// reduceRoom, and assertRoomInvariants after every dispatch.
import type { ColorId, Locale } from "../constants";
import { contentCatalog } from "../content/catalog";
import type { ContentCatalog } from "../content/catalog";
import type { RoomAccess } from "../content/types";
import type { GameId } from "../games/ids";
import { GAME_IDS } from "../games/ids";
import { GAME_DEFS, REGISTRY_ENABLED } from "../games/registry";
import type { GameState } from "../games/mishana/engine/types";
import { projectRoomForPlayer, projectRoomForTv } from "../projection/room";
import type { RoomViewCtx } from "../projection/room";
import type { PlayerRoomView, TvRoomView } from "../protocol/v2/views";
import type { ErrorCode } from "../protocol/errors";
import { assertRoomInvariants } from "../room/invariants";
import { createRoomHistory, createRoomState, reduceRoom } from "../room/reduce";
import type { RoomAction, RoomHistory, RoomIntent, RoomReduceResult, RoomState, RoomSystemAction } from "../room/types";
import { T0 } from "./game";
import { TEST_CATALOG, TEST_FREE_CATALOG } from "./test-catalog";

export const ROOM_TV = { kind: "tv" } as const;
export const ROOM_SYS = { kind: "system" } as const;

/** Every game at the server's VIEW_VERSION (what the `/tv` mock and a current TV build declare). */
export const ALL_TV_GAMES: { id: GameId; v: number }[] = GAME_IDS.map((id) => ({ id, v: GAME_DEFS[id].meta.VIEW_VERSION }));

export interface RoomHarnessOptions {
  seed?: number;
  now?: number;
  roomCode?: string;
  joinUrl?: string;
  contentLocale?: Locale;
  /** Playable content (default: the free test catalog). */
  content?: ContentCatalog;
  /** Every shipped pack (default: the full test catalog). */
  fullContent?: ContentCatalog;
  access?: RoomAccess;
  enabledGames?: readonly GameId[];
  tvGames?: { id: GameId; v: number }[] | null;   // null: no TV_GAMES dispatched
}

export class RoomHarness {
  state: RoomState;
  history: RoomHistory;
  now: number;
  content: ContentCatalog;
  fullContent: ContentCatalog;
  access: RoomAccess;
  enabledGames: readonly GameId[];
  focusedGameId: GameId = "mishana";
  tvBusy = false;

  constructor(o: RoomHarnessOptions = {}) {
    const roomCode = o.roomCode ?? "TEST";
    this.state = createRoomState({ roomCode, joinUrl: o.joinUrl ?? `https://x.test/${roomCode}`, seed: o.seed ?? 1, contentLocale: o.contentLocale ?? "en" });
    this.history = createRoomHistory();
    this.now = o.now ?? T0;
    this.content = o.content ?? contentCatalog(TEST_FREE_CATALOG);
    this.fullContent = o.fullContent ?? contentCatalog(TEST_CATALOG);
    this.access = o.access ?? { premium: false, packs: new Set() };
    this.enabledGames = o.enabledGames ?? REGISTRY_ENABLED;
    const tv = o.tvGames === undefined ? ALL_TV_GAMES : o.tvGames;
    if (tv) this.sys({ type: "TV_GAMES", games: tv });
  }

  /** Dispatch at the current clock; the state and history update only on success. Invariants are checked either way. */
  try(action: RoomAction): RoomReduceResult {
    const r = reduceRoom(this.state, action, { now: this.now, content: this.content, enabledGames: this.enabledGames, access: this.access, history: this.history });
    assertRoomInvariants(r.state, r.history);
    if (r.ok) {
      this.state = r.state;
      this.history = r.history;
    } else if (r.state !== this.state || r.history !== this.history) {
      throw new Error("a failed reduceRoom must return its inputs");
    }
    return r;
  }
  do(action: RoomAction): RoomState {
    const r = this.try(action);
    if (!r.ok) throw new Error(`${action.type} failed: ${r.error}`);
    return r.state;
  }
  err(action: RoomAction): ErrorCode {
    const r = this.try(action);
    if (r.ok) throw new Error(`${action.type} unexpectedly succeeded`);
    return r.error;
  }
  tv(a: RoomIntent): RoomState {
    return this.do({ ...a, by: ROOM_TV } as RoomAction);
  }
  p(playerId: string, a: RoomIntent): RoomState {
    return this.do({ ...a, by: { kind: "player", playerId } } as RoomAction);
  }
  sys(a: RoomSystemAction): RoomState {
    return this.do({ ...a, by: ROOM_SYS } as RoomAction);
  }
  join(playerId: string, name: string, color: ColorId, locale: Locale = "en"): RoomState {
    return this.sys({ type: "JOIN", playerId, name, color, locale });
  }
  /** Advance the clock by `ms` and TICK. */
  tick(ms: number): RoomState {
    this.now += ms;
    return this.sys({ type: "TICK" });
  }

  viewCtx(): RoomViewCtx {
    return {
      content: this.content, fullContent: this.fullContent, access: this.access, enabledGames: this.enabledGames,
      focusedGameId: this.focusedGameId, tvBusy: this.tvBusy, history: this.history,
    };
  }
  tvView(): TvRoomView {
    return projectRoomForTv(this.state, this.viewCtx());
  }
  playerView(id: string | null): PlayerRoomView {
    return projectRoomForPlayer(this.state, this.viewCtx(), id);
  }

  /** The active Mish Ana! engine state (throws otherwise). */
  mishana(): GameState {
    const g = this.state.game;
    if (!g || g.id !== "mishana") throw new Error("no Mish Ana! instance");
    return g.state as GameState;
  }

  /** The next legal Mish Ana! action that moves the active instance toward RESULTS, or null once it is there. */
  nextMishanaAction(wrongGuess = "Zzyzx"): RoomAction | null {
    const s = this.mishana();
    const tvAdvance: RoomAction = { type: "GAME", gameId: "mishana", i: { type: "HOST_ADVANCE" }, by: ROOM_TV };
    const by = (playerId: string, i: unknown): RoomAction => ({ type: "GAME", gameId: "mishana", i, by: { kind: "player", playerId } });
    switch (s.phase) {
      case "RESULTS":
        return null;
      case "ROLE_REVEAL": {
        const p = s.players.find((x) => !x.ready && !x.left && x.connected);
        return p ? by(p.id, { type: "READY" }) : tvAdvance;
      }
      case "CLUES":
      case "TIE_BREAK": {
        const sp = s.speakingOrder[s.turnIdx];
        const p = s.players.find((x) => x.id === sp);
        return p && p.connected && !p.left ? by(p.id, { type: "CLUE_DONE" }) : tvAdvance;
      }
      case "VOTING": {
        const alive = s.players.filter((x) => x.alive && !x.left);
        const pool = s.revote ? alive.filter((x) => s.tieCandidates.includes(x.id)) : alive;
        const target = pool.find((x) => x.role !== "CIVILIAN") ?? pool[0];
        const voter = alive.find((x) => x.connected && s.votes[x.id] === undefined);
        if (!voter || !target) return tvAdvance;
        const t = voter.id === target.id ? (pool.find((x) => x.id !== voter.id) ?? target) : target;
        return t.id === voter.id ? tvAdvance : by(voter.id, { type: "CAST_VOTE", targetId: t.id });
      }
      case "MR_WHITE_GUESS": {
        const gp = s.guess?.status === "PENDING" ? s.players.find((x) => x.id === s.guess?.playerId) : undefined;
        return gp && gp.connected ? by(gp.id, { type: "SUBMIT_GUESS", text: wrongGuess }) : tvAdvance;
      }
      default:
        return tvAdvance;
    }
  }

  /**
   * Plays the active Mish Ana! instance to RESULTS with legal intents: everyone ready, each speaker done, every voter
   * votes out an impostor, the TV advances the eliminations, and a guessing Mole guesses `wrongGuess`.
   */
  playMishanaToResults(wrongGuess = "Zzyzx", onPhase?: (phase: string) => void): void {
    for (let guard = 0; guard < 500; guard++) {
      onPhase?.(this.mishana().phase);
      const a = this.nextMishanaAction(wrongGuess);
      if (!a) return;
      const r = this.try(a);
      if (!r.ok) this.do({ type: "GAME", gameId: "mishana", i: { type: "HOST_ADVANCE" }, by: ROOM_TV });
      this.now += 1000;
    }
    throw new Error("Mish Ana! instance did not finish");
  }
}
