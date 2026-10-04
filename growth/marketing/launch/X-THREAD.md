# X: build-in-public thread + follow-ups

Voice: one solo dev talking to other people who make things. Lowercase-ish, plain, no hype words, no "game-changer", no exclamation marks except inside the name. Every number here is checked against the repo (README.md, docs/DEV.md, `web-client` size check); do not add user, download or revenue numbers you don't have.

Placeholders: `{{NAME}}`, `{{X_HANDLE}}`.
Play link: `https://play.mishana.workers.dev/tv` (open on a laptop or TV browser; phones scan the QR).

## Before you post: media check (important)

| Asset | Use it? | Why |
|---|---|---|
| `/home/alex/mishana-video/out/final/MishAna-16x9.mp4` (23.8 s) | Yes, **after a fix** | The last 1.4 s (from ~22.4 s) shows a button "Available on Google TV". That is not true yet. Either change `growth/video/src/Film.tsx:571` to "Play free in your browser" and re-render all three cuts, or trim: `ffmpeg -i MishAna-16x9.mp4 -t 22.3 -af "afade=t=out:st=21.3:d=1" -c:v libx264 -crf 18 -c:a aac MishAna-16x9-web.mp4` (same for `-9x16` and `-1x1`). |
| `MishAna-9x16.mp4`, `MishAna-1x1.mp4` | Yes, same fix | Same end card. 1x1 is the safest crop on X. |
| Ads `MA-*.mp4` | **Not until the Play listing is live** | They end on an "Install on TV" card with a Google Play badge and "Or search 'Mish Ana' on your TV". Posting them now would promise something people can't do yet. |
| Landing screenshots `desktop-*`, `mobile-*` | Avoid for now | Every one shows a "Get it on Google TV" button and the landing site isn't deployed. `mobile-en-deal-mole.png` also says "You're the Mole!", which contradicts "the Mole isn't told" (it's the beginner-mode card) and will confuse people. |
| `demo-en-pizza-held.png`, `demo-en-mole-held.png`, `demo-ar-pizza-held.png`, `demo-fr-*` | Yes | Clean phone cards: PIZZA vs PASTA, Arabic, French. Crop the "Deal again" button off if you like. |
| `/home/alex/mishana-marketing/play-store/graphics/feature-graphic-1024x500.png` | Yes | Brand image, no store claim. |
| Your own screen recording of `/tv` + 2 phones | Strongly recommended | Real footage of the browser version beats any motion graphic for trust. 20–30 s, phone + laptop in one shot. |

---

## The thread (10 posts)

Post on a weekday morning US Eastern or early afternoon Beirut time (LAUNCH-PLAN.md, Day 1: 13:00 UTC). Attach media where marked. Put the link in the last post, not the hook, and pin the thread. Why: Buffer's analysis of 18.8M posts found link posts get near-zero median engagement on non-Premium accounts (https://buffer.com/resources/links-on-x/), even though X's product head says links aren't deboosted. Video in the hook, link at the end; if post 10 underperforms, repeat the link in a reply to post 1.

**1/ (hook)**
> I've been building a party game where your TV is the board and everyone's phone is their hand of cards.
>
> One of you has a slightly different secret word and doesn't know it.
>
> It's called Mish Ana! ("not me!" in Lebanese). You can play it tonight, free, in a browser. 🧵

Media: `MishAna-1x1.mp4` (fixed end card).
Alt text: "Short animated film of the game. A TV shows a QR code and a room code, players join from their phones, everyone sees a secret word, they give one-word clues like Cheese, Slice, Oven, and a yellow OUT stamp lands on the player who was voted out."

**2/ (the game in one post)**
> How it works:
> - everyone gets a word on their own phone: PIZZA
> - one player, the Mole, gets PASTA and isn't told
> - in bigger groups a Blank gets no word at all and has to bluff
> - one-word clues, vote on your phone, the TV stamps OUT
>
> 3 to 12 players.

Media: two images side by side: `demo-en-pizza-held.png` + `demo-en-mole-held.png`.
Alt text: "Two phone screens side by side. The left one shows the secret word PIZZA on a red card, the right one shows PASTA. Both look identical otherwise."

**3/ (why I built it)**
> Why: most phone versions of this kind of game make you pass one phone around the table. Someone peeks, someone forgets their word, and everyone ends up looking at a screen instead of each other.
>
> I wanted the TV to hold the drama and each phone to hold one secret.

(If you have a real story here, like a specific family night, use it instead. Your own story beats this line.)

No media (text-only posts in a thread read faster).

**4/ (no app on phones)**
> The rule I set on day one: nobody installs anything on their phone.
>
> You scan the QR on the TV, type a nickname, done. iPhone or Android, it's a web page.
>
> The phone page is about 53 KB gzipped (Preact). It has to load on bad Wi-Fi in a living room with 10 people on it.

Media: short screen recording of scanning the QR and joining (if you have it). Otherwise none.
Alt text: "A phone camera scans the QR code on a laptop screen, the browser opens a join page, the player types 'Maya' and appears on the TV."

**5/ (server)**
> Backend: one Cloudflare Worker, and one Durable Object per room.
>
> Each room is its own tiny stateful server that only exists while people are playing. The server is the referee: each phone only receives its own word, never anyone else's.
>
> It runs on the free tier.

**6/ (engine + simulator)**
> The game rules are a pure TypeScript engine shared by the server and a simulator.
>
> Before I trust a rule change, the simulator plays 200 bot games for every player count from 3 to 12 and checks invariants: the game always ends, roles add up, and no secret word ever leaks to the TV.

