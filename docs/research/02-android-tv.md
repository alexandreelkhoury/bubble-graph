# 02 — Android TV / Google TV requirements (researched 2026-10-03)

Scope: Kotlin + Jetpack Compose for TV app. The TV shows a lobby with a QR code, and phones join through a web page.
Rule: every claim has a source URL. **[UNVERIFIED]** means no official page fetched in this session confirms it.
Note: `support.google.com` was blocked by the network proxy in this session, so the Play Help Center claims rely on developer.android.com pages that link to it.

## TL;DR version pins (fetched, not guessed)

| Item | Version / value | Source |
|---|---|---|
| `androidx.tv:tv-material` | **1.1.0** stable (2026-05-06); prior 1.1.0-rc01 (2026-04-08), 1.1.0-beta01 (2026-03-11), 1.0.1 (2025-07-16) | https://developer.android.com/jetpack/androidx/releases/tv |
| `androidx.tv:tv-foundation` | **1.0.0** stable (2026-05-06), its first stable release; prior 1.0.0-rc01 (2026-04-08), 1.0.0-beta01 (2026-03-11) | same |
| Newer tv alpha/beta | The release page listed none newer than the stables above as of fetch | same |
| Compose BOM | **2026.09.00** (foundation/ui 1.12.1, material3 1.4.0); previous 2026.08.00, 2026.06.01 | https://developer.android.com/develop/ui/compose/bom/bom-mapping |
| Compose preview line | foundation 1.13.0-alpha03, material3 1.5.0-alpha29 (page dated 2026-09-23) | https://developer.android.com/jetpack/androidx/releases/compose-bom |
| Compose 1.12 build requirement | **compileSdk 37 + AGP 9** | https://developer.android.com/develop/ui/compose/compiler |
| AGP | **9.4.0** (Sept 2026); Gradle 9.6.0 min; JDK 17; build-tools 36.0.0; max API 37 | https://developer.android.com/build/releases/gradle-plugin |
| AGP 9 Kotlin | Built-in Kotlin is on by default, so there is no `kotlin-android` plugin; runtime dep on KGP ≥ 2.2.10 | https://developer.android.com/build/releases/agp-9-0-0-release-notes |
| Kotlin | **2.4.20** stable (2026-09-07); 2.4.10 (2026-07-14); 2.4.0 (2026-06-03). Maven Central also shows 2.4.21-RC, 2.5.0-Beta1 | https://kotlinlang.org/docs/releases.html , https://repo1.maven.org/maven2/org/jetbrains/kotlin/kotlin-stdlib/maven-metadata.xml |
| Compose compiler | `org.jetbrains.kotlin.plugin.compose`, version = Kotlin version | https://developer.android.com/develop/ui/compose/compiler |
| Play targetSdk (TV) | New apps/updates from **2026-08-31**: TV must target **API 34+**. Phone apps need API 36. Existing TV apps need API 33+ to stay visible on newer OS. Extension to 2026-11-01 available | https://developer.android.com/google/play/requirements/target-sdk |
| ZXing core | **3.5.4** (`com.google.zxing:core`; Maven metadata lastUpdated 2025-11-11) | https://repo1.maven.org/maven2/com/google/zxing/core/maven-metadata.xml |

Recommendation: `compileSdk = 37` (required by Compose 1.12 / BOM 2026.09.00). Set `targetSdk = 36` or 37: TV needs only 34, but if the same package ever ships on phones, the phone rule is 36. Set `minSdk ≤ 31` (TV-PS, see §4). AGP 9.4.0 + Kotlin 2.4.20.
Caveat: `dl.google.com/maven2` metadata was blocked by the proxy, so the androidx versions come from the developer.android.com release pages and not from maven-metadata.xml.

## 1. Manifest requirements

Source: https://developer.android.com/training/tv/get-started/create and https://developer.android.com/training/tv/get-started/hardware

