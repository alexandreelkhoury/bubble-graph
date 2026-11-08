#!/usr/bin/env node
// `pnpm rename:gate` (JAMAA-PLATFORM §1.7): fails on any hit of the old brand outside tools/rename-gate/allowlist.txt.
// Usage: node tools/rename-gate/src/main.mjs [--root <dir>] [--summary]
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runGate } from "./gate.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const root = resolve(rootIdx >= 0 && args[rootIdx + 1] ? args[rootIdx + 1] : join(here, "..", "..", ".."));
const summary = args.includes("--summary");

const hits = runGate(root, readFileSync(join(here, "..", "allowlist.txt"), "utf8"));
if (hits.length === 0) {
  console.log("rename gate: OK (no hits outside the allowlist)");
  process.exit(0);
}
if (summary) {
  const perFile = new Map();
  for (const h of hits) perFile.set(h.path, (perFile.get(h.path) ?? 0) + 1);
  for (const [path, n] of [...perFile].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) console.error(`${n}\t${path}`);
} else {
  for (const h of hits) console.error(`${h.path}:${h.line}: ${h.text}`);
}
const files = new Set(hits.map((h) => h.path)).size;
console.error(`rename gate: FAILED, ${hits.length} hit(s) in ${files} file(s) outside tools/rename-gate/allowlist.txt`);
process.exit(1);
