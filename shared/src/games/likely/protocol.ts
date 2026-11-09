// JAMAA-PLATFORM §2.5 / §6.1: Likely's zod schemas (GAME-LIKELY §13.1 intents, §9 settings, §13.2 views). Intents and
// settings patches are strict (C2S); views are plain objects (S2C). Each schema is checked equal to the type it mirrors.
import * as z from "zod";
import type { Same } from "../../protocol/common";
import type { LikelyExtras as EngineExtras, LikelyIntent as EngineIntent, LikelyMe as EngineMe, LikelyPublic as EnginePublic } from "./engine/state";
import type { LikelySettingsPatch } from "./engine/settings";
import { LIKELY_AWARD_KINDS, LIKELY_DELTA_REASONS, LIKELY_PHASES } from "./meta";
import type { LikelySettings } from "./meta";

const PackIds = z.array(z.string().regex(/^[a-z0-9-]{1,35}$/)).max(50);
/** Card ids (GAME-LIKELY §11.2). */
const CardId = z.string().regex(/^[a-z0-9-]{3,40}$/);
const PlayerId = z.string().min(1).max(64);

// ---------- intents (§13.1) ----------

export const LikelyIntentSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("VOTE"), cardId: CardId, targetId: PlayerId }),
  z.strictObject({ type: z.literal("SKIP_CARD"), cardId: CardId }),
  z.strictObject({ type: z.literal("HOST_ADVANCE") }),
  z.strictObject({ type: z.literal("END_GAME") }),
]);
export type LikelyIntent = z.infer<typeof LikelyIntentSchema>;
export const _likelyIntentAgree: Same<LikelyIntent, EngineIntent> = true;

// ---------- settings (§9) ----------

export const LikelySettingsSchema = z.object({
  packIds: PackIds,
  length: z.enum(["short", "normal", "long"]),
  showVoters: z.boolean(),
  mode: z.enum(["family", "spicy"]),
});
/** §9.1 rule 2: a move to Spicy carries `ageConfirmed: true` (never stored). The engine decides; the schema only types it. */
export const LikelySettingsPatchSchema = LikelySettingsSchema.partial().extend({ ageConfirmed: z.boolean().optional() }).strict();
export const _likelySettingsAgree: Same<z.infer<typeof LikelySettingsSchema>, LikelySettings> = true;
export const _likelyPatchAgree: Same<z.infer<typeof LikelySettingsPatchSchema>, LikelySettingsPatch> = true;

// ---------- views (§13.2) ----------

const Phase = z.enum(LIKELY_PHASES);
const Count = z.object({ playerId: PlayerId, count: z.number().int().positive(), percent: z.number().int().min(0).max(100) });
const Ballot = z.object({ voterId: PlayerId, targetId: PlayerId });
const Delta = z.object({ playerId: PlayerId, points: z.number().int().positive(), reason: z.enum(LIKELY_DELTA_REASONS) });

export const LikelyRevealSchema = z.object({
  votesCast: z.number().int().nonnegative(),
  counts: z.array(Count),
  topIds: z.array(PlayerId),
  unanimous: z.boolean(),
  chaos: z.boolean(),
  none: z.boolean(),
  againId: PlayerId.nullable(),
  ballots: z.array(Ballot).nullable(),
  deltas: z.array(Delta),
});

export const LikelyCardSchema = z.object({
  id: CardId,
  prompt: z.string(),
  award: z.string(),
  spicy: z.boolean(),
  namedPlayerId: PlayerId.nullable(),
  rerun: z.boolean(),
});

export const LikelyAwardSchema = z.object({
  kind: z.enum(LIKELY_AWARD_KINDS),
  playerIds: z.array(PlayerId),
  value: z.number().int().nonnegative().nullable(),
  card: z.object({ index: z.number().int().nonnegative(), id: CardId, prompt: z.string(), award: z.string(), namedPlayerId: PlayerId.nullable() }).nullable(),
});

export const LikelyPublicSchema = z.object({
  schema: z.number().int(),
  phase: Phase,
  cardIndex: z.number().int().nonnegative(),
  cardCount: z.number().int().positive(),
  deadline: z.number().int().nullable(),
  card: LikelyCardSchema.nullable(),
  newIds: z.array(PlayerId),
  votedIds: z.array(PlayerId),
  reveal: LikelyRevealSchema.nullable(),
  scores: z.array(z.object({ playerId: PlayerId, score: z.number().int().nonnegative(), scoreBefore: z.number().int().nonnegative() })),
  awards: z.array(LikelyAwardSchema),
  showVoters: z.boolean(),
  mode: z.enum(["family", "spicy"]),
});
export const LikelyMeSchema = z.object({ myVote: PlayerId.nullable(), waitingForNext: z.boolean() });
export const LikelyExtrasSchema = z.object({ gameId: z.literal("likely"), available: z.number().int().nonnegative() });

export type LikelyPublic = z.infer<typeof LikelyPublicSchema>;
export type LikelyMe = z.infer<typeof LikelyMeSchema>;
export type LikelyExtras = z.infer<typeof LikelyExtrasSchema>;
export const _likelyPublicAgree: Same<LikelyPublic, EnginePublic> = true;
export const _likelyMeAgree: Same<LikelyMe, EngineMe> = true;
export const _likelyExtrasAgree: Same<LikelyExtras, EngineExtras> = true;
