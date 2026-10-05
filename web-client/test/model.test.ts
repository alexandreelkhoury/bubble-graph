import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@mishana/shared/engine";
import type { PublicPlayer } from "@mishana/shared/protocol";
import { SETTINGS_SCHEMA, rowValueText, stepRow, toggleDifficulty, togglePack, visibleRows } from "../src/lib/settingsModel";
import { afterElimination, competitionRank, newForfeits, orderWindow, rankPlayers, tiedWithTally, topVoted } from "../src/lib/view";
import { ellipsizeName, graphemeCount } from "../src/lib/names";
import { nearest } from "../src/tv-mock/dpad";
import { displayInstallId, recreatesRoomOnFatal } from "../src/tv-mock/roomLife";

const P = (id: string, seat: number, score = 0): PublicPlayer => ({
  id, name: id, color: "coral", seat, connected: true, alive: true, left: false, isHost: false, ready: false, spoke: false,
  hasVoted: false, revealedRole: null, score,
});

describe("settings model (one source for PH-03b and TV-03)", () => {
  const s = { ...DEFAULT_SETTINGS, packIds: [], difficulties: [1, 2, 3] as (1 | 2 | 3)[], points: { ...DEFAULT_SETTINGS.points } };
  it("lists the TV-03 categories and hides Custom-only rows in Automatic", () => {
    expect(Object.keys(SETTINGS_SCHEMA)).toEqual(["game", "roles", "timers", "words"]);
    expect(visibleRows("roles", { ...s, roleMode: "auto" }).map((r) => r.id)).toEqual(["roleMode"]);
    expect(visibleRows("roles", { ...s, roleMode: "custom" }).map((r) => r.id)).toEqual(["roleMode", "undercoverCount", "blankCount"]);
  });
  it("steps every kind of row like the phone controls", () => {
    const row = (id: string) => Object.values(SETTINGS_SCHEMA).flat().find((r) => r.id === id)!;
    expect(stepRow(row("winRule"), s, 1)).toEqual({ winRule: s.winRule === "official" ? "parity" : "official" });
    expect(stepRow(row("blankGuess"), s, -1)).toEqual({ blankGuess: !s.blankGuess });
    expect(stepRow(row("clueSeconds"), { ...s, clueSeconds: 10 }, -1)).toEqual({ clueSeconds: 0 }); // min → off
    expect(stepRow(row("points.blank"), s, 1)).toEqual({ points: { ...s.points, blank: s.points.blank + 1 } });
    expect(stepRow(row("points.civilian"), { ...s, points: { ...s.points, civilian: 0 } }, -1)).toBeNull();
    expect(stepRow(row("packIds"), s, 1)).toBeNull();
    expect(rowValueText(row("packIds"), s)).toBe("All packs");
  });
  it("keeps at least one difficulty and toggles packs", () => {
    expect(toggleDifficulty({ ...s, difficulties: [2] }, 2)).toBeNull();
    expect(toggleDifficulty({ ...s, difficulties: [3] }, 1)).toEqual({ difficulties: [1, 3] });
    expect(togglePack({ ...s, packIds: ["a"] }, "a")).toEqual({ packIds: [] });
    expect(togglePack(s, "b")).toEqual({ packIds: ["b"] });
  });
});

describe("view helpers", () => {
  it("ranks equal totals together (competition ranking)", () => {
    const ps = rankPlayers([P("c", 2, 2), P("a", 0, 2), P("d", 3, 5), P("b", 1, 2)]);
    expect(ps.map((p) => p.id)).toEqual(["d", "a", "b", "c"]);
    expect(ps.map((p) => competitionRank(ps, p))).toEqual([1, 2, 2, 2]);
  });
  it("tied players with their tallies, and the top-voted in seat order", () => {
    const players = [P("a", 0), P("b", 1), P("c", 2)];
    const lastVote = { round: 1, revote: false, outcome: "TIE" as const, eliminatedId: null, abstainIds: [],
      tally: [{ targetId: "c", voterIds: ["a", "b"] }, { targetId: "a", voterIds: ["b", "c"] }, { targetId: "b", voterIds: ["a"] }] };
    expect(tiedWithTally({ players, tieCandidates: ["c", "a"], lastVote }).map((x) => [x.player.id, x.votes])).toEqual([["c", 2], ["a", 2]]);
    expect(topVoted({ players, lastVote }).map((p) => p.id)).toEqual(["a", "c"]);
  });
  it("finds new forfeits within one game only", () => {
    const players = [P("a", 0), P("b", 1)];
    const prev = { gameNumber: 1, history: [] };
    const next = { gameNumber: 1, players, history: [{ round: 1, eliminatedId: "b", role: "BLANK" as const, cause: "LEAVE" as const }] };
    expect(newForfeits(prev, next).map((f) => [f.player.id, f.role])).toEqual([["b", "BLANK"]]);
    expect(newForfeits(prev, { ...next, gameNumber: 2 })).toEqual([]);
  });
});

