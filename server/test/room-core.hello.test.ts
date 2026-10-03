import { describe, expect, it } from "vitest";
import { SEAT_HOLD_MS } from "@mishana/shared/constants";
import { Harness, TV_TOKEN } from "./support/fakes";

describe("RoomCore hello", () => {
  it("TV auth ok → tv state", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    expect(tv.state?.role).toBe("tv");
    expect(tv.lastView().kind).toBe("tv");
    expect(tv.open).toBe(true);
  });

  it("TV auth fail → TV_AUTH_FAILED + 4003", async () => {
    const h = await new Harness().init();
    const c = await h.connect();
    await h.send(c, { v: 1, t: "hello", role: "tv", tvToken: "f".repeat(32) });
    expect(c.errors()).toEqual(["TV_AUTH_FAILED"]);
    expect(c.closeCode).toBe(4003);
    expect(c.of("state")).toHaveLength(0);
  });

  it("a second TV replaces the first (REPLACED + 4005)", async () => {
    const h = await new Harness().init();
    const tv1 = await h.tv();
    const tv2 = await h.tv();
    expect(tv1.errors()).toEqual(["REPLACED"]);
    expect(tv1.closeCode).toBe(4005);
    expect(tv2.open).toBe(true);
    expect(tv2.lastView().kind).toBe("tv");
  });

  it("spectator hello → player view with me:null", async () => {
    const h = await new Harness().init();
    const s = await h.spectator();
    const v = s.lastView();
    expect(v.kind).toBe("player");
    expect(v.me).toBeNull();
    expect(s.state?.role).toBe("player");
    expect(s.state?.playerId).toBeNull();
  });

  it("player resume ok → same playerId and token, RECONNECT, old socket REPLACED", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const a = await h.player(0);
    const r = await h.resume(a.token);
    const w = r.last("welcome");
    expect(w).toMatchObject({ playerId: a.pid, resumeToken: a.token, roomCode: "KXRT" });
    expect((r.lastView().me as { id: string }).id).toBe(a.pid);
    expect(a.conn.errors()).toContain("REPLACED");
    expect(a.conn.closeCode).toBe(4005);
    // The old socket's close does not disconnect the player: the new one is live.
    await h.core.onClose(a.conn);
    expect(h.state.players[0]?.connected).toBe(true);
    // welcome comes before state on the resumed socket
    const order = r.msgs.map((m) => m.t);
    expect(order.indexOf("welcome")).toBeLessThan(order.lastIndexOf("state"));
    expect(tv.open).toBe(true);
  });

  it("resume after a disconnect dispatches RECONNECT (connected again, broadcast)", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const a = await h.player(0);
    a.conn.close(1001);
    await h.core.onClose(a.conn);
    expect(h.state.players[0]?.connected).toBe(false);
    const seqBefore = h.state.version;
    await h.resume(a.token);
    expect(h.state.players[0]?.connected).toBe(true);
    expect(h.state.version).toBe(seqBefore + 1);
    const tvPlayers = tv.lastView().players as { id: string; connected: boolean }[];
    expect(tvPlayers[0]).toMatchObject({ id: a.pid, connected: true });
  });

  it("resume with an unknown token → RESUME_INVALID then spectator state", async () => {
    const h = await new Harness().init();
    const r = await h.resume("a".repeat(32));
    expect(r.errors()).toEqual(["RESUME_INVALID"]);
    expect(r.lastView().me).toBeNull();
    expect(r.state?.role).toBe("player");
    expect(r.state?.playerId).toBeNull();
  });

  it("resume of a kicked player → RESUME_INVALID", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const ps = [await h.player(0), await h.player(1), await h.player(2)];
    await h.act(tv, { type: "START" });
    expect(h.state.phase).toBe("ROLE_REVEAL");
    await h.act(tv, { type: "KICK", playerId: ps[0]!.pid });
    expect(h.core.peek().sessions[ps[0]!.pid]?.kicked).toBe(true);
    const r = await h.resume(ps[0]!.token);
    expect(r.errors()).toEqual(["RESUME_INVALID"]);
    expect(r.state?.playerId).toBeNull();
  });

  it("a second hello on a non-pending socket → BAD_MESSAGE and no rebinding", async () => {
    const h = await new Harness().init();
    const a = await h.player(0);
    const b = await h.player(1);
    await h.send(b.conn, { v: 1, t: "hello", role: "player", resumeToken: a.token });
    expect(b.conn.errors()).toEqual(["BAD_MESSAGE"]);
    expect(b.conn.state?.playerId).toBe(b.pid);
    await h.send(b.conn, { v: 1, t: "hello", role: "tv", tvToken: TV_TOKEN });
    expect(b.conn.errors()).toEqual(["BAD_MESSAGE", "BAD_MESSAGE"]);
    expect(b.conn.state?.role).toBe("player");
    expect(a.conn.open).toBe(true);
  });

  it("lobby seat expiry → resume gives RESUME_INVALID and deletes the session → join works", async () => {
    const h = await new Harness().init();
    await h.tv();
    const a = await h.player(0);
    await h.player(1);
    a.conn.close(1001);
    await h.core.onClose(a.conn);
    h.advance(SEAT_HOLD_MS + 1);
    await h.core.onAlarm();
    expect(h.state.players.map((p) => p.id)).not.toContain(a.pid);
    // Session pruned with the seat (§7.5 session pruning).
    expect(h.core.peek().sessions[a.pid]).toBeUndefined();
    const r = await h.resume(a.token);
    expect(r.errors()).toEqual(["RESUME_INVALID"]);
    await h.send(r, { v: 1, t: "join", name: "Back Again", color: "coral", locale: "en" });
    expect(r.last("welcome")).toBeDefined();
    expect(r.last("welcome")?.playerId).not.toBe(a.pid);
  });

  it("a session whose player is gone (but not pruned) is deleted on resume", async () => {
    const h = await new Harness().init();
    const a = await h.player(0);
    // Simulate a stale record: the session survives in storage but the player is no longer in the state.
    const state = await h.storage.get<{ players: unknown[] }>("state");
    await h.storage.put("state", { ...state!, players: [], hostPlayerId: null });
    a.conn.close(1001);
    const h2 = new Harness({ storage: h.storage, conns: h.conns, now: h.now });
    await h2.core.start();
    expect(h2.core.peek().sessions[a.pid]).toBeDefined();
    const r = await h2.resume(a.token);
    expect(r.errors()).toEqual(["RESUME_INVALID"]);
    expect(h2.core.peek().sessions[a.pid]).toBeUndefined();
    expect((await h.storage.get<Record<string, unknown>>("sessions"))?.[a.pid]).toBeUndefined();
  });

  it("pending socket: join/action before hello → NOT_AUTHENTICATED", async () => {
    const h = await new Harness().init();
    const c = await h.connect();
    await h.send(c, { v: 1, t: "join", name: "X", color: "coral", locale: "en" });
    await h.act(c, { type: "START" }, "a1");
    expect(c.errors()).toEqual(["NOT_AUTHENTICATED", "NOT_AUTHENTICATED"]);
    expect(c.last("error")?.ref).toBe("a1");
  });

  it("connect to a room that was never created → ROOM_NOT_FOUND + 4004 + deleteAll", async () => {
    const h = new Harness();
    const c = await h.connect();
    expect(c.errors()).toEqual(["ROOM_NOT_FOUND"]);
    expect(c.closeCode).toBe(4004);
    expect(h.storage.deleteAllCalls).toBe(1);
  });

  it("missing or invalid cid → 4000", async () => {
    const h = await new Harness().init();
    expect((await h.connect({ cid: null })).closeCode).toBe(4000);
    expect((await h.connect({ cid: "short" })).closeCode).toBe(4000);
    expect((await h.connect({ cid: "bad_chars!!" })).closeCode).toBe(4000);
    expect((await h.connect({ cid: "Good-cid-1234" })).closeCode).toBeNull();
  });
});
