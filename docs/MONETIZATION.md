# JAMAA — Monetization & Payments Research

> **Rename and model update (2026-11-08).** The app is now **JAMAA**, a multi-game party platform, and "Mish Ana!" is its game #1 ([JAMAA-PLATFORM.md](JAMAA-PLATFORM.md) §1). **The current decision is the JAMAA Pass** (§5.1): a subscription (`jamaa_pass`, base plans `monthly` and `yearly`, a 7-day free trial on each) that unlocks every pack of every game, plus one-time `pack_<family>` packs. Every game stays free to play with starter content, and everything is behind `BILLING_ENABLED` (JAMAA-PLATFORM §4, which supersedes PAYMENTS-SPEC revision 3). The 2026-10-26 lifetime decision is archived in §5.1.1. The store-policy research in §1–§4 is unchanged.

Status: research note, written 2026-10-04; decision section (§5) updated 2026-11-08. Covers the Android TV / Google TV host app (Kotlin, Compose for TV), browser-only phone controllers, a Cloudflare Workers + Durable Objects backend, a developer based in Lebanon / France, and players in Lebanon, the Middle East and France.

> **How to read this.** App-store payment rules changed several times in 2024–2026. The network proxy for this research blocked `support.google.com`, `play.google.com`, `android-developers.googleblog.com`, `stripe.com`, `paddle.com`, `apple.com/newsroom` and most news sites. Those facts come from **search-engine snippets** of the official pages and are marked **(snippet)**. Pages fetched in full are `developer.android.com`, `developers.google.com` (via snippet) and `developer.apple.com`. **(unverified)** marks anything I could not confirm from a source. Re-check every policy row in Play Console and App Store Connect before launch.

---

## TL;DR

| Question | Answer |
|---|---|
| Must the Android TV app use Google Play Billing? | **Yes, for our markets.** Lebanon and the Middle East stay on the old Payments policy until **2027-09-30**. The new "billing choice" program covers the US, EEA and UK only, and it is limited to **mobile and tablet** apps, so it does not cover TV. [G1][G4][G6] |
| Can the TV app show a QR code that sends the user to a web page to pay? | **No, not in v1.** Outside the enrolled programs, steering users to another payment method is prohibited. A QR code is a link in effect. [G7] |
| Play fee for a small developer | Rest of world (Lebanon/ME): 15% (15% tier) and 15% for subscriptions. US/EEA/UK new installs since 2026-06-30: 10% service fee **+ 5% billing fee** when Play Billing is used, so 15% in total. [G2][G3][G8] |
| Can a Lebanon-based developer be a Play merchant? | Yes. Lebanon is a merchant country (snippet) and also a buyer country for paid apps (snippet). [G9][G10] |
| v1 model | **JAMAA Pass (decided 2026-11-08, §5.1):** a host-only subscription (monthly or yearly, 7-day free trial) unlocking every pack of every game, plus one-time packs. Every game is free to play with starter content. Phones always play free and never see a price. No web checkout. *Superseded:* the 2026-10-04 one-time "Full" unlock and the 2026-10-26 lifetime `premium` unlock (archived in §5.1.1). |
| v2 (Apple TV) | A SwiftUI tvOS host with StoreKit 2 IAP (an auto-renewable subscription for the Pass, non-consumables for packs; required by 3.1.1), plus the same server entitlement model. Enrol through a **French** entity. |

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

**Bottom line for JAMAA:** our audience is Lebanon and the Middle East (legacy rules), plus France (EEA billing choice, but mobile/tablet only). So **Play Billing is the only safe rail on the TV app** until at least 2027-09-30, or until Google opens a program to TV.

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

### 5.1 v1 model: the JAMAA Pass (DECIDED by the owner, 2026-11-08)

**Decision log**
- 2026-10-04: Premium subscription (monthly + yearly, 7-day trial) plus à-la-carte packs.
- 2026-10-26: subscription dropped for a one-time lifetime unlock. **Archived** in §5.1.1.
- **2026-11-08: back to a subscription, now for the whole platform: the JAMAA Pass** (JAMAA-PLATFORM §0 and §4). Why it changed: with four games and more coming, the offer is a growing catalog rather than one game played a few nights a year. One Pass for every game is the strongest price story against per-pack competitors (BLUEPRINT §2, §5). The yearly plan is the default in the TV store and answers the "a subscription is a trap" objection that drove the lifetime decision. The trial lets a household try every pack during one party night. A short "Party Night" pass is planned for phase 2 (BLUEPRINT §5.2, D3).

