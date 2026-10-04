import type { ColorId, Locale } from "../constants";
import type { Catalog } from "./catalog";

export const PHASES = ["LOBBY","ROLE_REVEAL","CLUES","VOTING","TIE_BREAK","ELIMINATION","MR_WHITE_GUESS","RESULTS"] as const;
export type Phase = (typeof PHASES)[number];
// Enum literal lists: the single source for the engine unions and the protocol's z.enum schemas.
export const ROLES = ["CIVILIAN", "UNDERCOVER", "BLANK"] as const;
export type Role = (typeof ROLES)[number];
export const WINNERS = ["CIVILIANS", "INFILTRATORS", "BLANK"] as const;
export type Winner = (typeof WINNERS)[number];
export const DEADLINE_KINDS = ["REVEAL", "CLUE", "VOTE", "ELIMINATION", "GUESS", "VERDICT"] as const;
export type DeadlineKind = (typeof DEADLINE_KINDS)[number];
export const VOTE_OUTCOMES = ["ELIMINATED", "TIE", "RANDOM", "NO_ELIMINATION"] as const;
export type VoteOutcome = (typeof VOTE_OUTCOMES)[number];
export const GUESS_STATUSES = ["PENDING", "CORRECT", "WRONG", "TIMEOUT"] as const;
export type GuessStatus = (typeof GUESS_STATUSES)[number];
export const HISTORY_CAUSES = ["VOTE", "RANDOM", "KICK", "LEAVE", "NONE"] as const;
export type HistoryCause = (typeof HISTORY_CAUSES)[number];

/** A title in every UI locale (pack titles). */
export type LocalizedTitle = Record<Locale, string>;

export interface WordRef { text: string; translit: string | null }
export interface WordSide { text: string; translit: string | null; alt: string[] }   // catalog-internal (alt never leaves server)
export interface RoleCounts { civilian: number; undercover: number; blank: number }
export interface Points { civilian: number; undercover: number; blank: number }

export interface Settings {
  winRule: "official" | "parity";
  revealRoles: boolean;
  roleMode: "auto" | "custom";
  undercoverCount: number;
  blankCount: number;
  clueSeconds: number;
  voteSeconds: number;
  revealSeconds: number;
  guessSeconds: number;
  tieBreak: "random" | "none";
  blankGuess: boolean;
  wordLocale: Locale;
  packIds: string[];
  difficulties: (1 | 2 | 3)[];
  familyFilter: boolean;
  swapSides: boolean;
  points: Points;
}
export type SettingsPatch = Partial<Settings>;  // `points`, if present, must be a complete Points object

export interface Player {
  id: string;               // "p_" + 24 hex (96-bit)
  name: string;
  color: ColorId;
  locale: Locale;
  seat: number;             // unique; gaps allowed in LOBBY; compacted to 0..n-1 at START
  joinedAt: number;
  connected: boolean;
  disconnectedAt: number | null;
  role: Role | null;        // null in LOBBY/after reset
  word: WordRef | null;     // null in LOBBY and for BLANK
  alive: boolean;
  left: boolean;            // LEAVE/KICK outside LOBBY; removed at the next resetToLobby
  ready: boolean;           // ROLE_REVEAL
  spoke: boolean;           // current CLUES/TIE_BREAK pass
  score: number;            // cumulative for the session
}

export interface Deadline { id: number; kind: DeadlineKind; at: number; durationMs: number }

export interface SelectedPair {
  key: string;              // `${packId}:${pairId}`
  packId: string; packVersion: number; pairId: string;
  packTitle: LocalizedTitle;
  civilian: WordSide;       // after optional swap
  undercover: WordSide;
}

export interface VoteSummary {
  round: number;
  revote: boolean;
  tally: { targetId: string; voterIds: string[] }[];   // sorted by voterIds.length desc, then target seat asc; only targets with ≥1 vote
  abstainIds: string[];                                 // alive players with no valid vote, seat order
  outcome: VoteOutcome;
  eliminatedId: string | null;
}

