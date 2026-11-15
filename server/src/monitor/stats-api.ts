// The Stats DO's RPC surface as the Worker and the rooms see it (no `cloudflare:workers` import, so tests can fake it).
import type { Env } from "../env";
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
