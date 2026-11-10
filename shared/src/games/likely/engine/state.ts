// GAME-LIKELY §4–§7, §13: the engine state, intents and view types (zod-free; protocol.ts mirrors the wire types and
// checks they agree). Everything here is plain JSON so the room can persist it as is.
import type { Locale } from "../../../constants";
import { LIKELY_RUNNER_UP_VALUE } from "../meta";
import type { LikelyAwardKind, LikelyDeltaReason, LikelyMode, LikelyPhase, LikelySettings } from "../meta";

/** Bumped on any breaking change of LikelyState (the room aborts a stored instance whose schema differs, §2.2). */
export const STATE_SCHEMA = 1;

export const NAMED_MIN_PLAYERS = 4;       // named (Spicy) cards need ≥ 4 players in game (§7, §11.3)
export const MIN_CONNECTED = 3;           // HOLD below this at card start (§7)
export const OPENER_TAGS: readonly string[] = ["party", "habits"];  // first card of a family game (§11.3)

// "Read the Room" scoring (§6, public mode only).
export const AGREE_POINTS = 50;
export const AGREE_CAP = 300;
export const UNANIMOUS_BONUS = 100;
export const SELF_AWARE_BONUS = 100;
export const SELF_AWARE_MIN_OTHERS = 2;
export const RESULT_MIN_VOTES = 3;        // chaos and unanimous need ≥ 3 votes (§5.1)
/** Invariant 5: a player's points on one card ≤ 300 agreement + 100 Unanimous + 100 Self-aware. */
export const MAX_CARD_POINTS = AGREE_CAP + UNANIMOUS_BONUS + SELF_AWARE_BONUS;

// Awards (§6.2) and the "AGAIN?!" line (§6.1).
export const STAR_MIN_TOPS = 3;
/** Runner-up signature (owner amendment of §6.2 rule 2, G3 review): ≥ 2 votes on a card the player did not top. */
export const RUNNER_UP_MIN_VOTES = 2;
/** `value` of a runner-up signature award ("Runner-up: {award}"); a top signature keeps `value: null`. */
export const RUNNER_UP_VALUE = LIKELY_RUNNER_UP_VALUE;
export const SELF_AWARE_AWARD_MIN = 2;
export const AGAIN_STREAK = 3;

/** GAME-LIKELY §13.1 (travels as `GAME {gameId:"likely", i}`). */
export type LikelyIntent =
  | { type: "VOTE"; cardId: string; targetId: string }
  | { type: "SKIP_CARD"; cardId: string }
  | { type: "HOST_ADVANCE" }
  | { type: "END_GAME" };

export interface LikelyPlayer {
  id: string;
  /** Entry number in this instance (0, 1, …; never reused): results store ballots by entry number to stay small. */
  n: number;
  seat: number;
  connected: boolean;
  left: boolean;
  /** Joined while PLAYING: watches until the next CARD (§7), then votes and can be voted for. */
  waiting: boolean;
  /** cardIndex of the first card this player was dealt into (null while waiting). > 0 ⇔ a late joiner ("New" ribbon). */
  firstCard: number | null;
  /** Named (Spicy) cards that named this player and reached REVEAL (fewest-named fairness, §7). */
  namedCount: number;
}

/** The card on the table. Texts are resolved in the room's content language when drawn, so a later access change
 *  (a Pass that expires mid-game) can never blank the TV. `prompt` keeps "{player}" on a named card. */
export interface LikelyCurrentCard {
  cardId: string;
  packId: string;
  prompt: string;
  award: string;
  tags: string[];
  spicy: boolean;
  namedPlayerId: string | null;
  rerun: boolean;
}

/** One revealed card. Tallies, percentages, deltas and awards are all derived from `ballots` (one source of truth); the
 *  texts are kept so the awards ceremony can quote the card even if the room's access shrank mid-game (§2.6 size: no
 *  pack id or tags here). */
export interface LikelyCardResult {
  cardId: string;
  prompt: string;
  award: string;
  /** The named player's entry number (Spicy), or null. */
  named: number | null;
  /** picks[voter n] = target n, or -1 (abstained / not dealt in). STATE ONLY: projected as voter→target ids in public
   *  mode during REVEAL, never in secret mode. */
  picks: number[];
}

