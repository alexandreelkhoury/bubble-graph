import { describe, expect, it } from "vitest";
import { HELLO_TIMEOUT_MS, ROOM_EMPTY_TTL_MS, ROOM_IDLE_TTL_MS, ROOM_RESULTS_TTL_MS } from "@mishana/shared/constants";
import { nextWakeAt } from "@mishana/shared/engine";
import { expiresAt } from "../src/room-core";
import { Harness, T0, TV_TOKEN } from "./support/fakes";
import { sha256hex } from "../src/tokens";

describe("RoomCore alarm", () => {
  it("initRoom schedules the empty-room expiry", async () => {
    const h = await new Harness().init();
    expect(h.storage.alarm).toBe(T0 + ROOM_EMPTY_TTL_MS);
  });

  it("TICK on a due deadline advances the phase and broadcasts", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    for (let i = 0; i < 3; i++) await h.player(i);
    await h.act(tv, { type: "START" });
    expect(h.state.phase).toBe("ROLE_REVEAL");
    const dl = h.state.deadline!;
    expect(dl.kind).toBe("REVEAL");
    expect(h.storage.alarm).toBe(dl.at);
    const before = h.state.version;
    // An early alarm is a harmless no-op.
    h.now = dl.at - 1000;
    await h.core.onAlarm();
    expect(h.state.version).toBe(before);
    expect(h.storage.alarm).toBe(dl.at);
    h.now = dl.at;
    await h.core.onAlarm();
    expect(h.state.phase).toBe("CLUES");
    expect(tv.last("state")?.seq).toBe(h.state.version);
    expect(h.storage.alarm).toBe(nextWakeAt(h.state));
  });

  it("alarm = min(next wake, expiry, pending deadline)", async () => {
    const h = await new Harness().init();
    await h.tv();
    h.advance(5_000);
    await h.connect(); // pending
    expect(h.storage.alarm).toBe(h.now + HELLO_TIMEOUT_MS);
    const meta = h.core.peek().meta!;
    expect(h.storage.alarm).toBeLessThan(expiresAt(meta, h.state));
  });

  it("a never-hello'd socket is closed 4001 by the alarm", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const c = await h.connect();
    h.now = c.state!.openedAt + HELLO_TIMEOUT_MS;
    await h.core.onAlarm();
    expect(c.closeCode).toBe(4001);
    expect(tv.open).toBe(true);
    // Back to the expiry alarm once nobody is pending.
    expect(h.storage.alarm).toBe(expiresAt(h.core.peek().meta!, h.state));
  });

  it("expiry: empty lobby → 4010 + deleteAll", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    h.now = T0 + ROOM_EMPTY_TTL_MS;
    await h.core.onAlarm();
    expect(tv.errors()).toEqual(["ROOM_EXPIRED"]);
    expect(tv.closeCode).toBe(4010);
    expect(h.storage.map.size).toBe(0);
    expect(h.storage.alarm).toBeNull();
    expect(h.storage.deleteAllCalls).toBeGreaterThan(1);
  });

  it("expiry: idle room (players present) after 2 h without activity → 4010", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const a = await h.player(0);
    const meta = h.core.peek().meta!;
    expect(expiresAt(meta, h.state)).toBe(meta.lastActivityAt + ROOM_IDLE_TTL_MS);
    h.now = meta.lastActivityAt + ROOM_IDLE_TTL_MS - 1;
    await h.core.onAlarm();
    expect(tv.open).toBe(true);
    h.now += 1;
    await h.core.onAlarm();
    expect(tv.closeCode).toBe(4010);
    expect(a.conn.closeCode).toBe(4010);
    expect(h.storage.map.size).toBe(0);
  });

  it("activity is written at most once per minute and pushes the idle expiry", async () => {
    const h = await new Harness().init();
    await h.tv();
    const a = await h.player(0);
    const m0 = h.core.peek().meta!.lastActivityAt;
    await h.act(a.conn, { type: "UPDATE_SETTINGS", patch: { clueSeconds: 30 } });
    expect(h.core.peek().meta!.lastActivityAt).toBe(m0);
    h.advance(61_000);
    await h.act(a.conn, { type: "UPDATE_SETTINGS", patch: { clueSeconds: 35 } });
    expect(h.core.peek().meta!.lastActivityAt).toBe(h.now);
    expect((await h.storage.get<{ lastActivityAt: number }>("meta"))!.lastActivityAt).toBe(h.now);
  });

  it("expiry: RESULTS for 30 min → 4010", async () => {
    const h = await new Harness().init();
    const { tv, ps } = await h.startedGame();
    await h.playToResults(tv, ps);
    const meta = h.core.peek().meta!;
    expect(meta.resultsAt).not.toBeNull();
    expect(h.storage.alarm).toBe(meta.resultsAt! + ROOM_RESULTS_TTL_MS);
    h.now = meta.resultsAt! + ROOM_RESULTS_TTL_MS;
    await h.core.onAlarm();
    expect(tv.closeCode).toBe(4010);
    expect(ps.every((p) => p.conn.closeCode === 4010)).toBe(true);
    expect(h.storage.map.size).toBe(0);
  });

  it("meta missing → deleteAll", async () => {
    const h = new Harness();
    await h.storage.put("__junk", 1);
    await h.core.onAlarm();
    expect(h.storage.deleteAllCalls).toBe(1);
    expect(h.storage.map.size).toBe(0);
  });

  it("initRoom: EXISTS for a live room; on an expired room it closes old sockets 4010 and refreshes the cache", async () => {
    const h = await new Harness().init();
    const hash = await sha256hex(TV_TOKEN);
    expect(await h.core.initRoom({ tvTokenHash: hash, joinUrl: "https://x.test/KXRT", locale: "en", now: h.now + 1000, entitlement: null, billingMode: "google" })).toEqual({ ok: false, reason: "EXISTS" });
    const tv = await h.tv();
    const old = await h.spectator();
    const oldEpoch = old.state!.epoch;
    // Expired, but the alarm has not fired yet.
    h.now = T0 + ROOM_EMPTY_TTL_MS + 5;
    const newHash = await sha256hex("f".repeat(32));
    expect(await h.core.initRoom({ tvTokenHash: newHash, joinUrl: "https://x.test/KXRT", locale: "fr", now: h.now, entitlement: null, billingMode: "google" })).toEqual({ ok: true });
    expect(tv.closeCode).toBe(4010);
    expect(old.closeCode).toBe(4010);
    const meta = h.core.peek().meta!;
    expect(meta.createdAt).toBe(h.now);
    expect(meta.createdAt).not.toBe(oldEpoch);
    expect(meta.tvTokenHash).toBe(newHash);
    expect(h.state.settings.wordLocale).toBe("fr");
    expect(h.state.version).toBe(0);
    // New TV token works; the old one does not.
    const c1 = await h.connect();
    await h.send(c1, { v: 1, t: "hello", role: "tv", tvToken: TV_TOKEN });
    expect(c1.closeCode).toBe(4003);
    const c2 = await h.connect();
    await h.send(c2, { v: 1, t: "hello", role: "tv", tvToken: "f".repeat(32) });
    expect(c2.lastView().kind).toBe("tv");
  });

  it("initRoom never trusts the cache: a stale core with storage replaced underneath still answers EXISTS", async () => {
    const h = await new Harness().init();
    const stale = h.makeCore();
    expect(await stale.initRoom({ tvTokenHash: "0".repeat(64), joinUrl: "x", locale: "en", now: h.now, entitlement: null, billingMode: "google" })).toEqual({ ok: false, reason: "EXISTS" });
  });
});
