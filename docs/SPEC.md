# SPEC — Mish Ana! (مش أنا!) v1 implementation contract

Status: **binding** for the four implementer agents. It builds on [PLAN.md](PLAN.md) and [RESEARCH.md](RESEARCH.md) with the approved answers to PLAN §8. Where this file and PLAN differ, **this file wins**. Deviations from PLAN are listed in §0.3.

**Precedence over DESIGN.md.** [DESIGN.md](DESIGN.md) governs visuals, layout, motion and copy tone only. Every identifier, key, enum, colour id, placeholder syntax, error code, setting, timing constant and protocol field comes from this file. Where DESIGN differs, **SPEC wins**, and the implementer adds a `// SPEC-GAP` note only if SPEC is silent. §0.5 lists the DESIGN features that are out of v1.

Verified 2026-10-03 in a scratch workspace (pnpm 10.28.0, Node 22.22.0):
- The pinned npm set installs cleanly.
- A minimal partyserver `Room` passes `tsc --strict`.
- `wrangler dev` (4.147.0) serves `GET /healthz`, `POST /api/rooms` (with the rate-limit binding and a `getByName` stub call), the SPA fallback for `/WXYZ`, and a WebSocket upgrade on `/parties/room/ABCD?_pk=…`.

Items marked **[VERIFY]** could not be checked here, mostly Android/Google Maven because dl.google.com is blocked. The implementer checks each one before relying on it.

---

## 0. Conventions

### 0.1 Agents and file ownership

Each agent writes **only** the paths it owns. Paths not listed here are frozen. Nobody commits to git.

| Agent | Owns (write access) |
|---|---|
| **A — shared+server** | `/package.json`, `/pnpm-workspace.yaml`, `/tsconfig.base.json`, `/eslint.config.js`, `/vitest.config.ts`, `/.gitignore`, `/.nvmrc`, `/.env.example`, `/shared/**` **except** `/shared/i18n/*.json`, `/server/**`, `/tools/sim/**`, `/tools/dev.mjs`, `/docs/DEV.md` |
| **B — web-client** | `/web-client/**` |
| **C — tv-app** | `/tv-app/**` **except** the generated files listed under D, plus `/docs/TV.md` and `/assets/brand/**` (source SVGs; placeholder banner and icon until M5) |
| **D — word-packs/i18n** | `/shared/i18n/en.json`, `/shared/i18n/fr.json`, `/shared/i18n/ar.json`, `/word-packs/**`, `/tools/gen-android-strings/**`, `/tools/pack-lint/**`, `/THIRD_PARTY.md`, generated files `/tv-app/app/src/main/res/values/strings_generated.xml`, `/tv-app/app/src/main/res/values-fr/strings_generated.xml`, `/tv-app/app/src/main/res/values-ar/strings_generated.xml`, `/tv-app/app/src/main/java/app/mishana/tv/i18n/I18nKeys.kt` |

**Build order (§0.4).** D runs a short **phase 0** before A, B and C start. A, B and C never create D's files, not even as stubs.

**Seams.** Agents never talk to each other, so every name that crosses a package boundary is defined here:

| Defined in | What it fixes |
|---|---|
| §3 | Brand and constants |
| §4–§5 | Engine and views |
| §6 | Wire protocol |
| §10 | Fixtures |
| §11 | i18n keys |
| §12 | Pack schema |

If an agent needs something this file does not define, it chooses the most conservative option, writes `// SPEC-GAP: <description>` at the site, and lists it in its final report.

### 0.2 Language rules
- TypeScript is `strict` everywhere, and `any` is a lint error. Relative imports have no file extension (`./engine/reduce`). Type-only imports use `import type`.
- Server→client JSON never omits keys. A missing value is `null`. Client→server JSON may omit optional keys.
- Times are epoch milliseconds as JSON numbers: `number` in TypeScript, `Long` in Kotlin. Durations are in ms (`*Ms`) or seconds (`*Seconds`), as the name says.
- IDs and tokens are lowercase hex.

### 0.3 Deviations from PLAN (intentional)

| PLAN | SPEC | Why |
|---|---|---|
| `reduce(state, action, rng)` / ctx `{now, rng}` | `reduce(state, action, ctx: {now, catalog})`. The RNG lives **in state** as `rngState: uint32` (mulberry32) | Replay and persistence: the DO stores one object, and the same seed plus the same actions give the same state |
| System actions `TIMER_EXPIRED{deadlineId}` | One system action, `TICK`. It is idempotent: the engine compares `ctx.now` with `deadline.at` and the seat expiries | Stale or duplicate alarms are harmless no-ops, so no `deadlineId` matching is needed |
| Seat held 120 s in all phases | 120 s in `LOBBY` only. **In-game and RESULTS seats are held until the room returns to LOBBY**, which restarts the 120 s hold: turns are skipped and votes abstain while the player is away. The TV (or the VIP, for disconnected players) may `KICK` | Simpler, never stalls, and keeps results stable |
| App-level ping `{ts}` | Ping and pong are **byte-exact constant strings**, answered by the DO auto-response without waking it | Hibernation cost |
| `rosetta` on web | A ~40-line in-house `t()` with `{name}` placeholders | Same placeholder syntax as the Android generator. One fewer dependency |
| `TvView`/`PlayerView` separate | `PublicView`, extended by `kind:"tv"` or by `kind:"player"` plus `me` | One projection, so there is less to keep in sync and less risk of leaks |
| "Clients only ever receive `correct: bool`" | Clients receive `guess.status` (`PENDING/CORRECT/WRONG/TIMEOUT`). The guess **text** is `null` in every view until RESULTS, where it appears in `result.guesses` | The verdict is public anyway; the text could leak the Civilian word to Undercovers before RESULTS |
| Seat held 120 s, kicked/left players dropped | Players who LEAVE or are KICKed in-game or in RESULTS are marked `left:true` and removed at the next `resetToLobby` (never dealt in again) | Keeps role counts and results stable until the lobby |
| Joins 5/min per IP per room; 20 msg/s | 30 joins/min per IP per room; 5 msg/s with burst 10; a per-IP WebSocket connect limiter | A whole party shares one public IP (home Wi-Fi NAT) |
| — | EN shows the `UNDERCOVER` role as **"Mole"** (keys and enums stay `undercover`/`UNDERCOVER`) | RESEARCH §6: keep the trademarked word out of the UI |

### 0.4 Build order (phase 0)
Agents run in parallel and never talk, but A's typecheck and tests import D's files. So:
1. **Phase 0 (D, first, short).** D delivers `shared/i18n/en.json`, `fr.json` and `ar.json` with the **complete** §11.2 key set (FR/AR may temporarily copy EN), plus `word-packs/package.json`, `word-packs/index.ts` and one valid pack of ≥20 pairs per language (`en`, `fr`, `ar`).
2. **Phase 1 (A, B, C, and D continuing).** A, B and C start only after phase 0 exists. D keeps refining strings and packs. It must not rename or remove §11.2 keys.
3. The §15 "done" gates for A, B and C are evaluated after phase 0.

### 0.5 DESIGN.md features out of v1
Implementers skip these DESIGN items. They need protocol or scope that v1 does not have.
- Pausing timers for everyone (PAUSE/RESUME), and the phone "Paused on the TV" overlay. The TV pause menu is local and says "The game keeps running" (`tv.pauseNote`).
- Tie-break naming "wheel". The setting is `tieBreak: "random" | "none"`. The TV may still *animate* a random pick as a wheel (DESIGN TV-09 variant).
- Sound settings, volume, phone sounds, and the sound cue assets (M4). B and C may leave hooks.
- TV-15 How to play (M4), the "Display" settings category, "Hide room code" and "Show transliteration" (translit is shown whenever it is non-null).
- The away countdown ring (`disconnectedAt` is not projected; use a static away badge), the `blankTyping` indicator, and a CLOSE_ROOM intent.
- Interactive TV Home: Home is a splash plus "creating / failed" states only (§9.6).

## 1. Repository layout

```
/package.json  /pnpm-workspace.yaml  /tsconfig.base.json  /eslint.config.js  /vitest.config.ts
/.gitignore  /.nvmrc  /.env.example  /THIRD_PARTY.md
/shared/                    @mishana/shared   (A; i18n JSON by D)
  package.json tsconfig.json vitest.config.ts
  src/brand.ts src/constants.ts src/index.ts
  src/engine/{index,types,settings,roles,rng,reduce,draft,queries,lifecycle,turns,departures,membership,votes,win,scoring,normalize,sanitize,invariants,catalog}.ts
  src/protocol/{index,common,messages,views,errors,http}.ts
  src/projection/{index,project}.ts
  src/packs/{index,schema}.ts
  src/testing/{index,game,bots,leak-check,test-catalog}.ts   (test support; `@mishana/shared/testing`)
  src/i18n/index.ts          (types + helpers; loads ../../i18n/*.json)
  i18n/en.json fr.json ar.json          (D)
  fixtures/*.json                       (A)
  scripts/gen-fixtures.ts               (A)
  test/**                               (A)
/server/                    @mishana/server   (A)
  package.json tsconfig.json vitest.config.ts wrangler.jsonc
  src/index.ts src/env.ts src/room.ts src/room-core.ts src/room-store.ts src/frames.ts src/request.ts src/http.ts src/codes.ts src/tokens.ts src/origin.ts src/ratelimit.ts src/mutex.ts
  scripts/check-size.mjs   (bundle budget, run by `build`)
  (only index.ts and room.ts import partyserver or `cloudflare:workers`; tests never import those two)
  test/**
/web-client/                @mishana/web-client (B; includes public/_headers, §8.10)
/tv-app/                    Gradle project (C)
/word-packs/                @mishana/word-packs (D)
  package.json tsconfig.json vitest.config.ts index.ts packs/{en,fr,ar}/*.json test/**
/tools/
  dev.mjs                   (A; a plain file, not a Vitest project)
  sim/                      @mishana/sim (A)
  gen-android-strings/      @mishana/gen-android-strings (D)
  pack-lint/                @mishana/pack-lint (D)
/docs/ PLAN.md RESEARCH.md SPEC.md DEV.md(A) TV.md(C)
```

---

## 2. Root tooling (Agent A writes; others rely on it)

### 2.1 Pinned versions (exact, no `^`/`~`)

| Package | Version | Used by |
|---|---|---|
| pnpm (`packageManager`) | 10.28.0 | root |
| Node (`.nvmrc`, `engines`) | 22 (`>=22.12.0`) | root |
| typescript | 5.9.3 | all TS (TS 6/7 are out of scope; typescript-eslint needs <6.1) |
| vitest, @vitest/coverage-v8 | 4.1.11 | all TS (4.x line; 5.x is not adopted) |
| fast-check | 4.10.2 | shared, server |
| tsx | 4.23.15 | tools, scripts |
| eslint | 10.12.0 | root |
| @eslint/js | 10.0.1 | root |
| typescript-eslint | 8.71.0 | root |
| @types/node | 22.20.5 | tools, scripts |
| zod | 4.6.5 | shared (server-side validation; **the web bundle must not import zod**) |
| partyserver | 0.5.10 | server |
| wrangler | 4.147.0 | server |
| @cloudflare/workers-types | 5.20261003.1 | server |
| partysocket | 1.3.0 | web-client |
| preact | 10.29.8 | web-client |
| @preact/signals | 2.11.3 | web-client |
| vite | 8.3.2 | web-client |
| @preact/preset-vite | 2.10.6 | web-client |
| qrcode-generator | 2.0.4 | web-client (tv-mock only, lazy chunk) |
| @playwright/test | 1.63.0 | web-client e2e |
| ws | 8.20.0 | tools/sim |
| @types/ws | 8.18.2 | tools/sim |

### 2.2 `/pnpm-workspace.yaml` (exact)
```yaml
packages:
  - shared
  - server
  - web-client
  - word-packs
  - tools/*
onlyBuiltDependencies:
  - esbuild
  - workerd
  - sharp
```
`tools/dev.mjs` is a plain file, not a package.

### 2.3 `/package.json` (exact scripts; dev dependencies per §2.1)
```json
{
  "name": "mishana",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.28.0",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "node tools/dev.mjs",
    "build": "pnpm --filter @mishana/web-client run build && pnpm --filter @mishana/server run build",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "sim": "pnpm --filter @mishana/sim run sim",
    "lint": "eslint .",
    "typecheck": "pnpm -r --if-present run typecheck",
    "fixtures": "pnpm --filter @mishana/shared run gen:fixtures",
    "gen:strings": "pnpm --filter @mishana/gen-android-strings run gen",
    "lint:packs": "pnpm --filter @mishana/pack-lint run lint",
    "e2e": "pnpm --filter @mishana/web-client run e2e",
    "deploy": "pnpm run build && pnpm --filter @mishana/server run deploy"
  },
  "devDependencies": {
    "typescript": "5.9.3", "vitest": "4.1.11", "@vitest/coverage-v8": "4.1.11",
    "fast-check": "4.10.2", "tsx": "4.23.15", "eslint": "10.12.0", "@eslint/js": "10.0.1",
    "typescript-eslint": "8.71.0", "@types/node": "22.20.5"
  }
}
```
`pnpm sim --players 3..12 --games 500` works because pnpm forwards extra args to the script. The `@mishana/sim` script is `"sim": "tsx src/main.ts"`.

