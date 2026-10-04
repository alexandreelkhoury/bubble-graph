// Locally generated RSA "Google" signing keys and OIDC tokens for the Pub/Sub push tests.
import { b64urlEncode } from "../../src/billing/token";
import { GOOGLE_JWKS_URL, JwksCache } from "../../src/billing/pubsub-auth";

export const AUD = "https://play.example/api/billing/rtdn";
export const EMAIL = "rtdn-push@proj.iam.gserviceaccount.com";

export interface Signing { kid: string; key: CryptoKey; jwk: JsonWebKey }

export async function rsaKey(kid: string): Promise<Signing> {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  return { kid, key: pair.privateKey, jwk: { kty: "RSA", n: jwk.n, e: jwk.e, kid, alg: "RS256", use: "sig" } as JsonWebKey };
}

export async function oidcToken(s: Signing, nowMs: number, over: Record<string, unknown> = {}, header: Record<string, unknown> = {}): Promise<string> {
  const enc = new TextEncoder();
  const iat = Math.floor(nowMs / 1000);
  const h = b64urlEncode(enc.encode(JSON.stringify({ alg: "RS256", kid: s.kid, typ: "JWT", ...header })));
  const p = b64urlEncode(enc.encode(JSON.stringify({ iss: "https://accounts.google.com", aud: AUD, email: EMAIL, email_verified: true, iat, exp: iat + 3600, sub: "123", ...over })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, s.key, enc.encode(`${h}.${p}`)));
  return `${h}.${p}.${b64urlEncode(sig)}`;
}

/** A JWKS cache over a mocked fetch serving `keys()`; counts fetches. */
export function jwksFor(keys: () => Signing[], now: () => number): { jwks: JwksCache; fetches: () => number } {
  let n = 0;
  const fetchImpl = (async (url: RequestInfo | URL) => {
    if (String(url) !== GOOGLE_JWKS_URL) throw new Error("unexpected url");
    n++;
    return new Response(JSON.stringify({ keys: keys().map((k) => k.jwk) }), { headers: { "Cache-Control": "public, max-age=3600" } });
  }) as typeof fetch;
  return { jwks: new JwksCache({ fetch: fetchImpl, now }), fetches: () => n };
}
