// GAME-TRIVIA engine types: the parsed pack (platform §5.2 PackHeader + §11.3 questions), the engine state, intents.
import type { Locale } from "../../../constants";
import type { AgeRating, Domain, LocalizedTitle, Topic } from "../../../content/types";
import type { Region } from "../../../content/vocab";
import type { LengthId, PaceId, QuestionType, STATE_SCHEMA } from "../constants";
import type { TriviaPhase, TriviaSettings } from "../meta";

export type { TriviaSettings, TriviaPhase, QuestionType, LengthId, PaceId, Domain, Topic, Region, LocalizedTitle, AgeRating };

/** GAME-TRIVIA §11.3, as parsed (defaults applied). `answer` is the AUTHORED index; the engine reshuffles mc4. */
export interface TriviaQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];            // mc4: 4; tf: 2 = the localized [True, False] labels
  answer: number;
  topic: Topic;
  difficulty: 1 | 2 | 3;
  easyIn: Locale[];
  region?: Region | undefined;
  explain?: string | undefined;
  source: string;               // never projected
}

/** One quiz in one locale (`family` shared across locales, same question ids). */
export interface TriviaPack {
  id: string;
  family?: string | undefined;
  game: "trivia";
  version: number;
  locale: "en" | "fr" | "ar" | "ar-LB" | "es";
  script: "Latn" | "Arab";
  title: LocalizedTitle;
  description?: { en: string; fr: string; ar: string; es?: string | undefined } | undefined;
  domain: Domain;
  topics: Topic[];
  featuredTopics: Topic[];
  stars: 1 | 2 | 3;
  ageRating: AgeRating;
  tier: "free" | "premium";
  license: string;
  source: string;
  status: "draft" | "reviewed";
  reviewedBy: string[];
  tags: string[];
  questions: TriviaQuestion[];
}

/** The engine's `C`: the room's PLAYABLE packs (platform §4.4 already removed locked ones). */
export interface TriviaCatalog { packs: readonly TriviaPack[] }

export type TriviaIntent =
  | { type: "ANSWER"; choice: number }
  | { type: "HOST_ADVANCE" }
  | { type: "VOID_QUESTION"; questionId: string }
  | { type: "END_GAME" };

/** A deadline as the clients draw it (kind = the phase; durationMs = at − the moment it was set). */
export interface TriviaDeadline { kind: TriviaPhase; at: number; durationMs: number }

export interface TriviaPlayer {
  id: string;
  seat: number;
  connected: boolean;
  left: boolean;                // LEAVE/KICK: score frozen, never counted as awaited
  waiting: boolean;             // late joiner: watches until the next READ (§6)
  newAt: number | null;         // index of the first question a late joiner plays ("New" ribbon); null = dealt in at start
  score: number;
  streak: number;
  bestStreak: number;
  correct: number;              // tie-break 1
  timeSum: number;              // Σ t of correct answers, ms (tie-break 2)
  fastest: number;              // "Fastest finger" count (results stats)
  boardScore: number;           // score at the previous LEADERBOARD (the race grows from here)
  boardRank: number | null;     // rank at the previous LEADERBOARD (the "+3 places!" arrow)
}

/** The question on screen, copied from the pack when its READ starts (texts never live in state for the others). */
export interface CurrentQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];            // DISPLAYED order (position i = token A/B/C/D, or True/False)
  correctIndex: number;         // displayed position of the right answer: STATE ONLY until REVEAL
  topic: Topic;
  difficulty: 1 | 2 | 3;
  explain: string | null;       // STATE ONLY until REVEAL
  answerMs: number;
  answerOpenAt: number | null;  // server time ANSWER opened
}

export interface Answer { choice: number; timeMs: number }

/** One dealt-in player's result for the last revealed question (+ what VOID_QUESTION needs to restore). */
export interface ChoiceRow {
  id: string;
  choice: number | null;
  correct: boolean;
  timeMs: number | null;
  points: number;               // base + speed (× 2 on the final)
  streakBonus: number;
  prevStreak: number;           // STATE ONLY (void restore)
  prevBest: number;             // STATE ONLY (void restore)
}

export interface QuestionResult {
  index: number;
  questionId: string;
  correctIndex: number;
  isFinal: boolean;
  choices: ChoiceRow[];         // players who could answer, seat order
  fastestIds: string[];
  onFireIds: string[];
  stumped: boolean;
  genius: boolean;
  voided: boolean;
}

export interface QuizInfo {
  id: string;                   // the FAMILY (settings.quizId)
  packId: string;
  title: LocalizedTitle;
  stars: 1 | 2 | 3;
  domain: Domain;
  featuredTopics: Topic[];
  topicCount: number;
  questionCount: number;
}

export interface TriviaState {
  schema: typeof STATE_SCHEMA;
  phase: TriviaPhase;
  settings: TriviaSettings;
  locale: Locale;
  quiz: QuizInfo;
  questionIds: string[];        // the drawn questions, in play order (texts are resolved from the pack per question)
  index: number;                // current (READ/ANSWER/REVEAL), last revealed (LEADERBOARD/FINAL_INTRO), next (QUIZ_INTRO/HOLD)
  shown: number;                // questions that reached READ (→ memory)
  deadline: TriviaDeadline | null;
  cur: CurrentQuestion | null;
  answers: Record<string, Answer>;   // current question, STATE ONLY before REVEAL
  last: QuestionResult | null;  // the last revealed question
  players: TriviaPlayer[];      // seat order
  rerun: boolean;               // the draw had to reuse questions already played in this room (§6)
  voidedQuestionIds: string[];  // content-review report (§6)
  endedEarly: boolean;          // the quiz pack became unplayable mid-game (access change): ended at RESULTS
  usedKeys: string[];           // room memory at start ("<family>:<id>"), STATE ONLY
  rngState: number;             // STATE ONLY
}
