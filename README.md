# JAMAA (جماعة)

**JAMAA** (Arabic for "the gang, the gathering") is a party-games platform for **Android TV and Google TV**, for 3–12 players. The TV is the shared screen. Each player joins by scanning a QR code with their phone and plays in the phone's browser, so nobody installs anything on a phone. JAMAA has four languages: English, French, Arabic (fully right-to-left) and Spanish.

One TV session is one **room**. The room opens on a **hub** where the group picks a game. Each game has a short setup ("How to play", players, up to four settings), then one game runs at a time. Players, characters, the host and the night's scores ("Tonight's cup") belong to the room, so the group can move from one game to the next without rejoining.

- **Binding platform spec:** [docs/JAMAA-PLATFORM.md](docs/JAMAA-PLATFORM.md) (rename, hub, game registry, protocol v2, JAMAA Pass, content system, lanes and build order). The visual spec is [docs/DESIGN-JAMAA.md](docs/DESIGN-JAMAA.md).
- **Strategy:** [docs/BLUEPRINT.md](docs/BLUEPRINT.md) (what we copy, what we never copy, pricing, roadmap), based on the evidence in [docs/JACKBOX-STUDY.md](docs/JACKBOX-STUDY.md).

## The games

| # | Game (id) | What it is | Spec | Status |
|---|---|---|---|---|
| G1 | **Mish Ana!** «مش أنا!» (`mishana`) | Social deduction with a secret word. Everyone gets the same word except the **Mole**, who gets none and has to bluff. A caught Mole gets one last guess at the word. Hosts can add an optional **Undercover**, who gets a slightly different word and doesn't know it. One-word clues, a vote, and "not me!" from everyone. Word packs in EN / FR / AR (with Lebanese packs) / ES | [SPEC.md](docs/SPEC.md) | **Built** (in `GAMES_ENABLED`) |
| G2 | **Bluff!** (`bluff`) | Everyone writes a fake answer to a real prompt (Lebanese proverbs, word meanings, expressions), then votes for the one they think is true. You score for finding the truth and for every player your lie fools. The final round has no true answer | [GAME-BLUFF.md](docs/GAME-BLUFF.md) | **Built** (in `GAMES_ENABLED`); content is draft pending native review |
| G3 | **Most Likely** «مين فينا؟» (`likely`) | "Who's most likely to…?" Everyone votes for a player in the room with one tap. You score for reading the room. Anonymous mode available | [GAME-LIKELY.md](docs/GAME-LIKELY.md) | **Built** (in `GAMES_ENABLED`); content is draft pending native review |
| G4 | **Quiz Night** «سهرة أسئلة» (`trivia`) | Speed trivia with streaks, played on a colour + shape + letter answer pad. The first quiz is "Lebanon: the big quiz" (`lb-quiz-01`), which is free | [GAME-TRIVIA.md](docs/GAME-TRIVIA.md) | **Built** (in `GAMES_ENABLED`); content is draft pending native review |

Every game is **free to play** with starter content. The display names above are working titles until the name clearance (BLUEPRINT §9 D4). All four games are in `GAMES_ENABLED`. Content is still `draft` until native review, so deploy with `pnpm run deploy:preview` (the strict `pnpm run deploy` refuses drafts).

## How it is built

