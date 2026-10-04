// §8.4 connection: partysocket with no queueing, seq filter, close-code fatality, heartbeat.
import PartySocket from "partysocket";
import {
  FATAL_CLOSE_CODES, HEARTBEAT_INTERVAL_MS, PARTY_NAME, PING_FRAME, PONG_FRAME, PONG_TIMEOUT_MS, PROTOCOL_VERSION,
  SLOW_RECONNECT_CLOSE_CODES, SLOW_RECONNECT_MS,
} from "@mishana/shared/constants";
import type { ClientIntentMsg, ClientMessage, ErrorMsg, HelloPlayerMsg, HelloTvMsg, StateMsg, WelcomeMsg } from "@mishana/shared/protocol";
import { nextActionId, randomId } from "./ids";

export const WS_OPEN = 1;

/** What the connection needs from a socket (PartySocket in the app, a fake in tests). */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  reconnect(code?: number, reason?: string): void;
}
export interface SocketHandlers {
  open(): void;
  close(code: number): void;
  message(data: unknown): void;
}
export type SocketFactory = (h: SocketHandlers) => SocketLike;

export type ConnStatus = "connecting" | "open" | "reconnecting" | "closed";

/** Fatal close codes by name (SPEC §8.4); typed against the shared FATAL_CLOSE_CODES list. */
export const CLOSE = {
  UNSUPPORTED_VERSION: 4002, TV_AUTH_FAILED: 4003, ROOM_NOT_FOUND: 4004, REPLACED: 4005, KICKED: 4006, ROOM_EXPIRED: 4010,
} as const satisfies Record<string, (typeof FATAL_CLOSE_CODES)[number]>;

export interface ConnectionCallbacks {
  /** The hello frame to send on every open (reads the stored resume token at that moment). */
  hello(): HelloPlayerMsg | HelloTvMsg;
  onState(msg: StateMsg): void;
  onWelcome(msg: WelcomeMsg): void;
  onError(msg: ErrorMsg): void;
  onStatus(s: ConnStatus): void;
  /** A close code in FATAL_CLOSE_CODES: the socket is closed for good. */
  onFatal(code: number): void;
}

const FATAL: readonly number[] = FATAL_CLOSE_CODES;
const SLOW: readonly number[] = SLOW_RECONNECT_CLOSE_CODES;

export function isFatalClose(code: number): boolean { return FATAL.includes(code); }
export function isSlowClose(code: number): boolean { return SLOW.includes(code); }

export class Connection {
  private readonly socket: SocketLike;
  private lastSeq = -1;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private fatal = false;
  status: ConnStatus = "connecting";

  constructor(factory: SocketFactory, private readonly cb: ConnectionCallbacks) {
    this.socket = factory({
      open: () => this.handleOpen(),
      close: (code) => this.handleClose(code),
      message: (data) => this.handleMessage(data),
    });
  }

  get isOpen(): boolean {
    return !this.destroyed && this.socket.readyState === WS_OPEN;
  }

  /** Sends a raw frame only while the socket is OPEN; otherwise drops it (no queueing). */
  sendRaw(frame: string): boolean {
    if (!this.isOpen) return false;
    this.socket.send(frame);
    return true;
  }

  send(msg: ClientMessage): boolean {
    return this.sendRaw(JSON.stringify(msg));
  }

  /** Sends an action; returns its id, or null when the socket is not OPEN. */
  action(a: ClientIntentMsg): string | null {
    const id = nextActionId();
    return this.send({ v: PROTOCOL_VERSION, t: "action", id, a }) ? id : null;
  }

  /** visibilitychange → visible, online, pageshow(persisted): reconnect now if not OPEN. */
  wake(): void {
    if (this.destroyed || this.fatal || this.slowTimer !== null) return;
    if (this.socket.readyState !== WS_OPEN) this.socket.reconnect();
  }

  /** "Use it here" after REPLACED: start a fresh connection. */
  restart(): void {
    if (this.destroyed) return;
    this.fatal = false;
    this.clearSlow();
    this.setStatus("reconnecting");
    this.socket.reconnect();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopHeartbeat();
    this.clearSlow();
    this.socket.close(1000);
    this.setStatus("closed");
  }

