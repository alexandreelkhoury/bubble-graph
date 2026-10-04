// Worker/DO script budget: every cold isolate parses and compiles the whole bundle, so a regression such as
// zod's full namespace with its locale packs (+350 KB) must fail the build. Run after `wrangler deploy --dry-run`.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const BUDGET = 400 * 1024; // minified bytes; ~60% of it is word-pack data, which grows with the packs
const file = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");
let buf;
try {
  buf = readFileSync(file);
} catch {
  console.error(`check-size: ${file} not found. Run the build first.`);
  process.exit(1);
}
const gz = gzipSync(buf, { level: 9 }).length;
const ok = buf.length <= BUDGET;
console.log(`server bundle ${(buf.length / 1024).toFixed(1)} KB (${(gz / 1024).toFixed(1)} KB gz) / budget ${BUDGET / 1024} KB → ${ok ? "OK" : "OVER BUDGET"}`);
process.exit(ok ? 0 : 1);
