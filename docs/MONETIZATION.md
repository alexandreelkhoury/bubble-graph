# Mish Ana! — Monetization & Payments Research

Status: research note, written 2026-10-04. Covers the Android TV / Google TV host app (Kotlin, Compose for TV), browser-only phone controllers, a Cloudflare Workers + Durable Objects backend, a developer based in Lebanon / France, and players in Lebanon, the Middle East and France.

> **How to read this.** App-store payment rules changed several times in 2024–2026. The network proxy for this research blocked `support.google.com`, `play.google.com`, `android-developers.googleblog.com`, `stripe.com`, `paddle.com`, `apple.com/newsroom` and most news sites. Those facts come from **search-engine snippets** of the official pages and are marked **(snippet)**. Pages fetched in full are `developer.android.com`, `developers.google.com` (via snippet) and `developer.apple.com`. **(unverified)** marks anything I could not confirm from a source. Re-check every policy row in Play Console and App Store Connect before launch.

---

## TL;DR

| Question | Answer |
|---|---|
| Must the Android TV app use Google Play Billing? | **Yes, for our markets.** Lebanon and the Middle East stay on the old Payments policy until **2027-09-30**. The new "billing choice" program covers the US, EEA and UK only, and it is limited to **mobile and tablet** apps, so it does not cover TV. [G1][G4][G6] |
| Can the TV app show a QR code that sends the user to a web page to pay? | **No, not in v1.** Outside the enrolled programs, steering users to another payment method is prohibited. A QR code is a link in effect. [G7] |
| Play fee for a small developer | Rest of world (Lebanon/ME): 15% (15% tier) and 15% for subscriptions. US/EEA/UK new installs since 2026-06-30: 10% service fee **+ 5% billing fee** when Play Billing is used, so 15% in total. [G2][G3][G8] |
| Can a Lebanon-based developer be a Play merchant? | Yes. Lebanon is a merchant country (snippet) and also a buyer country for paid apps (snippet). [G9][G10] |
| v1 model | **Host-only, one-time Play Billing unlock** ("Mish Ana! Full", about US$4.99). Phones always play free. Optional extra word packs later. No subscription and no web checkout in v1. |
| v2 (Apple TV) | A SwiftUI tvOS host with StoreKit 2 non-consumable IAP (required by 3.1.1), plus the same server entitlement model. Enrol through a **French** entity. |

---

## 1. Google Play (Android TV / Google TV)

### 1.1 Is Play Billing mandatory? Programs by region

| Region (by **user** location) | What applies today (2026-10-04) | TV eligible? | Source |
|---|---|---|---|
| **Lebanon, Middle East, rest of world** | Legacy Payments policy: Google Play Billing is **required** for in-app digital goods, and apps may not lead users to other payment methods. The new fee and choice rollout reaches the "rest of world" on **2027-09-30**. | n/a | [G1][G6][G7] (snippet) |
| **EEA (incl. France) + UK** | The **billing choice program** has been live since **2026-06-30**. It allows alternative in-app billing or **external web links**, alongside Play Billing, with a choice screen. Every transaction is reported with an external transaction token, and it needs Play Billing Library ≥ 9.1. | **No.** "To be eligible … your app must be an app or game on the **mobile or tablet** form factors." (snippet) The older EEA **external offers program** was reported to cover all form factors, Android TV included. Whether it is still open to new enrolments is **(unverified)**. | [G4][G5][G6] |
| **US** | An Epic injunction (upheld 2025-09-12; in force until 2027-11-01). Since 2025-10-29, links and alternative billing are allowed. Fee-bearing **external content links** and **alternative billing** programs started 2026-01-28. Reporting and fees apply from **2026-10-01**. | External content links: TV eligibility **(unverified)**. | [G11][G12][G13] |
| Australia; Japan and South Korea | Billing choice rollout on 2026-09-30, then 2026-12-31. | — | [G6] (snippet) |
| India, Indonesia, etc. | Legacy **user choice billing** (mobile/tablet). Not relevant to us. | No | [G14] (snippet) |

**Bottom line for Mish Ana!:** our audience is Lebanon and the Middle East (legacy rules), plus France (EEA billing choice, but mobile/tablet only). So **Play Billing is the only safe rail on the TV app** until at least 2027-09-30, or until Google opens a program to TV.