  private setStatus(s: ConnStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.cb.onStatus(s);
  }

  private handleOpen(): void {
    if (this.destroyed) return;
    this.lastSeq = -1;
    this.setStatus("open");
    this.send(this.cb.hello());
    this.startHeartbeat();
  }

  private handleClose(code: number): void {
    this.stopHeartbeat();
    if (this.destroyed) return;
    if (isFatalClose(code)) {
      this.fatal = true;
      this.clearSlow();
      this.socket.close();
      this.setStatus("closed");
      this.cb.onFatal(code);
      return;
    }
    this.setStatus("reconnecting");
    if (isSlowClose(code)) {
      this.socket.close();
      this.clearSlow();
      this.slowTimer = setTimeout(() => {
        this.slowTimer = null;
        if (!this.destroyed && !this.fatal) this.socket.reconnect();
      }, SLOW_RECONNECT_MS);
    }
    // Any other code: partysocket reconnects with its normal backoff.
  }

  private handleMessage(data: unknown): void {
    if (this.destroyed || typeof data !== "string") return;
    if (data === PONG_FRAME) {
      this.clearPong();
      return;
    }
    let msg: unknown;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (typeof msg !== "object" || msg === null) return;
    const m = msg as { t?: unknown; seq?: unknown };
    switch (m.t) {
      case "state":
        if (typeof m.seq === "number" && m.seq > this.lastSeq) {
          this.lastSeq = m.seq;
          this.cb.onState(msg as StateMsg);
        }
        return;
      case "welcome":
        this.cb.onWelcome(msg as WelcomeMsg);
        return;
      case "error":
        this.cb.onError(msg as ErrorMsg);
        return;
      default:
        return; // unknown t (or partyserver's {"error": …}) → ignore
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      if (!this.sendRaw(PING_FRAME)) return;
      this.clearPong();
      this.pongTimer = setTimeout(() => {
        this.pongTimer = null;
        if (!this.destroyed) this.socket.reconnect();
      }, PONG_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.clearPong();
  }

  private clearPong(): void {
    if (this.pongTimer !== null) clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  private clearSlow(): void {
    if (this.slowTimer !== null) clearTimeout(this.slowTimer);
    this.slowTimer = null;
  }

  /** Test hook. */
  get seq(): number { return this.lastSeq; }
  get heartbeatRunning(): boolean { return this.heartbeat !== null; }
}

/**
 * Wakes the connection when the page comes back (visibilitychange → visible, online, pageshow from the bfcache);
 * `extra` runs too (the phone re-takes its wake lock). Returns the unbind function.
 */
export function bindWake(conn: Pick<Connection, "wake">, extra?: () => void): () => void {
  const wake = (): void => { conn.wake(); extra?.(); };
  const onVis = (): void => { if (document.visibilityState === "visible") wake(); };
  const onShow = (e: PageTransitionEvent): void => { if (e.persisted) wake(); };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("online", wake);
  window.addEventListener("pageshow", onShow);
  return () => {
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("online", wake);
    window.removeEventListener("pageshow", onShow);
  };
}

/** The real socket (§8.4 options, all explicit). */
export function partySocketFactory(code: string): SocketFactory {
  return (h) => {
    const ps = new PartySocket({
      host: location.host,
      protocol: location.protocol === "https:" ? "wss" : "ws",
      party: PARTY_NAME,
      room: code,
      query: () => ({ cid: randomId() }), // fresh per attempt
      minReconnectionDelay: 500,
      maxReconnectionDelay: 10_000,
      reconnectionDelayGrowFactor: 2,
      connectionTimeout: 4000,
      maxRetries: Infinity,
      maxEnqueuedMessages: 0, // never queue while offline
      // Fatal and slow codes never auto-reconnect (the Connection decides; belt and braces with close()).
      shouldReconnectOnClose: (e) => !isFatalClose(e.code) && !isSlowClose(e.code),
    });
    ps.addEventListener("open", () => h.open());
    ps.addEventListener("close", (e) => h.close(e.code));
    ps.addEventListener("message", (e) => h.message(e.data));
    return ps;
  };
}
