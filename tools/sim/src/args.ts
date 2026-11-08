import { GAME_IDS } from "@jamaa/shared/games/ids";
import type { GameId } from "@jamaa/shared/games/ids";

export interface SimArgs {
  /** JAMAA-PLATFORM §2.9: which game(s); "all" runs every registered game (stubs are reported as skipped). */
  game: GameId | "all";
  players: number[];
  games: number;
  seed: number;
  winRule: "official" | "parity";
  tieBreak: "random" | "none";
  ws: string | null;
  verbose: boolean;
  /**
   * PAYMENTS-SPEC §3.11 room access: "premium" plays the full catalog (equivalent to a Pass room, the default); "free"
   * plays the free starter packs only and also checks that no locked pack is ever picked.
   */
  access: "premium" | "free";
  /** §2.9: play rooms through hub → game → replay or back to hub (about 10 games per room) and check the cup. */
  session: boolean;
}

/**
 * Parses `--game mishana|bluff|likely|trivia|all --players 1..12|N --games N --seed N --win-rule official|parity
 * --tie-break random|none --access premium|free --session --ws URL --verbose`.
 */
export function parseArgs(argv: readonly string[]): SimArgs {
  const out: SimArgs = { game: "mishana", players: range(3, 12), games: 200, seed: 1, winRule: "official", tieBreak: "random", ws: null, verbose: false, access: "premium", session: false };
  const args = argv.filter((a) => a !== "--");
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    const [flag, inline] = a.includes("=") ? (a.split(/=(.*)/s, 2) as [string, string]) : [a, undefined];
    const value = (): string => {
      const v = inline ?? args[++i];
      if (v === undefined) throw new Error(`missing value for ${flag}`);
      return v;
    };
    switch (flag) {
      case "--game": {
        const v = value();
        if (v !== "all" && !(GAME_IDS as readonly string[]).includes(v)) throw new Error(`--game must be ${GAME_IDS.join("|")}|all, got ${v}`);
        out.game = v as GameId | "all";
        break;
      }
      case "--players": {
        const v = value();
        const m = /^(\d+)\.\.(\d+)$/.exec(v);
        out.players = m ? range(Number(m[1]), Number(m[2])) : [Number(v)];
        if (out.players.length === 0 || out.players.some((n) => !Number.isInteger(n) || n < 1 || n > 12)) throw new Error(`--players must be within 1..12, got ${v}`);
        break;
      }
      case "--games": out.games = positiveInt(value(), "--games"); break;
      case "--seed": out.seed = positiveInt(value(), "--seed", true); break;
      case "--win-rule": {
        const v = value();
        if (v !== "official" && v !== "parity") throw new Error(`--win-rule must be official|parity, got ${v}`);
        out.winRule = v;
        break;
      }
      case "--tie-break": {
        const v = value();
        if (v !== "random" && v !== "none") throw new Error(`--tie-break must be random|none, got ${v}`);
        out.tieBreak = v;
        break;
      }
      case "--access": {
        const v = value();
        if (v !== "premium" && v !== "free") throw new Error(`--access must be premium|free, got ${v}`);
        out.access = v;
        break;
      }
      case "--session": out.session = true; break;
      case "--ws": out.ws = value(); break;
      case "--verbose": out.verbose = true; break;
      default: throw new Error(`unknown argument ${a}`);
    }
  }
  return out;
}

/** The player counts of `args.players` that `game` accepts (min/max players from its meta). */
export function playersFor(players: readonly number[], min: number, max: number): number[] {
  return players.filter((n) => n >= min && n <= max);
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let n = a; n <= b; n++) out.push(n);
  return out;
}

function positiveInt(v: string, flag: string, allowZero = false): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < (allowZero ? 0 : 1)) throw new Error(`${flag} must be a ${allowZero ? "non-negative" : "positive"} integer, got ${v}`);
  return n;
}
