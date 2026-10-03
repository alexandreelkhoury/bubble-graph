import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FATAL_CLOSE_CODES, PING_FRAME, PONG_FRAME, SLOW_RECONNECT_MS } from "@mishana/shared/constants";
import { Connection } from "../src/net/connection";
import type { ConnStatus, SocketHandlers, SocketLike } from "../src/net/connection";

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  closes = 0;
  reconnects = 0;
  constructor(public h: SocketHandlers) {}
  send(d: string) { if (this.readyState !== 1) throw new Error("send while not open"); this.sent.push(d); }
  /**
   * Mirrors partysocket 1.3.0 ws.js: close() and reconnect() on a CONNECTING/OPEN socket go through `_disconnect`,
   * which dispatches a synthetic CloseEvent (default code 1000) synchronously, before returning.
   */
  close(code = 1000) {
    this.closes++;
    if (this.readyState === 2 || this.readyState === 3) return;
    this.readyState = 3;
    this.h.close(code);
  }
  reconnect(code = 1000) {
    this.reconnects++;
    if (this.readyState === 0 || this.readyState === 1) {
      this.readyState = 2;
      this.h.close(code);
    }
    this.readyState = 0;
  }
  open() { this.readyState = 1; this.h.open(); }
  serverClose(code: number) { this.readyState = 3; this.h.close(code); }
  msg(o: unknown) { this.h.message(typeof o === "string" ? o : JSON.stringify(o)); }
}

function setup() {
  let sock!: FakeSocket;
  const states: number[] = [];
  const statuses: ConnStatus[] = [];
  const fatal: number[] = [];
  const errors: string[] = [];
  const welcomes: string[] = [];
  const conn = new Connection((h) => (sock = new FakeSocket(h)), {
    hello: () => '{"v":1,"t":"hello","role":"player"}',
    onState: (m) => states.push(m.seq),
    onWelcome: (m) => welcomes.push(m.playerId),
    onError: (m) => errors.push(m.code),
    onStatus: (s) => statuses.push(s),
    onFatal: (c) => fatal.push(c),
  });
  return { conn, sock: () => sock, states, statuses, fatal, errors, welcomes };
}
const state = (seq: number) => ({ v: 1, t: "state", seq, serverNow: 0, view: { kind: "player" } });