| Item | Decision |
|---|---|
| Free tier | **Every game is free to play** with starter content: Mish Ana! `*-everyday-01` in EN/FR/AR/ES, the free items of Bluff and Most Likely, and the whole first Lebanon quiz for Trivia (JAMAA-PLATFORM §4.3). Unlimited rooms, 3–12 players. |
| **JAMAA Pass** | Play subscription `jamaa_pass` with base plans `monthly` (P1M) and `yearly` (P1Y), and the offer `trial-7d` on each (one 7-day free phase for new subscribers). Grace period and account hold stay at their defaults, pause is off, resubscribe is on. Unlocks **every premium pack of every game, current and future**, plus each game's premium settings. |
| **Single packs** | One-time **non-consumable** Play products `pack_<family>`, owned forever (all locales of that content family). Existing Mish Ana! pack ids are unchanged (`pack_en_food_01` …). |
| Lifetime unlock | **None** (removed everywhere, JAMAA-PLATFORM §4.2). |
| Who pays | **The host TV only.** Phones never pay, never see a price or a buy button, and say "Unlock on the TV". |
| Where it is sold | The TV store: a Pass hero with Monthly / Yearly cards (Yearly focused, "Save n %", trial badge when eligible), then packs grouped by game, Restore and Manage subscription (JAMAA-PLATFORM §4.5). At most one soft upsell line on results, after the 2nd finished game of the night, never during play. |
| Prices | Set in Play Console by the owner. The recommended grid is BLUEPRINT §5.2 (owner decision D2, open). The rule: the yearly Pass costs less than one $29.99 competitor pack in every region, and the monthly Pass costs less than $4.99. US targets: **$3.99 / month, $24.99 / year, $2.99 per pack**. Gulf: about $3.49 / $19.99. Lebanon, Jordan, Iraq: $1.49 / $9.99 (in USD). Egypt and the Maghreb: about $0.99 / $7.99. LatAm: about $1.99 / $12.99. EU: €3.49 / €22.99. The earlier starting point (about $4.99 / $29.99, roughly 40 % lower in Lebanon and the Middle East) is the upper bound. Packs stay at or below a third of the yearly price. |
| Seller | **The owner as an individual** Play developer account (unchanged; check Play Console's current rules for individual accounts, such as the closed-test requirement). |
| Rail on Android TV | **Google Play Billing only.** |
| Phone-web purchase | **None.** Not policy-safe (§1.3). |
| Switch | `BILLING_ENABLED` (default `"0"`): off = every room plays the whole catalog and the Pass UI is hidden. |

Entitlement = the Pass is active if `subscriptionsv2.get` gives an expiry in the future and a state that grants access (ACTIVE, IN_GRACE_PERIOD, or CANCELED before expiry; not ON_HOLD, PAUSED, EXPIRED or PENDING), **plus** the set of owned `pack_*` families. A room's playable content is the free content, plus everything with the Pass, plus the host's owned families.

**Later levers** (BLUEPRINT §5.2, not v1): the 48-hour Party Night pass (needs a server-side expiring entitlement), gift codes before Ramadan, Eid and Christmas, a Ramadan trial promo, and a B2B venue licence. No ads during play.

#### 5.1.1 Archived: the lifetime decision (2026-10-26, superseded 2026-11-08)

> Archived 2026-11-08. This was the decision for the single-game app "Mish Ana!". It was replaced by the JAMAA Pass above. Nothing was ever sold under it, and the `premium` product was never created on the new Play app (`app.jamaa.tv`), so no customer migration is needed (JAMAA-PLATFORM §4.6).

- 2026-10-26: the subscription is dropped. Premium becomes a one-time lifetime unlock (`premium`, Play in-app product, non-consumable): $7.99 list, $5.99 launch promo (a Play Console sale, not code). Packs stay one-time at $1.99–2.99. Reason given: a party game is played a few nights a year, so a subscription reads as a trap; a lifetime price matched the market scan (growth/marketing/launch/MARKET-SCAN.md) and removed the trial/renewal/manage-subscription UI.

| Item | Decision (archived) |
|---|---|
| Free tier | Core game: full rules, 3–12 players, one starter pack per language (EN/FR/AR). |
| Premium (lifetime) | `premium`: one-time non-consumable. $7.99 list, $5.99 launch promo. Unlocked every pack, including later ones, plus premium settings, for good. No subscription, no trial. |
| Single packs | `pack_<packId>`, non-consumable, owned forever. $1.99 (under 60 pairs), $2.99 (60+ pairs). |
| Subscription | None. |
| Who pays | The host TV only. |
| Prices by region | Play per-country pricing, about 40 % lower in Lebanon and the Middle East. |

### 5.2 Entitlement architecture (account-less)

```
TV app ──launchBillingFlow(obfuscatedAccountId = sha256(installId))──▶ Google Play
TV app ──POST /play/verify {productId, purchaseToken, installId}──▶ Worker
Worker ──GET androidpublisher …/purchases/subscriptionsv2/tokens/{token} (Pass)
         or …/purchases/productsv2/tokens/{token} (packs)──▶ Google (service-account JWT, RS256 via WebCrypto)
Worker: check packageName (app.jamaa.tv), productId, state, expiry (Pass), obfuscatedAccountId
Worker ──acknowledge──▶ Google   (must happen < 3 days, or the purchase is refunded)
Worker ──store──▶ EntitlementDO (key = purchaseToken; index installId → tokens)
Worker ──▶ TV: signed entitlement (Ed25519, iss "jamaa": installId, pu = Pass expiry, packs = families, iat)
TV ──createRoom {entitlementJWT}──▶ RoomDO: verify signature → room.premium = true, packs = [...]
RoomDO ──room state {premium, packs}──▶ phones (UI only; words served by DO)
Google Pub/Sub (RTDN) ──push──▶ Worker /play/rtdn (verify push OIDC token) → update on renew/hold/expire, revoke on void
Cron Trigger (daily) ──Voided Purchases API──▶ revoke refunded tokens
```

- **The server is the source of truth.** Premium word lists live server-side and the RoomDO hands them out only when `room.premium`. A modded APK therefore cannot unlock content.
- **Restore:** on each launch, `queryPurchasesAsync()` runs and the tokens are re-posted to `/play/verify`. This works on any TV signed into the same Google account. No JAMAA account is needed in v1. [G17]
- **RTDN:** `subscriptionNotification` (Pass renewals, grace, hold, cancel, expiry; then `subscriptionsv2.get`) and `ONE_TIME_PRODUCT_PURCHASED` / `ONE_TIME_PRODUCT_CANCELED` for packs (then `productsv2.getproductpurchasev2`). De-duplicate on `messageId`. A daily cron re-checks stale subscriptions. Implementation: PAYMENTS-SPEC rev 4. [G18][G19]
- **Short-lived JWT** (e.g. 7 days), refreshed on launch, so revocations take effect.
- **v2 cross-platform:** add an optional account (e.g. email magic link) only when Apple TV ships. Map Play tokens and Apple `originalTransactionId` to the account. Under 3.1.3(b) Apple allows honouring a Play purchase if the same item is also sold as IAP on tvOS.

### 5.3 v2: Apple TV

1. Build a SwiftUI tvOS host that reuses the same WebSocket protocol and the phone web client unchanged.
2. Add StoreKit 2 products with the same ids (an auto-renewable subscription for the Pass, non-consumables for packs). The server verifies signed transactions through the App Store Server API, receives App Store Server Notifications v2, and issues the same entitlement JWT.
3. Enrol in the Small Business Program (15%).
4. In the **US storefront only**, the app may also link or QR to a web checkout. Watch the court-set commission. Elsewhere the app must use IAP only.

### 5.4 Decisions the owner must make

| # | Decision | Suggested default |
|---|---|---|
| 1 | Seller | **Decided:** the owner, as an individual |
| 2 | Free tier | **Decided:** every game free to play with starter content (JAMAA-PLATFORM §4.3) |
| 3 | Price points by region | **Open (BLUEPRINT D2):** recommended grid in §5.1 (US $3.99 / month, $24.99 / year, packs $2.99), set in Play Console |
| 4 | Product split | **Decided 2026-11-08:** `jamaa_pass` subscription (monthly + yearly, `trial-7d`) plus `pack_<family>` non-consumables; no lifetime product (the 2026-10-26 lifetime split is archived in §5.1.1) |
| 5 | Accounts in v1? | No (account-less, keyed by Google purchase token) |
| 6 | Apple TV timing | After Android TV hits product-market fit |

### 5.5 Setup checklist

1. **Play Console** developer account → **Payments profile / merchant account** (entity and bank, ideally French) → enrol in the **15% service-fee tier** (legacy regions).
2. On the Play app **JAMAA** (`app.jamaa.tv`): create the subscription `jamaa_pass` (base plans `monthly`, `yearly`; offer `trial-7d` on each), then every `pack_*` from `pnpm --filter @jamaa/server billing:products`. Set per-country prices and add license testers.
3. Upload to an internal or closed test track. Billing only works on builds distributed through Play.
4. **Google Cloud project** linked in Play Console → enable the Google Play Android Developer API → create a **service account**, grant it "View financial data" and "Manage orders" in Play Console, and store its JSON key as a Workers secret.
5. **Pub/Sub topic** for RTDN → grant `google-play-developer-notifications@system.gserviceaccount.com` publish rights → create a push subscription to `https://<worker>/play/rtdn` → set the topic in Play Console → Monetization setup.
6. Workers: the billing routes, the Billing DO, the daily crons (voided purchases, stale subscriptions) and the `ENTITLEMENT_KEYS` secret (all implemented; see PAYMENTS-SPEC §8 and BILLING-LAUNCH.md).
7. TV app: Play Billing Library 9.1+ and a D-pad purchase UI (implemented). Test the trial, a renewal, a cancellation, a refund and restore on a real Google TV device.
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
