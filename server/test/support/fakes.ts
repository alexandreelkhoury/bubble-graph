// In-memory fakes for driving RoomCore in Node (§7.5 "Dependency injection"), protocol v2 (JAMAA-PLATFORM §2.5).
import type { GameState, SettingsPatch } from "@jamaa/shared/engine";
import { contentCatalog } from "@jamaa/shared/content";
import type { ContentCatalog } from "@jamaa/shared/content";
import type { GameId } from "@jamaa/shared/games/ids";
import type { RoomHistory, RoomState } from "@jamaa/shared/room";
import type { RoomIntentMsg } from "@jamaa/shared/protocol/v2";
import { ALL_TV_GAMES, T0, TEST_CATALOG, TIMERS_OFF } from "@jamaa/shared/testing";
import type { RoomEntitlement } from "../../src/billing/token";
import { RoomCore } from "../../src/room-core";
import type { ConnHandle, ConnState, InitRoomArgs, RoomBillingDeps, RoomStorage } from "../../src/room-core";
import { randomBytes, sha256hex } from "../../src/tokens";

export { T0, ALL_TV_GAMES };
/** The v2 test content: the Mish Ana! test catalog, no packs for the other games. */
export const TEST_CONTENT: ContentCatalog = contentCatalog(TEST_CATALOG);
export const TEST_PREMIUM_FAMILIES: ReadonlySet<string> = new Set(TEST_CATALOG.packs.filter((p) => p.tier !== "free").map((p) => p.family ?? p.id));
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
  /** GAMES_ENABLED ∩ registry enabled (undefined = the RoomCore default, ["mishana"]). */
  enabledGames: readonly GameId[] | undefined;
  content: ContentCatalog = TEST_CONTENT;
  logs: { code: string; fields: Record<string, string | number | null> }[] = [];
  #n = 0;

  constructor(opts: { storage?: FakeStorage; conns?: FakeConnections; now?: number; entitlement?: RoomEntitlement | null; billingMode?: "google" | "fake"; billing?: RoomBillingDeps; billingEnabled?: boolean; enabledGames?: readonly GameId[]; content?: ContentCatalog } = {}) {
    if (opts.storage) this.storage = opts.storage;
    if (opts.conns) this.conns = opts.conns;
    if (opts.now !== undefined) this.now = opts.now;
    this.entitlement = opts.entitlement === undefined ? null : opts.entitlement;
    this.billingMode = opts.billingMode ?? "google";
    this.billing = opts.billing ?? { verifyKeys: new Map(), fakeAllowedByEnv: false };
    this.billingEnabled = opts.billingEnabled;
    this.enabledGames = opts.enabledGames;
    if (opts.content) this.content = opts.content;
    this.core = this.makeCore();
  }

  makeCore(connections: { list(): ConnHandle[] } = this.conns): RoomCore {
    return new RoomCore({
      storage: this.storage,
      connections,
      clock: { now: () => this.now },
      crypto: { randomBytes, sha256hex },
      content: () => this.content,
      premiumFamilies: () => TEST_PREMIUM_FAMILIES,
      billing: async () => this.billing,
      log: (code, fields) => void this.logs.push({ code, fields }),
      ...(this.billingEnabled === undefined ? {} : { billingEnabled: this.billingEnabled }),
      ...(this.enabledGames === undefined ? {} : { enabledGames: this.enabledGames }),
      debugInvariants: this.debugInvariants,
      roomCode: ROOM,
    });
  }

  /** `memory`: the TV's no-repeat seed (POST /api/rooms `memory`, JAMAA-PLATFORM §2.6a). */
  async init(opts: { memory?: InitRoomArgs["memory"] } = {}): Promise<this> {
    const r = await this.core.initRoom({
      tvTokenHash: await sha256hex(TV_TOKEN), joinUrl: `https://x.test/${ROOM}`, locale: "en", now: this.now,
      entitlement: this.entitlement, billingMode: this.billingMode, ...(opts.memory ? { memory: opts.memory } : {}),
    });
    if (!r.ok) throw new Error("initRoom failed");
    return this;
  }

  advance(ms: number): void {
    this.now += ms;
  }

  /** The room state (RoomState v2). */
  get room(): RoomState {
    const s = this.core.peek().state;
    if (!s) throw new Error("no state");
    return s;
  }

  get history(): RoomHistory {
    return this.core.peek().history;
  }

  /** The active Mish Ana! engine state (throws when no Mish Ana! instance runs). */
  get state(): GameState {
    const g = this.room.game;
    if (!g || g.id !== "mishana") throw new Error(`no Mish Ana! instance (room phase ${this.room.phase})`);
    return g.state as GameState;
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

  async act(c: FakeConn, a: RoomIntentMsg, id?: string): Promise<void> {
    await this.send(c, id === undefined ? { v: 2, t: "action", a } : { v: 2, t: "action", id, a });
  }

  /** A Mish Ana! in-game intent (`GAME {gameId:"mishana", i}`). */
  async game(c: FakeConn, i: Record<string, unknown>, id?: string): Promise<void> {
    await this.act(c, { type: "GAME", gameId: "mishana", i } as RoomIntentMsg, id);
  }

  /** OPEN_GAME mishana (TV) → SETUP. */
  async open(c: FakeConn, gameId: GameId = "mishana"): Promise<void> {
    await this.act(c, { type: "OPEN_GAME", gameId });
  }

  /** UPDATE_GAME_SETTINGS for Mish Ana! (the room must be in its SETUP). */
  async settings(c: FakeConn, patch: SettingsPatch, id?: string): Promise<void> {
    await this.act(c, { type: "UPDATE_GAME_SETTINGS", gameId: "mishana", patch } as RoomIntentMsg, id);
  }

  async tv(games: { id: GameId; v: number }[] = ALL_TV_GAMES): Promise<FakeConn> {
    const c = await this.connect({ label: "tv" });
    await this.send(c, { v: 2, t: "hello", role: "tv", tvToken: TV_TOKEN, games });
    return c;
  }

  async spectator(opts: { ip?: string; label?: string } = {}): Promise<FakeConn> {
    const c = await this.connect(opts);
    await this.send(c, { v: 2, t: "hello", role: "player" });
    return c;
  }

  async player(i: number, opts: { ip?: string } = {}): Promise<{ conn: FakeConn; pid: string; token: string }> {
    const colors = ["coral", "azure", "lemon", "jade", "grape", "tangerine", "aqua", "rose", "mint", "plum", "sand", "lilac"];
    const conn = await this.spectator({ ip: opts.ip, label: `p${i}` });
    await this.send(conn, { v: 2, t: "join", name: `Player ${i}`, color: colors[i % 12], locale: "en" });
    const w = conn.last("welcome");
    if (!w) throw new Error(`join failed: ${conn.errors().join(",")}`);
    return { conn, pid: w.playerId as string, token: w.resumeToken as string };
  }

  async resume(token: string, label = "resume"): Promise<FakeConn> {
    const c = await this.connect({ label });
    await this.send(c, { v: 2, t: "hello", role: "player", resumeToken: token });
    return c;
  }

  /**
   * TV + `n` joined players, hub → OPEN_GAME mishana, timers off (plus `settings`), then START_GAME; with `ready`,
   * every player is READY so the game is in CLUES round 1.
   */
  async startedGame(opts: { n?: number; settings?: SettingsPatch; ready?: boolean } = {}): Promise<{ tv: FakeConn; ps: { conn: FakeConn; pid: string; token: string }[] }> {
    const tv = await this.tv();
    const ps = [];
    for (let i = 0; i < (opts.n ?? 4); i++) ps.push(await this.player(i));
    await this.open(tv);
    await this.settings(tv, { ...TIMERS_OFF, ...opts.settings });
    await this.act(tv, { type: "START_GAME" });
    if (this.room.phase !== "PLAYING") throw new Error(`START_GAME failed: ${tv.errors().join(",")}`);
    if (opts.ready) for (const p of ps) await this.game(p.conn, { type: "READY" });
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
            await this.game(vc.conn, { type: "CAST_VOTE", targetId: t2.id });
            continue;
          }
        }
      }
      await this.game(tv, { type: "HOST_ADVANCE" });
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
