// PAYMENTS-SPEC §3.6: Real-time developer notifications (Pub/Sub push) and the shared "re-read a token from Google
// and apply it" paths, used by RTDN, the fake `set` route (§3.10) and the cron (§3.8).
import * as z from "zod";
import { BILLING_BODY_MAX_BYTES } from "@mishana/shared/constants";
import { packIdFromProductId, PREMIUM_PRODUCT_ID } from "@mishana/shared/billing";
import { readBodyLimited } from "../http";
import { sha256hex } from "../tokens";
import type { BillingStore } from "./billing-core";
import { billingPacks } from "./catalog-info";
import { ackPurchase, GOOGLE_CALL_TIMEOUT_BACKGROUND_MS, GoogleHttpError, isGoogleGone } from "./google";
import type { CallOpts, GoogleApi } from "./google";
import { billingLog } from "./log";
import { normalizeProduct, normalizeSubscription } from "./normalize";
import { bearerFromHeader, verifyPubsubJwt } from "./pubsub-auth";
import type { JwksCache } from "./pubsub-auth";

// ------------------------------------------------------------------ shared re-read paths

export interface SyncCtx { store: BillingStore; api: GoogleApi; now: () => number; opts?: CallOpts; source?: "google" | "fake" }

const bg = (c: SyncCtx): CallOpts => c.opts ?? { timeoutMs: GOOGLE_CALL_TIMEOUT_BACKGROUND_MS };

/**
 * 400/404/410 from the purchases API: the token is unknown to Google (never retried). Token-endpoint (OAuth)
 * failures are never "gone" (see isGoogleGone), so an auth outage makes the RTDN answer 503 and Pub/Sub redelivers.
 */
export const isGone = isGoogleGone;

/**
 * Re-reads a subscription and applies it with no caller (RTDN rules), acknowledging when due and re-reading the
 * linked subscription when asked. "gone" when Google does not know the token; transient errors are thrown.
 */
export async function refreshSubscription(c: SyncCtx, token: string): Promise<"ok" | "gone"> {
  const tokenHash = await sha256hex(token);
  const checkedMs = c.now();
  let r;
  try {
    r = await c.api.getSubscriptionV2(token, bg(c));
  } catch (e) {
    if (isGone(e)) return "gone";
    throw e;
  }
  const n = normalizeSubscription(r, checkedMs);
  if (n.productId !== PREMIUM_PRODUCT_ID) return "gone";
  const res = await c.store.applyPurchase({
    tokenHash, kind: "sub", productId: PREMIUM_PRODUCT_ID, n, callerInstallHash: null, rawTokenForAck: token, nowMs: c.now(), store: c.source ?? "google",
  });
  if (res.ackDue) await ackPurchase(c.api, c.store, "sub", PREMIUM_PRODUCT_ID, token, tokenHash, bg(c));
  if (res.refreshLinked && n.linkedPurchaseToken) await refreshLinked(c, n.linkedPurchaseToken);
  return "ok";
}

/** §3.5 PENDING_PURCHASE_CANCELED: re-read the old subscription; the raw linked token is never stored. */
export async function refreshLinked(c: SyncCtx, linked: string): Promise<void> {
  const checkedMs = c.now();
  try {
    const n = normalizeSubscription(await c.api.getSubscriptionV2(linked, bg(c)), checkedMs);
    if (n.productId !== PREMIUM_PRODUCT_ID) return;
    await c.store.applyPurchase({
      tokenHash: await sha256hex(linked), kind: "sub", productId: PREMIUM_PRODUCT_ID, n, callerInstallHash: null, rawTokenForAck: null, nowMs: c.now(),
      store: c.source ?? "google",
    });
  } catch {
    // Best effort: the old row stays as it was; the next RTDN or /verify for it settles it.
  }
}

/** Re-reads a one-time purchase and applies it with no caller. "gone" for an unknown token or a non-premium-pack product. */
export async function refreshProduct(c: SyncCtx, token: string): Promise<"ok" | "gone"> {
  const tokenHash = await sha256hex(token);
  const checkedMs = c.now();
  let r;
  try {
    r = await c.api.getProductV2(token, bg(c));
  } catch (e) {
    if (isGone(e)) return "gone";
    throw e;
  }
  const n = normalizeProduct(r, checkedMs);
  const packId = packIdFromProductId(n.productId);
  if (!packId || !billingPacks().premiumIds.has(packId)) return "gone";
  const res = await c.store.applyPurchase({
    tokenHash, kind: "pack", productId: n.productId, n, callerInstallHash: null, rawTokenForAck: token, nowMs: c.now(), store: c.source ?? "google",
  });
  if (res.ackDue) await ackPurchase(c.api, c.store, "pack", n.productId, token, tokenHash, bg(c));
  return "ok";
}

// ------------------------------------------------------------------ push endpoint

