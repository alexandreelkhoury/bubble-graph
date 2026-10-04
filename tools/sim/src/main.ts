// pnpm sim [--players 3..12|N] [--games N=200] [--seed N=1] [--win-rule official|parity] [--tie-break random|none]
//          [--access premium|free] [--ws URL] [--verbose]
import { parseArgs } from "./args";
import { realCatalog } from "./catalog";
import { formatTable, runEngineMode } from "./engine-mode";
import { reportFailures } from "./format";
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
    console.log(`ws mode · ${args.ws} · win-rule ${args.winRule} · tie-break ${args.tieBreak} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    console.log(formatWsTable(rows));
    if (reportFailures(rows)) return 1;
    console.log("\nOK: every game finished over the protocol, resume restored the seat, TV views passed §5.4");
    return 0;
  }
  const t0 = Date.now();
  const rows = runEngineMode(realCatalog(), args);
  console.log(`engine mode · access ${args.access} · win-rule ${args.winRule} · tie-break ${args.tieBreak} · seed ${args.seed} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(formatTable(rows));
  if (reportFailures(rows)) return 1;
  console.log("\nOK: zero invariant, termination, role-count or leak failures");
  return 0;
}

process.exitCode = await main();
