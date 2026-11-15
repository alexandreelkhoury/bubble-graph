// JAMAA-PLATFORM §8.8: the admin room inspector is read-only and redacts tokens, hashes, connection ids and hashed IPs.
import { describe, expect, it } from "vitest";
import { inspectRoom, redactDeep, REDACTED, SECRET_NOTE } from "../../src/monitor/inspect";
import { FakeConnections, Harness, ROOM } from "../support/fakes";

describe("redactDeep", () => {
  it("replaces secret-looking keys at any depth and keeps the rest", () => {
    expect(redactDeep({ a: 1, tvTokenHash: "x", list: [{ resumeToken: "r", ipKey: "i", cid: "c", name: "Rana" }], ent: { sub: "s", packs: ["p"] } })).toEqual({
      a: 1, tvTokenHash: REDACTED, list: [{ resumeToken: REDACTED, ipKey: REDACTED, cid: REDACTED, name: "Rana" }], ent: { sub: REDACTED, packs: ["p"] },
    });
  });
});

describe("RoomCore.inspect", () => {
  it("a live room: phase, members (names, flags, host), sockets without ids, timers; no token, hash or ip anywhere", async () => {
    const h = await new Harness().init();
    const { tv, ps } = await h.startedGame({ n: 3, ready: true });
    void tv;
    const before = h.storage.snapshot();
    const v = await h.core.inspect();
    expect(v).toMatchObject({ code: ROOM, exists: true, source: "memory", room: { phase: "PLAYING", gameId: "mishana" }, game: { id: "mishana" } });
    const members = v.members as { id: string; name: string; connected: boolean; host: boolean }[];
    expect(members).toHaveLength(3);
    expect(members.filter((m) => m.host)).toHaveLength(1);
    expect(members.every((m) => m.connected && typeof m.name === "string")).toBe(true);
    expect((v.sockets as { role: string }[]).map((s) => s.role).sort()).toEqual(["player", "player", "player", "tv"]);
    expect(v.hiddenState).toMatchObject({ note: SECRET_NOTE });
    expect((v.timers as { alarm: number | null }).alarm).toBe(h.storage.alarm);
    const json = JSON.stringify(v);
    for (const p of ps) expect(json).not.toContain(p.token);
    expect(json).not.toMatch(/"(tvTokenHash|tokenHash|ipKey|cid)":"(?!\[redacted\])/);
    expect(json).not.toContain(h.core.peek().meta!.tvTokenHash);
    for (const s of Object.values(h.core.peek().sessions)) expect(json).not.toContain(s.tokenHash);
    // Read-only: storage and alarm untouched, nothing sent.
    expect(h.storage.snapshot()).toEqual(before);
  });

  it("an evicted room is read from storage without loading it (no write); an unknown room → exists:false", async () => {
    const h = await new Harness().init();
    await h.player(0);
    const cold = new Harness({ storage: h.storage, conns: new FakeConnections() });
    const before = h.storage.snapshot();
    const v = await cold.core.inspect();
    expect(v).toMatchObject({ exists: true, source: "storage", room: { phase: "HUB" } });
    expect(h.storage.snapshot()).toEqual(before);
    expect(await new Harness().core.inspect()).toMatchObject({ code: ROOM, exists: false });
  });

  it("inspectRoom summarises the entitlement without its subject", async () => {
    const h = await new Harness().init();
    const { meta, state, history } = h.core.peek();
    const v = inspectRoom({
      code: ROOM, now: 1, meta: { ...meta!, entitlement: { sub: "install-hash-abc", iatMs: 0, expMs: 9, premiumUntilMs: null, packs: ["x"], mode: "google" } },
      state, history, sessions: {}, sockets: [null], alarm: null, nextWakeAt: null, expiresAt: null, source: "memory",
    });
    expect((v.meta as { entitlement: unknown }).entitlement).toEqual({ mode: "google", premiumUntilMs: null, expMs: 9, packs: ["x"] });
    expect(v.sockets).toEqual([{ role: "pending", playerId: null, openedAt: null }]);
    expect(JSON.stringify(v)).not.toContain("install-hash-abc");
  });
});
