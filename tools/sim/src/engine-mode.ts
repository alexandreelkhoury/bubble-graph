// Engine mode (§13.1): seeded bot games straight through `reduce`, invariants + leak checks after every step.
import type { Catalog } from "@mishana/shared/engine";
import { playableCatalog } from "@mishana/shared/billing";
import { countRoles, effectiveRoleCounts } from "@mishana/shared/engine";
import type { ViewAccess } from "@mishana/shared/projection";
// The bot driver and the leak checker are the ones the @mishana/shared tests use (one implementation).
import { findLeaks, playGame } from "@mishana/shared/testing";
import type { SimArgs } from "./args";
import { formatColumns } from "./format";

export interface RowStats {
  n: number;
  games: number;
  rounds: number;
  civilians: number;
  infiltrators: number;
  blank: number;
  stalemates: number;
  failures: string[];
}

export function gameSeed(base: number, n: number, g: number): number {
  return (Math.imul(base, 1_000_003) + n * 10_007 + g) >>> 0;
}

/**
 * `catalog` is the full catalog. With `--access free` the games run on the free playable catalog (PAYMENTS-SPEC §3.11)
 * and the projections get the full catalog only for locked-pack metadata; otherwise the full catalog = Premium.
 */
export function runEngineMode(catalog: Catalog, args: SimArgs, log: (line: string) => void = console.log): RowStats[] {
  const rows: RowStats[] = [];
  const free = args.access === "free";
  const playable = free ? playableCatalog(catalog, false, new Set()) : catalog;
  const playableIds = new Set(playable.packs.map((p) => p.id));
  const access: ViewAccess = { premium: !free, fullCatalog: catalog, tvBusy: false };
  for (const n of args.players) {
    const row: RowStats = { n, games: 0, rounds: 0, civilians: 0, infiltrators: 0, blank: 0, stalemates: 0, failures: [] };
    for (let g = 0; g < args.games; g++) {
      const seed = gameSeed(args.seed, n, g);
      const fail = (msg: string): void => {
        row.failures.push(`n=${n} game=${g} seed=${seed}: ${msg}`);
      };
      try {
        const out = playGame(
          playable,
          { players: n, seed, settings: { winRule: args.winRule, tieBreak: args.tieBreak } },
          (prev, action, res) => {
            if (action.type === "START" && res.ok) {
              const expected = effectiveRoleCounts(prev.settings, prev.players.length);
              const actual = countRoles(res.state.players);
              if (JSON.stringify(actual) !== JSON.stringify(expected) || JSON.stringify(res.state.roleCounts) !== JSON.stringify(expected)) {
                throw new Error("role-count mismatch");
              }
            }
            const leaks = findLeaks(res.state, playable, access);
            if (leaks.length > 0) throw new Error(`secret leak after ${action.type}: ${leaks.slice(0, 3).join("; ")}`);
            if (res.state.pair && !playableIds.has(res.state.pair.packId)) throw new Error(`locked pack ${res.state.pair.packId} was picked`);
          },
        );
        row.games++;
        row.rounds += out.rounds;
        if (out.failure) fail(out.failure);
        else if (out.stalemate) row.stalemates++;
        else if (out.winner === "CIVILIANS") row.civilians++;
        else if (out.winner === "INFILTRATORS") row.infiltrators++;
        else if (out.winner === "BLANK") row.blank++;
        else fail("game ended without a result");
        if (args.verbose) log(`n=${n} game=${g} seed=${seed} rounds=${out.rounds} actions=${out.log.length} winner=${out.winner ?? (out.stalemate ? "stalemate" : "-")}`);
      } catch (e) {
        row.games++;
        fail(e instanceof Error ? e.message : String(e));
      }
    }
    rows.push(row);
  }
  return rows;
}

export function formatTable(rows: RowStats[]): string {
  const pct = (x: number, total: number): string => (total ? ((100 * x) / total).toFixed(1) + "%" : "-");
  const header = ["n", "games", "avg rounds", "civilians", "infiltrators", "blank", "blank-guess wins", "stalemates", "failures"];
  const lines = rows.map((r) => [
    String(r.n), String(r.games), r.games ? (r.rounds / r.games).toFixed(2) : "-",
    pct(r.civilians, r.games), pct(r.infiltrators, r.games), pct(r.blank, r.games), String(r.blank), String(r.stalemates), String(r.failures.length),
  ]);
  return formatColumns(header, lines);
}
