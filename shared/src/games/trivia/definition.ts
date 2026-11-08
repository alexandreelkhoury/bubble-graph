// JAMAA-PLATFORM §2.1 / §6.1: Trivia's server-only GameDefinition. STUB created in P (`enabled: false`); the G lane of
// this game replaces this file with the real engine, content and projections.
import { oneOf } from "../settings-util";
import { stubDefinition } from "../stub";
import { TRIVIA_META } from "./meta";

const FAMILY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const definition = stubDefinition(
  TRIVIA_META,
  {
    quizId: (v) => v === null || (typeof v === "string" && v.length <= 35 && FAMILY_RE.test(v)),
    length: oneOf(["short", "normal", "long"]),
    pace: oneOf(["relaxed", "normal", "fast"]),
  },
  (s) => (s.quizId === null ? [] : [s.quizId]),
  () => ({ gameId: "trivia" as const, available: 0, quiz: null }),
);
export type TriviaDefinition = typeof definition;
