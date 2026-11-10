// JAMAA-PLATFORM §2.2 / §2.11: Likely's server-only GameDefinition (GAME-LIKELY §4–§7 engine, §8.1 projections, §13).
// `createLikelyDefinition({ spicyEnabled })` lets tests exercise Spicy while the shipped definition keeps it compiled out
// (LIKELY_SPICY_ENABLED = false, GAME-LIKELY §9.1 rule 2: `settings.apply` has no actor yet).
import type { Locale } from "../../constants";
import type { GameActor, GameDefinition } from "../types";
import type { LikelyCatalog } from "./engine/catalog";
import { assertInvariants } from "./engine/invariants";
import { join, memory, nextWakeAt, outcome, reduce, start, startBlocker } from "./engine/reduce";
import { applySettings, normalizeSettings, restrictSettings } from "./engine/settings";
import type { LikelySettingsPatch } from "./engine/settings";
import { STATE_SCHEMA } from "./engine/state";
import type { LikelyEngineOptions, LikelyExtras, LikelyIntent, LikelyMe, LikelyPublic, LikelyState } from "./engine/state";
import { LIKELY_META, LIKELY_SPICY_ENABLED } from "./meta";
import type { LikelySettings } from "./meta";
import { FORBIDDEN_KEYS, leakCheck, projectMe, projectPublic, projectSetup, projectStatus, secretsFor } from "./projection/project";

export type LikelyDefinition = GameDefinition<LikelyState, LikelySettings, LikelyIntent, LikelyPublic, LikelyMe, LikelyCatalog, LikelyExtras> & {
  settings: {
    /** The optional `by` is the §9.1 rule 2 addition (JAMAA-GAP: the platform does not pass it yet, so Spicy fails closed). */
    apply(s: LikelySettings, patch: LikelySettingsPatch, content: LikelyCatalog, locale: Locale, by?: GameActor): LikelySettings | null;
  };
};

export function createLikelyDefinition(opt: LikelyEngineOptions): LikelyDefinition {
  return {
    meta: LIKELY_META,
    // JAMAA-PLATFORM §6.2 / §2.5: G3 is built, so Likely is registry-enabled (no longer a stub; owner-approved in the G3
    // review, as Trivia did for G4). It is live only where the deploy's GAMES_ENABLED lists it: production keeps the
    // default (server/wrangler.jsonc) until the owner adds "likely"; local dev: `GAMES_ENABLED=mishana,likely pnpm dev`.
    enabled: true,
    stateSchema: STATE_SCHEMA,
    settings: {
      apply: (s, patch, content, locale, by?: GameActor) => applySettings(s, patch, content, locale, by, opt),
      normalize: (raw) => normalizeSettings(raw, opt),
      restrict: (s, a, content, locale) => restrictSettings(s, a, content, locale, opt),
      packIds: (s) => s.packIds,
    },
    start: (a) => start(a, opt),
    reduce,
    nextWakeAt,
    outcome,
    memory,
    join,
    startBlocker: (roster, s, content, locale) => startBlocker(roster, s, content, locale, opt),
    projectSetup,
    projectPublic: (s) => projectPublic(s),
    projectMe: (s, playerId) => projectMe(s, playerId),
    projectStatus,
    assertInvariants,
    secretsFor,
    leakCheck,
    forbiddenKeys: FORBIDDEN_KEYS,
  };
}

export const definition = createLikelyDefinition({ spicyEnabled: LIKELY_SPICY_ENABLED });
