// Durable storage of one room (§7.5): the three KV records and the alarm. Owns the storage keys, batches
// writes into one multi-key put, and caches the scheduled alarm so it is not read back on every entry point.
import type { GameState } from "@mishana/shared/engine";

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

/** The subset of `DurableObjectStorage` the room uses (KV API + alarm). */
export interface RoomStorage {
  get<T>(key: string): Promise<T | undefined>;
  /** Multi-key put: all entries are written atomically. */
  put(entries: Record<string, unknown>): Promise<void>;
  deleteAll(): Promise<void>;
  getAlarm(): Promise<number | null>;
  setAlarm(at: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

/** Everything a room persists. `null` meta: the room was never created (or has expired). */
export interface RoomRecords { meta: RoomMeta | null; state: GameState | null; sessions: Sessions }

const KEY = { meta: "meta", state: "state", sessions: "sessions" } as const;

/** Unset fields are left untouched. */
export type RoomWrite = Partial<{ meta: RoomMeta; state: GameState; sessions: Sessions }>;

export class RoomStore {
  readonly #s: RoomStorage;
  /** The alarm as last read or written; `undefined` = unknown (fresh instance, after a wipe or a fired alarm). */
  #alarmAt: number | null | undefined = undefined;

  constructor(storage: RoomStorage) {
    this.#s = storage;
  }

  async load(): Promise<RoomRecords> {
    const meta = (await this.#s.get<RoomMeta>(KEY.meta)) ?? null;
    const state = (await this.#s.get<GameState>(KEY.state)) ?? null;
    const sessions = (await this.#s.get<Sessions>(KEY.sessions)) ?? {};
    return { meta, state, sessions };
  }

  /** Meta and state only (initRoom's existence check). */
  async loadHead(): Promise<Pick<RoomRecords, "meta" | "state">> {
    const meta = (await this.#s.get<RoomMeta>(KEY.meta)) ?? null;
    const state = meta ? ((await this.#s.get<GameState>(KEY.state)) ?? null) : null;
    return { meta, state };
  }

  /** One atomic put of the given records; no-op when nothing is given. */
  async write(w: RoomWrite): Promise<void> {
    const entries: Record<string, unknown> = {};
    if (w.meta) entries[KEY.meta] = w.meta;
    if (w.state) entries[KEY.state] = w.state;
    if (w.sessions) entries[KEY.sessions] = w.sessions;
    if (Object.keys(entries).length > 0) await this.#s.put(entries);
  }

  /** Deletes every record. Whether the runtime also drops the alarm is not assumed: the cache is reset. */
  async wipe(): Promise<void> {
    await this.#s.deleteAll();
    this.#alarmAt = undefined;
  }

  /** Sets the alarm to `at` unless it is already there. */
  async scheduleAlarm(at: number): Promise<void> {
    if (this.#alarmAt === undefined) this.#alarmAt = await this.#s.getAlarm();
    if (this.#alarmAt === at) return;
    await this.#s.setAlarm(at);
    this.#alarmAt = at;
  }

  async clearAlarm(): Promise<void> {
    await this.#s.deleteAlarm();
    this.#alarmAt = null;
  }

  /** The runtime consumes an alarm when it fires: forget the cached value. */
  alarmFired(): void {
    this.#alarmAt = undefined;
  }
}
