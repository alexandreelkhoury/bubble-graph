import { describe, expect, it } from "vitest";
import { MAX_CONNECTIONS_PER_ROOM, MAX_PENDING_CONNECTIONS, MSG_MAX_BYTES, PING_FRAME, PONG_FRAME, RATE_BURST } from "@mishana/shared/constants";
import { MAX_SPECTATORS_PER_ROOM } from "../src/room-core";
import { Harness } from "./support/fakes";

describe("RoomCore rate limits and frame checks", () => {
  it("token bucket: burst 10, then RATE_LIMITED; refills at 5/s", async () => {
    const h = await new Harness().init();
    const c = await h.connect(); // fresh bucket (hello would spend a token)
    c.clear();
    for (let i = 0; i < RATE_BURST; i++) await h.send(c, PING_FRAME, 0);
    expect(c.raw).toEqual(Array(RATE_BURST).fill(PONG_FRAME));
    await h.send(c, PING_FRAME, 0);
    expect(c.errors()).toEqual(["RATE_LIMITED"]);
    await h.send(c, PING_FRAME, 200); // one token back after 200 ms
    expect(c.raw.at(-1)).toBe(PONG_FRAME);
    expect(c.open).toBe(true);
  });

  it("3 strikes within 10 s → close 4008", async () => {
    const h = await new Harness().init();
    const c = await h.connect(); // fresh bucket (hello would spend a token)
    for (let i = 0; i < RATE_BURST; i++) await h.send(c, PING_FRAME, 0);
    await h.send(c, PING_FRAME, 0);
    await h.send(c, PING_FRAME, 0);
    expect(c.open).toBe(true);
    await h.send(c, PING_FRAME, 0);
    expect(c.errors()).toEqual(["RATE_LIMITED", "RATE_LIMITED", "RATE_LIMITED"]);
    expect(c.closeCode).toBe(4008);
  });

  it("strikes older than 10 s are forgotten", async () => {
    const h = await new Harness().init();
    const c = await h.connect(); // fresh bucket (hello would spend a token)
    for (let i = 0; i < RATE_BURST; i++) await h.send(c, PING_FRAME, 0);
    await h.send(c, PING_FRAME, 0);
    await h.send(c, PING_FRAME, 0);
    h.advance(10_001);
    for (let i = 0; i < RATE_BURST; i++) await h.send(c, PING_FRAME, 0);
    await h.send(c, PING_FRAME, 0);
    expect(c.open).toBe(true);
  });

  it("oversize frame (UTF-8 bytes) → BAD_MESSAGE, socket stays open", async () => {
    const h = await new Harness().init();
    const c = await h.spectator();
    // 2049 chars but 4098 UTF-8 bytes: a char-length check would let it through.
    const name = "é".repeat(2049);
    const frame = JSON.stringify({ v: 1, t: "join", name, color: "coral", locale: "en" });
    expect(frame.length).toBeLessThan(MSG_MAX_BYTES + 100);
    expect(new TextEncoder().encode(frame).length).toBeGreaterThan(MSG_MAX_BYTES);
    await h.send(c, frame);
    expect(c.errors()).toEqual(["BAD_MESSAGE"]);
    expect(c.open).toBe(true);
    expect(h.state.players).toHaveLength(0);
  });

  it("binary frame → BAD_MESSAGE", async () => {
    const h = await new Harness().init();
    const c = await h.spectator();
    await h.send(c, new TextEncoder().encode(PING_FRAME).buffer as ArrayBuffer);
    expect(c.errors()).toEqual(["BAD_MESSAGE"]);
    expect(c.open).toBe(true);
  });

  it("v:2 → UNSUPPORTED_VERSION + 4002 (not BAD_MESSAGE); garbage → BAD_MESSAGE", async () => {
    const h = await new Harness().init();
    const c = await h.connect();
    await h.send(c, "{not json");
    await h.send(c, "[1,2]");
    await h.send(c, '"str"');
    await h.send(c, JSON.stringify({ v: 1, t: "nope" }));
    expect(c.errors()).toEqual(["BAD_MESSAGE", "BAD_MESSAGE", "BAD_MESSAGE", "BAD_MESSAGE"]);
    expect(c.open).toBe(true);
    await h.send(c, JSON.stringify({ v: 2, t: "hello", role: "player" }));
    expect(c.errors().at(-1)).toBe("UNSUPPORTED_VERSION");
    expect(c.closeCode).toBe(4002);
  });

  it("ping is answered with the byte-exact pong even before hello", async () => {
    const h = await new Harness().init();
    const c = await h.connect();
    await h.send(c, PING_FRAME);
    expect(c.raw).toEqual([PONG_FRAME]);
  });

  it("connection cap: the 41st non-spectator socket → 4009", async () => {
    const h = await new Harness().init();
    // Real rooms cannot reach 40 non-spectators (pending ≤ 10, one TV, ≤ 12 seats): fake joined sockets.
    for (let i = 0; i < MAX_CONNECTIONS_PER_ROOM; i++) {
      const c = await h.spectator();
      expect(c.open).toBe(true);
      c.setState({ ...c.state!, playerId: `p_fake${i}` });
    }
    const extra = await h.connect();
    expect(extra.closeCode).toBe(4009);
  });

  it("spectators do not count toward the connection cap and have their own cap (17th → 4009)", async () => {
    const h = await new Harness().init();
    const a = await h.player(0);
    const specs = [];
    for (let i = 0; i < MAX_SPECTATORS_PER_ROOM; i++) specs.push(await h.spectator());
    expect(specs.every((c) => c.open)).toBe(true);
    const extra = await h.spectator();
    expect(extra.closeCode).toBe(4009);
    // The TV and a resume-token reconnect still get in while the spectator cap is full.
    const tv = await h.tv();
    expect(tv.open).toBe(true);
    expect(tv.last("state")).toBeDefined();
    const r = await h.resume(a.token);
    expect(r.open).toBe(true);
    expect(r.last("welcome")?.playerId).toBe(a.pid);
    // A pre-join phone that joins frees its spectator slot.
    expect((await h.spectator()).closeCode).toBe(4009);
    await h.send(specs[0]!, { v: 1, t: "join", name: "Late", color: "azure", locale: "en" });
    expect(specs[0]!.last("welcome")).toBeDefined();
    expect((await h.spectator()).open).toBe(true);
  });

  it("a spectator flood cannot lock the TV out (reviewed attack: 39 spectators + TV reconnect)", async () => {
    const h = await new Harness().init();
    for (let i = 0; i < 39; i++) await h.spectator();
    const tv = await h.tv();
    expect(tv.open).toBe(true);
    expect(tv.last("state")).toBeDefined();
  });

  it("pending cap: an 11th never-hello'd socket evicts the oldest pending one (4009)", async () => {
    const h = await new Harness().init();
    const first = await h.connect();
    for (let i = 1; i < MAX_PENDING_CONNECTIONS; i++) {
      h.advance(10);
      expect((await h.connect()).open).toBe(true);
    }
    h.advance(10);
    const newest = await h.connect();
    expect(newest.open).toBe(true);
    expect(first.closeCode).toBe(4009);
  });

  it("binary and oversize floods take tokens and strikes → 4008", async () => {
    const h = await new Harness().init();
    const c = await h.spectator();
    const bin = new TextEncoder().encode(PING_FRAME).buffer as ArrayBuffer;
    for (let i = 0; i < 3; i++) await h.send(c, bin, 0);
    expect(c.closeCode).toBe(4008);
    const d = await h.spectator();
    const big = "x".repeat(MSG_MAX_BYTES + 1);
    for (let i = 0; i < 3; i++) await h.send(d, big, 0);
    expect(d.closeCode).toBe(4008);
  });

  it("a spectator repeating hello does not refresh room activity", async () => {
    const h = await new Harness().init();
    const c = await h.spectator();
    const m0 = h.core.peek().meta!.lastActivityAt;
    for (let i = 0; i < 3; i++) {
      h.advance(61_000);
      await h.send(c, { v: 1, t: "hello", role: "player" });
    }
    expect(c.errors()).toEqual(["BAD_MESSAGE", "BAD_MESSAGE", "BAD_MESSAGE"]);
    expect(h.core.peek().meta!.lastActivityAt).toBe(m0);
  });

  it("a message from an older room epoch → ROOM_EXPIRED + 4010", async () => {
    const h = await new Harness().init();
    const c = await h.spectator();
    c.setState({ ...c.state!, epoch: c.state!.epoch - 1 });
    await h.send(c, { v: 1, t: "join", name: "X", color: "coral", locale: "en" });
    expect(c.errors()).toEqual(["ROOM_EXPIRED"]);
    expect(c.closeCode).toBe(4010);
  });
});
