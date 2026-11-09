// Likely through the platform room (reduceRoom + projections): hub → setup → game → stars → REPLAY, late joins, leaves,
// ABORT, the generic room leak checker after every step, and the §2.6 storage bound for a worst-case Likely room.
import { describe, expect, it } from "vitest";
import { MAX_PLAYERS, MEMORY_MAX_KEYS, NAME_MAX_CHARS } from "../../../src/constants";
import type { ColorId } from "../../../src/constants";
import { contentCatalog } from "../../../src/content/catalog";
import { playableContent } from "../../../src/content/load";
import type { LikelyCatalog } from "../../../src/games/likely/engine/catalog";
import type { LikelyIntent, LikelyState } from "../../../src/games/likely/engine/state";
import type { LikelyPack } from "../../../src/games/likely/schema";
import type { RoomAction } from "../../../src/room/types";
import { createRng } from "../../../src/room/rng";
import { likelyNextIntent } from "../../../src/testing/bots/likely";
import { likelyFamilyPack, likelyTokenCatalog, withLikely } from "../../../src/testing/catalogs/likely";
import { findRoomLeaks } from "../../../src/testing/room-leaks";
import { RoomHarness } from "../../../src/testing/room";
import { pid } from "../../../src/testing/game";
import { TEST_CATALOG } from "../../../src/testing/test-catalog";
import { GAME_DEFS } from "../../../src/games/registry";

const COLORS: ColorId[] = ["coral", "azure", "lemon", "jade", "grape", "tangerine", "aqua", "rose", "mint", "plum", "sand", "lilac"];
const ENABLED = ["mishana", "likely"] as const;
const bytes = (v: unknown): number => new TextEncoder().encode(JSON.stringify(v)).length;

function room(o: { cat?: LikelyCatalog; n?: number; seed?: number; premium?: boolean } = {}): RoomHarness {
  const cat = o.cat ?? likelyTokenCatalog();
  const access = { premium: o.premium ?? true, packs: new Set<string>() };
  const full = withLikely(cat, contentCatalog(TEST_CATALOG));
  const h = new RoomHarness({ seed: o.seed ?? 7, content: playableContent(full, access), fullContent: full, enabledGames: ENABLED, access });
  for (let i = 0; i < (o.n ?? 4); i++) h.join(pid(i), `P${i}`, COLORS[i] as ColorId);
  return h;
}
const game = (h: RoomHarness): LikelyState => (h.state.game as { state: LikelyState }).state;
const gameAction = (i: LikelyIntent, by: RoomAction["by"]): RoomAction => ({ type: "GAME", gameId: "likely", i, by } as RoomAction);

/** Plays the active instance to RESULTS with bot moves; checks the room leak oracles after every step. */
function playToResults(h: RoomHarness, seed = 1, everyStep?: () => void): void {
  const rng = createRng(seed);
  for (let guard = 0; guard < 2_000; guard++) {
    const s = game(h);
    if (s.phase === "RESULTS") return;
    const next = likelyNextIntent(s, rng, h.state.hostPlayerId);
    if (next && rng.next() < 0.8) {
      const r = h.try(gameAction(next.intent, next.by.kind === "tv" ? { kind: "tv" } : next.by));
      if (!r.ok && next.intent.type === "VOTE") throw new Error(`vote refused: ${r.error}`);
    } else {
      const d = s.deadline;
      h.now = Math.max(h.now, d ?? h.now + 1_000);
      h.sys({ type: "TICK" });
    }
    h.now += 300;
    const leaks = findRoomLeaks(h);
    if (leaks.length) throw new Error(`leak in ${game(h).phase}: ${leaks.slice(0, 3).join("; ")}`);
    everyStep?.();
  }
  throw new Error("did not finish");
}

