// JAMAA-PLATFORM §2.6a: the TV's no-repeat memory across rooms. POST /api/rooms `memory` seeds the new room's
// RoomHistory.memory (the creator only: no WebSocket message can), and every change of it is sent to the TV only.
import { describe, expect, it } from "vitest";
import { MEMORY_MAX_KEYS } from "@jamaa/shared/constants";
import { MemoryV2Schema } from "@jamaa/shared/protocol/v2";
import { createRoom } from "../src/http";
import type { CreateRoomDeps } from "../src/http";
import type { InitRoomArgs } from "../src/room-core";
import { randomBytes } from "../src/tokens";
import { fakeEnv } from "./support/env";
import { Harness, TEST_CONTENT } from "./support/fakes";
import type { FakeConn } from "./support/fakes";

const ALL_MISHANA_KEYS = TEST_CONTENT.mishana.packs.flatMap((p) => p.pairs.map((q) => q.key));

/** The key Mish Ana! draws for the first game of a 4-player room seeded with `memory`. */
async function firstDraw(memory?: InitRoomArgs["memory"]): Promise<{ h: Harness; key: string }> {
  const h = await new Harness().init(memory ? { memory } : {});
  await h.startedGame({ n: 4 });
  const key = h.state.pair?.key;
  if (!key) throw new Error("no pair drawn");
  return { h, key };
}

const memoryFrames = (c: FakeConn) => c.of("memory").map((m) => MemoryV2Schema.parse(m).memory);

describe("seed at room creation (§2.6a)", () => {
  it("the seeded memory is the new room's history and the first draw avoids it", async () => {
    const { key: k } = await firstDraw();
    expect(ALL_MISHANA_KEYS).toContain(k);
    // Every pair but `k` was played on this TV before: the first game of the new room must draw `k`.
    const seed = ALL_MISHANA_KEYS.filter((x) => x !== k);
    for (let i = 0; i < 3; i++) {
      const { h, key } = await firstDraw({ mishana: seed });
      expect(key).toBe(k);
      expect(h.history.memory.mishana?.usedKeys.slice(0, seed.length)).toEqual(seed);
    }
  });

  it("is sanitized again in the DO: unknown games, malformed keys and duplicates dropped, ≤ 300 most recent", async () => {
    const many = Array.from({ length: MEMORY_MAX_KEYS + 20 }, (_, i) => `lb-quiz-01:q${String(i).padStart(4, "0")}`);
    const raw = { karaoke: ["x"], mishana: ["test-en-01:p001", "BAD KEY", "test-en-01:p002", "test-en-01:p001", 7], trivia: many };
    const h = await new Harness().init({ memory: raw as unknown as InitRoomArgs["memory"] });
    expect(Object.keys(h.history.memory)).toEqual(["mishana", "trivia"]);
    expect(h.history.memory.mishana?.usedKeys).toEqual(["test-en-01:p002", "test-en-01:p001"]);
    expect(h.history.memory.trivia?.usedKeys).toEqual(many.slice(-MEMORY_MAX_KEYS));
    expect(await h.storage.get("history")).toEqual(h.history);
  });

  it("no seed = empty memory (as before)", async () => {
    const h = await new Harness().init();
    expect(h.history.memory).toEqual({});
  });
});

describe("a phone (or any socket) cannot seed memory", () => {
  it("player hello, join and TV hello carrying `memory` are BAD_MESSAGE; the memory is unchanged", async () => {
    const h = await new Harness().init({ memory: { likely: ["family-01"] } });
    const before = structuredClone(h.history.memory);
    const sp = await h.connect({ label: "sneaky" });
    await h.send(sp, { v: 2, t: "hello", role: "player", memory: { mishana: ["test-en-01:p001"] } });
    expect(sp.errors()).toEqual(["BAD_MESSAGE"]);
    const p = await h.player(0);
    await h.send(p.conn, { v: 2, t: "memory", memory: { mishana: ["test-en-01:p001"] } });
    await h.send(p.conn, { v: 2, t: "join", name: "X", color: "coral", locale: "en", memory: { mishana: ["test-en-01:p001"] } });
    expect(p.conn.errors()).toEqual(["BAD_MESSAGE", "BAD_MESSAGE"]);
    const tv = await h.connect({ label: "tv2" });
    await h.send(tv, { v: 2, t: "hello", role: "tv", tvToken: "0123456789abcdef0123456789abcdef", games: [{ id: "mishana", v: 1 }], memory: {} });
    expect(tv.errors()).toEqual(["BAD_MESSAGE"]);
    expect(h.history.memory).toEqual(before);
  });
});

