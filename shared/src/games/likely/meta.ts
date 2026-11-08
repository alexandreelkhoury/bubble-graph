// Who's Most Likely To… (JAMAA-PLATFORM §2.11, GAME-LIKELY). STUB created in P: the G3 lane replaces this file's values
// (rule sections, settings rows) from GAME-LIKELY. Zod-free and engine-free.
import type { GameMeta } from "../types";

export interface LikelySettings { packIds: string[]; length: "short" | "normal" | "long"; showVoters: boolean }

const K = "game.likely";
export const LIKELY_META: GameMeta<LikelySettings> = {
  id: "likely",
  minPlayers: 3,
  maxPlayers: 12,
  phases: ["CARD", "VOTING", "REVEAL", "AWARDS", "RESULTS", "HOLD"],
  rules: {
    titleKey: `${K}.title`,
    taglineKey: `${K}.tagline`,
    howToKeys: [`${K}.howto.1`, `${K}.howto.2`, `${K}.howto.3`, `${K}.howto.4`],
    ruleSections: [],
    durationMinutes: [6, 10],
    world: "rooftop",
    pauseItems: [
      { id: "skipCard", labelKey: `${K}.pause.skipCard`, intent: "SKIP_CARD", phases: ["CARD", "VOTING"] },
      { id: "next", labelKey: `${K}.pause.next`, intent: "HOST_ADVANCE", phases: ["CARD", "REVEAL", "AWARDS"] },
      { id: "endGame", labelKey: `${K}.pause.endGame`, intent: "END_GAME", phases: ["HOLD"], confirm: true },
    ],
  },
  carriesScore: false,
  VIEW_VERSION: 1,
  SETTINGS_SCHEMA: 1,
  settings: {
    defaults: { packIds: [], length: "normal", showVoters: true },
    basic: [
      { key: "packIds", kind: "packs", labelKey: `${K}.settings.packs`, single: false },
      { key: "length", kind: "choice", labelKey: `${K}.settings.length`, options: [
        { value: "short", labelKey: `${K}.settings.length.short` }, { value: "normal", labelKey: `${K}.settings.length.normal` }, { value: "long", labelKey: `${K}.settings.length.long` },
      ] },
      { key: "showVoters", kind: "toggle", labelKey: `${K}.settings.showVoters` },
    ],
    advanced: [],
    premiumKeys: [],
  },
};
