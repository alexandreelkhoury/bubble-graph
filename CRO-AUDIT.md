# Mish Ana! landing page – CRO audit (2026-10-04)

Scope: `index.html` (EN/FR/AR via `assets/js/i18n.js`), privacy page, `_headers`. Traffic assumption: paid TikTok/Instagram (≈90 % on a phone, usually **not** in front of the TV) plus organic. Primary conversion: click to Google Play ("install on your TV from your phone"). Secondary: "Play in your browser" (`play.mishana.workers.dev/tv`).

Method: Playwright screenshots at 390×844 and 1440×900 in EN/FR/AR, Lighthouse mobile (before/after), code read, checks against `play-store/LISTING.md`, `ads/REVIEW.md`, `ads/SCRIPTS.md` and the game's UI rules (`bubble-graph/docs/DESIGN.md` §2, §6.2; `shared/i18n`).

Screenshots and Lighthouse reports: `/home/alex/mishana-marketing/cro-screenshots/` (`before-*`, `after-*`, `angle-*`, `reel-*`, `lighthouse-mobile-*`).

## 1. Scores

| | Before | After |
|---|---|---|
| Lighthouse mobile – Performance | 98 | **98** (EN) · 96 (AR + angle) |
| Lighthouse mobile – Accessibility | 96 (contrast fail) | **100** |
| Lighthouse mobile – Best practices | 100 | 100 |
| Lighthouse – SEO | 92 | 92 (only failure: `canonical` = `{{SITE_URL}}` placeholder, left for the SEO agent/owner) |
| LCP / CLS (local python server, no compression) | 2.3 s / 0.028 | 2.4 s / 0.016 |
| Hero primary CTA bottom edge, 390×844 | 668 px (EN) | 635 px (EN) · 703 px (FR) · 708 px (AR): inside the fold, with the install hint and the "No Android TV?" link |

Local LCP is pessimistic: python's server sends no compression and no cache headers. On Cloudflare (brotli + `_headers` caching) expect ≈1.5 s.

## 2. Findings, scored (impact × effort)

Impact 1–5 (effect on Play clicks or trust), Effort 1–5 (1 = trivial). Priority = Impact × (6 − Effort). Status: ✅ done in this pass, 🟡 partly, ⬜ owner/next.

