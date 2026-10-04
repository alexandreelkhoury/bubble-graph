# PAYMENTS-SPEC — Mish Ana! premium, packs and Google Play Billing (v1)

Status: **binding** for three implementers, written 2026-10-04. It extends [SPEC.md](SPEC.md). Where the two differ on payments, entitlements, packs, the room access model or the new protocol fields, **this file wins**. Everything SPEC.md says and this file does not change stays binding: the engine rules, the secrecy rules (§5.4), the Blank never speaking first, remote-only TV, the logging rules, and the rule that nobody commits to git.

| Implementer | Scope | Owns (write access, §9) |
|---|---|---|
| **A** | shared + server (+ packs, i18n, generated Android strings) | `shared/**`, `server/**`, `word-packs/**`, `tools/**`, generated `tv-app` string files, `docs/DEV.md` |
| **B** | Android TV app | `tv-app/**` except the generated files, `docs/TV.md` |
| **C** | phone web client + browser TV mock (`/tv`) + e2e | `web-client/**` |

> Note: these letters are **not** SPEC.md's letters. In SPEC.md, B is web and C is TV. Here, B is the **TV app** and C is the **web client**.

Implementers never talk to each other. Every name that crosses a package boundary is defined here. If something is missing, the implementer picks the most conservative option, writes `// PAY-GAP: <text>` at the site, and lists it in their final report.

**Verification legend.**
- Facts marked ✔ were checked on 2026-10-04 against the sources listed in §10.
- **[VERIFY]** means the fact could not be confirmed from an official source in this sandbox, which blocks `support.google.com`, `developers.google.com`, `docs.cloud.google.com`, `developers.cloudflare.com` and `dl.google.com`. Google API facts come from the live **discovery document** (`androidpublisher.googleapis.com/$discovery/rest?version=v3`, revision `20261001`). Cloudflare facts come from the `cloudflare/cloudflare-docs` GitHub sources. OAuth facts come from Google's own `gtoken@8.0.0` and `google-auth-library@11.1.0` npm sources.

---

## 0. Decisions in one page

**Owner's "Google Pay" question.** Inside an Android app distributed by Google Play, **digital goods such as subscriptions and word packs must be sold through Google Play Billing**. The Google Pay API is for physical goods and services, not for this (Payments policy, MONETIZATION.md [G7], snippet-level → **[VERIFY]** in Play Console policy pages). This costs the buyer nothing in convenience: the Play Billing purchase sheet already offers the payment methods saved in the user's Google account, including cards, Google Play balance and carrier billing where available. Integration needs only **one Google Play developer account** (§8). No separate "Google Pay merchant" setup is needed.

| Topic | Decision |
|---|---|
| Rail | Google Play Billing Library **9.1.0** ✔ (latest per the release notes, 2026-06-18). Server checks go through the Google Play Developer API v3. There is no web checkout, no QR code to a payment page, and **no buy button on phones**. |
| Products | Subscription `premium` (base plans `monthly`, `yearly`; offer `trial-7d` on each). One-time products `pack_<packId with - → _>` for every premium pack (§1). |
| Free tier | Core game, 3–12 players, one starter pack per language: `en-everyday-01`, `fr-everyday-01`, `ar-everyday-01`. All other settings are free except the premium settings in §1.6. |
| Who pays | Only the host TV. Phones show locked packs with "Unlock on the TV". |
| Identity | No accounts. The TV generates an `installId` (128-bit random). The server sees the raw value only inside HTTPS request bodies and stores only `installHash = sha256hex(installId)`, which is also the `obfuscatedAccountId` sent to Google. |
| Source of truth | The server. It stores purchase state in the **Billing Durable Object** (SQLite), issues a signed **entitlement token** (Ed25519 JWT, 24 h TTL), and the Room DO decides which packs a room may play. Locked packs reach clients as metadata only (title, count), never as words. |
| Fake billing | `BILLING_MODE=fake` exists for local dev and e2e only. It is guarded so it cannot be enabled in production (§3.10). |
| Apple TV (v2) | Not blocked. Entitlement claims are store-agnostic (`premiumUntil`, `packs[]`). A future `/api/billing/apple/verify` writes rows with `store="apple"` into the same tables and the same token. |

---

## 1. Product catalog

### 1.1 Google Play products (created by the owner in Play Console, §8)

Formats verified ✔ in the discovery document:
- Subscription `productId`: `[a-z0-9_.]`, starts with a letter or digit, 1–40 characters.
- One-time `productId`: `[a-z0-9_.]`, starts with a letter or digit. **No hyphens.**
- `basePlanId`: `[a-z0-9-]`, ≤ 63 characters.
- Offer id: `[a-z0-9-]`, ≤ 63 characters.

| Product id | Play type | Plans / options | Price (owner sets per country) | Grants |
|---|---|---|---|---|
| `premium` | Subscription | Base plan `monthly`: auto-renewing, 1 month. Base plan `yearly`: auto-renewing, 1 year. Offer `trial-7d` on **each** base plan: one phase "free trial, 7 days", eligibility "new customer acquisition → never had this subscription". Grace period and account hold stay at their defaults. Pause: **disable** it in Play Console (simplifies v1; the paused state is still mapped). Resubscribe: allowed | ~US$4.99 / month, ~US$29.99 / year; ~40% lower in LB/ME | All packs, current and future, plus premium settings |
| `pack_<id>` (one per premium pack, see §1.3) | One-time product (Play Console: "one-time product", non-consumable; **we never consume**) | One purchase option `buy` [VERIFY the default purchase-option id Play Console proposes; it is not used by the code] | ~US$1.99–2.99 | That pack, forever |

The code never hard-codes prices. The TV shows `ProductDetails` formatted prices only.

### 1.2 Pack metadata: new `tier` field (A)

`shared/src/packs/schema.ts`: add to `WordPackSchema` (strict object):
```ts
tier: z.enum(["free", "premium"]).default("premium"),
```
- **New packs are premium automatically.** A pack JSON without `tier` parses as premium. The starter packs carry `"tier": "free"` explicitly.
- `engine/catalog.ts`: `WordPackLike.tier: "free" | "premium"` and `CatalogPack.tier: "free" | "premium"`. `buildCatalog` copies it.
- `PackTier` type: `export type PackTier = "free" | "premium"` in `engine/catalog.ts`.

Edits to the pack JSON files (A):

| Pack id | Locale | Pairs | `tier` | Product id |
|---|---|---|---|---|
| `en-everyday-01` | en | 24 | **free** | — |
| `fr-everyday-01` | fr | 24 | **free** | — |
| `ar-everyday-01` | ar | 24 | **free** | — |
| `en-food-01` | en | 33 | premium | `pack_en_food_01` |
| `en-leisure-01` | en | 33 | premium | `pack_en_leisure_01` |
| `en-nature-01` | en | 33 | premium | `pack_en_nature_01` |
| `en-places-01` | en | 30 | premium | `pack_en_places_01` |
| `en-things-01` | en | 64 | premium | `pack_en_things_01` |
| `fr-food-01` | fr | 33 | premium | `pack_fr_food_01` |
| `fr-leisure-01` | fr | 33 | premium | `pack_fr_leisure_01` |
| `fr-nature-01` | fr | 31 | premium | `pack_fr_nature_01` |
| `fr-places-01` | fr | 30 | premium | `pack_fr_places_01` |
| `fr-things-01` | fr | 64 | premium | `pack_fr_things_01` |
| `ar-home-01` | ar | 28 | premium | `pack_ar_home_01` |
| `ar-nature-01` | ar | 29 | premium | `pack_ar_nature_01` |
| `lb-food-01` | ar-LB | 27 | premium | `pack_lb_food_01` |
| `lb-life-01` | ar-LB | 23 | premium | `pack_lb_life_01` |

Starter packs are the "Everyday" pack because it exists with the same theme in all three languages. **Owner follow-up (non-blocking):** grow each starter pack to at least 40 pairs. 24 pairs is about 24 games before repeats (lint warning, §1.5).

### 1.3 Pack → product id mapping (shared, A; mirrored in Kotlin by B)

`shared/src/billing/products.ts` (new module, exported as `@mishana/shared/billing`, added to `shared/package.json` `exports` as `"./billing": "./src/billing/index.ts"`):
```ts
export const PREMIUM_PRODUCT_ID = "premium" as const;
export const BASE_PLAN_IDS = ["monthly", "yearly"] as const;          // display order on the TV
export type BasePlanId = (typeof BASE_PLAN_IDS)[number];
export const TRIAL_OFFER_ID = "trial-7d" as const;
export const PACK_PRODUCT_PREFIX = "pack_" as const;
export const PRODUCT_ID_MAX = 40;                                       // ✔ Play limit for subscriptions; applied to packs too
export const PREMIUM_PACK_ID_MAX = PRODUCT_ID_MAX - PACK_PRODUCT_PREFIX.length; // 35
export function packProductId(packId: string): string { return PACK_PRODUCT_PREFIX + packId.replaceAll("-", "_"); }
export function packIdFromProductId(productId: string): string | null {
  if (!productId.startsWith(PACK_PRODUCT_PREFIX)) return null;
  const rest = productId.slice(PACK_PRODUCT_PREFIX.length);
  return /^[a-z0-9]+(_[a-z0-9]+)*$/.test(rest) ? rest.replaceAll("_", "-") : null;
}
export const PRODUCT_ID_REGEX = /^[a-z0-9][a-z0-9_.]{0,39}$/;
```
The mapping is a bijection: pack ids match `^[a-z0-9]+(-[a-z0-9]+)*$` and contain no `_`. A test checks the round trip for every shipped pack.

Kotlin (B) `billing/Products.kt` mirrors these constants and the two functions exactly. `ProductsTest` checks them against `shared/fixtures/billing.products.json` (V, written by A):
```json
{ "premium": "premium", "basePlans": ["monthly", "yearly"], "trialOfferId": "trial-7d",
  "pairs": [["lb-food-01", "pack_lb_food_01"], ["en-things-01", "pack_en_things_01"]] }
```

### 1.4 How a new pack becomes sellable
1. D/A adds a JSON pack (no `tier`, so premium) and lists it in `word-packs/index.ts`.
2. Deploy. `GET /api/billing/catalog` (§3.4) lists it, and the TV store shows it as soon as Play returns `ProductDetails` for its product id. Until the owner creates the product in Play Console, `queryProductDetailsAsync` reports it in `unfetchedProductList` (`PRODUCT_NOT_FOUND` ✔). The TV then hides the row's Buy button and shows the row as "Included with Premium".
3. Premium subscribers get the pack immediately, because premium means "every pack whose tier is premium".
4. `pnpm --filter @mishana/server billing:products` (A, `server/scripts/play-products.mjs`) prints a CSV (`productId,packId,locale,titleEn,titleFr,titleAr`) of every premium pack, for the owner to create in Play Console.

### 1.5 Pack lint additions (A, `tools/pack-lint`)

Errors:
- Not exactly **one** `tier:"free"` pack per **language** (`languageOf(locale)`; `ar-LB` counts as `ar`).
- A free pack whose `locale` is not exactly `en`/`fr`/`ar`. Starter packs are not regional.
- A free pack whose `ageRating !== "all"`.
- A premium pack whose `id.length > PREMIUM_PACK_ID_MAX` (35).
- `packProductId(id)` fails `PRODUCT_ID_REGEX`, or two packs map to the same product id.

Warnings:
- A free pack with fewer than 40 pairs.
- A premium pack with fewer than 20 pairs.

`word-packs/test/packs.test.ts` asserts the same error rules on the shipped packs.

### 1.6 Premium settings
```ts
// shared/src/billing/products.ts
export const PREMIUM_SETTING_KEYS = ["points"] as const satisfies readonly (keyof Settings)[];
```
- v1 has one premium setting: **custom points** (`points`). In a non-premium room, `points` stays `DEFAULT_SETTINGS.points`.
- Changing the list is a one-line owner decision. Every client reads it from this constant (TS) or its Kotlin mirror (`Products.PREMIUM_SETTING_KEYS = listOf("points")`), and nothing else is hard-coded.
- Every other §4.4 setting stays free.

---

## 2. Entitlement model

### 2.1 Definitions
- **installId**: 32 lowercase hex characters (16 bytes from `SecureRandom`), created on the TV's first launch. It is stored in SharedPreferences `"mishana_billing"`, key `install_id`, and excluded from Auto Backup (§4.1). Regex `INSTALL_ID_REGEX = /^[0-9a-f]{32}$/`.
- **installHash**: `sha256hex(installId)`, 64 hex characters. It is the `obfuscatedAccountId` passed to `BillingFlowParams.Builder.setObfuscatedAccountId` (✔ limit 64 characters, no PII).
- **Purchase**: one Google purchase token, stored only as `tokenHash = sha256hex(purchaseToken)`. The raw token is kept only while an acknowledgement is pending (§3.7).
- **Binding**: (tokenHash, installHash). It is created when an install proves possession of a token by posting it to `/api/billing/verify`, or from `obfuscatedExternalAccountId` on an RTDN.
- **Entitlement of an install**: computed over every purchase bound to its installHash that is not superseded or revoked:
  - `premiumUntil`: the latest access-until time over subscription purchases with access (below), or `null`;
  - `packs`: the pack ids of one-time purchases in state `PURCHASED`.

### 2.2 Subscription state → access (shared pure function, A)

`shared/src/billing/entitlement.ts`:
```ts
export const SUB_STATES = ["SUBSCRIPTION_STATE_UNSPECIFIED","SUBSCRIPTION_STATE_PENDING","SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_PAUSED","SUBSCRIPTION_STATE_IN_GRACE_PERIOD","SUBSCRIPTION_STATE_ON_HOLD","SUBSCRIPTION_STATE_CANCELED",
  "SUBSCRIPTION_STATE_EXPIRED","SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED"] as const;   // ✔ discovery enum
export const RENEWAL_SLACK_MS = 6 * 3600_000;
export function subscriptionAccessUntil(s: { state: SubState; expiryMs: number | null; autoRenew: boolean; revoked: boolean }, nowMs: number): number | null;
```

