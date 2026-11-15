// GAME-TAQRIBAN engine types: state, intents and view types (zod-free; protocol.ts mirrors the wire types and checks
// they agree). Everything is plain JSON so the room can persist it as is.
import type { Locale } from "../../../constants";
import type { PackCatalog } from "../../../content/types";
import type { STATE_SCHEMA, TaqMode } from "../constants";
import type { TaqribanPhase, TaqribanSettings } from "../meta";
import type { TaqribanItem, TaqribanPack } from "../schema";

export type { TaqribanItem, TaqribanPack, TaqribanPhase, TaqribanSettings, TaqMode };

/** The engine's `C`: the room's PLAYABLE packs (platform §4.4 already removed locked items). */
export type TaqribanCatalog = PackCatalog<TaqribanPack>;

/** GAME-TAQRIBAN §13.1 (travels as `GAME {gameId:"taqriban", i}`). */
export type TaqribanIntent =
  | { type: "GUESS"; questionId: string; value: number }
  | { type: "SKIP_QUESTION"; questionId?: string | undefined }
  | { type: "HOST_ADVANCE" }
  | { type: "END_GAME" };

export interface TaqDeadline { at: number; durationMs: number }

export interface TaqPlayer {
  id: string;
  seat: number;
  connected: boolean;
  left: boolean;                // LEAVE/KICK: score frozen, never awaited
  waiting: boolean;             // late joiner: watches until the next QUESTION
  newAt: number | null;         // index of the first question a late joiner plays ("New" ribbon)
  score: number;
  closest: number;              // questions won (tie-break 1)
  bullseyes: number;            // Bullseyes (tie-break 2)
  boardScore: number;           // score at the previous LEADERBOARD (the race grows from here)
  boardRank: number | null;
}

/** The question on screen, resolved in the room's language when it starts. `answer` is STATE ONLY until REVEAL. */
export interface TaqCurrent {
  id: string;
  text: string;
  unit: string;
  answer: number;
  source: string;
}

/** One dealt-in player's line for the last revealed question. */
export interface TaqGuessRow {
  id: string;
  value: number | null;         // null: no guess
  rank: number | null;          // 1 = closest (competition ranking on the §5.1 error); null without a guess
  closest: boolean;
  bullseye: boolean;
  points: number;               // closest + bullseye, × 2 on the final
}

export interface TaqResult {
  index: number;
  questionId: string;
  text: string;
  unit: string;
  answer: number;
  source: string;
  isFinal: boolean;
  rows: TaqGuessRow[];          // players who could guess, seat order
  closestIds: string[];
  bullseyeIds: string[];
  wildId: string | null;        // §5.4 "Way off!"
}

export interface TaqribanState {
  schema: typeof STATE_SCHEMA;
  phase: TaqribanPhase;
  settings: TaqribanSettings;
  locale: Locale;
  questionIds: string[];        // drawn at start, play order (a skip replaces the current one in place)
  index: number;                // current (QUESTION/REVEAL), last revealed (LEADERBOARD/FINAL_INTRO), next (HOLD)
  shown: number;                // questions that reached QUESTION (→ memory)
  deadline: TaqDeadline | null;
  cur: TaqCurrent | null;
  guesses: Record<string, number>;   // current question, STATE ONLY
  last: TaqResult | null;       // the last revealed question
  players: TaqPlayer[];         // seat order
  rerun: boolean;               // the draw had to reuse questions this room already played
  skippedIds: string[];         // host skips (content-review report)
  endedEarly: boolean;          // the playable catalog lost the questions mid-game (access change)
  usedKeys: string[];           // room memory at start (only ids this catalog knows), STATE ONLY
  rngState: number;             // STATE ONLY
}

// ---------- views (§13.2) ----------

export interface TaqQuestionView { id: string; text: string; unit: string }
export interface TaqGuessView { id: string; value: number; rank: number; closest: boolean; bullseye: boolean; points: number }
export interface TaqReveal {
  answer: number;
  source: string;
  mode: TaqMode;
  /** §8.3: the number line is logarithmic (values spread ≥ 20×). */
  logLine: boolean;
  guesses: TaqGuessView[];      // value ascending, then seat
  missingIds: string[];         // dealt-in players who did not guess (seat order)
  closestIds: string[];
  bullseyeIds: string[];
  wildId: string | null;
}
export interface TaqScore {
  playerId: string;
  score: number;
  scoreBefore: number;
  rank: number | null;          // null for left players
  rankBefore: number | null;
  closest: number;
  bullseyes: number;
  left: boolean;
}
export interface TaqribanPublic {
  schema: number;
  phase: TaqribanPhase;
  index: number;
  total: number;
  isFinal: boolean;
  deadline: number | null;
  durationMs: number | null;
  question: TaqQuestionView | null;
  answeredIds: string[];
  reveal: TaqReveal | null;
  scores: TaqScore[];
  newIds: string[];
  waitingIds: string[];
  rerun: boolean;
  endedEarly: boolean;
}
export interface TaqribanMe { myGuess: number | null; waitingForNext: boolean }
export interface TaqribanExtras { gameId: "taqriban"; available: number }
