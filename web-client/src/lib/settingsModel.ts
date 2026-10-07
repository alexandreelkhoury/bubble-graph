// One declarative source for the settings rows (DESIGN: PH-03b shows "exactly the TV-03 rows"). The phone sheet
// renders each row as a segmented control / switch / stepper / chips; the TV mock as a ‹ value › row.
import { LOCALES, SETTINGS_BOUNDS } from "@mishana/shared/constants";
import type { Points, Settings, SettingsPatch } from "@mishana/shared/engine";
import { fmtNum, LOCALE_NATIVE_NAME, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { stepValue } from "./settings";
import type { Bound } from "./settings";

export type SettingsCategory = "game" | "roles" | "timers" | "words";
export const CATEGORIES: readonly SettingsCategory[] = ["game", "roles", "timers", "words"];
export const CATEGORY_LABEL: Record<SettingsCategory, MessageKey> = {
  game: "settings.catGame", roles: "settings.catRoles", timers: "settings.catTimers", words: "settings.catWords",
};
/** A help line for the whole category (the roles preview is computed from the view, see rolePreview()). */
export const CATEGORY_HELP: Partial<Record<SettingsCategory, MessageKey>> = { timers: "settings.timerOffHelp" };
/** One line per optional role (rules v2): what a Mole and an Undercover are. Shown with the roles preview. */
export const ROLE_HELP: Record<"blankCount" | "undercoverCount", MessageKey> = {
  blankCount: "settings.blankCountHelp", undercoverCount: "settings.undercoverCountHelp",
};

type EnumKey = "winRule" | "tieBreak" | "roleMode" | "wordLocale";
type BoolKey = "revealRoles" | "blankGuess" | "familyFilter" | "swapSides";
type NumKey = "undercoverCount" | "blankCount" | "clueSeconds" | "voteSeconds" | "revealSeconds" | "guessSeconds";
export type Difficulty = Settings["difficulties"][number];
export const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3];

export type RowDef =
  | { kind: "enum"; id: EnumKey; label: MessageKey; options: readonly string[]; optionLabel(v: string): string; help?(s: Settings): MessageKey }
  | { kind: "bool"; id: BoolKey; label: MessageKey }
  | { kind: "num"; id: NumKey; label: MessageKey; bound: Bound; format(v: number): string; when?(s: Settings): boolean }
  | { kind: "points"; id: `points.${keyof Points}`; key: keyof Points; label: MessageKey; group: MessageKey }
  | { kind: "packs"; id: "packIds"; label: MessageKey }
  | { kind: "difficulty"; id: "difficulties"; label: MessageKey };

export function formatSeconds(v: number): string {
  return v === 0 ? t("common.off") : t("common.seconds", { count: v });
}
const count = (v: number): string => fmtNum(v);
const keyed = (map: Record<string, MessageKey>) => (v: string): string => t(map[v] ?? (v as MessageKey));
const custom = (s: Settings): boolean => s.roleMode === "custom";
const B = SETTINGS_BOUNDS;

const points = (key: keyof Points, label: MessageKey): RowDef => ({ kind: "points", id: `points.${key}`, key, label, group: "settings.points" });

export const SETTINGS_SCHEMA: Record<SettingsCategory, readonly RowDef[]> = {
  game: [
    { kind: "enum", id: "winRule", label: "settings.winRule", options: ["official", "parity"],
      optionLabel: keyed({ official: "settings.winRuleOfficial", parity: "settings.winRuleParity" }),
      help: (s) => (s.winRule === "official" ? "settings.winRuleOfficialHelp" : "settings.winRuleParityHelp") },
    { kind: "bool", id: "revealRoles", label: "settings.revealRoles" },
    { kind: "enum", id: "tieBreak", label: "settings.tieBreak", options: ["random", "none"],
      optionLabel: keyed({ random: "settings.tieBreakRandom", none: "settings.tieBreakNone" }) },
    { kind: "bool", id: "blankGuess", label: "settings.blankGuess" },
    points("civilian", "role.civilian"), points("blank", "role.blank"), points("undercover", "role.undercover"),
  ],
  roles: [
    { kind: "enum", id: "roleMode", label: "settings.roleMode", options: ["auto", "custom"],
      optionLabel: keyed({ auto: "settings.roleModeAuto", custom: "settings.roleModeCustom" }) },
    // The Mole (BLANK) is the default impostor, so it comes first; the Undercover is optional (0 by default).
    { kind: "num", id: "blankCount", label: "settings.blankCount", bound: B.blankCount, format: count, when: custom },
    { kind: "num", id: "undercoverCount", label: "settings.undercoverCount", bound: B.undercoverCount, format: count, when: custom },
  ],
  timers: [
    { kind: "num", id: "clueSeconds", label: "settings.clueSeconds", bound: B.clueSeconds, format: formatSeconds },
    { kind: "num", id: "voteSeconds", label: "settings.voteSeconds", bound: B.voteSeconds, format: formatSeconds },
    { kind: "num", id: "revealSeconds", label: "settings.revealSeconds", bound: B.revealSeconds, format: formatSeconds },
    { kind: "num", id: "guessSeconds", label: "settings.guessSeconds", bound: B.guessSeconds, format: formatSeconds },
  ],
  words: [
    { kind: "enum", id: "wordLocale", label: "settings.wordLocale", options: LOCALES, optionLabel: (v) => LOCALE_NATIVE_NAME[v as Settings["wordLocale"]] },
    { kind: "packs", id: "packIds", label: "settings.packs" },
    { kind: "difficulty", id: "difficulties", label: "settings.difficulty" },
    { kind: "bool", id: "familyFilter", label: "settings.familyFilter" },
    { kind: "bool", id: "swapSides", label: "settings.swapSides" },
  ],
};

