// PAYMENTS-SPEC §3.4: HTTP handlers for /api/billing/*. No partyserver import. Tokens travel only in request
// bodies (never URLs), and every log goes through billingLog (§3.9).
import {
  BILLING_BODY_MAX_BYTES,
  GOOGLE_CALL_TIMEOUT_VERIFY_MS,
  GOOGLE_FRESH_MS,
  INSTALL_PREFIXES_PER_DAY,
  MAX_GOOGLE_READS_PER_VERIFY,
  VERIFY_DEADLINE_MS,
} from "@mishana/shared/constants";
import {
  BASE_PLAN_IDS,
  EntitlementRequest,
  FakePurchaseRequest,
  FakeSetRequest,
  packIdFromProductId,
  packProductId,
  PREMIUM_PRODUCT_ID,
  TRIAL_OFFER_ID,
  VerifyRequest,
} from "@mishana/shared/billing";
import type { BillingErrorCode, CatalogResponseBody, EntitlementBody, PurchaseResult } from "@mishana/shared/billing";
import type * as z from "zod";
import type { Env } from "../env";
import { readBodyLimited } from "../http";
import { isOriginAllowed } from "../origin";
import { clientIp } from "../request";
import { sha256hex } from "../tokens";
import { isAckEligible, isPendingState } from "./billing-core";
import type { BillingStore } from "./billing-core";
import { billingPacks } from "./catalog-info";
import { fakePurchase, fakeSet, FakeGoogleApi } from "./fake";
import { ackPurchase, googleClientFor, GoogleHttpError, isGoogleGone } from "./google";
import type { GoogleApi } from "./google";
import { billingLog } from "./log";
import { billingRouteMode } from "./mode";
import type { BillingMode } from "./mode";
import { normalizeProduct, normalizeSubscription } from "./normalize";
import type { NormalizedPurchase } from "./normalize";
import { googleJwks } from "./pubsub-auth";
import type { JwksCache } from "./pubsub-auth";
import { handleRtdn, refreshLinked } from "./rtdn";
import { buildClaims, importFakeSigner, importSigner, parseKeyring, signEntitlementToken } from "./token";
import type { Signer } from "./token";

export const BILLING_PREFIX = "/api/billing/";

export interface BillingRouteDeps {
  store: () => BillingStore;
  /** The Google client for google mode (null when the service account is missing or invalid). */
  google: (env: Env) => GoogleApi | null;
  jwks: () => JwksCache;
  now: () => number;
}

export function productionBillingDeps(env: Env): BillingRouteDeps {
  return {
    store: () => env.BILLING.getByName("global") as unknown as BillingStore,
    google: (e) => (e.PLAY_SERVICE_ACCOUNT_JSON ? googleClientFor(e.PLAY_SERVICE_ACCOUNT_JSON, e.PLAY_PACKAGE_NAME) : null),
    jwks: googleJwks,
    now: () => Date.now(),
  };
}

export function billingError(code: BillingErrorCode, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
function ok(body: unknown, cache = "no-store"): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache } });
}

// One signer per isolate and keyring.
let signerCache: { key: string; signer: Promise<Signer> } | null = null;
function signerFor(env: Env, mode: BillingMode): Promise<Signer> | null {
  if (mode === "fake") return importFakeSigner();
  const json = env.ENTITLEMENT_KEYS ?? "";
  if (signerCache?.key === json) return signerCache.signer;
  const ring = parseKeyring(json);
  if (!ring) return null;
  signerCache = { key: json, signer: importSigner(ring) };
  return signerCache.signer;
}