### 1.2 Service fees

| Regime | ≤ US$1M/yr | > US$1M/yr | Auto-renewing subs | Source |
|---|---|---|---|---|
| Legacy (Lebanon/ME until 2027-09-30) | 15% (must enrol in the 15% tier) | 30% | 15% from day one | [G2][G3] (snippet) |
| New (US/EEA/UK since 2026-06-30), **new installs** | 10% service fee + **5% billing fee** if Play Billing is used (0% billing fee for alternative billing or links) | 15–20% depending on program; reporting differs across sources | 10% (+5% billing fee) | [G6][G8] (fetched and snippet) |
| Games "Level Up" program (from 2026-09-30) | — | 15% new installs / 20% existing | — | [G15] (snippet). Requires Play Games Services, PC, controller and other items. Not worth pursuing at our size. |

### 1.3 Links, steering, QR codes

| Behaviour inside the TV app | Rest of world / France (TV) | Source |
|---|---|---|
| QR code or URL that leads to a web checkout for premium | **Not allowed.** The Payments policy prohibits leading users to non-Play payment methods. A QR code is not named explicitly, but it works as a link. **(inference)** | [G7] (snippet) |
| Linking to a help page or privacy policy | Allowed, as long as the page does not lead on to an alternative payment. | [G7] (snippet) |
| Mentioning "buy on our website" without a link | Only allowed for **consumption-only** apps, i.e. apps that sell nothing in-app. That rules it out once we sell through Play Billing. | [G7] (snippet) |
| Honouring something bought elsewhere (a cross-platform entitlement) | Consumption-only apps can let users access content paid for elsewhere. If the app also sells through Play, this is **(unverified)**; ask Play support before relying on it. | [G7] |

**The phone-controller page is the grey zone.** Phones reach our web page because the TV app shows them a QR code. A "Buy premium" button on that page could be read as steering from the app. **Do not sell on the phone page in v1.** The phone page may still *show* "Premium unlocked by host".

### 1.4 Play Billing on TV, and the merchant side

| Item | Finding | Source |
|---|---|---|
| Does Play Billing work on Android TV / Google TV? | Yes. Google's TV guidance says to "use the Play Billing library to support in-app purchases and manage subscriptions across both **mobile and TV**". The flow is the standard Play purchase dialog, navigated with the remote. Exact TV dialog UX, such as PIN or phone confirmation, is **(unverified)**; test it on a real device. | [G16] |
| Library | Play Billing Library 9.1.0 is current. Acknowledge purchases **within 3 days** or they are refunded automatically. Call `queryPurchasesAsync()` on launch to restore. `setObfuscatedAccountId` helps with fraud detection. | [G17] |
| Lebanon developer = merchant? | Lebanon has been listed as a merchant country since 2014 (snippet). The current list is at support.google.com/…/answer/9306917, which was blocked here, so re-check it. A **French** payments profile avoids Lebanese banking friction for payouts **(recommendation)**. | [G9] |
| Lebanon users can buy? | Lebanon is in the "paid apps available" buyer list (snippet). Whether local cards and Google Play gift cards work in practice is **(unverified)**. | [G10] |

---

## 2. Apple TV (tvOS) — there is no tvOS app today

| Topic | Rule | Source |
|---|---|---|
| 3.1.1 IAP | "If you want to unlock features or functionality within your app (… access to premium content, or unlocking a full version), you **must use in-app purchase**. Apps may not use their own mechanisms to unlock content … such as license keys … **QR codes** …" | [A1] |
| Steering, non-US storefronts | "…except for the United States storefront … apps and their metadata may not include buttons, external links, or other calls to action that direct customers to purchasing mechanisms other than in-app purchase." So a QR code to an external checkout is not allowed on tvOS outside the US. | [A1] |
| US storefront | No entitlement is required for buttons, external links or other calls to action. The April 30 2025 contempt order was affirmed by the Ninth Circuit on 2025-12-11. Apple may charge "some" limited fee on linked purchases, with the rate to be set in court. The Supreme Court agreed (2026-07-01) to hear Apple's appeal, with a ruling expected by mid-2027. | [A1][A2][A3] (snippet) |
| 3.1.3(b) Multiplatform | Users may access content bought "on other platforms or your web site … **provided those items are also available as in-app purchases** within the app". | [A1] |
| EU | A single set of EU terms was announced 2026-08-18, effective **2026-10-01**: IAP 26% standard, 15% for small business; 20%/10% with alternative payment processing; 5% on transactions outside the App Store. Reported only; apple.com was blocked. | [A4] (snippet) |
| Small Business Program | 15% commission at ≤ US$1M proceeds in the prior year (10% on EU alternative terms). | [A5] |
| Lebanon developer | Lebanon is an App Store storefront (sales are reported under "Rest of World", USD). Whether **developer enrolment and payouts** work from Lebanon is **(unverified)**. Enrol through the **French** entity. | [A6] (snippet) |

