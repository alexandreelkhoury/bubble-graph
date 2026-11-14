// JAMAA-PLATFORM §2.6a: the TV's no-repeat memory across rooms (sanitize, wire shape, merge) and the room engine
// starting from a seeded history.
import { describe, expect, it } from "vitest";
import { MEMORY_MAX_KEYS } from "../../src/constants";
import type { ColorId } from "../../src/constants";
import { contentCatalog } from "../../src/content/catalog";
import { CreateRoomRequest } from "../../src/protocol/http";
import { MemoryV2Schema, ServerMessageV2Schema } from "../../src/protocol/v2";
import { createRoomHistory } from "../../src/room";
import { isMemoryKey, memoryFromWire, memoryToWire, mergeMemoryWire, sameMemory, sanitizeMemoryWire } from "../../src/room/memory";
import { ROOM_FORBIDDEN_KEYS } from "../../src/testing/room-leaks";
import { pid, RoomHarness, TEST_FREE_CATALOG } from "../../src/testing";

const COLORS: ColorId[] = ["coral", "azure", "lemon", "jade", "grape"];

describe("memory keys and sanitizing", () => {
  it("accepts the keys every game stores, refuses other shapes", () => {
    for (const k of ["en-food-01:p001", "lb-quiz-01:q0123", "teta-words-07", "x", `${"a".repeat(40)}:${"b".repeat(40)}`]) expect(isMemoryKey(k), k).toBe(true);
    for (const k of ["", "A:b", "a b", "a:b:c", ":a", "a:", "-a", `${"a".repeat(41)}`, "a/b", "a\u0000", 7, null]) expect(isMemoryKey(k), String(k)).toBe(false);
  });

  it("keeps known games only, in GAME_IDS order; drops malformed keys and empty games; dedupes keeping the latest", () => {
    const raw = { trivia: ["q:1", "lb-quiz-01:q0001"], likely: [], karaoke: ["a"], mishana: ["a:p001", "a:p002", "a:p001", 3, "NO"], bluff: "x" };
    const w = sanitizeMemoryWire(raw);
    expect(Object.keys(w)).toEqual(["mishana", "trivia"]);
    expect(w.mishana).toEqual(["a:p002", "a:p001"]);
    expect(w.trivia).toEqual(["q:1", "lb-quiz-01:q0001"]);
  });

  it("caps each game at MEMORY_MAX_KEYS, the most recent", () => {
    const keys = Array.from({ length: MEMORY_MAX_KEYS * 5 }, (_, i) => `k${i}`);
    expect(sanitizeMemoryWire({ bluff: keys }).bluff).toEqual(keys.slice(-MEMORY_MAX_KEYS));
  });

  it("never throws on junk", () => {
    for (const j of [null, undefined, 1, "x", [], [["mishana", ["a"]]], { mishana: null }, Object.create(null)]) expect(sanitizeMemoryWire(j)).toEqual({});
  });

  it("wire ↔ history round trip; sameMemory compares contents", () => {
    const w = { mishana: ["a:p001"], likely: ["c1", "c2"] };
    const m = memoryFromWire(w);
    expect(m).toEqual({ mishana: { usedKeys: ["a:p001"] }, likely: { usedKeys: ["c1", "c2"] } });
    expect(memoryToWire(m)).toEqual(w);
    expect(memoryToWire({ bluff: { usedKeys: [] } })).toEqual({});
    expect(sameMemory(m, memoryFromWire(structuredClone(w)))).toBe(true);
    expect(sameMemory(m, {})).toBe(false);
    expect(sameMemory({ bluff: { usedKeys: [] } }, undefined)).toBe(true);
    expect(sameMemory(m, memoryFromWire({ ...w, likely: ["c2", "c1"] }))).toBe(false);
  });

  it("the TV merge: games in the frame replace the stored list, the others stay", () => {
    expect(mergeMemoryWire({ mishana: ["a:p001"], bluff: ["b1"] }, { mishana: ["a:p001", "a:p002"], trivia: ["t:q0001"] })).toEqual({
      mishana: ["a:p001", "a:p002"], bluff: ["b1"], trivia: ["t:q0001"],
    });
  });

  it("createRoomHistory copies the seed", () => {
    const seed = memoryFromWire({ mishana: ["a:p001"] });
    const h = createRoomHistory(seed);
    seed.mishana!.usedKeys.push("a:p002");
    expect(h).toEqual({ memory: { mishana: { usedKeys: ["a:p001"] } }, games: [] });
  });
});

describe("wire schemas", () => {
  it("POST /api/rooms takes an optional, bounded `memory`", () => {
    expect(CreateRoomRequest.safeParse({ locale: "en", memory: { mishana: ["a:p001"], future: [] } }).success).toBe(true);
    expect(CreateRoomRequest.safeParse({ memory: { mishana: Array(MEMORY_MAX_KEYS + 1).fill("k") } }).success).toBe(false);
    expect(CreateRoomRequest.safeParse({ memory: { mishana: [1] } }).success).toBe(false);
    expect(CreateRoomRequest.safeParse({ memory: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`g${i}`, []])) }).success).toBe(false);
  });
  it("s2c `memory` is a v2 server message", () => {
    const m = { v: 2, t: "memory", memory: { trivia: ["lb-quiz-01:q0001"] } };
    expect(MemoryV2Schema.parse(m)).toEqual(m);
    expect(ServerMessageV2Schema.safeParse(m).success).toBe(true);
    expect(ROOM_FORBIDDEN_KEYS).toContain("memory");
  });
});

describe("a seeded room (§2.6a)", () => {
  const allKeys = contentCatalog(TEST_FREE_CATALOG).mishana.packs.flatMap((p) => p.pairs.map((q) => q.key));

  function startMishana(seed: number, memory?: Record<string, string[]>): RoomHarness {
    const h = new RoomHarness({ seed });
    if (memory) h.history = createRoomHistory(memoryFromWire(sanitizeMemoryWire(memory)));
    for (let i = 0; i < 4; i++) {
      h.now += 10;
      h.join(pid(i), `Player${i}`, COLORS[i] as ColorId);
    }
    h.tv({ type: "OPEN_GAME", gameId: "mishana" });
    h.tv({ type: "START_GAME" });
    return h;
  }

  it("the first draw of the new room avoids every seeded key", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const k = startMishana(seed).mishana().pair!.key;
      const h = startMishana(seed + 1000, { mishana: allKeys.filter((x) => x !== k) });
      expect(h.mishana().pair!.key, `seed ${seed}`).toBe(k);
    }
  });

  it("the seed never reaches a phone or the TV view", () => {
    const seed = { mishana: allKeys.slice(0, 5), trivia: ["lb-quiz-01:q0001"] };
    const h = startMishana(7, seed);
    h.playMishanaToResults();
    for (const json of [JSON.stringify(h.tvView()), JSON.stringify(h.playerView(pid(0))), JSON.stringify(h.playerView(null))]) {
      expect(json).not.toContain("lb-quiz-01:q0001");
      expect(json).not.toContain("usedKeys");
      expect(json).not.toContain('"memory"');
    }
    expect(h.history.memory.trivia?.usedKeys).toEqual(["lb-quiz-01:q0001"]);
    expect(h.history.memory.mishana?.usedKeys.slice(0, 5)).toEqual(seed.mishana);
  });
});
