#!/usr/bin/env node
// PAYMENTS-SPEC §1.4: prints a CSV of every Play in-app product (all one-time, non-consumable) for the owner to
// create in Play Console: first the lifetime `premium` unlock, then every premium pack:
//   productId,kind,priceUsd,pairs,packId,locale,titleEn,titleFr,titleAr
// Recommended prices (USD; Play converts them per country):
//   premium 7.99. The launch promo (5.99) is a Play Console sale on `premium`, not a separate product.
//   packs   1.99, or 2.99 for a pack with >= 60 pairs.
// Reads the packs registered in word-packs/index.ts. A pack without "tier" is premium. Notes go to stderr, so stdout
// is the bare CSV.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HEADER = "productId,kind,priceUsd,pairs,packId,locale,titleEn,titleFr,titleAr";
export const PREMIUM_PRICE_USD = "7.99";
export const PREMIUM_LAUNCH_SALE_USD = "5.99";
export const BIG_PACK_PAIRS = 60;
/** 1.99 below BIG_PACK_PAIRS pairs, 2.99 from it. */
export const packPriceUsd = (pairs) => (pairs >= BIG_PACK_PAIRS ? "2.99" : "1.99");

const csv = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const row = (cells) => cells.map((v) => csv(String(v))).join(",");
const productId = (packId) => "pack_" + packId.replaceAll("-", "_");

/** CSV lines (header first) for parsed pack JSONs; throws on a pack id that maps to an invalid product id. */
export function productLines(packs) {
  const lines = [HEADER, row(["premium", "lifetime", PREMIUM_PRICE_USD, "", "", "", "Mish Ana Premium", "Mish Ana Premium", "Mish Ana Premium"])];
  for (const p of packs) {
    if (p.tier === "free") continue;
    const pid = productId(p.id);
    if (!/^[a-z0-9][a-z0-9_.]{0,39}$/.test(pid)) throw new Error(`${p.id} maps to an invalid product id ${pid}`);
    const pairs = Array.isArray(p.pairs) ? p.pairs.length : 0;
    lines.push(row([pid, "pack", packPriceUsd(pairs), pairs, p.id, p.locale, p.title.en, p.title.fr, p.title.ar]));
  }
  return lines;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "word-packs");
  const index = readFileSync(join(root, "index.ts"), "utf8");
  const files = [...index.matchAll(/from\s+["']\.\/(packs\/[^"']+\.json)["']/g)].map((m) => m[1]);
  let lines;
  try {
    lines = productLines(files.map((f) => JSON.parse(readFileSync(join(root, f), "utf8"))));
  } catch (e) {
    console.error(`play-products: ${e.message}`);
    process.exit(1);
  }
  if (lines.length < 3) {
    console.error("play-products: no premium packs found");
    process.exit(1);
  }
  console.error(`play-products: ${lines.length - 1} one-time products. Launch promo: a Play Console sale on "premium" at ${PREMIUM_LAUNCH_SALE_USD} USD.`);
  console.log(lines.join("\n"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
