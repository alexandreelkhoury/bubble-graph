// JAMAA-PLATFORM §2.2: Taqriban's server-only GameDefinition (GAME-TAQRIBAN §4–§7 engine, §8.1 projections, §13).
import type { GameDefinition } from "../types";
import { STATE_SCHEMA } from "./constants";
import { assertInvariants } from "./engine/invariants";
import { join, memory, nextWakeAt, outcome, reduce, start, startBlocker } from "./engine/reduce";
import { applySettings, normalizeSettings, restrictSettings } from "./engine/settings";
import type { TaqribanCatalog, TaqribanExtras, TaqribanIntent, TaqribanMe, TaqribanPublic, TaqribanState } from "./engine/types";
import { TAQRIBAN_META } from "./meta";
import type { TaqribanSettings } from "./meta";
import { FORBIDDEN_KEYS, leakCheck, projectMe, projectPublic, projectSetup, projectStatus, secretsFor } from "./projection/project";

export type TaqribanDefinition = GameDefinition<TaqribanState, TaqribanSettings, TaqribanIntent, TaqribanPublic, TaqribanMe, TaqribanCatalog, TaqribanExtras>;

export const definition: TaqribanDefinition = {
  meta: TAQRIBAN_META,
  // Registry-enabled; live only where the deploy's GAMES_ENABLED lists it (server/wrangler.jsonc: the preview env).
  enabled: true,
  stateSchema: STATE_SCHEMA,
  settings: {
    apply: applySettings,
    normalize: normalizeSettings,
    restrict: (s, a) => restrictSettings(s, a),
    packIds: (s) => s.packIds,
  },
  start,
  reduce,
  nextWakeAt,
  outcome,
  memory,
  join,
  startBlocker,
  projectSetup,
  projectPublic: (s) => projectPublic(s),
  projectMe: (s, id) => projectMe(s, id),
  projectStatus,
  assertInvariants,
  secretsFor,
  leakCheck,
  forbiddenKeys: FORBIDDEN_KEYS,
};
