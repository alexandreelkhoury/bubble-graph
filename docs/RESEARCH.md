# RESEARCH — findings and decisions

Researched 2026-10-03. This file summarises the conclusions. The detailed notes, with a source URL for every claim, are in:

| File | Scope |
|---|---|
| [research/01-game-and-naming.md](research/01-game-and-naming.md) | Rules, variants, scoring, tie-breaks, Jackbox/AirConsole UX, trademark, names |
| [research/02-android-tv.md](research/02-android-tv.md) | Manifest, Compose for TV versions, focus, quality checklist, Play TV review, adb/emulator |
| [research/03-backend-web-i18n.md](research/03-backend-web-i18n.md) | Backend comparison, phone client, wake lock and reconnection, RTL, fonts, word datasets |

**Caveat:** the research sandbox's proxy blocked direct fetches of yanstarstudio.com, play.google.com, support.google.com, fly.io, supabase.com, developers.cloudflare.com and the trademark registries.
- Claims about those sites come from search snippets, or from the vendors' doc sources on GitHub.
- Version numbers come from npm, Maven Central and the developer.android.com release pages.
- Unverified items are marked [U] or "unverified" in the detail files.

---

## 1. Game design

### Rules adopted (default = official Undercover app)

| Topic | Decision | Basis |
|---|---|---|
| Roles | Civilian (word A), Undercover (word B, similar), Blank (our name for "Mr. White"; no word) | Official rules |
| Role knowledge | Players see **only their word**, not their role. Civilians and Undercovers don't know which they are. The Blank knows they have no word. Option: "reveal roles" for beginners | Official rules ("everyone has forgotten their identity") |
| Speaking order | Random starter, **never the Blank**, then clockwise by seat order. Order rotates each round | Official rules say random start; "Blank never first" is a common house rule, not confirmed in the official app |
| Clues | Said out loud. On their turn a player taps "Done" on their phone, or the per-turn timer expires | — |
| Vote | Secret on the phones. Revealed all at once on the TV. No self-vote | Jackbox pattern |
| Tie | Tied players each give one more clue, then **re-vote among the tied players only**. A second tie picks a random tied player with an on-screen "wheel". Configurable to "no elimination" instead | Official FAQ option 2 |
| Elimination | The eliminated player's role is revealed on the TV | Inferred from the official Lovers rule |
| Blank's guess | An eliminated Blank types one guess on their phone, with a timer. Matching ignores case, accents and Arabic diacritics, and unifies alef/ya/ta-marbuta variants. The pack can list alternate spellings. The TV host can override the result. A correct guess means **the Blank wins immediately** | Official FAQ |
| Civilians win | When every Undercover and Blank is eliminated | Official |
| Infiltrators win | **Official:** when alive Civilians ≤ 1. **Option "parity":** when alive infiltrators ≥ alive Civilians, the Werewolf-style rule your brief described | Official FAQ; ⚠ your brief differs (see open questions) |
| Scoring | Winners score: Civilian 2, Blank 6, Undercover 10, configurable. There is a session leaderboard across rounds | Official app values |
| Special roles | Lovers, Revenger, Goddess, Mr. Meme, Joy Fool are **out of v1**. The engine is designed with hooks so they can be added later | — |

### Default role distribution (configurable; the official table is not published)

| Players | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|
| Undercover | 1 | 1 | 1 | 1 | 2 | 2 | 3 | 3 | 3 | 3 |
| Blank | 0 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 |
| Civilians | 2 | 3 | 3 | 4 | 4 | 5 | 5 | 6 | 7 | 7 |

The host can set Blank from 0 to 2 and Undercover from 1 to ⌊(n−1)/2⌋. The engine checks that civilians outnumber infiltrators.

### UX patterns adopted (from Jackbox and AirConsole)
- **Joining:** the TV shows a big QR code plus a 4-letter code with no ambiguous letters. The QR opens `https://<host>/<CODE>` directly; the player only types a name and picks a colour.
- **Hosting:** the TV remote is the primary host, and the first phone to join is the "VIP" co-host who can press Start. The host can kick players and change settings.
- **Privacy:** the word appears on the phone behind **press-and-hold**, and the player can peek again any time.
- **Reconnection:** each phone keeps a stable seat via a resume token in localStorage. The TV shows a "reconnecting" badge, and the game never stalls: timers skip absent players.
- **Timers:** adjustable or off, shown on both the TV and the phone.
- **Reveals:** all votes revealed together → eliminated player → role card flip. After each round, a scoreboard with both words shown.
- **Later:** audience mode, and hiding the room code for streamers.

## 2. Android TV — decisions