| `subscriptionState` ✔ | Access? | `accessUntil` |
|---|---|---|
| `ACTIVE`, including the free trial (`lineItems[].offerPhase.freeTrial` present) and the silent 24 h grace ✔ | yes | `expiryMs + (autoRenew ? RENEWAL_SLACK_MS : 0)` |
| `IN_GRACE_PERIOD` (Google keeps extending `expiryTime` ✔) | yes | `expiryMs + RENEWAL_SLACK_MS` |
| `CANCELED` (the user keeps access until `expiryTime` ✔) | yes, only if `expiryMs > now` | `expiryMs` |
| `ON_HOLD` (account hold: block access ✔) | no | `null` |
| `PAUSED` | no | `null` |
| `EXPIRED` (also what a revocation looks like ✔) | no | `null` |
| `PENDING`, `PENDING_PURCHASE_CANCELED`, `UNSPECIFIED` | no | `null` |

The function returns `null` whenever `revoked` is true or the result is `≤ now`. `expiryMs` is `max(Date.parse(lineItems[i].expiryTime))` over line items whose `productId === "premium"`.

`RENEWAL_SLACK_MS` exists because a token issued just before an auto-renewal would otherwise end premium at the old `expiryTime`, before the TV fetches a fresh token. A user who cancels auto-renew gets no slack.

One-time products ✔ (`ProductPurchaseV2.purchaseStateContext.purchaseState`):
- `PURCHASED`: owned.
- `PENDING`: pending, no access.
- `CANCELLED`: no access.

Access also requires `revoked === false` (voided, §3.8).

### 2.3 Entitlement token (server-signed, opaque to clients)

**Format:** a compact JWS (JWT) with three base64url (no padding) segments, `header.payload.signature`. Total length ≤ `ENTITLEMENT_TOKEN_MAX_CHARS = 3000`.
```jsonc
// header
{ "alg": "EdDSA", "typ": "JWT", "kid": "k1" }
// payload (JWT time claims in SECONDS)
{ "iss": "mish-ana", "v": 1, "sub": "<installHash 64 hex>",
  "iat": 1790000000, "exp": 1790086400,
  "pu": 1792592000,                 // premiumUntil, seconds, or null
  "packs": ["en-food-01", "lb-food-01"],   // sorted, unique, ≤ 64 (MAX_TOKEN_PACKS); owned packs only (premium covers the rest)
  "mode": "google" }                // "google" | "fake"
```
- **Algorithm:** Ed25519 via WebCrypto (`{ name: "Ed25519" }`, ✔ supported by Workers for sign/verify/importKey; ✔ Node 22.22 for tests). The signature covers the ASCII bytes of `header + "." + payload` (the base64url strings).
- **TTL:** `exp = iat + ENTITLEMENT_TTL_S` (86 400 s = 24 h). Revocations (refunds, chargebacks, holds) therefore reach new rooms within 24 h at most, and usually immediately, because the TV refreshes often (§2.4).
- **Keys:** the Workers secret `ENTITLEMENT_KEYS` (JSON):
  ```json
  { "active": "k2", "keys": [ { "kid": "k1", "x": "<b64url pub>", "d": "<b64url priv>" }, { "kid": "k2", "x": "…", "d": "…" } ] }
  ```
  - Each key is an OKP JWK pair (`kty:"OKP", crv:"Ed25519"`). Sign with the `active` kid; verify with any listed kid.
  - **Rotation:** generate a new key (`pnpm --filter @mishana/server gen:entitlement-key` → `server/scripts/gen-entitlement-key.mjs` prints `{kid,x,d}` from Node WebCrypto), add it, set `active`, deploy, then remove the old kid after **≥ 48 h** (2 × TTL).
  - `kid` matches `^[a-z0-9]{1,16}$`.
- **Fake mode** signs with the fixed, public dev key `FAKE_ENTITLEMENT_KEY` (kid `fake`, constant in `server/src/billing/fake.ts`). The verifier accepts kid `fake` and `mode:"fake"` **only** when fake mode is active (§3.10). In google mode, a token with `mode:"fake"` or kid `fake` → `ENTITLEMENT_INVALID`.
- **Verification** (server only, `server/src/billing/token.ts`, `verifyEntitlementToken(token, keys, nowMs, fakeActive)`):
  1. length ≤ 3000;
  2. three segments;
  3. header exact (`alg:"EdDSA"`, `typ:"JWT"`, known `kid`);
  4. signature valid;
  5. `iss`, `v===1`;
  6. `sub` is 64 hex;
  7. `iat ≤ now + 300 s` and `exp > now`;
  8. `packs` are ids of premium packs that exist in the catalog (unknown ids are dropped, not an error);
  9. mode rules as above.

  Output `RoomEntitlement` (milliseconds):
  ```ts
  export interface RoomEntitlement { sub: string; iatMs: number; expMs: number; premiumUntilMs: number | null; packs: string[]; mode: "google" | "fake" }
  ```
- Clients never parse the token. The TV stores it and also receives the decoded fields in the API response (§3.4).

### 2.4 Refresh rules (TV, B; the TV mock follows the same rules with fake billing)

The TV calls `POST /api/billing/verify` (when it has purchases) or `POST /api/billing/entitlement` (when it has none):
1. On app start, after `queryPurchasesAsync` (restore; §4.2).
2. On `ON_START` (foreground) if the stored token is older than 1 h.
3. After every `onPurchasesUpdated` with `PURCHASED` purchases.
4. While in a room: on a timer at `min(expiresAt − 1 h, premiumUntil + 2 min)`, and at least every 6 h.
5. When the Store opens.

After a successful refresh while connected to a room, the TV sends the WS message `{"v":1,"t":"entitlement","token":"…"}` (§3.11).

A refresh failure is never fatal. The TV keeps the old token and retries with `ReconnectPolicy.delayMs`, capped at 10 min.

### 2.5 Where entitlement is not needed
- Phones never hold tokens.
- The engine never sees tokens. The Room DO turns the room's entitlement into a **playable catalog** (§3.11) and passes only that catalog to `reduce` and the projection.

---

## 3. Server (A)

### 3.1 Files
```
server/src/billing/
  routes.ts          HTTP handlers for /api/billing/* (no partyserver import)
  billing-do.ts      `Billing` Durable Object (extends DurableObject from "cloudflare:workers"); thin adapter over BillingCore
  billing-core.ts    runtime-agnostic logic + SQL (tests drive it with a node:sqlite-backed fake, or an in-memory SqlLike fake)
  google.ts          GoogleApi: service-account JWT → access token cache; subscriptionsv2.get, productsv2.getproductpurchasev2,
                     subscriptions.acknowledge, products.acknowledge, voidedpurchases.list
  google-types.ts    hand-written TS types for the fields we read (subset of the discovery schemas, names verbatim)
  normalize.ts       SubscriptionPurchaseV2 / ProductPurchaseV2 → NormalizedPurchase
  token.ts           sign/verify entitlement JWT (Ed25519), key parsing
  pubsub-auth.ts     Pub/Sub push OIDC verification (RS256, Google JWKS cache)
  rtdn.ts            DeveloperNotification parsing + dispatch
  cron.ts            scheduled(): voided purchases, ack retries, pruning
  fake.ts            FAKE billing: FakeGoogleApi + fake routes + FAKE_ENTITLEMENT_KEY + guard
  mode.ts            billingMode(env, req?) guard (§3.10)
server/src/access.ts room access: playable catalog, locked pack metadata, settings restriction (used by RoomCore)
server/scripts/{gen-entitlement-key.mjs, play-products.mjs, check-deploy.mjs}
```
`shared/src/billing/{index,products,entitlement,http}.ts` holds the constants, the pure state mapping, and the zod schemas for the billing HTTP API, shared with C and with the fixtures.

### 3.2 `wrangler.jsonc` changes (exact keys; ✔ the wrangler 4.147.0 schema has `triggers.crons`, `secrets.required`, ratelimit `period` ∈ {10, 60})
```jsonc
"durable_objects": { "bindings": [ { "name": "Room", "class_name": "Room" }, { "name": "BILLING", "class_name": "Billing" } ] },
"migrations": [ { "tag": "v1", "new_sqlite_classes": ["Room"] }, { "tag": "v2", "new_sqlite_classes": ["Billing"] } ],
"ratelimits": [ …existing…, { "name": "BILLING_LIMITER", "namespace_id": "1003", "simple": { "limit": 30, "period": 60 } } ],
"triggers": { "crons": ["17 3 * * *"] },
"secrets": { "required": ["PLAY_SERVICE_ACCOUNT_JSON", "ENTITLEMENT_KEYS"] },
"vars": { …existing…, "BILLING_MODE": "google", "ALLOW_FAKE_BILLING": "0",
          "PLAY_PACKAGE_NAME": "app.mishana.tv", "RTDN_AUDIENCE": "", "RTDN_SA_EMAIL": "" }
```
- `run_worker_first` already covers `/api/*`.
- `secrets.required` makes `wrangler deploy` fail when a secret is missing ✔. In local dev, missing secrets are warnings only ✔.
- `namespace_id: "1003"` is a placeholder, like 1001/1002 (SPEC §16.5).

`src/env.ts` adds:
```ts
BILLING: DurableObjectNamespace<Billing>; BILLING_LIMITER: RateLimit;
BILLING_MODE: string; ALLOW_FAKE_BILLING: string; PLAY_PACKAGE_NAME: string; RTDN_AUDIENCE: string; RTDN_SA_EMAIL: string;
PLAY_SERVICE_ACCOUNT_JSON?: string; ENTITLEMENT_KEYS?: string;
```
`src/index.ts` exports `{ fetch, scheduled } satisfies ExportedHandler<Env>` and `export { Room } from "./room"; export { Billing } from "./billing/billing-do"`. The Billing DO is a **single instance**: `env.BILLING.getByName("global")` ✔ (`getByName` exists in the pinned workers-types). Load is tiny (one row write per purchase or notification), and one instance gives strongly consistent indices.

### 3.3 Constants (A, `shared/src/constants.ts` additions)
```ts
export const HTTP_BODY_MAX_BYTES = 4096;          // CHANGED from 1024: POST /api/rooms now carries an entitlement token
export const BILLING_BODY_MAX_BYTES = 16384;
export const ENTITLEMENT_TOKEN_MAX_CHARS = 3000;
export const ENTITLEMENT_TTL_S = 86_400;
export const MAX_TOKEN_PACKS = 64;
export const MAX_PURCHASES_PER_VERIFY = 20;
export const PURCHASE_TOKEN_MAX_CHARS = 2048;     // printable ASCII \x21-\x7e
export const MAX_INSTALLS_PER_PURCHASE = 10;      // active bindings (seen in the last 60 days)
export const INSTALL_ACTIVE_WINDOW_MS = 60 * 86_400_000;
export const INSTALL_VERIFY_PER_10MIN = 20;       // per installHash, Billing DO in-memory window
export const INSTALL_ENTITLEMENT_PER_10MIN = 60;
```
Kotlin `Constants` mirrors `ENTITLEMENT_TOKEN_MAX_CHARS`, `MAX_PURCHASES_PER_VERIFY` and `PURCHASE_TOKEN_MAX_CHARS`.

### 3.4 HTTP endpoints

All billing JSON responses carry `Cache-Control: no-store` except `/catalog`. They use the error body `{"error": BillingErrorCode}`. Request bodies need `Content-Type: application/json`, are capped at `BILLING_BODY_MAX_BYTES` (read with `readBodyLimited`), and are parsed with strict zod schemas. The Origin check (SPEC §7.4) applies: the TV app sends no Origin, and the TV mock is same-origin. `BILLING_LIMITER` (key: client IP) applies to every route except `/rtdn`.

```ts
// shared/src/billing/http.ts
export const BILLING_ERROR_CODES = ["BAD_REQUEST","FORBIDDEN","RATE_LIMITED","UNAUTHORIZED","NOT_CONFIGURED","UPSTREAM_UNAVAILABLE","INTERNAL"] as const;
export const PURCHASE_RESULTS = ["OK","PENDING","NOT_OWNED","INVALID","REVOKED","INSTALL_LIMIT","UPSTREAM_ERROR"] as const;
export const InstallIdSchema = z.string().regex(/^[0-9a-f]{32}$/);
export const PurchaseTokenSchema = z.string().min(1).max(2048).regex(/^[\x21-\x7e]+$/);
export const ProductIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_.]{0,39}$/);
export const VerifyRequest = z.strictObject({ installId: InstallIdSchema,
  purchases: z.array(z.strictObject({ productId: ProductIdSchema, purchaseToken: PurchaseTokenSchema })).min(1).max(20) });
export const EntitlementRequest = z.strictObject({ installId: InstallIdSchema });
export const SubscriptionInfo = z.object({ state: z.enum(SUB_STATES), basePlanId: z.string().nullable(), autoRenewing: z.boolean(),
  inTrial: z.boolean(), expiresAt: z.number().nullable() /* ms */ });
export const EntitlementBody = z.object({ token: z.string(), premium: z.boolean(), premiumUntil: z.number().nullable() /* ms, incl. slack */,
  packs: z.array(z.string()), expiresAt: z.number() /* token exp, ms */, subscription: SubscriptionInfo.nullable() });
export const VerifyResponse = z.object({ entitlement: EntitlementBody,
  results: z.array(z.object({ productId: z.string(), result: z.enum(PURCHASE_RESULTS) })) });   // same order as the request
export const EntitlementResponse = z.object({ entitlement: EntitlementBody });
export const CatalogResponse = z.object({ mode: z.enum(["google","fake"]), packageName: z.string(),
  subscription: z.object({ productId: z.literal("premium"), basePlanIds: z.array(z.string()), trialOfferId: z.string() }),
  freePackIds: z.array(z.string()),
  packs: z.array(z.object({ packId: z.string(), productId: z.string(), locale: z.string(), language: LocaleSchema,
    title: LocalizedTitleSchema, pairCount: z.number().int(), ageRating: AgeRatingSchema })) });  // premium packs only, catalog order
export const BillingHttpError = z.object({ error: z.enum(BILLING_ERROR_CODES) });
```
`subscription` in `EntitlementBody` is the bound premium purchase with the latest `expiresAt` (or `null`). The TV uses it for "Renews on / Ends on / Fix payment".

