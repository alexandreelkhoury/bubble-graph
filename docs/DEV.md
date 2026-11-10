# Developing JAMAA

This page covers local development, testing and deployment for the TypeScript side of the repo (shared room and game engines, Worker and Room Durable Object, web client, tools). The Android TV app has its own guide in [TV.md](TV.md). The binding contracts are [JAMAA-PLATFORM.md](JAMAA-PLATFORM.md) (rooms, hub, protocol v2, the JAMAA Pass, content) and, for game #1, [SPEC.md](SPEC.md) (the Mish Ana! engine rules); billing is [PAYMENTS-SPEC.md](PAYMENTS-SPEC.md) revision 4.

## Prerequisites

- Node 22 (`>=22.12.0`, see `.nvmrc`).
- pnpm 10.28.0 (`corepack enable` picks it up from `packageManager`).
- A phone and the computer on the **same Wi-Fi** for LAN play. A TV (or the browser TV mock) on the same network.

## Install

```sh
pnpm install
```

There is no build step for `@jamaa/shared`: Vite, Wrangler (esbuild), Vitest and tsx compile its TypeScript source directly.

## Run locally: `pnpm dev`

```sh
pnpm dev
```

`tools/dev.mjs`:

1. Emits the content (JAMAA-PLATFORM §5.6): `content-lint --emit` writes every registered, validated pack to `server/content-dist/<game>/<id>.txt` (gitignored), then `server/scripts/gen-content-modules.mjs` regenerates `server/src/content-modules.gen.ts` (one Text-module import per pack). Both also run before `pnpm build` and `pnpm test` (root script `content:emit`).
2. Picks the LAN address: `LAN_HOST` from `/.env` wins. Otherwise it uses the first non-internal IPv4 address, preferring `192.168.*`, then `10.*`, then `172.16–31.*`.
3. Builds the web client once if `web-client/dist/index.html` is missing. Wrangler serves that folder as static assets.
4. Starts both processes and stops both on Ctrl+C:
   - `wrangler dev --ip 0.0.0.0 --port 8787` with `JOIN_BASE_URL=http://<LAN_HOST>:5173`, `ALLOWED_ORIGINS=http://<LAN_HOST>:5173,http://localhost:5173`, `DEBUG_INVARIANTS=1` (the room and game invariants run after every state change), billing on and **fake billing** (`BILLING_ENABLED=1`, `BILLING_MODE=fake`, `ALLOW_FAKE_BILLING=1`; see [Billing](#billing-payments-specmd)). `GAMES_ENABLED=mishana,bluff,likely,trivia` (`DEV_GAMES_ENABLED` in `tools/dev.mjs`): local dev offers every game whose registry entry is enabled (a stub stays hidden, since the room uses `GAMES_ENABLED` ∩ registry enabled). Narrow it with an environment variable, e.g. `GAMES_ENABLED=mishana,trivia pnpm dev`. Production is unaffected: it keeps `wrangler.jsonc`'s `"mishana"`.
   - `vite --host 0.0.0.0 --port 5173 --strictPort` (hot reload for the phone UI).
5. Prints the URLs:
   - `TV server URL: http://<LAN_HOST>:8787`. Build the Android TV app with `-PserverUrl=http://<LAN_HOST>:8787`.
   - `Phone/TV-mock: http://<LAN_HOST>:5173/tv`. Open it on a laptop or TV browser to host without the Android app.

Phones scan the QR code or open `http://<LAN_HOST>:5173/ABCD`.

### LAN notes

- **Wrong address detected** (VPN, Docker or VM adapters): copy `.env.example` to `.env` and set `LAN_HOST=192.168.1.23`.
- **Phones cannot connect**:
  - allow inbound TCP 8787 and 5173 in the OS firewall;
  - check that the router has no "client/AP isolation" (guest networks usually do);
  - mobile data must be off on the phone.
- **Origins.** Browsers send `Origin`. The Worker accepts same-origin requests, the origins in `ALLOWED_ORIGINS` and requests without an `Origin` (the TV app and the sim). When you open Vite through a different host name, add it to `ALLOWED_ORIGINS`. Otherwise the WebSocket upgrade gets **403**.
- **Local state.** Wrangler keeps Durable Object storage in `server/.wrangler/state`. Delete that folder to drop all local rooms. Rooms stored by an older build (protocol v1, `state` without `schema: 2`) are expired on their next wake-up and log `room_schema_expired` once each: that is the intended deploy behaviour (JAMAA-PLATFORM §2.6), not an error.
- **Proxy warnings.** Behind an HTTP proxy, wrangler logs `Unable to fetch the Request.cf object` and `Request was cancelled`. Both are harmless.

### Running only the server

```sh
pnpm run content:emit && pnpm --filter @jamaa/server run dev   # gen-content-modules, then wrangler dev on :8787
curl -s localhost:8787/healthz                     # {"ok":true,"app":"jamaa","protocol":2}
curl -s localhost:8787/api/config                  # {"billing":false,"games":["mishana"]}
curl -s -X POST localhost:8787/api/rooms           # {"code":"KXRT","tvToken":"…","joinUrl":"…","wsPath":"/parties/room/KXRT","entitlement":"NONE"}
```

`wrangler.jsonc` points `assets.directory` at `../web-client/dist`, so build the web client first (`pnpm --filter @jamaa/web-client build`). Wrangler refuses to start when that folder is missing.

## Tests and checks

| Command | What it runs |
|---|---|
| `pnpm test` | `content:emit`, then every Vitest project: `shared`, `server`, `web-client`, `content`, `tools/*` |
| `pnpm test:coverage` | The same, with the coverage gate (≥ 90 %) on `shared/src/games/*/engine/**` and `shared/src/room/**` |
| `ROOM_PROPS_RUNS=2000 pnpm vitest run --project shared shared/test/room/props.test.ts` | The room property tests at the P acceptance size (JAMAA-PLATFORM §6.4: ≥ 2 000 runs; the default run is 150) |
| `pnpm lint` / `pnpm typecheck` | ESLint (flat config) and `tsc -p .` in every package |
| `pnpm sim [--game mishana\|bluff\|likely\|trivia\|all] --players 3..12 --games 500` | Engine-mode bot games of each selected game on the real packs with invariant, termination, role-count and leak checks, and the Blank-never-opens rule at every round and tie-break. `--game` defaults to `mishana`; `all` reports the G2–G4 stubs as skipped until their G milestone. The full catalog is equivalent to a Pass room; add `--access free` to play the free starter content only (locked packs must never be picked, views carry locked-pack metadata only) |
| `pnpm sim --session --games 50 [--access free]` | **Session mode** (JAMAA-PLATFORM §2.9): rooms through the platform engine (`reduceRoom`), hub → a live game → setup → play → replay, back to setup or back to hub, about 10 games per room, with random reactions, disconnects, benched late joins, leaves and aborts. Room invariants and the generic leak checker after every step, and the cup arithmetic (stars recomputed from each outcome's ranking) after every finished instance |
| `pnpm sim --ws http://127.0.0.1:8787 --players 4 --games 3` | **WS mode** against a running server, over protocol v2 (see below) |
| `pnpm --filter @jamaa/web-client build` | Vite production build into `web-client/dist`, then the 60 KB gzip phone budget (`web-client/scripts/check-size.mjs`, TV mock excluded) |
| `pnpm --filter @jamaa/server build` | `gen-content-modules --require`, the Wrangler dry-run bundle (minified) into `server/dist` (the script plus one `.txt` Text module per pack), then `server/scripts/check-size.mjs`: script code ≤ 400 KB, content modules ≤ 2 MB raw, whole upload ≤ 3 MB gzip (the Free-plan limit, [VERIFY] the owner's plan) |
| `pnpm fixtures` / `pnpm --filter @jamaa/shared run check:fixtures` | Regenerate or verify the generated fixtures: `shared/fixtures/*.json` (v1, kept for one milestone) and `shared/fixtures/v2/**` (the protocol v2 contract the web client and the TV test against). The billing fixtures (`billing.products.json`, `http.billing.*`) are hand-maintained |
| `pnpm rename:gate` (`-- --summary` for per-file counts) | JAMAA rename gate (JAMAA-PLATFORM §1.7): fails on any case-insensitive hit of the old brand outside `tools/rename-gate/allowlist.txt` |
| `pnpm lint:content` (alias `pnpm lint:packs`, one milestone) / `pnpm --filter @jamaa/content-lint run lint -- --release` | Content lint over every game. `--release` (run by `pnpm run deploy`) applies the release gates of JAMAA-PLATFORM §4.3 and fails on a free starter pack with fewer than 40 pairs **or still `status: "draft"`**. Today the four free `*-everyday-01` packs are drafts awaiting the owner's review, so **`pnpm run deploy` fails on purpose** until they are reviewed |
| `pnpm gen:characters` (`--filter @jamaa/gen-characters run check` / `check:kotlin`) | Regenerates the TV's `CharacterPaths.kt`, `WorldColors.kt` and `Choreo.kt` from `shared/src/{characters,worlds,motion}` (lane D's generator; `check:kotlin` compiles the Kotlin sampler port and compares it with the TS `sample()`) |
| `pnpm --filter @jamaa/server billing:products` | CSV for Play Console (PAYMENTS-SPEC §1.4): `productId,type,gameId,family,locales,titleEn,titleFr,titleAr,titleEs`. Row 1 is the `jamaa_pass` subscription (create its base plans and offers by hand), then one one-time `pack_<family>` per sellable content family, titled "JAMAA – <pack title>" |
| `pnpm grant <installId>` / `pnpm grant list` / `pnpm grant revoke <id>` | Owner comps through `/api/admin/grants` (needs the optional `ADMIN_TOKEN` secret; see [Admin grants](#admin-grants-comp-premium-for-a-tv-payments-spec-312)) |

To run one project: `pnpm vitest run --project server` (or `shared`, `sim`, …).

Test support lives in `shared/src/testing` and is imported as `@jamaa/shared/testing` (from shared tests: `../../src/testing`): the room harness `RoomHarness` (a scripted clock over `reduceRoom` that checks `assertRoomInvariants` after every dispatch, with `nextMishanaAction` / `playMishanaToResults`), the generic room leak checker `findRoomLeaks` (`secretsFor`, `leakCheck` and `forbiddenKeys` of the active game, for the TV, spectators and every member), the scripted Mish Ana! `Game` driver, the seeded bot driver `playGame`, and the test catalogs. The server tests, `tools/sim` and the fixture generator use the same code.

### Server tests (`server/test`)

The server tests run in Node. `server/test/support/setup.ts` installs the content loader over the `@jamaa/content` JSON (the Worker installs one over its Text modules). They drive `RoomCore` (`server/src/room-core.ts`) through in-memory fakes in `server/test/support/fakes.ts`: storage with an alarm, sockets, a clock and real WebCrypto, speaking protocol v2 (`h.tv(games?)` says hello with every game at its `VIEW_VERSION` by default, `h.open(tv)`, `h.settings(tv, patch)`, `h.game(conn, intent)`; `h.room` is the `RoomState`, `h.state` the running Mish Ana! engine state, `h.history` the `RoomHistory`). `Harness.startedGame({ n, settings, ready })` sets up a TV, `n` players, OPEN_GAME mishana, the timers off and START_GAME. Options: `{ entitlement, billingMode, billing, billingEnabled, enabledGames, content }`. They never import `room.ts` or `index.ts`, so no workerd is needed. The suites cover:

- hello (a v1 frame closes with 4002; a TV hello without `games` is refused), join (a join while PLAYING is benched, then dealt in at REPLAY), actions and KICK/LEAVE;
- the platform (`room-core.platform.test.ts`): the two storage keys (`history` written only at game end, REPLAY or ABORT), a schema-1 room expires (4010), stale settings and a missing game slot normalize on load, a game-state schema mismatch aborts to SETUP (`game_schema_reset`), the three `GAMES_ENABLED` runtime cases, TV capability negotiation (a TV without a game or at another view version never gets it), `WRONG_GAME` / `NOT_IN_GAME`, `HUB_FOCUS` without any storage write, and one full session hub → mishana → replay → hub;
- rate limits and frame checks;
- connection caps;
- alarms and expiry;
- `initRoom` on live and expired rooms;
- concurrency (the mutex);
- hibernation: a fresh `RoomCore` on the same storage behaves identically, and a restart with no live sockets marks players disconnected and applies the speaker grace rule;
- HTTP handlers (healthz v2, `/api/config` with `games`, `GAMES_ENABLED` parsing), room codes, tokens, the Origin check, the content loader, and the deploy scripts (`check-deploy`, `check-size`, `play-products`);
- room access (PAYMENTS-SPEC §3.11, JAMAA-PLATFORM §4.4): entitlement and `storeOpen` messages, the `PACK_LOCKED` (by family) and `PREMIUM_REQUIRED` pre-checks on `UPDATE_GAME_SETTINGS`, restrictions of the setup game in SETUP and of every game in HUB, the TV-busy flag (`room-core.access.test.ts`, `access.test.ts`);
- billing (`server/test/billing/*`): the Billing DO core against real SQLite (`node:sqlite`, flag-free in Node 22.22; it prints an `ExperimentalWarning`), the Google client with a mocked `fetch`, RTDN with locally generated OIDC keys, routes, cron, the fake mode guards and the log redaction test. `Harness` takes `{ entitlement, billingMode, billing }`; a room with no entitlement is a free room.

### WS mode: end-to-end over the protocol

With a server running (`pnpm dev`, or `wrangler dev` alone):

```sh
pnpm sim --ws http://127.0.0.1:8787 --players 3..12 --games 3
```

For each player count the sim:

- creates a room over HTTP and checks `Cache-Control: no-store`;
- opens a TV socket and N phone sockets (no `Origin`) and checks ping/pong;
- says hello as a v2 TV (every game at its `VIEW_VERSION`) and checks the room starts in HUB with `mishana` in `room.games`;
- OPEN_GAME mishana, sets the timers off, START_GAME, and plays full games through `GAME {gameId:"mishana", i}` (bots READY, give clues, vote and guess; the TV advances ELIMINATION and verdicts), REPLAY between games and once BACK_TO_HUB and in again.

Along the way it checks that:

- **killing and resuming a player socket mid-game** restores the same `playerId` and token through `welcome`;
- **a late joiner while PLAYING** is benched (no game `me`) and dealt in at the next instance;
- every server frame parses with `ServerMessageV2Schema`;
- `seq` strictly increases on every socket;
- every TV state satisfies SPEC §5.4: no secret word, no room or game `me`, no state-only key, no alive revealed role and no guess text before RESULTS.
- every phone state satisfies SPEC §5.4 too: `game.me` is the viewer's own, no other player's word that differs from the viewer's appears anywhere, and no alive revealed role before RESULTS;
- **the Blank never speaks first**: at the first frame of every CLUES and TIE_BREAK pass, `speakingOrder[0]` is not a Blank (known from each phone's own `me.isBlank`), unless no non-Blank can open (two tied Blanks). The table counts `blanks dealt` and `openings checked`.

The same check is available as an opt-in Vitest case: `JAMAA_WS_URL=http://127.0.0.1:8787 pnpm vitest run --project sim`.

**Manual restart check** (a real DO reset):

1. Start a game.
2. Stop `wrangler dev` and start it again (the state persists in `.wrangler/state`).
3. Reconnect the TV with its token and the phones with their resume tokens.

The room comes back in the same phase with the same words. On the first connection, the `onStart` reconcile marks everyone disconnected. Each resume then reconnects its seat.

## How the server is put together

- `server/src/index.ts`: the Worker. In order:
  1. `GET /healthz`;
  2. `POST /api/rooms`, `GET /api/config` (`{billing, games}`), `/api/billing/*` (PAYMENTS-SPEC §3.4), `/api/admin/*`, and 405 for any other request under `/api/*`;
  3. WebSocket upgrades to `/parties/room/{CODE}`: the Worker checks the code regex, returns 400 unless `_pk` matches `^[A-Za-z0-9_-]{1,64}$` and `cid` matches `^[A-Za-z0-9-]{8,64}$`, applies the per-IP `CONNECT_LIMITER`, then routes through partyserver, which runs the Origin check in `onBeforeConnect`.

  Everything else is served by the static-assets layer, with SPA fallback.
- `server/src/http.ts`: room creation. It draws a code by rejection sampling, hashes the TV token, calls `initRoom` over native RPC (retrying up to 10 codes on collision) and returns 201 with `no-store`.
- `server/src/room.ts`: a thin partyserver `Server` (`hibernate: true`). It sets the ping/pong auto-response and forwards every entry point to `RoomCore`.
- `server/src/content.ts` (JAMAA-PLATFORM §5.6): the content behind an injected loader. `index.ts` installs a loader over `content-modules.gen.ts` (the Text modules), Node installs one over `@jamaa/content`; each game's packs are `JSON.parse`d on first use and schema-validated once per isolate (`loadGameContent`). The packs never ship as JS object literals or as static assets.
- `server/src/room-core.ts`: all behaviour. Every entry point runs through one FIFO mutex. Each change goes read → `reduceRoom(state, action, {now, content: playable, enabledGames, access, history})` → inline expiry (a result whose wake time is already due TICKs in the same turn) → persist → broadcast per-connection projections (`projectRoomForTv` / `projectRoomForPlayer`) → reschedule the alarm (the minimum of the room wake time, the room expiry, the access change and the hello deadline).
- Storage (`server/src/room-store.ts`, JAMAA-PLATFORM §2.6): `meta`, `state` (`RoomState`, rewritten on every change), `history` (`RoomHistory`: memory and the last 20 cup entries, written only at game end, REPLAY or ABORT) and `sessions`. On load (`normalizeLoaded`): a `state` without `schema: 2` expires the room (4010), every `gameSettings[K]` passes through `GAMES[K].settings.normalize`, and a running game whose state `schema` differs from the code's is aborted to SETUP. The TV's carousel focus (`HUB_FOCUS`) is in-memory meta only: it is broadcast (with a higher `seq`) but never written.
- `GAMES_ENABLED` (`server/src/config.ts`): the live games, `GAMES_ENABLED` ∩ registry `enabled`. The room offers that ∩ the games the TV's hello declares at the server's `VIEW_VERSION`. Unknown ids are ignored at runtime (one `games_enabled_unknown_id` log per isolate) and fail `check-deploy.mjs`. A game removed by a redeploy: an instance already PLAYING finishes; a room in SETUP for it returns to HUB on its next write.
- Per-socket data lives in the hibernation-safe attachment: role, playerId, `cid`, a truncated IP hash, epoch and rate-limit bucket. Resume and TV tokens are stored only as SHA-256 hashes and compared in constant time.
- Connection caps: at most `MAX_CONNECTIONS_PER_ROOM` (40) non-spectator sockets (pending, TV, joined players) and, separately, `MAX_SPECTATORS_PER_ROOM` (16) spectators (said hello as a player but have not joined). A spectator flood therefore cannot lock out the TV or a resume-token reconnect. When `MAX_PENDING_CONNECTIONS` is reached, a new socket evicts the oldest pending one (4009). Every inbound frame takes a rate-limit token; binary and oversize frames also count as strikes (three in 10 s → 4008). Room activity (idle TTL) is refreshed only by a TV hello, a resume, a join or an accepted action.
- Known local-dev effect: on `wrangler dev`, a close sent from inside `onConnect` (4004 room not found, 4009 room full) reaches the client about 10 s late, because it is issued before partyserver returns the 101. Closes sent from `onMessage` arrive at once. Bad `_pk` and `cid` values are rejected with 400 before the upgrade, so they are not affected. This has not been checked against a deployed Worker; check it before shipping.
- Server code never logs message bodies, state, words, guesses, tokens, names or IPs. The catch-all logs `{code, phase, roomCode}` only.
- Billing (PAYMENTS-SPEC §3): `/api/billing/*` is handled by `server/src/billing/routes.ts`; purchase state lives in the single `Billing` Durable Object (`env.BILLING.getByName("global")`, SQLite). The Room DO only gets the public entitlement verify keys and plays `playableFor(full, access)` (`server/src/access.ts`: each game's `ContentAdapter.playable` on every pack), so a locked pack's items can never be picked or projected.

## Billing (PAYMENTS-SPEC.md)

The binding contract is [PAYMENTS-SPEC.md](PAYMENTS-SPEC.md) revision 4: the **JAMAA Pass** subscription `jamaa_pass` (base plans `monthly` and `yearly`, offer `trial-7d` on each) unlocks every pack of every game and the premium settings; one-time `pack_<family>` products unlock one content family. The server stores purchase state in the `Billing` DO, checks every purchase token with Google, and signs an 8-hour Ed25519 **entitlement token** (`iss: "jamaa"`; `pu` = the Pass expiry, `packs` = owned families) that the TV sends with `POST /api/rooms` and the WS `entitlement` message.

### Fake billing (local dev and e2e)

`pnpm dev` runs the Worker with `--var BILLING_MODE:fake --var ALLOW_FAKE_BILLING:1`. Fake mode is active for a request only when **all** of these hold (`server/src/billing/mode.ts`):

1. `BILLING_MODE` is `fake`;
2. `ALLOW_FAKE_BILLING` is `1`;
3. `PLAY_SERVICE_ACCOUNT_JSON` is unset or empty;
4. the request host is `localhost`, `127.0.0.1`, `[::1]` or a private IPv4 (`10/8`, `172.16/12`, `192.168/16`).

If `BILLING_MODE=fake` but another condition fails, every billing route answers **503** `NOT_CONFIGURED` and rooms treat every token as invalid (fail closed). The mode is decided per request in the Worker and stored in the room (`meta.billingMode`). `wrangler.jsonc` ships `BILLING_MODE:"google"` and `ALLOW_FAKE_BILLING:"0"`; `pnpm run deploy` refuses anything else (`server/scripts/check-deploy.mjs`).

In fake mode the server serves synthetic Google purchases from the Billing DO and signs tokens with the public dev key (kid `fake`, `server/src/billing/fake.ts`):

```sh
B=http://127.0.0.1:8787; I=0123456789abcdef0123456789abcdef   # installId: 32 lowercase hex
curl -s $B/api/billing/catalog                                     # "mode":"fake"
curl -s -X POST $B/api/billing/fake/purchase -H 'Content-Type: application/json' \
  -d "{\"installId\":\"$I\",\"productId\":\"jamaa_pass\",\"basePlanId\":\"yearly\",\"offerId\":\"trial-7d\"}"   # {"purchaseToken":"fake.sub.jamaa_pass.1"}
curl -s -X POST $B/api/billing/verify -H 'Content-Type: application/json' \
  -d "{\"installId\":\"$I\",\"purchases\":[{\"productId\":\"jamaa_pass\",\"purchaseToken\":\"fake.sub.jamaa_pass.1\"}]}"
curl -s -X POST $B/api/billing/fake/set -H 'Content-Type: application/json' \
  -d '{"purchaseToken":"fake.sub.jamaa_pass.1","state":"SUBSCRIPTION_STATE_EXPIRED"}'   # 204; the Pass ends, same path as an RTDN
```

`fake/purchase` takes `basePlanId` (`monthly` | `yearly`), `offerId` (`trial-7d` or null) and `outcome: "PENDING"` for a pending purchase. `fake/set` takes a `SubscriptionPurchaseV2` state for the Pass (`SUBSCRIPTION_STATE_ACTIVE | IN_GRACE_PERIOD | ON_HOLD | PAUSED | CANCELED | EXPIRED | …`) and `PURCHASED | PENDING | CANCELLED | REVOKED` for a `pack_*` product. Outside fake mode both routes answer 404 (or 503 when fake mode was asked for but refused).

### Cron (local)

```sh
curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=23+*+*+*+*"   # hourly: ack retries, overdue alert
curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=17+3+*+*+*"   # daily: voided purchases, stale-sub alert, prune
```

In fake mode the cron only prunes.

### Secrets (production, and local Google-mode testing)

| Secret | Content |
|---|---|
| `PLAY_SERVICE_ACCOUNT_JSON` | The Play Developer API service-account key JSON (view-only Play permissions, rotated every 90 days; PAYMENTS-SPEC §8.C) |
| `ENTITLEMENT_KEYS` | `{"active":"k1","keys":[{"kid":"k1","x":"…","d":"…"}]}` (Ed25519 OKP keys) |
| `ADMIN_TOKEN` (optional) | ≥ 32 random characters (`openssl rand -hex 32`); unset = admin endpoints answer 404. See [Admin grants](#admin-grants-comp-premium-for-a-tv-payments-spec-312) |

```sh
pnpm --filter @jamaa/server gen:entitlement-key            # prints {"kid":"k1","x":"…","d":"…"}; -- --kid k2 for the next one
cd server && npx wrangler secret put ENTITLEMENT_KEYS          # paste {"active":"k1","keys":[ <that object> ]}
npx wrangler secret put PLAY_SERVICE_ACCOUNT_JSON < ../play-api.json
```

- They are needed only when `BILLING_ENABLED` is `"1"`: `check-deploy.mjs` then checks both exist (`wrangler secret list`, names only) and refuses the deploy otherwise. With billing off (the shipped `"0"`), the Worker deploys without them.
- `ADMIN_TOKEN` is the one optional secret (see [Admin grants](#admin-grants-comp-premium-for-a-tv-payments-spec-312)).
- **Key rotation:** generate `k2`, add it to `keys`, set `"active":"k2"`, deploy; remove `k1` (or keep only its `x`) after at least 16 h (2 × token TTL; 24 h recommended).
- **Local Google mode:** put the secrets and non-fake vars in `server/.dev.vars` (git-ignored, `.dev.vars*`) and run `wrangler dev` without the fake `--var`s. Never use `pnpm dev` for this: it forces fake mode, and a configured service account disables fake mode (503).
- Only `server/src/billing/**` reads `PLAY_SERVICE_ACCOUNT_JSON` (ESLint `no-restricted-syntax`). The Room DO parses `ENTITLEMENT_KEYS` with the private halves dropped.

### Admin grants (comp premium for a TV, PAYMENTS-SPEC §3.12)

Optional. Lets the owner give premium and/or packs to specific TV installs (e.g. a sideloaded TV) without paying. Grants never involve Google and never use one of a purchase's 10 install slots.

1. **Turn it on** (once): `cd server && openssl rand -hex 32 | npx wrangler secret put ADMIN_TOKEN`, and keep the value in your password manager. Without the secret (or with one shorter than 32 characters) every `/api/admin/*` path answers 404; `check-deploy.mjs` keeps it optional (never a var, never in `secrets.required`). To turn it off again: `npx wrangler secret delete ADMIN_TOKEN`. Locally, put `ADMIN_TOKEN=…` in `server/.dev.vars`.
2. **Find the TV's install id:** on the TV, Lobby → **Settings** → **About** (last category, D-pad Down). It shows `Install ID` as eight groups of four hex characters. The `/tv` browser mock shows its own id in the same place. The id is created on first launch and survives updates; clearing the app's data creates a new one.
3. **Grant / list / revoke** (the token is read from the environment only, so it stays out of shell history; the server from `--url` or `JAMAA_URL`):

```sh
export JAMAA_URL=https://play.<your-subdomain>.workers.dev   # or your custom domain
read -rs ADMIN_TOKEN && export ADMIN_TOKEN                      # paste the token
pnpm grant "0123 4567 89ab cdef 0123 4567 89ab cdef" --note "living-room TV"   # premium, no end date
pnpm grant 0123456789abcdef0123456789abcdef --packs en-food-01,fr-food-01      # only these packs
pnpm grant 0123456789abcdef0123456789abcdef --premium --packs en-food-01 --expires 2027-01-01
pnpm grant list                                  # install hashes (the raw id is never stored), what, until when
pnpm grant revoke 0123456789abcdef0123456789abcdef   # or the 64-hex hash printed by `list`
```

4. The TV picks it up on its next entitlement refresh: open the Store and choose **Restore purchases**, or restart the app. A new room is then premium; a room already open gets it with the TV's next token.

Admin routes, like every `/api/billing/*` route, answer 404 while `BILLING_ENABLED` is not `"1"`, and the TV only shows its install id in About once billing is on.

### Owner: free JAMAA Pass + every pack on every device

The Pass (`premium` in code and protocol) covers every premium pack of every game, current and future, plus the premium settings. A grant with no end date gives it to an install for good. The grant survives app updates, server deploys and the daily prune, and it never touches Google or a purchase's install slots. One-time setup: `ADMIN_TOKEN` (step 1 above) and `BILLING_ENABLED` `"1"` ([BILLING-LAUNCH.md](BILLING-LAUNCH.md)).

```sh
export JAMAA_URL=https://play.jamaa.workers.dev
read -rs ADMIN_TOKEN && export ADMIN_TOKEN          # from your password manager
pnpm grant "<id of TV 1>" "<id of TV 2>" --note "owner"   # each id: TV → Settings → About; spaces are fine
```

Then on each TV: Store → **Restore purchases** (or restart the app). Run the same command later for any new device: a new TV, a reinstall, cleared app data or a browser `/tv`. Each of these has a new install id. Use `pnpm grant list` and `pnpm grant revoke <hash>` to remove ids you no longer use.

Why install ids and not your Google account: the app has no accounts, and the server never learns a Google identity (Play only sees `obfuscatedAccountId = sha256(installId)`), so a grant can only be tied to installs. Your Gmail as a **license tester** (Play Console → Settings → License testing) also lets you buy for free on any device signed into that account, with Restore. That path is for testing: test subscriptions stop after 6 short renewals (minutes), so it is not a lasting Pass. Use the grant.

### Vars, observability and logs

- Vars: `PLAY_PACKAGE_NAME` (`app.jamaa.tv`), `RTDN_AUDIENCE` (`https://<your-domain>/api/billing/rtdn`), `RTDN_SA_EMAIL` (the push service account), `RTDN_SUBSCRIPTION` (`projects/<project>/subscriptions/play-rtdn-push`). Until the RTDN vars are set, `/api/billing/rtdn` answers 503 and Pub/Sub retries.
- **Workers traces stay disabled** (`observability.traces.enabled: false`, enforced by `check-deploy.mjs`): traces record outbound fetch URLs, and every Google Play call carries a raw purchase token in its path. Do not add Logpush or a Tail Worker without revisiting PAYMENTS-SPEC §3.2.
- Billing code logs only through `billingLog(code, fields)` (`server/src/billing/log.ts`), which keeps numbers, booleans and a few enum strings and redacts every other string. Alert on the codes `BILLING_ACK_OVERDUE`, `BILLING_ACK_REJECTED`, `BILLING_AUTH`, `BILLING_BUDGET`, `BILLING_SUB_STALE`, `RTDN_AUTH` (PAYMENTS-SPEC §8.D).

### `BILLING_ENABLED` (the production switch)

`vars.BILLING_ENABLED` in `server/wrangler.jsonc` (default `"0"`, see `server/src/config.ts`). Off: `/api/billing/*` and `/api/admin/*` answer 404, the crons do nothing, rooms play the whole catalog of every game, and `GET /api/config` → `{"billing":false,"games":[…]}` makes the TV, phone and `/tv` hide every Pass UI.

### `GAMES_ENABLED` (the rollout switch)

`vars.GAMES_ENABLED` in `server/wrangler.jsonc` (comma list, default `"mishana"`, JAMAA-PLATFORM §2.6). A game ships by adding its id once its G milestone is accepted (owner order: `bluff`, `likely`, `trivia`); a registry stub (`enabled: false`) is never live whatever the var says.

Where each game stands and how to turn it on:

| Game | id | Registry (`shared/src/games/<id>/definition.ts`) | Local dev (`pnpm dev`) | e2e (`pnpm e2e`) | Production (`server/wrangler.jsonc`) |
|---|---|---|---|---|---|
| Mish Ana! | `mishana` | enabled | on | on | on (default) |
| Bluff the Answer | `bluff` | set by G2 | on once registry-enabled | on once registry-enabled | off until the owner adds it |
| Most Likely | `likely` | set by G3 | on once registry-enabled | on once registry-enabled | off until the owner adds it |
| Quiz Night | `trivia` | **enabled** (G4) | on | on (`E2E_GAMES_ENABLED` overrides the list) | off until the owner adds it |

To turn a game on in production (one game per release, owner order `bluff`, `likely`, `trivia`):

1. Its registry entry is `enabled: true` and its G acceptance is green (sim, leak tests, e2e EN + AR, chunk ≤ 14 KB gz).
2. Its free starter content passes `pnpm --filter @jamaa/content-lint run lint --release` (for Quiz Night: the four `lb-quiz-01-*` packs `status: "reviewed"` and their `[VERIFY]` sources resolved, after the owner and Lebanese review).
3. Edit `server/wrangler.jsonc`: `"GAMES_ENABLED": "mishana,trivia"` (append the id to whatever is already live), commit it on `main`.
4. `pnpm run deploy` (`check-deploy.mjs` refuses an unknown id; `content-lint --release` refuses draft free packs), then check `curl -s https://play.<subdomain>.workers.dev/api/config` lists the id.
5. Add the game to README and the site copy (JAMAA-PLATFORM §6.8). Ship a TV build whose `hello` declares the game; older TVs simply do not offer it.

To turn it off again, remove the id and redeploy: a game in progress finishes, a room on its setup screen returns to the hub ([BILLING-LAUNCH.md](BILLING-LAUNCH.md) Phase 4). `GET /api/config` → `games` = `GAMES_ENABLED` ∩ registry enabled; the TV intersects with its own build's games before it creates a room. `"1"`: PAYMENTS-SPEC as written. The switch and the move from `prod-rules-v2` are covered in [BILLING-LAUNCH.md](BILLING-LAUNCH.md).

### Before the first production release

- `pnpm run deploy` (never bare `pnpm deploy`: pnpm 10 runs its built-in `deploy` command instead of the script) runs `content-lint --release`: each free starter pack (`*-everyday-01`) needs at least **40 pairs** and `status: "reviewed"`, plus the per-game release gates of JAMAA-PLATFORM §4.3. The deploy is refused until the owner (and a native reviewer for AR/ES) marks the free starter packs reviewed; this is intended, not a bug.
- Create the JAMAA Pass and the pack products from `pnpm --filter @jamaa/server billing:products` (PAYMENTS-SPEC §8.B, [BILLING-LAUNCH.md](BILLING-LAUNCH.md)).
- Replace the rate-limit `namespace_id`s `1003`/`1004` like `1001`/`1002`.

## Deploy (Cloudflare)

1. Log in once: `pnpm --filter @jamaa/server exec wrangler login`.
2. **Rate-limit namespaces.** `namespace_id` must be a positive integer string that is unique in your account. `"1001"` to `"1004"` in `server/wrangler.jsonc` work locally; change them if they collide with other Workers.
3. **Billing secrets and vars:** see [Billing](#billing-payments-specmd). Only with `BILLING_ENABLED` `"1"`: the deploy is refused while `PLAY_SERVICE_ACCOUNT_JSON` or `ENTITLEMENT_KEYS` is missing. With billing off, no billing secret is needed.
4. Deploy: `pnpm run deploy`. This emits the content, builds the web client, dry-run bundles the Worker with the size checks, runs `content-lint --release` and `check-deploy.mjs` (google billing, fake billing off, traces off, `PLAY_PACKAGE_NAME` `app.jamaa.tv`, known `GAMES_ENABLED` ids), then `wrangler deploy`. The Worker is served at `https://play.<your-subdomain>.workers.dev`.
5. **Custom domain** (optional). Add the domain to the Worker in the Cloudflare dashboard, then set `JOIN_BASE_URL` (see below).
6. Build the TV app against the deployed URL (see below and [TV.md](TV.md#production-server-url)).

### Production URLs

Nothing in the repo names a real domain. There are exactly three settings, all empty or placeholders until you deploy:

| Setting | Where | Placeholder / default | Set it to |
|---|---|---|---|
| TV app server URL → `BuildConfig.SERVER_URL` | `jamaa.prodServerUrl` in `tv-app/gradle.properties`, or `-PserverUrl=…` / env `ORG_GRADLE_PROJECT_serverUrl` | `https://play.example.workers.dev` (placeholder; release builds refuse it, and refuse any non-`https://` URL) | The Worker origin: the `https://play.<your-subdomain>.workers.dev` URL printed by `pnpm run deploy`, or `https://<your-domain>`. No trailing slash, no path |
| Phone join base URL (QR code and join link) | `JOIN_BASE_URL` in `server/wrangler.jsonc` `vars` (or the dashboard) | `""` = the origin the TV called, i.e. the same URL as above | Leave empty on `*.workers.dev`. With a custom domain: `https://<your-domain>`, so QR codes do not show the `workers.dev` host |
| Extra browser origins | `ALLOWED_ORIGINS` in `server/wrangler.jsonc` `vars` | `""` = same-origin only | Leave empty in production (the Worker serves the phone page itself). Only for a web client hosted elsewhere: a comma-separated list of exact origins |

The phone client has no server URL of its own: it is served by the Worker and connects to `location.host` (in dev, Vite proxies `/api`, `/parties` and `/healthz` to `:8787`). So `JOIN_BASE_URL` must point at an origin that serves this Worker.

Checklist after `pnpm run deploy`:

1. `curl https://<worker-origin>/healthz` prints `{"ok":true,"app":"jamaa","protocol":2}` and `/api/config` lists the live games.
2. With a custom domain: set `JOIN_BASE_URL`, run `pnpm run deploy` again.
3. Put the same origin in `tv-app/gradle.properties` (`jamaa.prodServerUrl=https://…`) and run `./gradlew :app:bundleRelease`; the build log prints `JAMAA release server URL: …`.
4. Open `/tv` on the deployed origin: the QR code must show the intended host.

Keep `DEBUG_INVARIANTS` at `"0"` in production. Workers observability (logs) is enabled with traces off, and the logging rules above keep player data and purchase tokens out of it.


## Personal / preview deploy (draft content allowed)

`pnpm run deploy` refuses packs still marked `draft` (`content-lint --release`). For the owner's own TV testing before the
native review, use:

```sh
pnpm run deploy:preview   # same build + deploy checks, but content-lint without --release (drafts allowed)
```

Production `GAMES_ENABLED` is `"mishana,trivia"` (server/wrangler.jsonc). Bluff and Most Likely are added there when their
G milestones pass. The phone size budget counts only registry-enabled games (`enabled: false` games are reported, not counted).