### 2.4 `/tsconfig.base.json` (exact)
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  }
}
```
Package tsconfigs `extend` it:
- shared: `lib ["ES2023"]`.
- server: `types ["@cloudflare/workers-types"]`.
- web-client: `lib ["ES2023","DOM","DOM.Iterable"]`, `jsx "react-jsx"`, `jsxImportSource "preact"`.
- tools: `types ["node"]`.

Every TS package has the script `"typecheck": "tsc -p ."`.

### 2.5 Workspace consumption of `@mishana/shared`
There is no build step. Every consumer (tsx, vite, wrangler/esbuild, vitest) compiles TS source directly. `shared/package.json`:
```json
{
  "name": "@mishana/shared", "version": "0.0.0", "private": true, "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./engine": "./src/engine/index.ts",
    "./protocol": "./src/protocol/index.ts",
    "./projection": "./src/projection/index.ts",
    "./packs": "./src/packs/index.ts",
    "./testing": "./src/testing/index.ts",
    "./brand": "./src/brand.ts",
    "./constants": "./src/constants.ts",
    "./i18n": "./src/i18n/index.ts",
    "./i18n/*.json": "./i18n/*.json",
    "./fixtures/*": "./fixtures/*"
  },
  "scripts": { "typecheck": "tsc -p .", "gen:fixtures": "tsx scripts/gen-fixtures.ts", "check:fixtures": "tsx scripts/gen-fixtures.ts --check" },
  "dependencies": { "zod": "4.6.5" }
}
```
**Zod-free entry points:** `./brand`, `./constants`, `./i18n`, `./engine` (for `sanitizeName`, `nameKey`, `normalizeGuess`, `SETTINGS_BOUNDS`; the engine never imports zod), and the **types** of `./protocol`.
- The web client may import these at runtime.
- It may only use `import type` from `./protocol` and `./projection`.

Rule: `src/engine/**` must not import zod. Zod lives only in `src/protocol/**` and `src/packs/**` (and `src/testing/**`, which builds the test catalog through `loadCatalog`). Zod is always imported as a namespace, `import * as z from "zod"`, so bundlers can drop the unused parts (`import { z }` pulls in every locale pack).

`./testing` is test support only: the scripted driver `Game` (`T0`, `TV`, `SYS`, `P`, `pid`, `TIMERS_OFF`, `lobby`, `inClues`, `findSeed`), the seeded bot driver `playGame` with its cross-step checks (`checkStep`, `isOpening`, `blankOpensViolation`), the secret-leak checker (`findLeaks`, `FORBIDDEN_KEYS`) and the test catalogs (`TEST_CATALOG`, `makeTokenCatalog`). Shared tests, server tests, `tools/sim` and the fixture generator import it; the web client and the Worker never do.

### 2.6 `/vitest.config.ts`
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    projects: ["shared", "server", "web-client", "word-packs", "tools/*/vitest.config.ts"],
    coverage: {
      provider: "v8",
      include: ["shared/src/engine/**"],
      thresholds: { branches: 90, lines: 90, functions: 90, statements: 90 },
    },
  },
});
```
Every package directory has its own `vitest.config.ts` using `defineProject({ test: { name: "<pkg>", environment: "node", passWithNoTests: true } })`.
- The `tools/*/vitest.config.ts` glob is deliberate. Vitest 4.1.11 refuses a `projects` glob that matches a plain file such as `tools/dev.mjs`.
- Long tests set an explicit timeout: `projection/leak.test.ts`, `engine/props.test.ts` and `engine/golden.test.ts` pass `{ timeout: 120_000 }` per test. The 1,000 leak games run as 10 `test.each` batches of 100 seeds, so a failure names its seed range.

### 2.7 `/eslint.config.js`
Flat config using `@eslint/js` recommended plus `typescript-eslint` `recommended` (non type-aware).
- Rules: `@typescript-eslint/no-explicit-any: error` and `@typescript-eslint/consistent-type-imports: error`.
- Ignores: `**/dist/**`, `**/node_modules/**`, `**/.wrangler/**`, `coverage/**`, `tv-app/**`, `web-client/test-results/**`, `web-client/playwright-report/**`.

### 2.8 `/.gitignore` additions
```
node_modules/
dist/
.wrangler/
coverage/
.env
.dev.vars
tv-app/.gradle/
tv-app/build/
tv-app/app/build/
tv-app/local.properties
web-client/test-results/
web-client/playwright-report/
```
`.env.example` contains `LAN_HOST=` with an explanatory comment.

---

## 3. Brand and constants (`shared/src/brand.ts`, `shared/src/constants.ts`)

The name lives in one place per platform: `BRAND` (TS), `Brand.kt` (Kotlin, hand-written, mirrors `BRAND.name`/`nameAr`), and the i18n keys `brand.appName` and `brand.slogan`. Renaming means changing those plus the banner and icon assets in `/assets/brand/` and `tv-app` resources. DESIGN.md's brand constant names (`APP_NAME_LATIN`, `APP_SLUG="mishana"`, `app.*` keys) are superseded by this section.

```ts
// brand.ts
export const BRAND = {
  name: "Mish Ana!",
  nameAr: "مش أنا!",
  slug: "mish-ana",            // worker name, URL slug
  storagePrefix: "mishana",   // localStorage / prefs prefix
  androidAppId: "app.mishana.tv",
} as const;
```

```ts
// constants.ts
export const PROTOCOL_VERSION = 1;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ"; // 23 letters, no I L O
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_REGEX = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`); // = /^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/
export const PARTY_NAME = "room";              // kebab of DO binding "Room"
export const WS_PATH_PREFIX = "/parties/room/"; // + CODE
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const NAME_MAX_CHARS = 16;   // graphemes (Intl.Segmenter) after sanitising
export const GUESS_MAX_CHARS = 40;
export const NAME_MAX_CODEPOINTS = 64;  // after sanitising; guards combining-mark abuse
export const SEAT_HOLD_MS = 120_000;    // LOBBY only (§4.8)
export const ELIMINATION_HOLD_MS = 8_000;
export const VERDICT_HOLD_MS = 8_000;
export const CLUE_GRACE_MS = 15_000;    // speaker disconnects mid-turn with the clue timer off
export const TIE_LEAD_IN_MS = 3_000;    // added to the first TIE_BREAK turn so the TV can show the tie
export const MAX_NO_ELIMINATION_STREAK = 3;
export const HEARTBEAT_INTERVAL_MS = 20_000;
export const PONG_TIMEOUT_MS = 10_000;
export const HELLO_TIMEOUT_MS = 10_000;
export const ROOM_EMPTY_TTL_MS = 15 * 60_000;
export const ROOM_IDLE_TTL_MS = 2 * 60 * 60_000;
export const ROOM_RESULTS_TTL_MS = 30 * 60_000;
export const MSG_MAX_BYTES = 4096;          // UTF-8 bytes (TextEncoder)
export const HTTP_BODY_MAX_BYTES = 1024;    // POST /api/rooms
export const RATE_MSGS_PER_SEC = 5;         // token bucket refill / s
export const RATE_BURST = 10;               // bucket capacity
export const JOINS_PER_MIN_PER_IP = 30;     // per room; a whole party shares one NAT IP
export const CREATE_ROOMS_PER_MIN_PER_IP = 10;
export const CONNECTS_PER_MIN_PER_IP = 60;  // Worker-level, all rooms (CONNECT_LIMITER)
export const MAX_CONNECTIONS_PER_ROOM = 40; // includes the new socket
export const MAX_PENDING_CONNECTIONS = 10;  // never-hello'd sockets per room
export const CLOSE_CODES = { BAD_CID: 4000, HELLO_TIMEOUT: 4001, UNSUPPORTED_VERSION: 4002, TV_AUTH_FAILED: 4003, ROOM_NOT_FOUND: 4004,
  REPLACED: 4005, KICKED: 4006, RATE_LIMITED: 4008, CAPACITY: 4009, ROOM_EXPIRED: 4010 } as const; // §6.4; re-exported by protocol/errors.ts
export const FATAL_CLOSE_CODES = [4002, 4003, 4004, 4005, 4006, 4010] as const; // client stops reconnecting (written via CLOSE_CODES; a test checks it equals the fatal ERROR_INFO close codes)
export const SLOW_RECONNECT_CLOSE_CODES = [4008, 4009] as const;                 // reconnect, but wait ≥ SLOW_RECONNECT_MS
export const SLOW_RECONNECT_MS = 10_000;
export const PING_FRAME = '{"v":1,"t":"ping"}'; // byte-exact
export const PONG_FRAME = '{"v":1,"t":"pong"}'; // byte-exact
export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
// Player colours: DESIGN §2.3 palette (CVD- and contrast-checked), in pick order. glyph = avatar glyph colour.
export const COLORS = [
  { id: "coral",     hex: "#F0183A", shape: "circle",   glyph: "ink" },
  { id: "azure",     hex: "#478CFF", shape: "square",   glyph: "ink" },
  { id: "lemon",     hex: "#FFF04D", shape: "star",     glyph: "ink" },
  { id: "jade",      hex: "#1FA88A", shape: "triangle", glyph: "ink" },
  { id: "grape",     hex: "#7A43FF", shape: "diamond",  glyph: "cream" },
  { id: "tangerine", hex: "#FF7A1F", shape: "hexagon",  glyph: "ink" },
  { id: "aqua",      hex: "#7BFFF4", shape: "plus",     glyph: "ink" },
  { id: "rose",      hex: "#FF96C5", shape: "drop",     glyph: "ink" },
  { id: "mint",      hex: "#BDF5C8", shape: "crescent", glyph: "ink" },
  { id: "plum",      hex: "#C02A8F", shape: "bolt",     glyph: "cream" },
  { id: "sand",      hex: "#E6C486", shape: "flower",   glyph: "ink" },
  { id: "lilac",     hex: "#C9BFFF", shape: "arch",     glyph: "ink" },
] as const;
export type ColorId = (typeof COLORS)[number]["id"];

// Settings bounds and UI step sizes (TV Left/Right, phone steppers). `off: 0` means 0 is allowed and means "timer off".
export const SETTINGS_BOUNDS = {
  undercoverCount: { min: 1, max: 5, step: 1 },
  blankCount:      { min: 0, max: 2, step: 1 },
  clueSeconds:     { off: 0, min: 10, max: 120, step: 5 },
  voteSeconds:     { off: 0, min: 15, max: 300, step: 15 },
  revealSeconds:   { off: 0, min: 10, max: 120, step: 5 },
  guessSeconds:    { off: 0, min: 10, max: 120, step: 5 },
  points:          { min: 0, max: 20, step: 1 },   // each of civilian/undercover/blank
  packIds:         { maxItems: 50, idRegex: "^[a-z0-9-]{1,40}$" },   // 40 = PACK_ID_MAX, also enforced by WordPackSchema
} as const;
```
A UI stepping down from `min` goes to `off` (when present) and stepping up from `off` goes to `min`. Kotlin mirrors all of §3 in `app.mishana.tv.Constants` (§9.3): the alphabet, timings, frames, `FATAL_CLOSE_CODES`, `SLOW_RECONNECT_CLOSE_CODES`, `SETTINGS_BOUNDS` and `COLORS` (id, ARGB, shape, glyph).

---

## 4. Engine (`shared/src/engine/**`, pure, no I/O, no `Date.now()`, no `Math.random()`)

### 4.1 Types (`types.ts`, exact names)
```ts
export const PHASES = ["LOBBY","ROLE_REVEAL","CLUES","VOTING","TIE_BREAK","ELIMINATION","MR_WHITE_GUESS","RESULTS"] as const;
export type Phase = (typeof PHASES)[number];
export type Role = "CIVILIAN" | "UNDERCOVER" | "BLANK";
export type Winner = "CIVILIANS" | "INFILTRATORS" | "BLANK";
export type DeadlineKind = "REVEAL" | "CLUE" | "VOTE" | "ELIMINATION" | "GUESS" | "VERDICT";
export type VoteOutcome = "ELIMINATED" | "TIE" | "RANDOM" | "NO_ELIMINATION";
export type GuessStatus = "PENDING" | "CORRECT" | "WRONG" | "TIMEOUT";
export type HistoryCause = "VOTE" | "RANDOM" | "KICK" | "LEAVE" | "NONE";

export interface WordRef { text: string; translit: string | null }
export interface WordSide { text: string; translit: string | null; alt: string[] }   // catalog-internal (alt never leaves server)
export interface RoleCounts { civilian: number; undercover: number; blank: number }
export interface Points { civilian: number; undercover: number; blank: number }

export interface Settings {
  winRule: "official" | "parity";
  revealRoles: boolean;
  roleMode: "auto" | "custom";
  undercoverCount: number;
  blankCount: number;
  clueSeconds: number;
  voteSeconds: number;
  revealSeconds: number;
  guessSeconds: number;
  tieBreak: "random" | "none";
  blankGuess: boolean;
  wordLocale: Locale;
  packIds: string[];
  difficulties: (1 | 2 | 3)[];
  familyFilter: boolean;
  swapSides: boolean;
  points: Points;
}
export type SettingsPatch = Partial<Settings>;  // `points`, if present, must be a complete Points object

export interface Player {
  id: string;               // "p_" + 24 hex (96-bit)
  name: string;
  color: ColorId;
  locale: Locale;
  seat: number;             // unique; gaps allowed in LOBBY; compacted to 0..n-1 at START
  joinedAt: number;
  connected: boolean;
  disconnectedAt: number | null;
  role: Role | null;        // null in LOBBY/after reset
  word: WordRef | null;     // null in LOBBY and for BLANK
  alive: boolean;
  left: boolean;            // LEAVE/KICK outside LOBBY; removed at the next resetToLobby
  ready: boolean;           // ROLE_REVEAL
  spoke: boolean;           // current CLUES/TIE_BREAK pass
  score: number;            // cumulative for the session
}

export interface Deadline { id: number; kind: DeadlineKind; at: number; durationMs: number }

export interface SelectedPair {
  key: string;              // `${packId}:${pairId}`
  packId: string; packVersion: number; pairId: string;
  packTitle: { en: string; fr: string; ar: string };
  civilian: WordSide;       // after optional swap
  undercover: WordSide;
}

export interface VoteSummary {
  round: number;
  revote: boolean;
  tally: { targetId: string; voterIds: string[] }[];   // sorted by voterIds.length desc, then target seat asc; only targets with ≥1 vote
  abstainIds: string[];                                 // alive players with no valid vote, seat order
  outcome: VoteOutcome;
  eliminatedId: string | null;
}

export interface GuessState { playerId: string; status: GuessStatus; text: string | null; overridden: boolean } // text: projected only in RESULTS (§5.4)

export interface ResultState {
  winner: Winner;
  winnerIds: string[];                     // seat order
  civilianWord: WordRef;
  undercoverWord: WordRef;
  pack: { id: string; version: number; title: { en: string; fr: string; ar: string } };
  pointsAwarded: Record<string, number>;  // every player id → points this game (0 for losers and left players)
  guesses: GuessState[];                   // every resolved Blank guess this game, in order (texts public now)
}

export interface HistoryEntry { round: number; eliminatedId: string | null; role: Role | null; cause: HistoryCause }

export interface GameState {
  schema: 1;
  roomCode: string;
  joinUrl: string;
  version: number;              // +1 on every state change; becomes `seq`
  phase: Phase;
  settings: Settings;
  players: Player[];            // always sorted by seat
  hostPlayerId: string | null;  // the "VIP" phone; TV is always host too
  gameNumber: number;           // 0 until first START
  round: number;                // 0 in LOBBY/ROLE_REVEAL; 1.. during play
  roleCounts: RoleCounts | null;// in-game: actual; LOBBY: computed on projection, stored null
  pair: SelectedPair | null;
  usedPairKeys: string[];       // session no-repeat list
  speakingOrder: string[];
  turnIdx: number;
  starterId: string | null;
  votes: Record<string, string>;// voterId → targetId (never projected)
  revote: boolean;
  tieCandidates: string[];      // seat order
  lastVote: VoteSummary | null;
  eliminated: { playerId: string; role: Role } | null;
  guess: GuessState | null;
  guessLog: GuessState[];       // resolved guesses this game (never projected; copied into result.guesses)
  result: ResultState | null;
  history: HistoryEntry[];      // current game only
  deadline: Deadline | null;
  deadlineSeq: number;          // Deadline.id source
  rngState: number;             // uint32
}
```

### 4.2 Actions (`types.ts`, exact)
```ts
export type Actor = { kind: "tv" } | { kind: "player"; playerId: string } | { kind: "system" };

export type ClientIntent =
  | { type: "UPDATE_SETTINGS"; patch: SettingsPatch }
  | { type: "START" }
  | { type: "READY" }
  | { type: "CLUE_DONE" }
  | { type: "CAST_VOTE"; targetId: string }
  | { type: "SUBMIT_GUESS"; text: string }
  | { type: "HOST_OVERRIDE_GUESS"; accept: boolean }
  | { type: "HOST_ADVANCE" }
  | { type: "KICK"; playerId: string }
  | { type: "PLAY_AGAIN" }
  | { type: "BACK_TO_LOBBY" }
  | { type: "LEAVE" };

export type SystemAction =
  | { type: "JOIN"; playerId: string; name: string; color: ColorId; locale: Locale }
  | { type: "RECONNECT"; playerId: string }
  | { type: "DISCONNECT"; playerId: string }
  | { type: "TICK" };

export type Action = (ClientIntent & { by: Exclude<Actor, { kind: "system" }> }) | (SystemAction & { by: { kind: "system" } });

export interface ReduceCtx { now: number; catalog: Catalog }
export type ReduceResult =
  | { ok: true; state: GameState }                          // state === input when nothing changed
  | { ok: false; error: EngineError; state: GameState };   // state === input
export type EngineError =
  | "ROOM_FULL" | "ROOM_LOCKED" | "NAME_INVALID" | "NAME_TAKEN" | "COLOR_TAKEN" | "BAD_MESSAGE"
  | "NOT_HOST" | "WRONG_PHASE" | "NOT_YOUR_TURN" | "NOT_ALIVE" | "INVALID_TARGET" | "INVALID_SETTINGS"
  | "NOT_ENOUGH_PLAYERS" | "INVALID_ROLE_CONFIG" | "NO_WORDS_AVAILABLE" | "GUESS_INVALID";
```

### 4.3 Public engine API (`engine/index.ts` exports exactly these, plus the types)
```ts
export function createInitialState(args: { roomCode: string; joinUrl: string; seed: number; wordLocale: Locale }): GameState;
export function reduce(state: GameState, action: Action, ctx: ReduceCtx): ReduceResult;
export function nextWakeAt(state: GameState): number | null;            // min(deadline.at, LOBBY seat expiries)
export function effectiveRoleCounts(settings: Settings, n: number): RoleCounts | null; // null if n<3 or invalid
export function defaultRoleCounts(n: number): RoleCounts | null;        // table §4.5
export function validateRoleCounts(c: RoleCounts, n: number): boolean;
export function checkWinner(state: GameState): Winner | null;          // §4.10 (CIVILIANS/INFILTRATORS only)
export function normalizeGuess(s: string): string;                      // §4.12
export function sanitizeName(raw: string): string | null;               // §7.9; null = NAME_INVALID
export function nameKey(name: string): string;                          // NFKC + toLowerCase; uniqueness key
export function isGuessCorrect(guess: string, target: WordSide): boolean;
export function assertInvariants(state: GameState): void;               // throws InvariantError
export class InvariantError extends Error {}
export function buildCatalog(packs: readonly WordPackLike[]): Catalog;  // see §12.3; validation is done by caller via packs schema (`loadCatalog` in ./packs does both)
export function languageOf(locale: string): Locale;                     // "ar-LB" → "ar"
export function countRoles(players: readonly { role: Role | null }[]): RoleCounts;
export const DEFAULT_SETTINGS: Settings;
export { SETTINGS_BOUNDS } from "../constants";                         // §3
export function applySettingsPatch(s: Settings, patch: SettingsPatch, catalog: Catalog): Settings | null; // null = invalid
export { createRng, type Rng } from "./rng";
```
`reduce` must not mutate its input. It may `structuredClone` the state first. On success with a change, `version` is the input version + 1. When nothing changed (for example a `TICK` with nothing due), it returns the **same object**.

### 4.4 Settings: defaults and bounds (`settings.ts`)

| Key | Type / bounds | Default |
|---|---|---|
| `winRule` | `"official"` \| `"parity"` | `"official"` |
| `revealRoles` | boolean ("beginner mode") | `false` |
| `roleMode` | `"auto"` \| `"custom"` | `"auto"` |
| `undercoverCount` | int 1..5 (used only when `custom`) | `1` |
| `blankCount` | int 0..2 (used only when `custom`) | `1` |
| `clueSeconds` | `0` (off) or int 10..120 (UI step 5) | `45` |
| `voteSeconds` | `0` or int 15..300 | `90` |
| `revealSeconds` | `0` or int 10..120 | `30` |
| `guessSeconds` | `0` or int 10..120 | `45` |
| `tieBreak` | `"random"` \| `"none"` (what happens when the **re-vote** ties) | `"random"` |
| `blankGuess` | boolean (an eliminated Blank may guess) | `true` |
| `wordLocale` | `"en"`\|`"fr"`\|`"ar"` | `"en"` (overridden by `POST /api/rooms` `locale`) |
| `packIds` | ≤50 unique ids, each matching `^[a-z0-9-]{1,40}$`. Each must exist in the catalog with a matching language. `[]` = all packs for the locale | `[]` |
| `difficulties` | non-empty, unique, ascending subset of `[1,2,3]` | `[1,2,3]` |
| `familyFilter` | boolean. `true` → packs with `ageRating:"all"` only; `false` → `"all"`+`"teen"`. `"adult"` is never served in v1 | `true` |
| `swapSides` | boolean. If true, 50% chance (rng) to swap civilian/undercover sides of the chosen pair | `true` |
| `points` | `{civilian, undercover, blank}` each int 0..20 | `{2, 10, 6}` |

`DEFAULT_SETTINGS` key order is exactly the table order. That order is used in fixtures. Bounds and UI step sizes are `SETTINGS_BOUNDS` (§3); B and C use those steps and no others.

`applySettingsPatch` merges the patch, then validates every bound.
- If `wordLocale` changes and the patch has no `packIds`, `packIds` is reset to `[]`.
- Unknown keys cannot arrive, because the zod schema is strict.

### 4.5 Role distribution (`roles.ts`)
Default table (`roleMode:"auto"`):

| n | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|
| undercover | 1 | 1 | 1 | 1 | 2 | 2 | 3 | 3 | 3 | 3 |
| blank | 0 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 |
| civilian | 2 | 3 | 3 | 4 | 4 | 5 | 5 | 6 | 7 | 7 |

Rules:
- `validateRoleCounts(c, n)` requires all of the following:
  - `c.civilian + c.undercover + c.blank === n`
  - `1 <= c.undercover <= floor((n-1)/2)`
  - `0 <= c.blank <= 2`
  - `c.civilian > c.undercover + c.blank`
- In custom mode, `civilian = n − U − B`.
- `effectiveRoleCounts` returns null if n<3, n>12, or the counts are invalid.

**Assignment at START:**
1. Shuffle the player ids with Fisher–Yates using the rng: `for i from n-1 down to 1: j = rng.int(i+1); swap`.
2. The first `undercover` ids become UNDERCOVER, the next `blank` ids become BLANK, and the rest become CIVILIAN.

### 4.6 RNG (`rng.ts`): mulberry32, state stored as uint32
```ts
export interface Rng { state: number; next(): number; int(n: number): number }   // int: 0..n-1
export function createRng(state: number): Rng {
  const r: Rng = {
    state: state >>> 0,
    next() {
      r.state = (r.state + 0x6D2B79F5) >>> 0;
      let t = r.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(r.next() * n); },
  };
  return r;
}
```
Test vector, seed `42`: `next()` returns `0.6011037519201636`, `0.44829055899754167`, `0.8524657934904099`, and the states after each call are `1831565855`, `3663131668`, `1199730185`.

`reduce` creates `createRng(state.rngState)` and writes `rng.state` back. The seed comes from the server (`crypto.getRandomValues(new Uint32Array(1))[0]`).

### 4.7 Phase flow (`lifecycle.ts`, `turns.ts`, `departures.ts`, `votes.ts`)

Module split (acyclic): `draft.ts` (the `Draft` working copy and `setDeadline`), `queries.ts` (pure reads: `findPlayer`, `currentSpeakerId`, `inferKind`, `isInGame`, `isPlaying`, `isSpeakingPhase`; used by the projection and the invariants), `membership.ts` (`reassignHost`, `removePlayer`, `markLeft`), `lifecycle.ts` (`startGame`, `enterResults`, `resetToLobby` and the shared per-round / per-game scratch reset), `votes.ts` (ballots and the tally, no transitions), `turns.ts` (rounds, turns, `openingOrder`, vote closing, elimination, the Blank's guess, `expire`) and `departures.ts` (`forfeit`, `onDisconnect`).

```
LOBBY --START--> ROLE_REVEAL --(all connected ready | deadline | HOST_ADVANCE)--> CLUES(round=1)
CLUES --(every speaker done/skipped)--> VOTING(revote=false)
VOTING --close: unique max--> ELIMINATION
VOTING --close: tie & !revote--> TIE_BREAK --(tied players done)--> VOTING(revote=true, targets=tieCandidates)
VOTING --close: tie & revote--> ELIMINATION (tieBreak "random": RANDOM pick | "none": NO_ELIMINATION)
VOTING --close: zero valid votes--> ELIMINATION (NO_ELIMINATION)
ELIMINATION --(deadline 8s | HOST_ADVANCE)--> MR_WHITE_GUESS (if eliminated.role==BLANK && blankGuess)
                                         \--> RESULTS (checkWinner != null) | LOBBY (stalemate) | CLUES(round+1)
MR_WHITE_GUESS --SUBMIT_GUESS--> (same phase, status CORRECT/WRONG, deadline VERDICT 8s)
MR_WHITE_GUESS --(GUESS deadline | HOST_ADVANCE while PENDING)--> status TIMEOUT, deadline VERDICT
MR_WHITE_GUESS --(VERDICT deadline | HOST_ADVANCE while not PENDING)--> CORRECT: RESULTS(BLANK) | else RESULTS(checkWinner) | CLUES(round+1)
RESULTS --PLAY_AGAIN--> LOBBY ;  any non-LOBBY --BACK_TO_LOBBY (TV)--> LOBBY
```

**Deadlines set on entry.** `setDeadline(kind, ms)` sets `deadline = { id: ++deadlineSeq, kind, at: now+ms, durationMs: ms }`. When ms is 0, `deadline = null`.

| Phase / step | Deadline kind | Duration |
|---|---|---|
| ROLE_REVEAL | REVEAL | `revealSeconds*1000` |
| CLUES / TIE_BREAK, **per speaker turn** | CLUE | `clueSeconds*1000`; the **first** TIE_BREAK turn adds `TIE_LEAD_IN_MS` when `clueSeconds>0`; a speaker who disconnects mid-turn with no deadline gets `CLUE_GRACE_MS` (§4.8) |
| VOTING | VOTE | `voteSeconds*1000` |
| ELIMINATION | ELIMINATION | `ELIMINATION_HOLD_MS` (always) |
| MR_WHITE_GUESS, PENDING | GUESS | `guessSeconds*1000` |
| MR_WHITE_GUESS, after evaluation/timeout | VERDICT | `VERDICT_HOLD_MS` (always) |
| LOBBY, RESULTS | — | `null` |

**Expiry handling.** `TICK` with `deadline && now >= deadline.at`, or `HOST_ADVANCE`, runs `expire(kind)`:
- REVEAL → `startRound(1)`.
- CLUE → mark the current speaker `spoke=true`, then `advanceTurn()`.
- VOTE → `closeVote()`.
- ELIMINATION → `afterElimination()`.
- GUESS → set guess status `TIMEOUT` and set deadline VERDICT.
- VERDICT → `resolveGuess()`.

`HOST_ADVANCE` behaves the same when the timer is off (deadline null). The kind is then inferred from the phase:
- ROLE_REVEAL→REVEAL; CLUES/TIE_BREAK→CLUE; VOTING→VOTE; ELIMINATION→ELIMINATION.
- MR_WHITE_GUESS→GUESS if PENDING, else VERDICT.

`HOST_ADVANCE` in LOBBY or RESULTS → `WRONG_PHASE`. In MR_WHITE_GUESS while the guess is PENDING, only the TV may advance, or the VIP (not the guesser) when the guesser is disconnected; otherwise → `NOT_HOST`. This stops a VIP from denying the Blank's guess.

**`START`** (host, LOBBY):
1. Fewer than `MIN_PLAYERS` **connected** players → `NOT_ENOUGH_PLAYERS` (disconnected lobby seats are still dealt in when the start succeeds).
2. `effectiveRoleCounts` is null → `INVALID_ROLE_CONFIG`.
3. Pick the pair (§12.4). None available → `NO_WORDS_AVAILABLE`.
4. If `swapSides && rng.next() < 0.5`, swap the two sides.
5. Push `pair.key` onto `usedPairKeys`.
6. Compact seats to 0..n-1 in current seat order.
7. Assign roles (§4.5). Words: CIVILIAN→`{text,translit}` of the civilian side; UNDERCOVER→the undercover side; BLANK→null.
8. Set on every player: `alive=true`, `left=false`, `spoke=false`, and `ready = !connected`.
9. Set `gameNumber++`, `round=0`, `roleCounts`, and clear `history/lastVote/eliminated/guess/guessLog/result/votes/tieCandidates`.
10. Set `phase=ROLE_REVEAL` and deadline REVEAL.

**`READY`** (player, ROLE_REVEAL): set `ready=true`. If every **connected** player is ready → `startRound(1)`.

**`startRound(r)`:**
1. Set `round=r`, `phase=CLUES`, `revote=false`, `tieCandidates=[]`, `votes={}`, `lastVote=null`, `eliminated=null`, `guess=null`.
2. Set every alive player's `spoke=false`.
3. Choose the starter and set `starterId`:
   - Every round (and every TIE_BREAK, over the tied candidates): `rng` pick among alive, connected, non-BLANK players; fall back to any non-BLANK, then to anyone. **The Blank never speaks first.**
   - The opener is drawn at random each round rather than rotated by seat, so skipping the Blank never reveals their seat (user decision 2026-10-03, replaces the seat-rotation rule).
4. `speakingOrder` = alive ids in seat order, rotated so the starter is first. `turnIdx=0`.
5. `beginTurn()`.

**`beginTurn()`** (CLUES and TIE_BREAK):
- While `turnIdx < speakingOrder.length` and the player at `turnIdx` is (not alive, or not connected, or `spoke`): mark them `spoke=true` and `turnIdx++`.
- If `turnIdx === length`, end the pass:
  - CLUES → `enterVoting(false)`.
  - TIE_BREAK → `enterVoting(true)`.
- Otherwise set deadline CLUE (with `TIE_LEAD_IN_MS` added on the first turn after entering TIE_BREAK, when `clueSeconds>0`).
- `currentSpeakerId` (projected) = `speakingOrder[turnIdx]` while in CLUES/TIE_BREAK, else null.

**`CLUE_DONE`** (current speaker only, else `NOT_YOUR_TURN`): mark `spoke=true`, `turnIdx++`, then `beginTurn()`.

**`enterVoting(revote)`:** set `phase=VOTING`, `votes={}`, `revote`, and deadline VOTE. If `revote` is false, `tieCandidates=[]`.

**`CAST_VOTE`** (alive player, else `NOT_ALIVE`):
- The target must be alive and ≠ voter. When `revote`, the target must also be in `tieCandidates`. Otherwise → `INVALID_TARGET`.
- The vote overwrites any previous vote by the same voter.
- Then: if every alive **connected** player has a vote and there is ≥1 such player → `closeVote()`.

**`closeVote()`:**
1. Valid votes are those whose voter is alive and whose target is alive, among the candidates, and ≠ voter. Candidates are `tieCandidates` if `revote`, else all alive players.
2. `abstainIds` = alive players without a valid vote.
3. If there are 0 valid votes → outcome `NO_ELIMINATION`.
4. Otherwise let `top` be the targets with the max count.
   - `top.length===1` → `ELIMINATED`.
   - Else if `!revote` → `TIE`. Set `tieCandidates = top` (seat order), `lastVote` = summary, `phase=TIE_BREAK`. `speakingOrder = tieCandidates`. `turnIdx=0`. Set `spoke=false` for the candidates. Then `beginTurn()`.
   - Else if `tieBreak==="random"` → `RANDOM`: the eliminated player is `top[rng.int(top.length)]`, with `top` in seat order.
   - Else → `NO_ELIMINATION`.
5. For ELIMINATED or RANDOM: set the player `alive=false`, set `eliminated={playerId, role}`, and push history `{round, eliminatedId, role, cause: "VOTE"|"RANDOM"}`.
6. For NO_ELIMINATION: push history `{round, eliminatedId:null, role:null, cause:"NONE"}`.
7. Set `lastVote` = summary, `phase=ELIMINATION`, and deadline ELIMINATION.

**`afterElimination()`:**
- If `eliminated?.role==="BLANK" && settings.blankGuess`:
  - Set `phase=MR_WHITE_GUESS`, `guess={playerId, status:"PENDING", text:null, overridden:false}`, and deadline GUESS.
  - Exception: if the guesser is not connected and `guessSeconds===0`, set status `TIMEOUT` and deadline VERDICT immediately.
- Otherwise: if `checkWinner()` returns a winner `w` → `enterResults(w)`.
- Else, **stalemate**: if the last `MAX_NO_ELIMINATION_STREAK` history entries with cause VOTE, RANDOM or NONE all have cause NONE → `resetToLobby()` (no points, like BACK_TO_LOBBY). This ends games where nobody votes (everyone asleep, or `tieBreak:"none"` ties forever). The sim counts these as "stalemate".
- Else → `startRound(round+1)`.

**`SUBMIT_GUESS`:**
- Only the guesser may submit (else `NOT_YOUR_TURN`), and only while the status is PENDING (else `WRONG_PHASE`).
- `text.trim()` must be 1..40 code points, else `GUESS_INVALID`.
- Set `guess.text` = the trimmed text, and status = `isGuessCorrect(text, pair.civilian) ? "CORRECT" : "WRONG"`. Set deadline VERDICT.

**`HOST_OVERRIDE_GUESS`** (at most once per guess; `overridden===true` → `WRONG_PHASE`):
- `accept:true`: requires status `WRONG` and `guess.text !== null` (else `WRONG_PHASE`). Actor: the TV, or the VIP when the VIP is not the guesser (else `NOT_HOST`). Sets status `CORRECT`.
- `accept:false`: requires status `CORRECT` (else `WRONG_PHASE`). Actor: **TV only** (else `NOT_HOST`). Sets status `WRONG`. This is for a matcher false positive.
- A TIMEOUT has no text and cannot be overridden.
- Then set `overridden=true` and restart deadline VERDICT (once, because a second override is refused).

**`resolveGuess()`:**
- First push a copy of `guess` onto `guessLog`.
- CORRECT → `enterResults("BLANK", [guess.playerId])`.
- Otherwise: `checkWinner()` returns `w` → `enterResults(w)`. Else → `startRound(round+1)`.

**`enterResults(winner, ids?)`:**
1. winnerIds (seat order), **excluding `left` players**:
   - CIVILIANS → every player with role CIVILIAN, alive or not.
   - INFILTRATORS → every UNDERCOVER and BLANK.
   - BLANK → `ids`.
2. Each winner gains `points[roleKey]`, where roleKey is civilian/undercover/blank. Add it to `score`.
3. `pointsAwarded` holds every player id (0 if they did not win or left).
4. `result.guesses = guessLog`.
5. Set `result`, `phase=RESULTS`, `deadline=null`.

**`PLAY_AGAIN`** (host, RESULTS) and **`BACK_TO_LOBBY`** (TV only, any phase ≠ LOBBY) → `resetToLobby()`:
- **Remove every `left` player** (with the `removePlayer` host rule). The server then prunes their sessions (§7.5).
- Per remaining player: role/word null; `alive=true`; `ready=false`; `spoke=false`. Disconnected players get `disconnectedAt=now`, which starts the 120 s lobby seat hold.
- Room: `round=0`; `roleCounts`, `pair`, `lastVote`, `eliminated`, `guess`, `result`, `deadline` = null; `history`, `guessLog`, `speakingOrder`, `tieCandidates` = []; `votes={}`; `starterId=null`.
- `scores`, `gameNumber` and `usedPairKeys` are kept. `BACK_TO_LOBBY` awards no points.

### 4.8 Membership actions
- **`JOIN`** (system; the server built it after validating the `join` message):
  - Phase LOBBY only, else `ROOM_LOCKED`.
  - Fewer than 12 players, else `ROOM_FULL`.
  - Name: `sanitizeName` (§7.9) returns non-null, else `NAME_INVALID`. A name whose `nameKey` (NFKC + `toLowerCase()`) equals another player's → `NAME_TAKEN`.
  - Colour already in use → `COLOR_TAKEN` (no automatic reassignment).
  - `seat` = the smallest non-negative integer not in use.
  - If `hostPlayerId===null`, the player becomes host.
  - New player: `connected=true`, `disconnectedAt=null`, `alive=true`, `left=false`, `score=0`, `joinedAt=now`.
- **System actions on unknown ids.** `RECONNECT` or `DISCONNECT` for a `playerId` that is not in `players`, or that is `left`, is a no-op: `{ok:true}` with the **same** state object.
- **`DISCONNECT`**: set `connected=false`, `disconnectedAt=now`. Then by phase:
  - CLUES/TIE_BREAK and the player is the current speaker → **keep the turn** (they may still be talking out loud). If `deadline===null` (clue timer off), set deadline CLUE with `CLUE_GRACE_MS`; otherwise leave the deadline alone. The deadline, HOST_ADVANCE or the TV handles it. (`beginTurn` still skips players who are already disconnected when their turn starts.)
  - ROLE_REVEAL → re-check all-ready.
  - VOTING → re-check close.
  - MR_WHITE_GUESS: nothing happens; the deadline or the host decides.
- **`RECONNECT`**: set `connected=true`, `disconnectedAt=null`. Nothing else, and no re-check is needed.
- **`LEAVE`** (player, self):
  - LOBBY → `removePlayer`.
  - RESULTS → `markLeft(p)`.
  - In-game → `forfeit(p, "LEAVE")`.
- **`KICK`** (host). Target unknown or already `left` → `INVALID_TARGET`. The VIP targeting itself → `INVALID_TARGET`.
  - **In-game (ROLE_REVEAL…MR_WHITE_GUESS), the VIP may kick only a target with `connected===false`** (else `INVALID_TARGET`). The TV may kick anyone. The VIP holds a secret word, so it must not be able to remove connected players without a vote.
  - LOBBY → `removePlayer`.
  - RESULTS → `markLeft(p)`.
  - In-game → `forfeit(p, "KICK")`.
  - In every case the server also closes the target's sockets with 4006 and invalidates its resume token (§7.5).
- **`removePlayer(p)`** (LOBBY, and `resetToLobby`): delete the player. If `p` was the host, `reassignHost()`.
- **`reassignHost()`**: `hostPlayerId` becomes:
  1. the earliest `joinedAt` among players that are **connected and not left**;
  2. else the earliest `joinedAt` among the remaining non-left players;
  3. else null.
- **`markLeft(p)`** (RESULTS): `left=true`, `connected=false`, `disconnectedAt=now`. If `p` is the host → `reassignHost()`. Nothing else changes; `result` keeps its ids.
- **`forfeit(p, cause)`** (in-game), in this exact order:
  1. Set `left=true`, `connected=false`, `disconnectedAt=now`. If `p` is the host → `reassignHost()`.
  2. If `p.alive===false` already (an eliminated player, or the Blank guesser after elimination): apply only the guess rule in step 5 below, then stop. No history entry, no win check.
  3. Set `alive=false`. Push history `{round, eliminatedId:p.id, role:p.role, cause}`. The role becomes public through `revealedRole` (intended: a departure must not hide an infiltrator).
  4. Delete votes cast by `p` and votes targeting `p`. Remove `p` from `tieCandidates`.
  5. Then by phase, first match wins:
     - (TIE_BREAK, or VOTING with `revote`) and `tieCandidates.length<2` → `enterVoting(false)`, and skip the speaker step.
     - ROLE_REVEAL → re-check all-ready.
     - CLUES/TIE_BREAK and `p` is the current speaker → `spoke=true`, `turnIdx++`, `beginTurn()`.
     - MR_WHITE_GUESS with `p` as the guesser and status PENDING → status TIMEOUT, deadline VERDICT.
  6. Then, if the phase ∉ {ELIMINATION, MR_WHITE_GUESS} and `checkWinner()` returns `w` → `enterResults(w)`.
  7. Else, if VOTING → re-check close.
- **`TICK`**:
  1. Expire the deadline if due (§4.7).
  2. If the phase is LOBBY, remove every player with `!connected && disconnectedAt !== null && disconnectedAt + SEAT_HOLD_MS <= now` (host rule applies). Seats never expire in RESULTS or in-game; `resetToLobby` restarts the hold.
  3. If nothing changed, return the input object.

### 4.9 Permission matrix (checked before phase rules; failure → listed error)

| Intent | Allowed phases (else `WRONG_PHASE`) | Allowed actor (else `NOT_HOST` / `NOT_YOUR_TURN` / `NOT_ALIVE`) |
|---|---|---|
| UPDATE_SETTINGS | LOBBY | TV or VIP |
| START | LOBBY | TV or VIP |
| READY | ROLE_REVEAL | any joined player |
| CLUE_DONE | CLUES, TIE_BREAK | current speaker |
| CAST_VOTE | VOTING | alive player |
| SUBMIT_GUESS | MR_WHITE_GUESS | the guesser |
| HOST_OVERRIDE_GUESS | MR_WHITE_GUESS: `accept:true` needs status WRONG with text; `accept:false` needs CORRECT; never twice | `accept:true`: TV, or VIP ≠ guesser. `accept:false`: TV only |
| HOST_ADVANCE | ROLE_REVEAL…MR_WHITE_GUESS | TV or VIP; while the guess is PENDING: TV, or VIP ≠ guesser only if the guesser is disconnected |
| KICK | any | TV (any target) or VIP (in-game: disconnected targets only, else `INVALID_TARGET`) |
| PLAY_AGAIN | RESULTS | TV or VIP |
| BACK_TO_LOBBY | any except LOBBY | TV only |
| LEAVE | any | the player |

An intent whose `by.playerId` is not in `players`, or is `left`, → `BAD_MESSAGE`. (System actions follow §4.8 "unknown ids".)

### 4.10 Win check (`win.ts`)
```
aliveC = alive CIVILIANs; aliveI = alive UNDERCOVERs + alive BLANKs
if aliveI === 0                                 → "CIVILIANS"
if winRule==="official" && aliveC <= 1          → "INFILTRATORS"
if winRule==="parity"   && aliveI >= aliveC     → "INFILTRATORS"
else null
```
It is called only:
- at the points in §4.7 (`afterElimination`, `resolveGuess`);
- in `forfeit`.

A correct Blank guess is resolved **before** the civilian count is checked.

**Consequence (asserted by invariant 13 and `win.test.ts`).** While a game continues into a new round, at least 3 players are alive: official needs `aliveC>=2 && aliveI>=1`, and parity needs `aliveC>aliveI>=1`. A forfeit that would drop below that always ends the game through step 6 of `forfeit`.

### 4.11 Scoring (`scoring.ts`)
`awardPoints(state, winnerIds) → Record<playerId, number>` uses `settings.points`. The full rule is in `enterResults` (§4.7).

### 4.12 Blank-guess normalisation (`normalize.ts`, exact algorithm)
```ts
const AR_MAP: Record<string, string> = { "ٱ": "ا", "ى": "ي", "ی": "ي", "ة": "ه", "ک": "ك", "ء": "" };
const LIG: Record<string, string> = { "œ": "oe", "æ": "ae", "ß": "ss", "ø": "o", "ł": "l", "đ": "d" };
const STOP = new Set(["the","a","an","le","la","les","l","un","une","des","du","de"]);
export function normalizeGuess(input: string): string {
  let s = input.normalize("NFKD");                 // splits accents, أ→ا+ٔ, آ→ا+ٓ, ؤ→و+ٔ, ئ→ي+ٔ, ﻻ→لا
  s = s.replace(/\p{M}/gu, "");                     // drop all combining marks: Latin accents, Arabic harakat/shadda/sukun/hamza marks, superscript alef
  s = s.replace(/ـ/g, "");                     // tatweel
  s = s.toLowerCase();
  s = s.replace(/[œæßøłđ]/g, (c) => LIG[c]!);
  s = s.replace(/[ٱىیةکء]/g, (c) => AR_MAP[c]!); // alef wasla→alef, alef maqsura/farsi yeh→yeh, ta marbuta→heh, keheh→kaf, drop hamza
  s = s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
       .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6F0));
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  let toks = s.split(" ").filter(Boolean);
  if (toks.length > 1) { const f = toks.filter((t) => !STOP.has(t)); if (f.length) toks = f; }
  toks = toks.map((t) => (t.startsWith("ال") && [...t].length >= 4 ? t.slice(2) : t)); // strip ال
  return toks.join("");
}
export function isGuessCorrect(guess: string, target: WordSide): boolean {
  const g = normalizeGuess(guess);
  if (!g) return false;
  const targets = [target.text, ...target.alt, ...(target.translit ? [target.translit] : [])];
  return targets.some((t) => normalizeGuess(t) === g);
}
```
Required test vectors (input → output):

| Input | Output |
|---|---|
| `Crème Brûlée` | `cremebrulee` |
| `creme brulee` | `cremebrulee` |
| `L'Œuf` | `oeuf` |
| `The Ice-Cream` | `icecream` |
| `Straße` | `strasse` |
| `  KA'KE  ` | `kake` |
| `مَنْقُوشَة` | `منقوشه` |
| `منقوشة` | `منقوشه` |
| `مـــنقوشة` | `منقوشه` |
| `الحمّص` | `حمص` |
| `أرز` / `إبريق` / `آذان` | `ارز` / `ابريق` / `اذان` |
| `مستشفى` | `مستشفي` |
| `فؤاد` | `فواد` |
| `سائق` | `سايق` |
| `٣ قطط` | `3قطط` |
| `ﻻ` | `لا` |

### 4.13 Invariants (`invariants.ts`; `assertInvariants` runs in tests and sim after **every** reduce, and in the DO only when `env.DEBUG_INVARIANTS==="1"`)
1. `players.length <= 12`. Ids, seats, `nameKey`s and colours are each unique. Players are sorted by seat.
2. `hostPlayerId` is null or refers to a player that is **not `left`**.
3. In LOBBY: no player is `left`; every `role`/`word` is null, every `alive` is true, `round===0`, `guessLog` is empty, and `result`, `deadline`, `pair` and `roleCounts` are null.
4. In-game (ROLE_REVEAL…MR_WHITE_GUESS) and RESULTS:
   - `pair` is non-null and every player has a role.
   - The role counts equal `roleCounts`.
   - Every CIVILIAN's `word.text === pair.civilian.text`, every UNDERCOVER's `word.text === pair.undercover.text`, and every BLANK's `word===null`.
5. In CLUES/TIE_BREAK: `0 <= turnIdx < speakingOrder.length`, and the current speaker is alive and `!spoke`. If the current speaker is disconnected, `deadline !== null`.
6. In VOTING: every vote key and target is alive, no voter votes for themselves, and when `revote` every target is in `tieCandidates`.
7. In TIE_BREAK, or VOTING with `revote`: `tieCandidates.length >= 2`.
8. In ROLE_REVEAL, CLUES, VOTING or TIE_BREAK: `checkWinner(state)===null`.
9. RESULTS ⇔ `result!==null`. In RESULTS, `deadline===null`.
10. `deadline !== null` ⇒ its kind matches the phase per the §4.7 table. `deadline === null` is allowed only where the table allows it (a timer set to 0, LOBBY, RESULTS).
11. `rngState` is an integer in 0..2³²−1. `version >= 0`. Every `score >= 0`.
12. In MR_WHITE_GUESS: `guess!==null` and the guesser's role is BLANK.
13. In ROLE_REVEAL, CLUES, VOTING and TIE_BREAK: at least 3 players are alive. (ELIMINATION and MR_WHITE_GUESS may briefly hold 2, before the win check.)
14. A `left` player is `!connected`; in-game, a `left` player is also `!alive`.
15. In RESULTS: every id in `result.winnerIds` and `result.pointsAwarded` is in `players` (players are never removed in RESULTS).

---

## 5. Projection (`shared/src/projection/project.ts`) and view shapes

```ts
export function projectPublic(state: GameState, catalog: Catalog): PublicView;
export function projectForTv(state: GameState, catalog: Catalog): TvView;            // { kind:"tv", ...public }
export function projectForPlayer(state: GameState, catalog: Catalog, playerId: string | null): PlayerView; // null → spectator (not joined)
```

### 5.1 `PublicView` (every key always present, in this order)

| Key | Type | Value rule |
|---|---|---|
| `roomCode` | string | |
| `joinUrl` | string | |
| `phase` | Phase | |
| `gameNumber` | int | |
| `round` | int | |
| `settings` | Settings | full |
| `players` | PublicPlayer[] | seat order |
| `hostPlayerId` | string\|null | |
| `roleCounts` | RoleCounts\|null | LOBBY: `effectiveRoleCounts(settings, n)`; otherwise the stored value |
| `canStart` | boolean | LOBBY && `startBlocker===null` |
| `startBlocker` | ErrorCode\|null | LOBBY only, first match: `NOT_ENOUGH_PLAYERS` (fewer than 3 **connected** players) \| `INVALID_ROLE_CONFIG` \| `NO_WORDS_AVAILABLE` (a dry-run filter of the catalog), else null |
| `speakingOrder` | string[] | CLUES/TIE_BREAK, else `[]` |
| `currentSpeakerId` | string\|null | |
| `revote` | boolean | |
| `tieCandidates` | string[] | |
| `deadline` | `{kind, at, durationMs}`\|null | `id` is **not** projected |
| `votesCast` | int | VOTING: number of alive connected players who have voted; else 0 |
| `votesExpected` | int | VOTING: number of alive connected players; else 0 |
| `lastVote` | VoteSummary\|null | |
| `eliminated` | `{playerId, role}`\|null | |
| `guess` | GuessState\|null | `text` is **null unless the phase is RESULTS** |
| `result` | ResultState\|null | RESULTS only (includes `guesses` with their texts) |
| `history` | HistoryEntry[] | |
| `availablePacks` | PackInfo[] | LOBBY only, else `[]`. Packs matching `settings.wordLocale` and `familyFilter` |

`PublicPlayer` (key order exact): `id, name, color, seat, connected, alive, left, isHost, ready, spoke, hasVoted, revealedRole, score`.
- `isHost` = `id===hostPlayerId`.
- `hasVoted` = VOTING && the player has a vote, else false.
- `revealedRole` = role if `!alive` or the phase is RESULTS, else null. In LOBBY it is always null. Forfeited (`left`) players are `!alive`, so their role is revealed.

`PackInfo` = `{ id, locale, title:{en,fr,ar}, pairCount, ageRating }`. `pairCount` counts pairs that pass the current `difficulties` filter.

### 5.2 `TvView` = `{ kind: "tv", ...PublicView }`

### 5.3 `PlayerView` = `{ kind: "player", ...PublicView, me: Me | null }`
`Me` (key order exact): `id, word, isBlank, role, myVote`.
- `word`: `WordRef|null`. It is the player's own word during the game and in RESULTS, else null.
- `isBlank`: `role==="BLANK"` during the game and in RESULTS. False in LOBBY.
- `role`: the player's role if `settings.revealRoles || !alive || phase==="RESULTS"`, else null. In LOBBY it is null.
- `myVote`: the player's own vote target in VOTING, else null.

### 5.4 Secrecy rules (enforced by tests, §14)
- `projectForTv` never contains `pair`, `votes`, any `word`, `alt`, or an alive player's role. The one exception is the RESULTS phase: `result.civilianWord`/`undercoverWord` and all `revealedRole`s.
- `projectForPlayer(X)` contains no word other than X's own, until RESULTS.
- `votes` are never projected except as `hasVoted`, `myVote`, and `lastVote` (published only after the vote closes).
- `guess.text` is `null` in **every** view (TV, spectators, other players, and the guesser) until RESULTS. The guesser's phone keeps what it typed locally. Clients see only `guess.status`. In RESULTS the texts are public in `guess.text` (if `guess` is still set) and in `result.guesses`. The Blank reads the guess aloud (DESIGN house rule), and the host overrides from what was heard.
- `guessLog` is never projected.

---

## 6. Wire protocol (`shared/src/protocol/**`; zod schemas + inferred types)

### 6.1 Transport
- WebSocket URL: `{ws|wss}://{host}/parties/room/{CODE}?_pk={connId}&cid={cid}`.
  - `CODE` must match `ROOM_CODE_REGEX` (upper case). The Worker returns **404** for anything else, because partyserver routing is case-sensitive: `/parties/room/abcd` is a *different* DO.
  - The DO binding is named `Room`, which partyserver kebab-cases to `room` (verified in partyserver 0.5.10 source).
  - `_pk` is partyserver's connection id. partysocket sets it automatically; the TV sends a fresh UUID per attempt.
  - `cid` (required, `^[A-Za-z0-9-]{8,64}$`) is a fresh random id **per connection attempt**. The server uses it to tell connections apart when replacing duplicates, because `_pk` may repeat across partysocket reconnects. A missing or invalid `cid` → close 4000.
- Text frames only, UTF-8 JSON, ≤ `MSG_MAX_BYTES` measured as `new TextEncoder().encode(msg).length`. Larger → `error BAD_MESSAGE` and the frame is dropped. A binary (`ArrayBuffer`) frame → `error BAD_MESSAGE`, dropped.
- Every JSON message has `v: 1` and `t`. The server checks `v` on the **raw parsed JSON before the zod parse**: an object with `v !== 1` → `error UNSUPPORTED_VERSION`, then close 4002. Unparseable JSON or a non-object → `BAD_MESSAGE`.

### 6.2 Client → server (zod `z.strictObject`; failure → `error BAD_MESSAGE`, socket stays open)
```ts
const Token = z.string().regex(/^[0-9a-f]{32}$/);
const PlayerId = z.string().regex(/^p_[0-9a-f]{24}$/);
HelloTv     = { v: 1, t: "hello", role: "tv", tvToken: Token }
HelloPlayer = { v: 1, t: "hello", role: "player", resumeToken?: Token }
Join        = { v: 1, t: "join", name: string(1..64 raw), color: ColorId, locale: Locale }
ActionMsg   = { v: 1, t: "action", id?: string matching /^[A-Za-z0-9-]{1,36}$/, a: ClientIntentSchema }
Ping        = exactly PING_FRAME '{"v":1,"t":"ping"}'

// Composition (exact). zod 4.6.5 throws "Duplicate discriminator value" if HelloTv and HelloPlayer
// are both listed directly in a union on "t", so nest them:
const Hello = z.discriminatedUnion("role", [HelloTv, HelloPlayer]);
export const ClientMessageSchema = z.discriminatedUnion("t", [Hello, Join, ActionMsg]);
```
`ClientIntentSchema` is a discriminated union on `type`, with shapes exactly as in §4.2. Ping never reaches zod (it is matched as a string first).
- `SettingsPatchSchema` is `SettingsSchema.partial().strict()`. `SettingsSchema.packIds` items match `^[a-z0-9-]{1,40}$`, max 50.
- `SUBMIT_GUESS.text` is a raw string of 1..200 chars. The engine then trims it and enforces 1..40.
- `CAST_VOTE.targetId` and `KICK.playerId` are `PlayerId`.

### 6.3 Server → client
```ts
Welcome = { v: 1, t: "welcome", playerId: PlayerId, resumeToken: Token, roomCode: string }
State   = { v: 1, t: "state", seq: number /* = state.version */, serverNow: number, view: TvView | PlayerView }
Error   = { v: 1, t: "error", code: ErrorCode, messageKey: string /* "error." + lowerCamel(code) */, ref: string | null /* echoes action id */ }
Pong    = exactly PONG_FRAME '{"v":1,"t":"pong"}'
```
- `ServerMessageSchema` is a discriminated union on `t`, and `view` is a discriminated union on `kind`.
- S2C schemas use `z.object` (non-strict) so tests can parse fixtures.
- Clients must ignore an unknown `t`. partyserver may itself send `{"error": "<stack>"}` (with no `t`) on a setup crash. Clients ignore it; the following close then triggers a reconnect.

### 6.4 Error codes (`errors.ts`; `messageKey` = `error.` + lowerCamel)

| Code | messageKey | Fatal (server closes) | Close code | Source |
|---|---|---|---|---|
| BAD_MESSAGE | error.badMessage | no | — | protocol/engine |
| UNSUPPORTED_VERSION | error.unsupportedVersion | yes | 4002 | protocol |
| NOT_AUTHENTICATED | error.notAuthenticated | no | — | action/join before a valid hello |
| TV_AUTH_FAILED | error.tvAuthFailed | yes | 4003 | hello tv |
| ROOM_NOT_FOUND | error.roomNotFound | yes | 4004 | connect to a room that was never created |
| ROOM_EXPIRED | error.roomExpired | yes | 4010 | expiry alarm |
| ROOM_FULL | error.roomFull | no | — | engine |
| ROOM_LOCKED | error.roomLocked | no | — | engine (join while not in LOBBY) |
| ALREADY_JOINED | error.alreadyJoined | no | — | join on a joined connection |
| NAME_INVALID | error.nameInvalid | no | — | engine/sanitise |
| NAME_TAKEN | error.nameTaken | no | — | engine |
| COLOR_TAKEN | error.colorTaken | no | — | engine |
| RESUME_INVALID | error.resumeInvalid | no | — | hello with an unknown or kicked token |
| KICKED | error.kicked | yes | 4006 | KICK |
| REPLACED | error.replaced | yes | 4005 | a newer connection for the same seat or TV |
| NOT_HOST | error.notHost | no | — | engine |
| WRONG_PHASE | error.wrongPhase | no | — | engine |
| NOT_YOUR_TURN | error.notYourTurn | no | — | engine |
| NOT_ALIVE | error.notAlive | no | — | engine |
| INVALID_TARGET | error.invalidTarget | no | — | engine |
| INVALID_SETTINGS | error.invalidSettings | no | — | engine |
| NOT_ENOUGH_PLAYERS | error.notEnoughPlayers | no | — | engine |
| INVALID_ROLE_CONFIG | error.invalidRoleConfig | no | — | engine |
| NO_WORDS_AVAILABLE | error.noWordsAvailable | no | — | engine |
| GUESS_INVALID | error.guessInvalid | no | — | engine |
| RATE_LIMITED | error.rateLimited | no; after 3 in 10 s the server closes 4008 (slow reconnect) | 4008 | server |
| INTERNAL | error.internal | no | — | server catch-all |

Other close codes:

| Close code | Meaning | Client |
|---|---|---|
| 4000 | bad `cid` | reconnect (normal backoff) |
| 4001 | hello timeout (`HELLO_TIMEOUT_MS`) | reconnect (normal backoff) |
| 4008 | rate limited | reconnect after ≥ `SLOW_RECONNECT_MS` |
| 4009 | room connection cap or pending cap | reconnect after ≥ `SLOW_RECONNECT_MS` |

**Client rule: fatality is decided by the close code only**, using `FATAL_CLOSE_CODES = [4002, 4003, 4004, 4005, 4006, 4010]` from `shared/src/constants.ts` (Kotlin `Constants` mirrors it). `error` frames are informational: they show a toast or inline message and pick which screen a following fatal close leads to.
- On a fatal close: partysocket → `.close()`; OkHttp → do not schedule a reconnect.
- On 4008/4009: wait at least `SLOW_RECONNECT_MS` before the next attempt.
- Any other close → reconnect with normal backoff (§8.4, §9.7).
- 4005 REPLACED is fatal for that socket, but the phone offers "Use it here" (§8.5), which starts a fresh connection with the stored resume token (and in turn replaces the other tab).

### 6.5 Session flows
1. **TV:**
   1. `POST /api/rooms`.
   2. Open the WS.
   3. `hello{role:"tv", tvToken}`.
   4. Receive `state` (TvView).

   A second TV connection with a valid token replaces the first: the old one gets `error REPLACED` and close 4005.
2. **New phone:**
   1. Open the WS.
   2. `hello{role:"player"}`.
   3. Receive `state` (PlayerView, `me:null`).
   4. `join{name,color,locale}`.
   5. Receive `welcome`, then `state` (to everyone).
3. **Returning phone:**
   1. `hello{role:"player", resumeToken}`.
   2. Valid token (a session exists, is not kicked, **and its playerId is still in `state.players`**) → `welcome` (same playerId and token), then `state`. The engine `RECONNECT` runs, and older connections for that player are closed with REPLACED.
   3. Invalid token → `error RESUME_INVALID`, then `state` with `me:null`. A session whose player no longer exists is deleted. The client deletes the stored token and shows Join (or the locked Join variant if the phase is not LOBBY).
   4. `hello` is accepted **only while the connection's role is `pending`**. A second `hello` on the same socket → `error BAD_MESSAGE` and nothing changes.
4. After every successful state change, the server sends a fresh `state` to every authenticated connection:
   - TV → `projectForTv`
   - joined player → `projectForPlayer(pid)`
   - player-hello'd spectator → `projectForPlayer(null)`

   `seq` is strictly increasing.
5. **Heartbeat.** The client sends `PING_FRAME` every 20 s after open. If no `PONG_FRAME` arrives within 10 s → force a reconnect. The DO answers via `ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING_FRAME, PONG_FRAME))`, set in `onStart`. If a ping reaches `onMessage` anyway, reply with `PONG_FRAME`.

### 6.6 HTTP endpoints (Worker)

| Method + path | Request | Success | Errors |
|---|---|---|---|
| `POST /api/rooms` | optional JSON `{"locale":"en"\|"fr"\|"ar"}` (default `"en"`). Body ≤ `HTTP_BODY_MAX_BYTES` (read at most that many bytes). A non-empty body requires `Content-Type: application/json`. If an `Origin` header is present it must pass §7.4 | **201** `{"code":"KXRT","tvToken":"<32hex>","joinUrl":"https://…/KXRT","wsPath":"/parties/room/KXRT"}` with `Cache-Control: no-store` | 400 `{"error":"BAD_MESSAGE"}` (bad body, too large, wrong content type), 403 `{"error":"BAD_MESSAGE"}` (origin), 429 `{"error":"RATE_LIMITED"}`, 503 `{"error":"INTERNAL"}` |
| `GET /healthz` | — | 200 `{"ok":true,"app":"mish-ana","protocol":1}` | — |
| `OPTIONS`/other methods on `/api/*` | — | 405 `{"error":"BAD_MESSAGE"}` | |
| any non-upgrade request to `/parties/*` | — | 404 | (keeps `Room.onRequest` unreachable from outside) |
| WebSocket upgrade to `/parties/room/{CODE}` | — | 101 | 404 (bad path), 403 (origin), 429 (CONNECT_LIMITER) |
| everything else | — | static assets; SPA fallback to `index.html` (handled by the assets layer before the Worker) | |

The zod schemas `CreateRoomRequest`, `CreateRoomResponse`, `HttpError` and `Healthz` live in `protocol/http.ts`.

---

## 7. Server (`/server`, Agent A)

### 7.1 `server/wrangler.jsonc` (exact keys; schema verified against wrangler 4.147.0 `config-schema.json`)
```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "mish-ana",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-30",
  "workers_dev": true,
  "minify": true,
  "observability": { "enabled": true },
  "assets": {
    "directory": "../web-client/dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*", "/parties/*", "/healthz"]
  },
  "durable_objects": { "bindings": [{ "name": "Room", "class_name": "Room" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Room"] }],
  "ratelimits": [
    { "name": "CREATE_ROOM_LIMITER", "namespace_id": "1001", "simple": { "limit": 10, "period": 60 } },
    { "name": "CONNECT_LIMITER", "namespace_id": "1002", "simple": { "limit": 60, "period": 60 } }
  ],
  "vars": { "JOIN_BASE_URL": "", "ALLOWED_ORIGINS": "", "DEBUG_INVARIANTS": "0" }
}
```
- `JOIN_BASE_URL`: when empty, the base is the request origin. The production domain is configurable here, and `*.workers.dev` is the default.
- `ALLOWED_ORIGINS`: a comma-separated list of exact origins.
- Package scripts:
  - `"dev": "wrangler dev"`
  - `"build": "wrangler deploy --dry-run --outdir dist && node scripts/check-size.mjs"`
  - `"size": "node scripts/check-size.mjs"`: fails when the minified `dist/index.js` exceeds 400 KB (every cold Worker/DO isolate parses the whole script; most of it is word-pack data).
  - `"deploy": "wrangler deploy"`
  - `"typecheck": "tsc -p ."`
- Dependencies: `partyserver@0.5.10` and `@mishana/shared`, `@mishana/word-packs` (`workspace:*`). Dev dependencies: `wrangler@4.147.0` and `@cloudflare/workers-types@5.20261003.1`.

### 7.2 `src/env.ts`
```ts
import type { Room } from "./room";
export interface Env {
  Room: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
  CREATE_ROOM_LIMITER: RateLimit;
  CONNECT_LIMITER: RateLimit;
  JOIN_BASE_URL: string;
  ALLOWED_ORIGINS: string;
  DEBUG_INVARIANTS: string;
}
```

### 7.3 Worker `src/index.ts` routing order
1. `GET /healthz` → JSON.
2. `POST /api/rooms` → `createRoom()` (§7.6). Other methods on `/api/*` → 405.
3. A path starting with `/parties/`:
   - Not a WebSocket upgrade → 404.
   - The code segment fails `ROOM_CODE_REGEX` (path must be exactly `/parties/room/{CODE}`) → 404.
   - `await env.CONNECT_LIMITER.limit({ key: CF-Connecting-IP ?? "local" })`; `!success` → 429. (The key is the raw IP inside the Worker only; it is never logged or stored.)
   - Otherwise `routePartykitRequest(req, env, { onBeforeConnect: originCheck })`. If it returns `null` → 404.
4. Anything else → `env.ASSETS.fetch(req)`. This is reached only for paths listed in `run_worker_first`, so it is effectively a fallback.

Export `{ fetch } satisfies ExportedHandler<Env>`, together with `export { Room } from "./room"`.

### 7.4 Origin check (`src/origin.ts`, used in `onBeforeConnect`)
A request is allowed when any of these is true:
- there is no `Origin` header (native TV app, sim);
- `Origin === new URL(req.url).origin`;
- `Origin` is in `ALLOWED_ORIGINS.split(",").map(trim).filter(Boolean)`.

Otherwise → `new Response("Forbidden", { status: 403 })`.

### 7.5 Room DO (`src/room.ts` thin adapter + `src/room-core.ts` logic)
```ts
export class Room extends Server<Env> {
  static options = { hibernate: true };
  onStart(): Promise<void>;                 // load meta/state/sessions into cache; set WS auto-response; reconcile (below)
  initRoom(args: InitRoomArgs): Promise<{ ok: true } | { ok: false; reason: "EXISTS" }>; // RPC; InitRoomArgs = { tvTokenHash: string; joinUrl: string; locale: Locale; now: number }
  onConnect(conn: Connection<ConnState>, ctx: ConnectionContext): Promise<void>;
  onMessage(conn: Connection<ConnState>, msg: WSMessage): Promise<void>;
  onClose(conn: Connection<ConnState>): Promise<void>;
  onAlarm(): Promise<void>;
  onRequest(): Response;                    // always 404
}
```
- Never override `webSocketMessage`, `webSocketClose`, `webSocketError`, `alarm` or `fetch` (partyserver README).
- Never use `setTimeout`/`setInterval` for game logic.
- `RoomCore` holds all behaviour and is runtime-agnostic (constructor: see "Dependency injection" below). `Room` adapts `this.ctx.storage` and `this.getConnections()`. Server unit tests drive `RoomCore` with in-memory fakes in Node.

**Serialisation (mutex).** Durable Object input gates only hold events during storage operations, so another `webSocketMessage` or the alarm can interleave at any non-storage `await` (for example `crypto.subtle.digest`). Therefore:
- `RoomCore` serialises **every entry point** (`onConnect`, `onMessage`, `onClose`, `onAlarm`, `initRoom`, and the `onStart` reconcile) through one promise-chain mutex (`src/mutex.ts`: `run<T>(fn: () => Promise<T>): Promise<T>`, FIFO, a rejected task does not poison the chain).
- Inside a handler, every crypto `await` (hashing a token or an IP) happens **before** the state is read. The read → reduce → persist → broadcast sequence has no `await` other than storage calls.

**Connection state** (`connection.setState`, ≤2 KB, survives hibernation):
```ts
type ConnState = {
  role: "pending" | "tv" | "player";   // "player" = hello'd as player (joined or spectator)
  playerId: string | null;
  cid: string;
  ipKey: string;                       // first 16 hex of sha256hex(roomCode + ":" + ip), ip = CF-Connecting-IP or "local". Never the raw IP
  epoch: number;                       // meta.createdAt at connect time; messages from an older epoch are closed 4010
  openedAt: number;
  bucket: { tokens: number; ts: number };
  strikes: number[];                   // RATE_LIMITED timestamps (last 10 s)
};
```
The runtime persists attachments across hibernation, which is why the raw IP is never stored. PRIVACY.md (M5) mentions the truncated hash.

**Storage keys** (`ctx.storage` KV API; the `__ps_name` key is reserved by partyserver and must not be touched):

| Key | Type |
|---|---|
| `meta` | `{ schema: 1, code, tvTokenHash, joinUrl, createdAt, lastActivityAt, resultsAt: number \| null }` |
| `state` | `GameState` |
| `sessions` | `Record<playerId, { tokenHash: string; kicked: boolean }>` |

Rules:
- The DO writes `state` (and `meta`/`sessions` when they change) **before** sending any message that reflects the change.
- `lastActivityAt` is updated on an accepted client message only if more than 60 s have passed since the last update.
- `resultsAt` is set when the phase becomes RESULTS and cleared when it leaves RESULTS.
- **Session pruning.** After every accepted reduce, delete every session whose `playerId` is not in `state.players` (seat expiry, `resetToLobby` removing left players, LOBBY LEAVE/KICK). Kicked sessions of players still in the game stay (marked `kicked`) until then.

**`onStart`** (after the cache loads):
1. Set the ping/pong auto-response (§6.5).
2. **Reconcile.** For every player with `connected===true` and no live connection in `getConnections()` whose `ConnState.playerId` matches, dispatch `DISCONNECT`. If anything changed, persist and reschedule the alarm. This covers a DO reset (deploy, eviction, runtime restart) where sockets dropped without `webSocketClose` reaching this instance.

**`onConnect`:**
1. If `meta` is missing → send `error ROOM_NOT_FOUND`, close 4004, and `ctx.storage.deleteAll()`. This cleans up the `__ps_name` record from probing.
2. Connection caps, counting the new socket: total ≥ `MAX_CONNECTIONS_PER_ROOM` + 1 → close 4009 (that is, reject when the total including this socket exceeds 40); pending sockets (including this one) > `MAX_PENDING_CONNECTIONS` → close 4009.
3. Parse `cid` from `conn.uri`. Invalid → close 4000.
4. `setState({role:"pending", epoch: meta.createdAt, …})`.

A `pending` connection that has not said hello after `HELLO_TIMEOUT_MS` is closed with 4001. The check runs on every message and alarm, and the alarm schedule includes the earliest pending deadline (below), so idle rooms do not accumulate pending sockets.

**`onMessage` pipeline:**
1. Binary frame or size check (§6.1).
2. Token bucket: refill `RATE_MSGS_PER_SEC`/s, capacity `RATE_BURST`. If empty → `error RATE_LIMITED`. 3 strikes within 10 s → close 4008.
3. If the frame equals `PING_FRAME` → send `PONG_FRAME`.
4. `ConnState.epoch !== meta.createdAt` → `error ROOM_EXPIRED`, close 4010.
5. `JSON.parse`; the raw `v` check (§6.1); then the zod `ClientMessageSchema`.
6. Dispatch by `t`:
   - **hello** while the role is not `pending` → `error BAD_MESSAGE`, nothing else.
   - **hello tv:** `sha256hex(tvToken)` compared in constant time with `meta.tvTokenHash`. Fail → `TV_AUTH_FAILED` and 4003. Success → role `tv`; close other `tv` connections (REPLACED); send `state`.
   - **hello player:**
     - With `resumeToken`: find the session whose `tokenHash` matches, is `!kicked`, **and whose playerId is in `state.players`**. Found → role player and `playerId`; dispatch `RECONNECT`; replace older connections for that pid; send `welcome` and `state`.
     - Not found → `error RESUME_INVALID`; if a matching session exists but its player is gone, delete it. Role player, `playerId=null`, send spectator `state`.
     - Without a token → spectator `state`.
   - **join:**
     - Requires role `player` and `playerId===null` (else `ALREADY_JOINED`, or `NOT_AUTHENTICATED` if the role is pending or tv).
     - Per-IP join limit (`JOINS_PER_MIN_PER_IP` per room, keyed by `ipKey`, in-memory map, fine to lose on hibernation) → `RATE_LIMITED`.
     - Sanitise the name (§7.9).
     - Generate `playerId` (`"p_"` + 12 random bytes hex) and a resume token (16 random bytes hex), and hash the token, **before** reading state.
     - Dispatch `JOIN`. On ok: store the session `{tokenHash}`, set the connection's playerId, send `welcome` to it, and broadcast `state`.
   - **action:**
     - Requires role tv, or player with a playerId (else `NOT_AUTHENTICATED`).
     - Build `by`, dispatch, and on error send `error` with `ref=id`.
     - After an accepted KICK: mark the session `kicked:true`, then send `error KICKED` and close 4006 on the target's connections.
     - After an accepted LEAVE: delete the session, then close the leaver's connections with 1000.
7. After any accepted reduce that changed `version`: if `DEBUG_INVARIANTS`, run `assertInvariants`. Then prune sessions, persist, broadcast and reschedule the alarm. A reduce that returns the same object sends nothing.

**`onClose`:** dispatch `DISCONNECT` only if the closed connection had a `playerId`, that playerId still has a **non-kicked session**, and this was the player's **last** open connection (compare by `cid` across `getConnections()` excluding this one). A DISCONNECT for an unknown or left player is a no-op anyway (§4.8).

**Alarm scheduling.** After every persist, and after any pending connection opens:
```
at = min(nextWakeAt(state), expiresAt(meta, state), pendingDeadline)
pendingDeadline = min(openedAt) + HELLO_TIMEOUT_MS over pending connections (absent if none)
```
If `at` differs from the current alarm, call `setAlarm(at)`. The current alarm is read with `getAlarm()` once and then cached (`RoomStore`): the cache is reset when the instance starts, after `deleteAll()` and when an alarm fires. `expiresAt` is the minimum of:
- `lastActivityAt + ROOM_IDLE_TTL_MS`;
- if phase LOBBY && `players.length===0`: `max(createdAt, lastActivityAt) + ROOM_EMPTY_TTL_MS`;
- if phase RESULTS: `resultsAt + ROOM_RESULTS_TTL_MS`.

**`onAlarm`:**
1. No `meta` → `deleteAll()` and return.
2. `now >= expiresAt` → send `error ROOM_EXPIRED` and close 4010 on every connection, then `deleteAlarm()` and `deleteAll()`.
3. Otherwise dispatch `TICK`. If the version changed → persist and broadcast. Also close stale pending connections (4001), then reschedule.

Alarms may fire early or late; the engine compares times. A failed alarm handler is retried by the runtime, and `TICK` is idempotent.

**Hibernation rules:**
- All authoritative data is in storage.
- An in-memory cache (`meta`, `state`, `sessions`) is allowed but must be reloadable in `onStart`, and `initRoom` replaces it (§7.6).
- Per-socket data lives in `setState`.
- No intervals.
- Ping/pong uses the auto-response, so idle rooms stay hibernated.

**Dependency injection (testability).** `RoomCore` is constructed with `{ storage: RoomStorage, connections: Connections, clock: Clock, crypto: CryptoProvider, catalog: Catalog, debugInvariants: boolean }`.
- `RoomStorage` = `get/put(entries)/deleteAll/getAlarm/setAlarm/deleteAlarm`. `RoomStore` (`room-store.ts`) owns the keys `meta`, `state`, `sessions`; every persist is one multi-key `put` of `state` plus whichever of `meta`/`sessions` changed. Wire frames are built in `frames.ts` (typed against the protocol message types).
- `RoomCore` lists the open sockets once per serialised entry point (listing hibernated sockets deserialises every attachment) and drops the sockets it closes from that snapshot.
- `Connections` = `list(): ConnHandle[]`, where `ConnHandle = {state, setState, send, close}`.
- Only `room.ts` builds the real `CATALOG` (§7.8) and imports partyserver. Server tests pass `TEST_CATALOG` from `@mishana/shared/testing` and never import `room.ts` or `index.ts`.

**Logging and privacy.**
- Server code never logs message bodies, `GameState`, views, words, guesses, tokens, token hashes, names or IPs.
- The catch-all (`INTERNAL`) logs only `{ code, phase, roomCode }`.
- `InvariantError` messages name the invariant number and player ids only, never word or guess text.
- Workers observability stays enabled under these rules.

### 7.6 Room creation (`src/http.ts`, `src/codes.ts`)
`http.ts` never imports partyserver. Its entry point takes its dependencies explicitly:
```ts
export interface CreateRoomDeps {
  getStub(code: string): Promise<{ initRoom(args: InitRoomArgs): Promise<{ ok: true } | { ok: false; reason: "EXISTS" }> }>;
  randomBytes(n: number): Uint8Array;
  now(): number;
}
export function createRoom(req: Request, env: Env, deps: CreateRoomDeps): Promise<Response>;
```
`index.ts` passes `getStub: (code) => getServerByName(env.Room, code)`. `codes.test.ts` passes a fake whose `initRoom` returns EXISTS twice.

1. Origin: if an `Origin` header is present and fails §7.4 → 403.
2. Rate limit: `await env.CREATE_ROOM_LIMITER.limit({ key: req.headers.get("CF-Connecting-IP") ?? "local" })`. If `!success` → 429.
3. Read at most `HTTP_BODY_MAX_BYTES`; more → 400. A non-empty body needs `Content-Type: application/json` (else 400) and must parse with `CreateRoomRequest` (else 400). An empty body is OK.
4. Generate `tvToken`: 16 random bytes as hex. `tvTokenHash = sha256hex(tvToken)` using `crypto.subtle.digest("SHA-256")`.
5. Generate a code uniformly by rejection sampling over bytes: accept byte `b < 230` and use `ALPHABET[b % 23]`.
6. Up to 10 attempts:
   - `stub = await deps.getStub(code)`. The DO is created from the TV's request, so it is placed near the host.
   - `r = await stub.initRoom({...})`. If `r.ok`, stop.
   - Otherwise draw a new code.
   - After 10 failures → 503.
7. `joinUrl = (env.JOIN_BASE_URL || new URL(req.url).origin).replace(/\/$/, "") + "/" + code`.
8. Respond 201 with `Cache-Control: no-store` (the body carries `tvToken`).

`initRoom` (native RPC, inside the mutex). Native RPC bypasses partyserver's `fetch` initialisation, and the DO may have been evicted after `getServerByName` ran `onStart`, so `initRoom` never trusts the cache:
- Read `meta` **directly from storage**.
- If `meta` exists and the room has not expired → `{ok:false, reason:"EXISTS"}`.
- If `meta` exists but has expired (its alarm has not fired yet): send `error ROOM_EXPIRED` and close 4010 on every connection from `getConnections()` first.
- Then `deleteAll()`, write `meta`, `state = createInitialState({roomCode, joinUrl, seed: randomUint32, wordLocale: locale})` and `sessions={}`, **replace the in-memory cache** (meta, state, sessions) in the same critical section, schedule the alarm, and return ok.
- Old sockets that survived anyway carry an older `ConnState.epoch` and are closed 4010 on their next message (§7.5).

### 7.7 Tokens (`src/tokens.ts`)
- `randomHex(bytes, source = randomBytes)`: `source` defaults to `crypto.getRandomValues`; the Worker and `RoomCore` pass their injected `randomBytes`.
- `sha256hex(s)`.
- `timingSafeEqualHex(a, b)`: same length, XOR-accumulate over all chars.
- Tokens are never logged and never stored in plain text.

### 7.8 Catalog
Only `room.ts` builds it, once per isolate on the first Room access (`onStart`): `loadCatalog(PACKS)` (schema-parse + `buildCatalog`, from `@mishana/shared/packs`), where `PACKS` comes from `@mishana/word-packs`. Building it lazily keeps the zod parse of the packs off the stateless Worker's cold start. It passes the catalog to `RoomCore`. A schema failure throws on the Room's start, and `word-packs/test/packs.test.ts` and `pnpm lint:packs` catch it earlier. `RoomCore` tests use the test catalog, so they do not depend on the shipped packs.

### 7.9 Name sanitising (`shared/src/engine/sanitize.ts`, exported from `@mishana/shared/engine` as `sanitizeName`)
```
NFC
→ remove \p{Cc}, \p{Cf}, \p{Co}, \p{Cs} (Cf includes bidi controls U+200E/F, U+202A–202E, U+2066–2069, ZWJ)
→ collapse \s+ to " " → trim
→ split into graphemes (Intl.Segmenter, granularity "grapheme"); in each grapheme keep at most 2 combining marks (\p{M})
→ if more than NAME_MAX_CHARS (16) graphemes: keep the first 16, then trim again
→ if more than NAME_MAX_CODEPOINTS (64) code points: NAME_INVALID
```
An empty result → `null` (`NAME_INVALID`). Uniqueness compares `nameKey(name) = name.normalize("NFKC").toLowerCase()`. The server, the web client (live preview) and the engine all use the same implementation. There is no `server/src/sanitize.ts`.

### 7.10 Local dev (`tools/dev.mjs`, Agent A)
1. Detect `LAN_HOST`:
   - `.env` `LAN_HOST` wins.
   - Otherwise the first non-internal IPv4 from `os.networkInterfaces()`, preferring `192.168.*`, then `10.*`, then `172.16–31.*`.
2. If `web-client/dist/index.html` is missing → run `pnpm --filter @mishana/web-client build` once.
3. Spawn both of these with `stdio: inherit`, and kill both on SIGINT:
   - `pnpm --filter @mishana/server exec wrangler dev --ip 0.0.0.0 --port 8787 --show-interactive-dev-session=false --var JOIN_BASE_URL:http://${LAN_HOST}:5173 --var ALLOWED_ORIGINS:http://${LAN_HOST}:5173,http://localhost:5173 --var DEBUG_INVARIANTS:1`
   - `pnpm --filter @mishana/web-client exec vite --host 0.0.0.0 --port 5173 --strictPort`
4. Print:
   - `TV server URL: http://${LAN_HOST}:8787` (use with `-PserverUrl=`)
   - `Phone/TV-mock: http://${LAN_HOST}:5173/tv`

The `--var KEY:VALUE` syntax was verified in the wrangler 4.147.0 source.

---

## 8. Web client (`/web-client`, Agent B)

### 8.1 Package
- Dependencies: `@mishana/shared` (workspace), `partysocket@1.3.0`, `preact@10.29.8`, `@preact/signals@2.11.3`, `qrcode-generator@2.0.4`.
- Dev dependencies: `vite@8.3.2`, `@preact/preset-vite@2.10.6`, `@playwright/test@1.63.0`.
- Scripts:
  - `dev` (vite)
  - `build` (`vite build`)
  - `typecheck`
  - `size` (`node scripts/check-size.mjs`)
  - `e2e` (`playwright test`)

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
export default defineConfig({
  plugins: [preact()],
  server: { host: true, port: 5173, strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8787", "/healthz": "http://127.0.0.1:8787",
             "/parties": { target: "ws://127.0.0.1:8787", ws: true } } },
  build: { outDir: "dist", target: "es2022" },
});
```

### 8.2 Layout
```
web-client/index.html          <meta viewport "width=device-width, initial-scale=1, viewport-fit=cover">, <html lang dir> set at runtime
web-client/src/main.tsx app.tsx router.ts styles.css
web-client/src/net/{connection.ts, api.ts, ids.ts}
web-client/src/state/store.ts  (signals: view, me, conn, lastError, locale)
web-client/src/i18n/t.ts       (imports @mishana/shared/i18n/{en,fr,ar}.json)
web-client/src/lib/{storage.ts, wakelock.ts, haptics.ts, countdown.ts}
web-client/src/screens/{Home,Join,Lobby,Settings,Reveal,Clues,Vote,Elimination,Guess,Results,Kicked,RoomGone,Replaced}.tsx
web-client/public/_headers     (§8.10)
web-client/src/components/{PlayerChip,Timer,HoldToReveal,ColorPicker,ConnBanner,LangSwitch}.tsx
web-client/src/tv-mock/{TvMock.tsx, Qr.tsx}   (lazy import; only route /tv)
web-client/scripts/check-size.mjs
web-client/e2e/game.spec.ts  web-client/playwright.config.ts
web-client/test/*.test.ts
```

### 8.3 Routes (tiny `location.pathname` router; no library)

| Path | Screen |
|---|---|
| `/` | Home: enter a 4-letter code. Typed input is upper-cased, and characters outside the alphabet are rejected. Navigates to `/{CODE}` |
| `/{code}` (any case) | A non-canonical code is replaced with its canonical upper case via `history.replaceState`. Then connect and show screens by phase (§8.5) |
| `/tv` | TV mock: `POST /api/rooms`, connect as TV, render the TvView with host controls |

### 8.4 Connection (`net/connection.ts`)
```ts
new PartySocket({
  host: location.host, protocol: location.protocol === "https:" ? "wss" : "ws", // always explicit
  party: "room", room: code,
  query: () => ({ cid: randomId() }),     // fresh per attempt
  minReconnectionDelay: 500, maxReconnectionDelay: 10_000, reconnectionDelayGrowFactor: 2,
  connectionTimeout: 4000, maxRetries: Infinity,
  maxEnqueuedMessages: 0,                  // never queue while offline (see below)
});
```
- **No queueing.** partysocket 1.3.0 defaults to `maxEnqueuedMessages: Infinity` and flushes its queue *before* dispatching `open`, so queued pings or a stale `CAST_VOTE` would reach the server before `hello`. Hence `maxEnqueuedMessages: 0`, and **every send (ping, join, action) happens only when `socket.readyState === 1`**. Otherwise the UI shows the `conn.reconnecting` banner and the tap does nothing.
- `randomId()` is 16 bytes from `crypto.getRandomValues`, as hex. **Do not use `crypto.randomUUID`**: it is unavailable in insecure contexts (http LAN dev).
- `open`: send hello with the `resumeToken` stored under that code, if any.
- `message`:
  - A frame equal to `PONG_FRAME` → clear the pong timer.
  - Otherwise `JSON.parse`. A `t` the client does not know → ignore. `state` → store the view **only if `seq` > the last seq** (reset to −1 on each open). `welcome` → save the resume record. `error` → remember `code` as `lastError` and show it (toast or inline, §8.5). Errors never decide fatality.
- `close` (read `event.code`): if `FATAL_CLOSE_CODES` contains it → `socket.close()` and route by code: 4006 → Kicked; 4004/4010 → RoomGone; 4005 → Replaced; 4002 → RoomGone with `error.unsupportedVersion` and a Reload button; 4003 cannot happen on the phone. If `SLOW_RECONNECT_CLOSE_CODES` contains it → `socket.close()`, then `socket.reconnect()` after `SLOW_RECONNECT_MS`. Otherwise let partysocket reconnect.
- Heartbeat: start an interval on `open` (every 20 s send `PING_FRAME`; if no pong within 10 s → `socket.reconnect()`), and **stop it on `close`**. It never sends when `readyState !== 1`.
- On `visibilitychange` to visible, `online`, or `pageshow` with `persisted`: if `readyState !== 1`, call `socket.reconnect()`. Also re-acquire the wake lock.
- Zod is **not** used. Messages are typed with `import type` from `@mishana/shared/protocol` and trusted.

### 8.5 Screens by phase (`me` = `view.me`)

| Condition | Screen | Key elements (i18n keys in §11) |
|---|---|---|
| `me===null && phase==="LOBBY"` | Join | name input (≥16 px font, live `sanitizeName` preview), colour grid (taken colours disabled), Join. Last name and colour are pre-filled from storage. Inline errors: NAME_INVALID, NAME_TAKEN, COLOR_TAKEN (keep the name, auto-select the first free colour, CTA stays enabled), ROOM_FULL, RATE_LIMITED |
| `me===null && phase!=="LOBBY"` | Join (locked) | `join.locked` + a read-only live line (`round.label` · phase name); the name field stays editable. When the phase becomes LOBBY: unlock, toast `join.unlocked`, haptic |
| LOBBY | Lobby | players list; host sees Start (disabled + `startBlocker` text: `lobby.needPlayers` / `lobby.blockerRoles` / `lobby.blockerWords`), Settings, a kick ✕ per player; non-host sees `lobby.waitingHost` |
| LOBBY + host taps Settings | Settings | every §4.4 setting, sends `UPDATE_SETTINGS` |
| ROLE_REVEAL | Reveal | HoldToReveal card (word or `reveal.noWord` + `reveal.youAreBlank`), role line if `me.role`, Ready button |
| CLUES / TIE_BREAK | Clues | if `currentSpeakerId===me.id`: big `clues.done` button; else `clues.speaking`; peek button (HoldToReveal) always available |
| VOTING | Vote | alive targets except me (only `tieCandidates` if `revote`), select + confirm, `vote.youVoted` (restored from `me.myVote` after a reconnect); dead players → `vote.dead`. No "change vote" UI (the server allows overwrites; the phone does not offer them) |
| ELIMINATION | Elimination | for everyone (survivors, the eliminated, spectators): outcome line (`elim.eliminated` + role, `elim.noElimination`, or `vote.nobodyVoted`), compact tally from `lastVote.tally` and `abstainIds`, deadline bar. The eliminated player additionally sees `elim.you` |
| MR_WHITE_GUESS | Guess | guesser while PENDING: text input (maxlength 40) + submit; after submit it shows its own typed text from local state (the view has `text:null`). VIP ≠ guesser, status WRONG and not yet overridden: `guess.accept` (sends `HOST_OVERRIDE_GUESS{accept:true}` after a confirm sheet). Others: `guess.waiting` / verdict (`guess.correct`, `guess.wrong`, `guess.timeout`) |
| RESULTS | Results | winner, both words (+translit), scoreboard with `pointsAwarded`, `result.guesses` (`guess.guessed`), `results.pack`, host: Play again; others: `results.waitingHost` |
| close 4006 | Kicked | `phone.kicked` |
| close 4004 / 4010 / 4002 | RoomGone | `phone.roomGone` (or the error text for 4002, with Reload), link to `/` |
| close 4005 | Replaced | `phone.replaced` + `phone.useHere` (reconnects with the stored resume token) |

Always shown:
- `ConnBanner` when the socket is not OPEN.
- Timer (from `deadline.at − (Date.now() + clockOffset)`, where each `state` gives a sample `serverNow − Date.now()` at receipt; `clockOffset` is the **largest** of the last 5 samples, i.e. the least delayed one).
- `LangSwitch`.
- A Leave option in the menu (`phone.menu`; sends `LEAVE`, clears storage, goes to `/`).
- Non-fatal errors that are not inline (NOT_HOST, WRONG_PHASE, NOT_YOUR_TURN, NOT_ALIVE, INVALID_TARGET, RATE_LIMITED, INTERNAL, …) show a 3 s toast with `t(messageKey)`.

### 8.6 Storage keys (`lib/storage.ts`; every access wrapped in try/catch)

| Key | Value |
|---|---|
| `mishana:resume:{CODE}` | `{"playerId":"p_…","resumeToken":"…","savedAt":<ms>}` |
| `mishana:locale` | `"en"\|"fr"\|"ar"` |
| `mishana:name` | last name |
| `mishana:color` | last colour id |

Resume records older than 6 h are ignored and deleted.

### 8.7 i18n on web (`i18n/t.ts`)
`t(key, params?)`:
- Look up the current locale first, then fall back to `en`, then to the key itself.
- Object values are plurals: `category = new Intl.PluralRules(locale).select(params.count)`, then use `value[category] ?? value.other`.
- Replace `{name}` placeholders.
- Format numbers with `Intl.NumberFormat(locale, { numberingSystem: "latn" })`.

Setting a locale updates `<html lang>` and `dir` (`ar` → `rtl`). CSS uses logical properties only, and player names are wrapped in `<bdi>`.

### 8.8 Mobile rules
- Wake lock: request it on the Join tap and re-request on visible. Unsupported or insecure context → show the `phone.keepScreenOn` hint.
- `navigator.vibrate(30)` on your turn, guarded by a feature check.
- `100dvh`, `env(safe-area-inset-*)`, `touch-action: manipulation`.

### 8.9 Budget
`scripts/check-size.mjs` gzips (level 9) every `dist/assets/*.js` **except** chunks whose name contains `tv-mock` or `TvMock`, and fails if the total is > 60 KB. Fonts are excluded.

### 8.10 Security headers (`web-client/public/_headers`)
```
/*
  Content-Security-Policy: default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
```
The resume token in localStorage is the only credential for a seat, and the room code sits in the URL path. [VERIFY that Workers static assets honour `_headers` with wrangler 4.147.0; if not, B reports it as a SPEC-GAP. Do not move asset serving behind the Worker.]

---

## 9. TV app (`/tv-app`, Agent C) — Kotlin + Compose for TV

### 9.1 Gradle (`tv-app/gradle/libs.versions.toml`)
```toml
[versions]
agp = "9.4.0"
kotlin = "2.4.20"
composeBom = "2026.09.00"
tvMaterial = "1.1.0"
tvFoundation = "1.0.0"
activityCompose = "1.13.0"     # [VERIFY] stable per developer.android.com release page 2026-10-03
lifecycle = "2.11.0"           # [VERIFY]
coreKtx = "1.19.1"             # [VERIFY]
appcompat = "1.8.0"            # [VERIFY]
kotlinxSerialization = "1.11.0"
coroutines = "1.11.0"
okhttp = "5.5.0"
zxing = "3.5.4"
junit = "4.13.2"
turbine = "1.2.1"

[libraries]
compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
compose-ui = { group = "androidx.compose.ui", name = "ui" }
compose-foundation = { group = "androidx.compose.foundation", name = "foundation" }
compose-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
compose-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
tv-material = { group = "androidx.tv", name = "tv-material", version.ref = "tvMaterial" }
tv-foundation = { group = "androidx.tv", name = "tv-foundation", version.ref = "tvFoundation" }
activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycle" }
lifecycle-runtime-compose = { group = "androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "lifecycle" }
core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
appcompat = { group = "androidx.appcompat", name = "appcompat", version.ref = "appcompat" }
kotlinx-serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version.ref = "kotlinxSerialization" }
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }
kotlinx-coroutines-test = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-test", version.ref = "coroutines" }
okhttp = { group = "com.squareup.okhttp3", name = "okhttp", version.ref = "okhttp" }
okhttp-mockwebserver = { group = "com.squareup.okhttp3", name = "mockwebserver3", version.ref = "okhttp" }
zxing-core = { group = "com.google.zxing", name = "core", version.ref = "zxing" }
junit = { group = "junit", name = "junit", version.ref = "junit" }
turbine = { group = "app.cash.turbine", name = "turbine", version.ref = "turbine" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
```

AGP 9 uses **built-in Kotlin**, so do not apply `org.jetbrains.kotlin.android`.

Files:
- `settings.gradle.kts`: `rootProject.name = "mish-ana-tv"` and `include(":app")`.
- Single module `:app`.
- `gradle/wrapper/gradle-wrapper.properties`: `distributionUrl=https\://services.gradle.org/distributions/gradle-9.6.0-bin.zip`. No wrapper jar (it cannot be generated here). `docs/TV.md` tells the user to run `gradle wrapper --gradle-version 9.6.0` once, or to open the project in Android Studio.

`app/build.gradle.kts` essentials:
- `namespace` and `applicationId` are `"app.mishana.tv"`.
- `compileSdk = 37` [VERIFY the DSL form under AGP 9; if deprecated, use `compileSdk { version = release(37) }`].
- `minSdk = 26`, `targetSdk = 36`, `versionCode = 1`, `versionName = "0.1.0"`.
- `buildFeatures { compose = true; buildConfig = true }`.
- Java 17 compile options.
- `buildConfigField("String", "SERVER_URL", "\"$serverUrl\"")`, where:
  ```
  serverUrl = (project.findProperty("serverUrl") as String?)
      ?: (project.findProperty("mishana.prodServerUrl") as String?)
      ?: "https://mish-ana.example.workers.dev"
  ```
  `gradle.properties` defines `mishana.prodServerUrl=https://mish-ana.example.workers.dev` (placeholder until deploy), `android.useAndroidX=true`, and `org.gradle.jvmargs=-Xmx4g`.

Dependencies:
- Compose BOM (platform), ui, foundation, tooling-preview
- tv-material, tv-foundation
- activity-compose, lifecycle-viewmodel-compose, lifecycle-runtime-compose
- core-ktx, appcompat
- kotlinx-serialization-json, coroutines-android
- okhttp, zxing-core
- tests: junit, coroutines-test, turbine, okhttp-mockwebserver
- `debugImplementation` ui-tooling

### 9.2 Manifest (`app/src/main/AndroidManifest.xml`)
Follows RESEARCH 02 §1 exactly:
- `INTERNET` permission.
- `leanback required=true`; `touchscreen`, `faketouch` and `wifi` `required=false`.
- `android:banner="@drawable/banner"` (320×180 px xhdpi containing the name) and `android:icon="@mipmap/ic_launcher"` (160×160).
- `android:supportsRtl="true"`, `android:localeConfig="@xml/locales_config"` (en, fr, ar).
- `MainActivity` exported, `screenOrientation="landscape"`, `LEANBACK_LAUNCHER` + `MAIN`.
- `AppLocalesMetadataHolderService` with `autoStoreLocales=true`, for AppCompat per-app locales on API < 33.
- Release: no cleartext.
- `src/debug/AndroidManifest.xml` adds `android:networkSecurityConfig="@xml/network_security_config"`, and `src/debug/res/xml/network_security_config.xml` holds `<base-config cleartextTrafficPermitted="true"/>`.
- The theme is an AppCompat `NoActionBar` dark theme. It hosts only Compose.

### 9.3 Packages and files (`app/src/main/java/app/mishana/tv/`)

| Path | Contents |
|---|---|
| `MainActivity.kt` | `AppCompatActivity`; `setContent { MishAnaTheme { AppRoot(vm) } }` |
| `Brand.kt` | `object Brand { const val NAME = "Mish Ana!"; const val NAME_AR = "مش أنا!" }` |
| `Constants.kt` | mirrors §3: alphabet, timings, `PING_FRAME`, `PONG_FRAME`, `FATAL_CLOSE_CODES`, `SLOW_RECONNECT_CLOSE_CODES`, `SLOW_RECONNECT_MS`, `SETTINGS_BOUNDS` (as a data class per key), `COLORS: List<PlayerColor>` with `PlayerColor(id: String, argb: Long, shape: AvatarShape, glyphIsCream: Boolean)` in §3 order |
| `protocol/Model.kt` | enums + view data classes (§9.5) |
| `protocol/Messages.kt` | `ServerMessage`, `ClientMessage`, `ClientIntent`, `SettingsPatch` |
| `protocol/ProtocolJson.kt` | Json instances |
| `net/RoomApi.kt` | `suspend fun createRoom(baseUrl: String, locale: String): CreateRoomResponse` (OkHttp POST, IO dispatcher) |
| `net/RoomSocket.kt` | WS client (§9.7) |
| `net/ReconnectPolicy.kt` | pure delay function |
| `net/Heartbeat.kt` | pure heartbeat/reconnect timing: `Heartbeat(scope: CoroutineScope, clock: () -> Long, send: (String) -> Boolean, onTimeout: () -> Unit)` with `start()`, `stop()`, `onPong()` |
| `game/GameViewModel.kt` | state machine (§9.8) |
| `game/Countdown.kt` | remaining-time computation |
| `ui/theme/*` | dark theme, Cairo font family (or `FontFamily.SansSerif` if the font file is unavailable; `// SPEC-GAP` note) |
| `ui/AppRoot.kt` | phase → screen switch, pause menu overlay, BackHandler |
| `ui/screens/{Home,Lobby,Settings,RoleReveal,Clues,Voting,Elimination,BlankGuess,Results,Fatal,DebugSettings}Screen.kt` | |
| `ui/components/{QrCode,PlayerTile,TimerRing,PauseMenu}.kt` | |
| `i18n/LocaleController.kt` | `AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))` |
| `i18n/I18nKeys.kt` | **generated by D** (§11.3 rule 5) |
| `settings/DebugPrefs.kt` | SharedPreferences `"mishana_debug"`, key `server_url` (debug builds only) |

### 9.4 Server URL resolution
`effectiveServerUrl` is:
- in debug builds: `DebugPrefs.serverUrl` if not blank, else `BuildConfig.SERVER_URL`;
- in release builds: `BuildConfig.SERVER_URL`.

The WS URL is `serverUrl` with `http→ws` and `https→wss`, plus `/parties/room/$code?_pk=${uuid}&cid=${uuid}`. Both UUIDs are fresh per attempt (`UUID.randomUUID()`).

### 9.5 Kotlin protocol mirror (exact names; kotlinx.serialization)
```kotlin
@file:OptIn(ExperimentalSerializationApi::class)
package app.mishana.tv.protocol
// ProtocolJson.kt also needs @file:OptIn(ExperimentalSerializationApi::class), because it uses explicitNulls.

@Serializable enum class Phase { LOBBY, ROLE_REVEAL, CLUES, VOTING, TIE_BREAK, ELIMINATION, MR_WHITE_GUESS, RESULTS }
@Serializable enum class Role { CIVILIAN, UNDERCOVER, BLANK }
@Serializable enum class Winner { CIVILIANS, INFILTRATORS, BLANK }
@Serializable enum class DeadlineKind { REVEAL, CLUE, VOTE, ELIMINATION, GUESS, VERDICT }
@Serializable enum class VoteOutcome { ELIMINATED, TIE, RANDOM, NO_ELIMINATION }
@Serializable enum class GuessStatus { PENDING, CORRECT, WRONG, TIMEOUT }
@Serializable enum class HistoryCause { VOTE, RANDOM, KICK, LEAVE, NONE }
@Serializable enum class WinRule { @SerialName("official") OFFICIAL, @SerialName("parity") PARITY }
@Serializable enum class RoleMode { @SerialName("auto") AUTO, @SerialName("custom") CUSTOM }
@Serializable enum class TieBreak { @SerialName("random") RANDOM, @SerialName("none") NONE }

@Serializable data class WordRef(val text: String, val translit: String?)
@Serializable data class RoleCounts(val civilian: Int, val undercover: Int, val blank: Int)
@Serializable data class Points(val civilian: Int, val undercover: Int, val blank: Int)
@Serializable data class LocalizedTitle(val en: String, val fr: String, val ar: String)
@Serializable data class Settings(
  val winRule: WinRule, val revealRoles: Boolean, val roleMode: RoleMode, val undercoverCount: Int, val blankCount: Int,
  val clueSeconds: Int, val voteSeconds: Int, val revealSeconds: Int, val guessSeconds: Int, val tieBreak: TieBreak,
  val blankGuess: Boolean, val wordLocale: String, val packIds: List<String>, val difficulties: List<Int>,
  val familyFilter: Boolean, val swapSides: Boolean, val points: Points)
@Serializable data class PublicPlayer(
  val id: String, val name: String, val color: String, val seat: Int, val connected: Boolean, val alive: Boolean,
  val left: Boolean, val isHost: Boolean, val ready: Boolean, val spoke: Boolean, val hasVoted: Boolean, val revealedRole: Role?, val score: Int)
@Serializable data class DeadlineView(val kind: DeadlineKind, val at: Long, val durationMs: Long)
@Serializable data class TallyEntry(val targetId: String, val voterIds: List<String>)
@Serializable data class VoteSummary(val round: Int, val revote: Boolean, val tally: List<TallyEntry>, val abstainIds: List<String>, val outcome: VoteOutcome, val eliminatedId: String?)
@Serializable data class Eliminated(val playerId: String, val role: Role)
@Serializable data class GuessView(val playerId: String, val status: GuessStatus, val text: String?, val overridden: Boolean)
@Serializable data class PackRef(val id: String, val version: Int, val title: LocalizedTitle)
@Serializable data class ResultView(val winner: Winner, val winnerIds: List<String>, val civilianWord: WordRef, val undercoverWord: WordRef, val pack: PackRef, val pointsAwarded: Map<String, Int>, val guesses: List<GuessView>)
@Serializable data class HistoryEntry(val round: Int, val eliminatedId: String?, val role: Role?, val cause: HistoryCause)
@Serializable data class PackInfo(val id: String, val locale: String, val title: LocalizedTitle, val pairCount: Int, val ageRating: String)
@Serializable data class TvView(
  val kind: String, // always "tv"
  val roomCode: String, val joinUrl: String, val phase: Phase, val gameNumber: Int, val round: Int, val settings: Settings,
  val players: List<PublicPlayer>, val hostPlayerId: String?, val roleCounts: RoleCounts?, val canStart: Boolean, val startBlocker: String?,
  val speakingOrder: List<String>, val currentSpeakerId: String?, val revote: Boolean, val tieCandidates: List<String>,
  val deadline: DeadlineView?, val votesCast: Int, val votesExpected: Int, val lastVote: VoteSummary?, val eliminated: Eliminated?,
  val guess: GuessView?, val result: ResultView?, val history: List<HistoryEntry>, val availablePacks: List<PackInfo>)

@Serializable @JsonClassDiscriminator("t") sealed class ServerMessage
@Serializable @SerialName("welcome") data class WelcomeMsg(val v: Int = 1, val playerId: String, val resumeToken: String, val roomCode: String) : ServerMessage()
@Serializable @SerialName("state") data class StateMsg(val v: Int = 1, val seq: Long, val serverNow: Long, val view: TvView) : ServerMessage()
@Serializable @SerialName("error") data class ErrorMsg(val v: Int = 1, val code: String, val messageKey: String, val ref: String?) : ServerMessage()
@Serializable @SerialName("pong") data class PongMsg(val v: Int = 1) : ServerMessage()

@Serializable @JsonClassDiscriminator("t") sealed class ClientMessage
@Serializable @SerialName("hello") data class HelloTv(val v: Int = 1, val role: String = "tv", val tvToken: String) : ClientMessage()
@Serializable @SerialName("action") data class ActionMsg(val v: Int = 1, val id: String? = null, val a: ClientIntent) : ClientMessage()

@Serializable @JsonClassDiscriminator("type") sealed class ClientIntent
@Serializable @SerialName("UPDATE_SETTINGS") data class UpdateSettings(val patch: SettingsPatch) : ClientIntent()
@Serializable @SerialName("START") data object Start : ClientIntent()
@Serializable @SerialName("HOST_ADVANCE") data object HostAdvance : ClientIntent()
@Serializable @SerialName("HOST_OVERRIDE_GUESS") data class HostOverrideGuess(val accept: Boolean) : ClientIntent()
@Serializable @SerialName("KICK") data class Kick(val playerId: String) : ClientIntent()
@Serializable @SerialName("PLAY_AGAIN") data object PlayAgain : ClientIntent()
@Serializable @SerialName("BACK_TO_LOBBY") data object BackToLobby : ClientIntent()
// TV never sends READY / CLUE_DONE / CAST_VOTE / SUBMIT_GUESS / LEAVE.
@Serializable data class SettingsPatch(
  val winRule: WinRule? = null, val revealRoles: Boolean? = null, val roleMode: RoleMode? = null, val undercoverCount: Int? = null,
  val blankCount: Int? = null, val clueSeconds: Int? = null, val voteSeconds: Int? = null, val revealSeconds: Int? = null,
  val guessSeconds: Int? = null, val tieBreak: TieBreak? = null, val blankGuess: Boolean? = null, val wordLocale: String? = null,
  val packIds: List<String>? = null, val difficulties: List<Int>? = null, val familyFilter: Boolean? = null,
  val swapSides: Boolean? = null, val points: Points? = null)
@Serializable data class CreateRoomRequest(val locale: String)
@Serializable data class CreateRoomResponse(val code: String, val tvToken: String, val joinUrl: String, val wsPath: String)
```

`ProtocolJson.kt`:
```kotlin
@file:OptIn(ExperimentalSerializationApi::class)
package app.mishana.tv.protocol
object ProtocolJson {
  val decoder = Json { ignoreUnknownKeys = true; explicitNulls = true }                    // production S2C
  val encoder = Json { encodeDefaults = true; explicitNulls = false }                      // C2S (omits null patch fields)
  val strict  = Json { ignoreUnknownKeys = false; explicitNulls = true; encodeDefaults = true } // tests only
  fun decodeServer(text: String): ServerMessage? // returns null for PONG_FRAME handled upstream, unknown "t", or SerializationException
}
```
Ping and pong are not serialised: the client sends `Constants.PING_FRAME` literally and compares incoming text with `PONG_FRAME` before decoding.

### 9.6 Screens ↔ phases (D-pad; RESEARCH 02 §3)

| UI state / phase | Screen | Initial focus (`FocusRequester` + `LaunchedEffect`) | Primary actions | Back |
|---|---|---|---|---|
| creating / failed | Home (splash only: wordmark, `brand.slogan`, spinner `tv.creatingRoom`, or `tv.createFailed` + Retry) | Retry (on failure) | Retry; long-press OK on the version label → DebugSettings (debug builds) | exit app |
| LOBBY | Lobby | Start (if `canStart` or `startBlocker==="NOT_ENOUGH_PLAYERS"`), else Settings | QR (§9.9), code (huge), host line from `joinUrl`, player tiles (kick via tile → confirm), roleCounts summary, bottom bar: Settings, Language, Start (`START`). OK on a disabled Start shakes; for `INVALID_ROLE_CONFIG`/`NO_WORDS_AVAILABLE` it opens Settings on the offending row | **exit app immediately** (TV-DB; Lobby is root; no confirm) |
| LOBBY → Settings | Settings | first category | rows: Left/Right (and OK) step the value by `SETTINGS_BOUNDS` → `UPDATE_SETTINGS` (debounced 300 ms) | Lobby |
| ROLE_REVEAL | RoleReveal | action pill `tv.startNow` | ready checkmarks (away > ready), timer | pause menu |
| CLUES / TIE_BREAK | Clues | action pill `clues.skipTurn` | spotlight on current speaker, order strip, timer, tie-break badge | pause menu |
| VOTING | Voting | action pill `vote.close` | tiles with ✓ for `hasVoted`, `votesCast/votesExpected`, timer | pause menu |
| ELIMINATION | Elimination | action pill `common.continue` | vote reveal then role flip, both inside the ELIMINATION deadline; no-elimination and random-pick variants | pause menu |
| MR_WHITE_GUESS | BlankGuess | while PENDING: action pill `guess.skip`; after: Continue | suspense; verdict (`guess.correct`/`guess.wrong`/`guess.timeout`); WRONG and not overridden: `guess.accept`; CORRECT and not overridden: `guess.reject` (TV only). The guess text is not available before RESULTS | pause menu |
| RESULTS | Results | Play again (`PLAY_AGAIN`) | winner banner, both words (+translit), scoreboard + `pointsAwarded`, `result.guesses`, history timeline, Change settings (sends `PLAY_AGAIN`, then opens Settings), New room (confirm `results.newRoomConfirm`, then `createRoom()`) | pause menu |
| pause overlay | PauseMenu (`tv.pauseTitle`, footer `tv.pauseNote`) | Resume | Resume; Skip (`HOST_ADVANCE`, `tv.skip`); Players… (`tv.players` → list → KICK with confirm); End game (`BACK_TO_LOBBY`, confirm `tv.endGameConfirm`); Exit app (`finish()`) | close overlay |
| Fatal | Fatal (`messageKey` text) | New room | New room (`createRoom()`) | exit app |

**In-game action pill (one pattern on every in-game screen).** A single ghost pill in the bottom-end action bar holds focus. The first OK arms it (label switches to `tv.pressAgain` for 3 s); a second OK within 3 s sends `HOST_ADVANCE`. On a reveal animation, the first OK jumps the animation to its end state locally; the pill logic then applies. When a focused node leaves composition (a kicked tile, an expired verdict button), focus moves to the screen's default target.

Rules:
- Use `focusRestorer()` on tile grids.
- Use the standard `LazyRow`/`LazyVerticalGrid`; no `TvLazy*`.
- Use `androidx.tv.material3` widgets.
- Canvas 960×540 dp, with 48 dp horizontal and 27 dp vertical safe margins.
- Text in `sp`.
- No Menu-key dependency.
- Local animations are budgeted against `deadline.at` (minus clock offset), never against local constants: the ELIMINATION hold (8 s) covers the vote reveal (≤3 s) plus the role flip (≤4.5 s).

### 9.7 WebSocket client (`net/RoomSocket.kt`)
- One `OkHttpClient` with `connectTimeout(5 s)` and `readTimeout(0)`. Do not set OkHttp `pingInterval`: the heartbeat is at app level.
- `connect(code, tvToken)`:
  - Opens `client.newWebSocket(Request.Builder().url(wsUrl).build(), listener)`. `wsUrl` may be the `ws://`/`wss://` or the `http://`/`https://` form: `Request.Builder.url(String)` canonicalises ws→http. Do **not** use the `Request(url: HttpUrl, …)` constructor or `"ws://…".toHttpUrl()` (HttpUrl only accepts http/https; checked in okhttp-jvm 5.5.0 `Request.kt`).
  - `onOpen` → send `HelloTv(tvToken)` via `ProtocolJson.encoder`, then `heartbeat.start()`: every 20 s send `PING_FRAME`; if no `PONG_FRAME` within 10 s → `cancel()` and reconnect.
  - `onMessage(text)` → if `text == PONG_FRAME`, `heartbeat.onPong()`; else `decodeServer` and emit to `incoming: SharedFlow<ServerMessage>`. `ErrorMsg` is informational only.
  - `onClosing(code, reason)` → call `webSocket.close(1000, null)` and take the fatal/reconnect decision **here**. RealWebSocket fires `onClosed` only after both sides have closed, so `onClosed` may never come.
  - `onFailure` → reconnect per `ReconnectPolicy`.
- **Close-code decision** (in `onClosing`): code in `FATAL_CLOSE_CODES` → terminal, emit `ConnState.CLOSED_FATAL(code)`; code in `SLOW_RECONNECT_CLOSE_CODES` → reconnect after `max(SLOW_RECONNECT_MS, policy delay)`; otherwise → reconnect per `ReconnectPolicy`.
- **Stale callbacks.** RoomSocket keeps a reference to the current `WebSocket`. Every listener callback first checks `webSocket === current`; callbacks from an older socket are ignored (including a late 4005 sent to the socket that a heartbeat reconnect already replaced).
- `heartbeat.stop()` on close, failure and `disconnect()`.
- `ReconnectPolicy.delayMs(attempt)` = `min(10_000, 500 * 2^attempt) * (0.8 + 0.4 * random)`. The attempt counter resets 5 s after a successful open.
- `state: StateFlow<ConnState>` with `ConnState = CONNECTING | OPEN | RECONNECTING | CLOSED_FATAL(code)`.

### 9.8 ViewModel (`game/GameViewModel.kt`)
```kotlin
sealed interface TvUiState {
  data object CreatingRoom : TvUiState
  data class CreateFailed(val messageKey: String) : TvUiState
  data class InRoom(val code: String, val joinUrl: String, val view: TvView?, val conn: ConnState,
                    val clockOffsetMs: Long, val lastError: ErrorMsg?, val paused: Boolean) : TvUiState
  data class Fatal(val messageKey: String) : TvUiState
}
class GameViewModel(app: Application) : AndroidViewModel(app) {
  val ui: StateFlow<TvUiState>
  fun createRoom()                   // POST /api/rooms with current app language (en|fr|ar, default en) then connect
  fun send(intent: ClientIntent)     // wraps in ActionMsg(id = counter.toString()); dropped unless conn == OPEN
  fun setPaused(p: Boolean)          // local only: pauses local animations, never the game
}
```
- A `StateMsg` is applied only if `seq > lastSeq` (reset on reconnect).
- `clockOffsetMs` = the largest of the last 5 samples of `serverNow − System.currentTimeMillis()` taken at receipt.
- On `CLOSED_FATAL(4010)` while in LOBBY with no players → `createRoom()` automatically (a new QR) and toast `tv.newCode`. Other fatal codes → `Fatal`, with the `messageKey` of the last `ErrorMsg` if it matches the code (`error.roomExpired` for 4010, `error.replaced` for 4005, `error.tvAuthFailed` for 4003, `error.unsupportedVersion` for 4002, `error.roomNotFound` for 4004), and a "New room" button.
- `tvToken` lives in memory only. If the process dies, the room is lost and a new one is created.

### 9.9 QR (`ui/components/QrCode.kt`)
```kotlin
QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, 0, 0, mapOf(EncodeHintType.MARGIN to 0, EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M))
```
[VERIFY the zxing 3.5.4 signature `encode(String, BarcodeFormat, int, int, Map<EncodeHintType,?>)`].
- `content = view.joinUrl.uppercase()`. Upper case keeps the whole URL in QR alphanumeric mode (smaller version, bigger modules); the route accepts any case (§8.3), and scheme and host are case-insensitive.
- Module size: `module = floor(panelDp / (matrix.width + 8))` dp, where `panelDp` is the light panel size (DESIGN TV-02: 240 dp). Draw the dark modules on a `Canvas` over the light panel, inset by `4 * module` on each side (the 4-module quiet zone is inside the panel). A unit test asserts `module >= 6` dp for the production and LAN-dev URL shapes.

### 9.10 `docs/TV.md` (Agent C) must cover
- Prerequisites.
- `gradle wrapper`.
- `./gradlew :app:assembleDebug :app:installDebug -PserverUrl=http://<mac-ip>:8787`.
- The emulator (Google TV AVD, API 34+).
- **Both** TCL paths:
  - Android TV 13+: Developer options → Wireless debugging → Pair with code → `adb pair <ip>:<pairPort>` → `adb connect <ip>:<port>`.
  - ≤12: USB once → `adb tcpip 5555` → `adb connect <ip>:5555` (or the "Network debugging" toggle if present).
- How to find the model and OS version (Settings → System → About).
- Troubleshooting (same subnet; `adb kill-server`; firewall on port 8787).
- `./gradlew :app:testDebugUnitTest`.

---

## 10. Shared fixtures (`/shared/fixtures/*.json`, Agent A)

Fixtures are the contract tests for both TS and Kotlin.
- Files marked **V** below are written **exactly as shown** here (one-line blocks stay one line; the pretty-printed blocks keep their 2-space layout), each ending with a trailing newline. Tests compare **parsed** JSON, never bytes.
- Files marked **G** are produced by `shared/scripts/gen-fixtures.ts` with a fixed seed (`12345`), `now` starting at `1790000000000` and advanced by the script, and the test catalog `TEST_CATALOG` from `shared/src/testing/test-catalog.ts`, driven by the `Game` test driver. G files are pretty-printed with 2 spaces.
- `gen-fixtures --check` fails if any G file would change. The script never touches V files.
- `lastVote.tally[].voterIds` and `abstainIds` are in **seat order** (so the JSON is deterministic).

**Scripted scenario for G files** (player ids exactly as in §10.2; `joinedAt = 1790000000000 + i` for the i-th join):

| Seat | Name | Colour | Id |
|---|---|---|---|
| 0 | Rami | coral | `p_0a1b2c3d4e5f60718293a4b5` |
| 1 | Léa | azure | `p_1b2c3d4e5f60718293a4b5c6` |
| 2 | نور | jade | `p_2c3d4e5f60718293a4b5c6d7` |
| 3 | Sam | lemon | `p_3d4e5f60718293a4b5c6d7e8` |
| 4 (game 2 only) | Zoé | grape | `p_4e5f60718293a4b5c6d7e8f9` |

- **Game 1:** the 4 players, `roleMode:"custom"`, `undercoverCount:1`, `blankCount:0`. Scripted round-1 votes split 2–2 → TIE_BREAK → re-vote with a unique maximum → ELIMINATION, then play on to RESULTS. Writes `lobby`, `role_reveal`, `clues`, `tie_break`, `elimination`, `results` (TV) and `player.lobby_spectator`, `player.lobby`, `player.voting`, `player.results`.
- **Game 2:** PLAY_AGAIN, Zoé joins, `blankCount:1`. The script votes out the Blank, who guesses wrong. Writes `tv.mr_white_guess`, `player.role_reveal_blank` and `player.mr_white_guess_guesser`. The script finds roles by reading the engine state, never by hard-coding seats.

| File | V/G | Kotlin decodes? |
|---|---|---|
| `c2s.hello.tv.json` | V | encode-compare |
| `c2s.hello.player.json`, `c2s.hello.player.resume.json`, `c2s.join.json` | V | no |
| `c2s.ping.json` | V (content = `PING_FRAME` + `\n`) | no |
| `c2s.action.{update_settings,start,host_advance,host_override_guess,kick,play_again,back_to_lobby}.json` | V | encode-compare |
| `c2s.action.{ready,clue_done,cast_vote,submit_guess,leave}.json` | V | no |
| `s2c.welcome.json`, `s2c.error.json`, `s2c.pong.json` | V | yes (pong: decodes as `PongMsg`) |
| `s2c.state.tv.voting.json` | V | yes + deep asserts |
| `s2c.state.tv.{lobby,role_reveal,clues,tie_break,elimination,mr_white_guess,results}.json` | G | yes |
| `s2c.state.player.clues.json` | V | no |
| `s2c.state.player.{lobby_spectator,lobby,role_reveal_blank,voting,mr_white_guess_guesser,results}.json` | G | no |
| `http.create_room.request.json`, `http.create_room.response.json`, `http.error.json`, `http.healthz.json` | V | create_room.response: yes |


### 10.1 Verbatim C2S
```jsonc
// c2s.hello.tv.json
{ "v": 1, "t": "hello", "role": "tv", "tvToken": "0123456789abcdef0123456789abcdef" }
// c2s.hello.player.json
{ "v": 1, "t": "hello", "role": "player" }
// c2s.hello.player.resume.json
{ "v": 1, "t": "hello", "role": "player", "resumeToken": "fedcba9876543210fedcba9876543210" }
// c2s.join.json
{ "v": 1, "t": "join", "name": "Léa", "color": "azure", "locale": "fr" }
// c2s.action.update_settings.json
{ "v": 1, "t": "action", "id": "1", "a": { "type": "UPDATE_SETTINGS", "patch": { "winRule": "parity", "clueSeconds": 30 } } }
// c2s.action.start.json
{ "v": 1, "t": "action", "id": "2", "a": { "type": "START" } }
// c2s.action.ready.json
{ "v": 1, "t": "action", "id": "3", "a": { "type": "READY" } }
// c2s.action.clue_done.json
{ "v": 1, "t": "action", "id": "4", "a": { "type": "CLUE_DONE" } }
// c2s.action.cast_vote.json
{ "v": 1, "t": "action", "id": "5", "a": { "type": "CAST_VOTE", "targetId": "p_3d4e5f60718293a4b5c6d7e8" } }
// c2s.action.submit_guess.json
{ "v": 1, "t": "action", "id": "6", "a": { "type": "SUBMIT_GUESS", "text": "chat" } }
// c2s.action.host_override_guess.json
{ "v": 1, "t": "action", "id": "7", "a": { "type": "HOST_OVERRIDE_GUESS", "accept": true } }
// c2s.action.host_advance.json
{ "v": 1, "t": "action", "id": "8", "a": { "type": "HOST_ADVANCE" } }
// c2s.action.kick.json
{ "v": 1, "t": "action", "id": "9", "a": { "type": "KICK", "playerId": "p_2c3d4e5f60718293a4b5c6d7" } }
// c2s.action.play_again.json
{ "v": 1, "t": "action", "id": "10", "a": { "type": "PLAY_AGAIN" } }
// c2s.action.back_to_lobby.json
{ "v": 1, "t": "action", "id": "11", "a": { "type": "BACK_TO_LOBBY" } }
// c2s.action.leave.json
{ "v": 1, "t": "action", "id": "12", "a": { "type": "LEAVE" } }
```
Kotlin encode-compare means that `ProtocolJson.encoder.encodeToJsonElement(ClientMessage.serializer(), msg)` equals `Json.parseToJsonElement(fixture)`. This is structural equality, so key order is irrelevant.

### 10.2 Verbatim S2C and HTTP
```jsonc
// s2c.welcome.json
{ "v": 1, "t": "welcome", "playerId": "p_1b2c3d4e5f60718293a4b5c6", "resumeToken": "fedcba9876543210fedcba9876543210", "roomCode": "KXRT" }
// s2c.error.json
{ "v": 1, "t": "error", "code": "NOT_YOUR_TURN", "messageKey": "error.notYourTurn", "ref": "4" }
// s2c.pong.json
{ "v": 1, "t": "pong" }
// http.create_room.request.json
{ "locale": "fr" }
// http.create_room.response.json
{ "code": "KXRT", "tvToken": "0123456789abcdef0123456789abcdef", "joinUrl": "https://mish-ana.example.workers.dev/KXRT", "wsPath": "/parties/room/KXRT" }
// http.error.json
{ "error": "RATE_LIMITED" }
// http.healthz.json
{ "ok": true, "app": "mish-ana", "protocol": 1 }
```

`s2c.state.tv.voting.json` (V). This is a 4-player game: Léa started, everyone has spoken, نور is disconnected, and Rami and Sam have voted. Voting began at `1790000030000`.
```json
{
  "v": 1,
  "t": "state",
  "seq": 42,
  "serverNow": 1790000040000,
  "view": {
    "kind": "tv",
    "roomCode": "KXRT",
    "joinUrl": "https://mish-ana.example.workers.dev/KXRT",
    "phase": "VOTING",
    "gameNumber": 1,
    "round": 1,
    "settings": {
      "winRule": "official",
      "revealRoles": false,
      "roleMode": "auto",
      "undercoverCount": 1,
      "blankCount": 1,
      "clueSeconds": 45,
      "voteSeconds": 90,
      "revealSeconds": 30,
      "guessSeconds": 45,
      "tieBreak": "random",
      "blankGuess": true,
      "wordLocale": "en",
      "packIds": [],
      "difficulties": [1, 2, 3],
      "familyFilter": true,
      "swapSides": true,
      "points": { "civilian": 2, "undercover": 10, "blank": 6 }
    },
    "players": [
      { "id": "p_0a1b2c3d4e5f60718293a4b5", "name": "Rami", "color": "coral", "seat": 0, "connected": true, "alive": true, "left": false, "isHost": true, "ready": true, "spoke": true, "hasVoted": true, "revealedRole": null, "score": 0 },
      { "id": "p_1b2c3d4e5f60718293a4b5c6", "name": "Léa", "color": "azure", "seat": 1, "connected": true, "alive": true, "left": false, "isHost": false, "ready": true, "spoke": true, "hasVoted": false, "revealedRole": null, "score": 0 },
      { "id": "p_2c3d4e5f60718293a4b5c6d7", "name": "نور", "color": "jade", "seat": 2, "connected": false, "alive": true, "left": false, "isHost": false, "ready": true, "spoke": true, "hasVoted": false, "revealedRole": null, "score": 0 },
      { "id": "p_3d4e5f60718293a4b5c6d7e8", "name": "Sam", "color": "lemon", "seat": 3, "connected": true, "alive": true, "left": false, "isHost": false, "ready": true, "spoke": true, "hasVoted": true, "revealedRole": null, "score": 0 }
    ],
    "hostPlayerId": "p_0a1b2c3d4e5f60718293a4b5",
    "roleCounts": { "civilian": 3, "undercover": 1, "blank": 0 },
    "canStart": false,
    "startBlocker": null,
    "speakingOrder": [],
    "currentSpeakerId": null,
    "revote": false,
    "tieCandidates": [],
    "deadline": { "kind": "VOTE", "at": 1790000120000, "durationMs": 90000 },
    "votesCast": 2,
    "votesExpected": 3,
    "lastVote": null,
    "eliminated": null,
    "guess": null,
    "result": null,
    "history": [],
    "availablePacks": []
  }
}
```
Kotlin deep asserts:
- `phase==VOTING`, `players.size==4`.
- `players[2].connected==false`, `players[2].name=="نور"`.
- `deadline.kind==VOTE`, `deadline.at==1790000120000L`.
- `players[0].color=="coral"`, `players[0].left==false`.
- `votesCast==2`, `votesExpected==3`.
- `settings.winRule==OFFICIAL`, `settings.points.undercover==10`.

`s2c.state.player.clues.json` (V) is the same room in CLUES, seen by Léa, who is the current speaker:
- `seq` 30, `serverNow` 1790000010000 (CLUES began then).
- `phase` `"CLUES"`.
- All `hasVoted` false. All `spoke` false: نور, who is disconnected, is skipped only when the turn reaches them (§4.7 `beginTurn`).
- `speakingOrder` `["p_1b2c3d4e5f60718293a4b5c6","p_2c3d4e5f60718293a4b5c6d7","p_3d4e5f60718293a4b5c6d7e8","p_0a1b2c3d4e5f60718293a4b5"]`. `currentSpeakerId` is Léa's id.
- `deadline` `{ "kind": "CLUE", "at": 1790000055000, "durationMs": 45000 }`.
- `votesCast` 0, `votesExpected` 0.
- `kind` `"player"`, plus a final key:
  ```json
  "me": { "id": "p_1b2c3d4e5f60718293a4b5c6", "word": { "text": "Cat", "translit": null }, "isBlank": false, "role": null, "myVote": null }
  ```
- Every other key and value is as in the TV voting fixture.

Agent A writes this file out in full, in the §5.1 key order.

---

## 11. i18n (`/shared/i18n/*.json`, Agent D; consumed by B, C, and the generator)

### 11.1 Format
- Each file is one flat JSON object: `{ "<key>": "<string>" | { "<pluralCategory>": "<string>", … } }`.
- Key regex: `^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$`. Keys are dot-separated, lowerCamel segments, with no `_` or `-`.
- Placeholders are `{name}` with `name` matching `[a-z][a-zA-Z0-9]*`. `{count}` is reserved for plural selection and numbers.
- Plural objects need `other`. EN uses `one` and `other`. FR uses `one` and `other` (`many` optional). AR uses `zero`, `one`, `two`, `few`, `many` and `other`.
- A literal `%` is forbidden (pack-lint and gen fail). Use the words "percent" or "٪" instead.
- `fr.json` and `ar.json` must have **exactly** the key set of `en.json`, with the same placeholder names per key. The `@mishana/shared` i18n test and `gen-android-strings --check` both enforce this.
- **Placeholder rule for plurals.** Compare the **union** of placeholder names across all plural categories of a key with the EN union. `{count}` may be absent from individual categories (natural AR `one`/`two` forms such as "ثانية وحدة", or "ثانيتين"). Non-plural values must have exactly the EN placeholder set.
- Strings are seeded from DESIGN.md §12 (FR and AR drafts per key below); D may polish wording but never keys or placeholders.
- AR drafts are allowed. The user reviews them.

`shared/src/i18n/index.ts` (A writes; it only imports the JSON):
- `export type MessageKey = keyof typeof en`
- `export const MESSAGES = { en, fr, ar }`
- `export function errorKey(code: ErrorCode): MessageKey`

### 11.2 Key list (EN text is authoritative; placeholders in braces; "P" = plural object, EN categories shown)

FR and AR drafts for every key are in DESIGN.md §12. FR uses U+202F before `! ? : ;` and *tu* on phone-only keys, *vous* on TV-only keys.

| Key | EN |
|---|---|
| **Brand, common, language** | |
| `brand.appName` | Mish Ana! *(Also generates `app_name` (§11.3 rule 6))* |
| `brand.tagline` | The secret-word party game |
| `brand.slogan` | Everyone's innocent. Someone's lying. *(TV splash)* |
| `common.ok` | OK |
| `common.cancel` | Cancel |
| `common.back` | Back |
| `common.close` | Close |
| `common.continue` | Continue |
| `common.done` | Done |
| `common.retry` | Try again |
| `common.on` | On |
| `common.off` | Off |
| `common.loading` | Loading… |
| `common.you` | You |
| `common.host` | Host |
| `common.away` | Away |
| `common.timerOff` | No timer |
| `common.seconds` | P one: `{count} second` · other: `{count} seconds` |
| `common.points` | P one: `{count} point` · other: `{count} points` |
| `common.aliveCount` | P one: `{count} alive` · other: `{count} alive` |
| `common.language` | Language |
| `lang.en` | English *(Same in all files)* |
| `lang.fr` | Français *(Same in all files)* |
| `lang.ar` | العربية *(Same in all files)* |
| `round.label` | Round {count} |
| `game.label` | Game {count} |
| **Roles, teams, winners, colours, phases** | |
| `role.civilian` | Civilian |
| `role.undercover` | Mole *(EN avoids the trademarked "Undercover" (RESEARCH §6))* |
| `role.blank` | Blank |
| `roleDesc.civilian` | You have the majority word. Find the infiltrators. |
| `roleDesc.undercover` | Your word is slightly different. Blend in. |
| `roleDesc.blank` | You have no word. Listen, bluff, and guess the word if you're caught. |
| `team.civilians` | Civilians |
| `team.infiltrators` | Infiltrators |
| `winner.civilians` | Civilians win! |
| `winner.infiltrators` | The infiltrators win! |
| `winner.blank` | The Blank wins: {name}! |
| `color.coral` | Coral |
| `color.azure` | Azure |
| `color.lemon` | Lemon |
| `color.jade` | Jade |
| `color.grape` | Grape |
| `color.tangerine` | Tangerine |
| `color.aqua` | Aqua |
| `color.rose` | Rose |
| `color.mint` | Mint |
| `color.plum` | Plum |
| `color.sand` | Sand |
| `color.lilac` | Lilac |
| `phase.lobby` | Lobby |
| `phase.roleReveal` | Secret words |
| `phase.clues` | Clues |
| `phase.voting` | Vote |
| `phase.tieBreak` | Tie-break |
| `phase.elimination` | Elimination |
| `phase.mrWhiteGuess` | Last chance |
| `phase.results` | Results |
| **Lobby** | |
| `lobby.scanToJoin` | Scan to join |
| `lobby.orVisit` | or open {url} and enter the code |
| `lobby.roomCode` | Room code |
| `lobby.playerCount` | Players {count}/{max} |
| `lobby.needPlayers` | P one: `Need {count} more player` · other: `Need {count} more players` |
| `lobby.blockerRoles` | Roles don't fit this many players |
| `lobby.blockerWords` | No words match these settings |
| `lobby.startGame` | Start *(TV Start button)* |
| `lobby.startAll` | Everybody's in, start! *(Phone VIP Start button)* |
| `lobby.waitingPlayers` | Waiting for players… |
| `lobby.waitingHost` | Waiting for the host to start… |
| `lobby.hostIs` | {name} is the host |
| `lobby.roleSummary` | Civilians {civilian} · Moles {undercover} · Blank {blank} |
| `lobby.kick` | Remove |
| `lobby.kickConfirm` | Remove {name}? |
| `lobby.kickBody` | They can rejoin with the code in the lobby. |
| `lobby.settings` | Settings |
| `lobby.joined` | {name} is with us! |
| `lobby.left` | {name} left |
| `lobby.full` | Room full |
| `lobby.youreIn` | You're in! |
| `lobby.lookTv` | Look at the TV: your tile is up. |
| `lobby.youHostSub` | Start when everybody's in. |
| **Settings** | |
| `settings.title` | Game settings |
| `settings.catGame` | Game |
| `settings.catRoles` | Roles |
| `settings.catTimers` | Timers |
| `settings.catWords` | Words |
| `settings.winRule` | Win rule |
| `settings.winRuleOfficial` | Official (1 Civilian left) |
| `settings.winRuleParity` | Parity (as many as the Civilians) |
| `settings.winRuleOfficialHelp` | The infiltrators win when only one Civilian is left alive. |
| `settings.winRuleParityHelp` | The infiltrators win as soon as they are as many as the Civilians. |
| `settings.revealRoles` | Beginner mode (show roles) |
| `settings.roleMode` | Roles |
| `settings.roleModeAuto` | Automatic |
| `settings.roleModeCustom` | Custom |
| `settings.undercoverCount` | Moles |
| `settings.blankCount` | Blanks |
| `settings.rolePreview` | With {count} players: {civilian} Civilians · {undercover} Moles · {blank} Blank |
| `settings.clueSeconds` | Clue turn |
| `settings.voteSeconds` | Vote |
| `settings.revealSeconds` | Reading the word |
| `settings.guessSeconds` | Blank's guess |
| `settings.timerOffHelp` | Off = the host decides when to move on. |
| `settings.tieBreak` | If the re-vote ties again |
| `settings.tieBreakRandom` | Random pick |
| `settings.tieBreakNone` | Nobody is out |
| `settings.blankGuess` | Eliminated Blank may guess the word |
| `settings.wordLocale` | Word language |
| `settings.packs` | Word packs |
| `settings.allPacks` | All packs |
| `settings.packTeen` | Teen |
| `settings.difficulty` | Difficulty |
| `settings.difficulty1` | Easy |
| `settings.difficulty2` | Medium |
| `settings.difficulty3` | Subtle |
| `settings.familyFilter` | Family friendly |
| `settings.swapSides` | Shuffle word sides |
| `settings.points` | Points for winners |
| `settings.applies` | Changes apply to this game. |
| `settings.changedBy` | {name} changed {setting} → {value} |
| **Join (phone)** | |
| `join.title` | Join a party |
| `join.enterCode` | Enter the code on the TV |
| `join.codeLabel` | Room code |
| `join.codeInvalid` | Codes use letters only, never I, L or O. |
| `join.next` | Next |
| `join.joiningCode` | You're joining {code} |
| `join.nameLabel` | Your name |
| `join.namePlaceholder` | Nickname |
| `join.colorLabel` | Your colour |
| `join.colorTaken` | That colour was just taken. Pick another. |
| `join.submit` | Let me in! |
| `join.joining` | Joining… |
| `join.resuming` | Rejoining your seat… |
| `join.locked` | A game is in progress. You'll be able to join when it ends. |
| `join.unlocked` | You can join now! |
| **Role reveal** | |
| `reveal.yourWord` | Your secret word |
| `reveal.holdToSee` | Press and hold to see your word |
| `reveal.release` | Release to hide |
| `reveal.privacy` | Make sure nobody's looking. |
| `reveal.firstTime` | That's your word. Don't show anyone. |
| `reveal.noWord` | No word for you. |
| `reveal.youAreBlank` | You're the Blank |
| `reveal.blankBody` | Listen. Blend in. Bluff. |
| `reveal.yourRole` | Your role: {role} |
| `reveal.ready` | Got it |
| `reveal.tapAlt` | Tap to show for 5 s instead |
| `reveal.showFor5` | Show my word for 5 seconds *(Screen-reader label)* |
| `reveal.waitingOthers` | Ready! Waiting for the others… |
| `reveal.readyCount` | {ready}/{total} ready |
| `reveal.checkPhones` | Check your phones! |
| `reveal.checkBody` | Hold the card to see your secret word. Don't show anyone! |
| `reveal.blankHint` | The Blank has no word… and has to bluff. |
| **Clues** | |
| `clues.rule` | One word or short phrase. Don't say the word! |
| `clues.firstHint` | Listen carefully. Someone has a different word… or none at all. |
| `clues.speaking` | {name}'s clue |
| `clues.speakerSub` | Say it out loud, then tap Done |
| `clues.noTimer` | No timer, tap Done when finished |
| `clues.nowSpeaking` | Now speaking |
| `clues.upNext` | Up next: {name} |
| `clues.youreNext` | You're next. Get your clue ready. |
| `clues.listen` | Listen closely. Who sounds off? |
| `clues.yourTurn` | Your turn! |
| `clues.yourTurnBody` | Say one word or a short phrase about your word. |
| `clues.blankBody` | Bluff! Lean on the others' clues. |
| `clues.done` | Done |
| `clues.peek` | Hold to peek my word |
| `clues.skipTurn` | Skip turn |
| `clues.skipped` | {name} isn't here, skipping |
| **Vote and tie** | |
| `vote.title` | Who's not one of us? *(TV)* |
| `vote.sub` | Vote on your phone *(TV)* |
| `vote.pick` | Who's lying? *(Phone)* |
| `vote.pickSub` | Tap a player, then lock it in. |
| `vote.confirm` | Lock my vote: {name} |
| `vote.locked` | Vote locked. |
| `vote.actNatural` | Act natural. |
| `vote.youVoted` | You voted for {name} |
| `vote.progress` | {cast}/{expected} voted |
| `vote.tenLeft` | 10 seconds left! |
| `vote.timeUp` | Time's up, no vote counted. |
| `vote.lookTv` | Look at the TV! |
| `vote.dead` | You're out. Watch and enjoy! |
| `vote.revoteAmong` | Re-vote between the tied players |
| `vote.close` | Close vote |
| `vote.votesIn` | The votes are in… |
| `vote.noVote` | No vote |
| `vote.nobodyVoted` | Nobody voted |
| `stamp.out` | OUT |
| `stamp.tie` | TIE! |
| `tie.title` | It's a tie! |
| `tie.explain` | One more clue each, then everyone votes again, between them only. |
| `tie.inTie` | You're in the tie: get your best clue ready! |
| **Elimination and history** | |
| `elim.eliminated` | {name} is out! |
| `elim.wasCivilian` | {name} was a Civilian |
| `elim.wasUndercover` | {name} was the Mole |
| `elim.wasBlank` | {name} was the Blank |
| `elim.reactionCivilian` | …a Civilian. Oops. |
| `elim.reactionUndercover` | …the Mole! Nice catch. |
| `elim.reactionBlank` | …the Blank! But wait, one last chance… *(Only when `settings.blankGuess`)* |
| `elim.reactionBlankNoGuess` | …the Blank! *(When `!settings.blankGuess`)* |
| `elim.noElimination` | Nobody's out this round |
| `elim.randomPick` | Still tied, let fate decide! |
| `elim.abstained` | P one: `{count} didn't vote` · other: `{count} didn't vote` |
| `elim.nextRound` | Next round in {count}… |
| `elim.you` | You're out of the game |
| `elim.youWere` | You were: {role} |
| `elim.stay` | Stick around for the reveal. No hints, OK? |
| `elim.forfeit` | {name} left the game ({role}) |
| `history.title` | How it went |
| `history.left` | {name} left |
| `history.kicked` | {name} was removed |
| **Blank guess** | |
| `guess.title` | The Blank gets one guess |
| `guess.guessing` | {name} is guessing the Civilians' word… |
| `guess.silence` | Silence, please! |
| `guess.waiting` | {name} is the Blank and gets one guess. Shh… |
| `guess.prompt` | What's the Civilians' word? |
| `guess.placeholder` | Your guess |
| `guess.spelling` | Spelling doesn't need to be perfect. |
| `guess.submit` | That's my answer |
| `guess.sent` | Sent! Say your answer out loud for everyone. |
| `guess.correct` | The Blank nailed it! |
| `guess.correctYou` | You got it! You win! |
| `guess.wrong` | Wrong! The game goes on. |
| `guess.wrongYou` | Not quite. The game goes on. |
| `guess.timeout` | Time's up! No guess. |
| `guess.accept` | It counts! |
| `guess.acceptConfirm` | Accept {name}'s guess? The Blank wins. |
| `guess.reject` | Doesn't count *(TV only)* |
| `guess.rejectConfirm` | Reject the guess? The game goes on. |
| `guess.overridden` | Host's decision |
| `guess.skip` | Skip |
| `guess.guessed` | {name} guessed: {text} *(RESULTS only)* |
| **Results** | |
| `results.title` | Game over |
| `results.civilianWord` | Civilian word |
| `results.undercoverWord` | Mole word |
| `results.scoreboard` | Scoreboard |
| `results.colRank` | # |
| `results.colPlayer` | Player |
| `results.colRole` | Role |
| `results.colGame` | This game |
| `results.colTotal` | Total |
| `results.pointsEarned` | +{count} |
| `results.youWon` | You won! +{count} |
| `results.youLost` | You lost this one |
| `results.playAgain` | Play again |
| `results.changeSettings` | Change settings |
| `results.newRoom` | New room |
| `results.newRoomConfirm` | Start a new room? Players will need the new code. |
| `results.waitingHost` | Waiting for the host to start the next game… |
| `results.pack` | Pack: {title} |
| **Connection** | |
| `conn.connecting` | Connecting… |
| `conn.reconnecting` | Reconnecting… |
| `conn.lost` | Connection lost |
| `conn.tvReconnecting` | Reconnecting to the server… |
| `conn.tvLostBody` | Check the TV's internet. The room is kept for a while: your players stay in it. |
| `conn.cantReach` | Can't reach the server. |
| `conn.playerAway` | Lost connection with {name}. Their seat is saved. |
| `conn.phonesAsleep` | Everyone's phone is asleep? Wake them up, the game is waiting. |
| `conn.seatSaved` | Your seat is saved. |
| `conn.stillTrying` | Still trying… Check your Wi-Fi or mobile data. |
| `conn.back` | Back in! |
| `conn.reload` | Reload |
| **TV only** | |
| `tv.creatingRoom` | Opening the room… |
| `tv.createFailed` | Couldn't create a room. Check the connection. |
| `tv.newRoom` | New room |
| `tv.newCode` | New code: {code} |
| `tv.startNow` | Start now |
| `tv.pressAgain` | Press OK again to confirm |
| `tv.skipHint` | Press OK to skip |
| `tv.cluesSub` | Say it out loud, then end the turn on your phone |
| `tv.cluesNoTimer` | No timer: end the turn on your phone when you're done |
| `tv.pauseTitle` | Game menu |
| `tv.pauseNote` | The game keeps running |
| `tv.resume` | Resume |
| `tv.skip` | Skip turn / timer |
| `tv.players` | Players… |
| `tv.endGame` | End game |
| `tv.endGameConfirm` | End this game? |
| `tv.endGameBody` | Nobody scores. You'll go back to the lobby. |
| `tv.keepPlaying` | Keep playing |
| `tv.exitApp` | Exit |
| `tv.roomClosed` | This room has closed |
| `tv.debugTitle` | Debug settings |
| `tv.serverUrl` | Server URL |
| **Phone only** | |
| `phone.menu` | Menu |
| `phone.leave` | Leave the game |
| `phone.leaveConfirm` | Leave? Your seat will be freed. |
| `phone.youAreHost` | You're the host |
| `phone.keepScreenOn` | Keep your screen on during the game |
| `phone.vibration` | Vibration |
| `phone.kicked` | You were removed from the room |
| `phone.kickedBody` | Ask the host if that was a mistake. |
| `phone.roomGone` | This room has closed |
| `phone.roomGoneBody` | Thanks for playing! |
| `phone.noRoom` | No room called {code} |
| `phone.goHome` | Join another game |
| `phone.differentCode` | Enter a different code |
| `phone.replaced` | This game is open in another tab or phone. |
| `phone.useHere` | Use it here |
| **Errors (one per §6.4 code, in table order)** | |
| `error.badMessage` | Something went wrong with that message. |
| `error.unsupportedVersion` | Update needed. Reload to get the latest version. |
| `error.notAuthenticated` | Join the room first. |
| `error.tvAuthFailed` | This TV is no longer connected to the room. |
| `error.roomNotFound` | Room not found. Check the code on the TV. |
| `error.roomExpired` | This room has closed. Thanks for playing! |
| `error.roomFull` | This room is full (12 players max). |
| `error.roomLocked` | A game is in progress. You can join the next one. |
| `error.alreadyJoined` | You've already joined. |
| `error.nameInvalid` | Pick a name (1–16 characters). |
| `error.nameTaken` | Someone already has that name. Add an initial? |
| `error.colorTaken` | That colour was just taken. Pick another. |
| `error.resumeInvalid` | Your seat expired. Join again. |
| `error.kicked` | You were removed from the room. |
| `error.replaced` | This game is open in another tab or phone. |
| `error.notHost` | Only the host can do that. |
| `error.wrongPhase` | You can't do that right now. |
| `error.notYourTurn` | It's not your turn. |
| `error.notAlive` | You're out of this game. |
| `error.invalidTarget` | You can't pick that player. |
| `error.invalidSettings` | Those settings don't work. |
| `error.notEnoughPlayers` | At least 3 players need to be connected. |
| `error.invalidRoleConfig` | Those role numbers don't work for this many players. |
| `error.noWordsAvailable` | No words match these settings. |
| `error.guessInvalid` | Type a guess (1–40 characters). |
| `error.rateLimited` | Easy there! Try again in a moment. |
| `error.internal` | Something went wrong. Try again. |


B and C may use only keys from this table. A missing key → `SPEC-GAP` comment plus the closest existing key. D may add keys only under the prefix `extra.` (unused by B and C), for example `extra.storeHook` for the store listing.

### 11.3 Generator `tools/gen-android-strings` (Agent D)
Invocation: `pnpm gen:strings` (writes) or `pnpm gen:strings --check` (exits 1 if the output would differ).

Inputs are `shared/i18n/{en,fr,ar}.json`. Outputs (UTF-8, with the `<!-- GENERATED by tools/gen-android-strings. Do not edit. -->` header):

| Locale | Output |
|---|---|
| en | `tv-app/app/src/main/res/values/strings_generated.xml` |
| fr | `tv-app/app/src/main/res/values-fr/strings_generated.xml` |
| ar | `tv-app/app/src/main/res/values-ar/strings_generated.xml` |

Rules:
1. **Resource name.** Split the key on `.`, convert each segment from camelCase to snake_case (insert `_` before each uppercase letter, then lowercase), and join the segments with `__`.
   - Example: `phase.mrWhiteGuess` → `phase__mr_white_guess`; `settings.difficulty1` → `settings__difficulty1`.
   - The generator fails on any collision.
2. **Placeholders → positional args.** For each key, the argument order is the order of first appearance in the **EN** string. For plurals, use the EN `other` form; categories that omit a placeholder (§11.1) keep the same numbering for the ones they use.
   - `{count}` → `%N$d`; every other placeholder → `%N$s`.
   - FR and AR use the same N for the same name.
3. **Plurals.** An object value becomes `<plurals name="…">` with one `<item quantity="zero|one|two|few|many|other">` per category present.
4. **Escaping.**
   - XML-escape `&`, `<`, `>`.
   - Android-escape `'` → `\'`, `"` → `\"`, and `\` → `\\`.
   - A newline becomes `\n`.
   - A leading `@` or `?` gets a backslash prefix.
5. **Also emit** `tv-app/app/src/main/java/app/mishana/tv/i18n/I18nKeys.kt`:
   ```kotlin
   package app.mishana.tv.i18n
   import app.mishana.tv.R
   object I18nKeys {
     val strings: Map<String, Int> = mapOf("error.badMessage" to R.string.error__bad_message, /* every non-plural key */)
     val plurals: Map<String, Int> = mapOf(/* every plural key */)
   }
   ```
   C resolves a server `messageKey` with `I18nKeys.strings[key]`, falling back to `R.string.error__internal`.
6. `brand.appName` also generates `app_name`. C's manifest uses `@string/app_name`, and C must **not** define `app_name` elsewhere.

### 11.4 Kotlin usage
- Compose code uses `stringResource(R.string.lobby__start_game)` and `pluralStringResource(R.plurals.common__seconds, n, n)`.
- Args are passed in the generator order. C may read that order from §11.2: placeholders appear left to right in the EN text.

---

## 12. Word packs (`/word-packs`, Agent D; schema code in `shared/src/packs/schema.ts`, Agent A)

### 12.1 Schema (zod, `WordPackSchema`; extends RESEARCH 03 §3.3)
```ts
WordSideSchema = z.strictObject({ text: z.string().min(1).max(40), translit: z.string().min(1).max(40).nullable().optional(), alt: z.array(z.string().min(1).max(40)).max(8).optional() })
PairSchema = z.strictObject({
  id: z.string().regex(/^p\d{3,4}$/),
  civilian: WordSideSchema, undercover: WordSideSchema,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  reviewedBy: z.array(z.string()).default([]),
  notes: z.string().max(200).optional(),
})
WordPackSchema = z.strictObject({
  id: z.string().max(PACK_ID_MAX).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), // e.g. "lb-food-01"; ≤ 40 so every pack is selectable (SETTINGS_BOUNDS.packIds)
  version: z.number().int().min(1),
  locale: z.enum(["en", "fr", "ar", "ar-LB"]),
  script: z.enum(["Latn", "Arab"]),
  title: z.strictObject({ en: z.string().min(1), fr: z.string().min(1), ar: z.string().min(1) }),
  tags: z.array(z.string()).default([]),
  ageRating: z.enum(["all", "teen", "adult"]),
  license: z.string().min(1),                                 // "CC-BY-4.0" (original) | "MIT" (seeded)
  source: z.string().min(1),                                  // "original" | "antebrl/undercover-word-game" | …
  status: z.enum(["draft", "reviewed"]),
  pairs: z.array(PairSchema).min(10),
})
```
`buildCatalog` turns each side into a `WordSide`, with `translit ?? null` and `alt ?? []`.

### 12.2 Layout
```
word-packs/package.json        {"name":"@mishana/word-packs","version":"0.0.0","private":true,"type":"module","exports":{".":"./index.ts","./packs/*":"./packs/*"},"scripts":{"typecheck":"tsc -p ."},"devDependencies":{"@mishana/shared":"workspace:*"}}
word-packs/index.ts            import each pack JSON; export const PACKS: readonly unknown[] = [ ... ];
word-packs/packs/en/en-<theme>-NN.json
word-packs/packs/fr/fr-<theme>-NN.json
word-packs/packs/ar/ar-<theme>-NN.json   and   ar/lb-<theme>-NN.json (locale "ar-LB")
word-packs/test/packs.test.ts  (validates with WordPackSchema + lint rules)
```
The file name equals `<id>.json`.

**M1 minimum** (so the server and sim work): at least one pack per language with at least 20 pairs. M4 targets: EN ≥150, FR ≥150, AR ≥100 including Lebanese ≥40.

EN/FR seed packs drawn from `antebrl/undercover-word-game` use `license:"MIT"` and `source:"antebrl/undercover-word-game"`, contain no brand names, and are credited in `THIRD_PARTY.md`.

### 12.3 Catalog (`engine/catalog.ts`)
```ts
interface CatalogPair { key: string; packId: string; packVersion: number; pairId: string; difficulty: 1|2|3; civilian: WordSide; undercover: WordSide }
interface CatalogPack { id: string; version: number; locale: string; language: Locale; title: {en:string;fr:string;ar:string}; ageRating: "all"|"teen"|"adult"; pairs: CatalogPair[] }
interface Catalog { packs: CatalogPack[] }          // language = locale.split("-")[0]
type WordPackLike = z.infer<typeof WordPackSchema>  // re-declared structurally in engine (no zod import)
```

### 12.4 Pair selection (`pickPair(catalog, settings, usedPairKeys, rng)`)
1. Eligible packs:
   - `pack.language === settings.wordLocale`;
   - `ageRating === "all"`, or (`!familyFilter` and `ageRating === "teen"`);
   - `settings.packIds.length === 0 || packIds.includes(pack.id)`.
2. Candidates = their pairs with `difficulties.includes(pair.difficulty)`, ordered by pack id, then pair id.
3. Remove keys in `usedPairKeys`. If none remain, but some were filtered only by `usedPairKeys`, remove those keys from `usedPairKeys` (a reset for this filter) and retry once.
4. None at all → `NO_WORDS_AVAILABLE`.
5. Pick `candidates[rng.int(candidates.length)]`.

No pair repeats within one room session until the filtered pool is exhausted.

### 12.5 Pack lint (`tools/pack-lint`, Agent D; `pnpm lint:packs`)
Errors (exit 1):
- schema failure;
- duplicate pack id;
- duplicate pair id within a pack;
- `civilian.text` and `undercover.text` normalising to the same string (`normalizeGuess`);
- the same unordered pair (normalised) twice across all packs of a language;
- any word containing `%`.

Warnings: M4 count targets not met; `status:"draft"`; `reviewedBy` with fewer than 2 entries.

---

## 13. Tools

### 13.1 `tools/sim` (A) — `pnpm sim [--players 3..12|N] [--games N=200] [--seed N=1] [--win-rule official|parity] [--tie-break random|none] [--ws http://host:8787] [--verbose]`

`@mishana/sim` depends on `@mishana/shared` and `@mishana/word-packs` (`workspace:*`), plus `ws`. **Engine mode uses the real `PACKS` catalog** (built with `buildCatalog` after `WordPackSchema.parse`); the leak checker uses the synthetic token catalog of §14.1 instead.

**Engine mode (default).** For each player count, run `--games` games through `reduce` with seeded bots:
- READY always.
- CLUE_DONE (sometimes HOST_ADVANCE from the TV).
- CAST_VOTE uniformly at random over valid targets.
- SUBMIT_GUESS: correct 30% of the time; otherwise a string guaranteed not to normalise to any catalog word (`"zzwrong" + n`).
- HOST_OVERRIDE_GUESS 5% (following the §4.9 rules).
- 2% DISCONNECT/RECONNECT churn, with time advancing.
- 1% KICK (from the TV).
- After each game, PLAY_AGAIN once, then stop.
- Games that end through the stalemate rule (§4.7) count as terminated and are reported in their own column.

Run `assertInvariants` after every step.

Failure (exit 1):
- an invariant throws;
- more than 60 rounds or more than 5000 actions in one game (non-termination);
- a role-count mismatch;
- the secret-leak checker (§14.1) fails.

Print a table per n: games, average rounds, win % by side, Blank-guess wins.

**WS mode (`--ws`).** `POST /api/rooms`, open the TV and N player sockets (`ws` package, `cid` param, no Origin), and play `--games` full games via the protocol. Additionally:
- kill and resume one player socket mid-game with its `resumeToken`, and assert that the seat is restored (the same `playerId`, with `welcome`);
- assert that every state the TV receives satisfies §5.4.

This is the M1 "scripted WS client" acceptance test.

### 13.2 `tools/gen-android-strings`, `tools/pack-lint` (D)
See §11.3 and §12.5. Each has `package.json`, `src/main.ts`, `vitest.config.ts`, and `test/`. They depend on `@mishana/shared` (workspace).

---

## 14. Test plan (commands are run from the repo root unless noted)

### 14.1 shared (A) — `pnpm test` (project `shared`), `pnpm test:coverage` (engine ≥90% branches)

| Test file | Covers |
|---|---|
| `engine/rng.test.ts` | the §4.6 vectors |
| `engine/roles.test.ts` | the table for n=3..12; `validateRoleCounts` edges; custom-mode bounds |
| `engine/settings.test.ts` | defaults, every bound (accept min/max, reject min−1/max+1), the `wordLocale` reset of `packIds` |
| `engine/normalize.test.ts` | every §4.12 vector, `isGuessCorrect` with `alt`/`translit` |
| `engine/transitions.test.ts` | one test per §4.7/§4.8 transition and per §4.9 permission-matrix cell (allowed and rejected). Must include: LEAVE and KICK in-game and in RESULTS (player marked `left`, removed at `resetToLobby`, never dealt in again); host reassignment when the VIP forfeits; forfeit of an already-dead player (no second history entry); forfeit of a TIE_BREAK speaker who is also a tie candidate (§4.8 order); VIP KICK of a connected vs a disconnected target in-game; HOST_OVERRIDE_GUESS on CORRECT/WRONG/TIMEOUT by TV and VIP, and a second override refused; HOST_ADVANCE by the VIP while PENDING (guesser connected vs disconnected); START with 3 players but only 2 connected; the speaker disconnecting mid-turn (turn kept; grace deadline when the timer is off); the stalemate rule; RECONNECT/DISCONNECT for unknown ids return the same object; a disconnected player in RESULTS for more than 120 s keeps invariants and results valid |
| `engine/win.test.ts` | matrix n=3..12 × winRule × alive compositions; a Blank guess beats the civilian count; forfeits that drop below 3 alive end the game |
| `engine/starter.test.ts` | across seeded games, the round-1 starter is never BLANK, and every round and tie-break opener is a non-Blank, and later-round openers are random (not seat-rotated) |
| `engine/sanitize.test.ts` | bidi controls stripped; Zalgo (1 base + 15 marks) cut to 2 marks; 17 graphemes cut to 16; `nameKey` treats full-width and case variants as equal |
| `engine/props.test.ts` (fast-check) | random games terminate; invariants hold after every step; role counts are respected; determinism (same seed + actions → deep-equal states) |
| `engine/golden.test.ts` | seeded full games, snapshot of the final state + action log (`toMatchSnapshot`) |
| `projection/leak.test.ts` | **1,000 seeded sim games** (10 batches of 100, `timeout: 120_000`) with a synthetic catalog of unique tokens (`zzciv0001`…); bots guess correctly 30% of the time. At every step: `JSON.stringify(projectForTv)` contains no word token and no alive `revealedRole` unless RESULTS; every `projectForPlayer(X)` (including the guesser's and spectators') contains only X's own word token unless RESULTS; `guess.text` is null in every view unless RESULTS; no `votes` map or `guessLog` leaks |
| `protocol/fixtures.test.ts` | every `c2s.*` parses with `ClientMessageSchema` (ping: equals `PING_FRAME`); every `s2c.*` parses with `ServerMessageSchema`; `http.*` parse with the HTTP schemas; `check:fixtures` is clean |
| `i18n/keys.test.ts` | fr/ar key sets equal en; placeholder names equal per key (plural: union rule of §11.1); plural objects have `other`; every `ErrorCode` has `error.*`; every `color.*` matches `COLORS` |

### 14.2 server (A) — `pnpm test` (project `server`, Node environment, `RoomCore` with fakes)

| Test file | Covers |
|---|---|
| `codes.test.ts` | alphabet and length, uniformity smoke test, collision retry (`createRoom` with a fake `deps.getStub` whose `initRoom` returns EXISTS twice) |
| `tokens.test.ts` | hex lengths, `sha256hex` known vector (`sha256("abc")` = `ba7816bf…`), `timingSafeEqualHex` |
| `origin.test.ts` | no Origin, same origin, allowlist, foreign → 403 |
| `room-core.hello.test.ts` | TV auth ok/fail/replace; player resume ok/invalid/kicked; spectator state; a second hello on a non-pending socket → BAD_MESSAGE and no rebinding; lobby seat expiry → resume gives RESUME_INVALID and deletes the session → join then works |
| `room-core.join.test.ts` | join → welcome + broadcast; ALREADY_JOINED; NOT_AUTHENTICATED; **12 joins from one IP succeed**; the 31st join in a minute from one IP → RATE_LIMITED; name sanitising |
| `room-core.actions.test.ts` | error `ref` echo; KICK closes with 4006 and invalidates the token; LEAVE deletes the session; sessions pruned after `resetToLobby`; seq monotonic; each connection gets its own projection; `onClose` after KICK does not dispatch DISCONNECT |
| `room-core.concurrency.test.ts` | two hellos and a join fired concurrently (without awaiting) → every broadcast `seq` strictly increasing, no lost update |
| `room-core.ratelimit.test.ts` | bucket (5/s, burst 10), strikes → 4008, oversize (UTF-8 bytes) → BAD_MESSAGE, binary frame → BAD_MESSAGE, `v:2` → UNSUPPORTED_VERSION + 4002 (not BAD_MESSAGE), connection cap (41st socket → 4009), pending cap |
| `room-core.alarm.test.ts` | TICK on deadline; alarm = min(wake, expiry, pending deadline); a never-hello'd socket is closed 4001 by the alarm; each expiry rule → 4010 + `deleteAll`; meta missing → `deleteAll`; `initRoom` on an expired room closes old sockets 4010 and refreshes the cache |
| `room-core.hibernation.test.ts` | recreate `RoomCore` from the same fake storage mid-game → identical subsequent behaviour; recreate with an **empty connections list** → players become disconnected and the current turn rules apply (§4.8) |
| `http.test.ts` | body > 1 KB → 400; wrong content type → 400; foreign Origin → 403; 201 has `Cache-Control: no-store` |

Integration (manual or CI with network): `pnpm dev`, then `pnpm sim --ws http://127.0.0.1:8787 --players 4 --games 3`.

`pnpm --filter @mishana/server build` (dry-run bundle, then the size budget) must succeed.

### 14.3 web-client (B)
- `pnpm test` (project `web-client`, Node environment). Unit tests cover:
  - `t()`: fallback, plurals for ar/fr/en, placeholders;
  - router canonicalisation;
  - storage (try/catch, 6 h expiry);
  - `randomId`;
  - countdown math;
  - the connection handler with a fake socket: seq ordering; fatality by close code only (`FATAL_CLOSE_CODES`), slow reconnect for 4008/4009; no send while `readyState !== 1`; heartbeat stopped on close and restarted on open; pong timer.
- `pnpm --filter @mishana/web-client build && pnpm --filter @mishana/web-client size` (≤60 KB gzip).
- `pnpm e2e`: Playwright. `webServer` = `pnpm --filter @mishana/server exec wrangler dev --port 8788` after a build. One TV-mock page plus 4 player contexts play a full game. If Playwright browsers cannot be installed in the environment, the agent still writes the test and reports that it was not run.

### 14.4 tv-app (C) — on macOS: `cd tv-app && ./gradlew :app:testDebugUnitTest :app:assembleDebug`
- `ProtocolFixturesTest`:
  - decodes every `s2c.state.tv.*`, `s2c.welcome`, `s2c.error`, `s2c.pong` and `http.create_room.response` with `ProtocolJson.strict`;
  - re-encodes through the polymorphic serializer, `ProtocolJson.strict.encodeToJsonElement(ServerMessage.serializer(), decoded)` (so the `t` discriminator is kept), and compares the `JsonElement` with the original;
  - performs the §10.2 deep asserts.

  Fixtures are read from `File(System.getProperty("user.dir"), "../../shared/fixtures")`; the unit test working directory is `tv-app/app`. The environment variable `MISHANA_FIXTURES` overrides this.
- `ClientEncodingTest`: encode-compares `HelloTv` and each TV intent against the §10.1 fixtures.
- `ReconnectPolicyTest`: delays are bounded and grow, with the cap at 10 s.
- `HeartbeatTest` (`runTest` virtual time, fake send/clock): PING_FRAME every 20 s; `onTimeout` 10 s after an unanswered ping; `onPong` cancels the timeout; `stop()` stops everything.
- `RoomSocketTest` (MockWebServer, real time, short timeouts): hello is sent on open; no reconnect after close 4006; a reconnect after a normal close; a late 4005 delivered to an **old** socket after the new socket opened leaves the state OPEN.
- `QrCodeTest`: module size ≥ 6 dp at a 240 dp panel for the production URL shape (≤ 61 characters upper-cased) and the LAN-dev shape.
- `GameViewModelTest` (fake socket + Turbine): create → InRoom; the seq filter; ROOM_EXPIRED in an empty lobby → re-create.
- `CountdownTest`.

The agent cannot run Gradle here and states so in its report.

### 14.5 word-packs / i18n (D)
- `pnpm test` (projects `word-packs`, `tools/gen-android-strings`, `tools/pack-lint`):
  - every pack parses;
  - lint rules (fixtures of bad packs);
  - name mangling and collisions;
  - placeholder conversion (`{name} guessed: {text}` → `%1$s guessed: %2$s`; `{count}` → `%1$d`);
  - escaping (`'`, `"`, `@`, `&`);
  - plural emission for ar (6 categories);
  - `--check` mode.
- `pnpm lint:packs` (errors are 0).
- `pnpm gen:strings --check`.

### 14.6 Repo-wide gates (all agents' work combined)
`pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage && pnpm sim --players 3..12 --games 500 && pnpm build`

---

## 15. Definition of done per agent

| Agent | Done when |
|---|---|
| A | (Gates evaluated after D's phase 0, §0.4.) Root tooling as specified in §2. Shared engine, protocol, projection and packs schema per §3–§6 and §12.1, §12.3, §12.4. Server per §7. All V fixtures, plus G fixtures generated. §14.1 and §14.2 green. Sim engine mode passes 3..12 × 500. `docs/DEV.md` written: install, `pnpm dev`, LAN notes, deploy (`wrangler login`, `pnpm deploy`, set `JOIN_BASE_URL` if using a custom domain) |
| B | All §8 screens, the TV mock, §14.3 unit tests green, build within budget, e2e written |
| C | The Gradle project per §9 and Kotlin tests per §14.4 (written; compiled by the user on macOS). `docs/TV.md` with both adb paths |
| D | Phase 0 first (§0.4). Then `en/fr/ar.json` with the exact §11.2 key set (FR/AR seeded from DESIGN §12). Generator and lint tools plus generated Android files. Packs meeting the M1 minimum, with the M4 targets as the drafting goal. `THIRD_PARTY.md`. §14.5 green |

## 16. Open [VERIFY] items (for whoever first touches them)
1. androidx versions in §9.1 (Google Maven blocked here; taken from the developer.android.com release pages).
2. AGP 9 DSL for `compileSdk` and for applying the serialization plugin with built-in Kotlin.
3. ZXing `encode` overload with hints.
4. `@JsonClassDiscriminator` stays experimental in kotlinx-serialization 1.11.0, so keep `@OptIn`.
5. A Cloudflare rate-limit `namespace_id` must be a unique positive integer string per account. `"1001"` and `"1002"` are placeholders that work in local dev.
6. Workers static assets honouring `web-client/public/_headers` (§8.10).

---

## Appendix: Review log (2026-10-03)

All blocker and major review findings were applied, and most minors. Departures from a reviewer's suggested fix, and rejected parts:

| Finding | Decision |
|---|---|
| Per-IP **per-room** WebSocket cap (e.g. 4 sockets per IP) | **Rejected.** Every phone at a party shares the home Wi-Fi's public IP, so the cap would lock out players 5–12 (the same problem as the old join limit). Kept instead: the Worker-level `CONNECT_LIMITER` (60/min per IP), the 40-socket room cap, the 10-pending cap, and the lower message bucket. |
| Guess text: show the guess on the TV at the verdict (DESIGN finding) | **Rejected** in favour of the SPEC blocker fix: `guess.text` is null in every view until RESULTS (it is shown there via `result.guesses`). The Blank reads the guess aloud, and the host overrides from what was heard. |
| `guessSeconds` without `0` (DESIGN finding) | **Rejected.** `0` stays allowed like every other timer; with the timer off, the TV (or the VIP, when the guesser is disconnected) advances. DESIGN's help text "Off = the host decides" covers it. |
| HOST_OVERRIDE on TIMEOUT ("It counts!" after a timeout) | **Rejected.** A timeout has no text to accept. TIMEOUT shows Continue only. |
| Removal of expired seats in RESULTS | Chose option (a): nobody is removed in RESULTS; `left` players are removed at `resetToLobby`, and disconnected seats restart their 120 s lobby hold there. |
| Stalemate when nobody votes | Chose "return to LOBBY with no points after 3 consecutive no-elimination rounds" rather than a forced random elimination. |
| TV Home as root with a CLOSE_ROOM intent (DESIGN option A) | **Rejected** in favour of option B (SPEC's model): Lobby is root, Back exits, Home is a splash. No CLOSE_ROOM in v1; phones see RoomGone when the room expires. |
| Tie pacing | Added `TIE_LEAD_IN_MS` (3 s) to the first TIE_BREAK turn instead of a separate TIE deadline kind. |
| Verdict window | Raised `VERDICT_HOLD_MS` from 5 s to 8 s to match DESIGN's verdict buttons. `ELIMINATION_HOLD_MS` stays 8 s and DESIGN's animations were compressed to fit. |
| Phone colour race auto-reassignment (DESIGN §13.5 #9) | **Rejected.** JOIN fails with `COLOR_TAKEN`; the phone keeps the name and auto-selects the first free colour. |
| DESIGN §13.5 rows 1, 2, 4, 6 (voter→target map, TV host intents, `tieBreak:"wheel"`, VIP handover) | Already covered by SPEC (`lastVote.tally[].voterIds`, the TV is always host, `random`, `reassignHost`). PAUSE/RESUME (row 3), `awaySince` (row 5) and `blankTyping` (row 7) are out of v1 (§0.5). |