describe("delivery to the TV only (§2.6a)", () => {
  it("TV hello gets the seeded memory; a game end, REPLAY and ABORT send the new memory to the TV and never to phones", async () => {
    const h = await new Harness().init({ memory: { bluff: ["lb-proverbs-01"] } });
    const { tv, ps } = await h.startedGame({ n: 4, ready: true });
    const spectator = await h.spectator();
    expect(memoryFrames(tv)).toEqual([{ bluff: ["lb-proverbs-01"] }]);
    tv.clear();
    await h.playToResults(tv, ps);
    const first = h.state.pair!.key;
    expect(memoryFrames(tv)).toEqual([{ mishana: [first], bluff: ["lb-proverbs-01"] }]);
    tv.clear();
    await h.act(tv, { type: "REPLAY" });   // the memory REPLAY writes is the one the game end already sent: no frame
    expect(memoryFrames(tv)).toEqual([]);
    for (const p of ps) await h.game(p.conn, { type: "READY" });
    await h.act(tv, { type: "ABORT_GAME" });
    const after = h.history.memory.mishana!.usedKeys;
    expect(after).toHaveLength(2);
    expect(memoryFrames(tv)).toEqual([{ mishana: after, bluff: ["lb-proverbs-01"] }]);
    for (const c of [...ps.map((p) => p.conn), spectator]) {
      expect(c.of("memory")).toEqual([]);
      for (const m of c.msgs) expect(JSON.stringify(m)).not.toContain("usedKeys");
      for (const m of c.msgs) expect(JSON.stringify(m)).not.toContain("lb-proverbs-01");
    }
  });

  it("a TV that reconnects gets the room's memory again; an empty memory sends nothing", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    expect(tv.of("memory")).toEqual([]);
    const ps = [await h.player(0), await h.player(1), await h.player(2), await h.player(3)];
    await h.open(tv);
    await h.settings(tv, { clueSeconds: 0, voteSeconds: 0, revealSeconds: 0, guessSeconds: 0 });
    await h.act(tv, { type: "START_GAME" });
    for (const p of ps) await h.game(p.conn, { type: "READY" });
    await h.act(tv, { type: "ABORT_GAME" });
    const tv2 = await h.tv();
    expect(memoryFrames(tv2)).toEqual([{ mishana: h.history.memory.mishana!.usedKeys }]);
  });
});

describe("POST /api/rooms `memory` (§2.6a)", () => {
  function deps(log: InitRoomArgs[]): CreateRoomDeps {
    return { getStub: async () => ({ initRoom: async (a: InitRoomArgs) => (log.push(a), { ok: true as const }) }), randomBytes, now: () => 42 };
  }
  const post = (body: unknown): Request =>
    new Request("https://jamaa.test/api/rooms", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

  it("passes the sanitized memory to the DO (unknown games and malformed keys dropped)", async () => {
    const log: InitRoomArgs[] = [];
    const res = await createRoom(post({ locale: "en", memory: { mishana: ["en-food-01:p001", "Nope!"], future: ["x"], trivia: [] } }), fakeEnv(), deps(log));
    expect(res.status).toBe(201);
    expect(log[0]?.memory).toEqual({ mishana: ["en-food-01:p001"] });
  });

  it("no memory → {}; a full 4 × 300 memory of long keys fits the body limit", async () => {
    const log: InitRoomArgs[] = [];
    expect((await createRoom(post({ locale: "en" }), fakeEnv(), deps(log))).status).toBe(201);
    expect(log[0]?.memory).toEqual({});
    const long = (g: string) => Array.from({ length: MEMORY_MAX_KEYS }, (_, i) => `${"a".repeat(36)}-${g}:${"b".repeat(35)}${String(i).padStart(4, "0")}`);
    const full = { mishana: long("m"), bluff: long("b"), likely: long("l"), trivia: long("t") };
    expect((await createRoom(post({ locale: "en", entitlement: "x".repeat(3000), memory: full }), fakeEnv(), deps(log))).status).toBe(201);
    expect(log[1]?.memory).toEqual(full);
  });

  it("a memory breaking the shape bounds → 400 BAD_MESSAGE (no room)", async () => {
    const log: InitRoomArgs[] = [];
    const bad: unknown[] = [
      { memory: [] },
      { memory: { mishana: "x" } },
      { memory: { mishana: [1] } },
      { memory: { mishana: Array.from({ length: MEMORY_MAX_KEYS + 1 }, (_, i) => `k${i}`) } },
      { memory: { mishana: ["k".repeat(82)] } },
      { memory: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`g${i}`, []])) },
    ];
    for (const b of bad) {
      const res = await createRoom(post(b), fakeEnv(), deps(log));
      expect(res.status, JSON.stringify(b).slice(0, 80)).toBe(400);
    }
    expect(log).toHaveLength(0);
  });
});
