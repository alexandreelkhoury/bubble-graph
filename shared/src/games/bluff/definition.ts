// JAMAA-PLATFORM §2.2 / §2.10: Bluff's server-only GameDefinition (GAME-BLUFF §4–§7 engine, §8.1 projections, §13).
import type { Locale } from "../../constants";
import type { GameDefinition } from "../types";
import { isStringArray, normalizeByDefaults, oneOf } from "../settings-util";
import { BIG_GROUP } from "./engine/constants";
import { type BluffCatalog, contentCounts } from "./engine/catalog";
import { assertInvariants } from "./engine/invariants";
import { join, memory, nextWakeAt, outcome, reduce, start, startBlocker } from "./engine/reduce";
import type { BluffExtras, BluffIntent, BluffMe, BluffPublic, BluffSettings, BluffState } from "./engine/state";
import { STATE_SCHEMA } from "./engine/state";
import { BLUFF_META } from "./meta";
import { FORBIDDEN_KEYS, leakCheck, projectMe, projectPublic, projectStatus, secretsFor } from "./projection/project";

const PACK_ID = /^[a-z0-9-]{1,35}$/;
const VALID: { [K in keyof BluffSettings]: (v: unknown) => boolean } = {
  packIds: isStringArray(PACK_ID, 50),
  length: oneOf(["short", "normal", "long"]),
  pace: oneOf(["relaxed", "normal", "fast"]),
};
/** Pack ids (= family ids: every Bluff pack is its own family, GAME-BLUFF §9) playable in `locale` in this room. */
const packsIn = (cat: BluffCatalog, locale: Locale): Set<string> => new Set(cat.packs.filter((p) => p.playableIn.includes(locale)).map((p) => p.id));

export type BluffDefinition = GameDefinition<BluffState, BluffSettings, BluffIntent, BluffPublic, BluffMe, BluffCatalog, BluffExtras>;

export const definition: BluffDefinition = {
  meta: BLUFF_META,
  // JAMAA-PLATFORM §6.2 / §2.5: G2 is built, so Bluff is registry-enabled (no longer a stub; owner-approved, as Likely
  // and Trivia were for G3/G4). It is live only where the deploy's GAMES_ENABLED lists it: production keeps
  // server/wrangler.jsonc's list until the owner appends "bluff"; local dev (tools/dev.mjs) already lists it.
  enabled: true,
  stateSchema: STATE_SCHEMA,
  settings: {
    apply(s, patch, content, locale) {
      const next: BluffSettings = { packIds: [...s.packIds], length: s.length, pace: s.pace };
      for (const [k, v] of Object.entries(patch)) {
        if (!(k in VALID) || !VALID[k as keyof BluffSettings](v)) return null;
        (next as unknown as Record<string, unknown>)[k] = Array.isArray(v) ? [...(v as string[])] : v;
      }
      // Every selected pack must be playable in the content language for this room (JAMAA-PLATFORM §2.5 fitSettings).
      const ok = packsIn(content, locale);
      if (next.packIds.some((id) => !ok.has(id))) return null;
      return next;
    },
    normalize: (raw) => normalizeByDefaults(raw, BLUFF_META.settings.defaults, (k, v) => VALID[k](v)),
    restrict(s, a) {
      const kept = s.packIds.filter((id) => a.playableIds.has(id));
      return kept.length === s.packIds.length ? s : { ...s, packIds: kept };
    },
    packIds: (s) => s.packIds,
  },
  start,
  reduce,
  nextWakeAt,
  outcome,
  memory,
  join,
  startBlocker,
  projectSetup(s, roster, content, _access, locale) {
    const c = contentCounts(content, s.packIds, locale);
    return { gameId: "bluff", available: c.r1 + c.r2, bigGroup: roster.length >= BIG_GROUP };
  },
  projectPublic: (s) => projectPublic(s),
  projectMe: (s, id) => projectMe(s, id),
  projectStatus,
  assertInvariants,
  secretsFor,
  leakCheck,
  forbiddenKeys: FORBIDDEN_KEYS,
};
