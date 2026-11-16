import type { Billing } from "./billing/billing-do";
import type { Room } from "./room";
import type { Stats } from "./monitor/stats-do";
export interface Env {
  Room: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
  CREATE_ROOM_LIMITER: RateLimit;
  CONNECT_LIMITER: RateLimit;
  JOIN_BASE_URL: string;
  ALLOWED_ORIGINS: string;
  DEBUG_INVARIANTS: string;
  /** "1" turns premium/billing on (config.ts); anything else, or unset, keeps it entirely off. */
  BILLING_ENABLED?: string;
  /** JAMAA-PLATFORM §2.6: comma list of live games (default "mishana", config.ts). */
  GAMES_ENABLED?: string;
  /** "1" serves Most Likely's Spicy 18+ pack (config.ts spicyEnabled); production "0". */
  LIKELY_SPICY_ENABLED?: string;
  // PAYMENTS-SPEC §3.2. Secrets are optional at the type level: local dev (fake mode) runs without them.
  BILLING: DurableObjectNamespace<Billing>;
  BILLING_LIMITER: RateLimit;
  RTDN_LIMITER: RateLimit;
  BILLING_MODE: string;
  ALLOW_FAKE_BILLING: string;
  PLAY_PACKAGE_NAME: string;
  RTDN_AUDIENCE: string;
  RTDN_SA_EMAIL: string;
  RTDN_SUBSCRIPTION: string;
  PLAY_SERVICE_ACCOUNT_JSON?: string;
  ENTITLEMENT_KEYS?: string;
  /** PAYMENTS-SPEC §3.12: optional owner secret for /api/admin/* (unset = those endpoints answer 404). */
  ADMIN_TOKEN?: string;
  // JAMAA-PLATFORM §8 monitoring. Bindings are optional at the type level: tests and a Worker without them still run
  // (no counters, no forwarding, alerts only logged).
  /** Singleton live counters, hourly counts, error ring and alert incidents. */
  STATS?: DurableObjectNamespace<Stats>;
  /** Workers Analytics Engine dataset `jamaa_events`, production `jamaa_events_prod` (one point per meaningful event). */
  EVENTS?: AnalyticsEngineDataset;
  /** Per-IP limit for POST /api/client-errors. */
  CLIENT_ERROR_LIMITER?: RateLimit;
  /** Cloudflare Email Routing `send_email` binding for alerts (unset or unconfigured = alerts are only logged). */
  ALERT_MAILER?: SendEmail;
  /** Owner address (a verified Email Routing destination) and the sender on a domain with Email Routing on. */
  ALERT_EMAIL?: string;
  ALERT_EMAIL_FROM?: string;
  ALERT_SERVER_ERRORS_PER_HOUR?: string;
  ALERT_CLIENT_ERRORS_PER_HOUR?: string;
  PLAN_DAILY_REQUESTS?: string;
  ALERT_QUOTA_RATIO?: string;
  /** JAMAA-PLATFORM §8.9: the account whose Analytics Engine SQL API the admin history reads (a var). */
  CF_ACCOUNT_ID?: string;
  /** The Analytics Engine dataset the admin history queries (= the EVENTS binding's dataset; unset = jamaa_events). */
  AE_DATASET?: string;
  /** Read-only API token (Account › Account Analytics › Read), a secret. Unset = the admin page asks to connect it. */
  CF_ANALYTICS_TOKEN?: string;
}
