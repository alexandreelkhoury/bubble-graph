// JAMAA-PLATFORM §8.9: history from Workers Analytics Engine (dataset `jamaa_events`) through its SQL API, for the
// admin page. Needs the read-only API token secret CF_ANALYTICS_TOKEN (Account › Account Analytics › Read) and the var
// CF_ACCOUNT_ID; without them the admin page shows how to connect it. Answers are cached in the Stats DO for
// HISTORY_TTL_MS (admin-store.ts), so a page refreshing every 30 s asks the API at most once per 5 minutes.
// Counts are SUM(_sample_interval) (AE samples under load). The token is sent only to api.cloudflare.com, never logged.
import type { Env } from "../env";
import type { AdminStoreApi } from "./stats-api";

export const AE_DATASET = "jamaa_events";
export const HISTORY_DAYS = 90;
export const CONTENT_WINDOWS = [30, 90] as const;
export const HISTORY_TTL_MS = 5 * 60_000;
export const CONTENT_LIMIT = 100;
export const AE_SQL_URL = (account: string): string => `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`;
export const CONNECT_HELP =
  "Connect Analytics: in the Cloudflare dashboard, My Profile → API Tokens → Create Token → Custom token with the permission " +
  "Account › Account Analytics › Read, then run `npx wrangler secret put CF_ANALYTICS_TOKEN` (CF_ACCOUNT_ID is a var in wrangler.jsonc).";

const ACCOUNT_RE = /^[0-9a-f]{32}$/;

const n = "SUM(_sample_interval) AS n";
const since = (days: number): string => `timestamp > NOW() - INTERVAL '${Math.trunc(days)}' DAY`;
const day = "toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day";
const from = (event: string, days: number): string => `FROM ${AE_DATASET} WHERE index1 = '${event}' AND ${since(days)}`;

/** The history panels' SQL (fixed strings: only the integer day window varies). */
export function historySql(days = HISTORY_DAYS): Record<HistoryPanel, string> {
  return {
    gamesPerDay: `SELECT ${day}, blob2 AS game, ${n} ${from("game_started", days)} GROUP BY day, game ORDER BY day FORMAT JSON`,
    roomsPerDay: `SELECT ${day}, ${n} ${from("room_created", days)} GROUP BY day ORDER BY day FORMAT JSON`,
    ends: `SELECT blob2 AS game, blob5 AS reason, ${n}, SUM(_sample_interval * double2) AS dur ${from("game_ended", days)} GROUP BY game, reason ORDER BY n DESC FORMAT JSON`,
    languages: `SELECT blob3 AS locale, ${n} ${from("game_started", days)} GROUP BY locale ORDER BY n DESC FORMAT JSON`,
    platforms: `SELECT blob4 AS platform, ${n} ${from("room_created", days)} GROUP BY platform ORDER BY n DESC FORMAT JSON`,
    players: `SELECT blob2 AS game, double1 AS players, ${n} ${from("game_started", days)} GROUP BY game, players ORDER BY game, players FORMAT JSON`,
  };
}
export type HistoryPanel = "gamesPerDay" | "roomsPerDay" | "ends" | "languages" | "platforms" | "players";

/** The most skipped / voided / hidden pack items in the last `days` days. */
export function contentSql(days: number): string {
  return `SELECT blob2 AS game, blob7 AS pack, blob8 AS item, blob5 AS action, ${n} ${from("content_flag", days)} GROUP BY game, pack, item, action ORDER BY n DESC LIMIT ${CONTENT_LIMIT} FORMAT JSON`;
}

type Row = Record<string, string | number>;
/** Numbers come back as strings for some column types: coerce the numeric ones (n, dur, players). */
function rows(json: unknown): Row[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new Error("AE_BAD_RESPONSE");
  return data.map((r: Record<string, unknown>) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) out[k] = k === "n" || k === "dur" || k === "players" ? Number(v) || 0 : String(v ?? "");
    return out;
  });
}

export interface HistoryDeps { fetch: typeof fetch; now: () => number; store: AdminStoreApi | null }

export function analyticsReady(env: Pick<Env, "CF_ACCOUNT_ID" | "CF_ANALYTICS_TOKEN">): boolean {
  return ACCOUNT_RE.test(env.CF_ACCOUNT_ID ?? "") && typeof env.CF_ANALYTICS_TOKEN === "string" && env.CF_ANALYTICS_TOKEN.length >= 20;
}

export async function aeQuery(env: Pick<Env, "CF_ACCOUNT_ID" | "CF_ANALYTICS_TOKEN">, sql: string, f: typeof fetch): Promise<Row[]> {
  const res = await f(AE_SQL_URL(env.CF_ACCOUNT_ID as string), {
    method: "POST", headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN as string}`, "Content-Type": "text/plain" }, body: sql,
  });
  if (!res.ok) {
    // Cloudflare's own reason (e.g. a disabled dataset or a quota) makes the admin message actionable; the body never
    // carries the token, and it is cut short.
    const why = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    throw new Error(`AE_HTTP_${res.status}${why ? `: ${why}` : ""}`);
  }
  return rows(await res.json());
}

/** Cached in the Stats DO; a cache miss or a missing STATS binding asks the API. */
async function cached<T>(deps: HistoryDeps, key: string, load: () => Promise<T>): Promise<{ at: number; value: T; cached: boolean }> {
  const hit = await deps.store?.cacheGet(key).catch(() => null);
  if (hit) return { at: hit.at, value: hit.value as T, cached: true };
  const value = await load();
  const at = deps.now();
  await deps.store?.cachePut(key, value, HISTORY_TTL_MS).catch(() => undefined);
  return { at, value, cached: false };
}

export type AnalyticsAnswer = { connected: false; help: string } | { connected: true; error: string } | ({ connected: true; at: number; cached: boolean } & Record<string, unknown>);

export async function historyBody(env: Env, deps: HistoryDeps): Promise<AnalyticsAnswer> {
  if (!analyticsReady(env)) return { connected: false, help: CONNECT_HELP };
  try {
    const sql = historySql();
    const r = await cached(deps, `history:${HISTORY_DAYS}`, async () => {
      const keys = Object.keys(sql) as HistoryPanel[];
      // One query at a time: six parallel calls drew HTTP 429 from the AE SQL API.
      const all: Row[][] = [];
      for (const k of keys) all.push(await aeQuery(env, sql[k], deps.fetch));
      return Object.fromEntries(keys.map((k, i) => [k, all[i]])) as Record<HistoryPanel, Row[]>;
    });
    return { connected: true, at: r.at, cached: r.cached, days: HISTORY_DAYS, ...r.value };
  } catch (e) {
    return { connected: true, error: e instanceof Error && /^AE_/.test(e.message) ? e.message : "AE_UNREACHABLE" };
  }
}

export async function contentBody(env: Env, days: number, deps: HistoryDeps): Promise<AnalyticsAnswer> {
  if (!analyticsReady(env)) return { connected: false, help: CONNECT_HELP };
  try {
    const r = await cached(deps, `content:${days}`, () => aeQuery(env, contentSql(days), deps.fetch));
    return { connected: true, at: r.at, cached: r.cached, days, items: r.value };
  } catch (e) {
    return { connected: true, error: e instanceof Error && /^AE_/.test(e.message) ? e.message : "AE_UNREACHABLE" };
  }
}
