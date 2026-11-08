// Worker/DO script budget (JAMAA-PLATFORM §5.6). Every cold isolate parses and compiles the whole bundle, so a code
// regression such as zod's full namespace with its locale packs (+350 KB) must fail the build. The packs no longer live
// in the script: `content-lint --emit` writes them to content-dist/ and wrangler uploads them as Text modules, which
// `wrangler deploy --dry-run --outdir dist` copies next to index.js. Run after that dry run (`pnpm build` does).
//   1. JS (dist/index.js, code only) ≤ 400 KB minified;
//   2. content text modules (dist/*.txt) ≤ 2 MB raw in all;
//   3. the whole upload (JS + modules) ≤ 3 MB gzip: the Workers Free plan limit as documented in 2025
//      [VERIFY the current limits for the owner's plan: Free 3 MB / Paid 10 MB gzip]. The conservative one is used.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const KB = 1024;
export const JS_BUDGET = 400 * KB;
export const CONTENT_BUDGET = 2 * KB * KB;
export const UPLOAD_GZ_BUDGET = 3 * KB * KB;

/** Pure check over the dist listing (exported for tests): returns the report lines and whether every budget holds. */
export function checkSizes(files) {
  const js = files.find((f) => f.name === "index.js");
  if (!js) return { ok: false, lines: ["dist/index.js not found"] };
  const mods = files.filter((f) => f.name.endsWith(".txt"));
  const contentRaw = mods.reduce((n, f) => n + f.bytes.length, 0);
  const jsGz = gzipSync(js.bytes, { level: 9 }).length;
  const uploadGz = jsGz + mods.reduce((n, f) => n + gzipSync(f.bytes, { level: 9 }).length, 0);
  const rows = [
    ["script (code)", js.bytes.length, JS_BUDGET, `${(jsGz / KB).toFixed(1)} KB gz`],
    [`content (${mods.length} text modules, raw)`, contentRaw, CONTENT_BUDGET, null],
    ["upload (gzip)", uploadGz, UPLOAD_GZ_BUDGET, null],
  ];
  let ok = true;
  const lines = rows.map(([label, n, max, extra]) => {
    const pass = n <= max;
    ok &&= pass;
    return `${label}: ${(n / KB).toFixed(1)} KB${extra ? ` (${extra})` : ""} / budget ${(max / KB).toFixed(0)} KB → ${pass ? "OK" : "OVER BUDGET"}`;
  });
  return { ok, lines };
}

function main() {
  const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
  let names;
  try {
    names = readdirSync(dist);
  } catch {
    console.error(`check-size: ${dist} not found. Run the build first.`);
    process.exit(1);
  }
  const files = names.filter((n) => n === "index.js" || n.endsWith(".txt")).map((name) => ({ name, bytes: readFileSync(join(dist, name)) }));
  const { ok, lines } = checkSizes(files);
  for (const l of lines) console.log(`server ${l}`);
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
