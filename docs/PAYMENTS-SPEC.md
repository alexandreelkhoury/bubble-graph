# PAYMENTS-SPEC — Mish Ana! premium, packs and Google Play Billing (v1)

Status: **binding** for three implementers, written 2026-10-04, revision 3 (2026-10-26; revision 2 applied the review findings, see the Review log appendix).

> **Revision 3 (2026-10-26), owner decision:** the Premium subscription is gone. Premium is a **one-time lifetime unlock**, the non-consumable Play in-app product `premium` (US$7.99 list; the US$5.99 launch promo is a Play Console sale/price change, never code). Packs stay one-time. There is **no subscription** anywhere. The code was changed first and is the source of truth; this revision describes it. Spanish (`es`) is now a 4th UI language.

 It extends [SPEC.md](SPEC.md). Where the two differ on payments, entitlements, packs, the room access model or the new protocol fields, **this file wins**. Everything SPEC.md says and this file does not change stays binding: the engine rules, the secrecy rules (§5.4), the Blank never speaking first, remote-only TV, the logging rules, and the rule that nobody commits to git.

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

**Owner's "Google Pay" question.** Inside an Android app distributed by Google Play, **digital goods such as a Premium unlock and word packs must be sold through Google Play Billing**. The Google Pay API is for physical goods and services, not for this (Payments policy, MONETIZATION.md [G7], snippet-level → **[VERIFY]** in Play Console policy pages). This costs the buyer nothing in convenience: the Play Billing purchase sheet already offers the payment methods saved in the user's Google account, including cards, Google Play balance and carrier billing where available. Integration needs only **one Google Play developer account** (§8) with a Play **payments profile** for payouts. You do **not** need a Google Pay merchant account, a Google Pay API integration, or any separate "Google Pay" setup.

| Topic | Decision |
|---|---|
| Rail | Google Play Billing Library **9.1.0** ✔ (latest per the release notes, 2026-06-18). Server checks go through the Google Play Developer API v3. There is no web checkout, no QR code to a payment page, and **no buy button on phones**. |
| Products | **One-time products only** (revision 3; no subscription). `premium`: lifetime unlock, non-consumable, US$7.99 list, launch promo US$5.99 as a Play Console sale. `pack_<packId with - → _>` for every premium pack: US$1.99, US$2.99 for packs ≥ 60 pairs (§1). Prices live in Play Console only. |
| Free tier | Core game, 3–12 players, one starter pack per language: `en-everyday-01`, `fr-everyday-01`, `ar-everyday-01`. All other settings are free except the premium settings in §1.6. |
| Who pays | Only the host TV. Phones show locked packs with "Unlock on the TV". |
| Identity | No accounts. The TV generates an `installId` (128-bit random). The server sees the raw value only inside HTTPS request bodies and stores only `installHash = sha256hex(installId)`, which is also the `obfuscatedAccountId` sent to Google. |
| Source of truth | The server. It stores purchase state in the **Billing Durable Object** (SQLite), issues a signed **entitlement token** (Ed25519 JWT, 8 h TTL), and the Room DO decides which packs a room may play. Locked packs reach clients as metadata only (title, count), never as words. |
| Fake billing | `BILLING_MODE=fake` exists for local dev and e2e only. It is guarded so it cannot be enabled in production (§3.10). |
| Apple TV (v2) | Not blocked. Entitlement claims are store-agnostic (`premiumUntil`, `packs[]`). A future `/api/billing/apple/verify` writes rows with `store="apple"` into the same tables and the same token. |

---

## 1. Product catalog

### 1.1 Google Play products (created by the owner in Play Console, §8)

Format verified ✔ in the discovery document: one-time `productId`: `[a-z0-9_.]`, starts with a letter or digit. **No hyphens.** We cap ids at 40 characters (`PRODUCT_ID_MAX`).

Every product is a Play Console **one-time product**, non-consumable (**we never consume**), with one purchase option `buy` [VERIFY the default purchase-option id Play Console proposes; it is not used by the code]. There is no subscription, base plan or offer.

| Product id | Recommended price (USD; owner sets it in Play Console, Play converts per country) | Grants |
|---|---|---|
| `premium` | **US$7.99** list. Launch promo **US$5.99**: a Play Console sale (or a temporary price change) on `premium`, never a second product and never in code | Lifetime: all packs, current and future, plus premium settings |
| `pack_<id>` (one per premium pack, see §1.3) | **US$1.99**; **US$2.99** for a pack with ≥ 60 pairs (`play-products.mjs` prints the recommended price per row) | That pack, forever |

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
| `en-everyday-01` | en | 176 | **free** | — |
| `fr-everyday-01` | fr | 176 | **free** | — |
| `ar-everyday-01` | ar | 170 | **free** | — |
| `en-food-01` | en | 35 | premium | `pack_en_food_01` |
| `en-leisure-01` | en | 35 | premium | `pack_en_leisure_01` |
| `en-nature-01` | en | 33 | premium | `pack_en_nature_01` |
| `en-places-01` | en | 30 | premium | `pack_en_places_01` |
| `en-things-01` | en | 63 | premium | `pack_en_things_01` |
| `fr-food-01` | fr | 35 | premium | `pack_fr_food_01` |
| `fr-leisure-01` | fr | 34 | premium | `pack_fr_leisure_01` |
| `fr-nature-01` | fr | 31 | premium | `pack_fr_nature_01` |
| `fr-places-01` | fr | 30 | premium | `pack_fr_places_01` |
| `fr-things-01` | fr | 63 | premium | `pack_fr_things_01` |
| `ar-home-01` | ar | 28 | premium | `pack_ar_home_01` |
| `ar-nature-01` | ar | 30 | premium | `pack_ar_nature_01` |
| `lb-food-01` | ar-LB | 28 | premium | `pack_lb_food_01` |
| `lb-life-01` | ar-LB | 23 | premium | `pack_lb_life_01` |

Starter packs are the "Everyday" pack because it exists with the same theme in all three languages. **Easy words (2026-10-07, owner):** the starter packs hold the easy, everyday words (concrete, 1–2 words, guessable by the word-less Mole; each pair's `notes` names its theme: Everyday, Places, Food, Animals, Things at home, Jobs, Travel, Sports and hobbies). They are the only words a free room plays by default. The premium packs are the "Hard" packs (titles prefixed "Hard · " / "Difficile · " / "صعب · ", tag `hard`); their ids and product ids are unchanged. **Release gate:** each starter pack must reach **at least 40 pairs** before the first production release. 24 pairs is about 24 games before repeats, and in a deduction game a remembered pair exposes the Mole at once. `pack-lint --release` (run by `pnpm run deploy`) fails below 40; dev runs only warn (§1.5). Growing the three starter packs is an owner/D content task; A only adds the gate.

### 1.3 Pack → product id mapping (shared, A; mirrored in Kotlin by B)

`shared/src/billing/products.ts` (new module, exported as `@mishana/shared/billing`, added to `shared/package.json` `exports` as `"./billing": "./src/billing/index.ts"`):
```ts
export const PREMIUM_PRODUCT_ID = "premium" as const;                  // lifetime unlock, one-time non-consumable
export const PACK_PRODUCT_PREFIX = "pack_" as const;
export const PRODUCT_ID_MAX = 40;                                       // Play product id length limit
export const PREMIUM_PACK_ID_MAX = PRODUCT_ID_MAX - PACK_PRODUCT_PREFIX.length; // 35
export function packProductId(packId: string): string { return PACK_PRODUCT_PREFIX + packId.replaceAll("-", "_"); }
export function packIdFromProductId(productId: string): string | null {
  if (!productId.startsWith(PACK_PRODUCT_PREFIX)) return null;
  const rest = productId.slice(PACK_PRODUCT_PREFIX.length);
  return /^[a-z0-9]+(_[a-z0-9]+)*$/.test(rest) ? rest.replaceAll("_", "-") : null;
}
export const PRODUCT_ID_REGEX = /^[a-z0-9][a-z0-9_.]{0,39}$/;
/** `premium` or a well-formed `pack_*` id (all one-time products). The server further requires a premium catalog pack. */
export function isSellableProductId(productId: string): boolean;
export const SUPPORT_EMAIL: string = "alexkhoury@hotmail.com";   // §4.7 {email}
```
The mapping is a bijection: pack ids match `^[a-z0-9]+(-[a-z0-9]+)*$` and contain no `_`. A test checks the round trip for every shipped pack.

Kotlin (B) `billing/Products.kt` mirrors these constants and the two functions exactly. `ProductsTest` checks them against `shared/fixtures/billing.products.json` (V, written by A):
```json
{ "premium": "premium",
  "pairs": [["lb-food-01", "pack_lb_food_01"], ["en-things-01", "pack_en_things_01"]] }
```

### 1.4 How a new pack becomes sellable
1. D/A adds a JSON pack (no `tier`, so premium) and lists it in `word-packs/index.ts`.
2. Deploy. `GET /api/billing/catalog` (§3.4) lists it, and the TV store shows it as soon as Play returns `ProductDetails` for its product id. Until the owner creates the product in Play Console, `queryProductDetailsAsync` reports it in `unfetchedProductList` (`PRODUCT_NOT_FOUND` ✔). The TV then hides the row's Buy button and shows the row's trailing state as `store.included` ("Included with Premium"), for premium and non-premium hosts alike (§4.4 row states).
3. Premium owners get the pack immediately, because premium means "every pack whose tier is premium".
4. `pnpm --filter @mishana/server billing:products` (A, `server/scripts/play-products.mjs`) prints a CSV (`productId,kind,priceUsd,pairs,packId,locale,titleEn,titleFr,titleAr`) of every Play product to create: first `premium` (`kind` `lifetime`, `7.99`), then every premium pack (`kind` `pack`, `1.99`, or `2.99` from 60 pairs). Notes (including the US$5.99 launch-sale reminder) go to stderr, so stdout is the bare CSV.

### 1.5 Pack lint additions (A, `tools/pack-lint`)

Errors:
- Not exactly **one** `tier:"free"` pack per **language** (`languageOf(locale)`; `ar-LB` counts as `ar`).
- A free pack whose `locale` is not exactly `en`/`fr`/`ar`. Starter packs are not regional.
- A free pack whose `ageRating !== "all"`.
- A premium pack whose `id.length > PREMIUM_PACK_ID_MAX` (35).
- `packProductId(id)` fails `PRODUCT_ID_REGEX`, or two packs map to the same product id.
- With the new flag `--release` only: a free pack with fewer than 40 pairs. The root `package.json` `deploy` script becomes `pnpm run build && pnpm --filter @mishana/pack-lint run lint -- --release && pnpm --filter @mishana/server run deploy`.

Warnings:
- Without `--release`: a free pack with fewer than 40 pairs.
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
- **Purchase**: one Google purchase token, stored only as `tokenHash = sha256hex(purchaseToken)`. The raw token is kept only while an acknowledgement is pending or may still become due (§3.5 `ack_token`).
- **Binding**: (tokenHash, installHash). It is created when an install proves possession of a token by posting it to `/api/billing/verify`, or (restricted, §3.4) from `obfuscatedExternalAccountId` on an RTDN. Only `/verify` refreshes its `last_seen_ms`; `/entitlement` never does.
- **Active binding**: a binding with `last_seen_ms > now − INSTALL_ACTIVE_WINDOW_MS` (30 days). The **same predicate** is used for the install limit and for access, so an install that stops proving possession stops counting and stops getting access at the same moment. A genuine TV re-proves possession on every app start and resume (restore posts its tokens, §2.4), so honest users never notice.
- **Entitlement of an install**: computed over every purchase with an **active** binding to its installHash that is owned (`purchaseOwned`, §2.2), plus an unexpired admin grant (§3.12):
  - `premiumUntil`: when an owned `premium` purchase (or an open-ended premium grant) exists, the token's own `exp` (lifetime premium lasts as long as each token and is extended by every refresh); a dated grant gives its `expiresAt` if later; else `null`;
  - `packs`: the pack ids of owned `pack_*` purchases.

### 2.2 Purchase state → access (shared pure function, A)

Premium is an owned one-time `premium` purchase; a pack is an owned one-time `pack_*` purchase. Same rule for both. `shared/src/billing/entitlement.ts` holds only:
```ts
export const PURCHASE_STATES = ["PURCHASED", "PENDING", "CANCELLED"] as const;   // ✔ ProductPurchaseV2.purchaseStateContext.purchaseState
export type PurchaseState = (typeof PURCHASE_STATES)[number];
export function purchaseOwned(p: { state: PurchaseState; revoked: boolean }): boolean;   // state === "PURCHASED" && !revoked
```
- `PURCHASED`: owned.
- `PENDING`: pending, no access.
- `CANCELLED`: no access. `PURCHASE_STATE_UNSPECIFIED` or an unknown value is normalized to `CANCELLED` (`normalize.ts`, PAY-GAP).

Access also requires `revoked === false` (voided, §3.6/§3.8), for `premium` and packs alike: a refunded or charged-back lifetime Premium ends at the TV's next refresh (≤ 8 h, token TTL). `revoked` is **sticky**: once 1, nothing sets it back to 0 (§3.5). Whether `productsv2` reports `CANCELLED` for a refunded or charged-back one-time purchase is undocumented (the enum description says only "Purchase canceled.") → [VERIFY]; the sticky flag makes the answer irrelevant.

### 2.3 Entitlement token (server-signed, opaque to clients)

**Format:** a compact JWS (JWT) with three base64url (no padding) segments, `header.payload.signature`. Total length ≤ `ENTITLEMENT_TOKEN_MAX_CHARS = 3000`.
```jsonc
// header
{ "alg": "EdDSA", "typ": "JWT", "kid": "k1" }
// payload (JWT time claims in SECONDS)
{ "iss": "mish-ana", "v": 1, "sub": "<installHash 64 hex>",
  "iat": 1790000000, "exp": 1790028800,
  "pu": 1792592000,                 // premiumUntil, seconds, or null
  "packs": ["en-food-01", "lb-food-01"],   // sorted, unique, ≤ 64 (MAX_TOKEN_PACKS); owned packs only (premium covers the rest)
  "mode": "google" }                // "google" | "fake"
```
- **Algorithm:** Ed25519 via WebCrypto (`{ name: "Ed25519" }`, ✔ supported by Workers for sign/verify/importKey; ✔ Node 22.22 for tests). The signature covers the ASCII bytes of `header + "." + payload` (the base64url strings).
- **TTL:** `exp = iat + ENTITLEMENT_TTL_S` (28 800 s = 8 h). Revocations (refunds, chargebacks) therefore reach new rooms within 8 h at most, even from a modded or offline TV, and usually immediately, because an honest TV refreshes often (§2.4). Honest TVs lose nothing: they refresh at least every 6 h in a room and on every start/resume.
- **Keys:** the Workers secret `ENTITLEMENT_KEYS` (JSON):
  ```json
  { "active": "k2", "keys": [ { "kid": "k1", "x": "<b64url pub>", "d": "<b64url priv>" }, { "kid": "k2", "x": "…", "d": "…" } ] }
  ```
  - Each key is an OKP JWK pair (`kty:"OKP", crv:"Ed25519"`). Sign with the `active` kid; verify with any listed kid. Verify entries need only `x`; `d` is required only for the `active` kid and may be omitted for retired kids.
  - **Import:** public keys only as `importKey("jwk", {kty:"OKP", crv:"Ed25519", x}, {name:"Ed25519"}, false, ["verify"])`; the active private key as `importKey("jwk", {kty:"OKP", crv:"Ed25519", x, d}, {name:"Ed25519"}, false, ["sign"])`. The keyring parser rejects any entry that is not `kty:"OKP", crv:"Ed25519"`, so an RSA or EC key can never verify an entitlement token (no algorithm confusion).
  - **Rotation:** generate a new key (`pnpm --filter @mishana/server gen:entitlement-key` → `server/scripts/gen-entitlement-key.mjs` prints `{kid,x,d}` from Node WebCrypto), add it, set `active`, deploy, then remove the old kid after **≥ 16 h** (2 × TTL; 24 h recommended).
  - `kid` matches `^[a-z0-9]{1,16}$`.
- **Fake mode** signs with the fixed, public dev key `FAKE_ENTITLEMENT_KEY` (kid `fake`, constant in `server/src/billing/fake.ts`). The verifier accepts kid `fake` and `mode:"fake"` **only** when fake mode is active (§3.10). In google mode, a token with `mode:"fake"` or kid `fake` → `ENTITLEMENT_INVALID`.
- **Verification** (server only, `server/src/billing/token.ts`, `verifyEntitlementToken(token, keys, nowMs, fakeActive)`):
  1. length ≤ 3000;
  2. exactly three segments, each matching `^[A-Za-z0-9_-]+$` and **canonical**: decode, re-encode (base64url, no padding) and compare byte for byte; a mismatch is invalid;
  3. header JSON parsed with `z.strictObject({ alg: z.literal("EdDSA"), typ: z.literal("JWT"), kid: z.string().regex(/^[a-z0-9]{1,16}$/) })`, and `kid` is in the keyring (or is `fake` under the mode rule);
  4. signature valid (Ed25519 key only, see Import);
  5. payload JSON parsed with:
     ```ts
     const SafeInt = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
     export const EntitlementClaimsSchema = z.strictObject({
       iss: z.literal("mish-ana"), v: z.literal(1), sub: z.string().regex(/^[0-9a-f]{64}$/),
       iat: SafeInt, exp: SafeInt, pu: SafeInt.nullable(),
       packs: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64)).max(MAX_TOKEN_PACKS),
       mode: z.enum(["google", "fake"]) })
       .refine(c => c.exp > c.iat && c.exp - c.iat <= ENTITLEMENT_TTL_S)
       .refine(c => c.packs.every((p, i) => i === 0 || c.packs[i - 1] < p));   // sorted, unique
     ```
     Duplicate or reordered claims are rejected by one rule: the verifier re-serialises the parsed header and payload with `JSON.stringify` in the canonical key order (header `alg, typ, kid`; payload `iss, v, sub, iat, exp, pu, packs, mode`) and requires byte equality with the decoded segment. The signer always writes exactly that form;
  6. `iat ≤ now + 300 s` and `exp > now`;
  7. `packs` are ids of premium packs that exist in the catalog (unknown ids are dropped, not an error);
  8. mode rules as above.

  Output `RoomEntitlement` (milliseconds):
  ```ts
  export interface RoomEntitlement { sub: string; iatMs: number; expMs: number; premiumUntilMs: number | null; packs: string[]; mode: "google" | "fake" }
  ```
- Clients never parse the token. The TV stores it and also receives the decoded fields in the API response (§3.4).

### 2.4 Refresh rules (TV, B; the TV mock follows the same rules with fake billing)

The TV calls `POST /api/billing/verify` (when it has `PURCHASED` purchases) or `POST /api/billing/entitlement` (when it has none):
1. On app start **and on every `ON_START`/`ON_RESUME`**, run `queryPurchasesAsync` (INAPP only; a local Play cache call, ✔ the integrate guide says to call it in `onResume()` to catch PENDING → PURCHASED transitions). Post to `/verify` immediately when any `(purchaseToken, purchaseState)` differs from the last successful verify; otherwise refresh only if the stored token is older than 1 h.
2. After every `onPurchasesUpdated` with `PURCHASED` purchases.
3. While in a room, on a timer at
   `max(now + 1 min, min(expiresAt − 1 h, premiumUntil − 30 min, now + 6 h))`,
   ignoring a `null` `premiumUntil`. For lifetime premium `premiumUntil` equals the token `exp`, so the refresh lands **before** the room loses premium and the new token carries it on. Pure function `BillingRepository.nextRefreshAt(body, nowMs)`.
4. When the Store opens.

The phrase "older than 1 h" always refers to `ent_saved_at`.

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
  google.ts          GoogleApi: service-account JWT → access token cache; productsv2.getproductpurchasev2,
                     products.acknowledge, voidedpurchases.list (no subscription endpoint)
  google-types.ts    hand-written TS types for the fields we read (subset of the discovery schemas, names verbatim)
  normalize.ts       ProductPurchaseV2 → NormalizedPurchase
  catalog-info.ts    premium pack ids from the catalog; isSoldProductId (`premium` or a premium catalog pack)
  token.ts           sign/verify entitlement JWT (Ed25519), key parsing
  pubsub-auth.ts     Pub/Sub push OIDC verification (RS256, Google JWKS cache)
  rtdn.ts            DeveloperNotification parsing + dispatch; refreshProduct (re-read + apply + ack, shared with fake/set)
  cron.ts            scheduled(): hourly ack retries + overdue alert; daily voided purchases, pruning
  fake.ts            FAKE billing: FakeGoogleApi + fake routes (FAKE_ENTITLEMENT_KEY in fake-key.ts)
  mode.ts            billingModeForRequest(env, req) and fakeAllowedByEnv(env) guards (§3.10)
  log.ts             billingLog(code, fields): the ONLY logging entry point in server/src/billing; drops any string field
                     and any value matching the redaction patterns (§3.9)
server/src/access.ts room access: playable catalog, locked pack metadata, settings restriction (used by RoomCore)
server/scripts/{gen-entitlement-key.mjs, play-products.mjs, check-deploy.mjs}
```
`shared/src/billing/{index,products,entitlement,http,access}.ts` holds the constants, the pure state mapping, and the zod schemas for the billing HTTP API, shared with C and with the fixtures.

### 3.2 `wrangler.jsonc` changes (exact keys; ✔ the wrangler 4.147.0 schema has `triggers.crons`, `secrets.required`, ratelimit `period` ∈ {10, 60})
```jsonc
"durable_objects": { "bindings": [ { "name": "Room", "class_name": "Room" }, { "name": "BILLING", "class_name": "Billing" } ] },
"migrations": [ { "tag": "v1", "new_sqlite_classes": ["Room"] }, { "tag": "v2", "new_sqlite_classes": ["Billing"] } ],
"ratelimits": [ …existing…,
  { "name": "BILLING_LIMITER", "namespace_id": "1003", "simple": { "limit": 30, "period": 60 } },
  { "name": "RTDN_LIMITER",    "namespace_id": "1004", "simple": { "limit": 120, "period": 60 } } ],
"triggers": { "crons": ["23 * * * *", "17 3 * * *"] },        // hourly ack retries; daily voided + prune (§3.8)
"secrets": { "required": ["PLAY_SERVICE_ACCOUNT_JSON", "ENTITLEMENT_KEYS"] },
"observability": { "enabled": true, "logs": { "enabled": true, "invocation_logs": true }, "traces": { "enabled": false } },
"vars": { …existing…, "BILLING_MODE": "google", "ALLOW_FAKE_BILLING": "0",
          "PLAY_PACKAGE_NAME": "app.mishana.tv", "RTDN_AUDIENCE": "", "RTDN_SA_EMAIL": "", "RTDN_SUBSCRIPTION": "" }
```
- `run_worker_first` already covers `/api/*`.
- **Observability and token secrecy** (✔ cloudflare-docs sources): Workers **traces** record `url.full`, `url.path` and `url.query` for every outbound `fetch` span, and every Google call carries the raw purchase token in its URL path. Traces must therefore stay **disabled** (`observability.traces.enabled: false`, written explicitly because Cloudflare plans to turn tracing on with `observability.enabled` for newer compatibility dates ✔ tracing beta note). Workers **Logs** invocation logs record the *incoming* request's method and URL ✔; billing routes carry tokens only in request bodies, never in URLs or query strings, so invocation logs stay on. `check-deploy.mjs` fails if `observability.traces.enabled` is not `false`. No Logpush/Tail Worker may be added without revisiting this rule.
- `secrets.required` makes `wrangler deploy` fail when a secret is missing ✔. In local dev, missing secrets are warnings only ✔.
- `namespace_id: "1003"` is a placeholder, like 1001/1002 (SPEC §16.5).

`src/env.ts` adds:
```ts
BILLING: DurableObjectNamespace<Billing>; BILLING_LIMITER: RateLimit; RTDN_LIMITER: RateLimit;
BILLING_MODE: string; ALLOW_FAKE_BILLING: string; PLAY_PACKAGE_NAME: string; RTDN_AUDIENCE: string; RTDN_SA_EMAIL: string;
RTDN_SUBSCRIPTION: string; PLAY_SERVICE_ACCOUNT_JSON?: string; ENTITLEMENT_KEYS?: string;
```
**The Room DO never sees billing secrets.** `Room` must not read `env.PLAY_SERVICE_ACCOUNT_JSON` or the private halves of `ENTITLEMENT_KEYS`, and `RoomCore` must not receive the `env` object. The Room DO builds, once per isolate, a `RoomBillingDeps = { verifyKeys: Map<kid, CryptoKey /* Ed25519 public, verify only */>, fakeAllowedByEnv: boolean }` from `ENTITLEMENT_KEYS` (dropping every `d`) and passes only that into `RoomCore`. A lint rule (`no-restricted-syntax` on `env.PLAY_SERVICE_ACCOUNT_JSON` outside `server/src/billing/**`) enforces the first half. Workers cannot scope secrets per DO class, so this is a code rule, not an isolation boundary.
`src/index.ts` exports `{ fetch, scheduled } satisfies ExportedHandler<Env>` and `export { Room } from "./room"; export { Billing } from "./billing/billing-do"`. The Billing DO is a **single instance**: `env.BILLING.getByName("global")` ✔ (`getByName` exists in the pinned workers-types). Load is tiny (one row write per purchase or notification), and one instance gives strongly consistent indices.

### 3.3 Constants (A, `shared/src/constants.ts` additions)
```ts
export const HTTP_BODY_MAX_BYTES = 4096;          // CHANGED from 1024: POST /api/rooms now carries an entitlement token
export const BILLING_BODY_MAX_BYTES = 16384;
export const ENTITLEMENT_TOKEN_MAX_CHARS = 3000;
export const ENTITLEMENT_TTL_S = 28_800;          // 8 h
export const MAX_TOKEN_PACKS = 64;
export const MAX_PURCHASES_PER_VERIFY = 20;
export const PURCHASE_TOKEN_MAX_CHARS = 2048;     // printable ASCII \x21-\x7e
export const MAX_INSTALLS_PER_PURCHASE = 10;      // ACTIVE bindings (§2.1)
export const INSTALL_ACTIVE_WINDOW_MS = 30 * 86_400_000;
export const INSTALL_VERIFY_PER_10MIN = 20;       // per installHash, Billing DO in-memory window
export const INSTALL_ENTITLEMENT_PER_10MIN = 60;
export const RATE_MAP_MAX_ENTRIES = 10_000;       // LRU bound of the in-memory rateCheck map
export const GOOGLE_FRESH_MS = 10 * 60_000;       // verify reuses a stored Google read younger than this
export const INVALID_TOKEN_TTL_MS = 86_400_000;   // negative cache for Google 400/404/410
export const MAX_GOOGLE_READS_PER_VERIFY = 5;
export const GOOGLE_CALL_TIMEOUT_VERIFY_MS = 3_000;   // per call, verify path (RTDN/cron: 10 s)
export const VERIFY_DEADLINE_MS = 12_000;             // whole verify request
export const GOOGLE_VERIFY_BUCKET = { capacity: 120, refillPerMin: 60 } as const;  // global, verify path only (§3.5)
export const ACK_WINDOW_MS = 3 * 86_400_000;      // ✔ starts at PENDING → PURCHASED
export const ACK_OVERDUE_ALERT_MS = 48 * 3_600_000;
export const PENDING_ACK_TOKEN_MAX_MS = 30 * 86_400_000;
export const RTDN_AUTH_HEADER_MAX_CHARS = 4096;
```
Kotlin `Constants` mirrors `ENTITLEMENT_TOKEN_MAX_CHARS`, `MAX_PURCHASES_PER_VERIFY` and `PURCHASE_TOKEN_MAX_CHARS`.

### 3.4 HTTP endpoints

All billing JSON responses carry `Cache-Control: no-store` except `/catalog`. They use the error body `{"error": BillingErrorCode}`. Request bodies need `Content-Type: application/json`, are capped at `BILLING_BODY_MAX_BYTES` (read with `readBodyLimited`), and are parsed with strict zod schemas. The Origin check (SPEC §7.4) applies: the TV app sends no Origin, and the TV mock is same-origin. `BILLING_LIMITER` (key: client IP) applies to every route except `/rtdn`, which has its own `RTDN_LIMITER` (§3.6).

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
export const EntitlementBody = z.object({ token: z.string(), premium: z.boolean(),
  premiumUntil: z.number().nullable() /* ms; lifetime premium or an open-ended grant: the token's exp */,
  packs: z.array(z.string()), expiresAt: z.number() /* token exp, ms */ });   // no `subscription` field (revision 3)
