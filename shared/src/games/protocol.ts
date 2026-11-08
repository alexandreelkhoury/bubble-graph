// JAMAA-PLATFORM §2.5: the per-game zod schemas, unioned over GAME_IDS (server, tests; clients import types only).
// P creates this file once; G lanes replace only their own games/<id>/protocol.ts.
import * as z from "zod";
import type { GameId } from "./ids";
import { BluffExtrasSchema, BluffIntentSchema, BluffMeSchema, BluffPublicSchema, BluffSettingsPatchSchema, BluffSettingsSchema } from "./bluff/protocol";
import { LikelyExtrasSchema, LikelyIntentSchema, LikelyMeSchema, LikelyPublicSchema, LikelySettingsPatchSchema, LikelySettingsSchema } from "./likely/protocol";
import { MishanaExtrasSchema, MishanaIntentSchema, MishanaMeSchema, MishanaPublicSchema, MishanaSettingsPatchSchema, MishanaSettingsSchema } from "./mishana/protocol";
import { TriviaExtrasSchema, TriviaIntentSchema, TriviaMeSchema, TriviaPublicSchema, TriviaSettingsPatchSchema, TriviaSettingsSchema } from "./trivia/protocol";

export const GameIdSchema = z.enum(["mishana", "bluff", "likely", "trivia"]);
export const _gameIdsAgree: z.infer<typeof GameIdSchema> extends GameId ? (GameId extends z.infer<typeof GameIdSchema> ? true : never) : never = true;

/** Each game's in-game intent schema (`GAME {gameId, i}` validates `i` with this). */
export const GameIntentSchema = {
  mishana: MishanaIntentSchema, bluff: BluffIntentSchema, likely: LikelyIntentSchema, trivia: TriviaIntentSchema,
} as const;
/** Each game's full settings schema (strict). */
export const GameSettingsSchema = {
  mishana: MishanaSettingsSchema, bluff: BluffSettingsSchema, likely: LikelySettingsSchema, trivia: TriviaSettingsSchema,
} as const;
/** Each game's settings patch schema (strict, partial): `UPDATE_GAME_SETTINGS {gameId, patch}`. */
export const GameSettingsPatchSchema = {
  mishana: MishanaSettingsPatchSchema, bluff: BluffSettingsPatchSchema, likely: LikelySettingsPatchSchema, trivia: TriviaSettingsPatchSchema,
} as const;

/** Room intent `GAME {gameId, i}` (strict; discriminated on gameId). */
export const GameMsgIntentSchema = z.discriminatedUnion("gameId", [
  z.strictObject({ type: z.literal("GAME"), gameId: z.literal("mishana"), i: MishanaIntentSchema }),
  z.strictObject({ type: z.literal("GAME"), gameId: z.literal("bluff"), i: BluffIntentSchema }),
  z.strictObject({ type: z.literal("GAME"), gameId: z.literal("likely"), i: LikelyIntentSchema }),
  z.strictObject({ type: z.literal("GAME"), gameId: z.literal("trivia"), i: TriviaIntentSchema }),
]);
/** Room intent `UPDATE_GAME_SETTINGS {gameId, patch}` (strict; discriminated on gameId). */
export const UpdateGameSettingsIntentSchema = z.discriminatedUnion("gameId", [
  z.strictObject({ type: z.literal("UPDATE_GAME_SETTINGS"), gameId: z.literal("mishana"), patch: MishanaSettingsPatchSchema }),
  z.strictObject({ type: z.literal("UPDATE_GAME_SETTINGS"), gameId: z.literal("bluff"), patch: BluffSettingsPatchSchema }),
  z.strictObject({ type: z.literal("UPDATE_GAME_SETTINGS"), gameId: z.literal("likely"), patch: LikelySettingsPatchSchema }),
  z.strictObject({ type: z.literal("UPDATE_GAME_SETTINGS"), gameId: z.literal("trivia"), patch: TriviaSettingsPatchSchema }),
]);

const envelope = <G extends GameId, P extends z.ZodType, M extends z.ZodType>(gameId: G, pub: P, me: M) =>
  z.object({
    gameId: z.literal(gameId), n: z.number().int(), phase: z.string(), doneIds: z.array(z.string()), awaitedIds: z.array(z.string()),
    public: pub, me: me.nullable(), over: z.boolean(),
  });
/** §2.5 `RoomView.game` (non-strict, S2C). */
export const GameEnvelopeSchema = z.discriminatedUnion("gameId", [
  envelope("mishana", MishanaPublicSchema, MishanaMeSchema),
  envelope("bluff", BluffPublicSchema, BluffMeSchema),
  envelope("likely", LikelyPublicSchema, LikelyMeSchema),
  envelope("trivia", TriviaPublicSchema, TriviaMeSchema),
]);
/** §2.5 `RoomPublic.setup.extras`: built by `def.projectSetup`, discriminated on gameId. */
export const SetupExtrasSchema = z.discriminatedUnion("gameId", [MishanaExtrasSchema, BluffExtrasSchema, LikelyExtrasSchema, TriviaExtrasSchema]);

export type GameEnvelope = z.infer<typeof GameEnvelopeSchema>;
export type SetupExtras = z.infer<typeof SetupExtrasSchema>;
export type GameMsgIntent = z.infer<typeof GameMsgIntentSchema>;
export type UpdateGameSettingsIntent = z.infer<typeof UpdateGameSettingsIntentSchema>;
