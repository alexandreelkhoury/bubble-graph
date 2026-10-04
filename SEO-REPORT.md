# Mish Ana! site – SEO + AI search (GEO) report

Date: 2026-10-04. Scope: `/home/alex/mishana-site` (not deployed, not pushed). Builds on the CRO pass (CRO-AUDIT.md); all CRO behaviour is kept (ad angles, device hints, reel, demo, sticky CTA, cookieless events).

## 1. What was done

### Build: one origin, one command
- **`site.config.json`** holds `"origin": "https://www.mishana.app"`, a clearly marked **placeholder**. Changing the domain = edit that one line, run `node build.mjs`, deploy.
- **`build.mjs`** (Node, no dependencies) writes `dist/`: home in EN/FR/AR, guide pages, privacy, 404, `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, assets. The origin is injected into canonicals, hreflang, sitemap, OG/Twitter, JSON-LD, robots and llms files.
- The build **fails** on invalid JSON-LD, a leftover `{{SITE_URL}}`, a broken internal link, a page without exactly one H1, a missing canonical, title or description. It warns on long titles/descriptions.
- Kept placeholders: `{{CONTACT_EMAIL}}`, `{{OWNER_NAME}}`, `{{CF_BEACON_TOKEN}}` (fill them in the source, or set `contactEmail` / `ownerName` / `cfBeaconToken` in `site.config.json` to have the build fill them).
- `"playStoreLive": false` switch: while false, guide CTAs lead with "Play in your browser" and say the TV app is coming to Google Play (matching the launch drafts' status line); `llms.txt` says the same. Set to `true` on Play launch day to switch CTAs to "Install on my TV" and add `installUrl`/`sameAs` to the JSON-LD.
- **Deploy config**: `wrangler.jsonc` now uploads `./dist` only and runs `node build.mjs` before `wrangler deploy` / `wrangler dev` (`build.command`). Sources, `.git`, `node_modules`, `*.md`, `content/` and the build script are never published. `dist/` is git-ignored. (This also ends the `wrangler dev` reload loop CRO-AUDIT.md mentioned.)

### Real language URLs
- `/` (EN), `/fr/`, `/ar/` (RTL, `lang`/`dir` set) are pre-rendered from the same template: EN copy from `index.html`, FR/AR from `assets/js/i18n.js`. Crawlers see each language without JavaScript, including the hero angle copy and device hints inside the inline script.
- Language switcher = real links. `?lang=fr|ar|en` (used in ad links) redirects to the right page and keeps `utm_*` / `angle`; a remembered choice (or, once per session, the browser language) routes visitors who land on `/`. Clicking a language stores it, so "EN" from `/fr/` sticks.
- FR/AR pages inline only the ~1 KB of strings `main.js` needs at runtime instead of loading the 27 KB `i18n.js`.
- Each page: self-canonical, `hreflang` en / fr / ar / x-default (only between real translations), per-language title, description, OG/Twitter, `og:locale` + alternates.

### Technical
- `robots.txt`: everything allowed; explicit groups for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Bingbot, DuckAssistBot, MistralAI-User, Meta-ExternalAgent, Amazonbot, CCBot. Points to the sitemap and llms.txt. No reason was found to block any of them (no paywall, the goal is to be cited).
- `sitemap.xml`: every indexable page, `lastmod` from the content front matter, `xhtml:link` alternates for translated pages.
- `404.html` keeps `noindex`.
- `_headers`: UTF-8 content types for `llms*.txt` / `robots.txt` (Arabic text), short caching for the sitemap.
- Structured data (one `@graph` per page, validated by the build):
  - Home (per language): `Organization`, `WebSite`, `VideoGame` + `SoftwareApplication` (applicationCategory GameApplication, operatingSystem "Android TV, Google TV", gamePlatform Android TV / Google TV / Web browser, `numberOfPlayers` 3–12, inLanguage en/fr/ar, `offers` price 0, playMode MultiPlayer, genre), `VideoObject` (hero video: thumbnail, `PT20S`, contentUrl, uploadDate), `WebPage`, `FAQPage` built from the visible FAQ in that language.
  - Guides: `Article` (dates, publisher, `about` → the game, `mentions` for other games on comparison pages), `BreadcrumbList`, `FAQPage`, `WebPage`. About page: `AboutPage` + `VideoGame`. Guides hub: `CollectionPage`.
  - No `aggregateRating`, reviews or download counts anywhere.

### Content (guides)
Each guide has one H1, a concise answer box first (quotable), an FAQ, internal links, a CTA box (browser version / Play), "Last updated" date, the shared one-sentence definition, and, on comparison pages, a trademark disclaimer.

| URL | Lang | Purpose |
|---|---|---|
| `/how-to-play/` | EN | Rules, roles, role table by player count, round, ties, Blank's guess, win rules, scoring (2/10/6), tips, settings |
| `/fr/comment-jouer/` | FR | Same, in French (Civil / Taupe / Blanc, Officielle / Parité) |
| `/party-games-android-tv/` | EN | Honest 2026 roundup of party games on Android TV / Google TV with sources |
| `/mr-white-game-on-tv/` | EN | What "Mr. White" means, paper version, TV version |
| `/fr/jeu-mr-white-tele/` | FR | Same, French (the market where "Mr White" is a known name) |
| `/games-like-spyfall-undercover/` | EN | Comparison: Spyfall, Undercover, The Chameleon, Codenames, Jackbox, Werewolf, Mish Ana! |
| `/family-game-night-12-players/` | EN | 8 big-group game ideas, ages, equipment |
| `/lebanese-game-night/` | EN | Lebanese sahra plan, Lebanese word packs, mixed-language groups |
| `/ar/lebanese-game-night/` | AR | Arabic (Lebanese) version |
| `/install-apps-google-tv-from-phone/` | EN | Android / iPhone / computer / remote steps + troubleshooting |
| `/about/` | EN | Entity facts, role names in 3 languages, where to play, press contact |
| `/guides/` | EN | Hub listing all guides |

Home pages also got an **About** block (entity facts, `id="about"`) and a guides list in the footer, in all three languages.

### LLM visibility
- `/llms.txt` (entity description, key facts, status, links) and `/llms-full.txt` (full text of the FAQ and every guide), generated from the same sources so they never drift.
- One product definition sentence (EN/FR/AR, in `content/home.json`) reused in JSON-LD, the About block, the About page, every guide's "About Mish Ana!" box and llms.txt.
- Off-site plan with priorities and a monthly measurement protocol: **GEO-PLAN.md**.

## 2. Keyword map

Volumes are not available (no Keyword Planner/Ahrefs access); intent and competition are estimated from what ranks today. Trademark rule: other games' names only in comparison context, never as our brand.

| Page | Primary target | Secondary / long tail | Intent · competition |
|---|---|---|---|
| `/` | party game for Android TV / Google TV | secret word party game, TV party game phones as controllers, game night on TV, who's the spy game TV | Commercial · medium (listicles) |
| `/fr/` | jeu d'ambiance télé / jeu de soirée TV | jeu du mot secret, jeu Android TV, téléphone comme manette, qui est l'intrus | Commercial · low-medium |
| `/ar/` | لعبة سهرات عالتلفزيون | مين الجاسوس، لعبة الكلمة السرّية، ألعاب جماعية، Android TV | Commercial · low |
| `/how-to-play/` | how to play Mish Ana | secret word game rules, mole and blank roles, impostor word game rules, scoring | Informational · low (brand) |
| `/fr/comment-jouer/` | règles Mish Ana | règles jeu du mot secret, rôle Taupe / Blanc, règles Mr White (secondary) | Informational · low |
| `/party-games-android-tv/` | best party games for Android TV / Google TV 2026 | games to play on TV with friends, TV games with phone as controller, Jackbox Android TV, AirConsole | Commercial investigation · medium-high |
| `/mr-white-game-on-tv/` | Mr White game | how to play Mr White, Mr White word game online, Mr White on TV | Informational · medium (dominated by app stores) |
| `/fr/jeu-mr-white-tele/` | jeu Mr White | règles Mr White, Mr White sur la télé, jeu Mr White en ligne | Informational · medium, little web content (opportunity) |
| `/games-like-spyfall-undercover/` | games like Spyfall | games like Undercover, Spyfall alternative, Mr White alternative, hidden role word games | Commercial investigation · medium |
| `/family-game-night-12-players/` | party games for 12 people | family game night ideas big group, games kids and grandparents, games for large groups | Informational · medium-high |
| `/lebanese-game-night/` | Lebanese game night | Arabic party games family, Lebanese party games, sahra games | Informational · low (niche, open) |
| `/ar/lebanese-game-night/` | ألعاب سهرات | لعبة الجاسوس، ألعاب جماعية للعيلة، سهرة لبنانية، ألعاب سهرة رمضان | Informational · low-medium |
| `/install-apps-google-tv-from-phone/` | install apps on Google TV from phone | install Android TV app from iPhone, TV not showing in Play Store install | Informational · medium (Google Help, tech blogs) |
| `/about/` | Mish Ana (entity) | مش أنا game, Mish Ana app | Navigational |

## 3. Lighthouse (mobile, local server with brotli, after this pass)

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| `/` | 100 | 100 | 100 | 100 | 1.8 s | 0.000 |
| `/fr/` | 100 | 100 | 100 | 100 | 1.8 s | 0.000 |
| `/ar/` | 100 | 100 | 100 | 100 | 1.8 s | 0.000 |
| `/how-to-play/` | 100 | 100 | 100 | 100 | 1.6 s | 0.000 |
| `/party-games-android-tv/` | 100 | 100 | 100 | 100 | 1.6 s | 0.000 |
| `/fr/jeu-mr-white-tele/` | 100 | 100 | 100 | 100 | 1.6 s | 0.000 |
| `/ar/lebanese-game-night/` | 100 | 100 | 100 | 100 | 1.6 s | 0.000 |

Lighthouse 13.5, mobile preset, headless Chrome, origin set to the placeholder. Before this pass: SEO 92 (placeholder canonical), FR home CLS 0.083 (late `cairo-bold` swap moved the hero media). Fix: `cairo-bold.woff2` is now preloaded with the other two weights (home and guides), CLS 0.000 everywhere.

Local server, no CDN. On Cloudflare (HTTP/2/3, edge cache) expect equal or better.

## 4. Things to know / decisions

- **Home CTA vs Play status.** The CRO landing keeps "Install on my TV" → Google Play as the hero CTA (unchanged). The launch drafts say the Play listing is not public yet. Deploy the site when Play is live, or tell the CRO owner; the guides already handle both states with `playStoreLive`.
- **Hero video end card** shows "Available on Google TV" (also flagged in X-THREAD.md). It's in the `VideoObject` too; replace the video file when the fixed render exists (same file names, no build change).
- **Auto language redirect** on `/` is client-side and only when the visitor has chosen a language before or their browser language is FR/AR (once per session). Crawlers (en-US) always get English at `/`, and every language has its own indexable URL, so this doesn't affect indexing.
- **Device facts changed since the CRO copy** (research 2026-10-04): the Chromecast with Google TV is discontinued (still supported), Philips 2026 TVs run Titan OS (older Philips models have Google TV), the Google TV Streamer is now $149.99 in the US. The guides say "older Philips models" and "no longer sold, still supported"; the CRO home strip still says "Sony, TCL, Hisense, Philips…" and "Chromecast with Google TV" (still true for existing devices, but consider "many Sony, TCL and Hisense TVs" in a future copy pass).
- **Privacy page** stays one bilingual document (EN/FR toggled with `?lang=fr`), canonical `/privacy/`.
- The guides avoid "Undercover", "Spyfall" etc. in brand positions; comparison pages name them nominatively with a disclaimer. "Mr. White" (no trademark registration for games was found, but this wasn't verified in TMview/INPI) is used in two titles as a descriptive genre term. "Undercover" is registered by Yanstar Studio (EU, class 28; international registration 2025) and appears only inside comparison text and the comparison page title, never as our brand. Spyfall (Hobby World), Jackbox, Codenames etc. are treated as protected. Owner check before launch: search "Mr White" and "Undercover" on https://www.tmdn.org/tmview/ and https://data.inpi.fr/. If a cease-and-desist ever arrives, retitle those two pages "The no-word-player game…" and keep the URLs.

## 5. Owner tasks, in order

1. **Buy the domain** (e.g. on Cloudflare Registrar, so DNS is already on Cloudflare).
2. **Set the origin**: `site.config.json` → `"origin": "https://www.<your-domain>"`. Optionally fill `contactEmail`, `ownerName`, `cfBeaconToken`.
3. **Custom domain** in `wrangler.jsonc`: uncomment `"routes": [{ "pattern": "www.<your-domain>", "custom_domain": true }]` and set `"workers_dev": false`. Add a redirect from the apex (`<your-domain>` → `https://www.<your-domain>`) with a Cloudflare Redirect Rule (Rules → Redirect Rules → "Redirect from root to WWW" template), so only one host serves the site.
4. **Build + deploy**: `node build.mjs` (check the ✓ line) then `npx wrangler deploy` (it rebuilds automatically).
5. **Check live**: `https://www.<domain>/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/fr/`, `/ar/`; run the [Rich Results Test](https://search.google.com/test/rich-results) and the [Schema validator](https://validator.schema.org/) on `/` and `/how-to-play/`.
6. **Google Search Console** – https://search.google.com/search-console
   - Add property → **Domain** → enter `<your-domain>` → copy the TXT record → Cloudflare DNS → add TXT on `@` → Verify (with Cloudflare, Search Console can also add it for you via "Verify with Cloudflare").
   - Sitemaps → submit `https://www.<domain>/sitemap.xml`.
   - URL inspection → request indexing for `/`, `/fr/`, `/ar/`, `/how-to-play/`, `/fr/jeu-mr-white-tele/`.
7. **Bing Webmaster Tools** – https://www.bing.com/webmasters
   - Sign in → "Import from Google Search Console" (fastest: imports the verified site and sitemap), or Add site → verify with the DNS CNAME/TXT they give → Sitemaps → submit the same URL.
   - Turn on IndexNow: in Cloudflare → Caching → Configuration → **Crawler Hints** (on). Bing feeds ChatGPT search and Copilot.
8. **Google Play**: Store settings → Website = the domain; Privacy policy URL = `https://www.<domain>/privacy/`.
9. **Play launch day**: `"playStoreLive": true`, add profile URLs to `"sameAs"`, rebuild, deploy.
10. **Monthly**: the prompt test and tracking table in GEO-PLAN.md §3; Search Console / Bing performance; refresh the roundup facts each quarter.

## 6. How to edit

- Home copy: EN in `index.html`, FR/AR in `assets/js/i18n.js` (same keys). Home `<title>`/description/OG: `content/home.json`.
- Guides: `content/<lang>/<slug>.html` → URL `/<slug>/` (EN) or `/<lang>/<slug>/`. A JSON front matter block on top (title, description, h1, crumb, dates, `group` links translations); FAQ in `<faq><faq-q>…</faq-q><faq-a>…</faq-a></faq>`; `<!--CTA-->` and `<!--ABOUT-->` mark where the generated boxes go. `{{BROWSER_URL}}` / `{{BROWSER_SHORT}}` are filled from the config.
- Entity facts and the definition sentence: `content/home.json` (feeds JSON-LD, /about/, llms.txt).
- Then `node build.mjs`.

## 7. Commits

| Commit | What |
|---|---|
| `b0572d8` | Build system (`site.config.json`, `build.mjs`), pre-rendered `/fr/` `/ar/`, language routing, About block, structured data, sitemap/robots/llms, wrangler → `dist/`, first guides |
| `416a37b` | Roundup, Spyfall/Undercover comparison, install guide, font preload (CLS fix), small UI fixes |
| (next) | GEO-PLAN.md and this report |

Not pushed, not deployed.