/** The rows of a category that apply to the current settings (Custom-only rows hide in Automatic). */
export function visibleRows(cat: SettingsCategory, s: Settings): RowDef[] {
  return SETTINGS_SCHEMA[cat].filter((r) => r.kind !== "num" || !r.when || r.when(s));
}

export function enumPatch(id: EnumKey, v: string): SettingsPatch {
  return { [id]: v } as SettingsPatch;
}

export function rowBound(row: Extract<RowDef, { kind: "num" | "points" }>): Bound {
  return row.kind === "num" ? row.bound : B.points;
}

export function numValue(row: Extract<RowDef, { kind: "num" | "points" }>, s: Settings): number {
  return row.kind === "num" ? s[row.id] : s.points[row.key];
}

export function numPatch(row: Extract<RowDef, { kind: "num" | "points" }>, s: Settings, v: number): SettingsPatch {
  return row.kind === "num" ? { [row.id]: v } : { points: { ...s.points, [row.key]: v } };
}

/** One D-pad step (Left = -1, Right/OK = +1): enums cycle, switches flip, numbers follow SETTINGS_BOUNDS. */
export function stepRow(row: RowDef, s: Settings, dir: 1 | -1): SettingsPatch | null {
  switch (row.kind) {
    case "enum": {
      const i = row.options.indexOf(s[row.id]);
      return enumPatch(row.id, row.options[(i + dir + row.options.length) % row.options.length]!);
    }
    case "bool": return { [row.id]: !s[row.id] };
    case "num":
    case "points": {
      const v = numValue(row, s);
      const n = stepValue(v, rowBound(row), dir);
      return n === v ? null : numPatch(row, s, n);
    }
    default: return null; // packs / difficulty open a sub-panel
  }
}

/**
 * The packs of the room language that `packIds` selects. The default list carries one easy pack per language, so ids
 * of other languages are ignored; none selected means "All packs" (the engine plays every pack then).
 */
export function selectedPacks<P extends { id: string }>(s: Settings, available: readonly P[]): P[] {
  return available.filter((p) => s.packIds.includes(p.id));
}

/** The row's current value as text (TV rows, summaries). `available`: the room's packs (for the packs row). */
export function rowValueText(row: RowDef, s: Settings, available?: readonly { id: string }[]): string {
  switch (row.kind) {
    case "enum": return row.optionLabel(s[row.id]);
    case "bool": return s[row.id] ? t("common.on") : t("common.off");
    case "num": return row.format(s[row.id]);
    case "points": return fmtNum(s.points[row.key]);
    case "packs": {
      const n = available ? selectedPacks(s, available).length : s.packIds.length;
      return n === 0 ? t("settings.allPacks") : fmtNum(n);
    }
    case "difficulty": return s.difficulties.map(difficultyLabel).join(" · ");
  }
}

export function difficultyLabel(d: Difficulty): string {
  return t(`settings.difficulty${d}` as MessageKey);
}

/** Toggles a difficulty, keeping at least one selected (null = refused). */
export function toggleDifficulty(s: Settings, d: Difficulty): SettingsPatch | null {
  const on = s.difficulties.includes(d);
  if (on && s.difficulties.length === 1) return null;
  return { difficulties: on ? s.difficulties.filter((x) => x !== d) : [...s.difficulties, d].sort() };
}

/** Toggles one pack ([] = all packs). */
export function togglePack(s: Settings, id: string): SettingsPatch {
  return { packIds: s.packIds.includes(id) ? s.packIds.filter((x) => x !== id) : [...s.packIds, id] };
}