- **TV:** a Kotlin + Jetpack Compose for TV app (`tv-app/`, application id `app.jamaa.tv`). For development there is also a browser TV at `/tv`, which works the same way with the keyboard as the remote.
- **Phones:** a small Preact web controller (`web-client/`), about 53 KB gzip. Each game's screens load lazily.
- **Server:** a Cloudflare Worker with one Durable Object per room (`server/`, using partyserver; Worker name `play`). The server is authoritative. It runs the pure engines from `shared/` and sends each client only its own view of the state, so secrets never reach the TV or other phones.
- **JAMAA Pass:** an optional subscription (`jamaa_pass`, monthly or yearly, with a 7-day free trial) that unlocks every pack of every game, current and future. One-time `pack_<family>` packs are also sold. Everything is sold **on the TV only**, through Google Play Billing, and verified by the server. Phones never show a price. Everything is behind `BILLING_ENABLED` (see [Switches](#switches-billing_enabled-and-games_enabled)).

## Quick start (one command, local LAN)

Requirements: Node ≥ 22.12 and pnpm 10.28 (`corepack enable`). Put the computer, the phones and the TV on the same Wi-Fi.

```sh
pnpm i && pnpm dev
```

`pnpm dev` starts `wrangler dev` (Worker + Room DO, port **8787**) and Vite (phone UI with hot reload, port **5173**). Both listen on `0.0.0.0`, and fake billing is on. It then prints the URLs to use:

```
TV server URL: http://<lan-ip>:8787   (Android TV: -PserverUrl=http://<lan-ip>:8787)
Phone/TV-mock: http://<lan-ip>:5173/tv
```

To host a room without the Android app, open `http://<lan-ip>:5173/tv` on a laptop or in a TV browser. Phones scan the QR code or open `http://<lan-ip>:5173/ABCD`.

### LAN notes

- **Wrong IP picked** (VPN, Docker or VM adapters): `cp .env.example .env` and set `LAN_HOST=192.168.x.y`.
- **Phones cannot connect:** allow inbound TCP 8787 and 5173 in the OS firewall. Router "client/AP isolation" must be off (guest networks usually have it on). Turn off mobile data on the phone.
- **403 on the WebSocket:** the page was opened through a host name that is not in `ALLOWED_ORIGINS`. `pnpm dev` allows `http://<lan-ip>:5173` and `http://localhost:5173`.
- **Reset local rooms:** delete `server/.wrangler/state`.

More detail: [docs/DEV.md](docs/DEV.md).

## Android TV app (`app.jamaa.tv`)

The full guide is **[docs/TV.md](docs/TV.md)**: Gradle wrapper setup, the emulator, pairing a real TV over Wi-Fi, logs and troubleshooting. The essentials:

```sh
cd tv-app
gradle wrapper --gradle-version 9.6.0                     # once (no wrapper jar is committed)
./gradlew :app:installDebug -PserverUrl=http://<lan-ip>:8787
adb shell am start -n app.jamaa.tv/.MainActivity

# Once, on test TVs that still have a build from before the rename (it is a separate app):
adb uninstall app.mishana.tv

# Real TV over Wi-Fi
adb pair <tv-ip>:<pairPort>        # Android TV 13+: Developer options → Wireless debugging → pair with code
adb connect <tv-ip>:<port>
# Android TV ≤12: adb tcpip 5555 (once over USB), then adb connect <tv-ip>:5555

# Emulator (Google TV AVD, API 34+): the host machine is 10.0.2.2
./gradlew :app:installDebug -PserverUrl=http://10.0.2.2:8787

./gradlew :app:testDebugUnitTest :app:assembleDebug       # CI-style check
./gradlew :app:bundleRelease                              # Play AAB (needs jamaa.prodServerUrl, see below)
```

On the emulator and in the `/tv` browser TV, the arrow keys are the D-pad, Enter is OK and Esc is Back. In the browser TV, `i` is the remote's INFO key.

## Deploy

| What | Command | Served at |
|---|---|---|
| Game server + phone page (Worker `play`) | `pnpm run deploy`: build, `content-lint --release`, `check-deploy.mjs` (Google billing, fake billing off, `PLAY_PACKAGE_NAME` = `app.jamaa.tv`, `GAMES_ENABLED` lists only known ids), then `wrangler deploy`. Always use `run`, because bare `pnpm deploy` is pnpm's built-in command | `https://play.jamaa.workers.dev` |
| Site (Worker `www`) | `cd growth/site && npx wrangler deploy` (runs `node build.mjs` first) | `https://www.jamaa.workers.dev` |

The release gate requires at least 40 pairs in each free Mish Ana! starter pack, so `pnpm run deploy` fails on purpose until that is true.

### Production configuration

| What | Where | Value |
|---|---|---|
| TV app server (`BuildConfig.SERVER_URL`) | `jamaa.prodServerUrl` in `tv-app/gradle.properties`, or `-PserverUrl=` | `https://play.jamaa.workers.dev` (valid once owner step O1 is done). Release builds refuse the `play.example.workers.dev` placeholder and any non-`https://` URL |
| Phone join URL in the QR code | `JOIN_BASE_URL` in `server/wrangler.jsonc` `vars` | `""` (the origin the TV called). Set `https://<your-domain>` only with a custom domain |
| Extra browser origins | `ALLOWED_ORIGINS` in `server/wrangler.jsonc` `vars` | `""` (same origin only) |
| Site origin, browser-version link, Play link | `growth/site/site.config.json` (`origin`, `browserUrl`, `playUrl`, `playStoreLive`) | `https://www.jamaa.workers.dev`, `https://play.jamaa.workers.dev/tv`, `…?id=app.jamaa.tv`, `false` until the Play listing is public |

The phone client has no URL setting: the Worker serves it and it connects back to its own origin. Details: [DEV.md → Production URLs](docs/DEV.md#production-urls), [TV.md → Production server URL](docs/TV.md#production-server-url).

## Switches: `BILLING_ENABLED` and `GAMES_ENABLED`

Both switches are Worker vars in `server/wrangler.jsonc`. Change one and redeploy with `pnpm run deploy`; no app update is needed.

| Var | Default | Effect |
|---|---|---|
| `BILLING_ENABLED` | `"0"` | `"0"`: no Pass or pack UI anywhere (TV, phone, `/tv`), `/api/billing/*` and `/api/admin/*` answer 404, crons do nothing, and every room plays the whole catalog. `"1"`: JAMAA Pass and packs are sold on the TV, and free rooms get only the free starter content. The deploy is then refused until the secrets `PLAY_SERVICE_ACCOUNT_JSON` and `ENTITLEMENT_KEYS` exist. Launch steps: [docs/BILLING-LAUNCH.md](docs/BILLING-LAUNCH.md) |
| `GAMES_ENABLED` | `"mishana,bluff,likely,trivia"` | Comma list of the live game ids. A room offers `GAMES_ENABLED` ∩ the games enabled in the registry ∩ the games the TV build can draw. Add `bluff`, then `likely`, then `trivia` as each game ships. Unknown ids fail `check-deploy.mjs` |

**When a game is turned on**, also update the README games table, the site and the store listings in the same release ([growth/marketing/play-store/LISTING.md](growth/marketing/play-store/LISTING.md) §0). When billing is turned on, swap in the billing copy from LISTING.md §4, Data safety §1.B and privacy policy Appendix B.

## Owner steps (outside the repo)

These are from JAMAA-PLATFORM §1.6. Only the owner can do them.

| # | Step | Where |
|---|---|---|
| O1 | **Rename the Cloudflare workers.dev subdomain `mishana` → `jamaa`.** This changes the URLs of every Worker on the account (`play.jamaa.workers.dev`, `www.jamaa.workers.dev`). **The Worker names `play` and `www` stay as they are**: renaming a Worker would create new Durable Object namespaces and lose the room and Billing DO data. Old `*.mishana.workers.dev` URLs stop working. If `jamaa` is taken, pick another subdomain and change the config points in O3 | Cloudflare dashboard → Workers & Pages → Overview → *Subdomain* → Change (check the label in the current dashboard) |
| O2 | (Recommended) Attach a custom domain to `play` and `www`. Shorter QR URLs scan better | Cloudflare → Workers → *play* / *www* → Settings → Domains & Routes |
| O3 | Point the config at the final origins: `tv-app/gradle.properties` `jamaa.prodServerUrl`, `growth/site/site.config.json` `origin` and `browserUrl`, `server/wrangler.jsonc` `JOIN_BASE_URL` (custom domain only) and `RTDN_AUDIENCE` | repo (lane A or E makes the edit; the owner supplies the values) |
| O4 | Create the Play app **JAMAA**, package `app.jamaa.tv` (Android TV form factor). Leave any `app.mishana.tv` draft unpublished. License testers, service-account access and RTDN are set up again for the new app | Play Console → Create app; [RELEASE-CHECKLIST.md](growth/marketing/play-store/RELEASE-CHECKLIST.md) |
| O5 | Create the products: subscription `jamaa_pass` with base plans `monthly` and `yearly` and a `trial-7d` offer on each. One-time packs come from the CSV printed by `pnpm --filter @jamaa/server billing:products`. Prices: [MONETIZATION.md §5.1](docs/MONETIZATION.md) | Play Console → Monetize |
| O6 | Redeploy both Workers (see [Deploy](#deploy)) | terminal |
| O7 | Delete `growth/marketing/release/mishana-tv-0.1.0-vc1.*` (built with the old package id), then `./gradlew :app:bundleRelease` | repo + terminal |
| O8 | (Optional) Rename the GitHub repo `bubble-graph` → `jamaa` | GitHub → Settings |
| O9 | Name clearance for "JAMAA" (Play search, EUIPO/INPI, USPTO, classes 9 and 41), and for the game names (BLUEPRINT §3.10, §9 D4) | IP counsel |

Billing also needs the Google Cloud service account, the RTDN Pub/Sub topic and the Worker secrets: see [PAYMENTS-SPEC §8](docs/PAYMENTS-SPEC.md#8-owner-setup-checklist-exact-steps).

## JAMAA Pass and packs (payments)

The binding design is [JAMAA-PLATFORM §4](docs/JAMAA-PLATFORM.md), on top of [docs/PAYMENTS-SPEC.md](docs/PAYMENTS-SPEC.md). The decision and the price recommendation are in [docs/MONETIZATION.md](docs/MONETIZATION.md). The server verifies and acknowledges every Google purchase, then gives the TV a signed entitlement token that the room checks. A room without a valid token is a free room: its packs list shows Pass content as locked, and no locked content is ever sent to its clients.

### Testing with fake billing (no Play account needed)

Fake billing is a test store inside the Worker. It is on only when **all** of these hold: `BILLING_MODE=fake`, `ALLOW_FAKE_BILLING=1`, no `PLAY_SERVICE_ACCOUNT_JSON`, and a request host of `localhost`, `127.0.0.1`, `[::1]` or a private IPv4 address. Otherwise the billing routes answer 503. `wrangler.jsonc` ships `google` / `0`, and `pnpm run deploy` refuses anything else.

1. `pnpm dev` (it passes the fake vars to `wrangler dev`).
2. **Browser TV:** open `http://<lan-ip>:5173/tv`, then open **JAMAA Pass** with the D-pad (arrow keys + Enter). The Store says "Test store: no real payments". Buying a plan or a pack is approved at once and the room unlocks without a new code. The Store footer has **Test controls** (*Expire Pass now*, *Refund pack*).
3. **Android TV app (debug build):** splash screen → long-press OK on the version label → set the server URL to `http://<lan-ip>:8787` and switch **Billing: Fake (server test store)** on. Details: [docs/TV.md → Billing](docs/TV.md). Release builds do not contain the fake gateway.
4. **From a shell:** see [docs/DEV.md → Fake billing](docs/DEV.md#fake-billing-local-dev-and-e2e).
5. **Automated:** `pnpm e2e` runs `web-client/e2e/payments.spec.ts` and `store-layout.spec.ts` with fake billing.

## Scripts (repo root)

| Command | What it does |
|---|---|
| `pnpm dev` | LAN dev stack: wrangler :8787 + Vite :5173 |
| `pnpm lint` | ESLint over the whole repo (except `growth/`, which has its own tooling) |
| `pnpm typecheck` | `tsc` in every package |
| `pnpm test` | Vitest across all projects (engines, room, server, web client, content, tools) |
| `pnpm test:coverage` | the same, with v8 coverage (engine ≥ 90 % branches) |
| `pnpm build` | web-client production build + Worker dry-run bundle, each checked against its size budget |
| `pnpm sim` | headless simulator: plays many games per player count and checks invariants, termination and secrecy (`--games N`, `--access free`, `--ws http://host:8787` plays over the real protocol) |
| `pnpm e2e` | Playwright: builds the web client, starts `wrangler dev` on :8788 with fake billing, then a TV mock and browser phones play full games (driven by keyboard D-pad, OK and Back only), plus the payments specs |
| `pnpm fixtures` | regenerate the protocol fixtures in `shared/fixtures/` (the TS ↔ Kotlin contract) |
| `pnpm gen:strings` | regenerate the Android string resources from `shared/i18n` |
| `pnpm lint:content` | lint the content packs (`lint:packs` is kept as an alias) |
| `pnpm rename:gate` | the rename gate: fails on any old-name hit outside `tools/rename-gate/allowlist.txt` (JAMAA-PLATFORM §1.7) |
| `pnpm gen:sounds` | re-render the synthesised sound cues (needs ffmpeg with libvorbis) |
| `pnpm run deploy` | see [Deploy](#deploy) |
| `pnpm --filter @jamaa/server billing:products` | CSV of the one-time Play products to create; `jamaa_pass` is created by hand (JAMAA-PLATFORM §4.1) |
| `pnpm --filter @jamaa/server gen:entitlement-key` | new Ed25519 key for the `ENTITLEMENT_KEYS` secret |

## Status

| Milestone | Scope | Status |
|---|---|---|
| **M1–M4** Mish Ana! | engine, server, phone client, `/tv` mock, Android TV app, i18n, packs, sounds | **Done**, except the on-device checks. `pnpm test`, `pnpm sim` (3–12 players, no invariant, termination or leak failures) and the Playwright e2e (EN and AR/RTL, remote-only TV) are green. The TV app passes its JVM unit tests against the shared fixtures, but the APK has not been built or tried on a real TV here, because Google Maven and the Android SDK were unavailable (see [docs/TV.md](docs/TV.md)). Packs (`content/mishana/`): EN 372, FR 369, AR 279 (51 Lebanese), ES 379 pairs; the Spanish packs are drafts for native review |
| **Payments** | JAMAA Pass + packs, Billing DO, entitlement tokens, RTDN, cron, room access, fake billing | **Code complete, verified with fake billing only.** Not done yet: a real Play purchase (needs owner steps O4–O5), the TV APK build, and 40 pairs per free starter pack |
| **P0** Rename to JAMAA | billing restore, then the mechanical rename (JAMAA-PLATFORM §1, §6.3) | **Done.** Gate: `pnpm rename:gate` |
| **M6** JAMAA platform | room + hub, setup, How to play, ⓘ rules, characters, portal, protocol v2, `GameDefinition` registry, session cup, content system, Pass store behind `BILLING_ENABLED`, Mish Ana! as the first game, EN/FR/AR/ES (JAMAA-PLATFORM §6.4) | **Done**, except the on-device checks: `assembleDebug`, frame times on a real TV and the RTL screenshots on device (Google Maven was blocked here; see [docs/TV.md](docs/TV.md)). Ships with `GAMES_ENABLED="mishana"` |
| **G2** Bluff! | engine, phone + TV screens, content (JAMAA-PLATFORM §6.5) | **Done** (engine, phone + TV screens, content draft, reviews). In `GAMES_ENABLED` |
| **G3** Most Likely | engine, phone + TV screens, content (JAMAA-PLATFORM §6.6) | **Done** (engine, phone + TV screens, content draft, reviews). In `GAMES_ENABLED` |
| **G4** Quiz Night | engine, phone + TV screens, `lb-quiz-01` (JAMAA-PLATFORM §6.7) | **Done** (engine, phone + TV screens, content draft, reviews). In `GAMES_ENABLED` |
| **M5** Play Store readiness | banners, signing, prod deploy, listing | Not started. The listing (EN/FR/AR/ES), graphics, Data safety and release checklist are drafted in `growth/marketing/play-store/` |

## Repository layout

```
shared/          @jamaa/shared: room engine (hub, members, cup), game registry (games/<id>/: mishana engine,
                 bluff/likely/trivia engines), zod wire protocol v2, per-client projections, billing, characters,
                 worlds, i18n (shared/i18n/ + shared/i18n/games/<id>/), protocol fixtures
server/          @jamaa/server: Cloudflare Worker "play" + Room DO + Billing DO (partyserver), access, rate limits
web-client/      @jamaa/web-client: Preact phone controller + browser TV (/tv), per-game screens in src/games/<id>/,
                 Playwright e2e in e2e/
tv-app/          Android TV app app.jamaa.tv (Kotlin, Compose for TV, OkHttp WebSocket, Play Billing)
content/         @jamaa/content: content packs per game (mishana, bluff, likely, trivia)
tools/
  dev.mjs        `pnpm dev` (wrangler + vite on the LAN)
  sim/           headless game simulator (in-process, or over WebSocket against a running server)
  gen-android-strings/  shared/i18n → tv-app res/values*/strings_generated.xml
  gen-sounds/    synthesised sound cues → web-client/public/sounds + tv-app res/raw (OGG)
  content-lint/  content-pack linter
  rename-gate/   `pnpm rename:gate` (JAMAA-PLATFORM §1.7)
assets/brand/    JAMAA logo, wordmarks, banner, icon (generated by assets/brand/scripts/gen_brand.py)
assets/games/    per-game art (assets/games/mishana/: the Mish Ana! wordmark)
growth/          the JAMAA site (Worker "www"), Play listing, ads, launch plan, videos (see growth/README.md)
docs/            specs, plans and research (index below)
```

## Docs index

| Doc | What it is |
|---|---|
| [JAMAA-PLATFORM.md](docs/JAMAA-PLATFORM.md) | **Binding.** Platform spec: rename, architecture, hub UX, JAMAA Pass, content, lanes, build order |
| [DESIGN-JAMAA.md](docs/DESIGN-JAMAA.md) | **Binding.** Platform look: worlds, characters, motion, wireframes |
| [ART-DIRECTION.md](docs/ART-DIRECTION.md) | Art direction for worlds, characters and posters |
| [SPEC.md](docs/SPEC.md) | Mish Ana! (game #1) engine contract: rules, secrecy, room lifetimes |
| [GAME-BLUFF.md](docs/GAME-BLUFF.md), [GAME-LIKELY.md](docs/GAME-LIKELY.md), [GAME-TRIVIA.md](docs/GAME-TRIVIA.md) | Binding rules for games #2–#4 |
| [BLUEPRINT.md](docs/BLUEPRINT.md) | Strategy: what we copy and never copy, pricing grid, roadmap, open owner decisions |
| [JACKBOX-STUDY.md](docs/JACKBOX-STUDY.md) | Evidence behind the blueprint (business, games, UX, legal), with sources |
| [MONETIZATION.md](docs/MONETIZATION.md) | Store rules research and the JAMAA Pass decision (the earlier lifetime decision is archived there) |
| [PAYMENTS-SPEC.md](docs/PAYMENTS-SPEC.md) | Billing implementation spec (Play Billing, Billing DO, tokens, RTDN, owner setup §8) |
| [BILLING-LAUNCH.md](docs/BILLING-LAUNCH.md) | Steps to turn `BILLING_ENABLED` on |
| [DESIGN.md](docs/DESIGN.md) | Original Mish Ana! design system (TV and phone), world palettes |
| [DEV.md](docs/DEV.md) | Local development, tests, fake billing, secrets, deploy |
| [TV.md](docs/TV.md) | Android TV build, install, signing, debugging |
| [PLAN.md](docs/PLAN.md) | History of the Mish Ana! build (M1–M5) |
| [RESEARCH.md](docs/RESEARCH.md), [research/](docs/research/) | Archived research from before the rename (game, Android TV, backend, i18n) |
| [growth/README.md](growth/README.md) | Marketing: site, Play listing, ads, videos |

## Blueprint: Jackbox-proven, JAMAA-made

JAMAA follows the formula that made Jackbox Games a hit with 200M+ players (one TV, everyone's phone, 15-minute comedy games, one payer) and aims it at the markets Jackbox ignores. Jackbox has no Arabic, no RTL and no Middle East content, and Netflix's Jackbox games list no MENA country.

- **We copy mechanics and patterns:** bluff-and-find, room votes, ×1/×2/×3 rounds, staged reveals, stuck-player help, audience and streamer modes. Copyright does not protect game rules.
- **We never copy names, text, art, characters, music, sound or look-and-feel.** Everything is written, drawn and composed by us, rooted in Levantine and Mediterranean culture. Marketing never names Jackbox (BLUEPRINT §3).
- **We undercut on price:** free games with starter content, plus one JAMAA Pass for every game. The yearly Pass costs less than one $29.99 Jackbox pack, with regional prices (Gulf, Levant, Egypt, LatAm).
- **Roadmap:** Mish Ana! → Bluff → Who's Most Likely To → Trivia (Lebanon quiz) → candidates.

Read [docs/JACKBOX-STUDY.md](docs/JACKBOX-STUDY.md) (evidence) and [docs/BLUEPRINT.md](docs/BLUEPRINT.md) (decisions).

## License

See [THIRD_PARTY.md](THIRD_PARTY.md) for third-party notices (fonts, libraries).
