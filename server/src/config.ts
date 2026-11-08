// Worker vars that switch features on (JAMAA-PLATFORM §2.6, §4.3).
// - BILLING_ENABLED (wrangler.jsonc, default "0"): the production switch for everything premium/billing. Off (anything but
//   "1"): /api/billing/* and /api/admin/* answer 404, the crons do nothing, createRoom ignores entitlement tokens, rooms
//   play the whole catalog and ignore `entitlement` / `storeOpen`, and GET /api/config tells every client to hide its
//   premium UI and never call billing. "1": PAYMENTS-SPEC as written.
// - GAMES_ENABLED (comma list, default "mishana"): the live games. At runtime unknown ids are ignored with one logged
//   error (`games_enabled_unknown_id`), so billing verify and RTDN keep working; check-deploy fails the deploy on them.
import { GAME_IDS, isGameId } from "@jamaa/shared/games/ids";
import type { GameId } from "@jamaa/shared/games/ids";
import { REGISTRY_ENABLED } from "@jamaa/shared/games/registry";
import type { ClientConfigV2Body } from "@jamaa/shared/protocol/v2";
import { notFound } from "./request";

export const CONFIG_PATH = "/api/config";
/** BILLING_PREFIX (billing/routes.ts) and ADMIN_PREFIX (admin.ts), repeated so this module imports neither (http.ts uses it). */
export const GATED_PREFIXES = ["/api/billing/", "/api/admin/"] as const;
export const GAMES_ENABLED_DEFAULT = "mishana";

type ConfigEnv = { BILLING_ENABLED?: string | undefined; GAMES_ENABLED?: string | undefined };

export function billingEnabled(env: { BILLING_ENABLED?: string | undefined }): boolean {
  return env.BILLING_ENABLED === "1";
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

/** GET/HEAD /api/config. Never cached, so flipping a var takes effect on the next page load. */
export function handleConfig(req: Request, env: ConfigEnv): Response {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "BAD_MESSAGE" }), { status: 405, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  const body: ClientConfigV2Body = { billing: billingEnabled(env), games: enabledGames(env) };
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

/** 404 for a billing or admin path while billing is off; null otherwise (route as usual). */
export function billingGate(path: string, env: { BILLING_ENABLED?: string | undefined }): Response | null {
  if (billingEnabled(env)) return null;
  return GATED_PREFIXES.some((p) => path.startsWith(p)) ? notFound() : null;
}
