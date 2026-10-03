import { describe, expect, it } from "vitest";
import { CLUE_GRACE_MS } from "@mishana/shared/constants";
import { FakeConnections, Harness } from "./support/fakes";
import type { FakeConn } from "./support/fakes";

async function midGame(clueSeconds = 0) {
  const h = await new Harness().init();
  const tv = await h.tv();
  const ps = [];
  for (let i = 0; i < 4; i++) ps.push(await h.player(i));
  await h.act(tv, { type: "UPDATE_SETTINGS", patch: { clueSeconds, voteSeconds: 0, revealSeconds: 0, guessSeconds: 0 } });
  await h.act(tv, { type: "START" });
  for (const p of ps) await h.act(p.conn, { type: "READY" });
  expect(h.state.phase).toBe("CLUES");
  return { h, tv, ps };
}

function connStates(conns: FakeConn[]) {
  return conns.map((c) => structuredClone(c.state));
}

describe("RoomCore hibernation / restore", () => {
  it("a recreated RoomCore on the same storage behaves identically", async () => {
    const { h, tv, ps } = await midGame();
    const all = [tv, ...ps.map((p) => p.conn)];
    const snap = h.storage.snapshot();
    const cs = connStates(all);
    const now0 = h.now;

    const script = async (core = h.core): Promise<unknown[]> => {
      const out: unknown[] = [];
      h.core = core;
      const speaker = (): FakeConn => ps.find((p) => p.pid === h.state.speakingOrder[h.state.turnIdx])!.conn;
      for (let i = 0; i < 3; i++) {
        await h.act(speaker(), { type: "CLUE_DONE" });
        out.push(structuredClone(h.state));
      }
      await h.act(tv, { type: "HOST_ADVANCE" });
      out.push(structuredClone(h.state));
      out.push(all.map((c) => c.last("state")?.seq));
      return out;
    };

    const original = await script();
    // Rewind storage, sockets and clock; "wake" a brand-new instance and replay.
    h.storage.restore(snap);
    all.forEach((c, i) => c.setState(cs[i]!));
    h.now = now0;
    const revived = h.makeCore();
    await revived.start();
    const replay = await script(revived);
    expect(replay).toEqual(original);
  });

  it("the cache is reloaded from storage, not kept from the old instance", async () => {
    const { h, tv } = await midGame();
    const fresh = h.makeCore();
    await fresh.start();
    expect(fresh.peek().state).toEqual(h.state);
    expect(fresh.peek().meta).toEqual(h.core.peek().meta);
    expect(fresh.peek().sessions).toEqual(h.core.peek().sessions);
    // And it keeps serving existing sockets (attachments survived).
    h.core = fresh;
    tv.clear();
    await h.act(tv, { type: "HOST_ADVANCE" });
    expect(tv.last("state")).toBeDefined();
  });

  it("restart with an empty connections list → players become disconnected; the speaker keeps the turn with a grace deadline", async () => {
    const { h } = await midGame(0);
    expect(h.state.deadline).toBeNull();
    const speaker = h.state.speakingOrder[h.state.turnIdx];
    const v = h.state.version;
    const revived = h.makeCore(new FakeConnections());
    await revived.start();
    const s = revived.peek().state!;
    expect(s.players.every((p) => !p.connected)).toBe(true);
    expect(s.version).toBeGreaterThan(v);
    expect(s.speakingOrder[s.turnIdx]).toBe(speaker);
    expect(s.deadline).toMatchObject({ kind: "CLUE", at: h.now + CLUE_GRACE_MS });
    // Persisted and the alarm follows the grace deadline.
    expect((await h.storage.get<{ version: number }>("state"))!.version).toBe(s.version);
    expect(h.storage.alarm).toBe(h.now + CLUE_GRACE_MS);
  });

  it("restart with all sockets alive → no change at all", async () => {
    const { h } = await midGame();
    const v = h.state.version;
    const revived = h.makeCore();
    await revived.start();
    expect(revived.peek().state!.version).toBe(v);
  });
});
