// Trivia / Quiz Night (JAMAA-PLATFORM §2.12, GAME-TRIVIA). STUB created in P: the G4 lane replaces this file's values
// (rule sections, settings rows) from GAME-TRIVIA. Zod-free and engine-free.
import type { GameMeta } from "../types";

/** `quizId` is a FAMILY id (e.g. "lb-quiz-01"); null = the first featured quiz playable in the content language. */
export interface TriviaSettings { quizId: string | null; length: "short" | "normal" | "long"; pace: "relaxed" | "normal" | "fast" }

const K = "game.trivia";
export const TRIVIA_META: GameMeta<TriviaSettings> = {
  id: "trivia",
  minPlayers: 1,
  maxPlayers: 12,
  phases: ["QUIZ_INTRO", "READ", "ANSWER", "REVEAL", "LEADERBOARD", "FINAL_INTRO", "RESULTS", "HOLD"],
  rules: {
    titleKey: `${K}.title`,
    taglineKey: `${K}.tagline`,
    howToKeys: [`${K}.howto.1`, `${K}.howto.2`, `${K}.howto.3`, `${K}.howto.4`],
    ruleSections: [],
    durationMinutes: [5, 10],
    world: "quiz-studio",
    pauseItems: [
      { id: "next", labelKey: `${K}.pause.next`, intent: "HOST_ADVANCE", phases: ["QUIZ_INTRO", "REVEAL", "LEADERBOARD", "FINAL_INTRO"] },
      { id: "voidQuestion", labelKey: `${K}.pause.voidQuestion`, intent: "VOID_QUESTION", phases: ["REVEAL"], confirm: true },
      { id: "endGame", labelKey: `${K}.pause.endGame`, intent: "END_GAME", phases: ["HOLD"], confirm: true },
    ],
  },
  carriesScore: false,
  VIEW_VERSION: 1,
  SETTINGS_SCHEMA: 1,
  settings: {
    defaults: { quizId: null, length: "normal", pace: "normal" },
    basic: [
      { key: "quizId", kind: "packs", labelKey: `${K}.settings.quiz`, single: true },
      { key: "length", kind: "choice", labelKey: `${K}.settings.length`, options: [
        { value: "short", labelKey: `${K}.settings.length.short` }, { value: "normal", labelKey: `${K}.settings.length.normal` }, { value: "long", labelKey: `${K}.settings.length.long` },
      ] },
      { key: "pace", kind: "choice", labelKey: `${K}.settings.pace`, options: [
        { value: "relaxed", labelKey: `${K}.settings.pace.relaxed` }, { value: "normal", labelKey: `${K}.settings.pace.normal` }, { value: "fast", labelKey: `${K}.settings.pace.fast` },
      ] },
    ],
    advanced: [],
    premiumKeys: [],
  },
};
