// §8.9 bundle budget: gzip (level 9) every dist/assets/*.js except the lazy TV-mock chunks; fail if > 60 KB total.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const BUDGET = 60 * 1024;
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "assets");
let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith(".js"));
} catch {
  console.error(`check-size: ${dir} not found. Run the build first.`);
  process.exit(1);
}
let total = 0;
for (const f of files) {
  const size = gzipSync(readFileSync(join(dir, f)), { level: 9 }).length;
  const excluded = f.includes("tv-mock") || f.includes("TvMock");
  console.log(`${excluded ? "  (excluded)" : "            "} ${f.padEnd(40)} ${(size / 1024).toFixed(2)} KB gz`);
  if (!excluded) total += size;
}
const ok = total <= BUDGET;
console.log(`total ${(total / 1024).toFixed(2)} KB gz / budget ${(BUDGET / 1024).toFixed(0)} KB → ${ok ? "OK" : "OVER BUDGET"}`);
process.exit(ok ? 0 : 1);
