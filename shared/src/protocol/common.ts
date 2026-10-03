import { z } from "zod";
import { COLORS, LOCALES, SETTINGS_BOUNDS } from "../constants";
import type { Points, Settings } from "../engine/types";
import { PHASES } from "../engine/types";
import { ERROR_CODES } from "./errors";

export const Token = z.string().regex(/^[0-9a-f]{32}$/);
export const PlayerId = z.string().regex(/^p_[0-9a-f]{24}$/);
const COLOR_IDS = COLORS.map((c) => c.id) as [(typeof COLORS)[number]["id"], ...(typeof COLORS)[number]["id"][]];
export const ColorIdSchema = z.enum(COLOR_IDS);
export const LocaleSchema = z.enum(LOCALES);
export const PhaseSchema = z.enum(PHASES);
export const RoleSchema = z.enum(["CIVILIAN", "UNDERCOVER", "BLANK"]);
export const WinnerSchema = z.enum(["CIVILIANS", "INFILTRATORS", "BLANK"]);
export const DeadlineKindSchema = z.enum(["REVEAL", "CLUE", "VOTE", "ELIMINATION", "GUESS", "VERDICT"]);
export const VoteOutcomeSchema = z.enum(["ELIMINATED", "TIE", "RANDOM", "NO_ELIMINATION"]);
export const GuessStatusSchema = z.enum(["PENDING", "CORRECT", "WRONG", "TIMEOUT"]);
export const HistoryCauseSchema = z.enum(["VOTE", "RANDOM", "KICK", "LEAVE", "NONE"]);
export const ErrorCodeSchema = z.enum(ERROR_CODES);

export const WordRefSchema = z.object({ text: z.string(), translit: z.string().nullable() });
export const PointsSchema = z.strictObject({ civilian: z.number().int(), undercover: z.number().int(), blank: z.number().int() });
export const RoleCountsSchema = z.object({ civilian: z.number().int(), undercover: z.number().int(), blank: z.number().int() });

const Difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);
// Bounds beyond types are enforced by the engine (→ INVALID_SETTINGS, not BAD_MESSAGE).
export const SettingsSchema = z.object({
  winRule: z.enum(["official", "parity"]),
  revealRoles: z.boolean(),
  roleMode: z.enum(["auto", "custom"]),
  undercoverCount: z.number().int(),
  blankCount: z.number().int(),
  clueSeconds: z.number().int(),
  voteSeconds: z.number().int(),
  revealSeconds: z.number().int(),
  guessSeconds: z.number().int(),
  tieBreak: z.enum(["random", "none"]),
  blankGuess: z.boolean(),
  wordLocale: LocaleSchema,
  packIds: z.array(z.string().regex(new RegExp(SETTINGS_BOUNDS.packIds.idRegex))).max(SETTINGS_BOUNDS.packIds.maxItems),
  difficulties: z.array(Difficulty),
  familyFilter: z.boolean(),
  swapSides: z.boolean(),
  points: PointsSchema,
});
export const SettingsPatchSchema = SettingsSchema.partial().strict();

// Compile-time agreement between the zod schemas and the engine types.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const _settingsAgree: Same<z.infer<typeof SettingsSchema>, Settings> = true;
export const _pointsAgree: Same<z.infer<typeof PointsSchema>, Points> = true;
