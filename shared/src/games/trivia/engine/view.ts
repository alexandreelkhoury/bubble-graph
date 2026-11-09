// GAME-TRIVIA §13.2 view types (zod-free mirrors of games/trivia/protocol.ts; protocol.ts checks they agree).
// JAMAA-GAP (G4): §13.2 lists the minimum fields; the additions below are the ones the screens of §8.3 / §12 need
// (marked "+"). None of them carries a secret: they only exist once their data is public.
import type { Domain, Topic } from "../../../content/vocab";
import type { QuestionType } from "../constants";
import type { TriviaPhase } from "../meta";
import type { QuizCard } from "./quiz";

export interface TriviaQuizView {
  id: string;                         // the FAMILY (settings.quizId resolved)
  title: { en: string; fr: string; ar: string; es?: string | undefined };
  stars: 1 | 2 | 3;
  domain: Domain;
  featuredTopics: Topic[];
  topicCount: number;
  questionCount: number;
}

/** READ, ANSWER and REVEAL only. Never `explain`, `source` or the answer before REVEAL. */
export interface TriviaQuestionView {
  id: string;                         // + the VOID_QUESTION argument (pause menu)
  text: string;
  type: QuestionType;
  topic: Topic;
  difficulty: 1 | 2 | 3;
}

export interface TriviaChoiceView {
  id: string;                         // playerId
  choice: number | null;              // displayed position, null = no answer
  correct: boolean;
  timeMs: number | null;
  points: number;                     // base + speed (× 2 on the final); 0 when wrong or voided
  streakBonus: number;
}

/** REVEAL only. */
export interface TriviaRevealView {
  correct: number;                    // displayed position of the right answer
  choices: TriviaChoiceView[];        // every player who could answer, seat order
  fastestIds: string[];
  onFireIds: string[];                // + streak reached 3, 5, 7… on this question
  stumped: boolean;
  genius: boolean;
  tooSlow: boolean;                   // + nobody answered ("Too slow, everyone!", §6)
  explain: string | null;
  voided: boolean;                    // + the host voided this question (points removed)
}

export interface TriviaScoreView {
  playerId: string;
  score: number;
  /** REVEAL: the score before this question; LEADERBOARD: the score at the previous board (the race grows from it);
   *  other phases: = score. */
  scoreBefore: number;
  /** + the rank `scoreBefore` had (REVEAL: before this question; LEADERBOARD: at the previous board, null at the first). */
  rankBefore: number | null;
  streak: number;
  bestStreak: number;                 // + results stat "Longest streak"
  correct: number;                    // correct answers so far (a COUNT; tie-break 1)
  fastest: number;                    // + results stat "Fastest finger ×n"
  rank: number | null;                // §5.3 shared places (1, 1, 3); null for a player who left (greyed, unranked)
  left: boolean;                      // +
}

export interface TriviaPublic {
  schema: number;                     // VIEW_VERSION
  phase: TriviaPhase;
  quiz: TriviaQuizView;
  rerun: boolean;                     // + the draw reused questions already played in this room (quiz card "Rerun")
  /** 0-based: the question on screen (READ/ANSWER/REVEAL), the last revealed one (LEADERBOARD/FINAL_INTRO/RESULTS),
   *  the next one (QUIZ_INTRO/HOLD). The TV shows "index + 1 / total". */
  index: number;
  total: number;
  isFinal: boolean;                   // the final question is on screen, or FINAL_INTRO
  deadline: number | null;            // server time the phase ends
  durationMs: number | null;          // + its full length (the bulb ring / "get ready" bar)
  question: TriviaQuestionView | null;
  options: string[];                  // ANSWER and REVEAL, displayed order (A..D, or True/False)
  answeredIds: string[];              // ANSWER: who locked in (never what); REVEAL: who answered
  reveal: TriviaRevealView | null;
  scores: TriviaScoreView[];          // best first; left players last
  newIds: string[];                   // + late joiners on their first question ("New" ribbon)
  waitingIds: string[];               // + late joiners waiting for the next READ
  endedEarly: boolean;                // + the quiz became unplayable mid-game; RESULTS came early
}

export interface TriviaMe {
  myChoice: number | null;            // own answer: ANSWER (after the tap) and REVEAL only
  myTimeMs: number | null;
  waitingForNext: boolean;
}

export interface TriviaExtras {
  gameId: "trivia";
  /** Questions in the resolved quiz for the content language ("7 questions available"); 0 = no quiz. */
  available: number;
  /** + questions this length will play: min(length, available). */
  playCount: number;
  /** + fewer fresh (never played in this room) questions than `playCount`: the quiz card shows "Rerun". */
  rerun: boolean;
  /** The quiz summary card (one quiz) / the selected card (shelf). */
  quiz: QuizCard | null;
  /** + every playable quiz in the content language, catalog order (the shelf rows and the VIP list); with fewer than
   *  2 the `quizId` row is hidden and the summary card shows instead (§9.1). */
  quizzes: QuizCard[];
}
