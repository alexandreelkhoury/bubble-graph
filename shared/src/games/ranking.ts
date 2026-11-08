// JAMAA-PLATFORM §2.2 / §2.4: GameOutcome.ranking helper shared by every game. Pure, zod-free.

/**
 * Standard competition ranking (1, 1, 3) on `points`, best first: one group per score, ids inside a group in `order`
 * (seat order). Ids in `exclude` (left players) and ids with 0 or fewer points are left out (they get no stars).
 */
export function competitionRanking(points: Readonly<Record<string, number>>, order: readonly string[], exclude: ReadonlySet<string> = new Set()): string[][] {
  const ids = order.filter((id) => !exclude.has(id) && (points[id] ?? 0) > 0);
  const scores = [...new Set(ids.map((id) => points[id] as number))].sort((a, b) => b - a);
  return scores.map((sc) => ids.filter((id) => points[id] === sc));
}
