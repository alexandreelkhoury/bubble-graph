// PAYMENTS-SPEC §3.6 / §7.2: Pub/Sub push OIDC verification.
import { describe, expect, it } from "vitest";
import { bearerFromHeader, JwksCache, verifyPubsubJwt } from "../../src/billing/pubsub-auth";
import { handleRtdn } from "../../src/billing/rtdn";
import { newCore } from "../support/billing";
import { AUD, EMAIL, jwksFor, oidcToken, rsaKey } from "../support/oidc";

const NOW = 1_790_000_000_000;
const expect_ = { audience: AUD, email: EMAIL };

describe("verifyPubsubJwt", () => {
  it("valid token", async () => {
    const k = await rsaKey("g1");
    const { jwks, fetches } = jwksFor(() => [k], () => NOW);
    expect(await verifyPubsubJwt(await oidcToken(k, NOW), expect_, jwks, NOW)).toEqual({ ok: true });
    expect(await verifyPubsubJwt(await oidcToken(k, NOW, { iss: "accounts.google.com" }), expect_, jwks, NOW)).toEqual({ ok: true });
    expect(fetches()).toBe(1); // cached
  });

  it("wrong aud, iss, email; email_verified false; expired; alg; bad signature", async () => {
    const k = await rsaKey("g1");
    const other = await rsaKey("g1");
    const { jwks } = jwksFor(() => [k], () => NOW);
    const cases: [Record<string, unknown>, string][] = [
      [{ aud: "https://evil.example/api/billing/rtdn" }, "aud"],
      [{ iss: "https://evil.example" }, "iss"],
      [{ email: "someone@else.com" }, "email"],
      [{ email_verified: false }, "email_verified"],
      [{ email_verified: "true" }, "email_verified"],
      [{ iat: Math.floor(NOW / 1000) - 7200, exp: Math.floor(NOW / 1000) - 3600 }, "time"],
      [{ iat: Math.floor(NOW / 1000) + 600, exp: Math.floor(NOW / 1000) + 4200 }, "time"],
      [{ exp: Math.floor(NOW / 1000) + 90_000 }, "time"],
    ];
    for (const [over, reason] of cases) expect(await verifyPubsubJwt(await oidcToken(k, NOW, over), expect_, jwks, NOW), reason).toEqual({ ok: false, reason });
    expect(await verifyPubsubJwt(await oidcToken(k, NOW, {}, { alg: "HS256" }), expect_, jwks, NOW)).toEqual({ ok: false, reason: "alg" });
    expect(await verifyPubsubJwt(await oidcToken(other, NOW), expect_, jwks, NOW)).toEqual({ ok: false, reason: "signature" });
    expect(await verifyPubsubJwt("a.b", expect_, jwks, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("an unknown kid triggers one refetch, at most once per 60 s", async () => {
    let now = NOW;
    const k1 = await rsaKey("g1");
    const k2 = await rsaKey("g2");
    let served = [k1];
    const { jwks, fetches } = jwksFor(() => served, () => now);
    expect((await verifyPubsubJwt(await oidcToken(k1, now), expect_, jwks, now)).ok).toBe(true);
    expect(fetches()).toBe(1);
    now += 61_000;
    served = [k1, k2];
    expect((await verifyPubsubJwt(await oidcToken(k2, now), expect_, jwks, now)).ok).toBe(true);
    expect(fetches()).toBe(2);
    const k3 = await rsaKey("g3");
    expect(await verifyPubsubJwt(await oidcToken(k3, now), expect_, jwks, now)).toEqual({ ok: false, reason: "kid" });
    expect(await verifyPubsubJwt(await oidcToken(k3, now), expect_, jwks, now)).toEqual({ ok: false, reason: "kid" });
    expect(fetches()).toBe(2); // the refetch window (60 s) has not passed
    now += 61_000;
    await verifyPubsubJwt(await oidcToken(k3, now), expect_, jwks, now);
    expect(fetches()).toBe(3);
  });
});

describe("JWKS failures", () => {
  it("a JWKS 500 followed by 10 RTDN verifications → exactly 1 fetch; the next attempt waits 60 s", async () => {
    let now = NOW;
    let n = 0;
    const k = await rsaKey("g1");
    let fail = true;
    const jwks = new JwksCache({
      now: () => now,
      fetch: (async () => {
        n++;
        return fail ? new Response("down", { status: 500 }) : Response.json({ keys: [k.jwk] }, { headers: { "Cache-Control": "max-age=3600" } });
      }) as typeof fetch,
    });
    for (let i = 0; i < 10; i++) expect((await verifyPubsubJwt(await oidcToken(k, now), expect_, jwks, now)).ok).toBe(false);
    expect(n).toBe(1);
    fail = false;
    now += 61_000;
    expect((await verifyPubsubJwt(await oidcToken(k, now), expect_, jwks, now)).ok).toBe(true);
    expect(n).toBe(2);
  });

  it("a failed or empty refresh keeps the cached keys", async () => {
    let now = NOW;
    const k = await rsaKey("g1");
    let mode: "ok" | "empty" | "throw" = "ok";
    let n = 0;
    const jwks = new JwksCache({
      now: () => now,
      fetch: (async () => {
        n++;
        if (mode === "throw") throw new TypeError("network");
        return Response.json({ keys: mode === "ok" ? [k.jwk] : [] }, { headers: { "Cache-Control": "max-age=60" } });
      }) as typeof fetch,
    });
    expect((await verifyPubsubJwt(await oidcToken(k, now), expect_, jwks, now)).ok).toBe(true);
    for (const m of ["empty", "throw"] as const) {
      mode = m;
      now += 61_000; // cache expired → refresh fails → old keys still verify
      expect((await verifyPubsubJwt(await oidcToken(k, now), expect_, jwks, now)).ok).toBe(true);
    }
    expect(n).toBe(3);
  });
});

describe("pre-auth guards", () => {
  it("bearerFromHeader: missing, oversized (> 4096) or malformed → null", () => {
    expect(bearerFromHeader(null)).toBeNull();
    expect(bearerFromHeader("Basic abc")).toBeNull();
    expect(bearerFromHeader("Bearer a.b")).toBeNull();
    expect(bearerFromHeader("Bearer a.b.c d")).toBeNull();
    expect(bearerFromHeader("Bearer " + "a".repeat(2000) + "." + "b".repeat(2000) + "." + "c".repeat(100))).toBeNull();
    expect(bearerFromHeader("Bearer a.b.c")).toBe("a.b.c");
  });

  it("missing, oversized or malformed header → 401 without reading the body or fetching JWKS", async () => {
    const { jwks, fetches } = jwksFor(() => [], () => NOW);
    const env = { RTDN_LIMITER: { limit: async () => ({ success: true }) }, RTDN_AUDIENCE: AUD, RTDN_SA_EMAIL: EMAIL, RTDN_SUBSCRIPTION: "projects/p/subscriptions/s", PLAY_PACKAGE_NAME: "app.mishana.tv" };
    for (const auth of [undefined, "Bearer " + "x".repeat(5000), "Bearer not-a-jwt"]) {
      let bodyRead = false;
      const body = new ReadableStream({ pull() { bodyRead = true; } }, { highWaterMark: 0 });
      const req = new Request("https://play.example/api/billing/rtdn", { method: "POST", body, headers: auth ? { Authorization: auth } : {}, duplex: "half" } as RequestInit);
      const res = await handleRtdn(req, env, { store: newCore().store, api: null, jwks, now: () => NOW, ip: "1.2.3.4" });
      expect(res.status).toBe(401);
      expect(bodyRead).toBe(false);
    }
    expect(fetches()).toBe(0);
  });
});