**Effort to build a tvOS client (estimate).** The TV app is a thin "big screen": QR and lobby, role-reveal choreography, timers, voting results. Game state lives in the Durable Object. A SwiftUI tvOS app needs:
- WebSocket client and reconnection
- Focus-engine navigation (`.focusable`, `@FocusState`; the Siri Remote has no D-pad, only a touch surface)
- QR rendering with CoreImage
- Localisation (EN/FR/AR, including RTL)
- StoreKit 2 and App Store Server API verification

Estimate: **about 3–6 developer-weeks** for parity, plus App Review. It needs a Mac and Xcode, and a US$99/yr Apple Developer Program membership **(fee unverified here)**.

---

## 3. How comparable products monetise

| Product | What is sold | Where it is bought | Who pays | Price | Source |
|---|---|---|---|---|---|
| Jackbox Party Packs | A paid-upfront pack per store | Each platform store; on Android TV through Google Play | **Host only**; phones play free in the browser | US$24.99–34.99 per pack (PP10 is $34.99 on Google TV) | [C1] (snippet) |
| AirConsole Hero | Subscription; "one-for-all" (one Hero per session unlocks for everyone) | Through the **app stores** (Apple, Google, Huawei, Amazon) that manage it; AirConsole cannot cancel it. Whether it is bought on the TV app or a phone app is not confirmed **(unverified)**. | One player per session | $4.99/mo, $23.99/yr, $29.99 lifetime (as listed) | [C2][C3] (snippet) |
| Kahoot! (Kahoot+) | Subscription tiers | App stores and web | Host | about $3.99–17.99/mo | [C4] (snippet) |
| Heads Up! | Paid app plus deck IAPs | App stores | Device owner | $1.99 app; decks about $0.99 | [C5] (snippet) |
| Netflix party games (LEGO Party, Pictionary, etc.) | Included with the Netflix subscription; phone is the controller | — | Netflix subscriber | $0 extra | [C6] (snippet) |
| Undercover™ (Yanstar Studio) | Freemium: Full Version, word packs, "Special Roles", time-limited ad removal | App stores | Device owner | Full $5.99; 1000+ words $3.99–4.99; 100 words $2.99; Special Roles $3.99; ad-free $0.99/week, $1.99/4 weeks | [C7] (snippet) |

**Pattern:** the host pays once and phones are free. Content packs are the add-on. The genre-specific benchmark (Undercover) is a **$5.99 full unlock plus $3–5 packs**.

---

## 4. Phone-web payment rails (for later or outside the apps)

| Provider | Lebanon entity | France entity | MoR / VAT | Fees (indicative) | Apple Pay / Google Pay | Source |
|---|---|---|---|---|---|---|
| Stripe | **Not supported** (not in the 46 countries) | Yes | No, you collect and remit VAT yourself (Stripe Tax is an add-on). The MoR option is **Managed Payments** (+3.5%, limited countries, Checkout only). | 1.5% + €0.25 for standard EEA cards; higher for international cards | Yes | [P1][P2][P3] (snippet) |
| Paddle (MoR) | Not on the unsupported list (snippet); approval is case by case | Yes | **Yes**, Paddle is the seller and handles global VAT | 5% + $0.50 | Yes (Google Pay express since 2026-06) | [P4][P5] (snippet) |
| Lemon Squeezy (MoR, owned by Stripe) | **(unverified)** | Yes | Yes | 5% + $0.50 (+1.5% international, +0.5% subscriptions) | Yes (Safari / Chrome) | [P6][P7] (snippet) |
| Whish Pay (Lebanon) | Yes | — | No | **(unverified)** | Wallet; cardless | [P8] (snippet) |
| Areeba (Lebanon acquirer) | Yes | — | No | **(unverified)** | Cards | [P9] (snippet) |

