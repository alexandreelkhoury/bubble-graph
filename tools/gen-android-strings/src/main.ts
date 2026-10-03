// CLI: `pnpm gen:strings` writes the Android resources; `pnpm gen:strings --check` exits 1 if they would change.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GenError, LOCALES, generate, type MessageSet } from "./gen";

export interface RunResult { changed: string[]; written: boolean }

export function readMessages(root: string): MessageSet {
  const set: Partial<MessageSet> = {};
  for (const loc of LOCALES) {
    const path = join(root, "shared/i18n", `${loc}.json`);
    set[loc] = JSON.parse(readFileSync(path, "utf8")) as MessageSet[typeof loc];
  }
  return set as MessageSet;
}

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** Generates into `root`. With `check`, writes nothing and reports the files that differ. */
export function run(root: string, check: boolean): RunResult {
  const outputs = generate(readMessages(root));
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
  const root = rootIdx >= 0 && args[rootIdx + 1] ? resolve(args[rootIdx + 1] as string) : resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  try {
    const { changed } = run(root, check);
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