| Method + path | Request | Success | Errors |
|---|---|---|---|
| `GET /api/billing/catalog` | — | 200 `CatalogResponse`, `Cache-Control: public, max-age=300` | 503 `NOT_CONFIGURED` when google mode lacks secrets |
| `POST /api/billing/verify` | `VerifyRequest` | 200 `VerifyResponse` (per-purchase results; the entitlement is always returned and reflects every binding, not only this request) | 400 `BAD_REQUEST`, 403 `FORBIDDEN` (origin), 429 `RATE_LIMITED` (IP limiter or per-install window), 503 `NOT_CONFIGURED`. Google outages do **not** fail the request: affected purchases get `UPSTREAM_ERROR` |
| `POST /api/billing/entitlement` | `EntitlementRequest` | 200 `EntitlementResponse` (free entitlement when nothing is bound) | 400, 403, 429, 503 |
| `POST /api/billing/rtdn` | Pub/Sub push (§3.6) | 204 | 401 `UNAUTHORIZED` (bad or missing OIDC), 503 `UPSTREAM_UNAVAILABLE` (so Pub/Sub retries) |
| `POST /api/billing/fake/purchase` | fake only (§3.10) | 200 `{ "purchaseToken": "fake.…" }` | 404 outside fake mode |
| `POST /api/billing/fake/set` | fake only | 204 | 404 outside fake mode |
| other methods/paths under `/api/billing/` | — | — | 405 `{"error":"BAD_REQUEST"}` |

**Verify algorithm** (Worker, `routes.ts`). Run steps 1–2 once, step 3 for each purchase sequentially, then step 4:
1. Parse the request. `installHash = sha256hex(installId)`. Billing DO `rateCheck(installHash, "verify", now)` → false → 429.
2. Mode guard (§3.10). Load the Google client (google) or the FakeGoogleApi (fake).
3. For each purchase:
   - a. `productId === "premium"` → kind `sub`. Otherwise `packIdFromProductId` must name a **premium** catalog pack → kind `pack`. Otherwise → `INVALID`.
   - b. Fetch from Google:
     - sub → `subscriptionsv2.get`; pack → `productsv2.getproductpurchasev2`.
     - HTTP 400/404/410 → `INVALID`.
     - 401/403 → log `{code:"BILLING_AUTH"}`, `UPSTREAM_ERROR`.
     - 429/5xx/timeout (after the one retry of §3.7) → `UPSTREAM_ERROR`.
   - c. `normalize` (§3.7). The product must match:
     - sub: some `lineItems[].productId === "premium"`;
     - pack: `productLineItem[0].productId === productId`.

     Otherwise → `INVALID`.
   - d. Billing DO `applyPurchase({ tokenHash, kind, productId, n: normalized, callerInstallHash: installHash, rawTokenForAck })` → `OK` / `PENDING` / `NOT_OWNED` / `REVOKED` / `INSTALL_LIMIT` (§3.5).
   - e. If the result is `OK` and `n.acknowledged === false`:
     - acknowledge (sub → `subscriptions.acknowledge` with `subscriptionId="premium"`; pack → `products.acknowledge`);
     - on 2xx → DO `markAcked(tokenHash)`;
     - on failure, keep `ack_token` for the cron retry. The result stays `OK`: the user paid, and we have three days to acknowledge ✔.
4. DO `entitlementFor(installHash, now)` → sign the token → 200.

**obfuscatedAccountId rule.**
- If the Google resource carries `obfuscatedExternalAccountId` (sub: `externalAccountIdentifiers.obfuscatedExternalAccountId`; product: `obfuscatedExternalAccountId`, ✔ field names), store it as `origin_install_hash`. If it is a 64-hex string, also bind it.
- A mismatch with the caller is **allowed**: it is a restore on another TV signed into the same Google account. It counts toward `MAX_INSTALLS_PER_PURCHASE`, and the Worker logs `{code:"BILLING_RESTORE_OTHER_INSTALL"}` without hashes.
- A purchase with **no** obfuscated id (a promo code redeemed in the Play Store, or an out-of-app resubscribe) binds to the caller.

**Entitlement route:** `rateCheck(…, "entitlement")`, then `entitlementFor`, then sign.

### 3.5 Billing Durable Object (`Billing`, SQLite; ✔ `ctx.storage.sql.exec(...).toArray()/.one()`, `ctx.storage.transactionSync`)

Schema, created in the constructor with `CREATE TABLE IF NOT EXISTS`:
```sql
CREATE TABLE purchases (
  token_hash TEXT PRIMARY KEY, store TEXT NOT NULL DEFAULT 'google',  -- 'google' | 'fake' | ('apple' in v2)
  kind TEXT NOT NULL,              -- 'sub' | 'pack'
  product_id TEXT NOT NULL,
  state TEXT NOT NULL,             -- sub: SUB_STATES value; pack: 'PURCHASED' | 'PENDING' | 'CANCELLED'
  expiry_ms INTEGER, auto_renew INTEGER NOT NULL DEFAULT 0, base_plan_id TEXT, in_trial INTEGER NOT NULL DEFAULT 0,
  acknowledged INTEGER NOT NULL DEFAULT 0, ack_token TEXT,           -- raw token ONLY while unacknowledged; NULLed on ack or after 4 days
  revoked INTEGER NOT NULL DEFAULT 0, test INTEGER NOT NULL DEFAULT 0,
  origin_install_hash TEXT, superseded_by TEXT,                      -- token_hash of the purchase that replaced this one
  google_checked_ms INTEGER NOT NULL, created_ms INTEGER NOT NULL, updated_ms INTEGER NOT NULL);
CREATE TABLE bindings (token_hash TEXT NOT NULL, install_hash TEXT NOT NULL, first_seen_ms INTEGER NOT NULL, last_seen_ms INTEGER NOT NULL,
  PRIMARY KEY (token_hash, install_hash));
CREATE INDEX bindings_install ON bindings(install_hash);
CREATE TABLE rtdn_seen (message_id TEXT PRIMARY KEY, at_ms INTEGER NOT NULL);
CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);               -- 'voided_cursor_ms'
CREATE TABLE fake_purchases (token TEXT PRIMARY KEY, json TEXT NOT NULL);  -- used only in fake mode
```

RPC methods (all synchronous SQL inside `transactionSync`; no `await` between read and write):

| Method | Behaviour |
|---|---|
| `rateCheck(installHash, kind: "verify"\|"entitlement", nowMs): boolean` | In-memory sliding window (10 min) per hash; limits from §3.3. Losing it on eviction is fine |
| `applyPurchase(i: ApplyInput): PurchaseResult` | **Upsert** `purchases`, but only if `i.n.checkedMs >= google_checked_ms` (stale Google reads never overwrite newer ones). Then link handling (below). Then the binding: if `i.callerInstallHash` and the purchase grants access or is pending, upsert `bindings` (refresh `last_seen_ms`). Before inserting a **new** binding, count active bindings (`last_seen_ms > now − INSTALL_ACTIVE_WINDOW_MS`) for the token; if ≥ 10 → `INSTALL_LIMIT` (the purchase row is still stored). Returns `OK` if access, `PENDING` if pending, `REVOKED` if `revoked`, `NOT_OWNED` otherwise |
| `markAcked(tokenHash)` | `acknowledged=1, ack_token=NULL` |
| `entitlementFor(installHash, nowMs): Claims` | Bound rows with `superseded_by IS NULL AND revoked=0`. `premiumUntil = max(subscriptionAccessUntil(row))`. `packs` = sorted pack ids of `kind='pack' AND state='PURCHASED'` that still exist as premium catalog packs, truncated to `MAX_TOKEN_PACKS` (see the note at the end of this section). Also returns `subscription` info for the best sub row |
| `kindOf(tokenHash): 'sub'\|'pack'\|null` | For voided purchases |
| `markRevoked(tokenHash)` | `revoked=1` |
| `rtdnSeen(messageId): boolean` / `rtdnMark(messageId, nowMs)` | Dedupe |
| `pendingAcks(nowMs): {tokenHash, kind, productId, token}[]` | Rows with `ack_token NOT NULL AND created_ms > now − 3 days` |
| `cursorGet()/cursorSet(ms)` | `kv.voided_cursor_ms` |
| `prune(nowMs)` | Delete `rtdn_seen` older than 30 days. NULL `ack_token` older than 4 days. Delete bindings with `last_seen_ms` older than 400 days. Delete purchases that are `superseded_by` or `revoked` or expired more than 400 days ago (retention, §6.5) |
| `fakeGet/fakePut` | Fake store rows (§3.10) |

**Link handling** (inside `applyPurchase`):
- If `n.linkedPurchaseToken` is set (upgrade, downgrade, re-signup before lapse ✔): `old = sha256hex(linked)`. If a row `old` exists:
  - set `old.superseded_by = token_hash`;
  - copy every binding of `old` to the new token (keeping `last_seen_ms`).
- If `n.outOfAppExpiredPurchaseToken` is set (resubscribe after expiry, made from the Play subscriptions center ✔ `outOfAppPurchaseContext.expiredPurchaseToken`): copy the bindings of that token's hash the same way. Do not mark it superseded, because it is already expired.
- If neither applies, the RTDN path also binds through `obfuscatedExternalAccountId` (§3.4 rule).

`linkedPurchaseToken` is computed **before** hashing. The raw linked token is never stored.

The owned-pack cap (`MAX_TOKEN_PACKS = 64`) is a v1 limit. It is far above the 14 premium packs. **PAY-GAP for A** if the catalog ever approaches 64: switch the claim to a bitmap.

### 3.6 RTDN push endpoint (`/api/billing/rtdn`)

**Auth** (`pubsub-auth.ts`). The push subscription is created with `--push-auth-service-account` and `--push-auth-token-audience` (✔ gcloud flags), so each request carries `Authorization: Bearer <Google-signed OIDC JWT>` ✔ (`PushConfig.oidcToken`). Verify:
1. Header `{alg:"RS256", kid}`. Keys come from `https://www.googleapis.com/oauth2/v3/certs` (✔ the JWK URL used by `google-auth-library`):
   - cache them per isolate, honouring `Cache-Control: max-age` (default 1 h);
   - on an unknown kid, refetch once, at most once per 60 s.