| Item | Value |
|---|---|
| UI | Compose for TV: `androidx.tv:tv-material:1.1.0` and `tv-foundation:1.0.0` (both stable 2026-05-06). Lazy layouts and focus APIs come from core Compose (the `TvLazy*` layouts were removed) |
| Toolchain | AGP 9.4.0 (built-in Kotlin), Gradle 9.6.0, JDK 17, Kotlin 2.4.20, Compose BOM 2026.09.00 |
| SDK levels | compileSdk 37 (needed by Compose 1.12); targetSdk 36; minSdk 26 (≤31 required by TV-PS) |
| Manifest | `LEANBACK_LAUNCHER`, `leanback required=true` (TV-only), `touchscreen required=false`, 320×180 px xhdpi banner **containing the app name**, 160×160 px icon, landscape |
| Networking | OkHttp WebSocket + kotlinx.serialization. A debug-only `network_security_config` allows cleartext to the LAN dev server |
| QR | `com.google.zxing:core:3.5.4` → `BitMatrix` → drawn on a Compose `Canvas`, ≥240 dp with a quiet zone |
| Focus | Initial focus via `FocusRequester` + `LaunchedEffect`; `focusRestorer` on groups; `BackHandler`. Back from the root screen exits the app (TV-DB). During a game, Back opens a pause menu |
| Layout | 960×540 dp canvas, 48/27 dp safe margins, dark theme, `sp` text |
| Play | AAB; ≥1 TV screenshot and a TV banner in the listing; opt in under Advanced settings → Form factors. **targetSdk ≥34 has been required for TV since 2026-08-31.** 64-bit and 16 KB page sizes required (no native libs in this app, so no impact) |
| Device | TCL on Android TV 13+: `adb pair` then `adb connect`. On older versions: `adb tcpip 5555`. Emulator: Google TV AVD, API 34+ |

## 3. Realtime backend — recommendation

| | Node + Socket.io on Fly | **Workers + Durable Objects (PartyServer)** | Supabase Realtime |
|---|---|---|---|
| Latency from Lebanon | Europe region | Edge at the **Beirut PoP**; DO runs in a nearby European colo | Europe region |
| Hobby cost | About $2/mo, no free tier for new orgs [U] | **$0** on the Free plan (100k req/day, WebSocket messages counted 20:1); hibernation required | $0, but pauses when idle |
| Authoritative logic | Good | **Best fit:** one single-threaded DO per room, with alarms and storage | Poor (no persistent process) |
| Kotlin client | Needs the Socket.io Java client | **Plain WebSocket** (OkHttp) | supabase-kt or Phoenix protocol |
| LAN dev | `node` | `wrangler dev --ip 0.0.0.0` | Docker stack |

**Decision: Cloudflare Workers + Durable Objects using `partyserver@0.5.10` with `partysocket@1.3.0` on the phone.**
- **One DO per room:** room state is persisted in `ctx.storage` and rehydrated in `onStart()`.
- **Hibernation is on** (`static options = { hibernate: true }`).
- **Timers use DO alarms**, not `setTimeout`, because in-memory timers don't survive hibernation.

## 4. Phone client — decisions
- **Framework:** Vite 8 + Preact 10.29.x + `@preact/signals`, with a 5.6 KB gzip runtime. Preact 11 was released three days ago; we'll revisit it after M2.
- **Wake lock:** request it on the Join tap and again on every `visibilitychange→visible`. Without support, show a "keep the screen on" hint. iOS only supports it in home-screen apps from 18.4.
- **Reconnection:** reconnect immediately on `visible`/`online`/`pageshow`, then exponential backoff with jitter capped at 10 s. Re-joining uses `resumeToken`, and the server replies with a **full snapshot**. The seat is held for 120 s.
- **Mobile layout:** `viewport-fit=cover` with `env(safe-area-inset-*)`, `100dvh`, inputs ≥16px, and `touch-action: manipulation`.
- **Haptics:** `navigator.vibrate` only as an enhancement; it doesn't exist on iOS.
- **No PWA or service worker in v1.**

## 5. i18n — decisions
- **Languages:** FR, EN and AR, with a shared set of message keys. Strings live in `shared/i18n/*.json`, and Android `strings.xml` files are generated from them by a script.
- **Web:** `<html lang dir>`, CSS logical properties only, `rosetta` (0.7 KB), and `Intl.PluralRules`, which handles Arabic's 6 plural forms. Player names are wrapped in `<bdi>`.
- **Android:** `supportsRtl="true"`, per-app locale (`AppCompatDelegate.setApplicationLocales`), and layouts that mirror automatically through `LocalLayoutDirection`.
- **Fonts (all OFL):** Cairo for TV display in all 3 scripts, Noto Sans Arabic as fallback. Web fonts subsetted. Western digits by default.
- **Word packs:**
  - **EN/FR:** seeded from `antebrl/undercover-word-game` (MIT, ~300 pairs per language), with brand names filtered out and attribution in `THIRD_PARTY.md`.
  - **AR:** no open dataset exists, so we write our own pairs, Levantine and Modern Standard Arabic, starting with a **Lebanese pack** (manousheh/ka'ke, hommos/mtabbal, service/taxi…).
  - Packs follow a JSON schema validated by zod in CI and go through a 5-step review: draft → second native reviewer → sensitivity pass → playtest → versioning.

## 6. Name and trademark
- The developer claims "Undercover" as a trademark (® on Google Play, ™ elsewhere), and the registration couldn't be checked. "Mr. White" is closely tied to that app. **We avoid both, and avoid "Imposter Party".** Mr. White becomes "the Blank".

| Name | Meaning | Conflicts found | Verdict |
|---|---|---|---|
| **Mish Ana!** (مش أنا) | Lebanese for "Not me!" | None among apps; there's a 2016 Lebanese TV series | **Recommended** |
| Kelmet Ser (كلمة سر) | "Secret word" | None exact; generic phrase | Fallback (weak brand) |
| Fauxmot | "False word" (FR/EN) | None exact | Fallback (FR/EN only) |
| Word Mole | — | iOS app plus a BlackBerry game | Rejected |
| L'Intrus | "The intruder" | 1991 card game; crowded term | Rejected |

Before launch you'll need a manual Play Store search plus Lebanese (Ministry of Economy and Trade) and WIPO trademark searches in classes 9, 28 and 41.
