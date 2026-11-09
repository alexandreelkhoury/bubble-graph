// JAMAA-PLATFORM §3.8 phone budget (gzip level 9 of dist/assets/*.js):
//   core (every chunk the phone shell can load: the entry's import graph, stopping at game, locale and TV chunks)
//   + the largest game (its game-<id>* chunks plus every chunk only games reach, e.g. a shared `motion` chunk)
//   + the largest root locale chunk (en/fr/ar/es) + the largest per-game locale chunk (i18n-<id>-<locale>)   ≤ 60 KB gz
//   each game ≤ 14 KB gz (provisional). The /tv mock chunks (and chunks only the TV reaches) are reported against a
//   soft 220 KB cap (never fails).
// Chunk references are read from the built files: `"./<chunk>.js"` covers static imports and dynamic import() calls.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const BUDGET = 60 * 1024;
const GAME_CAP = 14 * 1024;
const TV_SOFT_CAP = 220 * 1024;
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const dir = join(root, "assets");
let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
} catch {
  console.error(`check-size: ${dir} not found. Run the build first.`);
  process.exit(1);
}

const src = new Map(files.map((f) => [f, readFileSync(join(dir, f), "utf8")]));
const size = new Map(files.map((f) => [f, gzipSync(src.get(f), { level: 9 }).length]));
const refs = new Map(files.map((f) => [f, new Set([...src.get(f).matchAll(/["']\.\/([\w.-]+\.js)["']/g)].map((m) => m[1]).filter((x) => src.has(x) && x !== f))]));

/** Named kinds; null = an unnamed shared chunk, classified by who reaches it. */
function named(f) {
  if (/^tv-mock/.test(f) || f.includes("TvMock")) return "tv";
  if (/^(fr|ar|es|en)-[\w-]+\.js$/.test(f)) return "locale";
  if (/^i18n-[a-z]+-[a-z]{2}-/.test(f)) return "game-locale";
  if (/^game-[a-z]+/.test(f)) return "game";
  return null;
}
const gameOf = (f) => /^game-([a-z]+)/.exec(f)?.[1] ?? null;

/** Every chunk reachable from `starts`, not entering named chunks other than the starts' own kind `keep`. */
function closure(starts, keep) {
  const seen = new Set(starts);
  const stack = [...starts];
  while (stack.length) {
    for (const r of refs.get(stack.pop()) ?? []) {
      if (seen.has(r)) continue;
      const k = named(r);
      if (k !== null && !keep(r)) continue;
      seen.add(r);
      stack.push(r);
    }
  }
  return seen;
}

// The phone shell: the HTML entry (and its modulepreloads) and everything they reach, minus games, locales and TV.
const html = readFileSync(join(root, "index.html"), "utf8");
const entries = [...html.matchAll(/\/assets\/([\w.-]+\.js)/g)].map((m) => m[1]).filter((f) => src.has(f));
const core = closure(entries, () => false);
const games = new Map();
for (const f of files) { const g = gameOf(f); if (g) games.set(g, [...(games.get(g) ?? []), f]); }
const gameSets = new Map([...games].map(([id, fs]) => [id, closure(fs, (r) => gameOf(r) === id)]));
const tvSet = closure(files.filter((f) => named(f) === "tv"), (r) => named(r) === "tv");

const kb = (n) => `${(n / 1024).toFixed(2)} KB`;
let coreSize = 0, tvSize = 0, rootLocale = 0, gameLocale = 0;
for (const f of files) {
  const n = size.get(f);
  const k = named(f);
  let kind;
  if (k === "locale") { kind = "locale"; rootLocale = Math.max(rootLocale, n); }
  else if (k === "game-locale") { kind = "game-locale"; gameLocale = Math.max(gameLocale, n); }
  else if (k === "game") kind = "game";
  else if (k === "tv") { kind = "tv"; tvSize += n; }
  else if (core.has(f)) { kind = "core"; coreSize += n; }
  else {
    const users = [...gameSets].filter(([, s]) => s.has(f)).map(([id]) => id);
    if (users.length) kind = `game-dep(${users.join(",")})`;
    else if (tvSet.has(f)) { kind = "tv"; tvSize += n; }
    else { kind = "core"; coreSize += n; } // unreachable from anything known: count it, to be safe
  }
  console.log(`${kind.padStart(22)}  ${f.padEnd(44)} ${kb(n)} gz`);
}

let ok = true;
let largestGame = 0;
for (const [id, set] of gameSets) {
  let n = 0;
  for (const f of set) if (!core.has(f) && named(f) !== "tv") n += size.get(f);
  const over = n > GAME_CAP;
  if (over) ok = false;
  largestGame = Math.max(largestGame, n);
  console.log(`game-${id}: ${kb(n)} gz (its chunks + game-only deps) / cap ${kb(GAME_CAP)} → ${over ? "OVER" : "OK"}`);
}
const total = coreSize + largestGame + rootLocale + gameLocale;
console.log(`core ${kb(coreSize)} + largest game ${kb(largestGame)} + largest locale ${kb(rootLocale)} + largest game locale ${kb(gameLocale)}`);
const fits = total <= BUDGET;
if (!fits) ok = false;
console.log(`phone total ${kb(total)} gz / budget ${kb(BUDGET)} → ${fits ? "OK" : "OVER BUDGET"}`);
console.log(`/tv mock ${kb(tvSize)} gz / soft cap ${kb(TV_SOFT_CAP)} → ${tvSize <= TV_SOFT_CAP ? "OK" : "over (reported, not failing)"}`);
process.exit(ok ? 0 : 1);
