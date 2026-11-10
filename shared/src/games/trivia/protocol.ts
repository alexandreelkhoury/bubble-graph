// JAMAA-PLATFORM §2.5 / §6.1: Trivia's zod schemas (GAME-TRIVIA §13.1 intents, §13.2 views, §9 settings). Intents
// are strict (C2S); views are plain objects (S2C). Each schema is checked equal to the engine type it mirrors.
import * as z from "zod";
import { DOMAINS, TOPICS } from "../../content/vocab";
import type { Same } from "../../protocol/common";
import type { TriviaIntent as EngineIntent } from "./engine/types";
import type { TriviaExtras as EngineExtras, TriviaMe as EngineMe, TriviaPublic as EnginePublic } from "./engine/view";
import type { TriviaSettings } from "./meta";

const FamilyId = z.string().max(35).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const PlayerId = z.string().min(1).max(64);
const QuestionId = z.string().regex(/^q\d{3,4}$/);
const Stars = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const Domain = z.enum(DOMAINS);
const Topic = z.enum(TOPICS);
const Title = z.object({ en: z.string(), fr: z.string(), ar: z.string(), es: z.string().optional() });
const Int = z.number().int();
const Nat = z.number().int().nonnegative();

// ---------- intents (GAME-TRIVIA §13.1) ----------

/**
 * `choice` is the DISPLAYED position (0..3; tf: 0 = True, 1 = False). Any integer passes the schema so that an out-of-range
 * pick gets the game's own ANSWER_INVALID (§13.1), never a generic protocol error. The object is strict: the intent carries
 * no client time (answer time is the server's receipt time, platform §2.12).
 */
export const TriviaIntentSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ANSWER"), choice: z.number().int().min(-1_000).max(1_000) }),
  z.strictObject({ type: z.literal("HOST_ADVANCE") }),
  // `questionId` is optional: the platform pause menus (web tvDialogs, native GameViewModel) send the bare intent, which
  // voids the question currently in REVEAL; with an id, a stale menu (another question) is refused (WRONG_PHASE).
  z.strictObject({ type: z.literal("VOID_QUESTION"), questionId: QuestionId.optional() }),
  z.strictObject({ type: z.literal("END_GAME") }),
]);
export type TriviaIntent = z.infer<typeof TriviaIntentSchema>;
export const _triviaIntentAgree: Same<TriviaIntent, EngineIntent> = true;

// ---------- settings (GAME-TRIVIA §9) ----------

export const TriviaSettingsSchema = z.object({ quizId: FamilyId.nullable(), length: z.enum(["short", "normal", "long"]), pace: z.enum(["relaxed", "normal", "fast"]) });
export const TriviaSettingsPatchSchema = TriviaSettingsSchema.partial().strict();
export const _triviaSettingsAgree: Same<z.infer<typeof TriviaSettingsSchema>, TriviaSettings> = true;

// ---------- views (GAME-TRIVIA §13.2) ----------

const Phase = z.enum(["QUIZ_INTRO", "READ", "ANSWER", "REVEAL", "LEADERBOARD", "FINAL_INTRO", "RESULTS", "HOLD"]);

/** GAME-TRIVIA §9.1 quiz card (setup summary card, shelf, VIP list). Closes the P1 gap "QuizCardInfo" (§2.5). */
export const QuizCardInfoSchema = z.object({
  id: FamilyId,
  title: Title,
  stars: Stars,
  domain: Domain,
  featuredTopics: z.array(Topic).max(3),
  moreTopics: Nat,
  questionCount: Nat,
  tier: z.enum(["free", "premium"]),
});

export const TriviaRevealSchema = z.object({
  correct: Nat,
  choices: z.array(z.object({
    id: PlayerId, choice: Nat.nullable(), correct: z.boolean(), timeMs: Nat.nullable(), points: Nat, streakBonus: Nat,
  })),
  fastestIds: z.array(PlayerId),
  onFireIds: z.array(PlayerId),
  stumped: z.boolean(),
  genius: z.boolean(),
  tooSlow: z.boolean(),
  explain: z.string().nullable(),
  voided: z.boolean(),
});

export const TriviaScoreSchema = z.object({
  playerId: PlayerId,
  score: Nat,
  scoreBefore: Nat,
  rankBefore: Int.positive().nullable(),
  streak: Nat,
  bestStreak: Nat,
  correct: Nat,
  fastest: Nat,
  rank: Int.positive().nullable(),
  left: z.boolean(),
});

export const TriviaPublicSchema = z.object({
  schema: Int,
  phase: Phase,
  quiz: z.object({
    id: FamilyId, title: Title, stars: Stars, domain: Domain, featuredTopics: z.array(Topic), topicCount: Nat, questionCount: Nat,
  }),
  rerun: z.boolean(),
  index: Nat,
  total: Int.positive(),
  isFinal: z.boolean(),
  deadline: Int.nullable(),
  durationMs: Nat.nullable(),
  question: z.object({
    id: QuestionId, text: z.string(), type: z.enum(["mc4", "tf"]), topic: Topic, difficulty: Stars,
  }).nullable(),
  options: z.array(z.string()),
  answeredIds: z.array(PlayerId),
  reveal: TriviaRevealSchema.nullable(),
  scores: z.array(TriviaScoreSchema),
  newIds: z.array(PlayerId),
  waitingIds: z.array(PlayerId),
  endedEarly: z.boolean(),
});

export const TriviaMeSchema = z.object({ myChoice: Nat.nullable(), myTimeMs: Nat.nullable(), waitingForNext: z.boolean() });

export const TriviaExtrasSchema = z.object({
  gameId: z.literal("trivia"),
  available: Nat,
  playCount: Nat,
  rerun: z.boolean(),
  quiz: QuizCardInfoSchema.nullable(),
  quizzes: z.array(QuizCardInfoSchema),
});

export type TriviaPublic = z.infer<typeof TriviaPublicSchema>;
export type TriviaMe = z.infer<typeof TriviaMeSchema>;
export type TriviaExtras = z.infer<typeof TriviaExtrasSchema>;
export const _triviaPublicAgree: Same<TriviaPublic, EnginePublic> = true;
export const _triviaMeAgree: Same<TriviaMe, EngineMe> = true;
export const _triviaExtrasAgree: Same<TriviaExtras, EngineExtras> = true;
