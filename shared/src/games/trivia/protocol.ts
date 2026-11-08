// JAMAA-PLATFORM §2.5 / §6.1: Trivia's zod schemas. STUB created in P (`z.never()` intents, `{}` views); the G lane of
// this game replaces them from its game doc §13. The settings and setup-extras shapes already follow the game doc / §2.5.
import * as z from "zod";
import type { Same } from "../../protocol/common";
import type { TriviaSettings } from "./meta";

const FamilyId = z.string().max(35).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
/** JAMAA-GAP: QuizCardInfo is not defined by the spec yet (§2.5); the G4 lane fills it in (stars, domain, topics…). */
export const QuizCardInfoSchema = z.object({});

/** Stub: no intent is valid until the game exists. */
export const TriviaIntentSchema = z.never();
export type TriviaIntent = z.infer<typeof TriviaIntentSchema>;

export const TriviaSettingsSchema = z.object({ quizId: FamilyId.nullable(), length: z.enum(["short", "normal", "long"]), pace: z.enum(["relaxed", "normal", "fast"]) });
export const TriviaSettingsPatchSchema = TriviaSettingsSchema.partial().strict();
export const _triviaSettingsAgree: Same<z.infer<typeof TriviaSettingsSchema>, TriviaSettings> = true;

export const TriviaPublicSchema = z.object({});
export const TriviaMeSchema = z.object({});
export const TriviaExtrasSchema = z.object({ gameId: z.literal("trivia"), available: z.number().int(), quiz: QuizCardInfoSchema.nullable() });

export type TriviaPublic = z.infer<typeof TriviaPublicSchema>;
export type TriviaMe = z.infer<typeof TriviaMeSchema>;
export type TriviaExtras = z.infer<typeof TriviaExtrasSchema>;