/** Reads and strictly parses a JSON body (Content-Type, size cap); null → 400. */
export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T | null> {
  const ct = (req.headers.get("Content-Type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (ct !== "application/json") return null;
  const body = await readBodyLimited(req, BILLING_BODY_MAX_BYTES);
  if (body === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return null;
  }
  const r = schema.safeParse(raw);
  return r.success ? r.data : null;
}

export async function handleBilling(req: Request, env: Env, deps: BillingRouteDeps): Promise<Response> {
  const path = new URL(req.url).pathname;
  const route = path.slice(BILLING_PREFIX.length);
  const known = (route === "catalog" && req.method === "GET") || (req.method === "POST" && ["verify", "entitlement", "rtdn", "fake/purchase", "fake/set"].includes(route));
  if (!known) return billingError("BAD_REQUEST", 405);
  try {
    if (!isOriginAllowed(req, env.ALLOWED_ORIGINS)) return billingError("FORBIDDEN", 403);
    const mode = billingRouteMode(env, req);
    if (route === "rtdn") {
      if (mode !== "google") {
        // RTDN only exists in google mode; the pre-auth limiter still applies first.
        const { success } = await env.RTDN_LIMITER.limit({ key: clientIp(req) });
        if (!success) return billingError("RATE_LIMITED", 429);
        return billingError("NOT_CONFIGURED", 503);
      }
      return await handleRtdn(req, env, { store: deps.store(), api: deps.google(env), jwks: deps.jwks(), now: deps.now, ip: clientIp(req) });
    }
    const { success } = await env.BILLING_LIMITER.limit({ key: clientIp(req) });
    if (!success) return billingError("RATE_LIMITED", 429);
    if (mode === "not_configured") {
      billingLog("BILLING_NOT_CONFIGURED", { reason: "not_configured" }, "error");
      return billingError("NOT_CONFIGURED", 503);
    }
    if (route.startsWith("fake/")) {
      if (mode !== "fake") return new Response("Not found", { status: 404 });
      const store = deps.store();
      if (route === "fake/purchase") {
        const body = await readJson(req, FakePurchaseRequest);
        return body ? await fakePurchase(body, store, deps.now()) : billingError("BAD_REQUEST", 400);
      }
      const body = await readJson(req, FakeSetRequest);
      return body ? await fakeSet(body, store, deps.now) : billingError("BAD_REQUEST", 400);
    }
    if (route === "catalog") return catalog(env, mode);
    const signer = signerFor(env, mode);
    if (!signer) return billingError("NOT_CONFIGURED", 503);
    const api = mode === "fake" ? new FakeGoogleApi(deps.store(), deps.now) : deps.google(env);
    if (!api) return billingError("NOT_CONFIGURED", 503);
    if (route === "verify") {
      const body = await readJson(req, VerifyRequest);
      if (!body) return billingError("BAD_REQUEST", 400);
      return await verify(body, deps.store(), api, await signer, mode, deps.now, await clientKeys(clientIp(req)));
    }
    const body = await readJson(req, EntitlementRequest);
    if (!body) return billingError("BAD_REQUEST", 400);
    const store = deps.store();
    const installHash = await sha256hex(body.installId);
    if (!(await store.rateCheck(installHash, "entitlement", deps.now()))) return billingError("RATE_LIMITED", 429);
    // PAY-GAP §6.1: an installId used from more networks per day than one household plausibly has is being shared
    // (a modded APK or script). /entitlement needs only the installId, so it is refused; the real TV still gets its
    // entitlement from /verify, which needs the purchase token.
    if ((await store.installNetSeen(installHash, (await clientKeys(clientIp(req))).netKey, deps.now())) > INSTALL_PREFIXES_PER_DAY) {
      logShared(deps.now());
      return billingError("RATE_LIMITED", 429);
    }
    return ok({ entitlement: await entitlementBody(store, installHash, await signer, mode, deps.now()) });
  } catch (e) {
    billingLog("BILLING_INTERNAL", { status: e instanceof GoogleHttpError ? e.status : 500 }, "error");
    return billingError("INTERNAL", 500);
  }
}

let sharedLoggedAt = -Infinity;
function logShared(nowMs: number): void {
  if (nowMs - sharedLoggedAt < 60_000) return;
  sharedLoggedAt = nowMs;
  billingLog("BILLING_INSTALL_SHARED", {}, "warn");
}

function catalog(env: Env, mode: BillingMode): Response {
  const packs = billingPacks().all;
  const body: CatalogResponseBody = {
    mode,
    packageName: env.PLAY_PACKAGE_NAME,
    subscription: { productId: PREMIUM_PRODUCT_ID, basePlanIds: [...BASE_PLAN_IDS], trialOfferId: TRIAL_OFFER_ID },
    freePackIds: packs.filter((p) => p.tier === "free").map((p) => p.id),
    packs: packs
      .filter((p) => p.tier === "premium")
      .map((p) => ({ packId: p.id, productId: packProductId(p.id), locale: p.locale, language: p.language, title: { ...p.title }, pairCount: p.pairCount, ageRating: p.ageRating })),
  };
  return ok(body, "public, max-age=300");
}

export async function entitlementBody(store: BillingStore, installHash: string, signer: Signer, mode: BillingMode, nowMs: number): Promise<EntitlementBody> {
  const e = await store.entitlementFor(installHash, nowMs);
  const claims = buildClaims(installHash, nowMs, e.premiumUntilMs, e.packs, mode);
  const token = await signEntitlementToken(claims, signer);
  const premiumUntil = claims.pu === null ? null : claims.pu * 1000;
  return {
    token,
    premium: premiumUntil !== null && premiumUntil > nowMs,
    premiumUntil,
    packs: claims.packs,
    expiresAt: claims.exp * 1000,
    subscription: e.subscription,
  };
}

// BILLING_BUDGET is logged at most once per minute per isolate (a flood would otherwise log once per request).
let budgetLoggedAt = -Infinity;
function logBudget(nowMs: number): void {
  if (nowMs - budgetLoggedAt < 60_000) return;
  budgetLoggedAt = nowMs;
  billingLog("BILLING_BUDGET", { op: "verify" }, "warn");
}
/** Test hook: forget the BILLING_BUDGET log throttle. */
export function resetBudgetLogThrottle(): void {
  budgetLoggedAt = -Infinity;
}

/** Truncated hashes of the client IP and its network prefix. Never stored; only in-memory limiter keys (§6.3). */
export interface ClientKeys { ipKey: string; netKey: string }

/** IPv4 → /24, IPv6 → /48 (first three hextets after expanding "::"); anything else → itself. */
export function networkPrefix(ip: string): string {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(ip);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}`;
  if (ip.includes(":")) {
    const [head = "", tail] = ip.toLowerCase().split("::");
    const h = head === "" ? [] : head.split(":");
    const parts = tail === undefined ? h : [...h, ...Array<string>(Math.max(0, 8 - h.length - (tail === "" ? 0 : tail.split(":").length))).fill("0")];
    return parts.slice(0, 3).map((x) => x.replace(/^0+(?=.)/, "")).join(":");
  }
  return ip;
}

export async function clientKeys(ip: string): Promise<ClientKeys> {
  return { ipKey: (await sha256hex(`ip:${ip}`)).slice(0, 16), netKey: (await sha256hex(`net:${networkPrefix(ip)}`)).slice(0, 16) };
}

/** §3.4 verify algorithm. Google outages never fail the request: affected purchases get UPSTREAM_ERROR. */
export async function verify(
  body: z.infer<typeof VerifyRequest>, store: BillingStore, api: GoogleApi, signer: Signer, mode: BillingMode, now: () => number,
  client: ClientKeys | null = null,
): Promise<Response> {
  const start = now();
  const deadline = start + VERIFY_DEADLINE_MS;
  const installHash = await sha256hex(body.installId);
  if (!(await store.rateCheck(installHash, "verify", start))) return billingError("RATE_LIMITED", 429);
  // Fake reads never reach Google, so the per-IP Google budget applies in google mode only (e2e runs from one IP).
  const ipKey = mode === "google" ? (client?.ipKey ?? null) : null;
  // Recorded for the installId-sharing check; /verify itself is never refused for it (it proves the purchase token).
  if (client) await store.installNetSeen(installHash, client.netKey, start);
  const premiumIds = billingPacks().premiumIds;
  const opts = { timeoutMs: GOOGLE_CALL_TIMEOUT_VERIFY_MS, deadlineMs: deadline };
  let googleReads = 0;
  let budgetLogged = false;
  let otherInstallLogged = false;
  const results: { productId: string; result: PurchaseResult }[] = [];

  const takeRead = async (): Promise<boolean> => {
    // Per-IP window first, so one IP cannot drain the global bucket for every real buyer (§6.1 PAY-GAP).
    if (
      googleReads >= MAX_GOOGLE_READS_PER_VERIFY ||
      (ipKey !== null && !(await store.ipReadCheck(ipKey, now()))) ||
      (await store.googleBudget(1, now())) === 0
    ) {
      if (!budgetLogged) logBudget(now());
      budgetLogged = true;
      return false;
    }
    googleReads += 1;
    return true;
  };

  for (const p of body.purchases) {
    const push = (result: PurchaseResult): void => void results.push({ productId: p.productId, result });
    if (now() >= deadline) {
      push("UPSTREAM_ERROR");
      continue;
    }
    // a. Kind.
    let kind: "sub" | "pack";
    if (p.productId === PREMIUM_PRODUCT_ID) kind = "sub";
    else {
      const packId = packIdFromProductId(p.productId);
      if (!packId || !premiumIds.has(packId)) {
        push("INVALID");
        continue;
      }
      kind = "pack";
    }
    const tokenHash = await sha256hex(p.purchaseToken);
    // b. Short-circuits.
    const t0 = now();
    const lk = await store.lookup(tokenHash, kind, t0);
    if (lk.invalid) {
      push("INVALID");
      continue;
    }
    const row = lk.row;
    if (row && row.revoked === 1 && row.kind === "pack") {
      push("REVOKED");
      continue;
    }
    if (
      row && row.kind === kind && row.product_id === p.productId && row.google_checked_ms > t0 - GOOGLE_FRESH_MS &&
      !isPendingState(row.kind, row.state) && (row.acknowledged === 1 || !isAckEligible(row.kind, row.state))
    ) {
      push(await store.bindOnly({ tokenHash, callerInstallHash: installHash, nowMs: t0 }));
      continue;
    }
    // c. Google read.
    if (!(await takeRead())) {
      push("UPSTREAM_ERROR");
      continue;
    }
    let n: NormalizedPurchase;
    const checkedMs = now();
    try {
      n = kind === "sub"
        ? normalizeSubscription(await api.getSubscriptionV2(p.purchaseToken, opts), checkedMs)
        : normalizeProduct(await api.getProductV2(p.purchaseToken, opts), checkedMs);
    } catch (e) {
      // Only the purchases API's own 400/404/410 means "unknown token"; an OAuth failure is UPSTREAM_ERROR.
      if (isGoogleGone(e)) {
        await store.markInvalid(tokenHash, kind, now());
        push("INVALID");
      } else {
        push("UPSTREAM_ERROR");
      }
      continue;
    }
    // d. Product match. Not negative-cached: only Google's own 400/404/410 is, so a misclassified or hostile post of
    // someone else's token can never make the owner's verify INVALID.
    if (n.productId !== p.productId) {
      push("INVALID");
      continue;
    }
    if (n.obfuscatedAccountId !== null && n.obfuscatedAccountId !== installHash && !otherInstallLogged) {
      billingLog("BILLING_RESTORE_OTHER_INSTALL");
      otherInstallLogged = true;
    }
    // e. Apply (+ link re-read).
    const r = await store.applyPurchase({ tokenHash, kind, productId: p.productId, n, callerInstallHash: installHash, rawTokenForAck: p.purchaseToken, nowMs: now(), store: mode });
    if (r.refreshLinked && n.linkedPurchaseToken && now() < deadline && (await takeRead())) {
      await refreshLinked({ store, api, now, opts }, n.linkedPurchaseToken);
    }
    // f. Acknowledge on Google state only (also for INSTALL_LIMIT / REVOKED / NOT_OWNED).
    if (r.ackDue && now() < deadline && (await store.googleBudget(1, now())) > 0) {
      await ackPurchase(api, store, kind, p.productId, p.purchaseToken, tokenHash, opts);
    }
    push(r.result);
  }
  return ok({ entitlement: await entitlementBody(store, installHash, signer, mode, now()), results });
}
