// GAME-BLUFF §4, §13: server state, intents and views. Server-only keys are named after GAME-BLUFF §13.2's
// state-only list so `forbiddenKeys` can find them if they ever leak.
import type { BluffType, RoundKind } from "./catalog";
import type { Locale } from "../../../constants";
import type { BluffSettings } from "../meta";

export const STATE_SCHEMA = 1;

export type Phase = "ROUND_INTRO" | "WRITING" | "VOTING" | "REVEAL" | "SCORES" | "HOLD" | "AWARDS" | "RESULTS";
export const PHASES: readonly Phase[] = ["ROUND_INTRO", "WRITING", "VOTING", "REVEAL", "SCORES", "AWARDS", "RESULTS", "HOLD"];

export type { BluffSettings };

export type BluffIntent =
  | { type: "SUBMIT_LIE"; text: string; promptId: string }
  | { type: "REQUEST_HELP"; promptId: string }
  | { type: "VOTE"; optionId: string }
  | { type: "LIKE"; optionId: string; on: boolean }
  | { type: "SKIP_PROMPT"; promptId: string }
  | { type: "HIDE_OPTION"; optionId: string }
  | { type: "HOST_ADVANCE" }
  | { type: "END_GAME" };

export interface PlayerStats { truthsFound: number; likesReceived: number; fooledTimes: number; fooledOthers: number }

export interface BPlayer {
  id: string;
  seat: number;
  locale: Locale;
  connected: boolean;
  left: boolean;
  waiting: boolean;            // joined mid-game: watches until the next WRITING (me.waitingForNext)
  newAtPrompt: number | null;  // promptIndex of the first prompt played ("New" ribbon for that prompt)
  score: number;
  scoreBefore: number;         // score at the start of the current prompt
  stats: PlayerStats;
}

/** The drawn prompt. Public parts: id, type, original, translit, display, lengthHint, rerun. The rest is server-only. */
export interface PromptState {
  id: string;                  // fresh RNG id per draw (STALE_PROMPT guard)
  itemId: string;
  packId: string;
  type: BluffType;
  knownIn: Locale[];
  crossRound: boolean;         // filled under the §11.4 short-pool rule
  original: string;
  translit: string | null;
  display: string | null;
  lengthHint: "short" | "few" | "sentence" | "free";
  rerun: boolean;
  truthText: string | null;    // display-normalised truth in the content locale (null: no_truth)
  truthOriginal: string | null;// the source-locale truth, shown after the reveal when it differs
  truthAll: string[];          // truth + truthAlt in the content locale and the item's sourceLocale (matching only)
  truthAlt: string[];          // the alternatives alone (secrets: never shown)
  note: string | null;
  houseLies: string[];         // the item's own house lies first, then the pack's fallbacks, for this locale
  ownHouseCount: number;       // how many of houseLies are the item's own (drawn first, §4.2 / §5.5)
}

export type OptionKind = "lie" | "house" | "truth";
export interface OptionState {
  id: string;
  text: string;                // display-normalised
  kind: OptionKind;            // server-only until REVEAL
  authors: string[];           // server-only until REVEAL (player lies; [] otherwise)
  helped: boolean;
}

export interface LieState { text: string; seq: number; helped: boolean }

export type RevealReason = "truth" | "fooled" | "like" | "convincing";
export interface RevealDelta { playerId: string; points: number; reason: RevealReason }
export interface RevealStep {
  optionId: string;
  kind: OptionKind;
  quick: boolean;
  text: string;
  authorIds: string[];
  helped: boolean;
  voteCount: number;
  voterIds: string[];          // [] in the final (anonymous ballots)
  likerIds: string[];
  foundEarlyIds: string[];     // truth step only
  spotOnIds: string[];         // truth step only, round 1
  top: boolean;                // final: most convincing
  deltas: RevealDelta[];
}
export interface Reveal {
  final: boolean;
  steps: RevealStep[];
  spotOnDeltas: { playerId: string; points: number }[];
  unpicked: { optionId: string; text: string; authorIds: string[]; likerIds: string[]; deltas: RevealDelta[] }[];  // likerIds/deltas: addition (likes on unpicked lies still pay)
  truth: { text: string; original: string | null; note: string | null } | null;
  durationMs: number;
}