Media (optional): screenshot of a `pnpm sim` run in your terminal.
Alt text: "Terminal output of the game simulator: rows for 3 to 12 players, each with 200 games and zero failures."

**7/ (TV app)**
> The TV side is a native Android TV / Google TV app in Kotlin with Jetpack Compose for TV. The whole thing runs on the remote: D-pad and OK, no controllers.
>
> It's going into Google Play closed testing soon. Not live yet.

Media: `/home/alex/mishana-marketing/play-store/graphics/feature-graphic-1024x500.png`.
Alt text: "Mish Ana! logo, a pink speech bubble with an exclamation mark, and the line 'the secret-word party game for your TV'."

**8/ (Arabic)**
> I'm a solo dev from Lebanon, so Arabic wasn't an afterthought: full right-to-left on the TV and on phones, plus Lebanese word packs.
>
> Falafel or shawarma? Good luck bluffing that one at a family dinner.
>
> English and French too.

Media: `demo-ar-pizza-held.png`.
Alt text: "A phone screen in Arabic, right to left, showing the secret word 'بيتزا' (pizza) on a red card."

**9/ (the small, nerdy bits)**
> Small things I enjoyed:
> - every sound effect is synthesised in code, no sample packs
> - the launch film is also code: made with Remotion (React)
> - the TV never shows anyone's word during play, only at the end

**10/ (CTA)**
> You don't need the TV app to try it.
>
> Open this on a laptop or a smart TV browser, put it on the big screen, and everyone scans the QR:
> https://play.mishana.workers.dev/tv
>
> Free, no account. Play it free in your browser tonight and tell me what broke. I read every reply.

Media: none (let the link card show; if X shows no card, attach `demo-en-pizza-held.png`).

### If you want 12 posts instead of 10
- **Extra A (after 6):** "Hardest bug so far: a phone locks its screen mid-round. Every phone keeps a resume token, so it rejoins the same seat with the same word, and timers skip absent players instead of freezing the room."
- **Extra B (after 9):** "What I'd love feedback on: are 3-player games fun or too easy? Is the Blank too hard to play? Clue timer on or off by default?"

### After posting
- Reply to every comment in the first 2 hours. Short, real answers.
- Quote-post your own thread once, ~8 hours later, for the other timezone ("for the evening crowd: …"), not more.
- Do not tag big accounts asking for retweets.

### Follow-up reply ideas (keep under the thread, use when relevant)
1. Someone plays it: "Thank you for actually trying it. How many of you were there, and did anyone guess the Mole on round one?"
2. "Is this like Undercover / Spyfall?": "Same family of games, yes. The difference is the setup: the TV is the shared screen, each phone holds only your secret, and nobody installs anything on their phone. Plus Arabic with Lebanese packs."
3. "iPhone?": "Phones can be iPhones or Android, it's a web page. The TV app is Android TV / Google TV only for now. Any laptop can be the TV through the browser version."
4. Bug report: "Thanks, that's exactly what I need. What phone/browser was it? I'll reply here when it's fixed." (then actually reply when fixed)
5. Tech question about Durable Objects: answer with one concrete detail (one DO per room, state persisted on every change, hibernation so idle rooms aren't billed for wall-clock time) and offer to write a longer post if people want.
6. A week later: a reply with one real thing you changed because of feedback.

---

## 5 standalone posts for the following days

**Day +1: the screenshot**
> PIZZA or PASTA.
>
> One of these is your word. One of them belongs to the Mole. Neither of you knows which is which until someone gives a clue that's slightly off.

Media: `demo-en-pizza-held.png` + `demo-en-mole-held.png`. Alt text as in post 2.

**Day +2: tech detail (Durable Objects)**
> Things I like about one Durable Object per game room:
> - the room is the unit of state, no shared database
> - the room is the referee; phones only get their own projection of the game
> - idle rooms hibernate, so a living room that pauses for snacks isn't burning compute
>
> All on the Workers free tier so far.

No media, or a simple diagram (TV, phones, one box labelled "room").

**Day +3: Arabic / RTL**
> Building a TV game in Arabic taught me that RTL isn't a mirror button. Names in Latin letters inside Arabic sentences, numbers, timers, the order of player tiles: each one needed a decision.
>
> Here's the same moment in English, French and Arabic.

Media: `demo-en-pizza-held.png`, `demo-fr-pizza-held.png`, `demo-ar-pizza-held.png`.
Alt text: "Three phone screens showing the same secret-word card: PIZZA in English, PIZZA in French, بيتزا in Arabic."

**Day +4: the sound post (#ScreenshotSaturday works if it lands on a Saturday)**
> Every sound in the game is generated by a script, not downloaded: the vote countdown, the OUT stamp, the remote clicks. 26 cues, rendered to OGG for the TV and the phones.
>
> Turn your sound on for this one.

Media: 10–15 s screen recording of an elimination with the sound on (record it yourself from `/tv`).
Alt text: "A round ends: votes are revealed together on the TV, one player tile shakes, and a yellow OUT stamp lands on it with a thump."

**Day +5: honest status**
> Status check on Mish Ana!:
> - browser version: playable now, free
> - Android TV / Google TV app: going into Play closed testing
> - next: [the one thing feedback asked for most]
>
> If you have a Google TV and want to test the app early, reply and I'll add you when testing opens.

No media, or the TV banner `/home/alex/mishana-marketing/play-store/graphics/tv-banner-1280x720.png` (alt: "Mish Ana! TV banner with the logo on a dark purple background").
