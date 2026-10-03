import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SocketHandlers, SocketLike } from "../src/net/connection";

// session.ts wires DOM listeners; give the node environment the few globals it touches.
const listeners = new Map<string, Set<(e: unknown) => void>>();
const target = {
  addEventListener: (t: string, f: (e: unknown) => void) => { (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(f); },
  removeEventListener: (t: string, f: (e: unknown) => void) => { listeners.get(t)?.delete(f); },
};
const fire = (t: string, e: unknown = {}): void => { for (const f of listeners.get(t) ?? []) f(e); };
const wakeRequests: string[] = [];
beforeAll(() => {
  vi.stubGlobal("document", { ...target, visibilityState: "visible" });
  vi.stubGlobal("window", target);
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("navigator", {
    wakeLock: {
      request: async (type: string) => {
        wakeRequests.push(type);
        return { released: false, addEventListener() {}, release: async () => undefined };
      },
    },
  });
});

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  constructor(public h: SocketHandlers) {}
  send(d: string) { this.sent.push(d); }
  close(code = 1000) { if (this.readyState < 2) { this.readyState = 3; this.h.close(code); } }
  reconnect(code = 1000) { if (this.readyState < 2) { this.readyState = 2; this.h.close(code); } this.readyState = 0; }
  open() { this.readyState = 1; this.h.open(); }
  serverClose(code: number) { this.readyState = 3; this.h.close(code); }
  msg(o: unknown) { this.h.message(JSON.stringify(o)); }
}

const SETTINGS = {};
function playerView(me: { id: string } | null, seq = 1) {
  return {
    v: 1, t: "state", seq, serverNow: Date.now(),
    view: {
      kind: "player", roomCode: "KXQP", phase: "LOBBY", me, players: [], history: [], speakingOrder: [], currentSpeakerId: null,
      gameNumber: 0, round: 0, settings: SETTINGS, result: null, hostPlayerId: null,
    },
  };
}

async function load() {
  const session = await import("../src/state/session");
  const store = await import("../src/state/store");
  let sock!: FakeSocket;
  session.startSession("KXQP", (h) => (sock = new FakeSocket(h)));
  return { session, store, sock: () => sock };
}

describe("session", () => {
  afterEach(async () => {
    (await import("../src/state/session")).stopSession();
    vi.resetModules();
    listeners.clear();
    wakeRequests.length = 0;
  });

  it("a join lost with the socket never leaves joinPending stuck", async () => {
    const { session, store, sock } = await load();
    sock().open();
    sock().msg(playerView(null, 1));
    expect(session.join("Rami", "coral" as never)).toBe(true);
    expect(store.joinPending.value).toBe(true);
    sock().serverClose(1006); // dropped before welcome
    expect(store.joinPending.value).toBe(false);
    sock().open(); // hello without a token (none saved)
    sock().msg(playerView(null, 1));
    expect(store.joinPending.value).toBe(false);
    expect(store.view.value?.me).toBeNull();
  });

  it("a resumed seat (welcome without a Join tap) wants the wake lock and retries it on a tap", async () => {
    const { store, sock } = await load();
    sock().open();
    sock().msg({ v: 1, t: "welcome", playerId: "p_1", resumeToken: "tok", roomCode: "KXQP" });
    sock().msg(playerView({ id: "p_1" }, 2));
    await Promise.resolve();
    expect(wakeRequests.length).toBeGreaterThanOrEqual(1);
    expect(store.view.value?.me).toEqual({ id: "p_1" });
    const before = wakeRequests.length;
    fire("pointerdown");
    await Promise.resolve();
    // Already held: a tap doesn't re-request.
    expect(wakeRequests.length).toBe(before);
  });

  it("counts a resync on the first state after a reconnect", async () => {
    const { store, sock } = await load();
    sock().open();
    sock().msg(playerView(null, 1));
    const r0 = store.resyncs.value;
    sock().serverClose(1006);
    sock().open();
    expect(store.resyncs.value).toBe(r0);
    sock().msg(playerView(null, 1));
    expect(store.resyncs.value).toBe(r0 + 1);
    sock().msg(playerView(null, 2));
    expect(store.resyncs.value).toBe(r0 + 1);
  });
});
