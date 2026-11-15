// JAMAA-PLATFORM §7.2: the `Stats` Durable Object's behaviour (runtime-agnostic; stats-do.ts adapts it, tests use a Map).
// A single instance ("global") receives a handful of pings per room (created, game started, game ended, closed) and
// one per error report, never one per WebSocket message. It keeps:
//   - the LIVE rooms and games (id → start time) with a TTL, so a room that crashed without its "closed" ping stops
//     counting after ROOM_LIVE_TTL_MS (games: GAME_LIVE_TTL_MS);
//   - hourly counters (UTC hour index → name → n) for the last HOURS_KEPT hours: today's totals and the alert window;
//   - the last ERRORS_KEPT client and server errors (a ring; identical ones within ERROR_DEDUPE_MS are merged);
//   - the alert incidents (alerts.ts).
// Writes are batched: state lives in memory and is flushed at most every FLUSH_DELAY_MS (one alarm), so storage
// writes do not grow with traffic. A runtime restart between two flushes loses at most that window of counts.
// Every event carries an idempotency key (`seen`), so a duplicated ping is counted once.
import { ROOM_TV_MAX_TTL_MS } from "@jamaa/shared/constants";
import type { GameId } from "@jamaa/shared/games/ids";
import { evaluateAlerts } from "./alerts";
import type { AlertConfig, AlertIncident, AlertMetrics, AlertResult } from "./alerts";
import type { RoomEvent } from "./events";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
export const ROOM_LIVE_TTL_MS = ROOM_TV_MAX_TTL_MS + 30 * 60_000;
export const GAME_LIVE_TTL_MS = 4 * HOUR_MS;
export const HOURS_KEPT = 48;
export const ERRORS_KEPT = 100;
export const SEEN_KEPT = 2000;
export const ERROR_DEDUPE_MS = 10 * 60_000;
export const FLUSH_DELAY_MS = 30_000;

export interface ErrorEntry {
  kind: "client" | "server";
  /** First and last time this fingerprint was seen inside the dedupe window, and how many times. */
  at: number; last: number; n: number;
  /** Server: the log code (INTERNAL, BILLING_UPSTREAM…). Client: the error name (TypeError…). */
  code: string;
  platform?: string; v?: string; screen?: string; message?: string; stack?: string; room?: string;
}

export type StatsInput =
  | RoomEvent
  | { t: "client_error"; at: number; entry: Omit<ErrorEntry, "kind" | "at" | "last" | "n"> }
  | { t: "server_error"; at: number; entry: Omit<ErrorEntry, "kind" | "at" | "last" | "n"> };

interface LiveGame { g: GameId; at: number; p: number }
interface State {
  rooms: Record<string, number>;
  games: Record<string, LiveGame>;
  hours: Record<string, Record<string, number>>;
  seen: string[];
  errors: ErrorEntry[];
  alerts: Record<string, AlertIncident>;
}
type Key = keyof State;
const KEYS: readonly Key[] = ["rooms", "games", "hours", "seen", "errors", "alerts"];

export interface StatsStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(entries: Record<string, unknown>): Promise<void>;
  setAlarm(at: number): Promise<void>;
}

export type Counters = Record<string, number>;

export interface StatsSnapshot {
  now: number;
  live: { rooms: number; games: number; players: number; byGame: Record<string, number> };
  /** Since 00:00 UTC. */
  today: Counters;
  /** The last complete UTC hour (the alert window). */
  lastHour: Counters;
  /** The last 24 hours, oldest first, including the current partial hour. */
  hours: { hour: number; c: Counters }[];
  /** Newest first. */
  errors: ErrorEntry[];
  alerts: AlertIncident[];
}

export const hourOf = (t: number): number => Math.floor(t / HOUR_MS);
export const dayStart = (t: number): number => Math.floor(t / DAY_MS) * DAY_MS;

function addInto(into: Counters, from: Counters | undefined): Counters {
  if (from) for (const [k, n] of Object.entries(from)) into[k] = (into[k] ?? 0) + n;
  return into;
}

