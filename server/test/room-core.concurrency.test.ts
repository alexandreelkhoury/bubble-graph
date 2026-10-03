import { describe, expect, it } from "vitest";
import { Harness, TV_TOKEN, seqs, strictlyIncreasing } from "./support/fakes";
import type { RoomStorage } from "../src/room-core";

describe("RoomCore concurrency", () => {
  it("two hellos and a join fired concurrently → strictly increasing seq everywhere, no lost update", async () => {
    const h = await new Harness().init();
    // Slow storage: every operation yields several times, so unserialised handlers would interleave.
    const s = h.storage as RoomStorage;
    const wrap = <K extends keyof RoomStorage>(k: K): void => {
      const f = s[k].bind(s) as (...a: unknown[]) => Promise<unknown>;
      (s as unknown as Record<string, unknown>)[k] = async (...a: unknown[]) => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
        await new Promise((r) => setTimeout(r, 1));
        return f(...a);
      };
    };
    for (const k of ["get", "put", "getAlarm", "setAlarm"] as const) wrap(k);

    const existing = await h.player(0);
    const [tvConn, p1, p2] = await Promise.all([h.connect({ label: "tv" }), h.connect({ label: "p1" }), h.connect({ label: "p2" })]);
    const sends = [
      h.core.onMessage(tvConn, JSON.stringify({ v: 1, t: "hello", role: "tv", tvToken: TV_TOKEN })),
      h.core.onMessage(p1, JSON.stringify({ v: 1, t: "hello", role: "player" })),
      h.core.onMessage(p2, JSON.stringify({ v: 1, t: "hello", role: "player" })),
      h.core.onMessage(p1, JSON.stringify({ v: 1, t: "join", name: "Alpha", color: "azure", locale: "en" })),
      h.core.onMessage(p2, JSON.stringify({ v: 1, t: "join", name: "Beta", color: "lemon", locale: "en" })),
      h.core.onMessage(existing.conn, JSON.stringify({ v: 1, t: "action", a: { type: "UPDATE_SETTINGS", patch: { clueSeconds: 60 } } })),
    ];
    await Promise.all(sends);
    expect(h.state.players.map((p) => p.name).sort()).toEqual(["Alpha", "Beta", "Player 0"]);
    expect(h.state.settings.clueSeconds).toBe(60);
    expect(p1.last("welcome")).toBeDefined();
    expect(p2.last("welcome")).toBeDefined();
    for (const c of [tvConn, p1, p2, existing.conn]) {
      expect(c.errors()).toEqual([]);
      expect(strictlyIncreasing(seqs(c))).toBe(true);
    }
    // The last frame everyone saw is the final version.
    for (const c of [tvConn, p1, p2, existing.conn]) expect(seqs(c).at(-1)).toBe(h.state.version);
    // Storage matches the cache.
    expect((await h.storage.get<{ version: number }>("state"))?.version).toBe(h.state.version);
    expect(Object.keys((await h.storage.get<Record<string, unknown>>("sessions")) ?? {})).toHaveLength(3);
  });
});