2. Import with `{name:"RSASSA-PKCS1-v1_5", hash:"SHA-256"}` from JWK ✔, then `crypto.subtle.verify`.
3. `iss ∈ {"accounts.google.com","https://accounts.google.com"}` ✔.
4. `aud === env.RTDN_AUDIENCE` (non-empty; empty → 503 `NOT_CONFIGURED`).
5. `email === env.RTDN_SA_EMAIL` and `email_verified === true` ✔ (Google's own push sample warns to check both).
6. `iat − 300 ≤ now ≤ exp + 300` and `exp − now < 86 400 s` ✔ (`google-auth-library` skew and lifetime rules).

Any failure → 401. Log `{code:"RTDN_AUTH", reason}`, never the token.

**Body** ✔:
```json
{ "message": { "attributes": {}, "data": "<base64 DeveloperNotification>", "messageId": "136969346945", "publishTime": "…" },
  "subscription": "projects/…/subscriptions/…" }
```
`DeveloperNotification` ✔:
```ts
{ version: string; packageName: string; eventTimeMillis: string | number;   // the docs say long; the example shows a string → accept both
  subscriptionNotification?: { version: string; notificationType: number; purchaseToken: string };
  oneTimeProductNotification?: { version: string; notificationType: number; purchaseToken: string; sku: string };
  voidedPurchaseNotification?: { purchaseToken: string; orderId: string; productType: number; refundType: number };
  testNotification?: { version: string } }
```
(`pendingRefundReviewNotification` exists ✔; v1 ignores it with 204.)

Processing (the zod schema is non-strict; unknown fields are ignored):
1. Unparseable body or data → log `{code:"RTDN_BAD"}` → **204**. It would never succeed, so it must not loop.
2. `rtdnSeen(messageId)` → 204.
3. `packageName !== env.PLAY_PACKAGE_NAME` → 204 + log.
4. Dispatch:
   - `subscriptionNotification`, any `notificationType` (1–13, 17–20, 22 ✔; there is no switch on type, because "call the API to get the full status" ✔): `subscriptionsv2.get(token)` → normalize → `applyPurchase({ callerInstallHash: null, … })` → acknowledge if needed. This covers out-of-app resubscribes ✔, which must be acknowledged server-side within 3 days.
   - `oneTimeProductNotification` (1 `PURCHASED`, 2 `CANCELED` ✔): `productsv2.getproductpurchasev2(token)` → `applyPurchase` → acknowledge if `PURCHASED` and not acknowledged. Only the owner's Play Console choice "Get all notifications for subscriptions and one-time products" ✔ sends these.
   - `voidedPurchaseNotification`:
     - `productType` 2 (one-time ✔) → `markRevoked(hash)`;
     - `productType` 1 (subscription ✔) → `subscriptionsv2.get` + `applyPurchase` (a revocation shows as `EXPIRED` ✔) and **also** `markRevoked` when `refundType === 1` (full refund) ✔.
   - `testNotification` → log `{code:"RTDN_TEST"}`.
   - otherwise → 204.
5. Google failure (429/5xx/timeout/401/403) → **503**, so Pub/Sub redelivers ✔ (a non-2xx response is a nack). A Google 404/410 for the token → ignore → 204.
6. Success → `rtdnMark(messageId)` → 204.

Processing is idempotent (`applyPurchase` ordering by `google_checked_ms`), so a redelivery after a crash between steps 4 and 6 is harmless.

### 3.7 Google API client (`google.ts`)

**Service-account JWT** ✔ (`gtoken` 8.0.0 source):
- Secret `PLAY_SERVICE_ACCOUNT_JSON` (the downloaded key JSON). Read `client_email`, `private_key` (PEM PKCS#8) and `private_key_id`.
- Strip the PEM armour → base64 decode → `crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"])` ✔ (Workers WebCrypto RSASSA-PKCS1-v1_5).
- JWT header `{"alg":"RS256","typ":"JWT","kid":private_key_id}`. Payload:
  ```json
  { "iss": client_email, "scope": "https://www.googleapis.com/auth/androidpublisher", "aud": "https://oauth2.googleapis.com/token", "iat": now_s, "exp": now_s + 3600 }
  ```
  (scope ✔ in the discovery `auth.oauth2.scopes`).
- `POST https://oauth2.googleapis.com/token`, `Content-Type: application/x-www-form-urlencoded`, body `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<jwt>` ✔. Response `{access_token, expires_in, token_type}`.
- **Cache** in module scope per isolate until `iat + expires_in − 300 s`. Concurrent misses share one in-flight promise.

**Calls.** Base `https://androidpublisher.googleapis.com/` ✔ (discovery `rootUrl`). The token is URL-encoded with `encodeURIComponent`.

| Function | Request ✔ | Response |
|---|---|---|
| `getSubscriptionV2(pkg, token)` | `GET androidpublisher/v3/applications/{pkg}/purchases/subscriptionsv2/tokens/{token}` | `SubscriptionPurchaseV2` |
| `getProductV2(pkg, token)` | `GET androidpublisher/v3/applications/{pkg}/purchases/productsv2/tokens/{token}` | `ProductPurchaseV2` |
| `ackSubscription(pkg, token)` | `POST androidpublisher/v3/applications/{pkg}/purchases/subscriptions/premium/tokens/{token}:acknowledge`, body `{}` (✔ `subscriptionId` is still a required path param; "not required/recommended" only for add-ons) | empty |
| `ackProduct(pkg, productId, token)` | `POST androidpublisher/v3/applications/{pkg}/purchases/products/{productId}/tokens/{token}:acknowledge`, body `{}` (productsv2 has no acknowledge method ✔) | empty |
| `listVoided(pkg, {startTimeMs, pageToken})` | `GET androidpublisher/v3/applications/{pkg}/purchases/voidedpurchases?type=1&startTime=<ms>&maxResults=1000[&token=<pageToken>]`. `type=1` includes subscriptions ✔; `startTime` can be at most 30 days back ✔ | `{ voidedPurchases?: VoidedPurchase[], tokenPagination?: { nextPageToken?: string } }` |

The `maxResults=1000` value is [VERIFY] (the server's maximum is undocumented; any accepted value works, because we paginate).

- Every call: `Authorization: Bearer <access_token>`, a 10 s timeout (`AbortController` + `setTimeout`), and one retry after 500 ms on 429/5xx/network errors. A 401 drops the cached access token and retries once.
- `GoogleApi` is an interface; `FakeGoogleApi` implements it. Tests inject `fetch`.

**Fields read** (`google-types.ts`, names verbatim ✔):
- `SubscriptionPurchaseV2`: `subscriptionState`, `acknowledgementState`, `linkedPurchaseToken`, `lineItems[].{productId, expiryTime, autoRenewingPlan.autoRenewEnabled, offerDetails.{basePlanId, offerId}, offerPhase.freeTrial}`, `externalAccountIdentifiers.obfuscatedExternalAccountId`, `outOfAppPurchaseContext.expiredPurchaseToken`, `testPurchase`.
- `ProductPurchaseV2`: `purchaseStateContext.purchaseState`, `acknowledgementState`, `productLineItem[].productId`, `obfuscatedExternalAccountId`, `testPurchaseContext`.
- `VoidedPurchase`: `purchaseToken`, `orderId`, `voidedTimeMillis`.

**`normalize.ts`:**
```ts
export interface NormalizedPurchase {
  kind: "sub" | "pack"; productId: string; state: string; expiryMs: number | null; autoRenew: boolean; basePlanId: string | null;
  inTrial: boolean; acknowledged: boolean; test: boolean; obfuscatedAccountId: string | null;
  linkedPurchaseToken: string | null; outOfAppExpiredPurchaseToken: string | null; checkedMs: number }
```
`acknowledged = acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"`. Test purchases (license testers) are accepted in every mode and flagged `test=1`.

### 3.8 Daily cron (`scheduled`, ✔ handler `(controller: ScheduledController, env, ctx)`, UTC schedule)

`ctx.waitUntil(runDaily(env, controller.scheduledTime))`, google mode only. In fake mode it only prunes.
1. **Voided purchases:**
   - `start = max(now − 30 d + 1 h, cursor − 1 d)`;
   - page through `listVoided`. For each item: `h = sha256hex(purchaseToken)`; `kindOf(h)`:
     - `pack` → `markRevoked`;
     - `sub` → `getSubscriptionV2` + `applyPurchase`;
     - `null` → skip;
   - after the last page → `cursorSet(now)`.

   Subscription orders share one token ✔, so the same token may repeat; this is harmless.
2. **Ack retries:** for each `pendingAcks(now)`, acknowledge; on success → `markAcked`.
3. `prune(now)`.

Local test: `curl "http://localhost:8787/cdn-cgi/local/scheduled"` ✔.

### 3.9 Errors, rate limits, logging
- Logs are JSON with a `code` only, plus counts. Never log tokens, token hashes, install ids or hashes, emails, order ids or JWTs (same rule as SPEC §7.5).
- `INTERNAL` → 500 `{"error":"INTERNAL"}`.
- Limits:
  - IP: `BILLING_LIMITER` 30/min.
  - Install: verify 20 per 10 min, entitlement 60 per 10 min.
  - Room: an `entitlement` WS message goes through the normal message bucket, plus at most 6 per minute per TV connection (more → `RATE_LIMITED`).

### 3.10 FAKE billing mode (dev / e2e only)

`billingMode(env, req)` in `mode.ts` returns `"fake"` **only if all** of these hold:
1. `env.BILLING_MODE === "fake"`;
2. `env.ALLOW_FAKE_BILLING === "1"`;
3. `env.PLAY_SERVICE_ACCOUNT_JSON` is unset or empty;
4. the request host (`new URL(req.url).hostname`) is `localhost`, `127.0.0.1`, `[::1]`, or a private IPv4 (`10/8`, `172.16/12`, `192.168/16`). For `scheduled()` and Room DO checks without a request, condition 4 uses `env.JOIN_BASE_URL`'s host, and an empty `JOIN_BASE_URL` counts as **not** local.

If `BILLING_MODE === "fake"` but any other condition fails → every billing route returns 503 `NOT_CONFIGURED`, and rooms treat every token as invalid (fail closed). Otherwise the mode is `"google"`.

Defence in depth:
- `wrangler.jsonc` ships `BILLING_MODE:"google"`, `ALLOW_FAKE_BILLING:"0"`.
- `tools/dev.mjs` adds `--var BILLING_MODE:fake --var ALLOW_FAKE_BILLING:1`, and C's Playwright `webServer` command adds the same two `--var`s.
- `server/scripts/check-deploy.mjs` runs first in `"deploy"`. It fails if `wrangler.jsonc` vars have `BILLING_MODE !== "google"` or `ALLOW_FAKE_BILLING !== "0"`.
- A unit test asserts that each condition alone disables fake mode.
- In the TV app, the fake gateway exists only in the `debug` source set (§4.8).

**Fake tokens** are deterministic: `fake.<kind>.<productId>.<n>`, where `<n>` is a per-DO counter, for example `fake.sub.premium.1` or `fake.pack.pack_en_food_01.2`.

`FakeGoogleApi` serves a synthetic `SubscriptionPurchaseV2` / `ProductPurchaseV2` from the `fake_purchases` table:
- `obfuscatedExternalAccountId` = the installHash given at fake purchase;
- `acknowledgementState` starts `PENDING`; acks flip it;
- sub `expiryTime` = now + 30 days (`monthly`) or 365 days (`yearly`); `offerPhase.freeTrial` when `offerId === "trial-7d"`.

Routes:
- `POST /api/billing/fake/purchase` `{installId, productId, basePlanId?: "monthly"|"yearly", offerId?: "trial-7d"|null, outcome?: "PURCHASED"|"PENDING"}` → creates the fake row → `{purchaseToken}`. The client then calls `/verify` exactly as in production.
- `POST /api/billing/fake/set` `{purchaseToken, state}`:
  - `state` ∈ `SUB_STATES` for subs, or `PURCHASED|PENDING|CANCELLED|REVOKED` for packs;
  - `"SUBSCRIPTION_STATE_EXPIRED"` also sets `expiryTime = now − 1 s`;
  - the server then runs the **same** code path as an RTDN for that token (`applyPurchase`, and `markRevoked` for `REVOKED`).

### 3.11 Room integration (A: `server/src/access.ts`, `room-core.ts`, `http.ts`, shared engine and projection)

**Create.**
- `CreateRoomRequest` becomes `z.strictObject({ locale: LocaleSchema.optional(), entitlement: z.string().max(3000).optional() })`.
- `createRoom` verifies the token (§2.3) **before** drawing a code:
  - valid → `RoomEntitlement`;
  - invalid or expired → `null`.
- `InitRoomArgs` gains `entitlement: RoomEntitlement | null`.
- `CreateRoomResponse` gains `"entitlement": "NONE" | "OK" | "INVALID"`. The TV refreshes its token when it gets `INVALID`.
- The room is created either way; an invalid token gives a free room.

**Meta.** `RoomMeta` gains `entitlement: RoomEntitlement | null`. A missing field (rooms created before deploy) means `null`.

**Access** (`access.ts`, pure):
```ts
export interface RoomAccess { premium: boolean; packs: ReadonlySet<string>; changesAt: number | null }
export function roomAccess(e: RoomEntitlement | null, nowMs: number): RoomAccess;
//   premium = e && e.expMs > now && e.premiumUntilMs !== null && e.premiumUntilMs > now
//   packs   = e && e.expMs > now ? new Set(e.packs) : ∅
//   changesAt = the earliest future instant among {e.expMs, e.premiumUntilMs} (null if none)
export function playableCatalog(full: Catalog, a: RoomAccess): Catalog;     // packs with tier "free", or premium, or in a.packs
export function lockedPacks(full: Catalog, a: RoomAccess, settings: Settings): LockedPackInfo[];
//   LOBBY only; packs NOT playable, matching settings.wordLocale and packAllowedByAge; metadata only (never pairs)
export function restrictionFor(state: GameState, playable: Catalog, a: RoomAccess): { allowedPackIds: string[]; resetPremiumSettings: boolean } | null;
//   non-null iff LOBBY and (settings.packIds has an id not in playable, or (!a.premium and a premium setting differs from DEFAULT_SETTINGS))
```
`playableCatalog` is memoised per `(fullCatalog, premium, sorted packs)`. **Only the playable catalog is ever passed to `reduce`, `nextWakeAt`, `projectForTv` and `projectForPlayer`.** So words of a locked pack cannot be picked or projected, even with a bug elsewhere.

**Engine additions (A, `shared/src/engine`):**
- `SystemAction` gains `{ type: "RESTRICT_SETTINGS"; allowedPackIds: string[]; resetPremiumSettings: boolean }`.
- Handling: LOBBY only (else `WRONG_PHASE`).
  - `settings.packIds = settings.packIds.filter(id => allowedPackIds.includes(id))`.
  - If `resetPremiumSettings`: for each key in `PREMIUM_SETTING_KEYS`, set it to `DEFAULT_SETTINGS[key]` (deep copy).
  - If nothing changed, return the same object. Otherwise `version + 1`.
- `PREMIUM_SETTING_KEYS` lives in `shared/src/billing/products.ts`, and the engine imports it (no I/O, still pure).

**RoomCore flow:**
- Every serialised entry point computes `now`, `access = roomAccess(meta.entitlement, now)` and `playable`.
- Before handling the message or alarm, and again after any accepted reduce that leaves the phase in LOBBY:
  - if `restrictionFor(...)` is non-null, dispatch `RESTRICT_SETTINGS` as `by: system`;
  - include it in the same persist and broadcast.
- **Alarm:** `at = min(existing, access.changesAt)`, so a lobby downgrades on time even if nobody acts.
- **UPDATE_SETTINGS pre-checks** in RoomCore, before `reduce`. The order matters, so that clients get a precise error:
  1. `patch.packIds` contains an id that exists in the full catalog but is not playable → error `PACK_LOCKED`;
  2. `!access.premium` and the patch changes a `PREMIUM_SETTING_KEYS` key to a value ≠ the current one → error `PREMIUM_REQUIRED`;
  3. otherwise reduce as usual. `INVALID_SETTINGS` still covers unknown ids.
- **Mid-session expiry:**
  - A game that has started keeps its `state.pair` and **finishes normally**; the access change is invisible until the room is back in LOBBY.
  - In LOBBY, the restriction above removes locked pack ids and resets premium settings.
  - The view's `premium` flips at the next broadcast, so the TV and phones update their badges.
  - If the remaining `packIds` filter is empty, it becomes `[]` ("all playable"), and the free starter pack always remains, so START is never blocked by a downgrade alone.
- **Host change:**
  - Entitlement belongs to the **room**, set by the TV. VIP phone changes (`reassignHost`) never touch it.
  - A replacing TV connection (same `tvToken`) keeps it.
  - "New room" on the TV passes the TV's current token again.
- **WS message `entitlement`** (C2S, TV only):
  ```ts
  export const EntitlementMsgSchema = z.strictObject({ v: V, t: z.literal("entitlement"), token: z.string().min(1).max(3000) });
  // ClientMessageSchema = z.discriminatedUnion("t", [Hello, JoinSchema, ActionMsgSchema, EntitlementMsgSchema])
  ```
  - Allowed only when the connection role is `tv` (else `NOT_AUTHENTICATED`).
  - Verify (§2.3). It is accepted if valid, **and** (`meta.entitlement === null` or `sub === meta.entitlement.sub`), **and** `iatMs ≥ meta.entitlement.iatMs`.
  - Accepted (even when the claims are lower, e.g. after a refund) → write `meta.entitlement`, apply the restriction if in LOBBY, persist, broadcast, reschedule.
  - Rejected → `error ENTITLEMENT_INVALID` (non-fatal); the room keeps its current entitlement.
  - No `ref`.
- **New error codes** (`errors.ts`, all non-fatal, no close code):
  - `PREMIUM_REQUIRED` (`error.premiumRequired`)
  - `PACK_LOCKED` (`error.packLocked`)
  - `ENTITLEMENT_INVALID` (`error.entitlementInvalid`)

**View additions** (`PublicView`, every key always present; appended **after** `availablePacks`, in this order):

| Key | Type | Rule |
|---|---|---|
| `premium` | boolean | `access.premium` at projection time |
| `lockedPacks` | `LockedPackInfo[]` | LOBBY only, else `[]`. `{ id, locale, title:{en,fr,ar}, pairCount, ageRating, productId }` (`pairCount` passes the current `difficulties` filter). **No words, no pair ids** |

- `availablePacks` keeps its meaning, and it is now computed from the **playable** catalog. `PackInfo` gains a final key `tier: "free" | "premium"`.
- `PackInfoSchema`, `PublicViewSchema` and Kotlin `PackInfo`/`TvView` are updated (Kotlin: `val premium: Boolean`, `val lockedPacks: List<LockedPackInfo>`, `data class LockedPackInfo(val id: String, val locale: String, val title: LocalizedTitle, val pairCount: Int, val ageRating: String, val productId: String)`, and `PackInfo` gets `val tier: String`).
- **Fixtures (A):** regenerate the G fixtures. Update the V fixture `s2c.state.tv.voting.json` with `"premium": false, "lockedPacks": []` after `availablePacks`. The **free** TEST_CATALOG has one free and one premium pack per language (§7), so `s2c.state.tv.lobby.json` shows a non-empty `lockedPacks`.
- New V fixtures:
  - `c2s.entitlement.json`: `{ "v": 1, "t": "entitlement", "token": "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6ImsxIn0.e30.c2ln" }`
  - `http.create_room.request.json` → `{ "locale": "fr", "entitlement": "<same token>" }`
  - `http.create_room.response.json` gains `"entitlement": "OK"`
  - `http.billing.catalog.response.json`, `http.billing.verify.request.json`, `http.billing.verify.response.json`, `http.billing.entitlement.request.json`, `billing.products.json` (§1.3)

  A writes them from the §3.4 shapes. B decodes `catalog`, `verify.response` and `create_room.response` in `ProtocolFixturesTest`.

**Sim and tests** construct `RoomCore` with an explicit `entitlement` (sim engine mode passes the full catalog, which is equivalent to premium).

---

## 4. TV app (B)

### 4.1 Dependencies, manifest, files
- `libs.versions.toml`: `billing = "9.1.0"` ✔ (docs and release notes) and `play-billing = { group = "com.android.billingclient", name = "billing", version.ref = "billing" }` → `implementation(libs.play.billing)`.
  - Do **not** add `billing-ktx`: wrap the callback APIs with `suspendCancellableCoroutine` yourself, so no unverified ktx signatures are needed.
  - [VERIFY] the artifact resolves on Google Maven (blocked here).
  - PBL 9 sets targetSdk 35 ✔ and minSdk 23 ✔. Ours is 26 / 36, which is fine.
- Manifest:
  - The library merges the `com.android.vending.BILLING` permission [VERIFY in the merged manifest]. Nothing else is needed.
  - Exclude `mishana_billing.xml` from Auto Backup: `android:fullBackupContent`/`dataExtractionRules` XML excluding `sharedpref` `mishana_billing.xml`. Then a restored backup on another TV gets a new installId; restore still works through Play.

Files (`app/src/main/java/app/mishana/tv/`):

| Path | Contents |
|---|---|
| `billing/Products.kt` | §1.3 mirror + `PREMIUM_SETTING_KEYS` |
| `billing/InstallId.kt` | `object InstallId { fun get(ctx): String; fun hash(id): String /* sha256 hex lowercase */ }` |
| `billing/BillingGateway.kt` | interface (below) |
| `billing/PlayBillingGateway.kt` | real implementation |
| `billing/EntitlementApi.kt` | OkHttp client for `/api/billing/{catalog,verify,entitlement}` (IO dispatcher, same timeouts as `RoomApi`) |
| `billing/EntitlementStore.kt` | SharedPreferences `mishana_billing`: `install_id`, `ent_token`, `ent_json` (last `EntitlementBody`), `ent_saved_at` |
| `billing/BillingRepository.kt` | orchestration; `StateFlow<StoreUiState>`; owned by `MishAnaApp`/`ProductionDeps` (process-wide) |
| `billing/BillingErrors.kt` | response code → i18n key (§4.6) |
| `protocol/BillingModels.kt` | kotlinx.serialization mirrors of §3.4 (`CatalogResponse`, `VerifyRequest`, …) and `EntitlementMsg` (`@SerialName("entitlement")` ClientMessage subclass) |
| `ui/screens/StoreScreen.kt` | Store overlay (§4.4) |
| `ui/components/LockBadge.kt` | lock icon + label |
| `src/debug/java/app/mishana/tv/billing/GatewayFactory.kt` | returns `FakeBillingGateway` when `DebugPrefs.fakeBilling`, else `PlayBillingGateway` |
| `src/debug/java/app/mishana/tv/billing/FakeBillingGateway.kt` | §4.8 |
| `src/release/java/app/mishana/tv/billing/GatewayFactory.kt` | always `PlayBillingGateway` |

```kotlin
interface BillingGateway {
  val purchaseUpdates: SharedFlow<PurchaseUpdate>               // from PurchasesUpdatedListener
  suspend fun connect(): GatewayResult<Unit>
  suspend fun queryProducts(subIds: List<String>, inappIds: List<String>): GatewayResult<ProductsSnapshot>
  suspend fun queryOwned(): GatewayResult<List<OwnedPurchase>>  // SUBS + INAPP, PURCHASED or PENDING
  fun launch(activity: Activity, offer: PurchasableOffer, obfuscatedAccountId: String): GatewayResult<Unit>
  fun end()
}
data class OwnedPurchase(val productId: String, val purchaseToken: String, val state: OwnedState /* PURCHASED, PENDING */, val suspended: Boolean)
sealed interface GatewayResult<out T> { data class Ok<T>(val value: T) : GatewayResult<T>; data class Err(val code: Int, val sub: Int?) : GatewayResult<Nothing> }
```

### 4.2 BillingClient lifecycle (`PlayBillingGateway`; every API below ✔ on developer.android.com, PBL 9.1.0)
- **One** client per process:
  ```kotlin
  BillingClient.newBuilder(appContext)
    .setListener(listener)
    .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
    .enableAutoServiceReconnection()
    .build()
  ```
  (The no-arg `enablePendingPurchases()` was removed in 8.0 ✔.)
- `connect()`:
  - `startConnection(BillingClientStateListener)`: `onBillingSetupFinished(result)`; `onBillingServiceDisconnected()` is a no-op apart from state, because auto-reconnect is enabled ✔.
  - If setup fails with `SERVICE_UNAVAILABLE`/`SERVICE_DISCONNECTED`/`ERROR`/`NETWORK_ERROR`, retry with `ReconnectPolicy.delayMs(attempt)` up to 5 times, then expose `StoreUiState.Unavailable`.
  - `BILLING_UNAVAILABLE` (3) is terminal for this session (no Play Store, or a blocked Play Store ✔ PBL 9 mapping).
- Connect on app start (`MainActivity.onCreate` → repository `start()`) and in `onStart` when not ready. Keep the connection for the whole process; the docs recommend an active connection while in the foreground ✔. Call `endConnection()` only in `MainActivity.onDestroy` when `isFinishing`.
- **Products:**
  - `queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), listener)`, one `Product` per id built with `QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.SUBS | INAPP).build()`.
  - Make **two calls** (one SUBS, one INAPP); mixing types in one params object is [VERIFY], so avoid it.
  - Listener: `onProductDetailsResponse(BillingResult, QueryProductDetailsResult)` → `productDetailsList` + `unfetchedProductList` (`statusCode` `PRODUCT_NOT_FOUND` = 3, `NO_ELIGIBLE_OFFER` = 4 ✔).
  - Do **not** cache `ProductDetails` across store openings ✔ (stale objects make `launchBillingFlow` fail).
- **Offers:**
  - Subscription → `productDetails.subscriptionOfferDetails` (list). For each base plan id in `BASE_PLAN_IDS`:
    - trial offer = the entry with `basePlanId == id && offerId == TRIAL_OFFER_ID` (present only if the user is eligible: Play returns user-eligible offers);
    - base offer = the entry with `basePlanId == id && offerId == null`.
    - Price text = `pricingPhases.pricingPhaseList.last().formattedPrice`. Period = `billingPeriod` (ISO 8601: `P1M` → month, `P1Y` → year ✔).
    - Trial days come from the first phase with `priceAmountMicros == 0L`: parse `billingPeriod` `P{n}D`/`P{n}W` (7 × n).
  - One-time → `productDetails.oneTimePurchaseOfferDetails` (single offer). `oneTimePurchaseOfferDetailsList` is non-null **only** with multiple offers ✔, so use `oneTimePurchaseOfferDetailsList?.firstOrNull() ?: oneTimePurchaseOfferDetails`. Price = `formattedPrice`, token = `offerToken`.
- **Launch (main thread):**
  ```kotlin
  BillingFlowParams.newBuilder()
    .setProductDetailsParamsList(listOf(BillingFlowParams.ProductDetailsParams.newBuilder()
        .setProductDetails(pd).setOfferToken(offerToken).build()))
    .setObfuscatedAccountId(InstallId.hash(installId))
    .build()
  ```
  Then `launchBillingFlow(activity, params)` returns a `BillingResult`; non-OK is mapped with §4.6. Subscription choice:
  - trial offer token if present;
  - else the base offer token.
  - No `setSubscriptionUpdateParams` in v1: an existing subscriber never sees plan buttons (§4.4).
- **`onPurchasesUpdated(result, purchases)`:**
  - `OK` → for each purchase: `purchaseState == PURCHASED` → verify; `PENDING` → `StoreUiState.pending += productIds`;
  - `USER_CANCELED` → silent;
  - `ITEM_ALREADY_OWNED` → run restore;
  - others → toast (§4.6).
- **Restore:**
  - `queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(SUBS)[.includeSuspendedSubscriptions(true)].build(), listener)` and the same for `INAPP` ✔. Listener: `onQueryPurchasesResponse(BillingResult, List<Purchase>)`.
  - Call `includeSuspendedSubscriptions(true)` only when `isFeatureSupported(BillingClient.FeatureType.INCLUDE_SUSPENDED_SUBSCRIPTIONS).responseCode == OK` ✔.
  - Read `purchase.products`, `purchaseToken`, `purchaseState`, `isSuspended` ✔.
  - Suspended subs are **not** posted. They set `StoreUiState.subscriptionSuspended = true`, which shows `store.onHold`.
- **Acknowledgement:** the **server** acknowledges (§3.4). The TV never calls `acknowledgePurchase`. An unacknowledged purchase stays in `queryPurchasesAsync` until the server acks it, so the next launch reposts it. That is the retry.
- **Verify call:**
  - `EntitlementApi.verify(installId, purchases)`, at most 20 per call; chunk if more.
  - On HTTP or network failure, keep the purchases in memory and retry with backoff (1 s → 10 min cap) while the app is in the foreground. Show `store.verifyFailed` once.
  - On success: `EntitlementStore.save(...)`; if in a room, send `EntitlementMsg(token)`; on a newly granted product, show the toast `store.unlocked`.

### 4.3 Room creation and the token
- `RoomApi.createRoom(baseUrl, locale, entitlement: String?)` sends `CreateRoomRequest(locale, entitlement)`. `CreateRoomRequest` gains `val entitlement: String? = null`; the encoder omits nulls.
- The token is sent only when `EntitlementStore.token` exists and `expiresAt > now + 60 s`.
- Response `entitlement == "INVALID"` → trigger a refresh (§2.4). The refresh then sends `EntitlementMsg`.
- `GameViewModel` gains:
  - `fun sendEntitlement(token: String)`, which sends only when `conn == OPEN` and otherwise queues one pending token to send after the next `welcome`/first `state` following `hello`;
  - a collector on `BillingRepository.entitlement` that calls it.
- Keep `RoomSocket` message handling unchanged otherwise. Add the `ErrorMsg` codes `PREMIUM_REQUIRED`, `PACK_LOCKED` and `ENTITLEMENT_INVALID` to the toast handling (keys via `I18nKeys`).

### 4.4 Store screen and paywall entry points (remote only)

The Store is an overlay in `InRoom` (`TvUiState.InRoom.store: StoreEntry?`, `data class StoreEntry(val focusProductId: String?)`).
- It opens **only in LOBBY**. If the phase leaves LOBBY while it is open, close it.
- **Back** closes it and returns focus to the element that opened it (remember that element's `FocusRequester`).

Entry points:
1. **Lobby bottom bar:** a new button `lobby.premium` with a crown icon, placed between Language and Start. When `view.premium`, it shows `lobby.premiumRoom` and still opens the Store (manage, restore). `focusProductId = null` puts the initial focus on the yearly plan button (or Manage when premium).
2. **Settings → Words → Packs sub-panel:** the playable packs (`availablePacks`) appear as today. Below a divider, `lockedPacks` rows show a `LockBadge`, the title, `store.packPairs` and `settings.unlockHint`. OK on a locked row → Store with `focusProductId = lockedPack.productId`.
3. **Settings → Game → Points rows** (each `PREMIUM_SETTING_KEYS` row) when `!view.premium`: the row shows `LockBadge` + `settings.premiumOnly`; Left/Right do nothing; OK opens the Store with `focusProductId = "premium"`.
4. **Error `PREMIUM_REQUIRED` / `PACK_LOCKED`** received while in Settings: toast with the error text. The TV does not auto-open the Store.

Layout (960×540 dp canvas, 48/27 dp safe margins; DESIGN tokens). Header `store.title`, footer hint "Back".

| Column (start side, 40%) | Column (end side, 60%) |
|---|---|
| **Premium card**: `store.premiumTitle`, `store.premiumPitch`. **Not premium:** two plan buttons (`store.planYearly` first, then `store.planMonthly`), each with price text `store.pricePerYear`/`store.pricePerMonth` and, if a trial offer exists, the badge `store.trialDays` (plural, `{count}` = trial days); primary label `store.startTrial` (trial) or `store.subscribe`. The legal block (§4.5) sits under the buttons and always shows the **focused** plan's values. **Premium:** `store.premiumActive`, `store.renewsOn`/`store.endsOn` (from `subscription.autoRenewing`), button `store.manage` | **Packs list** (`LazyColumn`, `focusRestorer()`), from `CatalogResponse.packs` filtered to the room's `settings.wordLocale` language first, then the other languages under the heading `store.otherLanguages`. Row: title (in the UI locale), `store.packPairs`, then the trailing state: `store.owned` / `store.included` (premium active) / `store.pending` chip / Buy button `store.buy` (`{price}`) / nothing (product not fetched) |
| Below: `store.restore` (button) | — |

Focus and D-pad:
- The initial focus follows `focusProductId`: `"premium"` → yearly plan; a pack product id → that row; `null` → yearly plan or Manage.
- Up/Down move within a column; Right (LTR) / Left (RTL) cross columns (Compose geometry); OK activates.
- Rows without a Buy button stay focusable and announce their state. OK on them does nothing.
- No element needs a Menu key or long-press.

While a purchase is in flight:
- the Play purchase sheet covers the app ✔ ("the system displays the Google Play purchase screen");
- on return, the button the user started from shows a spinner and `store.confirming` until `/verify` answers, at most 15 s, after which it shows `store.verifyFailed` and keeps retrying in the background.

PENDING purchases:
- the row or plan shows the chip `store.pending`, plus the body `store.pendingBody` under the legal block;
- no access is granted;
- when the payment completes, `onPurchasesUpdated` fires again (if running) or the next launch restore picks it up ✔.

### 4.5 Required subscription disclosure (shown next to the plan buttons, always visible, never behind a "more" link)

Values come from the focused plan's `ProductDetails` (`formattedPrice`, period, trial days). Show all of:
1. `store.legalPrice`: "{price} per {period}, billed to your Google Play account." (`{period}` = `store.periodMonth`/`store.periodYear`)
2. If a trial offer exists, `store.legalTrial`: "Free for {days} days, then {price} per {period}. Cancel before the trial ends and you won't be charged."
3. `store.legalRenew`: "Renews automatically until you cancel."
4. `store.legalCancel`: "Cancel anytime in Google Play › Payments & subscriptions › Subscriptions."

This matches the Play subscriptions policy items: price, period, trial terms, auto-renewal, how to cancel. [VERIFY the current policy wording in Play Console → Policy; support.google.com is blocked here.]

**Manage subscription link** ✔ (developer.android.com/google/play/billing/subscriptions):
```
https://play.google.com/store/account/subscriptions?sku=premium&package=app.mishana.tv
```
- Open it with `Intent(Intent.ACTION_VIEW, Uri.parse(url))`.
- On `ActivityNotFoundException`, or if nothing resolves, show a dialog with the text `store.manageHint`: no QR code and no URL to type. [VERIFY on a real Google TV that the Play Store handles this link; if it does not, the dialog is the fallback.]
- Show the link only when the subscription is not expired (premium active, or state ON_HOLD/PAUSED, for fixing payment) ✔ ("for non-expired subscriptions").

### 4.6 Error mapping (`BillingErrors.kt`; codes ✔ `BillingClient.BillingResponseCode`)

| Code | UI |
|---|---|
| `OK` (0) | — |
| `USER_CANCELED` (1) | nothing |
| `SERVICE_UNAVAILABLE` (2), `NETWORK_ERROR` (12), `SERVICE_DISCONNECTED` (−1) | toast `store.network` |
| `BILLING_UNAVAILABLE` (3) | Store body replaced by `store.playUnavailable` |
| `ITEM_UNAVAILABLE` (4) | toast `store.itemUnavailable` |
| `DEVELOPER_ERROR` (5), `ERROR` (6), `FEATURE_NOT_SUPPORTED` (−2) | toast `store.errorGeneric` (+ `Log.w` with the code, debug builds only) |
| `ITEM_ALREADY_OWNED` (7) | toast `store.alreadyOwned` + restore |
| `ITEM_NOT_OWNED` (8) | `store.errorGeneric` |
| Server `UPSTREAM_ERROR`/HTTP 5xx | `store.verifyFailed` (auto retry) |
| Server `INSTALL_LIMIT` | `store.installLimit` |
| Server `RATE_LIMITED` | `error.rateLimited` |

`launchBillingFlow` sub-response codes (PBL 8 ✔: `PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS`, `USER_INELIGIBLE`) → `store.errorGeneric`; v1 does not specialise them.

### 4.7 i18n keys (A adds them to `shared/i18n/{en,fr,ar}.json` and regenerates the Android strings)

FR uses *vous* on TV-only keys and *tu* on phone-only keys, with U+202F before `! ? : ;`. AR drafts follow DESIGN's Levantine tone; the owner reviews them.

| Key | EN | FR | AR |
|---|---|---|---|
| `lobby.premium` | Premium | Premium | بريميوم |
| `lobby.premiumRoom` | Premium room | Partie Premium | غرفة بريميوم |
| `store.title` | Premium & word packs | Premium et packs de mots | بريميوم وباقات كلمات |
| `store.premiumTitle` | Premium | Premium | بريميوم |
| `store.premiumPitch` | Every word pack, including new ones, plus custom scoring. | Tous les packs de mots, y compris les nouveaux, et les points personnalisés. | كل باقات الكلمات، حتى الجديدة، مع نقاط على ذوقكن. |
| `store.planMonthly` | Monthly | Mensuel | شهري |
| `store.planYearly` | Yearly | Annuel | سنوي |
| `store.pricePerMonth` | {price} / month | {price} / mois | {price} بالشهر |
| `store.pricePerYear` | {price} / year | {price} / an | {price} بالسنة |
| `store.trialDays` (P) | one/other: {count}-day free trial | one/other: {count} jours d'essai gratuit | zero/one/two/few/many/other: تجربة مجانية {count} يوم (AR forms: one "تجربة مجانية يوم واحد", two "تجربة مجانية يومين", few "تجربة مجانية {count} أيام") |
| `store.startTrial` | Start free trial | Commencer l'essai gratuit | ابدأ التجربة المجانية |
| `store.subscribe` | Subscribe | S'abonner | اشترك |
| `store.premiumActive` | Premium is on | Premium est activé | البريميوم شغّال |
| `store.renewsOn` | Renews on {date} | Renouvellement le {date} | بيتجدد بـ {date} |
| `store.endsOn` | Ends on {date} | Se termine le {date} | بيخلص بـ {date} |
| `store.manage` | Manage subscription | Gérer l'abonnement | إدارة الاشتراك |
| `store.manageHint` | On any device: Google Play › Profile › Payments & subscriptions › Subscriptions. | Sur n'importe quel appareil : Google Play › Profil › Paiements et abonnements › Abonnements. | من أي جهاز: Google Play › الحساب › الدفع والاشتراكات › الاشتراكات. |
| `store.packsTitle` | Word packs | Packs de mots | باقات الكلمات |
| `store.otherLanguages` | Other languages | Autres langues | لغات تانية |
| `store.packPairs` (P) | one: {count} word pair / other: {count} word pairs | one: {count} paire de mots / other: {count} paires de mots | zero/one/two/few/many/other drafts (other: "{count} زوج كلمات") |
| `store.buy` | Buy · {price} | Acheter · {price} | اشتري · {price} |
| `store.owned` | Owned | Acheté | مشترى |
| `store.included` | Included with Premium | Inclus dans Premium | ضمن البريميوم |
| `store.pending` | Payment pending | Paiement en attente | الدفع معلّق |
| `store.pendingBody` | It unlocks as soon as Google Play confirms the payment. | Il se débloque dès que Google Play confirme le paiement. | بيفتح أول ما Google Play يأكد الدفع. |
| `store.confirming` | Confirming… | Confirmation… | عم نأكد… |
| `store.unlocked` | Unlocked! Have fun. | Débloqué ! Amusez-vous bien. | انفتح! انبسطوا. |
| `store.restore` | Restore purchases | Restaurer les achats | استرجاع المشتريات |
| `store.restored` | Purchases restored | Achats restaurés | رجعت المشتريات |
| `store.nothingToRestore` | No purchases found on this Google account | Aucun achat trouvé sur ce compte Google | ما في مشتريات على حساب Google هيدا |
| `store.loading` | Loading the store… | Chargement de la boutique… | عم يحمّل المتجر… |
| `store.unavailable` | The store isn't available right now. Try again later. | La boutique n'est pas disponible. Réessayez plus tard. | المتجر مش متاح هلّق. جرّبوا بعدين. |
| `store.playUnavailable` | Google Play isn't available on this TV. | Google Play n'est pas disponible sur ce téléviseur. | Google Play مش متاح عهالتلفزيون. |
| `store.network` | Can't reach Google Play. Check the connection. | Impossible de joindre Google Play. Vérifiez la connexion. | ما عم نوصل لـ Google Play. شيكوا عالإنترنت. |
| `store.itemUnavailable` | This item isn't available in your country yet. | Cet article n'est pas encore disponible dans votre pays. | هالشي مش متاح ببلدكن بعد. |
| `store.errorGeneric` | The purchase didn't go through. You weren't charged. | L'achat n'a pas abouti. Vous n'avez pas été débité. | الشرا ما مشي. ما انخصم شي. |
| `store.alreadyOwned` | You already own this. Restoring… | Vous l'avez déjà. Restauration… | هيدا معكن من قبل. عم نرجّعه… |
| `store.verifyFailed` | Purchase received. We'll finish unlocking it shortly. | Achat reçu. Le déblocage se termine dans un instant. | وصل الشرا. رح نخلّص الفتح بعد شوي. |
| `store.installLimit` | This purchase is already used on too many TVs. | Cet achat est déjà utilisé sur trop de téléviseurs. | هالشرا مستعمل على تلفزيونات كتير. |
| `store.onHold` | Premium is paused: there's a payment problem. Fix it in Google Play. | Premium est suspendu : problème de paiement. Corrigez-le dans Google Play. | البريميوم موقّف: في مشكلة بالدفع. صلّحوها بـ Google Play. |
| `store.legalPrice` | {price} per {period}, billed to your Google Play account. | {price} par {period}, facturé sur votre compte Google Play. | {price} كل {period}، عحساب Google Play تبعكن. |
| `store.legalTrial` | Free for {days} days, then {price} per {period}. Cancel before the trial ends and you won't be charged. | Gratuit pendant {days} jours, puis {price} par {period}. Annulez avant la fin de l'essai pour ne rien payer. | مجاني {days} أيام، بعدين {price} كل {period}. إذا لغيتوا قبل ما تخلص التجربة ما بينخصم شي. |
| `store.legalRenew` | Renews automatically until you cancel. | Renouvellement automatique jusqu'à résiliation. | بيتجدد لحاله لحتى تلغوا. |
| `store.legalCancel` | Cancel anytime in Google Play › Payments & subscriptions › Subscriptions. | Résiliez à tout moment dans Google Play › Paiements et abonnements › Abonnements. | فيكن تلغوا أي وقت من Google Play › الدفع والاشتراكات › الاشتراكات. |
| `store.periodMonth` | month | mois | شهر |
| `store.periodYear` | year | an | سنة |
| `store.testMode` | Test store: no real payments | Boutique de test : aucun paiement réel | متجر تجريبي: ما في دفع حقيقي |
| `settings.locked` | Locked | Verrouillé | مقفول |
| `settings.premiumOnly` | Premium | Premium | بريميوم |
| `settings.unlockHint` | Press OK to unlock | Appuyez sur OK pour débloquer | كبسوا OK لتفتحوه |
| `settings.unlockOnTv` | Unlock on the TV | Débloque-le sur la télé | افتحه من التلفزيون |
| `settings.lockedPacks` | More packs | Plus de packs | باقات زيادة |
| `error.premiumRequired` | This needs Premium. Unlock it on the TV. | Il faut Premium. Débloque-le sur la télé. | بدها بريميوم. افتحها من التلفزيون. |
| `error.packLocked` | This pack is locked. Unlock it on the TV. | Ce pack est verrouillé. Débloque-le sur la télé. | هالباقة مقفولة. افتحها من التلفزيون. |
| `error.entitlementInvalid` | Couldn't check purchases. Free packs still work. | Impossible de vérifier les achats. Les packs gratuits marchent toujours. | ما قدرنا نتأكد من المشتريات. الباقات المجانية شغالة. |

`{date}` is formatted on the client: Kotlin `DateFormat.getDateInstance(DateFormat.MEDIUM, locale)`, or `Intl.DateTimeFormat(locale, {dateStyle:"medium"})` on web with `numberingSystem: "latn"`. `{days}` is a plain string. `{price}` is Play's `formattedPrice`, verbatim.

### 4.8 DebugSettings and fake billing (debug builds only)
- `DebugSettingsScreen` gains the toggle `Billing: Google Play / Fake (server test store)`, stored as `DebugPrefs.fakeBilling`.
- `FakeBillingGateway` (debug source set):
  - `queryProducts` returns synthetic products from `CatalogResponse` with prices "$4.99"/"$29.99"/"$1.99" and a trial offer;
  - `launch` shows a remote-friendly confirm dialog ("Fake purchase: Approve / Pending / Cancel / Error"), then calls `POST /api/billing/fake/purchase` and emits a `PurchaseUpdate` with the fake token;
  - `queryOwned` returns the tokens remembered in debug prefs.
- The Store shows the banner `store.testMode`.
- In fake mode the server must run with fake billing (`pnpm dev`). If `/api/billing/catalog` says `mode:"google"`, the Fake toggle shows "Server is in Google mode" and is ignored.

### 4.9 TV tests (B; JVM unit tests; also run in the pure-Kotlin harness `scratchpad/tv-verify` where possible, since Gradle cannot run here)
- `ProductsTest` (fixture `billing.products.json`).
- `OfferSelectionTest`: given synthetic offer lists (trial present or absent, ineligible) → the chosen offer token, trial days from `P7D`/`P1W`, period from `P1M`/`P1Y`.
- `BillingErrorsTest`: every row of §4.6.
- `EntitlementApiTest` (MockWebServer): verify request body shape, response decoding, `INSTALL_LIMIT`.
- `ProtocolFixturesTest` additions: the new view keys, `c2s.entitlement.json` encode-compare, and the billing HTTP fixtures.
- `BillingRepositoryTest`, with a fake gateway and fake API:
  - restore on start posts all purchases and saves the token;
  - pending purchases are not posted as owned;
  - a refresh while in a room emits `sendEntitlement`;
  - a refresh failure keeps the old token and backs off.
- `StoreFocusTest` (pure model): the initial focus target for each `StoreEntry`; Back returns to the opener.

---

## 5. Phone + `/tv` mock (C)

### 5.1 Phone (never a buy button, never a price)
- **Settings → Packs** (VIP phone):
  - the playable `availablePacks` are toggleable as today;
  - under `settings.lockedPacks`, list `view.lockedPacks` as disabled rows: lock icon, localized title, `store.packPairs`, and the trailing text `settings.unlockOnTv`;
  - a tap shows the 3 s toast `error.packLocked`;
  - no prices, no product ids shown, no links.
- **Settings → Points** rows when `!view.premium`: disabled steppers + lock + `settings.unlockOnTv`; a tap → toast `error.premiumRequired`.
- **Lobby:** a small chip `lobby.premiumRoom` near the room header when `view.premium`.
- **Errors** `PREMIUM_REQUIRED`, `PACK_LOCKED`, `ENTITLEMENT_INVALID` → toasts (`t(messageKey)`), non-fatal (SPEC §6.4 client rule unchanged).
- **Budget:** the phone bundle stays ≤ 60 KB gzip. The store code lives only in the lazy `tv-mock` chunk.
- **Types:** `LockedPackInfo`, `premium` and the `PackInfo.tier` key come from `@mishana/shared/protocol` (`import type`).

### 5.2 `/tv` mock store (fake billing)
- On load, `GET /api/billing/catalog`. With `mode:"google"`, the mock shows the `lobby.premium` button, and its dialog says "Purchases are available in the Android TV app": no store. With `mode:"fake"`, the full simulation below.
- `installId`: localStorage `mishana:installId` (32 hex from `crypto.getRandomValues`; try/catch rules of SPEC §8.6).
- The mock follows §4.4 (entry points, layout, focus with the keyboard D-pad: arrows, Enter, Esc) using the same keys, with the banner `store.testMode`. Plan and pack buttons call:
  1. `POST /api/billing/fake/purchase` (`basePlanId`, and `offerId: "trial-7d"` on the plan buttons);
  2. `POST /api/billing/verify`;
  3. store the token in memory and localStorage `mishana:entToken`;
  4. send `{"v":1,"t":"entitlement","token":…}` on the TV socket.
- Room creation sends `entitlement` in `POST /api/rooms` when a token exists.
- **Debug-only controls** in the mock store, visible only in fake mode, under a "Test controls" heading:
  - "Expire Premium now": `POST /api/billing/fake/set {purchaseToken, state:"SUBSCRIPTION_STATE_EXPIRED"}`, then `/api/billing/entitlement`, then send `entitlement`;
  - "Refund pack": same, with `state:"REVOKED"`.
- The mock reproduces §2.4 refresh rules 1, 3 and 4 (timer).

### 5.3 E2E (C, Playwright, `web-client/e2e/payments.spec.ts`)
- `webServer.command` adds `--var BILLING_MODE:fake --var ALLOW_FAKE_BILLING:1`. Existing specs keep passing.
- Tests:
  1. **Free room cannot get premium packs.** The TV mock creates a room with no token. 4 phones join. A phone VIP opens Settings: `lockedPacks` is non-empty and has no Buy buttons. Sending `UPDATE_SETTINGS {packIds:["en-food-01"]}` via the page's socket → error `PACK_LOCKED`. Play 3 games; every TV and phone WS frame (collected with `page.on("websocket")`) contains no word from any premium pack. The test reads the premium words from `word-packs/packs/**/*.json` with `tier` ≠ free.
  2. **Purchase → premium → premium pack plays.** In the TV mock store, buy `premium` yearly (trial) with the D-pad only. `view.premium` becomes true without a new room; `lockedPacks` is `[]`. Select `en-food-01` only, start, and assert that the RESULTS `result.pack.id === "en-food-01"`.
  3. **Single pack purchase.** Buy `pack_en_food_01` in a fresh free room. Only that pack unlocks; others stay locked.
  4. **Expiry fallback.** In a premium room with `packIds:["en-food-01"]` and custom points, start a game, then "Expire Premium now" mid-game. The game continues to RESULTS with the same pack. After PLAY_AGAIN (lobby): `premium:false`, `packIds:[]`, points at the defaults, and START works with the free pack.
  5. **Fake mode refused off-LAN** (request-level): call `/api/billing/fake/purchase` with `Host: example.com` via `request.post(..., {headers})` → 404 or 503. (A's unit test is the primary guard; this is a smoke test.)

---

## 6. Security & abuse

### 6.1 Threats and mitigations

| Threat | Mitigation |
|---|---|
| Modded APK unlocks packs | Words live on the server. Rooms get only the playable catalog (§3.11). A client cannot request words. |
| Forged entitlement token | Ed25519 signature with a server-only key. Short TTL. `kid`/`alg`/`typ` pinned. Fake key rejected outside fake mode. |
| Forged purchase token | Every token is checked with Google (package taken from the URL path, product id matched). Unknown → `INVALID`. |
| Token replay or sharing across devices | **Policy:** one Google purchase may unlock **up to 10 TVs** (active in 60 days). This covers a household with several TVs on the same Google account (restore is legitimate and required ✔). Beyond that → `INSTALL_LIMIT`. Entitlement tokens are bound to `sub = installHash`; a room only accepts a token whose `sub` matches the room's current sub. A copied entitlement token works for at most 24 h on rooms created with it; that is accepted risk. |
| Stolen installId | It is a 128-bit secret on the TV only; the server stores only its hash. Worst case: someone gets that TV's entitlement. |
| Refund or chargeback | RTDN `voidedPurchaseNotification` → immediate revoke. The daily voided-purchases cron is a backup. Rooms drop access within 24 h at most (token TTL), or immediately on the TV's next refresh. |
| RTDN spoofing | OIDC JWT verified (signature, iss, aud, email, email_verified, time). Package name checked. Every notification is re-read from Google, never trusted as state. |
| Replay of RTDN | `messageId` dedupe and idempotent upserts. |
| API abuse | IP and install rate limits (§3.9), body caps, strict zod schemas. |
| Fake mode in production | Five independent conditions (§3.10) plus a deploy check. |
| Secret leakage in logs | Logging rules (§3.9). |

### 6.2 Workers secrets (`wrangler secret put <NAME>`)

| Secret | Content |
|---|---|
| `PLAY_SERVICE_ACCOUNT_JSON` | Full JSON key of the Play API service account |
| `ENTITLEMENT_KEYS` | §2.3 JSON |

Non-secret vars: `PLAY_PACKAGE_NAME`, `RTDN_AUDIENCE`, `RTDN_SA_EMAIL`, `BILLING_MODE`, `ALLOW_FAKE_BILLING`.

Local dev (fake) needs no secrets. Local Google-mode testing uses `server/.dev.vars` ✔ (git-ignored; A adds `.dev.vars*` to `.gitignore`).

### 6.3 Privacy (feeds PRIVACY.md at M5 and the Play **Data safety** form)

**Stored**, in the Billing DO only:
- SHA-256 of purchase tokens;
- SHA-256 of install ids;
- product id, state, expiry, ack and revoke flags, test flag;
- binding timestamps;
- RTDN message ids (30 days);
- raw purchase tokens only while unacknowledged (≤ 4 days).

**Not stored:**
- names, emails, Google account ids, order ids, prices, region codes, IPs (the rate limiter uses the IP transiently, as today), `subscribeWithGoogleInfo`, cancel-survey answers.

**Retention:**
- bindings: 400 days after last seen;
- dead purchases: 400 days after expiry, revocation or supersession;
- RTDN ids: 30 days.

Play Data safety declares "Purchase history" as collected, not shared, for app functionality, encrypted in transit [VERIFY the category names in Play Console].

### 6.4 Refund and chargeback
- Full refund of a pack → `revoked=1` → the pack disappears from the next token.
- A refunded subscription is revoked by Google → `EXPIRED` → premium ends.
- A partial refund of a renewal order (subscription `refundType=2` is impossible, since it applies to multi-quantity only ✔) → re-read from Google; access follows the state.
- Voluntary refunds by the owner in Play Console flow through the same RTDN.

---

## 7. Tests

### 7.1 shared (A)

| File | Covers |
|---|---|
| `billing/products.test.ts` | `packProductId`/`packIdFromProductId` round trip for every shipped pack; rejects `pack_`, `pack_A`, `premium`; `PRODUCT_ID_REGEX`; `billing.products.json` fixture |
| `billing/entitlement.test.ts` | §2.2 table: every state × (expiry past/future) × autoRenew × revoked; slack applied only to ACTIVE+autoRenew and IN_GRACE |
| `packs/schema.test.ts` | `tier` defaults to premium; strict object still rejects unknown keys |
| `engine/restrict.test.ts` | RESTRICT_SETTINGS: LOBBY only; same object when nothing changes; premium keys reset to the defaults; packIds filtered |
| `projection/leak.test.ts` (extend) | **Premium leak test:** a synthetic catalog with free tokens `zzfree0001…` and premium tokens `zzprem0001…`. Run 1,000 seeded sim games through a **free** RoomAccess (playable catalog) with settings `packIds: []`. At every step, `JSON.stringify` of the TV view and of every player view contains **no** `zzprem` token, and `lockedPacks` items have exactly the keys `id, locale, title, pairCount, ageRating, productId` |
| `protocol/fixtures.test.ts` | the new fixtures parse (`EntitlementMsgSchema`, the billing HTTP schemas, the updated views) |
| `i18n/keys.test.ts` | the new keys exist in all three locales with matching placeholders; `error.*` exists for the 3 new codes |

`TEST_CATALOG` (`shared/src/testing/test-catalog.ts`): every language gets one `tier:"free"` and one `tier:"premium"` pack. Existing tests that need all packs pass a premium `RoomAccess` (or the full catalog).

### 7.2 server (A)

| File | Covers |
|---|---|
| `billing/token.test.ts` | sign → verify round trip; wrong kid, alg, typ; tampered payload or signature; `exp` past; `iat` in the future (>300 s); length > 3000; kid `fake` rejected unless fake; rotation (verify old kid, sign new) |
| `billing/google.test.ts` | mocked `fetch`: JWT claims exactly as in §3.7 (decode the assertion, verify the RS256 signature with the generated test key pair); form body; token cached until `expires_in − 300`; one in-flight request; 401 → refresh + retry; 5xx → one retry; URLs for get/ack/voided with an encoded token; voided pagination |
| `billing/normalize.test.ts` | samples built from ✔ doc examples: new sub (trial, ack pending), grace, canceled-future, revoked → EXPIRED, linked token, out-of-app resubscribe; product PURCHASED/PENDING/CANCELLED, test purchase |
| `billing/pubsub-auth.test.ts` | locally generated RSA JWKS served by mocked fetch: valid; wrong aud, iss, email; `email_verified:false`; expired; unknown kid triggers one refetch; missing header → 401 |
| `billing/rtdn.test.ts` | parse (string and number `eventTimeMillis`); dedupe; package mismatch → 204; sub notification → get + apply + ack; one-time; voided product → revoked; voided sub with full refund; test notification; Google 503 → 503 and no `rtdnMark`; garbage → 204 |
| `billing/billing-core.test.ts` | SQL against `node:sqlite` (Node 22.22 ships `node:sqlite` [VERIFY flag-free in 22.22; else use a small in-memory `SqlLike` fake]): apply/bind; `INSTALL_LIMIT` at 11; stale `checkedMs` ignored; linked token supersedes and copies bindings; `entitlementFor` premium/packs; prune retention; `pendingAcks` |
| `billing/routes.test.ts` | verify happy path (sub + pack) with FakeGoogleApi; `UPSTREAM_ERROR` keeps 200; bad body 400; rate limit 429; catalog lists premium packs only; entitlement for an unknown install = free |
| `billing/mode.test.ts` | fake mode on only when all 4 conditions hold; each single failure → google or `NOT_CONFIGURED`; `check-deploy.mjs` rejects non-google vars |
| `billing/cron.test.ts` | voided window and cursor; sub vs pack handling; ack retries |
| `access.test.ts` | `roomAccess` time edges; `playableCatalog`; `lockedPacks` metadata-only; `restrictionFor` |
| `room-core.access.test.ts` | createRoom with valid, invalid or no token; `entitlement` WS message from a player → `NOT_AUTHENTICATED`; sub mismatch / older iat → `ENTITLEMENT_INVALID`; upgrade mid-lobby broadcasts `premium:true`; `PACK_LOCKED`/`PREMIUM_REQUIRED` pre-checks; **expiry mid-game: the game finishes with its pair, the restriction applies in LOBBY**; alarm scheduled at `changesAt`; hibernation reload keeps `meta.entitlement`; VIP reassignment leaves entitlement unchanged |
| `http.test.ts` | body ≤ 4096; response has `entitlement` status |

### 7.3 web-client (C)
- Unit tests:
  - the locked-pack row model (lock, no price);
  - points locked when `!premium`;
  - the error toast keys;
  - mock store: fake-mode gating from the catalog response, the purchase sequence calls in order, token persisted with try/catch.
- E2E: §5.3.

### 7.4 tv-app (B)
- §4.9.

### 7.5 Repo gates
SPEC §14.6, plus `pnpm --filter @mishana/server billing:products` exits 0.

---

## 8. Owner setup checklist (exact steps)

Do these in order. Items marked [VERIFY] come from third-party summaries or blocked pages; Play Console shows the current rule when you get there.

**A. Google Play developer account (individual)**
1. Go to https://play.google.com/console/signup with the Google account that will own the app (use a dedicated one, not your daily account). Choose **"Yourself"** (personal account).
2. Pay the one-time **US$25** registration fee [VERIFY the amount on the signup page].
3. Complete **identity verification**: legal name and address matching a government ID, plus a verified email and phone. Personal accounts need no D-U-N-S number [VERIFY].
4. Answer the developer questions (experience, number of apps, monetisation: "in-app purchases").
5. **Payments profile:** Play Console → Settings → Payments profile → create or link one. Pick the country of your bank account; MONETIZATION.md recommends the French one for easier payouts; Lebanon is a listed merchant country [VERIFY]. Add the bank account and confirm the test deposit.
6. **Service fee:** enrol in the **15% service fee tier** (Play Console → Settings → Developer account → Account groups / Service fee program) [VERIFY the menu path]. Subscriptions are 15% anyway.
7. **New personal accounts must run a closed test before production:** at least **12 testers opted in for 14 continuous days**. This applies to personal accounts created after 2023-11-13; the tester count went from 20 to 12 in Dec 2024 (third-party summaries; Google's page was blocked here → [VERIFY]). Recruit 12+ testers early (friends, a Google Group). They also serve as purchase testers.

**B. App and billing in Play Console**
1. Create the app: name "Mish Ana!", default language, App, Free (in-app purchases are allowed in free apps), declarations.
2. Fill **App content**: privacy policy URL (M5), ads = none, content rating questionnaire, target audience (13+, so that Families policy is avoided [VERIFY with the owner]), **Data safety** (§6.3), and the **TV** form factor (Release → Advanced settings → Form factors → Android TV; TV screenshots and banner are needed for review).
3. Build a release AAB with the billing library (B's work) and upload it to **Internal testing** (and to the closed test track for A.7). Billing products can be created only after an APK/AAB with the BILLING permission is uploaded [VERIFY; it was true historically].
4. **License testers:** Settings → License testing → add the testers' Gmail addresses. License testers get test payment methods, shortened renewals (monthly = 5 min, yearly = 30 min, trial = 3 min) and auto-refund after 3 min if unacknowledged ✔.
5. **Subscription:** Monetize with Play → Products → Subscriptions → Create subscription:
   - Product ID `premium`, name "Mish Ana! Premium" (benefits: "All word packs", "New packs included", "Custom scoring").
   - Add base plan `monthly`: auto-renewing, billing period 1 month, set prices (use "Set prices" → per-country, ~40% lower in LB/ME), grace period default, account hold default. **Activate.**
   - Add base plan `yearly`: auto-renewing, 1 year, prices. **Activate.**
   - Add offer `trial-7d` on `monthly`: eligibility "New customer acquisition → Never had this subscription", phase "Free trial", duration 7 days. **Activate.** Repeat on `yearly` (same offer id).
   - Subscription settings: turn **Pause off**. Keep Resubscribe on.
6. **One-time products:** Monetize with Play → Products → One-time products → Create, for each line of `pnpm --filter @mishana/server billing:products`:
   - product id `pack_en_food_01` etc.;
   - name = English title (add the FR/AR translations);
   - one purchase option (buy), price ~US$1.99–2.99.
   - **Activate.**
7. **RTDN** (after section C): Monetize with Play → Monetization setup → Real-time developer notifications:
   - enable;
   - Topic name `projects/<PROJECT_ID>/topics/play-rtdn`;
   - choose **"Get all notifications for subscriptions and one-time products"** ✔;
   - **Send test message** ✔, then Save.

**C. Google Cloud (Play Developer API + Pub/Sub)** — `gcloud` CLI flags ✔ verified with `gcloud … --help`:
```sh
gcloud projects create mish-ana-billing            # or use an existing project
gcloud config set project mish-ana-billing
gcloud services enable androidpublisher.googleapis.com pubsub.googleapis.com
# Service account the Worker uses to call the Play Developer API
gcloud iam service-accounts create play-api --display-name="Mish Ana Play API"
gcloud iam service-accounts keys create play-api.json --iam-account=play-api@mish-ana-billing.iam.gserviceaccount.com
#   (if your org blocks key creation: constraint iam.disableServiceAccountKeyCreation [VERIFY]; a personal project has no org policy)
# RTDN topic + Google Play publisher right (✔ the Play service account below)
gcloud pubsub topics create play-rtdn
gcloud pubsub topics add-iam-policy-binding play-rtdn \
  --member=serviceAccount:google-play-developer-notifications@system.gserviceaccount.com --role=roles/pubsub.publisher
# Identity Pub/Sub uses to sign push OIDC tokens (needs no roles)
gcloud iam service-accounts create rtdn-push --display-name="Mish Ana RTDN push"
gcloud pubsub subscriptions create play-rtdn-push --topic=play-rtdn \
  --push-endpoint=https://<YOUR_DOMAIN>/api/billing/rtdn \
  --push-auth-service-account=rtdn-push@mish-ana-billing.iam.gserviceaccount.com \
  --push-auth-token-audience=https://<YOUR_DOMAIN>/api/billing/rtdn \
  --ack-deadline=30 --expiration-period=never --min-retry-delay=10s --max-retry-delay=600s
```
- You (the person running gcloud) need `iam.serviceAccounts.actAs` on `rtdn-push`; project Owner has it. Very old projects may also need the Pub/Sub service agent to hold `roles/iam.serviceAccountTokenCreator` [VERIFY].
- **Play Console → Users and permissions → Invite new users:** email `play-api@mish-ana-billing.iam.gserviceaccount.com`. Under **App permissions**, add the app with "View app information (read-only)", "View financial data, orders, and cancellation survey responses" ✔ (needed for billing) and "Manage orders and subscriptions" [VERIFY exact labels]. Click Invite. Permissions can take up to 24 h to propagate [VERIFY].
- **Delete `play-api.json` from your disk** after step D.

**D. Cloudflare Worker**
```sh
cd server
pnpm --filter @mishana/server gen:entitlement-key           # prints {"kid":"k1","x":"…","d":"…"}
npx wrangler secret put ENTITLEMENT_KEYS                     # paste {"active":"k1","keys":[ <that object> ]}
npx wrangler secret put PLAY_SERVICE_ACCOUNT_JSON < ../play-api.json   # stdin input [VERIFY that piping works on your wrangler; else paste]
```
- Edit `server/wrangler.jsonc` vars:
  - `RTDN_AUDIENCE`: `https://<YOUR_DOMAIN>/api/billing/rtdn`;
  - `RTDN_SA_EMAIL`: `rtdn-push@mish-ana-billing.iam.gserviceaccount.com`;
  - keep `BILLING_MODE:"google"`, `ALLOW_FAKE_BILLING:"0"`.
- Replace the ratelimit `namespace_id`s with unique account values.
- `pnpm deploy`: this runs `check-deploy.mjs`, and `secrets.required` blocks a deploy with missing secrets ✔.
- Then send the Play Console **test RTDN** (B.7). The Worker logs `{code:"RTDN_TEST"}`.

**E. End-to-end on a real Google TV (closed or internal test install from Play)**
1. Sign in to the TV with a **license tester** account and install from the internal test link.
2. Store → yearly trial → Test card "always approves" → premium on; the room unlocks without a new code. Wait about 3 min: the trial converts; check `premium` stays on.
3. Buy a pack with "slow test card, approves after a few minutes" → Pending shown → unlocks later ✔ (test instruments).
4. Refund the pack in Play Console → Order management → it disappears within seconds (RTDN) or by the next daily cron.
5. Cancel the subscription via Manage subscription → `endsOn` is shown; after expiry the next game falls back to the free pack.
6. Reinstall the app or use a second TV on the same account → Restore purchases → premium restored.

---

## 9. File ownership and build order

| Implementer | Writes | Must not touch |
|---|---|---|
| **A** | `shared/src/billing/**` (new), `shared/src/{constants,engine/*,packs/schema.ts,projection/project.ts,protocol/*,testing/*,i18n/index.ts}`, `shared/i18n/{en,fr,ar}.json` (§4.7 keys), `shared/fixtures/**` + `scripts/gen-fixtures.ts`, `shared/package.json` (`./billing` export), `server/**` (incl. `wrangler.jsonc`, `scripts/*`, `package.json` scripts `gen:entitlement-key`, `billing:products`, `deploy` = `node scripts/check-deploy.mjs && wrangler deploy`), `word-packs/packs/*/*-everyday-01.json` (`tier:"free"`), `word-packs/test/**`, `tools/pack-lint/**`, `tools/dev.mjs` (fake vars), `tools/sim/**` (adapt to the RoomCore deps), generated `tv-app/app/src/main/res/values*/strings_generated.xml` + `tv-app/app/src/main/java/app/mishana/tv/i18n/I18nKeys.kt` (run `pnpm gen:strings`), `.gitignore` (`.dev.vars*`), `docs/DEV.md` (fake billing + secrets section) | `tv-app/**` source, `web-client/**` |
| **B** | `tv-app/**` except the generated files above; `docs/TV.md` (billing testing: license testers, fake toggle) | everything else |
| **C** | `web-client/**` (screens, tv-mock store, net/api additions, e2e `payments.spec.ts`, `playwright.config.ts` vars) | everything else |

**Build order:**
1. **Phase 0 (A, first, short):** everything B and C compile against:
   - `shared/src/billing/{products,entitlement,http}.ts`;
   - the protocol changes (`EntitlementMsgSchema`, new error codes, `premium`/`lockedPacks`/`PackInfo.tier`, `CreateRoomRequest.entitlement`, `CreateRoomResponse.entitlement`);
   - all §4.7 i18n keys + regenerated Android strings;
   - the pack `tier` field + the free starter flags;
   - the updated V fixtures + the new billing fixtures;
   - regenerated G fixtures (they may come with phase 1 if the engine is not ready; then B and C use the V fixtures only).
2. **Phase 1 (parallel):** A server (Billing DO, routes, Google client, RTDN, cron, fake mode, room access); B TV billing module + Store UI; C phone locked UI + mock store + e2e.
3. **Phase 2 (A, then C):** A runs `pnpm test` + sim. C runs `pnpm e2e` against A's fake mode. B's Kotlin is compiled by the owner on macOS (`./gradlew :app:testDebugUnitTest :app:assembleDebug`). Here, B runs what it can in `scratchpad/tv-verify` and reports.

**Definition of done:**
- A: §7.1 + §7.2 green, sim 3..12 × 500 green, `pnpm build` within budget (Worker ≤ 400 KB; Ed25519/RS256 use WebCrypto, so no new dependency is allowed).
- B: §4 implemented, §4.9 written (and run where possible), every [VERIFY] it touches listed.
- C: §5 implemented, §7.3 green, e2e §5.3 green with fake billing, phone bundle ≤ 60 KB.

---

## 10. Sources (fetched 2026-10-04)
- Play Billing Library: integrate guide, release notes (9.1.0 = 2026-06-18; 9.0.0; 8.x), reference pages for `BillingClient`, `BillingClient.Builder`, `PendingPurchasesParams.Builder`, `QueryProductDetailsParams.Product.Builder`, `ProductDetails` (+`SubscriptionOfferDetails`, `OneTimePurchaseOfferDetails`, `PricingPhase`), `QueryProductDetailsResult`, `UnfetchedProduct(.StatusCode)`, `BillingFlowParams.Builder`, `BillingFlowParams.ProductDetailsParams.Builder`, `Purchase`, `Purchase.PurchaseState`, `AccountIdentifiers`, `QueryPurchasesParams.Builder`, `PurchasesResponseListener`, `PurchasesUpdatedListener`, `ProductDetailsResponseListener`, `BillingClientStateListener`, `BillingClient.BillingResponseCode`, `BillingClient.ProductType`, `BillingClient.FeatureType`. All at developer.android.com/google/play/billing/* and developer.android.com/reference/com/android/billingclient/api/*.
- Subscription lifecycle, RTDN reference, getting-ready (RTDN setup, `google-play-developer-notifications@system.gserviceaccount.com`), subscriptions (deep link), testing (license testers and renewal times), security (obfuscated id check): developer.android.com/google/play/billing/{lifecycle/subscriptions, rtdn-reference, getting-ready, subscriptions, test, security}.
- Google Play Developer API v3 discovery document, revision 20261001: `purchases.subscriptionsv2.{get,cancel,revoke,defer}`, `purchases.productsv2.getproductpurchasev2`, `purchases.subscriptions.acknowledge`, `purchases.products.{get,acknowledge,consume}`, `purchases.voidedpurchases.list`; schemas `SubscriptionPurchaseV2`, `ProductPurchaseV2`, `VoidedPurchase`; product/base plan/offer id rules; scope `androidpublisher`.
- Pub/Sub v1 discovery (`PushConfig.oidcToken`, `NoWrapper`, `Subscription.expirationPolicy`); `gcloud pubsub subscriptions create --help`; GoogleCloudPlatform/nodejs-docs-samples `appengine/pubsub/app.js` (claim checks).
- OAuth: npm `gtoken@8.0.0` (service-account JWT claims, token URL, grant type), `google-auth-library@11.1.0` (`verifySignedJwtWithCertsAsync`: issuers, JWK cert URL, 300 s skew, 86 400 s max lifetime).
- Cloudflare (github.com/cloudflare/cloudflare-docs): `workers/configuration/cron-triggers.mdx`, `runtime-apis/handlers/scheduled.mdx`, `runtime-apis/web-crypto.mdx` (RSASSA-PKCS1-v1_5, Ed25519, `timingSafeEqual`), `configuration/secrets.mdx` + partial `secrets-in-dev.mdx`, `durable-objects/api/sqlite-storage-api.mdx`; `wrangler@4.147.0` `config-schema.json` (`triggers.crons`, `secrets.required`, ratelimit `period`); `@cloudflare/workers-types` (`getByName`, `ScheduledController`).
- Closed-testing rule (12 testers / 14 days): third-party summaries (testerscommunity.com, choicely.com, extendsclass.com, 2026) → [VERIFY] in Play Console.
