import { describe, expect, it } from "vitest";
import { Harness, seqs, strictlyIncreasing } from "./support/fakes";

async function startedGame(n = 4) {
  const h = await new Harness().init();
  return { h, ...(await h.startedGame({ n })) };
}

describe("RoomCore actions", () => {
  it("echoes the action id as error ref", async () => {
    const h = await new Harness().init();
    await h.tv();
    const a = await h.player(0);
    const b = await h.player(1);
    await h.act(b.conn, { type: "OPEN_GAME", gameId: "mishana" }, "req-42");
    expect(b.conn.last("error")).toMatchObject({ code: "NOT_HOST", messageKey: "error.notHost", ref: "req-42" });
    await h.open(a.conn);
    await h.act(a.conn, { type: "START_GAME" });
    expect(a.conn.last("error")).toMatchObject({ code: "NOT_ENOUGH_PLAYERS", ref: null });
    // Schema failure on an action with a valid id echoes it too (a v1 top-level in-game intent is not a v2 intent).
    await h.send(a.conn, { v: 2, t: "action", id: "bad-1", a: { type: "CAST_VOTE", targetId: "nope" } });
    expect(a.conn.last("error")).toMatchObject({ code: "BAD_MESSAGE", ref: "bad-1" });
  });

  it("KICK in LOBBY closes the target with 4006 and invalidates the token", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const a = await h.player(0);
    const b = await h.player(1);
    await h.act(tv, { type: "KICK", playerId: b.pid });
    expect(b.conn.errors()).toEqual(["KICKED"]);
    expect(b.conn.closeCode).toBe(4006);
    expect(h.room.members.map((p) => p.id)).toEqual([a.pid]);
    expect(h.core.peek().sessions[b.pid]).toBeUndefined();
    const r = await h.resume(b.token);
    expect(r.errors()).toEqual(["RESUME_INVALID"]);
  });

  it("KICK in-game keeps a kicked session until the game ends; onClose after KICK does not dispatch DISCONNECT", async () => {
    const { h, tv, ps } = await startedGame(4);
    const target = ps[3]!;
    await h.act(tv, { type: "KICK", playerId: target.pid });
    expect(target.conn.closeCode).toBe(4006);
    expect(h.core.peek().sessions[target.pid]).toEqual(expect.objectContaining({ kicked: true }));
    expect(h.room.members.find((m) => m.id === target.pid)?.left).toBe(true);
    const v = h.room.version;
    await h.core.onClose(target.conn);
    expect(h.room.version).toBe(v);
    expect((await h.resume(target.token)).errors()).toEqual(["RESUME_INVALID"]);
    // The kick may have ended the game (it removed the only impostor): ABORT before the outcome, BACK_TO_SETUP after.
    await h.act(tv, { type: h.state.phase === "RESULTS" ? "BACK_TO_SETUP" : "ABORT_GAME" });
    expect(h.room.phase).toBe("SETUP");
    expect(h.room.members.map((p) => p.id)).not.toContain(target.pid);
    expect(h.core.peek().sessions[target.pid]).toBeUndefined();
    expect(Object.keys(h.core.peek().sessions).sort()).toEqual(ps.slice(0, 3).map((p) => p.pid).sort());
  });

  it("LEAVE deletes the session and closes the leaver's sockets with 1000", async () => {
    const { h, ps } = await startedGame(4);
    const leaver = ps[1]!;
    await h.act(leaver.conn, { type: "LEAVE" });
    expect(leaver.conn.closeCode).toBe(1000);
    expect(h.core.peek().sessions[leaver.pid]).toBeUndefined();
    expect(h.state.players.find((p) => p.id === leaver.pid)?.left).toBe(true);
    expect(h.room.members.find((p) => p.id === leaver.pid)?.left).toBe(true);
    expect((await h.resume(leaver.token)).errors()).toEqual(["RESUME_INVALID"]);
  });

  it("sessions are pruned when the game ends (REPLAY removes left members)", async () => {
    const { h, tv, ps } = await startedGame(5);
    await h.act(ps[4]!.conn, { type: "KICK", playerId: ps[3]!.pid });
    await h.game(ps[3]!.conn, { type: "READY" }); // ps[3] is still connected: the VIP may not kick it
    await h.act(tv, { type: "KICK", playerId: ps[4]!.pid });
    expect(h.core.peek().sessions[ps[4]!.pid]?.kicked).toBe(true);
    await h.playToResults(tv, ps.slice(0, 4));
    expect(h.state.phase).toBe("RESULTS");
    await h.act(tv, { type: "REPLAY" });
    expect(h.room.phase).toBe("PLAYING");
    expect(Object.keys(h.core.peek().sessions).sort()).toEqual(h.room.members.map((p) => p.id).sort());
    expect(h.room.members).toHaveLength(4);
  });

  it("seq is strictly increasing on every connection and each connection gets its own projection", async () => {
    const { h, tv, ps } = await startedGame(4);
    for (const p of ps) await h.game(p.conn, { type: "READY" });
    await h.playToResults(tv, ps);
    for (const c of [tv, ...ps.map((p) => p.conn)]) expect(strictlyIncreasing(seqs(c))).toBe(true);
    // During the game every phone saw only its own word.
    for (const p of ps) {
      const states = p.conn.of("state").map((m) => m.view as { kind: string; me: { id: string } | null; game: { me: { id: string } | null } | null });
      expect(states.every((v) => v.kind === "player")).toBe(true);
      expect(states.filter((v) => v.me !== null).every((v) => v.me!.id === p.pid)).toBe(true);
      expect(states.filter((v) => v.game?.me).every((v) => v.game!.me!.id === p.pid)).toBe(true);
    }
    expect(tv.of("state").every((m) => (m.view as { kind: string }).kind === "tv")).toBe(true);
    // The TV never saw a word before RESULTS.
    const words = [h.state.result!.civilianWord.text, h.state.result!.undercoverWord.text];
    for (const m of tv.of("state")) {
      const v = m.view as { game: { phase: string } | null };
      if (v.game?.phase === "RESULTS") continue;
      for (const w of words) expect(JSON.stringify(v)).not.toContain(`"${w}"`);
    }
  });

  it("a no-op reduce sends nothing", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    await h.player(0);
    await h.open(tv);
    tv.clear();
    await h.settings(tv, {});
    expect(tv.msgs).toEqual([]);
  });

  it("errors in the pipeline are answered with INTERNAL, without leaking details", async () => {
    const h = await new Harness().init();
    await h.tv();
    const a = await h.player(0);
    await h.open(a.conn);
    const orig = h.storage.put.bind(h.storage);
    h.storage.put = async () => {
      throw new Error("disk full");
    };
    const errs: unknown[] = [];
    const origErr = console.error;
    console.error = (...x: unknown[]) => errs.push(x);
    try {
      await h.settings(a.conn, { clueSeconds: 30 });
    } finally {
      console.error = origErr;
      h.storage.put = orig;
    }
    expect(a.conn.errors()).toEqual(["INTERNAL"]);
    expect(JSON.stringify(errs)).not.toContain("disk full");
    expect(JSON.stringify(errs)).toContain("KXRT");
  });
});
