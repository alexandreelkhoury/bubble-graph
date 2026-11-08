// PAYMENTS-SPEC §3.7 / §7.2: the Google Play Developer API client with a mocked fetch.
import { describe, expect, it } from "vitest";
import {
  ackPurchase, ANDROIDPUBLISHER_SCOPE, GOOGLE_TOKEN_URL, GoogleClient, GoogleHttpError, isGoogleGone, JWT_GRANT_TYPE, parseServiceAccount,
} from "../../src/billing/google";
import type { ServiceAccount } from "../../src/billing/google";
import { b64urlDecode } from "../../src/billing/token";
import { ScriptedGoogle } from "../support/billing";

const TOKEN = "tok/en+with?odd=chars&x";

async function serviceAccount(): Promise<{ sa: ServiceAccount; publicKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"],
  )) as CryptoKeyPair;
  const der = new Uint8Array((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
  let bin = "";
  for (const b of der) bin += String.fromCharCode(b);
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(bin).replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`;
  return { sa: { client_email: "play-api@proj.iam.gserviceaccount.com", private_key: pem, private_key_id: "kid123" }, publicKey: pair.publicKey };
}

type Call = { url: string; init: RequestInit };
function mockFetch(handler: (url: string, init: RequestInit, n: number) => Response | Promise<Response>): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    return handler(url, init ?? {}, calls.length);
  }) as typeof fetch;
  return { fetch: f, calls };
}
const tokenOk = (): Response => Response.json({ access_token: "at-1", expires_in: 3600, token_type: "Bearer" });
const opts = { timeoutMs: 3000 };

describe("GoogleClient", () => {
  it("service-account JWT claims exactly as §3.7, RS256 signature valid, form body", async () => {
    const { sa, publicKey } = await serviceAccount();
    const m = mockFetch((url) => (url === GOOGLE_TOKEN_URL ? tokenOk() : Response.json({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE" })));
    const now = 1_790_000_000_000;
    const c = new GoogleClient(sa, "app.mishana.tv", { fetch: m.fetch, now: () => now, sleep: async () => undefined });
    await c.getSubscriptionV2(TOKEN, opts);
    const tokenCall = m.calls[0] as Call;
    expect(tokenCall.init.method).toBe("POST");
    expect((tokenCall.init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const form = new URLSearchParams(String(tokenCall.init.body));
    expect(form.get("grant_type")).toBe(JWT_GRANT_TYPE);
    const jwt = form.get("assertion") as string;
    const [h, p, s] = jwt.split(".") as [string, string, string];
    const dec = (x: string): unknown => JSON.parse(new TextDecoder().decode(b64urlDecode(x)!));
    expect(dec(h)).toEqual({ alg: "RS256", typ: "JWT", kid: "kid123" });
    const iat = Math.floor(now / 1000);
    expect(dec(p)).toEqual({ iss: sa.client_email, scope: ANDROIDPUBLISHER_SCOPE, aud: GOOGLE_TOKEN_URL, iat, exp: iat + 3600 });
    expect(await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, publicKey, b64urlDecode(s)!, new TextEncoder().encode(`${h}.${p}`))).toBe(true);
    const api = m.calls[1] as Call;
    expect((api.init.headers as Record<string, string>).Authorization).toBe("Bearer at-1");
  });

  it("access token cached until expires_in − 300 s; concurrent misses share one request; 401 → refresh + retry", async () => {
    const { sa } = await serviceAccount();
    let now = 1_790_000_000_000;
    let apiN = 0;
    let tokenN = 0;
    const m = mockFetch((url) => {
      if (url === GOOGLE_TOKEN_URL) return Response.json({ access_token: `at-${++tokenN}`, expires_in: 3600 });
      apiN++;
      return apiN === 4 ? new Response("", { status: 401 }) : Response.json({});
    });
    const c = new GoogleClient(sa, "pkg", { fetch: m.fetch, now: () => now, sleep: async () => undefined });
    await Promise.all([c.getProductV2("a", opts), c.getProductV2("b", opts)]);
    expect(tokenN).toBe(1);
    now += (3600 - 301) * 1000;
    await c.getProductV2("c", opts);
    expect(tokenN).toBe(1);
    now += 2000;
    await c.getProductV2("d", opts); // the 4th API call gets 401 → drop token → refetch → retry
    expect(tokenN).toBe(3);
    expect(apiN).toBe(5);
  });

  it("5xx → one retry after 500 ms; a second failure throws GoogleHttpError without URL or token", async () => {
    const { sa } = await serviceAccount();
    const sleeps: number[] = [];
    const m = mockFetch((url) => (url === GOOGLE_TOKEN_URL ? tokenOk() : new Response("boom " + TOKEN, { status: 503 })));
    const c = new GoogleClient(sa, "pkg", { fetch: m.fetch, now: () => 0, sleep: async (ms) => void sleeps.push(ms) });
    const err = await c.getSubscriptionV2(TOKEN, opts).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GoogleHttpError);
    expect(err).toMatchObject({ status: 503, op: "sub_get" });
    expect(String((err as Error).message) + String((err as Error).stack)).not.toContain(TOKEN);
    expect(String((err as Error).message)).not.toMatch(/https?:|tokens\//);
    expect(sleeps).toEqual([500]);
    expect(m.calls.filter((c2) => c2.url !== GOOGLE_TOKEN_URL)).toHaveLength(2);
  });

  it("no retry when the verify deadline does not allow it; network errors become status 0", async () => {
    const { sa } = await serviceAccount();
    const m = mockFetch((url) => {
      if (url === GOOGLE_TOKEN_URL) return tokenOk();
      throw new TypeError(`fetch failed for ${url}`);
    });
    const c = new GoogleClient(sa, "pkg", { fetch: m.fetch, now: () => 10_000, sleep: async () => undefined });
    const err = await c.getProductV2(TOKEN, { timeoutMs: 3000, deadlineMs: 12_000 }).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 0, op: "product_get" });
    expect(String((err as Error).message)).not.toContain(TOKEN);
    expect(m.calls.filter((c2) => c2.url !== GOOGLE_TOKEN_URL)).toHaveLength(1);
  });

  it("an OAuth token-endpoint failure (400 invalid_grant, 401, 5xx, network) is reported as 503 op token, never as gone", async () => {
    const { sa } = await serviceAccount();
    for (const mk of [
      () => Response.json({ error: "invalid_grant" }, { status: 400 }),
      () => new Response("", { status: 401 }),
      () => new Response("", { status: 500 }),
      () => { throw new TypeError("down"); },
    ]) {
      const m = mockFetch((url) => (url === GOOGLE_TOKEN_URL ? mk() : Response.json({})));
      const c = new GoogleClient(sa, "pkg", { fetch: m.fetch, now: () => 0, sleep: async () => undefined });
      const err = await c.getSubscriptionV2(TOKEN, opts).catch((e: unknown) => e);
      expect(err).toMatchObject({ status: 503, op: "token" });
      expect(isGoogleGone(err)).toBe(false);
      expect(m.calls.filter((c2) => c2.url !== GOOGLE_TOKEN_URL)).toHaveLength(0);
    }
    expect(isGoogleGone(new GoogleHttpError(404, "sub_get"))).toBe(true);
    expect(isGoogleGone(new GoogleHttpError(400, "token"))).toBe(false);
  });

  it("the token exchange timeout is capped by the verify deadline", async () => {
    const { sa } = await serviceAccount();
    let aborted = false;
    const m = mockFetch((url, init) => {
      if (url !== GOOGLE_TOKEN_URL) return Response.json({});
      return new Promise<Response>((_, rej) => {
        init.signal?.addEventListener("abort", () => {
          aborted = true;
          rej(new Error("aborted"));
        });
      });
    });
    const c = new GoogleClient(sa, "pkg", { fetch: m.fetch, now: () => 0, sleep: async () => undefined });
    const t0 = Date.now();
    const err = await c.getSubscriptionV2(TOKEN, { timeoutMs: 3000, deadlineMs: 50 }).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 503, op: "token" });
    expect(aborted).toBe(true);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("per-call timeout is honoured (AbortController)", async () => {
    const { sa } = await serviceAccount();
    const m = mockFetch((url, init) => {
      if (url === GOOGLE_TOKEN_URL) return tokenOk();
      return new Promise<Response>((_res, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
    });
    const c = new GoogleClient(sa, "pkg", { fetch: m.fetch, now: () => 0, sleep: async () => undefined });
    const t0 = Date.now();
    const err = await c.getSubscriptionV2("t", { timeoutMs: 50, deadlineMs: 1 }).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 0 });
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("URLs for get / ack / voided with an encoded token; voided pagination", async () => {
    const { sa } = await serviceAccount();
    const m = mockFetch((url) => (url === GOOGLE_TOKEN_URL ? tokenOk() : Response.json({})));
    const c = new GoogleClient(sa, "app.mishana.tv", { fetch: m.fetch, now: () => 0, sleep: async () => undefined });
    const enc = encodeURIComponent(TOKEN);
    await c.getSubscriptionV2(TOKEN, opts);
    await c.getProductV2(TOKEN, opts);
    await c.ackSubscription(TOKEN, opts);
    await c.ackProduct("pack_en_food_01", TOKEN, opts);
    await c.listVoided({ startTimeMs: 1234 }, opts);
    await c.listVoided({ startTimeMs: 1234, pageToken: "next/1" }, opts);
    const base = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/app.mishana.tv/purchases/";
    const api = m.calls.filter((x) => x.url !== GOOGLE_TOKEN_URL);
    expect(api.map((x) => [x.init.method, x.url])).toEqual([
      ["GET", `${base}subscriptionsv2/tokens/${enc}`],
      ["GET", `${base}productsv2/tokens/${enc}`],
      ["POST", `${base}subscriptions/premium/tokens/${enc}:acknowledge`],
      ["POST", `${base}products/pack_en_food_01/tokens/${enc}:acknowledge`],
      ["GET", `${base}voidedpurchases?type=1&startTime=1234&maxResults=1000`],
      ["GET", `${base}voidedpurchases?type=1&startTime=1234&maxResults=1000&token=next%2F1`],
    ]);
    expect(api[2]?.init.body).toBe("{}");
  });

  it("parseServiceAccount needs client_email, private_key and private_key_id", () => {
    expect(parseServiceAccount(JSON.stringify({ client_email: "a", private_key: "b", private_key_id: "c", x: 1 }))).toEqual({ client_email: "a", private_key: "b", private_key_id: "c" });
    expect(parseServiceAccount(JSON.stringify({ client_email: "a" }))).toBeNull();
    expect(parseServiceAccount("{")).toBeNull();
    expect(parseServiceAccount(undefined)).toBeNull();
  });
});

describe("ackPurchase", () => {
  const store = () => {
    const acked: string[] = [];
    return { acked, markAcked: (h: string) => void acked.push(h) };
  };
  it("2xx → markAcked", async () => {
    const g = new ScriptedGoogle();
    const s = store();
    expect(await ackPurchase(g, s, "sub", "premium", "t", "h", opts)).toBe("acked");
    expect(s.acked).toEqual(["h"]);
  });
  it("4xx + re-read ACKNOWLEDGED → markAcked; 4xx + re-read PENDING → kept", async () => {
    const g = new ScriptedGoogle();
    g.ackError = new GoogleHttpError(400, "product_ack");
    g.products.set("t", { acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" });
    const s = store();
    expect(await ackPurchase(g, s, "pack", "pack_en_food_01", "t", "h", opts)).toBe("acked");
    g.products.set("t", { acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING" });
    const s2 = store();
    expect(await ackPurchase(g, s2, "pack", "pack_en_food_01", "t", "h", opts)).toBe("kept");
    expect(s2.acked).toEqual([]);
  });
  it("401/403 and token-endpoint failures → kept, no re-read", async () => {
    for (const e of [new GoogleHttpError(401, "sub_ack"), new GoogleHttpError(403, "sub_ack"), new GoogleHttpError(503, "token")]) {
      const g = new ScriptedGoogle();
      g.ackError = e;
      const s = store();
      expect(await ackPurchase(g, s, "sub", "premium", "t", "h", opts)).toBe("kept");
      expect(g.count("sub_get")).toBe(0);
    }
  });
  it("429/5xx/timeout → kept, no re-read", async () => {
    for (const status of [429, 503, 0]) {
      const g = new ScriptedGoogle();
      g.ackError = new GoogleHttpError(status, "sub_ack");
      const s = store();
      expect(await ackPurchase(g, s, "sub", "premium", "t", "h", opts)).toBe("kept");
      expect(g.count("sub_get")).toBe(0);
    }
  });
});
