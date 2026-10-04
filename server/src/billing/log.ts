// PAYMENTS-SPEC §3.9: the ONLY logging entry point in server/src/billing. A log line is JSON with a `code`, plus
// counts, booleans, HTTP statuses and a few fixed enum strings. Every other string value is replaced by
// "[redacted]", so a token, a token hash, an install id, an email, an order id or a Google URL can never be logged.

export type BillingLogCode =
  | "BILLING_BUDGET" | "BILLING_AUTH" | "BILLING_RESTORE_OTHER_INSTALL" | "BILLING_ACK_REJECTED" | "BILLING_ACK_OVERDUE"
  | "BILLING_SUB_STALE" | "BILLING_NOT_CONFIGURED" | "BILLING_REVOKE_SUB_IGNORED" | "BILLING_UPSTREAM" | "BILLING_INTERNAL"
  | "BILLING_CRON" | "BILLING_INSTALL_SHARED" | "RTDN_AUTH" | "RTDN_BAD" | "RTDN_WRONG_SUBSCRIPTION" | "RTDN_PACKAGE" | "RTDN_TEST" | "RTDN_UPSTREAM";

/** The only keys whose string values may be logged, each with its closed set of values. */
const ENUM_FIELDS: Readonly<Record<string, ReadonlySet<string>>> = {
  reason: new Set([
    "header", "alg", "kid", "signature", "iss", "aud", "email", "email_verified", "time", "jwks", "malformed", "not_configured",
    "data", "body", "timeout", "network", "status", "deadline",
  ]),
  op: new Set(["token", "sub_get", "product_get", "sub_ack", "product_ack", "voided_list", "jwks", "hourly", "daily", "verify", "rtdn", "cron"]),
};

export const REDACTED = "[redacted]";

export type LogValue = number | boolean | string | null;

/** Sanitised copy of `fields` (exported for the log test). */
export function sanitizeLogFields(fields: Readonly<Record<string, LogValue>>): Record<string, number | boolean | string | null> {
  const out: Record<string, number | boolean | string | null> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === "code") continue;
    if (typeof v === "number") out[k] = Number.isFinite(v) ? v : null;
    else if (typeof v === "boolean" || v === null) out[k] = v;
    else out[k] = ENUM_FIELDS[k]?.has(v) ? v : REDACTED;
  }
  return out;
}

export function billingLog(code: BillingLogCode, fields: Readonly<Record<string, LogValue>> = {}, level: "log" | "warn" | "error" = "log"): void {
  const line = JSON.stringify({ code, ...sanitizeLogFields(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