export interface GuessState { playerId: string; status: GuessStatus; text: string | null; overridden: boolean } // text: projected only in RESULTS (§5.4)

export interface ResultState {
  winner: Winner;
  winnerIds: string[];                     // seat order
  civilianWord: WordRef;
  undercoverWord: WordRef;
  pack: { id: string; version: number; title: LocalizedTitle };
  pointsAwarded: Record<string, number>;  // every player id → points this game (0 for losers and left players)
  guesses: GuessState[];                   // every resolved Blank guess this game, in order (texts public now)
}

export interface HistoryEntry { round: number; eliminatedId: string | null; role: Role | null; cause: HistoryCause }

export interface GameState {
  schema: 1;
  roomCode: string;
  joinUrl: string;
  version: number;              // +1 on every state change; becomes `seq`
  phase: Phase;
  settings: Settings;
  players: Player[];            // always sorted by seat
  hostPlayerId: string | null;  // the "VIP" phone; TV is always host too
  gameNumber: number;           // 0 until first START
  round: number;                // 0 in LOBBY/ROLE_REVEAL; 1.. during play
  roleCounts: RoleCounts | null;// in-game: actual; LOBBY: computed on projection, stored null
  pair: SelectedPair | null;
  usedPairKeys: string[];       // session no-repeat list
  speakingOrder: string[];
  turnIdx: number;
  starterId: string | null;
  votes: Record<string, string>;// voterId → targetId (never projected)
  revote: boolean;
  tieCandidates: string[];      // seat order
  lastVote: VoteSummary | null;
  eliminated: { playerId: string; role: Role } | null;
  guess: GuessState | null;
  guessLog: GuessState[];       // resolved guesses this game (never projected; copied into result.guesses)
  result: ResultState | null;
  history: HistoryEntry[];      // current game only
  deadline: Deadline | null;
  deadlineSeq: number;          // Deadline.id source
  rngState: number;             // uint32
}

export type Actor = { kind: "tv" } | { kind: "player"; playerId: string } | { kind: "system" };

export type ClientIntent =
  | { type: "UPDATE_SETTINGS"; patch: SettingsPatch }
  | { type: "START" }
  | { type: "READY" }
  | { type: "CLUE_DONE" }
  | { type: "CAST_VOTE"; targetId: string }
  | { type: "SUBMIT_GUESS"; text: string }
  | { type: "HOST_OVERRIDE_GUESS"; accept: boolean }
  | { type: "HOST_ADVANCE" }
  | { type: "KICK"; playerId: string }
  | { type: "PLAY_AGAIN" }
  | { type: "BACK_TO_LOBBY" }
  | { type: "LEAVE" };

export type SystemAction =
  | { type: "JOIN"; playerId: string; name: string; color: ColorId; locale: Locale }
  | { type: "RECONNECT"; playerId: string }
  | { type: "DISCONNECT"; playerId: string }
  | { type: "TICK" }
  // PAYMENTS-SPEC §3.11: RoomCore drops locked pack ids and resets premium settings when a LOBBY loses access.
  | { type: "RESTRICT_SETTINGS"; allowedPackIds: string[]; resetPremiumSettings: boolean };

export type Action = (ClientIntent & { by: Exclude<Actor, { kind: "system" }> }) | (SystemAction & { by: { kind: "system" } });

export interface ReduceCtx { now: number; catalog: Catalog }
export type ReduceResult =
  | { ok: true; state: GameState }                          // state === input when nothing changed
  | { ok: false; error: EngineError; state: GameState };   // state === input
export type EngineError =
  | "ROOM_FULL" | "ROOM_LOCKED" | "NAME_INVALID" | "NAME_TAKEN" | "COLOR_TAKEN" | "BAD_MESSAGE"
  | "NOT_HOST" | "WRONG_PHASE" | "NOT_YOUR_TURN" | "NOT_ALIVE" | "INVALID_TARGET" | "INVALID_SETTINGS"
  | "NOT_ENOUGH_PLAYERS" | "INVALID_ROLE_CONFIG" | "NO_WORDS_AVAILABLE" | "GUESS_INVALID";
