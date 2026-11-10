// pnpm sim [--game mishana|bluff|likely|trivia|all] [--players 1..12|N] [--games N=200] [--seed N=1]
//          [--win-rule official|parity] [--tie-break random|none] [--access premium|free] [--session] [--ws URL] [--verbose]
// JAMAA-PLATFORM §2.9. Without --session/--ws: seeded bot games of each selected game straight through its engine.
import { GAME_IDS } from "@jamaa/shared/games/ids";
import type { GameId } from "@jamaa/shared/games/ids";
import { GAME_DEFS } from "@jamaa/shared/games/registry";
import { parseArgs, playersFor } from "./args";
import { realContent } from "./catalog";
import { formatTable, runEngineMode } from "./engine-mode";
import { reportFailures } from "./format";
import { formatSessionTable, runSessionMode } from "./session-mode";
import { formatLikelyTable, likelySimCatalog, runLikelyEngineMode } from "./games/likely";
import { formatTriviaTable, runTriviaEngineMode, triviaSimCatalog } from "./games/trivia";
import { formatWsTable, runWsMode } from "./ws-mode";

async function main(): Promise<number> {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
  if (args.ws) {
    const t0 = Date.now();
    let rows;
    try {
      rows = await runWsMode(args);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      return 1;
    }
    console.log(`ws mode (protocol v2) · ${args.ws} · win-rule ${args.winRule} · tie-break ${args.tieBreak} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    console.log(formatWsTable(rows));
    if (reportFailures(rows)) return 1;
    console.log("\nOK: every game finished over protocol v2 through the hub, resume restored the seat, a late joiner was benched then dealt in, TV and phone views leaked nothing, the Blank never opened a pass");
    return 0;
  }
  if (args.session) {
    const t0 = Date.now();
    const s = runSessionMode(realContent(), args);
    console.log(`session mode · game ${args.game} · access ${args.access} · seed ${args.seed} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    console.log(formatSessionTable(s));
    if (reportFailures([s])) return 1;
    console.log("\nOK: zero room-invariant, termination, leak, locked-pack or cup-arithmetic failures");
    return 0;
  }
  const ids: GameId[] = args.game === "all" ? [...GAME_IDS] : [args.game];
  let failed = false;
  for (const id of ids) {
    const def = GAME_DEFS[id];
    if (!def.enabled) {
      // `--game all` skips the stubs; a game named explicitly that cannot run is a failure, never an "OK" (G3 review).
      if (args.game === "all") console.log(`${id}: a stub until its G milestone (enabled: false), skipped`);
      else {
        console.error(`${id}: registry-disabled (enabled: false): nothing was played`);
        failed = true;
      }
      continue;
    }
    if (id === "trivia") {
      // JAMAA-PLATFORM §6.7: Trivia's engine-mode bot (tools/sim/src/games/trivia.ts), 1..12 players.
      const players = playersFor(args.players, def.meta.minPlayers, def.meta.maxPlayers);
      if (players.length === 0) {
        console.error(`${id}: no player count in ${args.players.join(",")} within ${def.meta.minPlayers}..${def.meta.maxPlayers}`);
        failed = true;
        continue;
      }
      const { catalog, source } = triviaSimCatalog(args.access);
      const t0 = Date.now();
      const rows = runTriviaEngineMode({ ...args, players }, catalog);
      console.log(`engine mode · ${id} · ${source} · access ${args.access} · seed ${args.seed} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      console.log(formatTriviaTable(rows));
      if (reportFailures(rows)) failed = true;
      continue;
    }
    if (id === "likely") {
      // JAMAA-PLATFORM §6.6: Likely's engine-mode bot (tools/sim/src/games/likely.ts), 3..12 players.
      const players = playersFor(args.players, def.meta.minPlayers, def.meta.maxPlayers);
      if (players.length === 0) {
        console.error(`${id}: no player count in ${args.players.join(",")} within ${def.meta.minPlayers}..${def.meta.maxPlayers}`);
        failed = true;
        continue;
      }
      const { catalog, source } = likelySimCatalog(args.access);
      const t0 = Date.now();
      const rows = runLikelyEngineMode({ ...args, players }, catalog);
      console.log(`engine mode · ${id} · ${source} · access ${args.access} · seed ${args.seed} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      console.log(formatLikelyTable(rows));
      if (reportFailures(rows)) failed = true;
      continue;
    }
    if (id !== "mishana") {
      console.error(`${id}: no engine-mode bot yet (tools/sim/src/games/${id}.ts arrives with its G milestone)`);
      failed = true;
      continue;
    }
    const players = playersFor(args.players, Math.max(3, def.meta.minPlayers), def.meta.maxPlayers);
    if (players.length === 0) {
      console.error(`${id}: no player count in ${args.players.join(",")} within ${def.meta.minPlayers}..${def.meta.maxPlayers}`);
      failed = true;
      continue;
    }
    const t0 = Date.now();
    const rows = runEngineMode(realContent().mishana, { ...args, players });
    console.log(`engine mode · ${id} · access ${args.access} · win-rule ${args.winRule} · tie-break ${args.tieBreak} · seed ${args.seed} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    console.log(formatTable(rows));
    if (reportFailures(rows)) failed = true;
  }
  if (failed) return 1;
  console.log("\nOK: zero invariant, termination, role-count or leak failures");
  return 0;
}

process.exitCode = await main();
