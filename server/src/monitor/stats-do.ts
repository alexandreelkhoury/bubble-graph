// JAMAA-PLATFORM §8.2: the `Stats` Durable Object, a single instance (`env.STATS.getByName("global")`). A thin RPC
// adapter over StatsCore: key-value storage on the SQLite backend, writes batched by one alarm.
import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import type { AlertConfig, AlertResult } from "./alerts";
import { StatsCore } from "./stats-core";
import type { StatsInput, StatsSnapshot } from "./stats-core";

export class Stats extends DurableObject<Env> {
  readonly #core: StatsCore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const storage = ctx.storage;
    this.#core = new StatsCore({
      get: <T>(key: string) => storage.get<T>(key),
      put: (entries) => storage.put(entries),
      setAlarm: (at) => storage.setAlarm(at),
    });
  }

  ingest(events: StatsInput[]): Promise<void> { return this.#core.ingest(events, Date.now()); }
  snapshot(): Promise<StatsSnapshot> { return this.#core.snapshot(Date.now()); }
  evaluate(cfg: AlertConfig): Promise<AlertResult> { return this.#core.evaluate(Date.now(), cfg); }
  override async alarm(): Promise<void> { await this.#core.flush(); }
}
