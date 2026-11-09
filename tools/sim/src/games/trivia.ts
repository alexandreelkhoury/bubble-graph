// JAMAA-PLATFORM §2.9 / §6.7: Trivia engine mode for `pnpm sim --game trivia`. Seeded bot games straight through the
// GameDefinition (shared/src/testing/bots/trivia.ts) on the REAL quizzes in every content language: random answers
// with random latencies (some past the deadline), host skips/voids/ends, AWAY/BACK/GONE churn, late joins and noise
// intents. After every reduce: invariants, the scoring checks, and the leak oracles on the TV view and every phone's
// view; termination; with `--access free`, that no Pass-only quiz is ever played.
//
// JAMAA-GAP (G4): tools/sim/src/main.ts (milestone P file) still routes only mishana to an engine-mode bot; until it
// imports `runTriviaEngineMode`, run this module directly:
//   pnpm --filter @jamaa/sim exec tsx src/games/trivia.ts --players 1..12 --games 300 [--seed N] [--access free]
import { fileURLToPath } from "node:url";
import { LOCALES } from "@jamaa/shared/constants";
import type { Locale } from "@jamaa/shared/constants";
import { GAME_CONTENT } from "@jamaa/shared/games/registry";
// JAMAA-GAP (G4): shared/package.json exports neither games/trivia/engine nor testing/bots/<id> (P files); relative
// imports until the P seam adds `./testing/*`.
import type { TriviaCatalog, TriviaPack } from "../../../../shared/src/games/trivia/engine/types";
import { playTrivia } from "../../../../shared/src/testing/bots/trivia";
import { TRIVIA_SYNTH_CATALOG } from "../../../../shared/src/testing/catalogs/trivia";
import { realContent } from "../catalog";
import type { SimArgs } from "../args";
import { parseArgs, playersFor } from "../args";
import { formatColumns, reportFailures } from "../format";

export interface TriviaSimRow {
  players: number; games: number; questions: number; endGame: number; voided: number; joins: number; lateRefused: number;
  steps: number; failures: string[];
}

/** The quizzes to play: the real content (free quizzes only with `--access free`), else the synthetic catalog. */
export function triviaSimCatalog(access: SimArgs["access"]): { catalog: TriviaCatalog; source: string } {
  let real: TriviaCatalog | null = null;
  try {
    real = realContent().trivia as unknown as TriviaCatalog;
  } catch (e) {
    console.error(`content failed to load (${e instanceof Error ? e.message : String(e)}); using the synthetic catalog`);
  }
  const base = real && real.packs.length > 0 ? { catalog: real, source: "content/trivia" } : { catalog: TRIVIA_SYNTH_CATALOG, source: "synthetic token catalog" };
  if (access === "premium") return base;
  const packs = base.catalog.packs.map((p) => GAME_CONTENT.trivia.playable(p, { premium: false, ownedFamilies: new Set() }) as TriviaPack | null).filter((p): p is TriviaPack => p !== null);
  return { catalog: { packs }, source: `${base.source}, free quizzes only` };
}

export function runTriviaEngineMode(args: Pick<SimArgs, "players" | "games" | "seed" | "access" | "verbose">, catalog: TriviaCatalog, log: (line: string) => void = console.log): TriviaSimRow[] {
  const locales = LOCALES.filter((l) => catalog.packs.some((p) => (p.locale === "ar-LB" ? "ar" : p.locale) === l));
  const families = [...new Set(catalog.packs.map((p) => p.family ?? p.id))];
  const premiumFamilies = new Set(catalog.packs.filter((p) => p.tier !== "free").map((p) => p.family ?? p.id));
  const rows: TriviaSimRow[] = [];
  for (const players of args.players) {
    const row: TriviaSimRow = { players, games: 0, questions: 0, endGame: 0, voided: 0, joins: 0, lateRefused: 0, steps: 0, failures: [] };
    for (let k = 0; k < args.games; k++) {
      const seed = (args.seed * 1_000_003 + players * 10_007 + k) >>> 0;
      const locale = locales[k % locales.length] as Locale;
      const fam = k % 3 === 0 ? null : families[k % families.length] ?? null;
      const quizId = fam !== null && catalog.packs.some((p) => (p.family ?? p.id) === fam && p.locale === locale) ? fam : null;
      const run = playTrivia({
        players, seed, content: catalog, locale,
        settings: { quizId, length: (["short", "normal", "long"] as const)[k % 3], pace: (["relaxed", "normal", "fast"] as const)[(k >> 1) % 3] },
        advanceRate: [0, 0.3, 1][k % 3], awayRate: [0.01, 0.05][k % 2], joinRate: players < 12 ? 0.01 : 0,
      });
      const fail = (m: string) => row.failures.push(`players=${players} game=${k} seed=${seed} locale=${locale}: ${m}`);
      row.games++;
      row.steps += run.steps.length;
      if (run.failure) { fail(run.failure); continue; }
      const s = run.final;
      if (args.access === "free" && premiumFamilies.has(s.quiz.id)) fail(`played the Pass-only quiz ${s.quiz.id} in a free room`);
      row.questions += s.shown;
      if (run.ended === "endGame") row.endGame++;
      row.voided += s.voidedQuestionIds.length;
      row.joins += run.steps.filter((x) => x.action.type === "JOIN" && x.ok).length;
      row.lateRefused += run.steps.filter((x) => x.action.type === "INTENT" && x.action.intent.type === "ANSWER" && x.error === "WRONG_PHASE").length;
      if (args.verbose) log(`players=${players} game=${k} seed=${seed} ${locale} quiz=${s.quiz.id} questions=${s.shown} steps=${run.steps.length} ended=${run.ended}`);
    }
    rows.push(row);
  }
  return rows;
}

export function formatTriviaTable(rows: TriviaSimRow[]): string {
  return formatColumns(
    ["players", "games", "avg questions", "host ended", "voided", "late joins", "late taps refused", "avg steps", "failures"],
    rows.map((r) => [
      String(r.players), String(r.games), r.games ? (r.questions / r.games).toFixed(2) : "-", String(r.endGame), String(r.voided),
      String(r.joins), String(r.lateRefused), r.games ? (r.steps / r.games).toFixed(0) : "-", String(r.failures.length),
    ]),
  );
}

function main(): number {
  let args: SimArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const players = playersFor(args.players, 1, 12);
  if (players.length === 0) { console.error("no player count within 1..12"); return 2; }
  const { catalog, source } = triviaSimCatalog(args.access);
  const t0 = Date.now();
  const rows = runTriviaEngineMode({ ...args, players }, catalog);
  console.log(`engine mode · trivia · ${source} · access ${args.access} · seed ${args.seed} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(formatTriviaTable(rows));
  if (reportFailures(rows)) return 1;
  console.log("\nOK: zero invariant, scoring, termination, leak or locked-quiz failures");
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main();
