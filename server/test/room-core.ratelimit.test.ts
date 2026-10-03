import { describe, expect, it } from "vitest";
import { MAX_CONNECTIONS_PER_ROOM, MAX_PENDING_CONNECTIONS, MSG_MAX_BYTES, PING_FRAME, PONG_FRAME, RATE_BURST } from "@mishana/shared/constants";
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

  it("connection cap: the 41st socket → 4009", async () => {
    const h = await new Harness().init();
    for (let i = 0; i < MAX_CONNECTIONS_PER_ROOM; i++) {
      const c = await h.spectator();
      expect(c.open).toBe(true);
    }
    const extra = await h.connect();
    expect(extra.closeCode).toBe(4009);
  });

  it("pending cap: the 11th never-hello'd socket → 4009", async () => {
    const h = await new Harness().init();
    for (let i = 0; i < MAX_PENDING_CONNECTIONS; i++) expect((await h.connect()).open).toBe(true);
    expect((await h.connect()).closeCode).toBe(4009);
    // Saying hello frees a pending slot.
    const first = h.conns.all[0]!;
    await h.send(first, { v: 1, t: "hello", role: "player" });
    expect((await h.connect()).open).toBe(true);
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