- **Launcher intent (required):** `ACTION_MAIN` + `CATEGORY_LEANBACK_LAUNCHER` on the entry activity. Without it the app is invisible to Play on TV and does not appear in the TV launcher (create page; quality item TV-ML at https://developer.android.com/docs/quality-guidelines/tv-app-quality).
- **`android.software.leanback`:** use `required="false"` if the APK/AAB also targets phones. Use `required="true"` for a TV-only app; Play then restricts distribution to Android TV OS devices (create page). PartyWord TV is TV-only, so **`required="true"`** fits. Note that this blocks installs on phones and tablets.
- **`android.hardware.touchscreen required="false"` is mandatory.** Without it the app does not appear in Play on TV (create page; TV-MT).
- **Other features TV lacks; declare each `required="false"` if used or implied:** `faketouch`, `telephony`, `camera`, `nfc`, `location.gps`, `microphone`, `sensor`, `screen.portrait`, and `wifi` (the sample includes wifi; many TVs use Ethernet). Permissions that imply features: `RECORD_AUDIO`→microphone, `CAMERA`→camera(+autofocus), `ACCESS_FINE/COARSE_LOCATION`→location/gps/network, `ACCESS/CHANGE_WIFI_STATE`→wifi (hardware page).
- **Banner:** `android:banner="@drawable/banner"` on `<application>` or the activity. **320 × 180 px, xhdpi resource**, which is 160 × 90 dp, *not* 320×180 dp. **The banner must include the app name as text.** Provide localized banners per language (create page; TV-LB/TV-BN).
- **Icon:** `android:icon`, a 160 × 160 px xhdpi launcher icon (TV-LB, quality page).
- **Theme/launcher color:** `android:colorPrimary` in the theme is used by the launcher (create page).
- **Network:** `INTERNET` permission is needed for the LAN server or socket (standard Android; not TV-specific).

```xml
<manifest>
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-feature android:name="android.software.leanback" android:required="true"/>
  <uses-feature android:name="android.hardware.touchscreen" android:required="false"/>
  <uses-feature android:name="android.hardware.faketouch" android:required="false"/>
  <uses-feature android:name="android.hardware.wifi" android:required="false"/>
  <application android:icon="@mipmap/ic_launcher" android:banner="@drawable/banner"
      android:networkSecurityConfig="@xml/network_security_config">
    <activity android:name=".MainActivity" android:exported="true"
        android:screenOrientation="landscape">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LEANBACK_LAUNCHER"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
```
(`screenOrientation` is a choice for this app. TV-LO requires landscape support: https://developer.android.com/docs/quality-guidelines/tv-app-quality)

## 2. Compose for TV libraries

- Deps: `androidx.tv:tv-material:1.1.0`, `androidx.tv:tv-foundation:1.0.0` (https://developer.android.com/jetpack/androidx/releases/tv). The create guide recommends Compose for TV over Leanback (https://developer.android.com/training/tv/get-started/create).
- **What moved to main Compose foundation:**
  - **Lazy layouts:** `TvLazyRow/TvLazyColumn/TvLazyHorizontalGrid/TvLazyVerticalGrid` were deprecated in tv-foundation 1.0.0-alpha11 (2024-07-10) and **removed in 1.0.0-alpha12** (2025-01-15). Use the standard `LazyRow/LazyColumn/LazyVertical/HorizontalGrid` (foundation ≥ 1.7.0). `pivotOffsets` is replaced by `BringIntoViewSpec` via `LocalBringIntoViewSpec` (https://developer.android.com/training/tv/playback/compose/lists ; release notes above).
  - **Focus:** `focusRequester`, `focusRestorer`, `focusGroup`, `focusProperties` live in Compose UI `androidx.compose.ui.focus` (https://developer.android.com/develop/ui/compose/touch-input/focus/change-focus-behavior , https://developer.android.com/reference/kotlin/androidx/compose/ui/focus/package-summary). The tv 1.1.0-alpha01 notes also show focus API renames that align with core Compose: `FocusProperties.enter/exit` became `onEnter/onExit`, and `cancelFocus()` became `cancelFocusChange()` (tv release page).
- tv-material supplies TV-styled `Surface`, `Button`, `Card`, `Carousel`, `NavigationDrawer`, and `MaterialTheme` with focus/scale/glow indications. Use **`androidx.tv.material3`** widgets on TV, not mobile `androidx.compose.material3`. That split is the general recommendation from the create page; the per-component list is **[UNVERIFIED]** in detail.

## 3. D-pad focus best practices (Compose)

Sources: https://developer.android.com/training/tv/get-started/navigation , https://developer.android.com/develop/ui/compose/touch-input/focus/change-focus-behavior , https://developer.android.com/develop/ui/compose/touch-input/focus/request-focus , https://developer.android.com/design/ui/tv/guides/styles/layouts

- **Always have something focused** at launch and while idle. Show a clear focus indicator (color, scale, or animation) and leave enough padding around focusable items for the highlight (navigation page).
- **Initial focus:** `val fr = remember { FocusRequester() }`, `Modifier.focusRequester(fr)`, and `LaunchedEffect(Unit) { fr.requestFocus() }`. Never call `requestFocus()` in the composable body (request-focus page). For the lobby, put initial focus on "Start game" (disabled until ≥ N players), or on a "Settings" button.
- **`Modifier.focusRestorer()`** on a container saves the last focused child and restores it when focus re-enters the group (focusRestorer reference / search summary). **`focusGroup()`** groups children for traversal. **`focusProperties { up/down/left/right/next; canFocus; onEnter/onExit }`** overrides the default geometry only when it is wrong (change-focus-behavior page).
- **Layout by axis:** vertical moves between categories, horizontal moves within one. Avoid deeply nested hierarchies and keep a direct path to every focusable element (navigation page).
- **Back button:** returns to the previous destination. From the root it should **exit to the TV home screen (TV-DB)**. Do not gate exit with confirmation screens, create back loops, show an on-screen back button, or reuse Back for other functions (navigation page; https://developer.android.com/docs/quality-guidelines/tv-app-quality). In Compose use `BackHandler {}` (an `OnBackPressedDispatcher` wrapper; navigation page shows the dispatcher form). For a game, Back during a round should go to the lobby or a pause screen rather than kill the session silently. That is a design choice, not a guideline.
- **No Menu-key dependency (TV-DM).** Everything must work with the 5-way D-pad (TV-DP) (quality page).
- **Overscan / safe area:** base canvas **960 × 540 dp**. Keep a 5% margin, **48 dp left/right and 27 dp (≈24 dp) top/bottom**; the TV design page recommends **58 dp sides / 28 dp top-bottom**. Backgrounds still fill the full screen. Use a 12-column grid (52 dp columns, 20 dp gutters, 844 dp content width) (layouts page; TV-OV/TV-TR on quality page).
- **10-foot text:** use `sp`, light text on a dark background, sans-serif, and no thin or decorative fonts. Keep text minimal (https://developer.android.com/training/tv/start/layouts , https://developer.android.com/design/ui/tv/guides/styles/typography). TV type scale roles: Display / Headline / Title / Body / Label, with buttons using Label Large (typography page). **[UNVERIFIED] exact sp values.** The fetched pages gave none; read them from `androidx.tv.material3.Typography` defaults in code. For the QR code, make it large (for example ≥ 240 dp) with a quiet-zone margin so phones can scan from a couch. That size is a design heuristic and **[UNVERIFIED]** by any official source.

## 4. TV app quality guidelines: key checklist

Source: https://developer.android.com/docs/quality-guidelines/tv-app-quality

- **Launcher:** TV-LM icon shows in the launcher; TV-LB 320×180 px banner + 160×160 px icon (xhdpi); TV-BN banner contains the app name; TV-LS installs and launches without errors.
- **Layout:** TV-LO landscape, no letterboxing; TV-OV nothing cut off by screen edges; TV-TR full-screen opaque background.
- **Input:** TV-DP everything works with the D-pad; TV-DK standard gamepad keys if a controller is required; TV-DM no Menu-button dependency; TV-DB Back from root goes to home.
- **Manifest:** TV-ML LEANBACK_LAUNCHER; TV-MT touchscreen not required.
- **Platform:** TV-PS `minSdkVersion` ≤ **31**; TV-G6 **from 2026-08-01 support 64-bit + 16 KB page sizes**. This matters if native libraries are bundled; pure Kotlin/JVM apps are generally unaffected (https://developer.android.com/guide/practices/page-sizes).
- **Play:** TV-G1 **App Bundle mandatory**; TV-G2 policy; TV-G3 works as listed; TV-G4 high-res TV screenshot of the current experience; TV-G5 provide login credentials if auth is required.
- **Performance:** TV-ME stay within memory limits on low-RAM TVs (https://developer.android.com/training/tv/playback/memory).
- Media/PiP items (TV-PC/PP/PA/IE…) mostly don't apply. Tier 2/Tier 1 (Baseline Profiles, 4K assets, gamepad, Engage SDK) are optional differentiators.

## 5. Play Console: TV opt-in and review

Source: https://developer.android.com/training/tv/publishing/distribute (Play Help Center links on it were not fetchable)

1. Meet the quality guidelines and the 64-bit/16 KB requirement (from 2026-08-01). The page strongly recommends the same package name as any mobile app and dedicated TV tracks.
2. Upload an **AAB**.
3. Store listing: **at least one Android TV screenshot** (required before opting in), an **Android TV banner graphic**, and "Android TV" mentioned in the description.
4. **Setup → Advanced settings → Form factors tab → Add release type → Android TV**, then accept the review terms.
5. Roll out. Google Play reviews the app against the TV quality criteria. Status is **Pending / Approved / Not approved**, shown under the Android TV section of *Pricing & distribution*. A rejection sends an email to the developer account listing the issues; fix them and upload a new version to re-review.

- **Review timing: [UNVERIFIED].** No official figure was found on the fetched pages.
- **Store banner pixel size (commonly cited as 1280×720): [UNVERIFIED]**, because support.google.com was blocked.
- **Common rejection reasons:** the distribute page gives no list. Inferred from the checklist, the likely causes are missing LEANBACK_LAUNCHER or banner, touchscreen required, unreachable UI via D-pad, Back not exiting, content clipped by overscan, no TV screenshot, and a 32-bit-only or 4 KB-only native lib. This list is **inference, not an official list**.

## 6. Practical dev setup

**Deploy to a TCL Google TV over Wi-Fi.** Source: https://developer.android.com/tools/adb#connect-to-a-device-over-wi-fi , https://developer.android.com/studio/debug/dev-options
- Enable Developer options by tapping **Build number** 7 times. The TV path is not on the official page. On Google TV it is usually *Settings → System → About → Android TV OS build*: **[UNVERIFIED]**.
- **Android TV 13+ (API 33+):** use Wireless debugging (adb Wi-Fi). Turn on *Developer options → Wireless debugging*, then *Pair using pairing code*, then `adb pair <ip>:<pairport>` (enter the code), then `adb connect <ip>:<port>`. Android Studio's "Pair devices over Wi-Fi" (QR) also works. Requires platform-tools; the doc cites **adb 37.0.0+ for adb Wi-Fi 2.0**.
- **Older TV OS (≤12) / legacy:** `adb tcpip 5555` (needs an initial USB connection), then `adb connect <ip>:5555`. Many Android TV builds have a "Network debugging" toggle in Developer options that opens 5555 without USB: **[UNVERIFIED]**, not on the official page. Check the TCL model's Android TV OS version, which varies by model (**[UNVERIFIED]**).
- Troubleshooting: same subnet, `adb kill-server && adb start-server`, `adb mdns track-services`.

**Emulator.** Device Manager → Create device → Device type **Android TV** or **Google TV** → pick a TV system image (https://developer.android.com/studio/run/managing-avds). Use the image API that matches your target (34+). Arrow keys act as the D-pad. **[UNVERIFIED]** list of currently available TV image API levels.

**Cleartext to a LAN dev server: yes, you need a config.** For apps targeting API 28+, cleartext is **disabled by default** (https://developer.android.com/privacy-and-security/security-config).
- If the **TV itself hosts** the HTTP/WebSocket server (likely for this game), the TV app does not make cleartext *client* requests, so this does not apply to serving.
- If the TV app *calls* a dev server at `http://192.168.x.x`, it needs a debug-only `network_security_config` or `android:usesCleartextTraffic="true"` in a debug manifest. `<domain-config>` matches hostnames. Matching raw LAN IPs in `<domain>` is **[UNVERIFIED]**: the doc only confirms loopback IPs on API 37+. The safest approach for dev is `<base-config cleartextTrafficPermitted="true">` in `src/debug/res/xml/`.

```xml
<!-- src/debug/res/xml/network_security_config.xml -->
<network-security-config>
  <base-config cleartextTrafficPermitted="true"/>
</network-security-config>
```

**QR code generation.** `com.google.zxing:core:3.5.4` (https://repo1.maven.org/maven2/com/google/zxing/core/maven-metadata.xml) is pure Java. Encode with `QRCodeWriter().encode(url, BarcodeFormat.QR_CODE, size, size)` into a `BitMatrix`, then draw it into an `ImageBitmap` or a Compose `Canvas`. No camera is needed on TV. API usage is from ZXing's well-known API; this session did not fetch a ZXing javadoc page, so treat the exact signature as **[UNVERIFIED]**.
