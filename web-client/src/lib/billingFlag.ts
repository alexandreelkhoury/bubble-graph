// BILLING_ENABLED (server/src/config.ts on main): the one place the web client learns whether premium/billing exists.
// GET /api/config once per page (not on this hotfix branch; see loadBillingFlag). Until it answers, and if it fails, billing is OFF (fail closed): no premium chip, no
// Premium button, no Store, no install id, and the TV mock never calls /api/billing/* nor sends `entitlement` /
// `storeOpen`. Zod-free (main bundle).
import { signal } from "@preact/signals";

/** GET /api/config body (inlined: the deployed server predates the shared ClientConfigBody and has no /api/config). */
interface ClientConfigBody { billing: boolean }

export const billingEnabled = signal(false);

let loading: Promise<boolean> | null = null;

/** Only an explicit `{"billing": true}` turns billing on. */
export function parseClientConfig(body: unknown): boolean {
  return typeof body === "object" && body !== null && (body as Partial<ClientConfigBody>).billing === true;
}

/**
 * Fetches the flag once per page (later calls share the first answer) and sets `billingEnabled`. Never rejects.
 * Production hotfix (branch hotfix/prod-hide-billing): the deployed server has no /api/config (it answers 405, which
 * the browser logs as a console error on every load), so without an explicit `fetchFn` billing is simply off and
 * nothing is requested. Main's client fetches /api/config by default.
 */
export function loadBillingFlag(fetchFn?: typeof fetch): Promise<boolean> {
  if (!fetchFn) return (loading ??= Promise.resolve((billingEnabled.value = false)));
  loading ??= fetchFn("/api/config", { cache: "no-store" })
    .then(async (r) => (r.ok ? parseClientConfig(await r.json()) : false))
    .catch(() => false)
    .then((on) => (billingEnabled.value = on));
  return loading;
}

/** Tests only. */
export function resetBillingFlag(): void {
  loading = null;
  billingEnabled.value = false;
}
