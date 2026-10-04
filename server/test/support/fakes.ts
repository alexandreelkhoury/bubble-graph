// In-memory fakes for driving RoomCore in Node (§7.5 "Dependency injection").
import type { ClientIntentMsg } from "@mishana/shared/protocol";
import type { GameState, SettingsPatch } from "@mishana/shared/engine";
import { T0, TEST_CATALOG, TIMERS_OFF } from "@mishana/shared/testing";
import type { RoomEntitlement } from "../../src/billing/token";
import { RoomCore } from "../../src/room-core";
import type { ConnHandle, ConnState, RoomBillingDeps, RoomStorage } from "../../src/room-core";
import { randomBytes, sha256hex } from "../../src/tokens";

export { T0 };
export const TV_TOKEN = "0123456789abcdef0123456789abcdef";
export const ROOM = "KXRT";

export class FakeStorage implements RoomStorage {
  map = new Map<string, unknown>();
  alarm: number | null = null;
  deleteAllCalls = 0;
  async get<T>(key: string): Promise<T | undefined> {
    const v = this.map.get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }
  /** Single-key or multi-key put (DurableObjectStorage overloads); RoomCore only uses the multi-key form. */
  async put(keyOrEntries: string | Record<string, unknown>, value?: unknown): Promise<void> {
    const entries = typeof keyOrEntries === "string" ? { [keyOrEntries]: value } : keyOrEntries;
    for (const [k, v] of Object.entries(entries)) this.map.set(k, structuredClone(v));
  }
  async deleteAll(): Promise<void> {
    this.deleteAllCalls++;
    this.map.clear();
  }
  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }
  async setAlarm(at: number): Promise<void> {
    this.alarm = at;
  }
  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }
  snapshot(): { map: Map<string, unknown>; alarm: number | null } {
    return { map: structuredClone(this.map), alarm: this.alarm };
  }
  restore(s: { map: Map<string, unknown>; alarm: number | null }): void {
    this.map = structuredClone(s.map);
    this.alarm = s.alarm;
  }
}

export type Msg = { t: string; [k: string]: unknown };

export class FakeConn implements ConnHandle {
  state: ConnState | null = null;
  open = true;
  closeCode: number | null = null;
  raw: string[] = [];
  constructor(readonly label: string) {}
  setState(s: ConnState): void {
    this.state = structuredClone(s);
  }
  send(msg: string): void {
    if (!this.open) throw new Error("send on closed socket");
    this.raw.push(msg);
  }
  close(code?: number): void {
    if (!this.open) return;
    this.open = false;
    this.closeCode = code ?? 1005;
  }
  get msgs(): Msg[] {
    return this.raw.map((r) => JSON.parse(r) as Msg);
  }
  of(t: string): Msg[] {
    return this.msgs.filter((m) => m.t === t);
  }
  last(t: string): Msg | undefined {
    return this.of(t).at(-1);
  }
  errors(): string[] {
    return this.of("error").map((m) => m.code as string);
  }
  lastView(): Record<string, unknown> {
    const s = this.last("state");
    if (!s) throw new Error(`${this.label}: no state received`);
    return s.view as Record<string, unknown>;
  }
  clear(): void {
    this.raw = [];
  }
}

export class FakeConnections {
  all: FakeConn[] = [];
  list(): ConnHandle[] {
    return this.all.filter((c) => c.open);
  }
}

export class Harness {
  storage = new FakeStorage();
  conns = new FakeConnections();
  now = T0;
  core: RoomCore;
  debugInvariants = true;
  /** PAYMENTS-SPEC §3.11: the room's entitlement at initRoom (null = a free room). */
  entitlement: RoomEntitlement | null;
  billingMode: "google" | "fake";
  billing: RoomBillingDeps;
  /** BILLING_ENABLED (undefined = the RoomCore default, on). */
  billingEnabled: boolean | undefined;
  #n = 0;

  constructor(opts: { storage?: FakeStorage; conns?: FakeConnections; now?: number; entitlement?: RoomEntitlement | null; billingMode?: "google" | "fake"; billing?: RoomBillingDeps; billingEnabled?: boolean } = {}) {
    if (opts.storage) this.storage = opts.storage;
    if (opts.conns) this.conns = opts.conns;
    if (opts.now !== undefined) this.now = opts.now;
    this.entitlement = opts.entitlement === undefined ? null : opts.entitlement;
    this.billingMode = opts.billingMode ?? "google";
    this.billing = opts.billing ?? { verifyKeys: new Map(), fakeAllowedByEnv: false };
    this.billingEnabled = opts.billingEnabled;
    this.core = this.makeCore();
  }

  makeCore(connections: { list(): ConnHandle[] } = this.conns): RoomCore {
    return new RoomCore({
      storage: this.storage,
      connections,
      clock: { now: () => this.now },
      crypto: { randomBytes, sha256hex },
      catalog: TEST_CATALOG,
      billing: async () => this.billing,
      ...(this.billingEnabled === undefined ? {} : { billingEnabled: this.billingEnabled }),
      debugInvariants: this.debugInvariants,
      roomCode: ROOM,
    });
  }

  async init(): Promise<this> {
    const r = await this.core.initRoom({
      tvTokenHash: await sha256hex(TV_TOKEN), joinUrl: `https://x.test/${ROOM}`, locale: "en", now: this.now,
      entitlement: this.entitlement, billingMode: this.billingMode,
    });
    if (!r.ok) throw new Error("initRoom failed");
    return this;
  }