For a France-based seller of digital goods to EU consumers, VAT is due at the buyer's rate (OSS). An MoR (Paddle) removes that work for 5% + $0.50. On a $4.99 item that costs about 15%, so a store fee and an MoR fee cost about the same. **Any web sale must stay off the TV app's UI** under current Play rules (§1.3).

---

## 5. Recommendation

### 5.1 v1 model

| Item | Decision |
|---|---|
| What is sold | **"Mish Ana! Full"**: a one-time, **non-consumable** Play in-app product that unlocks all game modes and settings (e.g. Mr. White, custom timers, more than N players) and all current word packs. Later, optional **word packs** as separate non-consumables ($1.99–2.99). |
| Free tier | Core game with one base pack (AR/FR/EN) and a player cap. Fully playable, so the game spreads. |
| Who pays | **Host TV only.** Phones never pay and never see a buy button, the same "one-for-all" approach as Jackbox and AirConsole. |
| Price | US$4.99 in the US/EU (France €4.99). Use Play's per-country pricing to set a **lower Lebanon / Middle East price** (e.g. about $2.99) **(owner decision)**. |
| Subscription? | **No** for v1. A party game is used occasionally, and subscriptions need grace-period and account-hold handling. Revisit with v2 content cadence. |
| Rail on Android TV | **Google Play Billing only** (Play Billing Library 9.1+). |
| Phone-web purchase | **No in v1.** Not policy-safe while the TV app shows the QR code (rest of world, and no TV billing choice in the EEA). Re-evaluate after Google extends billing choice to TV or to the rest of world (≥ 2027-09-30). Even then, sales must go through the choice screen and be reported. |

### 5.2 Entitlement architecture (account-less)

```
TV app ──launchBillingFlow(obfuscatedAccountId = sha256(installId))──▶ Google Play
TV app ──POST /play/verify {productId, purchaseToken, installId}──▶ Worker
Worker ──GET androidpublisher …/purchases/productsv2/tokens/{token}──▶ Google (service-account JWT, RS256 via WebCrypto)
Worker: check packageName, productId, purchaseState=PURCHASED, obfuscatedAccountId
Worker ──acknowledge──▶ Google   (must happen < 3 days, or the purchase is refunded)
Worker ──store──▶ EntitlementDO (key = purchaseToken; index installId → tokens)
Worker ──▶ TV: signed entitlement (HMAC/Ed25519 JWT: installId, products, iat)
TV ──createRoom {entitlementJWT}──▶ RoomDO: verify signature → room.premium = true, packs = [...]
RoomDO ──room state {premium, packs}──▶ phones (UI only; words served by DO)
Google Pub/Sub (RTDN) ──push──▶ Worker /play/rtdn (verify push OIDC token) → revoke on cancel/void
Cron Trigger (daily) ──Voided Purchases API──▶ revoke refunded tokens
```

- **The server is the source of truth.** Premium word lists live server-side and the RoomDO hands them out only when `room.premium`. A modded APK therefore cannot unlock content.
- **Restore:** on each launch, `queryPurchasesAsync()` runs and the tokens are re-posted to `/play/verify`. This works on any TV signed into the same Google account. No Mish Ana! account is needed in v1. [G17]
- **RTDN / one-time products:** `ONE_TIME_PRODUCT_PURCHASED` and `ONE_TIME_PRODUCT_CANCELED`, then call `purchases.productsv2.getproductpurchasev2`. De-duplicate on `messageId`. [G18][G19]
- **Short-lived JWT** (e.g. 7 days), refreshed on launch, so revocations take effect.
- **v2 cross-platform:** add an optional account (e.g. email magic link) only when Apple TV ships. Map Play tokens and Apple `originalTransactionId` to the account. Under 3.1.3(b) Apple allows honouring a Play purchase if the same item is also sold as IAP on tvOS.

### 5.3 v2: Apple TV

1. Build a SwiftUI tvOS host that reuses the same WebSocket protocol and the phone web client unchanged.
2. Add a StoreKit 2 non-consumable with the same product IDs. The server verifies signed transactions through the App Store Server API, receives App Store Server Notifications v2, and issues the same entitlement JWT.
3. Enrol in the Small Business Program (15%).
4. In the **US storefront only**, the app may also link or QR to a web checkout. Watch the court-set commission. Elsewhere the app must use IAP only.

