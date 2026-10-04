// PAYMENTS-SPEC §3.7: Google Play Developer API v3 client. Service-account JWT (RS256, WebCrypto) → OAuth access
// token (cached per isolate) → purchases.* calls. Raw purchase tokens appear in request URLs, so URLs are never
// logged and never put in errors: failures throw GoogleHttpError { status, op } only.
import type { ProductPurchaseV2, SubscriptionPurchaseV2, VoidedPurchasesListResponse } from "./google-types";
import { billingLog } from "./log";
import { b64urlEncode } from "./token";

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const ANDROIDPUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
export const API_ROOT = "https://androidpublisher.googleapis.com/";
export const JWT_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";
/** Drop a cached access token this long before Google says it expires. */
export const ACCESS_TOKEN_MARGIN_S = 300;
export const RETRY_DELAY_MS = 500;
export const GOOGLE_CALL_TIMEOUT_BACKGROUND_MS = 10_000; // RTDN and cron (§3.6, §3.8)
/** OAuth token exchange timeout (capped by the caller's deadline on the verify path). */
export const TOKEN_TIMEOUT_MS = 10_000;
/** [VERIFY] the server's maximum page size is undocumented; any accepted value works because we paginate (§3.7). */
export const VOIDED_MAX_RESULTS = 1000;

export type GoogleOp = "token" | "sub_get" | "product_get" | "sub_ack" | "product_ack" | "voided_list";

/** status 0 = network error or timeout. Carries no URL, token or body. */
export class GoogleHttpError extends Error {
  constructor(readonly status: number, readonly op: GoogleOp) {
    super(`google ${op} failed (${status})`);
    this.name = "GoogleHttpError";
  }
}

/**
 * True only when the purchases API itself answered 400/404/410 for the token: Google does not know it. An OAuth
 * token-endpoint failure (op "token": invalid_grant after a key rotation, clock skew, …) is never "gone"; it is an
 * upstream outage, and `GoogleClient` reports it as status 503 anyway.
 */
export function isGoogleGone(e: unknown): boolean {
  return e instanceof GoogleHttpError && e.op !== "token" && (e.status === 400 || e.status === 404 || e.status === 410);
}

/** An auth failure on our side (token endpoint, or 401/403 from the API): retrying or re-reading cannot help. */
export function isGoogleAuthFailure(e: unknown): boolean {
  return e instanceof GoogleHttpError && (e.op === "token" || e.status === 401 || e.status === 403);
}

export interface CallOpts {
  /** Per-call timeout (3 s on the verify path, 10 s for RTDN/cron). */
  timeoutMs: number;
  /** Absolute time (ms) after which no retry is attempted (the verify deadline). */
  deadlineMs?: number;
}

export interface GoogleApi {
  getSubscriptionV2(token: string, o: CallOpts): Promise<SubscriptionPurchaseV2>;
  getProductV2(token: string, o: CallOpts): Promise<ProductPurchaseV2>;
  ackSubscription(token: string, o: CallOpts): Promise<void>;
  ackProduct(productId: string, token: string, o: CallOpts): Promise<void>;
  listVoided(q: { startTimeMs: number; pageToken?: string | undefined }, o: CallOpts): Promise<VoidedPurchasesListResponse>;
}

export interface ServiceAccount { client_email: string; private_key: string; private_key_id: string }

export function parseServiceAccount(json: string | undefined): ServiceAccount | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    if (typeof v.client_email !== "string" || typeof v.private_key !== "string" || typeof v.private_key_id !== "string") return null;
    return { client_email: v.client_email, private_key: v.private_key, private_key_id: v.private_key_id };
  } catch {
    return null;
  }
}

