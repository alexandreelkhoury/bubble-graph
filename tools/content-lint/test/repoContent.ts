// Shared fixture for the tests that lint the real content/ tree. A full lint of the repo takes several seconds, over
// vitest's 5 s default, so each file lints it once (memoised) and the repo-content describes take REPO_TIMEOUT.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lintDirectory } from "../src/main";
import type { LintResult } from "../src/lint";
import { GAME_IDS, registeredGameFiles, type GameId } from "../src/platform";

export const REPO_CONTENT = join(import.meta.dirname, "../../../content");
export const REPO_TIMEOUT = 30_000;

let cached: LintResult | null = null;
/** `lintDirectory(REPO_CONTENT)`, computed once per test file. */
export function repoLint(): LintResult {
  cached ??= lintDirectory(REPO_CONTENT);
  return cached;
}

/** Packs registered in content/<game>/index.ts (JAMAA-PLATFORM §5.1), per game. */
export function registeredPackCount(game?: GameId): number {
  const games: readonly GameId[] = game === undefined ? GAME_IDS : [game];
  let n = 0;
  for (const g of games) n += registeredGameFiles(readFileSync(join(REPO_CONTENT, g, "index.ts"), "utf8"), g).length;
  return n;
}
