// PAYMENTS-SPEC §3.4: zod schemas for the billing HTTP API (/api/billing/*). Pulls in zod at runtime:
// the web client may only `import type` from here (runtime constants live in ./products and ./entitlement).
import * as z from "zod";
import { MAX_PURCHASES_PER_VERIFY, PURCHASE_TOKEN_MAX_CHARS } from "../constants";
import { AgeRatingSchema, LocaleSchema, LocalizedTitleSchema } from "../protocol/common";
import { PRODUCT_ID_REGEX } from "./products";

export const BILLING_ERROR_CODES = ["BAD_REQUEST", "FORBIDDEN", "RATE_LIMITED", "UNAUTHORIZED", "NOT_CONFIGURED", "UPSTREAM_UNAVAILABLE", "INTERNAL"] as const;
export type BillingErrorCode = (typeof BILLING_ERROR_CODES)[number];
export const PURCHASE_RESULTS = ["OK", "PENDING", "NOT_OWNED", "INVALID", "REVOKED", "INSTALL_LIMIT", "UPSTREAM_ERROR"] as const;
export type PurchaseResult = (typeof PURCHASE_RESULTS)[number];

export const INSTALL_ID_REGEX = /^[0-9a-f]{32}$/;
export const InstallIdSchema = z.string().regex(INSTALL_ID_REGEX);
export const PurchaseTokenSchema = z.string().min(1).max(PURCHASE_TOKEN_MAX_CHARS).regex(/^[\x21-\x7e]+$/);
export const ProductIdSchema = z.string().regex(PRODUCT_ID_REGEX);

export const VerifyRequest = z.strictObject({
  installId: InstallIdSchema,
  purchases: z.array(z.strictObject({ productId: ProductIdSchema, purchaseToken: PurchaseTokenSchema })).min(1).max(MAX_PURCHASES_PER_VERIFY),
});
export const EntitlementRequest = z.strictObject({ installId: InstallIdSchema });
export const EntitlementBody = z.object({
  token: z.string(), premium: z.boolean(), premiumUntil: z.number().nullable() /* ms; lifetime premium or an open-ended grant: the token's exp */,
  packs: z.array(z.string()), expiresAt: z.number() /* token exp, ms */,
});
export const VerifyResponse = z.object({
  entitlement: EntitlementBody,
  results: z.array(z.object({ productId: z.string(), result: z.enum(PURCHASE_RESULTS) })), // same order as the request
});
export const EntitlementResponse = z.object({ entitlement: EntitlementBody });
export const CatalogPackSchema = z.object({
  packId: z.string(), productId: z.string(), locale: z.string(), language: LocaleSchema,
  title: LocalizedTitleSchema, pairCount: z.number().int(), ageRating: AgeRatingSchema,
});
export const CatalogResponse = z.object({
  mode: z.enum(["google", "fake"]), packageName: z.string(),
  premium: z.object({ productId: z.literal("premium") }), // one-time lifetime unlock
  freePackIds: z.array(z.string()),
  packs: z.array(CatalogPackSchema), // premium packs only, catalog order
});
export const BillingHttpError = z.object({ error: z.enum(BILLING_ERROR_CODES) });

// §3.10 fake-mode routes (dev / e2e only; 404 outside fake mode). PAY-GAP: the spec gives the shapes in prose only.
export const FAKE_PURCHASE_STATES = ["PURCHASED", "PENDING", "CANCELLED", "REVOKED"] as const;
export const FakePurchaseRequest = z.strictObject({
  installId: InstallIdSchema, productId: ProductIdSchema, outcome: z.enum(["PURCHASED", "PENDING"]).optional(),
});
export const FakePurchaseResponse = z.object({ purchaseToken: z.string() });
export const FakeSetRequest = z.strictObject({
  purchaseToken: PurchaseTokenSchema, state: z.enum(FAKE_PURCHASE_STATES),
});

export type VerifyRequestBody = z.infer<typeof VerifyRequest>;
export type EntitlementRequestBody = z.infer<typeof EntitlementRequest>;
export type EntitlementBody = z.infer<typeof EntitlementBody>;
export type VerifyResponseBody = z.infer<typeof VerifyResponse>;
export type EntitlementResponseBody = z.infer<typeof EntitlementResponse>;
export type CatalogPackBody = z.infer<typeof CatalogPackSchema>;
export type CatalogResponseBody = z.infer<typeof CatalogResponse>;
export type BillingHttpErrorBody = z.infer<typeof BillingHttpError>;
export type FakePurchaseRequestBody = z.infer<typeof FakePurchaseRequest>;
export type FakePurchaseResponseBody = z.infer<typeof FakePurchaseResponse>;
export type FakeSetRequestBody = z.infer<typeof FakeSetRequest>;
