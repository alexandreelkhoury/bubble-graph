// Writes the generated (G) fixtures (v1 at the top level, every v2 fixture under v2/); `--check` fails (exit 1) if any would change. Never touches V files.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateFixtures } from "./fixture-scenario";
import { generateFixturesV2 } from "./fixture-scenario-v2";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const check = process.argv.includes("--check");
let stale = 0;
mkdirSync(join(dir, "v2"), { recursive: true });
for (const [name, content] of [...generateFixtures(), ...generateFixturesV2()]) {
  const path = join(dir, name);
  let current: string | null;
  try {
    current = readFileSync(path, "utf8");
  } catch {
    current = null;
  }
  if (current === content) continue;
  if (check) {
    console.error(`stale fixture: ${name}`);
    stale++;
  } else {
    writeFileSync(path, content);
    console.log(`wrote ${name}`);
  }
}
if (check && stale > 0) {
  console.error(`${stale} generated fixture(s) out of date; run \`pnpm fixtures\``);
  process.exit(1);
}
if (check) console.log("fixtures up to date");
