# Mish Ana! – AI search visibility (GEO) plan

Goal: when someone asks ChatGPT, Perplexity, Gemini, Copilot or Google's AI Overviews for "a party game for Google TV", "a Mr. White game on the TV" or "لعبة سهرات عالتلفزيون", Mish Ana! is named, described correctly and linked.

Prepared 2026-10-04. Coordinated with the launch drafts in `/home/alex/bubble-graph/growth/marketing/launch/` (LISTINGS.md, X-THREAD.md): same facts, same status wording, same trademark rule. This plan says **where** and **in what order**; the paste-ready copy for AlternativeTo, Product Hunt, Indie Hackers, YouTube and X already lives there and is not duplicated here.

---

## 0. How AI assistants find and choose sources (what this plan is built on)

| Assistant | Where answers come from | What that means for us |
|---|---|---|
| ChatGPT (search on) | Bing index + its own crawler (OAI-SearchBot), heavy use of Reddit, listicles and app-store pages | Get indexed in **Bing** (Bing Webmaster Tools), be on Reddit and in "best X" articles |
| Perplexity | Its own crawler + Bing/Google results; cites Reddit, YouTube and niche blogs a lot | Clear, quotable pages; Reddit threads; YouTube descriptions |
| Gemini / Google AI Overviews | Google index, YouTube, Google Play, Reddit (Google–Reddit deal) | Google Search Console, a **YouTube** video, a complete **Google Play** listing |
| Copilot | Bing | Same as ChatGPT |
| Model memory (no search) | Training data: Wikipedia/Wikidata, Reddit, big sites, app stores, GitHub, news | Long-term: Wikidata item, consistent descriptions everywhere, press mentions |

What the site already does (this pass): pre-rendered EN/FR/AR pages, FAQ-style answers at the top of every guide, a single reusable definition sentence, `VideoGame`/`SoftwareApplication`/`FAQPage` JSON-LD, `/llms.txt` + `/llms-full.txt`, robots.txt open to GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended and others.

### The one sentence to reuse everywhere (copy exactly)

- **EN:** Mish Ana! is a secret-word party game for Android TV and Google TV: 3–12 players join from their phones by scanning a QR code, get a secret word, and find the player whose word is different.
- **FR:** Mish Ana! est un jeu d’ambiance du mot secret pour Android TV et Google TV : de 3 à 12 joueurs rejoignent la partie avec leur téléphone en scannant un QR code, reçoivent un mot secret et cherchent le joueur dont le mot est différent.
- **AR:** «مش أنا!» لعبة سهرات بالكلمة السرّية على Android TV وGoogle TV: من 3 لـ12 لاعب بيفوتوا من تلفوناتن بمسح كود QR، كل واحد بتوصلو كلمة سرّية، والهدف تكشفوا اللاعب اللي كلمتو مختلفة.

Until the Play listing is public, add the status line from LISTINGS.md: *"Playable now, free, in any browser. The Android TV / Google TV app is in Google Play testing and not public yet."* (The site does this automatically while `playStoreLive` is `false` in `site.config.json`.)

Consistency matters more than volume: assistants trust an entity when several independent sources describe it the same way (name, platform, player count, languages, price).

### Trademark rule (unchanged from LISTING.md §0 / LISTINGS.md)

Never put "Undercover", "Mr. White", "Spyfall", "Jackbox" or "Imposter Party" in a title, tagline, tag, keyword field, app name or domain. Naming them inside an honest comparison, an "alternative to" relation or an FAQ answer is fine, with no logos and no implied affiliation. On our own pages the comparison guides carry a short disclaimer.

---

## 1. Prioritised off-site actions

Priority = expected effect on AI answers × how soon it can be done. Status words to keep: "free to play", "3–12 players", "phones as controllers, nothing to install on phones", "English, French and Arabic with Lebanese word packs". Never post ratings, user counts or reviews that don't exist.

