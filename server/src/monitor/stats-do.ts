// JAMAA-PLATFORM §8.2: the `Stats` Durable Object, a single instance (`env.STATS.getByName("global")`). A thin RPC
// adapter over StatsCore: key-value storage on the SQLite backend, writes batched by one alarm.
import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import type { GameId } from "@jamaa/shared/games/ids";
import { AdminStoreCore } from "./admin-store";
import type { AuditEntry, GamesOverride } from "./admin-store";
import type { AlertConfig, AlertResult } from "./alerts";
import { StatsCore } from "./stats-core";
import type { StatsInput, StatsSnapshot } from "./stats-core";

export class Stats extends DurableObject<Env> {
  readonly #core: StatsCore;
  readonly #admin: AdminStoreCore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const storage = ctx.storage;
    this.#core = new StatsCore({
      get: <T>(key: string) => storage.get<T>(key),
      put: (entries) => storage.put(entries),
      setAlarm: (at) => storage.setAlarm(at),
    });
    this.#admin = new AdminStoreCore({ get: <T>(key: string) => storage.get<T>(key), put: (entries) => storage.put(entries) });
  }

  ingest(events: StatsInput[]): Promise<void> { return this.#core.ingest(events, Date.now()); }
  snapshot(): Promise<StatsSnapshot> { return this.#core.snapshot(Date.now()); }
  evaluate(cfg: AlertConfig): Promise<AlertResult> { return this.#core.evaluate(Date.now(), cfg); }
  // JAMAA-PLATFORM §8.7 / §8.9 (admin-store.ts): game toggles, their audit log, the AE answer cache.
  gamesOverride(): Promise<GamesOverride> { return this.#admin.gamesOverride(); }
  setGame(gameId: GameId, enabled: boolean | null): Promise<{ override: GamesOverride; audit: AuditEntry[] }> { return this.#admin.setGame(gameId, enabled, Date.now()); }
  auditLog(): Promise<AuditEntry[]> { return this.#admin.audit(); }
  cacheGet(key: string): { at: number; value: unknown } | null { return this.#admin.cacheGet(key, Date.now()); }
  cachePut(key: string, value: unknown, ttlMs: number): void { this.#admin.cachePut(key, value, Date.now(), ttlMs); }
  override async alarm(): Promise<void> { await this.#core.flush(); }
}