export const VerifyResponse = z.object({ entitlement: EntitlementBody,
  results: z.array(z.object({ productId: z.string(), result: z.enum(PURCHASE_RESULTS) })) });   // same order as the request
export const EntitlementResponse = z.object({ entitlement: EntitlementBody });
export const CatalogPackSchema = z.object({ packId: z.string(), productId: z.string(), locale: z.string(), language: LocaleSchema,
  title: LocalizedTitleSchema, pairCount: z.number().int(), ageRating: AgeRatingSchema });
export const CatalogResponse = z.object({ mode: z.enum(["google","fake"]), packageName: z.string(),
  premium: z.object({ productId: z.literal("premium") }),   // one-time lifetime unlock
  freePackIds: z.array(z.string()),
  packs: z.array(CatalogPackSchema) });                        // premium packs only, catalog order
export const BillingHttpError = z.object({ error: z.enum(BILLING_ERROR_CODES) });
// fake mode only (§3.10)
export const FAKE_PURCHASE_STATES = ["PURCHASED", "PENDING", "CANCELLED", "REVOKED"] as const;
export const FakePurchaseRequest = z.strictObject({ installId: InstallIdSchema, productId: ProductIdSchema,
  outcome: z.enum(["PURCHASED", "PENDING"]).optional() });
export const FakePurchaseResponse = z.object({ purchaseToken: z.string() });
export const FakeSetRequest = z.strictObject({ purchaseToken: PurchaseTokenSchema, state: z.enum(FAKE_PURCHASE_STATES) });
```
`premium` in `EntitlementBody` is `premiumUntil !== null && premiumUntil > now`.

| Method + path | Request | Success | Errors |
|---|---|---|---|
| `GET /api/billing/catalog` | — | 200 `CatalogResponse`, `Cache-Control: public, max-age=300` | 503 `NOT_CONFIGURED` when google mode lacks secrets |
| `POST /api/billing/verify` | `VerifyRequest` | 200 `VerifyResponse` (per-purchase results; the entitlement is always returned and reflects every binding, not only this request) | 400 `BAD_REQUEST`, 403 `FORBIDDEN` (origin), 429 `RATE_LIMITED` (IP limiter or per-install window), 503 `NOT_CONFIGURED`. Google outages do **not** fail the request: affected purchases get `UPSTREAM_ERROR` |
| `POST /api/billing/entitlement` | `EntitlementRequest` | 200 `EntitlementResponse` (free entitlement when nothing is bound) | 400, 403, 429, 503 |
| `POST /api/billing/rtdn` | Pub/Sub push (§3.6) | 204 | 401 `UNAUTHORIZED` (bad or missing OIDC), 413 `BAD_REQUEST` (body too large), 429 `RATE_LIMITED`, 503 `UPSTREAM_UNAVAILABLE` (so Pub/Sub retries) |
| `POST /api/billing/fake/purchase` | fake only (§3.10) | 200 `{ "purchaseToken": "fake.…" }` | 404 outside fake mode |
| `POST /api/billing/fake/set` | fake only | 204 | 404 outside fake mode |
| other methods/paths under `/api/billing/` | — | — | 405 `{"error":"BAD_REQUEST"}` |

**Verify algorithm** (Worker, `routes.ts`). Run steps 1–2 once, step 3 for each purchase sequentially, then step 4. The whole request has a deadline of `VERIFY_DEADLINE_MS` (12 s) measured from step 1; when it passes, every purchase not yet processed gets `UPSTREAM_ERROR` (the TV already retries those, §4.2).
1. Parse the request. `installHash = sha256hex(installId)`. Billing DO `rateCheck(installHash, "verify", now)` → false → 429.
2. Mode guard (§3.10). Load the Google client (google) or the FakeGoogleApi (fake). `googleReads = 0`.
3. For each purchase (`tokenHash = sha256hex(purchaseToken)`):
   - a. `isSoldProductId(productId)` (`catalog-info.ts`): `premium`, or a `pack_*` id whose `packIdFromProductId` names a **premium** catalog pack. Otherwise → `INVALID` (no Google call). Every sold product is a one-time product.
   - b. **Short-circuits** (no Google call), via DO `lookup(tokenHash, now)`:
     - the hash is in the negative cache (`invalid_tokens_v2`, younger than `INVALID_TOKEN_TTL_MS`) → `INVALID`;
     - a row exists with `revoked=1` → `REVOKED` (no binding, no Google call; `premium` and packs alike);
     - a row exists with matching `product_id`, `google_checked_ms > now − GOOGLE_FRESH_MS`, a state that is not `PENDING`, and no ack due (`acknowledged=1` or the state is not ack-eligible) → DO `bindOnly({ tokenHash, callerInstallHash, now })` (same binding rules and `INSTALL_LIMIT` check as `applyPurchase`, refreshes `last_seen_ms`) → its result. Possession is proven, because the caller sent the raw token whose hash matches.
   - c. Otherwise, if `googleReads ≥ MAX_GOOGLE_READS_PER_VERIFY` (5), or DO `googleBudget(1, now)` returns 0 (the global bucket, §3.5) → `UPSTREAM_ERROR` (log `{code:"BILLING_BUDGET"}` once per request). Else `googleReads += 1`, then fetch from Google with a `GOOGLE_CALL_TIMEOUT_VERIFY_MS` (3 s) per-call timeout and the §3.7 retry only if the deadline allows:
     - `checkedMs = Date.now()` taken **immediately before** the fetch is sent;
     - `productsv2.getproductpurchasev2`, for `premium` and packs alike;
     - HTTP 400/404/410 from the purchases API → `INVALID`, and DO `markInvalid(tokenHash, now)` (negative cache);
     - 401/403 or an OAuth token-endpoint failure → log `{code:"BILLING_AUTH"}`, `UPSTREAM_ERROR`;
     - 429/5xx/timeout → `UPSTREAM_ERROR`.
   - d. `normalize` (§3.7). The product must match: `productLineItem[0].productId === productId`. Otherwise → `INVALID`, **not** negative-cached (only Google's own 400/404/410 is), so a hostile post of someone else's token under the wrong product id can never make the owner's verify `INVALID`.
   - e. Billing DO `applyPurchase({ tokenHash, productId, n: normalized, callerInstallHash: installHash, rawTokenForAck: purchaseToken })` → `{ result, ackDue }`. `result` ∈ `OK` / `PENDING` / `NOT_OWNED` / `REVOKED` / `INSTALL_LIMIT` (§3.5).
   - f. **Acknowledge based on Google state only**, never on `result`: if `ackDue` (the stored row is ack-eligible and `acknowledged=0`; §3.5) then acknowledge (`ackPurchase`, §3.7: `products.acknowledge`, also for `premium`). This also covers `INSTALL_LIMIT`, `REVOKED` and `NOT_OWNED` results: a purchase Google says is paid is always acknowledged, so Google never auto-refunds it because of our own binding policy. Ack calls do not count toward `MAX_GOOGLE_READS_PER_VERIFY` but do take from the global bucket. The `result` is unchanged by the ack outcome: the user paid, and we have three days to acknowledge ✔.
4. DO `entitlementFor(installHash, now)` → sign the token → 200.

**Ack-eligible state:** `PURCHASED` (every product; `isAckEligible`).

**obfuscatedAccountId rule.**
- If the Google resource carries `obfuscatedExternalAccountId` (✔ `ProductPurchaseV2.obfuscatedExternalAccountId`), store it as `origin_install_hash`.
- **Verify path:** the purchase binds to the **caller** (the one who proved possession). The obfuscated id is not bound here; a mismatch with the caller is **allowed** (a restore on another TV signed into the same Google account), counts toward `MAX_INSTALLS_PER_PURCHASE`, and the Worker logs `{code:"BILLING_RESTORE_OTHER_INSTALL"}` without hashes.
- **RTDN path** (no caller): bind the obfuscated id (if it is 64-hex) **only if** the token has **no** binding yet **and** its active-binding count is below `MAX_INSTALLS_PER_PURCHASE`. The RTDN path can never exceed the limit. The obfuscated id is client-chosen (a modded APK can set any value), so such a binding is a hint, not a proof: it grants nothing unless an install whose `sha256hex(installId)` equals it calls `/entitlement`, and it expires with the active window unless that install later proves possession via `/verify`.
- A purchase with **no** obfuscated id (a promo code redeemed in the Play Store) binds to the caller on `/verify`.

**Which purchases bind on `/verify`:** every Google-confirmed token of this package with a matching product binds to the caller (subject to `INSTALL_LIMIT`), **except** rows in `CANCELLED` or `revoked` (`isBindable`). A `PENDING` purchase therefore binds, and grants access as soon as it turns `PURCHASED`. Access is computed from state anyway (`purchaseOwned`).

**Entitlement route:** `rateCheck(…, "entitlement")`, then `entitlementFor`, then sign.

### 3.5 Billing Durable Object (`Billing`, SQLite; ✔ `ctx.storage.sql.exec(...).toArray()/.one()`, `ctx.storage.transactionSync`)

Schema, created in the constructor with `CREATE TABLE IF NOT EXISTS`:
```sql
CREATE TABLE purchases (
  token_hash TEXT PRIMARY KEY, store TEXT NOT NULL DEFAULT 'google',  -- 'google' | 'fake' | ('apple' in v2)
  kind TEXT NOT NULL,              -- always 'product' (PRODUCT_KIND): `premium` and packs are all one-time products
  product_id TEXT,                 -- NULL only on a tombstone whose product is unknown
  state TEXT NOT NULL,             -- 'PURCHASED' | 'PENDING' | 'CANCELLED'
  expiry_ms INTEGER, auto_renew INTEGER NOT NULL DEFAULT 0, base_plan_id TEXT, in_trial INTEGER NOT NULL DEFAULT 0,  -- UNUSED (see below)
  acknowledged INTEGER NOT NULL DEFAULT 0,
  ack_token TEXT,                  -- raw token ONLY while an ack is or may become due (rules below)
  ack_window_start_ms INTEGER,     -- start of Google's 3-day ack window (PENDING → PURCHASED), NULL while pending
  revoked INTEGER NOT NULL DEFAULT 0,  -- `premium` and packs; sticky (never 1 → 0)
  test INTEGER NOT NULL DEFAULT 0,
  origin_install_hash TEXT, superseded_by TEXT,                      -- superseded_by: UNUSED
  google_checked_ms INTEGER NOT NULL,  -- 0 on a tombstone
  created_ms INTEGER NOT NULL, updated_ms INTEGER NOT NULL);
