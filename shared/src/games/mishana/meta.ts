// Game #1 of JAMAA (JAMAA-PLATFORM §0, §1.3): its name stays "Mish Ana!" and its internal id is "mishana".
// Zod-free and engine-free (type imports only): the web client and the TV generators may import this at runtime.
// A test asserts that every value mirrored from the engine (phases, defaults) equals the engine's.
import { SETTINGS_BOUNDS } from "../../constants";
import type { Settings } from "./engine/types";
import type { GameMeta, SettingField } from "../types";

export const GAME1 = { id: "mishana", name: "Mish Ana!", nameAr: "مش أنا!" } as const;

/** The room-level Mish Ana! settings: the engine `Settings` minus `wordLocale` (the room's `contentLocale`, §2.5). */
export type MishanaSettings = Omit<Settings, "wordLocale">;

/** The engine phases a running Mish Ana! instance can be in (LOBBY never appears while PLAYING, §2.7). */
export const MISHANA_PHASES = ["ROLE_REVEAL", "CLUES", "VOTING", "TIE_BREAK", "ELIMINATION", "MR_WHITE_GUESS", "RESULTS"] as const;

/** The free easy pack of each language (engine DEFAULT_PACK_IDS). */
export const MISHANA_DEFAULT_PACK_IDS: readonly string[] = ["en-everyday-01", "fr-everyday-01", "ar-everyday-01", "es-everyday-01"];

/** Engine DEFAULT_SETTINGS minus `wordLocale`, in the same key order. */
const DEFAULTS: MishanaSettings = {
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
  packIds: [...MISHANA_DEFAULT_PACK_IDS],
  difficulties: [1, 2, 3],
  familyFilter: true,
  swapSides: true,
  points: { civilian: 2, undercover: 10, blank: 10 },
};

/** §3.5 "Timers" row: a UI preset over the four seconds settings. Stored values matching none of them show "Custom". */
export const TIMER_PRESETS = {
  relaxed: { clueSeconds: 60, voteSeconds: 120, revealSeconds: 45, guessSeconds: 60 },
  normal: { clueSeconds: 45, voteSeconds: 90, revealSeconds: 30, guessSeconds: 45 },
  fast: { clueSeconds: 30, voteSeconds: 60, revealSeconds: 20, guessSeconds: 30 },
  off: { clueSeconds: 0, voteSeconds: 0, revealSeconds: 0, guessSeconds: 0 },
} as const;
export type TimerPreset = keyof typeof TIMER_PRESETS;
export const TIMER_PRESET_IDS = ["relaxed", "normal", "fast", "off"] as const satisfies readonly TimerPreset[];

/** The preset the four timer values match, or "custom". */
export function timerPresetOf(s: Pick<Settings, "clueSeconds" | "voteSeconds" | "revealSeconds" | "guessSeconds">): TimerPreset | "custom" {
  for (const id of TIMER_PRESET_IDS) {
    const p = TIMER_PRESETS[id];
    if (p.clueSeconds === s.clueSeconds && p.voteSeconds === s.voteSeconds && p.revealSeconds === s.revealSeconds && p.guessSeconds === s.guessSeconds) return id;
  }
  return "custom";
}

