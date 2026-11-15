// GAME-TAQRIBAN §9 settings. Pure.
import type { Locale } from "../../../constants";
import { isStringArray, normalizeByDefaults, oneOf } from "../../settings-util";
import { TAQ_LENGTH_IDS, TAQ_PACE_IDS } from "../constants";
import { TAQRIBAN_META } from "../meta";
import type { TaqribanSettings } from "../meta";
import { packsFor } from "./catalog";
import type { TaqribanCatalog } from "./types";

const PACK_ID = /^[a-z0-9-]{1,35}$/;
export const MAX_PACK_IDS = 50;
const validPackIds = isStringArray(PACK_ID, MAX_PACK_IDS);
const VALID: { [K in keyof TaqribanSettings]: (v: unknown) => boolean } = {
  packIds: validPackIds,
  length: oneOf(TAQ_LENGTH_IDS),
  pace: oneOf(TAQ_PACE_IDS),
};
const KEYS = new Set(Object.keys(VALID));

export function normalizeSettings(raw: unknown): TaqribanSettings {
  return normalizeByDefaults(raw, TAQRIBAN_META.settings.defaults, (k, v) => VALID[k](v));
}

function same(a: TaqribanSettings, b: TaqribanSettings): boolean {
  return a.length === b.length && a.pace === b.pace && a.packIds.length === b.packIds.length && a.packIds.every((x, i) => x === b.packIds[i]);
}

/** `settings.apply` (JAMAA-PLATFORM §2.2): null = INVALID_SETTINGS; `s` itself when nothing changes. */
export function applySettings(s: TaqribanSettings, patch: Partial<TaqribanSettings>, content: TaqribanCatalog, locale: Locale): TaqribanSettings | null {
  if (patch === null || typeof patch !== "object") return null;
  for (const [k, v] of Object.entries(patch)) if (!KEYS.has(k) || !VALID[k as keyof TaqribanSettings](v)) return null;
  const allowed = new Set(packsFor(content, locale).map((p) => p.id));
  const packIds = patch.packIds !== undefined ? [...patch.packIds] : s.packIds;
  if (!packIds.every((id) => allowed.has(id))) return null;
  const next: TaqribanSettings = { packIds, length: patch.length ?? s.length, pace: patch.pace ?? s.pace };
  return same(s, next) ? s : next;
}

/** Access restriction (§4.4): locked packs leave the selection. Same object when nothing changes. */
export function restrictSettings(s: TaqribanSettings, a: { playableIds: ReadonlySet<string>; premium: boolean }): TaqribanSettings {
  const packIds = s.packIds.filter((id) => a.playableIds.has(id));
  return packIds.length === s.packIds.length ? s : { ...s, packIds };
}
