// GAME-LIKELY §9 settings and the §9.1 Spicy 18+ gate. Pure.
import type { Locale } from "../../../constants";
import { isBool, isStringArray, normalizeByDefaults, oneOf } from "../../settings-util";
import type { GameActor } from "../../types";
import { LIKELY_LENGTHS, LIKELY_META } from "../meta";
import type { LikelyMode, LikelySettings } from "../meta";
import { packAllowed, packsFor, spicyPlayable } from "./catalog";
import type { LikelyCatalog } from "./catalog";

/** The patch may carry `ageConfirmed` (never stored): required to move `mode` to "spicy" (§9.1 rule 2). */
export type LikelySettingsPatch = Partial<LikelySettings> & { ageConfirmed?: boolean };
export interface SpicyOptions { spicyEnabled: boolean }

const PACK_ID = /^[a-z0-9-]{1,35}$/;
export const MAX_PACK_IDS = 50;
const validPackIds = isStringArray(PACK_ID, MAX_PACK_IDS);
const VALID: { [K in keyof LikelySettings]: (v: unknown) => boolean } = {
  packIds: validPackIds,
  length: oneOf(Object.keys(LIKELY_LENGTHS)),
  showVoters: isBool,
  mode: oneOf(["family", "spicy"]),
};
const PATCH_KEYS = new Set(["packIds", "length", "showVoters", "mode", "ageConfirmed"]);

/** Any stored value → valid settings, per key (old schema-1 values have no `mode` → family). Spicy off → family. */
export function normalizeSettings(raw: unknown, opt: SpicyOptions): LikelySettings {
  const s = normalizeByDefaults(raw, LIKELY_META.settings.defaults, (k, v) => VALID[k](v));
  return s.mode === "spicy" && !opt.spicyEnabled ? { ...s, mode: "family" } : s;
}

function same(a: LikelySettings, b: LikelySettings): boolean {
  return a.length === b.length && a.showVoters === b.showVoters && a.mode === b.mode && a.packIds.length === b.packIds.length && a.packIds.every((x, i) => x === b.packIds[i]);
}

/**
 * `settings.apply` (JAMAA-PLATFORM §2.2); null = INVALID_SETTINGS. Returns `s` itself when nothing changes.
 * JAMAA-GAP: §2.2 `apply` has no actor; `by` is the §9.1 rule 2 addition. The platform calls it without one, so a move
 * to Spicy fails closed (and Spicy is compiled out anyway: LIKELY_SPICY_ENABLED).
 */
export function applySettings(s: LikelySettings, patch: LikelySettingsPatch, content: LikelyCatalog, locale: Locale, by: GameActor | undefined, opt: SpicyOptions): LikelySettings | null {
  if (patch === null || typeof patch !== "object") return null;
  for (const k of Object.keys(patch)) if (!PATCH_KEYS.has(k)) return null;
  if (patch.ageConfirmed !== undefined && typeof patch.ageConfirmed !== "boolean") return null;
  let { mode, showVoters, length } = s;
  if (patch.mode !== undefined) {
    if (!VALID.mode(patch.mode)) return null;
    if (patch.mode === "spicy" && s.mode !== "spicy") {
      // §9.1 rules 1–3: TV only, an explicit 18+ confirmation each time, and only where a Spicy card is playable.
      if (!opt.spicyEnabled || by?.kind !== "tv" || patch.ageConfirmed !== true || !spicyPlayable(content, locale)) return null;
      showVoters = false; // rule 4: secret votes are suggested in the same patch (the host may switch them back later)
    }
    mode = patch.mode;
  }
  const entering = patch.mode === "spicy" && s.mode !== "spicy";
  if (patch.showVoters !== undefined) {
    if (!isBool(patch.showVoters)) return null;
    if (!entering) showVoters = patch.showVoters;
  }
  if (patch.length !== undefined) {
    if (!VALID.length(patch.length)) return null;
    length = patch.length;
  }
  const allowed = new Set(packsFor(content, mode, locale).map((p) => p.id));
  let packIds = s.packIds;
  if (patch.packIds !== undefined) {
    if (!validPackIds(patch.packIds)) return null;
    packIds = [...patch.packIds];
  } else if (mode !== s.mode) {
    packIds = packIds.filter((id) => allowed.has(id)); // leaving Spicy drops the adult pack from the selection
  }
  if (!packIds.every((id) => allowed.has(id))) return null;
  const next: LikelySettings = { packIds, length, showVoters, mode };
  return same(s, next) ? s : next;
}

/** Access restriction (§4.4): drop locked packs; Spicy falls back to family where it cannot be played. Same object if unchanged. */
export function restrictSettings(s: LikelySettings, a: { playableIds: ReadonlySet<string>; premium: boolean }, content: LikelyCatalog, locale: Locale, opt: SpicyOptions): LikelySettings {
  const mode: LikelyMode = s.mode === "spicy" && (!opt.spicyEnabled || !spicyPlayable(content, locale)) ? "family" : s.mode;
  // Locale fit is SET_CONTENT_LOCALE's job (apply with an empty patch); restrict only drops locked or age-barred packs.
  const packIds = s.packIds.filter((id) => a.playableIds.has(id) && content.packs.some((p) => p.id === id && packAllowed(p, mode)));
  const next = { ...s, mode, packIds };
  return same(s, next) ? s : next;
}
