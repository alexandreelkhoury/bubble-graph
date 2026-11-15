// JAMAA-PLATFORM §2.5 / §6.1: Taqriban's zod schemas (GAME-TAQRIBAN §13.1 intents, §9 settings, §13.2 views). Intents
// and settings patches are strict (C2S); views are plain objects (S2C). Each schema is checked equal to the engine type.
import * as z from "zod";
import type { Same } from "../../protocol/common";
import type {
  TaqribanExtras as EngineExtras, TaqribanIntent as EngineIntent, TaqribanMe as EngineMe, TaqribanPublic as EnginePublic,
} from "./engine/types";
import { ITEM_ID, TAQRIBAN_PHASES } from "./meta";
import type { TaqribanSettings } from "./meta";

const PackIds = z.array(z.string().regex(/^[a-z0-9-]{1,35}$/)).max(50);
const ItemId = z.string().regex(ITEM_ID);
const PlayerId = z.string().min(1).max(64);
const Int = z.number().int();
const Nat = z.number().int().nonnegative();

// ---------- intents (§13.1) ----------

/** `value`: any number passes the schema so that an out-of-range guess gets VALUE_INVALID from the engine. */
export const TaqribanIntentSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("GUESS"), questionId: ItemId, value: z.number() }),
  z.strictObject({ type: z.literal("SKIP_QUESTION"), questionId: ItemId.optional() }),
  z.strictObject({ type: z.literal("HOST_ADVANCE") }),
  z.strictObject({ type: z.literal("END_GAME") }),
]);
export type TaqribanIntent = z.infer<typeof TaqribanIntentSchema>;
export const _taqribanIntentAgree: Same<TaqribanIntent, EngineIntent> = true;

// ---------- settings (§9) ----------

export const TaqribanSettingsSchema = z.object({ packIds: PackIds, length: z.enum(["short", "normal", "long"]), pace: z.enum(["relaxed", "normal", "fast"]) });
export const TaqribanSettingsPatchSchema = TaqribanSettingsSchema.partial().strict();
export const _taqribanSettingsAgree: Same<z.infer<typeof TaqribanSettingsSchema>, TaqribanSettings> = true;

// ---------- views (§13.2) ----------

export const TaqribanRevealSchema = z.object({
  answer: z.number(),
  source: z.string(),
  mode: z.enum(["ratio", "absolute"]),
  logLine: z.boolean(),
  guesses: z.array(z.object({ id: PlayerId, value: z.number(), rank: Int.positive(), closest: z.boolean(), bullseye: z.boolean(), points: Nat })),
  missingIds: z.array(PlayerId),
  closestIds: z.array(PlayerId),
  bullseyeIds: z.array(PlayerId),
  wildId: PlayerId.nullable(),
});

export const TaqribanScoreSchema = z.object({
  playerId: PlayerId, score: Nat, scoreBefore: Nat, rank: Int.positive().nullable(), rankBefore: Int.positive().nullable(),
  closest: Nat, bullseyes: Nat, left: z.boolean(),
});

export const TaqribanPublicSchema = z.object({
  schema: Int,
  phase: z.enum(TAQRIBAN_PHASES),
  index: Nat,
  total: Int.positive(),
  isFinal: z.boolean(),
  deadline: Int.nullable(),
  durationMs: Nat.nullable(),
  question: z.object({ id: ItemId, text: z.string(), unit: z.string() }).nullable(),
  answeredIds: z.array(PlayerId),
  reveal: TaqribanRevealSchema.nullable(),
  scores: z.array(TaqribanScoreSchema),
  newIds: z.array(PlayerId),
  waitingIds: z.array(PlayerId),
  rerun: z.boolean(),
  endedEarly: z.boolean(),
});
export const TaqribanMeSchema = z.object({ myGuess: z.number().nullable(), waitingForNext: z.boolean() });
export const TaqribanExtrasSchema = z.object({ gameId: z.literal("taqriban"), available: Nat });

export type TaqribanPublic = z.infer<typeof TaqribanPublicSchema>;
export type TaqribanMe = z.infer<typeof TaqribanMeSchema>;
export type TaqribanExtras = z.infer<typeof TaqribanExtrasSchema>;
export const _taqribanPublicAgree: Same<TaqribanPublic, EnginePublic> = true;
export const _taqribanMeAgree: Same<TaqribanMe, EngineMe> = true;
export const _taqribanExtrasAgree: Same<TaqribanExtras, EngineExtras> = true;
