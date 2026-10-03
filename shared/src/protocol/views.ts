import { z } from "zod";
import {
  ColorIdSchema, DeadlineKindSchema, ErrorCodeSchema, GuessStatusSchema, HistoryCauseSchema, PhaseSchema,
  RoleCountsSchema, RoleSchema, SettingsSchema, VoteOutcomeSchema, WinnerSchema, WordRefSchema,
} from "./common";

// S2C schemas are non-strict (z.object) so tests and clients tolerate additive fields.
export const PublicPlayerSchema = z.object({
  id: z.string(), name: z.string(), color: ColorIdSchema, seat: z.number().int(), connected: z.boolean(), alive: z.boolean(),
  left: z.boolean(), isHost: z.boolean(), ready: z.boolean(), spoke: z.boolean(), hasVoted: z.boolean(),
  revealedRole: RoleSchema.nullable(), score: z.number(),
});
export const PackInfoSchema = z.object({
  id: z.string(), locale: z.string(), title: z.object({ en: z.string(), fr: z.string(), ar: z.string() }),
  pairCount: z.number().int(), ageRating: z.enum(["all", "teen", "adult"]),
});
export const DeadlineViewSchema = z.object({ kind: DeadlineKindSchema, at: z.number(), durationMs: z.number() });
export const VoteSummarySchema = z.object({
  round: z.number().int(), revote: z.boolean(),
  tally: z.array(z.object({ targetId: z.string(), voterIds: z.array(z.string()) })),
  abstainIds: z.array(z.string()), outcome: VoteOutcomeSchema, eliminatedId: z.string().nullable(),
});
export const GuessStateSchema = z.object({ playerId: z.string(), status: GuessStatusSchema, text: z.string().nullable(), overridden: z.boolean() });
export const ResultStateSchema = z.object({
  winner: WinnerSchema, winnerIds: z.array(z.string()), civilianWord: WordRefSchema, undercoverWord: WordRefSchema,
  pack: z.object({ id: z.string(), version: z.number().int(), title: z.object({ en: z.string(), fr: z.string(), ar: z.string() }) }),
  pointsAwarded: z.record(z.string(), z.number()), guesses: z.array(GuessStateSchema),
});
export const HistoryEntrySchema = z.object({ round: z.number().int(), eliminatedId: z.string().nullable(), role: RoleSchema.nullable(), cause: HistoryCauseSchema });

const publicViewShape = {
  roomCode: z.string(),
  joinUrl: z.string(),
  phase: PhaseSchema,
  gameNumber: z.number().int(),
  round: z.number().int(),
  settings: SettingsSchema,
  players: z.array(PublicPlayerSchema),
  hostPlayerId: z.string().nullable(),
  roleCounts: RoleCountsSchema.nullable(),
  canStart: z.boolean(),
  startBlocker: ErrorCodeSchema.nullable(),
  speakingOrder: z.array(z.string()),
  currentSpeakerId: z.string().nullable(),
  revote: z.boolean(),
  tieCandidates: z.array(z.string()),
  deadline: DeadlineViewSchema.nullable(),
  votesCast: z.number().int(),
  votesExpected: z.number().int(),
  lastVote: VoteSummarySchema.nullable(),
  eliminated: z.object({ playerId: z.string(), role: RoleSchema }).nullable(),
  guess: GuessStateSchema.nullable(),
  result: ResultStateSchema.nullable(),
  history: z.array(HistoryEntrySchema),
  availablePacks: z.array(PackInfoSchema),
};
export const PublicViewSchema = z.object(publicViewShape);
export const MeSchema = z.object({
  id: z.string(), word: WordRefSchema.nullable(), isBlank: z.boolean(), role: RoleSchema.nullable(), myVote: z.string().nullable(),
});
export const TvViewSchema = z.object({ kind: z.literal("tv"), ...publicViewShape });
export const PlayerViewSchema = z.object({ kind: z.literal("player"), ...publicViewShape, me: MeSchema.nullable() });
export const ViewSchema = z.discriminatedUnion("kind", [TvViewSchema, PlayerViewSchema]);

export type PublicPlayer = z.infer<typeof PublicPlayerSchema>;
export type PackInfo = z.infer<typeof PackInfoSchema>;
export type DeadlineView = z.infer<typeof DeadlineViewSchema>;
export type PublicView = z.infer<typeof PublicViewSchema>;
export type Me = z.infer<typeof MeSchema>;
export type TvView = z.infer<typeof TvViewSchema>;
export type PlayerView = z.infer<typeof PlayerViewSchema>;
export type View = TvView | PlayerView;
