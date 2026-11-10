// JAMAA-PLATFORM §2.2 / §2.12: Trivia's server-only GameDefinition (GAME-TRIVIA §4–§7 engine, §8.1 projections, §13).
import type { GameDefinition } from "../types";
import { STATE_SCHEMA } from "./constants";
import { assertInvariants } from "./engine/invariants";
import { join, memory, nextWakeAt, outcome, reduce, start, startBlocker } from "./engine/reduce";
import { applySettings, normalizeSettings, packIdsOf, restrictSettings } from "./engine/settings";
import type { TriviaCatalog, TriviaIntent, TriviaSettings, TriviaState } from "./engine/types";
import type { TriviaExtras, TriviaMe, TriviaPublic } from "./engine/view";
import { TRIVIA_META } from "./meta";
import { FORBIDDEN_KEYS, leakCheck, projectMe, projectPublic, projectSetup, projectStatus, secretsFor } from "./projection/project";

export type TriviaDefinition = GameDefinition<TriviaState, TriviaSettings, TriviaIntent, TriviaPublic, TriviaMe, TriviaCatalog, TriviaExtras>;

export const definition: TriviaDefinition = {
  meta: TRIVIA_META,
  // JAMAA-PLATFORM §6.2 / §2.5: G4 is built, so Trivia is registry-enabled (no longer a stub). It is live only where the
  // deploy's GAMES_ENABLED lists it: production keeps the default "mishana" (server/wrangler.jsonc) until the owner adds
  // "trivia"; local dev turns it on with `GAMES_ENABLED=mishana,trivia pnpm dev` (docs/DEV.md).
  enabled: true,
  stateSchema: STATE_SCHEMA,
  settings: {
    apply: applySettings,
    normalize: normalizeSettings,
    restrict: restrictSettings,
    packIds: packIdsOf,
  },
  start,
  reduce,
  nextWakeAt,
  outcome,
  memory,
  join,
  startBlocker,
  projectSetup: (s, roster, content, _access, locale, mem) => projectSetup(s, roster, content, locale, mem),
  projectPublic: (s) => projectPublic(s),
  projectMe: (s, id) => projectMe(s, id),
  projectStatus,
  assertInvariants,
  secretsFor,
  leakCheck,
  forbiddenKeys: FORBIDDEN_KEYS,
};
