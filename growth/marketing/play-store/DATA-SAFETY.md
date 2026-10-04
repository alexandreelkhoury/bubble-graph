# Mish Ana! — Data safety, content rating, target audience and other App content answers

Prepared 2026-10-04 from the code in `/home/alex/bubble-graph` (HEAD `672b09c`). All paths below are relative to that repo. Where to click: Play Console → your app → **Policy → App content** (direct: `https://play.google.com/console/u/0/developers/<DEV_ID>/app/<APP_ID>/app-content/overview`).

Policy references: [Data safety form](https://support.google.com/googleplay/android-developer/answer/10787469) · [Target audience & content](https://support.google.com/googleplay/android-developer/answer/9867159) · [Families policy](https://support.google.com/googleplay/android-developer/answer/9893335).

---

## 0. What the code actually does (the facts every answer rests on)

| Fact | Evidence |
|---|---|
| The TV app's only permission is `INTERNET`; no location, mic, camera, contacts, storage, AD_ID | `tv-app/app/src/main/AndroidManifest.xml:5`; merged debug manifest (`tv-app/app/build/outputs/logs/manifest-merger-debug-report.txt`) adds only AndroidX's internal `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` |
| No ads, analytics, crash-reporting or attribution SDKs in the TV app (Compose, tv-material, AndroidX, kotlinx, OkHttp, ZXing only) | `tv-app/app/build.gradle.kts:86-110` |
| The phone web page loads nothing third-party: CSP `default-src 'self'`, `font-src 'self'`, `Referrer-Policy: no-referrer`; no analytics code anywhere in `web-client/src` | `web-client/public/_headers:1-4`; grep for gtag/analytics/sentry/posthog/plausible/umami/mixpanel = 0 hits |
| What the TV sends when creating a room: its UI language only (`{"locale":"en"}`) | `tv-app/app/src/main/java/app/mishana/tv/net/RoomApi.kt:35`; server parse `server/src/http.ts:88` |
| The TV's connection ids are random UUIDs made fresh per connection (not a device id, not persisted) | `tv-app/app/src/main/java/app/mishana/tv/net/ServerUrls.kt:12-13` |
| The TV stores locally only its sound on/off setting (and, in debug builds only, a server URL); backups disabled | `tv-app/.../settings/SoundPrefs.kt:5-7`, `settings/DebugPrefs.kt:6-8`; `AndroidManifest.xml:13` (`allowBackup="false"`) |
| A player (on the phone web page) sends: a **nickname** (1–16 characters, sanitised), a colour, a language | `shared/src/protocol/messages.ts:33`, `shared/src/constants.ts:9`, `server/src/room-core.ts:476-487` |
| The Blank's typed guess (1–200 chars) is sent and kept until the room ends; votes / "ready" / "done" actions are game actions | `shared/src/protocol/messages.ts:18`, `shared/src/engine/types.ts:86,123` |
| Server storage per room: game state (players: id, nickname, colour, language, seat, role, word, alive…), hashed resume tokens, hashed TV token | `shared/src/engine/types.ts:49-61`, `server/src/room-store.ts:5-16` |
| **Everything in a room is deleted automatically**: 15 min after creation if nobody joined, 30 min after a game's results with no replay, and at most 2 h after the last activity | `shared/src/constants.ts:21-23`, `server/src/room-core.ts:96-106` (`expiresAt`), `:284-287` (alarm wipes storage), `server/src/room-store.ts:70-71` (`deleteAll`) |
| The phone remembers locally (its own browser storage): nickname, colour, language, vibration setting, and a resume token per room for 6 h | `web-client/src/lib/storage.ts:6-16,52-73` |
| IP address: used only as a rate-limit key and, inside a room, as a truncated salted SHA-256 (`roomCode:ip`, 16 hex chars) for join limiting; never stored in room storage, never logged by app code | `server/src/request.ts:3-6`, `server/src/http.ts:68-69`, `server/src/index.ts:53`, `server/src/room-core.ts:41,79,198` |
| App logs contain only `{code, phase, roomCode}` on internal errors | `server/src/http.ts:112`, `server/src/room-core.ts:720-722`, rule `docs/SPEC.md:1321-1325` |
| Transport is encrypted: release builds forbid cleartext and refuse to build with a non-`https://` server | `AndroidManifest.xml:19`; `tv-app/app/build.gradle.kts:71-84`; production `https://play.mishana.workers.dev` (`tv-app/gradle.properties`) |
| No accounts, no login, no email, no payments **in the current build** | Billing not in TV deps (`build.gradle.kts:86-110`); server PAY-GAP, entitlement never verified (`server/src/http.ts:91-93`, `server/src/room-core.ts:654-657`) |

### ⚠ Uncertain item to resolve before submitting
**Cloudflare Workers Logs.** `server/wrangler.jsonc:8` has `"observability": { "enabled": true }`, which turns on Cloudflare **invocation logs** (one log per request with request metadata, retained up to 7 days per [Cloudflare docs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)). Whether those logs include the client IP / request headers could not be confirmed from the docs today. Two clean options:
1. **Recommended:** have the repo owner/session set `"observability": { "enabled": true, "logs": { "invocation_logs": false } }` (keeps the app's own `console.error` logs, drops per-request metadata) and redeploy. Then "IP used only transiently" is strictly true.
2. Or keep it and leave the sentence in the privacy policy that says our host may keep technical request logs, including IP addresses, for up to 7 days for security and debugging (already drafted in PRIVACY-POLICY.md). The Data safety answers below stay the same either way (that is service-provider processing for security/debugging, see §1 note 3).

---

## 1. Data safety form

Play Console → Policy → App content → **Data safety** → Start.

### 1.A Answers for the current build (v0.1.x, no billing)

**Step "Data collection and security"**

| Question | Answer | Justification |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Conservative. The nickname, the Blank's guess and the votes are sent to and stored on our server (§0). See note 1 for the "No" alternative and why it is not recommended |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | HTTPS/WSS only in release (`AndroidManifest.xml:19`, `build.gradle.kts:79-81`); the phone page is served over HTTPS by the same Worker |
| Which of the following methods of account creation does your app support? | **My app does not allow users to create an account** | No accounts anywhere (`docs/PLAN.md:117`) |
| Do you provide a way for users to request that their data is deleted? | **Yes** | Users can email `{{SUPPORT_EMAIL}}` (privacy policy); in practice data is already deleted automatically within 2 h of last activity (§0). No "delete account" URL is needed because there are no accounts |

**Step "Data types"** — tick exactly these:

| Category › Data type | Collected | Shared | Processed ephemerally? | Required or optional | Purposes |
|---|---|---|---|---|---|
| **Personal info › Name** | Yes | No | **No** (kept in the room until it expires) | **Required** (a nickname is needed to join; any pseudonym works) | **App functionality** |
| **App activity › Other user-generated content** (the Blank's typed guess) | Yes | No | No | **Optional** (only the Blank, and they can skip, `guess.skip`) | **App functionality** |
| **App activity › App interactions** (votes, ready, clue done, host settings) | Yes | No | No | Required | **App functionality** |

Everything else: **not collected** — Location, Financial info, Health, Messages (no chat), Photos/videos, Audio, Files, Calendar, Contacts, Web browsing, Installed apps, Search history, **App info and performance** (no crash/diagnostic SDK), **Device or other IDs** (connection UUIDs are random per connection and never persisted, `ServerUrls.kt:12-13`).

Notes:
1. *Why not "No data collected"?* One could argue the Play app (the TV) itself sends only its UI language and random per-session ids, and that nicknames/guesses are typed into a **website** on the phones. But the TV app is the host of that service, displays those nicknames, and the server stores them; Google's definition of "Name" explicitly includes nicknames. Under-declaring is a policy violation; over-declaring costs almost nothing. **Recommendation: declare as above.**
2. *Shared = No:* Cloudflare hosts and processes the data on our behalf (service provider). Google's form excludes transfers to service providers from "sharing".
3. *IP address* is not a Play data type; it is only used transiently for abuse/rate limiting (§0). Google counts IP only if you derive location from it, which the app does not.
4. *Security practices section* (optional badges): "Independent security review" = No.

### 1.B Changes when Play Billing ships (do it in the same release)

From `docs/PAYMENTS-SPEC.md` §6.3 (lines 1192-1216): the TV will create a random `installId` (stored in `mishana_billing` prefs, excluded from backup), the server stores only `sha256(installId)` and hashed purchase tokens; it never stores names, emails, Google account ids, order ids, prices or IPs.

Add:
| Category › Data type | Collected | Shared | Ephemeral | Required/optional | Purposes |
|---|---|---|---|---|---|
| **Financial info › Purchase history** | Yes | No | No | Optional (only buyers) | App functionality |
| **Device or other IDs** (the install id, hashed; also the Play `obfuscatedAccountId`) | Yes | No | No | Required | App functionality, **Fraud prevention, security, and compliance** |

Payment card data is handled by Google Play, never by the app → **do not** declare "User payment info".

---

## 2. Content rating (IARC questionnaire)

Play Console → Policy → App content → **Content ratings** → Start questionnaire.

| Field | Answer | Justification |
|---|---|---|
| Email address | `{{SUPPORT_EMAIL}}` | IARC sends the certificate there |
| Category | **Game** (not "All other app types") | It is a party game |
| Violence (any depiction, realistic or fantasy) | **No** | Being voted out is a stamp "OUT"; DESIGN forbids blood/skulls/horror (`docs/DESIGN.md:31`) |
| Fear / horror | **No** | Same |
| Sexuality / nudity / sexual references | **No** | Word packs scanned: everyday objects, food, places, jobs, nature (`word-packs/packs/*`); every pack is `ageRating: "all"` |
| Language: profanity, crude humour | **No** | Content is fixed word lists; user nicknames are covered by "users interact" below |
| Controlled substances (drugs, alcohol, tobacco) | **No** | Scanned the 563 pairs for alcohol/drug/tobacco/gambling terms: none. Re-scan when packs are added |
| Gambling (real or simulated) | **No** | Points scoreboard only; no betting, no currency, no casino. The pair "ورق شدة" (playing cards) is a word, not a mechanic |
| Discrimination / hate | **No** | |
| Does the app allow users to interact or exchange content with each other (text, voice, images)? | **Yes** | Players type a nickname and the Blank types a guess, both displayed to the other players in the room on the TV/phones. No chat, no voice, no images, no friend lists, rooms are private (4-letter code) and short-lived. Answering Yes is the safe reading; expect the "Users Interact" descriptor |
| Does the app share the user's current physical location with other users? | **No** | No location permission/data |
| Does the app allow users to purchase digital goods? | **No** (current build) → **Yes** when billing ships, re-submit the questionnaire then | `build.gradle.kts:86-110` |
| Does the app contain a web browser / unrestricted internet access? | **No** | The TV never opens a browser or WebView (also TV-WB) |
| Is the app primarily a news/educational/reference app? | No | |

**Expected result** (uncertain, IARC computes it): ESRB **Everyone**, PEGI **3**, USK **0**, ClassInd **L**, plus the interactive element **"Users Interact"** (and "In-Game Purchases" after billing). If any authority returns higher than PEGI 7 / ESRB E10+, re-check the "users interact" answer wording before appealing.

---

## 3. Target audience and content

Play Console → Policy → App content → **Target audience and content**.

| Question | Answer | Justification |
|---|---|---|
| Target age groups | **13–15, 16–17, 18 and over** (leave 0–12 unticked) | Social-deduction "lying" party game hosted by an adult on the family TV. Ticking any under-13 band makes the whole **Families policy** apply (Families Self-Certified SDKs, Teacher-approved style content review, stricter data rules, review of the free-text nickname/guess features, and the new 2026 rule against anonymous chat features targeting children). Nothing in the app is designed for children, so declaring 13+ is accurate and avoids that review track. Matches `docs/PAYMENTS-SPEC.md:1296` ("13+, so that Families policy is avoided") |
| Could your store listing unintentionally appeal to children? | **No** | Keep it true: dark nightlife look (`docs/DESIGN.md` §1.1 "Beirut rooftop at 1 a.m."), no cartoon mascots, no "kids" keywords. "Family gatherings" and "family-friendly filter" describe adult-led group play and are fine; do **not** add "for kids", "children", cartoon kid imagery or school themes to the listing or screenshots |
| Store presence (if asked "Does your app's store listing include the following...") | Answer truthfully; none of the child-appeal items apply | |

⚠ **Flag:** Google states it double-checks marketing against the declared audience. If Google decides the listing appeals to children it will ask for changes or put the app under the Families policy. The app would mostly pass it anyway (no ads, no SDKs, minimal data, automatic deletion), but billing to children would then need extra care. Decide with the owner before ticking under-13 later.

---

## 4. The other App content declarations

| Section | Answer | Justification |
|---|---|---|
| **Privacy policy** | `{{WEBSITE_URL}}/privacy` | Text in PRIVACY-POLICY.md. Not the Worker URL (its `/privacy` returns the phone app shell) |
| **App access** | **All functionality is available without any special access** | No login, membership, location gate or invite code; the room code/QR is generated by the app on screen. Reviewer note (TV review risk): a reviewer needs 3 player devices (any phones or 3 separate desktop browser profiles/incognito windows opening the join URL shown on the TV). If Play rejects for "can't access functionality", switch to "All or some functionality is restricted" and add an instruction entry: *"No login. Open the app, then on 3 phones (or 3 separate browser windows) open the URL shown under the QR code and enter the 4-letter room code. Pick nicknames, then press Start on a phone or the TV."* |
| **Ads** | **No, my app does not contain ads** | No ad SDK (`build.gradle.kts:86-110`); no ads in the web client (`_headers` CSP blocks third-party) |
| **Advertising ID** | **No** (app does not use advertising ID) | No `com.google.android.gms.permission.AD_ID` in the merged manifest; no Play services |
| **Government apps** | **No** | |
| **Financial features** | **My app doesn't provide any financial features** | In-app purchases of digital goods are not "financial features" (that section is for banking, loans, crypto, etc.) |
| **Health apps** | **My app does not have any health features** | |
| **News apps** | **No** | |
| **COVID-19 contact tracing/status** | (if shown) **My app is not a publicly available COVID-19 app** | |
| **Data safety** | §1 | |
| **Content rating** | §2 | |
| **Target audience** | §3 | |
| Photo & video permissions, Foreground service, Full-screen intent, Exact alarms, Accessibility API, Location permissions | Not shown / not applicable | Only `INTERNET` is requested |
