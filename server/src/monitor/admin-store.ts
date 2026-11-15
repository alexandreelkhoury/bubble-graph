// JAMAA-PLATFORM §8.7 / §8.9: owner state kept in the `Stats` Durable Object next to the live counters (no new
// binding). Runtime-agnostic (stats-do.ts adapts it, tests use a Map):
//   - the game-toggle override (game id → on/off), merged with GAMES_ENABLED by config.ts `effectiveGames`;
//   - the audit log of every toggle change (newest first, AUDIT_KEPT kept);
//   - a short in-memory cache for the Analytics Engine SQL answers (history.ts), so the admin page never hammers the
//     SQL API. In memory only: an evicted DO just asks the API again.
import { isGameId } from "@jamaa/shared/games/ids";
import type { GameId } from "@jamaa/shared/games/ids";

export type GamesOverride = Partial<Record<GameId, boolean>>;
export interface AuditEntry { at: number; gameId: GameId; enabled: boolean | null; before: boolean | null }
export const AUDIT_KEPT = 200;
export const CACHE_KEYS_MAX = 32;
const K_OVERRIDE = "admin:games";
const K_AUDIT = "admin:audit";

export interface AdminStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(entries: Record<string, unknown>): Promise<void>;
}

/** Known game ids with a boolean value only (anything else stored or sent is dropped). */
export function sanitizeOverride(x: unknown): GamesOverride {
  const out: GamesOverride = {};
  if (typeof x !== "object" || x === null) return out;
  for (const [k, v] of Object.entries(x)) if (isGameId(k) && typeof v === "boolean") out[k] = v;
  return out;
}

export class AdminStoreCore {
  readonly #s: AdminStorage;
  readonly #cache = new Map<string, { exp: number; at: number; value: unknown }>();

  constructor(storage: AdminStorage) {
    this.#s = storage;
  }

  async gamesOverride(): Promise<GamesOverride> {
    return sanitizeOverride(await this.#s.get(K_OVERRIDE));
  }

  /** `enabled: null` removes the override (back to GAMES_ENABLED). Override and audit entry in one write. */
  async setGame(gameId: GameId, enabled: boolean | null, at: number): Promise<{ override: GamesOverride; audit: AuditEntry[] }> {
    const override = await this.gamesOverride();
    const before = override[gameId] ?? null;
    const next: GamesOverride = { ...override };
    if (enabled === null) delete next[gameId];
    else next[gameId] = enabled;
    const audit = [{ at, gameId, enabled, before }, ...(await this.audit())].slice(0, AUDIT_KEPT);
    await this.#s.put({ [K_OVERRIDE]: next, [K_AUDIT]: audit });
    return { override: next, audit };
  }

  async audit(): Promise<AuditEntry[]> {
    const a = await this.#s.get<AuditEntry[]>(K_AUDIT);
    return Array.isArray(a) ? a : [];
  }

  /** A cached value younger than its TTL, with the time it was stored; null when missing or stale. */
  cacheGet(key: string, now: number): { at: number; value: unknown } | null {
    const e = this.#cache.get(key);
    if (!e || e.exp <= now) return null;
    return { at: e.at, value: e.value };
  }

  cachePut(key: string, value: unknown, now: number, ttlMs: number): void {
    if (!this.#cache.has(key) && this.#cache.size >= CACHE_KEYS_MAX) {
      for (const [k, e] of this.#cache) if (e.exp <= now) this.#cache.delete(k);
      if (this.#cache.size >= CACHE_KEYS_MAX) this.#cache.delete(this.#cache.keys().next().value as string);
    }
    this.#cache.set(key, { exp: now + ttlMs, at: now, value });
  }
}
