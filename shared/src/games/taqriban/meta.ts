// Taqriban! (تقريبًا, "roughly"): the estimation game (GAME-TAQRIBAN). Zod-free and engine-free: the web client and the
// TV generators may import this file.
import type { GameMeta } from "../types";
import { MAX_PLAYERS, MIN_PLAYERS, SETTINGS_SCHEMA, VIEW_VERSION } from "./constants";
import type { TaqLength, TaqPace } from "./constants";

export * from "./constants";

/** `packIds`: [] = every pack playable in the content language (GAME-TAQRIBAN §9). */
export interface TaqribanSettings { packIds: string[]; length: TaqLength; pace: TaqPace }

export const TAQRIBAN_PHASES = ["QUESTION", "REVEAL", "LEADERBOARD", "FINAL_INTRO", "RESULTS", "HOLD"] as const;
export type TaqribanPhase = (typeof TAQRIBAN_PHASES)[number];

/** Question tags (GAME-TAQRIBAN §11.2). */
export const TAQRIBAN_TAGS = ["geo", "people", "nature", "space", "body", "history", "tech", "sport", "food", "money", "culture", "lebanon"] as const;
export type TaqribanTag = (typeof TAQRIBAN_TAGS)[number];

const K = "game.taqriban";
export const TAQRIBAN_META: GameMeta<TaqribanSettings> = {
  id: "taqriban",
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  phases: TAQRIBAN_PHASES,
  rules: {
    titleKey: `${K}.title`,
    taglineKey: `${K}.tagline`,
    howToKeys: [`${K}.howto.1`, `${K}.howto.2`, `${K}.howto.3`, `${K}.howto.4`],
    ruleSections: [
      { id: "guess", titleKey: `${K}.rules.guess.title`, bodyKey: `${K}.rules.guess.body`, phases: ["QUESTION", "HOLD"] },
      { id: "closest", titleKey: `${K}.rules.closest.title`, bodyKey: `${K}.rules.closest.body`, phases: ["REVEAL"] },
      { id: "points", titleKey: `${K}.rules.points.title`, bodyKey: `${K}.rules.points.body`, phases: ["REVEAL", "LEADERBOARD"] },
      { id: "final", titleKey: `${K}.rules.final.title`, bodyKey: `${K}.rules.final.body`, phases: ["FINAL_INTRO", "RESULTS"] },
    ],
    durationMinutes: [6, 12],
    world: "observatory",
    pauseItems: [
      { id: "skip", labelKey: `${K}.pause.skip`, intent: "SKIP_QUESTION", phases: ["QUESTION"], confirm: true },
      { id: "next", labelKey: `${K}.pause.next`, intent: "HOST_ADVANCE", phases: ["REVEAL", "LEADERBOARD", "FINAL_INTRO"] },
      { id: "endGame", labelKey: `${K}.pause.endGame`, intent: "END_GAME", phases: ["HOLD"], confirm: true },
    ],
  },
  carriesScore: false,
  VIEW_VERSION,
  SETTINGS_SCHEMA,
  settings: {
    defaults: { packIds: [], length: "normal", pace: "normal" },
    basic: [
      { key: "packIds", kind: "packs", labelKey: `${K}.settings.packs`, single: false },
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
