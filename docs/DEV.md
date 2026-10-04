# Developing Mish Ana!

This page covers local development, testing and deployment for the TypeScript side of the repo (shared engine, Worker and Room Durable Object, web client, tools). The Android TV app has its own guide in [TV.md](TV.md). The binding contract is [SPEC.md](SPEC.md).

## Prerequisites

- Node 22 (`>=22.12.0`, see `.nvmrc`).
- pnpm 10.28.0 (`corepack enable` picks it up from `packageManager`).
- A phone and the computer on the **same Wi-Fi** for LAN play. A TV (or the browser TV mock) on the same network.

## Install

```sh
pnpm install
```

There is no build step for `@mishana/shared`: Vite, Wrangler (esbuild), Vitest and tsx compile its TypeScript source directly.

## Run locally: `pnpm dev`

```sh
pnpm dev
```

`tools/dev.mjs`:

1. Picks the LAN address: `LAN_HOST` from `/.env` wins. Otherwise it uses the first non-internal IPv4 address, preferring `192.168.*`, then `10.*`, then `172.16–31.*`.
2. Builds the web client once if `web-client/dist/index.html` is missing. Wrangler serves that folder as static assets.
3. Starts both processes and stops both on Ctrl+C:
   - `wrangler dev --ip 0.0.0.0 --port 8787` with `JOIN_BASE_URL=http://<LAN_HOST>:5173`, `ALLOWED_ORIGINS=http://<LAN_HOST>:5173,http://localhost:5173`, `DEBUG_INVARIANTS=1` (the engine invariants run after every state change) and **fake billing** (`BILLING_MODE=fake`, `ALLOW_FAKE_BILLING=1`; see [Billing](#billing-payments-specmd)).
   - `vite --host 0.0.0.0 --port 5173 --strictPort` (hot reload for the phone UI).
4. Prints the URLs:
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
- **Local state.** Wrangler keeps Durable Object storage in `server/.wrangler/state`. Delete that folder to drop all local rooms.
- **Proxy warnings.** Behind an HTTP proxy, wrangler logs `Unable to fetch the Request.cf object` and `Request was cancelled`. Both are harmless.

### Running only the server

```sh
pnpm --filter @mishana/server exec wrangler dev --port 8787
curl -s localhost:8787/healthz                     # {"ok":true,"app":"mish-ana","protocol":1}
curl -s -X POST localhost:8787/api/rooms           # {"code":"KXRT","tvToken":"…","joinUrl":"…","wsPath":"/parties/room/KXRT","entitlement":"NONE"}
```

`wrangler.jsonc` points `assets.directory` at `../web-client/dist`, so build the web client first (`pnpm --filter @mishana/web-client build`). Wrangler refuses to start when that folder is missing.

## Tests and checks

| Command | What it runs |
|---|---|
| `pnpm test` | Every Vitest project: `shared`, `server`, `web-client`, `word-packs`, `tools/*` |
| `pnpm test:coverage` | The same, with the engine coverage gate (≥ 90 %) |
| `pnpm lint` / `pnpm typecheck` | ESLint (flat config) and `tsc -p .` in every package |
| `pnpm sim --players 3..12 --games 500` | Engine-mode bot games on the real packs with invariant, termination, role-count and leak checks, and the Blank-never-opens rule at every round and tie-break. The full catalog is equivalent to a Premium room; add `--access free` to play the free starter packs only (locked packs must never be picked, views carry locked-pack metadata only) |
| `pnpm sim --ws http://127.0.0.1:8787 --players 4 --games 3` | **WS mode** against a running server (see below) |
| `pnpm --filter @mishana/web-client build` | Vite production build into `web-client/dist`, then the 60 KB gzip phone budget (`web-client/scripts/check-size.mjs`, TV mock excluded) |
| `pnpm --filter @mishana/server build` | Wrangler dry-run bundle (minified) into `server/dist`, then the 400 KB script budget (`server/scripts/check-size.mjs`) |
| `pnpm fixtures` / `pnpm --filter @mishana/shared run check:fixtures` | Regenerate or verify `shared/fixtures/*.json` |
| `pnpm lint:packs` / `pnpm --filter @mishana/pack-lint run lint -- --release` | Pack lint. `--release` (run by `pnpm run deploy`) fails when a free starter pack has fewer than 40 pairs |
| `pnpm --filter @mishana/server billing:products` | CSV of every premium pack (`productId,packId,locale,titleEn,titleFr,titleAr`) for Play Console |

To run one project: `pnpm vitest run --project server` (or `shared`, `sim`, …).

Test support lives in `shared/src/testing` and is imported as `@mishana/shared/testing` (from shared tests: `../../src/testing`): the scripted `Game` driver, the seeded bot driver `playGame` with its per-step checks, the secret-leak checker and the test catalogs. The server tests, `tools/sim` and the fixture generator use the same code.

### Server tests (`server/test`)

The server tests run in Node. They drive `RoomCore` (`server/src/room-core.ts`) through in-memory fakes in `server/test/support/fakes.ts`: storage with an alarm, sockets, a clock and real WebCrypto. `Harness.startedGame({ n, settings, ready })` sets up a TV, `n` players and a started game with the timers off. They never import `room.ts` or `index.ts`, so no workerd is needed. The suites cover:

- hello, join, actions and KICK/LEAVE;
- rate limits and frame checks;
- connection caps;
- alarms and expiry;
- `initRoom` on live and expired rooms;
- concurrency (the mutex);
- hibernation: a fresh `RoomCore` on the same storage behaves identically, and a restart with no live sockets marks players disconnected and applies the speaker grace rule;
- HTTP handlers, room codes, tokens and the Origin check;
- room access (PAYMENTS-SPEC §3.11): entitlement and `storeOpen` messages, locked-pack and premium-setting pre-checks, restrictions, the TV-busy flag (`room-core.access.test.ts`, `access.test.ts`);
- billing (`server/test/billing/*`): the Billing DO core against real SQLite (`node:sqlite`, flag-free in Node 22.22; it prints an `ExperimentalWarning`), the Google client with a mocked `fetch`, RTDN with locally generated OIDC keys, routes, cron, the fake mode guards and the log redaction test. `Harness` takes `{ entitlement, billingMode, billing }`; a room with no entitlement is a free room.

### WS mode: end-to-end over the protocol

With a server running (`pnpm dev`, or `wrangler dev` alone):

```sh
pnpm sim --ws http://127.0.0.1:8787 --players 3..12 --games 3
```

For each player count the sim:

- creates a room over HTTP and checks `Cache-Control: no-store`;
- opens a TV socket and N phone sockets (no `Origin`) and checks ping/pong;
- plays full games with all timers off (bots READY, give clues, vote and guess; the TV advances ELIMINATION and verdicts) and runs PLAY_AGAIN between games.

Along the way it checks that:

- **killing and resuming a player socket mid-game** restores the same `playerId` and token through `welcome`;
- every server frame parses with `ServerMessageSchema`;
- `seq` never goes backwards;
- every TV state satisfies SPEC §5.4: no secret word, no alive revealed role and no guess text before RESULTS.

The same check is available as an opt-in Vitest case: `MISHANA_WS_URL=http://127.0.0.1:8787 pnpm vitest run --project sim`.

**Manual restart check** (a real DO reset):

1. Start a game.
2. Stop `wrangler dev` and start it again (the state persists in `.wrangler/state`).
3. Reconnect the TV with its token and the phones with their resume tokens.

The room comes back in the same phase with the same words. On the first connection, the `onStart` reconcile marks everyone disconnected. Each resume then reconnects its seat.

## How the server is put together

- `server/src/index.ts`: the Worker. In order:
  1. `GET /healthz`;
  2. `POST /api/rooms`, `/api/billing/*` (PAYMENTS-SPEC §3.4), and 405 for any other request under `/api/*`;
  3. WebSocket upgrades to `/parties/room/{CODE}`: the Worker checks the code regex, returns 400 unless `_pk` matches `^[A-Za-z0-9_-]{1,64}$` and `cid` matches `^[A-Za-z0-9-]{8,64}$`, applies the per-IP `CONNECT_LIMITER`, then routes through partyserver, which runs the Origin check in `onBeforeConnect`.

  Everything else is served by the static-assets layer, with SPA fallback.
- `server/src/http.ts`: room creation. It draws a code by rejection sampling, hashes the TV token, calls `initRoom` over native RPC (retrying up to 10 codes on collision) and returns 201 with `no-store`.
- `server/src/room.ts`: a thin partyserver `Server` (`hibernate: true`). It sets the ping/pong auto-response and forwards every entry point to `RoomCore`.
- `server/src/room-core.ts`: all behaviour. Every entry point runs through one FIFO mutex. Each change goes read → reduce → persist (`meta`, `state` and `sessions` in DO storage) → broadcast per-connection projections → reschedule the alarm (the minimum of the engine wake time, the room expiry and the hello deadline).
- Per-socket data lives in the hibernation-safe attachment: role, playerId, `cid`, a truncated IP hash, epoch and rate-limit bucket. Resume and TV tokens are stored only as SHA-256 hashes and compared in constant time.
- Connection caps: at most `MAX_CONNECTIONS_PER_ROOM` (40) non-spectator sockets (pending, TV, joined players) and, separately, `MAX_SPECTATORS_PER_ROOM` (16) spectators (said hello as a player but have not joined). A spectator flood therefore cannot lock out the TV or a resume-token reconnect. When `MAX_PENDING_CONNECTIONS` is reached, a new socket evicts the oldest pending one (4009). Every inbound frame takes a rate-limit token; binary and oversize frames also count as strikes (three in 10 s → 4008). Room activity (idle TTL) is refreshed only by a TV hello, a resume, a join or an accepted action.
- Known local-dev effect: on `wrangler dev`, a close sent from inside `onConnect` (4004 room not found, 4009 room full) reaches the client about 10 s late, because it is issued before partyserver returns the 101. Closes sent from `onMessage` arrive at once. Bad `_pk` and `cid` values are rejected with 400 before the upgrade, so they are not affected. This has not been checked against a deployed Worker; check it before shipping.
- Server code never logs message bodies, state, words, guesses, tokens, names or IPs. The catch-all logs `{code, phase, roomCode}` only.
- Billing (PAYMENTS-SPEC §3): `/api/billing/*` is handled by `server/src/billing/routes.ts`; purchase state lives in the single `Billing` Durable Object (`env.BILLING.getByName("global")`, SQLite). The Room DO only gets the public entitlement verify keys and plays `playableCatalog(full, access)` (`server/src/access.ts`), so a locked pack's words can never be picked or projected.

## Billing (PAYMENTS-SPEC.md)

The binding contract is [PAYMENTS-SPEC.md](PAYMENTS-SPEC.md). The server stores purchase state in the `Billing` DO, checks every purchase token with Google, and signs an 8-hour Ed25519 **entitlement token** that the TV sends with `POST /api/rooms` and the WS `entitlement` message.

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
  -d "{\"installId\":\"$I\",\"productId\":\"premium\",\"basePlanId\":\"yearly\",\"offerId\":\"trial-7d\"}"   # {"purchaseToken":"fake.sub.premium.1"}
curl -s -X POST $B/api/billing/verify -H 'Content-Type: application/json' \
  -d "{\"installId\":\"$I\",\"purchases\":[{\"productId\":\"premium\",\"purchaseToken\":\"fake.sub.premium.1\"}]}"
curl -s -X POST $B/api/billing/fake/set -H 'Content-Type: application/json' \
  -d '{"purchaseToken":"fake.sub.premium.1","state":"SUBSCRIPTION_STATE_EXPIRED"}'          # 204; same path as an RTDN
```

`fake/purchase` takes `outcome: "PENDING"` for a pending purchase; `fake/set` takes any `SUBSCRIPTION_STATE_*` for a subscription, or `PURCHASED | PENDING | CANCELLED | REVOKED` for a pack. Outside fake mode both routes answer 404 (or 503 when fake mode was asked for but refused).

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

```sh
pnpm --filter @mishana/server gen:entitlement-key            # prints {"kid":"k1","x":"…","d":"…"}; -- --kid k2 for the next one
cd server && npx wrangler secret put ENTITLEMENT_KEYS          # paste {"active":"k1","keys":[ <that object> ]}
npx wrangler secret put PLAY_SERVICE_ACCOUNT_JSON < ../play-api.json
```

- `wrangler.jsonc` lists both under `secrets.required`, so `wrangler deploy` fails when one is missing; local dev only warns.
- **Key rotation:** generate `k2`, add it to `keys`, set `"active":"k2"`, deploy; remove `k1` (or keep only its `x`) after at least 16 h (2 × token TTL; 24 h recommended).
- **Local Google mode:** put the secrets and non-fake vars in `server/.dev.vars` (git-ignored, `.dev.vars*`) and run `wrangler dev` without the fake `--var`s. Never use `pnpm dev` for this: it forces fake mode, and a configured service account disables fake mode (503).
- Only `server/src/billing/**` reads `PLAY_SERVICE_ACCOUNT_JSON` (ESLint `no-restricted-syntax`). The Room DO parses `ENTITLEMENT_KEYS` with the private halves dropped.

### Vars, observability and logs

- Vars: `PLAY_PACKAGE_NAME` (`app.mishana.tv`), `RTDN_AUDIENCE` (`https://<your-domain>/api/billing/rtdn`), `RTDN_SA_EMAIL` (the push service account), `RTDN_SUBSCRIPTION` (`projects/<project>/subscriptions/play-rtdn-push`). Until the RTDN vars are set, `/api/billing/rtdn` answers 503 and Pub/Sub retries.
- **Workers traces stay disabled** (`observability.traces.enabled: false`, enforced by `check-deploy.mjs`): traces record outbound fetch URLs, and every Google Play call carries a raw purchase token in its path. Do not add Logpush or a Tail Worker without revisiting PAYMENTS-SPEC §3.2.
- Billing code logs only through `billingLog(code, fields)` (`server/src/billing/log.ts`), which keeps numbers, booleans and a few enum strings and redacts every other string. Alert on the codes `BILLING_ACK_OVERDUE`, `BILLING_ACK_REJECTED`, `BILLING_AUTH`, `BILLING_BUDGET`, `BILLING_SUB_STALE`, `RTDN_AUTH` (PAYMENTS-SPEC §8.D).

### Before the first production release

- `pnpm run deploy` (never bare `pnpm deploy`: pnpm 10 runs its built-in `deploy` command instead of the script) runs `pack-lint --release`: each free starter pack (`*-everyday-01`) needs at least **40 pairs** (they have 24 today, so the deploy fails until they grow).
- Create the Play products from `pnpm --filter @mishana/server billing:products` (PAYMENTS-SPEC §8.B).
- Replace the rate-limit `namespace_id`s `1003`/`1004` like `1001`/`1002`.

## Deploy (Cloudflare)

1. Log in once: `pnpm --filter @mishana/server exec wrangler login`.
2. **Rate-limit namespaces.** `namespace_id` must be a positive integer string that is unique in your account. `"1001"` to `"1004"` in `server/wrangler.jsonc` work locally; change them if they collide with other Workers.
3. **Billing secrets and vars:** see [Billing](#billing-payments-specmd). `wrangler deploy` fails while `PLAY_SERVICE_ACCOUNT_JSON` or `ENTITLEMENT_KEYS` is missing.
4. Deploy: `pnpm run deploy`. This builds the web client, dry-run bundles the Worker, runs `pack-lint --release` and `check-deploy.mjs` (google billing, fake billing off, traces off), then `wrangler deploy`. The Worker is served at `https://play.<your-subdomain>.workers.dev`.
5. **Custom domain** (optional). Add the domain to the Worker in the Cloudflare dashboard, then set `JOIN_BASE_URL` (see below).
6. Build the TV app against the deployed URL (see below and [TV.md](TV.md#production-server-url)).

### Production URLs

Nothing in the repo names a real domain. There are exactly three settings, all empty or placeholders until you deploy:

| Setting | Where | Placeholder / default | Set it to |
|---|---|---|---|
| TV app server URL → `BuildConfig.SERVER_URL` | `mishana.prodServerUrl` in `tv-app/gradle.properties`, or `-PserverUrl=…` / env `ORG_GRADLE_PROJECT_serverUrl` | `https://mish-ana.example.workers.dev` (placeholder; release builds refuse it, and refuse any non-`https://` URL) | The Worker origin: the `https://play.<your-subdomain>.workers.dev` URL printed by `pnpm run deploy`, or `https://<your-domain>`. No trailing slash, no path |
| Phone join base URL (QR code and join link) | `JOIN_BASE_URL` in `server/wrangler.jsonc` `vars` (or the dashboard) | `""` = the origin the TV called, i.e. the same URL as above | Leave empty on `*.workers.dev`. With a custom domain: `https://<your-domain>`, so QR codes do not show the `workers.dev` host |
| Extra browser origins | `ALLOWED_ORIGINS` in `server/wrangler.jsonc` `vars` | `""` = same-origin only | Leave empty in production (the Worker serves the phone page itself). Only for a web client hosted elsewhere: a comma-separated list of exact origins |

The phone client has no server URL of its own: it is served by the Worker and connects to `location.host` (in dev, Vite proxies `/api`, `/parties` and `/healthz` to `:8787`). So `JOIN_BASE_URL` must point at an origin that serves this Worker.

Checklist after `pnpm run deploy`:

1. `curl https://<worker-origin>/healthz` prints `{"ok":true,…}`.
2. With a custom domain: set `JOIN_BASE_URL`, run `pnpm run deploy` again.
3. Put the same origin in `tv-app/gradle.properties` (`mishana.prodServerUrl=https://…`) and run `./gradlew :app:bundleRelease`; the build log prints `Mish Ana! release server URL: …`.
4. Open `/tv` on the deployed origin: the QR code must show the intended host.

Keep `DEBUG_INVARIANTS` at `"0"` in production. Workers observability (logs) is enabled with traces off, and the logging rules above keep player data and purchase tokens out of it.
