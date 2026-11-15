// JAMAA-PLATFORM §2.9 / §6.6: Taqriban engine mode for `pnpm sim --game taqriban`. Seeded bot games straight through
// the GameDefinition (shared/src/testing/bots/taqriban.ts) on the REAL packs in every content language: guesses from
// spot-on to wildly off (ties, Bullseyes, Way off!), host skips/advances/END_GAME, AWAY/BACK/GONE churn, late joins and
// noise intents, at the deadline pace and the eager pace. After EVERY reduce: invariants, the leak oracles on the TV
// view and every phone's view, monotone scores; termination at RESULTS with an outcome.
import { LOCALES } from "@jamaa/shared/constants";
import type { Locale } from "@jamaa/shared/constants";
import { GAME_CONTENT } from "@jamaa/shared/games/registry";
import type { TaqribanCatalog, TaqribanPack } from "../../../../shared/src/games/taqriban/engine/types";
import { playTaqribanGame } from "../../../../shared/src/testing/bots/taqriban";
import { taqribanTokenCatalog } from "../../../../shared/src/testing/catalogs/taqriban";
import { realContent } from "../catalog";
import type { SimArgs } from "../args";
import { formatColumns } from "../format";

export interface TaqribanSimRow {
  players: number; games: number; questions: number; ties: number; bullseyes: number; wild: number; skips: number; joins: number;
  steps: number; failures: string[];
}

export function taqribanSimCatalog(access: SimArgs["access"]): { catalog: TaqribanCatalog; source: string } {
  let real: TaqribanCatalog | null = null;
  try {
    real = realContent().taqriban as unknown as TaqribanCatalog;
  } catch (e) {
    console.error(`taqriban: content failed to load (${e instanceof Error ? e.message : String(e)}); using the synthetic catalog`);
  }
  const base = real && real.packs.length > 0 ? { catalog: real, source: "content/taqriban" } : { catalog: taqribanTokenCatalog(), source: "synthetic token catalog" };
  if (access === "premium") return base;
  const packs = base.catalog.packs.map((p) => GAME_CONTENT.taqriban.playable(p, { premium: false, ownedFamilies: new Set() }) as TaqribanPack | null).filter((p): p is TaqribanPack => p !== null);
  return { catalog: { packs }, source: `${base.source}, free questions only` };
}

export function runTaqribanEngineMode(args: Pick<SimArgs, "players" | "games" | "seed" | "access" | "verbose">, catalog: TaqribanCatalog): TaqribanSimRow[] {
  const rows: TaqribanSimRow[] = [];
  for (const players of args.players) {
    const row: TaqribanSimRow = { players, games: 0, questions: 0, ties: 0, bullseyes: 0, wild: 0, skips: 0, joins: 0, steps: 0, failures: [] };
    for (let k = 0; k < args.games; k++) {
      const seed = (args.seed * 1_000_003 + players * 10_007 + k) >>> 0;
      const locale = LOCALES[k % LOCALES.length] as Locale;
      const r = playTaqribanGame({
        players, seed, content: catalog, locale, pace: k % 2 === 0 ? "clock" : "eager",
        settings: { length: (["short", "normal", "long"] as const)[k % 3], pace: (["relaxed", "normal", "fast"] as const)[Math.floor(k / 3) % 3] },
        disconnectedAtStart: Math.min(k % 3, players - 2),
      });
      row.games++;
      row.steps += r.steps;
      row.questions += r.questions;
      row.ties += r.ties;
      row.bullseyes += r.bullseyes;
      row.wild += r.wild;
      row.skips += r.skips;
      row.joins += r.joins;
      if (r.failure) row.failures.push(`taqriban players=${players} seed=${seed} locale=${locale}: ${r.failure}`);
      if (args.verbose) console.log(`players ${players} game ${k + 1}: ${r.failure ?? "ok"} (${r.steps} steps)`);
    }
    rows.push(row);
  }
  return rows;
}

export function formatTaqribanTable(rows: readonly TaqribanSimRow[]): string {
  return formatColumns(
    ["players", "games", "questions", "ties", "bullseyes", "way off", "skips", "late joins", "avg steps", "failures"],
    rows.map((r) => [r.players, r.games, r.questions, r.ties, r.bullseyes, r.wild, r.skips, r.joins, r.games ? Math.round(r.steps / r.games) : 0, r.failures.length].map(String)),
  );
}