const TokenStr = z.string().min(1).max(4096);
const DeveloperNotification = z.object({
  version: z.string().optional(),
  packageName: z.string(),
  eventTimeMillis: z.union([z.string(), z.number()]).optional(),
  subscriptionNotification: z.object({ notificationType: z.number().optional(), purchaseToken: TokenStr }).optional(),
  oneTimeProductNotification: z.object({ notificationType: z.number().optional(), purchaseToken: TokenStr, sku: z.string().optional() }).optional(),
  voidedPurchaseNotification: z.object({ purchaseToken: TokenStr, productType: z.number(), refundType: z.number().optional() }).optional(),
  testNotification: z.object({}).optional(),
});
const PushBody = z.object({
  message: z.object({ data: z.string(), messageId: z.string().min(1).max(256), attributes: z.record(z.string(), z.string()).optional() }),
  subscription: z.string(),
});
export type DeveloperNotificationBody = z.infer<typeof DeveloperNotification>;

/** Parses a push body; null when unparseable (the endpoint answers 204 so Pub/Sub does not loop). */
export function parsePush(bodyText: string): { messageId: string; subscription: string; n: DeveloperNotificationBody } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(bodyText);
  } catch {
    return null;
  }
  const b = PushBody.safeParse(raw);
  if (!b.success) return null;
  let data: unknown;
  try {
    const bin = atob(b.data.message.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    return null;
  }
  const n = DeveloperNotification.safeParse(data);
  if (!n.success) return null;
  return { messageId: b.data.message.messageId, subscription: b.data.subscription, n: n.data };
}

export interface RtdnEnv {
  RTDN_LIMITER: RateLimit;
  RTDN_AUDIENCE: string;
  RTDN_SA_EMAIL: string;
  RTDN_SUBSCRIPTION: string;
  PLAY_PACKAGE_NAME: string;
}
export interface RtdnDeps { store: BillingStore; api: GoogleApi | null; jwks: JwksCache; now: () => number; ip: string }

const err = (error: string, status: number): Response =>
  new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const noContent = (): Response => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function handleRtdn(req: Request, env: RtdnEnv, d: RtdnDeps): Promise<Response> {
  // Pre-auth guards: cheap, before any crypto or body read.
  const { success } = await env.RTDN_LIMITER.limit({ key: d.ip });
  if (!success) return err("RATE_LIMITED", 429);
  const jwt = bearerFromHeader(req.headers.get("Authorization"));
  if (jwt === null) {
    billingLog("RTDN_AUTH", { reason: "header" }, "warn");
    return err("UNAUTHORIZED", 401);
  }
  // PAY-GAP: §3.6 names only an empty RTDN_AUDIENCE as NOT_CONFIGURED; an empty RTDN_SA_EMAIL is treated the same
  // (no push could ever authenticate, so Pub/Sub should keep retrying until the owner sets it).
  if (env.RTDN_AUDIENCE === "" || env.RTDN_SA_EMAIL === "") {
    billingLog("BILLING_NOT_CONFIGURED", { reason: "not_configured" }, "error");
    return err("NOT_CONFIGURED", 503);
  }
  const auth = await verifyPubsubJwt(jwt, { audience: env.RTDN_AUDIENCE, email: env.RTDN_SA_EMAIL }, d.jwks, d.now());
  if (!auth.ok) {
    billingLog("RTDN_AUTH", { reason: auth.reason }, "warn");
    return err("UNAUTHORIZED", 401);
  }
  const body = await readBodyLimited(req, BILLING_BODY_MAX_BYTES);
  if (body === null) return err("BAD_REQUEST", 413);
  const push = parsePush(new TextDecoder().decode(body));
  if (!push) {
    billingLog("RTDN_BAD", { reason: "body" }, "warn");
    return noContent();
  }
  if (env.RTDN_SUBSCRIPTION === "") return err("NOT_CONFIGURED", 503);
  if (push.subscription !== env.RTDN_SUBSCRIPTION) {
    billingLog("RTDN_WRONG_SUBSCRIPTION", {}, "warn");
    return noContent();
  }
  if (await d.store.rtdnSeen(push.messageId)) return noContent();
  const n = push.n;
  if (n.packageName !== env.PLAY_PACKAGE_NAME) {
    billingLog("RTDN_PACKAGE", {}, "warn");
    return noContent();
  }
  if (!d.api) return err("NOT_CONFIGURED", 503);
  const c: SyncCtx = { store: d.store, api: d.api, now: d.now };
  try {
    if (n.subscriptionNotification) {
      await refreshSubscription(c, n.subscriptionNotification.purchaseToken);
    } else if (n.oneTimeProductNotification) {
      await refreshProduct(c, n.oneTimeProductNotification.purchaseToken);
    } else if (n.voidedPurchaseNotification) {
      const v = n.voidedPurchaseNotification;
      if (v.productType === 2) await d.store.markRevoked(await sha256hex(v.purchaseToken), d.now());
      else if (v.productType === 1) await refreshSubscription(c, v.purchaseToken); // never markRevoked a subscription (§3.6)
    } else if (n.testNotification) {
      billingLog("RTDN_TEST");
    }
  } catch (e) {
    billingLog("RTDN_UPSTREAM", { status: e instanceof GoogleHttpError ? e.status : 0 }, "warn");
    return err("UPSTREAM_UNAVAILABLE", 503); // Pub/Sub redelivers
  }
  await d.store.rtdnMark(push.messageId, d.now());
  return noContent();
}
