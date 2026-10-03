// Runtime-agnostic Room behaviour (§7.5). Never imports partyserver or `cloudflare:workers`:
// `room.ts` adapts the Durable Object, tests drive this class with in-memory fakes.
import {
  HELLO_TIMEOUT_MS,
  MAX_CONNECTIONS_PER_ROOM,
  MAX_PENDING_CONNECTIONS,
  MSG_MAX_BYTES,
  PING_FRAME,
  PONG_FRAME,
  ROOM_EMPTY_TTL_MS,
  ROOM_IDLE_TTL_MS,
  ROOM_RESULTS_TTL_MS,
} from "@mishana/shared/constants";
import type { Locale } from "@mishana/shared/constants";
import { assertInvariants, createInitialState, nextWakeAt, reduce, sanitizeName } from "@mishana/shared/engine";
import type { Action, Catalog, GameState } from "@mishana/shared/engine";
import { projectForPlayer, projectForTv } from "@mishana/shared/projection";
import type { ClientMessage, ErrorCode, HelloPlayerMsg, HelloTvMsg, JoinMsg, ActionMsg } from "@mishana/shared/protocol";
import { CLOSE_CODES, ClientMessageSchema, errorMessageKey } from "@mishana/shared/protocol";
import { Mutex } from "./mutex";
import { addStrike, fullBucket, JoinLimiter, STRIKES_TO_CLOSE, takeToken } from "./ratelimit";
import type { Bucket } from "./ratelimit";
import { bytesToHex, timingSafeEqualHex } from "./tokens";

// ------------------------------------------------------------------ types

export type ConnRole = "pending" | "tv" | "player";

export type ConnState = {
  role: ConnRole;            // "player" = hello'd as player (joined or spectator)
  playerId: string | null;
  cid: string;
  ipKey: string;             // first 16 hex of sha256hex(roomCode + ":" + ip); never the raw IP
  epoch: number;             // meta.createdAt at connect time
  openedAt: number;
  bucket: Bucket;
  strikes: number[];
};

export interface RoomMeta {
  schema: 1;
  code: string;
  tvTokenHash: string;
  joinUrl: string;
  createdAt: number;
  lastActivityAt: number;
  resultsAt: number | null;
}

export interface SessionRecord { tokenHash: string; kicked: boolean }
export type Sessions = Record<string, SessionRecord>;

export interface InitRoomArgs { tvTokenHash: string; joinUrl: string; locale: Locale; now: number }
export type InitRoomResult = { ok: true } | { ok: false; reason: "EXISTS" };

