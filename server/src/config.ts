// Worker vars that switch features on (JAMAA-PLATFORM §2.6, §4.3).
// - BILLING_ENABLED (wrangler.jsonc, default "0"): the production switch for everything premium/billing. Off (anything but
//   "1"): /api/billing/* and /api/admin/grants answer 404, the billing crons do nothing, createRoom ignores entitlement tokens, rooms
//   play the whole catalog and ignore `entitlement` / `storeOpen`, and GET /api/config tells every client to hide its
//   premium UI and never call billing. "1": PAYMENTS-SPEC as written.
// - GAMES_ENABLED (comma list, default "mishana"): the live games. At runtime unknown ids are ignored with one logged
//   error (`games_enabled_unknown_id`), so billing verify and RTDN keep working; check-deploy fails the deploy on them.
//   JAMAA-PLATFORM §8.7: the owner can override it per game from /admin without a redeploy (Stats DO, admin-store.ts).
//   GAMES_ENABLED is the default; the override turns any known game on or off. GET /api/config and POST /api/rooms
//   read the override through a per-isolate cache (GAMES_OVERRIDE_TTL_MS); rooms keep the list they were created with,
//   so no WebSocket message ever reads it.
import { GAME_IDS, isGameId } from "@jamaa/shared/games/ids";
import type { GameId } from "@jamaa/shared/games/ids";
import { REGISTRY_ENABLED } from "@jamaa/shared/games/registry";
import type { ClientConfigV2Body } from "@jamaa/shared/protocol/v2";
import type { Env } from "./env";
import { sanitizeOverride } from "./monitor/admin-store";
import type { GamesOverride } from "./monitor/admin-store";
import { adminStub } from "./monitor/stats-api";
import { notFound } from "./request";

export const CONFIG_PATH = "/api/config";
/**
 * BILLING_PREFIX (billing/routes.ts) and the admin grants route (admin.ts), repeated so this module imports neither
 * (http.ts uses it). The other /api/admin/* routes (monitoring, JAMAA-PLATFORM §8.5) work with billing off.
 */
export const GATED_PREFIXES = ["/api/billing/", "/api/admin/grants"] as const;
export const GAMES_ENABLED_DEFAULT = "mishana";

type ConfigEnv = { BILLING_ENABLED?: string | undefined; GAMES_ENABLED?: string | undefined; STATS?: Env["STATS"] };

export function billingEnabled(env: { BILLING_ENABLED?: string | undefined }): boolean {
  return env.BILLING_ENABLED === "1";
}

/**
 * LIKELY_SPICY_ENABLED: Most Likely's Spicy 18+ pack. "1" = served; anything else or unset = off (the safe default).
 * Production ships "0" for v1 (owner decision 2026-11-17), preview "1". Note the engine also has the compile-time
 * switch LIKELY_SPICY_ENABLED in shared/src/games/likely/meta.ts (false until the platform passes the actor to
 * `settings.apply`, GAME-LIKELY §9.1 rule 2); both must be on for Spicy to be playable.
 */
export function spicyEnabled(env: { LIKELY_SPICY_ENABLED?: string | undefined }): boolean {
  return env.LIKELY_SPICY_ENABLED === "1";
}

/** The ids listed in GAMES_ENABLED (unset → the default), split and trimmed; empty entries dropped. */
export function parseGamesEnabled(raw: string | undefined): { ids: GameId[]; unknown: string[] } {
  const list = (raw ?? GAMES_ENABLED_DEFAULT).split(",").map((x) => x.trim()).filter((x) => x.length > 0);
  const ids = GAME_IDS.filter((id) => list.includes(id));
  return { ids, unknown: list.filter((x) => !isGameId(x)) };
}

const logged = new Set<string>();
/** Test hook: forget which unknown-id errors were logged. */
export function resetGamesEnabledLog(): void {
  logged.clear();
}

/** §2.5: GAMES_ENABLED ∩ registry enabled, in GAME_IDS order. Unknown ids are logged once per isolate and ignored. */
export function enabledGames(env: { GAMES_ENABLED?: string | undefined }): GameId[] {
  const { ids, unknown } = parseGamesEnabled(env.GAMES_ENABLED);
  const key = unknown.join(",");
  if (unknown.length > 0 && !logged.has(key)) {
    logged.add(key);
    // Ids only (they are operator config, never user data).
    console.error(JSON.stringify({ code: "games_enabled_unknown_id", ids: unknown }));
  }
  return ids.filter((id) => REGISTRY_ENABLED.includes(id));
}

/** §8.7: the env list with the admin override applied (on/off per known id), ∩ registry enabled, in GAME_IDS order. */
export function mergeGames(envIds: readonly GameId[], override: GamesOverride): GameId[] {
  return GAME_IDS.filter((id) => REGISTRY_ENABLED.includes(id) && (override[id] ?? envIds.includes(id)));
}

/** At most one Stats read per isolate per this long: a toggle reaches every client within it (≤ 60 s). */
export const GAMES_OVERRIDE_TTL_MS = 30_000;
let overrideCache: { at: number; value: GamesOverride } | null = null;
/** Test hook, and the admin toggle's own isolate (it knows the new value at once). */
export function setGamesOverrideCache(value: GamesOverride | null, at = Date.now()): void {
  overrideCache = value === null ? null : { at, value };
}

/**
 * The admin override, cached per isolate. No STATS binding = none. A failed read keeps the last known value (or none)
 * for another TTL, so a Stats outage never blocks room creation or retries on every request.
 */
export async function gamesOverride(env: Pick<ConfigEnv, "STATS">, now = Date.now()): Promise<GamesOverride> {
  if (overrideCache && now - overrideCache.at < GAMES_OVERRIDE_TTL_MS) return overrideCache.value;
  let value = overrideCache?.value ?? {};
  const stub = adminStub(env);
  if (stub) {
    try {
      value = sanitizeOverride(await stub.gamesOverride());
    } catch {
      // keep the last known override
    }
  }
  overrideCache = { at: now, value };
  return value;
}

/** The live games: GAMES_ENABLED merged with the admin override (POST /api/rooms, GET /api/config). */
export async function effectiveGames(env: ConfigEnv, now = Date.now()): Promise<GameId[]> {
  return mergeGames(enabledGames(env), await gamesOverride(env, now));
}

/** GET/HEAD /api/config. Never cached, so flipping a var takes effect on the next page load (an admin toggle within GAMES_OVERRIDE_TTL_MS). */
export async function handleConfig(req: Request, env: ConfigEnv): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "BAD_MESSAGE" }), { status: 405, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  const body: ClientConfigV2Body = { billing: billingEnabled(env), games: await effectiveGames(env) };
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

/** 404 for a billing or admin path while billing is off; null otherwise (route as usual). */
export function billingGate(path: string, env: { BILLING_ENABLED?: string | undefined }): Response | null {
  if (billingEnabled(env)) return null;
  return GATED_PREFIXES.some((p) => path.startsWith(p)) ? notFound() : null;
}
