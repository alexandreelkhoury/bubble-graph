// Runtime-agnostic Room behaviour (§7.5). Never imports partyserver or `cloudflare:workers`:
// `room.ts` adapts the Durable Object, tests drive this class with in-memory fakes.
import {
  CLOSE_CODES,
  HELLO_TIMEOUT_MS,
  MAX_CONNECTIONS_PER_ROOM,
  MAX_PENDING_CONNECTIONS,
  MSG_MAX_BYTES,
  PING_FRAME,
  PONG_FRAME,
  PROTOCOL_VERSION,
  ROOM_TV_GONE_TTL_MS,
  ROOM_TV_MAX_TTL_MS,
  TV_BUSY_MAX_MS,
} from "@mishana/shared/constants";
import type { Locale } from "@mishana/shared/constants";
import { assertInvariants, createInitialState, nextWakeAt, reduce, sanitizeName } from "@mishana/shared/engine";
import type { Action, Catalog, GameState } from "@mishana/shared/engine";
import { PREMIUM_SETTING_KEYS } from "@mishana/shared/billing/products";
import { projectForPlayer, projectForTv } from "@mishana/shared/projection";
import type { ViewAccess } from "@mishana/shared/projection";
import type { ActionMsg, ClientMessage, EntitlementMsg, HelloPlayerMsg, HelloTvMsg, JoinMsg, StoreOpenMsg } from "@mishana/shared/protocol";
import { ACTION_ID_REGEX, ClientMessageSchema } from "@mishana/shared/protocol";
import { playableCatalog, restrictionFor, roomAccess } from "./access";
import type { RoomAccess } from "./access";
import { verifyEntitlementToken } from "./billing/token";
import type { RoomEntitlement } from "./billing/token";
import { errorFrame, safeClose, safeSend, sendFatal, stateFrame, welcomeFrame } from "./frames";
import type { FatalErrorCode } from "./frames";
import { Mutex } from "./mutex";
import { addStrike, fullBucket, JoinLimiter, pruneStrikes, STRIKES_TO_CLOSE, takeToken } from "./ratelimit";
import type { Bucket } from "./ratelimit";
import { RoomStore } from "./room-store";
import type { RoomMeta, RoomStorage, Sessions } from "./room-store";
import { randomHex, timingSafeEqualHex } from "./tokens";

export type { RoomMeta, RoomStorage, SessionRecord, Sessions } from "./room-store";

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
  /** PAYMENTS-SPEC §3.9: times of this TV connection's `entitlement` messages in the last minute. */
  billingMsgs?: number[];
  /** PAY-GAP §3.9: times of this TV connection's `storeOpen{open:true}` messages in the last minute (own budget). */
  storeMsgs?: number[];
};

export interface InitRoomArgs {
  tvTokenHash: string; joinUrl: string; locale: Locale; now: number;
  /** PAYMENTS-SPEC §3.11: verified by the Worker before a code is drawn; null = a free room. */
  entitlement: RoomEntitlement | null;
  /** §3.10: decided once, in the Worker, from the request. */
  billingMode: "google" | "fake";
}
export type InitRoomResult = { ok: true } | { ok: false; reason: "EXISTS" };

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

/**
 * PAYMENTS-SPEC §3.2: the only billing material a room gets. Public Ed25519 verify keys (no private half) and the
 * env-level fake-mode guard (§3.10 conditions 1–3). RoomCore never receives `env`.
 */
export interface RoomBillingDeps { verifyKeys: ReadonlyMap<string, CryptoKey>; fakeAllowedByEnv: boolean }

export interface RoomCoreDeps {
  storage: RoomStorage;
  connections: Connections;
  clock: Clock;
  crypto: CryptoProvider;
  /** The FULL catalog. Rooms play `playableCatalog(catalog, access)` only (PAYMENTS-SPEC §3.11). */
  catalog: Catalog;
  /** Built once per isolate (WebCrypto key import is async). */
  billing: () => Promise<RoomBillingDeps>;
  /** BILLING_ENABLED (config.ts). false: the room plays the whole catalog and ignores `entitlement` / `storeOpen`. Default true. */
  billingEnabled?: boolean;
  debugInvariants: boolean;
  // SPEC-GAP: §7.5 lists the deps without the room code, but `ipKey` must be hashed before any state is
  // read (and `meta` is missing for never-created rooms), so the DO name is passed in explicitly.
  roomCode: string;
}

/** Request facts `onConnect` needs; the raw IP is only hashed, never stored. */
export interface ConnectInfo { url: string; ip: string | null }

export const CID_REGEX = /^[A-Za-z0-9-]{8,64}$/;
/**
 * SPEC-GAP (§7.5 caps): spectator sockets (hello'd as player, not joined) do not count toward
 * MAX_CONNECTIONS_PER_ROOM, so they can never lock out the TV or a resume-token reconnect. They have their own
 * per-room cap instead, sized for a whole party of phones sitting on the join screen at once. No per-IP cap:
 * phones at one party usually share a public IP.
 */
