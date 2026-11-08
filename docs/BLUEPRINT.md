# BLUEPRINT — JAMAA, built on what makes Jackbox work

> Version 1, 2026-11-08. Derived from [JACKBOX-STUDY.md](JACKBOX-STUDY.md), which holds the evidence and sources. This file holds the **decisions and recommendations**. Where it disagrees with a binding spec (SPEC, JAMAA-PLATFORM, GAME-*), the spec still wins until the owner changes it. Every proposed change is listed in §9 as an open decision.
>
> Tags: **[E]** = estimate or our judgement. Every other fact links back to the study.

## 0. The blueprint in one paragraph

Jackbox proved that "one TV, everyone's phone, a voiced host, 15-minute comedy games" sells to hundreds of millions of players ([study §0](JACKBOX-STUDY.md#0-executive-summary)). **We copy the formula, not the material.** We take the mechanics, the pacing patterns and the business levers. Every name, word, picture, voice and sound is our own, rooted in Levantine and Mediterranean culture. We win where Jackbox is absent: **Arabic and RTL, regional content, Google TV-first, one cheap pass instead of 12 packs, and pricing adapted to each region.**

---

## 1. What we copy (mechanics and patterns: free to reuse)

These are rules, genre conventions and UX patterns. Copyright does not protect them ([study §6](JACKBOX-STUDY.md#6-legal--ip-risk-matrix)).

| # | Pattern | Jackbox reference | JAMAA use |
|---|---|---|---|
| C1 | Phone = private input, TV = shared stage; no install, no account | All games | Platform core (done) |
| C2 | Room code + QR, first joiner hosts (VIP), reconnect | jackbox.tv | Done, and better than Jackbox: QR from day one, token resume |
| C3 | Timers on every phase; the game moves on without you | Jack Principles | Every game spec |
| C4 | 2 rounds + final at ×1/×2/×3 | Fibbage, Quiplash | Bluff (done in spec), Trivia ("last question doubles"). The *pattern* is free, but Bluff also copies Fibbage's exact point values: see D7 |
| C5 | Anonymous answers, then a staged reveal (least-picked first, truth last) | Fibbage, Quiplash | Bluff reveal (GAME-BLUFF §12.2) |
| C6 | "Too close to the truth" rejection with authored alternate answers | Fibbage | Bluff §5.2, with Arabic normalisation |
| C7 | Stuck-player escape button at partial credit | Lie For Me, Safety Quip | Bluff "Help me" (§5.5) |
| C8 | House lies (decoys) for small groups | Fibbage | Bluff (spec) |
| C9 | Likes as a side currency, plus end-game awards | Fibbage 4, Drawful | Bluff likes and awards; Most Likely awards |
| C10 | Audience mode (spectators vote, own leaderboard) | Quiplash onward | **Missing**, §7.1 |
| C11 | Extended timers / no timers | PP6–PP10 | Partial (`pace` per game), §7.2 |
| C12 | Family filter, profanity tiers, host kick and hide answer, moderation | PP2–PP9 | Partial, §7.3 |
| C13 | Streamer preset: hidden code, delay-safe timers, strict filter | Streaming guides | Missing, §7.1 |
| C14 | Self-referential mode: bluff about the people in the room, then a "truth + lie about yourself" final | Fibbage: Enough About You | Bluff v1.1, zero content cost (§6.1 G5) |
| C15 | Identical answers cancel out (Jinx); AI filler for odd counts | Quiplash | Future writing game |
| C16 | Free launcher that sells what you don't own | Megapicker | The JAMAA hub is this, from day one |
| C17 | A free hook game | Drawful 2 time-limited free-to-keep giveaways (2020, 2024); the Netflix sampler and the planned free TV app are Jackbox's move to a permanent free tier | Mish Ana! plus starter content in every game, free **forever** (we go further than Jackbox did) |
| C18 | An annual tentpole content drop timed to the gifting season | October packs | Ramadan/Eid drop (and Christmas for FR/ES) |
| C19 | Streamers as the marketing budget; a public creator licence | Streaming guidelines | Our own creator licence, written in our words |

## 2. What we adapt (same lever, our version)

| Lever | Jackbox | JAMAA adaptation |
|---|---|---|
| Content | US-centric English trivia and prompts; FIGS translations | Content **written natively** per locale: Lebanese proverbs, French expressions, Lebanon quiz, later Gulf/Maghreb/LatAm. A region toggle replaces their "US-centric filter" |
| Languages | EN + FIGS + pt-BR | EN/FR/**AR (RTL)**/ES, **mixed-language rooms** (each phone in its own UI language) |
| Host | Snarky American game-show voice | An original Levantine host ("tfaddalo" hospitality, Franco-Arab code switching), natively voiced per language with subtitles (§7.5) |
| Price | $29.99 per 5-game pack, $4.99/mo on Luna (closed) | One JAMAA Pass for everything, regional prices (§5) |
| Calendar | October pack, Christmas peak | Ramadan nights, Eid, summer diaspora return, Christmas/New Year |
| Distribution | Consoles and PC first; Android TV patchy | Google TV / Android TV first, then browser TV, then Fire TV (older Fire OS devices run our APK; new Vega OS sticks need a separate build) |
| Streaming | Twitch | TikTok Live, Instagram, YouTube, Kick (MENA); Twitch for FR/ES |
| B2B | Ad hoc email for colleges | "JAMAA for Schools & Teams" venue licence (later) |
| Art | One look per game, no shared characters | One look per **world** plus **one cast** (the *shilleh*) across all games (DESIGN-JAMAA §4) |

## 3. What we never copy

Hard rules for everyone who works on JAMAA: staff, contractors, writers and AI tools.

1. **Names.** Never JACKBOX, FIBBAGE, QUIPLASH, DRAWFUL, TRIVIA MURDER PARTY, YOU DON'T KNOW JACK, TEE K.O. or any Jackbox game name, nor anything confusingly close to them in any language or script ("…box", "Fibbish", "Quiplush"). Not as an app, game, mode, domain, handle or store keyword. Their feature names stay theirs too: Safety Quip, Lie For Me, deFIBrillator, Thriplash, Last Lash, Enough About You. Our equivalents get our own words ("Help me", «ساعدني», "The Big Bluff").
2. **Text.** No prompt, question, answer, house lie, host line, joke, rule text or tutorial text from Jackbox. That includes translations, close paraphrases and AI output prompted with their items. No scraping of jackbox.tv or fan wikis.
3. **Art, characters, animation, fonts, logos.** No imitation of Cookie Masterson, Schmitty or any mascot. No per-game look copied from theirs.
4. **Music and SFX.** No samples and no sound-alikes. Everything is synthesised by us (`tools/gen-sounds`) or commissioned with a written IP assignment.
5. **Trade dress.** Do not copy their lobby or room-code screen composition, colour blocking, typography, button shapes, transitions or the jackbox.tv phone styling.
6. **Code and protocol.** No decompiling and no reuse of the jackbox.tv client, assets or API messages.
7. **Marketing.** Never "Jackbox clone", "the Arabic Jackbox", "Jackbox but cheaper", their logos or screenshots, implied affiliation, or bidding on their marks. Any factual comparison needs counsel review per market (EU 2006/114/EC).
8. **Process.** Designers may play Jackbox for research. Specs are written in our own words, with no Jackbox screenshots used as UI templates. Writers keep authorship logs and assign IP. Nobody pitches to Jackbox: it creates "access" evidence ([study §6.2](JACKBOX-STUDY.md#62-case-law)).
9. **Structural distance.** For every game, document at least three visible structural choices that differ from the nearest Jackbox title (§6.2). That is our evidence of independent creation (the Spry Fox and Tetris lesson).
10. **Trademarks.** JAMAA is the protectable house mark. "Bluff", "Trivia" and "Who's Most Likely To" are descriptive: use them as "JAMAA Bluff". Coin distinctive names before launch. File JAMAA (word and logo) in Lebanon, the EU, the US, the UAE and KSA, in Classes 9, 41 and 42, after a clearance search. Get one or two hours of IP counsel before launch.

## 4. Brand differentiation

| Axis | Jackbox | JAMAA |
|---|---|---|
| Personality | Snarky, irreverent American game show; comedy club | **Hospitality**: "the living room at 11 p.m., when the whole family ends up around the TV" (DESIGN-JAMAA §1.1). Warm, teasing, family-first |
| Cultural world | Generic US pop culture | Levantine and Mediterranean, modern: arches (*bab*), lamps, café warmth, darbuka. **Not** folklore postcards (DESIGN-JAMAA §1.1) |
| Visual system | A different art style per game, no shared cast | Violet hub with an amber lamp accent, one **world palette** per game (night market, hakawati café, rooftop, quiz studio), and **one cast of 12 characters with 13 expressions** in every game |
| Type | Per-game display fonts | **Cairo** everywhere, Latin and Arabic in one rhythm; Arabic is a first-class wordmark («جماعة») |
| Transitions | Snappy cuts | "Every entrance is a doorway": the Bab portal and world entrances |
| Accessibility | Subtitles, sliders, motion toggle; no colour-blind mode | Colour is never the only signal (shape + letter + character), contrast measured per token; advertise it |
| Sound | In-house orchestral and pop per game | Original synthesis now; commissioned **Levantine synth-pop beds** later (oud, darbuka, synth). Credits song per world as a TikTok asset |
| Ethics | ESRB T, adult pack | Family-safe by default. Any "spicy" content is opt-in, Pass-only, never in Arabic starter content |

**Positioning line [E]:** "Party game night in your language, on the TV you already own. One pass, all the games." AR: «سهرة ألعاب بلغتك، على تلفزيونك». FR: « La soirée jeux dans ta langue, sur ta télé. Un seul pass, tous les jeux. »

## 5. Pricing recommendation

### 5.1 Anchors

- A Jackbox household pays **$29.99 per 5-game pack**, about $15–20 after sales [E], and **$33.99 in the UAE/KSA PS Store** (third-party tracker, about 13% above the US). PP10's $34.99 launch price did not stick: it lists at $29.99 today. The subscription reference is **$4.99/mo** (Luna, closed) ([study §1](JACKBOX-STUDY.md#1-business-and-pricing)).
- AirConsole Hero is about $7.99/mo or $29.99 lifetime. Apple Arcade is $6.99/mo. Netflix games come "free" with a Netflix plan.
- **Repo history.** MONETIZATION.md §5.1 records a 2026-10-26 owner decision for a **lifetime** unlock ($7.99, $5.99 promo), on the grounds that "a party game is played a few nights a year, so a subscription reads as a trap". JAMAA-PLATFORM §4.1 later returned to a **`jamaa_pass` subscription** (monthly + yearly + 7-day trial) with $4.99/$29.99 as the starting point. The recommendation below keeps the platform model and answers the "few nights a year" objection with a yearly-first store and a short Party Night pass.

### 5.2 Recommended price grid [E]

Prices are set in Play Console; these are targets. The rule: **the yearly Pass costs less than one Jackbox pack in every region**, and the monthly Pass costs less than Luna's $4.99.

| Region | Pass monthly | **Pass yearly (hero)** | Single pack (one-time) | Party Night (48 h, later) | Reasoning |
|---|---|---|---|---|---|
| US / UK / Canada / Australia | $3.99 / £3.49 | **$24.99 / £21.99** | $2.99 | $1.99 | Below Luna and below one $29.99 pack per year, for every game |
| France / Spain / EU | €3.49 | **€22.99** | €2.49 | €1.99 | Same logic in EUR. Netflix–Jackbox is present here, so lead on content, not price |
| Gulf (KSA, UAE, Qatar, Kuwait, Bahrain, Oman) | $3.49 equivalent (SAR/AED via Play) | **$19.99 equivalent** | $2.49 | $1.99 | Highest ARPU in MENA (UAE $84.60, KSA $54.89; 2024). Jackbox lists about $34 per pack on PlayStation there, and its direct store does not sell there. This region is the **revenue base** |
| Lebanon, Jordan, Iraq | $1.49 (USD) | **$9.99** | $0.99 | $0.99 | Content and culture base. USD pricing because the lira is unstable. Cards are unreliable, so plan vouchers (§5.2 gift codes) |
| Egypt, Maghreb | Play-suggested local price (about $0.99) | **about $7.99** | $0.99 | $0.49–0.99 | Very low ARPU (Egypt $3.39). Volume and virality market |
| LatAm Spanish | about $1.99 | **about $12.99** | $1.49 | $0.99 | About 50–60% of the EU price, following Play's local pricing |

- **Free tier, forever:** Mish Ana! plus starter content in every game, unlimited rooms, up to 12 players. **Phones never pay and never see a price** (already binding).
- **Trial:** 7 days on both base plans (already specified). Also offer it during **Ramadan nights** as a seasonal promo.
- **Party Night pass** (48 h, consumable): answers the "few nights a year" objection and matches how MENA households host (Eid, weddings, holidays). It needs a server-side expiring entitlement that the platform does not have yet, so it is **phase 2**.
- **Gift codes** sold before Ramadan, Eid and Christmas, as a web or voucher product. This copies Jackbox's October gifting tentpole on our calendar.
- **Single packs** stay at or below 1/3 of the yearly Pass, so the Pass stays the obvious deal.
- **B2B** (later): "JAMAA for Schools & Teams", about $49–99 per venue per year, with no Play billing, invoiced directly.
- **Ads:** Jackbox plans ads in its free TV app. We **do not** show ads during play. At most one house-promo card between games for free rooms. Revisit only if free-tier costs require it.

## 6. Game roadmap (Jackbox-proven mechanics mapped to JAMAA)

### 6.1 Priority order

| # | JAMAA game | Status | Jackbox-proven mechanic | Why first | Key Jackbox lessons to apply |
|---|---|---|---|---|---|
| G1 | **Mish Ana!** (social deduction) | Built | Fakin' It, Push The Button, Suspectives | Familiar spy/"out of the loop" mechanic with proven Arabic demand (spy apps 100K–1M installs) | Add a gesture round later ("raise your hand if…") for kids and elders |
| G2 | **Bluff** | Specified (GAME-BLUFF) | Fibbage, the most proven pillar, on Netflix | Jackbox's flagship mechanic has **no Arabic version** anywhere. Lebanese teasing and white-lie culture | Too-close check, Help me, house lies, likes, staged reveal (all specified). Final decision §9 D1. Then an "About us" mode (C14) |
| G3 | **Who's Most Likely To** | Specified (GAME-LIKELY) | Role Models, Poll Mine, Survey Scramble | No typing, one tap, RTL-trivial, every age: the warm-up game | Keep it short (6–10 min); awards so everyone leaves with something; anonymous mode for touchy families |
| G4 | **Trivia** (Lebanon quiz first) | Specified (GAME-TRIVIA) | YDKJ, Trivia Murder Party, Legends of Trivia | Local pride, shareable scores; Seen Jeem-style team trivia charts in the Gulf | Add **drama and a catch-up**: a final that lets the last player come back (TMP's ghost race idea, our own form). Region quiz packs |
| G5 | **Bluff "About us"** (mode) | Candidate | Fibbage: Enough About You | **Zero content cost**: the players are the content. Works in every language, ideal for families | Personal truth → others bluff it → "one truth, one lie about yourself" final. Strong free-tier content |
| G6 | **Head-to-head comedy writing** (working title, needs our own name) | Candidate | Quiplash, the second pillar | Highest-proven comedy loop worldwide | Mitigate Arabic typing: short answers, a "stuck" button, optional voice-to-text, ×1.5 timers when the room language is AR [E]. Jinx rule, AI filler for odd counts |
| G7 | **Poll guessing** ("What % of us…?") | Candidate | Guesspionage, Survey Scramble | Feud-style shows are big in Arab TV [E]; little typing | Needs survey data: collect it from our own anonymous in-game polls (privacy review first) |
| G8 | **Drawing bluff** | Candidate | Drawful, the third pillar | Language-neutral, ideal for mixed-language rooms | Phone drawing is clumsy for elders: thick brush, undo, short timers |
| G9 | **Team trivia for big gatherings** | Candidate | Legends of Trivia, Seen Jeem | Weddings, cafés, 15+ people | Teams on one phone each; audience mode first |
| — | Skip: real-time and rhythm games (Quixort, Dodo Re Mi), adult packs | — | — | Latency on TV + browser; low comedy value; cultural risk | — |

**Pack lesson from Jackbox's reviews [E]:** the top-rated pack (PP3, 96%) pairs a writing game, a trivia game and a social game, and PP7 (96%) leads with a writing flagship. A flagship helps but is not required: PP11 has no returning pillar and still scores about 93% thanks to strong new games, while PP10 (about 63%) shows that a weak line-up plus a price hike hurts. Our launch line-up (Mish Ana!, Bluff, Most Likely, Trivia) covers social, writing and trivia. Keep Bluff as the flagship and give it the most polish, but quality per game matters more than the label.

### 6.2 Structural distance from the nearest Jackbox title (evidence of independent creation)

| JAMAA game | Nearest Jackbox title | Visible differences (already in our specs unless marked) |
|---|---|---|
| Bluff | Fibbage | **Gap:** point values are currently identical to Fibbage (1,000 truth / 500 per fooled / ×1-×2-×3 / help halves the lie's points), see D7. Differences: prompt types are proverbs, word meanings and expressions, not "fact with a blank"; 3–12 players (Fibbage 2–8); points flow **from the fooled player's character to the liar** as coins; "Too famous!" auto-swap when half the room finds the truth; "found it early" no-score rule; LIE/TRUTH stamp reveal in a café world; Short/Normal/Long lengths; final is "The Big Bluff" (and possibly a no-truth twist, D1) |
| Most Likely | Role Models / Poll Mine | Votes for real people in the room, "Read the Room" points for agreeing with the group, conga-line reveal, signature award per player, anonymous mode without points |
| Trivia | YDKJ / TMP | Quiz shelf with stars and topic chips; region-specific sourced quizzes; colour + shape + letter answers; streak bonus; no death or horror theme |
| Mish Ana! | Fakin' It / Push The Button | Word-based Mole with a last-chance guess, optional Undercover, one-word clue turns |

## 7. UX and sound checklist (against the current repo)

Status: **Done** = in code today (Mish Ana! and the shared platform). **Spec** = specified in docs (SPEC, DESIGN, JAMAA-PLATFORM, DESIGN-JAMAA, GAME-*), not yet built; the JAMAA platform build (P0) is in progress. **Missing** = in neither. Priority: P1 = before a public launch, P2 = in the first 3 months, P3 = later.

### 7.1 Join, room, host

| Item | Jackbox | JAMAA status | Priority |
|---|---|---|---|
| Browser controller, no install, light | Yes | **Done** (Preact, about 53 KB gzip) | — |
| 4-letter code, unambiguous alphabet, QR | QR only since 2022 | **Done** | — |
| VIP host with reassignment; TV drives everything | Yes | **Done** | — |
| Token resume, seat hold, heartbeat | Partial | **Done** | — |
| Kick (TV, VIP) | Since 2022 | **Done** | — |
| Up to 12 players | Usually 8 | **Done** | — |
| Multi-game hub, session cup, characters | Megapicker only | **Spec** (JAMAA-PLATFORM §2–3) | P1 |
| **Audience mode** (late joiners vote, own leaderboard) | Up to 10,000 | **Missing** (a late joiner gets a locked screen) | P2 |
| Hide room code / streamer preset | Yes | **Missing** (DESIGN §8 "[not in v1]") | P2 |
| Room code read aloud | Since PP7 | **Missing** | P3 |
| Moderator page (second phone approves entries) | Since PP7 | **Missing** | P3 |

### 7.2 Onboarding, timers, controller

| Item | Jackbox | JAMAA status | Priority |
|---|---|---|---|
| How to play per game, first-time per device, ⓘ always reachable | Host explains in character | **Spec** (JAMAA-PLATFORM §3.6) | P1 |
| First-round coach marks | Partial | **Spec** | P1 |
| VIP-only "skip intro" on the phone | Yes | Check: make sure the How to play sheet can be skipped from the VIP phone | P1 |
| Per-game pace (relaxed / normal / fast) | Extended timers | **Spec** (Bluff, Trivia `pace`) | P1 |
| **Room-wide extended timers (×1.5/×2) and no-timer mode**, applied by every engine | Yes | **Missing** as a platform setting | P1 |
| ×1.5 default timers when the content language is Arabic [E] | — | **Missing**; playtest first | P2 |
| Phone shows own result during reveals ("You fooled 2!") | Yes | **Spec** (Bluff, Most Likely) | P1 |
| Custom in-page keyboard fallback | PP10 | **Missing**; only if field bugs appear (Arabic IME risk) | P3 |
| Settings changeable mid-game from the pause menu | PP8 | **Missing** | P3 |

### 7.3 Accessibility and moderation

| Item | Jackbox | JAMAA status | Priority |
|---|---|---|---|
| Reduced motion | Yes | **Done** (TV and phone) | — |
| Colour never the only signal, measured contrast | No colour-blind mode | **Done / Spec** (characters + names; Trivia shape + letter) | — |
| Separate volume sliders (master / music / SFX / voice) | Yes | **Missing** (one global mute; two internal buses) | P2 (with music) |
| Subtitles for host voice | Yes | **Missing** (no voice yet) | With G-host |
| Larger text on the phone; accessibility statement | Partial | **Missing** | P3 |
| Blocked words for Bluff lies; host "hide an answer"; `ageRating` | Partial | **Spec** (GAME-BLUFF §5.4, `HIDE_OPTION`) | P1 |
| **Profanity tiers** (Off / Moderate / Strict) in EN/FR/AR (incl. Arabizi)/ES | Yes | **Missing** | P1 before any streamer push |
| Family toggle filtering packs by `ageRating` | Yes | **Partial** (Most Likely "Spicy" confirm; launch packs all `all`) | P2 |

### 7.4 Language and content

| Item | Jackbox | JAMAA status | Priority |
|---|---|---|---|
| EN/FR/AR (RTL)/ES UI | No AR | **Done** | — |
| Lebanese content; content language separate from UI | No | **Done** (Mish Ana!), **Spec** (G2–G4) | — |
| Native content per locale with authorship logs | — | **Spec** (writing guides); add authorship log fields | P1 |
| Gulf / Egyptian / Maghreb variants; LatAm vs Castilian split | ES split exists | **Missing** | P2–P3 |
| Seasonal drops (Ramadan, Eid, Christmas) without an app update | No | **Spec-able** (content ships in the Worker) | P1 for Ramadan 2027 |

### 7.5 Host, music, sound

| Item | Jackbox | JAMAA status | Priority |
|---|---|---|---|
| Original synthesised SFX and stings | In-house | **Done** (26 cues in `tv-app/app/src/main/res/raw`) | — |
| Platform and per-game cues (portal, world stings, coins, truth reveal, quiz correct/wrong…) | — | **Spec** (JAMAA-PLATFORM §3.11, GAME-* §12.6) | P1 |
| **Music beds per phase per world**, escalation near the end of a timer, ducking | Yes | **Missing** (no music at all) | P2: biggest "feel" gain after the host |
| **Voiced host per game** (original character, native VO in Lebanese Arabic, FR, ES, EN, many line variants, reacts to state) | Core of the feel | **Missing** | P2: start with Bluff in Lebanese Arabic and FR |
| Credits song per world (marketing asset) | Yes | **Missing** | P3 |
| Phone audio (opt-in) for remote play | Partial | **Missing** (TV-only by design) | P3 |

### 7.6 Platforms and tech

| Item | Jackbox | JAMAA status | Priority |
|---|---|---|---|
| Server-authoritative rooms, per-client projections | Host-authoritative relay | **Done** (better) | — |
| Android TV / Google TV native | Patchy | **Done** | — |
| Browser TV host as a product (smart TVs, laptops) | Partial | **Done as a dev mock** (`/tv`); productise | P2 |
| Fire TV | Yes | **Missing**. Cheap on older Fire OS (Android) devices; new Vega OS sticks (since the Fire TV Stick 4K Select) need a separate non-Android build, so that part is not cheap | P2 (Fire OS), later (Vega) |
| Audience fan-out (thousands of read-only sockets) | Yes | **Missing**; needs aggregated votes or a separate audience DO [E] | With audience mode |

**Top five gaps to close (recommendation):** (1) room-wide extended / no timers, (2) profanity tiers incl. Arabic and Arabizi, (3) audience mode + streamer preset, (4) music beds + volume sliders, (5) an original voiced host with subtitles, starting in Lebanese Arabic.

## 8. Go-to-market angle

- **Beachhead:** Lebanon and its diaspora (France, Gulf expats, the Americas) for content credibility and virality. **Monetize in KSA and the UAE**, where ARPU is highest and Jackbox costs about $34 a pack on PlayStation.
- **Launch moment:** the free tier goes live before **Ramadan 2027** (expected to start around 8 February 2027, subject to moon sighting ([Gulf News](https://gulfnews.com/uae/ramadan/when-does-ramadan-2027-begin-everything-you-need-to-know-1.500630523)); the earlier research file's "late February" was wrong), with a Ramadan pack, a free Pass trial during Ramadan nights, and Eid gift codes. Christmas and New Year for FR/ES.
- **Hero games in marketing:** Mish Ana! (a familiar "برّا السالفة" spy mechanic), the Lebanon quiz (local pride, shareable score card), then Bluff as the headline ("the bluffing game, finally in Arabic", never naming the competitor).
- **Channels:**
  - Arabic, French and Spanish creators on TikTok Live, Instagram, YouTube and Kick. Ship the streamer preset first and publish a creator licence (monetized streams allowed).
  - Cafés, shisha lounges and university clubs as "venue hosts", with a QR poster kit.
  - Telco and Android TV box bundles, following AirConsole's telco deals (outreach targets, unverified: Alfa/touch in Lebanon, stc/du/e& in the Gulf).
  - Phone-side acquisition: the QR on the TV, a shareable join link, and an end-of-game result card. TV-store search volume is low.
- **Message hierarchy:** (1) in your language, (2) on the TV you already own, (3) one pass, every game, (4) free to start. Price comparisons stay factual and never name Jackbox in paid media.
- **Watch list:** Netflix adding Arabic games or turning on Jackbox Essentials in MENA; the launch and price of Jackbox's free TV app; Arabic moderation incidents.

## 9. Open decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| D1 | Bluff final. The brief describes a **"no truth" final**, but GAME-BLUFF.md §3 currently specifies "The Big Bluff": same mechanics, ×3 | Playtest both. If we keep no-truth, announce it on the TV ("No truth this time: just make them laugh"), score by votes ×3, raise the value of likes, and add the Jinx rule for identical answers. It is a real structural difference from Fibbage (good for §3 rule 9) |
| D2 | Pass prices per region | Adopt the §5.2 grid in Play Console; yearly as the focused default (already specified) |
| D3 | Party Night 48-hour pass | Phase 2; needs a server-side expiring entitlement |
| D4 | Final game names (Bluff, Most Likely, Trivia) | Coin distinctive, clearable names in AR/FR/EN/ES, or use "JAMAA Bluff" etc. Run the clearance search before store listings |
| D5 | Voice host budget | Pilot one host for Bluff in Lebanese Arabic + FR (about 300–500 lines per language [E]) before the other games |
| D6 | Audience mode scope | Local spectators first (same room, extra phones), remote viewers later |
| D7 | Bluff point values. GAME-BLUFF §6.3 uses exactly Fibbage's numbers (1,000 / 500, ×1/×2/×3, help halves points) on top of the same 2 rounds + final. Each element is a free mechanic, but together they form the "stacked identical structure" the study rates **Medium** risk | Change the visible numbers and keep the ratios that matter (truth worth more than one fooled player). For example: truth 100 coins, each player fooled 60, likes 10, rounds ×1/×2/×3 *or* a 1-1-2 escalation with a no-truth final (D1); help costs a flat penalty instead of halving. Record the change in §6.2 |

---

## 10. README section draft (for the orchestrator to paste into README.md)

```markdown
## Blueprint: Jackbox-proven, JAMAA-made

JAMAA follows the formula that made Jackbox Games a hit with 200M+ players (one TV, everyone's phone,
15-minute comedy games, one payer) and aims it at the markets Jackbox ignores. Jackbox has no Arabic,
no RTL and no Middle East content; Netflix's Jackbox games list no MENA country.
- **We copy mechanics and patterns** (bluff-and-find, room votes, ×1/×2/×3 rounds, staged reveals,
  stuck-player help, audience and streamer modes). Rules are not protected by copyright.
- **We never copy names, text, art, characters, music, sound or look-and-feel.** Everything is
  written, drawn and composed by us, rooted in Levantine and Mediterranean culture.
- **We undercut on price:** free games with starter content, plus one JAMAA Pass for every game,
  below the price of one $29.99 Jackbox pack a year, with regional prices (Gulf, Levant, Egypt, LatAm).
- Roadmap: Mish Ana! → Bluff → Who's Most Likely To → Trivia (Lebanon quiz) → candidates.
Read [docs/JACKBOX-STUDY.md](docs/JACKBOX-STUDY.md) (evidence) and [docs/BLUEPRINT.md](docs/BLUEPRINT.md) (decisions).
```
