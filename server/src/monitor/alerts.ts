// JAMAA-PLATFORM §7.4: alert rules, evaluated by the hourly cron on the Stats counters (pure; stats-core.ts stores the
// incidents, index.ts sends the notification). ONE notification per incident: an incident opens when a rule crosses its
// threshold, stays open (silent) while it keeps firing, and closes at the first evaluation below it. A rule that
// re-opens within ALERT_RENOTIFY_MS of its last notification is recorded but not notified again (flapping).
import type { Counters } from "./stats-core";

export type AlertRule = "server_errors" | "client_errors" | "quota";

export interface AlertIncident {
  key: string;
  rule: AlertRule;
  openedAt: number;
  lastSeenAt: number;
  closedAt: number | null;
  value: number;
  threshold: number;
  notifiedAt: number | null;
}

export interface AlertConfig {
  /** Server errors in the last complete hour (0 = rule off). */
  serverErrorsPerHour: number;
  /** Client error reports in the last complete hour (0 = rule off). */
  clientErrorsPerHour: number;
  /** The plan's daily Worker request quota (Free plan: 100 000/day, unverified for this account). */
  dailyRequests: number;
  /** Alert when today's ESTIMATED requests reach this share of the quota. */
  quotaRatio: number;
  renotifyMs: number;
}

export interface AlertMetrics { lastHour: Counters; today: Counters }
export interface AlertResult {
  incidents: Record<string, AlertIncident>;
  /** Incidents to notify now (each exactly once). */
  notify: AlertIncident[];
  /** Every incident still open after this evaluation. */
  open: AlertIncident[];
}

export const ALERT_DEFAULTS: AlertConfig = {
  serverErrorsPerHour: 20, clientErrorsPerHour: 50, dailyRequests: 100_000, quotaRatio: 0.8, renotifyMs: 6 * 3_600_000,
};
const CLOSED_KEPT_MS = 7 * 86_400_000;

/**
 * Worker requests per counted thing, for the free-plan ESTIMATE (the real number is in the Cloudflare dashboard):
 * a room = POST /api/rooms + GET /api/config + the TV's WebSocket upgrade + one reconnect; a player = GET /api/config +
 * the WebSocket upgrade + two reconnects; a client error report = 1. Static assets do not invoke the Worker.
 */
export const REQUESTS_PER_ROOM = 4;
export const REQUESTS_PER_PLAYER = 4;

export function estimateRequests(c: Counters): number {
  return (c.rooms_created ?? 0) * REQUESTS_PER_ROOM + (c.players_joined ?? 0) * REQUESTS_PER_PLAYER + (c.client_errors ?? 0);
}

function num(raw: string | undefined, dflt: number): number {
  if (raw === undefined || raw.trim() === "") return dflt;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

export interface AlertEnv {
  ALERT_SERVER_ERRORS_PER_HOUR?: string; ALERT_CLIENT_ERRORS_PER_HOUR?: string; PLAN_DAILY_REQUESTS?: string; ALERT_QUOTA_RATIO?: string;
}

export function alertConfig(env: AlertEnv): AlertConfig {
  const ratio = num(env.ALERT_QUOTA_RATIO, ALERT_DEFAULTS.quotaRatio);
  return {
    serverErrorsPerHour: num(env.ALERT_SERVER_ERRORS_PER_HOUR, ALERT_DEFAULTS.serverErrorsPerHour),
    clientErrorsPerHour: num(env.ALERT_CLIENT_ERRORS_PER_HOUR, ALERT_DEFAULTS.clientErrorsPerHour),
    dailyRequests: num(env.PLAN_DAILY_REQUESTS, ALERT_DEFAULTS.dailyRequests),
    quotaRatio: ratio > 0 && ratio <= 1 ? ratio : ALERT_DEFAULTS.quotaRatio,
    renotifyMs: ALERT_DEFAULTS.renotifyMs,
  };
}

export function evaluateAlerts(prev: Readonly<Record<string, AlertIncident>>, m: AlertMetrics, now: number, cfg: AlertConfig): AlertResult {
  const day = new Date(now).toISOString().slice(0, 10);
  const checks: { key: string; rule: AlertRule; value: number; threshold: number }[] = [
    { key: "server_errors", rule: "server_errors", value: m.lastHour.server_errors ?? 0, threshold: cfg.serverErrorsPerHour },
    { key: "client_errors", rule: "client_errors", value: m.lastHour.client_errors ?? 0, threshold: cfg.clientErrorsPerHour },
    { key: `quota:${day}`, rule: "quota", value: estimateRequests(m.today), threshold: Math.round(cfg.dailyRequests * cfg.quotaRatio) },
  ];
  const incidents: Record<string, AlertIncident> = {};
  for (const [k, inc] of Object.entries(prev)) {
    if (inc.closedAt !== null && now - inc.closedAt > CLOSED_KEPT_MS) continue;
    incidents[k] = { ...inc };
  }
  // A quota incident of an earlier day closes with that day.
  for (const inc of Object.values(incidents)) if (inc.rule === "quota" && inc.key !== `quota:${day}` && inc.closedAt === null) inc.closedAt = now;
  const notify: AlertIncident[] = [];
  for (const c of checks) {
    const firing = c.threshold > 0 && c.value >= c.threshold;
    const cur = incidents[c.key];
    if (firing) {
      if (cur && cur.closedAt === null) {
        cur.lastSeenAt = now;
        cur.value = Math.max(cur.value, c.value);
        continue;
      }
      const lastNotified = cur?.notifiedAt ?? null;
      const shouldNotify = lastNotified === null || now - lastNotified >= cfg.renotifyMs;
      const inc: AlertIncident = {
        key: c.key, rule: c.rule, openedAt: now, lastSeenAt: now, closedAt: null, value: c.value, threshold: c.threshold,
        notifiedAt: shouldNotify ? now : lastNotified,
      };
      incidents[c.key] = inc;
      if (shouldNotify) notify.push(inc);
    } else if (cur && cur.closedAt === null) {
      cur.closedAt = now;
    }
  }
  return { incidents, notify, open: Object.values(incidents).filter((i) => i.closedAt === null) };
}

/** The one-line, PII-free text of an alert (log line, email subject and body). */
export function describeAlert(i: AlertIncident): string {
  switch (i.rule) {
    case "server_errors": return `JAMAA: ${i.value} server errors in the last hour (threshold ${i.threshold})`;
    case "client_errors": return `JAMAA: ${i.value} client error reports in the last hour (threshold ${i.threshold})`;
    case "quota": return `JAMAA: about ${i.value} Worker requests today (estimate; alert at ${i.threshold})`;
  }
}
