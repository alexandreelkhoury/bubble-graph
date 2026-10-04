# Notes for the SEO agent (handover from the CRO pass, 2026-10-04)

Not deployed. Nothing SEO-specific was created: no language URLs, sitemap, robots, llms.txt or new pages. Placeholders left untouched: `{{SITE_URL}}`, `{{CONTACT_EMAIL}}`, `{{OWNER_NAME}}`, plus a new `{{CF_BEACON_TOKEN}}` in `assets/js/main.js` (measurement, see CRO-AUDIT.md §4).

## Structure

| Path | What |
|---|---|
| `/index.html` | The single landing page (all languages) |
| `/privacy/index.html` | Privacy policy, EN + FR in one document (`.pv-en` / `.pv-fr` articles, toggled by an inline script with `?lang=`; AR falls back to EN). New §12 "This website" |
| `/404.html` | noindex |
| `/assets/js/i18n.js` | FR + AR strings (`window.MISHANA_I18N.fr / .ar`) |
| `/assets/js/main.js` | i18n engine, angle tracking, reel, demo, events |
| `/worker/index.js` | Worker: only `POST /e` (events). Every other path is a static asset (`run_worker_first: ["/e"]`). Not uploaded as an asset |
| `/_headers` | Security headers + CSP (now allows `static.cloudflareinsights.com` script and `cloudflareinsights.com` connect) and caching |
| `wrangler.jsonc` | `main`, `assets` (directory `.`, `404-page`, `auto-trailing-slash`), Analytics Engine binding |

`.assetsignore` excludes `*.md`, `worker`, `.git`, `.gitignore`, `wrangler.jsonc`, `node_modules`, `.wrangler`. If you add `robots.txt`, `sitemap.xml` or `llms.txt` at the root they will be served (they're not ignored). Note `*.md` is ignored, so an `llms.txt` is fine but an `llms.md` would not ship.

## How i18n works (important for crawlers)

- **English is in the HTML.** FR/AR are applied client-side: the inline head script picks the language from `?lang=` → `localStorage['mishana:site-lang']` → `navigator.languages`, sets `<html lang dir>`, loads `i18n.js`, and `main.js` swaps `innerHTML` of every `[data-i18n]` element (plus `[data-i18n-alt]`, `document.title`, `meta[name=description]`).
- So **`/?lang=fr` and `/?lang=ar` are the only language "URLs" today**, and they rely on JavaScript. Crawlers that don't run JS see English. The `<link rel=canonical>` is `{{SITE_URL}}/` on all variants. There are no `hreflang` alternates in `<head>` yet (the language switcher links use `hreflang` attributes on `<a>` only).
- `og:locale` + `og:locale:alternate` (fr_FR, ar_LB) are present; OG/Twitter text is English only.
- Hero headline/sub can also change with `?angle=…` or `utm_campaign=<angle>_…` (paid traffic message match). **These must not be indexed as separate pages**: canonical should keep pointing at the clean URL. If you generate static language pages, keep the angle mechanism: it's an inline script right after the hero (EN copy) + keys `heroTitle_<angle>` / `heroSub_<angle>` in `i18n.js` (FR/AR). Angles: `reveal`, `passphone`, `nohardware`, `tonight`, `family`, `tvgame`.
- If you pre-render FR/AR into static files, the source of truth for copy is: EN = `index.html` (+ the inline angle script + `EN` object in `main.js` for JS-only strings), FR/AR = `i18n.js`. Keys missing in a dictionary fall back to English.
- Device-aware text: `#hero-hint` is swapped by the inline script for iPhone (`hintIos`) and desktop (`hintDesktop`) visitors; Android/default text is in the HTML.

## Final copy (EN, default angle) – page outline

Heading order (one H1, then H2s; H3s inside sections):

1. **H1** "Everyone's innocent. Someone's lying." – kicker above it: "Party game for Android TV & Google TV". Sub: "Everyone gets a secret word on their phone. One player's word is slightly different. Give one-word clues, vote, and catch the liar on the big screen." CTA "Install on my TV" (Free to play · via Google Play). Chips: 3–12 players · Nothing to install on phones · EN · FR · عربي
2. **H2** "Works on Android TV & Google TV" – Smart TVs with Google TV or Android TV: Sony, TCL, Hisense, Philips… · Chromecast with Google TV · Google TV Streamer. "Quick check: if your TV has the Google Play Store, it works." "Samsung, LG, Fire TV or Apple TV? Play in your browser instead"
3. **H2** "A whole round in 15 seconds." – 4 beats: Scan / Secret word / Clue & vote / Reveal (captions are real text in the DOM, also for screen readers). **H3** "Try it: here's your phone" (hold-to-peek demo)
4. **H2** "Put it on your TV from the phone in your hand." – 3 steps (H3s: Tap "Install on my TV" / Choose your TV / Open it on your TV), iPhone/computer and remote-search notes
5. **H2** "No Android TV? Play in your browser." – laptop + HDMI steps, `play.mishana.workers.dev/tv`
6. **H2** "Made for the couch, not the controller." – No controllers / No passing one phone around / 3 to 12 players / English, French & Arabic
7. **H2** "Before you press play." – FAQ (`<details>`), in this order: Which TVs does it work on? · My TV is a Samsung, LG, Fire TV or Apple TV. Can we still play? · I'm on an iPhone. Can I still install it on my TV? · How much does it cost? · Do my friends need to download anything? · How long does it take to set up? · Do we need internet? · Is it OK for kids? · How many people can play? · Which languages? · What do you do with our data?
8. **H2** "Someone at your table is lying. Find out who." – final CTA

The FAQ is a good candidate for `FAQPage` JSON-LD (answers are in the HTML for EN and in `i18n.js` keys `q*/a*`, `qOther/aOther`, `qSetup/aSetup`, `qKids/aKids` for FR/AR). Existing JSON-LD: `SoftwareApplication` (price 0, Android TV/Google TV, inLanguage en/fr/ar).

## Facts to keep consistent (don't overclaim)

- "Free to play" (never "100% free": optional in-app purchases may come). No ratings, reviews, download counts or press exist yet: don't add `aggregateRating`.
- Works on Android TV / Google TV with the Play Store; not on Samsung (Tizen), LG (webOS), Fire TV, Apple TV; plain "Chromecast" can't run apps, say "Chromecast with Google TV".
- Phones join in the browser (iPhone and Android); internet needed on TV and phones; 3–12 players; EN/FR/AR with Lebanese word packs.
- Word pairs: EN Pizza/Pasta, FR Pizza/Pâtes, AR بيتزا/برغر. Role names: Mole / Taupe / جاسوس, Blank / Blanc / فاضي. Avoid the word "Undercover" (trademark, see LISTING.md §0).
- Keywords already used naturally (from LISTING.md): party game, game night, TV game, secret word, who's the spy, phones as controllers, Android TV, Google TV, Lebanese; FR jeu d'ambiance, soirée jeux; AR لعبة سهرات، الكلمة السرّية.
