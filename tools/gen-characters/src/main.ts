// CLI: `pnpm --filter @jamaa/gen-characters run gen` writes CharacterPaths.kt, WorldColors.kt and Choreo.kt from
// shared/src/{characters,worlds,motion} (JAMAA-PLATFORM §3.7, §3.4, §3.8). `-- --check` fails when a generated file is
// missing or stale. Exit code 2 (and nothing written) while lane A's source modules are missing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emitAll } from "./kotlin";
import { loadModel } from "./load";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** Generated files that differ from what the sources produce (empty when up to date). */
export function stale(root: string, files: Record<string, string>): string[] {
  return Object.entries(files)
    .filter(([rel, text]) => !existsSync(join(root, rel)) || readFileSync(join(root, rel), "utf8") !== text)
    .map(([rel]) => rel);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const { model, missing } = await loadModel(ROOT);
  if (!model) {
    console.error(`gen-characters: source module(s) not written yet (lane A, JAMAA-PLATFORM §6.4 A5):\n  ${missing.join("\n  ")}`);
    process.exitCode = 2;
    return;
  }
  const files = emitAll(model);
  if (args.includes("--check")) {
    const bad = stale(ROOT, files);
    if (bad.length) {
      console.error(`gen-characters --check: stale or missing (run pnpm --filter @jamaa/gen-characters run gen):\n  ${bad.join("\n  ")}`);
      process.exitCode = 1;
    } else console.log(`gen-characters --check: ${Object.keys(files).length} files up to date`);
    return;
  }
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(ROOT, rel)), { recursive: true });
    writeFileSync(join(ROOT, rel), text);
    console.log(`wrote ${rel} (${(text.length / 1024).toFixed(1)} KB)`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