### 5.4 Decisions the owner must make

| # | Decision | Suggested default |
|---|---|---|
| 1 | Which legal entity sells: France (company or micro-entreprise) or Lebanon | **France**, for easier Stripe/Paddle/Apple access and EUR payouts |
| 2 | Free tier limits (players, modes, packs) | Base pack + max 8 players |
| 3 | Price points by region | $4.99 / €4.99; about $2.99 Lebanon/ME |
| 4 | Product split: one "Full" SKU only, or also à-la-carte packs | One SKU at launch; packs later |
| 5 | Accounts in v1? | No (account-less, keyed by Google purchase token) |
| 6 | Apple TV timing | After Android TV hits product-market fit |

### 5.5 Setup checklist

1. **Play Console** developer account → **Payments profile / merchant account** (entity and bank, ideally French) → enrol in the **15% service-fee tier** (legacy regions).
2. Create the in-app products (`full_unlock`, later `pack_*`). Set per-country prices and add license testers.
3. Upload to an internal or closed test track. Billing only works on builds distributed through Play.
4. **Google Cloud project** linked in Play Console → enable the Google Play Android Developer API → create a **service account**, grant it "View financial data" and "Manage orders" in Play Console, and store its JSON key as a Workers secret.
5. **Pub/Sub topic** for RTDN → grant `google-play-developer-notifications@system.gserviceaccount.com` publish rights → create a push subscription to `https://<worker>/play/rtdn` → set the topic in Play Console → Monetization setup.
6. Workers: `/play/verify`, `/play/rtdn`, an EntitlementDO, a daily Cron for voided purchases, and an entitlement-JWT signing key secret.
7. TV app: Play Billing Library 9.1+ and a purchase UI that works with the D-pad. Test purchase, refund and restore on a real Google TV device.
8. (v2) Apple Developer Program (French entity), Paid Apps agreement, Small Business Program, App Store Server API key, and the Server Notifications URL.

---

## Sources

Google
- [G1] Google Play US policy update (Epic injunction) — https://support.google.com/googleplay/android-developer/answer/15582165 (snippet)
- [G2] Service fees — https://support.google.com/googleplay/android-developer/answer/112622 (snippet)
- [G3] 15% subscriptions from day one — https://9to5google.com/2021/10/21/google-play-subscription-fee/ (snippet)
- [G4] Billing choice program enrolment — https://support.google.com/googleplay/android-developer/answer/17161464 (snippet: regions; "mobile or tablet form factors")
- [G5] Billing choice program (developer docs) — https://developer.android.com/google/play/billing/billingchoice (fetched)
- [G6] "Expanded billing choice and lower fees on Google Play" (2026-06) — https://developer.android.com/blog/posts/expanded-billing-choice-and-lower-fees-on-google-play (fetched); rollout schedule (rest of world 2027-09-30) — https://www.androidpolice.com/googles-play-store-billing-shake-up-finally-happening-next-week/ , https://www.macrumors.com/2026/06/24/google-play-store-fee-change/ (snippets)
- [G7] Understanding Google Play's Payments policy — https://support.google.com/googleplay/android-developer/answer/10281818 (snippet)
- [G8] 9to5google, external billing from June 30 — https://9to5google.com/2026/06/24/google-play-store-external-billing-june-30/ (snippet)
- [G9] Merchant countries — https://support.google.com/googleplay/android-developer/answer/9306917 ; https://android-developers.googleblog.com/2014/11/chinese-developers-can-now-offer-paid.html (snippet: Lebanon added)
- [G10] Paid app availability (buyers) — https://support.google.com/googleplay/answer/143779 (snippet)
- [G11] US external content links program — https://support.google.com/googleplay/android-developer/answer/16470497 (snippet); https://developer.android.com/google/play/billing/externalcontentlinks (fetched)
- [G12] US fees from 2026-10-01 — https://github.com/mjmirza/app-store-compliance/issues/623 (snippet)
- [G13] Epic v. Google remedies — https://www.androidheadlines.com/2025/10/google-play-store-alternative-third-party-billing-us-ruling-epic-games.html (snippet)
- [G14] User choice billing — https://support.google.com/googleplay/android-developer/answer/13821247 (snippet); external offers program (all form factors) — https://support.google.com/googleplay/android-developer/answer/14372887 (snippet)
- [G15] Games Level Up fees — https://respawn.outlookindia.com/gaming/gaming-news/google-play-revamps-billing-with-lower-developer-fees (snippet)
- [G16] Best practices for Google TV (Play Billing on TV) — https://developer.android.com/training/tv/get-started/google-tv (fetched)
- [G17] Integrate Play Billing Library — https://developer.android.com/google/play/billing/integrate (fetched)
- [G18] Backend integration — https://developer.android.com/google/play/billing/backend (fetched)
- [G19] purchases.productsv2 / RTDN reference — https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2/getproductpurchasev2 , https://developer.android.com/google/play/billing/rtdn-reference (snippet)

