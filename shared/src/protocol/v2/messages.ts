// JAMAA-PLATFORM §2.5: protocol v2 frames. The envelope is v1's with `v: 2`; `hello` (TV) gains `games`; the room
// intents replace Mish Ana!'s top-level intents, whose in-game ones now travel inside `GAME {gameId, i}`.
import * as z from "zod";
import { ENTITLEMENT_TOKEN_MAX_CHARS, LOCALES, NAME_MAX_CODEPOINTS, PROTOCOL_VERSION_V2 } from "../../constants";
import { GameIdSchema, GameMsgIntentSchema, UpdateGameSettingsIntentSchema } from "../../games/protocol";
import { ColorIdSchema, ErrorCodeSchema, LocaleSchema, PlayerId, Token } from "../common";
import { ACTION_ID_REGEX } from "../messages";
import { ReactionKindSchema, RoomViewSchema } from "./views";

const V = z.literal(PROTOCOL_VERSION_V2);
/** OPEN_GAME / HUB_FOCUS take any id-shaped string so an unknown id gets UNKNOWN_GAME (not BAD_MESSAGE). */
const AnyGameId = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);

// ---------------------------------------------------------------- client → server (strict)
export const RoomIntentSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("HUB_FOCUS"), gameId: AnyGameId }),
  z.strictObject({ type: z.literal("OPEN_GAME"), gameId: AnyGameId }),
  z.strictObject({ type: z.literal("CLOSE_GAME") }),
  z.strictObject({ type: z.literal("SET_CONTENT_LOCALE"), locale: z.enum(LOCALES) }),
  UpdateGameSettingsIntentSchema,
  z.strictObject({ type: z.literal("START_GAME") }),
  GameMsgIntentSchema,
  z.strictObject({ type: z.literal("REPLAY") }),
  z.strictObject({ type: z.literal("BACK_TO_SETUP") }),
  z.strictObject({ type: z.literal("BACK_TO_HUB") }),
  z.strictObject({ type: z.literal("ABORT_GAME") }),
  z.strictObject({ type: z.literal("REACT"), kind: ReactionKindSchema }),
  z.strictObject({ type: z.literal("KICK"), playerId: PlayerId }),
  z.strictObject({ type: z.literal("LEAVE") }),
]);

/** §2.5 capability negotiation: the games (1–4, unique ids) and per-game VIEW_VERSIONs this TV build renders. */
export const TvGamesSchema = z
  .array(z.strictObject({ id: GameIdSchema, v: z.number().int().min(1) }))
  .min(1)
  .max(4)
  .refine((gs) => new Set(gs.map((g) => g.id)).size === gs.length, { message: "duplicate game id" });

export const HelloTvV2Schema = z.strictObject({ v: V, t: z.literal("hello"), role: z.literal("tv"), tvToken: Token, games: TvGamesSchema });
export const HelloPlayerV2Schema = z.strictObject({ v: V, t: z.literal("hello"), role: z.literal("player"), resumeToken: Token.optional() });
export const JoinV2Schema = z.strictObject({ v: V, t: z.literal("join"), name: z.string().min(1).max(NAME_MAX_CODEPOINTS), color: ColorIdSchema, locale: LocaleSchema });
export const ActionMsgV2Schema = z.strictObject({ v: V, t: z.literal("action"), id: z.string().regex(ACTION_ID_REGEX).optional(), a: RoomIntentSchema });
export const EntitlementMsgV2Schema = z.strictObject({ v: V, t: z.literal("entitlement"), token: z.string().min(1).max(ENTITLEMENT_TOKEN_MAX_CHARS) });
export const StoreOpenMsgV2Schema = z.strictObject({ v: V, t: z.literal("storeOpen"), open: z.boolean() });
const HelloV2 = z.discriminatedUnion("role", [HelloTvV2Schema, HelloPlayerV2Schema]);
export const ClientMessageV2Schema = z.discriminatedUnion("t", [HelloV2, JoinV2Schema, ActionMsgV2Schema, EntitlementMsgV2Schema, StoreOpenMsgV2Schema]);

// ---------------------------------------------------------------- server → client (non-strict)
export const WelcomeV2Schema = z.object({ v: V, t: z.literal("welcome"), playerId: PlayerId, resumeToken: Token, roomCode: z.string() });
export const StateV2Schema = z.object({ v: V, t: z.literal("state"), seq: z.number().int(), serverNow: z.number(), view: RoomViewSchema });
export const ErrorMsgV2Schema = z.object({ v: V, t: z.literal("error"), code: ErrorCodeSchema, messageKey: z.string(), ref: z.string().nullable() });
export const PongV2Schema = z.object({ v: V, t: z.literal("pong") });
export const ServerMessageV2Schema = z.discriminatedUnion("t", [WelcomeV2Schema, StateV2Schema, ErrorMsgV2Schema, PongV2Schema]);

export type RoomIntentMsg = z.infer<typeof RoomIntentSchema>;
export type TvGames = z.infer<typeof TvGamesSchema>;
export type HelloTvV2Msg = z.infer<typeof HelloTvV2Schema>;
export type ActionMsgV2 = z.infer<typeof ActionMsgV2Schema>;
export type ClientMessageV2 = z.infer<typeof ClientMessageV2Schema>;
export type HelloPlayerV2Msg = z.infer<typeof HelloPlayerV2Schema>;
export type JoinV2Msg = z.infer<typeof JoinV2Schema>;
export type EntitlementV2Msg = z.infer<typeof EntitlementMsgV2Schema>;
export type StoreOpenV2Msg = z.infer<typeof StoreOpenMsgV2Schema>;
export type WelcomeV2Msg = z.infer<typeof WelcomeV2Schema>;
export type StateV2Msg = z.infer<typeof StateV2Schema>;
export type ErrorMsgV2 = z.infer<typeof ErrorMsgV2Schema>;
export type ServerMessageV2 = z.infer<typeof ServerMessageV2Schema>;
