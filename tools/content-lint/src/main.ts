// CLI: `pnpm lint:content [--quiet] [--release] [--emit [--out <dir>]]` (`pnpm lint:packs` is a one-milestone alias).
// Exits 1 on any error; warnings are printed but never fail. `--release` (PAYMENTS-SPEC §1.5, run by `pnpm deploy`) turns
// the starter-pack size gate into an error. `--emit` (JAMAA-PLATFORM §5.6) writes every registered, validated pack as
// minified JSON to server/content-dist/<game>/<id>.txt (gitignored, never edited by hand), only when there is no error.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GAME1_DIR, lintPacks, registeredPackFiles, type LintOptions, type LintResult, type PackEntry } from "./lint";
import { GAME_IDS, I18N_LOCALES, lintGameI18n, lintRootIndex, lintVocab, registeredGameFiles, unlistedFiles, type GameId, type I18nFiles } from "./platform";

/** Reads every game #1 word pack `<GAME1_DIR>/<lang>/*.json` under the content root (JAMAA-PLATFORM §5.1). */
export function readPackEntries(contentRoot: string): PackEntry[] {
  const entries: PackEntry[] = [];
  const packsDir = join(contentRoot, GAME1_DIR);
  for (const lang of readdirSync(packsDir).sort()) {
    const dir = join(packsDir, lang);
    if (!statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".json")) continue;
      const file = `${GAME1_DIR}/${lang}/${name}`;
      const text = readFileSync(join(dir, name), "utf8");
      try {
        entries.push({ file, data: JSON.parse(text) as unknown });
      } catch (e) {
        entries.push({ file, data: null, parseError: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return entries;
}

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function jsonFiles(root: string, rel: string): string[] {
  const dir = join(root, rel);
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const r = `${rel}/${name}`;
    if (statSync(join(root, r)).isDirectory()) out.push(...jsonFiles(root, r));
    else if (name.endsWith(".json")) out.push(r);
  }
  return out;
}

function readI18n(dir: string): I18nFiles | null {
  const out: Partial<I18nFiles> = {};
  for (const loc of I18N_LOCALES) {
    const text = readOrNull(join(dir, `${loc}.json`));
    if (text === null) return null;
    out[loc] = JSON.parse(text) as Record<string, unknown>;
  }
  return out as I18nFiles;
}

export interface DirectoryOptions extends LintOptions {
  /** shared/i18n folder; default `<content root>/../shared/i18n` when it exists; null skips the i18n checks. */
  i18nRoot?: string | null;
}

/** Pack files listed for game #1: `content/mishana/index.ts` (P layout), else the old flat `content/index.ts`. */
function registeredMishana(contentRoot: string): string[] | null {
  const gameIndex = readOrNull(join(contentRoot, GAME1_DIR, "index.ts"));
  if (gameIndex !== null) return registeredGameFiles(gameIndex, GAME1_DIR);
  const rootIndex = readOrNull(join(contentRoot, "index.ts"));
  return rootIndex === null ? null : registeredPackFiles(rootIndex);
}

export function lintDirectory(contentRoot: string, opts: DirectoryOptions = {}): LintResult {
  const result = lintPacks(readPackEntries(contentRoot), registeredMishana(contentRoot), opts);
  const add = (f: { errors: string[]; warnings: string[] }): void => {
    result.errors.push(...f.errors);
    result.warnings.push(...f.warnings);
  };
  // Per-game registry (§5.1, §6.1), in the P layout only.
  if (existsSync(join(contentRoot, GAME1_DIR, "index.ts"))) {
    add(lintRootIndex(readOrNull(join(contentRoot, "index.ts")) ?? ""));
    for (const id of GAME_IDS) {
      if (id === GAME1_DIR) continue;
      const src = readOrNull(join(contentRoot, id, "index.ts"));
      if (src === null) {
        result.errors.push(`content/${id}/index.ts is missing (P creates every game's registry, §6.1)`);
        continue;
      }
      for (const f of unlistedFiles(jsonFiles(contentRoot, id), registeredGameFiles(src, id))) result.warnings.push(`${f}: not listed in content/${id}/index.ts (it will not ship)`);
    }
  }
  const i18nDir = opts.i18nRoot === undefined ? join(contentRoot, "../shared/i18n") : opts.i18nRoot;
  const root = i18nDir === null ? null : readI18n(i18nDir);
  const vocabText = readOrNull(join(contentRoot, "vocab.json"));
  if (vocabText !== null) add(lintVocab(JSON.parse(vocabText) as unknown, root));
  if (root !== null && i18nDir !== null) {
    const games: Partial<Record<GameId, I18nFiles>> = {};
    for (const id of GAME_IDS) {
      const g = readI18n(join(i18nDir, "games", id));
      if (g) games[id] = g;
    }
    add(lintGameI18n(root, games));
  }
  return result;
}

/** §5.6: writes every registered pack of a lint-clean tree as minified JSON to `<outDir>/<game>/<id>.txt`. */
export function emitContent(contentRoot: string, outDir: string): string[] {
  const registered = new Set(registeredMishana(contentRoot) ?? []);
  const written: string[] = [];
  for (const id of GAME_IDS) {
    const dir = join(outDir, id);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
  for (const e of readPackEntries(contentRoot)) {
    if (!registered.has(e.file) || e.data === null) continue;
    const packId = (e.data as { id: string }).id;
    const rel = `${GAME1_DIR}/${packId}.txt`;
    writeFileSync(join(outDir, rel), JSON.stringify(e.data), "utf8");
    written.push(rel);
  }
  // SPEC-GAP: bluff/likely/trivia packs are emitted once their G milestone adds a ContentAdapter-based reader here.
  return written;
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const quiet = args.includes("--quiet");
  const dirIdx = args.indexOf("--dir");
  const root = dirIdx >= 0 && args[dirIdx + 1] ? resolve(args[dirIdx + 1] as string) : resolve(dirname(fileURLToPath(import.meta.url)), "../../../content");
  const { errors, warnings, counts } = lintDirectory(root, { release: args.includes("--release") });
  const outIdx = args.indexOf("--out");
  const out = outIdx >= 0 && args[outIdx + 1] ? resolve(args[outIdx + 1] as string) : resolve(root, "../server/content-dist");
  if (!quiet) for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  console.log(`content-lint: pairs en=${counts.en ?? 0} fr=${counts.fr ?? 0} ar=${counts.ar ?? 0} (ar-LB=${counts["ar-LB"] ?? 0}) es=${counts.es ?? 0}; ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length > 0) process.exitCode = 1;
  else if (args.includes("--emit")) console.log(`content-lint --emit: wrote ${emitContent(root, out).length} pack(s) to ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
