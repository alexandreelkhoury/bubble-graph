# TV app — build, install, debug

The Android TV app lives in [`/tv-app`](../tv-app). It is a single-module Gradle project (`:app`, package `app.mishana.tv`) written in Kotlin with Compose for TV. It creates a room on the server, shows the QR code and room code, and is the stage for the whole game (SPEC §9, DESIGN §7).

Contents: [Prerequisites](#prerequisites) · [First-time setup](#first-time-setup-gradle-wrapper) · [Build and install](#build-and-install) · [Emulator](#emulator-google-tv-avd) · [Real TV (TCL)](#real-tv-tcl-google-tv--android-tv) · [Unit tests](#unit-tests) · [Billing: premium and packs](#billing-premium-and-packs) · [Debug server override](#debug-server-override) · [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| JDK | 17 or newer (21 recommended) | AGP 9 needs JDK 17+. Android Studio bundles one |
| Android Studio | a 2026.x release with AGP 9.4 support | Or the command-line SDK tools |
| Android SDK | Platform **37** (compileSdk), Build-Tools 36.x | Install with the SDK Manager |
| Gradle | 9.6.0 (via the wrapper) | See below; no wrapper jar is checked in |
| adb (platform-tools) | 37.0.0+ | Needed for Wi-Fi pairing on Android TV 13+ |
| The game server | `pnpm dev` from the repo root | See [DEV.md](DEV.md). It listens on port **8787** |

The pinned library versions are in `tv-app/gradle/libs.versions.toml` (AGP 9.4.0 with built-in Kotlin 2.4.20, Compose BOM 2026.09.00, tv-material 1.1.0, tv-foundation 1.0.0, OkHttp 5.5.0, kotlinx.serialization 1.11.0, ZXing core 3.5.4). Items marked `[VERIFY]` there could not be resolved when the project was written (Google Maven was unreachable from the authoring sandbox); if one does not resolve, bump it to the nearest stable release from developer.android.com and note it.

Find your Mac's LAN IP (the TV must reach it):

```sh
ipconfig getifaddr en0      # Wi-Fi; try en1 if empty
```

## First-time setup (Gradle wrapper)

The wrapper properties pin Gradle 9.6.0, but the `gradle-wrapper.jar` is not in the repo. Generate it once, either way:

- **Android Studio:** File → Open → `tv-app/`. Studio creates the wrapper and syncs.
- **Command line** (needs any local Gradle, e.g. `brew install gradle`):

  ```sh
  cd tv-app
  gradle wrapper --gradle-version 9.6.0
  ```

Then make sure `tv-app/local.properties` points at your SDK (Studio writes it for you):

```properties
sdk.dir=/Users/<you>/Library/Android/sdk
```

## Build and install

The server URL is baked into `BuildConfig.SERVER_URL` at build time (SPEC §9.4):

1. `-PserverUrl=…` on the command line, else
2. `mishana.prodServerUrl` in `tv-app/gradle.properties` (a placeholder until you deploy; see [Production server URL](#production-server-url)), else
3. `https://mish-ana.example.workers.dev` (the same placeholder).

Build and install a debug APK against your Mac's dev server:

```sh
cd tv-app
./gradlew :app:assembleDebug :app:installDebug -PserverUrl=http://<mac-ip>:8787
adb shell am start -n app.mishana.tv/.MainActivity
```

Debug builds allow cleartext `http://` / `ws://` (a debug-only network security config). Release builds do not, so production must be `https://`.

### Production server URL

`tv-app/gradle.properties` ships a **placeholder**: `mishana.prodServerUrl=https://mish-ana.example.workers.dev`. Before a release, replace it with your deployed Worker origin (the `https://play.<your-subdomain>.workers.dev` URL that `pnpm run deploy` prints, or your custom domain; no trailing slash, no path), or pass it per build:

```sh
./gradlew :app:bundleRelease -PserverUrl=https://<your-worker-origin>
# CI: ORG_GRADLE_PROJECT_serverUrl=https://<your-worker-origin> ./gradlew :app:bundleRelease
```

The phone join link in the QR code comes from the server, not from the app (`JOIN_BASE_URL`, see [DEV.md](DEV.md#production-urls)).

Release build (production URL from `gradle.properties`):

```sh
./gradlew :app:assembleRelease      # or :app:bundleRelease for Play (AAB)
```

Release builds are minified and resource-shrunk (R8). `preReleaseBuild` **fails** while the server URL is still the `example.workers.dev` placeholder, and when it is not `https://` (release builds allow no cleartext traffic); on success it logs `Mish Ana! release server URL: …`. The Compose compiler treats the protocol models as stable (`app/compose-stability.conf`), so unchanged parts of a broadcast skip recomposition.

The app appears in the TV launcher's apps row with its banner (`res/drawable/banner.xml`, localised for Arabic in `drawable-ar/`).

## Emulator (Google TV AVD)

1. Android Studio → Device Manager → **Create Virtual Device**.
2. Category **TV** → pick **Google TV (1080p)** (or "Android TV (1080p)").
3. System image: **API 34 or newer** (Google TV image). Finish.
4. Start it, then `./gradlew :app:installDebug -PserverUrl=http://10.0.2.2:8787`.
   - `10.0.2.2` is the emulator's alias for your Mac's localhost. Phones on your Wi-Fi still need `http://<mac-ip>:8787`, so for a real party use the LAN IP everywhere.
5. The arrow keys are the D-pad, Enter is OK, Esc is Back. Long-press = hold Enter.

## Real TV (TCL Google TV / Android TV)

First find the model and OS: **Settings → System → About** (model name, *Android TV OS version*, *Android TV OS build*). Then enable Developer options: on that About screen, select **Android TV OS build** seven times until "You are now a developer".

The TV and the Mac must be on the **same network/subnet**.

### Android TV 13 and newer: Wireless debugging (pair with code)

1. **Settings → System → Developer options → Wireless debugging** → On.
2. Choose **Pair device with pairing code**. The TV shows an `IP:pairPort` and a 6-digit code.
3. On the Mac:

   ```sh
   adb pair <tv-ip>:<pairPort>         # enter the 6-digit code when asked
   adb connect <tv-ip>:<port>          # the port shown on the main Wireless debugging screen (not the pairing port)
   adb devices                         # should list <tv-ip>:<port>   device
   ```

4. Install: `./gradlew :app:installDebug -PserverUrl=http://<mac-ip>:8787`.

The wireless-debugging port changes after a reboot or after toggling the setting; run `adb connect` again with the new port. Pairing is remembered.

### Android TV 12 and older: `adb tcpip 5555`

1. Turn on **Developer options → USB debugging**.
2. Connect the TV to the Mac **once over USB** (USB-A to USB-A, or the TV's service port; models differ), accept the RSA prompt on the TV, then:

   ```sh
   adb tcpip 5555
   adb connect <tv-ip>:5555
   ```

3. Unplug USB; `adb connect <tv-ip>:5555` keeps working until the TV reboots.
4. Some Android TV builds have a **Network debugging** (or "ADB over network") toggle in Developer options that opens port 5555 without USB; if yours does, turn it on and skip the USB step.

Then install as above. To see logs: `adb logcat | grep -i mishana`.

## Unit tests

```sh
cd tv-app
./gradlew :app:testDebugUnitTest
```

Fixtures are read from `../../shared/fixtures` relative to the unit-test working directory (`tv-app/app`). Override with `MISHANA_FIXTURES=/abs/path/to/shared/fixtures`. The tests cover: protocol fixtures (decode + re-encode + deep asserts), client encoding, reconnect policy, heartbeat (virtual time), the WebSocket client (MockWebServer), QR module size, the ViewModel (fake socket + Turbine), countdowns, settings stepping, the action pill (arming, and the guard that ignores OK presses carried over from a skipped reveal), the colour table, the view diff behind the join / leave / away / forfeit / skipped-turn toasts, the optimistic settings draft (debounce, echo, late echo), the elimination sequence plan (flights, budget, what follows: next round / last chance / end), and the lobby metrics (the widest room code and a long join host fit the 264 dp column at the smallest fit-to-width size, measured with the bundled Cairo fonts).

Full CI-style check on a Mac: `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

Before the first Mac build, check the layouts listed in DESIGN §11 on a device or emulator: 12 players in English and Arabic, at the 1.3× system font scale, on TV-02 (lobby), TV-04 (role reveal), TV-05 (clues: order strip), TV-06 (vote grid) and TV-11 (results). These sandboxes had no Android SDK, so no screenshot tests (Paparazzi/Roborazzi) run here.

## Remote-only checks on a device

The app must be fully usable with the remote alone (D-pad, OK, Back; sometimes an air-mouse). There is no instrumented test suite yet (it needs the Android SDK and Google Maven, which the authoring sandboxes did not have); before a release, walk through these on a TV or a Google TV AVD:

- Every screen has a visible focused element on arrival, and Up/Down/Left/Right never leave focus on nothing. Back works everywhere: Lobby → exit; Settings rows → categories → Lobby; in a game or on Results → pause menu; inside any dialog or panel → closes it.
- Overlays keep focus inside: open the pause menu, a kick or end-game confirm, the language list, the packs/difficulty panels, and the connection-lost screen; the D-pad must never reach the screen behind. Let a listed player leave while the pause menu's Players… page or a kick confirm is open: focus stays in the overlay and the confirm closes.
- Focus comes back to where it was: pause menu → Players… → Back returns to Players…; cancelling a kick returns to that player's row; cancelling the guess override returns to its button; pausing from the verdict's Continue pill and resuming returns to Continue. Down on the last Settings row stays put (it never jumps to a lower category).
- Mash OK through the vote reveal into the next clue turn: the new speaker's turn is never skipped (the pill ignores OK briefly after a phase or speaker change). On Results, a double OK does not trigger Play again before the summary has shown. On the Results summary, players with equal totals share a rank (every rank-1 row has the trophy), and 4 score rows stay fully visible in English and Arabic.
- Air-mouse: hovering a control focuses it; clicks on a dimmed area under any dialog or scrim do nothing; both Settings chevrons step values. **Check that a pointer click (BUTTON_PRIMARY) on tv-material Surfaces activates them** (buttons, tiles, rows). If it does not on your remote, add a tap handler next to `MishFocusSurface` (one place) rather than per screen.
- Performance: on a low-end stick (e.g. Chromecast HD), the idle lobby and the clue timer should not keep the GPU busy (no per-frame recomposition: check with the Layout Inspector's recomposition counts). A baseline profile (`androidx.baselineprofile` + a Macrobenchmark walking Home → Lobby → Reveal → Clues → Vote → Elimination → Results with D-pad events) is the next step for first-launch smoothness.

## Sound

The 26 cues (DESIGN §6.4) are original synthesis rendered by `pnpm gen:sounds` into `app/src/main/res/raw/*.ogg` (and `web-client/public/sounds` for the `/tv` mock). The app plays them through `SoundPool` on two buses (SFX, Stingers), plus quiet remote feedback for D-pad moves, OK and Back. One global mute lives in Settings and in the pause menu; it is persisted, muting stops what is ringing and unmuting confirms with the OK tick. Check levels on the real TV speakers before release.

## Billing: premium and packs

The TV is the only place anything is sold (PAYMENTS-SPEC §0, §4): the `premium` subscription (base plans `monthly` / `yearly`, offer `trial-7d`) and one-time `pack_<id>` products, through **Google Play Billing Library 9.1.0** (`com.android.billingclient:billing`, no `billing-ktx`). The server verifies every purchase, acknowledges it, and returns a signed entitlement token; the TV never acknowledges or consumes anything itself.

**Where things are** (`app/src/main/java/app/mishana/tv/`):

| Path | Role |
|---|---|
| `billing/BillingRepository.kt` | Process-wide orchestration: restore on start / `ON_START` / `ON_RESUME`, `/api/billing/verify` and `/entitlement`, the in-room refresh timer, the Store state machine, billing toasts |
| `billing/PlayBillingGateway.kt` | The only file that touches Play Billing (one `BillingClient` per process, auto-reconnect, pending one-time purchases enabled) |
| `billing/StoreModel.kt`, `ui/screens/StoreScreen.kt` | The Store overlay (LOBBY only): Premium card + disclosure, packs row, Restore, room code in the header |
| `billing/EntitlementStore.kt`, `billing/InstallId.kt` | SharedPreferences `mishana_billing` (install id, last entitlement). Excluded from backup and device transfer (`res/xml/backup_rules.xml`, `data_extraction_rules.xml`) |
| `src/debug/…/FakeBillingGateway.kt` | The server's fake test store (debug builds only; a release APK does not contain it) |

**Entry points (remote only):** the lobby's Premium button (gem icon, first in the bottom bar; icon-only with a focus tooltip, like the globe Language button, because the labelled bar does not fit the 542 dp end column), a locked pack in Settings → Words → Packs, and the locked Points rows in Settings → Game (Left/Right shake, OK opens the Store). Back closes the Store and returns focus to the control that opened it. While the Store or the Play purchase sheet is up, the TV sends `storeOpen` so a phone cannot start a game behind it.

### Fake billing (debug builds, no Play account needed)

1. Run the server with fake billing: `pnpm dev` (it passes `BILLING_MODE=fake` and `ALLOW_FAKE_BILLING=1`; the Worker only honours them on `localhost`/LAN hosts).
2. Open the debug settings (splash screen → long-press OK on the version label), set the server URL to your Mac (`http://<mac-ip>:8787`), switch **Billing: Fake (server test store)** on, then Done. The dialog checks `GET /api/billing/catalog`: "Server is in Google mode" means the toggle is ignored and Google Play is used.
3. In the lobby open **Premium**: the Store shows the banner "Test store: no real payments" and synthetic prices ($4.99 / $29.99 / $1.99, 7-day trials). OK on a plan or pack opens a **Fake purchase** dialog: *Approve* (purchased), *Pending* (the pending chip; complete it from the server with `POST /api/billing/fake/set`, then open the Store or use Restore purchases), *Cancel* (USER_CANCELED, silent) or *Error* (generic error toast).
4. Fake purchase tokens are remembered in the debug prefs (`mishana_debug` / `fake_purchases`), so **Restore purchases** and app restarts behave like Play. Clearing the app's data starts over (new install id).
5. To test expiry and refunds, use the `/tv` mock's test controls or `POST /api/billing/fake/set {purchaseToken, state}` (see [DEV.md](DEV.md)); the TV picks the change up on its next refresh (open the Store, resume the app, or wait for the in-room timer).

### Google Play testing (license testers)

Real Play Billing only works for an app **installed from Play** (internal or closed testing track) by an account the console knows; a sideloaded debug APK gets `BILLING_UNAVAILABLE` or `ITEM_UNAVAILABLE` [VERIFY on your device].

1. Play Console → Settings → **License testing**: add the testers' Gmail addresses. Upload a release AAB to **Internal testing** and create the products (PAYMENTS-SPEC §8.B).
2. On the TV, sign in to Google Play with a license tester account (Settings → Accounts), accept the internal test link from a phone or computer, and install from Play.
3. Test timings (license testers): monthly renews every 5 min, yearly every 30 min, the free trial lasts 3 min, grace 5 min, account hold 10 min; a test subscription renews at most 6 times. An **unacknowledged** purchase is refunded after 3 min (one-time) or 5 min (subscription): if purchases keep vanishing, the server is not acknowledging (check the Worker logs for `BILLING_ACK_*`).
4. Test cards: "Test card, always approves", "always declines", and "slow test card, approves/declines after a few minutes" (the last one exercises the **Payment pending** state).
5. Walk PAYMENTS-SPEC §8.E: trial → premium without a new room code; slow card → pending → unlocks later; refund a pack in Play Console → it disappears; refund-and-revoke the subscription → `lobby.premiumEnded`; Restore purchases on a second TV; a declining card → grace/hold → the Store shows **Fix payment** and no plan buttons.
6. **Manage subscription / Fix payment** open `https://play.google.com/store/account/subscriptions?sku=premium&package=app.mishana.tv`. [VERIFY on a real Google TV that the Play Store handles this link; when nothing does, the TV shows the "On a phone or computer…" instructions instead.]

### What to check on a device (not covered by the JVM tests)

- The Store at 960×540 dp in EN, FR and AR: the Premium card with the longest disclosure (trial + cancel line) fits above the packs row without scrolling, every plan shows its price and badge, and focus starts where §4.4 says (yearly plan, Fix payment, Manage, or the pack you came from). `StoreLayoutFitTest` checks the arithmetic with the Cairo metrics; a Compose screenshot test (Paparazzi/Roborazzi) of `StoreScreen` is still to add.
- The lobby bottom bar in all three languages, with the icon-only Premium and Language buttons and their focus tooltips.
- `BILLING_UNAVAILABLE`: sign out of Google Play (or use a kids profile), open the Store → "To buy on this TV, sign in to Google Play…" with a single OK; locked rows read "Locked". Sign back in, leave and reopen the app: the Store works again.
- The merged manifest contains `com.android.vending.BILLING` (`./gradlew :app:processDebugManifest`, then look in `app/build/intermediates/merged_manifest/`) [VERIFY].

**JVM tests** (`./gradlew :app:testDebugUnitTest`): `ProductsTest`, `OfferSelectionTest`, `BillingErrorsTest`, `EntitlementApiTest` (MockWebServer), `BillingRepositoryTest` (fake gateway + fake API, virtual time), `StoreFocusTest`, `BillingNoticesTest`, `GameViewModelBillingTest`, `LobbyBarFitTest`, `StoreLayoutFitTest`, plus the billing fixtures in `ProtocolFixturesTest` and `ClientEncodingTest`.

## Debug server override

Debug builds only: on the splash screen, focus the small version label at the bottom end and **long-press OK**. The Debug settings dialog stores a server URL in SharedPreferences `mishana_debug` / `server_url`; blank means `BuildConfig.SERVER_URL`. Saving creates a new room on that server. Release builds always use `BuildConfig.SERVER_URL`. The same dialog holds the **Billing: Google Play / Fake** toggle ([Fake billing](#fake-billing-debug-builds-no-play-account-needed)).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Splash shows "Couldn't create a room" | The TV can't reach the server. From the Mac: `curl http://<mac-ip>:8787/healthz` should print `{"ok":true,…}`. Check the URL you built with (`-PserverUrl`) or the debug override |
| Works on the emulator, not on the TV | `10.0.2.2` only exists in the emulator; rebuild with `-PserverUrl=http://<mac-ip>:8787` |
| `adb connect` times out / "No route to host" | TV and Mac must be on the same subnet (guest Wi-Fi and mesh "client isolation" block this). Check the TV's IP in Settings → Network |
| `adb pair` fails | Use the **pairing** port for `adb pair` and the **connection** port for `adb connect`; they differ. Update platform-tools (adb 37.0.0+) |
| `adb devices` shows `unauthorized` / `offline` | `adb kill-server && adb start-server`, reconnect, and accept the prompt on the TV |
| Wireless debugging port changed | It changes on reboot; read the new port on the TV and `adb connect` again |
| Phones can't open the QR link or connect | macOS firewall: System Settings → Network → Firewall → allow incoming connections for `node`/`workerd`, or open **TCP 8787**. Phones must be on the same Wi-Fi |
| Cleartext error in logs | Only debug builds allow `http://`/`ws://`; use a debug build for LAN dev, `https://` for release |
| "Reconnecting to the server…" banner | The socket dropped; the app retries with backoff (0.5 s → 10 s). After 30 s a full-screen "Connection lost" appears with Try again. The room and players are kept by the server |
| Gradle can't find `gradle-wrapper.jar` | Run `gradle wrapper --gradle-version 9.6.0` once (see above) |
| Text taller than designed; labels clipped (e.g. the lobby's bottom buttons show only the top half of their text) | Android 13+ never makes a line shorter than the font's ascent + descent (fallback line spacing, which Compose cannot turn off), and stock Cairo's are 1.874 em, so every `lineHeight` in `MishType` was ignored. The bundled fonts carry tightened metrics (880 / −180) so the line heights apply again. If you replace the font files, re-run `python3 tv-app/scripts/tighten_cairo_metrics.py` (needs `pip install fonttools`) |
| Store says "To buy on this TV, sign in to Google Play…" | Play reported `BILLING_UNAVAILABLE`: no Google account on the TV, a kids profile, or the app was not installed from Play. Sign in, then leave and reopen the app (it retries on the next start). For local testing use the fake store |
| Store shows "The store isn't available right now" | The catalog or Play product query failed or took over 10 s. Try again; check `curl http://<server>/api/billing/catalog` |
| A test purchase disappears after a few minutes | It was never acknowledged (license-tester auto-refund after 3 / 5 min). The server acknowledges: check its Play API credentials and logs |
| AGP/Kotlin DSL error on `compileSdk` | AGP 9 may prefer `compileSdk { version = release(37) }`; switch the line in `app/build.gradle.kts` (SPEC §16 [VERIFY]) |
