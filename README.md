# Mish Ana! (مش أنا!)

A social-deduction word party game for **Android TV**, for 3–12 players. The TV is the shared screen. Each player joins on their phone by scanning a QR code; no app install is needed. Everyone gets a secret word, except the **Undercover**, who has a slightly different one, and the **Blank**, who has none. Players take turns giving one-word clues, vote someone out, and try to find out who is "not me". Available in English, French and Arabic (RTL), with Lebanese word packs.

- **TV:** a Kotlin + Jetpack Compose for TV app (`tv-app/`). For development there is also a browser TV mock at `/tv`.
- **Phones:** a small Preact web controller (`web-client/`), about 49 KB gzip.
- **Server:** a Cloudflare Worker with one Durable Object per room (`server/`, using partyserver). It is authoritative: it runs the pure game engine from `shared/` and sends each client only its own projection of the state.

## Quick start (local LAN)

Requirements: Node ≥ 22.12 and pnpm 10.28 (`corepack enable`). Put the computer, the phones and the TV on the same Wi-Fi.

```sh
pnpm i && pnpm dev
```

`pnpm dev` starts `wrangler dev` (Worker + Room DO, port **8787**) and Vite (phone UI with hot reload, port **5173**). Both listen on `0.0.0.0`. It then prints the URLs to use:

```
TV server URL: http://<lan-ip>:8787   (Android TV: -PserverUrl=http://<lan-ip>:8787)
Phone/TV-mock: http://<lan-ip>:5173/tv
```

Open `http://<lan-ip>:5173/tv` on a laptop or a TV browser to host a room without the Android app. Phones scan the QR code or open `http://<lan-ip>:5173/ABCD`.

### LAN notes

- **Wrong IP picked** (VPN, Docker or VM adapters): `cp .env.example .env` and set `LAN_HOST=192.168.x.y`.
- **Phones cannot connect:** allow inbound TCP 8787 and 5173 in the OS firewall. Router "client/AP isolation" must be off (guest networks usually have it on). Turn off mobile data on the phone.
- **403 on the WebSocket:** the page was opened through a host name that is not in `ALLOWED_ORIGINS`. `pnpm dev` allows `http://<lan-ip>:5173` and `http://localhost:5173`.
- **Reset local rooms:** delete `server/.wrangler/state`.

More detail is in [docs/DEV.md](docs/DEV.md).

## Android TV app

Full guide: **[docs/TV.md](docs/TV.md)**. It covers the Gradle wrapper setup, the emulator, pairing a real TV over Wi-Fi, logs and troubleshooting. The essentials:

```sh
cd tv-app
gradle wrapper --gradle-version 9.6.0                     # once (no wrapper jar is committed)
./gradlew :app:installDebug -PserverUrl=http://<lan-ip>:8787
adb shell am start -n app.mishana.tv/.MainActivity

# Real TV over Wi-Fi
adb pair <tv-ip>:<pairPort>        # Android TV 13+: Developer options → Wireless debugging → pair with code
adb connect <tv-ip>:<port>
# Android TV ≤12: adb tcpip 5555 (once over USB), then adb connect <tv-ip>:5555

# Emulator (Google TV AVD, API 34+): the host machine is 10.0.2.2
./gradlew :app:installDebug -PserverUrl=http://10.0.2.2:8787

./gradlew :app:testDebugUnitTest :app:assembleDebug       # CI-style check
```

The arrow keys are the D-pad, Enter is OK and Esc is Back.

## Repository layout

```
shared/          @mishana/shared: pure game engine (reducer, roles, votes, win, scoring, Arabic-aware guess
                 normalisation, invariants), zod wire protocol, per-client projections, i18n JSON, protocol fixtures
server/          @mishana/server: Cloudflare Worker + Room Durable Object (partyserver), rate limits, tokens
web-client/      @mishana/web-client: Preact phone controller + browser TV mock (/tv), Playwright e2e in e2e/
tv-app/          Android TV app (Kotlin, Compose for TV, OkHttp WebSocket, kotlinx.serialization)
word-packs/      @mishana/word-packs: EN / FR / AR (+ Lebanese) word-pair packs
tools/
  dev.mjs        `pnpm dev` (wrangler + vite on the LAN)
  sim/           headless game simulator (in-process, or over WebSocket against a running server)
  gen-android-strings/  shared/i18n → tv-app res/values*/strings_generated.xml
  gen-sounds/    synthesised sound cues → web-client/public/sounds + tv-app res/raw (OGG)
  pack-lint/     word-pack linter
assets/brand/    logo and brand assets
docs/            SPEC.md (binding contract), DESIGN.md (visual/UX spec), PLAN.md, RESEARCH.md, DEV.md, TV.md
```

## Scripts (repo root)

