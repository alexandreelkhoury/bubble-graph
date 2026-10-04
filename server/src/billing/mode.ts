// PAYMENTS-SPEC §3.10: FAKE billing guards. The mode is decided once per request, in the Worker.

export interface BillingModeEnv {
  BILLING_MODE: string;
  ALLOW_FAKE_BILLING: string;
  PLAY_SERVICE_ACCOUNT_JSON?: string | undefined;
}

export type BillingMode = "google" | "fake";

/** Conditions 1–3: BILLING_MODE=fake, ALLOW_FAKE_BILLING=1 and no Play service account configured. */
export function fakeAllowedByEnv(env: BillingModeEnv): boolean {
  return env.BILLING_MODE === "fake" && env.ALLOW_FAKE_BILLING === "1" && (env.PLAY_SERVICE_ACCOUNT_JSON ?? "") === "";
}

/** Condition 4: localhost, 127.0.0.1, [::1] or a private IPv4 (10/8, 172.16/12, 192.168/16). */
export function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((x) => x > 255)) return false;
  const [a, b] = o as [number, number, number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** "fake" only if all four conditions hold; otherwise "google" (the caller still checks `billingRouteMode`). */
export function billingModeForRequest(env: BillingModeEnv, req: Request): BillingMode {
  if (!fakeAllowedByEnv(env)) return "google";
  let host: string;
  try {
    host = new URL(req.url).hostname;
  } catch {
    return "google";
  }
  return isLocalHostname(host) ? "fake" : "google";
}

/**
 * What the billing routes do for this request: "fake", "google", or "not_configured" (503) when BILLING_MODE asks for
 * fake but any other condition fails (fail closed), or google mode lacks its secrets.
 */
export function billingRouteMode(env: BillingModeEnv & { ENTITLEMENT_KEYS?: string | undefined }, req: Request): BillingMode | "not_configured" {
  const mode = billingModeForRequest(env, req);
  if (mode === "fake") return "fake";
  if (env.BILLING_MODE !== "google") return "not_configured";
  if (!env.PLAY_SERVICE_ACCOUNT_JSON || !env.ENTITLEMENT_KEYS) return "not_configured";
  return "google";
}