describe("Likely in the room", () => {
  it("hub → setup → a full public game → stars from the outcome → REPLAY without repeating a card", () => {
    const h = room();
    h.tv({ type: "OPEN_GAME", gameId: "likely" });
    expect(h.tvView().room.setup?.extras).toEqual({ gameId: "likely", available: 40 });
    h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { length: "short" } } as never);
    h.tv({ type: "START_GAME" });
    expect(game(h).deadline).toBe(h.now + 3_500 + 2_500);
    const first = new Set<string>();
    playToResults(h, 1, () => {
      const c = game(h).card;
      if (c) first.add(c.cardId);
    });
    expect(h.tvView().game?.over).toBe(true);
    const out = GAME_DEFS.likely.outcome(game(h));
    const best = out?.ranking[0] ?? [];
    for (const id of best) expect(h.state.cup.stars[id]).toBe(3);
    h.tv({ type: "REPLAY" });
    expect(game(h).cardIndex).toBe(0);
    expect(first.has(game(h).card?.cardId as string)).toBe(false);
    expect(h.history.memory.likely?.usedKeys.length).toBeGreaterThanOrEqual(8);
  });
  it("secret votes: the game ends with no points, so nobody gets stars", () => {
    const h = room();
    h.tv({ type: "OPEN_GAME", gameId: "likely" });
    h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { length: "short", showVoters: false } } as never);
    h.tv({ type: "START_GAME" });
    playToResults(h, 3);
    expect(h.state.cup.stars).toEqual({});
    expect(h.state.cup.last?.ranking).toEqual([]);
  });
  it("a VIP spicy patch is refused (Spicy compiled out; the platform passes no actor)", () => {
    const h = room();
    h.tv({ type: "OPEN_GAME", gameId: "likely" });
    expect(h.err({ type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { mode: "spicy", ageConfirmed: true }, by: { kind: "tv" } } as never)).toBe("INVALID_SETTINGS");
    expect(h.err({ type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { mode: "spicy", ageConfirmed: true }, by: { kind: "player", playerId: pid(0) } } as never)).toBe("INVALID_SETTINGS");
  });
  it("a late joiner is benched, admitted through `join`, waits for the next CARD, then plays", () => {
    const h = room();
    h.tv({ type: "OPEN_GAME", gameId: "likely" });
    h.tv({ type: "START_GAME" });
    h.join(pid(9), "Late", "mint");
    const m = h.state.members.find((x) => x.id === pid(9));
    expect(m?.benched).toBe(false);
    expect(h.playerView(pid(9)).game?.me).toEqual({ myVote: null, waitingForNext: true });
    for (let k = 0; k < 20 && !(game(h).phase === "CARD" && game(h).cardIndex === 1); k++) {
      h.now = Math.max(h.now, game(h).deadline ?? h.now);
      h.sys({ type: "TICK" });
    }
    expect(h.playerView(pid(9)).game?.me).toEqual({ myVote: null, waitingForNext: false });
    expect(findRoomLeaks(h)).toEqual([]);
  });
  it("LEAVE while playing keeps the game going; ABORT keeps the memory and gives no stars", () => {
    const h = room({ n: 5 });
    h.tv({ type: "OPEN_GAME", gameId: "likely" });
    h.tv({ type: "START_GAME" });
    h.p(pid(4), { type: "LEAVE" });
    expect(game(h).players.find((p) => p.id === pid(4))?.left).toBe(true);
    expect(findRoomLeaks(h)).toEqual([]);
    const drawn = game(h).card?.cardId as string;
    h.tv({ type: "ABORT_GAME" });
    expect(h.state.phase).toBe("SETUP");
    expect(h.state.cup.stars).toEqual({});
    expect(h.history.memory.likely?.usedKeys).toContain(drawn);
  });
  it("start is blocked under 3 connected players, and without enough cards in the language", () => {
    const h = room({ n: 2 });
    h.tv({ type: "OPEN_GAME", gameId: "likely" });
    expect(h.tvView().room.setup?.startBlocker).toBe("NOT_ENOUGH_PLAYERS");
    const small = room({ cat: { packs: [{ ...likelyFamilyPack(), cards: likelyFamilyPack().cards.slice(0, 10) }] } });
    small.tv({ type: "OPEN_GAME", gameId: "likely" });
    expect(small.tvView().room.setup?.startBlocker).toBe("NO_CONTENT_AVAILABLE");
  });
  it("a free room plays only the free Family cards", () => {
    const h = room({ premium: false });
    h.tv({ type: "OPEN_GAME", gameId: "likely" });
    expect(h.tvView().room.setup?.extras).toEqual({ gameId: "likely", available: 20 });
    h.tv({ type: "START_GAME" });
    const free = new Set(likelyFamilyPack().cards.filter((c) => c.tier === "free").map((c) => c.id));
    playToResults(h, 5, () => {
      const c = game(h).card;
      if (c) expect(free.has(c.cardId)).toBe(true);
    });
  });
  it("a room without likely in its enabled games cannot open it", () => {
    const cat = likelyTokenCatalog();
    const h = new RoomHarness({ content: withLikely(cat), fullContent: withLikely(cat), enabledGames: ["mishana"] });
    h.join(pid(0), "A", "coral");
    expect(h.err({ type: "OPEN_GAME", gameId: "likely", by: { kind: "tv" } })).not.toBeNull();
  });
});

