// JAMAA-PLATFORM §2.3 (exact): the platform room. Pure data; zod-free and engine-free.
import type { ColorId, Locale } from "../constants";
import type { ContentCatalog } from "../content/catalog";
import type { RoomAccess } from "../content/types";
import type { GameId } from "../games/ids";
import type { SettingsOf } from "../games/meta";
import type { GameMemory } from "../games/types";
import type { ErrorCode } from "../protocol/errors";

export const ROOM_PHASES = ["HUB", "SETUP", "PLAYING"] as const;
export type RoomPhase = (typeof ROOM_PHASES)[number];
/** Every reaction IS an expression (§3.7); a unit test asserts REACTIONS ⊂ EXPRESSIONS. Icon bursts: §3.7 table. */
export const REACTIONS = ["laugh", "shock", "facepalm", "happy", "sad", "cheer"] as const;
export type ReactionKind = (typeof REACTIONS)[number];

export interface Member {
  id: string; name: string; color: ColorId;      // color = the character (§3.7)
  locale: Locale; seat: number; joinedAt: number;
  connected: boolean; disconnectedAt: number | null;
  left: boolean;                                  // LEAVE/KICK while PLAYING; removed when the game ends
  benched: boolean;                               // joined while PLAYING: watches, and is dealt into the next game
  reaction: { kind: ReactionKind; at: number; n: number } | null;   // last reaction; n increments per reaction
}

/** Small, per-intent state: stored under the DO key `state`, rewritten on every change. */
export interface SessionCup {
  stars: Record<string, number>;                  // member id → stars this session (§2.4)
  last: { gameId: GameId; n: number; ranking: string[][]; points: Record<string, number> } | null;
  matchScores: Partial<Record<GameId, Record<string, number>>>;   // native points per game across REPLAYs (display;
                                                                  // seeds carryScore only when meta.carriesScore)
}

export interface RoomState {
  schema: 2;
  roomCode: string; joinUrl: string;
  version: number;                                // +1 on every change; becomes the frame `seq` base
  phase: RoomPhase;
  setupGameId: GameId | null;                     // SETUP and PLAYING
  contentLocale: Locale;                          // the content language for every game (was settings.wordLocale)
  members: Member[];                              // sorted by seat
  hostPlayerId: string | null;                    // the VIP phone (SPEC §4.8 rules, unchanged)
  tvGames: { id: GameId; v: number }[];           // what this TV build can render (from hello, §2.5)
  gameSettings: { [K in GameId]: SettingsOf<K> }; // every game's current settings (defaults at creation; normalized on load)
  settingsSchema: { [K in GameId]: number };      // SETTINGS_SCHEMA each slot was written with
  game: { id: GameId; n: number; state: unknown } | null;  // the active instance (PLAYING only); state.schema per game
  cup: SessionCup;
  rngState: number;                               // uint32; seeds each game instance
}

/** Large, rarely written history: stored under the separate DO key `history`, written only at game end, REPLAY or ABORT. */
export interface RoomHistory {
  memory: Partial<Record<GameId, GameMemory>>;    // ≤ 300 item ids per game (§2.2); every game doc's "no repeat" list IS this
  games: { gameId: GameId; n: number; ranking: string[][]; endedAt: number }[];  // last 20, for the cup sheet
}

// ---------------------------------------------------------------- actions (§2.5 intents + system events)

export type RoomActor = { kind: "tv" } | { kind: "player"; playerId: string };

/** The client intents of §2.5 (already zod-validated; `GAME.i` and `UPDATE_GAME_SETTINGS.patch` by that game's schema). */
export type RoomIntent =
  | { type: "HUB_FOCUS"; gameId: string }
  | { type: "OPEN_GAME"; gameId: string }
  | { type: "CLOSE_GAME" }
  | { type: "SET_CONTENT_LOCALE"; locale: Locale }
  | { type: "UPDATE_GAME_SETTINGS"; gameId: GameId; patch: Record<string, unknown> }
  | { type: "START_GAME" }
  | { type: "GAME"; gameId: GameId; i: unknown }
  | { type: "REPLAY" }
  | { type: "BACK_TO_SETUP" }
  | { type: "BACK_TO_HUB" }
  | { type: "ABORT_GAME" }
  | { type: "REACT"; kind: ReactionKind }
  | { type: "KICK"; playerId: string }
  | { type: "LEAVE" };

export type RoomSystemAction =
  | { type: "JOIN"; playerId: string; name: string; color: ColorId; locale: Locale }
  | { type: "RECONNECT"; playerId: string }
  | { type: "DISCONNECT"; playerId: string }
  | { type: "TICK" }
  /** The TV's hello `games` (§2.5 capability negotiation). */
  | { type: "TV_GAMES"; games: { id: GameId; v: number }[] }
  /** §4.4 `restrictionFor`: def.settings.restrict on the setup game in SETUP and on every game in HUB (uses ctx.access). */
  | { type: "RESTRICT_SETTINGS" };

export type RoomAction =
  | (RoomIntent & { by: RoomActor })
  | (RoomSystemAction & { by: { kind: "system" } });

export interface RoomCtx {
  now: number;
  /** The PLAYABLE content (§4.4): the only content that ever reaches reduceRoom. */
  content: ContentCatalog;
  /** GAMES_ENABLED ∩ registry enabled (§2.5), computed by the server. */
  enabledGames: readonly GameId[];
  access: RoomAccess;
  history: RoomHistory;
}

export type RoomReduceResult =
  | { ok: true; state: RoomState; history: RoomHistory }       // same objects when nothing changed
  | { ok: false; error: ErrorCode; state: RoomState; history: RoomHistory };  // the inputs, unchanged
