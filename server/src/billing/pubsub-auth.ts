// PAYMENTS-SPEC §3.6: Pub/Sub push OIDC verification (RS256 against Google's JWKS, cached per isolate).
import { RTDN_AUTH_HEADER_MAX_CHARS } from "@mishana/shared/constants";
import { b64urlDecode } from "./token";

export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS: readonly string[] = ["accounts.google.com", "https://accounts.google.com"];
export const CLOCK_SKEW_S = 300;
export const MAX_TOKEN_LIFETIME_S = 86_400;
export const JWKS_DEFAULT_MAX_AGE_MS = 3_600_000;
export const JWKS_REFETCH_MIN_GAP_MS = 60_000;

const BEARER_RE = /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Cheap pre-auth guard (before any crypto or body read): present, ≤ 4096 chars, `Bearer <jwt>` shape. */
export function bearerFromHeader(h: string | null): string | null {
  if (h === null || h.length > RTDN_AUTH_HEADER_MAX_CHARS || !BEARER_RE.test(h)) return null;
  return h.slice("Bearer ".length);
}

export type AuthReason = "malformed" | "alg" | "kid" | "signature" | "iss" | "aud" | "email" | "email_verified" | "time" | "jwks";
export type AuthResult = { ok: true } | { ok: false; reason: AuthReason };

interface Jwk { kid?: unknown; kty?: unknown; n?: unknown; e?: unknown }

/** Google's signing keys, cached per isolate (honours Cache-Control max-age); an unknown kid refetches at most once per 60 s. */
export class JwksCache {
  #keys = new Map<string, CryptoKey>();
  #until = 0;
  #lastFetch = -Infinity;
  #inflight: Promise<void> | null = null;

  constructor(private readonly deps: { fetch: typeof fetch; now: () => number }) {}

  async keyFor(kid: string): Promise<CryptoKey | null> {
    const now = this.deps.now();
    if (now >= this.#until) await this.#refresh();
    let k = this.#keys.get(kid);
    if (!k && this.deps.now() - this.#lastFetch >= JWKS_REFETCH_MIN_GAP_MS) {
      await this.#refresh();
      k = this.#keys.get(kid);
    }
    return k ?? null;
  }

  #refresh(): Promise<void> {
    return (this.#inflight ??= this.#load().finally(() => {
      this.#inflight = null;
    }));
  }

  /**
   * One JWKS fetch. A failure (network, non-2xx, bad JSON) or a response with no importable key keeps the previous keys
   * and defers the next attempt by JWKS_REFETCH_MIN_GAP_MS, so an outage or a flood of junk bearers costs at most one
   * fetch per gap instead of one per request.
   */
  async #load(): Promise<void> {
    const started = this.deps.now();
    this.#lastFetch = started;
    const failed = (): void => {
      this.#until = started + JWKS_REFETCH_MIN_GAP_MS;
    };
    let res: Response;
    try {
      res = await this.deps.fetch(GOOGLE_JWKS_URL);
    } catch {
      return failed();
    }
    if (!res.ok) return failed();
    let body: { keys?: Jwk[] };
    try {
      body = (await res.json()) as { keys?: Jwk[] };
    } catch {
      return failed();
    }
    const next = new Map<string, CryptoKey>();
    for (const k of Array.isArray(body.keys) ? body.keys : []) {
      if (typeof k.kid !== "string" || k.kty !== "RSA" || typeof k.n !== "string" || typeof k.e !== "string") continue;
      try {
        next.set(k.kid, await crypto.subtle.importKey("jwk", { kty: "RSA", n: k.n, e: k.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
      } catch {
        // skip a key we cannot import
      }
    }
    if (next.size === 0) return failed(); // an empty set never wipes the cached keys
    this.#keys = next;
    const m = /max-age=(\d+)/.exec(res.headers.get("Cache-Control") ?? "");
    this.#until = this.deps.now() + (m ? Number(m[1]) * 1000 : JWKS_DEFAULT_MAX_AGE_MS);
  }
}

function jsonSeg(seg: string): Record<string, unknown> | null {
  const bytes = b64urlDecode(seg);
  if (!bytes) return null;
  try {
    const v = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes)) as unknown;
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Verifies a Pub/Sub push OIDC token (§3.6 Auth 1–6). */
export async function verifyPubsubJwt(jwt: string, expect: { audience: string; email: string }, jwks: JwksCache, nowMs: number): Promise<AuthResult> {
  const parts = jwt.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [h, p, s] = parts as [string, string, string];
  const head = jsonSeg(h);
  const claims = jsonSeg(p);
  const sig = b64urlDecode(s);
  if (!head || !claims || !sig) return { ok: false, reason: "malformed" };
  if (head.alg !== "RS256") return { ok: false, reason: "alg" };
  if (typeof head.kid !== "string") return { ok: false, reason: "kid" };
  const key = await jwks.keyFor(head.kid);
  if (!key) return { ok: false, reason: "kid" };
  let valid: boolean;
  try {
    valid = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, sig, new TextEncoder().encode(`${h}.${p}`));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: "signature" };
  if (typeof claims.iss !== "string" || !GOOGLE_ISSUERS.includes(claims.iss)) return { ok: false, reason: "iss" };
  if (expect.audience === "" || claims.aud !== expect.audience) return { ok: false, reason: "aud" };
  if (expect.email === "" || claims.email !== expect.email) return { ok: false, reason: "email" };
  if (claims.email_verified !== true) return { ok: false, reason: "email_verified" };
  const now = nowMs / 1000;
  const iat = claims.iat;
  const exp = claims.exp;
  if (typeof iat !== "number" || typeof exp !== "number") return { ok: false, reason: "time" };
  if (!(iat - CLOCK_SKEW_S <= now && now <= exp + CLOCK_SKEW_S && exp - now < MAX_TOKEN_LIFETIME_S)) return { ok: false, reason: "time" };
  return { ok: true };
}

let sharedJwks: JwksCache | null = null;
/** The per-isolate JWKS cache used in production. */
export function googleJwks(): JwksCache {
  return (sharedJwks ??= new JwksCache({ fetch: (u, i) => fetch(u, i), now: () => Date.now() }));
}
