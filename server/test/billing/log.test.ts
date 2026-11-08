// PAYMENTS-SPEC §3.9 / §7.2: no token, token hash, install id/hash, 64-hex or `tokens/` string ever reaches console.*.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CRON_DAILY, CRON_HOURLY, runCron } from "../../src/billing/cron";
import { ackPurchase, GOOGLE_TOKEN_URL, GoogleClient, GoogleHttpError } from "../../src/billing/google";
import { billingLog, REDACTED, sanitizeLogFields } from "../../src/billing/log";
import { normalizeProduct } from "../../src/billing/normalize";
import { handleRtdn } from "../../src/billing/rtdn";
import { verify } from "../../src/billing/routes";
import { importFakeSigner } from "../../src/billing/token";
import { INSTALL_A, NOW, ScriptedGoogle, hashOf, newCore, playToken, product, sub } from "../support/billing";
import { AUD, EMAIL, jwksFor, oidcToken, rsaKey } from "../support/oidc";

const lines: string[] = [];
beforeEach(() => {
  lines.length = 0;
  for (const m of ["log", "warn", "error", "info", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void lines.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x) ?? String(x))).join(" ")));
  }
});
afterEach(() => vi.restoreAllMocks());

const TOKEN_150 = playToken("logtest");
const TOKEN_HEX = "c0ffee".repeat(10) + "abcd"; // looks like 64-hex

async function assertClean(secrets: string[]): Promise<void> {
  const all = lines.join("\n");
  for (const s of secrets) {
    expect(all).not.toContain(s);
    expect(all).not.toContain(await hashOf(s));
  }
  expect(all).not.toMatch(/[0-9a-f]{64}/);
  expect(all).not.toMatch(/tokens\//);
  expect(all).not.toMatch(/googleapis\.com/);
}

describe("billingLog redaction", () => {
  it("keeps numbers, booleans and allowed enum strings; redacts every other string", () => {
    expect(sanitizeLogFields({ count: 3, ok: true, reason: "aud", op: "sub_get", token: TOKEN_150, reasonX: "aud", status: 503, n: null })).toEqual({
      count: 3, ok: true, reason: "aud", op: "sub_get", token: REDACTED, reasonX: REDACTED, status: 503, n: null,
    });
    expect(sanitizeLogFields({ reason: TOKEN_HEX })).toEqual({ reason: REDACTED });
    billingLog("BILLING_AUTH", { code: "x", reason: TOKEN_150 } as Record<string, string>);
    expect(JSON.parse(lines[0] as string)).toEqual({ code: "BILLING_AUTH", reason: REDACTED });
  });
});

describe("no secret reaches the logs", () => {
  it("verify path with a real GoogleClient: error responses, thrown fetch errors, 401/403, acks", async () => {
    const { store } = newCore();
    const pair = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign"])) as CryptoKeyPair;
    const der = new Uint8Array((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
    let bin = "";
    for (const b of der) bin += String.fromCharCode(b);
    const sa = { client_email: "a@b.iam.gserviceaccount.com", private_key: `-----BEGIN PRIVATE KEY-----\n${btoa(bin)}\n-----END PRIVATE KEY-----`, private_key_id: "k" };
    let n = 0;
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u === GOOGLE_TOKEN_URL) return Response.json({ access_token: "at", expires_in: 3600 });
      n++;
      if (u.includes("subscriptionsv2")) {
        if (n % 3 === 0) throw new TypeError(`network down at ${u}`);
        return new Response(`{"error":{"message":"bad token ${u}"}}`, { status: n % 2 ? 403 : 500 });
      }
      if (u.includes(":acknowledge")) return new Response(`denied ${u}`, { status: 400 });
      return Response.json(product());
    }) as typeof fetch;
    const api = new GoogleClient(sa, "app.mishana.tv", { fetch: fetchImpl, now: () => NOW, sleep: async () => undefined });
    const res = await verify(
      { installId: INSTALL_A, purchases: [{ productId: "premium", purchaseToken: TOKEN_150 }, { productId: "premium", purchaseToken: TOKEN_HEX }, { productId: "pack_en_food_01", purchaseToken: TOKEN_150 + "p" }] },
      store, api, await importFakeSigner(), "google", () => NOW,
    );
    expect(res.status).toBe(200);
    expect(lines.length).toBeGreaterThan(0);
    await assertClean([TOKEN_150, TOKEN_HEX, TOKEN_150 + "p", INSTALL_A]);
  });

  it("RTDN, ack and cron paths", async () => {
    const { core, store } = newCore();
    const google = new ScriptedGoogle();
    google.subs.set(TOKEN_150, sub({ externalAccountIdentifiers: { obfuscatedExternalAccountId: await hashOf(INSTALL_A) } }));
    google.subs.set(TOKEN_HEX, new GoogleHttpError(503, "sub_get"));
    google.ackError = new GoogleHttpError(403, "sub_ack");
    const k = await rsaKey("g1");
    const { jwks } = jwksFor(() => [k], () => NOW);
    const env = { RTDN_LIMITER: { limit: async () => ({ success: true }) }, RTDN_AUDIENCE: AUD, RTDN_SA_EMAIL: EMAIL, RTDN_SUBSCRIPTION: "projects/p/subscriptions/s", PLAY_PACKAGE_NAME: "app.mishana.tv" };
    const call = async (tok: string, id: string, auth?: string) => {
      const data = btoa(JSON.stringify({ packageName: "app.mishana.tv", subscriptionNotification: { notificationType: 4, purchaseToken: tok } }));
      const req = new Request("https://p.example/api/billing/rtdn", { method: "POST", headers: { Authorization: auth ?? `Bearer ${await oidcToken(k, NOW)}` }, body: JSON.stringify({ message: { data, messageId: id }, subscription: "projects/p/subscriptions/s" }) });
      return handleRtdn(req, env, { store, api: google, jwks, now: () => NOW, ip: "1.1.1.1" });
    };
    await call(TOKEN_150, "1");
    await call(TOKEN_HEX, "2");
    await call(TOKEN_150, "3", `Bearer ${await oidcToken(k, NOW, { aud: TOKEN_HEX })}`);
    await ackPurchase(google, store, "sub", "premium", TOKEN_150, await hashOf(TOKEN_150), { timeoutMs: 1000 });
    const ph = await hashOf(TOKEN_HEX);
    await core.applyPurchase({ tokenHash: ph, kind: "pack", productId: "pack_en_food_01", n: normalizeProduct(product({ purchaseCompletionTime: new Date(NOW - 49 * 3_600_000).toISOString() }), NOW - 49 * 3_600_000), callerInstallHash: null, rawTokenForAck: TOKEN_HEX, nowMs: NOW - 49 * 3_600_000 });
    google.voidedPages = [{ voidedPurchases: [{ purchaseToken: TOKEN_150, orderId: "GPA.1234-5678" }, { purchaseToken: TOKEN_HEX }] }];
    const cronEnv = { BILLING_MODE: "google", ALLOW_FAKE_BILLING: "0", PLAY_SERVICE_ACCOUNT_JSON: "{}" };
    await runCron(cronEnv, CRON_HOURLY, { store, api: google, now: () => NOW });
    await runCron(cronEnv, CRON_DAILY, { store, api: google, now: () => NOW });
    expect(lines.length).toBeGreaterThan(3);
    await assertClean([TOKEN_150, TOKEN_HEX, INSTALL_A, "GPA.1234-5678"]);
  });
});
