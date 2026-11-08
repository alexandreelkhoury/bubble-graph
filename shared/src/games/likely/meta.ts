// Who's Most Likely To… (JAMAA-PLATFORM §2.11, GAME-LIKELY). Zod-free and engine-free: the web client and the TV
// generators may import this at runtime. The engine (engine/) reads its numbers from here, so the doc, the clients and
// the server share one copy.
import type { GameMeta, SettingField } from "../types";

export * from "./layout";

/** GAME-LIKELY §9: `mode` added in draft 3 (SETTINGS_SCHEMA 2). */
export type LikelyMode = "family" | "spicy";
export type LikelyLength = "short" | "normal" | "long";
export interface LikelySettings { packIds: string[]; length: LikelyLength; showVoters: boolean; mode: LikelyMode }

/** GAME-LIKELY §3. */
export const LIKELY_LENGTHS: Readonly<Record<LikelyLength, number>> = { short: 8, normal: 12, long: 16 };

/**
 * GAME-LIKELY §9.1 rule 2: a move to Spicy needs the TV actor, and JAMAA-PLATFORM §2.2 `settings.apply` has no actor yet
 * (platform open item). Until it does, G3 ships with Spicy compiled out: the `mode` row is not offered and the server
 * refuses `mode: "spicy"` (INVALID_SETTINGS). The engine itself is Spicy-complete and tested with the switch on.
 */
export const LIKELY_SPICY_ENABLED = false;

/** Phases of a running instance (GAME-LIKELY §4; there is no INTRO phase). */
export const LIKELY_PHASES = ["CARD", "VOTING", "REVEAL", "AWARDS", "RESULTS", "HOLD"] as const;
export type LikelyPhase = (typeof LIKELY_PHASES)[number];

/** Award kinds (GAME-LIKELY §6.2). `selfAware` and `mindReader` exist in public mode only. */
export const LIKELY_AWARD_KINDS = ["signature", "mystery", "star", "selfAware", "mindReader"] as const;
export type LikelyAwardKind = (typeof LIKELY_AWARD_KINDS)[number];

/** Reasons of a public-mode point delta (GAME-LIKELY §13.2). */
export const LIKELY_DELTA_REASONS = ["agree", "unanimous", "selfAware"] as const;
export type LikelyDeltaReason = (typeof LIKELY_DELTA_REASONS)[number];

/** Card tags (GAME-LIKELY §11.2); `romance` only on Spicy cards. */
export const LIKELY_TAGS = ["party", "food", "family", "travel", "habits", "lebanon", "tech", "music", "sport", "future", "romance"] as const;
export type LikelyTag = (typeof LIKELY_TAGS)[number];

/** Timers (GAME-LIKELY §4.1, §12.2), for client countdowns and tests. */
export const LIKELY_TIMING = {
  CARD_MS: 3_500,
  EARLY_END_MS: 1_000,
  VOTING_BASE_MS: 14_000,
  VOTING_PER_PLAYER_MS: 1_000,
  VOTING_MIN_MS: 18_000,
  VOTING_MAX_MS: 26_000,
  REVEAL_MIN_MS: 6_000,
  REVEAL_MAX_MS: 9_500,
  AWARDS_BASE_MS: 3_000,
  AWARDS_TRIO_MS: 4_000,
  AWARDS_MIND_READER_MS: 4_000,
} as const;

/** `clamp(14 000 + 1 000 × n, 18 000, 26 000)`, n = players in game (GAME-LIKELY §4.1). */
export function likelyVotingMs(players: number): number {
  const t = LIKELY_TIMING;
  return Math.min(t.VOTING_MAX_MS, Math.max(t.VOTING_MIN_MS, t.VOTING_BASE_MS + t.VOTING_PER_PLAYER_MS * players));
}

