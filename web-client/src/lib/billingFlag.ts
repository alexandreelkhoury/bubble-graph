// BILLING_ENABLED (server/src/config.ts): the one place the web client learns whether premium/billing exists.
// GET /api/config once per page. Until it answers, and if it fails, billing is OFF (fail closed): no premium chip, no
// Premium button, no Store, no install id, and the TV mock never calls /api/billing/* nor sends `entitlement` /
// `storeOpen`. Zod-free (main bundle).
import { signal } from "@preact/signals";
import type { ClientConfigBody } from "@mishana/shared/protocol";

export const billingEnabled = signal(false);

let loading: Promise<boolean> | null = null;

/** Only an explicit `{"billing": true}` turns billing on. */
export function parseClientConfig(body: unknown): boolean {
  return typeof body === "object" && body !== null && (body as Partial<ClientConfigBody>).billing === true;
}

/** Fetches the flag once per page (later calls share the first answer) and sets `billingEnabled`. Never rejects. */
export function loadBillingFlag(fetchFn: typeof fetch = (u, i) => fetch(u, i)): Promise<boolean> {
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
