# TV app — build, install, debug

The Android TV app lives in [`/tv-app`](../tv-app). It is a single-module Gradle project (`:app`, package `app.jamaa.tv`, launcher name **JAMAA**) written in Kotlin with Compose for TV. JAMAA is the multi-game TV party platform (JAMAA-PLATFORM §0); game #1 follows SPEC.md. The app creates a room on the server, shows the QR code and room code, and is the stage for the whole game (SPEC §9, DESIGN §7).

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
2. `jamaa.prodServerUrl` in `tv-app/gradle.properties` (a placeholder until you deploy; see [Production server URL](#production-server-url)), else
3. `https://play.example.workers.dev` (the same placeholder).

Build and install a debug APK against your Mac's dev server:

```sh
cd tv-app
./gradlew :app:assembleDebug :app:installDebug -PserverUrl=http://<mac-ip>:8787
adb shell am start -n app.jamaa.tv/.MainActivity
```

**Test TVs with a build from before the rename:** the application id changed to `app.jamaa.tv` with the JAMAA rename (JAMAA-PLATFORM §1.4, §1.5), so the TV sees a new, separate app with empty data (new install id, default settings) and keeps the old one next to it. Remove the old build from each test TV once:

```sh
adb uninstall app.mishana.tv
```

Debug builds allow cleartext `http://` / `ws://` (a debug-only network security config). Release builds do not, so production must be `https://`.

### Production server URL

`tv-app/gradle.properties` ships a **placeholder**: `jamaa.prodServerUrl=https://play.example.workers.dev`. Before a release, replace it with your deployed Worker origin (the `https://play.<your-subdomain>.workers.dev` URL that `pnpm run deploy` prints, or your custom domain; no trailing slash, no path), or pass it per build:

```sh
./gradlew :app:bundleRelease -PserverUrl=https://<your-worker-origin>
# CI: ORG_GRADLE_PROJECT_serverUrl=https://<your-worker-origin> ./gradlew :app:bundleRelease
```

The phone join link in the QR code comes from the server, not from the app (`JOIN_BASE_URL`, see [DEV.md](DEV.md#production-urls)).

Release build (production URL from `gradle.properties`):

```sh
./gradlew :app:assembleRelease      # or :app:bundleRelease for Play (AAB)
```

Release builds are minified and resource-shrunk (R8). `preReleaseBuild` **fails** while the server URL is still the `example.workers.dev` placeholder, and when it is not `https://` (release builds allow no cleartext traffic); on success it logs `JAMAA release server URL: …`. The Compose compiler treats the protocol models as stable (`app/compose-stability.conf`), so unchanged parts of a broadcast skip recomposition.

The app appears in the TV launcher's apps row as **JAMAA** (Arabic: «جماعة») with its banner (`res/drawable/banner.xml`: the ring mark + the JAMAA wordmark; `drawable-ar/` mirrors it with «جماعة»). The banner, the adaptive launcher icon (`mipmap-anydpi-v26/ic_launcher.xml`: background, foreground and the Android 13 monochrome layer) and the in-app mark (`drawable/ic_mark.xml`) are generated by `assets/brand/scripts/gen_brand.py` (see [assets/brand/README.md](../assets/brand/README.md)); do not edit them by hand.

### Release signing

Play App Signing holds the app signing key; we only keep an **upload key**. `app/build.gradle.kts` signs release builds with it when it finds a properties file (never committed): `-PsigningProps=/path/to/keystore.properties`, else `~/.jamaa-keys/keystore.properties`:

```properties
storeFile=/home/<you>/.jamaa-keys/upload.jks
storePassword=…
keyAlias=upload
keyPassword=…
```

Create one with `keytool -genkeypair -keystore upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000`. Without the file, release builds are unsigned. If the upload key is lost, request an upload-key reset in Play Console (Setup → App signing). Back up `~/.jamaa-keys/` somewhere safe and offline.

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

Then install as above. To see logs: `adb logcat | grep -i jamaa`.

## Unit tests

```sh
cd tv-app
./gradlew :app:testDebugUnitTest
```

Fixtures are read from `../../shared/fixtures` relative to the unit-test working directory (`tv-app/app`). Override with `JAMAA_FIXTURES=/abs/path/to/shared/fixtures`. The tests cover: protocol fixtures (decode + re-encode + deep asserts), client encoding, reconnect policy, heartbeat (virtual time), the WebSocket client (MockWebServer), QR module size, the ViewModel (fake socket + Turbine), countdowns, settings stepping, the action pill (arming, and the guard that ignores OK presses carried over from a skipped reveal), the colour table, the view diff behind the join / leave / away / forfeit / skipped-turn toasts, the optimistic settings draft (debounce, echo, late echo), the elimination sequence plan (flights, budget, what follows: next round / last chance / end), the lobby metrics (the widest room code and a long join host fit the 264 dp column at the smallest fit-to-width size, measured with the bundled Cairo fonts), and the brand (the JAMAA name, the generated wordmark geometry: three heads inside the letters, both wordmarks inside their artboards, the lobby wordmark inside its 58 dp height budget; the launcher icon layers and banners are the generated JAMAA art).

The JAMAA platform tests (`app/src/test/java/app/jamaa/tv/platform/`, JAMAA-PLATFORM §6.4 acceptance 6) cover: the v2 fixtures (`shared/fixtures/v2`), envelope decoding through `GameDecoders` including an unknown `gameId` (the "Update JAMAA" card), the hello `games` list (`GameDecoders.supported()`), the hub focus graph and the debounced `HUB_FOCUS`, the input rule (OK completes a choreography, the 300 ms guard, key-repeat never activates), the overlay back stack (rules from the pause menu close to the game; a host dialog closes the rules sheet), the first-time intro flow and the `intro_seen_<gameId>` prefs, the setup column (≤ 4 rows, timer presets), the back-hint timing, the trial badge and yearly saving, the lite/calm-motion decision, and parity of the generated `Choreo.kt` sampler, `CharacterPaths.kt` and `WorldColors.kt` with the shared fixtures.

Full CI-style check on a Mac: `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

**Without Google Maven** (the authoring sandboxes): two harnesses outside the repo stand in. A pure-JVM Gradle project compiles the non-UI Kotlin against small Android stubs and runs every JVM test above; a second one type-checks **all** of `tv-app` (Compose UI included) against Compose Multiplatform desktop 1.8.2 (same `androidx.compose.*` packages, from Maven Central) plus hand-written stubs that mirror the `androidx.tv.material3`, `android.*`, activity, appcompat and lifecycle signatures the app uses (`PlayBillingGateway.kt` is the only file left out). Neither replaces `assembleDebug`, R8, lint or a device run.

Before the first Mac build, check the layouts listed in DESIGN §11 on a device or emulator: 12 players in English and Arabic, at the 1.3× system font scale, on TV-02 (lobby), TV-04 (role reveal), TV-05 (clues: order strip), TV-06 (vote grid) and TV-11 (results). These sandboxes had no Android SDK, so no screenshot tests (Paparazzi/Roborazzi) run here.

## Remote-only checks on a device

The app must be fully usable with the remote alone (D-pad, OK, Back; sometimes an air-mouse). There is no instrumented test suite yet (it needs the Android SDK and Google Maven, which the authoring sandboxes did not have); before a release, walk through these on a TV or a Google TV AVD:

- Every screen has a visible focused element on arrival, and Up/Down/Left/Right never leave focus on nothing. Back works everywhere (JAMAA-PLATFORM §3.1): hub → "Close JAMAA?" (focus on **Stay**); setup → the hub (reverse portal); Advanced settings rows → categories → setup; in a game or on Results → the pause menu; inside any dialog, sheet or panel → closes it.
- The platform flow with the remote only: launch → hub (focus on the last played game, else Mish Ana!) → Left/Right through the posters (wraps, mirrored in Arabic; phones follow after a short rest) → Up always reaches ⓘ → Down reaches the members strip (OK → Kick / Cancel). OK on a poster plays the portal; pressing OK three times quickly ends on the setup, never in a game. First visit of a game on this TV: the full-screen How to play (OK next, Back skip, "Got it" on the last card); Settings → Show how-to again brings it back. Start → world entrance → game → results → Play again / Change settings / Other games.
- ⓘ rules: the hub top-bar ⓘ shows the focused game's rules and "How JAMAA works"; the setup ⓘ and the results ⓘ show that game's rules; in a game, Back → Rules → Back returns straight to the game, and the timers keep running while the sheet is open. The **INFO** key (and MENU / the coloured PROG keys) opens the sheet on any screen when the remote has one [VERIFY per reference remote: most Google TV and Chromecast remotes have no INFO key; note here which test remotes send `KEYCODE_INFO`]. During round 1 and for 3 s after each phase change the in-game hint "◁ Back: menu & rules" shows at the top end.
- Input lock: while the portal, entrance or cup animation plays, the D-pad does nothing and OK only jumps it to its end; for 300 ms after any transition OK and the D-pad are ignored; holding a key (key-repeat) moves focus but never presses a button.
- Overlays keep focus inside: open the pause menu, a kick or end-game confirm, the language list, the packs/difficulty panels, and the connection-lost screen; the D-pad must never reach the screen behind. Let a listed player leave while the pause menu's Players… page or a kick confirm is open: focus stays in the overlay and the confirm closes.
- Focus comes back to where it was: pause menu → Players… → Back returns to Players…; cancelling a kick returns to that player's row; cancelling the guess override returns to its button; pausing from the verdict's Continue pill and resuming returns to Continue. Down on the last Settings row stays put (it never jumps to a lower category). Settings → About (last category) has nothing focusable: focus stays on the category, which shows the version and install id.
- Mash OK through the vote reveal into the next clue turn: the new speaker's turn is never skipped (the pill ignores OK briefly after a phase or speaker change). On Results, a double OK does not trigger Play again before the summary has shown. On the Results summary, players with equal totals share a rank (every rank-1 row has the trophy), and 4 score rows stay fully visible in English and Arabic.
- Air-mouse: hovering a control focuses it; clicks on a dimmed area under any dialog or scrim do nothing; both Settings chevrons step values. **Check that a pointer click (BUTTON_PRIMARY) on tv-material Surfaces activates them** (buttons, tiles, rows). If it does not on your remote, add a tap handler next to `JamaaFocusSurface` (one place) rather than per screen.
- Performance: on a low-end stick (e.g. Chromecast HD), the idle lobby and the clue timer should not keep the GPU busy (no per-frame recomposition: check with the Layout Inspector's recomposition counts). A baseline profile (`androidx.baselineprofile` + a Macrobenchmark walking Home → Lobby → Reveal → Clues → Vote → Elimination → Results with D-pad events) is the next step for first-launch smoothness.

## Platform (hub, setup, games)

Where things are (`app/src/main/java/app/jamaa/tv/`):

| Path | Role |
|---|---|
| `ui/AppRoot.kt` | Routes `room.phase` (HUB → `ui/hub/HubScreen`, SETUP → `ui/setup/SetupScreen`, PLAYING → `games/GameScreens`), passes every key through the input rule (`platform/InputGate.kt`), maps INFO/MENU to the ⓘ sheet, draws the local overlays, moments, the Pass store and the connection states |
| `platform/*.kt` | Pure, JVM-tested models: hub and setup focus graphs, setup rows, the intro flow, the overlay back stack, pause-menu rows, moments, characters' expressions, motion mode |
| `games/GameDecoders.kt`, `games/GameScreens.kt` | gameId → decoder and → screen. A game this build cannot draw (unknown id, a stub, a decode failure) shows "Update JAMAA to play this game" with a way back to the hub. The hello declares only implemented games (`GameDecoders.supported()`) |
| `games/mishana/` | Mish Ana! inside the platform: its envelope decoder and the existing screens fed from it |
| `ui/characters/` | The Canvas character renderer over the generated `CharacterPaths.kt` (do not edit; `pnpm gen:characters`) |
| `motion/Choreo.kt`, `ui/theme/WorldColors.kt` | Generated (lane D): the choreography steps + sampler and the world palettes |

Per-device prefs (SharedPreferences `jamaa_prefs`, shared with the mute setting): `intro_seen_<gameId>` and **Calm animations** (hub Settings), which with a system animator scale of 0 or a low-RAM device selects reduced or lite motion.

## Sound

The 44 platform cues (the 26 of DESIGN §6.4 plus the 18 JAMAA cues of JAMAA-PLATFORM §3.11: hub move, portal open/close, the four world stings, coin flight and landing, counter tick, crown drop, cup star, reaction pop, answer lock, truth reveal, "the house got you", quiz correct/wrong) are original synthesis rendered by `pnpm gen:sounds` into `app/src/main/res/raw/*.ogg` (and `web-client/public/sounds` for the `/tv` mock); each game's own cues are `res/raw/<gameId>_*.ogg`, generated with that game's `SoundCues<Id>.kt`. The app plays them through `SoundPool` on two buses (SFX, Stingers), plus quiet remote feedback for D-pad moves, OK and Back. One global mute lives in Settings and in the pause menu; it is persisted, muting stops what is ringing and unmuting confirms with the OK tick. Check levels on the real TV speakers before release.

## Billing: premium and packs

The TV is the only place anything is sold (PAYMENTS-SPEC rev 4, JAMAA-PLATFORM §4): the **JAMAA Pass** subscription (`jamaa_pass`, base plans `monthly` and `yearly`, a 7-day free trial offer `trial-7d` for eligible accounts) and the one-time `pack_<family>` packs, through **Google Play Billing Library 9.1.0** (`com.android.billingclient:billing`, no `billing-ktx`). Everything is behind the server's `BILLING_ENABLED`: with it off the TV shows no Pass button, no store, no install id, and every setting and game is open. The server verifies every purchase, acknowledges it, and returns a signed entitlement token; the TV never acknowledges or consumes anything itself.

**Where things are** (`app/src/main/java/app/jamaa/tv/`):

| Path | Role |
|---|---|
| `billing/BillingRepository.kt` | Process-wide orchestration: restore on start / `ON_START` / `ON_RESUME`, `/api/billing/verify` and `/entitlement`, the in-room refresh timer, the Store state machine, billing toasts |
| `billing/PlayBillingGateway.kt` | The only file that touches Play Billing (one `BillingClient` per process, auto-reconnect, pending one-time purchases enabled) |
| `billing/StoreModel.kt`, `billing/OfferSelection.kt`, `ui/screens/StoreScreen.kt` | HUB-08, the Pass store overlay (HUB or SETUP only): Yearly and Monthly plan cards (trial badge, "Save n%", the disclosure of the focused plan), the active state (renews / ends on, **Manage subscription**), the payment-problem state (**Fix payment**), packs by game, Restore, room code in the header |
| `billing/EntitlementStore.kt`, `billing/InstallId.kt` | SharedPreferences `jamaa_billing` (install id, last entitlement). Excluded from backup and device transfer (`res/xml/backup_rules.xml`, `data_extraction_rules.xml`). The install id is shown in Settings → About (groups of four) so the owner can comp the TV with `pnpm grant` (PAYMENTS-SPEC §3.12, docs/DEV.md "Admin grants") |
| `src/debug/…/FakeBillingGateway.kt` | The server's fake test store (debug builds only; a release APK does not contain it) |

**Entry points (remote only):** the hub's **JAMAA Pass** button in the top bar (only when billing is on and the room has no Pass), a locked pack in a setup pack picker ("Pass"), and a locked premium setting row (OK opens the Store). The results screen shows at most one soft line ("Love it? JAMAA Pass unlocks every pack.") from the second finished game on. Back closes the Store and returns focus to the control that opened it. While the Store or the Play purchase sheet is up, the TV sends `storeOpen` so a phone cannot start a game behind it.

### Fake billing (debug builds, no Play account needed)

1. Run the server with fake billing: `pnpm dev` (it passes `BILLING_MODE=fake` and `ALLOW_FAKE_BILLING=1`; the Worker only honours them on `localhost`/LAN hosts).
2. Open the debug settings (splash screen → long-press OK on the version label), set the server URL to your Mac (`http://<mac-ip>:8787`), switch **Billing: Fake (server test store)** on, then Done. The dialog checks `GET /api/billing/catalog`: "Server is in Google mode" means the toggle is ignored and Google Play is used.
3. On the hub open **JAMAA Pass**: the Store shows the banner "Test store: no real payments" and the server's synthetic prices (the Yearly and Monthly plans, with the trial badge when the fake account is eligible, and the packs). OK on a plan or a pack opens a **Fake purchase** dialog: *Approve* (purchased), *Pending* (the pending chip; complete it from the server with `POST /api/billing/fake/set`, then open the Store or use Restore purchases), *Cancel* (USER_CANCELED, silent) or *Error* (generic error toast).
4. Fake purchase tokens are remembered in the debug prefs (`jamaa_debug` / `fake_purchases`), so **Restore purchases** and app restarts behave like Play. Clearing the app's data starts over (new install id).
5. To test expiry and refunds, use the `/tv` mock's test controls or `POST /api/billing/fake/set {purchaseToken, state}` (see [DEV.md](DEV.md)); the TV picks the change up on its next refresh (open the Store, resume the app, or wait for the in-room timer).

### Google Play testing (license testers)

Real Play Billing only works for an app **installed from Play** (internal or closed testing track) by an account the console knows; a sideloaded debug APK gets `BILLING_UNAVAILABLE` or `ITEM_UNAVAILABLE` [VERIFY on your device].

1. Play Console → Settings → **License testing**: add the testers' Gmail addresses. Upload a release AAB to **Internal testing** and create the products (PAYMENTS-SPEC §8.B).
2. On the TV, sign in to Google Play with a license tester account (Settings → Accounts), accept the internal test link from a phone or computer, and install from Play.
3. `jamaa_pass` is a subscription (base plans `monthly` and `yearly`, offer `trial-7d`); the packs are one-time in-app products. Play's test subscriptions renew on a compressed clock (minutes, not months), which is how to see a renewal, a cancellation and the end of a trial quickly. An **unacknowledged** test purchase is refunded after about 3 min: if purchases keep vanishing, the server is not acknowledging (check the Worker logs for `BILLING_ACK_*`).
4. Test cards: "Test card, always approves", "always declines", and "slow test card, approves/declines after a few minutes" (the last one exercises the **Payment pending** state).
5. Walk PAYMENTS-SPEC §8.E: start the Pass with the trial → the room becomes a Pass room without a new code; slow card → pending → unlocks later; let a test subscription lapse mid-game → the game finishes, then the restriction applies ("JAMAA Pass has ended…"); a declined renewal → the store shows **Fix payment**; refund a pack in Play Console → it disappears; Restore purchases on a second TV. **Manage subscription** and **Fix payment** open the Play subscriptions page for `jamaa_pass`; when the TV cannot open it, the store shows the path as text instead.

### What to check on a device (not covered by the JVM tests)

- The Store at 960×540 dp in EN, FR, AR and ES: the two plan cards (trial badge, "Save n%", the focused plan's disclosure) fit above the packs row without scrolling, and focus starts where §4.4 says (the Yearly plan, or the pack you came from). `StoreLayoutFitTest` checks the arithmetic with the Cairo metrics; a Compose screenshot test (Paparazzi/Roborazzi) of `StoreScreen` is still to add.
- The hub top bar in all four languages (wordmark, cup chip, ⓘ, JAMAA Pass, Settings) and the members strip with 12 members.
- `BILLING_UNAVAILABLE`: sign out of Google Play (or use a kids profile), open the Store → "To buy on this TV, sign in to Google Play…" with a single OK; locked rows read "Locked". Sign back in, leave and reopen the app: the Store works again.
- The merged manifest contains `com.android.vending.BILLING` (`./gradlew :app:processDebugManifest`, then look in `app/build/intermediates/merged_manifest/`) [VERIFY].

**JVM tests** (`./gradlew :app:testDebugUnitTest`): `ProductsTest`, `OfferSelectionTest`, `BillingErrorsTest`, `EntitlementApiTest` (MockWebServer), `BillingRepositoryTest` (fake gateway + fake API, virtual time), `StoreFocusTest`, `BillingNoticesTest`, `GameViewModelBillingTest`, `LobbyBarFitTest`, `StoreLayoutFitTest`, plus the billing fixtures in `ProtocolFixturesTest` and `ClientEncodingTest`.

## Debug server override

Debug builds only: on the splash screen, focus the small version label at the bottom end and **long-press OK**. The Debug settings dialog stores a server URL in SharedPreferences `jamaa_debug` / `server_url`; blank means `BuildConfig.SERVER_URL`. Saving creates a new room on that server. Release builds always use `BuildConfig.SERVER_URL`. The same dialog holds the **Billing: Google Play / Fake** toggle ([Fake billing](#fake-billing-debug-builds-no-play-account-needed)).

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
| Text taller than designed; labels clipped (e.g. the lobby's bottom buttons show only the top half of their text) | Android 13+ never makes a line shorter than the font's ascent + descent (fallback line spacing, which Compose cannot turn off), and stock Cairo's are 1.874 em, so every `lineHeight` in `JamaaType` was ignored. The bundled fonts carry tightened metrics (880 / −180) so the line heights apply again. If you replace the font files, re-run `python3 tv-app/scripts/tighten_cairo_metrics.py` (needs `pip install fonttools`) |
| Store says "To buy on this TV, sign in to Google Play…" | Play reported `BILLING_UNAVAILABLE`: no Google account on the TV, a kids profile, or the app was not installed from Play. Sign in, then leave and reopen the app (it retries on the next start). For local testing use the fake store |
| Store shows "The store isn't available right now" | The catalog or Play product query failed or took over 10 s. Try again; check `curl http://<server>/api/billing/catalog` |
| A test purchase disappears after a few minutes | It was never acknowledged (license-tester auto-refund after 3 / 5 min). The server acknowledges: check its Play API credentials and logs |
| AGP/Kotlin DSL error on `compileSdk` | AGP 9 may prefer `compileSdk { version = release(37) }`; switch the line in `app/build.gradle.kts` (SPEC §16 [VERIFY]) |
