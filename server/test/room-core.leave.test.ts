// Leaving a running game over the real protocol (JAMAA-PLATFORM §2.3 "Leaving", "Empty game"): the phone's Leave
// (LEAVE + socket close), a closed tab (socket close only), rejoining with the same name and character, and the TV
// never left on a game nobody plays.
import { describe, expect, it } from "vitest";
import { GAME_ABANDON_MS, SEAT_HOLD_MS } from "@jamaa/shared/constants";
import { Harness } from "./support/fakes";
import type { FakeConn } from "./support/fakes";

const roomOf = (c: FakeConn) => c.lastView().room as { phase: string; hostPlayerId: string | null; members: { id: string; name: string; color: string; left: boolean }[] };

describe("RoomCore: leaving a running game", () => {
  it("the leaver rejoins with the same name and character (no NAME_TAKEN / COLOR_TAKEN from their own left seat)", async () => {
    const h = await new Harness().init();
    const { tv, ps } = await h.startedGame({ n: 4, ready: true });
    const p1 = ps[1]!;
    await h.act(p1.conn, { type: "LEAVE" });
    expect(p1.conn.closeCode).toBe(1000);
    expect(roomOf(tv).members.find((m) => m.id === p1.pid)?.left).toBe(true);
    // The same phone (its resume token was dropped by Leave) joins again as "Player 1" in azure.
    const again = await h.player(1);
    expect(again.conn.errors()).toEqual([]);
    expect(again.pid).not.toBe(p1.pid);
    expect(roomOf(tv).members.filter((m) => m.name === "Player 1").map((m) => m.left)).toEqual([true, false]);
    // The old token is dead.
    const old = await h.resume(p1.token);
    expect(old.errors()).toEqual(["RESUME_INVALID"]);
  });

  it("the host leaves → the next player is VIP; everyone leaves → the room is back in the HUB on every screen", async () => {
    const h = await new Harness().init();
    const { tv, ps } = await h.startedGame({ n: 3, ready: true });
    await h.act(ps[0]!.conn, { type: "LEAVE" });
    expect(h.room.phase).toBe("PLAYING");
    expect(h.room.hostPlayerId).toBe(ps[1]!.pid);
    await h.act(ps[1]!.conn, { type: "LEAVE" });
    await h.act(ps[2]!.conn, { type: "LEAVE" });
    expect(h.room).toMatchObject({ phase: "HUB", game: null, members: [], hostPlayerId: null });
    expect(roomOf(tv).phase).toBe("HUB");
    expect(tv.lastView().game).toBeNull();
  });

  it("every phone closed (no Leave) → the game ends after GAME_ABANDON_MS on the alarm, then the held seats expire", async () => {
    const h = await new Harness().init();
    const { tv, ps } = await h.startedGame({ n: 3, ready: true });
    for (const p of ps) await h.core.onClose(p.conn);
    expect(h.room.phase).toBe("PLAYING");
    const at = h.room.members.reduce((t, m) => Math.max(t, m.disconnectedAt ?? 0), 0) + GAME_ABANDON_MS;
    expect(h.storage.alarm).toBeLessThanOrEqual(at);
    h.now = at;
    await h.core.onAlarm();
    expect(h.room.phase).toBe("HUB");
    expect(roomOf(tv).phase).toBe("HUB");
    expect(h.room.members).toHaveLength(3);
    // A player who comes back in time resumes their seat in the HUB.
    const back = await h.resume(ps[0]!.token);
    expect(back.errors()).toEqual([]);
    h.now += SEAT_HOLD_MS;
    await h.core.onAlarm();
    expect(h.room.members.map((m) => m.id)).toEqual([ps[0]!.pid]);
  });
});
