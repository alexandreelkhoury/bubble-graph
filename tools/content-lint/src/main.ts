// CLI: `pnpm lint:content [--quiet] [--release]` (`pnpm lint:packs` is a one-milestone alias). Exits 1 on any error; warnings are printed but never fail.
// `--release` (PAYMENTS-SPEC §1.5, run by `pnpm deploy`) turns the starter-pack size gate into an error.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GAME1_DIR, lintPacks, registeredPackFiles, type LintOptions, type LintResult, type PackEntry } from "./lint";

/** Reads every game #1 word pack `<GAME1_DIR>/<lang>/*.json` under the content root (JAMAA-PLATFORM §5.1). */
export function readPackEntries(contentRoot: string): PackEntry[] {
  const entries: PackEntry[] = [];
  const packsDir = join(contentRoot, GAME1_DIR);
  for (const lang of readdirSync(packsDir).sort()) {
    const dir = join(packsDir, lang);
    if (!statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".json")) continue;
      const file = `${GAME1_DIR}/${lang}/${name}`;
      const text = readFileSync(join(dir, name), "utf8");
      try {
        entries.push({ file, data: JSON.parse(text) as unknown });
      } catch (e) {
        entries.push({ file, data: null, parseError: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return entries;
}

export function lintDirectory(contentRoot: string, opts: LintOptions = {}): LintResult {
  let registered: string[] | null;
  try {
    registered = registeredPackFiles(readFileSync(join(contentRoot, "index.ts"), "utf8"));
  } catch {
    registered = null;
  }
  return lintPacks(readPackEntries(contentRoot), registered, opts);
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const quiet = args.includes("--quiet");
  const dirIdx = args.indexOf("--dir");
  const root = dirIdx >= 0 && args[dirIdx + 1] ? resolve(args[dirIdx + 1] as string) : resolve(dirname(fileURLToPath(import.meta.url)), "../../../content");
  const { errors, warnings, counts } = lintDirectory(root, { release: args.includes("--release") });
  if (!quiet) for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  console.log(`content-lint: pairs en=${counts.en ?? 0} fr=${counts.fr ?? 0} ar=${counts.ar ?? 0} (ar-LB=${counts["ar-LB"] ?? 0}) es=${counts.es ?? 0}; ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
