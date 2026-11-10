// JAMAA-PLATFORM §2.9 / §6.5: Bluff engine mode for `pnpm sim --game bluff`. Seeded bot games straight through the
// engine (shared/src/testing/bots/bluff.ts): invariants, leak oracles, monotone scores and termination after every
// reduce; with `--access free`, that no Pass item is ever drawn.
//
// JAMAA-GAP (G2, review finding): tools/sim/src/main.ts (milestone P file, outside the G2 lane) routes only mishana
// to an engine-mode bot and SKIPS a registry-disabled game, then prints "OK" — so `pnpm sim --game bluff` is a FALSE
// PASS that never plays Bluff. Platform follow-up: main.ts calls `runBluffEngineMode` for "bluff" (even while it is
// registry-disabled) or fails loudly. Until then the G2 acceptance command is this module, run directly:
//   pnpm --filter @jamaa/sim exec tsx src/games/bluff.ts --players 3..12 --games 300 [--seed N] [--access free]
// `--players` also takes a comma list here (`--players 3,12`).
import { fileURLToPath } from "node:url";
import { GAME_CONTENT, GAME_DEFS } from "@jamaa/shared/games/registry";
// JAMAA-GAP (G2): shared/package.json exports neither games/bluff/engine nor testing/bots/<id> (P files); relative
// imports until the P seam adds `./testing/*`.
import type { BluffCatalog } from "../../../../shared/src/games/bluff/engine/catalog";
import { runBluffBotGame } from "../../../../shared/src/testing/bots/bluff";
import { bluffTokenCatalog } from "../../../../shared/src/testing/catalogs/bluff";
import { realContent } from "../catalog";
import type { SimArgs } from "../args";
import { parseArgs, playersFor } from "../args";
import { formatColumns, reportFailures } from "../format";

export interface BluffSimRow { players: number; games: number; prompts: number; holds: number; joins: number; voided: number; swaps: number; steps: number; failures: string[] }

/** The catalog to play: the real Bluff packs when they can fill a Normal game in EN, else the synthetic catalog. */
export function bluffSimCatalog(real: BluffCatalog | null, access: SimArgs["access"]): { catalog: BluffCatalog; source: string } {
  const roster = [0, 1, 2].map((i) => ({ id: `p${i}`, seat: i, locale: "en" as const, connected: true, carryScore: 0 }));
  const playable = real !== null && GAME_DEFS.bluff.startBlocker(roster, GAME_DEFS.bluff.meta.settings.defaults, real, "en") === null;
  const base = real && playable ? { catalog: real, source: "content/bluff" } : { catalog: bluffTokenCatalog(), source: "synthetic token catalog (content/bluff has no playable EN game yet)" };
  if (access === "premium") return base;
  const packs = base.catalog.packs.map((p) => GAME_CONTENT.bluff.playable(p, { premium: false, ownedFamilies: new Set() })).filter((p): p is BluffCatalog["packs"][number] => p !== null);
  return { catalog: { packs }, source: `${base.source}, free items only` };
}

export function runBluffEngineMode(args: Pick<SimArgs, "players" | "games" | "seed" | "access" | "verbose">, catalog: BluffCatalog): BluffSimRow[] {
  const passIds = new Set(catalog.packs.flatMap((p) => p.items.filter((i) => i.tier === "pass").map((i) => i.id)));
  const rows: BluffSimRow[] = [];
  for (const players of args.players) {
    const row: BluffSimRow = { players, games: 0, prompts: 0, holds: 0, joins: 0, voided: 0, swaps: 0, steps: 0, failures: [] };
    for (let k = 0; k < args.games; k++) {
      const seed = (args.seed * 1_000_003 + players * 10_007 + k) >>> 0;
      const r = runBluffBotGame({
        players, seed, catalog,
        timers: k % 2 === 0,
        settings: { length: (["short", "normal", "long"] as const)[k % 3], pace: (["relaxed", "normal", "fast"] as const)[Math.floor(k / 3) % 3] },
      });
      row.games++;
      row.steps += r.steps;
      row.prompts += r.final.records.length;
      row.holds += r.holds;
      row.joins += r.joins;
      row.voided += r.voided;
      row.swaps += r.swaps;
      if (r.failure) row.failures.push(`bluff players=${players} seed=${seed}: ${r.failure}`);
      if (args.access === "free") for (const id of r.final.drawn) if (passIds.has(id)) row.failures.push(`bluff players=${players} seed=${seed}: Pass item ${id} drawn in a free room`);
      if (args.verbose) console.log(`players ${players} game ${k + 1}: ${r.failure ?? "ok"} (${r.steps} steps)`);
    }
    rows.push(row);
  }
  return rows;
}

export function formatBluffTable(rows: readonly BluffSimRow[]): string {
  return formatColumns(
    ["players", "games", "prompts", "holds", "late joins", "voided", "too famous", "avg steps", "failures"],
    rows.map((r) => [r.players, r.games, r.prompts, r.holds, r.joins, r.voided, r.swaps, r.games ? Math.round(r.steps / r.games) : 0, r.failures.length].map(String)),
  );
}

/** `--players 3,12` (a comma list) on top of the shared parser's `N` and `A..B` forms. */
export function splitPlayersList(argv: readonly string[]): { argv: string[]; players: number[] | null } {
  const out = [...argv];
  const i = out.indexOf("--players");
  const v = i >= 0 ? out[i + 1] : undefined;
  if (v === undefined || !v.includes(",")) return { argv: out, players: null };
  const players = v.split(",").map((x) => Number(x.trim()));
  if (players.some((n) => !Number.isInteger(n) || n < 1 || n > 12)) throw new Error(`--players must be within 1..12, got ${v}`);
  out.splice(i, 2);
  return { argv: out, players: [...new Set(players)].sort((a, b) => a - b) };
}

function main(): number {
  let args: SimArgs;
  try {
    const split = splitPlayersList(process.argv.slice(2));
    args = parseArgs(split.argv);
    if (split.players) args = { ...args, players: split.players };
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const players = playersFor(args.players, 3, 12);
  if (players.length === 0) {
    console.error(`bluff: no player count in ${args.players.join(",")} within 3..12`);
    return 2;
  }
  let real: BluffCatalog | null = null;
  try {
    real = realContent().bluff as unknown as BluffCatalog;
  } catch (e) {
    console.error(`bluff: content/bluff did not load (${e instanceof Error ? e.message : String(e)}); using the synthetic catalog`);
  }
  const { catalog, source } = bluffSimCatalog(real, args.access);
  const t0 = Date.now();
  const rows = runBluffEngineMode({ ...args, players }, catalog);
  console.log(`engine mode · bluff · access ${args.access} · ${source} · seed ${args.seed} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(formatBluffTable(rows));
  if (reportFailures(rows)) return 1;
  console.log("\nOK: zero invariant, termination, leak, score or locked-item failures");
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main();
