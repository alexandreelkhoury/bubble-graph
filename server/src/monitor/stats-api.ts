// The Stats DO's RPC surface as the Worker and the rooms see it (no `cloudflare:workers` import, so tests can fake it).
import type { GameId } from "@jamaa/shared/games/ids";
import type { Env } from "../env";
import type { AuditEntry, GamesOverride } from "./admin-store";
import type { AlertConfig, AlertResult } from "./alerts";
import type { StatsInput, StatsSnapshot } from "./stats-core";

/** The singleton stub (typed as the RPC surface tests fake). */
export interface StatsApi {
  ingest(events: StatsInput[]): Promise<void>;
  snapshot(): Promise<StatsSnapshot>;
  evaluate(cfg: AlertConfig): Promise<AlertResult>;
}
export function statsStub(env: Pick<Env, "STATS">): StatsApi | null {
  return env.STATS ? (env.STATS.getByName("global") as unknown as StatsApi) : null;
}

/** JAMAA-PLATFORM §8.7 / §8.9: the owner-state RPCs of the same singleton (admin-store.ts). */
export interface AdminStoreApi {
  gamesOverride(): Promise<GamesOverride>;
  setGame(gameId: GameId, enabled: boolean | null): Promise<{ override: GamesOverride; audit: AuditEntry[] }>;
  auditLog(): Promise<AuditEntry[]>;
  cacheGet(key: string): Promise<{ at: number; value: unknown } | null>;
  cachePut(key: string, value: unknown, ttlMs: number): Promise<void>;
}
export function adminStub(env: Pick<Env, "STATS">): AdminStoreApi | null {
  return env.STATS ? (env.STATS.getByName("global") as unknown as AdminStoreApi) : null;
}
