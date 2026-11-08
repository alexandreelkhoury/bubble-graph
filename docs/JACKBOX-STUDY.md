# JACKBOX-STUDY — how Jackbox Games works, and what it means for JAMAA

> Consolidated study, 2026-11-08. It merges five research files (business, games, UX/sound/tech, legal/IP, market gap) written by research agents. The decisions we draw from it live in [BLUEPRINT.md](BLUEPRINT.md).
>
> **Tags.** **[V]** = verified in a primary or official source, or several consistent sources. **[S]** = secondary press. **[3P]** = a third-party tracker or aggregator; approximate. **[E]** = estimate or inference (ours or a third party's model). **[U]** = unverified or conflicting. **[K]** = researcher's prior knowledge of the games, widely documented but not re-checked this session.
>
> **Method limits.** In the research sandbox, WebFetch could not reach jackboxgames.com, support.jackboxgames.com, Steam, Wikipedia, USPTO, Google Patents and several press sites (DNS blocked). Facts from those pages come from search-engine extracts of the cited URLs, not full reads. **Re-open a link before quoting it to a third party.** None of this is legal advice.

---

## 0. Executive summary

1. **What Jackbox is.** A private, independent Chicago studio of about 85–90 people ([Built In Chicago](https://www.builtinchicago.org/company/jackbox-games), [LeadIQ](https://www.leadiq.com/c/jackbox-games/5a1d8f765400005100754cf2)) [E]. It descends from Jellyvision and *You Don't Know Jack* (1995) and rebranded as Jackbox Games in 2013 ([Jackbox blog](https://www.jackboxgames.com/our-earliest-memories-of-you-dont-know-jack), [CBR interview](https://www.cbr.com/interview-jackbox-harry-gottlieb-mike-bilder/)) [S]. More than 60 games ([Checkpoint Gaming, PAX Aus 2026](https://checkpointgaming.net/features/2026/10/a-party-pack-of-product-at-pax-aus-2026-interview-with-jackboxs-mike-bilder)) [S].
2. **The model.** One host buys. Up to 8 players, plus up to 10,000 audience members, join free from a phone browser with a room code ([Jackbox support](https://support.jackboxgames.com/hc/en-us/articles/15794756085015-How-many-players-can-join-each-game)) [V]. Every session is a free demo for up to 7 non-owners (more in the 9–10-player games).
3. **Pricing.** A new 5-game **Party Pack** every October at **$29.99**. They launched Pack 10 at **$34.99** ([Jackbox blog](https://www.jackboxgames.com/blog/the-jackbox-party-pack-10-is-now-available), [PP10 press kit](https://hello.jackboxgames.com/party-pack-10-press-kit/)) [V] and it lists at $29.99 today; the cut date (12 Aug 2024) comes only from a fan wiki ([Jackboxpedia PP10](https://jackbox.wiki/wiki/The_Jackbox_Party_Pack_10)) [S]. Single games cost **$9–15** and 3-game sets **$20**. The back catalogue sells at 40–60% off on every sale. The only subscription we found, the Amazon Luna channel at **$4.99/mo**, stopped selling on 10 Apr 2026; active subscriptions were cancelled at the end of the next billing cycle, and Luna access to purchased third-party games ended 10 Jun 2026 ([Engadget](https://www.engadget.com/gaming/amazon-luna-ends-support-for-third-party-subscriptions-and-game-purchases-171329996.html), [Slashdot](https://games.slashdot.org/story/26/04/11/2130243/amazon-luna-ends-its-support-for-purchased-games-and-third-party-subscriptions)) [S].
4. **Scale.** 100M players in 2019 and about 200M by late 2020 ([Bloomberg](https://www.bloomberg.com/news/articles/2020-10-20/jackbox-games-benefits-from-retro-style-party-games-in-pandemic)) [S]. Revenue is private; our working figure is **about $25M/yr net, ±50%** [E].
5. **Where they are heading.** TV-native and free-to-start. Three games are free inside Netflix since Apr 2026 ([Jackbox blog](https://www.jackboxgames.com/blog/play-the-jackbox-party-essentials-on-netflix)) [V]. A free, ad-supported smart-TV app with a later subscription is announced but late and US-first ([Cloud Dosage](https://clouddosage.com/jackbox-says-its-smart-tv-cloud-gaming-service-is-still-coming-in-2026/)) [S]. **That is the JAMAA model, aimed at the US.**
6. **The four pillars.** Quiplash, Fibbage, Drawful and Trivia Murder Party. The best-reviewed packs (PP3 and PP7 at 96% on Steam) contain one, and PP10 (no pillar) sits at about 63%. **But PP11 has no pillar and still scores about 93%** ([Raijin snapshot, Jul 2026](https://raijin.gg/app/3364070/The_Jackbox_Party_Pack_11)), so a pillar helps but is not required; PP10's score also carries its $34.99 launch-price backlash [V data, E reading].
7. **Design DNA.** The phone is private input and the TV is a shared stage. Every phase has a timer. There is a voiced, snarky, never-seen host. The structure is 2 rounds plus a final at ×1/×2/×3. Authors stay anonymous until a staged reveal. Stuck players get an escape button. Funny losers get side points ("likes") [V/K].
8. **The gaps.** **No Arabic, no RTL, no Middle East content** anywhere ([Jackbox: languages](https://www.jackboxgames.com/blog/how-were-bringing-jackbox-games-to-countries-around-the-world)) [V]. Netflix–Jackbox lists no MENA country; the help page says "a selection of countries, including…", so the list is not formally exhaustive ([Netflix Help](https://help.netflix.com/en/node/587850340349030), [Netflix Games help](https://games-netflix.helpshift.com/hc/en/57-the-jackbox-party-essentials/faq/1865-where-can-i-play-the-jackbox-party-essentials-via-netflix-games/)) [S]. Jackbox's own Shopify store sells only to the US, UK, EU, Canada and Brazil ([checkout](https://checkout.jackboxgames.com/products/the-jackbox-party-pack-10)) [3P extract]. Gulf PlayStation stores list PP10 at $33.99 against $29.99 in the US, about 13% more ([PlatPrices](https://platprices.com/intelligence/game/116035-the-jackbox-party-pack-10)) [3P, snapshot date unknown]. Android TV support is patchy. Arabic party apps are single-phone, small and fragmented.
9. **Legal line.** Mechanics, rules, genre conventions and "phone as controller + room code" are free to reuse. Names (FIBBAGE, QUIPLASH and JACKBOX GAMES are registered US marks), every prompt and host line, characters, art, music, SFX, code and overall look-and-feel are not. Courts have let a clone through when only the mechanics match and the theme and art are different (DaVinci v. ZiKo, a district-court ruling: persuasive, not binding). They stop it when the overall look is copied (Tetris v. Xio).

---

## 1. Business and pricing

### 1.1 Company snapshot

| Item | Fact | Tag | Source |
|---|---|---|---|
| Lineage | Learn Television (c.1989), then Jellyvision (*YDKJ*, 1995). Jellyvision Games shut down in 2001 and was revived in 2008 under Mike Bilder. Rebranded **Jackbox Games** in Jun 2013 | S | [Jackbox blog](https://www.jackboxgames.com/our-earliest-memories-of-you-dont-know-jack), [Wikipedia (pointer)](https://en.wikipedia.org/wiki/Jackbox_Games) |
| Founder | Harry Nathan Gottlieb | S | [CBR](https://www.cbr.com/interview-jackbox-harry-gottlieb-mike-bilder/) |
| Leadership | Mike Bilder (CEO), Allard Laban (CCO), Andy Kniaz (VP International & BD) | V/S | [Jackbox blog: PAX Australia](https://www.jackboxgames.com/blog/jackbox-games-is-going-to-pax-australia), [Built In Chicago](https://www.builtinchicago.org/company/jackbox-games) |
| Headcount | About 40 (2020), about 84–90 (2025–26) | E | [LeadIQ](https://www.leadiq.com/c/jackbox-games/5a1d8f765400005100754cf2), [GamesBeat 2026](https://gamesbeat.com/publishing-streaming-and-standalone-games-inside-jackbox-games-strategic-shift-in-2026/) |
| Ownership | Private. One listed investor (Jackson Square Ventures), round type conflicting | U | [Tracxn](https://tracxn.com/d/companies/jackbox-games/__k5F6nwv8i83v5q0naWe88JKnpItnWuMoUul4l-q_pBc/funding-and-investors), [CB Insights](https://www.cbinsights.com/company/jackbox-games) |
| Layoffs | None since about 2014; growth slowed after the pandemic | S | [GamesBeat](https://gamesbeat.com/how-two-veteran-studios-have-avoided-layoffs-sustainability-lessons-for-games/), [Game Developer podcast](https://www.gamedeveloper.com/business/how-jackbox-games-navigated-the-post-pandemic-sales-slump-ft-mike-bilder) |

### 1.2 Scale and revenue

- **Players.** 100M (2019), 110M in the first three months of lockdown, "on track" for 200M by the end of 2020. Pandemic sales rose "as much as 1,000%" ([Bloomberg](https://www.bloomberg.com/news/articles/2020-10-20/jackbox-games-benefits-from-retro-style-party-games-in-pandemic), [CNN](https://edition.cnn.com/2020/10/17/tech/jackbox-games-party-pack-7)) [S]. "Players" counts everyone who joined a room; only hosts pay.
- **After the pandemic**, sales fell. Jackbox held headcount steady and diversified into publishing, standalones, streaming and board games ([Game Developer](https://www.gamedeveloper.com/business/how-jackbox-games-navigated-the-post-pandemic-sales-slump-ft-mike-bilder)) [S]. The Naughty Pack underperformed (same source) [S].
- **Copies.** No official total. SteamSpy estimates about 3.7M copies owned across 25 Steam titles ([SteamSpy](https://steamspy.com/dev/Jackbox+Games,+Inc.)) [3P]. PP7's all-time concurrent peak on Steam is 10,435 ([SteamCharts](https://steamcharts.com/app/1211630)) [3P].

**Revenue estimates (the company is private; all of these are models)** [E]

| Source | Annual revenue |
|---|---|
| [Kona Equity](https://www.konaequity.com/company/jackbox-games-inc-4391704334/) | $7.8M |
| [Adapt.io](https://www.adapt.io/company/jackbox-games-1) | $1–10M |
| [Owler](https://www.owler.com/company/jackboxgames) | $5–25M |
| [Growjo](https://growjo.com/company/Jackbox_Games) | $18.4M |
| [LeadIQ](https://leadiq.com/c/jackbox-games/5a1d8f765400005100754cf2) | $25–50M |
| [Seamless.ai](https://seamless.ai/b/jackbox-games-186230) | $50–100M (outlier) |
| [VG Insights](https://vginsights.com/publisher/23216/jackbox-games-inc) (Steam only, lifetime gross) | about $97.9M |

**Our triangulation [E].** Steam is one of about 8 storefronts. About $98M lifetime gross on Steam suggests about $250–400M lifetime across all stores. At about 85 staff and $250–400k per head, steady state is about **$20–35M/yr**, with a 2020–21 peak 2–3× that. **Working figure: about $25M/yr, ±50%.**

### 1.3 Party Pack prices (USD MSRP; console, PC and Apple at price parity)

| Pack | Release | Launch price | List today | Source |
|---|---|---|---|---|
| 1 | Nov 2014 | $24.99 | $24.99 | [Steam](https://store.steampowered.com/app/331670/The_Jackbox_Party_Pack/) |
| 2–4 | Oct 2015–17 | $24.99 [U] | $24.99 | [Jackbox shop](https://www.jackboxgames.com/shop) |
| 5 | Oct 2018 | $29.99 (pre-order $24.99) | $29.99 | [Jackboxpedia PP5](https://jackbox.wiki/wiki/The_Jackbox_Party_Pack_5) |
| 6 | Oct 2019 | $29.99 | $29.99 | [PlayStation](https://www.playstation.com/en-us/games/the-jackbox-party-pack-6/) |
| 7–9 | Oct 2020–22 | $29.99 [U] | $29.99 | [Jackbox packs](https://www.jackboxgames.com/games/packs) |
| 10 | 19 Oct 2023 | **$34.99** [V], cut to $29.99 on 2024-08-12 [S, fan wiki only] | $29.99 | [Jackbox blog](https://www.jackboxgames.com/blog/the-jackbox-party-pack-10-is-now-available), [press kit](https://hello.jackboxgames.com/party-pack-10-press-kit/), [Jackboxpedia PP10](https://jackbox.wiki/wiki/The_Jackbox_Party_Pack_10) |
| 11 | Oct 2025 | $29.99 | $29.99 | [Steam](https://store.steampowered.com/app/3364070/The_Jackbox_Party_Pack_11/), [Nintendo](https://www.nintendo.com/us/store/products/the-jackbox-party-pack-11-switch/) |
| 12 | Mid-Oct 2026 (sources say 14 or 15 Oct) | $29.99 [S] | $29.99 | [Steam](https://store.steampowered.com/app/4199960/The_Jackbox_Party_Pack_12/), [Jackbox blog](https://www.jackboxgames.com/blog/here-are-all-5-games-in-the-jackbox-party-pack-12) |

**Regional prices.** PP11 is €29.99 in the EU [S]. PP10 is listed at **$33.99 in the UAE and Saudi PlayStation stores**, about 53% above the cheapest region ([PlatPrices](https://platprices.com/intelligence/game/116035-the-jackbox-party-pack-10)) [3P]. Against the US list price ($29.99) that is about **+13%**, not +53%; the snapshot date is unknown, and if it predates the US cut, the Gulf price may simply be a stale launch price. PP10's press kit launch prices: $34.99 / €34.99 / £29.50 / AU$59.50 ([press kit](https://hello.jackboxgames.com/party-pack-10-press-kit/)) [V]. MENA pays a modest premium and has no direct-store option [E].

### 1.4 Standalones and small packs (the trend: unbundling)

| Title | Year | Price | Source |
|---|---|---|---|
| Quiplash, Fibbage XL, Drawful 2, Quiplash 2 InterLASHional | 2015–20 | $9.99 each | [Jackbox checkout](https://checkout.jackboxgames.com/collections/staging-standalone-titles) |
| YDKJ Classic | — | $19.99 | same |
| Jackbox Naughty Pack (3 adult games) | Sep 2024 | $19.99 list ($21.69 at launch [U]) | [Jackbox blog](https://jackboxgames.com/blog/the-jackbox-naughty-pack-is-now-available-on-major-gaming-platforms), [weekend.com](https://www.weekend.com/post/jackbox-price) |
| Jackbox Survey Scramble (Family Feud-like), **also on Google Play** | Oct 2024 | $9.99 | [Nintendo](https://www.nintendo.com/us/store/products/the-jackbox-survey-scramble-switch/), [Google Play](https://play.google.com/store/apps/details?id=com.jackboxgames.tjss&hl=en_US) |
| Jackbox Party Starter (Quiplash 3, TMP2, Tee K.O.) | 2024 | $19.99 | [weekend.com](https://www.weekend.com/post/jackbox-price), [App Store](https://apps.apple.com/app/id6501958739) |
| Trivia Murder Party 3 (first Unreal title, Steam Early Access first) | Sep 2026 | $14.99 | [Variety](https://variety.com/2026/gaming/news/jackbox-party-pack-12-trivia-murder-party-3-release-dates-1236838174/) |
| Fakin' It XL | Nov 2026 | $8.99 [S] | [weekend.com](https://www.weekend.com/post/jackbox-price) |

### 1.5 Discounts, bundles, free hooks, subscriptions

| Lever | Detail | Source |
|---|---|---|
| Bundles | Quintpack 2.0 (PP6–10) about $79.51; Backpack Bundle (TMP3 + PP12) $44.98; Decade Bundle (all 50 games of PP1–10); Big Bang Bundle | [Steam bundle 38172](https://store.steampowered.com/bundle/38172/), [Steam bundle 84740](https://store.steampowered.com/bundle/84740/), [Microsoft Store](https://www.microsoft.com/ig-ng/p/the-jackbox-decade-bundle/9nr0078r07sm) |
| Sale cadence | Every Steam seasonal sale plus US holidays. Back catalogue 40–60% off; newest pack about 20% off within 6 months (Spring 2026: PP11 $23.99, PP9/10 $17.99) | [Jackbox Spring Sale 2026](https://www-origin-c791c71a.jackboxgames.com/blog/enjoy-up-to-60-off-in-the-jackbox-spring-steam-sale), [Memorial Day guide](https://jackboxgames.com/blog/jackbox-games-memorial-day-weekend-sale-guide) |
| Effective price | Probably $15–20 per pack on average | E |
| Direct store | checkout.jackboxgames.com (Shopify) sells Steam keys directly | [checkout](https://checkout.jackboxgames.com/) |
| Free launcher | **Jackbox Megapicker** (Jul 2024): a free Steam library of owned packs that sells the missing ones | [Jackbox blog](https://jackboxgames.com/blog/introducing-the-jackbox-megapicker), [Steam](https://store.steampowered.com/app/2828500/The_Jackbox_Megapicker) |
| Free hook | **Drawful 2** in two *time-limited* free-to-keep giveaways (about 3 weeks in spring 2020, ending 11 Apr; and Jul–28 Aug 2024 with the Megapicker launch). It is **not** permanently free; it normally sells for about $10 | [Jackbox blog](https://jackboxgames.com/were-giving-away-drawful-2-for-free-for-three-weeks), [PC Gamer](https://www.pcgamer.com/drawful-2-a-party-game-about-terrible-art-is-free-to-keep-on-steam) |
| Subscription | **Amazon Luna channel** $4.99/mo US, £3.99 UK, all Party Packs plus Drawful 2. Sales stopped 10 Apr 2026; active subscriptions auto-cancelled at the end of the next billing cycle; 10 Jun 2026 is when Luna access to purchased third-party games ended (sources differ slightly on dates) | [Jackbox blog](https://www.jackboxgames.com/blog/jackbox-games-titles-are-now-available-on-amazon-luna), [Engadget](https://www.engadget.com/gaming/amazon-luna-ends-support-for-third-party-subscriptions-and-game-purchases-171329996.html) |
| Licensing | **Netflix "Jackbox Party Essentials"** (Apr 2026): Fibbage 4, Quiplash 3, Drawful 2, free to members, QR join on the TV. Regions listed ("a selection of countries, including"): US, CA, UK, ES, MX, FR, IT, PL, NL, SE, BE, CH, AT, IE, FI, DE, ZA, AU, NZ. **No MENA country listed** | [Jackbox blog](https://www.jackboxgames.com/blog/play-the-jackbox-party-essentials-on-netflix), [Netflix Help](https://help.netflix.com/en/node/587850340349030) |
| Own TV app | **Free ad-supported smart-TV app** on AWS GameLift Streams, then a full-catalogue subscription (no price). Announced Mar 2025, delayed to "US before end of 2026"; an Amazon Appstore listing shows "5 free ad-supported games" | [Jackbox blog](https://www.jackboxgames.com/blog/jackbox-coming-to-your-smart-tv-for-free), [VGC](https://www.videogameschronicle.com/news/jackboxs-party-game-library-is-coming-to-your-living-room-via-a-new-smart-tv-app/), [Cloud Dosage](https://clouddosage.com/jackbox-says-its-smart-tv-cloud-gaming-service-is-still-coming-in-2026/), [Amazon Appstore](https://www.amazon.com/hz/mas/detail?ie=UTF8&ASIN=B0FN546TST&asin=B0FN546TST) |
| Game Pass / Arcade / PS Plus | No current deal found | U |

### 1.6 Distribution

- Steam, Epic, PS4/PS5, Xbox, Switch (and Switch 2), Apple TV, iPad, Mac, Amazon Fire TV, Netflix ([Everywhere you can play Jackbox](https://www.jackboxgames.com/blog/everywhere-you-can-play-jackbox)) [V].
- **Android/Google TV is patchy.** It returned with PP10 after a multi-year gap ([9to5Google](https://9to5google.com/2023/11/17/jackbox-party-pack-10-google-android-tv/)). Jackbox says some smart TVs cannot see the app; there is no Roku or ChromeOS support ([Jackbox streaming FAQ](https://www.jackboxgames.com/streaming)) [V].
- **No phone host app.** Phones are controllers only, via jackbox.tv [V].

### 1.7 Streamers: the marketing engine

- Audience up to 10,000; extended timers for stream delay; hidden room codes; "require Twitch" login; family filter; profanity filter; manual censoring ([PP8 features](https://www.jackboxgames.com/streaming-moderation-accessibility-features-jackbox-party-pack-eight/), [stream safety](https://www.jackboxgames.com/how-to-keep-your-stream-safe-while-playing-jackbox-games/)) [V].
- **Jackbox Audience Kit** Twitch extension (Dec 2020): viewers play inside Twitch and the room code updates itself ([Jackbox](https://www.jackboxgames.com/the-jackbox-audience-kit-twitch-extension-is-now-available/), [GameSpot](https://gamespot.com/articles/the-jackbox-audience-kit-for-twitch-makes-it-easier-for-audiences-to-join-in/1100-6485516/)) [V].
- Streaming and monetized streams are allowed; in-house music is cleared for streams of their games ([content guidelines](https://www.jackboxgames.com/jackbox-games-content-guidelines-for-streaming-platforms/)) [V]. There is no revenue share: streams are free marketing.

### 1.8 Diversification

- **Board and card games**, licensed to Wilder Toys: Fakin' It card game (2024, $19.99) and a Fibbage board game (Jul 2026, $19.99) ([Target](https://www.target.com/p/wilder-games-jackbox-fakin-39-it-card-game/-/A-93672307), [Jackbox blog](https://www.jackboxgames.com/blog/no-lie-fibbage-is-out-now-as-a-physical-board-game)) [V]. Bilder calls the goal "a digital Mattel" ([Poptopic](https://poptopic.com.au/entertainment/games/jackbox-interview-jackbox-games-takes-mattel/)) [S].
- **Publishing label** (Mar 2026), first title *My Arms Are Longer Now* ([Game Developer](https://www.gamedeveloper.com/business/jackbox-games-jumps-feet-first-into-publishing-biz)) [S].
- **Education and corporate:** no formal product. College events are handled by email with custom key discounts ([college page](https://www.jackboxgames.com/bring-jackbox-games-to-your-college-or-university)) [V]. **This niche is open.**
- **Merch:** buy your Tee K.O. shirt, or your *We Forgot a Card* card in real life (PP12) [K/V].

### 1.9 What the revenue model teaches

1. **One payer, many players.** Spread is viral, but revenue per player is tiny. Price for the *host household*.
2. **An annual tentpole plus a deep back catalogue.** The catalogue is the asset, not the hit. The October tentpole lands in Q4 gifting season.
3. **Price ceiling of about $30 per 5 games (about $6 per game).** The $34.99 test failed. The subscription reference is **$4.99/mo** (Luna).
4. **Entry products keep getting cheaper:** $9–15 singles, $20 three-packs, free Drawful 2, the free Netflix sampler. The industry is moving to **free to start, pay for the catalogue**.
5. **Distribution follows the TV**, and Jackbox missed the Android-TV-first world for years.
6. **Streamers are the marketing budget.**
7. **Stay small and diversify** through licensing and publishing.

---

## 2. Full game catalog

Player counts come from the [official player-count guide](https://www.jackboxgames.com/blog/the-ultimate-guide-to-player-counts-in-each-jackbox-game) and the [support table](https://support.jackboxgames.com/hc/en-us/articles/15794756085015-How-many-players-can-join-each-game) where search extracts showed them [V]. Mechanic summaries without a citation are [K]. Inputs: text = type, draw = phone canvas, pick = tap, gesture/tap = real-time.

| Pack (year) | Game | Players | Core loop | Inputs | Steam rating of the pack |
|---|---|---|---|---|---|
| PP1 (2014) | You Don't Know Jack 2015 | 1–4 | Irreverent trivia, speed points, "Screw" a rival, Jack Attack final | pick | Very Positive 90% |
| | Fibbage XL | 2–8 | Lie to fill a blank in a true fact; find the truth | text, pick | |
| | Drawful | 3–8 | Draw a prompt; others write fake titles; find the real one | draw, text, pick | |
| | Word Spud | 2–8 | Word chain, up/down vote (weakest) | text, pick | |
| | Lie Swatter | 1–100 | Fast true/false | pick | |
| PP2 (2015) | Fibbage 2 | 2–8 | Adds the **deFIBrillator** (one lie + truth left) ([Jackbox](https://jackboxgames.com/fibbage-two)) | text, pick | Overwhelmingly Positive |
| | Earwax | 3–8 | Pick 2 sound effects for a prompt; rotating judge | pick | |
| | Bidiots | 3–6 | Draw, then auction drawings with hidden values | draw, pick | |
| | Quiplash XL | 3–8 | Head-to-head funny answers; the room votes | text, pick | |
| | Bomb Corp. | 1–4 | Co-op bomb defusal | pick | |
| **PP3 (2016)** | Quiplash 2 | 3–8 | Quiplash + Last Lash variants; prompt editor | text, pick | **Overwhelmingly Positive 96%** |
| | Trivia Murder Party | 1–8 | Trivia in a killer's hotel; wrong = deadly minigame; ghosts race to escape | pick, draw, text | |
| | Guesspionage | 3–8 | Guess poll percentages; others bet higher/lower | pick | |
| | Tee K.O. | 3–8 | Draw + slogans, combine into T-shirts, bracket vote; real shirts | draw, text, pick | |
| | Fakin' It | 3–6 | One faker doesn't know the task; played with hands and faces (cousin of Mish Ana!) | pick | |
| PP4 (2017) | Fibbage 3 + Enough About You | 2–8 | Fibbage; EAY mode bluffs about the players ([Jackbox blog](https://www.jackboxgames.com/blog/introducing-fibbage-enough-about-you)) | text, pick | n/a |
| | Survive the Internet | 3–8 | Your answer is shown out of context as a comment on another post | text, pick | |
| | Monster Seeking Monster | 3–7 | Texting/dating with secret powers | text, pick | |
| | Bracketeering | 3–16 | Answers fight in a bracket; bet on winners | text, pick | |
| | Civic Doodle | 3–8 | Improve a shared mural in turns | draw, pick | |
| PP5 (2018) | YDKJ Full Stream | 1–8 | YDKJ built for streaming | pick | Very Positive 93% |
| | Split the Room | 3–8 | Finish a dilemma so the room splits 50/50 | text, pick | |
| | Mad Verse City | 3–8 | Rap lines read by text-to-speech robots | text, pick | |
| | Patently Stupid | 3–8 | Draw an invention, pitch it aloud, fund it | draw, text, pick | |
| | Zeeple Dome | 1–6 | Co-op physics slingshot | gesture | |
| PP6 (2019) | Trivia Murder Party 2 | 1–8 | TMP with more minigames; first US-Centric filter. "Probably THE most played" per a Steam guide (anecdotal, [Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2523215537)) | pick, draw, text | Overwhelmingly Positive 95% |
| | Role Models | 3–6 | Assign friends to roles | pick | |
| | Joke Boat | 3–8 | Write and perform jokes | text, pick | |
| | Dictionarium | 3–8 | Define made-up words, then synonyms, then usage | text, pick | |
| | Push The Button | 4–10 | Humans vs hidden aliens with a slightly different prompt ([Jackbox](https://jackboxgames.com/announcing-game-three-in-the-jackbox-party-pack-6-push-the-button)) | draw, text, pick | |
| **PP7 (2020)** | Quiplash 3 | 3–8 | Quiplash; Thriplash final (×3) | text, pick | **Overwhelmingly Positive 96%** |
| | The Devils and the Details | 3–8 | Co-op chores under pressure; talk to each other | pick | |
| | Champ'd Up | 3–8 | Draw champions and challengers; battle votes | draw, text, pick | |
| | Talking Points | 3–8 | Improvised speech; a helper picks the slides | pick | |
| | Blather 'Round | 2–6 | Describe pop culture with a restricted phrase builder (no free typing) | pick | |
| PP8 (2021) | Drawful Animate | 3–10 | Drawful with 2-frame animations | draw, text, pick | Very Positive 90% |
| | The Wheel of Enormous Proportions | 2–8 | Trivia earns wheel slices; big final spin | pick, text | |
| | Job Job | 3–10 | Answer interviews with words cut from others' answers | text, pick | |
| | The Poll Mine | 2–10 | Teams rank how the room answered a poll | pick | |
| | Weapons Drawn | 4–8 | Murder mystery; hide your letters in drawings | draw, pick | |
| PP9 (2022) | Fibbage 4 | 2–8 | Video questions, two-question final, fan questions, audience score ([Xbox Wire](https://news.xbox.com/en-us/2022/10/21/learn-more-about-the-brand-new-fibbage-video-questions-in-the-jackbox-party-pack-9/)) | text, pick | Very Positive 84% |
| | Roomerang | 4–9 | Reality-show elimination votes | text, pick | |
| | Junktopia | 3–8 | Backstory for junk, then appraise it | text, pick | |
| | Nonsensory | 3–8 | Draw/write on a scale; others guess the position | draw, text, pick | |
| | Quixort | 1–10 | Teams sort falling answers (real-time) | gesture | |
| PP10 (2023) | Tee K.O. 2 | 3–8 | Tee K.O. | draw, text, pick | **Mixed, about 63%** |
| | FixyText | 3–8 | Write a text reply together, live | text | |
| | Hypnotorious | 4–8 | Hidden-identity deduction | pick | |
| | Timejinx | 1–8 | Guess the year; scored on distance | pick | |
| | Dodo Re Mi | 1–9 | Rhythm game on phones | tap | |
| PP11 (2025) | Suspectives | 4–8 | Social deduction from your own survey answers | — | Very Positive 93% |
| | Doominate | 3–8 | Head-to-head: ruin a lovely situation | — | |
| | Legends of Trivia | 1–6 | Co-op team trivia | — | |
| | Cookie Haus | 3–8 | Decorate cookies (drawing) | — | |
| | Hear Say | 2–8 | Record sounds and lines to dub clips | — | |
| PP12 (2026) | We Forgot a Card | n/a | Write greeting cards for odd occasions; buy them for real | — | Mostly Positive 76% (84 reviews) |
| | MegaPals | n/a | List associated words against the clock | — | |
| | Debate and Switch | n/a | Town-hall debate on absurd hypotheticals (plagiarism claim, §6.3) | — | |
| | Idol Factions | n/a | Two teams sort answers into categories | — | |
| | Hyperface | n/a | Warp selfies or photos to answer prompts | — | |

PP11 rows: [Jackbox PP11](https://www.jackboxgames.com/games/packs/the-jackbox-party-pack-11), [GameSpew](https://www.gamespew.com/2025/08/all-five-games-in-the-jackbox-party-pack-11-have-now-been-revealed/). PP12 rows: [PlayStation Blog](https://blog.playstation.com/2026/06/25/introducing-the-five-new-games-of-jackbox-party-pack-12/). Steam ratings: [PP1](https://store.steampowered.com/app/331670/The_Jackbox_Party_Pack/), [PP3](https://store.steampowered.com/app/434170), [PP7](https://store.steampowered.com/app/1211630/The_Jackbox_Party_Pack_7/), [PP10](https://store.steampowered.com/app/2216830/The_Jackbox_Party_Pack_10/), [PP12](https://store.steampowered.com/app/4199960/The_Jackbox_Party_Pack_12/) (snapshots from different dates, approximate).

**Outside the packs:** Fibbage (2014), Quiplash (2015), Drawful 2 (2016), Quiplash 2 InterLASHional (2020, the first localized game), Megapicker (2024), Naughty Pack (2024), Survey Scramble (2024, 2–10 players), Party Starter (2024, later a pt-BR patch with region-specific content: [Jackbox blog](https://www.jackboxgames.com/blog/jackbox-games-announces-a-free-patch-update-for-the-jackbox-party-starter-introducing-brazilian-portuguese-localization-and-region-specific-content)), TMP3 (2026), Fakin' It XL (2026).

**Production rhythm.** About 6 months of active production per pack. A backlog of about 50 concepts, 5 picked per pack ([GDC 2021](https://gdcvault.com/play/1027202/contactUs), [Built In](https://builtin.com/articles/jackbox-games-design-party-pack)) [V]. Official game length is 15–20 minutes ([jackboxgames.com/party-pack](https://jackboxgames.com/party-pack)) [V].

**Popularity signal.** Jackbox's own pick of "essentials" for Netflix is Fibbage 4, Quiplash 3 and Drawful 2. Party Starter is Quiplash 3, TMP2 and Tee K.O. Together with the Steam ratings, this points to **four pillars: Quiplash, Fibbage, Drawful, Trivia Murder Party** [E]. Two packs without a pillar review worse (PP10 about 63%, PP12 76% on only 84 early reviews), **but PP11, also pillar-free, scores about 93%**, so the correlation is weak: pillars help, a strong new social-deduction game (Suspectives) can carry a pack too [V data, E reading]. Play is seasonal, peaking at Christmas and New Year ([SteamCharts](https://steamcharts.com/app/1211630)) [3P].

---

## 3. Design patterns

### 3.1 Fibbage (the reference for JAMAA Bluff)

**Loop [K unless cited].**
1. A rotating player picks one of about 5 categories.
2. The TV shows an obscure true fact with a blank, read by host Cookie Masterson ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Main/DevelopersForesight)).
3. Everyone types a plausible lie against a timer.
   - **"Too close to the truth"** rejects the real answer and authored synonyms ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Main/DevelopersForesight), [PSNProfiles PP9 guide](https://psnprofiles.com/guide/22829-the-jackbox-party-pack-9-trophy-guide)) [V]. Fibbage 4 relaxed it.
   - **Lie For Me** offers pre-written lies to stuck players ([Fibbage 3](https://www.jackboxgames.com/fibbage-three)) [V]; reportedly half points [V, weak].
   - **House lies** pad the list in small groups.
4. All lies plus the truth appear shuffled and anonymous; you cannot pick your own.
5. **Likes** on funny answers; in Fibbage 4 they give single-digit points ([Fibbage 4](https://www.jackboxgames.com/games/fibbage-4)) [V].
6. **Reveal:** lies one at a time with who fell for them and whose lie it was, the truth last with a fanfare. The comedy payoff, about 30–60 s per question [E].

**Scoring** ([Fibbage series wiki](https://jackboxgames.fandom.com/wiki/Fibbage_(series)), fan source; consistent with game reviews) [S, fan]. Versions differ in exact values; Lie For Me halves the lying points:

| Round | Finding the truth | Per player fooled |
|---|---|---|
| Round 1 | 1,000 | 500 |
| Round 2 | 2,000 | 1,000 |
| Final Fibbage | 3,000 | 1,500 |

**Versions.** Fibbage 2 added the deFIBrillator. Fibbage 3 added **Enough About You**: players answer personal questions truthfully, then the others bluff what that player would say, with a "Reputation Bonus" for the subject; the final is "one truth and one lie about yourself" ([Jackbox blog](https://www.jackboxgames.com/blog/introducing-fibbage-enough-about-you), [Jackboxpedia](https://jackbox.wiki/wiki/Fibbage_3)) [V]. Fibbage 4 added video questions, a two-question final (one lie for both), fan questions and an **audience score** ([Xbox Wire](https://news.xbox.com/en-us/2022/10/21/learn-more-about-the-brand-new-fibbage-video-questions-in-the-jackbox-party-pack-9/)) [V].

**Jackbox has no "no truth" final.** The closest are Fibbage 4's two-question final and EAY's truth-plus-lie final.

### 3.2 Quiplash

- **Write:** each player gets 2 prompts, each prompt goes to exactly 2 players ([Built In](https://builtin.com/articles/jackbox-games-design-party-pack), [Quiplash wiki](https://jackboxgames.fandom.com/wiki/Quiplash_(series))) [V].
- **Vote:** one matchup at a time, no names; everyone else, audience included, votes.
- **Score:** proportional to vote share. Quiplash 3 gives up to 1,000 / 2,000, then 6,000 in Thriplash ([Jackboxpedia](https://jackbox.wiki/wiki/Quiplash_3)) [V, fan].
- **Bonuses:** QUIPLASH! for sweeping the vote; Super Quiplash when more than 90% of the audience agrees.
- **Jinx:** identical answers score 0 ([Netflix Tudum](https://www.netflix.com/tudum/articles/jackbox-games-party-essentials-news)) [V].
- **Safety Quip:** a canned answer for half points.
- **Odd counts:** an AI player (Schmitty) fills the gap.
- **Finals:** Last Lash (everyone answers one prompt, 3 votes each), then Acro/Comic/Word Lash, then Thriplash (3 answers, ×3, no safety).
- **Why it works [E]:** short, low-stakes, anonymous writing; guaranteed screen time; obvious head-to-head comparison; no knowledge needed, so newcomers can beat veterans.

### 3.3 Sixteen recurring patterns

| # | Pattern | Source |
|---|---|---|
| 1 | Phone = private input, TV = shared stage | [Built In](https://builtin.com/articles/jackbox-games-design-party-pack) [V] |
| 2 | Minimal friction: browser, room code or QR, no account, "as little friction as possible" | same [V] |
| 3 | Jack Principles: one task at a time, only meaningful choices, always a timer, the game moves on, "illusion of awareness" | [Coding Horror](https://blog.codinghorror.com/the-jack-principles/), [Karl Kapp](https://karlkapp.com/creating-a-natural-engaging-conversation-in-your-simulation-or-game/) [V] |
| 4 | Voiced host with personality who explains rules in character | [K] |
| 5 | Improv DNA ("yes, and"); making the group laugh beats winning | [WFDD/NPR](https://www.wfdd.org/2025-10-23/how-chicagos-famous-second-city-comedy-club-fueled-blockbuster-party-game-jackbox), [Built In](https://builtin.com/articles/jackbox-games-design-party-pack) [V] |
| 6 | 2 rounds + final, ×1/×2/×3, keeps the last-place player alive | [V] |
| 7 | Anonymous until the reveal | [K] |
| 8 | Staggered reveals as a performance | [K] |
| 9 | Escape hatches for stuck players (Safety Quip, Lie For Me) at partial credit | [V] |
| 10 | Side currencies (likes, thumbs) and end-game awards | [V] |
| 11 | Audience mode up to 10,000, own score in Fibbage 4 | [V] |
| 12 | Anti-degenerate rules: truth match, Jinx, house lies, AI filler | [V] |
| 13 | Content and locale toggles: family filter, US-centric filter, extended timers, host moderation | [stream safety](https://www.jackboxgames.com/how-to-keep-your-stream-safe-while-playing-jackbox-games), [PP10 accessibility](https://www-origin.jackboxgames.com/blog/accessibility-features-in-the-jackbox-party-pack-10) [V] |
| 14 | UGC: prompt editors, fan questions, custom prompts | [Drawful 2](https://store.epicgames.com/p/drawful-2) [V] |
| 15 | Real-world tie-ins: shirts, greeting cards | [V for PP12] |
| 16 | Franchise sequels anchor each pack; novelty around them | [V data, E reading] |

---

## 4. UX, art, sound and tech

### 4.1 Join flow

| Pattern | Jackbox | Source |
|---|---|---|
| Controller | jackbox.tv in any browser, room code + name, no install | [jackbox.tv](https://jackbox.tv/), [Built In Chicago](https://www.builtinchicago.org/articles/jackbox-games-design-party-pack) |
| Room code | 4 letters, big in the lobby | same |
| QR | Only since PP9 (Oct 2022) | [PP9 launch PR](https://www.gamedeveloper.com/press-release/the-jackbox-party-pack-9-is-out-now-on-steam-playstation-xbox-nintendo-switch-and-more) |
| Code read aloud | Since PP7, for low-vision players | [PP7 accessibility](https://www.jackboxgames.com/blog/new-accessibility-features-in-the-jackbox-party-pack-7) |
| VIP | First joiner starts the game and skips intros from the phone | [PP5 streamer's guide](https://jackboxgames.com/the-jackbox-party-pack-5-streamers-guide/) |
| Hide code | Setting for streams | [So You Want To Stream Jackbox](https://www.jackboxgames.com/blog/so-you-want-to-stream-jackbox) |
| Kick | Only since PP9 (2022) | [PP9 features](https://www.jackboxgames.com/blog/the-ability-to-kick-players-and-other-new-features-coming-to-party-pack-9) |
| Reconnect | Same code + same name [U]; community reverse-engineering suggests a per-device identity [E] | [johnbox](https://github.com/InvoxiPlayGames/johnbox) |

### 4.2 Controller and TV

- A small pool of input widgets (pick, type, draw). Jackbox hired a "phone-controller advocate" so the phone never overwhelms anyone. Content lives on the TV; the phone shows only what you must act on, then a wait state ([Built In Chicago](https://www.builtinchicago.org/articles/jackbox-games-design-party-pack)) [V].
- Each game re-skins the controller in its own palette ([jackbox-int/tv](https://github.com/jackbox-int/tv)) [E on bundling].
- PP10 built a custom on-screen keyboard to dodge device keyboard bugs ([PP10 engineering](https://www.jackboxgames.com/blog/behind-the-scenes-of-pp10-engineering)) [V].
- A voiced host explains each task as it happens, so nobody reads rules up front. Intros and tutorials can be skipped by the VIP (PP6+), and settings can change mid-game (PP8) ([PP8 features](https://www.jackboxgames.com/streaming-moderation-accessibility-features-jackbox-party-pack-eight/), [survey answers](https://www.jackboxgames.com/blog/responding-to-your-questions-from-the-jackbox-customer-survey)) [V].
- Timers: **Extended Timers**, later **No Timers** ([PP10 accessibility](https://www.jackboxgames.com/blog/accessibility-features-in-the-jackbox-party-pack-10), [Accessibility FAQ](https://support.jackboxgames.com/hc/en-us/articles/15794801592855-What-accessibility-features-are-available-in-your-games)) [V].

### 4.3 Accessibility

| Feature | Since | Source |
|---|---|---|
| Subtitles for all host VO | PP7 | [PP7 accessibility](https://www.jackboxgames.com/blog/new-accessibility-features-in-the-jackbox-party-pack-7) |
| Separate sliders: master, music, SFX, VO | PP7 | same |
| Motion sensitivity toggle | PP7 | same |
| Room code read aloud | PP7 | same |
| Extended / no timers | PP6–PP8+ | [Accessibility FAQ](https://support.jackboxgames.com/hc/en-us/articles/15794801592855-What-accessibility-features-are-available-in-your-games) |
| Screen-reader table per game | ongoing | [Screen reader table](https://support.jackboxgames.com/hc/en-us/articles/15794836346775-Which-games-or-packs-work-best-with-screen-readers) |
| Colour-blind mode, text size | **none found** | — |

### 4.4 Moderation

- **Family-Friendly filter** (since PP2) removes suggestive game content but not player text; all games are ESRB T except the Naughty Pack ([Rating FAQ](https://support.jackboxgames.com/hc/en-us/articles/15794785491351-Are-your-games-family-friendly-What-are-they-rated)) [V].
- **Profanity filter:** Off / Moderate (default, hateful language) / Strict (also profanity) ([Profanity FAQ](https://support.jackboxgames.com/hc/en-us/articles/15794794632983-How-does-Profanity-Filtering-work)) [V].
- **Human moderation** (PP7+): a trusted person approves each entry from a separate site ([Moderation FAQ](https://support.jackboxgames.com/hc/en-us/articles/15794773430295-How-does-Moderation-work)) [V].
- **Streamer recipe:** Strict profanity + moderation + hidden code + extended timers ([Survey Scramble streaming guide](https://www.jackboxgames.com/blog/how-to-stream-the-jackbox-survey-scramble)) [V].

### 4.5 Localization

FR/IT/DE/ES started with Quiplash 2 InterLASHional. Latin-American Spanish came later, then Brazilian Portuguese. PP9 was fully localized by a free Language Pack, "from the settings menus to the end credit songs" ([languages](https://www.jackboxgames.com/blog/how-were-bringing-jackbox-games-to-countries-around-the-world), [Language Pack](https://www.jackboxgames.com/blog/the-jackbox-language-pack), [PP9 FIGS PR](https://www.gamespress.com/en-US/THE-JACKBOX-PARTY-PACK-9-IS-NOW-FULLY-LOCALIZED-IN-FRENCH-ITALIAN-GERM)) [V]. **No Arabic and no RTL.** New languages are chosen "based on demand" ([support](https://support.jackboxgames.com/hc/en-us/articles/15794788412951-Why-aren-t-your-games-available-in-my-native-language)) [V]. Region-specific content exists for Brazil, which validates per-region packs.

### 4.6 Art and animation

- **Each game has its own look, chosen by its lead artist** (Hypnotorious = 60s/70s; Timejinx = UPA-style) ([PP10 art](https://www.jackboxgames.com/blog/behind-the-scenes-of-pp10-art), [MCV on PP11](https://mcvuk.com/business-news/allard-laban-and-belia-portillo-from-jackbox-games-on-jackbox-party-pack-11/)) [V]. What ties them together is tone, "fast-paced, comedic" ([TheGamer](https://www.thegamer.com/jackbox-interview-wasd-andy-kniaz-belia-portillo-party-pack/)) [S].
- Flat 2D, kinetic type, snappy transitions. TMP3 is the first Unreal title ([Hooked Gamers](https://www.hookedgamers.com/features/2026/10/13/from_bean_bags_to_unreal_engine_an_interview_with_jackbox_ceo_mike_bilder.html)) [S].
- There is no shared character system across games [E].

### 4.7 Hosts and voice

- An unseen, snarky host is the core of the feel, inherited from YDKJ ([Triple Point PR](https://www.triplepointpr.com/post/jackbox-creative-director-on-party-game-s-roots-in-chicago-s-second-city-improv-comedy)) [S].
- Cookie Masterson is voiced by Tom Gottlieb ([Giant Bomb](https://www.giantbomb.com/tom-gottlieb/3040-19406/)) [S]; Schmitty by Phil Ridarelli (wiki only) [U].
- Hosts riff on game state with many line variants [E].

### 4.8 Music and sound

- In-house composers per game: Andy Poland, Brian Chard, Randy Sly and others ([PP3 OST](https://jackboxgames.bandcamp.com/album/the-jackbox-party-pack-3-soundtrack), [PP7 OST](https://jackboxgames.bandcamp.com/album/the-jackbox-party-pack-7-soundtrack), [PP10 OST](https://jackboxgames.bandcamp.com/album/the-jackbox-party-pack-10-soundtrack)) [V].
- Audio leads own music and SFX for their game ([PP10 audio](https://www.jackboxgames.com/blog/behind-the-scenes-of-pp10-audio)) [V].
- Soundtracks are sold on Steam and Bandcamp; end-credit songs are a signature ([PP3 OST Steam](https://store.steampowered.com/app/577810/The_Jackbox_Party_Pack_3__Soundtrack/)) [V].
- **How sound carries pacing [E]:** a looping bed per phase; escalation near the end of a timer; stingers on reveals; VO over ducked music; short, punchy sounds mixed for TV speakers.

### 4.9 Tech

- Proprietary engine on **Scaleform + ActionScript** ([job posting](https://gamejobs.co/Gameplay-Engineer-at-Jackbox-Games-8075)) [S]. TMP3 moved to Unreal for real-time cross-platform play; Party Packs "most likely not" ([Hooked Gamers](https://www.hookedgamers.com/features/2026/10/13/from_bean_bags_to_unreal_engine_an_interview_with_jackbox_ceo_mike_bilder.html)) [S].
- Three parts: the game app, the jackbox.tv web controller, relay servers ([PP10 engineering](https://www.jackboxgames.com/blog/behind-the-scenes-of-pp10-engineering)) [V].
- Protocols (community reverse-engineering): "Blobcast" (Socket.IO), then "Ecast" (HTTP + WebSocket). Game logic runs on the host device; the server relays ([johnbox](https://github.com/InvoxiPlayGames/johnbox), [kklash/jackbox](https://github.com/kklash/jackbox)) [U].
- **Contrast [E]:** JAMAA is server-authoritative (a Durable Object per room, per-client projections). That is better for anti-cheat, secrecy and reconnects.

---

## 5. Market and competitors

| Competitor | Model and price | Arabic / MENA | Source |
|---|---|---|---|
| **Netflix Party Games** | Included in Netflix; LEGO Party, Boggle, Pictionary, Tetris and others since Nov 2025; Jackbox Essentials since Apr 2026; QR join | **English-only in the Middle East**; Arabic "later"; Netflix+Shahid bundle in KSA | [Netflix Tudum](https://www.netflix.com/tudum/articles/netflix-party-games-play-on-tv), [The National](https://www.thenationalnews.com/arts-culture/pop-culture/2025/11/14/review-can-netflixs-new-tv-party-games-compete-with-jackbox), [Arab News](https://www.arabnews.pk/node/2622562/media) |
| **AirConsole** | Free with ads; Hero about $7.99/mo or $29.99 lifetime; telco bundles in Asia | None found | [AirConsole Hero](https://www.airconsole.com/hero), [App Pricing Lab](https://apppricinglab.com/iap/apple/1017688554) |
| AirConsole Android TV | About 12.4M installs, **3.18 stars** | — | [AppGoblin](https://appgoblin.info/apps/com.airconsole.androidtv) [3P] |
| Kahoot! | Free up to 10; Kahoot!+ Family about $7.50–10/mo | UI localized, not a party game | [Kahoot family](https://kahoot.com/family-friends) [3P] |
| Gartic Phone | Free browser, ads | Unverified | [WhistleOut](https://www.whistleout.com/CellPhones/Apps/gartic-phone-app-review) [3P] |
| **Psych!** (Warner Bros) | Free + packs; a **phone-only Fibbage-style game by a major studio** | Saudi App Store, English | [Warner Bros PR](https://www.warnerbros.com/news/press-releases/ellen-degeneres-ellen-digital-ventures-and-warner-bros-interactive-entertainment), [App Store](https://apps.apple.com/app/id1005765746) |
| Apple Arcade | $6.99/mo | Not party-focused for MENA | [Apple Arcade](https://apple.com/arcade) |
| **Jawaker** (Stillfront) | F2P Arabic card games; **acquired for $205M in 2021** | Arabic-native | [PocketGamer.biz](https://www.pocketgamer.biz/stillfront-group-acquires-jawaker-for-205-million) |
| Arabic party apps | Spy/imposter apps (100K–1M installs), Seen Jeem team trivia (about 207K), many small Gulf apps | Arabic, single phone, no TV | [AppBrain Mrone](https://www.appbrain.com/dev/Mrone/), [Seen Jeem](https://apps.apple.com/sa/app/id6479301314) [3P] |

**Platform size.** Google TV + Android TV: about **300M monthly active devices** (May 2026) ([9to5Google](https://9to5google.com/2026/05/21/google-tv-hits-300-million-active-devices/)) [V]. **MENA-3** (KSA, UAE, Egypt) game spend is about $2.2B in 2025, rising to $2.8B by 2029. ARPU (2024 figures) is $84.60 in the UAE, $54.89 in KSA and $3.39 in Egypt; the UAE is forecast above $100 by 2029 ([GameWorldObserver/Niko](https://gameworldobserver.com/2025/07/04/forecast-in-2025-residents-of-saudi-arabia-the-uae-and-egypt-will-spend-2-2-billion-on-games)) [V]. Google Play paid apps and subscriptions are available in **Lebanon, priced in USD** ([Google Play availability](https://support.google.com/googleplay/answer/143779)) [V]; carrier billing there is [U].

**Player complaints about Jackbox (our requirements)**

| Complaint | Evidence |
|---|---|
| Price per pack, too many packs, "only worth it on sale" | [Tom's Guide](https://www.tomsguide.com/news/which-jackbox-party-pack-should-you-buy), [VaporLens PP10](https://vaporlens.app/app/2216830/the_jackbox_party_pack_10) [3P] |
| "Which pack?" choice paralysis (Megapicker exists because of it) | [VaporLens Megapicker](https://vaporlens.app/app/2828500/the_jackbox_megapicker.md) [3P] |
| Repetitive, recycled prompts | [VaporLens PP10 analysis](https://vaporlens.app/app/2216830/the_jackbox_party_pack_10/stats/analysis) [3P] |
| English-only, US-centric references; Jackbox admits it | [GamingOnLinux comments](https://www.gamingonlinux.com/2020/03/jackbox-games-are-going-international-with-quiplash-2-interlashional/comment_id=178070), [Jackbox "For non-American eyes only"](https://www.jackboxgames.com/for-non-american-eyes-only-united-states-do-not-open) |
| Needs a PC or console; "some smart TVs may not show it" | [Jackbox streaming FAQ](https://www.jackboxgames.com/streaming) |
| Streamer trolls and raids | [Jackbox safety blog](https://www.jackboxgames.com/blog/safety-and-moderation-streaming-jackbox-games), [Gayming Mag](https://gaymingmag.com/2022/11/lgbtq-vtubers-are-reporting-harassment-and-doxing-when-playing-party-games/) |

---

## 6. Legal / IP risk matrix

> Not legal advice. Trademark numbers come from aggregators; check them in USPTO TSDR. EUIPO, WIPO and Lebanese registers were not checked.

### 6.1 What Jackbox owns

| Right | What | Source |
|---|---|---|
| Trademark (US, registered) | **JACKBOX GAMES** Reg. 4484270; **FIBBAGE** Reg. 4855109; **QUIPLASH** Reg. 7425654 (2024); **YOU DON'T KNOW JACK** Reg. 4342573. 10 US filings: 6 registered, 4 cancelled (incl. LIE SWATTER) | [Trademarkia](https://www.trademarkia.com/jackbox-games-85959420), [Markinton FIBBAGE](https://markinton.com/trademark/fibbage-86590012), [Justia QUIPLASH](https://trademarks.justia.com/978/84/quiplash-97884785.html), [Justia YDKJ](https://trademarks.justia.com/857/48/you-don-t-know-85748519.html), [trademarkdir](https://trademarkdir.com/owner/jackbox-games-inc) [3P] |
| Trademark (claimed, common law) | Drawful, Trivia Murder Party, Tee K.O., Survive the Internet and others: ™ on store pages, no US registration found | [Epic store TMP](https://store.epicgames.com/p/trivia-murder-party-518ad2) |
| Copyright | Every prompt, question, house lie, safety quip, host line, rule text; characters (Cookie Masterson…); art, animation, UI graphics; **all music, made in-house**; SFX; the jackbox.tv code | [US Copyright Office FL-108](https://webarchive.library.unt.edu/web/20170124184513/https://www.copyright.gov/fls/fl108.pdf), [content guidelines](https://www.jackboxgames.com/jackbox-games-content-guidelines-for-streaming-platforms/) |
| Trade dress | Possible look-and-feel rights over overall presentation | Tetris v. Xio, below |
| Patents | **None found** on phone-as-controller, browser join or room codes [U]. The prior art is large (AirConsole, Kahoot, Use Your Words, HappyFunTimes; US 8,827,811) | [US 8,827,811](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8827811), [CB Insights](https://www.cbinsights.com/compare/airconsole-vs-jackbox-games) |

**Enforcement history.** No public C&D, DMCA or lawsuit against a clone was found. Open-source "Quiplash clone" repos stay up ([example](https://github.com/khayyamsaleem/quiplash-clone)). *Use Your Words* (2017), "very similar to Quiplash" with its own name and art, coexists ([Destructoid](https://www.destructoid.com/use-your-words-adds-some-strategy-and-psychology-to-the-jackbox-formula/), [Steam](https://store.steampowered.com/app/521350/Use_Your_Words)). Assume they will defend **marks and content**.

### 6.2 Case law

| Case | Lesson | Source |
|---|---|---|
| Tetris v. Xio, 863 F. Supp. 2d 394 (D.N.J. 2012) | Copying the overall look of a game's display infringes copyright, even if "only the rules" were taken; Xio admitted deliberate copying. The trade dress win rested on Xio *conceding* fame, secondary meaning and confusion, so it is weaker precedent for a studio like Jackbox whose look changes per game | [Wikipedia](https://en.wikipedia.org/wiki/Tetris_Holding,_LLC_v._Xio_Interactive,_Inc.), [Justia opinion](https://cases.justia.com/federal/district-courts/new-jersey/njdce/3:2009cv06115/235418/61/0.pdf), [Loeb & Loeb](https://www.loeb.com/en/insights/publications/2012/06/tetris-holding-llc-v-xio-interactive-inc) |
| Spry Fox v. Lolapps (W.D. Wash. 2012) | A reskin with similar structure, after access, survived dismissal; settled | [Wikipedia](https://en.wikipedia.org/wiki/Spry_Fox,_LLC_v._Lolapps,_Inc.) |
| **DaVinci v. ZiKo, 183 F. Supp. 3d 820 (S.D. Tex. 2016)** | Same mechanics (Bang! vs Legend of the Three Kingdoms), different culture, theme, art, names and rules text: **not infringing. Best fit for JAMAA**, but a single district court and a board game: persuasive only | [Justia](https://law.justia.com/cases/federal/district-courts/texas/txsdce/4:2013cv03415/1134359/73/), [Game Developer](https://www.gamedeveloper.com/business/texas-court-affirms-game-mechanics-not-protected-under-copyright-law) |
| Data East v. Epyx (9th Cir. 1988) | Genre conventions (scènes à faire) are filtered out; nobody owns a sport or a "trivia show" | [Wikipedia](https://en.wikipedia.org/wiki/Data_East_USA,_Inc._v._Epyx,_Inc.) |
| Atari v. Philips (7th Cir. 1982) | Distinctive characters are protected; do not echo their hosts | [Wikipedia](https://en.wikipedia.org/wiki/Atari,_Inc._v._North_American_Philips_Consumer_Electronics_Corp.) |
| SAS v. WPL (CJEU C-406/10, 2012) | EU: functionality is not protected; recreating behaviour by observation is lawful | [SCL](https://www.scl.org/2964-no-copyright-in-software-functionality-sas-v-wpl-final-chapter/) |
| France: *parasitisme* | Can apply without copyright infringement if the overall visual impression is close and a rival free-rides; claims failed where visuals differed | [Kohen Avocats](https://kohenavocats.fr/en/?p=2129284), [Dalloz](https://www.dalloz-actualite.fr/document/tj-paris-7-nov-2024-n-2402849) |
| Debate and Switch dispute (Oct 2026) | Similar premise alone "wouldn't be enough"; Jackbox firewalls outside pitches | [Plagiarism Today](https://www.plagiarismtoday.com/2026/10/28/jackbox-games-denies-plagiarism-in-new-game/), [Kotaku](https://kotaku.com/jackbox-games-debate-and-switch-die-on-this-hill-similarities-2000750185) |

**Prior art for Bluff.** Fictionary / the Dictionary Game (documented to about 1970) and **Balderdash** (1984) predate Fibbage by decades ([Wikipedia: Balderdash](https://en.wikipedia.org/wiki/Balderdash), [Fictionary](https://en.wikipedia.org/wiki/Fictionary)). Psych! is a Warner Bros precedent for the same mechanic.

**Lebanon.** Copyright: Law No. 75 of 3 April 1999. Trademarks: Arrêté 2385 of 1924, filed with the Ministry of Economy's IP office, registration declaratory ([AGIP](https://www.agip.com/Agip-Country-Service/en/20/C), [Mattar Law](https://mattarlaw.com/trademark-registration-lebanon/)). Madrid Protocol membership [U].

### 6.3 Risk matrix

| Area | Risk | Rule for JAMAA |
|---|---|---|
| Mechanics (bluff-and-find, vote the funniest, social deduction, "most likely to", speed trivia, multipliers, catch-up finals) | **Low** | Free to reuse |
| Format conventions (TV + phones, room code, QR, VIP, lobby avatars, timers, reveal, scoreboard, family filter, streamer mode, audience) | **Low** | Free to reuse (scènes à faire, prior art) |
| Business model (packs, free tier + subscription, regional pricing, streamer policy) | **Low** | Free; write our own policy text |
| Stacked identical structure (same round counts, same multipliers, same point values, same reveal order, same layout) | **Medium** | Change several visible structural choices per game and document them. **Note:** GAME-BLUFF §6.3 currently uses exactly Fibbage's values (1,000 truth / 500 per fooled / ×1-×2-×3 / help halves points); see BLUEPRINT D7 |
| UI layouts | **Medium** | Generic layouts fine; never their specific compositions, colours, type, buttons, transitions or phone screens. In the EU, graphical user interfaces can also be protected as designs (unregistered EU design: 3 years from first EU disclosure) [K, check with counsel] |
| Humour tone / a voiced host | **Medium** | Own character, name, voice and script; never imitate Cookie or Schmitty |
| Prompt themes ("weird laws") | **Medium** | Themes are ideas; write every item from scratch; no close paraphrase |
| Pitching or partnering with Jackbox; hiring ex-staff | **Medium** | Creates "access" evidence; no confidential material |
| Game or brand names close to theirs, in any language ("…box", "Fibbish", "Quiplush") | **High** | Never |
| Their prompts, questions, host lines, rule text (incl. translations, AI rewrites) | **High** | Never |
| Their art, characters, music, SFX, fonts, logos, animations, sound-alikes | **High** | Never |
| Their code or protocol (jackbox.tv JS, Ecast messages) | **High** | Never |
| Marketing: "Jackbox clone", "the Arabic Jackbox", their logos, keyword bidding on their marks | **High** | Never (EU Directive 2006/114/EC Art. 4(g) bans "imitation or replica" claims: [overview](https://en.wikipedia.org/wiki/Comparative_advertising)) |

---

## 7. Market gaps JAMAA can win

1. **Arabic-first party games on the TV, with proper RTL.** Jackbox has none. Netflix games are English-only in the Middle East. AirConsole has no Arabic offer we found. Arabic apps are single-phone [V for the gaps; E for "only"].
2. **Regional content as the product:** a Lebanon quiz, Levantine/Gulf/Maghreb humour, Ramadan and Eid packs, francophone-Lebanese and LatAm Spanish packs. US-centric references are a documented pain point.
3. **One pass instead of 12 packs.** Jackbox costs $30 per pack (about $34 on Gulf PlayStation stores, 3P); AirConsole Hero is about $8/mo; Netflix requires a Netflix plan.
4. **Runs on the Google TV box people already own**, natively, with no PC, console or cloud streaming. That matters on Lebanese and Egyptian bandwidth [E].
5. **Mixed-language rooms** (each phone in its own UI language) [U: no evidence Jackbox does this].
6. **Schools and corporate team-building** (Gulf, Lebanon, France): Jackbox has no product.
7. **Colour-blind-safe design and a shared character cast** across games: Jackbox has neither [E].

**Risks.** Netflix adds Arabic and turns on Jackbox Essentials in MENA. Jackbox's free TV app undercuts us in EN/FR/ES. Arabic moderation (profanity, political and religious sensitivity) is needed before any streamer push. Lebanon and Egypt have low ARPU and unreliable cards, so the Gulf must carry revenue [E]. TV-store discoverability is poor, and AirConsole's 3.18 stars show how TV+phone friction gets punished.

---

## Appendix A. Fact-check log (2026-11-08)

A second pass re-searched the 15 claims that carry the most weight in this study and in BLUEPRINT.md. Method: fresh web searches; several hosts (jackbox.wiki, engadget.com, platprices.com, Netflix's help site) could not be fetched from the sandbox, so some checks rely on search extracts. **OK** = confirmed; **Fixed** = corrected in the text above; **Caveat** = kept, with a qualifier added.

| # | Claim | Result | Evidence |
|---|---|---|---|
| 1 | PP10 launched at $34.99, now $29.99 | **OK, source upgraded.** $34.99 is confirmed by Jackbox itself; the 12 Aug 2024 cut date rests only on a fan wiki | [Jackbox blog](https://www.jackboxgames.com/blog/the-jackbox-party-pack-10-is-now-available), [press kit](https://hello.jackboxgames.com/party-pack-10-press-kit/), [Xbox store $29.99](https://www.xbox.com/games/store/a/9P558FW2W073) |
| 2 | Luna channel $4.99/mo "closed 10 Jun 2026" | **Fixed.** Sales stopped 10 Apr 2026; subscriptions cancelled at the end of the next billing cycle; 10 Jun 2026 was the end of access to purchased third-party games. "Only subscription ever" softened to "only one found" | [Engadget](https://www.engadget.com/gaming/amazon-luna-ends-support-for-third-party-subscriptions-and-game-purchases-171329996.html), [Slashdot](https://games.slashdot.org/story/26/04/11/2130243/amazon-luna-ends-its-support-for-purchased-games-and-third-party-subscriptions) |
| 3 | Netflix Jackbox Party Essentials (Fibbage 4, Quiplash 3, Drawful 2), Apr 2026, no MENA | **Caveat.** Games and date confirmed (available 9 Apr 2026). The country list is introduced as "a selection of countries, including…", so "no MENA" means "none listed" | [Games Press](https://www.gamespress.com/The-Jackbox-Party-Essentials-Now-Available-on-Netflix), [Netflix Games help](https://games-netflix.helpshift.com/hc/en/57-the-jackbox-party-essentials/faq/1865-where-can-i-play-the-jackbox-party-essentials-via-netflix-games/) |
| 4 | 100M players (2019), about 200M by end 2020, sales up to 1,000% | **OK** ("on track to double to 200M"; players are not buyers) | [Bloomberg](https://www.bloomberg.com/news/articles/2020-10-20/jackbox-games-benefits-from-retro-style-party-games-in-pandemic), [DualShockers](https://www.dualshockers.com/jackbox-games-200-million-players-bloomberg-report/) |
| 5 | Up to 8 players + 10,000 audience | **OK, nuance added.** "Most" games are 1–8; several go to 9–10 (16 in Bracketeering). "7+ non-owners" corrected to "up to 7" | [Jackbox virtual happy hours guide](https://www.jackboxgames.com/the-jackbox-games-guide-to-virtual-happy-hours/), [PP8 features](https://www.jackboxgames.com/streaming-moderation-accessibility-features-jackbox-party-pack-eight/) |
| 6 | US marks: QUIPLASH Reg. 7425654, FIBBAGE Reg. 4855109, JACKBOX GAMES Reg. 4484270 | **OK (aggregators).** QUIPLASH filed 12 Apr 2023, registered 25 Jun 2024. FIBBAGE registered 17 Nov 2015, Section 8/9 renewal shown Jan 2026. JACKBOX GAMES registered 18 Feb 2014; a 10-year renewal was not visible, so its status needs a TSDR check | [Gleanmark QUIPLASH](https://gleanmark.com/trademark/uspto-97884785), [Markinton FIBBAGE](https://markinton.com/trademark/fibbage-86590012), [Trademarkdir JACKBOX GAMES](https://trademarkdir.com/trademark/jackbox-games-85959420) |
| 7 | Tetris v. Xio: overall look infringes copyright and trade dress | **Caveat.** Holding confirmed (863 F. Supp. 2d 394, 30 May 2012), but the trade dress win rested on Xio's concessions | [Justia opinion](https://cases.justia.com/federal/district-courts/new-jersey/njdce/3:2009cv06115/235418/61/0.pdf), [Loeb & Loeb](https://www.loeb.com/en/insights/publications/2012/06/tetris-holding-llc-v-xio-interactive-inc) |
| 8 | DaVinci v. ZiKo: same mechanics, different expression, not infringing | **OK, qualifier added** (183 F. Supp. 3d 820; district court, board game; persuasive only) | [Justia](https://law.justia.com/cases/federal/district-courts/texas/txsdce/4:2013cv03415/1134359/73/), [Game Developer](https://www.gamedeveloper.com/business/texas-court-affirms-game-mechanics-not-protected-under-copyright-law) |
| 9 | Pillar thesis: packs without a pillar review worse | **Fixed.** PP11 has no pillar and scores about 93% on Steam. PP3 96% and PP7 96% confirmed; PP10 about 63% | [Raijin PP11](https://raijin.gg/app/3364070/The_Jackbox_Party_Pack_11), [Steam PP7](https://store.steampowered.com/app/1211630), [Steam PP3](https://store.steampowered.com/app/434170), [Steam PP10](https://store.steampowered.com/app/2216830) |
| 10 | Gulf PS Store PP10 $33.99, "MENA pays a premium" | **Caveat.** The figure appears in a PlatPrices extract (snapshot date unknown). The premium versus the US is about 13%; the 53% figure compares against the cheapest region | [PlatPrices](https://platprices.com/intelligence/game/116035-the-jackbox-party-pack-10) |
| 11 | Drawful 2 "given free, kept forever" | **Fixed.** Two time-limited free-to-keep giveaways (spring 2020, summer 2024); not permanently free | [Jackbox blog](https://jackboxgames.com/were-giving-away-drawful-2-for-free-for-three-weeks), [PC Gamer](https://www.pcgamer.com/drawful-2-a-party-game-about-terrible-art-is-free-to-keep-on-steam), [GamingOnLinux](https://www.gamingonlinux.com/2024/07/grab-a-free-copy-of-drawful-2-now-that-the-jackbox-megapicker-is-out/page=1/) |
| 12 | PP12 $29.99, mid-Oct 2026; TMP3 $14.99, Early Access Sep 2026 | **OK.** PP12 on 15 Oct (14 Oct in some time zones); TMP3 Early Access from 17 Sep 2026 | [Deku Deals](https://www.dekudeals.com/items/the-jackbox-party-pack-12), [Epic PP12](https://store.epicgames.com/p/the-jackbox-party-pack-12-ecd7c0), [Shacknews TMP3](https://www.shacknews.com/article/150426/trivia-murder-party-3-early-access-release-date-september-2026), [Epic TMP3](https://store.epicgames.com/p/trivia-murder-party-518ad2) |
| 13 | Jackbox free smart-TV app "late, US-first" | **OK.** No launch found as of 2026-11-08 | [Cloud Dosage](https://clouddosage.com/jackbox-says-its-smart-tv-cloud-gaming-service-is-still-coming-in-2026/), [9to5Google](https://9to5google.com/2025/03/06/jackbox-games-app-is-coming-to-smart-tvs-for-free-in-spring-2025/) |
| 14 | Market facts: Google TV + Android TV 300M MAD (May 2026); Jawaker $205M (2021); MENA-3 $2.2B in 2025 | **OK; ARPU year fixed** (the $84.60 / $54.89 / $3.39 figures are for 2024) | [9to5Google](https://9to5google.com/2026/05/21/google-tv-hits-300-million-active-devices/), [Stillfront PR](https://stillfront.com/en/wp-content/uploads/sites/2/2021/08/stillfront-stillfront-group-acquires-jawaker-and-continues-expansion-in-the-mena-region-and-intend-210908.pdf), [GameWorldObserver](https://gameworldobserver.com/2025/07/04/forecast-in-2025-residents-of-saudi-arabia-the-uae-and-egypt-will-spend-2-2-billion-on-games) |
| 15 | Debate and Switch dispute; QR since PP9 | **OK.** Jackbox says the pitch went to business development, not the game team; Plagiarism Today judges it likely coincidence. QR join, kick and hidden code all arrived with PP9 (Oct 2022) | [Kotaku](https://kotaku.com/jackbox-games-debate-and-switch-die-on-this-hill-similarities-2000750185), [Plagiarism Today](https://www.plagiarismtoday.com/2026/10/28/jackbox-games-denies-plagiarism-in-new-game/), [Siliconera](https://www.siliconera.com/jackbox-party-pack-9-adds-moderation-features-qr-login/) |

**Also checked for BLUEPRINT.md:** Fire TV is no longer purely Android. Since the Fire TV Stick 4K Select, new sticks run the Linux-based **Vega OS**, which needs its own build; older Fire OS devices still run Android APKs ([Android Authority](https://www.androidauthority.com/amazon-fire-tv-os-vega-os-explanation-3615880), [Tom's Guide](https://www.tomsguide.com/entertainment/streaming-devices/amazons-new-usd40-fire-stick-is-the-illegal-streamers-nightmare-heres-why)). Ramadan 2027 is expected to start about **8 Feb 2027**, subject to moon sighting ([Gulf News](https://gulfnews.com/uae/ramadan/when-does-ramadan-2027-begin-everything-you-need-to-know-1.500630523)).

**Legal matrix review.** The Low / Medium / High split is consistent with the case law above. Three additions were made: (a) identical point values belong to "stacked structure", and Bluff currently matches Fibbage's values exactly; (b) EU design law can protect GUIs; (c) the qualifiers on Tetris and DaVinci. Not checked: EUIPO and GCC trademark registers for Jackbox marks, and the Lebanese register. Do those before filing JAMAA marks.
