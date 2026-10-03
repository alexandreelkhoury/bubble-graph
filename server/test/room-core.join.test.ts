import { describe, expect, it } from "vitest";
import { JOINS_PER_MIN_PER_IP, MAX_PLAYERS } from "@mishana/shared/constants";
import { Harness } from "./support/fakes";

describe("RoomCore join", () => {
  it("join → welcome to the joiner + state broadcast to everyone", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const spec = await h.spectator();
    tv.clear();
    spec.clear();
    const a = await h.player(0);
    expect(a.pid).toMatch(/^p_[0-9a-f]{24}$/);
    expect(a.token).toMatch(/^[0-9a-f]{32}$/);
    const msgs = a.conn.msgs.map((m) => m.t);
    expect(msgs.slice(-2)).toEqual(["welcome", "state"]);
    expect((a.conn.lastView().me as { id: string }).id).toBe(a.pid);
    expect((tv.lastView().players as unknown[]).length).toBe(1);
    expect(spec.lastView().me).toBeNull();
    expect((spec.lastView().players as unknown[]).length).toBe(1);
    // Token stored hashed only.
    const stored = JSON.stringify(await h.storage.get("sessions"));
    expect(stored).not.toContain(a.token);
    expect(h.state.hostPlayerId).toBe(a.pid);
  });

  it("ALREADY_JOINED on a joined connection; NOT_AUTHENTICATED for tv and pending", async () => {
    const h = await new Harness().init();
    const a = await h.player(0);
    await h.send(a.conn, { v: 1, t: "join", name: "Again", color: "azure", locale: "en" });
    expect(a.conn.errors()).toEqual(["ALREADY_JOINED"]);
    const tv = await h.tv();
    await h.send(tv, { v: 1, t: "join", name: "TV", color: "azure", locale: "en" });
    expect(tv.errors()).toEqual(["NOT_AUTHENTICATED"]);
    const pending = await h.connect();
    await h.send(pending, { v: 1, t: "join", name: "P", color: "azure", locale: "en" });
    expect(pending.errors()).toEqual(["NOT_AUTHENTICATED"]);
  });

  it("12 joins from one IP succeed; the 31st join in a minute from one IP → RATE_LIMITED", async () => {
    const h = await new Harness().init();
    const ip = "198.51.100.1";
    for (let i = 0; i < MAX_PLAYERS; i++) await h.player(i, { ip });
    expect(h.state.players).toHaveLength(12);
    const extra = await h.spectator({ ip });
    const codes: string[] = [];
    for (let i = MAX_PLAYERS; i < JOINS_PER_MIN_PER_IP + 1; i++) {
      await h.send(extra, { v: 1, t: "join", name: `Extra ${i}`, color: "coral", locale: "en" }, 300);
      codes.push(extra.errors().at(-1)!);
    }
    expect(codes.slice(0, -1).every((c) => c === "ROOM_FULL")).toBe(true);
    expect(codes.at(-1)).toBe("RATE_LIMITED");
    // Another IP is unaffected (gets ROOM_FULL, not RATE_LIMITED).
    const other = await h.spectator({ ip: "198.51.100.2" });
    await h.send(other, { v: 1, t: "join", name: "Other", color: "coral", locale: "en" });
    expect(other.errors()).toEqual(["ROOM_FULL"]);
    // The window slides: after a minute the first IP may try again.
    h.advance(61_000);
    await h.send(extra, { v: 1, t: "join", name: "Later", color: "coral", locale: "en" });
    expect(extra.errors().at(-1)).toBe("ROOM_FULL");
  });

  it("name sanitising: bidi controls stripped, long names cut, empty → NAME_INVALID", async () => {
    const h = await new Harness().init();
    const a = await h.spectator();
    await h.send(a, { v: 1, t: "join", name: "‮abc‬  def ", color: "coral", locale: "en" });
    expect(h.state.players[0]?.name).toBe("abc def");
    const b = await h.spectator();
    await h.send(b, { v: 1, t: "join", name: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", color: "azure", locale: "en" });
    expect(h.state.players[1]?.name).toBe("ABCDEFGHIJKLMNOP");
    const c = await h.spectator();
    await h.send(c, { v: 1, t: "join", name: "‎‏ ", color: "lemon", locale: "en" });
    expect(c.errors()).toEqual(["NAME_INVALID"]);
    await h.send(c, { v: 1, t: "join", name: "ABC DEF", color: "lemon", locale: "en" });
    expect(c.errors()).toEqual(["NAME_INVALID", "NAME_TAKEN"]);
    await h.send(c, { v: 1, t: "join", name: "Zed", color: "coral", locale: "en" });
    expect(c.errors().at(-1)).toBe("COLOR_TAKEN");
  });

  it("join after START → ROOM_LOCKED", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    for (let i = 0; i < 3; i++) await h.player(i);
    await h.act(tv, { type: "START" });
    const late = await h.spectator();
    await h.send(late, { v: 1, t: "join", name: "Late", color: "plum", locale: "en" });
    expect(late.errors()).toEqual(["ROOM_LOCKED"]);
  });
});