export interface GoogleDeps {
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const defaultDeps = (): GoogleDeps => ({
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
});

function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----(BEGIN|END) [A-Z ]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const utf8 = new TextEncoder();

/** Signs the service-account assertion (exported for the test that checks its claims and signature). */
export async function signServiceAccountJwt(sa: ServiceAccount, nowS: number): Promise<string> {
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const head = b64urlEncode(utf8.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: sa.private_key_id })));
  const body = b64urlEncode(utf8.encode(JSON.stringify({ iss: sa.client_email, scope: ANDROIDPUBLISHER_SCOPE, aud: GOOGLE_TOKEN_URL, iat: nowS, exp: nowS + 3600 })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, utf8.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64urlEncode(sig)}`;
}

export class GoogleClient implements GoogleApi {
  readonly #sa: ServiceAccount;
  readonly #pkg: string;
  readonly #d: GoogleDeps;
  #cached: { token: string; until: number } | null = null;
  #inflight: Promise<string> | null = null;

  constructor(sa: ServiceAccount, packageName: string, deps: Partial<GoogleDeps> = {}) {
    this.#sa = sa;
    this.#pkg = packageName;
    this.#d = { ...defaultDeps(), ...deps };
  }

  /**
   * Cached access token; concurrent misses share one in-flight request. `deadlineMs` (the verify deadline) shortens
   * the token-exchange timeout so a slow token endpoint cannot push a verify past it.
   */
  accessToken(deadlineMs?: number): Promise<string> {
    const now = this.#d.now();
    if (this.#cached && now < this.#cached.until) return Promise.resolve(this.#cached.token);
    const timeoutMs = deadlineMs === undefined ? TOKEN_TIMEOUT_MS : Math.max(1, Math.min(TOKEN_TIMEOUT_MS, deadlineMs - now));
    return (this.#inflight ??= this.#fetchToken(timeoutMs).finally(() => {
      this.#inflight = null;
    }));
  }

  dropAccessToken(): void {
    this.#cached = null;
  }

  async #fetchToken(timeoutMs: number): Promise<string> {
    const iatS = Math.floor(this.#d.now() / 1000);
    const assertion = await signServiceAccountJwt(this.#sa, iatS);
    const body = `grant_type=${encodeURIComponent(JWT_GRANT_TYPE)}&assertion=${assertion}`;
    const res = await this.#raw("token", GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }, timeoutMs);
    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) billingLog("BILLING_AUTH", { op: "token", status: res.status }, "error");
      throw new GoogleHttpError(res.status, "token");
    }
    let j: { access_token?: unknown; expires_in?: unknown };
    try {
      j = (await res.json()) as typeof j;
    } catch {
      throw new GoogleHttpError(502, "token");
    }
    if (typeof j.access_token !== "string" || typeof j.expires_in !== "number") throw new GoogleHttpError(502, "token");
    this.#cached = { token: j.access_token, until: (iatS + j.expires_in - ACCESS_TOKEN_MARGIN_S) * 1000 };
    return j.access_token;
  }

  /** One fetch with a timeout. Network errors and aborts become status 0. */
  async #raw(op: GoogleOp, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      return await this.#d.fetch(url, { ...init, signal: ac.signal });
    } catch {
      throw new GoogleHttpError(0, op);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Authorised call with the §3.7 retry rules. Returns the successful Response. */
  async #call(op: GoogleOp, method: "GET" | "POST", path: string, o: CallOpts): Promise<Response> {
    const url = API_ROOT + path;
    let retried5xx = false;
    let retried401 = false;
    for (;;) {
      let token: string;
      try {
        token = await this.accessToken(o.deadlineMs);
      } catch {
        // Any token-endpoint failure (400 invalid_grant, 401/403, 5xx, timeout, bad JSON) is an upstream outage for
        // the caller, never "this purchase token is unknown" (isGoogleGone also excludes op "token").
        throw new GoogleHttpError(503, "token");
      }
      const init: RequestInit = { method, headers: { Authorization: `Bearer ${token}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) } };
      if (method === "POST") init.body = "{}";
      let status: number;
      let res: Response | null = null;
      try {
        res = await this.#raw(op, url, init, o.timeoutMs);
        status = res.status;
      } catch (e) {
        status = e instanceof GoogleHttpError ? e.status : 0;
      }
      if (res && res.ok) return res;
      if (status === 401 && !retried401) {
        retried401 = true;
        this.dropAccessToken();
        continue;
      }
      const transient = status === 0 || status === 429 || status >= 500;
      const deadlineOk = o.deadlineMs === undefined || this.#d.now() + RETRY_DELAY_MS + o.timeoutMs <= o.deadlineMs;
      if (transient && !retried5xx && deadlineOk) {
        retried5xx = true;
        await this.#d.sleep(RETRY_DELAY_MS);
        continue;
      }
      if (status === 401 || status === 403) billingLog("BILLING_AUTH", { op, status }, "error");
      throw new GoogleHttpError(status, op);
    }
  }

  #app(): string {
    return `androidpublisher/v3/applications/${encodeURIComponent(this.#pkg)}/purchases/`;
  }

  async getSubscriptionV2(token: string, o: CallOpts): Promise<SubscriptionPurchaseV2> {
    const res = await this.#call("sub_get", "GET", `${this.#app()}subscriptionsv2/tokens/${encodeURIComponent(token)}`, o);
    return (await readJson(res, "sub_get")) as SubscriptionPurchaseV2;
  }

  async getProductV2(token: string, o: CallOpts): Promise<ProductPurchaseV2> {
    const res = await this.#call("product_get", "GET", `${this.#app()}productsv2/tokens/${encodeURIComponent(token)}`, o);
    return (await readJson(res, "product_get")) as ProductPurchaseV2;
  }

  async ackSubscription(token: string, o: CallOpts): Promise<void> {
    // `subscriptionId` is still a required path parameter of subscriptions.acknowledge.
    await this.#call("sub_ack", "POST", `${this.#app()}subscriptions/premium/tokens/${encodeURIComponent(token)}:acknowledge`, o);
  }

  async ackProduct(productId: string, token: string, o: CallOpts): Promise<void> {
    await this.#call("product_ack", "POST", `${this.#app()}products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`, o);
  }

  async listVoided(q: { startTimeMs: number; pageToken?: string | undefined }, o: CallOpts): Promise<VoidedPurchasesListResponse> {
    let qs = `type=1&startTime=${Math.floor(q.startTimeMs)}&maxResults=${VOIDED_MAX_RESULTS}`;
    if (q.pageToken) qs += `&token=${encodeURIComponent(q.pageToken)}`;
    const res = await this.#call("voided_list", "GET", `${this.#app()}voidedpurchases?${qs}`, o);
    return (await readJson(res, "voided_list")) as VoidedPurchasesListResponse;
  }
}

