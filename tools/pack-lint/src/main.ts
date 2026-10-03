// CLI: `pnpm lint:packs [--quiet]`. Exits 1 on any error; warnings are printed but never fail.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lintPacks, registeredPackFiles, type LintResult, type PackEntry } from "./lint";

/** Reads every `packs/<lang>/*.json` under a word-packs root. */
export function readPackEntries(wordPacksRoot: string): PackEntry[] {
  const entries: PackEntry[] = [];
  const packsDir = join(wordPacksRoot, "packs");
  for (const lang of readdirSync(packsDir).sort()) {
    const dir = join(packsDir, lang);
    if (!statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".json")) continue;
      const file = `packs/${lang}/${name}`;
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

export function lintDirectory(wordPacksRoot: string): LintResult {
  let registered: string[] | null;
  try {
    registered = registeredPackFiles(readFileSync(join(wordPacksRoot, "index.ts"), "utf8"));
  } catch {
    registered = null;
  }
  return lintPacks(readPackEntries(wordPacksRoot), registered);
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const quiet = args.includes("--quiet");
  const dirIdx = args.indexOf("--dir");
  const root = dirIdx >= 0 && args[dirIdx + 1] ? resolve(args[dirIdx + 1] as string) : resolve(dirname(fileURLToPath(import.meta.url)), "../../../word-packs");
  const { errors, warnings, counts } = lintDirectory(root);
  if (!quiet) for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  console.log(`pack-lint: pairs en=${counts.en ?? 0} fr=${counts.fr ?? 0} ar=${counts.ar ?? 0} (ar-LB=${counts["ar-LB"] ?? 0}); ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
