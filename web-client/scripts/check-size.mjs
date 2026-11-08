// JAMAA-PLATFORM §3.8 phone budget (gzip level 9 of dist/assets/*.js):
//   core (every chunk except tv-mock*, locale and game/i18n chunks)
//   + the largest game-<id> (its game-<id>* chunks together) + the largest root locale chunk (fr/ar/es)
//   + the largest per-game locale chunk (i18n-<id>-<locale>)        ≤ 60 KB gz
//   each game-<id> ≤ 14 KB gz (provisional). The /tv mock chunks are reported against a soft 220 KB cap (never fails).
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const BUDGET = 60 * 1024;
const GAME_CAP = 14 * 1024;
const TV_SOFT_CAP = 220 * 1024;
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "assets");
let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith(".js"));
} catch {
  console.error(`check-size: ${dir} not found. Run the build first.`);
  process.exit(1);
}
let core = 0, tv = 0, rootLocale = 0, gameLocale = 0;
const games = new Map();
const rows = [];
for (const f of files.sort()) {
  const size = gzipSync(readFileSync(join(dir, f)), { level: 9 }).length;
  let kind;
  if (/^tv-mock/.test(f) || f.includes("TvMock")) { kind = "tv"; tv += size; }
  else if (/^(fr|ar|es|en)-[\w-]+\.js$/.test(f)) { kind = "locale"; rootLocale = Math.max(rootLocale, size); }
  else if (/^i18n-[a-z]+-[a-z]{2}-/.test(f)) { kind = "game-locale"; gameLocale = Math.max(gameLocale, size); }
  else if (/^game-([a-z]+)/.test(f)) { kind = "game"; const id = /^game-([a-z]+)/.exec(f)[1]; games.set(id, (games.get(id) ?? 0) + size); }
  else { kind = "core"; core += size; }
  rows.push([kind, f, size]);
}
const kb = (n) => `${(n / 1024).toFixed(2)} KB`;
for (const [kind, f, size] of rows) console.log(`${kind.padStart(12)}  ${f.padEnd(44)} ${kb(size)} gz`);
let ok = true;
let largestGame = 0;
for (const [id, size] of games) {
  const over = size > GAME_CAP;
  if (over) ok = false;
  largestGame = Math.max(largestGame, size);
  console.log(`game-${id}: ${kb(size)} gz / cap ${kb(GAME_CAP)} → ${over ? "OVER" : "OK"}`);
}
const total = core + largestGame + rootLocale + gameLocale;
console.log(`core ${kb(core)} + largest game ${kb(largestGame)} + largest locale ${kb(rootLocale)} + largest game locale ${kb(gameLocale)}`);
const fits = total <= BUDGET;
if (!fits) ok = false;
console.log(`phone total ${kb(total)} gz / budget ${kb(BUDGET)} → ${fits ? "OK" : "OVER BUDGET"}`);
console.log(`/tv mock ${kb(tv)} gz / soft cap ${kb(TV_SOFT_CAP)} → ${tv <= TV_SOFT_CAP ? "OK" : "over (reported, not failing)"}`);
process.exit(ok ? 0 : 1);
