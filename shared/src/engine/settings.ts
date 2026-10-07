import { LOCALES, SETTINGS_BOUNDS } from "../constants";
import type { Catalog } from "./catalog";
import type { Points, Settings, SettingsPatch } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  winRule: "official",
  revealRoles: false,
  roleMode: "auto",
  undercoverCount: 0,
  blankCount: 1,
  clueSeconds: 45,
  voteSeconds: 90,
  revealSeconds: 30,
  guessSeconds: 45,
  tieBreak: "random",
  blankGuess: true,
  wordLocale: "en",
  packIds: [],
  difficulties: [1, 2, 3],
  familyFilter: true,
  swapSides: true,
  points: { civilian: 2, undercover: 10, blank: 10 },
};

/** Fresh deep copy of the defaults (the exported constant must never be mutated). */
export function defaultSettings(): Settings {
  return { ...DEFAULT_SETTINGS, packIds: [], difficulties: [1, 2, 3], points: { ...DEFAULT_SETTINGS.points } };
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const inRange = (v: unknown, min: number, max: number): boolean => isInt(v) && v >= min && v <= max;
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
// SPEC-GAP: UI step sizes are not enforced by the engine; any integer within the bounds is accepted.
const timerOk = (v: unknown, b: { off: number; min: number; max: number }): boolean => v === b.off || inRange(v, b.min, b.max);
const PACK_ID_RE = new RegExp(SETTINGS_BOUNDS.packIds.idRegex);

function pointsOk(p: unknown): p is Points {
  if (typeof p !== "object" || p === null) return false;
  const keys = Object.keys(p).sort();
  if (keys.join(",") !== "blank,civilian,undercover") return false;
  const q = p as Record<string, unknown>;
  const { min, max } = SETTINGS_BOUNDS.points;
  return inRange(q.civilian, min, max) && inRange(q.undercover, min, max) && inRange(q.blank, min, max);
}

/** Validates every bound of §4.4. */
export function validateSettings(s: Settings, catalog: Catalog): boolean {
  const B = SETTINGS_BOUNDS;
  if (s.winRule !== "official" && s.winRule !== "parity") return false;
  if (!isBool(s.revealRoles) || !isBool(s.blankGuess) || !isBool(s.familyFilter) || !isBool(s.swapSides)) return false;
  if (s.roleMode !== "auto" && s.roleMode !== "custom") return false;
  if (!inRange(s.undercoverCount, B.undercoverCount.min, B.undercoverCount.max)) return false;
  if (!inRange(s.blankCount, B.blankCount.min, B.blankCount.max)) return false;
  if (!timerOk(s.clueSeconds, B.clueSeconds) || !timerOk(s.voteSeconds, B.voteSeconds)) return false;
  if (!timerOk(s.revealSeconds, B.revealSeconds) || !timerOk(s.guessSeconds, B.guessSeconds)) return false;
  if (s.tieBreak !== "random" && s.tieBreak !== "none") return false;
  if (!(LOCALES as readonly string[]).includes(s.wordLocale)) return false;
  if (!Array.isArray(s.packIds) || s.packIds.length > B.packIds.maxItems) return false;
  if (new Set(s.packIds).size !== s.packIds.length) return false;
  for (const id of s.packIds) {
    if (typeof id !== "string" || !PACK_ID_RE.test(id)) return false;
    if (!catalog.packs.some((p) => p.id === id && p.language === s.wordLocale)) return false;
  }
  if (!Array.isArray(s.difficulties) || s.difficulties.length === 0) return false;
  for (let i = 0; i < s.difficulties.length; i++) {
    const d = s.difficulties[i];
    if (d !== 1 && d !== 2 && d !== 3) return false;
    if (i > 0 && d <= (s.difficulties[i - 1] as number)) return false; // unique + ascending
  }
  return pointsOk(s.points);
}

export function applySettingsPatch(s: Settings, patch: SettingsPatch, catalog: Catalog): Settings | null {
  // Copy nested values so the result never aliases the input; malformed values are kept as-is and rejected below.
  const copy = <T>(v: T): T => (Array.isArray(v) ? ([...v] as T) : v !== null && typeof v === "object" ? ({ ...v } as T) : v);
  const next: Settings = {
    ...s,
    ...patch,
    packIds: copy(patch.packIds !== undefined ? patch.packIds : s.packIds),
    difficulties: copy(patch.difficulties !== undefined ? patch.difficulties : s.difficulties),
    points: copy(patch.points !== undefined ? patch.points : s.points),
  };
  // Keep the §4.4 key order regardless of the patch's key order.
  const ordered = {} as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_SETTINGS)) ordered[k] = next[k as keyof Settings];
  for (const k of Object.keys(next)) if (!(k in ordered)) return null; // unknown key (cannot arrive via zod)
  const out = ordered as unknown as Settings;
  if (patch.wordLocale !== undefined && patch.wordLocale !== s.wordLocale && patch.packIds === undefined) out.packIds = [];
  return validateSettings(out, catalog) ? out : null;
}
