// JAMAA-PLATFORM §2.9 / §6.6: Likely engine mode for `pnpm sim --game likely`. Seeded bot games straight through the
// GameDefinition (shared/src/testing/bots/likely.ts) on the REAL packs in every content language: random votes
// (self-votes, changes, herding), host skips/advances/END_GAME, AWAY/BACK/GONE churn, late joins and noise intents, in
// public and secret-vote modes, at the deadline pace and the eager pace. After EVERY reduce: invariants, the leak oracles
// on the TV view and every phone's view, monotone scores, family never dealing Spicy; termination at RESULTS; with
// `--access free`, that no Pass card is ever drawn. Spicy games run on the Spicy-enabled test definition (the shipped
// one keeps it compiled out, GAME-LIKELY §9.1).
//
// `pnpm sim --game likely …` routes here (tools/sim/src/main.ts, G3 review); the module also runs on its own:
//   pnpm --filter @jamaa/sim exec tsx src/games/likely.ts --players 3..12 --games 300 [--seed N] [--access free]
import { fileURLToPath } from "node:url";
import { LOCALES } from "@jamaa/shared/constants";
import type { Locale } from "@jamaa/shared/constants";
import { GAME_CONTENT } from "@jamaa/shared/games/registry";
// JAMAA-GAP (G3): shared/package.json exports neither games/likely/engine nor testing/bots/<id> (P files); relative
// imports until the P seam adds `./testing/*`.
import type { LikelyCatalog, LikelyPack } from "../../../../shared/src/games/likely/engine/catalog";
import { resultTally } from "../../../../shared/src/games/likely/engine/reduce";
import { playLikelyGame } from "../../../../shared/src/testing/bots/likely";
import { likelyTokenCatalog } from "../../../../shared/src/testing/catalogs/likely";
import { realContent } from "../catalog";
import type { SimArgs } from "../args";
import { parseArgs, playersFor } from "../args";
import { formatColumns, reportFailures } from "../format";

export interface LikelySimRow {
  players: number; games: number; cards: number; chaos: number; unanimous: number; named: number; skips: number; joins: number;
  steps: number; failures: string[];
}

/** The packs to play: the real content (free cards only with `--access free`), else the synthetic catalog. */
export function likelySimCatalog(access: SimArgs["access"]): { catalog: LikelyCatalog; source: string } {
  let real: LikelyCatalog | null = null;
  try {
    real = realContent().likely as unknown as LikelyCatalog;
  } catch (e) {
    console.error(`likely: content failed to load (${e instanceof Error ? e.message : String(e)}); using the synthetic catalog`);
  }
  const base = real && real.packs.length > 0 ? { catalog: real, source: "content/likely" } : { catalog: likelyTokenCatalog(), source: "synthetic token catalog" };
  if (access === "premium") return base;
  const packs = base.catalog.packs.map((p) => GAME_CONTENT.likely.playable(p, { premium: false, ownedFamilies: new Set() }) as LikelyPack | null).filter((p): p is LikelyPack => p !== null);
  return { catalog: { packs }, source: `${base.source}, free cards only` };
}

export function runLikelyEngineMode(args: Pick<SimArgs, "players" | "games" | "seed" | "access" | "verbose">, catalog: LikelyCatalog): LikelySimRow[] {
  const passIds = new Set(catalog.packs.flatMap((p) => p.cards.filter((c) => c.tier === "pass").map((c) => c.id)));
  const spicyPlayable = catalog.packs.some((p) => p.ageRating === "adult");
  const rows: LikelySimRow[] = [];
  for (const players of args.players) {
    const row: LikelySimRow = { players, games: 0, cards: 0, chaos: 0, unanimous: 0, named: 0, skips: 0, joins: 0, steps: 0, failures: [] };
    for (let k = 0; k < args.games; k++) {
      const seed = (args.seed * 1_000_003 + players * 10_007 + k) >>> 0;
      const locale = LOCALES[k % LOCALES.length] as Locale;
      const spicy = spicyPlayable && k % 4 === 3;
      const r = playLikelyGame({
        players, seed, content: catalog, locale, spicy,
        pace: k % 2 === 0 ? "clock" : "eager",
        settings: { length: (["short", "normal", "long"] as const)[k % 3], showVoters: Math.floor(k / 2) % 2 === 0, mode: spicy ? "spicy" : "family" },
        disconnectedAtStart: Math.min(k % 3, players - 3),
      });
      row.games++;
      row.steps += r.steps.length;
      row.skips += r.skips;
      row.joins += r.joins;
      const s = r.final;
      if (s) {
        row.cards += s.results.length;
        row.named += s.results.filter((x) => x.named !== null).length;
        for (const res of s.results) {
          const t = resultTally(s, res);
          if (t.chaos) row.chaos++;
          if (t.unanimous) row.unanimous++;
        }
        if (args.access === "free") for (const res of s.results) if (passIds.has(res.cardId)) row.failures.push(`likely players=${players} seed=${seed}: Pass card ${res.cardId} drawn in a free room`);
      }
      if (r.failure) row.failures.push(`likely players=${players} seed=${seed} locale=${locale}: ${r.failure}`);
      if (args.verbose) console.log(`players ${players} game ${k + 1}: ${r.failure ?? "ok"} (${r.steps.length} steps)`);
    }
    rows.push(row);
  }
  return rows;
}

export function formatLikelyTable(rows: readonly LikelySimRow[]): string {
  return formatColumns(
    ["players", "games", "cards", "chaos", "unanimous", "named", "skips", "late joins", "avg steps", "failures"],
    rows.map((r) => [r.players, r.games, r.cards, r.chaos, r.unanimous, r.named, r.skips, r.joins, r.games ? Math.round(r.steps / r.games) : 0, r.failures.length].map(String)),
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
  const players = playersFor(args.players, 3, 12);
  if (players.length === 0) {
    console.error(`likely: no player count in ${args.players.join(",")} within 3..12`);
    return 2;
  }
  const { catalog, source } = likelySimCatalog(args.access);
  const t0 = Date.now();
  const rows = runLikelyEngineMode({ ...args, players }, catalog);
  console.log(`engine mode · likely · access ${args.access} · ${source} · seed ${args.seed} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(formatLikelyTable(rows));
  if (reportFailures(rows)) return 1;
  console.log("\nOK: zero invariant, termination, leak, score or locked-card failures");
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main();
