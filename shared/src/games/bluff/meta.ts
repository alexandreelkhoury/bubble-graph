// Bluff the Answer (JAMAA-PLATFORM §2.10, GAME-BLUFF). STUB created in P: the G2 lane replaces this file's values
// (rule sections, settings rows) from GAME-BLUFF. Zod-free and engine-free.
import type { GameMeta } from "../types";

export interface BluffSettings { packIds: string[]; length: "short" | "normal" | "long"; pace: "relaxed" | "normal" | "fast" }

const K = "game.bluff";
export const BLUFF_META: GameMeta<BluffSettings> = {
  id: "bluff",
  minPlayers: 3,
  maxPlayers: 12,
  phases: ["ROUND_INTRO", "WRITING", "VOTING", "REVEAL", "SCORES", "AWARDS", "RESULTS", "HOLD"],
  rules: {
    titleKey: `${K}.title`,
    taglineKey: `${K}.tagline`,
    howToKeys: [`${K}.howto.1`, `${K}.howto.2`, `${K}.howto.3`, `${K}.howto.4`],
    ruleSections: [],
    durationMinutes: [15, 20],
    world: "hakawati-cafe",
    pauseItems: [
      { id: "skipPrompt", labelKey: `${K}.pause.skipPrompt`, intent: "SKIP_PROMPT", phases: ["WRITING"] },
      { id: "hideOption", labelKey: `${K}.pause.hideOption`, intent: "HIDE_OPTION", phases: ["VOTING"] },
      { id: "next", labelKey: `${K}.pause.next`, intent: "HOST_ADVANCE", phases: ["ROUND_INTRO", "REVEAL", "SCORES", "AWARDS"] },
      { id: "endGame", labelKey: `${K}.pause.endGame`, intent: "END_GAME", phases: ["HOLD"], confirm: true },
    ],
  },
  carriesScore: false,
  VIEW_VERSION: 1,
  SETTINGS_SCHEMA: 1,
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
