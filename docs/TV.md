# TV app — build, install, debug

The Android TV app lives in [`/tv-app`](../tv-app). It is a single-module Gradle project (`:app`, package `app.mishana.tv`) written in Kotlin with Compose for TV. It creates a room on the server, shows the QR code and room code, and is the stage for the whole game (SPEC §9, DESIGN §7).

Contents: [Prerequisites](#prerequisites) · [First-time setup](#first-time-setup-gradle-wrapper) · [Build and install](#build-and-install) · [Emulator](#emulator-google-tv-avd) · [Real TV (TCL)](#real-tv-tcl-google-tv--android-tv) · [Unit tests](#unit-tests) · [Debug server override](#debug-server-override) · [Troubleshooting](#troubleshooting)

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

`tv-app/gradle.properties` ships a **placeholder**: `mishana.prodServerUrl=https://mish-ana.example.workers.dev`. Before a release, replace it with your deployed Worker origin (the `https://mish-ana.<your-subdomain>.workers.dev` URL that `pnpm deploy` prints, or your custom domain; no trailing slash, no path), or pass it per build:

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

## Debug server override

Debug builds only: on the splash screen, focus the small version label at the bottom end and **long-press OK**. The Debug settings dialog stores a server URL in SharedPreferences `mishana_debug` / `server_url`; blank means `BuildConfig.SERVER_URL`. Saving creates a new room on that server. Release builds always use `BuildConfig.SERVER_URL`.

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
| AGP/Kotlin DSL error on `compileSdk` | AGP 9 may prefer `compileSdk { version = release(37) }`; switch the line in `app/build.gradle.kts` (SPEC §16 [VERIFY]) |