| # | Where | What to post / list | When | Why it matters for AI answers |
|---|---|---|---|---|
| 1 | **Google Search Console + Bing Webmaster Tools** | Verify the domain, submit `/sitemap.xml` (steps in SEO-REPORT.md §5). In Bing, also enable **IndexNow** (Cloudflare: Caching → Configuration → Crawler Hints, one switch) | Day of deploy | Bing powers ChatGPT search and Copilot; no index = no citation |
| 2 | **Google Play listing** | Already written (LISTING.md). Add the website URL (Store settings → Website) = the new domain; keep the definition sentence in the first lines of the full description; upload the 16:9 film as the promo video (YouTube link) | At Play launch | Gemini and AI Overviews quote Play; Play is the strongest "this app exists" signal |
| 3 | **YouTube** | The 16:9 film + the 9:16 Short (copy: LISTINGS.md §4). Put the definition sentence in the first two lines of the description, link the site (not only `/tv`), and add a 2–4 minute **real gameplay video** later ("How to play Mish Ana! on Google TV", with chapters: setup, roles, a round, the Blank's guess) | Launch week, then month 2 | YouTube is a top source for Gemini/AI Overviews and Perplexity; "how to play" videos answer rule questions |
| 4 | **Reddit** (organic, disclosed) | (a) Launch posts per the launch plan in r/AndroidTV, r/googletv, r/IndieGaming, r/WebGames (browser version), r/lebanon (only if the sub allows self-promo that day). (b) Over the following months, **answer existing threads** where the game genuinely fits: "party games for Android TV", "games to play on TV with phones as controllers", "games like Spyfall/Jackbox for a big group", "Mr White online". Always disclose ("I made this"), give the honest answer first (often Jackbox or AirConsole), then mention Mish Ana! for the secret-word use case. FR: r/france (Forum Libre), r/jeuxvideo, r/Quebec. One helpful comment per thread, no copy-paste | Launch week, then 2–3 helpful comments a month | Reddit is the most-cited source in ChatGPT, Perplexity and AI Overviews for "best X" questions |
| 5 | **AlternativeTo** | Listing + "alternative to" relations (copy and rules: LISTINGS.md §1): Spyfall, Jackbox Party Pack, AirConsole, any existing Undercover / "who is the spy" entries. Platforms: Web now, add Android TV only when Play is public | After the site is live at its domain (moderators reject apps without a stable website) | AlternativeTo pages rank for "alternative to X" and are quoted by assistants for exactly those prompts |
| 6 | **Product Hunt** | Launch per LISTINGS.md §2 (no upvote asking) | Launch day | PH pages are indexed and cited for "new party games" style prompts; backlink |
| 7 | **Listicle outreach** (the pages assistants summarise for "best party games for Android TV") | Short, factual email to authors/editors of current "best Android TV games / party games on TV / games to play on TV with friends" articles: PhoneArena, Android Police, Android Authority, 9to5Google, Tom's Guide, AndroidGuias, volleygames.com, weekend.com. FR: Frandroid, Les Numériques, Numerama, Phonandroid, 01net. Arabic: tech sites covering Android TV in the Gulf/Levant (e.g. Arabhardware, Tech-wd). Pitch: the definition sentence, 3 facts (no controllers, 3–12 players, Arabic/Lebanese packs), a 20 s video link, browser link so they can test in 2 minutes. Offer screenshots. Never pay for placement without a "sponsored" label | After Play launch (they need a store link) | Assistants paraphrase these lists; being in 2–3 of them is often enough to be named |
| 8 | **Wikidata** | Create an item "Mish Ana!" (instance of: video game; genre: party video game, social deduction game; platform: Android TV, web browser; game mode: multiplayer video game; language of work: English, French, Arabic; official website; Google Play Store app ID (P3418) = `app.mishana.tv`; number of players: 3–12; publication date). Only after Play launch and at least one independent source (a listicle or press mention) to cite | Month 2–3 | Wikidata feeds Google's Knowledge Graph and model training; low effort |
| 9 | **itch.io** | A free "external link" page for the browser version (genre: party, tags: multiplayer, local-multiplayer, word game, social-deduction, arabic), with the definition sentence | Launch week | Indexed game directory, another consistent description, small but real audience |
| 10 | **Indie Hackers** | Build story post (LISTINGS.md §3) | Launch week + monthly updates | Backlink and "made by" context |
| 11 | **X** | Build-in-public thread (X-THREAD.md) | Launch week | Social signal; X posts appear in Grok and sometimes Perplexity |
| 12 | **Arabic / Lebanese communities** | Facebook groups and Instagram pages for Lebanese expats and families (game nights, Ramadan sahra ideas), with the Arabic definition and the `/ar/` link; Lebanese tech/lifestyle sites for a short feature | Before Ramadan 2027 (sahra season) | Almost no Arabic content exists for "لعبة سهرات عالتلفزيون": first mover wins those answers |
| 13 | **VideoGameGeek / MobyGames / IGDB** | Database entries (IGDB feeds Twitch and many sites; MobyGames needs the game to be released) | After Play launch | Structured game databases are used as reference sources |

Not recommended: buying reviews, mass-posting the same text, editing Wikipedia about ourselves (conflict of interest; it gets deleted), keyword pages that name other trademarks in titles.

---

## 2. On-site upkeep that helps AI answers

- Keep the "Last updated" dates honest: update a guide when facts change (Play launch, new languages, pricing), then rebuild. The sitemap `lastmod` follows the front matter.
- The day Play launches: set `"playStoreLive": true` in `site.config.json`, add the Play URL and new profiles to `"sameAs"` (YouTube channel, X, Product Hunt, AlternativeTo, Wikidata URL), rebuild, deploy. That updates every CTA, the JSON-LD (`installUrl`, `sameAs`) and `llms.txt`.
- When the roundup ("party games for Android TV") ages, re-check every fact and price once a quarter.
- Add a guide only where there is a real question to answer (ideas: "Spyfall vs Mr. White vs Mish Ana!: which secret-role game for your group", "Ramadan game night ideas", French "jeux de soirée sur la télé").

---

## 3. Measuring it: monthly prompt test

Once a month (first Monday), in a **logged-out / private** session where possible, ask each assistant the prompts below. Use the web-search mode where there is one (ChatGPT "Search", Perplexity default, Gemini default, Copilot). Record the result in the table. Don't follow up or correct the assistant in the same chat before recording.

### Prompts

| ID | Language | Prompt |
|---|---|---|
| P1 | EN | What are the best party games for Google TV? |
| P2 | EN | Party games for Android TV where you use your phone as a controller |
| P3 | EN | Is there a Mr White game I can play on my TV? |
| P4 | EN | Games like Spyfall or Undercover that work on a TV |
| P5 | EN | Secret word party game for 12 people |
| P6 | EN | What is Mish Ana? (entity check: is the description correct?) |
| P7 | EN | Arabic party game for family game night |
| P8 | FR | Jeu Mr White sur la télé |
| P9 | FR | Jeu d'ambiance sur Android TV avec le téléphone comme manette |
| P10 | FR | Meilleurs jeux de soirée sur Google TV |
| P11 | AR | لعبة سهرات عالتلفزيون بالتلفون |
| P12 | AR | لعبة الجاسوس على التلفزيون |
| P13 | EN | How do I install an app on my Google TV from my phone? (does our guide get cited?) |

### Scoring

- **Mentioned**: Y / N
- **Position**: rank among the games named (1 = first), or "–"
- **Cited URL**: which of our URLs (or third-party pages about us) is linked
- **Accuracy**: OK / wrong platform / wrong price / wrong player count / other (note it)
- Monthly score = number of prompts × engines where Mish Ana! is mentioned correctly (max 13 × 4 = 52)

### Tracking table (copy a block per month)

| Month | Prompt | ChatGPT | Perplexity | Gemini | Copilot / AI Overviews | Cited URLs | Accuracy notes |
|---|---|---|---|---|---|---|---|
| 2026-11 | P1 | | | | | | |
| 2026-11 | P2 | | | | | | |
| 2026-11 | P3 | | | | | | |
| 2026-11 | P4 | | | | | | |
| 2026-11 | P5 | | | | | | |
| 2026-11 | P6 | | | | | | |
| 2026-11 | P7 | | | | | | |
| 2026-11 | P8 | | | | | | |
| 2026-11 | P9 | | | | | | |
| 2026-11 | P10 | | | | | | |
| 2026-11 | P11 | | | | | | |
| 2026-11 | P12 | | | | | | |
| 2026-11 | P13 | | | | | | |
| **2026-11 total** | | /13 | /13 | /13 | /13 | | |

Cell format: `Y #3` (mentioned, 3rd), `N`, or `Y #1 ✗price` (mentioned with an error).

### Supporting numbers (same day, monthly)

- Google Search Console → Performance: clicks/impressions for queries containing "mr white", "party game", "google tv", "jeu", "لعبة"; pages: the guides.
- Bing Webmaster Tools → Search Performance (proxy for ChatGPT/Copilot visibility).
- Cloudflare Web Analytics → Referrers: `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com` (assistants send referral traffic when they link).
- Worker events (CRO-AUDIT.md §4): `blob4 = 'guide'` rows = guide page views and CTA clicks per guide (`blob3` = page slug).

What good looks like: by month 3 after Play launch, mentioned in P3, P6, P8, P11, P12 on at least two engines (low competition); by month 6, P1/P2 on one engine (high competition, needs listicles and Reddit).