export class StatsCore {
  readonly #st: StatsStorage;
  #s: State | null = null;
  readonly #dirty = new Set<Key>();
  #alarmAt: number | null = null;

  constructor(storage: StatsStorage) {
    this.#st = storage;
  }

  async #load(): Promise<State> {
    if (this.#s) return this.#s;
    const [rooms, games, hours, seen, errors, alerts] = await Promise.all(KEYS.map((k) => this.#st.get<unknown>(k)));
    this.#s = {
      rooms: (rooms as State["rooms"] | undefined) ?? {},
      games: (games as State["games"] | undefined) ?? {},
      hours: (hours as State["hours"] | undefined) ?? {},
      seen: (seen as State["seen"] | undefined) ?? [],
      errors: (errors as State["errors"] | undefined) ?? [],
      alerts: (alerts as State["alerts"] | undefined) ?? {},
    };
    return this.#s;
  }

  async #touch(keys: Key[], now: number): Promise<void> {
    for (const k of keys) this.#dirty.add(k);
    if (this.#alarmAt === null && this.#dirty.size > 0) {
      this.#alarmAt = now + FLUSH_DELAY_MS;
      await this.#st.setAlarm(this.#alarmAt);
    }
  }

  /** The alarm: writes every changed key in one put. */
  async flush(): Promise<void> {
    this.#alarmAt = null;
    const s = this.#s;
    if (!s || this.#dirty.size === 0) return;
    const entries: Record<string, unknown> = {};
    for (const k of this.#dirty) entries[k] = s[k];
    this.#dirty.clear();
    await this.#st.put(entries);
  }

  /** Records a batch of events (one RPC). Unknown or duplicate events are ignored. */
  async ingest(events: readonly StatsInput[], now: number): Promise<void> {
    const s = await this.#load();
    const touched = new Set<Key>(this.#expire(s, now));
    for (const ev of events) for (const k of this.#apply(s, ev, now)) touched.add(k);
    await this.#touch([...touched], now);
  }

  #count(s: State, at: number, name: string, n = 1): void {
    if (n <= 0) return;
    const h = String(hourOf(at));
    const bucket = (s.hours[h] ??= {});
    bucket[name] = (bucket[name] ?? 0) + n;
  }

  /** Idempotency: true the first time `key` is seen (within the last SEEN_KEPT keys). */
  #first(s: State, key: string): boolean {
    if (s.seen.includes(key)) return false;
    s.seen.push(key);
    if (s.seen.length > SEEN_KEPT) s.seen.splice(0, s.seen.length - SEEN_KEPT);
    return true;
  }

  #apply(s: State, ev: StatsInput, now: number): Key[] {
    // A timestamp from the future (clock skew between isolates) is clamped; one older than the kept window is dropped.
    const at = Math.min(ev.at, now);
    if (!Number.isFinite(at) || at < now - HOURS_KEPT * HOUR_MS) return [];
    switch (ev.t) {
      case "room_created":
        if (!this.#first(s, `rc:${ev.room}`)) return [];
        s.rooms[ev.room] = at;
        this.#count(s, at, "rooms_created");
        return ["rooms", "hours", "seen"];
      case "room_closed": {
        if (!this.#first(s, `rx:${ev.room}`)) return [];
        delete s.rooms[ev.room];
        for (const id of Object.keys(s.games)) if (id.startsWith(ev.room + ":")) delete s.games[id];
        this.#count(s, at, "players_joined", ev.joins);
        return ["rooms", "games", "hours", "seen"];
      }
      case "game_started":
        if (!this.#first(s, `gs:${ev.game}`)) return [];
        s.games[ev.game] = { g: ev.gameId, at, p: ev.players };
        this.#count(s, at, "games_started");
        this.#count(s, at, `started:${ev.gameId}`);
        this.#count(s, at, "players_joined", ev.joins);
        return ["games", "hours", "seen"];
      case "game_ended":
        if (!this.#first(s, `ge:${ev.game}`)) return [];
        delete s.games[ev.game];
        this.#count(s, at, `ended:${ev.reason}`);
        if (ev.reason === "finished") this.#count(s, at, `finished:${ev.gameId}`);
        this.#count(s, at, "players_joined", ev.joins);
        return ["games", "hours", "seen"];
      case "client_error":
      case "server_error": {
        const kind = ev.t === "client_error" ? "client" : "server";
        this.#count(s, at, `${kind}_errors`);
        this.#pushError(s, { ...ev.entry, kind, at, last: at, n: 1 });
        return ["errors", "hours"];
      }
      default:
        return []; // player_joined / player_left go to Analytics Engine only
    }
  }

  #pushError(s: State, e: ErrorEntry): void {
    const fp = (x: ErrorEntry): string => [x.kind, x.code, x.platform ?? "", x.screen ?? "", (x.message ?? "").slice(0, 120)].join("|");
    const key = fp(e);
    const same = s.errors.findLast((x) => fp(x) === key && e.at - x.last < ERROR_DEDUPE_MS);
    if (same) {
      same.n += 1;
      same.last = e.at;
      if (e.room) same.room = e.room;
      return;
    }
    s.errors.push(e);
    if (s.errors.length > ERRORS_KEPT) s.errors.splice(0, s.errors.length - ERRORS_KEPT);
  }

  /** Drops rooms and games past their TTL and hours past the kept window; returns the keys it changed. */
  #expire(s: State, now: number): Key[] {
    const out: Key[] = [];
    for (const [id, at] of Object.entries(s.rooms)) {
      if (now - at > ROOM_LIVE_TTL_MS) {
        delete s.rooms[id];
        if (!out.includes("rooms")) out.push("rooms");
      }
    }
    for (const [id, g] of Object.entries(s.games)) {
      if (now - g.at > GAME_LIVE_TTL_MS) {
        delete s.games[id];
        if (!out.includes("games")) out.push("games");
      }
    }
    const oldest = hourOf(now) - HOURS_KEPT;
    for (const h of Object.keys(s.hours)) {
      if (Number(h) < oldest) {
        delete s.hours[h];
        if (!out.includes("hours")) out.push("hours");
      }
    }
    return out;
  }

  async snapshot(now: number): Promise<StatsSnapshot> {
    const s = await this.#load();
    const expired = this.#expire(s, now);
    if (expired.length > 0) await this.#touch(expired, now);
    const byGame: Record<string, number> = {};
    let players = 0;
    for (const g of Object.values(s.games)) {
      byGame[g.g] = (byGame[g.g] ?? 0) + 1;
      players += g.p;
    }
    const today: Counters = {};
    const from = hourOf(dayStart(now));
    for (const [h, c] of Object.entries(s.hours)) if (Number(h) >= from) addInto(today, c);
    const cur = hourOf(now);
    const hours: StatsSnapshot["hours"] = [];
    for (let h = cur - 23; h <= cur; h++) hours.push({ hour: h * HOUR_MS, c: { ...(s.hours[String(h)] ?? {}) } });
    return {
      now,
      live: { rooms: Object.keys(s.rooms).length, games: Object.keys(s.games).length, players, byGame },
      today,
      lastHour: { ...(s.hours[String(cur - 1)] ?? {}) },
      hours,
      errors: [...s.errors].reverse(),
      alerts: Object.values(s.alerts).sort((a, b) => b.openedAt - a.openedAt),
    };
  }

  /** The hourly cron: evaluates the alert rules on the last complete hour and today's estimate; stores the incidents. */
  async evaluate(now: number, cfg: AlertConfig): Promise<AlertResult> {
    const snap = await this.snapshot(now);
    const s = await this.#load();
    const metrics: AlertMetrics = { lastHour: snap.lastHour, today: snap.today };
    const r = evaluateAlerts(s.alerts, metrics, now, cfg);
    s.alerts = r.incidents;
    await this.#touch(["alerts"], now);
    await this.flush(); // the cron path writes at once (it runs hourly, not per event)
    return r;
  }
}
