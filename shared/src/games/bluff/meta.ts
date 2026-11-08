// Bluff the Answer (JAMAA-PLATFORM §2.10, GAME-BLUFF §2, §3, §9, §10.2). Zod-free and engine-free: clients import it.
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
    // GAME-BLUFF §10.2, in the sheet's order; `phases` = where the ⓘ sheet opens on that section.
    ruleSections: [
      { id: "goal", titleKey: `${K}.rules.goal.title`, bodyKey: `${K}.rules.goal.body`, phases: ["ROUND_INTRO", "HOLD"] },
      { id: "round1", titleKey: `${K}.rules.round1.title`, bodyKey: `${K}.rules.round1.body`, phases: [] },
      { id: "round2", titleKey: `${K}.rules.round2.title`, bodyKey: `${K}.rules.round2.body`, phases: [] },
      { id: "writing", titleKey: `${K}.rules.writing.title`, bodyKey: `${K}.rules.writing.body`, phases: ["WRITING"] },
      { id: "voting", titleKey: `${K}.rules.voting.title`, bodyKey: `${K}.rules.voting.body`, phases: ["VOTING"] },
      { id: "points", titleKey: `${K}.rules.points.title`, bodyKey: `${K}.rules.points.body`, phases: ["REVEAL", "SCORES"] },
      { id: "final", titleKey: `${K}.rules.final.title`, bodyKey: `${K}.rules.final.body`, phases: ["AWARDS", "RESULTS"] },
      { id: "house", titleKey: `${K}.rules.house.title`, bodyKey: `${K}.rules.house.body`, phases: [] },
      { id: "same", titleKey: `${K}.rules.same.title`, bodyKey: `${K}.rules.same.body`, phases: [] },
      { id: "host", titleKey: `${K}.rules.host.title`, bodyKey: `${K}.rules.host.body`, phases: [] },
    ],
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