export const MAX_SPECTATORS_PER_ROOM = 16;
export const ACTIVITY_WRITE_INTERVAL_MS = 60_000;
/** Lower bound between alarm runs, so an alarm that finds nothing due can never spin. */
export const MIN_ALARM_GAP_MS = 250;
/**
 * PAYMENTS-SPEC §3.9, with separate budgets (PAY-GAP: one shared budget of 6 dropped a real purchase's `entitlement`
 * after a few Store open/close cycles): `entitlement` messages per TV connection per minute.
 */
export const BILLING_MSGS_PER_MIN = 6;
/** `storeOpen{open:true}` per TV connection per minute. `storeOpen{open:false}` only clears state and is never capped. */
export const STORE_OPEN_MSGS_PER_MIN = 12;

// ------------------------------------------------------------------ helpers

/**
 * §7.5 expiry. `tvConnected` = a hello'd TV socket is open (derived from the live sockets, never from pings: the
 * ping/pong auto-response does not wake the DO).
 * - TV connected: the room never expires, up to a safety cap of `lastActivityAt + ROOM_TV_MAX_TTL_MS` (a TV hello
 *   counts as activity, so this is 12 h after the later of the last accepted client message and the TV's hello).
 * - No TV: `tvLeftAt + ROOM_TV_GONE_TTL_MS` (set at creation, so a TV that never connects also gets 15 min).
 *   An unknown `tvLeftAt` (older rooms, before reconciliation) falls back to `lastActivityAt`.
 */
export function expiresAt(meta: RoomMeta, tvConnected: boolean): number {
  if (tvConnected) return meta.lastActivityAt + ROOM_TV_MAX_TTL_MS;
  return (meta.tvLeftAt ?? meta.lastActivityAt) + ROOM_TV_GONE_TTL_MS;
}

