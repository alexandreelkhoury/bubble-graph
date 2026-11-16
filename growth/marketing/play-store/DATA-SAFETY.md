# JAMAA: Data safety, content rating, target audience and other App content answers (v1)

**Rewritten 2026-11-17** for the v1 submission: five games (Mish Ana!, Bluff!, Most Likely, Quiz Night, Taqriban!), **free, billing off, no Spicy 18+ mode** (owner decisions of that day), production Worker `jamaa` at https://jamaa.mishana.workers.dev. It replaces the 2026-10-04 draft, whose "no crash/diagnostic data" answers had become false once the monitoring of [docs/JAMAA-PLATFORM.md](../../../docs/JAMAA-PLATFORM.md) §8 landed. The privacy policy ([PRIVACY-POLICY.md](PRIVACY-POLICY.md)) says the same things in prose; keep the two in step.

Where to click: Play Console → your app → **Policy → App content**. Policy references: [Data safety form](https://support.google.com/googleplay/android-developer/answer/10787469) · [Target audience & content](https://support.google.com/googleplay/android-developer/answer/9867159) · [Families policy](https://support.google.com/googleplay/android-developer/answer/9893335).

---

## 0. What the code actually does (the facts every answer rests on)

| Fact | Evidence |
|---|---|
| The TV app's only permission is `INTERNET` (the Billing Library merges `com.android.vending.BILLING`; billing is off). No location, mic, camera, contacts, storage, AD_ID | `tv-app/app/src/main/AndroidManifest.xml` |
| No ads, analytics, attribution or crash-reporting SDK: the TV app's crash and error reporting is its own code (`monitor/CrashReporter.kt`) posting to our server | `tv-app/app/build.gradle.kts` dependencies; `tv-app/.../monitor/` |
| The phone web page loads nothing third-party (CSP `default-src 'self'`); its error reporter posts to our own `/api/client-errors` | `web-client/public/_headers`; `web-client/src/lib/report.ts` |
| A player sends: **nickname** (1–16 chars), colour, language; game actions (ready, vote, tap on a player, quiz choice, number guess); **typed text**: Mish Ana! guess ≤ 200 chars, Bluff! made-up answer ≤ 480 chars. No chat, no free messages, no voice, no images. No profanity filter on nicknames or typed text | `shared/src/constants.ts`; `shared/src/games/*/protocol.ts` |
| The TV sends at room creation: UI language, header `X-Jamaa-Client: <platform>/<version>`, a list of already-played question/card ids (no-repeat memory). No device id | `tv-app/.../net/RoomApi.kt`; `server/src/monitor/events.ts` |
| **Client error reports** (phone, browser TV, Android TV): platform, app version, screen or page path, kind, error name, message (≤ 300 chars) and stack (≤ 1 500 chars) after a PII scrub (emails, URL queries, hex/token-like runs, long digit runs removed), optional room code, count. Rate-limited 10/min per IP; the IP is the limiter key only. No nickname, no typed text, no device id | `server/src/monitor/client-errors.ts`; JAMAA-PLATFORM §8.3 |
| **Analytics Engine events**, one point per event (never per message): room created/closed, game started/ended (game id, players, duration, end reason, content locale), player joined/left, host skip/void/hide of a pack item (pack id, item id), client/server errors. Ids, codes and counts only: no names, no IPs, no tokens | `server/src/monitor/events.ts`; JAMAA-PLATFORM §8.1, §8.6 |
| Stats Durable Object: live rooms and games, hourly counters kept 48 h, ring of the last 100 errors, alert incidents | JAMAA-PLATFORM §8.2 |
| Retention: room storage until the room closes (15 min after the TV leaves; at most 12 h after last activity while a TV is connected); Stats counters 48 h; Analytics Engine about 3 months; Cloudflare Workers Logs 7 days | `shared/src/constants.ts` `ROOM_TV_*_TTL_MS`; `server/src/room-core.ts` `expiresAt`; JAMAA-PLATFORM §8.2, §8.9; `server/wrangler.jsonc` `observability` |
| IP address: rate-limit key (Cloudflare rate-limit bindings, in memory) and, inside a room, a 16-hex truncated SHA-256 of `roomCode:ip` kept in the live connection state, never in room storage, stats or reports; never logged by app code. Cloudflare's own request logs (invocation logs on) may include it for ≤ 7 days | `server/src/request.ts`; `server/src/room-core.ts` `ipKey`; `server/wrangler.jsonc` |
| Server storage per room: players (id, nickname, colour, language, game state, typed answers), hashed resume tokens, hashed TV token | `server/src/room-store.ts` |
| The phone remembers locally: nickname, colour, language, vibration, resume token per room for 6 h. The TV: sound and calm-animation prefs, played-ids memory, an unsent crash report until the next launch (`noBackupFilesDir`) | `web-client/src/lib/storage.ts`; `tv-app/.../settings/`, `monitor/` |
| No accounts, no login, no email, no payments: `BILLING_ENABLED "0"` on production, premium UI hidden, rooms play the whole catalogue | `server/wrangler.jsonc`; `server/src/config.ts` |
| Transport encrypted: release builds forbid cleartext | `AndroidManifest.xml`; `tv-app/app/build.gradle.kts` |
| A local TV install id exists (Settings shows it) for purchases only. **Owner check before submitting:** confirm the TV does not send it to the server while billing is off; if it does, declare "Device or other IDs" as in §1.B | `tv-app/.../billing/InstallId.kt`, `ui/AppRoot.kt` |

---

## 1. Data safety form

Play Console → Policy → App content → **Data safety** → Start.

### 1.A Answers for v1 (free, billing off)

**Step "Data collection and security"**

| Question | Answer | Justification |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Nicknames and typed answers are stored on our server for the life of the room, and diagnostics and usage events are sent to it |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | HTTPS/WSS only in release; the phone page is served over HTTPS by the same Worker |
| Which of the following methods of account creation does your app support? | **My app does not allow users to create an account** | No accounts anywhere |
| Do you provide a way for users to request that their data is deleted? | **Yes** | Email the support address in the privacy policy. Rooms delete themselves when they close; usage events and error reports carry no identity, so they cannot be matched to a person. Deletion-request URL: the `/privacy` page (no account-deletion flow is needed) |

**Step "Data types"**: tick exactly these. *Shared* is **No** on every row: Cloudflare hosts and processes the data on our behalf (a service provider; Google excludes that from "sharing"), and Google Play's own collection is not ours.

| Category › Data type | Collected | Shared | Processed ephemerally? | Required or optional | Purposes |
|---|---|---|---|---|---|
| **Personal info › Name** (the player's nickname) | Yes | No | No (kept until the room closes) | Required (any pseudonym works) | App functionality |
| **App activity › Other user-generated content** (guess in Mish Ana!, made-up answer in Bluff!) | Yes | No | No | Optional (only in those two games) | App functionality |
| **App activity › App interactions** (votes, taps, quiz choices, number guesses, host settings; anonymous game events: game started/ended, players, duration, content skips by pack and item id) | Yes | No | No | Required | App functionality, **Analytics** |
| **App info and performance › Crash logs** (uncaught exception: name, message, stack, screen, app version, platform, optional room code) | Yes | No | No | Required (cannot be switched off) | **Analytics**, App functionality |
| **App info and performance › Diagnostics** (caught-error reports with the same fields; hourly error and rate counters) | Yes | No | No | Required | **Analytics**, App functionality |

**Not collected / not declared:** Location (including approximate: nothing derives a location from the IP), Financial info, Health and fitness, Messages (no chat), Photos and videos, Audio, Files, Calendar, Contacts, Web browsing, Installed apps, Search history, **Device or other IDs** (connection UUIDs are random per connection and never persisted; the room code is not a device id; see the install-id note in §0), Advertising ID.

Notes:
1. **IP address** is not a Play data type. It is used transiently for rate limiting and, hashed, for join limiting inside a live room, so it falls under Google's "processed ephemerally" exclusion. Cloudflare's 7-day request logs are service-provider processing for security and debugging.
2. **Why nicknames count as Name:** Google's definition includes nicknames; over-declaring costs nothing, under-declaring is a policy violation.
3. **Why crash and diagnostic data are declared even though the SDK count is zero:** the data leaves the device to our server, whoever wrote the code. Declaring "No data collected" would now be false.
4. **Security practices** section: encrypted in transit **Yes**; deletion requests **Yes**; "Committed to follow the Play Families Policy" **No** (13+ audience, §3); "Independent security review" **No**.
5. **Data retention in the Console's free-text boxes** (if asked): rooms until closed (≤ 12 h after last activity); error records and usage events about 3 months; counters 48 h.

### 1.B When billing is turned on (same release as the switch)

The JAMAA Pass subscription and `pack_<family>` products add no new category by themselves; the TV's random `installId` (stored hashed on the server, `docs/PAYMENTS-SPEC.md` §6.3) does. Add:

| Category › Data type | Collected | Shared | Ephemeral | Required/optional | Purposes |
|---|---|---|---|---|---|
| **Financial info › Purchase history** | Yes | No | No | Optional (only buyers) | App functionality |
| **Device or other IDs** (install id, hashed; the Play `obfuscatedAccountId`) | Yes | No | No | Required | App functionality, **Fraud prevention, security, and compliance** |

Card data is handled by Google Play: do **not** declare "User payment info". Also re-answer the content-rating question about digital purchases, and update the privacy policy with Appendix B of PRIVACY-POLICY.md.

---

## 2. Content rating (IARC questionnaire), v1 without Spicy

Play Console → Policy → App content → **Content ratings** → Start questionnaire. Answer for what ships on production: **the Spicy 18+ pack is not bundled and its mode is off** (`LIKELY_SPICY_ENABLED "0"`, enforced by `check-deploy.mjs`), so the questionnaire is answered for the family content only. If Spicy ever ships, redo this form (expect a clearly higher rating) and the target audience.

| Field | Answer | Justification |
|---|---|---|
| Email address | The support address (`SUPPORT_EMAIL`) | IARC sends the certificate there |
| Category | **Game** | Party games |
| Violence (cartoon, fantasy, realistic) | **No** | No violence depicted. Being voted out is an "OUT" stamp; Bluff! stamps answers LIE or TRUTH. Quiz and fact content mentions history and biology in a neutral, educational way (the lint scan finds only a handful of words such as "war" or "blood" in facts, never depicted); `docs/DESIGN.md` forbids blood, skulls, horror |
| Fear / horror | **No** | |
| Sexuality / nudity / sexual content | **No** | Family packs only. Most Likely's family pack is gentle humour ("cry at a wedding", "get lost even with GPS"); the suggestive pack is not shipped. Re-scan when content changes |
| Language: profanity | **No** (in the content) | All shipped content is fixed packs without profanity. The user-generated text is covered by the "users interact" answer below |
| Crude humour | **No** | The humour is mild and teasing; nothing scatological or gross-out. Answer **Mild** only if the questionnaire has no "No" and you want to be conservative |
| Controlled substances (drugs, alcohol, tobacco) | **No** | The scan finds one incidental word ("beer", in a fact) and no depiction or promotion. If IARC's wording is "references to", the honest answer is still No: nothing depicts or encourages use |
| Gambling (real or simulated) | **No** | Points scoreboards only; no betting, no virtual currency, no casino mechanic |
| Discrimination / hate / sensitive topics | **No** | Regional quizzes (Lebanon, Levant) are factual. A human sensitivity read of Trivia and Bluff is still on the release checklist (item 4.7) |
| Does the app allow users to interact or exchange content with each other (text, voice, images)? | **Yes** | Players type a nickname (visible on the TV and phones of the room) and, in Mish Ana! and Bluff!, short free text (a guess or a made-up answer) that is shown to the others in the room. No chat, no private messages, no voice, no images, no friend lists, no profile; rooms are private, short-lived (4-letter code) and the host can remove players. There is **no profanity filter** on nicknames or typed text, so the honest answer is Yes, "users can interact" and "user-generated content is not moderated" if asked. Expect the **Users Interact** descriptor |
| Does the app share the user's current physical location with other users? | **No** | No location data |
| Does the app allow users to purchase digital goods? | **No** (v1 is free, billing off) → **Yes** the day billing is switched on; then redo the questionnaire | `BILLING_ENABLED "0"` |
| Does the app contain a web browser or unrestricted internet access? | **No** | The TV app never opens a browser or WebView |
| Is the app primarily news, educational or reference? | **No** | Quiz Night is entertainment, not a learning product |

**Expected result** (IARC computes it, so treat as a forecast): ESRB **Everyone** (possibly **Everyone 10+** if "unmoderated user content" is weighed), PEGI **3** (PEGI 12 only if a rating body treats the unfiltered free text as a risk), USK **0**, ClassInd **L**, plus the interactive element **Users Interact**. Anything above PEGI 7 / ESRB E10+: re-read the "users interact" answers before appealing; do not answer No to get a lower rating.

---

## 3. Target audience and content

| Question | Answer | Justification |
|---|---|---|
| Target age groups | **13–15, 16–17, 18 and over** (leave 0–12 unticked) | A group party game hosted by an adult on the family TV with unfiltered typed text. Ticking an under-13 band would bring in the **Families policy** (certified SDKs, content review, stricter rules for free-text features). Nothing is designed for children, so 13+ is accurate |
| Could the store listing unintentionally appeal to children? | **No** | Keep it true: no cartoon-kid imagery, no "kids", "children" or "school" in text or screenshots. The in-game characters are stylised party characters, not a children's mascot; keep screenshots to the TV UI. "Family gatherings" describes adult-led group play and is fine |

Flag: Google checks marketing against the declared audience. If the listing is judged child-directed, the Families policy applies. Decide with the owner before ticking any under-13 band later.

---

## 4. The other App content declarations

| Section | Answer | Justification |
|---|---|---|
| **Privacy policy** | `<site origin>/privacy/` (the page built from PRIVACY-POLICY.md; not the Worker URL, whose `/privacy` returns the phone app shell) | Needs a public non-PDF page; until a domain exists use the site Worker's URL |
| **App access** | **All functionality is available without any special access**, with a reviewer note | A reviewer needs 3 player devices. If Play rejects with "can't access functionality", switch to "restricted" and paste: *"No login. Open the app on an Android TV; it shows a QR code, a join address and a 4-letter room code. On 3 phones (or 3 separate browser windows) open the address and enter the code, pick nicknames, then press Start on a phone or with the TV remote. Pick any game from the hub. Demo video: <link>."* |
| **Ads** | **No, my app does not contain ads** | No ad SDK; CSP blocks third parties in the web client |
| **Advertising ID** | **No** | No `AD_ID` permission, no Play services |
| **Government apps** | **No** | |
| **Financial features** | **My app doesn't provide any financial features** | v1 has no purchases |
| **Health** | **No health features** | |
| **News** | **No** | |
| **Data safety** | §1 | |
| **Content rating** | §2 | |
| **Target audience** | §3 | |
| **Contains in-app purchases** (store listing flag) | **No** for v1, even though the Billing Library is in the bundle | Must match what is live. Flip it when billing ships |
| Photo/video permissions, foreground service, full-screen intent, exact alarms, accessibility API, location | Not applicable | Only `INTERNET` is requested |
