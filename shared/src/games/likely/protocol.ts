// JAMAA-PLATFORM §2.5 / §6.1: Likely's zod schemas. STUB created in P (`z.never()` intents, `{}` views); the G lane of
// this game replaces them from its game doc §13. The settings and setup-extras shapes already follow the game doc / §2.5.
import * as z from "zod";
import type { Same } from "../../protocol/common";
import type { LikelySettings } from "./meta";

const PackIds = z.array(z.string().regex(/^[a-z0-9-]{1,35}$/)).max(50);


/** Stub: no intent is valid until the game exists. */
export const LikelyIntentSchema = z.never();
export type LikelyIntent = z.infer<typeof LikelyIntentSchema>;

export const LikelySettingsSchema = z.object({ packIds: PackIds, length: z.enum(["short", "normal", "long"]), showVoters: z.boolean() });
export const LikelySettingsPatchSchema = LikelySettingsSchema.partial().strict();
export const _likelySettingsAgree: Same<z.infer<typeof LikelySettingsSchema>, LikelySettings> = true;

export const LikelyPublicSchema = z.object({});
export const LikelyMeSchema = z.object({});
export const LikelyExtrasSchema = z.object({ gameId: z.literal("likely"), available: z.number().int() });

export type LikelyPublic = z.infer<typeof LikelyPublicSchema>;
export type LikelyMe = z.infer<typeof LikelyMeSchema>;
export type LikelyExtras = z.infer<typeof LikelyExtrasSchema>;
