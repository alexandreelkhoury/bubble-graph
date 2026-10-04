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
   - `wrangler dev --ip 0.0.0.0 --port 8787` with `JOIN_BASE_URL=http://<LAN_HOST>:5173`, `ALLOWED_ORIGINS=http://<LAN_HOST>:5173,http://localhost:5173` and `DEBUG_INVARIANTS=1` (the engine invariants run after every state change).
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
curl -s -X POST localhost:8787/api/rooms           # {"code":"KXRT","tvToken":"…","joinUrl":"…","wsPath":"/parties/room/KXRT"}
```

`wrangler.jsonc` points `assets.directory` at `../web-client/dist`, so build the web client first (`pnpm --filter @mishana/web-client build`). Wrangler refuses to start when that folder is missing.

## Tests and checks

| Command | What it runs |
|---|---|
| `pnpm test` | Every Vitest project: `shared`, `server`, `web-client`, `word-packs`, `tools/*` |
| `pnpm test:coverage` | The same, with the engine coverage gate (≥ 90 %) |
| `pnpm lint` / `pnpm typecheck` | ESLint (flat config) and `tsc -p .` in every package |
| `pnpm sim --players 3..12 --games 500` | Engine-mode bot games on the real packs with invariant, termination, role-count and leak checks, and the Blank-never-opens rule at every round and tie-break |
| `pnpm sim --ws http://127.0.0.1:8787 --players 4 --games 3` | **WS mode** against a running server (see below) |
| `pnpm --filter @mishana/web-client build` | Vite production build into `web-client/dist`, then the 60 KB gzip phone budget (`web-client/scripts/check-size.mjs`, TV mock excluded) |
| `pnpm --filter @mishana/server build` | Wrangler dry-run bundle (minified) into `server/dist`, then the 400 KB script budget (`server/scripts/check-size.mjs`) |
| `pnpm fixtures` / `pnpm --filter @mishana/shared run check:fixtures` | Regenerate or verify `shared/fixtures/*.json` |

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
- HTTP handlers, room codes, tokens and the Origin check.

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
  2. `POST /api/rooms`, and 405 for any other request under `/api/*`;
  3. WebSocket upgrades to `/parties/room/{CODE}`: the Worker checks the code regex, returns 400 unless `_pk` matches `^[A-Za-z0-9_-]{1,64}$` and `cid` matches `^[A-Za-z0-9-]{8,64}$`, applies the per-IP `CONNECT_LIMITER`, then routes through partyserver, which runs the Origin check in `onBeforeConnect`.

  Everything else is served by the static-assets layer, with SPA fallback.
- `server/src/http.ts`: room creation. It draws a code by rejection sampling, hashes the TV token, calls `initRoom` over native RPC (retrying up to 10 codes on collision) and returns 201 with `no-store`.
- `server/src/room.ts`: a thin partyserver `Server` (`hibernate: true`). It sets the ping/pong auto-response and forwards every entry point to `RoomCore`.
- `server/src/room-core.ts`: all behaviour. Every entry point runs through one FIFO mutex. Each change goes read → reduce → persist (`meta`, `state` and `sessions` in DO storage) → broadcast per-connection projections → reschedule the alarm (the minimum of the engine wake time, the room expiry and the hello deadline).
- Per-socket data lives in the hibernation-safe attachment: role, playerId, `cid`, a truncated IP hash, epoch and rate-limit bucket. Resume and TV tokens are stored only as SHA-256 hashes and compared in constant time.
- Connection caps: at most `MAX_CONNECTIONS_PER_ROOM` (40) non-spectator sockets (pending, TV, joined players) and, separately, `MAX_SPECTATORS_PER_ROOM` (16) spectators (said hello as a player but have not joined). A spectator flood therefore cannot lock out the TV or a resume-token reconnect. When `MAX_PENDING_CONNECTIONS` is reached, a new socket evicts the oldest pending one (4009). Every inbound frame takes a rate-limit token; binary and oversize frames also count as strikes (three in 10 s → 4008). Room activity (idle TTL) is refreshed only by a TV hello, a resume, a join or an accepted action.
- Known local-dev effect: on `wrangler dev`, a close sent from inside `onConnect` (4004 room not found, 4009 room full) reaches the client about 10 s late, because it is issued before partyserver returns the 101. Closes sent from `onMessage` arrive at once. Bad `_pk` and `cid` values are rejected with 400 before the upgrade, so they are not affected. This has not been checked against a deployed Worker; check it before shipping.
- Server code never logs message bodies, state, words, guesses, tokens, names or IPs. The catch-all logs `{code, phase, roomCode}` only.

## Deploy (Cloudflare)

1. Log in once: `pnpm --filter @mishana/server exec wrangler login`.
2. **Rate-limit namespaces.** `namespace_id` must be a positive integer string that is unique in your account. `"1001"` and `"1002"` in `server/wrangler.jsonc` work locally; change them if they collide with other Workers.
3. Deploy: `pnpm run deploy`. This builds the web client, dry-run bundles the Worker, then runs `wrangler deploy`. The Worker is served at `https://play.<your-subdomain>.workers.dev`.
4. **Custom domain** (optional). Add the domain to the Worker in the Cloudflare dashboard, then set `JOIN_BASE_URL` (see below).
5. Build the TV app against the deployed URL (see below and [TV.md](TV.md#production-server-url)).

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

Keep `DEBUG_INVARIANTS` at `"0"` in production. Workers observability is enabled, and the logging rules above keep player data out of it.