const K = "game.mishana";
const B = SETTINGS_BOUNDS;
// Labels reuse the existing Mish Ana! keys (lane D's split map keeps `settings.*` names in games/mishana/<locale>.json).
/** §3.5 basic rows. `timers` is a virtual key (TIMER_PRESETS); `undercoverCount`/`blankCount` open inline under Custom. */
const BASIC: readonly SettingField[] = [
  { key: "roleMode", kind: "choice", labelKey: `${K}.settings.impostors`, options: [
    { value: "auto", labelKey: `${K}.settings.impostorsAuto` }, { value: "custom", labelKey: `${K}.settings.impostorsCustom` },
  ] },
  { key: "timers", kind: "choice", labelKey: `${K}.settings.timers`, options: [
    { value: "relaxed", labelKey: `${K}.settings.timersRelaxed` }, { value: "normal", labelKey: `${K}.settings.timersNormal` },
    { value: "fast", labelKey: `${K}.settings.timersFast` }, { value: "off", labelKey: `${K}.settings.timersOff` },
  ] },
  { key: "packIds", kind: "packs", labelKey: "settings.packs", single: false },
];
const ADVANCED: readonly SettingField[] = [
  { key: "undercoverCount", kind: "stepper", labelKey: "settings.undercoverCount", bounds: { min: B.undercoverCount.min, max: B.undercoverCount.max, step: B.undercoverCount.step } },
  { key: "blankCount", kind: "stepper", labelKey: "settings.blankCount", bounds: { min: B.blankCount.min, max: B.blankCount.max, step: B.blankCount.step } },
  { key: "winRule", kind: "choice", labelKey: "settings.winRule", options: [
    { value: "official", labelKey: "settings.winRuleOfficial" }, { value: "parity", labelKey: "settings.winRuleParity" },
  ] },
  { key: "revealRoles", kind: "toggle", labelKey: "settings.revealRoles" },
  { key: "tieBreak", kind: "choice", labelKey: "settings.tieBreak", options: [
    { value: "random", labelKey: "settings.tieBreakRandom" }, { value: "none", labelKey: "settings.tieBreakNone" },
  ] },
  { key: "blankGuess", kind: "toggle", labelKey: "settings.blankGuess" },
  { key: "familyFilter", kind: "toggle", labelKey: "settings.familyFilter" },
  { key: "swapSides", kind: "toggle", labelKey: "settings.swapSides" },
  { key: "difficulties", kind: "choice", labelKey: "settings.difficulty", options: [
    { value: 1, labelKey: "settings.difficulty1" }, { value: 2, labelKey: "settings.difficulty2" }, { value: 3, labelKey: "settings.difficulty3" },
  ] },
  { key: "points", kind: "stepper", labelKey: "settings.points", bounds: { min: B.points.min, max: B.points.max, step: B.points.step } },
];

const IN_GAME = ["ROLE_REVEAL", "CLUES", "TIE_BREAK", "VOTING", "ELIMINATION", "MR_WHITE_GUESS"] as const;

export const MISHANA_META: GameMeta<MishanaSettings> = {
  id: "mishana",
  minPlayers: 3,
  maxPlayers: 12,
  phases: MISHANA_PHASES,
  rules: {
    titleKey: `${K}.title`,
    taglineKey: `${K}.tagline`,
    howToKeys: [`${K}.howto.1`, `${K}.howto.2`, `${K}.howto.3`, `${K}.howto.4`],
    ruleSections: [
      { id: "goal", titleKey: `${K}.rules.goal.title`, bodyKey: `${K}.rules.goal.body`, phases: [] },
      { id: "roles", titleKey: `${K}.rules.roles.title`, bodyKey: `${K}.rules.roles.body`, phases: ["ROLE_REVEAL"] },
      { id: "words", titleKey: `${K}.rules.words.title`, bodyKey: `${K}.rules.words.body`, phases: ["ROLE_REVEAL"] },
      { id: "clues", titleKey: `${K}.rules.clues.title`, bodyKey: `${K}.rules.clues.body`, phases: ["CLUES"] },
      { id: "vote", titleKey: `${K}.rules.vote.title`, bodyKey: `${K}.rules.vote.body`, phases: ["VOTING", "ELIMINATION"] },
      { id: "tie", titleKey: `${K}.rules.tie.title`, bodyKey: `${K}.rules.tie.body`, phases: ["TIE_BREAK"] },
      { id: "guess", titleKey: `${K}.rules.guess.title`, bodyKey: `${K}.rules.guess.body`, phases: ["MR_WHITE_GUESS"] },
      { id: "points", titleKey: `${K}.rules.points.title`, bodyKey: `${K}.rules.points.body`, phases: ["RESULTS"] },
    ],
    durationMinutes: [10, 20],
    world: "night-market",
    pauseItems: [{ id: "skip", labelKey: `${K}.pause.skip`, intent: "HOST_ADVANCE", phases: IN_GAME }],
  },
  carriesScore: true,
  VIEW_VERSION: 1,
  SETTINGS_SCHEMA: 1,
  settings: { defaults: DEFAULTS, basic: BASIC, advanced: ADVANCED, premiumKeys: ["points"] },
};

/** A fresh deep copy of the defaults (the exported constant must never be mutated). */
export function mishanaDefaultSettings(): MishanaSettings {
  return { ...DEFAULTS, packIds: [...DEFAULTS.packIds], difficulties: [...DEFAULTS.difficulties], points: { ...DEFAULTS.points } };
}