CREATE TABLE bindings (token_hash TEXT NOT NULL, install_hash TEXT NOT NULL, first_seen_ms INTEGER NOT NULL, last_seen_ms INTEGER NOT NULL,
  PRIMARY KEY (token_hash, install_hash));
CREATE INDEX bindings_install ON bindings(install_hash);
CREATE TABLE invalid_tokens_v2 (token_hash TEXT NOT NULL, kind TEXT NOT NULL, at_ms INTEGER NOT NULL,
  PRIMARY KEY (token_hash, kind));                                  -- negative cache, 24 h; kind always 'product'
CREATE TABLE rtdn_seen (message_id TEXT PRIMARY KEY, at_ms INTEGER NOT NULL);
CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);               -- 'voided_cursor_ms'
CREATE TABLE fake_purchases (token TEXT PRIMARY KEY, json TEXT NOT NULL);  -- used only in fake mode
```
**Unused columns (revision 3):** `expiry_ms`, `auto_renew`, `base_plan_id`, `in_trial` and `superseded_by` are leftovers of the dropped subscription design. Nothing shipped with them, the code never writes or reads them, and they stay at their defaults (`CREATE TABLE IF NOT EXISTS` keeps one schema; no migration). `kind` is written as `'product'` on every row, tombstones included.

**Upsert rules** (one SQL statement, so they hold even for code paths that forget them):
```sql
INSERT INTO purchases (…) VALUES (…)
ON CONFLICT(token_hash) DO UPDATE SET
  state = excluded.state, test = excluded.test, origin_install_hash = excluded.origin_install_hash,   -- Google-derived columns
  product_id = COALESCE(purchases.product_id, excluded.product_id),
  acknowledged = MAX(purchases.acknowledged, excluded.acknowledged),
  ack_token = CASE WHEN MAX(purchases.acknowledged, excluded.acknowledged) = 1 THEN NULL ELSE excluded.ack_token END,
  revoked = MAX(purchases.revoked, excluded.revoked),                    -- sticky; applyPurchase always writes 0 here
  ack_window_start_ms = COALESCE(purchases.ack_window_start_ms, excluded.ack_window_start_ms),
  google_checked_ms = excluded.google_checked_ms, updated_ms = excluded.updated_ms
WHERE excluded.google_checked_ms >= purchases.google_checked_ms;       -- stale Google reads never overwrite newer ones
```
`checkedMs` is the time taken **immediately before** the Google fetch was sent (§3.4 step c), so a slow, older read that completes late loses to a fresher one.

**Ack window and `ack_token`:**
- `ack_window_start_ms` is set on the first apply where the state is ack-eligible (§3.4), from `ProductPurchaseV2.purchaseCompletionTime` when present (✔; not set while pending), else from `checkedMs`. Google's 3-day window starts only at PENDING → PURCHASED ✔ (integrate guide).
- `ack_token` (the raw token) is written when `acknowledged=0` and the state is ack-eligible **or pending**. It is NULLed: on ack; 4 days after `ack_window_start_ms`; for a row still pending, 30 days after `created_ms` (`PENDING_ACK_TOKEN_MAX_MS`); and when the state becomes `CANCELLED`.
- `ackDue` (returned by `applyPurchase`) = stored row ack-eligible AND `acknowledged=0`.

RPC methods (all synchronous SQL inside `transactionSync`; no `await` between read and write):

| Method | Behaviour |
|---|---|
| `rateCheck(installHash, kind: "verify"\|"entitlement", nowMs): boolean` | In-memory sliding window (10 min) per hash; limits from §3.3. The map is an **LRU capped at `RATE_MAP_MAX_ENTRIES`** (10 000; evict least-recently-used), so random installIds cannot grow DO memory. Losing it on eviction is fine |
| `googleBudget(n, nowMs): number` | Global token bucket for **verify-path** Google calls (`GOOGLE_VERIFY_BUCKET`: capacity 120, refill 60/min, in memory). Returns how many of `n` were granted. RTDN and cron calls do not take from it, so they always have headroom. 60/min ≈ 86 400/day, below the Play Developer API's default daily quota [VERIFY the project's quota in Cloud Console → APIs → Google Play Android Developer API → Quotas; lower the refill if it is smaller] |
| `lookup(tokenHash, nowMs)` | `{ invalid: boolean, row: PurchaseRow \| null }` for the §3.4 short-circuits |
| `ipReadCheck(ipKey, nowMs)` / `installNetSeen(installHash, netKey, nowMs)` | In-memory, LRU-bounded abuse brakes on the verify path (per-IP Google reads per minute; network prefixes seen per install per day, `BILLING_INSTALL_SHARED`). Keys are truncated hashes; the IP never reaches the DO |
| `markInvalid(tokenHash, nowMs)` | Upsert `invalid_tokens_v2`. Never written for a hash that has a `purchases` row |
| `applyPurchase(i: ApplyInput): { result, ackDue }` | 1. Conditional upsert (above), with `kind='product'`, `revoked=0` and `ack_token` per the rules. 2. **Re-read the row as stored** (it may differ from `i.n` when `i.n` was stale) and compute everything else from it. 3. Binding: if `i.callerInstallHash` and the stored row is bindable (§3.4 "Which purchases bind"), upsert `bindings` (refresh `last_seen_ms`). Before inserting a **new** binding, count **active** bindings for the token; if ≥ `MAX_INSTALLS_PER_PURCHASE` → result `INSTALL_LIMIT` (the purchase row is still stored, and `ackDue` is still returned). With `callerInstallHash: null` (RTDN/cron/fake set) apply the restricted obfuscated-id rule of §3.4. 4. Result from the stored row: `REVOKED` if `revoked=1`; else `OK` if `purchaseOwned`; else `PENDING` if pending; else `NOT_OWNED` |
| `bindOnly({ tokenHash, callerInstallHash, nowMs })` | Steps 3–4 of `applyPurchase` for a cached row (§3.4 step b) |
| `markAcked(tokenHash)` | `acknowledged=1, ack_token=NULL` |
| `entitlementFor(installHash, nowMs): { premiumUntilMs, packs }` | Rows joined through **active** bindings only (`last_seen_ms > now − INSTALL_ACTIVE_WINDOW_MS`, the same predicate as the limit), owned only (`purchaseOwned`). An owned `premium` row → `premiumUntilMs = now + ENTITLEMENT_TTL_S·1000` (= the token `exp`: lifetime). `packs` = sorted pack ids of owned `pack_*` rows that still exist as premium catalog packs, truncated to `MAX_TOKEN_PACKS` (note below). Then the §3.12 grant merge. **Read-only: never touches `last_seen_ms`** |
| `markRevoked(tokenHash, nowMs)` | **Every product, `premium` included.** If a row exists → `revoked=1`. If no row exists → insert a **tombstone** `{kind:'product', product_id:NULL, state:'CANCELLED', revoked:1, google_checked_ms:0}` (and drop any negative-cache entry). A later `/verify` of that token then hits the §3.4 short-circuit and returns `REVOKED`; a later Google read cannot clear `revoked` (sticky upsert) |
| `rtdnSeen(messageId): boolean` / `rtdnMark(messageId, nowMs)` | Dedupe |
| `pendingAcks(nowMs): {tokenHash, productId, token, windowStartMs}[]` | `ack_token NOT NULL AND acknowledged=0 AND ack_window_start_ms NOT NULL AND product_id NOT NULL AND MAX(ack_window_start_ms, created_ms) > now − ACK_WINDOW_MS` (`created_ms` keeps the retry alive when Google reports an older completion time) |
| `cursorGet()/cursorSet(ms)` | `kv.voided_cursor_ms` |
| `prune(nowMs)` | Delete `rtdn_seen` older than 30 days and `invalid_tokens_v2` older than 24 h. NULL `ack_token` per the rules above. Delete bindings with `last_seen_ms` older than 400 days. Delete `CANCELLED`, non-revoked purchases (and their bindings) last updated more than 400 days ago, **never revoked rows**: those shrink to a tombstone (`origin_install_hash`, `ack_token` NULLed) so the same refunded token can never be re-granted (retention, §6.3) |
| `fakeGet/fakePut/fakeNext` | Fake store rows and the fake token counter (§3.10) |
| `grantPut/grantDelete/grantFor/grantList` | §3.12 |

There is no link handling, supersession or out-of-app logic: one-time purchases have none (revision 3). The RTDN path binds only through `obfuscatedExternalAccountId` (§3.4 rule).

The owned-pack cap (`MAX_TOKEN_PACKS = 64`) is a v1 limit. It is far above the 14 premium packs. **PAY-GAP for A** if the catalog ever approaches 64: switch the claim to a bitmap.

### 3.6 RTDN push endpoint (`/api/billing/rtdn`)

**Pre-auth guards** (cheap, before any crypto or body read), in order:
1. `RTDN_LIMITER` (key: client IP, 120/min; Pub/Sub push traffic for one app is far below this) → 429 `RATE_LIMITED` (Pub/Sub retries a 429 with backoff).
2. `Authorization` header present, ≤ `RTDN_AUTH_HEADER_MAX_CHARS` (4096), and matching `^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$` → else 401 without parsing.
3. Verify the JWT (below). Only then read the body with `readBodyLimited(req, BILLING_BODY_MAX_BYTES)` → too large → 413.

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
2. `body.subscription !== env.RTDN_SUBSCRIPTION` (`projects/<id>/subscriptions/play-rtdn-push`; empty var → 503 `NOT_CONFIGURED`) → log `{code:"RTDN_WRONG_SUBSCRIPTION"}` → 204. Defence in depth after authentication.
3. `rtdnSeen(messageId)` → 204.
4. `packageName !== env.PLAY_PACKAGE_NAME` → 204 + log.
5. Dispatch (Google calls here use a 10 s timeout and do not take from the verify bucket):
   - `oneTimeProductNotification` (any `notificationType`: 1 `PURCHASED`, 2 `CANCELED` ✔; no switch on type), for `premium` and packs alike: `refreshProduct` = `productsv2.getproductpurchasev2(token)` → normalize → `isSoldProductId` (else ignore) → `applyPurchase({ callerInstallHash: null, … })` → `ackPurchase` if `ackDue`. Only the owner's Play Console choice "Get all notifications for subscriptions and one-time products" ✔ sends these.
   - `voidedPurchaseNotification`:
     - `productType` 2 (one-time ✔; `premium` and packs) → `markRevoked(hash)`, sticky (inserts a tombstone when the token was never seen, e.g. a chargeback while the TV is offline). A refunded lifetime Premium ends at the TV's next refresh;
     - any other `productType` (1 = subscription; this app sells none) → 204 + log `{code:"RTDN_UNEXPECTED", productType}`, nothing changes.
   - `subscriptionNotification` (unexpected: no Play subscription exists) → 204 + log `{code:"RTDN_UNEXPECTED"}`, no Google call. It is parsed loosely only so such a message is acked and never redelivered.
   - `testNotification` → log `{code:"RTDN_TEST"}`.
   - otherwise (incl. `pendingRefundReviewNotification`) → 204.
6. Google failure (429/5xx/timeout/401/403) → **503**, so Pub/Sub redelivers ✔ (a non-2xx response is a nack). A Google 404/410 for the token → ignore → 204. A failed **ack** is not a failure here: the row keeps `ack_token` and the hourly cron retries it.
7. Success → `rtdnMark(messageId)` → 204.

Processing is idempotent (`applyPurchase` ordering by `google_checked_ms`, sticky flags), so a redelivery after a crash between steps 5 and 7 is harmless.

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
| `getProductV2(token)` | `GET androidpublisher/v3/applications/{pkg}/purchases/productsv2/tokens/{token}` (`premium` and packs) | `ProductPurchaseV2` |
| `ackProduct(productId, token)` | `POST androidpublisher/v3/applications/{pkg}/purchases/products/{productId}/tokens/{token}:acknowledge`, body `{}` (productsv2 has no acknowledge method ✔); `productId` is `premium` or the pack id | empty |
| `listVoided({startTimeMs, pageToken})` | `GET androidpublisher/v3/applications/{pkg}/purchases/voidedpurchases?type=0&startTime=<ms>&maxResults=1000[&token=<pageToken>]`. `type=0` = in-app (one-time) products only ✔ (`type=1` would add subscriptions; none exist). [VERIFY that `type=0` returns voided **non-consumable** one-time products such as `premium`, not only consumables.] `startTime` can be at most 30 days back ✔ | `{ voidedPurchases?: VoidedPurchase[], tokenPagination?: { nextPageToken?: string } }` |

No subscription endpoint (`subscriptionsv2.get`, `subscriptions.acknowledge`) is called (revision 3). The package name comes from `PLAY_PACKAGE_NAME`.

The `maxResults=1000` value is [VERIFY] (the server's maximum is undocumented; any accepted value works, because we paginate).

- Every call: `Authorization: Bearer <access_token>`, a timeout (`AbortController` + `setTimeout`; the caller passes it: 3 s on the verify path, 10 s for RTDN/cron), and one retry after 500 ms on 429/5xx/network errors (verify path: only if `VERIFY_DEADLINE_MS` still allows it). A 401 drops the cached access token and retries once.
- **`ackPurchase(productId, rawToken, tokenHash)`** (shared by verify, RTDN and cron):
  - 2xx → DO `markAcked(tokenHash)`;
  - 4xx → re-GET the purchase (`getProductV2`). If `acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"` → `markAcked` (a concurrent verify and RTDN both acked; the exact error Google returns for an already-acknowledged purchase is [VERIFY]). Otherwise keep `ack_token` for the cron and log `{code:"BILLING_ACK_REJECTED", status}`;
  - 429/5xx/timeout → keep `ack_token` for the cron.
- `GoogleApi` is an interface; `FakeGoogleApi` implements it. Tests inject `fetch`.
- **Token secrecy:** the raw purchase token appears in Google request URLs, so these URLs are never logged, never put in error messages or thrown `Error`s (`google.ts` throws `GoogleHttpError { status, op }` only), and tracing stays off (§3.2).

**Fields read** (`google-types.ts`, names verbatim ✔):
- `ProductPurchaseV2`: `purchaseStateContext.purchaseState`, `acknowledgementState`, `purchaseCompletionTime`, `productLineItem[].productId`, `obfuscatedExternalAccountId`, `testPurchaseContext`.
- `VoidedPurchase`: `purchaseToken`, `orderId`, `voidedTimeMillis`.

**`normalize.ts`:**
```ts
export function normalizeProduct(r: ProductPurchaseV2, checkedMs: number): NormalizedPurchase;
export interface NormalizedPurchase {
  productId: string; state: PurchaseState; acknowledged: boolean; test: boolean; obfuscatedAccountId: string | null;
  completedMs: number | null;   // Date.parse(purchaseCompletionTime) when PURCHASED; null while pending
  checkedMs: number }           // taken immediately BEFORE the Google fetch was sent
```
`acknowledged = acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"`. Test purchases (license testers) are accepted in every mode and flagged `test=1`.

### 3.8 Cron (`scheduled`, ✔ handler `(controller: ScheduledController, env, ctx)`, UTC schedule, ✔ `controller.cron` names the firing expression)

`ctx.waitUntil(run(env, controller.cron, controller.scheduledTime))`. Mode: `fakeAllowedByEnv(env)` (§3.10 conditions 1–3) → prune only; `BILLING_MODE === "fake"` without it → do nothing and log `{code:"BILLING_NOT_CONFIGURED"}`; otherwise google. Dispatch on `controller.cron`:

**Hourly `"23 * * * *"`:**
1. **Ack retries:** for each `pendingAcks(now)` → `ackPurchase` (§3.7).
2. **Overdue alert:** if any `pendingAcks` row has `windowStartMs < now − ACK_OVERDUE_ALERT_MS` (48 h), log `{code:"BILLING_ACK_OVERDUE", count}`. The owner sets a Workers Logs alert on this code (§8.D); Google auto-refunds at 3 days.

**Daily `"17 3 * * *"`:**
1. **Voided purchases:**
   - `start = max(now − 30 d + 1 h, cursor − 1 d)`;
   - page through `listVoided` (`type=0`: one-time products only, §3.7), at most 50 pages per run. For each item: `markRevoked(sha256hex(purchaseToken))`, sticky, a tombstone when never seen. No Google re-read: every in-app product of this package is one this app sells (`premium` or a pack);
   - a Google error (429/5xx/timeout/auth) → log `{code:"BILLING_UPSTREAM", op:"voided_list"}` and stop paging without moving the cursor (next run retries); more than 50 pages → keep the cursor (PAY-GAP);
   - after the last page → `cursorSet(now)`.
2. `prune(now)`.

**Accepted risk: missed RTDN.** If a `PURCHASED` (pending → paid) notification is lost, the row stays `PENDING` until the TV posts the token again (it does on every start/resume, §2.4). A lost voided notification is caught by the daily voided sweep. Keeping an encrypted raw token for reconciliation was rejected (Review log R-12).

Local test: `curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=23+*+*+*+*"` ✔ (the `cron` query parameter selects the expression; cron-triggers.mdx).

### 3.9 Errors, rate limits, logging
- Logs are JSON with a `code` only, plus counts and HTTP statuses. Never log tokens, token hashes, install ids or hashes, emails, order ids, Google request URLs or JWTs (same rule as SPEC §7.5).
- `server/src/billing/**` logs **only** through `billingLog(code, fields)` (`log.ts`): `fields` values must be numbers or booleans or one of a fixed set of enum strings (`reason`, `op`); any other string is dropped and replaced by `"[redacted]"`. An ESLint `no-console` rule (error) applies to `server/src/billing/**` except `log.ts`.
- **Test** (`billing/log.test.ts`): spy on `console.*`, run the verify, RTDN, ack and cron paths with sample purchase tokens (including a realistic 150-char token and a token that looks like 64-hex), Google error responses and thrown fetch errors, and assert that no logged argument contains the raw token, `sha256hex(token)`, the install id or its hash, or any `/[0-9a-f]{64}/` or `/tokens\//` match.
- `INTERNAL` → 500 `{"error":"INTERNAL"}`.
- Limits:
  - IP: `BILLING_LIMITER` 30/min; `/rtdn`: `RTDN_LIMITER` 120/min. Workers rate limiting is local to each Cloudflare location and "permissive, eventually consistent" ✔ (rate-limit.mdx), so these are abuse brakes, not quotas.
  - Install: verify 20 per 10 min, entitlement 60 per 10 min (LRU-bounded map).
  - Google: at most 5 reads per verify request, 3 s per call, 12 s per request, and the global verify bucket (60/min) in the Billing DO. Cached reads (10 min) and the 24 h negative cache keep repeat traffic off Google. RTDN and cron never compete with the verify bucket.
  - Room: an `entitlement` WS message goes through the normal message bucket, plus at most 6 per minute per TV connection (more → `RATE_LIMITED`). The same per-connection cap covers `storeOpen` (§3.11).

