// CLI: `pnpm gen:strings` writes the Android resources; `--check` exits 1 if they would change; `--only <platform|id>`
// limits the run to the platform files or one game's files (a G lane regenerates only its own game, JAMAA-PLATFORM §5.7).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_IDS, GenError, LOCALES, generate, type GameId, type I18nTree, type MessageSet, type Scope, type SplitMap } from "./gen";

export interface RunResult { changed: string[]; written: boolean }

export const SPLIT_MAP_PATH = "tools/gen-android-strings/split-map.json";

function readSet(dir: string): MessageSet {
  const set: Partial<MessageSet> = {};
  for (const loc of LOCALES) set[loc] = JSON.parse(readFileSync(join(dir, `${loc}.json`), "utf8")) as MessageSet[typeof loc];
  return set as MessageSet;
}

/** The root (platform) message files only. */
export function readMessages(root: string): MessageSet {
  return readSet(join(root, "shared/i18n"));
}

/** Root files plus every game's files (each of the four game folders must exist, §6.1). */
export function readTree(root: string): I18nTree {
  const games = {} as Record<GameId, MessageSet>;
  for (const id of GAME_IDS) {
    const dir = join(root, "shared/i18n/games", id);
    if (!existsSync(dir)) throw new GenError(`missing shared/i18n/games/${id}/ (every game has an i18n folder, JAMAA-PLATFORM §6.1)`);
    games[id] = readSet(dir);
  }
  return { root: readMessages(root), games };
}

/** split-map.json, or null when the repo has none (test fixtures). */
export function readSplitMap(root: string): SplitMap | null {
  const p = join(root, SPLIT_MAP_PATH);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as SplitMap) : null;
}

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** Generates into `root`. With `check`, writes nothing and reports the files that differ. */
export function run(root: string, check: boolean, scope: Scope = "all"): RunResult {
  const outputs = generate(readTree(root), readSplitMap(root), scope);
  const changed: string[] = [];
  for (const [rel, content] of outputs) {
    const abs = join(root, rel);
    if (readOrNull(abs) === content) continue;
    changed.push(rel);
    if (!check) {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
    }
  }
  return { changed, written: !check };
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const check = args.includes("--check");
  const rootIdx = args.indexOf("--root");
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
  if (only !== undefined && only !== "platform" && !(GAME_IDS as readonly string[]).includes(only)) {
    console.error(`gen-android-strings: --only expects platform or one of ${GAME_IDS.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  const scope = (only ?? "all") as Scope;
  const root = rootIdx >= 0 && args[rootIdx + 1] ? resolve(args[rootIdx + 1] as string) : resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  try {
    const { changed } = run(root, check, scope);
    if (check) {
      if (changed.length > 0) {
        console.error(`gen-android-strings --check: out of date (run pnpm gen:strings):\n  ${changed.join("\n  ")}`);
        process.exitCode = 1;
      } else {
        console.log("gen-android-strings --check: up to date");
      }
    } else {
      console.log(changed.length > 0 ? `gen-android-strings: wrote\n  ${changed.join("\n  ")}` : "gen-android-strings: nothing to do");
    }
  } catch (e) {
    console.error(e instanceof GenError ? e.message : e);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