  advance(ms: number): void {
    this.now += ms;
  }

  get state(): GameState {
    const s = this.core.peek().state;
    if (!s) throw new Error("no state");
    return s;
  }

  async connect(opts: { cid?: string | null; ip?: string; label?: string } = {}): Promise<FakeConn> {
    const n = ++this.#n;
    const c = new FakeConn(opts.label ?? `c${n}`);
    this.conns.all.push(c);
    const cid = opts.cid === undefined ? `cid-${n.toString().padStart(8, "0")}` : opts.cid;
    const url = `https://x.test/parties/room/${ROOM}?_pk=pk${n}` + (cid === null ? "" : `&cid=${encodeURIComponent(cid)}`);
    await this.core.onConnect(c, { url, ip: opts.ip ?? "203.0.113.7" });
    return c;
  }

  /** Sends a frame; the clock advances 250 ms first so the 5/s bucket never runs dry in ordinary tests. */
  async send(c: FakeConn, msg: object | string | ArrayBuffer, advanceMs = 250): Promise<void> {
    this.advance(advanceMs);
    await this.core.onMessage(c, typeof msg === "string" || msg instanceof ArrayBuffer ? msg : JSON.stringify(msg));
  }

  async act(c: FakeConn, a: ClientIntentMsg, id?: string): Promise<void> {
    await this.send(c, id === undefined ? { v: 1, t: "action", a } : { v: 1, t: "action", id, a });
  }

  async tv(): Promise<FakeConn> {
    const c = await this.connect({ label: "tv" });
    await this.send(c, { v: 1, t: "hello", role: "tv", tvToken: TV_TOKEN });
    return c;
  }

  async spectator(opts: { ip?: string; label?: string } = {}): Promise<FakeConn> {
    const c = await this.connect(opts);
    await this.send(c, { v: 1, t: "hello", role: "player" });
    return c;
  }

  async player(i: number, opts: { ip?: string } = {}): Promise<{ conn: FakeConn; pid: string; token: string }> {
    const colors = ["coral", "azure", "lemon", "jade", "grape", "tangerine", "aqua", "rose", "mint", "plum", "sand", "lilac"];
    const conn = await this.spectator({ ip: opts.ip, label: `p${i}` });
    await this.send(conn, { v: 1, t: "join", name: `Player ${i}`, color: colors[i % 12], locale: "en" });
    const w = conn.last("welcome");
    if (!w) throw new Error(`join failed: ${conn.errors().join(",")}`);
    return { conn, pid: w.playerId as string, token: w.resumeToken as string };
  }

  async resume(token: string, label = "resume"): Promise<FakeConn> {
    const c = await this.connect({ label });
    await this.send(c, { v: 1, t: "hello", role: "player", resumeToken: token });
    return c;
  }

  /**
   * TV + `n` joined players, timers off (plus `settings`), then START; with `ready`, every player is READY
   * so the game is in CLUES round 1.
   */
  async startedGame(opts: { n?: number; settings?: SettingsPatch; ready?: boolean } = {}): Promise<{ tv: FakeConn; ps: { conn: FakeConn; pid: string; token: string }[] }> {
    const tv = await this.tv();
    const ps = [];
    for (let i = 0; i < (opts.n ?? 4); i++) ps.push(await this.player(i));
    await this.act(tv, { type: "UPDATE_SETTINGS", patch: { ...TIMERS_OFF, ...opts.settings } });
    await this.act(tv, { type: "START" });
    if (opts.ready) for (const p of ps) await this.act(p.conn, { type: "READY" });
    return { tv, ps };
  }

  /** Drives the current game to RESULTS: everyone votes an infiltrator; the TV advances everything else. */
  async playToResults(tv: FakeConn, players: { conn: FakeConn; pid: string }[]): Promise<void> {
    for (let i = 0; i < 300 && this.state.phase !== "RESULTS"; i++) {
      const s = this.state;
      if (s.phase === "LOBBY") throw new Error("returned to LOBBY (stalemate)");
      if (s.phase === "VOTING") {
        const target = s.players.find((p) => p.alive && !p.left && p.role !== "CIVILIAN") ?? s.players.find((p) => p.alive);
        const voter = s.players.find((p) => p.alive && !p.left && p.connected && s.votes[p.id] === undefined);
        const vc = players.find((x) => x.pid === voter?.id);
        if (voter && vc && target) {
          const t2 = voter.id === target.id ? s.players.find((p) => p.alive && p.id !== voter.id) : target;
          if (t2) {
            await this.act(vc.conn, { type: "CAST_VOTE", targetId: t2.id });
            continue;
          }
        }
      }
      await this.act(tv, { type: "HOST_ADVANCE" });
    }
    if (this.state.phase !== "RESULTS") throw new Error(`did not reach RESULTS (phase ${this.state.phase})`);
  }
}

/** Sequence numbers of every state frame a connection received. */
export function seqs(c: FakeConn): number[] {
  return c.of("state").map((m) => m.seq as number);
}

export function strictlyIncreasing(xs: number[]): boolean {
  return xs.every((x, i) => i === 0 || x > (xs[i - 1] as number));
}

/** A premium entitlement valid for `ttlMs` (the full test catalog is playable). */
export function premiumEntitlement(now: number, ttlMs = 8 * 3_600_000, sub = "a".repeat(64)): RoomEntitlement {
  return { sub, iatMs: now, expMs: now + ttlMs, premiumUntilMs: now + 30 * 86_400_000, packs: [], mode: "google" };
}