/**
 * GAME-LIKELY §12.2: `5 000 + 100 × votes + (unanimous ? 1 200 : 0) + (ties > 1 ? 600 : 0)`, max 9 500. §4.1 also bounds
 * REVEAL to 6 000–9 500 ms; the formula alone gives 5 000 with no vote, so it is clamped to 6 000 (SPEC-GAP, reported).
 */
export function likelyRevealMs(votes: number, unanimous: boolean, topCount: number): number {
  const t = LIKELY_TIMING;
  return Math.min(t.REVEAL_MAX_MS, Math.max(t.REVEAL_MIN_MS, 5_000 + 100 * votes + (unanimous ? 1_200 : 0) + (topCount > 1 ? 600 : 0)));
}

/** `3 000 + 4 000 × ceil(players / 3) + 4 000` (the last 4 000 = Mind Reader, public mode only; GAME-LIKELY §4.1). */
export function likelyAwardsMs(players: number, publicMode: boolean): number {
  const t = LIKELY_TIMING;
  return t.AWARDS_BASE_MS + t.AWARDS_TRIO_MS * Math.ceil(players / 3) + (publicMode ? t.AWARDS_MIND_READER_MS : 0);
}

const K = "game.likely";

const MODE_ROW: SettingField = {
  key: "mode", kind: "choice", labelKey: `${K}.setup.mode`, options: [
    { value: "family", labelKey: `${K}.setup.mode.family` }, { value: "spicy", labelKey: `${K}.setup.mode.spicy` },
  ],
};

export const LIKELY_META: GameMeta<LikelySettings> = {
  id: "likely",
  minPlayers: 3,
  maxPlayers: 12,
  phases: LIKELY_PHASES,
  rules: {
    titleKey: `${K}.title`,
    taglineKey: `${K}.tagline`,
    // The intro and the rules sheet pick the `.anon` variants of howto.3/.4 when showVoters is false (GAME-LIKELY §10.1).
    howToKeys: [`${K}.howto.1`, `${K}.howto.2`, `${K}.howto.3`, `${K}.howto.4`],
    // GAME-LIKELY §10.2, highlighted in the phases where each section matters.
    ruleSections: [
      { id: "vote", titleKey: `${K}.rules.vote.title`, bodyKey: `${K}.rules.vote.body`, phases: ["CARD", "VOTING"] },
      { id: "points", titleKey: `${K}.rules.points.title`, bodyKey: `${K}.rules.points.body`, phases: ["REVEAL"] },
      { id: "chaos", titleKey: `${K}.rules.chaos.title`, bodyKey: `${K}.rules.chaos.body`, phases: ["REVEAL"] },
      { id: "awards", titleKey: `${K}.rules.awards.title`, bodyKey: `${K}.rules.awards.body`, phases: ["AWARDS", "RESULTS"] },
      { id: "secret", titleKey: `${K}.rules.secret.title`, bodyKey: `${K}.rules.secret.body`, phases: ["VOTING", "REVEAL"] },
      ...(LIKELY_SPICY_ENABLED ? [{ id: "spicy", titleKey: `${K}.rules.spicy.title`, bodyKey: `${K}.rules.spicy.body`, phases: ["CARD", "VOTING"] }] : []),
    ],
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
  SETTINGS_SCHEMA: 2,
  settings: {
    defaults: { packIds: [], length: "normal", showVoters: true, mode: "family" },
    basic: [
      { key: "packIds", kind: "packs", labelKey: `${K}.settings.packs`, single: false },
      { key: "length", kind: "choice", labelKey: `${K}.settings.length`, options: [
        { value: "short", labelKey: `${K}.settings.length.short` }, { value: "normal", labelKey: `${K}.settings.length.normal` }, { value: "long", labelKey: `${K}.settings.length.long` },
      ] },
      { key: "showVoters", kind: "toggle", labelKey: `${K}.settings.showVoters` },
      ...(LIKELY_SPICY_ENABLED ? [MODE_ROW] : []),
    ],
    advanced: [],
    premiumKeys: [],
  },
};
