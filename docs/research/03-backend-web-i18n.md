# 03 — Realtime backend, phone web client, i18n (FR/EN/AR + RTL)

Researched 2026-10-03. Legend: **[V]** verified against the cited source on that date; **[U]** unverified, estimated, or from a secondary source only.
Method note: the sandbox blocked direct fetches of fly.io, supabase.com and developers.cloudflare.com. Cloudflare and Supabase claims were checked against those vendors' **official doc sources on GitHub** (same content as the docs sites), against the npm registry, and against local measurements. Fly.io claims come from search-engine snippets of fly.io pages, so they are marked **[U]** where it matters.

---

## 1. Realtime backend

### 1.1 Options

**(a) Node + Socket.io on Fly.io (or a VPS)**
- socket.io latest is `4.8.4` [V, npm registry: https://registry.npmjs.org/socket.io/latest].
- Socket.io is **not** plain WebSocket: "a WebSocket client will not be able to successfully connect to a Socket.IO server" [V, https://socket.io/docs/v4/ — source: https://github.com/socketio/socket.io-website/blob/main/docs/categories/01-Documentation/index.md]. A Kotlin TV client would therefore need `socket.io-client-java` (2.x client ↔ 3.x/4.x server) [V, https://github.com/socketio/socket.io-client-java].
- Built-in reconnection, plus optional **Connection State Recovery** (server option `connectionStateRecovery.maxDisconnectionDuration`) that restores missed packets. The docs say recovery "will not always be successful", so the app still needs a full state resync [V, https://socket.io/docs/v4/connection-state-recovery].
- Fly regions near Lebanon: `fra` Frankfurt, `cdg` Paris, `ams` Amsterdam, `lhr` London, `arn` Stockholm. No Middle East region [U, https://fly.io/docs/reference/regions/ (search snippet)]. Fly's "region consolidation" deprecated `mad`, `otp`, `waw` and others [U, https://fly.io/blog/the-region-consolidation-project/].
- Price: shared-cpu-1x 256 MB is about **$1.94/month**. New orgs get a short trial (2 h of compute or 7 days), then pay-as-you-go. There is **no permanent free tier for new accounts**. Third-party pages still mention the legacy "3 free VMs" allowance, but treat it as gone for new orgs [U, https://fly.io/docs/about/pricing/ (search snippet); https://snapdeploy.dev/blog/leaving-flyio-after-free-tier].

**(b) Cloudflare Workers + Durable Objects via PartyServer**
- Cloudflare **acquired PartyKit on 2024-04-05** [V, https://blog.cloudflare.com/cloudflare-acquires-partykit/]. The maintained successor is the **`cloudflare/partykit` monorepo**. It ships **`partyserver`** (core library: "enhances a standard Durable Object" with rooms, lifecycle hooks and broadcasting) and **`partysocket`** (a WebSocket client with "reconnections, buffering, resilience"), plus `y-partyserver`, `partysub`, `partywhen` and `hono-party` [V, https://github.com/cloudflare/partykit].
- **Recommended packages: `partyserver@0.5.10` + `partysocket@1.3.0`** [V, npm registry]. The legacy `partykit` CLI/platform package is at `0.0.115`; npm shows it was last modified 2025-09-11 [V, https://registry.npmjs.org/partykit]. Do not start new work on it.
- PartyServer supports hibernation through `static options = { hibernate: true }`. It also exposes `onStart()` (runs after waking up), `connection.setState()` (≤2 KB per connection) and `routePartykitRequest(request, env, { locationHint })` [V, https://github.com/cloudflare/partykit/blob/main/packages/partyserver/README.md].
- **Location:** Cloudflare has a **Beirut PoP (BEY)**. Before it existed, Lebanon was served from Marseille and Paris, and the local PoP cut RTT by about 50 ms [V, https://blog.cloudflare.com/marhaba-beirut-cloudflares-121st-pop/]. So the Worker edge (TLS/WebSocket termination) can run in Beirut. **The Durable Object cannot:** the `me` (Middle East) location hint exists, but "Durable Objects currently do not spawn in this location… [they] spawn in a nearby location". By default a DO is created near the first `get()` [V, https://developers.cloudflare.com/durable-objects/reference/data-location/ — source: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/durable-objects/reference/data-location.mdx]. Which colo serves `me`-hinted DOs is not documented [U]; it is probably Europe.
- **Pricing** [V, https://developers.cloudflare.com/durable-objects/platform/pricing/ — source: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/durable-objects/durable-objects-pricing.mdx]:
  - The Workers **Free plan includes DOs (SQLite-backed only)**: 100,000 requests/day and 13,000 GB-s/day. Exceeding a limit makes those operations fail; limits reset at 00:00 UTC.
  - Paid plan: 1M requests/month + $0.15/M; 400,000 GB-s/month + $12.50/M GB-s; $5/month minimum.
  - Incoming WebSocket messages are billed at a **20:1 ratio** (100 messages = 5 requests). Outgoing messages and protocol pings are free.
  - **Hibernation:** objects that are "idle and eligible for hibernation are not billed for duration". Calling a plain `accept()` instead bills the entire time the socket is connected.
  - Worked example from the docs: 100 rooms × 50 sockets with no hibernation, 8 h/day ≈ **$142.95/mo**, nearly all of it duration. **Hibernation is mandatory for this project.**
- **Local and LAN development:** `wrangler dev` runs the real `workerd` runtime through Miniflare, Durable Objects included [V, https://developers.cloudflare.com/workers/local-development/ (search snippet)]. `wrangler dev` has an `--ip` flag ("IP address to listen on"), so `--ip 0.0.0.0` exposes it to phones and the TV on the LAN [V, https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/dev.ts]. `wrangler` latest is `4.147.0` [V, npm].

**(c) Supabase Realtime**
- Broadcast and Presence are client-to-client pub/sub [V, https://supabase.com/docs/guides/realtime/broadcast]. There is **no long-lived authoritative process**: game logic would have to run in Edge Functions (≤150 s wall-clock on the free plan, 2 s CPU per request) or in Postgres [U, https://supabase.com/docs/guides/functions/limits (search snippet)].
- Free plan: 200 concurrent connections, 100 messages/s, 256 KB broadcast payload [V, https://supabase.com/docs/guides/realtime/limits — source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/realtime/limits.mdx]. Third-party pricing summaries cite 2M messages/month and say free projects **pause after 1 week of inactivity** [U, https://supabase.com/pricing (via https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)].
- Regions: the nearest are `eu-central-1` Frankfurt and `eu-west-3` Paris. There is **no Middle East region** in Supabase's region list [V, https://github.com/supabase/supabase/blob/master/packages/shared-data/regions.ts; https://supabase.com/docs/guides/platform/regions].
- Local development: `supabase start` runs the stack locally in Docker [U, https://supabase.com/docs/guides/local-development]. The Kotlin TV client would use Supabase's Phoenix-channel protocol (supabase-kt) rather than a plain socket [U].

### 1.2 Criteria table

| Criterion | (a) Node + Socket.io / Fly | (b) Workers + DO + PartyServer | (c) Supabase Realtime |
|---|---|---|---|
| Latency from Lebanon | Single region, e.g. `fra`/`cdg`. Beirut↔Frankfurt RTT is probably around 50–80 ms [U] | WS terminates at BEY PoP [V]; DO runs at a nearby non-ME colo [V], probably Europe [U]. About the same as (a) for game logic | `eu-central-1`/`eu-west-3` [V]; about the same as (a) |
| France latency | `cdg` is excellent | DO placed near the first player (good) | `eu-west-3` is excellent |
| Hobby cost | About $2/mo per always-on VM; no free tier for new orgs [U] | **$0 on the Free plan** within 100k req/day (20:1 WS ratio) [V]; $5/mo paid minimum [V] | $0 with 200 concurrent connections; pauses when idle [V/U] |
| Reconnection | Built-in client reconnect plus state recovery (best effort) [V] | `partysocket` reconnect/buffer [V]; app-level resume token needed | Client auto-rejoin [U]; app-level resync |
| Authoritative logic | Excellent: plain Node process | **Excellent:** one DO per room is a single-threaded authority with storage and alarms | **Poor:** no persistent server; logic split across Edge Functions/DB |
| Fully local / LAN dev | Yes (`node server.ts`) | Yes (`wrangler dev --ip 0.0.0.0`, workerd) [V] | Yes, but Docker-heavy [U] |
| Dev speed | Fast; ops, scaling and redeploys are on you | Fast; zero ops; learn the DO lifecycle and hibernation rules | Fast for CRUD; awkward for game state machines |
| Kotlin Android TV client | Needs the Socket.io Java client (protocol layer) [V] | **Plain WebSocket via OkHttp** (OkHttp supports RFC 6455 WebSockets; Android 5.0+/API 21+) [V, https://github.com/square/okhttp] | supabase-kt or a hand-rolled Phoenix protocol [U] |
| Phone client size (gzip, measured) | socket.io-client 4.8.4: **13.0 KB** | partysocket 1.3.0: **4.1 KB** | n/a |

Client sizes were measured locally: esbuild 0.28.2, minified ESM bundle of a one-line import, `gzip -9` [V, measured 2026-10-03].

### 1.3 Recommendation: **(b) Cloudflare Workers + Durable Objects with `partyserver` + `partysocket`**

- **One DO per room code** is exactly the "authoritative room server" this game needs: a single-threaded state machine, timers through alarms, and SQLite storage for snapshots, with no servers to run.
- **Cost:** free for hobby scale. With hibernation enabled, idle lobbies cost nothing. A turn-based word game sends few messages, so the 20:1 WS billing ratio fits it well.
- **Lebanon:** the Beirut edge PoP terminates TLS/WS locally. Game-logic latency is roughly equivalent to the alternatives, because nobody offers ME compute here (Fly, Supabase and DOs are all Europe-nearest). For a turn-based party game, about 100 ms is a non-issue [U].
- **Android TV:** a plain WebSocket via OkHttp. The protocol is your own JSON, shared as TS types and mirrored in Kotlin.
- **LAN dev:** `wrangler dev --ip 0.0.0.0`, with the TV and phones pointed at the laptop's IP.
- **Caveats:**
  - In-memory state is lost on hibernation or eviction. Persist room state to `ctx.storage` and per-socket data via `connection.setState()`, and rehydrate in `onStart()`.
  - Do not override `webSocketMessage` and similar handlers when using PartyServer [V, PartyServer README].
  - When creating a room, create the DO from the host's request (the TV) so placement follows the host [V, DO data-location doc].

---

## 2. Phone web client

### 2.1 Framework comparison

Measured "counter button" app (state + click handler), bundled with esbuild 0.28.2 (minified, production), gzip -9 [V, measured locally 2026-10-03]:

| Stack | Version (npm, 2026-10-03) | Counter app gzip | DX notes |
|---|---|---|---|
| Preact (+ `@preact/preset-vite` 2.10.6) | `preact@11.0.0` (released 2026-09-30); 10.x line at `10.29.8` | **5.6 KB** | React-like API and hooks; `@preact/signals` 2.11.3; the React ecosystem works via compat |
| Svelte 5 (+ `@sveltejs/vite-plugin-svelte` 7.3.1) | `svelte@5.57.1` | 16.7 KB* | Runes (`$state`); compiler-driven; very concise; smaller ecosystem |
| React | `react@19.3.0` + `react-dom@19.3.0` | 69.1 KB | Largest ecosystem and hiring pool; heaviest runtime |

Versions are from the npm registry (e.g. https://registry.npmjs.org/preact). Vite latest is `8.3.2` [V, npm].

\*The Svelte figure is esbuild's output (no Svelte-specific optimizer); Vite/Rollup may tree-shake more [U].

**Recommendation: Vite + Preact (pin `preact@^10.29` initially).**
- It has the smallest runtime by far, which matters on mid-range Android phones and patchy Lebanese mobile data.
- The team can reuse React knowledge and TS types.
- `@preact/signals` suits the server-pushed state model.
- Pinning 10.x is cautious: Preact 11.0.0 shipped only 3 days ago [V, npm `time` field], so evaluate it after the ecosystem catches up [U]. Upgrading later is low-risk.

### 2.2 Mobile web best practices

**Screen Wake Lock**

| Browser | Support | Source |
|---|---|---|
| Chrome / Android Chrome | 84+ (Android mirrors desktop) | [V, https://github.com/mdn/browser-compat-data/blob/main/api/WakeLock.json] |
| iOS Safari | Partial from 16.4 (did **not** work in Home Screen web apps, WebKit bug 254545); full from **18.4** | same as above; https://webkit.org/b/254545 |
| Firefox | 126+ | same as above |

Implementation rules:
- Request the lock only from a user gesture (the "Join" tap).
- **Re-acquire it on `visibilitychange` → `visible`**, because the lock is released when the page is hidden [U, https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API].
- Feature-detect `'wakeLock' in navigator` and show a "keep your screen on" hint as the fallback.

**Reconnect after phone lock or tab backgrounding**
- Mobile browsers freeze or kill sockets in background tabs, so assume the socket is dead after any `visibilitychange` → `hidden` [U, https://developer.chrome.com/docs/web-platform/page-lifecycle-api].
- On `visible`, `online` or `pageshow` (persisted): if the socket is not OPEN, reconnect immediately, then fall back to **exponential backoff with jitter** (e.g. 0.5 s → doubling → cap 10 s). `partysocket` provides reconnect/backoff [V, cloudflare/partykit README].
- **Resume token:** on first join the server issues `{roomCode, playerId, resumeToken}`. Store it in `localStorage` (wrapped in try/catch, because Safari private mode can throw). On reconnect, send `hello{resumeToken}` and the DO re-binds the seat and returns a **full state snapshot**. Never rely on replaying missed deltas. Expire tokens when the room ends.
- Have the server keep the seat for a grace period (e.g. 60–120 s) before marking the player "away", so a phone lock mid-round does not kick anyone.

**Viewport and safe areas**
- Use `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` together with `padding: env(safe-area-inset-*)`.
- Use `100dvh` instead of `100vh` (the iOS URL bar changes the viewport height).
- Set `touch-action: manipulation` to remove the double-tap-zoom delay.
- Keep inputs ≥16px so iOS does not zoom [U, https://developer.mozilla.org/en-US/docs/Web/CSS/env].

**Haptics**
- `navigator.vibrate` works on Android Chrome 32+ and needs a user gesture since Chrome 60.
- **Safari/iOS: not supported** (`version_added: false`).
- Firefox Android 79+ returns `true` but does not vibrate.

Source: [V, https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json]. Treat haptics as a progressive enhancement and pair them with a visual or audio cue.

**PWA (optional)**
- A manifest plus "Add to Home Screen" gives full-screen play. Remember that wake lock in iOS Home Screen apps needs 18.4+ [V, above].
- A service worker is not required for a live-only game. Skip offline caching in v1.

---

## 3. i18n FR / EN / AR with RTL

### 3.1 Web

- Set `<html lang="ar" dir="rtl">` when switching locale, not just a class, so the browser bidi algorithm and form controls follow.
- Wrap user-generated names in `<bdi>` or `dir="auto"` [U, https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/dir].
- Use **CSS logical properties** only (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `text-align: start`). For example, `padding-inline-start` has been supported since Chrome 69 and iOS Safari 12.2 [V, https://github.com/mdn/browser-compat-data/blob/main/css/properties/padding-inline-start.json].
- Mirror directional icons (arrows) with `:dir(rtl)` or `[dir=rtl]` transforms.
- **i18n library**, measured gzip [V, local esbuild]:

| Library | Version | gzip |
|---|---|---|
| `rosetta` | 1.1.0 | **0.7 KB** |
| `i18next` | 26.4.2 | **13.9 KB** |

  **Recommendation:** `rosetta` (or a 30-line in-house `t()`) plus the built-in `Intl.PluralRules`, which handles Arabic's six plural categories, and `Intl.NumberFormat`. Use JSON message files per locale, with keys shared with the Android app.
- **Numerals:** decide on Western digits (common in Lebanon) vs Arabic-Indic. Pass `numberingSystem: 'latn'` explicitly for consistency [U, product decision].

### 3.2 Android (Compose / TV)

- Set `android:supportsRtl="true"` on `<application>`. Compose then reads `LocalLayoutDirection` from the locale, and `Row` and `padding(start=…)` mirror automatically.
- Force a direction with `CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl)` [U, https://developer.android.com/reference/kotlin/androidx/compose/ui/platform/package-summary#LocalLayoutDirection(); https://kotlinlang.org/docs/multiplatform/compose-rtl.html].
- For in-app language switching use per-app language preferences (`AppCompatDelegate.setApplicationLocales`) [U, https://developer.android.com/guide/topics/resources/app-languages].
- **Arabic fonts.** All of the following are **SIL OFL** (free to bundle in apps and on the web) [V, google/fonts METADATA.pb + OFL.txt]:

| Font | Designer(s) | Source |
|---|---|---|
| **Noto Sans Arabic** | Google | https://github.com/google/fonts/tree/main/ofl/notosansarabic |
| **Cairo** | Mohamed Gaber | https://github.com/google/fonts/tree/main/ofl/cairo |
| **IBM Plex Sans Arabic** | Mike Abbink, Bold Monday, Khajag Apelian, Wael Morcos | https://github.com/google/fonts/tree/main/ofl/ibmplexsansarabic |
| **Tajawal** | Boutros Fonts | https://github.com/google/fonts/tree/main/ofl/tajawal |

  **Suggestion:** use Cairo for display on the TV (bold, readable at 3 m, with Latin glyphs, so it can be the single font for all three languages [U]) and Noto Sans Arabic as the fallback. Subset the web font to the glyphs actually used.

### 3.3 Word-pair datasets

Repos found by searching GitHub for "undercover game words" (11 results) and cloning them [V, 2026-10-03]:

| Repo | License | Content | Usable? |
|---|---|---|---|
| https://github.com/antebrl/undercover-word-game | **MIT** | `src/i18n/locales/{en,fr,de}/wordPairs.ts`, about 300 pairs each, as `["Chien","Chat"]` | **Yes for EN/FR seed.** Some pairs are brands (e.g. "Adidas"/"Nike"); filter those out. Keep the MIT notice |
| https://github.com/Tanveer-rajpurohit/Undercover | MIT | `backend/src/wordPairs.ts`, about 115 EN pairs with a difficulty tag (Basic/Standard/Advanced) | Yes, as an EN supplement |
| https://github.com/omacelaru/Undercover_Android_Game | **none** | `similar_words.csv`, about 495 rows, **Romanian** | No (no license, wrong language) |

**No open Arabic Undercover dataset was found [V, for this search].**

**Plan:**
- Seed EN/FR from the MIT repos (attribute them in `THIRD_PARTY.md`).
- **Write AR (Levantine/Lebanese) pairs by hand.** Machine-translating EN pairs often breaks the "similar but different" property, so do not do that.

**JSON schema (one file per pack):**
```json
{
  "id": "lb-food-01", "version": 1, "locale": "ar-LB", "script": "Arab",
  "title": { "en": "Lebanese Kitchen", "fr": "Cuisine libanaise", "ar": "المطبخ اللبناني" },
  "tags": ["food", "lebanon"], "ageRating": "all", "license": "CC-BY-4.0", "source": "original",
  "pairs": [
    { "id": "p001", "civilian": { "text": "منقوشة", "translit": "manousheh" },
      "undercover": { "text": "كعكة", "translit": "ka'ke" },
      "difficulty": 2, "reviewedBy": ["reviewer-a", "reviewer-b"], "notes": "street breakfast breads" }
  ]
}
```
Rules:
- `difficulty` runs from 1 (easy) to 3 (subtle).
- `translit` is optional but shown on the TV for mixed-language groups.
- Validate packs with JSON Schema/zod in CI. Check for duplicate pairs, identical words, and pairs that appear in both orders.

**Review process:**
1. Drafting: a native speaker drafts 30–50 pairs per pack.
2. Second review: a second native speaker scores each pair for **(i) similarity** (enough to bluff) and **(ii) distinguishability** (describable without saying the word). Drop anything scored ≤2/5.
3. Sensitivity pass: religion, politics, sects, alcohol, real living people. Mark questionable items with `ageRating` or drop them.
4. Playtest with a real group. Log pairs where the undercover is spotted in round 1 (too different) or never found (too similar), and retire or re-tier them.
5. Versioning: bump the pack `version` on each change. The server sends the pack id and version in the room state.

**Lebanese pack examples (draft, Arabic spelling and transliteration need native review [U]):**

| # | Civilian (AR / translit) | Undercover (AR / translit) | Theme |
|---|---|---|---|
| 1 | منقوشة / manousheh | كعكة / ka'ke | street breakfast |
| 2 | تبولة / tabbouleh | فتوش / fattoush | salads |
| 3 | حمص / hommos | متبل / mtabbal | mezze dips |
| 4 | شاورما / shawarma | فلافل / falafel | sandwiches |
| 5 | كنافة / knefeh | معمول / ma'moul | sweets |
| 6 | جلاب / jallab | تمر هندي / tamer hindi | drinks |
| 7 | دبكة / dabke | زفة / zaffe | celebration |
| 8 | بعلبك / Baalbek | جبيل / Jbeil | places |
| 9 | سرفيس / service | تاكسي / taxi | transport |
| 10 | فيروز / Fairouz | صباح / Sabah | music legends |

---

## Sources (primary)
- Cloudflare DO pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Cloudflare DO data location: https://developers.cloudflare.com/durable-objects/reference/data-location/
- PartyKit acquisition: https://blog.cloudflare.com/cloudflare-acquires-partykit/
- PartyServer repo: https://github.com/cloudflare/partykit
- Beirut PoP: https://blog.cloudflare.com/marhaba-beirut-cloudflares-121st-pop/
- Socket.io (what it is not; state recovery): https://socket.io/docs/v4/ and https://socket.io/docs/v4/connection-state-recovery
- Supabase Realtime limits and regions: https://supabase.com/docs/guides/realtime/limits and https://supabase.com/docs/guides/platform/regions
- Fly.io regions and pricing [U]: https://fly.io/docs/reference/regions/ and https://fly.io/docs/about/pricing/
- MDN browser-compat-data: https://github.com/mdn/browser-compat-data
- OkHttp: https://github.com/square/okhttp
- Google Fonts OFL fonts: https://github.com/google/fonts/tree/main/ofl
- npm registry (all version numbers): https://registry.npmjs.org/