describe("what follows ELIMINATION (Kotlin afterElimination parity)", () => {
  const base = (over: Partial<Parameters<typeof afterElimination>[0]> = {}): Parameters<typeof afterElimination>[0] => ({
    phase: "ELIMINATION", eliminated: { playerId: "e", role: "CIVILIAN" }, settings: { ...DEFAULT_SETTINGS, blankGuess: true, winRule: "official" },
    roleCounts: { civilian: 4, undercover: 1, blank: 1 },
    players: [P("a", 0), P("b", 1), P("c", 2), P("d", 3), P("u", 4), { ...P("e", 5), alive: false, revealedRole: "CIVILIAN" }],
    history: [{ round: 1, eliminatedId: "e", role: "CIVILIAN", cause: "VOTE" }], ...over,
  });
  it("a voted-out Blank who may guess gets the last chance; without guessing the game goes on", () => {
    expect(afterElimination(base({ eliminated: { playerId: "e", role: "BLANK" } }))).toBe("LAST_CHANCE");
    expect(afterElimination(base({ eliminated: { playerId: "e", role: "BLANK" }, settings: { ...DEFAULT_SETTINGS, blankGuess: false, winRule: "official" } }))).toBe("NEXT_ROUND");
  });
  it("is OTHER when the game ends, the counts are hidden, the no-elimination streak resets, or another phase", () => {
    expect(afterElimination(base())).toBe("NEXT_ROUND");
    const allOut = base({ players: [P("a", 0), P("b", 1), { ...P("u", 2), alive: false, revealedRole: "UNDERCOVER" }, { ...P("w", 3), alive: false, revealedRole: "BLANK" }] });
    expect(afterElimination(allOut)).toBe("OTHER"); // civilians win
    expect(afterElimination(base({ players: [P("a", 0), P("u", 1), P("w", 2)] }))).toBe("OTHER"); // official: ≤ 1 civilian left
    expect(afterElimination(base({ roleCounts: null }))).toBe("OTHER");
    const none = { round: 1, eliminatedId: null, role: null, cause: "NONE" as const };
    expect(afterElimination(base({ eliminated: null, history: [none, none, none] }))).toBe("OTHER");
    expect(afterElimination(base({ phase: "CLUES" }))).toBe("OTHER");
  });
});

describe("TV-05 order strip window (Kotlin OrderStrip)", () => {
  it("shows everyone with chevrons, then without, then a window around the speaker with +n counts", () => {
    expect(orderWindow(5, 2, 640)).toEqual({ chevrons: true, start: 0, end: 5 }); // 5 × 104 + 4 × 24 = 616
    expect(orderWindow(6, 2, 630)).toEqual({ chevrons: false, start: 0, end: 6 }); // 624 fits without chevrons
    expect(orderWindow(12, 0, 620)).toEqual({ chevrons: false, start: 0, end: 5 }); // (620 − 96) / 104 = 5 slots
    expect(orderWindow(12, 6, 620)).toEqual({ chevrons: false, start: 5, end: 10 }); // one finished player before
    expect(orderWindow(12, 11, 620)).toEqual({ chevrons: false, start: 7, end: 12 });
    expect(orderWindow(12, 3, 50)).toEqual({ chevrons: false, start: 2, end: 3 }); // never fewer than one item
  });
  it("cuts names in graphemes", () => {
    expect(ellipsizeName("Maximilienne", 8)).toBe("Maximili…");
    expect(ellipsizeName("Léa", 8)).toBe("Léa");
    expect(ellipsizeName("👩‍👩‍👧‍👦👩‍👩‍👧‍👦👩‍👩‍👧‍👦", 2)).toBe("👩‍👩‍👧‍👦👩‍👩‍👧‍👦…");
    expect(graphemeCount("👩‍👩‍👧‍👦a")).toBe(2);
  });
});

describe("D-pad geometry", () => {
  const r = (left: number, top: number, w = 100, h = 40) => ({ left, top, width: w, height: h });
  const grid = [
    { el: "a", rect: r(0, 0) }, { el: "b", rect: r(120, 0) },
    { el: "c", rect: r(0, 60) }, { el: "d", rect: r(120, 60) }, { el: "done", rect: r(600, -100) },
  ];
  it("moves along the arrow, preferring the aligned neighbour", () => {
    expect(nearest(r(0, 0), grid.filter((x) => x.el !== "a"), "ArrowRight")).toBe("b");
    expect(nearest(r(0, 0), grid.filter((x) => x.el !== "a"), "ArrowDown")).toBe("c");
    expect(nearest(r(120, 60), grid.filter((x) => x.el !== "d"), "ArrowUp")).toBe("b");
    expect(nearest(r(0, 60), grid.filter((x) => x.el !== "c"), "ArrowLeft")).toBeNull();
  });
  it("still reaches a lone target far off-axis (Up from the first row → Done)", () => {
    expect(nearest(r(0, 0), [{ el: "done", rect: r(600, -100) }], "ArrowUp")).toBe("done");
  });
});

describe("TV-13e: a lost room between games is re-created (SPEC §7.5)", () => {
  it("4010 / 4004 in LOBBY, RESULTS or before any view; never in-game or for other codes", () => {
    for (const code of [4010, 4004]) {
      expect(recreatesRoomOnFatal(code, null)).toBe(true);
      expect(recreatesRoomOnFatal(code, { phase: "LOBBY" })).toBe(true);
      expect(recreatesRoomOnFatal(code, { phase: "RESULTS" })).toBe(true);
      for (const phase of ["ROLE_REVEAL", "CLUES", "VOTING", "TIE_BREAK", "ELIMINATION", "MR_WHITE_GUESS"] as const) {
        expect(recreatesRoomOnFatal(code, { phase })).toBe(false);
      }
    }
    for (const code of [4002, 4003, 4005, 4006]) expect(recreatesRoomOnFatal(code, { phase: "LOBBY" })).toBe(false);
  });
});

describe("Settings → About install id (PAYMENTS-SPEC §3.12)", () => {
  it("groups of four, like the TV app", () => {
    expect(displayInstallId("0123456789abcdef0123456789abcdef")).toBe("0123 4567 89ab cdef 0123 4567 89ab cdef");
  });
});
