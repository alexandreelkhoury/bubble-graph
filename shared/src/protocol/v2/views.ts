// JAMAA-PLATFORM §2.5: protocol v2 server → client views. Non-strict (z.object) so clients tolerate additive fields.
import * as z from "zod";
import { DOMAINS, TOPICS } from "../../content/vocab";
import { GameIdSchema, GameEnvelopeSchema } from "../../games/protocol";
import { BluffExtrasSchema, BluffSettingsSchema } from "../../games/bluff/protocol";
import { LikelyExtrasSchema, LikelySettingsSchema } from "../../games/likely/protocol";
import { MishanaExtrasSchema, MishanaSettingsSchema } from "../../games/mishana/protocol";
import { TriviaExtrasSchema, TriviaSettingsSchema } from "../../games/trivia/protocol";
import { REACTIONS, ROOM_PHASES } from "../../room/types";
import { AgeRatingSchema, ColorIdSchema, ErrorCodeSchema, LocaleSchema, LocalizedTitleSchema } from "../common";

export const RoomPhaseSchema = z.enum(ROOM_PHASES);
export const ReactionKindSchema = z.enum(REACTIONS);

export const MemberPublicSchema = z.object({
  id: z.string(), name: z.string(), color: ColorIdSchema, seat: z.number().int(), connected: z.boolean(), left: z.boolean(),
  benched: z.boolean(), isHost: z.boolean(), reaction: z.object({ kind: ReactionKindSchema, n: z.number().int() }).nullable(),
});
/** One hub card per game of `room.games`, in GAME_IDS order. */
export const GameCardSchema = z.object({
  id: GameIdSchema, minPlayers: z.number().int(), maxPlayers: z.number().int(), available: z.boolean(),
  lockedPackCount: z.number().int(), durationMinutes: z.tuple([z.number().int(), z.number().int()]),
});
const Stars = z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable();
/** v1 PackInfo + gameId, family, stars, domain, topics (§2.5). `pairCount` = the items the game's filters keep. */
export const PackInfoV2Schema = z.object({
  id: z.string(), gameId: GameIdSchema, family: z.string(), locale: z.string(), title: LocalizedTitleSchema,
  pairCount: z.number().int(), ageRating: AgeRatingSchema, tier: z.enum(["free", "premium", "mixed"]),
  stars: Stars, domain: z.enum(DOMAINS).nullable(), topics: z.array(z.enum(TOPICS)),
});
/** Metadata only: never words, items or item ids. `productId` = pack_<family>. */
export const LockedPackInfoV2Schema = z.object({
  id: z.string(), gameId: GameIdSchema, family: z.string(), locale: z.string(), title: LocalizedTitleSchema,
  pairCount: z.number().int(), ageRating: AgeRatingSchema, productId: z.string(),
  stars: Stars, domain: z.enum(DOMAINS).nullable(), topics: z.array(z.enum(TOPICS)),
});
const setup = <G extends string, S extends z.ZodType, E extends z.ZodType>(gameId: G, settings: S, extras: E) =>
  z.object({
    gameId: z.literal(gameId), settings, canStart: z.boolean(), startBlocker: ErrorCodeSchema.nullable(),
    availablePacks: z.array(PackInfoV2Schema), lockedPacks: z.array(LockedPackInfoV2Schema), extras,
  });
/** SETUP only (null otherwise). */
export const RoomSetupSchema = z.discriminatedUnion("gameId", [
  setup("mishana", MishanaSettingsSchema, MishanaExtrasSchema),
  setup("bluff", BluffSettingsSchema, BluffExtrasSchema),
  setup("likely", LikelySettingsSchema, LikelyExtrasSchema),
  setup("trivia", TriviaSettingsSchema, TriviaExtrasSchema),
]);
export const CupPublicSchema = z.object({
  stars: z.record(z.string(), z.number().int()),
  last: z.object({ gameId: GameIdSchema, n: z.number().int(), ranking: z.array(z.array(z.string())), points: z.record(z.string(), z.number()) }).nullable(),
});
export const RoomPublicSchema = z.object({
  roomCode: z.string(),
  joinUrl: z.string(),
  phase: RoomPhaseSchema,
  focusedGameId: GameIdSchema,
  setupGameId: GameIdSchema.nullable(),
  contentLocale: LocaleSchema,
  members: z.array(MemberPublicSchema),
  hostPlayerId: z.string().nullable(),
  games: z.array(GameCardSchema),
  setup: RoomSetupSchema.nullable(),
  cup: CupPublicSchema,
  premium: z.boolean(),
  tvBusy: z.boolean(),
  contentLocales: z.array(LocaleSchema),
});
export const RoomMeSchema = z.object({ id: z.string(), benched: z.boolean() });
export const TvRoomViewSchema = z.object({ kind: z.literal("tv"), room: RoomPublicSchema, game: GameEnvelopeSchema.nullable(), me: z.null() });
export const PlayerRoomViewSchema = z.object({ kind: z.literal("player"), room: RoomPublicSchema, game: GameEnvelopeSchema.nullable(), me: RoomMeSchema.nullable() });
export const RoomViewSchema = z.discriminatedUnion("kind", [TvRoomViewSchema, PlayerRoomViewSchema]);

export type MemberPublic = z.infer<typeof MemberPublicSchema>;
export type GameCard = z.infer<typeof GameCardSchema>;
export type PackInfoV2 = z.infer<typeof PackInfoV2Schema>;
export type LockedPackInfoV2 = z.infer<typeof LockedPackInfoV2Schema>;
export type RoomSetup = z.infer<typeof RoomSetupSchema>;
export type RoomPublic = z.infer<typeof RoomPublicSchema>;
export type RoomMe = z.infer<typeof RoomMeSchema>;
export type TvRoomView = z.infer<typeof TvRoomViewSchema>;
export type PlayerRoomView = z.infer<typeof PlayerRoomViewSchema>;
export type RoomView = z.infer<typeof RoomViewSchema>;
