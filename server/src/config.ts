// The production switch for everything premium/billing: the BILLING_ENABLED Worker var (wrangler.jsonc, default "0").
// Off (anything but "1"): /api/billing/* and /api/admin/* answer 404, the crons do nothing, createRoom ignores
// entitlement tokens, rooms play the whole catalog (as before payments) and ignore `entitlement` / `storeOpen`, and
// GET /api/config tells every client to hide its premium UI and never call billing. "1": PAYMENTS-SPEC as written.
import type { ClientConfigBody } from "@mishana/shared/protocol";
import { notFound } from "./request";

export const CONFIG_PATH = "/api/config";
/** BILLING_PREFIX (billing/routes.ts) and ADMIN_PREFIX (admin.ts), repeated so this module imports neither (http.ts uses it). */
export const GATED_PREFIXES = ["/api/billing/", "/api/admin/"] as const;

export function billingEnabled(env: { BILLING_ENABLED?: string | undefined }): boolean {
  return env.BILLING_ENABLED === "1";
}

/** GET/HEAD /api/config. Never cached, so flipping the var takes effect on the next page load. */
export function handleConfig(req: Request, env: { BILLING_ENABLED?: string | undefined }): Response {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "BAD_MESSAGE" }), { status: 405, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  const body: ClientConfigBody = { billing: billingEnabled(env) };
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

/** 404 for a billing or admin path while billing is off; null otherwise (route as usual). */
export function billingGate(path: string, env: { BILLING_ENABLED?: string | undefined }): Response | null {
  if (billingEnabled(env)) return null;
  return GATED_PREFIXES.some((p) => path.startsWith(p)) ? notFound() : null;
}
