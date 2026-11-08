// JAMAA-PLATFORM §2.5 / §6.1: Bluff's zod schemas. STUB created in P (`z.never()` intents, `{}` views); the G lane of
// this game replaces them from its game doc §13. The settings and setup-extras shapes already follow the game doc / §2.5.
import * as z from "zod";
import type { Same } from "../../protocol/common";
import type { BluffSettings } from "./meta";

const PackIds = z.array(z.string().regex(/^[a-z0-9-]{1,35}$/)).max(50);


/** Stub: no intent is valid until the game exists. */
export const BluffIntentSchema = z.never();
export type BluffIntent = z.infer<typeof BluffIntentSchema>;

export const BluffSettingsSchema = z.object({ packIds: PackIds, length: z.enum(["short", "normal", "long"]), pace: z.enum(["relaxed", "normal", "fast"]) });
export const BluffSettingsPatchSchema = BluffSettingsSchema.partial().strict();
export const _bluffSettingsAgree: Same<z.infer<typeof BluffSettingsSchema>, BluffSettings> = true;

export const BluffPublicSchema = z.object({});
export const BluffMeSchema = z.object({});
export const BluffExtrasSchema = z.object({ gameId: z.literal("bluff"), available: z.number().int() });

export type BluffPublic = z.infer<typeof BluffPublicSchema>;
export type BluffMe = z.infer<typeof BluffMeSchema>;
export type BluffExtras = z.infer<typeof BluffExtrasSchema>;
