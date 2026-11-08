// JAMAA-PLATFORM §2.2 (exact): the contract between the room and a game. Zod-free and engine-free (types only).
import type { Locale } from "../constants";
import type { RoomAccess } from "../content/types";
import type { ErrorCode } from "../protocol/errors";
import type { WorldId } from "../worlds/ids";
import type { GameId } from "./ids";

export type { GameId } from "./ids";
export type { WorldId } from "../worlds/ids";
export type { RoomAccess } from "../content/types";

export type GameActor = { kind: "tv" } | { kind: "player"; playerId: string };
export interface RosterEntry { id: string; seat: number; locale: Locale; connected: boolean; carryScore: number }

/** What the platform sends into a game. Intents are already zod-validated against the game's intent schema. */
export type GameAction<I> =
  | { type: "INTENT"; intent: I; by: GameActor }
  | { type: "TICK" }
  | { type: "PLAYER_AWAY"; playerId: string }    // socket closed; the seat is held for the rest of the game
  | { type: "PLAYER_BACK"; playerId: string }
  | { type: "PLAYER_GONE"; playerId: string; cause: "LEAVE" | "KICK" };  // never dealt back into this game instance

/** isHost is the ONLY host test a game may use; the room computes it from room.hostPlayerId (TV always true). */
export interface GameCtx<C> { now: number; content: C; isHost: (actor: GameActor) => boolean; hostPlayerId: string | null }
export type GameReduceResult<S> = { ok: true; state: S } | { ok: false; error: ErrorCode; state: S };

export interface GameOutcome {
  points: Record<string, number>;        // THIS instance's points per roster id (carry excluded; 0 for left players)
  ranking: string[][];                   // standard competition ranking (1,1,3) on `points`; left players and players
                                         // with 0 points are excluded (they get no stars)
}
/** Per-game history, read in any phase (ABORT keeps it). Keys are item ids only (the game knows its packs). */
export interface GameMemory { usedKeys: string[] }   // capped at MEMORY_MAX_KEYS = 300 per game, oldest dropped

export type SettingField =
  | { key: string; kind: "stepper"; labelKey: string; bounds: { min: number; max: number; step: number; off?: 0 }; unitKey?: string }
  | { key: string; kind: "choice"; labelKey: string; options: readonly { value: string | number; labelKey: string }[] }
  | { key: string; kind: "toggle"; labelKey: string }
  | { key: string; kind: "packs"; labelKey: string; single: boolean };    // multi-select packs, or one quiz

export interface GameRules {
  titleKey: string; taglineKey: string;            // "game.<id>.title", "game.<id>.tagline"
  howToKeys: readonly string[];                    // 3–4 short intro cards: "game.<id>.howto.1"…
  ruleSections: readonly { id: string; titleKey: string; bodyKey: string; phases: readonly string[] }[]; // ⓘ sheet
  durationMinutes: readonly [number, number];      // shown on the hub card, e.g. [10, 20]
  world: WorldId;                                  // §3.4
  /** Host actions offered in the TV pause menu (HUB-06), in this order, after Resume and before Rules.
   *  `confirm` items open a confirm dialog first. The TV sends `GAME {gameId, i: intent}` (plus args the item collects). */
  pauseItems: readonly { id: string; labelKey: string; intent: string; phases: readonly string[]; confirm?: boolean }[];
}

/** games/<id>/meta.ts: everything a client may import (no zod, no engine). */
export interface GameMeta<Settings> {
  id: GameId;
  minPlayers: number; maxPlayers: number;          // within the room's 1..MAX_PLAYERS
  phases: readonly string[];
  rules: GameRules;
  carriesScore: boolean;                           // true: REPLAY seeds points from cup.matchScores (mishana only)
  VIEW_VERSION: number;                            // bump on any breaking change to Pub/Me; the TV hello declares it
  SETTINGS_SCHEMA: number;                         // bump on any change to the Settings shape
  settings: {
    defaults: Settings;                            // static (never access-dependent); key order fixed (fixtures)
    basic: readonly SettingField[];                // ≤ 4 rows (TV + VIP phone); a row whose field has 1 possible value is hidden
    advanced: readonly SettingField[];             // collapsed "Advanced" row; [] for G2–G4
    premiumKeys: readonly (keyof Settings)[];      // only a Pass room may move these off the defaults
  };
}

