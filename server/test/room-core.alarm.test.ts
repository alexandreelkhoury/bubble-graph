import { describe, expect, it } from "vitest";
import { HELLO_TIMEOUT_MS, ROOM_TV_GONE_TTL_MS, ROOM_TV_MAX_TTL_MS } from "@mishana/shared/constants";
import { nextWakeAt } from "@mishana/shared/engine";
import { expiresAt } from "../src/room-core";
import { FakeConnections, Harness, T0, TV_TOKEN } from "./support/fakes";
import { sha256hex } from "../src/tokens";

describe("RoomCore alarm", () => {
  it("initRoom schedules the TV-gone expiry (no TV yet)", async () => {
    const h = await new Harness().init();
    expect(h.core.peek().meta!.tvLeftAt).toBe(T0);
    expect(h.storage.alarm).toBe(T0 + ROOM_TV_GONE_TTL_MS);
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
    expect(h.storage.alarm).toBeLessThan(expiresAt(meta, true));
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
    expect(h.storage.alarm).toBe(expiresAt(h.core.peek().meta!, true));
  });

  it("TV connected: an empty lobby never expires at 15 min; the 12 h safety cap since the last activity applies", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const meta = h.core.peek().meta!;
    expect(meta.tvLeftAt).toBeNull();
    expect(h.storage.alarm).toBe(meta.lastActivityAt + ROOM_TV_MAX_TTL_MS);
    h.now = T0 + ROOM_TV_GONE_TTL_MS + 60_000;
    await h.core.onAlarm();
    expect(tv.open).toBe(true);
    h.now = meta.lastActivityAt + ROOM_TV_MAX_TTL_MS - 1;
    await h.core.onAlarm();
    expect(tv.open).toBe(true);
    h.now += 1;
    await h.core.onAlarm();
    expect(tv.errors()).toEqual(["ROOM_EXPIRED"]);
    expect(tv.closeCode).toBe(4010);
    expect(h.storage.map.size).toBe(0);
    expect(h.storage.alarm).toBeNull();
    expect(h.storage.deleteAllCalls).toBeGreaterThan(1);
  });

  it("no TV ever connects: the room expires 15 min after creation", async () => {
    const h = await new Harness().init();
    const p = await h.spectator();
    h.now = T0 + ROOM_TV_GONE_TTL_MS - 1;
    await h.core.onAlarm();
    expect(p.open).toBe(true);
    h.now = T0 + ROOM_TV_GONE_TTL_MS;
    await h.core.onAlarm();
    expect(p.closeCode).toBe(4010);
    expect(h.storage.map.size).toBe(0);
  });

  it("TV connected: RESULTS and a long idle game stay alive for hours", async () => {
    const h = await new Harness().init();
    const { tv, ps } = await h.startedGame();
    await h.playToResults(tv, ps);
    h.advance(3 * 60 * 60_000);
    await h.core.onAlarm();
    expect(tv.open).toBe(true);
    expect(h.state.phase).toBe("RESULTS");
    expect(h.storage.alarm).toBe(expiresAt(h.core.peek().meta!, true));
  });

  it("TV disconnects → expires 15 min later; players keep it alive no longer", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const a = await h.player(0);
    h.advance(60 * 60_000);
    tv.open = false;
    await h.core.onClose(tv);
    const leftAt = h.now;
    expect(h.core.peek().meta!.tvLeftAt).toBe(leftAt);
    expect((await h.storage.get<{ tvLeftAt: number | null }>("meta"))!.tvLeftAt).toBe(leftAt);
    expect(h.storage.alarm).toBe(leftAt + ROOM_TV_GONE_TTL_MS);
    h.advance(2 * 60_000);
    await h.act(a.conn, { type: "UPDATE_SETTINGS", patch: { clueSeconds: 30 } });
    expect(h.storage.alarm).toBe(leftAt + ROOM_TV_GONE_TTL_MS);
    h.now = leftAt + ROOM_TV_GONE_TTL_MS - 1;
    await h.core.onAlarm();
    expect(a.conn.open).toBe(true);
    h.now += 1;
    await h.core.onAlarm();
    expect(a.conn.closeCode).toBe(4010);
    expect(h.storage.map.size).toBe(0);
  });

  it("TV reconnects within 15 min → the room lives on (no expiry clock while connected)", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    tv.open = false;
    await h.core.onClose(tv);
    h.advance(10 * 60_000);
    const tv2 = await h.tv();
    expect(h.core.peek().meta!.tvLeftAt).toBeNull();
    h.advance(10 * 60_000);
    await h.core.onAlarm();
    expect(tv2.open).toBe(true);
    expect(h.storage.alarm).toBe(h.core.peek().meta!.lastActivityAt + ROOM_TV_MAX_TTL_MS);
  });

  it("a replaced TV socket closing does not start the TV-gone clock", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const tv2 = await h.tv();
    expect(tv.closeCode).toBe(4005);
    await h.core.onClose(tv);
    expect(h.core.peek().meta!.tvLeftAt).toBeNull();
    expect(tv2.open).toBe(true);
    // The closing socket itself still listed (close not finished) does not count as a connected TV either.
    await h.core.onClose(tv2);
    expect(h.core.peek().meta!.tvLeftAt).toBe(h.now);
  });

  it("an errored TV socket (onError → onClose) twice is idempotent", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    tv.open = false;
    await h.core.onClose(tv);
    const at = h.core.peek().meta!.tvLeftAt;
    h.advance(1000);
    await h.core.onClose(tv);
    expect(h.core.peek().meta!.tvLeftAt).toBe(at);
  });

  it("hibernation: a woken instance sees the hello'd TV socket via its attachment and keeps the room", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    h.advance(60 * 60_000);
    h.core = h.makeCore();
    await h.core.start();
    await h.core.onAlarm();
    expect(tv.open).toBe(true);
    expect(h.core.peek().meta!.tvLeftAt).toBeNull();
  });

  it("DO reset with the TV socket gone unseen: the clock starts at the first wake-up and later wakes do not push it", async () => {
    const h = await new Harness().init();
    await h.tv();
    h.advance(60 * 60_000);
    const empty = new FakeConnections();
    h.core = h.makeCore(empty);
    await h.core.start();
    const woke = h.now;
    expect(h.core.peek().meta!.tvLeftAt).toBe(woke);
    expect(h.storage.alarm).toBe(woke + ROOM_TV_GONE_TTL_MS);
    h.advance(5 * 60_000);
    h.core = h.makeCore(empty);
    await h.core.start();
    expect(h.core.peek().meta!.tvLeftAt).toBe(woke);
    h.now = woke + ROOM_TV_GONE_TTL_MS;
    await h.core.onAlarm();
    expect(h.storage.map.size).toBe(0);
  });

  it("an older stored meta without tvLeftAt: no TV → the clock starts at the alarm, never expires on the spot", async () => {
    const h = await new Harness().init();
    const meta = (await h.storage.get<Record<string, unknown>>("meta"))!;
    delete meta.tvLeftAt;
    meta.resultsAt = null;
    await h.storage.put({ meta });
    h.advance(5 * 60 * 60_000);
    h.core = h.makeCore();
    await h.core.onAlarm();
    expect(h.core.peek().meta!.tvLeftAt).toBe(h.now);
    expect(h.storage.alarm).toBe(h.now + ROOM_TV_GONE_TTL_MS);
  });

  it("expiresAt: TV connected → lastActivityAt + 12 h; no TV → tvLeftAt (else lastActivityAt) + 15 min", () => {
    const base = { schema: 1, code: "KXRT", tvTokenHash: "", joinUrl: "", createdAt: 0, lastActivityAt: 1000 } as const;
    expect(expiresAt({ ...base, tvLeftAt: 5000 }, true)).toBe(1000 + ROOM_TV_MAX_TTL_MS);
    expect(expiresAt({ ...base, tvLeftAt: 5000 }, false)).toBe(5000 + ROOM_TV_GONE_TTL_MS);
    expect(expiresAt({ ...base }, false)).toBe(1000 + ROOM_TV_GONE_TTL_MS);
  });

  it("activity is written at most once per minute and pushes the 12 h cap", async () => {
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
    expect(h.storage.alarm).toBe(h.now + ROOM_TV_MAX_TTL_MS);
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
    // A connected TV keeps the room: still EXISTS long after 15 min.
    h.now = T0 + 60 * 60_000;
    expect(await h.core.initRoom({ tvTokenHash: hash, joinUrl: "https://x.test/KXRT", locale: "en", now: h.now, entitlement: null, billingMode: "google" })).toEqual({ ok: false, reason: "EXISTS" });
    // Expired (TV gone 15 min), but the alarm has not fired yet.
    tv.open = false;
    await h.core.onClose(tv);
    h.now += ROOM_TV_GONE_TTL_MS + 5;
    const newHash = await sha256hex("f".repeat(32));
    expect(await h.core.initRoom({ tvTokenHash: newHash, joinUrl: "https://x.test/KXRT", locale: "fr", now: h.now, entitlement: null, billingMode: "google" })).toEqual({ ok: true });
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