Apple
- [A1] App Review Guidelines 3.1.1, 3.1.1(a), 3.1.3(b) — https://developer.apple.com/app-store/review/guidelines/ (fetched)
- [A2] Ninth Circuit affirms contempt (2025-12-11) — https://www.cravath.com/news-insights/epic-games-ninth-circuit-win-affirming-civil-contempt-finding.html (snippet)
- [A3] Supreme Court to hear Apple appeal — https://www.macrumors.com/2026/06/30/apple-epic-games-supreme-court/ ; https://appleinsider.com/articles/26/05/06/supreme-court-denies-apples-hopes-for-breathing-space-in-its-fight-against-epic (snippets)
- [A4] Apple EU terms (2026-08-18, effective 2026-10-01) — https://apple.com/newsroom/2026/08/apple-announces-changes-for-apps-in-the-european-union (blocked); https://www.subscriptioninsider.com/blog/apple-sets-new-eu-app-store-fees (snippet)
- [A5] Small Business Program — https://developer.apple.com/app-store/small-business-program/ (fetched)
- [A6] Financial report regions — https://developer.apple.com/help/app-store-connect/reference/financial-report-regions-and-currencies/ (snippet)

Comparables
- [C1] Jackbox PP10 on Google TV — https://9to5google.com/2023/11/17/jackbox-party-pack-10-google-android-tv/ (snippet)
- [C2] AirConsole Hero — https://sites.google.com/a/n-dream.com/airconsole-help/home/what-is-airconsole-hero ; https://airconsole.zendesk.com/hc/en-us/articles/360014580419-Cancel-AirConsole-Hero (snippets)
- [C3] AirConsole IAP prices — https://apppricinglab.com/iap/apple/1017688554 (snippet)
- [C4] Kahoot+ pricing — https://subger.com/en/service/kahoot-plus (snippet)
- [C5] Heads Up! — https://apps.apple.com/app/id623592465 (snippet)
- [C6] Netflix party games — https://www.tomsguide.com/entertainment/netflix/how-to-set-up-netflix-games-on-tv-all-you-need-is-your-phone (snippet)
- [C7] Undercover™ (Yanstar) IAPs — https://apppricinglab.com/app/apple/946882449 (snippet)

Payments
- [P1] Stripe countries — https://support.stripe.com/questions/stripe-feature-availability-by-country (snippet; Lebanon absent)
- [P2] Stripe EEA pricing — https://support.stripe.com/questions/pricing-updates-for-businesses-based-in-the-european-economic-area-(eea) (snippet)
- [P3] Stripe Managed Payments — https://dodopayments.com/blogs/stripe-managed-payments-fees-explained (snippet, third party)
- [P4] Paddle supported countries — https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle (snippet)
- [P5] Paddle Google Pay express checkout — https://developer.paddle.com/changelog/2026/google-pay-express-checkout (snippet)
- [P6] Lemon Squeezy fees — https://dodopayments.com/blogs/lemonsqueezy-review (snippet, third party)
- [P7] Lemon Squeezy payment methods — https://docs.lemonsqueezy.com/help/checkout/payment-methods (snippet)
- [P8] Whish Pay — https://apps.shopify.com/whishpay ; https://www.zawya.com/en/press-release/companies-news/whish-money-launches-on-shopify-leading-the-regions-first-cardless-checkout-e53619rq (snippet)
- [P9] Areeba — https://economy.gov.lb/en/services/support-to-smes/online-payment-platforms-for-smes-and-start-ups (snippet)