/** games/<id>/definition.ts: server, sim and tests only. */
export interface GameDefinition<S, Settings, Intent, Pub, Me, C, Extras> {
  meta: GameMeta<Settings>;
  enabled: boolean;                                // false = stub; the room also intersects with GAMES_ENABLED and the TV's support
  settings: {
    apply(s: Settings, patch: Partial<Settings>, content: C, locale: Locale): Settings | null; // null = INVALID_SETTINGS
    /** Any stored value (old schema, missing/extra keys, unknown GameId slot) → valid Settings; falls back to defaults per key. */
    normalize(raw: unknown): Settings;
    /** Access restriction: reset locked pack/quiz filters and premium keys. Returns the SAME object when nothing changes. */
    restrict(s: Settings, a: { playableIds: ReadonlySet<string>; premium: boolean }, content: C, locale: Locale): Settings;
    packIds(s: Settings): readonly string[];       // the content filter as FAMILY ids, for access checks (§4.4)
  };
  /** Builds the first in-game state, or fails (NOT_ENOUGH_PLAYERS, NO_CONTENT_AVAILABLE…). `seed` comes from the room rng.
   *  The first phase's deadline already includes `graceMs` (= ENTRANCE_GRACE_MS, §3.10 B). */
  start(a: { roster: readonly RosterEntry[]; settings: Settings; locale: Locale; memory: GameMemory; seed: number; now: number; graceMs: number; content: C }): GameReduceResult<S>;
  reduce(s: S, a: GameAction<Intent>, ctx: GameCtx<C>): GameReduceResult<S>;
  nextWakeAt(s: S): number | null;
  outcome(s: S): GameOutcome | null;               // non-null once the game sits in its final RESULTS phase
  memory(s: S): GameMemory;                        // callable in ANY phase (ABORT_GAME and REPLAY both read it)
  /** Optional: a member who joined while PLAYING enters this instance. The room clears `benched` on success; the game alone
   *  decides when the entry first acts, and projects a non-null `me` with `waitingForNext: true` until then. */
  join?(s: S, entry: RosterEntry): GameReduceResult<S>;
  startBlocker(roster: readonly RosterEntry[], s: Settings, content: C, locale: Locale): ErrorCode | null;
  /** SETUP-only extras the setup screen needs before any game state exists (e.g. roleCounts, poolExhausted, available).
   *  JAMAA-GAP (P1): the trailing `memory` (the room's history for this game) is an addition to §2.2: Mish Ana!'s
   *  `poolExhausted` needs the used pair keys, which no other argument carries. Games that do not need it ignore it. */
  projectSetup(s: Settings, roster: readonly RosterEntry[], content: C, access: RoomAccess, locale: Locale, memory: GameMemory): Extras;
  projectPublic(s: S, content: C): Pub;            // what the TV and every phone may see
  projectMe(s: S, playerId: string, content: C): Me | null;   // that player's private part; null for unknown
  /** Envelope-level status for generic platform UI (rules-sheet highlight, coach marks, character done/think).
   *  Same secrecy as Pub: who acted, never what. */
  projectStatus(s: S): { phase: string; doneIds: string[]; awaitedIds: string[] };
  assertInvariants(s: S): void;                    // throws InvariantError
  /** Leak oracles for tests and sim (all three run after every step):
   *  - secretsFor: secret LEAF VALUES (whole-leaf equality, never substring) that the TV view (viewer null) or that
   *    player's view must not contain right now;
   *  - leakCheck: structural rules (paths that may/may not exist in this phase, ids that must not appear under a key),
   *    returning human-readable violations;
   *  - forbiddenKeys: state-only keys that never appear in any view. */
  secretsFor(s: S, viewer: string | null): readonly unknown[];
  leakCheck(s: S, viewer: string | null, view: unknown): string[];
  forbiddenKeys: readonly string[];
}

/** Any registered game, with its type parameters erased (the room only moves these values around). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameDefinition = GameDefinition<any, any, any, any, any, any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameMeta = GameMeta<any>;
