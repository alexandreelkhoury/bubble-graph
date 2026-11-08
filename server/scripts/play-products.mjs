#!/usr/bin/env node
// PAYMENTS-SPEC rev 4 §1.4 / JAMAA-PLATFORM §4.1, §1.6 O5: prints the CSV of every Play product for the owner to create
// in Play Console (`pnpm --filter @jamaa/server billing:products`):
//   productId,type,gameId,family,locales,titleEn,titleFr,titleAr,titleEs
// Row 1 is the JAMAA Pass subscription (base plans monthly + yearly, offer trial-7d on each: created by hand, the CSV
// only reminds the id and title). Then one one-time product per sellable content FAMILY (`pack_<family>`): every family
// with a pack that is not `tier: "free"` (item-level tiers, Bluff/Likely, count as sellable). Translations of one family
// share one product. Packs are read from the files listed in content/<game>/index.ts (the same list the server ships).
// Titles: "JAMAA Pass" and "JAMAA – <pack title>" (JAMAA-PLATFORM §1.3).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const GAME_IDS = ["mishana", "bluff", "likely", "trivia"]; // = shared/src/games/ids.ts (checked by the test)
export const PASS_PRODUCT_ID = "jamaa_pass";
const PRODUCT_ID_REGEX = /^[a-z0-9][a-z0-9_.]{0,39}$/;
const LANG = { en: "en", fr: "fr", ar: "ar", "ar-LB": "ar", es: "es" };
export const HEADER = "productId,type,gameId,family,locales,titleEn,titleFr,titleAr,titleEs";

const csv = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const packProductId = (family) => "pack_" + family.replaceAll("-", "_");

/** The pack files listed in content/<game>/index.ts (relative imports of .json files), as absolute paths. */
export function listedPackFiles(contentRoot, game) {
  const index = join(contentRoot, game, "index.ts");
  if (!existsSync(index)) return [];
  const src = readFileSync(index, "utf8");
  return [...src.matchAll(/from\s+["']\.\/([^"']+\.json)["']/g)].map((m) => join(contentRoot, game, m[1]));
}

const ITEM_KEYS = ["pairs", "questions", "items", "cards"];
function sellable(p) {
  const items = ITEM_KEYS.map((k) => p[k]).find(Array.isArray) ?? [];
  if (items.some((i) => i && typeof i === "object" && i.tier === "pass")) return true; // item-level tiers
  return p.tier !== "free"; // a pack without `tier` is premium (PackHeader default)
}

/** Pure: the CSV lines for `packs` ({gameId, pack}); throws on an id Play would refuse. */
export function productRows(packs) {
  const byFamily = new Map();
  for (const { gameId, pack } of packs) {
    if (!sellable(pack)) continue;
    const family = typeof pack.family === "string" ? pack.family : pack.id;
    const locale = typeof pack.locale === "string" ? pack.locale : pack.sourceLocale;
    const langs = Array.isArray(pack.playableIn) ? pack.playableIn : [LANG[locale] ?? locale];
    const row = byFamily.get(family) ?? { gameId, family, title: pack.title ?? {}, locales: new Set() };
    if (row.gameId !== gameId) throw new Error(`family ${family} is used by ${row.gameId} and ${gameId}`);
    for (const l of langs) row.locales.add(l);
    byFamily.set(family, row);
  }
  const lines = [HEADER, [PASS_PRODUCT_ID, "subscription", "*", "*", "*", "JAMAA Pass", "JAMAA Pass", "JAMAA Pass", "JAMAA Pass"].join(",")];
  const rows = [...byFamily.values()].sort((a, b) => GAME_IDS.indexOf(a.gameId) - GAME_IDS.indexOf(b.gameId) || (a.family < b.family ? -1 : 1));
  for (const r of rows) {
    const pid = packProductId(r.family);
    if (!PRODUCT_ID_REGEX.test(pid)) throw new Error(`family ${r.family} maps to an invalid product id ${pid}`);
    const t = (k) => `JAMAA – ${String(r.title[k] ?? r.title.en ?? "")}`;
    const locales = ["en", "fr", "ar", "es"].filter((l) => r.locales.has(l)).join(" ");
    lines.push([pid, "one-time", r.gameId, r.family, locales, t("en"), t("fr"), t("ar"), t("es")].map((v) => csv(String(v))).join(","));
  }
  return lines;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "content");
  const packs = GAME_IDS.flatMap((gameId) => listedPackFiles(root, gameId).map((f) => ({ gameId, pack: JSON.parse(readFileSync(f, "utf8")) })));
  let lines;
  try {
    lines = productRows(packs);
  } catch (e) {
    console.error(`play-products: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
  if (lines.length <= 2) {
    console.error("play-products: no sellable pack families found");
    process.exit(1);
  }
  console.log(lines.join("\n"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
