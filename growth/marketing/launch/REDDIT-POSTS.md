# Reddit posts (+ Show HN)

One post per community, each with a different angle. Rules and sources are in LAUNCH-PLAN.md §2. Read the live rules page of each sub on the day you post: the research couldn't load Reddit directly (Reddit blocks automated fetches), so the rules here come from dated archives and rule-mirror sites.

Placeholders: `{{NAME}}`, `{{X_HANDLE}}`.
Link: `https://play.mishana.workers.dev/tv`

## Rules for every post

1. **Say it plainly: "I'm the solo dev."** First person, in the first two lines.
2. **Status, every time:** browser version playable now and free; Android TV / Google TV app in Play testing, not public. No "out now on Google TV".
3. **Never put "Undercover", "Mr. White" or "Spyfall" in a title.** UNDERCOVER is a registered US trademark of Yanstar Studio OÜ (Reg. 8112944, Jan 2026, covers game apps and party games: https://tsdr.uspto.gov/statusview/sn79421860), and SPYFALL is registered to HW Group / Hobby World (Reg. 7940351: https://tsdr.uspto.gov/statusview/sn88910138). Naming them in a comment to describe the genre ("same family as…") is fine; using them as a hook or keyword is not.
4. **Media:** use the fixed film or your own screen recording, and the `demo-*` phone cards. Not the `MA-*` ads or the landing screenshots (they show "Get it on Google TV" / an install card; see X-THREAD.md "media check").
5. **Write it yourself.** These drafts are a starting point. r/androiddev removes "content indicative of LLM output", HN readers punish it, and every sub notices copy-paste. Change the wording, add one thing that only you know (a real playtest moment, a bug that cost you a weekend).
6. **Stay for 2–3 hours after posting** and reply to every comment. Don't edit the link into other people's threads.
7. **No vote asking**, no friends upvoting, no crossposting the same text to several subs on the same day.
8. **AI disclosure:** several subs restrict generative-AI content (r/indiegames removes "any generative-AI content", r/IndieGaming requires disclosure, r/boardgames bans "vibe-coded" apps, r/jackboxgames bans AI content). If you used AI tools for code, words or art, decide your honest one-line answer before posting (see FAQ) and skip subs whose rule your project breaks.

---

## 1. r/SideProject (dev story, broadest)

**Flair:** pick the closest available (e.g. "Show & Tell" or similar; check the flair list when posting).
**Media:** text post with the film embedded as a video (Reddit native upload of the fixed `MishAna-16x9.mp4`) or your own 20–30 s recording of laptop + phones.
**Title:**
```
I built a party game where the TV is the board and everyone's phone holds a secret word. No app on phones, playable free in the browser
```
**Body:**
```
Hi, I'm a solo dev from Lebanon. This is Mish Ana! ("not me!" in Lebanese), a secret-word party game for 3 to 12 people.

How a round goes: everyone scans a QR code on the big screen and gets a word on their own phone, say PIZZA. One player, the Mole, gets PASTA and isn't told. In bigger groups a Blank gets no word at all. You go around giving one-word clues, vote on your phones, and the TV reveals who's out.

What I cared about:
- nobody installs anything on their phone (it's a web page, iPhone or Android)
- no passing one phone around the table, no controllers
- Arabic done properly (right-to-left, Lebanese word packs), plus English and French

Stack, for the curious: Android TV app in Kotlin + Jetpack Compose for TV, phones are a ~53 KB Preact page, server is a Cloudflare Worker with one Durable Object per room, and the rules are a pure TypeScript engine that a simulator runs 200 bot games per player count against.

Status: the Android TV / Google TV app is heading into Google Play testing, so it's not public yet. But you can play today, free, no account: open play.mishana.workers.dev/tv on a laptop or a TV browser, put it on the big screen, and everyone scans the QR.

I'd really like to know what breaks, and whether 3-player games are fun or too easy.
```

---

## 2. r/IndieDev (design/process angle, different from r/SideProject)

**Flair:** something like "Video" or "New Game" (check list).
**Media:** native video: your own recording of a full round sped up, or the fixed film.
**Title:**
```
Designing a party game for a TV remote and ten phones at once: what I learned building Mish Ana!
```
**Body:**
```
Solo dev here. I've been building a social-deduction word game where the TV is the shared screen and each player's phone shows only their secret word. One player has a slightly different word and doesn't know it.

A few design problems that turned out harder than the game itself:

1. Two input devices with opposite jobs. The TV is driven by a D-pad and OK only, so every TV screen had to work with focus and nothing else. Phones carry the private stuff: your word (press and hold to peek), your vote.
2. People's phones lock mid-round. Every phone keeps a resume token, so it rejoins the same seat with the same word, and timers skip absent players so the room never freezes.
3. The TV must never spoil anything. The server sends each screen only its own view of the game; the TV only sees words at the end. A simulator plays 200 bot games for each player count from 3 to 12 and fails if a secret ever reaches the TV.
4. Arabic right to left on a TV, with Latin names and numbers inside Arabic text. Not a mirror button.

It's free to play in a browser right now (any laptop or TV browser as the screen): play.mishana.workers.dev/tv
The Android TV / Google TV app is going into Play testing; not public yet.

Happy to go deeper on any of these. What would you want from the TV side of a party game?
```

---

## 3. r/indiegames (player-facing, gameplay media required)

Rule from the research: promotion posts must include gameplay media; max 2 posts per week; no "promotion disguised as a request for feedback"; no generative-AI content. Check the AI point honestly before posting.

**Flair:** e.g. "Video" / "Promotion" (check list).
**Media (required):** gameplay video. Use your own recording of a real round (TV + phones). The fixed film is acceptable as a trailer but a real round is better here.
**Title:**
```
Mish Ana!, a secret-word party game for 3–12 players: the TV is the board, your phone holds your word
```
**Body:**
```
I'm the solo developer. Everyone gets a secret word on their phone. One player, the Mole, has a slightly different word and doesn't know it. One-word clues, vote on your phone, and the TV stamps OUT.

Free to play in your browser now (laptop or TV browser as the shared screen, phones scan a QR, no install): play.mishana.workers.dev/tv
Android TV / Google TV app in Play testing, not public yet. English, French and Arabic.
```

---

## 4. r/lebanon (local angle; message the mods first)

Rule 7 asks for mod approval before advertising. Send this modmail 3–5 days before:

> Hi mods, I'm a solo dev from Lebanon and I made a free party game with Lebanese word packs (Arabic, plus English and French). Would a single post about it be OK, flaired as you prefer? It's free, no ads in the post, no sign-up, playable in the browser. Happy to adjust anything.

**Flair:** whatever the mods say (likely "Culture" or "Discussion"); add `[OC]` if they want it (Rule 6 asks for [OC] on your own work).
**Media:** `demo-ar-pizza-held.png` (Arabic phone card) or a short recording of an Arabic round. Post on a weekday evening Beirut time, when people are home (judgement, no data).
**Title** (English + Arabic):
```
[OC] I made a Lebanese party game for the TV: falafel or shawarma, who's lying? | عملت لعبة سهرات عالتلفزيون
```
**Body:**
```
مرحبا. I'm a solo dev from Lebanon and I built Mish Ana! (مش أنا!), a party game for family nights and سهرات.

Everyone scans a QR code on the TV with their phone and gets a secret word. Everyone has the same word, except one person who gets a slightly different one and doesn't know it. Everyone gives a one-word clue, you vote, and the TV shows who's out. Basically the game ends in everyone shouting "مش أنا!".

The Arabic is right-to-left everywhere, and there are Lebanese packs: Lebanese food and Lebanese everyday life, the words we actually use. English and French too, so mixed groups work.

It's free. The Android TV / Google TV app is still in testing, but you can play now from any laptop or TV browser: play.mishana.workers.dev/tv. Everyone scans the QR, no app to download.

I'd love Lebanese words you think should be in the game, and any pair that feels wrong.

[Rewrite the Arabic in your own dialect. Add one real moment from playing with your family or friends if you have one.]
```

---

## 5. r/AndroidTV (TV owners; 10:1 participation rule; ask mods)

Rule 8 says self-promo follows the 10:1 ratio and you can ask the mods for an exception; Rule 1 requires a flair; Rule 3 sends Google TV *device* posts to r/GoogleTV (an app for Android TV in general belongs here). Comment helpfully in the sub for 1–2 weeks first.

**Flair:** the app/discussion flair (check list).
**Media:** feature graphic or a photo of it on a real TV with phones in hand. A real photo of your own TV is the strongest thing you can post here.
**Title:**
```
I made a party game for Android TV where everyone plays from their phone (no controllers, no phone app). You can try the browser version free today
```
**Body:**
```
I'm the solo dev, posting with the mods' OK [only if you got it].

Mish Ana! is a secret-word party game for 3–12 players. The TV shows a QR code, everyone scans it and gets a secret word on their phone in the browser. One player has a slightly different word and doesn't know it. One-word clues, vote on phones, and the TV reveals who's out.

The TV app is native: Kotlin + Jetpack Compose for TV, everything works with the remote's D-pad and OK.

Honest status: it's heading into Google Play closed testing and isn't public yet. In the meantime the same game runs in a browser: open play.mishana.workers.dev/tv on a laptop connected to the TV (or a TV browser), and phones scan the QR.

Two questions for this sub:
- what TVs/boxes do you use? I want to test on the ones people actually own
- would you want to be in the closed test? Reply and I'll message you when it opens
```

## 6. r/GoogleTV (post only when closed testing opens: tester call)

Small sub (~17k), active. Best angle is concrete: "I need testers on real Google TV devices".
**Flair:** app/recommendation flair (check list).
**Title:**
```
Looking for a few Google TV testers for a free party game (phones are the controllers)
```
**Body:**
```
I'm the solo dev of Mish Ana!, a secret-word party game for 3–12 players. The TV shows a QR, everyone plays from their phone's browser, nothing to install on phones.

The Google TV app is in Google Play closed testing and I want it to work on real devices before it's public: Chromecast with Google TV, Google TV Streamer, TCL/Hisense/Sony sets.

If you'd like to test, comment with your device and I'll send the opt-in link. You can also see the game right now in a browser: play.mishana.workers.dev/tv.

What I'll ask from testers: play one round, tell me what was confusing or slow with the remote.
```
(Check the sub's live rules first; r/androiddev explicitly bans recruiting testers, other subs may too.)

---

## 7. r/partygames (small, friendly to indie devs)

~1.6k members (Jul 2025 snapshot), low activity, devs post their own games there. Low risk, low reach; good for honest gameplay feedback.
**Title:**
```
Made a free secret-word party game for 3–12 players: everyone plays on their phone, the TV (or a laptop) is the board
```
**Body:**
```
Solo dev here. Everyone gets a word on their phone; one player's word is slightly different (PIZZA vs PASTA) and they don't know it; in bigger groups one player gets no word. One-word clues, then a vote.

Free in your browser now: open play.mishana.workers.dev/tv on whatever screen everyone can see, phones scan the QR. English, French, Arabic.

If you play it with your group, I'd love to know: how many of you were there, and how many rounds before someone figured out the trick of the different word?
```

---

## 8. r/playmygame (free games only, 1 post per month)

Rules: free to play (yes), description, your role on the project, direct link to the game first, truthful claims about AI and art.
**Title:**
```
[Browser] Mish Ana! – secret-word party game, 3–12 players on one screen + phones
```
**Body:**
```
Link: https://play.mishana.workers.dev/tv

Role: solo developer (design, code, art, sound).
[Adjust if anyone helped or if any assets are third-party. Word lists: EN/FR were seeded from an MIT-licensed dataset and then edited; say so if asked.]

What it is: a social-deduction word game. Open the link on a laptop or TV browser as the shared screen; each player scans the QR and gets a secret word on their phone. One player's word is slightly different. Give clues, vote, find them.

Platform: any modern browser (phones: iPhone or Android). Android TV app in testing.
Feedback I want: is the join flow clear, and are the word pairs too easy?
```

---

## 9. r/WebGames (only if the mods say yes)

Rule P7 bans games that require a smartphone. Ours needs phones to play, so ask first:

> Hi mods, I'm the dev of a free browser party game. One browser tab is the shared screen and players join from their phones' browsers (no app, no sign-up). Does that count as "requires a smartphone" under P7? If it does, no problem, I won't post.

If approved: **link post** to `https://play.mishana.workers.dev/tv`, title must start with the game's name:
```
Mish Ana! – a secret-word party game: one screen, everyone joins from their phone's browser (3–12 players)
```
Comment right after: "I'm the dev. You need at least 3 people with phones in the same room (or on a video call). Feedback welcome."

---

## 10. r/AndroidGaming (later: after the Play listing is public)

Rules: title starts with `[DEV]`, 1 promo post per 30 days, promo under 10% of your activity, account 1+ month old with 50+ karma in the sub, Play Store link preferred, never an APK link. Don't post until the Play listing is live.
```
[DEV] Mish Ana! – a free party game for Android TV: the TV is the board, everyone plays from their phone
```

---

## Show HN (Hacker News)

Not Reddit, but the same "posts" pile. HN restricted Show HN posts from new accounts in March 2026 (dang: "a bit of community participation is reasonable before posting a Show HN", https://news.ycombinator.com/item?id=47300329). Use an account with some real comment history. Rules: https://news.ycombinator.com/showhn.html (must be easy to try without sign-up: yes; you must be around to discuss).

**Title** (no "!", no superlatives; HN strips them anyway):
```
Show HN: Mish Ana – a party game on your TV, phones join by QR, no install
```
Alternative (tech-first):
```
Show HN: A party game where each room is a Cloudflare Durable Object
```

**URL:** `https://play.mishana.workers.dev/tv`

**Text (first comment, posted right after submitting):**
```
Hi HN, I'm a solo dev from Lebanon. Mish Ana! ("not me!") is a secret-word social-deduction game: everyone gets a word on their phone, one player gets a slightly different one and doesn't know it, and you find them through one-word clues and a vote. The TV (or any browser tab on a big screen) is the shared board.

To try it you need a screen and at least 3 phones: open the link, everyone scans the QR. No account.

Some technical notes:

- Server: one Cloudflare Worker, and one Durable Object per room. The DO is authoritative: it runs the game engine and sends each connection only its own projection of the state, so the TV never receives a word until the results screen and a phone only ever gets its own word. Rooms hibernate when idle and delete their storage when they expire.
- Engine: a pure TypeScript reducer shared by the server and a headless simulator. The simulator plays 200 bot games per player count (3 to 12) and checks invariants, termination, and that no secret reaches the TV view. It can also run over the real WebSocket protocol against a live server.
- Phones: Preact, about 53 KB gzipped, with a CI size budget of 60 KB because the page has to load fast on crowded living-room Wi-Fi.
- TV: native Android TV app in Kotlin + Compose for TV, D-pad only. It's going into Google Play testing; the browser version is what's live.
- Reconnection: phones keep a resume token; if a screen locks mid-round, the player gets the same seat and word back, and timers skip absent players.
- Arabic RTL on both TV and phone (player names wrapped in <bdi> so Latin names don't scramble Arabic sentences). When the no-word player guesses the word, matching ignores case, accents and Arabic diacritics and unifies alef/ya/ta-marbuta variants.
- Sound cues are synthesised by a script (no samples). The promo film was made in Remotion.

Happy to answer anything about Durable Objects for real-time games, the projection model, or building for Android TV.
```
Note: check the phone-bundle sentence against your latest build (`pnpm --filter @mishana/web-client build` printed 52.55 KB gz on 2026-10-04) and simplify it; "about 53 KB gzipped" is enough.

Timing: Sunday around 12:00 UTC did best in a study of 157k Show HN posts (https://www.myriade.ai/blogs/when-is-it-the-best-time-to-post-on-show-hn). Weekend = less competition but less traffic. If it sinks, don't delete and repost; a single repost later is tolerated (HN FAQ).

---

## FAQ: comments you'll get, and honest replies

Rewrite in your own words each time; these are the facts to stay inside.

**"Is it free?"**
> Yes. Today everything is free and unlocked, no account. Later I plan optional paid word packs in the TV app; the game itself and a free set of words will stay free. Nothing is for sale right now.

**"Where's the Play Store link?"** / **"Is it on Google TV?"**
> Not yet. The Android TV / Google TV app is going into Google Play closed testing. Until it's public, the browser version is the way to play: open play.mishana.workers.dev/tv on a laptop or TV browser. If you want to be a tester, tell me your device.

**"Why not iOS / Apple TV?"**
> Phones can be iPhones; the phone side is a web page, so any phone with a browser works. The TV app is Android TV / Google TV only because I'm one person and had to pick one TV platform first. On Apple TV today you can host from a Mac browser and mirror it with AirPlay. A native Apple TV app isn't planned right now.

**"Isn't this just Undercover / Spyfall / that imposter game?"**
> It's the same family of games, and I'm not hiding that: secret words, one player with a different word, a player with no word. Those games are great. What's different here is the setup: the TV is the shared board and each phone shows only your own word, so nobody passes a phone around and nobody needs to install an app or own controllers. It also has Arabic with right-to-left and Lebanese word packs, which most of these games skip. The roles and wording are my own (the Mole, the Blank).

**"Where do the words come from?"**
> The English and French lists started from an MIT-licensed open word-pair dataset, which I filtered and edited (brand names, people, alcohol and duplicates removed; credited in the project's third-party notices). There was no open Arabic dataset, so the Arabic and Lebanese packs were written for the game. If a pair feels wrong, tell me and I'll fix it.

**"Did you use AI to make this?"**
> [Answer truthfully, in one line, before you post anywhere. E.g. what was AI-assisted (code? copy? none?) and what wasn't (game design, Arabic words, art direction). The promo film is code (Remotion) with stock music from Mixkit; game sounds are synthesised by a script. If a sub bans AI-assisted projects and yours is, don't post there.]

**"Does it need everyone on the same Wi-Fi?"**
> No. The phones talk to a server on the internet (Cloudflare), so phones on mobile data work too. Everyone just needs to see the shared screen.

**"Can we play remotely?"**
> It's made for one room, but it can work on a video call: one person shares the screen with the TV page, everyone joins on their phone, and clues are said out loud.

**"How many players?"**
> 3 to 12. It's best around 5–8 in my experience [only keep this if it's true for you]. With more players you get more Moles and a Blank.

**"What data do you collect?"**
> No account. Players type a nickname for the room. Rooms and nicknames are deleted automatically when the room expires. The server doesn't log names or words.

**"Why a TV app at all if the browser works?"**
> Most people's TVs don't have a usable browser, and a native app on the remote is the easiest way to get the board on the big screen for a family night. The browser version is great if you have a laptop with HDMI or a cast-able tab.

**"Is it open source?"**
> No, the code isn't public. Happy to talk about how any part works.

**"It broke / my phone can't join."**
> Thanks, really. What phone and browser, and what did the screen show? [Then fix it and reply in the same thread when it's fixed.]

**"Cool, but who's going to buy word packs?"** (IH/HN types)
> Maybe nobody, I don't know yet. That's why the game is free now: first I want to see if groups come back for a second night.
