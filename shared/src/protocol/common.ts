import * as z from "zod";
import { COLORS, LOCALES, MEMORY_KEY_MAX_CHARS, MEMORY_MAX_KEYS, MEMORY_WIRE_MAX_GAMES, SETTINGS_BOUNDS } from "../constants";
import { AGE_RATINGS, PACK_TIERS } from "../games/mishana/engine/catalog";
import type { LocalizedTitle, Points, Settings } from "../games/mishana/engine/types";
import { DEADLINE_KINDS, GUESS_STATUSES, HISTORY_CAUSES, PHASES, ROLES, VOTE_OUTCOMES, WINNERS } from "../games/mishana/engine/types";
import { ERROR_CODES } from "./errors";

export const Token = z.string().regex(/^[0-9a-f]{32}$/);
export const PlayerId = z.string().regex(/^p_[0-9a-f]{24}$/);
const COLOR_IDS = COLORS.map((c) => c.id) as [(typeof COLORS)[number]["id"], ...(typeof COLORS)[number]["id"][]];
export const ColorIdSchema = z.enum(COLOR_IDS);
export const LocaleSchema = z.enum(LOCALES);
export const PhaseSchema = z.enum(PHASES);
export const RoleSchema = z.enum(ROLES);
export const WinnerSchema = z.enum(WINNERS);
export const DeadlineKindSchema = z.enum(DEADLINE_KINDS);
export const VoteOutcomeSchema = z.enum(VOTE_OUTCOMES);
export const GuessStatusSchema = z.enum(GUESS_STATUSES);
export const HistoryCauseSchema = z.enum(HISTORY_CAUSES);
export const AgeRatingSchema = z.enum(AGE_RATINGS);
export const PackTierSchema = z.enum(PACK_TIERS);
export const ErrorCodeSchema = z.enum(ERROR_CODES);
/**
 * JAMAA-PLATFORM §2.6a no-repeat memory on the wire (POST /api/rooms `memory`, s2c `memory`): game id → used item keys,
 * oldest first. The shape is bounded here (a body breaking it → BAD_MESSAGE); unknown game ids and malformed keys are
 * then DROPPED by `sanitizeMemoryWire` (room/memory.ts), so an older or newer TV never fails to create a room.
 */
export const MemoryWireSchema = z
  .record(z.string().max(32), z.array(z.string().max(MEMORY_KEY_MAX_CHARS)).max(MEMORY_MAX_KEYS))
  .refine((r) => Object.keys(r).length <= MEMORY_WIRE_MAX_GAMES, { message: "too many games" });
/** A title in every UI locale (engine `LocalizedTitle`). */
export const LocalizedTitleSchema = z.object({ en: z.string(), fr: z.string(), ar: z.string(), es: z.string().optional() });

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
export type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const _settingsAgree: Same<z.infer<typeof SettingsSchema>, Settings> = true;
export const _pointsAgree: Same<z.infer<typeof PointsSchema>, Points> = true;
export const _titleAgree: Same<z.infer<typeof LocalizedTitleSchema>, LocalizedTitle> = true;