### 3.10 FAKE billing mode (dev / e2e only)

`mode.ts` exports two guards:
- `fakeAllowedByEnv(env)`: true **only if all** of
  1. `env.BILLING_MODE === "fake"`;
  2. `env.ALLOW_FAKE_BILLING === "1"`;
  3. `env.PLAY_SERVICE_ACCOUNT_JSON` is unset or empty.
- `billingModeForRequest(env, req)`: `"fake"` **only if** `fakeAllowedByEnv(env)` **and**
  4. the request host (`new URL(req.url).hostname`) is `localhost`, `127.0.0.1`, `[::1]`, or a private IPv4 (`10/8`, `172.16/12`, `192.168/16`).

**The mode is decided once, in the Worker, from the request.** `createRoom` (Worker, `http.ts`) computes `billingModeForRequest(env, req)` and passes it into the Room DO: `InitRoomArgs.billingMode: "google" | "fake"`, persisted as `RoomMeta.billingMode` (missing → `"google"`). The Room DO accepts kid `fake` / `mode:"fake"` tokens (at create and in the WS `entitlement` message) **only if** `meta.billingMode === "fake"` **and** its own `fakeAllowedByEnv(env)` (conditions 1–3) still holds. `JOIN_BASE_URL` plays no part in the mode, so the HTTP and DO paths cannot disagree, and the Playwright config needs no extra var. `scheduled()` uses `fakeAllowedByEnv` (§3.8).

If `BILLING_MODE === "fake"` but any other condition fails → every billing route returns 503 `NOT_CONFIGURED`, and rooms treat every token as invalid (fail closed). Otherwise the mode is `"google"`.

Defence in depth:
- `wrangler.jsonc` ships `BILLING_MODE:"google"`, `ALLOW_FAKE_BILLING:"0"`.
- `tools/dev.mjs` adds `--var BILLING_MODE:fake --var ALLOW_FAKE_BILLING:1`, and C's Playwright `webServer` command adds the same two `--var`s.
- `server/scripts/check-deploy.mjs` runs first in `"deploy"`. It fails if `wrangler.jsonc` vars have `BILLING_MODE !== "google"` or `ALLOW_FAKE_BILLING !== "0"`.
- A unit test asserts that each condition alone disables fake mode, and a room-core test asserts that the WS `entitlement` message with a fake-kid token is **accepted** with `billingMode:"fake"` + fake env (the e2e config) and **rejected** (`ENTITLEMENT_INVALID`) with `billingMode:"google"` or with prod env vars.
- In the TV app, the fake gateway exists only in the `debug` source set (§4.8).

**Fake tokens** are deterministic: `fake.<productId>.<n>`, where `<n>` is a per-DO counter (`fakeNext`), for example `fake.premium.1` or `fake.pack_en_food_01.2`.

`FakeGoogleApi` serves a synthetic `ProductPurchaseV2` from the `fake_purchases` table (`premium` and packs alike):
- `obfuscatedExternalAccountId` = the installHash given at fake purchase;
- `acknowledgementState` starts `PENDING`; acks flip it;
- `purchaseCompletionTime` = the time the fake purchase became `PURCHASED` (absent while `PENDING`), so the ack-window logic runs unchanged;
- `testPurchaseContext` present; `listVoided` returns nothing.

Routes:
- `POST /api/billing/fake/purchase` `FakePurchaseRequest` `{installId, productId, outcome?: "PURCHASED"|"PENDING"}` (`productId` must be sold: `premium` or a premium pack, else 400) → creates the fake row → `{purchaseToken}`. The client then calls `/verify` exactly as in production.
- `POST /api/billing/fake/set` `FakeSetRequest` `{purchaseToken, state}`:
  - `state` ∈ `PURCHASED|PENDING|CANCELLED|REVOKED`, for `premium` and packs alike (`REVOKED` stores `CANCELLED`; `PURCHASED` sets the completion time if unset);
  - the server then runs the **same** code path as an RTDN for that token (`refreshProduct`: re-read, `applyPurchase`, ack), and `markRevoked` for `REVOKED`.

### 3.11 Room integration (A: `server/src/access.ts`, `room-core.ts`, `http.ts`, shared engine and projection)

**Create.**
- `CreateRoomRequest` becomes `z.strictObject({ locale: LocaleSchema.optional(), entitlement: z.string().max(3000).optional() })`.
- `createRoom` verifies the token (§2.3) **before** drawing a code:
  - valid → `RoomEntitlement`;
  - invalid or expired → `null`.
- `InitRoomArgs` gains `entitlement: RoomEntitlement | null` and `billingMode: "google" | "fake"` (§3.10).
- `CreateRoomResponse` gains `"entitlement": "NONE" | "OK" | "INVALID"`. The TV refreshes its token when it gets `INVALID`.
- The room is created either way; an invalid token gives a free room.

**Meta.** `RoomMeta` gains `entitlement: RoomEntitlement | null`, `billingMode: "google" | "fake"` and `tvBusyUntil: number | null`. Missing fields (rooms created before deploy) mean `null` / `"google"` / `null`.

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
- **Alarm:** `at = min(existing, access.changesAt, meta.tvBusyUntil)`, so a lobby downgrades (and a stale busy flag clears) on time even if nobody acts.
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
- **WS message `storeOpen`** (C2S, TV only) — the host-busy signal, so a game never starts behind the Store or the Google Play purchase sheet:
  ```ts
  export const StoreOpenMsgSchema = z.strictObject({ v: V, t: z.literal("storeOpen"), open: z.boolean() });
  // ClientMessageSchema gains StoreOpenMsgSchema
  ```
  - Allowed only for the `tv` role (else `NOT_AUTHENTICATED`); ignored outside LOBBY.
  - `open:true` → `meta.tvBusyUntil = now + TV_BUSY_MAX_MS` (5 min; `shared/src/constants.ts`); `open:false` → `null`. Also cleared when the TV connection closes (not on a replacing connection with the same `tvToken`, which re-sends its state), when the phase leaves LOBBY, and by the alarm at `tvBusyUntil` (`at = min(existing, access.changesAt, meta.tvBusyUntil)`).
  - The TV sends `open:true` when the Store opens and keeps it open (re-sends every 4 min) while the Store or the Play purchase sheet is up; it sends `open:false` when the Store closes **and** no purchase flow is in progress.
  - While `tvBusy`, `START` from a **phone** (VIP) → error `TV_BUSY` (non-fatal); START from the TV is impossible because the Store covers the lobby. `PLAY_AGAIN` from RESULTS is unaffected (the Store only opens in LOBBY).
- **New error codes** (`errors.ts`, all non-fatal, no close code):
  - `PREMIUM_REQUIRED` (`error.premiumRequired`; the TV shows `tv.premiumRequired` instead, §4.4)
  - `PACK_LOCKED` (`error.packLocked`; TV: `tv.packLocked`)
  - `ENTITLEMENT_INVALID` (`error.entitlementInvalid`)
  - `TV_BUSY` (`error.tvBusy`)

**View additions** (`PublicView`, every key always present; appended **after** `availablePacks`, in this order):

| Key | Type | Rule |
|---|---|---|
| `premium` | boolean | `access.premium` at projection time |
| `lockedPacks` | `LockedPackInfo[]` | LOBBY only, else `[]`. `{ id, locale, title:{en,fr,ar}, pairCount, ageRating, productId }` (`pairCount` passes the current `difficulties` filter). **No words, no pair ids** |
| `tvBusy` | boolean | LOBBY and `meta.tvBusyUntil > now`, else `false` |
| `poolExhausted` | boolean | LOBBY and `!premium` and the playable pool under the current settings (same filters as `pickPair`: packIds, wordLocale, difficulties, age) is non-empty **and** every one of its pair keys is in `usedPairKeys` (so the next game repeats a pair, SPEC §12.4 reset). Else `false`. A boolean only: no keys, no counts |

- `availablePacks` keeps its meaning, and it is now computed from the **playable** catalog. `PackInfo` gains a final key `tier: "free" | "premium"`.
- `PackInfoSchema`, `PublicViewSchema` and Kotlin `PackInfo`/`TvView` are updated (Kotlin: `val premium: Boolean`, `val lockedPacks: List<LockedPackInfo>`, `val tvBusy: Boolean`, `val poolExhausted: Boolean`, `data class LockedPackInfo(val id: String, val locale: String, val title: LocalizedTitle, val pairCount: Int, val ageRating: String, val productId: String)`, and `PackInfo` gets `val tier: String`).
- **Fixtures (A):** regenerate the G fixtures. Update the V fixture `s2c.state.tv.voting.json` with `"premium": false, "lockedPacks": [], "tvBusy": false, "poolExhausted": false` after `availablePacks`. The **free** TEST_CATALOG has one free and one premium pack per language (§7), so `s2c.state.tv.lobby.json` shows a non-empty `lockedPacks`.
- New V fixtures:
  - `c2s.entitlement.json`: `{ "v": 1, "t": "entitlement", "token": "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6ImsxIn0.e30.c2ln" }`
  - `c2s.storeOpen.json`: `{ "v": 1, "t": "storeOpen", "open": true }`
  - `http.create_room.request.json` → `{ "locale": "fr", "entitlement": "<same token>" }`
  - `http.create_room.response.json` gains `"entitlement": "OK"`
  - `http.billing.catalog.response.json` (`premium: { productId: "premium" }`), `http.billing.verify.request.json` (one `premium` + one pack purchase), `http.billing.verify.response.json` (no `subscription` key), `http.billing.entitlement.request.json`, `billing.products.json` (§1.3)

  A writes them from the §3.4 shapes. B decodes `catalog`, `verify.response` and `create_room.response` in `ProtocolFixturesTest`.

**Sim and tests** construct `RoomCore` with an explicit `entitlement` (sim engine mode passes the full catalog, which is equivalent to premium).

### 3.12 Admin grants (owner comps; `server/src/admin.ts`, CLI `server/scripts/grant.mjs`)

The owner can give premium and/or premium packs to specific installs (e.g. a sideloaded TV of their own) without a Google purchase.

- **Switch:** the optional Workers secret `ADMIN_TOKEN` (≥ 32 characters; `openssl rand -hex 32`). Unset or shorter → every `/api/admin/*` path answers **404** (indistinguishable from a missing route). It is never a `vars` entry and never in `secrets.required` (`check-deploy.mjs` enforces both).
- **Auth:** `Authorization: Bearer <ADMIN_TOKEN>` only (never a URL or body field). Both sides are SHA-256-hashed and compared in constant time (`timingSafeEqualHex`). Missing, malformed or wrong → **401** `{error:"UNAUTHORIZED"}` with `WWW-Authenticate: Bearer`. Rate limit first (before the token check): `BILLING_LIMITER` keyed `admin:<ip>` → 429. Nothing about the request is logged (a failure logs only `{"code":"ADMIN_INTERNAL"}`). No origin check: a browser cannot send the bearer token cross-site without already knowing it.
- **Endpoints** (`/api/admin/grants`, JSON, `Cache-Control: no-store`):
  - `POST` `{ installId, premium?: true, packs?: string[], expiresAt?: number|null /* ms */, note?: string /* ≤ 200 */ }` — at least `premium:true` or one pack. Pack ids must be **premium** catalog packs (`400 {error:"UNKNOWN_PACK", packs}` otherwise); a past `expiresAt` → `400 {error:"EXPIRED"}`. Upserts the install's grant (a new POST replaces it). → `200 {grant}`.
  - `DELETE` `{ installId }` or `{ installHash }` (the 64-hex hash that `GET` lists) → `200 {revoked: boolean, installHash}`.
  - `GET` → `200 {grants: [{installHash, premium, packs, expiresAt, note, createdAt, active}]}`, newest first (expired grants stay listed with `active:false` until revoked).
- **Storage:** Billing DO SQLite table `grants (install_hash TEXT PRIMARY KEY, premium INTEGER, packs TEXT /* JSON array */, expires_ms INTEGER NULL, note TEXT NULL, created_ms INTEGER)`. Only `sha256hex(installId)` is stored, like `bindings`. Grants never create `purchases` or `bindings` rows, so they never count toward `MAX_INSTALLS_PER_PURCHASE`, and they never call Google. `prune` leaves them alone.
- **Entitlement:** `entitlementFor(installHash)` merges an unexpired grant into the result: premium → `premiumUntilMs = max(purchases, grant.expiresAt ?? now + ENTITLEMENT_TTL_S·1000)` (an open-ended grant lasts as long as the token itself, `pu = exp`, and every refresh extends it); packs → added (filtered to premium packs). The token is the normal signed entitlement token, so `/entitlement`, `/verify`, `createRoom` and the room's `entitlement` message need no change, in both google and fake mode. The TV picks a new grant up on its next refresh (§2.4: app start when stale, Store open, Restore purchases, or before the token expires).
- **CLI:** `pnpm grant <installId> [--packs a,b] [--premium] [--expires YYYY-MM-DD|ISO] [--note text]`, `pnpm grant list`, `pnpm grant revoke <installId|installHash>`; server from `--url` or `MISHANA_URL`, token from the `ADMIN_TOKEN` environment variable only (docs/DEV.md "Admin grants").
- **Install id on the TV:** Settings → **About** (DESIGN TV-03) shows it in groups of four; the CLI drops the spaces.

---

## 4. TV app (B)

### 4.1 Dependencies, manifest, files
- `libs.versions.toml`: `billing = "9.1.0"` ✔ (docs and release notes) and `play-billing = { group = "com.android.billingclient", name = "billing", version.ref = "billing" }` → `implementation(libs.play.billing)`.
  - Do **not** add `billing-ktx`: wrap the callback APIs with `suspendCancellableCoroutine` yourself, so no unverified ktx signatures are needed.
  - [VERIFY] the artifact resolves on Google Maven (blocked here).
  - PBL 9 sets targetSdk 35 ✔ and minSdk 23 ✔. Ours is 26 / 36, which is fine.
  - PBL 9's mapping of a blocked Play Store to `BILLING_UNAVAILABLE` needs **androidx.core ≥ 1.9** ✔ (9.0.0 release notes). The project pins `core-ktx` 1.19.1, which satisfies it; keep it ≥ 1.9.
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
  suspend fun queryProducts(ids: List<String>): GatewayResult<ProductsSnapshot>   // one INAPP query: `premium` + pack ids
  suspend fun queryOwned(): GatewayResult<List<OwnedPurchase>>  // INAPP, PURCHASED or PENDING
  fun launch(activity: Activity, offer: PurchasableOffer, obfuscatedAccountId: String): GatewayResult<Unit>
  fun end()
  fun onLifecycleStart() {}                                       // BILLING_UNAVAILABLE retry (§4.2)
  val isFake: Boolean get() = false; val fakePrompt: FakePurchasePrompt? get() = null   // §4.8
}
data class OwnedPurchase(val productId: String, val purchaseToken: String, val state: OwnedState /* PURCHASED, PENDING */)
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
  - Call `startConnection(BillingClientStateListener)` **once**, guarded by a single in-flight flag (concurrent calls await the same `CompletableDeferred`). `onBillingServiceDisconnected()` is a no-op apart from state, because auto-reconnect re-establishes the connection when an API is called ✔.
  - Retry manually **only** when `onBillingSetupFinished` reports `SERVICE_UNAVAILABLE`/`SERVICE_DISCONNECTED`/`ERROR`/`NETWORK_ERROR`: `ReconnectPolicy.delayMs(attempt)`, up to 5 times, never while a call is in flight; then expose `StoreUiState.Unavailable(NETWORK)`.
  - `BILLING_UNAVAILABLE` (3) is terminal **until the next `ON_START`** (no Play Store, no Google account, kids profile or a blocked Play Store ✔ PBL 9 mapping). The user may sign in or leave the kids profile and come back, so the next `ON_START` tries once more.
- Connect on app start (`MainActivity.onCreate` → repository `start()`) and in `onStart` when not ready. Keep the connection for the whole process; the docs recommend an active connection while in the foreground ✔. Call `endConnection()` only in `MainActivity.onDestroy` when `isFinishing`.
- **Products** (INAPP only; there is no SUBS query anywhere):
  - **One** `queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), listener)` for `premium` + every pack product id, one `Product` per id built with `QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build()`. The pack ids come from the catalog (or `view.lockedPacks` when it failed), so the query starts once the catalog answered; `connect()` runs alongside (PAY-GAP).
  - Listener: `onProductDetailsResponse(BillingResult, QueryProductDetailsResult)` → `productDetailsList` + `unfetchedProductList` (`statusCode` `PRODUCT_NOT_FOUND` = 3, `NO_ELIGIBLE_OFFER` = 4 ✔).
  - Do **not** cache `ProductDetails` across store openings ✔ (stale objects make `launchBillingFlow` fail).
- **Offer:** `productDetails.oneTimePurchaseOfferDetails` (single offer), for `premium` and packs alike. `oneTimePurchaseOfferDetailsList` is non-null **only** with multiple offers ✔, so use `oneTimePurchaseOfferDetailsList?.firstOrNull() ?: oneTimePurchaseOfferDetails`. Price = `formattedPrice` (a Play Console sale on `premium` shows here automatically), token = `offerToken`.
- **Launch (main thread):**
  ```kotlin
  BillingFlowParams.newBuilder()
    .setProductDetailsParamsList(listOf(BillingFlowParams.ProductDetailsParams.newBuilder()
        .setProductDetails(pd).setOfferToken(offerToken).build()))
    .setObfuscatedAccountId(InstallId.hash(installId))
    .build()
  ```
  Then `launchBillingFlow(activity, params)` returns a `BillingResult`; non-OK is mapped with §4.6. No product (or no `offerToken`) → toast `store.itemUnavailable`.
- **`onPurchasesUpdated(result, purchases)`:**
  - `OK` → for each purchase: `purchaseState == PURCHASED` → verify; `PENDING` → `StoreUiState.pending += productIds`;
  - `USER_CANCELED` → silent;
  - `ITEM_ALREADY_OWNED` → run restore;
  - others → toast (§4.6).
