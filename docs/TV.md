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
2. `mishana.prodServerUrl` in `tv-app/gradle.properties` (the production `*.workers.dev` URL), else
3. `https://mish-ana.example.workers.dev`.

Build and install a debug APK against your Mac's dev server:

```sh
cd tv-app
./gradlew :app:assembleDebug :app:installDebug -PserverUrl=http://<mac-ip>:8787
adb shell am start -n app.mishana.tv/.MainActivity
```

Debug builds allow cleartext `http://` / `ws://` (a debug-only network security config). Release builds do not, so production must be `https://`.

Release build (production URL from `gradle.properties`):

```sh
./gradlew :app:assembleRelease      # or :app:bundleRelease for Play (AAB)
```

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

Fixtures are read from `../../shared/fixtures` relative to the unit-test working directory (`tv-app/app`). Override with `MISHANA_FIXTURES=/abs/path/to/shared/fixtures`. The tests cover: protocol fixtures (decode + re-encode + deep asserts), client encoding, reconnect policy, heartbeat (virtual time), the WebSocket client (MockWebServer), QR module size, the ViewModel (fake socket + Turbine), countdowns, settings stepping, the action pill, and the colour table.

Full CI-style check on a Mac: `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

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