| # | Finding | Impact | Effort | Priority | Status |
|---|---|---|---|---|---|
| 1 | **No message match with the ads.** Every angle (Reveal, Stop passing the phone, Zero hardware, Tonight, Family) lands on the same slogan. A viewer who tapped "Stop passing the phone around." doesn't see that promise again | 5 | 2 | 20 | ✅ `?angle=` / `utm_campaign` prefix swaps hero H1 + sub in EN/FR/AR before first paint |
| 2 | **"Install on TV from phone" not explained at the click.** CTA said "Get it on Google TV"; the reassurance ("install it onto your TV from here") sat under a second, equal-weight button | 5 | 1 | 25 | ✅ CTA "Install on my TV · Free to play · via Google Play" + device-aware hint directly under it (Android / iPhone / computer) |
| 3 | **iPhone visitors dead-end** (ads target Android, but organic and shares don't). Only answered in FAQ #7 | 4 | 1 | 20 | ✅ iOS-specific hint under the CTA, iPhone note in the install section, FAQ moved up |
| 4 | **"Which TVs?" buried in FAQ #1, no explicit "doesn't work on" list.** Samsung/LG/Fire TV/Apple TV owners click Play, find nothing, bounce (and cost money) | 5 | 2 | 20 | ✅ "Works on Android TV & Google TV" strip right after the hero (TCL, Sony, Hisense, Philips, Chromecast with Google TV, Google TV Streamer, Play Store check, route for the others) |
| 5 | **Browser fallback was a weak afterthought** (second sentence of a FAQ answer; a "Try it now in your browser" ghost button that, on a phone, opens the *TV* screen on the phone) | 4 | 2 | 16 | ✅ Dedicated "No Android TV? Play in your browser" section (3 steps, laptop + HDMI), "Send the link to my laptop" share/copy button for phone visitors; on phones the hero shows a text link, on desktop a ghost button |
| 6 | **Hero video says "Turn any TV into a party."** False (needs Android TV / Google TV) and visible in the first seconds | 4 | 1 | 20 | ✅ First 4 s trimmed (both encodes, smaller files). ⬜ Owner: fix the caption in the Remotion source |
| 7 | **Hero video and poster captions are English-only** on FR/AR pages | 2 | 3 | 6 | ⬜ Owner: render FR/AR cuts (`HERO_MEDIA` in main.js supports per-locale entries if you add a `lang` check) |
| 8 | **How-it-works was 3 tall cards (≈1,500 px on mobile)** and never showed the payoff (vote → OUT → role) that the Reveal ads sell | 4 | 3 | 12 | ✅ "A whole round in 15 seconds": localized, pausable 4-beat CSS reel matching the real UI (face-down card in player colour, Mole's card identical, edit-graphic ring *around* the phone, phone vote, OUT/DEHORS/برّا stamp at −8°, orange `#FF8A3D` Mole card with domino mask, "…the Mole! Nice catch."). Zero extra requests |
| 9 | **Arabic word pair wrong**: باستا isn't in the AR packs (real pair بيتزا/برغر, per REVIEW.md #3) | 3 | 1 | 15 | ✅ AR uses برغر in the demo, captions and reel |
| 10 | **«لا بصبصة»** (AR feature copy) reads as *ogling* in Lebanese (REVIEW.md #9) | 2 | 1 | 10 | ✅ «ما حدا بيطلّع عتلفون غيرو» |
| 11 | **Cream text on magenta buttons** (3.14:1); DESIGN.md §2.4 says "never", the app uses ink (5.78:1). The 16 px nav CTA failed AA | 3 | 1 | 15 | ✅ Ink labels on all magenta buttons |
| 12 | **Contrast fail** on the PIZZA word card (4.49:1 at 17 px) | 2 | 1 | 10 | ✅ min 19 px bold (large text) |
| 13 | **Broken Latin letter spacing** ("Inst all", "T u") everywhere in body text: the Cairo subsets had dropped the `prep` table | 3 | 1 | 15 | ✅ Re-subset with the same glyph set, `prep` kept (+~300 B each) |
| 14 | **Objections missing**: setup time, kids/age, "my TV is a Samsung", cost wording ("Free" vs "Free to play") | 3 | 1 | 15 | ✅ New FAQ items; FAQ reordered by objection weight; "Free to play" everywhere (IAP may come) |
| 15 | **Two equal CTAs in the hero split attention** on mobile (primary + same-size ghost) | 3 | 1 | 15 | ✅ One dominant CTA on phones; secondary as a link |
| 16 | **Final CTA was a repeat** with no recap or fallback | 3 | 1 | 15 | ✅ Checklist (free to play, nothing on phones, 3–12, 3 languages), two-line primary, "No Android TV?" secondary, search-on-TV line |
| 17 | **Sticky bar** said "Get it" / "Free to play · Google TV" (Android TV owners may not self-identify) | 2 | 1 | 10 | ✅ "Install on TV" / "Free to play · Android TV & Google TV" |
| 18 | **No measurement at all** – no way to compare angles, positions or objections | 5 | 3 | 15 | ✅ Cookieless: Cloudflare Web Analytics (token placeholder) + own `/e` events → Workers Analytics Engine. See §4 |
| 19 | **Late video frame became the LCP element** | 2 | 1 | 10 | ✅ Video layer 1 px smaller than the poster |
| 20 | **`.git` could be uploaded as assets** (assets directory is the repo root; `.git` wasn't in `.assetsignore`) | 4 | 1 | 20 | ✅ `.git`, `.gitignore`, `worker/` ignored |
| 21 | **Section eyebrows on every section** (tracked caps above each H2: template look) | 1 | 1 | 5 | ✅ Removed; one hero kicker pill kept ("Party game for Android TV & Google TV"), which also does the 5-second "for whom" job |
| 22 | **No social proof** | 3 | – | – | ⬜ Deliberately not faked. Add real Play rating/reviews or creator clips only once they exist |
| 23 | **Install-guide mock imitates Play UI** (green Install button, "Install on more devices" sheet). Fine for a landing page, but REVIEW.md warns ad reviewers dislike redrawn store UI; labels for a TV-only app may differ | 2 | 2 | 8 | ⬜ Swap for a real screen recording once the listing is live (the guide's `g__art` blocks are self-contained) |
| 24 | **Page length on mobile** (~7,200 px after adding works-on + no-TV sections) | 2 | 2 | 8 | 🟡 Acceptable: sticky CTA is always present after the hero; the reel replaced ~1,000 px of cards. Watch `depth` events and cut "Why" on mobile if < 30 % reach it |
| 25 | **No 9:16 hero cut**: the 16:9 TV frame is small on phones | 2 | 3 | 6 | ⬜ Supported in `HERO_MEDIA` already |
| 26 | CSS/JS unminified (≈15 KB) and render-blocking CSS | 1 | 2 | 4 | ⬜ Optional build step; Cloudflare compression covers most of it |

## 3. 5-second test (mobile hero, after)

- **What:** kicker "Party game for Android TV & Google TV" + H1 + the TV/phone visual.
- **For whom:** groups with an Android/Google TV; the "works on" strip lists the devices one scroll later.
- **Why now / risk-free:** "Free to play · via Google Play" inside the CTA; "Google Play opens on this phone. Choose your TV and the game installs there." under it; "No Android TV? Play in your browser →" for everyone else.

## 4. Measurement (cookieless) – owner setup

1. **Cloudflare Web Analytics** (page views, Core Web Vitals): Cloudflare dashboard → Analytics & Logs → Web Analytics → Add site → copy the 32-hex token → replace `{{CF_BEACON_TOKEN}}` in `assets/js/main.js`. Until then the beacon never loads. (If the site's hostname is proxied by Cloudflare you can instead enable automatic injection and leave the placeholder.)
2. **Custom events** (`worker/index.js` → Workers Analytics Engine dataset `mishana_site_events`): enable Analytics Engine in the account (free tier), then `npx wrangler deploy`. Events: `view`, `cta` (`t` = play_store | browser, `p` = nav | hero | install | notv | final | sticky | faq | footer), `faq` (question id), `depth` (25/50/75/100), `reel` (complete / tapN), `share`, `demo`, `lang`. Each carries angle, language, device class, utm_source/campaign/content and country. No cookies, no IDs, IP never stored; skipped with GPC/DNT. To switch off: set `EVENT_URL = ''` in main.js.
3. Example query (Analytics Engine SQL API):

```sql
-- Play-click rate by ad angle, last 7 days
SELECT blob4 AS angle,
       sumIf(_sample_interval, blob1 = 'view') AS views,
       sumIf(_sample_interval, blob1 = 'cta' AND blob2 = 'play_store') AS play_clicks
FROM mishana_site_events
WHERE timestamp > NOW() - INTERVAL '7' DAY
GROUP BY angle ORDER BY views DESC
```

Also: `GROUP BY blob3` on `cta` rows = which position converts; `blob1 = 'faq'` = which objections matter; `blob6` = device split (how many iPhones the ads actually bring).

Dev note: `wrangler dev` hot-reload-loops because the assets directory is the project root (it watches its own `.wrangler/tmp`). Test with `python3 -m http.server` for the page and deploy for the endpoint, or move the site into a `public/` folder later.

## 5. Ad links (message match)

Use the angle in `utm_campaign` (as SCRIPTS.md already does) or add `angle=` explicitly:

| Angle | Landing URL example | EN H1 |
|---|---|---|
| A The Reveal | `/?utm_source=instagram&utm_medium=paid_social&utm_campaign=reveal_A_H1&utm_content=A_H1_v1_EN` | "It was you?!" Find the liar on your TV. |
| B Pass the phone | `…utm_campaign=passphone_B_H1` | Stop passing the phone. Everyone gets their own. |
| E Zero hardware | `…utm_campaign=nohardware_E_M2` | No controllers. No app. Just your phones. |
| D Tonight | `…utm_campaign=tonight_D_H1` | 5 phones. 0 plans? Tonight's sorted. |
| F Family | `…utm_campaign=family_F_H1&lang=ar` | Family game night just got dangerous. |
| C TV game | `…utm_campaign=tvgame_C_M3` | Looking for a game for your TV? Here's one. |

The page passes all `utm_*` through to the Play `referrer` parameter (unchanged behaviour). For FR/AR ads add `&lang=fr` / `&lang=ar`.

## 6. Next tests (when traffic allows)

1. Hero media: TV + phone visual vs. the reel moved into the hero (mobile).
2. CTA copy: "Install on my TV" vs "Send it to my TV".
3. Hero for `default`: slogan vs. a benefit H1 ("The party game your phones control").
4. Remove "Why" on mobile if depth data shows < 30 % reach it.
