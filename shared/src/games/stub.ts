// JAMAA-PLATFORM §6.1: the stub GameDefinition P registers for G2–G4 (`enabled: false`). Each G lane replaces its own
// games/<id>/definition.ts; this helper is then unused by that game.
import type { PackCatalog } from "../content/types";
import type { GameDefinition, GameMeta } from "./types";
import { normalizeByDefaults } from "./settings-util";

/** A stub instance never exists (start always fails); the type only keeps the registry total. */
export interface StubState { schema: 0 }

export function stubDefinition<Settings extends object, Extras>(
  meta: GameMeta<Settings>,
  valid: { [K in keyof Settings]: (v: unknown) => boolean },
  packIds: (s: Settings) => readonly string[],
  extras: () => Extras,
): GameDefinition<StubState, Settings, never, Record<string, never>, Record<string, never>, PackCatalog<never>, Extras> {
  return {
    meta,
    enabled: false,
    stateSchema: 0,
    settings: {
      apply: () => null,
      normalize: (raw) => normalizeByDefaults(raw, meta.settings.defaults, (k, v) => valid[k](v)),
      restrict: (s) => s,
      packIds,
    },
    start: () => ({ ok: false, error: "GAME_DISABLED", state: { schema: 0 } }),
    reduce: (s) => ({ ok: false, error: "GAME_DISABLED", state: s }),
    nextWakeAt: () => null,
    outcome: () => null,
    memory: () => ({ usedKeys: [] }),
    startBlocker: () => "GAME_DISABLED",
    projectSetup: extras,
    projectPublic: () => ({}),
    projectMe: () => null,
    projectStatus: () => ({ phase: meta.phases[0] ?? "", doneIds: [], awaitedIds: [] }),
    assertInvariants: () => undefined,
    secretsFor: () => [],
    leakCheck: () => [],
    forbiddenKeys: [],
  };
}
