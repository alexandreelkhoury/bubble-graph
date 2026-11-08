// JAMAA-PLATFORM §2.5: Mish Ana!'s zod schemas for protocol v2 (server, tests; clients import types only).
import * as z from "zod";
import { PlayerId, RoleCountsSchema, RoleSchema, SettingsSchema } from "../../protocol/common";
import { MeSchema, PublicViewSchema } from "../../protocol/views";
import type { Same } from "../../protocol/common";
import type { MishanaSettings } from "./meta";

/** The v1 in-game intents minus UPDATE_SETTINGS, START, PLAY_AGAIN, BACK_TO_LOBBY, KICK and LEAVE (§2.5). */
export const MishanaIntentSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("READY") }),
  z.strictObject({ type: z.literal("CLUE_DONE") }),
  z.strictObject({ type: z.literal("CAST_VOTE"), targetId: PlayerId }),
  z.strictObject({ type: z.literal("SUBMIT_GUESS"), text: z.string().min(1).max(200) }),
  z.strictObject({ type: z.literal("HOST_OVERRIDE_GUESS"), accept: z.boolean() }),
  z.strictObject({ type: z.literal("HOST_ADVANCE") }),
]);
export type MishanaIntent = z.infer<typeof MishanaIntentSchema>;

/** The room-level settings: v1 `SettingsSchema` minus `wordLocale` (now the room's `contentLocale`). */
export const MishanaSettingsSchema = SettingsSchema.omit({ wordLocale: true });
export const MishanaSettingsPatchSchema = MishanaSettingsSchema.partial().strict();
export const _mishanaSettingsAgree: Same<z.infer<typeof MishanaSettingsSchema>, MishanaSettings> = true;

/** Only the game fields of a player; names, colours, seats, `connected` and `isHost` come from `room.members`. */
export const MishanaPlayerSchema = z.object({
  id: z.string(), alive: z.boolean(), left: z.boolean(), ready: z.boolean(), spoke: z.boolean(), hasVoted: z.boolean(),
  revealedRole: RoleSchema.nullable(), score: z.number(),
});

/** Today's PublicView minus the room-level keys (§2.5); every other key keeps its name, type and order. */
export const MishanaPublicSchema = PublicViewSchema.omit({
  roomCode: true, joinUrl: true, hostPlayerId: true, canStart: true, startBlocker: true, availablePacks: true, premium: true,
  lockedPacks: true, tvBusy: true, wordLocales: true, poolExhausted: true, players: true,
}).extend({ players: z.array(MishanaPlayerSchema) });
export const MishanaMeSchema = MeSchema;

export const MishanaExtrasSchema = z.object({
  gameId: z.literal("mishana"),
  roleCounts: RoleCountsSchema.nullable(),   // today's LOBBY PublicView.roleCounts (from settings and player count)
  poolExhausted: z.boolean(),
});

export type MishanaPlayer = z.infer<typeof MishanaPlayerSchema>;
export type MishanaPublic = z.infer<typeof MishanaPublicSchema>;
export type MishanaMe = z.infer<typeof MishanaMeSchema>;
export type MishanaExtras = z.infer<typeof MishanaExtrasSchema>;
