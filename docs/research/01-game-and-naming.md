# 01 — Game rules, UX patterns, naming

Research date: 2026-10-03. Method note: the sandbox egress proxy blocked direct fetches of yanstarstudio.com,
apps.apple.com, play.google.com, wikipedia, EUIPO/USPTO/WIPO. Facts below come from **web-search result
snippets** of those pages (URLs cited) plus one direct fetch (GitHub). Anything not backed by a snippet is
marked **unverified**. Re-check the official pages manually before shipping.

---

## 1. Undercover / Mr. White — rules

### 1.1 Roles

| Role | Gets | Goal | Source |
|---|---|---|---|
| Civilian | The shared secret word | Eliminate every Undercover and Mr. White | [Yanstar rules](https://www.yanstarstudio.com/undercover-how-to-play), [GitHub clone](https://github.com/antebrl/undercover-word-game) |
| Undercover | A word *slightly different* from the Civilians' | Survive until only 1 Civilian remains | same |
| Mr. White | **No word** (must improvise) | Same as Undercover, **or** guess the Civilian word when eliminated | same |

- Undercover and Mr. White together are called "Impostors"/"Infiltrators"; players don't know their own role, only their word ("everyone has forgotten their identity") — [Yanstar rules](https://yanstarstudio.com/undercover-how-to-play).
- Official app supports **3–20 players** and auto-suggests role counts; counts can be adjusted or randomised — [App Store listing](https://apps.apple.com/app/id946882449).

### 1.2 Round structure

| Phase | Rule | Source |
|---|---|---|
| Description | A **random player** starts; one by one, each gives a short *truthful* description (word/phrase) of their word | [Yanstar rules](https://www.yanstarstudio.com/undercover-how-to-play), [GitHub](https://github.com/antebrl/undercover-word-game) |
| Discussion | Debate / alliance-building | [GitHub](https://github.com/antebrl/undercover-word-game) |
| Vote / elimination | Vote out the player who seems to have a different word | [Yanstar rules](https://yanstarstudio.com/undercover-how-to-play) |
| Mr. White guess | If the eliminated player is Mr. White, he gets **1 chance** to guess the Civilian word; correct → **Mr. White wins immediately** | [Yanstar FAQ](https://www.yanstarstudio.com/undercover-faq) |
| Repeat | Cycle until a win condition | [GitHub](https://github.com/antebrl/undercover-word-game) |

- **Speaking order / who starts**: official source says only "random player starts". A third-party rules page states "an Undercover or Mr White should not start the game" — [pnwchords](https://pnwchords.com/undercover-game/). Whether the official app enforces "Mr. White never first" is **unverified** (widely believed; recommend implementing it: random starter drawn from non-Mr.-White players).
- **No repeated descriptions** (a clue can't be reused) — third-party house rule, [pnwchords](https://pnwchords.com/undercover-game/); official status **unverified**.
- **Elimination reveal**: whether the app reveals the eliminated player's role vs. only "Civilian/not Civilian" is **unverified**. (Lovers' identity "is revealed only at this sad moment", implying roles are shown on elimination — [Special roles](https://www.yanstarstudio.com/undercover-special-roles).)

### 1.3 Win conditions (parity specifics)

| Condition | Result | Source |
|---|---|---|
| All Undercovers **and** all Mr. Whites eliminated | Civilians win | [GitHub](https://github.com/antebrl/undercover-word-game), [Yanstar FAQ](https://www.yanstarstudio.com/undercover-faq) |
| Impostors survive until **only 1 Civilian left** | Impostors (Undercover and/or Mr. White) win | same |
| ≥1 Undercover **and** ≥1 Mr. White alive when 1 Civilian left | Undercover + Mr. White **win together** | [Yanstar FAQ](https://www.yanstarstudio.com/undercover-faq) (snippet) |
| Eliminated Mr. White guesses the Civilian word | Mr. White wins immediately (individual win; whether alive Undercovers also "win" is **unverified**) | [Yanstar FAQ](https://www.yanstarstudio.com/undercover-faq) |

Implications for our engine:
- **Mr. White counts as an infiltrator** for the end check (threshold is "Civilians alive ≤ 1", not a strict impostor-vs-civilian count parity).
- "Only Undercover + Mr. White remain" is unreachable: the game already ends when Civilians hit 1.
- Note this is *not* the Werewolf-style "impostors ≥ civilians" parity; with e.g. 2 C + 3 U alive the game continues under official rules. (Inferred from the stated rule; **unverified** in-app edge cases.)
- Edge: a Mr. White guess happens *before* the civilian-count check (he wins immediately on correct guess).

### 1.4 Tie-breaks

- With **Goddess of Justice** active: she decides who is ousted on any tie, even after being eliminated — [Special roles](https://www.yanstarstudio.com/undercover-special-roles), [Goddess update](https://www.yanstarstudio.com/undercover-updates/goddess-of-justice-online).
- Without her, the app suggests 3 options: (1) rock-paper-scissors, (2) tied players give **1 more description each**, then remaining players re-vote, (3) enable Goddess — [Yanstar FAQ](https://www.yanstarstudio.com/undercover-faq) (snippet). No "no elimination" rule found.
- Recommendation for TV version: default = option 2 (re-describe + re-vote among tied); if still tied → random among tied (shown as a dramatic "wheel"). Configurable.

### 1.5 Special roles / variants in the official app

| Role/mode | Mechanic | Min players | Source |
|---|---|---|---|
| Multiple Mr. Whites / Undercovers | Counts adjustable or random | — | [App Store](https://apps.apple.com/app/id946882449) |
| The Lovers | 2 secret lovers (any teams); if one is ousted, the other is too; revealed then | 5 | [Special roles](https://www.yanstarstudio.com/undercover-special-roles) |
| Mr. Meme | Each round one random player must describe with **gestures only**; announced at round start | — | same |
| The Revenger | When eliminated, takes another player down with her | 5 | same |
| Goddess of Justice | Breaks vote ties, even after elimination | — | same |
| The Joy Fool | If first player eliminated by majority vote → +4 bonus points | — | [Joy Fool post](https://www.yanstarstudio.com/undercover-updates/meet-the-joy-fool-jester) |
| Amnesic mode | Tap your name to see your word again (pass-and-play aid) | — | [Special roles](https://www.yanstarstudio.com/undercover-special-roles) |

Other roles may exist (the special-roles page says "and more"); not enumerated here — **unverified**.

### 1.6 Scoring (official app)

| Winner | Points each | Source |
|---|---|---|
| Civilians | 2 | [Yanstar rules](https://www.yanstarstudio.com/undercover-how-to-play) (snippet) |
| Mr. White | 6 | same |
| Undercover | 10 | same |
| Joy Fool bonus | +4 | [Joy Fool post](https://www.yanstarstudio.com/undercover-updates/meet-the-joy-fool-jester) |

- "Real-time ranking is displayed at the end of each round" — [Yanstar rules](https://www.yanstarstudio.com/undercover-how-to-play) (snippet).
- Whether losers / eliminated winners score, and whether co-winning U + W both score: **unverified**.

### 1.7 Role distribution 3–12 players

The official auto-suggest table is **not published** in any source found; the app "automatically suggests the best number of each role" — [App Store](https://apps.apple.com/app/id946882449). The table below is **our proposal (unverified vs. official app)**, designed so impostors < half and Mr. White only from 5 players.

| Players | Civilians | Undercover | Mr. White |
|---|---|---|---|
| 3 | 2 | 1 | 0 |
| 4 | 3 | 1 | 0 |
| 5 | 3 | 1 | 1 |
| 6 | 4 | 1 | 1 |
| 7 | 4 | 2 | 1 |
| 8 | 5 | 2 | 1 |
| 9 | 5 | 3 | 1 |
| 10 | 6 | 3 | 1 |
| 11 | 7 | 3 | 1 |
| 12 | 7 | 3 | 2 |

Allow host override (0–2 Mr. White, 1–⌊(n-1)/2⌋ Undercover) like the official app.

---

## 2. UX patterns from TV + phone party games

### 2.1 Jackbox (incl. Fakin' It)

| Topic | Observed pattern | Source |
|---|---|---|
| Join | TV lobby shows a **4-letter room code**; players open **jackbox.tv** in a phone browser, enter code + any name | [Fanatical support](https://support.fanatical.com/hc/en-us/articles/360000732457-Playing-Jackbox-Games) |
| VIP/host | **First player to join is VIP**; VIP presses **"Everybody's In"** to start | [Fanatical support](https://support.fanatical.com/hc/en-us/articles/360000732457-Playing-Jackbox-Games), [Steam thread](https://steamcommunity.com/app/442070/discussions/0/358415206096198643) |
| Reconnection | Refreshing the browser fixes most disconnects (rejoin same room/name) | [Fanatical support](https://support.fanatical.com/hc/en-us/articles/360000732457-Playing-Jackbox-Games) |
| Audience | Up to **10,000** audience members join with the same code after players fill/game starts; they vote | [PlayStation Blog](https://blog.playstation.com/2015/06/30/quiplash-new-party-game-expands-audience-participation-to-10000/) |
| Timers / settings | Timers can be **extended or switched off**; settings changeable mid-game; family-friendly filter | [Jackbox PP8 features](https://jackboxgames.com/streaming-moderation-accessibility-features-jackbox-party-pack-eight) |
| Moderation | Room-code hiding; human moderators; **kick players** (PP9+) | same, [PP9 kick](https://www.jackboxgames.com/the-ability-to-kick-players-and-other-new-features-coming-to-party-pack-9/) |
| Fakin' It loop | 3–6 players, 1 hidden Faker; task shown on phones (not to Faker); everyone acts at once ("hands up", "point", "number of fingers"); then vote on phones; Faker caught only if **everyone votes correctly**, else play continues (3 chances); Faker scores for evading | [Jackbox Wiki](https://jackboxgames.fandom.com/wiki/Fakin%27_It), [XboxHub review](https://www.thexboxhub.com/jackbox-party-pack-3-review/) |
| Reveal | Dramatic TV reveal after vote ("before the truth is revealed") | [Jackbox physical Fakin' It](https://www.jackboxgames.com/games/physical/fakin-it-board-game) |

### 2.2 AirConsole

| Topic | Pattern | Source |
|---|---|---|
| Join | Screen shows a **numeric code**; phones go to airconsole.com and type it; **QR scan** alternative; no app install | [Liliputing](https://liliputing.com/airconsoles-browser-based-game-platform-uses-your-phone-as-a-controller/), [AirConsole](https://airconsole.com/games/smartphone-as-game-controller) |
| Host | A **master controller** (`getMasterControllerDeviceId()`) drives menus | [AirConsole dev docs](https://developers.airconsole.com/device-ids-and-state) |
| Reconnection | Devices **keep the same device_id** across disconnect/reconnect within a session; don't assume consecutive IDs | same |
| Monetisation | Free tier limits players; "Hero" subscription (~$4.99) removes ads and allows >3 players | [Liliputing](https://liliputing.com/airconsoles-browser-based-game-platform-uses-your-phone-as-a-controller/) (search snippet) |

### 2.3 Actionable patterns for our game

- **Join**: big QR + short code (4 letters, no ambiguous chars like O/0, I/1) on TV; URL path `/<CODE>` so QR = one tap. Name + avatar/colour picker only.
- **Host = first joiner (VIP)** with "Everybody's in" button on phone; TV remote is a fallback host. Host can kick, change settings, pause.
- **Secret info only on phones** (word, role hints); TV shows public state only (who's alive, whose turn, timer, votes cast count).
- **Press-and-hold to reveal word** on phone (anti-shoulder-surf), with "Amnesic" re-peek always available.
- **Stable session token** in localStorage + reconnection by token (AirConsole-style stable ID); TV shows "reconnecting…" badge on the player's tile; game never blocks on one disconnected player (timer auto-skips).
- **Timers adjustable / off** (accessibility, Jackbox PP8); visible countdown on TV and phone.
- **Turn spotlight on TV**: highlight current describer; Mr. White never first.
- **Votes on phones, secret until all in**, then synchronized reveal animation on TV (vote arrows → eliminated player → role card flip).
- **Mr. White guess**: phone text input with timer; TV shows suspense screen; fuzzy match (accents, case, Arabic diacritics/alef variants) with host override "accept".
- **Audience mode** (optional later): spectators join with same code, vote "who's the impostor" for fun predictions, no effect on game.
- **Post-round scoreboard** (2/6/10 style points) with round recap of both words.
- **Room-code hide** for streamers; family filter for word packs.

---

## 3. Legal & naming

### 3.1 Is "Undercover" a trademark?

| Evidence | Finding | Source |
|---|---|---|
| Google Play title | "Undercover**®**: Word Party Game", dev Yanstar Studio OÜ | [Google Play (PC)](https://play.google.com/pc-store/games/details?id=com.yanstarstudio.joss.undercover) |
| Website / App Store | Uses "Undercover**™**" | [yanstarstudio.com](https://www.yanstarstudio.com/), [App Store](https://apps.apple.com/app/id946882449) |
| Registry (EUIPO/USPTO/WIPO) | **Could not verify** — registry sites blocked from sandbox; no search snippet gave a registration number | — |

Conclusion: the developer claims registration (®) — treat **"Undercover" (for games) as a registered mark; registration details unverified**. Also "Mr. White" is strongly associated with that app. Similarly "Imposter Party®" is claimed by another app ([App Store](https://apps.apple.com/app/id1562982547)). → Avoid "Undercover", "Mr. White", "Imposter Party" in our name/store listing; use our own role names (e.g. "the Blank" instead of Mr. White).

### 3.2 Name candidates

Play Store check caveat: play.google.com was blocked; checks were done via web search (`site:play.google.com` and unrestricted). "None found" = no hit in search, **not** a definitive clearance.

| Name | Meaning | Play Store / other conflict | Verdict |
|---|---|---|---|
| **Mish Ana!** (مش أنا) | Lebanese "Not me!" — the classic accusation-defence line | No app/game found; a **2016 Lebanese TV series** "Mish Ana" exists ([search](https://techvyro-movies.onrender.com/tv/120206)) — different class, low risk | **Recommended** |
| **Kelmet Ser** (كلمة سر) | Arabic "password / secret word" | No exact app found; many generic "imposter" apps ([example](https://apps.apple.com/app/6745120053)); generic Arabic phrase = weak trademark | OK, weak brand |
| **Fauxmot** | FR "faux mot" (false word) / EN "faux" | No exact match found; nearby "Fakeit: Imposter Game" ([AppFollow](https://apps.appfollow.io/ios/fakeit-imposter-game/6749012623?country=se)) | OK (FR/EN only, no AR resonance) |
| **Word Mole** | "mole" = spy | **Conflict**: "Word Mole" iOS app ([App Store](https://apps.apple.com/us/app/-/id1300522599)) and classic BlackBerry game ([Pocket Gamer](https://www.pocketgamer.com/word-mole/review/)) | Reject |
| **L'Intrus** | FR "the intruder" | Existing 1991 card game "L'Intrus" ([BoardGameMatcher](https://boardgamematcher.com/game/lintrus)); "L'Imposteur" word game ([Espritjeu](https://www.espritjeu.com/l-imposteur.html)); crowded generic term | Reject |

### 3.3 Recommendation

**"Mish Ana!"** (stylised *Mish Ana!* / مش أنا!), tagline e.g. "The secret-word party game — FR · EN · عربي".
- Distinctive, instantly understood by Lebanese players (code-switching AR/FR/EN audience), shouted naturally during play.
- Latin transliteration is easy for FR/EN speakers; Arabic logo variant works for RTL.
- No conflicting app found (search-based; **unverified**) — before launch: run a manual Play Store search, a Lebanese trademark search (Ministry of Economy & Trade IP office), and a WIPO Global Brand Database search in classes 9/28/41.
- Fallback: **Kelmet Ser** (more descriptive) or **Fauxmot** (if an FR/EN-first brand is preferred).