- **Restore:**
  - `queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(INAPP).build(), listener)` ✔ (one call; `premium` and packs). Listener: `onQueryPurchasesResponse(BillingResult, List<Purchase>)`.
  - Read `purchase.products`, `purchaseToken`, `purchaseState` ✔.
  - `PURCHASED` purchases are posted to `/verify`; `PENDING` ones only set `StoreUiState.pending` (never posted as owned).
  - Play unreachable → refresh through `/entitlement` when forced or stale (the server still knows this TV's bindings).
  - Runs on app start and on every `ON_START`/`ON_RESUME` (§2.4 rule 1).
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
  - a collector on `BillingRepository.entitlement` that calls it;
  - `fun sendStoreOpen(open: Boolean)` (§3.11 `storeOpen`), driven by `StoreUiState.busy = storeVisible || purchaseFlowInFlight`, re-sent every 4 min while true and after every reconnect `welcome`.
- Keep `RoomSocket` message handling unchanged otherwise. Add the `ErrorMsg` codes `PREMIUM_REQUIRED` → toast `tv.premiumRequired`, `PACK_LOCKED` → `tv.packLocked`, `ENTITLEMENT_INVALID` → `error.entitlementInvalid`, and `TV_BUSY` (never expected on the TV; ignore) to the toast handling (keys via `I18nKeys`).

### 4.4 Store screen and paywall entry points (remote only)

The Store is an overlay in `InRoom` (`TvUiState.InRoom.store: StoreEntry?`, `data class StoreEntry(val focusProductId: String?, val origin: StoreOrigin /* LOBBY_BUTTON, LOCKED_PACK, LOCKED_SETTING */)`).
- It opens **only in LOBBY**. While it is open, or while a Play purchase flow started from it is in flight, the TV sends `storeOpen{open:true}` (§3.11), so phones cannot start a game behind it (`TV_BUSY`). If the phase still leaves LOBBY (e.g. the TV connection dropped and the busy flag lapsed), close it; the purchase and verify flow keeps running in `BillingRepository`, and its toast is deferred (toast rule below).
- **Back** closes it and returns focus to the element that opened it (remember that element's `FocusRequester`).

**Entry points:**
1. **Lobby bottom bar:** a new button with the new icon `gem` (24×24 stroke style, does **not** mirror; added to DESIGN §5.1, see the DESIGN deltas below) and the **fixed** label `lobby.premium` (short in all 3 locales; never swapped for a longer label). Order: **Premium · Settings · Language · Start** (Premium at the start of the bar, so Start stays at the end where focus already expects it). `focusProductId = null` puts the initial focus on the **Unlock Premium** button (Focus below).
   - **Fit rule:** the bar starts at x ≥ 370 dp and must fit in 960 − 48 − 370 = 542 dp with Start at 200 dp, in EN/FR/AR. If the labelled Premium button does not fit next to Settings and Language (B's measurement test, §4.9), Premium becomes an **icon-only 48 × 48 dp** button with a focus tooltip (`lobby.premium`) and `contentDescription`.
   - **Premium status** is not shown on the button. When `view.premium`, the top-end **settings summary** (DESIGN TV-02) gains a chip `gem` + `lobby.premiumRoom` as its first line; phones already show the same chip (§5.1).
2. **Settings → Words → Packs sub-panel:** the playable packs (`availablePacks`) appear as today. Below a divider, `lockedPacks` rows show a `LockBadge`, the title, `store.packPairs` and `settings.unlockHint` (or `settings.locked` while billing is unavailable, see the state machine). OK on a locked row → Store with `focusProductId = lockedPack.productId`, `origin = LOCKED_PACK`.
3. **Settings → Game → Points rows** (each `PREMIUM_SETTING_KEYS` row) when `!view.premium`: moved to the **bottom** of the Game category (so the category's initial focus never lands on a lock). The row shows `LockBadge` + `settings.premiumOnly`; **Left/Right** play the DESIGN "disabled shake" + `sfx.error` (as Start does for `NOT_ENOUGH_PLAYERS`); **OK** opens the Store with `focusProductId = "premium"`, `origin = LOCKED_SETTING`. (DESIGN TV-03 "OK also steps" does not apply to locked rows; see the DESIGN deltas.)
4. **Error `PREMIUM_REQUIRED` / `PACK_LOCKED`** received while in Settings: toast `tv.premiumRequired` / `tv.packLocked` (TV register, no "on the TV"). The TV does not auto-open the Store.

**Paywall timing (market study, revision 3):** the TV **never** auto-opens the Store (unchanged); the Store opens only from the entry points above. A light, dismissible "after the first finished game" prompt on Results is a **FOLLOW-UP, not specified yet**; implementers must not build it from this revision.

**Store state machine** (`StoreUiState.phase`, pure, tested in `StoreFocusTest`/`BillingRepositoryTest`):
- `Loading`: spinner + `store.loading`; Back works; it starts `GET /api/billing/catalog` and `connect()` in parallel, then the one INAPP `queryProductDetailsAsync` (§4.2). Timeout 10 s → `Unavailable(NETWORK)`.
- `Ready`: the layout below.
- `Unavailable(reason)`:
  - `NETWORK` (the Play product query failed with anything but `BILLING_UNAVAILABLE`, whether or not the catalog answered (PAY-GAP: with no Play data nothing is buyable), or the timeout): text `store.unavailable` + a focused **Try again** button (`common.retry`) → back to `Loading`.
  - `BILLING_UNAVAILABLE` (Play reports 3): text `store.playUnavailable` ("To buy on this TV, sign in to Google Play in the TV's settings."), **no** Try again; the focus target is a single **OK** button (`common.ok`) that closes the Store. While in this state for the session (until the next `ON_START`), locked rows in Settings show `settings.locked` instead of `settings.unlockHint`, and OK on them shows the toast `store.playUnavailable` instead of opening the Store.
- **Partial data** stays `Ready`:
  - catalog fetch failed but Play answered → build the pack list from `view.lockedPacks` (it carries `productId`, `title`, `pairCount`) for the room's word language only, and hide "Other languages";
  - Play returned no `premium` `ProductDetails` (`PRODUCT_NOT_FOUND`, or no `offerToken`) → the Premium card shows `store.unavailable` and no button; pack cards stay buyable.
- Something is always focused (DESIGN rule): in every state, the initial focus target is defined above or in Focus below.

**Layout** (960×540 dp canvas, 48/27 dp safe margins; DESIGN tokens). Header: `store.title` at the start, and the **room code** at the end (same style as the in-game top-bar mini code, LTR-isolated), so the host can still read it out to late arrivals; the QR stays reachable by closing the Store. Footer row: `store.restore` button and **one** caption line (`StoreMetrics.footerLine`), first match wins: `store.pendingBody` (a pending purchase); `store.cardTip` with `{url}` = `pay.google.com` while nothing is owned on this account (no premium, no pack; so nobody types a card number with the remote; Google's own page, not another way to pay); `store.help` (support email); nothing when the email is empty. Footer hint "Back".

1. **Premium card**, full width, top:
   - `store.premiumTitle`, then `store.premiumPitch` (with the concrete counts from `CatalogResponse`: `{count}` = number of premium packs, `{pairs}` = their total `pairCount` rounded **down** to a multiple of 10).
   - **Not premium:** **one** primary button `store.unlockPremium` ("Unlock Premium · {price}", Play's INAPP `formattedPrice`, single line), then the line `store.premiumLifetime` ("One-time purchase, yours for good. No subscription."). A pending `premium` purchase shows `store.pending` on the button instead of the price; while confirming it shows the spinner + `store.confirming` (then `store.verifyFailed`); in those states the button stays focusable and OK does nothing.
   - **Premium** (lifetime purchase or owner grant; `premium && premiumUntil > now`): `store.premiumActive`, no button (no Manage: there is nothing to manage).
   - **No premium product** (partial data above): `store.unavailable`, no button.
2. **Packs**, below the card: a horizontal `LazyRow` of pack cards (`focusRestorer()`), the room's word language first, then the other languages after a `store.otherLanguages` divider card. Card: title (in the UI locale), `store.packPairs`, and the trailing state, exactly one of:
   - `store.owned` (owned);
   - `store.included` (premium active, **or** the product was not fetched from Play: §1.4);
   - `store.pending` chip (pending purchase);
   - Buy button `store.buy` with `{price}` (fetched, not owned, not premium).

**Fit rule (hard):** the Premium card (title + pitch, the Unlock button, the `store.premiumLifetime` line) must fit **without scrolling** above the packs row at the 20 sp TV floor in every shipped UI locale (EN, FR, AR, ES). B's measurement test (`StoreLayoutFitTest`, `StoreMetrics`) checks it at 960 dp (§4.9).

**Focus and D-pad:**
- The initial focus follows `focusProductId`: a pack product id present in the Store → that pack card; otherwise (`"premium"`, `null`, or an unknown id) → the **Unlock Premium** button when it shows, else (premium on, or no premium product) the first pack card, else **Restore**.
- Left/Right move within a row (pack cards); Up/Down move between the card, the packs row and the footer (Compose geometry; RTL mirrors Left/Right). OK activates.
- Cards without a Buy button stay focusable and announce their state. OK on them does nothing.
- No element needs a Menu key or long-press.

**While a purchase is in flight:**
- the Play purchase sheet covers the app ✔ ("the system displays the Google Play purchase screen");
- on return, the button the user started from shows a spinner and `store.confirming` until `/verify` answers, at most 15 s, after which it shows `store.verifyFailed` and keeps retrying in the background.

**After a pack purchase started from a locked row** (`origin = LOCKED_PACK`) succeeds:
- if the room is in LOBBY, `settings.packIds` is non-empty, and the pack's language equals the room's word language → the TV sends `UPDATE_SETTINGS { packIds: [...packIds, packId] }` and shows `store.addedToGame`;
- if the pack is in another word language → toast `store.switchLanguage` (`{lang}` = the language name); nothing changes automatically;
- with `packIds: []` ("all playable") nothing needs to change: the pack is already in the pool.

**PENDING purchases:**
- the Unlock button or pack card shows `store.pending`, and the footer shows `store.pendingBody`;
- no access is granted;
- when the payment completes, `onPurchasesUpdated` fires again (if running) or the next start/resume restore picks it up ✔.

**Billing toasts** (`store.unlocked`, `store.restored`, `store.verifyFailed`, `store.addedToGame`, pending completions, `lobby.premiumEnded`, `lobby.wordsRepeating`): shown immediately only while the Store is open or the phase is LOBBY/RESULTS. Otherwise at most **one** is queued (the latest wins) and shown on the next LOBBY/RESULTS. They count toward DESIGN's max-2 toasts. `EntitlementMsg` WS sends are never delayed.

**Downgrade notice:** when `view.premium` flips true → false while in LOBBY, or on the first LOBBY after a game during which it flipped, show the toast `lobby.premiumEnded` once (per flip). Never auto-open the Store.

**Free pool exhausted:** when `view.poolExhausted` becomes true in LOBBY, show the toast `lobby.wordsRepeating` once per room session. Never auto-open the Store.

### 4.5 Purchase disclosure

One-time purchase: the line `store.premiumLifetime` under the Unlock button says so; no subscription disclosure (price period, renewal, cancel) is needed, and no manage-subscription link exists (revision 3).

### 4.6 Error mapping (`BillingErrors.kt`; codes ✔ `BillingClient.BillingResponseCode`)

| Code | UI |
|---|---|
| `OK` (0) | — |
| `USER_CANCELED` (1) | nothing |
| `SERVICE_UNAVAILABLE` (2), `NETWORK_ERROR` (12), `SERVICE_DISCONNECTED` (−1) | toast `store.network` |
| `BILLING_UNAVAILABLE` (3) | Store → `Unavailable(BILLING_UNAVAILABLE)` (§4.4 state machine) until the next `ON_START` |
| `ITEM_UNAVAILABLE` (4) | toast `store.itemUnavailable` |
| `DEVELOPER_ERROR` (5), `ERROR` (6), `FEATURE_NOT_SUPPORTED` (−2) | toast `store.errorGeneric` (+ `Log.w` with the code, debug builds only) |
| `ITEM_ALREADY_OWNED` (7) | toast `store.alreadyOwned` + restore |
| `ITEM_NOT_OWNED` (8) | `store.errorGeneric` |
| Server `UPSTREAM_ERROR`/HTTP 5xx | `store.verifyFailed` (auto retry) |
| Server `INSTALL_LIMIT` | `store.installLimit` (includes the support email, `store.help`) |
| Server `RATE_LIMITED` | `error.rateLimited` |

`launchBillingFlow` sub-response codes (PBL 8 ✔: `PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS`, `USER_INELIGIBLE`) → `store.errorGeneric`; v1 does not specialise them.

### 4.7 i18n keys (A adds them to `shared/i18n/{en,fr,ar,es}.json` and regenerates the Android strings)

Revision 3: Spanish (`es`) is a 4th UI language. The table lists EN/FR/AR; `es.json` carries the same keys with matching placeholders and plural forms (`i18n/keys.test.ts` checks all four).

Register rules (DESIGN §1.5): FR uses *vous* on TV-only keys and *tu* on phone-only keys; keys marked (TV)/(phone) follow that, unmarked keys are neutral. AR never uses a masculine-singular imperative: buttons are nouns or first person, TV text uses the plural, phone text uses noun or impersonal forms. AR drafts follow DESIGN's Levantine tone; **the owner reviews every AR string before release**. FR values below already contain **U+202F** (narrow no-break space) before `! ? : ;`; A writes them byte-exact.

| Key | EN | FR | AR |
|---|---|---|---|
| `lobby.premium` | Premium | Premium | بريميوم |
| `lobby.premiumRoom` | Premium room | Partie Premium | غرفة بريميوم |
| `lobby.premiumEnded` (TV) | Premium has ended. Your free packs are still here. | Premium est terminé. Vos packs gratuits sont toujours là. | خلص البريميوم. الباقات المجانية بعدها هون. |
| `lobby.premiumEndedPhone` (VIP phone) | Premium has ended for this room. Free packs still work. | Premium est terminé pour cette partie. Les packs gratuits marchent toujours. | خلص البريميوم بهالغرفة. الباقات المجانية شغّالة. |
| `lobby.wordsRepeating` (TV) | You've played every free word. More packs in Premium. | Vous avez joué tous les mots gratuits. Plus de packs avec Premium. | لعبتوا كل الكلمات المجانية. في باقات أكتر مع البريميوم. |
| `store.title` | Premium & word packs | Premium et packs de mots | بريميوم وباقات كلمات |
| `store.premiumTitle` | Premium | Premium | بريميوم |
| `store.premiumPitch` (P on `{count}` = premium packs; `{pairs}` = pairs, rounded down to 10) | one: {count} word pack ({pairs}+ word pairs), and every new one. / other: All {count} word packs ({pairs}+ word pairs), and every new one. | one: {count} pack de mots ({pairs}+ paires), et tous les nouveaux. / other: Les {count} packs de mots ({pairs}+ paires), et tous les nouveaux. | other: كل الباقات ({count}) و{pairs}+ زوج كلمات، وكل باقة جديدة. (same text for every AR form; the count is shown as a number in brackets to avoid noun agreement) |
| `store.unlockPremium` | Unlock Premium · {price} | Débloquer Premium · {price} | افتح البريميوم · {price} |
| `store.premiumLifetime` | One-time purchase, yours for good. No subscription. | Achat unique, à vous pour de bon. Sans abonnement. | دفعة وحدة، إلك للأبد. بلا اشتراك. |
| `store.premiumActive` | Premium is on | Premium est activé | البريميوم شغّال |
| `store.packsTitle` | Word packs | Packs de mots | باقات الكلمات |
| `store.otherLanguages` | Other languages | Autres langues | لغات تانية |
| `store.packPairs` (P) | one: {count} word pair / other: {count} word pairs | one: {count} paire de mots / other: {count} paires de mots | zero/one/two/few/many/other drafts (other: "{count} زوج كلمات") |
| `store.buy` | Buy · {price} | Acheter · {price} | شراء · {price} |
| `store.owned` | Owned | Acheté | صار معكن |
| `store.included` | Included with Premium | Inclus dans Premium | ضمن البريميوم |
| `store.pending` | Payment pending | Paiement en attente | الدفع معلّق |
| `store.pendingBody` | It unlocks as soon as Google Play confirms the payment. | Il se débloque dès que Google Play confirme le paiement. | بيفتح أول ما Google Play يأكد الدفع. |
| `store.confirming` | Confirming… | Confirmation… | عم نأكد… |
| `store.unlocked` | Unlocked! Have fun. | Débloqué ! Amusez-vous bien. | انفتح! انبسطوا. |
| `store.addedToGame` | Added to this game | Ajouté à cette partie | انضافت للعبة |
| `store.switchLanguage` | Switch the word language to {lang} to play it. | Passez la langue des mots en {lang} pour y jouer. | غيّروا لغة الكلمات لـ{lang} لتلعبوها. |
| `store.restore` | Restore purchases | Restaurer les achats | استرجاع المشتريات |
| `store.restored` | Purchases restored | Achats restaurés | رجعت المشتريات |
| `store.nothingToRestore` | No purchases found on this Google account | Aucun achat trouvé sur ce compte Google | ما في مشتريات على حساب Google هيدا |
| `store.help` | Need help? {email} | Besoin d'aide ? {email} | بدكن مساعدة؟ {email} |
| `store.cardTip` (TV footer; `{url}` = `pay.google.com`) | No card? Add one on your phone: {url} | Pas de carte ? Ajoutez-la sur votre mobile : {url} | ما عندكن بطاقة؟ زيدوها من تلفونكن: {url} |
| `store.loading` | Loading the store… | Chargement de la boutique… | عم يحمّل المتجر… |
| `store.unavailable` | The store isn't available right now. Try again later. | La boutique n'est pas disponible. Réessayez plus tard. | المتجر مش متاح هلّق. جرّبوا بعدين. |
| `store.playUnavailable` | To buy on this TV, sign in to Google Play in the TV's settings. | Pour acheter sur ce téléviseur, connectez-vous à Google Play dans les paramètres du téléviseur. | لتشتروا عهالتلفزيون، فوتوا عحساب Google Play من إعدادات التلفزيون. |
| `store.network` | Can't reach Google Play. Check the connection. | Impossible de joindre Google Play. Vérifiez la connexion. | ما عم نوصل لـ Google Play. شيكوا عالإنترنت. |
| `store.itemUnavailable` | This item isn't available right now. | Cet article n'est pas disponible pour le moment. | هالشي مش متاح هلّق. |
| `store.errorGeneric` | The purchase didn't go through. If you were charged, it will unlock automatically. | L'achat n'a pas abouti. Si vous avez été débité, il se débloquera automatiquement. | الشرا ما مشي. إذا انخصم شي، بيفتح لحاله. |
| `store.alreadyOwned` | You already own this. Restoring… | Vous l'avez déjà. Restauration… | هيدا معكن من قبل. عم نرجّعه… |
| `store.verifyFailed` | Purchase received. We'll finish unlocking it shortly. | Achat reçu. Le déblocage se termine dans un instant. | وصل الشرا. رح نخلّص الفتح بعد شوي. |
| `store.installLimit` | This purchase is already used on too many TVs. Need help? {email} | Cet achat est déjà utilisé sur trop de téléviseurs. Besoin d'aide ? {email} | هالشرا مستعمل على تلفزيونات كتير. بدكن مساعدة؟ {email} |
| `store.installLimitNoHelp` | This purchase is already used on too many TVs. | (first sentence of `store.installLimit`) | (first sentence of `store.installLimit`) |
| `store.testMode` | Test store: no real payments | Boutique de test : aucun paiement réel | متجر تجريبي: ما في دفع حقيقي |
| `store.tvAppOnly` (TV mock, google mode) | Purchases are available in the Android TV app. | Les achats sont disponibles dans l'application Android TV. | المشتريات متاحة بتطبيق Android TV. |
| `settings.locked` | Locked | Verrouillé | مقفول |
| `settings.premiumOnly` | Premium | Premium | بريميوم |
| `settings.unlockHint` | Press OK to unlock | Appuyez sur OK pour débloquer | كبسوا OK لتفتحوه |
| `settings.unlockOnTv` (phone) | Unlock on the TV | Débloque-le sur la télé | بينفتح من التلفزيون |
| `settings.lockedPacks` | More packs | Plus de packs | باقات زيادة |
| `tv.packLocked` (TV toast) | This pack is locked. Open Premium to unlock it. | Ce pack est verrouillé. Ouvrez Premium pour le débloquer. | هالباقة مقفولة. افتحوا بريميوم لتفتحوها. |
| `tv.premiumRequired` (TV toast) | This needs Premium. Open Premium to unlock it. | Il faut Premium. Ouvrez Premium pour le débloquer. | بدها بريميوم. افتحوا بريميوم لتفتحوها. |
| `error.premiumRequired` (phone) | This needs Premium. Unlock it on the TV. | Il faut Premium. Débloque-le sur la télé. | بدها بريميوم، بينفتح من التلفزيون. |
| `error.packLocked` (phone) | This pack is locked. Unlock it on the TV. | Ce pack est verrouillé. Débloque-le sur la télé. | هالباقة مقفولة. بتنفتح من التلفزيون. |
| `error.entitlementInvalid` | Couldn't check purchases. Free packs still work. | Impossible de vérifier les achats. Les packs gratuits marchent toujours. | ما قدرنا نتأكد من المشتريات. الباقات المجانية شغالة. |
| `error.tvBusy` (phone) | The TV is in the store. The game can start once it closes. | La télé est dans la boutique. La partie pourra commencer quand elle sera fermée. | التلفزيون بالمتجر هلّق. اللعبة بتبلّش بس يسكّر. |

Removed in revision 3 (no subscription): `store.planMonthly`, `store.planYearly`, `store.pricePerMonth`, `store.pricePerYear`, `store.trialDays`, `store.renewsOn`, `store.endsOn`, `store.manage`, `store.manageHint`, `store.fixPayment`, `store.fixPaymentButton`, `store.legal*` (`legalPriceRenew`, `legalTrialRenew`, `legalCancel`, `legalCancelTrial`) and `store.period*` (`periodMonth`, `periodYear`). Removed earlier (revision 1 → 2): `store.startTrial`, `store.subscribe`, `store.onHold`, `store.legalPrice`/`legalTrial`/`legalRenew`.

**Placeholders and bidi:**
- `{price}` is Play's `formattedPrice`, verbatim (a Play Console sale on `premium` shows its sale price there). No billing string has a `{date}` any more (revision 3).
- Every interpolated value (`{price}`, `{count}`, `{pairs}`, `{email}`, `{lang}`, `{url}`) is bidi-isolated: Android `BidiFormatter.getInstance(isRtl).unicodeWrap(value)` before substitution; web `<bdi>` (or FSI…PDI in plain strings), per DESIGN §3.4.
- `{email}` is `SUPPORT_EMAIL` in `shared/src/billing/products.ts` (`alexkhoury@hotmail.com`, the same address as the Play listing; public on the landing page). An empty value hides `store.help` and drops the "Need help?" sentence from `store.installLimit` (A generates the variant key `store.installLimitNoHelp` = first sentence only).
- `{lang}` is the language's own name (`common.language.<code>` if present, else `English`/`Français`/`العربية`).

**FR typography test:** `i18n/keys.test.ts` fails on any FR value matching `/ [!?:;]/` (an ordinary space before those marks). Existing FR values that break it (e.g. `settings.rolePreview`, `elim.eliminated`, `elim.wasCivilian`, `elim.blankGetReady`, `guess.silence`, `tv.cluesNoTimer`, `tv.backToCategories`, `tv.soundOn`, `tv.soundOff`, `tv.backToLobby`) are normalised to U+202F by A in the same change.

**DESIGN deltas** (this file wins; DESIGN.md is updated by the owner or A to match):
- §5.1 icon table: add `gem` (cut gemstone outline, 24×24 stroke style, does not mirror) for Premium. `crown` stays reserved for host/VIP.
- TV-02 bottom bar: "Premium (`gem`) · Settings · Language · Start", Premium icon-only if the fit rule (§4.4) requires it; the settings summary gains the `lobby.premiumRoom` chip when premium.
- TV-03: locked rows (premium settings) do not step on OK/Left/Right; Left/Right shake + `sfx.error`, OK opens the Store.
- §10 test list: add a bidi screenshot case for a billing string with `{price}` in AR.

### 4.8 DebugSettings and fake billing (debug builds only)
- `DebugSettingsScreen` gains the toggle `Billing: Google Play / Fake (server test store)`, stored as `DebugPrefs.fakeBilling`.
- `FakeBillingGateway` (debug source set):
  - `queryProducts` returns synthetic one-time products: `premium` at "$7.99", each `pack_*` at "$1.99";
  - `launch` shows a remote-friendly confirm dialog ("Fake purchase: Approve / Pending / Cancel / Error"), then calls `POST /api/billing/fake/purchase` and emits a `PurchaseUpdate` with the fake token;
  - `queryOwned` returns the tokens remembered in debug prefs.
- The Store shows the banner `store.testMode`.
- In fake mode the server must run with fake billing (`pnpm dev`). If `/api/billing/catalog` says `mode:"google"`, the Fake toggle shows "Server is in Google mode" and is ignored.

### 4.9 TV tests (B; JVM unit tests; also run in the pure-Kotlin harness `scratchpad/tv-verify` where possible, since Gradle cannot run here)
- `ProductsTest` (fixture `billing.products.json`).
- (Revision 3: `OfferSelectionTest` is gone; there is one one-time offer per product.)
- `BillingErrorsTest`: every row of §4.6.
- `EntitlementApiTest` (MockWebServer): verify request body shape, response decoding, `INSTALL_LIMIT`.
- `ProtocolFixturesTest` additions: the new view keys, `c2s.entitlement.json` encode-compare, and the billing HTTP fixtures.
- `BillingRepositoryTest`, with a fake gateway and fake API:
  - restore on start posts all purchases and saves the token;
  - pending purchases are not posted as owned;
  - a refresh while in a room emits `sendEntitlement`;
  - a refresh failure keeps the old token and backs off.
  - a pending `premium` shows `store.pending` and grants nothing; a refunded (revoked) `premium` turns premium off at the next refresh;
  - restore runs on `ON_RESUME` and posts only changed `(token, state)` tuples (else the 1 h rule);
  - `nextRefreshAt`: lands before `premiumUntil − 30 min` and `expiresAt − 1 h`, never earlier than `now + 1 min`, at most `now + 6 h`;
  - `BILLING_UNAVAILABLE` is terminal until the next `ON_START`, then retried once; only one `startConnection` in flight;
  - billing toasts are queued (latest only) outside the Store/LOBBY/RESULTS and flushed on the next LOBBY/RESULTS;
  - `premium` true → false in LOBBY (or across a game) emits `lobby.premiumEnded` once; `poolExhausted` emits `lobby.wordsRepeating` once per room session;
  - a pack bought from a locked row is added to a non-empty `packIds` (same language) and shows `store.addedToGame`; another language → `store.switchLanguage`, no settings change;
  - `storeOpen` is true while the Store is visible or a purchase flow is in flight, and false after both end.
- `StoreFocusTest` (pure model): the initial focus target for each `StoreEntry` and each state-machine state (`Loading`, `Ready`, `Unavailable(NETWORK)` → Try again, `Unavailable(BILLING_UNAVAILABLE)` → OK); not premium → Unlock; premium on or no premium product → the first pack card, else Restore; a pack `focusProductId` → that card; a not-fetched product → `store.included`, focusable, no Buy; catalog failure → packs from `lockedPacks`, no "Other languages"; Back returns to the opener.
- `StoreLayoutFitTest` (JVM, real Cairo fonts, `StoreMetrics`): at 960×540 dp and 20 sp, in EN/FR/AR/ES, the Premium card (title + pitch, the Unlock button with a long price, `store.premiumLifetime`) and the single footer line fit without scrolling. The Compose screenshot half (`StoreLayoutTest`: also the lobby bottom bar from x 370 dp, else the icon-only Premium variant) runs on the owner's machine.

---

## 5. Phone + `/tv` mock (C)

### 5.1 Phone (never a buy button, never a price)
- **Settings → Packs** (VIP phone):
  - the playable `availablePacks` are toggleable as today;
  - under `settings.lockedPacks`, list `view.lockedPacks` as disabled rows: lock icon, localized title, `store.packPairs`, and the trailing text `settings.unlockOnTv`;
  - a tap shows the 3 s toast `error.packLocked`;
  - no prices, no product ids shown, no links.
- **Settings → Points** rows when `!view.premium`: disabled steppers + lock + `settings.unlockOnTv`; a tap → toast `error.premiumRequired`.
- **Lobby:** a small chip (`gem` + `lobby.premiumRoom`) near the room header when `view.premium`. When `view.premium` flips true → false (in LOBBY, or on the first LOBBY after a game), the **VIP phone only** shows the toast `lobby.premiumEndedPhone` once.
- **Start while the TV is in the store:** when `view.tvBusy`, the VIP's Start button stays enabled but shows the hint `error.tvBusy` under it; a press that still races returns `TV_BUSY`, shown as the same toast.
- **Errors** `PREMIUM_REQUIRED`, `PACK_LOCKED`, `ENTITLEMENT_INVALID`, `TV_BUSY` → toasts (`t(messageKey)`), non-fatal (SPEC §6.4 client rule unchanged).
- **Budget:** the phone bundle stays ≤ 60 KB gzip. The store code lives only in the lazy `tv-mock` chunk.
- **Types:** `LockedPackInfo`, `premium` and the `PackInfo.tier` key come from `@mishana/shared/protocol` (`import type`).

### 5.2 `/tv` mock store (fake billing)
- On load, `GET /api/billing/catalog`. With `mode:"google"`, the mock shows the `lobby.premium` button, and its dialog shows `store.tvAppOnly`: no store. With `mode:"fake"`, the full simulation below.
- `installId`: localStorage `mishana:installId` (32 hex from `crypto.getRandomValues`; try/catch rules of SPEC §8.6).
- The mock follows §4.4 (entry points, state machine, layout, room code in the header, toast rules, downgrade and pool-exhausted toasts, pack added to game, focus with the keyboard D-pad: arrows, Enter, Esc) using the same keys, with the banner `store.testMode`. It sends `storeOpen` exactly like the TV (§4.3). The Unlock Premium and pack buttons (all one-time products) call:
  1. `POST /api/billing/fake/purchase` `{installId, productId}`;
  2. `POST /api/billing/verify`;
  3. store the token in memory and localStorage `mishana:entToken`;
  4. send `{"v":1,"t":"entitlement","token":…}` on the TV socket.
- Room creation sends `entitlement` in `POST /api/rooms` when a token exists.
- **Debug-only controls** in the mock store, visible only in fake mode, under a "Test controls" heading (PAY-GAP: also in the TV mock's pause menu, so §5.3 test 4 can refund mid-game):
  - "Refund Premium": `POST /api/billing/fake/set {purchaseToken, state:"REVOKED"}` on the latest `premium` purchase, forget the token locally (Play no longer lists it), then `/api/billing/entitlement`, then send `entitlement`;
  - "Refund pack": same, on the latest pack purchase.
- The mock reproduces §2.4 refresh rules 1 (on load and on `visibilitychange` to visible), 2 and 3 (timer, same `nextRefreshAt` formula; C ports it to TS with a unit test).

### 5.3 E2E (C, Playwright, `web-client/e2e/payments.spec.ts`)
- `webServer.command` adds `--var BILLING_MODE:fake --var ALLOW_FAKE_BILLING:1`. The host is `127.0.0.1`, so the Worker decides fake mode per request and passes it to the room (§3.10); no `JOIN_BASE_URL` var is needed. Existing specs keep passing.
- Tests:
  1. **Free room cannot get premium packs.** The TV mock creates a room with no token. 4 phones join. A phone VIP opens Settings: `lockedPacks` is non-empty and has no Buy buttons. Sending `UPDATE_SETTINGS {packIds:["en-food-01"]}` via the page's socket → error `PACK_LOCKED`. Play 3 games; every TV and phone WS frame (collected with `page.on("websocket")`) contains no word from any premium pack. The test reads the premium words from `word-packs/packs/**/*.json` with `tier` ≠ free.
  2. **Purchase → premium → premium pack plays.** In the TV mock store, press **Unlock Premium** (the one button, with the price and `store.premiumLifetime`) with the D-pad only. `view.premium` becomes true without a new room; `lockedPacks` is `[]`. Select `en-food-01` only, start, and assert that the RESULTS `result.pack.id === "en-food-01"`.
  3. **Single pack purchase.** Buy `pack_en_food_01` in a fresh free room. Only that pack unlocks; others stay locked.
  4. **Refund fallback.** In a premium room with `packIds:["en-food-01"]` and custom points, start a game, then "Refund Premium" mid-game. The game continues to RESULTS with the same pack. After PLAY_AGAIN (lobby): `premium:false`, `packIds:[]`, points at the defaults, the TV mock shows `lobby.premiumEnded` and the VIP phone shows `lobby.premiumEndedPhone` (each once), and START works with the free pack.
  5. **Fake mode refused off-LAN** (request-level): call `/api/billing/fake/purchase` with `Host: example.com` via `request.post(..., {headers})` → 404 or 503. (A's unit test is the primary guard; this is a smoke test.)
  6. **No start behind the store.** With the mock Store open, the VIP phone's START → error `TV_BUSY` and the phase stays LOBBY; after closing the Store, START works.
  7. **Store churn.** Open and close the Store 4 times by D-pad, then buy: premium arrives, nothing is rate-limited.

---

## 6. Security & abuse

### 6.1 Threats and mitigations

| Threat | Mitigation |
|---|---|
| Modded APK unlocks packs | Words live on the server. Rooms get only the playable catalog (§3.11). A client cannot request words. |
| Forged entitlement token | Ed25519 signature with a server-only key. Short TTL. `kid`/`alg`/`typ` pinned. Fake key rejected outside fake mode. |
| Forged purchase token | Every token is checked with Google (package taken from the URL path, product id matched). Unknown → `INVALID`. |
| Token replay or sharing across devices | **Policy:** one Google purchase may unlock **up to 10 TVs** (active bindings: re-proved via `/verify` within 30 days). This covers a household with several TVs on the same Google account (restore is legitimate and required ✔). Beyond that → `INSTALL_LIMIT`. Access and the limit use the **same** active-binding predicate, and `/entitlement` never refreshes a binding, so a freeloader that verified once and then only polls `/entitlement` loses access and frees its slot after 30 days; to stay entitled it must keep presenting the purchase token, which means keeping the purchaser's Google account on that TV. Entitlement tokens are bound to `sub = installHash`; a room only accepts a token whose `sub` matches the room's current sub. A copied entitlement token works for at most 8 h on rooms created with it; that is accepted risk. |
| Stolen installId | It is a 128-bit secret on the TV only; the server stores only its hash. Worst case: someone gets that TV's entitlement. |
| Refund or chargeback | `premium` and packs alike: RTDN `voidedPurchaseNotification` (productType 2) → sticky revoke (a tombstone if the token was never seen); the daily voided-purchases cron (`type=0`) is a backup; revoked rows are never pruned. Rooms drop access within 8 h at most (token TTL), or immediately on the TV's next refresh. |
| RTDN spoofing and floods | Cheap pre-auth checks (IP limiter 120/min, header shape and length) before any crypto; OIDC JWT verified (signature, iss, aud, email, email_verified, time); body read only after auth, capped at 16 KB; `subscription` field and package name checked. Every notification is re-read from Google, never trusted as state. |
| Replay of RTDN | `messageId` dedupe and idempotent upserts. |
| API abuse, Google quota exhaustion | IP and install rate limits (§3.9, LRU-bounded), body caps, strict zod schemas. Google reads: 10-min positive cache and 24 h negative cache by token hash, at most 5 reads per verify with a 12 s deadline, and a global verify bucket (60/min) in the Billing DO, so RTDN and cron always keep quota headroom. |
| Fake mode in production | Four conditions decided per request in the Worker, plus the room's persisted `billingMode` and the DO's own env check (§3.10), plus a deploy check. |
| Secret leakage in logs or traces | `billingLog` is the only logger in billing code and redacts strings (§3.9); traces disabled because they record outbound URLs (§3.2); Google errors carry no URL. |
| Service-account key leak | Least privilege: the Play account has view-only permissions (no refund, revoke or cancel power; §8.C). 90-day key rotation, Cloud audit logs on. The Room DO never reads the key (§3.2). |
| Client-chosen `obfuscatedAccountId` | It is a hint only: RTDN-path bindings are created only for an unbound token below the install limit, and grant nothing unless that install proves itself (§3.4). |

### 6.2 Workers secrets (`wrangler secret put <NAME>`)

| Secret | Content |
|---|---|
| `PLAY_SERVICE_ACCOUNT_JSON` | Full JSON key of the Play API service account (view-only Play permissions; rotated every 90 days, §8.C) |
| `ENTITLEMENT_KEYS` | §2.3 JSON |
| `ADMIN_TOKEN` (optional) | §3.12: ≥ 32 random characters. Unset = the admin endpoints answer 404 |

Non-secret vars: `PLAY_PACKAGE_NAME`, `RTDN_AUDIENCE`, `RTDN_SA_EMAIL`, `RTDN_SUBSCRIPTION`, `BILLING_MODE`, `ALLOW_FAKE_BILLING`.

Workers secrets are visible to every isolate of the Worker, including the Room DO class. Code rule (§3.2): only `server/src/billing/**` reads `PLAY_SERVICE_ACCOUNT_JSON` and the private entitlement key; the Room DO gets public verify keys only, and `RoomCore` never receives `env`.

Local dev (fake) needs no secrets. Local Google-mode testing uses `server/.dev.vars` ✔ (git-ignored; A adds `.dev.vars*` to `.gitignore`).

### 6.3 Privacy (feeds PRIVACY.md at M5 and the Play **Data safety** form)

**Stored**, in the Billing DO only:
- SHA-256 of purchase tokens;
- SHA-256 of install ids;
- product id, state, ack and revoke flags, test flag;
- binding timestamps;
- RTDN message ids (30 days);
- raw purchase tokens only while an acknowledgement is pending or may become due (≤ 4 days after the purchase completes; ≤ 30 days for a purchase that stays pending);
- for revoked purchases (`premium` or a pack), a permanent ~100-byte tombstone (token hash, kind, revoked flag), so a refunded purchase cannot be re-granted.

**Not stored:**
- names, emails, Google account ids, order ids, prices, region codes, IPs (the rate limiter uses the IP transiently, as today).

**Retention:**
- bindings: 400 days after last seen;
- dead purchases (`CANCELLED`, not revoked): 400 days after the last update; revoked tombstones are kept (reduced to the hash and flags);
- negative-cache hashes: 24 h;
- RTDN ids: 30 days.

Play Data safety declares, each as collected, not shared, encrypted in transit [VERIFY the category names in Play Console]:
- **Purchase history**: app functionality;
- **Device or other IDs** (the install id, sent to the server and hashed; also used as the Play `obfuscatedAccountId` and the entitlement token `sub`): app functionality, fraud prevention / security.

The client IP is used transiently for rate limiting and not stored. PRIVACY.md (M5) mentions the install id, its purpose, that only its hash is stored, and that clearing the app's data creates a new one.

### 6.4 Refund and chargeback
- Full refund or chargeback of `premium` or a pack → `revoked=1` (sticky; tombstone if unseen) → premium / the pack disappears from the next token (the TV shows `lobby.premiumEnded` when premium flips off in LOBBY) and can never be re-granted for that token.
- Partial refunds (`refundType=2`) apply to multi-quantity purchases only ✔ and do not occur here (every product is non-consumable, quantity 1).
- Voluntary refunds by the owner in Play Console (Order management) flow through the same voided notification and end access [VERIFY that a Play Console refund of a one-time product always emits `voidedPurchaseNotification` and a `voidedpurchases` entry].
- A voided entry for a subscription cannot occur (none is sold); RTDN logs it as `RTDN_UNEXPECTED` and changes nothing (§3.6).

---

## 7. Tests

### 7.1 shared (A)

| File | Covers |
|---|---|
| `billing/products.test.ts` | `packProductId`/`packIdFromProductId` round trip for every shipped pack; rejects `pack_`, `pack_A`, `premium`; `isSellableProductId`; `PRODUCT_ID_REGEX`; `billing.products.json` fixture |
| `billing/entitlement.test.ts` | §2.2: `purchaseOwned` for every `PURCHASE_STATES` value × revoked |
| `packs/schema.test.ts` | `tier` defaults to premium; strict object still rejects unknown keys |
| `engine/restrict.test.ts` | RESTRICT_SETTINGS: LOBBY only; same object when nothing changes; premium keys reset to the defaults; packIds filtered |
| `projection/pool.test.ts` | `poolExhausted`: false when premium, outside LOBBY, or with any unused pair; true when every filtered playable pair is used; the view carries a boolean only |
| `projection/leak.test.ts` (extend) | **Premium leak test:** a synthetic catalog with free tokens `zzfree0001…` and premium tokens `zzprem0001…`. Run 1,000 seeded sim games through a **free** RoomAccess (playable catalog) with settings `packIds: []`. At every step, `JSON.stringify` of the TV view and of every player view contains **no** `zzprem` token, and `lockedPacks` items have exactly the keys `id, locale, title, pairCount, ageRating, productId` |
| `protocol/fixtures.test.ts` | the new fixtures parse (`EntitlementMsgSchema`, `StoreOpenMsgSchema`, the billing HTTP schemas, the updated views) |
| `i18n/keys.test.ts` | the new keys exist in all four locales (en/fr/ar/es) with matching placeholders and plural forms; `error.*` exists for the 4 new codes; FR values contain no ordinary space before `! ? : ;` (all of fr.json) |

`TEST_CATALOG` (`shared/src/testing/test-catalog.ts`): every language gets one `tier:"free"` and one `tier:"premium"` pack. Existing tests that need all packs pass a premium `RoomAccess` (or the full catalog).

### 7.2 server (A)

| File | Covers |
|---|---|
| `billing/token.test.ts` | sign → verify round trip; wrong kid, alg, typ; extra header or payload claim; duplicate claim; reordered claims; `pu` as string or float; `exp − iat > TTL`; unsorted or duplicate `packs`; > 64 packs; non-canonical base64url (padding, `+`/`/`, trailing bits); tampered payload or signature; `exp` past; `iat` in the future (>300 s); length > 3000; kid `fake` rejected unless fake; a non-Ed25519 JWK in the keyring is rejected at parse time; rotation (verify old kid without `d`, sign new) |
| `billing/google.test.ts` | mocked `fetch`: JWT claims exactly as in §3.7 (decode the assertion, verify the RS256 signature with the generated test key pair); form body; token cached until `expires_in − 300`; one in-flight request; 401 → refresh + retry; 5xx → one retry; per-call timeout honoured; URLs for get/ack/voided with an encoded token; thrown errors contain no URL or token; voided pagination; `ackPurchase`: 2xx → markAcked, 4xx + re-read ACKNOWLEDGED → markAcked, 4xx + re-read PENDING → kept |
| `billing/normalize.test.ts` | `ProductPurchaseV2` samples from ✔ doc examples: PURCHASED / PENDING / CANCELLED (unspecified → CANCELLED), `purchaseCompletionTime` → `completedMs`, test purchase |
| `billing/pubsub-auth.test.ts` | locally generated RSA JWKS served by mocked fetch: valid; wrong aud, iss, email; `email_verified:false`; expired; unknown kid triggers one refetch (and at most one per 60 s); missing, oversized (> 4096) or malformed header → 401 **without** reading the body or fetching JWKS |
| `billing/rtdn.test.ts` | parse (string and number `eventTimeMillis`); dedupe; package mismatch → 204; wrong `subscription` → 204; body > 16 KB → 413; limiter → 429; `premium` and pack one-time notifications → productsv2 get + apply + ack (obfuscated id binds lifetime premium); a product this app does not sell → 204, no row; `premium` CANCELED → premium off; **voided `premium` → revoked (sticky): premium off, a later PURCHASED read → `REVOKED`**; voided pack → revoked; unknown hash → tombstone, later `/verify` → `REVOKED`; **`subscriptionNotification` and voided productType 1 → 204 + `RTDN_UNEXPECTED`, nothing changes**; RTDN obfuscated-id binding skipped when the token already has a binding or is at the limit; test notification; Google 503 or OAuth failure → 503 and no `rtdnMark`; Google 404 → 204; failed ack → 204 with `ack_token` kept; garbage → 204 |
| `billing/billing-core.test.ts` | SQL against `node:sqlite` (Node 22.22 ships `node:sqlite` [VERIFY flag-free in 22.22; else use a small in-memory `SqlLike` fake]): apply/bind (every row `kind='product'`); `INSTALL_LIMIT` at 11 active bindings; **a binding older than 30 days gives no access and its slot is reusable**; `entitlementFor` never refreshes `last_seen_ms`; stale `checkedMs` ignored; **a stale PURCHASED read after a stored CANCELLED row → `NOT_OWNED`, no new binding; after a revoked row → `REVOKED`**; verify after revoke → `REVOKED` (sticky `MAX`), for `premium` and packs; void before verify → tombstone → `REVOKED`; prune keeps revoked tombstones; owned `premium` → `premiumUntil` = token `exp`; packs; grant merge; `pendingAcks` uses `ack_window_start_ms` (a purchase pending 5 days then completed is still retried); `ackDue` returned for `INSTALL_LIMIT`; `invalid_tokens_v2` TTL; rate map LRU eviction at 10 000; `googleBudget` refill |
| `billing/routes.test.ts` | verify happy path (`premium` + pack) with FakeGoogleApi; `UPSTREAM_ERROR` keeps 200; fresh cached row → no Google call; negative cache → `INVALID` with no Google call; 20 tokens → at most 5 Google reads, the rest `UPSTREAM_ERROR`; deadline exceeded → remaining `UPSTREAM_ERROR`; empty global bucket → `UPSTREAM_ERROR`; ack is sent for an `INSTALL_LIMIT` result; bad body 400; rate limit 429; catalog lists premium packs only; entitlement for an unknown install = free |
| `billing/mode.test.ts` | fake mode on only when all 4 conditions hold; each single failure → google or `NOT_CONFIGURED`; `check-deploy.mjs` rejects non-google vars |
| `billing/cron.test.ts` | dispatch on `controller.cron` (fake env → prune only); voided window and cursor; voided `premium` and packs → sticky revoke, unknown tokens → tombstone, no Google re-read; a 5xx or auth failure stops paging without moving the cursor; hourly ack retries; `BILLING_ACK_OVERDUE` after 48 h |
| `billing/log.test.ts` | §3.9 redaction: no token, token hash, install id/hash, 64-hex or `tokens/` string reaches `console.*` on any billing path |
| `access.test.ts` | `roomAccess` time edges; `playableCatalog`; `lockedPacks` metadata-only; `restrictionFor` |
| `room-core.access.test.ts` | createRoom with valid, invalid or no token; fake-kid token accepted only with `billingMode:"fake"` and fake env, rejected with prod config; `storeOpen` from a player → `NOT_AUTHENTICATED`; phone START while `tvBusy` → `TV_BUSY`; busy flag cleared on TV close, phase change and alarm; `entitlement` WS message from a player → `NOT_AUTHENTICATED`; sub mismatch / older iat → `ENTITLEMENT_INVALID`; upgrade mid-lobby broadcasts `premium:true`; `PACK_LOCKED`/`PREMIUM_REQUIRED` pre-checks; **expiry mid-game: the game finishes with its pair, the restriction applies in LOBBY**; alarm scheduled at `changesAt`; hibernation reload keeps `meta.entitlement`; VIP reassignment leaves entitlement unchanged |
| `http.test.ts` | body ≤ 4096; response has `entitlement` status; `billingMode` passed to `InitRoomArgs` from the request host |
| `scripts/check-deploy.test.ts` | rejects non-google vars and `observability.traces.enabled !== false`; `ADMIN_TOKEN` never a var nor a required secret |
| `admin.test.ts` | §3.12: unset/short `ADMIN_TOKEN` → 404; missing/wrong token → 401; rate limit before auth (`admin:<ip>`); never logs the token or install id; grant → signed entitlement has premium / packs (google and fake mode); revoke (by id or hash) → gone; expiry respected; hash-only storage; no purchases/bindings rows, no Google call |
| `scripts/grant.test.ts` | the CLI's argument parsing (grant/list/revoke, `--packs`, `--expires`, grouped ids, errors) |

### 7.3 web-client (C)
- Unit tests:
  - the locked-pack row model (lock, no price);
  - points locked when `!premium`;
  - the error toast keys (incl. `TV_BUSY`), the VIP Start hint while `tvBusy`, `lobby.premiumEndedPhone` once per flip;
  - mock store: state machine, `nextRefreshAt`, toast queue, `storeOpen` sends;
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
6. **Service fee:** enrol in the **15% service fee tier** (Play Console → Settings → Developer account → Account groups / Service fee program) [VERIFY the menu path]. Every product here is one-time, so the tier matters for all of them.
7. **Verify a physical Android device** with the **Play Console mobile app** (required for new personal accounts) [VERIFY the current requirement on the signup checklist]. An Android phone is enough; the TV is not needed for this step.
8. **EU Digital Services Act trader status:** Play Console → Account details → declare whether you are a **trader**. Selling Premium and packs makes you a trader for EU purposes; as a trader, Google Play shows your **name, address, phone number and email publicly** on the store listing to EU users. For a personal account that is your own address, so consider a business address, a domiciliation address or a PO box first [VERIFY the exact wording and which fields are shown in Play Console].
9. **New personal accounts must run a closed test before production:** at least **12 testers opted in for 14 continuous days**. This applies to personal accounts created after 2023-11-13; the tester count went from 20 to 12 in Dec 2024 (third-party summaries; Google's page was blocked here → [VERIFY]). Recruit 12+ testers early (friends, a Google Group). They also serve as purchase testers.

**B. App and billing in Play Console**
1. Create the app: name "Mish Ana!", default language, App, Free (in-app purchases are allowed in free apps), declarations.
2. Fill **App content**: privacy policy URL (M5), ads = none, content rating questionnaire, target audience (13+, so that Families policy is avoided [VERIFY with the owner]), **Data safety** (§6.3), and the **TV** form factor (Release → Advanced settings → Form factors → Android TV; TV screenshots and banner are needed for review).
3. Build a release AAB with the billing library (B's work) and upload it. `assembleRelease`/`bundleRelease` refuse to build until `mishana.prodServerUrl` in `tv-app/gradle.properties` (or `-PserverUrl=`) is the deployed `https://` Worker origin (docs/TV.md → Production server URL). The URL is known before the first deploy: `https://play.<your-workers-subdomain>.workers.dev` (Worker `name` in `wrangler.jsonc`) or your custom domain. Upload it to **Internal testing** (and to the closed test track for A.9). Billing products can be created only after an APK/AAB with the BILLING permission is uploaded [VERIFY; it was true historically].
4. **License testers:** Settings → License testing → add the testers' Gmail addresses. License testers get test payment methods ✔ (developer.android.com/google/play/billing/test), including "slow test card, approves after a few minutes" (pending → purchased) and "always declines"; an unacknowledged **one-time** purchase is auto-refunded after **3 min** ✔ (the server acks immediately on `/verify`, so this only shows up when the Worker is misconfigured). Test purchases are flagged `test=1`. A license tester can buy `premium` again after a refund in Order management; a non-consumable cannot be bought twice while owned (`ITEM_ALREADY_OWNED` → restore).
5. **No subscription.** Do **not** create anything under Products → Subscriptions: no subscription, no base plans, no offers (revision 3).
6. **One-time products only:** Monetize with Play → Products → One-time products → Create, for each row of `pnpm --silent --filter @mishana/server billing:products` (CSV: `productId,kind,priceUsd,pairs,packId,locale,titleEn,titleFr,titleAr`; `premium` first, then 14 packs today):
   - **first `premium`**: product id `premium`, name "Mish Ana! Premium" (description: all word packs, new packs included, custom scoring; one-time, no subscription), non-consumable, one purchase option (buy), price **US$7.99** ("Set prices" → Play converts per country; adjust LB/ME by hand if wanted). **Activate.** Launch promo: a Play Console **sale** (or a temporary price change) to **US$5.99** on `premium`; end it in Play Console. Never a second product, never code;
   - then each pack: product id `pack_en_food_01` etc.; name = English title (add the FR/AR/ES translations); one purchase option (buy), price from the CSV (**US$1.99**, or **US$2.99** for ≥ 60 pairs). **Activate.**
7. **RTDN** (after sections C and D: the Worker must be deployed with the `RTDN_*` vars, or the push answers 503 `NOT_CONFIGURED`): Monetize with Play → Monetization setup → Real-time developer notifications:
   - enable;
   - Topic name `projects/<PROJECT_ID>/topics/play-rtdn`;
   - choose **"Get all notifications for subscriptions and one-time products"** ✔ (the Play label; we need the one-time-product notifications, and no subscription exists);
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
- **Play Console → Users and permissions → Invite new users:** email `play-api@mish-ana-billing.iam.gserviceaccount.com`. Under **App permissions**, add the app with **only** "View app information (read-only)" and "View financial data, orders, and cancellation survey responses" ✔ (needed for billing). Do **not** grant "Manage orders and subscriptions": it allows refunding, revoking and cancelling every customer's purchase, and the code never does that. [VERIFY that acknowledge works with view-only permissions: in the internal test (E.2), check the Worker logs for `BILLING_ACK_REJECTED` with status 401/403. Only if acknowledge fails, add "Manage orders and subscriptions".] Click Invite. Permissions can take up to 24 h to propagate [VERIFY].
- **Audit:** enable Cloud Audit Logs (Data Access, `androidpublisher.googleapis.com`) in IAM → Audit Logs, so every API use of the key is recorded [VERIFY that androidpublisher emits data-access audit logs].
- **Key rotation every 90 days** (calendar reminder): `gcloud iam service-accounts keys create play-api-new.json --iam-account=play-api@mish-ana-billing.iam.gserviceaccount.com` → `npx wrangler secret put PLAY_SERVICE_ACCOUNT_JSON < play-api-new.json` → check a `/verify` works → `gcloud iam service-accounts keys list --iam-account=…` and `gcloud iam service-accounts keys delete <OLD_KEY_ID> --iam-account=…` → delete the local file. Rotate immediately if a leak is suspected.
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
  - `RTDN_SUBSCRIPTION`: `projects/mish-ana-billing/subscriptions/play-rtdn-push`;
  - keep `BILLING_MODE:"google"`, `ALLOW_FAKE_BILLING:"0"`.
- Replace the ratelimit `namespace_id`s with unique account values.
- `SUPPORT_EMAIL` in `shared/src/billing/products.ts` is set (`alexkhoury@hotmail.com`); use the same address on the Play listing.
- From the repo root, `pnpm run deploy` (always `run`: bare `pnpm deploy` is pnpm's built-in command, not the script): this builds, runs pack-lint `--release` (starter packs ≥ 40 pairs; the three `*-everyday-01` packs have 24 today, so the deploy fails until they grow), `check-deploy.mjs` (`BILLING_MODE:"google"`, `ALLOW_FAKE_BILLING:"0"`, traces off, no `env` block), and `secrets.required` blocks a deploy with missing secrets ✔.
- Then send the Play Console **test RTDN** (B.7). The Worker logs `{code:"RTDN_TEST"}`.
- In the Cloudflare dashboard → Workers → Observability, create alerts (or a saved query you check weekly) on the codes `BILLING_ACK_OVERDUE`, `BILLING_ACK_REJECTED`, `BILLING_AUTH`, `BILLING_BUDGET`, `BILLING_INSTALL_SHARED`, `RTDN_AUTH`, `RTDN_UNEXPECTED` [VERIFY alerting availability on your plan].

**E. End-to-end on a real Google TV (closed or internal test install from Play)**
1. Sign in to the TV with a **license tester** account and install from the internal test link.
2. **Buy Premium:** Store → **Unlock Premium** → test card "always approves" → `premium` on; the room unlocks without a new code; `store.premiumActive` shows and the button is gone. Check the Worker logs for no `BILLING_ACK_REJECTED` and wait 5 min: premium stays on (acknowledged, so no 3-min auto-refund).
3. **Pending:** buy a pack with "slow test card, approves after a few minutes" → `store.pending` on the card + `store.pendingBody` → unlocks later ✔ (test instruments). Repeat once on a second tester for `premium` (pending chip on the Unlock button).
4. Refund the pack in Play Console → Order management → it disappears within seconds (RTDN) or by the next daily cron.
5. **Restore:** reinstall the app or use a second TV on the same account → Restore purchases → premium restored (`store.restored`).
6. **Refund Premium** (last, it ends the tester's premium): refund `premium` in Order management → the server revokes it within seconds (RTDN; the daily cron is the backup); the TV drops premium at its next refresh (open the Store, or resume the app; ≤ 8 h) and in LOBBY shows `lobby.premiumEnded`; the next game falls back to the free pack; the Store shows Unlock again. Restore on the second TV no longer grants premium (`REVOKED`).

---

## 9. File ownership and build order

| Implementer | Writes | Must not touch |
|---|---|---|
| **A** | `shared/src/billing/**` (new), `shared/src/{constants,engine/*,packs/schema.ts,projection/project.ts,protocol/*,testing/*,i18n/index.ts}`, `shared/i18n/{en,fr,ar,es}.json` (§4.7 keys), `shared/fixtures/**` + `scripts/gen-fixtures.ts`, `shared/package.json` (`./billing` export), `server/**` (incl. `wrangler.jsonc`, `scripts/*`, `package.json` scripts `gen:entitlement-key`, `billing:products`, `deploy` = `node scripts/check-deploy.mjs && wrangler deploy`), `word-packs/packs/*/*-everyday-01.json` (`tier:"free"`), `word-packs/test/**`, `tools/pack-lint/**`, `tools/dev.mjs` (fake vars), `tools/sim/**` (adapt to the RoomCore deps), generated `tv-app/app/src/main/res/values*/strings_generated.xml` + `tv-app/app/src/main/java/app/mishana/tv/i18n/I18nKeys.kt` (run `pnpm gen:strings`), `.gitignore` (`.dev.vars*`), `docs/DEV.md` (fake billing + secrets section), root `package.json` `deploy` script (§1.5), `eslint.config.*` (billing `no-console`, Room secret rule), `docs/DESIGN.md` (only the §4.7 DESIGN deltas) | `tv-app/**` source, `web-client/**` |
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

Revision 2 sources, kept as history; the subscription-related items no longer apply (revision 3 calls only `productsv2`, `products.acknowledge` and `voidedpurchases`).

- Play Billing Library: integrate guide, release notes (9.1.0 = 2026-06-18; 9.0.0; 8.x), reference pages for `BillingClient`, `BillingClient.Builder`, `PendingPurchasesParams.Builder`, `QueryProductDetailsParams.Product.Builder`, `ProductDetails` (+`SubscriptionOfferDetails`, `OneTimePurchaseOfferDetails`, `PricingPhase`), `QueryProductDetailsResult`, `UnfetchedProduct(.StatusCode)`, `BillingFlowParams.Builder`, `BillingFlowParams.ProductDetailsParams.Builder`, `Purchase`, `Purchase.PurchaseState`, `AccountIdentifiers`, `QueryPurchasesParams.Builder`, `PurchasesResponseListener`, `PurchasesUpdatedListener`, `ProductDetailsResponseListener`, `BillingClientStateListener`, `BillingClient.BillingResponseCode`, `BillingClient.ProductType`, `BillingClient.FeatureType`. All at developer.android.com/google/play/billing/* and developer.android.com/reference/com/android/billingclient/api/*.
- Subscription lifecycle, RTDN reference, getting-ready (RTDN setup, `google-play-developer-notifications@system.gserviceaccount.com`), subscriptions (deep link), testing (license testers and renewal times), security (obfuscated id check): developer.android.com/google/play/billing/{lifecycle/subscriptions, rtdn-reference, getting-ready, subscriptions, test, security}.
- Google Play Developer API v3 discovery document, revision 20261001: `purchases.subscriptionsv2.{get,cancel,revoke,defer}`, `purchases.productsv2.getproductpurchasev2`, `purchases.subscriptions.acknowledge`, `purchases.products.{get,acknowledge,consume}`, `purchases.voidedpurchases.list`; schemas `SubscriptionPurchaseV2`, `ProductPurchaseV2`, `VoidedPurchase`; product/base plan/offer id rules; scope `androidpublisher`.
- Pub/Sub v1 discovery (`PushConfig.oidcToken`, `NoWrapper`, `Subscription.expirationPolicy`); `gcloud pubsub subscriptions create --help`; GoogleCloudPlatform/nodejs-docs-samples `appengine/pubsub/app.js` (claim checks).
- OAuth: npm `gtoken@8.0.0` (service-account JWT claims, token URL, grant type), `google-auth-library@11.1.0` (`verifySignedJwtWithCertsAsync`: issuers, JWK cert URL, 300 s skew, 86 400 s max lifetime).
- Revision 2 re-checks (2026-10-04): developer.android.com `integrate` (ack window starts at PENDING → PURCHASED; call `queryPurchasesAsync()` in `onResume()`), `test` (3 min one-time / 5 min subscription auto-refund, max 6 renewals), `rtdn-reference` (new order id per renewal; `refundType`), PBL release notes (androidx.core ≥ 1.9), `InAppMessageParams.Builder`; discovery rev. 20261001 (`purchaseCompletionTime`, `startTime`, `outOfAppPurchaseContext` incl. `expiredExternalAccountIdentifiers` and its removal after ack, `PENDING_PURCHASE_CANCELED` → `linkedPurchaseToken`, `VoidedPurchase` fields, `PurchaseStateContext` enum); cloudflare-docs `observability/traces/spans-and-attributes.mdx` (`url.full` on fetch spans), `traces/index.mdx` + `tracing-beta-config-note`, `logs/workers-logs.mdx` (invocation log = method + URL), `runtime-apis/bindings/rate-limit.mdx` (per-location, permissive), `cron-triggers.mdx` (`?cron=` local trigger); wrangler 4.147.0 schema (`observability.traces.enabled`, `logs.invocation_logs`); workers-types `ScheduledController.cron`.
- Cloudflare (github.com/cloudflare/cloudflare-docs): `workers/configuration/cron-triggers.mdx`, `runtime-apis/handlers/scheduled.mdx`, `runtime-apis/web-crypto.mdx` (RSASSA-PKCS1-v1_5, Ed25519, `timingSafeEqual`), `configuration/secrets.mdx` + partial `secrets-in-dev.mdx`, `durable-objects/api/sqlite-storage-api.mdx`; `wrangler@4.147.0` `config-schema.json` (`triggers.crons`, `secrets.required`, ratelimit `period`); `@cloudflare/workers-types` (`getByName`, `ScheduledController`).
- Closed-testing rule (12 testers / 14 days): third-party summaries (testerscommunity.com, choicely.com, extendsclass.com, 2026) → [VERIFY] in Play Console.

---

## Appendix: Review log (revision 2, 2026-10-04)

The review findings were applied as follows. "Applied" means the fix is in the referenced sections. Rejected or narrowed items give the reason.

**Blockers (all applied)**
| # | Finding | Where |
|---|---|---|
| B1 | Voided subscription with `refundType` 1 must not `markRevoked` (one refunded renewal order, same token, still ACTIVE). RTDN and cron now both re-read only; `revoked` is pack-only; `subscriptionAccessUntil` has no `revoked` input; new rtdn test "voided sub, Google ACTIVE → premium kept". Merged the two duplicate reports of this finding | §2.2, §3.5 `markRevoked`, §3.6 step 5, §3.8, §6.4, §7.2 |
| B2 | Install-limit bypass: access now uses the same active-binding predicate as the limit (30-day window, refreshed only by `/verify`); `/entitlement` never refreshes; test for an expired binding | §2.1, §3.3, §3.5 `entitlementFor`, §6.1, §7.2 |

**Majors (all applied)**
| # | Finding | Where |
|---|---|---|
| M1 | Durable revocation: sticky `revoked = MAX(...)` in the upsert, tombstones for void-before-verify (RTDN and cron), prune never deletes revoked rows | §2.2, §3.5, §3.6, §3.8, §6.3 |
| M2 | Google quota/cost amplification: 10-min positive cache, 24 h negative cache, ≤ 5 reads per verify, 3 s per call, 12 s deadline, global verify bucket in the Billing DO, LRU-bounded rate map | §3.3, §3.4, §3.5, §3.9 |
| M3 | Fake mode in the Room DO depended on `JOIN_BASE_URL`: mode now decided in the Worker per request and persisted as `RoomMeta.billingMode`; the DO also requires env conditions 1–3; room-core test added. The interim `--var JOIN_BASE_URL` workaround is unnecessary and was not added | §3.10, §3.11, §5.3, §7.2 |
| M4 + m-ack | Ack based on Google state only (also for `INSTALL_LIMIT`/`REVOKED`/`NOT_OWNED`); 4xx → re-read `acknowledgementState`; `BILLING_ACK_OVERDUE` alert after 48 h. Merged with the minor duplicate | §3.4 step f, §3.7 `ackPurchase`, §3.8 |
| M5 | Service account least privilege (view-only; "Manage orders" only if ack fails, [VERIFY]), 90-day key rotation, audit logs, Room DO never reads the key | §3.2, §6.1, §6.2, §8.C |
| M6 | Token leakage through observability: verified that traces record `url.full` for fetch spans; traces explicitly disabled and enforced by `check-deploy.mjs`; single redacting logger + log test | §3.2, §3.7, §3.9, §7.2 |
| M7 | `linkedPurchaseToken` on PENDING / PENDING_PURCHASE_CANCELED: supersede only for live states; PENDING copies bindings; PENDING_PURCHASE_CANCELED re-reads the old subscription | §3.4 step e, §3.5 link handling, §7.2 |
| M8 | Ack window anchored at PENDING → PURCHASED (`ack_window_start_ms` from `purchaseCompletionTime`/`startTime`), `ack_token` kept for pending rows up to 30 days, hourly ack cron | §3.5, §3.8, §3.2 crons |
| M9 | Room refresh timer now lands before access ends (`nextRefreshAt`) | §2.4, §4.9 |
| M10 | Suspended subscriptions: Fix payment instead of plan buttons, suspended purchases posted to `/verify`, optional `showInAppMessages` ([VERIFY] on TV, default off) | §4.2, §4.4, §4.9 |
| M11 | Owner checklist: DSA trader declaration (public address), physical-device verification, explicit "no Google Pay merchant account" | §0, §8.A |
| M12 | Lobby bar: new `gem` icon, fixed short label, Premium first in the bar, icon-only fallback, premium status as a summary chip, measurement test, DESIGN deltas | §4.4, §4.7 DESIGN deltas, §4.9 |
| M13 | Disclosure layout: full-width Premium card, side-by-side plans, one merged disclosure paragraph for the focused plan, packs in a row below, no-scroll fit rule with a screenshot test | §4.4, §4.5, §4.7, §4.9 |
| M14 | Purchase vs game start race: new TV-only `storeOpen` message, `tvBusy` view key, `TV_BUSY` error, 5-min auto-clear; deferred billing toasts | §3.11, §4.3, §4.4, §5.1, §5.3 test 6 |
| M15 | Silent downgrade: `lobby.premiumEnded` (TV) / `lobby.premiumEndedPhone` (VIP), shown once per flip; e2e test 4 asserts them | §4.4, §4.7, §5.1, §5.3 |
| M16 | Billing-unavailable/offline: Store state machine (Loading/Ready/Unavailable), Try again, actionable `store.playUnavailable`, locked rows show `settings.locked`, catalog fallback from `lockedPacks`, missing premium product handled | §4.4, §4.6, §4.7, §4.9 |
| M17 | AR/FR register: AR buttons as nouns, phone keys in noun/impersonal form, separate TV toasts `tv.packLocked`/`tv.premiumRequired`; owner reviews all AR | §4.3, §4.4, §4.7 |
| M18 | Free tier generosity: ≥ 40 starter pairs is a release gate (`pack-lint --release` in `pnpm run deploy`); `poolExhausted` view flag + `lobby.wordsRepeating` toast | §1.2, §1.5, §3.11, §4.4, §4.7 |

**Minors**
| # | Finding | Decision |
|---|---|---|
| m1 | `checkedMs` ordering and computing from the stored row | Applied (§3.4 step c, §3.5 upsert + `applyPurchase` step 3, test) |
| m2 | Strict token parsing, canonical base64url, Ed25519-only keyring | Applied (§2.3, §7.2) |
| m3 | Revocation latency: TTL 24 h → 8 h; rotation wait 2 × TTL | Applied. **Rejected:** the optional "revoked since" list checked by `createRoom`, because it adds a DO RPC to every premium room creation for a gain of at most 8 h on modded/offline TVs, and keeping room creation stateless is a stated goal |
| m4 | RTDN pre-auth guards, body cap, limiter, `subscription` check | Applied (§3.2, §3.6) |
| m5 | Client-chosen `obfuscatedExternalAccountId` on the RTDN path | Applied (§3.4 rule, §3.5, §6.1) |
| m6 | Bind on restore for ON_HOLD/PAUSED/PENDING/CANCELED | Applied (§3.4 "Which purchases bind") |
| m7 | `expiredExternalAccountIdentifiers` for out-of-app resubscribes; link handling on the pre-ack read | Applied (§3.5, §3.7) |
| m8 | Voided pack with unknown hash → tombstone | Applied (merged into M1) |
| m9 | Missed-RTDN reconciliation | **Narrowed:** documented accepted risk + `BILLING_SUB_STALE` alert (§3.8). **Rejected:** storing an AES-GCM-encrypted raw subscription token, because it reverses the "hashes only after ack" privacy property (§6.3) and adds a third secret, while the active-binding rule already forces regular `/verify` re-reads by every entitled TV (R-12) |
| m10 | `queryPurchasesAsync` on every `ON_START`/`ON_RESUME` | Applied (§2.4, §4.2) |
| m11 | Single `startConnection`, BILLING_UNAVAILABLE terminal until next `ON_START`, androidx.core ≥ 1.9 | Applied (§4.1, §4.2) |
| m12 | Test-environment timings; device-neutral cancel path | Applied (§4.5, §4.7, §8.B.4) |
| m13 | Data safety "Device or other IDs" and PRIVACY.md install id | Applied (§6.3) |
| m14 | `EntitlementBody.subscription` selection order | Applied (§3.4) |
| m15 | "Included with Premium" vs "nothing" for unfetched products | Applied: `store.included` everywhere (§1.4, §4.4) |
| m16 | Billing toasts mid-game | Applied: queue one, show on LOBBY/RESULTS (§4.4) |
| m17 | Pack bought from a locked row not added to the game | Applied: auto-add to non-empty `packIds` (same language), `store.addedToGame` / `store.switchLanguage` (§4.4) |
| m18 | RTL/bidi in billing strings, Western digits in AR dates, `›` breadcrumbs, `{days}` plural | Applied (§4.7 placeholders and bidi, `store.legalTrialRenew` plural, prose paths) |
| m19 | FR U+202F and the singular trial form | Applied; the keys test now covers all of fr.json and A fixes the existing offenders (§4.7) |
| m20 | Concrete premium pitch, plan buttons with price, Points row placement and feedback | Applied (§4.4, §4.7). Pitch counts come from `CatalogResponse`, so no hard-coded numbers |
| m21 | Grace/hold messaging, support email, softer `errorGeneric`, `itemUnavailable` | Applied (§4.4, §4.7 `store.fixPayment`, `store.help`, `SUPPORT_EMAIL`) |
| m22 | Room code hidden by the Store; `store.tvAppOnly` key | Applied: room code in the Store header (the 70% side-sheet alternative was not chosen, because the full-width card is needed for the disclosure fit rule); new key used by the mock (§4.4, §4.7, §5.2) |

**R-12 (rationale for m9).** After acknowledgement the server keeps only token hashes, so it cannot call Google on its own. Every path that grants access needs an active binding, which only `/verify` refreshes, and `/verify` re-reads Google when the stored read is older than 10 min. So a missed `RENEWED` costs at most a short dip until the TV's next refresh (which §2.4 schedules before access ends), and a missed `EXPIRED` keeps access at most until the stored `expiryTime` (+ slack), after which the row no longer grants access.

**New [VERIFY] items introduced by revision 2:** acknowledging a CANCELED-but-unexpired subscription; the error Google returns for an already-acknowledged purchase; `productsv2` response for a subscription token and for a voided one-time token; the project's Play Developer API quota; acknowledge with view-only Play permissions; androidpublisher data-access audit logs; `showInAppMessages` on Google TV; the Play TV menu path for cancelling; DSA trader wording; physical-device verification; Workers alerting on log codes.

## Appendix: Review log (revision 3, 2026-10-26)

**Owner decision 2026-10-26:** the Premium subscription (base plans `monthly`/`yearly`, offer `trial-7d`) is replaced by a one-time lifetime unlock, Play in-app product `premium`, non-consumable; US$7.99 list, US$5.99 launch promo as a Play Console sale/price change (never in code). Packs stay one-time (US$1.99; US$2.99 from 60 pairs). No subscription at all. The code changed first (commits `78e9a01`, `20c5988`, `adfd142`) and is the source of truth; this revision aligns the spec.

| Area | Change | Where |
|---|---|---|
| Catalog | `premium` is a one-time product; `BASE_PLAN_IDS`/`TRIAL_OFFER_ID` removed; `isSellableProductId`; `SUPPORT_EMAIL`; fixture without `basePlans`/`trialOfferId`; `play-products.mjs` CSV starts with `premium` and carries `kind,priceUsd,pairs` | §0, §1.1, §1.3, §1.4 |
| Entitlement | `entitlement.ts` = `PURCHASE_STATES` + `purchaseOwned` only; premium = owned `premium` purchase, `premiumUntil` = token `exp`; revoke is sticky for premium too; `EntitlementBody` has no `subscription`; `CatalogResponse.premium`; refresh formula drops the subscription expiry term | §2.1, §2.2, §2.4, §3.4 |
| Server | all rows `kind='product'` (subscription columns kept unused); productsv2 + products.acknowledge for `premium`; link/supersession/out-of-app logic, `kindOf`, `staleSubs`, `BILLING_SUB_STALE`, `BILLING_REVOKE_SUB_IGNORED` removed; RTDN: one-time notifications re-read, voided productType 2 revokes (premium included), subscription notifications / voided productType 1 → 204 + `RTDN_UNEXPECTED`; cron voided sweep `type=0` revokes every token; fake tokens `fake.<productId>.<n>`, fake/set states `PURCHASED|PENDING|CANCELLED|REVOKED` | §3.1, §3.4–§3.8, §3.10 |
| TV | INAPP only (one query for premium + packs); Premium card = one `store.unlockPremium` button + `store.premiumLifetime`; premium → `store.premiumActive`, no Manage; Fix payment, plan buttons, trial badge, manage link and subscription disclosure removed; `store.cardTip` footer documented; ES added to fit tests | §4.1, §4.2, §4.4, §4.5, §4.7, §4.8, §4.9 |
| i18n | removed `store.planMonthly/planYearly/pricePerMonth/pricePerYear/trialDays/renewsOn/endsOn/manage/manageHint/fixPayment/fixPaymentButton/legal*/period*`; added `store.unlockPremium`, `store.premiumLifetime` (and documented `store.cardTip`, `store.installLimitNoHelp`); Spanish (`es`) is a 4th UI language | §4.7 |
| Web / tests / owner | mock "Refund Premium" control; e2e test 4 refunds Premium, test 7 store churn; test tables rewritten; Play Console: one-time products only, launch sale, license-testing notes, E2E buy/pending/restore/refund Premium | §5, §6, §7, §8 |
| Paywall timing | the TV never auto-opens the Store (unchanged); a dismissible "after the first finished game" Results prompt is a follow-up, not specified | §4.4 |

Superseded revision-2 items: B1 (voided subscription must not revoke), M7 (linked tokens), M10 (suspended subscriptions / Fix payment), M13's disclosure paragraph, m6 (bind on hold), m7 (out-of-app resubscribe), m9's `BILLING_SUB_STALE`, m14 (subscription selection order) and the renewal reasoning of R-12 no longer apply: there is no subscription.

**New [VERIFY] items introduced by revision 3:** `voidedpurchases` `type=0` returns voided **non-consumable** one-time products (not only consumables); a Play Console refund of a one-time product always emits `voidedPurchaseNotification` and a voided-list entry.
