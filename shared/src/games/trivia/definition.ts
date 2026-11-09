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
  // JAMAA-PLATFORM §6.2: a game ships by adding its id to GAMES_ENABLED (owner order: bluff, likely, trivia). Neither
  // §6.7 nor GAME-TRIVIA asks lane A to flip this registry flag (SPEC-GAP in the G4 report), so Trivia stays
  // registry-disabled like Bluff; every test, the fixtures and the sim that play it pass `enabledGames` explicitly.
  enabled: false,
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