describe("storage size (§2.6)", () => {
  // Card ids as the packs name them ("fam-001", GAME-LIKELY §11.2: 7–12 characters); every text at its schema maximum.
  it("worst-case Likely room state (12 longest names, Long game, Arabic max-length cards, a full history, 60 skips) ≤ 16 KiB", () => {
    const long = (s: string, n: number): string => (s.repeat(n)).slice(0, n);
    const pack: LikelyPack = {
      ...likelyFamilyPack({ id: "likely-lebanon-life-and-more", n: 290 }),
      cards: likelyFamilyPack({ id: "likely-lebanon-life-and-more", n: 290 }).cards.map((c, i) => ({
        ...c, id: `leb-${String(i).padStart(3, "0")}`,
        prompt: { en: long("e", 60), fr: long("f", 70), ar: long("ب", 60), es: long("s", 70) },
        award: { en: long("e", 60), fr: long("f", 70), ar: long("ج", 60), es: long("s", 70) },
      })),
    };
    const cat: LikelyCatalog = { packs: [pack] };
    const h = new RoomHarness({ seed: 9, content: withLikely(cat), fullContent: withLikely(cat), enabledGames: ENABLED, contentLocale: "ar" });
    for (let i = 0; i < MAX_PLAYERS; i++) h.join(pid(i), "𝔐".repeat(NAME_MAX_CHARS - 2) + String(i).padStart(2, "0"), COLORS[i] as ColorId);
    // Every card of the catalog already in the history (290: about the whole Pass catalog drafted for launch, 175 Family + 108 Spicy), plus keys
    // of packs this room cannot draw (not carried in the state).
    h.history.memory.likely = { usedKeys: [...Array.from({ length: MEMORY_MAX_KEYS - 290 }, (_, i) => `gone-${i}`), ...Array.from({ length: 290 }, (_, i) => `leb-${String(i).padStart(3, "0")}`)] };
    h.tv({ type: "OPEN_GAME", gameId: "likely" });
    h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { length: "long" } } as never);
    h.tv({ type: "START_GAME" });
    for (let k = 0; k < 60; k++) h.tv({ type: "GAME", gameId: "likely", i: { type: "SKIP_CARD", cardId: game(h).card?.cardId as string } } as never);
    let max = 0;
    playToResults(h, 11, () => {
      max = Math.max(max, bytes(h.state));
    });
    for (const m of h.state.members) h.state.cup.stars[m.id] = 99;
    max = Math.max(max, bytes(h.state));
    const g = game(h) as unknown as Record<string, unknown>;
    console.log(`likely state worst case: ${max} bytes; game ${bytes(g)}; ` + Object.keys(g).map((k) => `${k}=${bytes(g[k])}`).join(" "));
    expect(max).toBeLessThanOrEqual(16 * 1024);
  });
});
