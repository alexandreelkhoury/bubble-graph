// GAME-TRIVIA §9 / §9.1, DESIGN-JAMAA §2.3.1: the pure model of Quiz Night's setup (the quiz summary card, the quiz
// shelf, the VIP phone's quiz list, the "7 questions · 15 s to answer" hint). Zod-free, DOM-free, unit-tested. It reads
// only `setup.settings` and `setup.extras` (built by lane A's `projectSetup`): no answer ever reaches setup.
import type { RoomSetup } from "@jamaa/shared/protocol/v2";
import { LENGTHS, PACE_MC4_MS } from "@jamaa/shared/games/trivia/meta";

export type TriviaSetup = Extract<RoomSetup, { gameId: "trivia" }>;
export type QuizCard = TriviaSetup["extras"]["quizzes"][number];
type Title = QuizCard["title"];

export const isTriviaSetup = (s: RoomSetup | null | undefined): s is TriviaSetup => !!s && s.gameId === "trivia";

/**
 * The quiz the game will play: the chosen family, else the server's resolution of `quizId: null` ("the first featured
 * quiz playable in the content language", `extras.quiz`), else the first card. Never "all packs": a quiz is one pack.
 */
export function selectedQuiz(setup: TriviaSetup): QuizCard | null {
  const { quizId } = setup.settings;
  const { quizzes, quiz } = setup.extras;
  return (quizId !== null ? quizzes.find((q) => q.id === quizId) : undefined) ?? quiz ?? quizzes[0] ?? null;
}

/** The `quizId` row's value: the selected quiz's title in `l` (empty when the content language has no quiz). */
export function quizRowValue(setup: TriviaSetup, titleOf: (t: Title) => string): string {
  const q = selectedQuiz(setup);
  return q ? titleOf(q.title) : "";
}

/** §9 / DESIGN-JAMAA §2.3.1: one quiz → a non-focusable summary card (no row); two or more → the row + the shelf. */
export function quizUi(setup: TriviaSetup): "none" | "summary" | "shelf" {
  const n = setup.extras.quizzes.length;
  return n === 0 ? (setup.extras.quiz ? "summary" : "none") : n === 1 ? "summary" : "shelf";
}

/** §9.1: one shelf row per domain, in the order the server lists the quizzes (featured first), cards in that order. */
export function shelfRows(quizzes: readonly QuizCard[]): { domain: QuizCard["domain"]; quizzes: QuizCard[] }[] {
  const rows: { domain: QuizCard["domain"]; quizzes: QuizCard[] }[] = [];
  for (const q of quizzes) {
    const row = rows.find((r) => r.domain === q.domain);
    if (row) row.quizzes.push(q);
    else rows.push({ domain: q.domain, quizzes: [q] });
  }
  return rows;
}

/** A Pass-only quiz in a free room shows a lock (focusing it shows the platform's Pass upsell when billing is on). */
export const quizLocked = (q: QuizCard, roomPremium: boolean): boolean => q.tier === "premium" && !roomPremium;

/** "+n" after the (max 3) featured topic chips. */
export const moreTopics = (q: QuizCard): number => Math.max(0, q.moreTopics);

/**
 * The line under the settings rows (§9): how many questions this game plays (`playCount`), whether the pool caps the
 * chosen length ("7 questions available"), and the seconds per mc4 answer at this pace ("15 s to answer").
 */
export function setupHint(setup: TriviaSetup): { count: number; capped: boolean; available: number; seconds: number } {
  const { playCount, available } = setup.extras;
  const want = LENGTHS[setup.settings.length];
  return { count: playCount, capped: available < want, available, seconds: Math.round(PACE_MC4_MS[setup.settings.pace] / 1000) };
}

/** The shelf's grouping (owner request): one row per theme (domain), or one row per difficulty (stars). */
export type ShelfSort = "theme" | "difficulty";
/** The shelf's difficulty filter: every quiz, or only quizzes of that many stars. */
export type ShelfStars = 0 | 1 | 2 | 3;
export type ShelfRow = { key: string; kind: "domain"; domain: QuizCard["domain"]; quizzes: QuizCard[] } | { key: string; kind: "stars"; stars: 1 | 2 | 3; quizzes: QuizCard[] };

/**
 * The shelf rows for a sort and a filter. "theme": `shelfRows` order (featured first). "difficulty": easiest first,
 * cards in server order within a row. Empty rows are dropped, so a filter with no match gives [].
 */
export function shelfView(quizzes: readonly QuizCard[], sort: ShelfSort, stars: ShelfStars): ShelfRow[] {
  const kept = stars === 0 ? quizzes : quizzes.filter((q) => q.stars === stars);
  if (sort === "theme") return shelfRows(kept).map((r) => ({ key: `d:${r.domain}`, kind: "domain", domain: r.domain, quizzes: r.quizzes }));
  return ([1, 2, 3] as const)
    .map((n) => ({ key: `s:${n}`, kind: "stars" as const, stars: n, quizzes: kept.filter((q) => q.stars === n) }))
    .filter((r) => r.quizzes.length > 0);
}

/** Star levels that at least one quiz has (the filter chips only offer levels that exist, plus "All"). */
export function starLevels(quizzes: readonly QuizCard[]): (1 | 2 | 3)[] {
  return ([1, 2, 3] as const).filter((n) => quizzes.some((q) => q.stars === n));
}
