// GAME-TRIVIA §9 settings (SETTINGS_SCHEMA = 1): quizId (a FAMILY id, or null = the default quiz), length, pace.
import type { Locale } from "../../../constants";
import { normalizeByDefaults, oneOf } from "../../settings-util";
import { LENGTH_IDS, PACE_IDS } from "../constants";
import { TRIVIA_META } from "../meta";
import { packFor } from "./quiz";
import type { TriviaCatalog, TriviaSettings } from "./types";

const FAMILY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const isFamilyId = (v: unknown): v is string => typeof v === "string" && v.length <= 35 && FAMILY_RE.test(v);

const VALID: { [K in keyof TriviaSettings]: (v: unknown) => boolean } = {
  quizId: (v) => v === null || isFamilyId(v),
  length: oneOf(LENGTH_IDS),
  pace: oneOf(PACE_IDS),
};

/** Any stored value → valid settings, per key, in the defaults' key order (unknown/missing/wrong keys → default). */
export function normalizeSettings(raw: unknown): TriviaSettings {
  return normalizeByDefaults(raw, TRIVIA_META.settings.defaults, (k, v) => VALID[k](v));
}

const same = (a: TriviaSettings, b: TriviaSettings): boolean => a.quizId === b.quizId && a.length === b.length && a.pace === b.pace;

/**
 * `patch` is already zod-checked by the room (strict, partial). Returns null (INVALID_SETTINGS) when the RESULT is not
 * valid in `locale`: a non-null `quizId` must name a family with a playable pack in the content language. The room also
 * calls `apply(s, {})` after SET_CONTENT_LOCALE / access changes, so a stored family that no longer fits gives null and
 * the room resets the `packs` row (quizId) to its default. Same object when nothing changes.
 */
export function applySettings(s: TriviaSettings, patch: Partial<TriviaSettings>, content: TriviaCatalog, locale: Locale): TriviaSettings | null {
  if (typeof patch !== "object" || patch === null) return null;
  const next: TriviaSettings = { ...s };
  for (const k of Object.keys(patch) as (keyof TriviaSettings)[]) {
    if (!(k in VALID)) return null;
    const v = patch[k];
    if (v === undefined) continue;
    if (!VALID[k](v)) return null;
    (next as unknown as Record<string, unknown>)[k] = v;
  }
  if (next.quizId !== null && !packFor(content, next.quizId, locale)) return null;
  return same(s, next) ? s : next;
}

/**
 * Access restriction (§4.4): a locked family (not in `playableIds`) or one with no pack in `locale` resets to null.
 * A family that exists in the new locale is KEPT (GAME-TRIVIA §2). No premium keys. Same object when nothing changes.
 */
export function restrictSettings(s: TriviaSettings, a: { playableIds: ReadonlySet<string>; premium: boolean }, content: TriviaCatalog, locale: Locale): TriviaSettings {
  if (s.quizId === null) return s;
  if (a.playableIds.has(s.quizId) && packFor(content, s.quizId, locale)) return s;
  return { ...s, quizId: null };
}

/** Platform §4.4: the content filter as FAMILY ids. */
export const packIdsOf = (s: TriviaSettings): readonly string[] => (s.quizId === null ? [] : [s.quizId]);
