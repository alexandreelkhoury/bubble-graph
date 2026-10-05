# Mish Ana! — Play Console release checklist (Android TV / Google TV)

Prepared 2026-10-04 for package `app.mishana.tv`. Ordered: do the steps top to bottom. Everything marked **YOU** is a manual action in a browser or terminal; nothing here was run, uploaded or signed. `{{…}}` = fill in.

Sources checked today: [testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465) · [TV distribution](https://developer.android.com/training/tv/publishing/distribute) · [TV app quality](https://developer.android.com/docs/quality-guidelines/tv-app-quality) · [dedicated form-factor tracks](https://support.google.com/googleplay/android-developer/answer/13295490) · [target API level](https://developer.android.com/google/play/requirements/target-sdk) · [preview assets](https://support.google.com/googleplay/android-developer/answer/9866151).

---

## Timing and blockers (read first)

### The closed-testing rule decides the launch date
- **Personal** Play developer accounts **created after 13 Nov 2023** must run a **closed test with at least 12 testers opted in continuously for at least 14 days** before they can even *apply* for production. Testers who opt out before 14 days don't count. Then "Apply for production" is reviewed, "usually seven days or less" (answer/14151465, fetched today).
- **It's a TV-only app** (`android.software.leanback` required, `AndroidManifest.xml:7`). Testers can only install it on an **Android TV / Google TV device** (Chromecast with Google TV, Google TV Streamer, a Google TV / Android TV set) signed in with the Gmail you invited. Phones show "not compatible". Recruit **15+** testers who own one, so you still have 12 if a few drop out. Google's production application also asks how testers engaged, so ask them to actually host a game or two.
- If your account was created **before 13 Nov 2023**, or is an **organization** account, the rule does not apply: skip step 7's 14-day wait.

**Realistic earliest dates** (if the account exists or is created this week and the closed test is live by ~Oct 8):

| Milestone | Earliest |
|---|---|
| Account verified, app created, closed-test release reviewed and live | ~Oct 6–9 (identity verification and the first review of a release can each take a few days) |
| 14 continuous days with ≥ 12 opted-in testers | ~Oct 22–23 |
| Production access granted (≤ 7 days, sometimes longer) | ~Oct 24–30 |
| Production release reviewed **+ Android TV quality review** | ~late Oct to mid-Nov 2026. Google gives no SLA for the TV review; a rejection means fix → new versionCode → new review. Budget **1–3 weeks** after "Apply for production" |

So the public Google TV launch is **about 3–6 weeks away** at best. The App content forms, listing and graphics can all be finished during the 14 days.

### Blockers to fix **before the first upload** (the other session edits the repo, not this pack)

| # | Blocker | Why | Fix |
|---|---|---|---|
| **B1** | **`android:isGame` missing** from `<application>` in `tv-app/app/src/main/AndroidManifest.xml:12-20` | **TV-LG**: "If app is a game, it appears in the Games row in Android TV Launcher". Without the flag the app lands in the Apps row → likely TV-review rejection for a Game listing | Add `android:isGame="true"` (and `android:appCategory="game"`) to `<application>` |
| **B2** | **The TV app has never run as a release build on a device** (README M3: "Code complete, not device-tested") | R8 minification + resource shrinking (`build.gradle.kts:33-38`) can break serialization/Compose at runtime; TV-G3 "works as described". The TV review tests D-pad only, Back→Home (TV-DB), no clipping (TV-OV) | Run the remote-only walkthrough in `docs/TV.md` "Remote-only checks" on a Google TV emulator **and** a real TV using the **signed release bundle** (step 5.6) against `https://play.mishana.workers.dev` |
| **B3** | **No signing config** in `tv-app/app/build.gradle.kts` | `bundleRelease` produces an unsigned bundle; Play rejects it | Add the snippet in step 5.3 |
| **B4** | Privacy policy not online | Required for every app, and the Worker's `/privacy` returns the phone app shell (HTTP 200, not a policy) | Publish PRIVACY-POLICY.md on the landing page `{{WEBSITE_URL}}/privacy` |
| **B5** | TV screenshots not produced (icon, feature graphics and TV banners EN/FR/AR are ready in `graphics/`; screenshots are browser-TV placeholders) | ≥ 1 unaltered TV screenshot is mandatory (TV-G4); capture on the TV (design-v3 D4), then re-render | GRAPHICS-SPEC.md §5 |
| B6 | Workers invocation logs decision | Keeps the privacy policy exact | DATA-SAFETY.md §0 "Uncertain item" |
| B7 | Trademark / name searches not done | `docs/RESEARCH.md:115`: manual Play search + Lebanon MoET + WIPO (classes 9, 28, 41) before the listing | **YOU**, 1 hour: search Play for "Mish Ana"; WIPO Global Brand Database `https://branddb.wipo.int` |
| B8 | AR packs are `status: "draft"` (`word-packs/packs/ar/*.json`) | Quality, not policy | Owner review (PLAN §8 Q7) |

Already OK (verified today): `minSdk 26` ≤ 31 (TV-PS); `targetSdk 36` ≥ 34 required for TV apps from 31 Aug 2026; leanback launcher intent + touchscreen not required (TV-ML, TV-MT, `AndroidManifest.xml:7-10,27-30`); 320×180 banner + adaptive icon (TV-LB/BN, `AndroidManifest.xml:14-15`); landscape; only the `INTERNET` permission; release server URL `https://play.mishana.workers.dev` set (`tv-app/gradle.properties`) and live (`/healthz` → `{"ok":true,"app":"mish-ana","protocol":1}`); **TV-G6** 64-bit + 16 KB pages: the only native lib (`libandroidx.graphics.path.so`, from Compose) ships for arm64-v8a/x86_64 with 16 KB (0x4000) LOAD alignment (checked in the existing debug APK).

---

## Step 0 — Developer account (**YOU**, once)

0.1 Go to **https://play.google.com/console/signup** → *Yourself* (personal account, as decided in `docs/MONETIZATION.md` §5.1) → pay the one-time US$25 fee.
0.2 Identity verification: legal name and address exactly as on your government ID; upload the ID; verify phone (OTP) and the developer contact email (OTP; it is shown on Google Play).
0.3 **Verify an Android device**: install the **Google Play Console** app on an Android phone, sign in with the same account, and complete the device check shown on the Console dashboard (required for new personal accounts; a phone is enough, not the TV).
0.4 Note the account creation date: if it is before 13 Nov 2023 the 12×14 rule doesn't apply.
0.5 Console → **Settings (gear) → Developer account → Account details**: developer name shown on Play = `{{DEVELOPER_NAME}}` (e.g. "Mish Ana Games" or your name). It cannot contain "Google" or ranking claims.
0.6 **EU Digital Services Act trader status** (Settings → Developer account → Account details → *Trader status*): with a free app and **no** in-app sales you can declare **not a trader**. When Premium/packs ship you become a trader and Play shows your name, address, phone and email to EU users → consider a business/domiciliation address first. Re-declare before the billing release.
0.7 (Billing later, not now) Settings → Payments profile, then Monetize setup → 15% service-fee tier enrolment.

## Step 1 — Create the app (**YOU**)

1.1 **https://play.google.com/console** → **Home → Create app**.
1.2 App name: `Mish Ana! Party Game for TV` (LISTING.md §1; you can edit it later in the store listing).
1.3 Default language: **English (United States) – en-US**.
1.4 App or game: **Game**. Free or paid: **Free** (a free app can still sell in-app products later; it can never become paid).
1.5 Tick both declarations (Developer Program Policies, US export laws) → **Create app**.

## Step 2 — App content (Policy → App content) (**YOU**, ~45 min)

Open **Policy → App content** (`https://play.google.com/console/u/0/developers/{{DEV_ID}}/app/{{APP_ID}}/app-content/overview`). Answers with justifications are in **DATA-SAFETY.md**; click order:

| # | Section | What to click |
|---|---|---|
| 2.1 | **Privacy policy** | Paste `{{WEBSITE_URL}}/privacy` → Save |
| 2.2 | **App access** | *All functionality is available without any special access* → Save (fallback text if rejected: DATA-SAFETY.md §4) |
| 2.3 | **Ads** | *No, my app does not contain ads* → Save |
| 2.4 | **Content ratings** | Start questionnaire → email → Category **Game** → answers DATA-SAFETY.md §2 → Save → **Submit** |
| 2.5 | **Target audience and content** | Ages **13–15, 16–17, 18+** → "Appeal to children?" **No** → Save |
| 2.6 | **News apps** | *No* |
| 2.7 | **Data safety** | Answers DATA-SAFETY.md §1.A (Yes collected; encrypted Yes; no accounts; deletion requests Yes; Name, Other UGC, App interactions — all App functionality, not shared) → Preview → Submit |
| 2.8 | **Advertising ID** | *No* (app does not use advertising ID) |
| 2.9 | **Government apps** | *No* |
| 2.10 | **Financial features** | *My app doesn't provide any financial features* |
| 2.11 | **Health apps** | *My app does not have any health features* |

## Step 3 — Store presence (**YOU**, ~45 min once graphics exist)

3.1 **Grow users → Store presence → Store settings**: Category **Game › Word** (alt: Casual), tags (LISTING.md §6), contact email `{{SUPPORT_EMAIL}}`, website `{{WEBSITE_URL}}` → Save.
3.2 **Grow users → Store presence → Main store listing** (en-US): App name, Short description, Full description from **LISTING.md §1**; upload icon 512, feature graphic, phone screenshots only if Save demands them (GRAPHICS-SPEC.md §1), **Android TV banner 1280×720**, **Android TV screenshots** (8, GRAPHICS-SPEC.md §5; never the `*-placeholder.jpg` files); optional YouTube video URL → Save.
3.3 Same page → **Manage translations → Add your own translations** → French (France) – fr-FR and Arabic – ar → paste LISTING.md §2 and §3. For Arabic, open the translation → **Graphics → Add own graphics** → upload Arabic screenshots/banner/feature graphic → Save.

## Step 4 — Opt in to Android TV (**YOU**, do it now, before any release)

4.1 **Test and release → Setup → Advanced settings → Form factors** tab → **+ Add form factor → Android TV**.
4.2 Leave **"Use a dedicated release track for Android TV"** **off** (the app is TV-only; the standard internal/closed/production tracks then serve TV. A dedicated track is optional, and it is unclear whether a TV-only dedicated closed track counts for the 12-tester rule, so avoid it).
4.3 Tick **Opt in to Android TV**, accept the TV review policy → Save. Requires: the TV banner and ≥ 1 TV screenshot uploaded (step 3), and "Android TV" mentioned in the description (it is).
4.4 Review status later: **Test and release → Setup → Advanced settings → Form factors → Android TV** (and the email sent to the developer account). States: Pending / Approved / Not approved.

## Step 5 — Signing and building the release bundle

### 5.1 Play App Signing (nothing to generate for the app signing key)
New apps use **Play App Signing** by default: Google creates and keeps the **app signing key**; you sign uploads with your own **upload key**. On the first AAB upload Play shows "Releases signed by Google Play" → keep **Use Google-generated key** (Test and release → Setup → **App signing** shows the certificates afterwards).

### 5.2 Generate the upload key (**YOU**, terminal, once)
```sh
mkdir -p ~/.mishana-keys && chmod 700 ~/.mishana-keys
keytool -genkeypair -v \
  -keystore ~/.mishana-keys/mishana-upload.jks -storetype PKCS12 \
  -alias mishana-upload -keyalg RSA -keysize 4096 -validity 10950 \
  -dname "CN={{OWNER_NAME}}, O=Mish Ana, C={{COUNTRY_CODE e.g. LB or FR}}"
# PKCS12: use the same password for the store and the key when prompted.
chmod 600 ~/.mishana-keys/mishana-upload.jks
keytool -list -v -keystore ~/.mishana-keys/mishana-upload.jks -alias mishana-upload | grep -E "SHA256|Valid"
```
Back it up now: the `.jks` file + password in a password manager and one offline copy. Never commit it. (If lost, Play App Signing lets you request an upload-key reset from the App signing page.)

Credentials go in your **user-level** Gradle properties, not in the repo — `~/.gradle/gradle.properties`:
```properties
mishana.upload.storeFile=/home/{{you}}/.mishana-keys/mishana-upload.jks
mishana.upload.storePassword={{password}}
mishana.upload.keyAlias=mishana-upload
mishana.upload.keyPassword={{same password}}
```
(CI alternative: `ORG_GRADLE_PROJECT_mishana.upload.storeFile=…` etc. as secrets.)

### 5.3 Gradle signing config the build needs (blocker B3; to be applied in the repo by its owner)
In `tv-app/app/build.gradle.kts`, inside `android { … }`, **between `defaultConfig { … }` (ends line 30) and `buildTypes {` (line 32)** add:
```kotlin
    // Upload key for Play App Signing. Credentials come from ~/.gradle/gradle.properties (never from the repo).
    val uploadStoreFile = providers.gradleProperty("mishana.upload.storeFile").orNull
    signingConfigs {
        if (uploadStoreFile != null) {
            create("upload") {
                storeFile = file(uploadStoreFile)
                storePassword = providers.gradleProperty("mishana.upload.storePassword").get()
                keyAlias = providers.gradleProperty("mishana.upload.keyAlias").get()
                keyPassword = providers.gradleProperty("mishana.upload.keyPassword").get()
            }
        }
    }
```
and inside `buildTypes { release { … } }` (line 33) add one line:
```kotlin
            signingConfig = signingConfigs.findByName("upload") // null → unsigned bundle (Play will reject it)
```
Nothing else in the file changes. The existing `preReleaseBuild` guard (`build.gradle.kts:71-84`) already enforces the production URL: `mishana.prodServerUrl=https://play.mishana.workers.dev` is set in `tv-app/gradle.properties`, so no `-PserverUrl` is needed; the build log must print `Mish Ana! release server URL: https://play.mishana.workers.dev`.

### 5.4 versionCode / versionName plan
`defaultConfig` currently has `versionCode = 1`, `versionName = "0.1.0"` (`build.gradle.kts:27-28`). Play rejects any upload whose versionCode was used before **in any track**. Bump `versionCode` by 1 for **every new AAB** you build (promoting the same AAB between tracks needs no bump).

| Upload | versionCode | versionName |
|---|---|---|
| First internal + closed test build | 1 | 0.1.0 |
| Each fix during the closed test | 2, 3, … | 0.1.1, 0.1.2, … |
| Production candidate | next number | 1.0.0 |
| Billing release | next | 1.1.0 |

### 5.5 Build (**YOU**, on the Mac/Linux box with the Android SDK)
```sh
cd /home/alex/bubble-graph/tv-app        # or your checkout
./gradlew :app:testDebugUnitTest :app:bundleRelease
ls -la app/build/outputs/bundle/release/app-release.aab
# Signed with the upload key? (must show CN={{OWNER_NAME}} and the SHA-256 from 5.2)
keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab | head -12
```

### 5.6 Test the exact release bundle on a TV before uploading (blocker B2)
```sh
# bundletool: https://github.com/google/bundletool/releases  (java -jar bundletool-all-<ver>.jar …)
adb connect <tv-ip>:<port>      # docs/TV.md "Real TV"
java -jar bundletool-all.jar build-apks --bundle=app/build/outputs/bundle/release/app-release.aab \
  --output=/tmp/mishana.apks --connected-device \
  --ks=$HOME/.mishana-keys/mishana-upload.jks --ks-key-alias=mishana-upload
java -jar bundletool-all.jar install-apks --apks=/tmp/mishana.apks
adb shell am start -n app.mishana.tv/.MainActivity
```
Play a full 4-phone game with the remote only; check Back from the lobby returns to the TV home screen (TV-DB), nothing is clipped (TV-OV), the app appears in the **Games** row after B1 (TV-LG).

## Step 6 — Internal testing (fast smoke test, optional but recommended)

6.1 **Test and release → Testing → Internal testing → Testers** → create an email list (you + 2–3 people) → copy the **opt-in link**.
6.2 **Create new release** → accept Play App Signing (step 5.1) → upload `app-release.aab` (versionCode 1) → release name `0.1.0 (1)` → release notes: paste the block from LISTING.md "Release notes in Play Console's multi-language paste format" → **Next → Save → Start rollout to Internal testing**.
6.3 On your TV: open the opt-in link on a phone/computer logged into the same Google account → *Accept* → open the Play Store on the TV → search "Mish Ana" or use play.google.com → *Install* → choose the TV.
Internal testing does **not** count toward the 12×14 requirement.

## Step 7 — Closed testing: the 12 testers × 14 days gate

7.1 **Test and release → Testing → Closed testing → Create track** (or use the default "Closed testing - Alpha") → **Manage track**.
7.2 **Testers** tab → *Email lists* (paste ≥ 15 Gmail addresses) **or** *Google Groups* (create `mishana-testers@googlegroups.com`, recommended: people join themselves) → **Feedback URL or email**: `{{SUPPORT_EMAIL}}` → Save → copy the **opt-in link** ("Join on the web").
7.3 **Countries/regions** tab → add Lebanon, France and every country where testers live.
7.4 **Releases** → **Create new release** → *Add from library* → pick versionCode 1 (promote, no rebuild) → release notes → **Next → Save → Send for review / Start rollout to Closed testing**. The first closed release is reviewed by Google (hours to a few days).
7.5 Send testers: the opt-in link + "Accept, then install on your Google TV from the Play Store (same Google account), keep it installed and stay opted in for at least 14 days, and host at least one game." Day 1 = the day the 12th tester opted in.
7.6 Track progress on **Dashboard** ("Production access" card shows testers opted in / days).
7.7 Ship fixes during the test as new AABs (versionCode 2, 3…) to the same closed track; testers stay opted in.

## Step 8 — Apply for production (**YOU**, after day 14)

8.1 **Dashboard → Apply for production** (only appears once the 12×14 condition is met).
8.2 Three parts: *About your closed test* (how you recruited testers, how they used it, the feedback you got and what you changed), *About your app* (audience: groups of friends and families playing on a TV; value: phone-as-controller secret-word party game in EN/FR/AR), *Production readiness* (what you changed, why you're ready). Answer concretely; vague answers get rejected.
8.3 Wait for the email (usually ≤ 7 days).

## Step 9 — Production release (**YOU**)

9.1 **Test and release → Production → Countries/regions** → *Add countries/regions*: start with **Lebanon, France, Belgium, Switzerland, Canada, United Arab Emirates, Saudi Arabia, Jordan, Kuwait, Qatar, Bahrain, Oman, Egypt, United States, United Kingdom** (or all; Google TV availability varies by country).
9.2 **Production → Create new release** → *Add from library* → the build that passed the closed test (versionName 1.0.0) → release notes → **Next**.
9.3 Staged rollout: 20 % → 50 % → 100 % over a few days (Production → Releases → *Manage rollout*). For a brand-new app, 100 % at once is also fine.
9.4 **Publishing overview** (left menu) → check every change is listed (store listing, App content, TV opt-in) → **Send changes for review**. Leave **Managed publishing** off unless you want to choose the exact go-live moment (then click *Publish* after approval).
9.5 Watch two reviews: the app review (policy) and the **Android TV review** (Advanced settings → Form factors → Android TV status + email). If "Not approved": read the email, fix, bump versionCode, upload, and the TV review restarts.

## Step 10 — After launch

- Store listing experiments (LISTING.md §5) once you have traffic.
- Reply to reviews (Ratings and reviews → Reviews).
- **Android vitals** (Monitor and improve → Android vitals): crashes/ANRs, since the app ships no crash reporter.
- Cloudflare: watch Workers/Durable Objects usage and limits in the Cloudflare dashboard on launch day (every room is one DO).
- **When Play Billing ships**: content rating questionnaire → digital purchases = Yes; Data safety → DATA-SAFETY.md §1.B; privacy policy Appendix B; listing LISTING.md §4; DSA trader status (0.6); create the products only after a build containing the Billing library is uploaded to a test track (`docs/PAYMENTS-SPEC.md` §8).