| Command | What it does |
|---|---|
| `pnpm dev` | LAN dev stack: wrangler :8787 + Vite :5173 |
| `pnpm lint` | ESLint over the whole repo |
| `pnpm typecheck` | `tsc` in every package |
| `pnpm test` | Vitest across all projects (engine, server, web-client, packs, tools) |
| `pnpm test:coverage` | the same, with v8 coverage (engine ≥ 90% branches) |
| `pnpm build` | web-client production build + Worker dry-run bundle, each checked against its size budget (phone JS 60 KB gzip, Worker script 400 KB) |
| `pnpm sim` | simulate 200 games per player count from 3 to 12 and check invariants, termination and secrecy (`--ws http://host:8787` plays over the real protocol) |
| `pnpm e2e` | Playwright: builds the web client, starts `wrangler dev` on :8788, then a TV mock and 5–6 browser phones play full games (two of them drive the TV mock with the keyboard D-pad, OK and Back only) |
| `pnpm fixtures` | regenerate `shared/fixtures/*.json` (the TS ↔ Kotlin protocol contract) |
| `pnpm gen:strings` | regenerate the Android string resources from `shared/i18n` |
| `pnpm lint:packs` | lint the word packs |
| `pnpm gen:sounds` | re-render the synthesised sound cues (needs ffmpeg with libvorbis) |
| `pnpm deploy` | build, then `wrangler deploy` |

## Status

| Milestone | Scope | Status |
|---|---|---|
| **M1** Engine + server | shared engine, protocol, projections, Worker + Room DO, sim | **Done.** `pnpm test` green, `pnpm sim` 3–12 players with zero invariant, termination or leak failures, resume tokens |
| **M2** Phone client + TV mock | Preact controller, browser TV mock, wake lock, reconnect | **Done.** 49.1 KB gzip (budget 60). Playwright e2e plays full games (EN and AR/RTL, remote-only TV in EN and AR, tie-break → revote → Blank guess → results → play again, reload resume, dropped-socket reconnect) and checks that no secret reaches the TV over WebSocket. Not yet tried on a real phone on a LAN |
| **M3** Android TV app | Compose for TV screens, D-pad flow, QR lobby, reconnects | **Code complete, not device-tested.** The protocol models, socket, ViewModel and lobby metrics pass 86 JVM unit tests against the shared fixtures (including the sound-cue mapping and mute). The UI type-checks against stubs. The APK has not been built here because Google Maven / the Android SDK were unavailable; see docs/TV.md |
| **M4** i18n + packs + polish | FR/EN/AR + RTL, packs, sounds, motion | **Done** (except on-device checks). All three locales on phone and TV, with motion and reduced-motion fallbacks. **Sounds done:** 26 original cues synthesised by `pnpm gen:sounds` (OGG, `tv-app/app/src/main/res/raw` and `web-client/public/sounds`), played through SoundPool on the TV and Web Audio in the `/tv` mock, with remote feedback cues (move / OK / Back) and one global mute in Settings and the pause menu (persisted). Packs: EN 217, FR 215, AR 131 pairs (50 Lebanese), lint-clean; review/"draft" warnings remain. **Pending:** AR RTL screenshot checks and sound levels on a real TV |
| **M5** Play Store readiness | banners, signing, prod deploy, listing | Not started. Banners exist. The production server URL is wired and documented but still a **placeholder** (see [Production configuration](#production-configuration)); release builds refuse to build until it is set |

## Production configuration

No real domain is committed. Before shipping, set these (details: [docs/DEV.md → Production URLs](docs/DEV.md#production-urls), [docs/TV.md → Production server URL](docs/TV.md#production-server-url)):

| What | Where | Ships as | Set to |
|---|---|---|---|
| TV app server (`BuildConfig.SERVER_URL`) | `mishana.prodServerUrl` in `tv-app/gradle.properties`, or `-PserverUrl=` | placeholder `https://mish-ana.example.workers.dev`; `assembleRelease`/`bundleRelease` fail until it is replaced with an `https://` URL | the Worker origin `pnpm deploy` prints (`https://mish-ana.<your-subdomain>.workers.dev`) or your custom domain |
| Phone join URL in the QR code | `JOIN_BASE_URL` in `server/wrangler.jsonc` `vars` | `""` (the origin the TV called) | leave empty on `workers.dev`; `https://<your-domain>` with a custom domain |
| Extra browser origins | `ALLOWED_ORIGINS` in `server/wrangler.jsonc` `vars` | `""` (same-origin only) | leave empty unless the phone page is hosted on another origin |

The phone client itself has no URL setting: the Worker serves it and it connects back to its own origin.

## License

See [THIRD_PARTY.md](THIRD_PARTY.md) for third-party notices (fonts, libraries).
