#!/usr/bin/env node
// PAYMENTS-SPEC §1.4: prints a CSV of every premium pack for the owner to create in Play Console:
//   productId,packId,locale,titleEn,titleFr,titleAr
// Reads the packs registered in word-packs/index.ts. A pack without "tier" is premium.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "word-packs");
const index = readFileSync(join(ROOT, "index.ts"), "utf8");
const files = [...index.matchAll(/from\s+["']\.\/(packs\/[^"']+\.json)["']/g)].map((m) => m[1]);
const csv = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const productId = (packId) => "pack_" + packId.replaceAll("-", "_");

const lines = ["productId,packId,locale,titleEn,titleFr,titleAr"];
let n = 0;
for (const f of files) {
  const p = JSON.parse(readFileSync(join(ROOT, f), "utf8"));
  if (p.tier === "free") continue;
  const pid = productId(p.id);
  if (!/^[a-z0-9][a-z0-9_.]{0,39}$/.test(pid)) {
    console.error(`play-products: ${p.id} maps to an invalid product id ${pid}`);
    process.exit(1);
  }
  lines.push([pid, p.id, p.locale, p.title.en, p.title.fr, p.title.ar].map((v) => csv(String(v))).join(","));
  n++;
}
if (n === 0) {
  console.error("play-products: no premium packs found");
  process.exit(1);
}
console.log(lines.join("\n"));