/** The subset of `DurableObjectStorage` the room uses (KV API + alarm). */
export interface RoomStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteAll(): Promise<void>;
  getAlarm(): Promise<number | null>;
  setAlarm(at: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

/** An open WebSocket. `state` is the hibernation-safe attachment (null until `onConnect` sets it). */
export interface ConnHandle {
  readonly state: ConnState | null;
  setState(s: ConnState): void;
  send(msg: string): void;
  close(code?: number, reason?: string): void;
}

/** Open connections only (closed or closing sockets are not listed). */
export interface Connections { list(): ConnHandle[] }
export interface Clock { now(): number }
export interface CryptoProvider {
  randomBytes(n: number): Uint8Array;
  sha256hex(s: string): Promise<string>;
}

export interface RoomCoreDeps {
  storage: RoomStorage;
  connections: Connections;
  clock: Clock;
  crypto: CryptoProvider;
  catalog: Catalog;
  debugInvariants: boolean;
  // SPEC-GAP: §7.5 lists the deps without the room code, but `ipKey` must be hashed before any state is
  // read (and `meta` is missing for never-created rooms), so the DO name is passed in explicitly.
  roomCode: string;
}

/** Request facts `onConnect` needs; the raw IP is only hashed, never stored. */
export interface ConnectInfo { url: string; ip: string | null }

export const CID_REGEX = /^[A-Za-z0-9-]{8,64}$/;
export const ACTIVITY_WRITE_INTERVAL_MS = 60_000;
/** Lower bound between alarm runs, so an alarm that finds nothing due can never spin. */
export const MIN_ALARM_GAP_MS = 250;

const STORAGE_META = "meta";
const STORAGE_STATE = "state";
const STORAGE_SESSIONS = "sessions";
const ACTION_ID_REGEX = /^[A-Za-z0-9-]{1,36}$/;

// ------------------------------------------------------------------ helpers

export function expiresAt(meta: RoomMeta, state: GameState | null): number {
  let at = meta.lastActivityAt + ROOM_IDLE_TTL_MS;
  if (state && state.phase === "LOBBY" && state.players.length === 0) {
    at = Math.min(at, Math.max(meta.createdAt, meta.lastActivityAt) + ROOM_EMPTY_TTL_MS);
  }
  if (state && state.phase === "RESULTS" && meta.resultsAt !== null) {
    at = Math.min(at, meta.resultsAt + ROOM_RESULTS_TTL_MS);
  }
  return at;
}

function errorFrame(code: ErrorCode, ref: string | null = null): string {
  return JSON.stringify({ v: 1, t: "error", code, messageKey: errorMessageKey(code), ref });
}

function safeSend(conn: ConnHandle, msg: string): void {
  try {
    conn.send(msg);
  } catch {
    // The socket is closing; the close handler deals with it.
  }
}

function safeClose(conn: ConnHandle, code: number, reason = ""): void {
  try {
    conn.close(code, reason);
  } catch {
    // Already closed.
  }
}

function uint32(bytes: Uint8Array): number {
  return (((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0)) >>> 0;
}

function isPending(c: ConnHandle): boolean {
  return c.state === null || c.state.role === "pending";
}

// ------------------------------------------------------------------ RoomCore

export class RoomCore {
  readonly #d: RoomCoreDeps;
  readonly #mutex = new Mutex();
  readonly #joins = new JoinLimiter();
  #loaded = false;
  #meta: RoomMeta | null = null;
  #state: GameState | null = null;
  #sessions: Sessions = {};

  constructor(deps: RoomCoreDeps) {
    this.#d = deps;
  }

  // ---------------------------------------------------------------- entry points

  /** Loads the cache and reconciles `connected` flags with the live sockets (§7.5 onStart). */
  start(): Promise<void> {
    return this.#mutex.run(async () => {
      await this.#load();
      const state = this.#state;
      const meta = this.#meta;
      if (!state || !meta) return;
      const live = new Set<string>();
      for (const c of this.#d.connections.list()) if (c.state?.playerId) live.add(c.state.playerId);
      let s = state;
      for (const p of state.players) {
        if (p.connected && !live.has(p.id)) {
          const r = reduce(s, { type: "DISCONNECT", by: { kind: "system" }, playerId: p.id }, this.#ctx());
          if (r.ok) s = r.state;
        }
      }
      if (s !== state) await this.#commit(s);
      else await this.#reschedule();
    });
  }

  initRoom(args: InitRoomArgs): Promise<InitRoomResult> {
    return this.#mutex.run(async () => {
      const seed = uint32(this.#d.crypto.randomBytes(4));
      // Native RPC bypasses partyserver's initialisation and the DO may have been evicted: never trust the cache.
      const storage = this.#d.storage;
      const meta = await storage.get<RoomMeta>(STORAGE_META);
      if (meta) {
        const state = (await storage.get<GameState>(STORAGE_STATE)) ?? null;
        if (args.now < expiresAt(meta, state)) return { ok: false, reason: "EXISTS" };
        this.#expireConnections();
      }
      await storage.deleteAll();
      const newMeta: RoomMeta = {
        schema: 1, code: this.#d.roomCode, tvTokenHash: args.tvTokenHash, joinUrl: args.joinUrl,
        createdAt: args.now, lastActivityAt: args.now, resultsAt: null,
      };
      const state = createInitialState({ roomCode: this.#d.roomCode, joinUrl: args.joinUrl, seed, wordLocale: args.locale });
      await storage.put(STORAGE_META, newMeta);
      await storage.put(STORAGE_STATE, state);
      await storage.put(STORAGE_SESSIONS, {});
      this.#meta = newMeta;
      this.#state = state;
      this.#sessions = {};
      this.#loaded = true;
      await this.#reschedule();
      return { ok: true };
    });
  }

  async onConnect(conn: ConnHandle, info: ConnectInfo): Promise<void> {
    const ipKey = (await this.#d.crypto.sha256hex(this.#d.roomCode + ":" + (info.ip ?? "local"))).slice(0, 16);
    return this.#mutex.run(async () => {
      await this.#ensureLoaded();
      const meta = this.#meta;
      if (!meta) {
        safeSend(conn, errorFrame("ROOM_NOT_FOUND"));
        safeClose(conn, CLOSE_CODES.ROOM_NOT_FOUND, "room not found");
        await this.#d.storage.deleteAll();
        this.#loaded = false;
        return;
      }
      const now = this.#d.clock.now();
      this.#closeStalePending(now);
      // Count the new socket explicitly: it is the only open socket without a state yet (entry points are
      // serialised), and the runtime may hand out distinct wrapper objects for the same socket.
      const others = this.#d.connections.list().filter((c) => c.state !== null);
      if (others.length + 1 > MAX_CONNECTIONS_PER_ROOM) {
        safeClose(conn, CLOSE_CODES.CAPACITY, "room full");
        return;
      }
      if (others.filter(isPending).length + 1 > MAX_PENDING_CONNECTIONS) {
        safeClose(conn, CLOSE_CODES.CAPACITY, "too many pending");
        return;
      }
      let cid: string | null;
      try {
        cid = new URL(info.url).searchParams.get("cid");
      } catch {
        cid = null;
      }
      if (cid === null || !CID_REGEX.test(cid)) {
        safeClose(conn, CLOSE_CODES.BAD_CID, "bad cid");
        return;
      }
      conn.setState({ role: "pending", playerId: null, cid, ipKey, epoch: meta.createdAt, openedAt: now, bucket: fullBucket(now), strikes: [] });
      await this.#reschedule();
    });
  }

  onMessage(conn: ConnHandle, msg: string | ArrayBuffer | ArrayBufferView): Promise<void> {
    return this.#mutex.run(async () => {
      try {
        await this.#handleMessage(conn, msg);
      } catch (e) {
        this.#logInternal(e);
        safeSend(conn, errorFrame("INTERNAL"));
      }
    });
  }

  onClose(conn: ConnHandle): Promise<void> {
    return this.#mutex.run(async () => {
      await this.#ensureLoaded();
      const st = conn.state;
      const state = this.#state;
      if (!st || !state || !this.#meta) return;
      const pid = st.playerId;
      if (pid !== null) {
        const session = this.#sessions[pid];
        const others = this.#d.connections.list().filter((c) => c.state !== null && c.state.cid !== st.cid && c.state.playerId === pid);
        if (session && !session.kicked && others.length === 0) {
          const r = reduce(state, { type: "DISCONNECT", by: { kind: "system" }, playerId: pid }, this.#ctx());
          if (r.ok && r.state !== state) {
            await this.#commit(r.state);
            return;
          }
        }
      }
      await this.#reschedule();
    });
  }

  onAlarm(): Promise<void> {
    return this.#mutex.run(async () => {
      await this.#ensureLoaded();
      const meta = this.#meta;
      if (!meta) {
        await this.#d.storage.deleteAll();
        this.#loaded = false;
        return;
      }
      const now = this.#d.clock.now();
      if (now >= expiresAt(meta, this.#state)) {
        this.#expireConnections();
        await this.#d.storage.deleteAlarm();
        await this.#d.storage.deleteAll();
        this.#meta = null;
        this.#state = null;
        this.#sessions = {};
        this.#loaded = true;
        return;
      }
      const state = this.#state;
      if (state) {
        const r = reduce(state, { type: "TICK", by: { kind: "system" } }, this.#ctx());
        if (r.ok && r.state !== state) {
          this.#closeStalePending(now);
          await this.#commit(r.state);
          return;
        }
      }
      this.#closeStalePending(now);
      await this.#reschedule();
    });
  }

  // ---------------------------------------------------------------- message pipeline

  async #handleMessage(conn: ConnHandle, raw: string | ArrayBuffer | ArrayBufferView): Promise<void> {
    const st0 = conn.state;
    if (!st0) return; // rejected in onConnect; nothing to do
    // 1. Binary frames and oversize frames.
    if (typeof raw !== "string" || new TextEncoder().encode(raw).length > MSG_MAX_BYTES) {
      safeSend(conn, errorFrame("BAD_MESSAGE"));
      return;
    }
    const now = this.#d.clock.now();
    // 2. Token bucket.
    const taken = takeToken(st0.bucket, now);
    if (!taken.ok) {
      const strikes = addStrike(st0.strikes, now);
      conn.setState({ ...st0, bucket: taken.bucket, strikes });
      safeSend(conn, errorFrame("RATE_LIMITED"));
      if (strikes.length >= STRIKES_TO_CLOSE) safeClose(conn, CLOSE_CODES.RATE_LIMITED, "rate limited");
      return;
    }
    const st: ConnState = { ...st0, bucket: taken.bucket, strikes: st0.strikes.filter((t) => now - t < 10_000) };
    conn.setState(st);
    // 3. Ping.
    if (raw === PING_FRAME) {
      safeSend(conn, PONG_FRAME);
      return;
    }
    await this.#ensureLoaded();
    const meta = this.#meta;
    // 4. Epoch (a room re-created under the same code, or deleted).
    if (!meta || st.epoch !== meta.createdAt) {
      safeSend(conn, errorFrame("ROOM_EXPIRED"));
      safeClose(conn, CLOSE_CODES.ROOM_EXPIRED, "room expired");
      return;
    }
    this.#closeStalePending(now, st.cid);
    // 5. JSON, raw `v`, schema.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      safeSend(conn, errorFrame("BAD_MESSAGE"));
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      safeSend(conn, errorFrame("BAD_MESSAGE"));
      return;
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.v !== 1) {
      safeSend(conn, errorFrame("UNSUPPORTED_VERSION"));
      safeClose(conn, CLOSE_CODES.UNSUPPORTED_VERSION, "unsupported version");
      return;
    }
    const res = ClientMessageSchema.safeParse(parsed);
    if (!res.success) {
      const ref = obj.t === "action" && typeof obj.id === "string" && ACTION_ID_REGEX.test(obj.id) ? obj.id : null;
      safeSend(conn, errorFrame("BAD_MESSAGE", ref));
      return;
    }
    await this.#touchActivity(now);
    // 6. Dispatch.
    const m: ClientMessage = res.data;
    switch (m.t) {
      case "hello":
        if (st.role !== "pending") {
          safeSend(conn, errorFrame("BAD_MESSAGE"));
          return;
        }
        if (m.role === "tv") return this.#helloTv(conn, st, m);
        return this.#helloPlayer(conn, st, m);
      case "join":
        return this.#join(conn, st, m, now);
      case "action":
        return this.#action(conn, st, m);
    }
  }

  async #helloTv(conn: ConnHandle, st: ConnState, m: HelloTvMsg): Promise<void> {
    const hash = await this.#d.crypto.sha256hex(m.tvToken);
    const meta = this.#meta;
    if (!meta || !timingSafeEqualHex(hash, meta.tvTokenHash)) {
      safeSend(conn, errorFrame("TV_AUTH_FAILED"));
      safeClose(conn, CLOSE_CODES.TV_AUTH_FAILED, "tv auth failed");
      return;
    }
    const next: ConnState = { ...st, role: "tv", playerId: null };
    conn.setState(next);
    for (const c of this.#d.connections.list()) {
      if (c.state === null || c.state.cid === st.cid || c.state.role !== "tv") continue;
      safeSend(c, errorFrame("REPLACED"));
      safeClose(c, CLOSE_CODES.REPLACED, "replaced");
    }
    this.#sendState(conn);
    await this.#reschedule();
  }

  async #helloPlayer(conn: ConnHandle, st: ConnState, m: HelloPlayerMsg): Promise<void> {
    const token = m.resumeToken;
    if (token === undefined) {
      conn.setState({ ...st, role: "player", playerId: null });
      this.#sendState(conn);
      await this.#reschedule();
      return;
    }
    const hash = await this.#d.crypto.sha256hex(token);
    const state = this.#state;
    if (!state) return;
    let matchPid: string | null = null;
    for (const [pid, s] of Object.entries(this.#sessions)) {
      if (timingSafeEqualHex(s.tokenHash, hash)) matchPid = pid;
    }
    const session = matchPid !== null ? this.#sessions[matchPid] : undefined;
    const player = matchPid !== null ? state.players.find((p) => p.id === matchPid) : undefined;
    if (matchPid === null || !session || session.kicked || !player) {
      safeSend(conn, errorFrame("RESUME_INVALID"));
      if (matchPid !== null && session && !player) {
        const { [matchPid]: _gone, ...rest } = this.#sessions;
        void _gone;
        this.#sessions = rest;
        await this.#d.storage.put(STORAGE_SESSIONS, this.#sessions);
      }
      conn.setState({ ...st, role: "player", playerId: null });
      this.#sendState(conn);
      await this.#reschedule();
      return;
    }
    conn.setState({ ...st, role: "player", playerId: matchPid });
    for (const c of this.#d.connections.list()) {
      if (c.state === null || c.state.cid === st.cid || c.state.playerId !== matchPid) continue;
      safeSend(c, errorFrame("REPLACED"));
      safeClose(c, CLOSE_CODES.REPLACED, "replaced");
    }
    const r = reduce(state, { type: "RECONNECT", by: { kind: "system" }, playerId: matchPid }, this.#ctx());
    const changed = r.ok && r.state !== state;
    if (changed) await this.#persist(r.state);
    safeSend(conn, JSON.stringify({ v: 1, t: "welcome", playerId: matchPid, resumeToken: token, roomCode: this.#d.roomCode }));
    if (changed) this.#broadcast();
    else this.#sendState(conn);
    await this.#reschedule();
  }

  async #join(conn: ConnHandle, st: ConnState, m: JoinMsg, now: number): Promise<void> {
    if (st.role !== "player") {
      safeSend(conn, errorFrame("NOT_AUTHENTICATED"));
      return;
    }
    if (st.playerId !== null) {
      safeSend(conn, errorFrame("ALREADY_JOINED"));
      return;
    }
    if (!this.#joins.hit(st.ipKey, now)) {
      safeSend(conn, errorFrame("RATE_LIMITED"));
      return;
    }
    const name = sanitizeName(m.name);
    if (name === null) {
      safeSend(conn, errorFrame("NAME_INVALID"));
      return;
    }
    // Ids, token and hash before reading state.
    const playerId = "p_" + bytesToHex(this.#d.crypto.randomBytes(12));
    const resumeToken = bytesToHex(this.#d.crypto.randomBytes(16));
    const tokenHash = await this.#d.crypto.sha256hex(resumeToken);
    const state = this.#state;
    if (!state) return;
    const r = reduce(state, { type: "JOIN", by: { kind: "system" }, playerId, name, color: m.color, locale: m.locale }, this.#ctx());
    if (!r.ok) {
      safeSend(conn, errorFrame(r.error));
      return;
    }
    this.#sessions = { ...this.#sessions, [playerId]: { tokenHash, kicked: false } };
    conn.setState({ ...st, playerId });
    await this.#persist(r.state);
    safeSend(conn, JSON.stringify({ v: 1, t: "welcome", playerId, resumeToken, roomCode: this.#d.roomCode }));
    this.#broadcast();
    await this.#reschedule();
  }

  async #action(conn: ConnHandle, st: ConnState, m: ActionMsg): Promise<void> {
    const ref = m.id ?? null;
    let by: { kind: "tv" } | { kind: "player"; playerId: string };
    if (st.role === "tv") by = { kind: "tv" };
    else if (st.role === "player" && st.playerId !== null) by = { kind: "player", playerId: st.playerId };
    else {
      safeSend(conn, errorFrame("NOT_AUTHENTICATED", ref));
      return;
    }
    const state = this.#state;
    if (!state) return;
    const action = { ...m.a, by } as Action;
    const r = reduce(state, action, this.#ctx());
    if (!r.ok) {
      safeSend(conn, errorFrame(r.error, ref));
      return;
    }
    if (r.state === state) return;
    const a = m.a;
    if (a.type === "KICK") {
      const s = this.#sessions[a.playerId];
      if (s) this.#sessions = { ...this.#sessions, [a.playerId]: { ...s, kicked: true } };
      await this.#persist(r.state);
      for (const c of this.#d.connections.list()) {
        if (c.state?.playerId !== a.playerId) continue;
        safeSend(c, errorFrame("KICKED"));
        safeClose(c, CLOSE_CODES.KICKED, "kicked");
      }
      this.#broadcast();
      await this.#reschedule();
      return;
    }
    if (a.type === "LEAVE" && by.kind === "player") {
      const pid = by.playerId;
      const { [pid]: _left, ...rest } = this.#sessions;
      void _left;
      this.#sessions = rest;
      await this.#persist(r.state);
      for (const c of this.#d.connections.list()) {
        if (c.state?.playerId === pid) safeClose(c, 1000, "left");
      }
      this.#broadcast();
      await this.#reschedule();
      return;
    }
    await this.#commit(r.state);
  }

  // ---------------------------------------------------------------- persistence, broadcast, alarm

  #ctx(): { now: number; catalog: Catalog } {
    return { now: this.#d.clock.now(), catalog: this.#d.catalog };
  }

  async #load(): Promise<void> {
    const s = this.#d.storage;
    this.#meta = (await s.get<RoomMeta>(STORAGE_META)) ?? null;
    this.#state = (await s.get<GameState>(STORAGE_STATE)) ?? null;
    this.#sessions = (await s.get<Sessions>(STORAGE_SESSIONS)) ?? {};
    this.#loaded = true;
  }

  async #ensureLoaded(): Promise<void> {
    if (!this.#loaded) await this.#load();
  }

  /** Persist + broadcast + reschedule for an accepted reduce that changed `version`. */
  async #commit(next: GameState): Promise<void> {
    await this.#persist(next);
    this.#broadcast();
    await this.#reschedule();
  }

  /** Invariants (debug), session pruning, `resultsAt`, then write meta/state/sessions before anything is sent. */
  async #persist(next: GameState): Promise<void> {
    if (this.#d.debugInvariants) assertInvariants(next);
    const prev = this.#state;
    const meta = this.#meta;
    const live = new Set(next.players.map((p) => p.id));
    let sessions = this.#sessions;
    if (Object.keys(sessions).some((pid) => !live.has(pid))) {
      sessions = Object.fromEntries(Object.entries(sessions).filter(([pid]) => live.has(pid)));
    }
    const storage = this.#d.storage;
    if (meta) {
      let resultsAt = meta.resultsAt;
      if (next.phase === "RESULTS" && prev?.phase !== "RESULTS") resultsAt = this.#d.clock.now();
      else if (next.phase !== "RESULTS") resultsAt = null;
      if (resultsAt !== meta.resultsAt) {
        this.#meta = { ...meta, resultsAt };
        await storage.put(STORAGE_META, this.#meta);
      }
    }
    await storage.put(STORAGE_STATE, next);
    await storage.put(STORAGE_SESSIONS, sessions);
    this.#state = next;
    this.#sessions = sessions;
  }

  async #touchActivity(now: number): Promise<void> {
    const meta = this.#meta;
    if (!meta || now - meta.lastActivityAt <= ACTIVITY_WRITE_INTERVAL_MS) return;
    this.#meta = { ...meta, lastActivityAt: now };
    await this.#d.storage.put(STORAGE_META, this.#meta);
  }

  #stateFrame(state: GameState, st: ConnState, now: number): string | null {
    let view;
    if (st.role === "tv") view = projectForTv(state, this.#d.catalog);
    else if (st.role === "player") view = projectForPlayer(state, this.#d.catalog, st.playerId);
    else return null;
    return JSON.stringify({ v: 1, t: "state", seq: state.version, serverNow: now, view });
  }

  #sendState(conn: ConnHandle): void {
    const state = this.#state;
    const st = conn.state;
    if (!state || !st) return;
    const frame = this.#stateFrame(state, st, this.#d.clock.now());
    if (frame !== null) safeSend(conn, frame);
  }

  #broadcast(): void {
    const state = this.#state;
    if (!state) return;
    const now = this.#d.clock.now();
    let tvFrame: string | null = null;
    let spectatorFrame: string | null = null;
    for (const c of this.#d.connections.list()) {
      const st = c.state;
      if (!st || st.role === "pending") continue;
      let frame: string | null;
      if (st.role === "tv") frame = tvFrame ??= this.#stateFrame(state, st, now);
      else if (st.playerId === null) frame = spectatorFrame ??= this.#stateFrame(state, st, now);
      else frame = this.#stateFrame(state, st, now);
      if (frame !== null) safeSend(c, frame);
    }
  }

  #pendingDeadline(): number | null {
    let min: number | null = null;
    for (const c of this.#d.connections.list()) {
      const st = c.state;
      if (!st || st.role !== "pending") continue;
      const at = st.openedAt + HELLO_TIMEOUT_MS;
      if (min === null || at < min) min = at;
    }
    return min;
  }

  /** alarm = min(nextWakeAt(state), expiresAt(meta, state), pendingDeadline); only written when it changes. */
  async #reschedule(): Promise<void> {
    const meta = this.#meta;
    if (!meta) return;
    const candidates = [expiresAt(meta, this.#state)];
    const wake = this.#state ? nextWakeAt(this.#state) : null;
    if (wake !== null) candidates.push(wake);
    const pending = this.#pendingDeadline();
    if (pending !== null) candidates.push(pending);
    const at = Math.max(Math.min(...candidates), this.#d.clock.now() + MIN_ALARM_GAP_MS);
    const current = await this.#d.storage.getAlarm();
    if (current !== at) await this.#d.storage.setAlarm(at);
  }

  #closeStalePending(now: number, exceptCid?: string): void {
    for (const c of this.#d.connections.list()) {
      const st = c.state;
      if (!st || st.role !== "pending" || st.cid === exceptCid) continue;
      if (now >= st.openedAt + HELLO_TIMEOUT_MS) safeClose(c, CLOSE_CODES.HELLO_TIMEOUT, "hello timeout");
    }
  }

  #expireConnections(): void {
    for (const c of this.#d.connections.list()) {
      safeSend(c, errorFrame("ROOM_EXPIRED"));
      safeClose(c, CLOSE_CODES.ROOM_EXPIRED, "room expired");
    }
  }

  #logInternal(e: unknown): void {
    // Never log bodies, state, words, tokens, names or IPs (§7.5): only the code, phase and room.
    void e;
    console.error(JSON.stringify({ code: "INTERNAL", phase: this.#state?.phase ?? null, roomCode: this.#d.roomCode }));
  }

  // ---------------------------------------------------------------- test/introspection helpers

  /** Read-only snapshot of the cache (tests only). */
  peek(): { meta: RoomMeta | null; state: GameState | null; sessions: Sessions } {
    return { meta: this.#meta, state: this.#state, sessions: this.#sessions };
  }
}