async function readJson(res: Response, op: GoogleOp): Promise<unknown> {
  try {
    const v = (await res.json()) as unknown;
    if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error("shape");
    return v;
  } catch {
    throw new GoogleHttpError(502, op);
  }
}

// One client per isolate and service account (the access-token cache lives in it).
let shared: { key: string; client: GoogleClient } | null = null;
export function googleClientFor(saJson: string, packageName: string): GoogleClient | null {
  const key = `${packageName}\n${saJson}`;
  if (shared?.key === key) return shared.client;
  const sa = parseServiceAccount(saJson);
  if (!sa) return null;
  shared = { key, client: new GoogleClient(sa, packageName) };
  return shared.client;
}

// ------------------------------------------------------------------ acknowledgement (§3.7)

export interface AckStore { markAcked(tokenHash: string): Promise<void> | void }

/**
 * [VERIFY] the exact error Google returns for an already-acknowledged purchase (handled generically by the re-read),
 * and that acknowledge works with the view-only Play permissions of §8.C (watch for BILLING_ACK_REJECTED 401/403).
 *
 * Acknowledges a purchase Google says is paid (shared by verify, RTDN and cron). 2xx → markAcked. 4xx (other than
 * 401/403) → re-read: if Google already reports ACKNOWLEDGED (a concurrent ack) → markAcked, else keep `ack_token`
 * for the cron. 401/403, token-endpoint failures, 429/5xx/timeout → keep `ack_token` with no re-read. Never throws.
 */
export async function ackPurchase(
  api: GoogleApi, store: AckStore, kind: "sub" | "pack", productId: string, rawToken: string, tokenHash: string, o: CallOpts,
): Promise<"acked" | "kept"> {
  try {
    if (kind === "sub") await api.ackSubscription(rawToken, o);
    else await api.ackProduct(productId, rawToken, o);
    await store.markAcked(tokenHash);
    return "acked";
  } catch (e) {
    const status = e instanceof GoogleHttpError ? e.status : 0;
    if (status >= 400 && status < 500 && status !== 429) {
      // 401/403 and token-endpoint failures: a re-read would fail the same way (BILLING_AUTH is already logged).
      if (!isGoogleAuthFailure(e)) {
        try {
          const r = kind === "sub" ? await api.getSubscriptionV2(rawToken, o) : await api.getProductV2(rawToken, o);
          if (r.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") {
            await store.markAcked(tokenHash);
            return "acked";
          }
        } catch {
          // fall through: keep the token for the cron
        }
      }
      billingLog("BILLING_ACK_REJECTED", { status }, "warn");
    }
    return "kept";
  }
}
