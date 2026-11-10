// Trivia / Quiz Night (JAMAA-PLATFORM §2.12, GAME-TRIVIA §2, §9, §10). Zod-free and engine-free: the web client and the
// generators may import this file.
import type { GameMeta } from "../types";
import { MAX_PLAYERS, MIN_PLAYERS, SETTINGS_SCHEMA, VIEW_VERSION } from "./constants";
import type { LengthId, PaceId } from "./constants";

export * from "./constants";

/** `quizId` is a FAMILY id (e.g. "lb-quiz-01"); null = the first featured quiz playable in the content language. */
export interface TriviaSettings { quizId: string | null; length: LengthId; pace: PaceId }

export const TRIVIA_PHASES = ["QUIZ_INTRO", "READ", "ANSWER", "REVEAL", "LEADERBOARD", "FINAL_INTRO", "RESULTS", "HOLD"] as const;
export type TriviaPhase = (typeof TRIVIA_PHASES)[number];

const K = "game.trivia";
export const TRIVIA_META: GameMeta<TriviaSettings> = {
  id: "trivia",
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  phases: TRIVIA_PHASES,
  rules: {
    titleKey: `${K}.title`,
    taglineKey: `${K}.tagline`,
    howToKeys: [`${K}.howto.1`, `${K}.howto.2`, `${K}.howto.3`, `${K}.howto.4`],
    // GAME-TRIVIA §10.2, in the sheet's order; `phases` drives the ⓘ "You are here" highlight.
    ruleSections: [
      { id: "answer", titleKey: `${K}.rules.answer.title`, bodyKey: `${K}.rules.answer.body`, phases: ["QUIZ_INTRO", "READ", "ANSWER", "HOLD"] },
      { id: "points", titleKey: `${K}.rules.points.title`, bodyKey: `${K}.rules.points.body`, phases: ["REVEAL"] },
      { id: "streaks", titleKey: `${K}.rules.streaks.title`, bodyKey: `${K}.rules.streaks.body`, phases: ["LEADERBOARD"] },
      { id: "final", titleKey: `${K}.rules.final.title`, bodyKey: `${K}.rules.final.body`, phases: ["FINAL_INTRO"] },
      { id: "ties", titleKey: `${K}.rules.ties.title`, bodyKey: `${K}.rules.ties.body`, phases: ["RESULTS"] },
    ],
    durationMinutes: [5, 10],
    world: "quiz-studio",
    // GAME-TRIVIA §2 pause menu, in order.
    pauseItems: [
      { id: "next", labelKey: `${K}.pause.next`, intent: "HOST_ADVANCE", phases: ["QUIZ_INTRO", "REVEAL", "LEADERBOARD", "FINAL_INTRO"] },
      { id: "voidQuestion", labelKey: `${K}.pause.void`, intent: "VOID_QUESTION", phases: ["REVEAL"], confirm: true },
      { id: "endGame", labelKey: `${K}.pause.endGame`, intent: "END_GAME", phases: ["HOLD"], confirm: true },
    ],
  },
  carriesScore: false,
  VIEW_VERSION,
  SETTINGS_SCHEMA,
  settings: {
    defaults: { quizId: null, length: "normal", pace: "normal" },
    basic: [
      // Hidden by the setup UI while only one quiz is playable (GAME-TRIVIA §9: the summary card shows instead).
      { key: "quizId", kind: "packs", labelKey: `${K}.settings.quiz`, single: true },
      { key: "length", kind: "choice", labelKey: `${K}.settings.length`, options: [
        { value: "short", labelKey: `${K}.settings.lengthShort` }, { value: "normal", labelKey: `${K}.settings.lengthNormal` }, { value: "long", labelKey: `${K}.settings.lengthLong` },
      ] },
      { key: "pace", kind: "choice", labelKey: `${K}.settings.pace`, options: [
        { value: "relaxed", labelKey: `${K}.settings.paceRelaxed` }, { value: "normal", labelKey: `${K}.settings.paceNormal` }, { value: "fast", labelKey: `${K}.settings.paceFast` },
      ] },
    ],
    advanced: [],
    premiumKeys: [],
  },
};