describe("Connection", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("sends hello on open and nothing while not OPEN", () => {
    const s = setup();
    expect(s.conn.action({ type: "READY" })).toBeNull();
    expect(s.conn.sendRaw(PING_FRAME)).toBe(false);
    expect(s.sock().sent).toEqual([]);
    s.sock().open();
    expect(s.sock().sent[0]).toBe('{"v":1,"t":"hello","role":"player"}');
    expect(s.statuses).toEqual(["open"]);
    const id = s.conn.action({ type: "READY" });
    expect(id).not.toBeNull();
    expect(JSON.parse(s.sock().sent[1]!)).toEqual({ v: 1, t: "action", id, a: { type: "READY" } });
  });

  it("stores state only when seq increases, resetting on each open", () => {
    const s = setup();
    s.sock().open();
    s.sock().msg(state(5));
    s.sock().msg(state(4));
    s.sock().msg(state(5));
    s.sock().msg(state(6));
    expect(s.states).toEqual([5, 6]);
    s.sock().serverClose(1006);
    s.sock().open();
    s.sock().msg(state(2)); // a new DO instance may restart lower; the filter resets per open
    expect(s.states).toEqual([5, 6, 2]);
  });

  it("dispatches welcome and error, ignores unknown t and junk", () => {
    const s = setup();
    s.sock().open();
    s.sock().msg({ v: 1, t: "welcome", playerId: "p_1", resumeToken: "x", roomCode: "KXQP" });
    s.sock().msg({ v: 1, t: "error", code: "NOT_HOST", messageKey: "error.notHost", ref: null });
    s.sock().msg({ v: 1, t: "future" });
    s.sock().msg({ error: "stack" });
    s.sock().msg("not json");
    s.sock().h.message(new ArrayBuffer(2));
    expect(s.welcomes).toEqual(["p_1"]);
    expect(s.errors).toEqual(["NOT_HOST"]);
  });

  it("errors never decide fatality; close codes do", () => {
    const s = setup();
    s.sock().open();
    s.sock().msg({ v: 1, t: "error", code: "KICKED", messageKey: "error.kicked", ref: null });
    expect(s.fatal).toEqual([]);
    s.sock().serverClose(4006);
    expect(s.fatal).toEqual([4006]);
    expect(s.sock().closes).toBe(1);
    expect(s.statuses.at(-1)).toBe("closed");
    s.conn.wake(); // a fatal socket never reconnects on visibility
    expect(s.sock().reconnects).toBe(0);
  });

  it.each([...FATAL_CLOSE_CODES])("close %i is fatal", (code) => {
    const s = setup();
    s.sock().open();
    s.sock().serverClose(code);
    expect(s.fatal).toEqual([code]);
  });

  it.each([1000, 1006, 4000, 4001])("close %i reconnects normally (partysocket backoff)", (code) => {
    const s = setup();
    s.sock().open();
    s.sock().serverClose(code);
    expect(s.fatal).toEqual([]);
    expect(s.sock().closes).toBe(0);
    expect(s.statuses.at(-1)).toBe("reconnecting");
  });

  it.each([4008, 4009])("close %i waits SLOW_RECONNECT_MS before reconnecting", (code) => {
    const s = setup();
    s.sock().open();
    s.sock().serverClose(code);
    expect(s.sock().closes).toBe(1);
    s.conn.wake(); // no early reconnect
    vi.advanceTimersByTime(SLOW_RECONNECT_MS - 1);
    expect(s.sock().reconnects).toBe(0);
    vi.advanceTimersByTime(1);
    expect(s.sock().reconnects).toBe(1);
    expect(s.fatal).toEqual([]);
  });

  it("heartbeat: ping every 20 s, reconnect when no pong within 10 s, pong clears", () => {
    const s = setup();
    s.sock().open();
    vi.advanceTimersByTime(20_000);
    expect(s.sock().sent.at(-1)).toBe(PING_FRAME);
    s.sock().msg(PONG_FRAME);
    vi.advanceTimersByTime(10_000);
    expect(s.sock().reconnects).toBe(0);
    vi.advanceTimersByTime(10_000); // second ping at 40 s
    expect(s.sock().sent.filter((x) => x === PING_FRAME)).toHaveLength(2);
    vi.advanceTimersByTime(10_000); // no pong
    expect(s.sock().reconnects).toBe(1);
    // partysocket's synthetic close(1000) from reconnect() → reconnecting, heartbeat stopped, not fatal.
    expect(s.statuses.at(-1)).toBe("reconnecting");
    expect(s.conn.heartbeatRunning).toBe(false);
    expect(s.fatal).toEqual([]);
    s.sock().open();
    expect(s.statuses.at(-1)).toBe("open");
    expect(s.sock().sent.at(-1)).toBe('{"v":1,"t":"hello","role":"player"}');
  });

  it("a synthetic close from wake() while CONNECTING keeps reconnecting", () => {
    const s = setup();
    s.sock().open();
    s.sock().serverClose(1006);
    s.sock().readyState = 0; // partysocket is connecting again
    s.conn.wake();
    expect(s.sock().reconnects).toBe(1);
    expect(s.statuses.at(-1)).toBe("reconnecting");
    expect(s.fatal).toEqual([]);
  });

  it("a 4008 slow close never reconnects early, even through a synthetic close", () => {
    const s = setup();
    s.sock().open();
    s.sock().serverClose(4008);
    expect(s.statuses.at(-1)).toBe("reconnecting");
    s.conn.wake();
    expect(s.sock().reconnects).toBe(0);
    vi.advanceTimersByTime(SLOW_RECONNECT_MS);
    expect(s.sock().reconnects).toBe(1);
    s.sock().open();
    expect(s.statuses.at(-1)).toBe("open");
  });

  it("heartbeat stops on close and restarts on open", () => {
    const s = setup();
    s.sock().open();
    expect(s.conn.heartbeatRunning).toBe(true);
    s.sock().serverClose(1006);
    expect(s.conn.heartbeatRunning).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(s.sock().sent.filter((x) => x === PING_FRAME)).toHaveLength(0);
    s.sock().open();
    expect(s.conn.heartbeatRunning).toBe(true);
    vi.advanceTimersByTime(20_000);
    expect(s.sock().sent.filter((x) => x === PING_FRAME)).toHaveLength(1);
  });

  it("never pings while not OPEN", () => {
    const s = setup();
    s.sock().open();
    s.sock().readyState = 0; // connecting again without a close event yet
    vi.advanceTimersByTime(20_000);
    expect(s.sock().sent.filter((x) => x === PING_FRAME)).toHaveLength(0);
  });

  it("wake reconnects only when not OPEN; restart after REPLACED", () => {
    const s = setup();
    s.sock().open();
    s.conn.wake();
    expect(s.sock().reconnects).toBe(0);
    s.sock().serverClose(1006);
    s.conn.wake();
    expect(s.sock().reconnects).toBe(1);
    s.sock().open();
    s.sock().serverClose(4005);
    expect(s.fatal).toEqual([4005]);
    s.conn.restart();
    expect(s.sock().reconnects).toBe(2);
  });

  it("destroy closes the socket and ignores later events", () => {
    const s = setup();
    s.sock().open();
    s.conn.destroy(); // the synthetic close(1000) is ignored: destroyed first
    expect(s.statuses).toEqual(["open", "closed"]);
    expect(s.sock().closes).toBe(1);
    s.sock().h.close(4006);
    expect(s.fatal).toEqual([]);
    expect(s.conn.isOpen).toBe(false);
  });
});
