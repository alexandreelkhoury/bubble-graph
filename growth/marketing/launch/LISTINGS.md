# Listings: AlternativeTo, Product Hunt, Indie Hackers, itch.io, YouTube

Paste-ready. Same facts everywhere, checked against README.md and docs/DEV.md. Status wording to keep consistent across every listing:

> Playable now, free, in any browser. The Android TV / Google TV app is in Google Play testing and not public yet.

Link: `https://play.mishana.workers.dev/tv`
Placeholders: `{{NAME}}`, `{{X_HANDLE}}`.

Trademark rule (from `growth/marketing/play-store/LISTING.md` §0): never put "Undercover", "Mr. White", "Spyfall" or "Imposter Party" in a title, tagline, tag or keyword field. Naming them as "games in the same genre" inside a comparison (AlternativeTo's "alternative to" link, an honest FAQ answer) is fine; the AlternativeTo "alternative to" relation is exactly that, and it's how the site works.

---

## 1. AlternativeTo

Where: alternativeto.net → sign in with a verified email → add a new app. Per the FAQ (https://alternativeto.net/faq/): the free queue "usually sits in our backlog for at least a few months"; a $5 priority review is "usually reviewed within 1-2 business days" and "does not buy approval". **Unreleased or closed-beta apps are rejected**, so list the free browser version only and leave Android TV out until the Play listing is public. Submit in the prep week (LAUNCH-PLAN.md); pay the $5 if you want it live during the launch window.

**Name**
```
Mish Ana!
```

**Website**
```
https://play.mishana.workers.dev/tv
```
(Swap to the landing page when `mishana-site` is deployed; keep the `/tv` link in the description.)

**Short description / tagline**
```
Secret-word party game for your TV. Phones are the controllers, no app needed.
```

**Description**
```
Mish Ana! ("not me!" in Lebanese) is a social-deduction word party game for 3 to 12 players, played on one shared screen.

The TV (or any laptop or TV browser) shows a QR code. Everyone scans it with their phone and gets a secret word in the browser: no app to install, no account, iPhone or Android. Most players get the same word, for example PIZZA. One player, the Mole, gets a slightly different one (PASTA) and isn't told. In bigger groups a Blank gets no word and has to bluff. Players take turns giving one-word clues, vote on their phones, and the TV reveals who was out.

- 3 to 12 players, on one TV or laptop screen
- Each player's word stays on their own phone; the TV never shows it during play
- English, French and Arabic (full right-to-left), with Lebanese word packs
- Free to play. The browser version works today; the Android TV / Google TV app is in Google Play testing

Made by a solo developer from Lebanon.
```

**Platforms**: Online / Web-based, Android TV (add Android TV only once the Play listing is public; until then Web only, otherwise it's a false platform claim).
**License**: Free (not "Open Source": the code is not public).
**Categories / tags**: Games → Party game; tags: `party-game`, `word-game`, `social-deduction`, `multiplayer`, `local-multiplayer`, `tv`, `browser-game`, `arabic`.

**"Alternative to" relations to add** (on the target app's page: "Contribute to this page" → "Suggest Alternatives"; never create entries for other people's apps). Checked 2026-10-04:
- **The Jackbox Party Pack**: https://alternativeto.net/software/the-jackbox-party-pack/ (25+ alternatives incl. AirConsole, HappyFunTimes; same shared-screen + phones format). Best target.
- **Imposter Game**: https://alternativeto.net/software/imposter-game/ (browser-based, added July 2026). Same genre.
- **HappyFunTimes**: https://alternativeto.net/software/happyfuntimes and **Gametje**: https://alternativeto.net/software/gametje (phones-as-controllers party platforms).
- Not available: there is no AlternativeTo entry for the Undercover word party app, and `/software/spyfall/` is an unrelated Steam spy game. Don't target those.

**Why this matters**: an AlternativeTo page ranks in Google for "alternatives to Jackbox / imposter game" searches, and it gives the game a stable third-party description that search engines and AI assistants can pick up. Be realistic: citation studies show Reddit and YouTube as the most-cited sites by AI assistants; no study found shows AlternativeTo or Product Hunt being cited often (see LAUNCH-PLAN.md §4). Ask two or three people who actually played to leave an honest comment; fake accounts or vote incentives lower your ranking there (FAQ).

---

## 2. Product Hunt

Launch day: **after the Play listing is public** (see LAUNCH-PLAN.md). A Product Hunt staff member wrote "your launch won't be featured if it's in beta or on a waitlist" (https://www.producthunt.com/p/introduce-yourself/hey-new-here-but-confused), and a launch is a one-shot. Schedule it for 12:01 a.m. Pacific Time (https://www.producthunt.com/launch/guide). Rule: "You cannot ask people directly to upvote your product. Instead, ask them to visit and comment." Personal account only; create it now and use it normally so it isn't brand-new on launch day.

If you do launch before the Play app is public, present the browser version as the product and the TV app as "coming", and expect not to be featured. The copy below is written for **after** the Play listing is live; swap the status lines if you launch earlier.

**Name**
```
Mish Ana!
```

**Tagline** (PH limit: 60 characters)
- Option A (53): `The secret-word party game for your TV, no app needed` → use this
- Option B (49): `Find the liar: a party game on your TV and phones`
- Option C (41): `Turn any TV into a secret-word party game`

**Description** (PH limit: 500 characters)
```
Everyone gets a secret word on their phone. One player's is slightly different and they don't know it. Give one-word clues, vote, and the TV reveals who's out. 3–12 players, no app on phones, EN/FR/Arabic. Free in your browser now.
```
(231 characters. After the Play release, end with: "Free on Android TV and Google TV, or in your browser.")

**Links**: Google Play listing + `https://play.mishana.workers.dev/tv`. Before the Play listing is public: the browser link only.
**Pricing**: Free.
**Topics**: Games, Board Games (or Party Games if available), Android, Web App, Indie Games.
**Status**: if PH asks, it's a free product with a working web version; don't tick anything that implies the Play app is out.

**Gallery order** (minimum 2 images, 1270×760 px recommended; export new images at that size from the assets, letterboxed on the brand purple `#1a0f24`-ish background, no "Get it on Google TV" button visible anywhere):
1. **Video**: the 16:9 film on YouTube (with the end card fixed; see X-THREAD.md media check). PH takes a YouTube link as the first gallery item.
2. **"PIZZA vs PASTA"**: `demo-en-pizza-held.png` and `demo-en-mole-held.png` side by side, caption "One word is different. Nobody knows whose."
3. **"Scan to join"**: your own screenshot of `/tv` lobby with the QR and two or three joined players.
4. **"The vote"**: screenshot of the vote reveal / OUT stamp on `/tv` (grab it from your own game or from the film at ~15 s).
5. **"Arabic, French, English"**: `demo-ar-pizza-held.png`, `demo-fr-pizza-held.png`, `demo-en-pizza-held.png` in a row.
6. **"Built with"**: simple card listing TV: Kotlin + Compose for TV · Phones: Preact web page · Server: Cloudflare Worker + Durable Objects.

**Thumbnail**: `app-icon-512.png` from `/home/alex/mishana-marketing/play-store/graphics/` (square, 240×240 recommended, under 3 MB).

**Maker's first comment**
```
Hi Product Hunt, I'm {{NAME}}, a solo dev from Lebanon.

Mish Ana! means "not me!" in Lebanese, which is what everyone says when they're accused in this game.

It's a secret-word social-deduction game for groups. Everyone gets a word on their own phone, one person (the Mole) has a slightly different word and doesn't know it, and you find them through one-word clues and a vote. The TV is the shared screen, phones are the controllers, and nobody installs anything on their phone: they scan a QR code.

What's real today:
- The browser version is free and playable now: open play.mishana.workers.dev/tv on a laptop or smart-TV browser and have everyone scan the QR. 3 to 12 players.
- The Android TV / Google TV app: [after Play release] "is on Google Play now: search Mish Ana on your TV or install it from the Play website onto your TV." [before] "is going through Google Play testing. It's not public yet."
- English, French and Arabic, with right-to-left Arabic and Lebanese word packs.

For the builders here: the server is a Cloudflare Worker with one Durable Object per room, the rules are a pure TypeScript engine that a simulator hammers with 200 bot games per player count, and the phone page is about 53 KB gzipped.

This genre already has great games. What I tried to do differently is the setup: no passing a phone around, no controllers, and a language most party games skip.

I'd love to hear what breaks, and whether 3-player games feel too easy. I'll be here all day answering.
```

**Launch-day replies**: answer every comment in your own words. Reuse the FAQ in REDDIT-POSTS.md but rewrite each time; PH readers notice copy-paste.

---

## 3. Indie Hackers

Where: indiehackers.com → post in the main feed (or the relevant group, e.g. "Building in Public" / "Side Projects") — see LAUNCH-PLAN.md for the current rules. IH readers want the story and the numbers you have, not a pitch. Use only numbers you measured (LAUNCH-PLAN.md §5); small honest numbers are fine there.

**Title**
```
I built a TV party game on Cloudflare's free tier. Here's the stack and what I'd do differently
```
Alternative: `Solo dev from Lebanon: shipped a browser version first while the Android TV app waits in review`

**Body**
```
Hi IH, I'm {{NAME}}, a solo developer from Lebanon. I've been building Mish Ana! ("not me!" in Lebanese), a secret-word party game where the TV is the shared screen and everyone plays from their own phone.

**The game in 20 seconds**
Everyone gets a secret word on their phone. One player, the Mole, gets a slightly different word (PIZZA vs PASTA) and isn't told. Players give one-word clues, vote on their phones, and the TV reveals who's out. 3 to 12 players. English, French and Arabic.

**Where it stands (honestly)**
- Browser version: live and free. Any laptop or smart-TV browser can be the TV: play.mishana.workers.dev/tv
- Android TV / Google TV app: built, heading into Google Play closed testing. Not public.
- Users and revenue: [Day 10: put only what you actually measured in week one, e.g. rooms created, groups who reported playing, bugs fixed. Revenue: none, nothing is for sale.]
- Money: free to play. In-app purchases (premium word packs) are planned for the TV app, not live.

**Stack, and why**
- TV: native Android TV app, Kotlin + Jetpack Compose for TV. A D-pad is the only input, so every screen is designed for the remote.
- Phones: a Preact web page, about 53 KB gzipped. No install was a hard rule: party guests won't download an app.
- Server: one Cloudflare Worker, one Durable Object per room. Each room is its own little stateful server. It's on the free tier.
- Game rules: a pure TypeScript engine shared by the server and a simulator that plays 200 bot games per player count (3 to 12) and checks the game always ends and no secret leaks.
- Sounds synthesised in code; the launch film made in code with Remotion.

**What I'd do differently**
[Write 2–3 real lessons. Suggestions to pick from, only if true for you:
- building the browser TV mode earlier, because it turned out to be the best demo and the only thing people can try before Play approval;
- talking to players before building payments;
- starting the Play Console setup earlier, since TV review and testing take time.]

**What I'm asking for**
If you have a group and a screen, try a round and tell me what broke or felt slow. And if you've launched a game or an Android TV app, I'd love to hear what actually moved the needle for you.
```

---

## 4. itch.io (browser page)

itch hosts HTML5 games as an uploaded ZIP with an `index.html` (https://itch.io/docs/creators/html5). Link-only pages are discouraged and can be removed from browse/search (https://itch.io/docs/creators/quality-guidelines), so upload a tiny `index.html` that embeds the TV page in a full-size iframe (`<iframe src="https://play.mishana.workers.dev/tv" allow="fullscreen; autoplay; screen-wake-lock" style="border:0;width:100%;height:100%">`). **Blocker found 2026-10-04:** `https://play.mishana.workers.dev/tv` sends `Content-Security-Policy: … frame-ancestors 'none'`, so it cannot be embedded on itch today. Options: (a) allow itch's game hosts in `frame-ancestors` for the `/tv` route only (itch serves HTML5 games from `*.itch.zone` / `*.hwcdn.net`; check the exact host in your browser's dev tools on your own uploaded page) and keep `'none'` for phone pages; or (b) skip itch until then. Don't publish a link-only page. After (a), test: the QR inside the iframe must still point to `play.mishana.workers.dev`, sound must start after a click, and fullscreen must work. A page gets indexed only once it's public, has a cover image and is playable (https://itch.io/docs/creators/getting-indexed).

- **Title**: `Mish Ana!`
- **Short description**: `A secret-word party game for 3–12 players. One screen, everyone plays on their phone.`
- **Kind**: HTML · "This file will be played in the browser" · viewport 1280×720, fullscreen button on.
- **Pricing**: No payments (or "donate" off; HTML5 games can only take donations anyway).
- **Genre**: Puzzle or "Other"; **tags** (max 10): `party-game`, `local-multiplayer`, `word-game`, `social-deduction`, `multiplayer`, `browser`, `arabic`, `phone-controller`, `casual`, `funny`.
- **Description**:
```
Everyone's innocent. Someone's lying.

Put this page on the biggest screen in the room. Everyone scans the QR code with their phone and gets a secret word: no app, no account. One player, the Mole, has a slightly different word and doesn't know it. In bigger groups, a Blank gets no word at all.

Give one-word clues, vote on your phones, and the screen reveals who's out.

• 3 to 12 players, phones as controllers (iPhone or Android)
• English, French and Arabic (right-to-left), with Lebanese word packs
• Free

An Android TV / Google TV app is in Google Play testing.
Made by a solo developer from Lebanon. Feedback and bug reports welcome in the comments.
```
- **Screenshots**: `demo-en-pizza-held.png`, `demo-en-mole-held.png`, `demo-ar-pizza-held.png`, plus your own `/tv` lobby and vote screenshots. Cover image 630×500 cropped from the feature graphic.
- **Devlog #1** (Day 5): a short post "How the TV and phones talk: one Durable Object per room", reusing the Show HN notes.

## 5. YouTube (the 16:9 film)

Upload the fixed 16:9 film (end card says "Play free in your browser" or is trimmed; see X-THREAD.md). Upload the 9:16 cut separately as a Short.

**Title** (keep the important part in the first ~60 characters; longer titles get cut in search results)
```
Mish Ana! – secret-word party game for your TV, free in your browser
```
Shorter alternative: `Mish Ana! | Secret-word party game for TV and phones`

**Description**
```
Everyone's innocent. Someone's lying.

Mish Ana! ("not me!" in Lebanese) is a secret-word party game for 3 to 12 players. The TV is the shared screen; everyone plays on their own phone by scanning a QR code. No app on phones, no controllers.

Everyone gets a secret word. One player, the Mole, has a slightly different word and doesn't know it. In bigger groups, a Blank gets no word at all. Give one-word clues, vote on your phones, and the TV reveals who's out.

▶ Play free in your browser now: https://play.mishana.workers.dev/tv
Open it on a laptop or a smart-TV browser, put it on the big screen, and have everyone scan the QR.

The Android TV / Google TV app is in Google Play testing and not public yet.

Languages: English, French, Arabic (with Lebanese word packs)
Made by {{NAME}}, a solo developer from Lebanon. Follow the build: https://x.com/{{X_HANDLE}}

This film was made entirely in code with Remotion (React). Music: "Take this Higher" from Mixkit. Sound effects: Mixkit.

#partygame #gamenight #indiegame
```
No chapters: YouTube needs at least three chapters of 10+ seconds each, so a 24-second film can't have them. Use chapters later on a longer gameplay or devlog video.

**Tags field**: party game, word game, social deduction, game night, Android TV game, Google TV game, browser party game, Lebanese, Arabic party game, secret word game.
**Category**: Gaming. **Audience**: not made for kids (it's a general-audience party game; "made for kids" disables comments, which you want for feedback).
**Pinned comment**: "Want to try it? Laptop or TV browser → play.mishana.workers.dev/tv → everyone scans the QR. Tell me what broke."

**Short (9:16)** title: `One of you has a different word. Who? #partygame` · description: first two lines + link + "Android TV app in testing, not public yet."
