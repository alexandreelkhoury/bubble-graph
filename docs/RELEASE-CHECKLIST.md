# JAMAA launch-readiness audit (Google Play, Android TV)

Audit date 2026-11-16, repo at `c43f199`. Read-only review: nothing was built, run, deployed or uploaded, and no adb was used. Status words: **DONE**, **PARTIAL**, **TODO**, **DECISION** (owner must choose). Who: **OWNER** (needs the owner's accounts, devices or judgement) or **CLAUDE** (can be done in the repo). Effort: S (under 2 h), M (about a day), L (several days or elapsed waiting). Blocker: **Y** = launch cannot happen without it.

Overlaps with, and is stricter than, the older Play-Console runbook [growth/marketing/play-store/RELEASE-CHECKLIST.md](../growth/marketing/play-store/RELEASE-CHECKLIST.md) (written 2026-10-04 for Mish Ana!; its dates are stale).

## Findings that change the plan (read first)

1. **The release APK would point at a server that does not exist.** `tv-app/gradle.properties:3` sets `jamaa.prodServerUrl=https://play.jamaa.workers.dev`, but the only deployed Worker is `play.mishana.workers.dev` (owner step O1, renaming the workers.dev subdomain, was never done). `preReleaseBuild` only rejects the `example` placeholder (`tv-app/app/build.gradle.kts:97`), so a release build would pass and ship a dead URL. docs/BILLING-LAUNCH.md and DEV.md also name `play.jamaa.workers.dev`.
2. **The privacy policy and Data safety answers are now false.** `growth/marketing/play-store/PRIVACY-POLICY.md:26,73` and `DATA-SAFETY.md:16-17` say "no analytics, no crash reporting". The monitoring work since then sends scrubbed error reports (TV `monitor/CrashReporter.kt`, `POST /api/client-errors`, JAMAA-PLATFORM §8.3), Analytics Engine events and an `X-Jamaa-Client` header (§8.1). Updating both is mandatory before any Play submission.
3. **"Production" is the preview Worker.** One Worker (`play`) serves testing and the public with draft content (`deploy:preview`). `pnpm run deploy` (the release path) refuses draft free packs (`tools/content-lint/src/common.ts:90`), and every pack is `draft`. So the proper release deploy cannot run today.
4. **Play listing assets, content-rating and Data safety answers cover Mish Ana! only.** Screenshots are `*-placeholder.jpg` of the old game (`growth/marketing/play-store/graphics/screenshots/`); `DATA-SAFETY.md:95` says every pack is `ageRating: "all"`, which is untrue now that Most Likely has a Spicy 18+ pack.
5. **Config drift on which games are live.** `server/wrangler.jsonc:65` enables all five (`mishana,bluff,likely,trivia,taqriban`); docs/DEV.md (last section) says `"mishana,trivia"`; docs/BILLING-LAUNCH.md says `"mishana"`. Decide the launch set (see Content).
6. **Monetization docs agree on the Pass today, but history conflicts.** Commits of 2026-10-26 (`4e37b47`, `8c4a442`) specify a lifetime Premium ($7.99, $5.99 launch); the 2026-11-08 rewrites (MONETIZATION.md §5.1, PAYMENTS-SPEC rev 4, JAMAA-PLATFORM §4) specify the JAMAA Pass subscription and archive lifetime (MONETIZATION.md §5.1.1). Code follows the Pass. Flagged as an owner decision below, because the earlier choice was also marked "decided".

## 1. Store and legal

| # | Item | Status | Evidence | Who | Eff | Blk |
|---|---|---|---|---|---|---|
| 1.1 | Play Console developer account exists, identity verified, account type known (personal vs organization) | DECISION | Status unknown (owner session). Drives item 1.2 | OWNER | S (+days for verification) | Y |
| 1.2 | **Closed test: 12+ testers opted in continuously for 14 days**, then apply for production. Applies to personal accounts created after 13 Nov 2023; organization accounts and older accounts are exempt. Open tests do not count; production is not unlocked automatically, you must apply. TV-only app means each tester needs an Android TV / Google TV device. See [Google's policy page](https://support.google.com/googleplay/android-developer/answer/14151465) and [secondary summary](https://www.revenuecat.com/blog/engineering/google-play-14-day/). The one source giving an earlier cutoff (1 Nov 2023) is a blog; verify the date in Play Console | TODO | Same rule as growth/marketing/play-store/RELEASE-CHECKLIST.md "Timing and blockers" | OWNER | L (14 d + review) | Y if personal |
| 1.3 | Recruit 12+ testers with Google TVs (family, friends, Reddit/Discord); keep 12+ opted in for the full 14 days | TODO | growth/marketing/launch/LAUNCH-PLAN.md | OWNER | M | Y if personal |
| 1.4 | Create Play app `app.jamaa.tv` (Android TV form factor, not the old `app.mishana.tv`) | TODO | JAMAA-PLATFORM §1.6 step O4 | OWNER | S | Y |
| 1.5 | Store listing text EN/FR/AR/ES for the multi-game platform (title "JAMAA: Party Games for TV", hub first, then each live game) | PARTIAL | `growth/marketing/play-store/LISTING.md` is paste-ready but describes Mish Ana! only (`:56`); plan to rewrite at JAMAA-PLATFORM §1.5 | CLAUDE | M | Y |
| 1.6 | TV banner 1280x720 (EN/AR/FR/ES), icon 512, feature graphic 1024x500 | DONE | `growth/marketing/play-store/graphics/` (banner is XML vector in-app: `tv-app/app/src/main/AndroidManifest.xml:19`) | CLAUDE | S (visual check on real TV: M-hours) | N |
| 1.7 | TV screenshots (1920x1080) of the real JAMAA hub and each live game, in the store languages | TODO | Only `*-placeholder.jpg` of the old game exist. Needs the redesigned native app running (item 5.1), so it depends on QA | OWNER+CLAUDE | M | Y |
| 1.8 | Privacy policy covers current data flows (error reports, analytics events, `X-Jamaa-Client`, 7-day Cloudflare logs, Spicy/phone web client) | TODO | See finding 2; `PRIVACY-POLICY.md:7` also has an unresolved "[LOGS]" decision | CLAUDE | M | Y |
| 1.9 | Privacy policy hosted at a public non-PDF URL; URL pasted in Play Console | PARTIAL | Page exists in the repo (`growth/site/privacy/index.html`), but there is no domain, and the policy text needs 1.8 first. Needs 3.2 (domain) or the `www` Worker URL | OWNER | S | Y |
| 1.10 | Data safety form | TODO | `DATA-SAFETY.md` must declare: diagnostics (crash logs, truncated message/stack, screen, room code, app version, platform), app activity (anonymous event counts: room/game created, players, content skips by pack and item id), IP used as an ephemeral rate-limit key only. Free-text answers (Blank/Bluff/Quiz guesses) held until room end. No account, no device id (check: `InstallId` in `billing/InstallId.kt` is a billing id; declare it once billing is on) | CLAUDE draft, OWNER submits | M | Y |
| 1.11 | Content rating (IARC) re-answered for the platform | TODO | `DATA-SAFETY.md:85-95`. Most Likely Spicy (`content/likely/likely-spicy.json`, `ageRating: "adult"`, gated by 18+ confirm: GAME-LIKELY §9.1, `LikelySpicyGate.kt`) means sexual/crude humour and user-generated text must be answered honestly. Expect a rating above "Everyone". Decide whether Spicy ships in v1 (see 4.5) | OWNER | S | Y |
| 1.12 | Target audience: 13+ / adults (do not tick under-13 bands, which would pull in the Families policy) | PARTIAL | `DATA-SAFETY.md:116` recommends 13-15, 16-17, 18+. Re-check with Spicy and the phone page | OWNER | S | Y |
| 1.13 | Other App-content forms: ads (none), government (no), news (no), data-deletion/account (no accounts), financial features (no), app access (no login, but reviewers need to know how to play: TV plus a phone; add a note and a demo video) | TODO | `DATA-SAFETY.md` sections 3-6 | OWNER | S | Y |
| 1.14 | Android TV quality review: leanback launcher, banner, D-pad only, no touch, landscape, no required hardware beyond leanback | PARTIAL | `AndroidManifest.xml:8-11,31-35` correct. Not yet verified by a real build (5.1). TV quality review has no SLA (budget 1-3 weeks per the older checklist) | OWNER | L | Y |
| 1.15 | **Target API level**: `targetSdk = 36`, `compileSdk = 37`, `minSdk = 26` | DONE | `tv-app/app/build.gradle.kts:31-36`. Google requires API 36 for new apps/updates from 31 Aug 2026 (see [Play target-API page](https://developer.android.com/google/play/requirements/target-sdk)); TV apps may have lower floors, but 36 already satisfies either. A blog claim of a 1 Nov 2026 extension is unverified | CLAUDE | - | N |
| 1.16 | Permissions minimal | DONE | Only `INTERNET`; `com.android.vending.BILLING` merges from the Billing Library 9.1.0. Merged manifest never inspected (`TV.md`: "[VERIFY]") | CLAUDE | S | N |
| 1.17 | Support email: dedicated address, same in Play listing, `shared/src/billing/products.ts:43` and `Products.kt:34` | DECISION | Both hold a personal Hotmail address `alexkhoury@hotmail.com`. A branded address needs a domain (7.1). Changing both needs a new release | OWNER | S | N (but strongly advised) |
| 1.18 | In-app purchase declarations: the AAB includes the Billing Library even with `BILLING_ENABLED 0`; the listing's "contains in-app purchases" flag must match what is live at launch | DECISION | See section 6 | OWNER | S | N |
| 1.19 | Tax/payments profile (only needed if billing goes live) | TODO | docs/BILLING-LAUNCH.md Phase 2 | OWNER | M | N (unless billing at launch) |

## 2. Android release build

| # | Item | Status | Evidence | Who | Eff | Blk |
|---|---|---|---|---|---|---|
| 2.1 | Release server URL points at a real, stable HTTPS origin | **TODO** | Finding 1. Must be set to the final prod origin (custom domain preferred, see 3.2) or `-PserverUrl`; consider adding a build-time check that rejects `play.jamaa.workers.dev` until it resolves | CLAUDE (check) / OWNER (domain) | S | **Y** |
| 2.2 | Upload keystore created, backed up offline, `~/.jamaa-keys/keystore.properties` present; Play App Signing enrolled | TODO | Signing is wired (`build.gradle.kts:42-55`, `TV.md` "Release signing"); unsigned release if the file is missing. Existence of the key is unknown. Losing it means an upload-key reset via Play Console | OWNER | S | Y |
| 2.3 | R8 / resource shrinking enabled | PARTIAL | `isMinifyEnabled=true`, `isShrinkResources=true` (`build.gradle.kts:57-59`). Keep rules are only `-keep class app.jamaa.tv.protocol.** { *; }` (`proguard-rules.pro`). A minified build was never smoke-tested with the five game decoders, billing and Compose | CLAUDE (review) + OWNER (device) | M | Y |
| 2.4 | A real `bundleRelease` has been produced and run | TODO | Google Maven was blocked in the authoring sandboxes; `assembleDebug` "still pending" (HANDOFF 2026-11-10). Only a Mish Ana! 0.1.0 vc1 AAB exists (`growth/marketing/release/`). Build on the owner's Mac with Android Studio | OWNER | M | Y |
| 2.5 | Versioning: `versionCode 3`, `versionName 1.0.0` | PARTIAL | `build.gradle.kts:37-38`. Each Play upload needs a higher versionCode; plan one bump per test upload. `app.jamaa.tv` is a fresh app so any code works | OWNER | S | N |
| 2.6 | Crash reporting | DONE (custom) | `monitor/CrashReporter.kt` saves uncaught exceptions and sends on next launch to `/api/client-errors`; Play Console Android vitals also collect for free. Depends on a working prod URL (2.1) and the CF token (6.2) for history | CLAUDE | - | N |
| 2.7 | Cleartext off in release; debug-only server override and fake billing absent from release | DONE | `AndroidManifest.xml:24`, `build.gradle.kts:101`, `TV.md` "Debug server override" | CLAUDE | - | N |
| 2.8 | Second app module `tv-app/pixi` is not in the release bundle | PARTIAL | Separate module `app.jamaa.tv.pixi`; only `:app:bundleRelease` should be built and uploaded. Do not ship Pixi | OWNER | S | N |
| 2.9 | `./gradlew :app:testDebugUnitTest` green on the owner's Mac | TODO | JVM harness passed 366 tests in the sandbox, not the real Gradle suite | OWNER | S | N |
| 2.10 | Pre-launch report / device compatibility: leanback devices only; sanity check on a low-end stick (Chromecast HD class) | TODO | `TV.md` "Performance" and the baseline-profile note | OWNER | M | N |

## 3. Server production (Cloudflare)

| # | Item | Status | Evidence | Who | Eff | Blk |
|---|---|---|---|---|---|---|
| 3.1 | Separate prod and preview Workers (or at least separate names/URLs) so the public never gets draft content | TODO | Single `"name": "play"` (`server/wrangler.jsonc:3`), no `env` blocks (forbidden by `check-deploy.mjs:73`). Options: a second config (`play-preview`) deployed with `deploy:preview`, or only ever run `pnpm run deploy` for prod after content review. Durable Object classes and migrations (v1-v3) are per Worker; a second Worker starts clean | CLAUDE (config + scripts) / OWNER (deploy) | M | Y |
| 3.2 | Custom domain (e.g. `jamaa.tv` or similar): TV URL, `JOIN_BASE_URL` for the QR/join link, privacy page, support email, Email Routing | TODO | `JOIN_BASE_URL` empty (`wrangler.jsonc:65`). Phones currently get `play.mishana.workers.dev/<CODE>`, which is long and brand-less. Changing the TV URL later needs an app update, so decide now | OWNER | M | Y (strongly) |
| 3.3 | Workers plan: Free (about 100k requests/day, unverified: `PLAN_DAILY_REQUESTS`, `wrangler.jsonc:69`) vs Paid ($5/month). WebSocket messages and DO requests count; the quota alert fires at 80% | DECISION | Recommend Paid before public launch: a viral night can exhaust Free, and Free-plan limits would take rooms down mid-game (verify current Cloudflare limits) | OWNER | S | N (risk) |
| 3.4 | Release deploy path works end to end (`pnpm run deploy`) with no drafts | TODO | Refused today by content-lint (finding 3, section 4). Also run `check-deploy` and the size budgets (Worker 376.7/400 KB; phone 59.46/60 KB gz per HANDOFF) | OWNER | S after 4.x | Y |
| 3.5 | Rate limits | PARTIAL | `CREATE_ROOM` 10/min, `CONNECT` 60/min, `CLIENT_ERROR` 10/min per IP (`wrangler.jsonc:24-30`). Namespace ids 1001-1005 must be unique in the account (DEV.md). Party-night NAT (one home IP, 12 phones joining) fits 60/min; a bar or event with many phones behind one IP could hit it. No load evidence | CLAUDE | S | N |
| 3.6 | CORS / origins | DONE | `ALLOWED_ORIGINS` empty = same-origin only; TV app sends no Origin (DEV.md "Origins"; `server/test/origin.test.ts`) | CLAUDE | - | N |
| 3.7 | Secrets: `ADMIN_TOKEN` set; billing secrets only when billing on; `CF_ANALYTICS_TOKEN` invalid | PARTIAL | `check-deploy.mjs:78-98`; token item in 6.2 | OWNER | S | N |
| 3.8 | Deploy guard rails (google billing mode, fake billing off, traces off, known game ids, package name) | DONE | `server/scripts/check-deploy.mjs:51-74` | CLAUDE | - | N |
| 3.9 | Backups and data retention | PARTIAL | Rooms expire with the TV session (DEV.md); no player accounts; Cloudflare logs max 7 days; Stats DO keeps hourly counters (48 h) and an error ring (100). Billing DO (purchases, grants) has no documented backup: only matters when billing is on. No export routine for the Stats history beyond Analytics Engine retention. Document retention in the policy (1.8) | CLAUDE | S | N |
| 3.10 | Load test | TODO | `tools/sim` exercises engines and a `--ws` mode, but there is no multi-room concurrency test on the deployed Worker. Target: 50 rooms x 8 phones for 30 minutes, watch request counts vs plan, DO latency and close codes | CLAUDE script / OWNER runs | M | N (strongly advised before ads) |
| 3.11 | Rollback runbook | DONE | docs/BILLING-LAUNCH.md "Rollback" (`wrangler rollback`, `BILLING_ENABLED 0`); the `Billing` and `Stats` DO classes can never be removed (migrations v2/v3) | CLAUDE | - | N |
| 3.12 | Protocol break: protocol v2 clients only; old `app.mishana.tv` builds get close 4002; rooms of old storage expire | PARTIAL | BILLING-LAUNCH "What deploying main changes". Only matters if the old app is still installed on any test TVs; deploy at a quiet hour | OWNER | S | N |
| 3.13 | Docs agree on prod URL and `GAMES_ENABLED` | TODO | Findings 1 and 5 | CLAUDE | S | N |

## 4. Content

| # | Item | Status | Evidence | Who | Eff | Blk |
|---|---|---|---|---|---|---|
| 4.1 | Launch set of games decided | DECISION | Five games are enabled in config; the content and screens of four were written very recently. Each extra game adds QA, listing, rating and data-safety surface. A smaller launch (e.g. Mish Ana! plus one or two) with others switched on through `/admin` game switches (JAMAA-PLATFORM §8.7, no redeploy) is the lowest-risk path | OWNER | S | Y |
| 4.2 | Fact-checks done (EN source, live-web verified) | DONE | `docs/research/FACTCHECK-BLUFF-2026-11.md` (224 checked, 222 remain), `-TRIVIA-` and `-TAQRIBAN-` (complete, third pass) | CLAUDE | - | N |
| 4.3 | Weak sources to re-check by a human | PARTIAL | Bluff: of-002 (scuba blog), of-024, of-031, of-054, of-056 (FACTCHECK-BLUFF line 17); Trivia: world-mix q023, q029, q053, q057, q071 (FACTCHECK-TRIVIA line 21); the web-search budget ran out partway through Bluff (lines 16). Trivia items flagged time-sensitive (e.g. q053 World Cup titles) need a re-check at release date | OWNER+CLAUDE | M | N for non-live games, Y for the first live game's free pack |
| 4.4 | Packs `draft` to `reviewed` (free starter packs first, `*-everyday-01` and each game's free pack) | TODO | `status: "draft"` throughout `content/**`; `content-lint --release` fails on a draft free pack (`common.ts:90`) and needs at least 40 pairs for Mish Ana! starters (`lint.ts:26`). Flip is a one-line edit per pack once reviewed | OWNER sign-off, CLAUDE edit | S | Y |
| 4.5 | Native-speaker review of AR, FR, ES wording (an earlier "copy review of FR/AR/ES" was done by agents, HANDOFF lane D, not native speakers) | TODO | HANDOFF "Open owner decisions". Especially Lebanese-dialect Arabic in Mish Ana!, Bluff "no truth", the Lebanon quiz, Taqriban Levant. Arabic quality is brand-critical for this audience | OWNER (find reviewers) | L | Y (for each language you advertise) |
| 4.6 | Spicy 18+ pack and `{player}` named cards: content review and the decision to ship in v1 | DECISION | `content/likely/likely-spicy.json`; needs a human read for offence, cultural fit (MENA families), and the 18+ gate wording. Safest: switch Spicy off for v1 (it is only served in `mode: spicy`), which also keeps the IARC rating lower | OWNER | S | Y (decision) |
| 4.7 | Lebanese/regional sensitivity pass (maps, flags, religion, politics in Trivia and Bluff) | TODO | Not recorded as done anywhere | OWNER | M | N |
| 4.8 | Content-lint clean | DONE | HANDOFF 2026-11-10 (`lint:content` passes); `--release` is the failing gate | CLAUDE | - | N |

## 5. Quality

| # | Item | Status | Evidence | Who | Eff | Blk |
|---|---|---|---|---|---|---|
| 5.1 | **Native Android TV QA after the UI redesign**: install the release-signed build, walk each game start to finish in EN and AR (RTL), 4+ phones | TODO | Owner tested only the browser `/tv` mock; native app not run on the TV since the redesign; frame-time and RTL screenshots pending (HANDOFF 2026-11-10); `TV.md` "Remote-only checks on a device" is the script | OWNER (TCL TV) | L | Y |
| 5.2 | Per-game QA on TV, each in EN and AR, then spot-check FR and ES: Mish Ana!, Bluff, Most Likely (family and Spicy), Quiz Night, Taqriban | TODO | One row per game in the QA log; GAME-*.md acceptance lists | OWNER | L | Y (for each live game) |
| 5.3 | Layout checks flagged by DESIGN §11: 12 players, 1.3x font scale, Arabic, Store at 960x540 | TODO | `TV.md` "Unit tests" and "What to check on a device" | OWNER | M | N |
| 5.4 | Phone web client on real iPhone (Safari) and Android (Chrome), including join by QR, reconnect after lock screen, Arabic RTL, and the 60 KB budget | TODO | `pnpm e2e` is Chromium-only (8/8 pass, HANDOFF). No real-device evidence | OWNER | M | Y |
| 5.5 | Offline / reconnect: TV Wi-Fi drop, phone sleep, Worker redeploy mid-game | PARTIAL | TV reconnect backoff and "Connection lost" screen are implemented and unit-tested (`TV.md` troubleshooting); never tried on a real TV and Wi-Fi | OWNER | M | N |
| 5.6 | Accessibility basics: colour contrast, font scale, no flashing, screen reader not applicable on TV party game; "Calm animations" setting exists | PARTIAL | `TV.md` "Per-device prefs"; no audit recorded | CLAUDE | M | N |
| 5.7 | Known failing tests / bugs from the milestone check | PARTIAL | Bluff `error.*` i18n keys missing (test fails on `LIE_EMPTY`); Likely props and Trivia sound tests time out under load; `gen:strings --check` stale for Trivia; `pnpm lint` fails only inside `prototypes/pixi-bluff` (HANDOFF 2026-11-10). Re-run `pnpm typecheck && pnpm lint && pnpm test` and fix | CLAUDE | M | Y (Bluff error keys: player-facing) |
| 5.8 | Pointer click on tv-material Surfaces (air-mouse remotes) | TODO | `TV.md` "Air-mouse" marks it unchecked | OWNER | S | N |
| 5.9 | Audio: 44 synthesized cues; volume and mute on TV; no licensing issues (original synthesis) | DONE | `TV.md` "Sound"; THIRD_PARTY.md | CLAUDE | - | N |
| 5.10 | Third-party licences listed (fonts, libs) | PARTIAL | `THIRD_PARTY.md` exists; re-check against the final dependency list and the Cairo font licence | CLAUDE | S | N |

## 6. Monitoring

| # | Item | Status | Evidence | Who | Eff | Blk |
|---|---|---|---|---|---|---|
| 6.1 | Admin page, live numbers, error ring, hourly alert evaluation, game switches, room inspector | DONE | JAMAA-PLATFORM §8.2-8.8; `/admin` live with `ADMIN_TOKEN` | CLAUDE | - | N |
| 6.2 | `CF_ANALYTICS_TOKEN` valid (read-only, Account Analytics: Read) so `/admin` history charts and content stats work | TODO | Currently invalid (owner session); DEV.md "Monitoring" steps. `CF_ACCOUNT_ID` is set (`wrangler.jsonc:70`) | OWNER | S | N |
| 6.3 | Alert channel chosen and verified | DECISION | `ALERT_EMAIL` and `ALERT_EMAIL_FROM` empty (`wrangler.jsonc:68`); alerts are only logged and shown on `/admin`. Email needs a domain with Email Routing (3.2); alternatives: a Telegram/Discord webhook from the hourly cron (not built) | OWNER decides, CLAUDE builds a webhook if wanted | S-M | N (but nobody is told when it breaks) |
| 6.4 | Alert thresholds sane for launch | PARTIAL | 20 server errors/h, 50 client errors/h, 80% quota (`wrangler.jsonc:68-69`) | CLAUDE | S | N |
| 6.5 | Dashboard for launch day (rooms, games per title, errors, quota) | PARTIAL | `/admin` covers it once 6.2 works; Play Console Android vitals as the TV-side view | OWNER | S | N |
| 6.6 | Workers Logs retention 7 days, traces off | DONE | `wrangler.jsonc:15`, `check-deploy.mjs:68` | CLAUDE | - | N |

## 7. Monetization and brand

| # | Item | Status | Evidence | Who | Eff | Blk |
|---|---|---|---|---|---|---|
| 7.0 | **Monetization model: JAMAA Pass subscription (docs now) vs lifetime Premium (10-26 docs)**. Billing is OFF at launch either way (`BILLING_ENABLED "0"`, `wrangler.jsonc:65`) | DECISION | Pass: MONETIZATION.md §5.1, PAYMENTS-SPEC rev 4 (2026-11-08), BILLING-LAUNCH, code and Play product ids (`jamaa_pass`, `pack_<family>`). Lifetime: git `4e37b47` / `8c4a442` ($7.99, $5.99 launch), archived at MONETIZATION.md §5.1.1; no lifetime product exists in code or Play. Owner session called it a conflict: confirm the Pass, or reopen it (reopening costs rework in server, TV and fixtures). Prices are set in Play Console at any time | OWNER | S (decide) / L (if reversed) | N for a free launch, Y before billing goes on |
| 7.1 | Launch free first, add billing later (recommended: ships sooner, avoids tax/payments setup and a payment E2E test on day one) | DECISION | BILLING-LAUNCH phases 1-3; the Pass UI is hidden while `/api/config` says `billing:false` | OWNER | S | N |
| 7.2 | If billing goes on: products, license testers, service account, RTDN, secrets, E2E test, alerts | TODO | BILLING-LAUNCH Phase 2-3, PAYMENTS-SPEC §8; needs an uploaded AAB first | OWNER | L | Y only if billing at launch |
| 7.3 | Trademark and name check for "JAMAA" (EUIPO, USPTO, MENA classes 9, 41; also existing apps named Jamaa/Jamaa on Play) | TODO | Not started. | OWNER (lawyer or search) | M | Y (a takedown after launch costs more than a week now) |
| 7.4 | Domain registration (`jamaa.*`) and email | TODO | See 3.2 and 1.17 | OWNER | S | Y (see 3.2) |
| 7.5 | Brand consistency: site, listing, TV, phone, store names, Arabic wordmark «جماعة» | PARTIAL | Rename gate passes (HANDOFF); site and listing still lead with the old game | CLAUDE | M | N |

## Critical path to launch

Ordered, with what blocks what. Elapsed time is the constraint, not effort.

1. **Day 0: owner decisions, in one sitting (S each).** Play account status (1.1), launch game set (4.1), Spicy in or out (4.6), domain name (3.2, 7.4), Pass vs lifetime and billing-off launch (7.0, 7.1), Workers Paid yes/no (3.3). Everything below waits on these.
2. **Day 0-2: start the long clocks in parallel.**
   - OWNER: register the domain and run a trademark search (7.3, 7.4); verify the Play account (1.1); recruit 12 testers with Google TVs (1.3).
   - CLAUDE: fix `prodServerUrl` and docs (2.1, 3.13), write the Data safety and privacy-policy updates (1.8, 1.10), rewrite the listing for the chosen games (1.5), fix the Bluff error keys and rerun the full gate (5.7), add the separate prod/preview deploy path (3.1).
3. **Day 2-5: native build and QA.** OWNER builds the release AAB on the Mac and signs it with the upload key (2.2, 2.4), installs on the TV, and walks every live game in EN and AR (5.1, 5.2). CLAUDE fixes what turns up (R8 keep rules, layout, 2.3). Capture the real screenshots (1.7). This is the highest-risk step: the redesigned native app has not been run on a TV since the redesign (owner session).
4. **Day 3-7 (parallel): content sign-off.** Native reviewers for AR/ES/FR (4.5), weak-source re-check (4.3), then flip packs to `reviewed` (4.4) and run the real `pnpm run deploy` to the prod Worker on the custom domain (3.1, 3.2, 3.4). Set the Cloudflare token and the alert channel (6.2, 6.3). Run the load test (3.10).
5. **Day ~7: upload to the Play closed-testing track** (needs 1.4, 1.5-1.13 filled, the app signed, a live prod server). **The 14-day clock starts when 12 testers are opted in** (1.2). If the Play account is an organization or older than 13 Nov 2023, skip the wait and go to step 7.
6. **Day 7-21: closed test running.** Collect crashes and feedback via `/admin` and Android vitals; ship fixes as new versionCodes (2.5). Phone-browser QA on real devices (5.4), reconnect testing (5.5), accessibility pass (5.6). Billing, if wanted, is tested here with license testers (7.2) but ideally deferred past launch.
7. **Day ~21: apply for production access**; Google answers within about 7 days per the older checklist (verify). Then the production release goes through review plus the Android TV quality review (1.14), budget 1-3 weeks with no SLA.
8. **Launch.** Realistic earliest public date for a personal account that starts this week: **about 4-6 weeks from today (late December 2026 to early January 2027)**. For an organization or older account: about 2-3 weeks, gated by QA, native reviews and TV review.

**Not blockers, but do before announcing widely:** load test (3.10), Workers Paid (3.3), alert channel (6.3), dedicated support email (1.17), real-device phone QA (5.4).