function uint32(bytes: Uint8Array): number {
  return (((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0)) >>> 0;
}

function isPending(c: ConnHandle): boolean {
  return c.state === null || c.state.role === "pending";
}

function isTv(c: ConnHandle, exceptCid?: string): boolean {
  return c.state !== null && c.state.role === "tv" && c.state.cid !== exceptCid;
}

function isSpectator(c: ConnHandle): boolean {
  return c.state !== null && c.state.role === "player" && c.state.playerId === null;
}

const SYSTEM = { kind: "system" } as const;

const BILLING_OFF_ACCESS: RoomAccess = { premium: true, packs: new Set(), changesAt: null };

function accessKey(a: RoomAccess): string {
  return `${a.premium ? 1 : 0}|${[...a.packs].sort().join(",")}`;
}

function withoutSession(sessions: Sessions, pid: string): Sessions {
  const rest = { ...sessions };
  delete rest[pid];
  return rest;
}

// ------------------------------------------------------------------ RoomCore

export class RoomCore {
  readonly #d: RoomCoreDeps;
  readonly #store: RoomStore;
  readonly #mutex = new Mutex();
  readonly #joins = new JoinLimiter();
  #loaded = false;
  #meta: RoomMeta | null = null;
  #state: GameState | null = null;
  /** The meta object last read from or written to storage (a different reference = unsaved changes). */
  #savedMeta: RoomMeta | null = null;
  #sessions: Sessions = {};
  /** The sessions object last read from or written to storage (a different reference = unsaved changes). */
  #savedSessions: Sessions = {};
  /**
   * Open sockets, listed once per serialised entry point: listing hibernated sockets deserialises every
   * attachment. Sockets this entry point closes are dropped from it (partyserver hands out the socket
   * object itself as the connection, so identity is stable within a run).
   */
  #snapshot: ConnHandle[] | null = null;
  readonly #closedNow = new Set<ConnHandle>();
  readonly #premiumPackIds: ReadonlySet<string>;
  /** Access (premium + owned packs) of the last broadcast; an alarm re-broadcasts when it changes (§3.11). */
  #broadcastAccess: string | null = null;
  /** §3.10: the env-level fake guard, read with the room (fail closed until known). */
  #fakeEnv = false;

  constructor(deps: RoomCoreDeps) {
    this.#d = deps;
    this.#store = new RoomStore(deps.storage);
    this.#premiumPackIds = new Set(deps.catalog.packs.filter((p) => p.tier === "premium").map((p) => p.id));
  }

  // ---------------------------------------------------------------- entry points

  /** Loads the cache and reconciles `connected` flags with the live sockets (§7.5 onStart). */
  start(): Promise<void> {
    return this.#run(async () => {
      await this.#load();
      const state = this.#state;
      const meta = this.#meta;
      if (!state || !meta) return;
      const live = new Set<string>();
      for (const c of this.#conns()) if (c.state?.playerId) live.add(c.state.playerId);
      let s = state;
      for (const p of state.players) {
        if (p.connected && !live.has(p.id)) {
          const r = reduce(s, { type: "DISCONNECT", by: { kind: "system" }, playerId: p.id }, this.#ctx());
          if (r.ok) s = r.state;
        }
      }
      if (s !== state || this.#restrictionPending(s)) await this.#commit(s);
      else await this.#reschedule();
    });
  }

  initRoom(args: InitRoomArgs): Promise<InitRoomResult> {
    return this.#run(async () => {
      // §3.10 defence in depth: a fake-mode entitlement is kept only in a fake room with the env guard still on.
      this.#fakeEnv = (await this.#d.billing()).fakeAllowedByEnv;
      const entitlement = args.entitlement?.mode === "fake" && !(args.billingMode === "fake" && this.#fakeEnv) ? null : args.entitlement;
      const seed = uint32(this.#d.crypto.randomBytes(4));
      // Native RPC bypasses partyserver's initialisation and the DO may have been evicted: never trust the cache.
      const head = await this.#store.loadHead();
      if (head.meta) {
        if (args.now < expiresAt(head.meta, this.#conns().some((c) => isTv(c)))) return { ok: false, reason: "EXISTS" };
        this.#closeWhere(() => true, "ROOM_EXPIRED");
      }
      await this.#store.wipe();
      const meta: RoomMeta = {
        schema: 1, code: this.#d.roomCode, tvTokenHash: args.tvTokenHash, joinUrl: args.joinUrl,
        createdAt: args.now, lastActivityAt: args.now, tvLeftAt: args.now,
        entitlement, billingMode: args.billingMode, tvBusyUntil: null, viewRev: 0,
      };
      const state = createInitialState({ roomCode: this.#d.roomCode, joinUrl: args.joinUrl, seed, wordLocale: args.locale });
      const sessions: Sessions = {};
      await this.#store.write({ meta, state, sessions });
      this.#setCache(meta, state, sessions);
      await this.#reschedule();
      return { ok: true };
    });
  }

  async onConnect(conn: ConnHandle, info: ConnectInfo): Promise<void> {
    const ipKey = (await this.#d.crypto.sha256hex(this.#d.roomCode + ":" + (info.ip ?? "local"))).slice(0, 16);
    return this.#run(async () => {
      await this.#ensureLoaded();
      const meta = this.#meta;
      if (!meta) {
        this.#fatal(conn, "ROOM_NOT_FOUND");
        await this.#store.wipe();
        this.#loaded = false;
        return;
      }
      const now = this.#d.clock.now();
      this.#closeStalePending(now);
      // Count the new socket explicitly: it is the only open socket without a state yet (entry points are
      // serialised), and the runtime may hand out distinct wrapper objects for the same socket.
      // Spectators are capped separately at hello time (MAX_SPECTATORS_PER_ROOM).
      const others = this.#conns().filter((c) => c.state !== null && !isSpectator(c));
      if (others.length + 1 > MAX_CONNECTIONS_PER_ROOM) {
        this.#close(conn, CLOSE_CODES.CAPACITY, "room full");
        return;
      }
      const pending = others.filter(isPending).sort((a, b) => (a.state?.openedAt ?? 0) - (b.state?.openedAt ?? 0));
      if (pending.length + 1 > MAX_PENDING_CONNECTIONS) {
        // SPEC-GAP: §7.5 refuses the new socket. A real client says hello within milliseconds, so the oldest
        // pending socket is far more likely to be an idle flood than the newcomer: evict it instead.
        const oldest = pending[0];
        if (oldest) this.#close(oldest, CLOSE_CODES.CAPACITY, "too many pending");
      }
      let cid: string | null;
      try {
        cid = new URL(info.url).searchParams.get("cid");
      } catch {
        cid = null;
      }
      if (cid === null || !CID_REGEX.test(cid)) {
        this.#close(conn, CLOSE_CODES.BAD_CID, "bad cid");
        return;
      }
      conn.setState({ role: "pending", playerId: null, cid, ipKey, epoch: meta.createdAt, openedAt: now, bucket: fullBucket(now), strikes: [] });
      await this.#reschedule();
    });
  }

  onMessage(conn: ConnHandle, msg: string | ArrayBuffer | ArrayBufferView): Promise<void> {
    return this.#run(async () => {
      try {
        await this.#handleMessage(conn, msg);
      } catch (e) {
        this.#logInternal(e);
        safeSend(conn, errorFrame("INTERNAL"));
      }
    });
  }

  onClose(conn: ConnHandle): Promise<void> {
    return this.#run(async () => {
      await this.#ensureLoaded();
      const st = conn.state;
      const state = this.#state;
      if (!st || !state || !this.#meta) return;
      const pid = st.playerId;
      // The last TV socket closed (not one a replacing TV socket took over): the 15-min TV-gone expiry starts (§7.5),
      // and the §3.11 storeOpen busy flag clears.
      if (st.role === "tv" && !this.#conns().some((c) => isTv(c, st.cid))) {
        const busy = (this.#meta.tvBusyUntil ?? null) !== null;
        this.#meta = { ...this.#meta, tvLeftAt: this.#meta.tvLeftAt ?? this.#d.clock.now(), tvBusyUntil: null };
        if (busy) await this.#metaBroadcast();
        else await this.#flushMeta();
        await this.#reschedule(st.cid);
        return;
      }
      if (pid !== null) {
        const session = this.#sessions[pid];
        const others = this.#conns().filter((c) => c.state !== null && c.state.cid !== st.cid && c.state.playerId === pid);
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
    return this.#run(async () => {
      this.#store.alarmFired();
      await this.#ensureLoaded();
      const meta = this.#meta;
      if (!meta) {
        await this.#store.wipe();
        this.#loaded = false;
        return;
      }
      const now = this.#d.clock.now();
      const synced = this.#syncTvLeft(now);
      if (now >= expiresAt(synced, this.#tvConnected())) {
        this.#closeWhere(() => true, "ROOM_EXPIRED");
        await this.#store.clearAlarm();
        await this.#store.wipe();
        this.#setCache(null, null, {});
        return;
      }
      let metaChanged = false;
      if ((meta.tvBusyUntil ?? null) !== null && (meta.tvBusyUntil as number) <= now) {
        this.#meta = { ...synced, tvBusyUntil: null };
        metaChanged = true;
      }
      const state = this.#state;
      if (state) {
        const r = reduce(state, { type: "TICK", by: SYSTEM }, this.#ctx());
        const next = r.ok ? r.state : state;
        if (next !== state || this.#restrictionPending(next)) {
          this.#closeStalePending(now);
          await this.#commit(next);
          return;
        }
      }
      // An access change (premium or a pack ending) re-broadcasts; after a fresh isolate the last key is unknown → broadcast.
      if (metaChanged || this.#broadcastAccess !== accessKey(this.#accessAt(now).access)) await this.#metaBroadcast();
      this.#closeStalePending(now);
      await this.#reschedule();
    });
  }

  // ---------------------------------------------------------------- message pipeline

  async #handleMessage(conn: ConnHandle, raw: string | ArrayBuffer | ArrayBufferView): Promise<void> {
    const st0 = conn.state;
    if (!st0) return; // rejected in onConnect; nothing to do
    const now = this.#d.clock.now();
    // SPEC-GAP: §7.5 checks binary/oversize frames before the token bucket, which lets a flood of bad frames
    // bypass rate limiting. Here every frame takes a token first, and every bad frame is also a strike, so a
    // binary/oversize flood is closed with 4008 either way.
    // 1. Token bucket.
    const taken = takeToken(st0.bucket, now);
    if (!taken.ok) return this.#strike(conn, st0, taken.bucket, "RATE_LIMITED", now);
    // 2. Binary frames and oversize frames. UTF-8 length >= UTF-16 length, so `raw.length` alone proves an
    // oversize frame without encoding it.
    if (typeof raw !== "string" || raw.length > MSG_MAX_BYTES || new TextEncoder().encode(raw).length > MSG_MAX_BYTES) {
      return this.#strike(conn, st0, taken.bucket, "BAD_MESSAGE", now);
    }
    const st: ConnState = { ...st0, bucket: taken.bucket, strikes: pruneStrikes(st0.strikes, now) };
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
      this.#fatal(conn, "ROOM_EXPIRED");
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
    if (obj.v !== PROTOCOL_VERSION) {
      this.#fatal(conn, "UNSUPPORTED_VERSION");
      return;
    }
    const res = ClientMessageSchema.safeParse(parsed);
    if (!res.success) {
      const ref = obj.t === "action" && typeof obj.id === "string" && ACTION_ID_REGEX.test(obj.id) ? obj.id : null;
      safeSend(conn, errorFrame("BAD_MESSAGE", ref));
      return;
    }
    // SPEC-GAP: §7.5 touches activity for every schema-valid frame, so a spectator repeating `hello` could
    // keep a room alive forever. Only real participation counts: a TV hello, a resume, a join or an
    // accepted action (see the #touchActivity calls below).
    // 6. Access (§3.11): a LOBBY that lost access is restricted before the message is handled.
    if (this.#state && this.#restrictionPending(this.#state)) await this.#commit(this.#state);
    // 7. Dispatch.
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
      case "entitlement":
      case "storeOpen":
        return this.#billingMsg(conn, st, m);
    }
  }

  /** PAYMENTS-SPEC §3.11 `entitlement` / `storeOpen` (TV only; at most BILLING_MSGS_PER_MIN per connection). */
  async #billingMsg(conn: ConnHandle, st: ConnState, m: EntitlementMsg | StoreOpenMsg): Promise<void> {
    if (st.role !== "tv") {
      safeSend(conn, errorFrame("NOT_AUTHENTICATED"));
      return;
    }
    if (this.#d.billingEnabled === false) return; // billing off: nothing to verify, the TV is never busy
    const now = this.#d.clock.now();
    // Separate budgets per kind; closing the Store only clears state, so it is never capped (PAY-GAP §3.9).
    if (m.t === "storeOpen" && !m.open) return this.#storeOpen(m, now);
    const key = m.t === "entitlement" ? "billingMsgs" : "storeMsgs";
    const cap = m.t === "entitlement" ? BILLING_MSGS_PER_MIN : STORE_OPEN_MSGS_PER_MIN;
    const recent = (Array.isArray(st[key]) ? st[key] : []).filter((t) => t > now - 60_000);
    if (recent.length >= cap) {
      conn.setState({ ...st, [key]: recent });
      safeSend(conn, errorFrame("RATE_LIMITED"));
      return;
    }
    conn.setState({ ...st, [key]: [...recent, now] });
    if (m.t === "entitlement") return this.#entitlement(conn, m);
    return this.#storeOpen(m, now);
  }

  async #entitlement(conn: ConnHandle, m: EntitlementMsg): Promise<void> {
    const billing = await this.#d.billing();
    const meta = this.#meta;
    if (!meta) return;
    const now = this.#d.clock.now();
    this.#fakeEnv = billing.fakeAllowedByEnv;
    const fakeActive = meta.billingMode === "fake" && billing.fakeAllowedByEnv;
    const e = await verifyEntitlementToken(m.token, billing.verifyKeys, now, fakeActive, this.#premiumPackIds);
    const cur = meta.entitlement ?? null;
    if (!e || (cur !== null && (e.sub !== cur.sub || e.iatMs < cur.iatMs))) {
      safeSend(conn, errorFrame("ENTITLEMENT_INVALID"));
      return;
    }
    // Accepted, even when the claims are lower (a refund): the room follows the newest token.
    this.#meta = { ...meta, entitlement: e };
    const state = this.#state;
    if (state && this.#restrictionPending(state)) await this.#commit(state);
    else {
      await this.#metaBroadcast();
      await this.#reschedule();
    }
  }

  async #storeOpen(m: StoreOpenMsg, now: number): Promise<void> {
    const meta = this.#meta;
    if (!meta || this.#state?.phase !== "LOBBY") return; // ignored outside LOBBY
    const next = m.open ? now + TV_BUSY_MAX_MS : null;
    if ((meta.tvBusyUntil ?? null) === next) return;
    this.#meta = { ...meta, tvBusyUntil: next };
    await this.#metaBroadcast();
    await this.#reschedule();
  }

  /** A rate-limited or malformed frame: one strike, an error, and a 4008 close on the third strike in the window. */
  #strike(conn: ConnHandle, st0: ConnState, bucket: Bucket, code: "RATE_LIMITED" | "BAD_MESSAGE", now: number): void {
    const strikes = addStrike(st0.strikes, now);
    conn.setState({ ...st0, bucket, strikes });
    safeSend(conn, errorFrame(code));
    if (strikes.length >= STRIKES_TO_CLOSE) this.#close(conn, CLOSE_CODES.RATE_LIMITED, "rate limited");
  }

  async #helloTv(conn: ConnHandle, st: ConnState, m: HelloTvMsg): Promise<void> {
    const hash = await this.#d.crypto.sha256hex(m.tvToken);
    const meta = this.#meta;
    if (!meta || !timingSafeEqualHex(hash, meta.tvTokenHash)) {
      this.#fatal(conn, "TV_AUTH_FAILED");
      return;
    }
    conn.setState({ ...st, role: "tv", playerId: null });
    await this.#touchActivity(this.#d.clock.now());
    this.#closeWhere((o) => o !== null && o.cid !== st.cid && o.role === "tv", "REPLACED");
    this.#sendState(conn);
    await this.#reschedule();
  }

  async #helloPlayer(conn: ConnHandle, st: ConnState, m: HelloPlayerMsg): Promise<void> {
    const token = m.resumeToken;
    if (token === undefined) return this.#becomeSpectator(conn, st);
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
        this.#sessions = withoutSession(this.#sessions, matchPid);
        await this.#saveSessions();
      }
      return this.#becomeSpectator(conn, st);
    }
    conn.setState({ ...st, role: "player", playerId: matchPid });
    await this.#touchActivity(this.#d.clock.now());
    this.#closeWhere((o) => o !== null && o.cid !== st.cid && o.playerId === matchPid, "REPLACED");
    const r = reduce(state, { type: "RECONNECT", by: { kind: "system" }, playerId: matchPid }, this.#ctx());
    const changed = r.ok && r.state !== state;
    if (changed) await this.#persist(r.state);
    safeSend(conn, welcomeFrame(matchPid, token, this.#d.roomCode));
    if (changed) this.#broadcast();
    else this.#sendState(conn);
    await this.#reschedule();
  }

  /** A player hello without a (valid) resume token: a spectator, if the room has a spectator slot left. */
  async #becomeSpectator(conn: ConnHandle, st: ConnState): Promise<void> {
    const n = this.#conns().filter((c) => isSpectator(c) && c.state?.cid !== st.cid).length;
    if (n >= MAX_SPECTATORS_PER_ROOM) {
      this.#close(conn, CLOSE_CODES.CAPACITY, "too many spectators");
      return;
    }
    conn.setState({ ...st, role: "player", playerId: null });
    this.#sendState(conn);
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
    const playerId = "p_" + randomHex(12, this.#d.crypto.randomBytes);
    const resumeToken = randomHex(16, this.#d.crypto.randomBytes);
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
    await this.#touchActivity(now);
    await this.#persist(r.state);
    safeSend(conn, welcomeFrame(playerId, resumeToken, this.#d.roomCode));
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
    const pre = this.#accessPrecheck(state, m, by);
    if (pre !== null) {
      safeSend(conn, errorFrame(pre, ref));
      return;
    }
    const action = { ...m.a, by } as Action;
    const r = reduce(state, action, this.#ctx());
    if (!r.ok) {
      safeSend(conn, errorFrame(r.error, ref));
      return;
    }
    await this.#touchActivity(this.#d.clock.now());
    if (r.state === state) return;
    const a = m.a;
    if (a.type === "KICK") {
      const s = this.#sessions[a.playerId];
      if (s) this.#sessions = { ...this.#sessions, [a.playerId]: { ...s, kicked: true } };
      await this.#persist(r.state);
      this.#closeWhere((o) => o?.playerId === a.playerId, "KICKED");
    } else if (a.type === "LEAVE" && by.kind === "player") {
      const pid = by.playerId;
      this.#sessions = withoutSession(this.#sessions, pid);
      await this.#persist(r.state);
      for (const c of this.#conns()) if (c.state?.playerId === pid) this.#close(c, 1000, "left");
    } else {
      await this.#persist(r.state);
    }
    this.#broadcast();
    await this.#reschedule();
  }

  // ---------------------------------------------------------------- persistence

  #ctx(): { now: number; catalog: Catalog } {
    const now = this.#d.clock.now();
    return { now, catalog: this.#accessAt(now).playable };
  }

  /** The room's access and playable catalog at `now` (§3.11). Only `playable` reaches reduce and the projections. */
  #accessAt(now: number): { access: RoomAccess; playable: Catalog } {
    // BILLING_ENABLED off: every room plays the whole catalog, as before payments (no locks, no premium settings).
    if (this.#d.billingEnabled === false) return { access: BILLING_OFF_ACCESS, playable: this.#d.catalog };
    const meta = this.#meta;
    let ent = meta?.entitlement ?? null;
    // §3.10: a stored fake-mode entitlement grants nothing once the room is not fake or the env guard is off.
    if (ent?.mode === "fake" && !(meta?.billingMode === "fake" && this.#fakeEnv)) ent = null;
    const access = roomAccess(ent, now);
    return { access, playable: playableCatalog(this.#d.catalog, access) };
  }

  #restrictionPending(state: GameState): boolean {
    const { access, playable } = this.#accessAt(this.#d.clock.now());
    return restrictionFor(state, playable, access) !== null;
  }

  /**
   * §3.11 UPDATE_SETTINGS pre-checks (PACK_LOCKED, then PREMIUM_REQUIRED) and the TV-busy START guard. Run before
   * `reduce`, so clients get a precise error; INVALID_SETTINGS still covers unknown ids.
   */
  #accessPrecheck(state: GameState, m: ActionMsg, by: { kind: "tv" } | { kind: "player"; playerId: string }): "PACK_LOCKED" | "PREMIUM_REQUIRED" | "TV_BUSY" | null {
    const a = m.a;
    const now = this.#d.clock.now();
    if (a.type === "UPDATE_SETTINGS") {
      const { access, playable } = this.#accessAt(now);
      const patch = a.patch as Record<string, unknown>;
      if (Array.isArray(patch.packIds)) {
        const playableIds = new Set(playable.packs.map((p) => p.id));
        const known = new Set(this.#d.catalog.packs.map((p) => p.id));
        if (patch.packIds.some((id) => typeof id === "string" && known.has(id) && !playableIds.has(id))) return "PACK_LOCKED";
      }
      if (!access.premium) {
        for (const k of PREMIUM_SETTING_KEYS) {
          if (patch[k] !== undefined && JSON.stringify(patch[k]) !== JSON.stringify(state.settings[k])) return "PREMIUM_REQUIRED";
        }
      }
    }
    if (a.type === "START" && by.kind === "player" && state.phase === "LOBBY" && this.#tvBusy(now)) return "TV_BUSY";
    return null;
  }

  #tvBusy(now: number): boolean {
    const until = this.#meta?.tvBusyUntil ?? null;
    return until !== null && until > now;
  }

  #setCache(meta: RoomMeta | null, state: GameState | null, sessions: Sessions): void {
    this.#savedMeta = meta;
    this.#meta = meta;
    this.#state = state;
    this.#sessions = sessions;
    this.#savedSessions = sessions;
    this.#loaded = true;
  }

  async #load(): Promise<void> {
    this.#fakeEnv = (await this.#d.billing()).fakeAllowedByEnv;
    const r = await this.#store.load();
    this.#setCache(r.meta, r.state, r.sessions);
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

  /**
   * Invariants (debug) and session pruning, then one atomic write of the state plus whichever of
   * meta/sessions changed, before anything is sent.
   */
  async #persist(next: GameState): Promise<void> {
    // §3.11: a LOBBY that may not keep its pack filter or premium settings is restricted in the same write.
    if (next.phase === "LOBBY") {
      const now = this.#d.clock.now();
      const { access, playable } = this.#accessAt(now);
      const restrict = restrictionFor(next, playable, access);
      if (restrict) {
        const r = reduce(next, { type: "RESTRICT_SETTINGS", by: SYSTEM, ...restrict }, { now, catalog: playable });
        if (r.ok) next = r.state;
      }
    } else if (this.#meta && (this.#meta.tvBusyUntil ?? null) !== null) {
      this.#meta = { ...this.#meta, tvBusyUntil: null }; // the busy flag never outlives LOBBY
    }
    if (this.#d.debugInvariants) assertInvariants(next);
    const meta = this.#meta;
    const live = new Set(next.players.map((p) => p.id));
    let sessions = this.#sessions;
    if (Object.keys(sessions).some((pid) => !live.has(pid))) {
      sessions = Object.fromEntries(Object.entries(sessions).filter(([pid]) => live.has(pid)));
    }
    const writeMeta = meta !== null && meta !== this.#savedMeta;
    await this.#store.write({
      state: next,
      ...(writeMeta ? { meta } : {}),
      ...(sessions !== this.#savedSessions ? { sessions } : {}),
    });
    if (meta) this.#savedMeta = meta;
    this.#state = next;
    this.#sessions = sessions;
    this.#savedSessions = sessions;
  }

  async #saveSessions(): Promise<void> {
    const sessions = this.#sessions;
    await this.#store.write({ sessions });
    this.#savedSessions = sessions;
  }

  async #touchActivity(now: number): Promise<void> {
    const meta = this.#meta;
    if (!meta || now - meta.lastActivityAt <= ACTIVITY_WRITE_INTERVAL_MS) return;
    this.#meta = { ...meta, lastActivityAt: now };
    await this.#flushMeta();
  }

  /**
   * A broadcast for a meta-only change (entitlement, storeOpen, tvBusy clear, an access flip at `changesAt`). The
   * state's `version` is unchanged, so `meta.viewRev` is bumped and persisted first: every frame's
   * `seq = state.version + viewRev` stays strictly increasing across broadcasts and hibernation (SPEC §8.4 clients
   * drop a frame whose seq is not greater than the last one). SPEC-GAP: SPEC §6 says `seq = state.version`.
   */
  async #metaBroadcast(): Promise<void> {
    const meta = this.#meta;
    if (!meta || !this.#state) return;
    this.#meta = { ...meta, viewRev: (meta.viewRev ?? 0) + 1 };
    await this.#flushMeta();
    this.#broadcast();
  }

  #seq(state: GameState): number {
    return state.version + (this.#meta?.viewRev ?? 0);
  }

  /** Writes the meta if it changed since the last read/write. */
  async #flushMeta(): Promise<void> {
    const meta = this.#meta;
    if (!meta || meta === this.#savedMeta) return;
    await this.#store.write({ meta });
    this.#savedMeta = meta;
  }

  // ---------------------------------------------------------------- sockets, broadcast, alarm

  /** Serialises an entry point; the socket snapshot lives exactly as long as one run. */
  #run<T>(fn: () => Promise<T>): Promise<T> {
    return this.#mutex.run(async () => {
      try {
        return await fn();
      } finally {
        this.#snapshot = null;
        this.#closedNow.clear();
      }
    });
  }

  /** Open sockets, minus the ones closed during this entry point. */
  #conns(): ConnHandle[] {
    const all = (this.#snapshot ??= this.#d.connections.list());
    if (this.#closedNow.size === 0) return all;
    return all.filter((c) => !this.#closedNow.has(c));
  }

  #close(conn: ConnHandle, code: number, reason: string): void {
    safeClose(conn, code, reason);
    this.#forget(conn);
  }

  /** Sends a fatal error, then closes with its close code. */
  #fatal(conn: ConnHandle, code: FatalErrorCode): void {
    sendFatal(conn, code);
    this.#forget(conn);
  }

  #forget(conn: ConnHandle): void {
    this.#closedNow.add(conn);
  }

  /** Sends the fatal `code` to every open socket whose state (null before onConnect) matches, then closes it. */
  #closeWhere(pred: (st: ConnState | null) => boolean, code: FatalErrorCode): void {
    for (const c of this.#conns()) if (pred(c.state)) this.#fatal(c, code);
  }

  /** §3.11: projections get the PLAYABLE catalog; the full one is used only for locked-pack metadata. */
  #viewAccess(now: number): { view: ViewAccess; playable: Catalog } {
    const { access, playable } = this.#accessAt(now);
    return { view: { premium: access.premium, fullCatalog: this.#d.catalog, tvBusy: this.#tvBusy(now) }, playable };
  }

  #viewFrame(state: GameState, st: ConnState, now: number, va = this.#viewAccess(now)): string | null {
    if (st.role === "tv") return stateFrame(this.#seq(state), now, projectForTv(state, va.playable, va.view));
    if (st.role === "player") return stateFrame(this.#seq(state), now, projectForPlayer(state, va.playable, st.playerId, va.view));
    return null;
  }

  #sendState(conn: ConnHandle): void {
    const state = this.#state;
    const st = conn.state;
    if (!state || !st) return;
    const frame = this.#viewFrame(state, st, this.#d.clock.now());
    if (frame !== null) safeSend(conn, frame);
  }

  #broadcast(): void {
    const state = this.#state;
    if (!state) return;
    const now = this.#d.clock.now();
    const va = this.#viewAccess(now);
    this.#broadcastAccess = accessKey(this.#accessAt(now).access);
    let tvFrame: string | null = null;
    let spectatorFrame: string | null = null;
    for (const c of this.#conns()) {
      const st = c.state;
      if (!st || st.role === "pending") continue;
      let frame: string | null;
      if (st.role === "tv") frame = tvFrame ??= this.#viewFrame(state, st, now, va);
      else if (st.playerId === null) frame = spectatorFrame ??= this.#viewFrame(state, st, now, va);
      else frame = this.#viewFrame(state, st, now, va);
      if (frame !== null) safeSend(c, frame);
    }
  }

  #pendingDeadline(): number | null {
    let min: number | null = null;
    for (const c of this.#conns()) {
      const st = c.state;
      if (!st || st.role !== "pending") continue;
      const at = st.openedAt + HELLO_TIMEOUT_MS;
      if (min === null || at < min) min = at;
    }
    return min;
  }

  /** A hello'd TV socket is open (`exceptCid`: a socket being closed right now). */
  #tvConnected(exceptCid?: string): boolean {
    return this.#conns().some((c) => isTv(c, exceptCid));
  }

  /**
   * Keeps `meta.tvLeftAt` in line with the live sockets: null while a TV is connected; `now` when no TV socket is
   * open but the leave was never seen (a DO reset dropped the socket without `webSocketClose`, or an older room).
   * Changes only the cache; the caller persists it. Returns the (possibly new) meta.
   */
  #syncTvLeft(now: number, exceptCid?: string): RoomMeta {
    const meta = this.#meta as RoomMeta;
    const left = meta.tvLeftAt ?? null;
    const connected = this.#tvConnected(exceptCid);
    if (connected && left !== null) this.#meta = { ...meta, tvLeftAt: null };
    else if (!connected && left === null) this.#meta = { ...meta, tvLeftAt: now };
    return this.#meta as RoomMeta;
  }

  /**
   * alarm = min(nextWakeAt(state), expiresAt(meta, tvConnected), pendingDeadline, access.changesAt, tvBusyUntil);
   * only written when it changes. Reconciles `tvLeftAt` first (§7.5).
   */
  async #reschedule(closingCid?: string): Promise<void> {
    if (!this.#meta) return;
    const meta = this.#syncTvLeft(this.#d.clock.now(), closingCid);
    await this.#flushMeta();
    const candidates = [expiresAt(meta, this.#tvConnected(closingCid))];
    const changesAt = this.#accessAt(this.#d.clock.now()).access.changesAt;
    if (changesAt !== null) candidates.push(changesAt);
    if ((meta.tvBusyUntil ?? null) !== null) candidates.push(meta.tvBusyUntil as number);
    const wake = this.#state ? nextWakeAt(this.#state) : null;
    if (wake !== null) candidates.push(wake);
    const pending = this.#pendingDeadline();
    if (pending !== null) candidates.push(pending);
    await this.#store.scheduleAlarm(Math.max(Math.min(...candidates), this.#d.clock.now() + MIN_ALARM_GAP_MS));
  }

  #closeStalePending(now: number, exceptCid?: string): void {
    for (const c of this.#conns()) {
      const st = c.state;
      if (!st || st.role !== "pending" || st.cid === exceptCid) continue;
      if (now >= st.openedAt + HELLO_TIMEOUT_MS) this.#close(c, CLOSE_CODES.HELLO_TIMEOUT, "hello timeout");
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
