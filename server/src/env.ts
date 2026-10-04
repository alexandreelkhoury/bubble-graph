import type { Billing } from "./billing/billing-do";
import type { Room } from "./room";
export interface Env {
  Room: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
  CREATE_ROOM_LIMITER: RateLimit;
  CONNECT_LIMITER: RateLimit;
  JOIN_BASE_URL: string;
  ALLOWED_ORIGINS: string;
  DEBUG_INVARIANTS: string;
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
}
