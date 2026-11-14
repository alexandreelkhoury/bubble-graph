// JAMAA-PLATFORM §2.6a: the browser TV keeps the room's no-repeat memory in localStorage, sends it with POST /api/rooms
// and saves each `memory` frame (TV socket only).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoom } from "../src/net/api";
import { Connection } from "../src/net/connection";
import type { SocketHandlers, SocketLike } from "../src/net/connection";
import { loadTvMemory, saveTvMemory, TV_MEMORY_KEY, tvMemoryBody, withMemoryTap } from "../src/tv-mock/tvMemory";

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
const g = globalThis as { localStorage?: unknown; fetch?: unknown };

describe("tvMemory storage", () => {
  let mem: MemStorage;
  beforeEach(() => { mem = new MemStorage(); g.localStorage = mem; });
  afterEach(() => { delete g.localStorage; });

  it("uses a `jamaa:` key and round-trips", () => {
    expect(TV_MEMORY_KEY).toBe("jamaa:tvMemory");
    expect(loadTvMemory()).toEqual({});
    saveTvMemory({ mishana: ["en-food-01:p001"], trivia: ["lb-quiz-01:q001"] });
    expect(loadTvMemory()).toEqual({ mishana: ["en-food-01:p001"], trivia: ["lb-quiz-01:q001"] });
    // A later frame replaces the games it carries and keeps the others.
    saveTvMemory({ mishana: ["en-food-01:p001", "en-food-01:p002"] });
    expect(loadTvMemory()).toEqual({ mishana: ["en-food-01:p001", "en-food-01:p002"], trivia: ["lb-quiz-01:q001"] });
    expect(JSON.parse(mem.getItem("jamaa:tvMemory")!)).toEqual(loadTvMemory());
  });

  it("corrupt or junk storage reads as empty; junk frames change nothing", () => {
    mem.setItem("jamaa:tvMemory", "{nope");
    expect(loadTvMemory()).toEqual({});
    mem.setItem("jamaa:tvMemory", JSON.stringify({ chess: ["a"], bluff: ["ok", "NOT OK", 3] }));
    expect(loadTvMemory()).toEqual({ bluff: ["ok"] });
    saveTvMemory("junk");
    expect(loadTvMemory()).toEqual({ bluff: ["ok"] });
  });

  it("blocked storage never throws", () => {
    g.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("x"); }, key: () => null, length: 0 };
    expect(loadTvMemory()).toEqual({});
    expect(() => saveTvMemory({ mishana: ["a:p001"] })).not.toThrow();
    delete g.localStorage;
    expect(loadTvMemory()).toEqual({});
  });
});

describe("POST /api/rooms carries the memory", () => {
  afterEach(() => { delete g.fetch; });
  it("sends `memory` when non-empty, omits it otherwise", async () => {
    const bodies: unknown[] = [];
    g.fetch = vi.fn(async (_u: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ code: "KXRT", tvToken: "0".repeat(32), joinUrl: "x", wsPath: "/parties/room/KXRT", entitlement: "NONE" }), { status: 201 });
    });
    g.localStorage = new MemStorage();
    expect(tvMemoryBody()).toEqual({});
    saveTvMemory({ likely: ["late-again"] });
    expect((await createRoom("fr", null, tvMemoryBody())).ok).toBe(true);
    delete g.localStorage;
    await createRoom("en", "tok");
    expect(bodies).toEqual([{ locale: "fr", memory: { likely: ["late-again"] } }, { locale: "en", entitlement: "tok" }]);
  });
});

describe("the TV socket taps `memory` frames", () => {
  it("saves them through onMemory and still hands every frame to the Connection (which ignores `memory`)", () => {
    let h!: SocketHandlers;
    const got: unknown[] = [];
    const states: unknown[] = [];
    const sock: SocketLike = { readyState: 1, send() {}, close() {}, reconnect() {} };
    new Connection(withMemoryTap((x) => ((h = x), sock), (m) => got.push(m)), {
      hello: () => ({ v: 2, t: "hello", role: "player" }),
      onState: (m) => states.push(m),
      onWelcome: () => undefined,
      onError: () => undefined,
      onStatus: () => undefined,
      onFatal: () => undefined,
    });
    h.message(JSON.stringify({ v: 2, t: "memory", memory: { bluff: ["b1"] } }));
    h.message(JSON.stringify({ v: 2, t: "state", seq: 1, serverNow: 0, view: { kind: "tv", note: '"t":"memory"' } }));
    h.message("{nope \"t\":\"memory\"");
    expect(got).toEqual([{ bluff: ["b1"] }]);
    expect(states).toHaveLength(1);
  });
});
