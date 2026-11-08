import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/args";
import { realCatalog } from "../src/catalog";
import { formatTable, runEngineMode } from "../src/engine-mode";
import { realContent } from "../src/catalog";
import { formatSessionTable, GAMES_PER_ROOM, runSessionMode } from "../src/session-mode";

describe("sim", () => {
  it("parses arguments", () => {
    expect(parseArgs([])).toMatchObject({ game: "mishana", players: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], games: 200, seed: 1, winRule: "official", tieBreak: "random", ws: null, session: false });
    expect(parseArgs(["--game", "all", "--session", "--players", "1..12"])).toMatchObject({ game: "all", session: true, players: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] });
    expect(parseArgs(["--game=trivia"]).game).toBe("trivia");
    expect(() => parseArgs(["--game", "chess"])).toThrow();
    expect(() => parseArgs(["--players", "13"])).toThrow();
    expect(parseArgs(["--players", "4", "--games=3", "--win-rule", "parity", "--tie-break", "none", "--verbose"])).toMatchObject({
      players: [4], games: 3, winRule: "parity", tieBreak: "none", verbose: true,
    });
    expect(parseArgs(["--", "--players", "3..5"]).players).toEqual([3, 4, 5]);
    expect(() => parseArgs(["--players", "0"])).toThrow();
    expect(() => parseArgs(["--games", "0"])).toThrow();
    expect(() => parseArgs(["--win-rule", "x"])).toThrow();
    expect(() => parseArgs(["--bogus"])).toThrow();
    expect(parseArgs([]).access).toBe("premium");
    expect(parseArgs(["--access", "free"]).access).toBe("free");
    expect(() => parseArgs(["--access", "gold"])).toThrow();
  });
  it("runs a few engine-mode games on the real catalog without failures", { timeout: 60_000 }, () => {
    const rows = runEngineMode(realCatalog(), { ...parseArgs([]), players: [3, 7, 12], games: 10, seed: 1 }, () => {});
    expect(rows.flatMap((r) => r.failures)).toEqual([]);
    expect(rows.every((r) => r.games === 10)).toBe(true);
    expect(formatTable(rows)).toContain("avg rounds");
  });
  it("free access (PAYMENTS-SPEC §3.11): games run on the free starter packs only, with locked-pack metadata in views", { timeout: 60_000 }, () => {
    const rows = runEngineMode(realCatalog(), { ...parseArgs([]), players: [3, 8, 12], games: 10, seed: 2, access: "free" }, () => {});
    expect(rows.flatMap((r) => r.failures)).toEqual([]);
  });
  it("session mode (JAMAA-PLATFORM §2.9): rooms through the hub, replays and returns, with cup arithmetic, premium and free", { timeout: 120_000 }, () => {
    for (const access of ["premium", "free"] as const) {
      const s = runSessionMode(realContent(), { ...parseArgs([]), session: true, games: 2 * GAMES_PER_ROOM, seed: 5, access }, () => {});
      expect(s.failures).toEqual([]);
      expect(s.rooms).toBe(2);
      expect(s.games).toBe(2 * GAMES_PER_ROOM);
      expect(s.replays + s.hubReturns).toBeGreaterThan(0);
      expect(formatSessionTable(s)).toContain("hub returns");
    }
  });
});
