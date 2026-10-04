import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/args";
import { realCatalog } from "../src/catalog";
import { formatTable, runEngineMode } from "../src/engine-mode";

describe("sim", () => {
  it("parses arguments", () => {
    expect(parseArgs([])).toMatchObject({ players: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], games: 200, seed: 1, winRule: "official", tieBreak: "random", ws: null });
    expect(parseArgs(["--players", "4", "--games=3", "--win-rule", "parity", "--tie-break", "none", "--verbose"])).toMatchObject({
      players: [4], games: 3, winRule: "parity", tieBreak: "none", verbose: true,
    });
    expect(parseArgs(["--", "--players", "3..5"]).players).toEqual([3, 4, 5]);
    expect(() => parseArgs(["--players", "2"])).toThrow();
    expect(() => parseArgs(["--games", "0"])).toThrow();
    expect(() => parseArgs(["--win-rule", "x"])).toThrow();
    expect(() => parseArgs(["--bogus"])).toThrow();
    expect(parseArgs([]).access).toBe("premium");
    expect(parseArgs(["--access", "free"]).access).toBe("free");
    expect(() => parseArgs(["--access", "gold"])).toThrow();
  });
  it("runs a few engine-mode games on the real catalog without failures", { timeout: 60_000 }, () => {
    const rows = runEngineMode(realCatalog(), { players: [3, 7, 12], games: 10, seed: 1, winRule: "official", tieBreak: "random", ws: null, verbose: false, access: "premium" }, () => {});
    expect(rows.flatMap((r) => r.failures)).toEqual([]);
    expect(rows.every((r) => r.games === 10)).toBe(true);
    expect(formatTable(rows)).toContain("avg rounds");
  });
  it("free access (PAYMENTS-SPEC §3.11): games run on the free starter packs only, with locked-pack metadata in views", { timeout: 60_000 }, () => {
    const rows = runEngineMode(realCatalog(), { players: [3, 8, 12], games: 10, seed: 2, winRule: "official", tieBreak: "random", ws: null, verbose: false, access: "free" }, () => {});
    expect(rows.flatMap((r) => r.failures)).toEqual([]);
  });
});
