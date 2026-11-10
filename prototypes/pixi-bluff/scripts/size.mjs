// Prints the static dist size: JS/CSS/HTML raw + gzip, and the atlas/font assets (already compressed formats).
import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
async function* walk(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
let code = 0, codeGz = 0, assets = 0;
const rows = [];
for await (const f of walk(dist)) {
  const ext = extname(f);
  const size = (await stat(f)).size;
  if ([".js", ".css", ".html", ".json"].includes(ext)) {
    const gz = gzipSync(await readFile(f), { level: 9 }).length;
    code += size;
    codeGz += gz;
    rows.push(`${relative(dist, f).padEnd(40)} ${kb(size).padStart(10)}  gz ${kb(gz).padStart(9)}`);
  } else {
    assets += size;
    rows.push(`${relative(dist, f).padEnd(40)} ${kb(size).padStart(10)}`);
  }
}
console.log(rows.sort().join("\n"));
console.log(`\ncode (js/css/html/json): ${kb(code)} raw, ${kb(codeGz)} gzip`);
console.log(`assets (webp/woff2/txt): ${kb(assets)}`);
console.log(`total transfer ≈ ${kb(codeGz + assets)}`);
