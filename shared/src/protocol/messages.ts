import * as z from "zod";
import { ENTITLEMENT_TOKEN_MAX_CHARS, NAME_MAX_CODEPOINTS, PROTOCOL_VERSION } from "../constants";
import { ColorIdSchema, ErrorCodeSchema, LocaleSchema, PlayerId, SettingsPatchSchema, Token } from "./common";
import { ViewSchema } from "./views";

const V = z.literal(PROTOCOL_VERSION);

/** Client-chosen action id, echoed back as the error `ref`. */
export const ACTION_ID_REGEX = /^[A-Za-z0-9-]{1,36}$/;

// ---------------------------------------------------------------- client → server (strict)
const intent = {
  UPDATE_SETTINGS: z.strictObject({ type: z.literal("UPDATE_SETTINGS"), patch: SettingsPatchSchema }),
  START: z.strictObject({ type: z.literal("START") }),
  READY: z.strictObject({ type: z.literal("READY") }),
  CLUE_DONE: z.strictObject({ type: z.literal("CLUE_DONE") }),
  CAST_VOTE: z.strictObject({ type: z.literal("CAST_VOTE"), targetId: PlayerId }),
  SUBMIT_GUESS: z.strictObject({ type: z.literal("SUBMIT_GUESS"), text: z.string().min(1).max(200) }),
  HOST_OVERRIDE_GUESS: z.strictObject({ type: z.literal("HOST_OVERRIDE_GUESS"), accept: z.boolean() }),
  HOST_ADVANCE: z.strictObject({ type: z.literal("HOST_ADVANCE") }),
  KICK: z.strictObject({ type: z.literal("KICK"), playerId: PlayerId }),
  PLAY_AGAIN: z.strictObject({ type: z.literal("PLAY_AGAIN") }),
  BACK_TO_LOBBY: z.strictObject({ type: z.literal("BACK_TO_LOBBY") }),
  LEAVE: z.strictObject({ type: z.literal("LEAVE") }),
};
export const ClientIntentSchema = z.discriminatedUnion("type", [
  intent.UPDATE_SETTINGS, intent.START, intent.READY, intent.CLUE_DONE, intent.CAST_VOTE, intent.SUBMIT_GUESS,
  intent.HOST_OVERRIDE_GUESS, intent.HOST_ADVANCE, intent.KICK, intent.PLAY_AGAIN, intent.BACK_TO_LOBBY, intent.LEAVE,
]);

export const HelloTvSchema = z.strictObject({ v: V, t: z.literal("hello"), role: z.literal("tv"), tvToken: Token });
export const HelloPlayerSchema = z.strictObject({ v: V, t: z.literal("hello"), role: z.literal("player"), resumeToken: Token.optional() });
export const JoinSchema = z.strictObject({ v: V, t: z.literal("join"), name: z.string().min(1).max(NAME_MAX_CODEPOINTS), color: ColorIdSchema, locale: LocaleSchema });
export const ActionMsgSchema = z.strictObject({
  v: V, t: z.literal("action"), id: z.string().regex(ACTION_ID_REGEX).optional(), a: ClientIntentSchema,
});
/** PAYMENTS-SPEC §3.11: TV only; the server-signed entitlement token (opaque to clients). No `ref`. */
export const EntitlementMsgSchema = z.strictObject({ v: V, t: z.literal("entitlement"), token: z.string().min(1).max(ENTITLEMENT_TOKEN_MAX_CHARS) });
/** PAYMENTS-SPEC §3.11: TV only; the host-busy signal while the Store or the Play purchase sheet is up. */
export const StoreOpenMsgSchema = z.strictObject({ v: V, t: z.literal("storeOpen"), open: z.boolean() });
// zod 4.6.5 throws "Duplicate discriminator value" if HelloTv and HelloPlayer are both listed directly on "t".
const Hello = z.discriminatedUnion("role", [HelloTvSchema, HelloPlayerSchema]);
export const ClientMessageSchema = z.discriminatedUnion("t", [Hello, JoinSchema, ActionMsgSchema, EntitlementMsgSchema, StoreOpenMsgSchema]);

// ---------------------------------------------------------------- server → client (non-strict)
export const WelcomeSchema = z.object({ v: V, t: z.literal("welcome"), playerId: PlayerId, resumeToken: Token, roomCode: z.string() });
export const StateSchema = z.object({ v: V, t: z.literal("state"), seq: z.number().int(), serverNow: z.number(), view: ViewSchema });
export const ErrorMsgSchema = z.object({ v: V, t: z.literal("error"), code: ErrorCodeSchema, messageKey: z.string(), ref: z.string().nullable() });
export const PongSchema = z.object({ v: V, t: z.literal("pong") });
export const ServerMessageSchema = z.discriminatedUnion("t", [WelcomeSchema, StateSchema, ErrorMsgSchema, PongSchema]);

export type ClientIntentMsg = z.infer<typeof ClientIntentSchema>;
export type HelloTvMsg = z.infer<typeof HelloTvSchema>;
export type HelloPlayerMsg = z.infer<typeof HelloPlayerSchema>;
export type JoinMsg = z.infer<typeof JoinSchema>;
export type ActionMsg = z.infer<typeof ActionMsgSchema>;
export type EntitlementMsg = z.infer<typeof EntitlementMsgSchema>;
export type StoreOpenMsg = z.infer<typeof StoreOpenMsgSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type WelcomeMsg = z.infer<typeof WelcomeSchema>;
export type StateMsg = z.infer<typeof StateSchema>;
export type ErrorMsg = z.infer<typeof ErrorMsgSchema>;
export type PongMsg = z.infer<typeof PongSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