export interface LikelyAwardEntry {
  kind: LikelyAwardKind;
  playerIds: string[];        // one id for signature/mystery; ties share star/selfAware/mindReader (seat order)
  /** signature: the result index; star, selfAware, mindReader, mystery: null. */
  cardIndex: number | null;
  /** signature: null (top of the card) or RUNNER_UP_VALUE (2: runner-up); star: cards topped; selfAware: bonuses;
   *  mindReader: points; mystery: null. */
  value: number | null;
}

export interface LikelyState {
  schema: typeof STATE_SCHEMA;
  phase: LikelyPhase;
  settings: LikelySettings;
  locale: Locale;
  players: LikelyPlayer[];            // seat order
  cardIndex: number;                  // 0-based index of the current card = cards completed
  cardCount: number;
  deadline: number | null;
  earlyEnd: boolean;                  // VOTING: the +1 s window is set
  card: LikelyCurrentCard | null;
  votes: Record<string, string>;      // voter → target for the current card; STATE ONLY
  results: LikelyCardResult[];
  scores: Record<string, number>;     // public mode only (all 0 in secret mode)
  /** Tags of the last revealed card (draw: no two consecutive cards sharing a tag). */
  prevTags: string[] | null;
  /**
   * The card history, oldest first, unique: the platform memory at start (only cards this room can draw), then every card
   * drawn this game (skips included), each moved to the end when drawn. The last `drawnCount` keys are exactly the cards
   * drawn this game, so one list serves the draw and `memory()` (§2.6 size: no second copy). STATE ONLY.
   */
  memoryKeys: string[];
  drawnCount: number;
  rngState: number;                   // STATE ONLY
  lastNamedId: string | null;
}

export interface LikelyEngineOptions { spicyEnabled: boolean }

// ---------- views (§13.2) ----------

export interface LikelyCardView {
  id: string;
  /** JAMAA-GAP: the game never sees display names (RosterEntry has none), so a named card keeps "{player}" and the
   *  clients write `namedPlayerId`'s name (in its character colour, §8.2) in its place. */
  prompt: string;
  award: string;
  spicy: boolean;
  namedPlayerId: string | null;
  rerun: boolean;
}
export interface LikelyCount { playerId: string; count: number; percent: number }
export interface LikelyBallot { voterId: string; targetId: string }
export interface LikelyDelta { playerId: string; points: number; reason: LikelyDeltaReason }
export interface LikelyReveal {
  votesCast: number;
  counts: LikelyCount[];          // percent desc, then seat (§5.1)
  topIds: string[];               // seat order
  unanimous: boolean;
  chaos: boolean;
  none: boolean;                  // nobody voted ("No votes? Shy tonight!")
  againId: string | null;         // "{name} AGAIN?!": topped this card and the 2 before (§6.1)
  ballots: LikelyBallot[] | null; // public mode only; voter seat order
  deltas: LikelyDelta[];          // [] in secret mode
}
export interface LikelyAwardCardView { index: number; id: string; prompt: string; award: string; namedPlayerId: string | null }
export interface LikelyAwardView { kind: LikelyAwardKind; playerIds: string[]; value: number | null; card: LikelyAwardCardView | null }
export interface LikelyScore { playerId: string; score: number; scoreBefore: number }

export interface LikelyPublic {
  schema: number;
  phase: LikelyPhase;
  cardIndex: number;
  cardCount: number;
  deadline: number | null;
  card: LikelyCardView | null;
  newIds: string[];               // late joiners on their first card ("New" ribbon)
  votedIds: string[];             // VOTING only
  reveal: LikelyReveal | null;    // REVEAL only
  scores: LikelyScore[];          // seat order; every score 0 in secret mode
  awards: LikelyAwardView[];      // AWARDS and RESULTS ([] before)
  showVoters: boolean;
  mode: LikelyMode;
}
export interface LikelyMe { myVote: string | null; waitingForNext: boolean }
export interface LikelyExtras { gameId: "likely"; available: number }