export type AwardId = "bluffOfTheNight" | "lieDetector" | "crowdFavourite" | "hookLineSinker";
export interface Award { id: AwardId; playerIds: string[]; value: number; text: string | null; promptIndex: number | null }

/** One record per answered prompt (awards input). */
export interface PromptRecord { promptIndex: number; options: { text: string; authorIds: string[]; votes: number; likes: number; helped: boolean }[] }

export type Notice = "tooFamous" | "voided" | "allKnew" | null;

export interface BluffState {
  schema: typeof STATE_SCHEMA;
  phase: Phase;
  deadline: number | null;
  locale: Locale;
  settings: BluffSettings;
  rngState: number;
  players: BPlayer[];                       // seat order
  plan: RoundKind[];                        // one entry per prompt slot
  promptIndex: number;
  factRich: boolean;
  prompt: PromptState | null;
  prevType: BluffType | null;
  skipsUsed: number;                        // per prompt slot
  swapped: boolean;                         // "Too famous!" used for this slot
  emptyRedraw: boolean;                     // §4.2 step 5 used for this slot
  seq: number;                              // server receive order
  lies: Record<string, LieState>;
  edits: Record<string, number>;
  tooCloseProbes: Record<string, number>;
  foundWhileWriting: Record<string, true>;
  spotOn: Record<string, true>;
  firstSubmitDone: Record<string, true>;
  firstProbe: Record<string, true>;         // LIE_TOO_CLOSE on the first submission ("Too famous!" swap)
  help: Record<string, string | null>;      // REQUEST_HELP result (null: nothing left)
  housePool: string[];                      // unused house lies of this prompt
  options: OptionState[];
  votes: Record<string, string>;
  votedOnce: Record<string, true>;          // voted at least once this prompt (public votedIds/doneIds; a hide never clears it)
  likes: Record<string, string[]>;
  likeToggles: Record<string, number>;      // accepted LIKE toggles this prompt (LIKE_TOGGLES_MAX)
  hides: number;
  voided: boolean;
  notice: Notice;
  reveal: Reveal | null;
  awards: Award[];
  records: PromptRecord[];
  usedKeys: string[];                       // memory in + drawn this game (oldest first, deduped, ≤ 300)
  drawn: string[];                          // item ids drawn in this game
}

export interface PublicPrompt {
  id: string; type: BluffType; original: string; translit: string | null; display: string | null;
  lengthHint: "short" | "few" | "sentence" | "free"; rerun: boolean;
}
export interface BluffPublic {
  schema: number;
  phase: Phase;
  round: 1 | 2 | 3;
  roundCount: 3;
  roundKind: RoundKind;
  promptIndex: number;
  promptCount: number;
  multiplier: 1 | 2;
  deadline: number | null;
  prompt: PublicPrompt | null;
  submittedIds: string[];
  spotOnIds: string[];
  options: { id: string; text: string }[];
  votedIds: string[];
  voided: boolean;
  notice: Notice;
  reveal: Omit<Reveal, "durationMs"> & { durationMs: number } | null;
  scores: { playerId: string; score: number; scoreBefore: number }[];
  newIds: string[];
  awards: Award[];
  skipsLeft: number;
  hidesLeft: number;
}
export interface BluffMe {
  myLie: string | null;
  myLieStatus: "none" | "locked" | "spotOn";
  spotOn: boolean;
  help: string | null;
  helpNone: boolean;
  myOptionIds: string[];
  myVote: string | null;
  myLikes: string[];
  foundWhileWriting: boolean;
  editsLeft: number;
  /** JAMAA-GAP (GAME-BLUFF §5.2 vs JAMAA-PLATFORM §2.2): a failed reduce must leave the room state untouched, so a
   *  "too close" probe (which MUST be recorded: probe cap, foundWhileWriting) is accepted and reported here. The phone
   *  shows `bluff.err.tooClose` each time this count goes up. */
  tooCloseCount: number;
  waitingForNext: boolean;
}
export interface BluffExtras { gameId: "bluff"; available: number; bigGroup: boolean }
