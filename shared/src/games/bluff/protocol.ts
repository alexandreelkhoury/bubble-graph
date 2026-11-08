// JAMAA-PLATFORM §2.5 / §6.1: Bluff's zod schemas (GAME-BLUFF §13.1 intents, §13.2 views). Intents are strict (C2S);
// views are plain objects (S2C). Each schema is checked equal to the engine type it mirrors.
import * as z from "zod";
import type { Same } from "../../protocol/common";
import type { BluffExtras as EngineExtras, BluffIntent as EngineIntent, BluffMe as EngineMe, BluffPublic as EnginePublic } from "./engine/state";
import type { BluffSettings } from "./meta";

const PackIds = z.array(z.string().regex(/^[a-z0-9-]{1,35}$/)).max(50);
/** Prompt and option ids: 8 lowercase hex chars from the game RNG (GAME-BLUFF §4.2 step 4). */
const Hex8 = z.string().regex(/^[0-9a-f]{8}$/);
const PlayerId = z.string().min(1).max(64);

// ---------- intents (GAME-BLUFF §13.1) ----------

/** The raw lie: sanitised and length-checked by the engine (LIE_EMPTY / LIE_TOO_LONG); 240 code points max on the wire. */
const LieText = z.string().max(480);

export const BluffIntentSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("SUBMIT_LIE"), text: LieText, promptId: Hex8 }),
  z.strictObject({ type: z.literal("REQUEST_HELP"), promptId: Hex8 }),
  z.strictObject({ type: z.literal("VOTE"), optionId: Hex8 }),
  z.strictObject({ type: z.literal("LIKE"), optionId: Hex8, on: z.boolean() }),
  z.strictObject({ type: z.literal("SKIP_PROMPT"), promptId: Hex8 }),
  z.strictObject({ type: z.literal("HIDE_OPTION"), optionId: Hex8 }),
  z.strictObject({ type: z.literal("HOST_ADVANCE") }),
  z.strictObject({ type: z.literal("END_GAME") }),
]);
export type BluffIntent = z.infer<typeof BluffIntentSchema>;
export const _bluffIntentAgree: Same<BluffIntent, EngineIntent> = true;

// ---------- settings (GAME-BLUFF §9) ----------

export const BluffSettingsSchema = z.object({ packIds: PackIds, length: z.enum(["short", "normal", "long"]), pace: z.enum(["relaxed", "normal", "fast"]) });
export const BluffSettingsPatchSchema = BluffSettingsSchema.partial().strict();
export const _bluffSettingsAgree: Same<z.infer<typeof BluffSettingsSchema>, BluffSettings> = true;

// ---------- views (GAME-BLUFF §13.2) ----------

const Phase = z.enum(["ROUND_INTRO", "WRITING", "VOTING", "REVEAL", "SCORES", "AWARDS", "RESULTS", "HOLD"]);
const BluffType = z.enum(["proverb_end", "fact_blank", "word_meaning", "expression_meaning", "no_truth"]);
const RoundKind = z.enum(["saying", "fact", "noTruth"]);
const LengthHint = z.enum(["short", "few", "sentence", "free"]);
const Reason = z.enum(["truth", "fooled", "like", "convincing"]);
const Delta = z.object({ playerId: PlayerId, points: z.number().int().nonnegative(), reason: Reason });

export const BluffRevealSchema = z.object({
  final: z.boolean(),
  steps: z.array(z.object({
    optionId: Hex8,
    kind: z.enum(["lie", "house", "truth"]),
    quick: z.boolean(),
    text: z.string(),
    authorIds: z.array(PlayerId),
    helped: z.boolean(),
    voteCount: z.number().int().nonnegative(),
    voterIds: z.array(PlayerId),
    likerIds: z.array(PlayerId),
    foundEarlyIds: z.array(PlayerId),
    spotOnIds: z.array(PlayerId),
    top: z.boolean(),
    deltas: z.array(Delta),
  })),
  spotOnDeltas: z.array(z.object({ playerId: PlayerId, points: z.number().int().nonnegative() })),
  unpicked: z.array(z.object({ optionId: Hex8, text: z.string(), authorIds: z.array(PlayerId), likerIds: z.array(PlayerId), deltas: z.array(Delta) })),
  truth: z.object({ text: z.string(), original: z.string().nullable(), note: z.string().nullable() }).nullable(),
  durationMs: z.number().int().nonnegative(),
});

export const BluffAwardSchema = z.object({
  id: z.enum(["bluffOfTheNight", "lieDetector", "crowdFavourite", "hookLineSinker"]),
  playerIds: z.array(PlayerId),
  value: z.number().int().nonnegative(),
  text: z.string().nullable(),
  promptIndex: z.number().int().nonnegative().nullable(),
});

export const BluffPublicSchema = z.object({
  schema: z.number().int(),
  phase: Phase,
  round: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  roundCount: z.literal(3),
  roundKind: RoundKind,
  promptIndex: z.number().int().nonnegative(),
  promptCount: z.number().int().positive(),
  multiplier: z.union([z.literal(1), z.literal(2)]),
  deadline: z.number().int().nullable(),
  prompt: z.object({
    id: Hex8, type: BluffType, original: z.string(), translit: z.string().nullable(), display: z.string().nullable(),
    lengthHint: LengthHint, rerun: z.boolean(),
  }).nullable(),
  submittedIds: z.array(PlayerId),
  spotOnIds: z.array(PlayerId),
  options: z.array(z.object({ id: Hex8, text: z.string() })),
  votedIds: z.array(PlayerId),
  voided: z.boolean(),
  notice: z.enum(["tooFamous", "voided", "allKnew"]).nullable(),
  reveal: BluffRevealSchema.nullable(),
  scores: z.array(z.object({ playerId: PlayerId, score: z.number().int().nonnegative(), scoreBefore: z.number().int().nonnegative() })),
  newIds: z.array(PlayerId),
  awards: z.array(BluffAwardSchema),
  skipsLeft: z.number().int().nonnegative(),
  hidesLeft: z.number().int().nonnegative(),
});

export const BluffMeSchema = z.object({
  myLie: z.string().nullable(),
  myLieStatus: z.enum(["none", "locked", "spotOn"]),
  spotOn: z.boolean(),
  help: z.string().nullable(),
  helpNone: z.boolean(),
  myOptionIds: z.array(Hex8),
  myVote: Hex8.nullable(),
  myLikes: z.array(Hex8),
  foundWhileWriting: z.boolean(),
  editsLeft: z.number().int().nonnegative(),
  tooCloseCount: z.number().int().nonnegative(),
  waitingForNext: z.boolean(),
});

export const BluffExtrasSchema = z.object({ gameId: z.literal("bluff"), available: z.number().int(), bigGroup: z.boolean() });

export type BluffPublic = z.infer<typeof BluffPublicSchema>;
export type BluffMe = z.infer<typeof BluffMeSchema>;
export type BluffExtras = z.infer<typeof BluffExtrasSchema>;
export const _bluffPublicAgree: Same<BluffPublic, EnginePublic> = true;
export const _bluffMeAgree: Same<BluffMe, EngineMe> = true;
export const _bluffExtrasAgree: Same<BluffExtras, EngineExtras> = true;
