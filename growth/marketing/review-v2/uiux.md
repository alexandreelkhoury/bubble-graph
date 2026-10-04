# Mish Ana! creative system: UX and conversion review (v2)

Reviewer lens: ui-ux-pro-max (viewer experience, comprehension, cognitive load) + copywriting (clarity, CTA). Reviewed 2026-10-04.

**What I looked at**
- All 11 renders in `growth/video/out/final/`: contact sheets at 4 fps with timestamps, plus mean luma measured with `signalstats`.
- Caption texts and beat timings from `growth/video/src/ads/*.tsx` and `Film.tsx`. 1 beat = 0.485 s, body = 22.75 beats = 11.0 s, end card = 8.25 beats = 4.0 s.
- `SCRIPTS.md`, `REVIEW.md`, `LAUNCH-PLAN.md`, `site/CRO-AUDIT.md` and `docs/DESIGN.md`.
- The landing page at http://192.168.0.6:8091/, captured with Playwright at 390×844 and 1440×900 (full page plus a scroll-through).

**How times are given.** Every time below is in seconds from the first frame of the ad. A caption's "on-screen" time is how long it is fully visible. It is shorter than its start–end span, because words rise in one at a time and leave early.

---

## 0. Verdict in five lines

1. **Pre-launch, none of the six ads can run as rendered.** All six end on an "Install it from your phone → Pick your TV → Google Play badge" card for an app that is not public yet. Viewers would click into a dead end. The single highest-impact change is a **pre-launch end card** that sells "Play free tonight in your browser" (change 1).
2. **"Sometimes too fast" is measurable.** About **25 caption cards are on screen for less than 1.0 s**. Several of them carry the one idea the viewer must get, "…and he doesn't know": M4 shows it for 0.49 s and M6 for 0.49 s. In the end card, "Done. Game on." gets 0.34 s, and the brand + badge frame gets about 1.4 s.
3. **"Sometimes too dark" is measurable too.** Mean luma of the ads is **22–27 / 255** (about 9–10 %). The product film is 34–36. A typical Reels/TikTok frame is around 90–130. The game UI also fills only 50–60 % of the 9:16 canvas, so on a dark-mode feed the ads read as a black rectangle with small coloured chips.
4. **In 5 of 6 ads, the first 1.5 s doesn't say what the product is.** M1, M3 and M4 never show a TV or the brand until the end card, at 11–16 s. Only M5 (TV home screen) and M6 (TV lobby) put the TV in frame 0.
5. **The angles are mostly right, but the set is missing two formats:** real faces (filmed UGC) and a plain "how it works" explainer with a voiceover. Those two matter most for cold viewers who have never heard of Undercover or Mr. White.

---

## 1. Per-ad scorecard (1–10)

The **CTA** column gives two scores: *pre-launch* (as rendered today, pointing at a store that isn't live) / *post-launch* (once the Play listing is public).

| Ad | Len | Hook (0–1.5 s) | Clarity (would a cold viewer get the game?) | Pace (readable?) | CTA | Main problem |
|---|---|---|---|---|---|---|
| **MA-A-M1-PIZZA** | 15.0 s | 6 | 6 | 5 | 2 / 6 | No TV and no brand until 11.5 s. "Wait… fork?" is on for 0.8 s. The vote phase dims everything (6.5–9 s is the darkest stretch of any ad) |
| **MA-E-M2-CHECKLIST** | 15.0 s | 5 | 4 | 4 | 2 / 6 | The payoff line "Your TV + your phones" is fully visible for about **0.4 s** (1.94–2.30 s). It never shows a clue, vote or reveal, so the fun is missing. "One is different." gets 0.87 s |
| **MA-C-M3-SPOT-THE-MOLE** | 20.0 s | 7 | 6 | 7 | 2 / 5 | The best hook (a task). But nothing says "TV game" for 15.5 s, and the puzzle can't be solved (see change 9). The comment CTA is good for reach |
| **MA-B-M4-PASS-THE-PHONE** | 15.0 s | 6 | 6 | 4 | 2 / 6 | The 6-word hook line is on for 1.0 s. "(he doesn't know)" is on for **0.49 s** at 54 px. The phone row at the bottom is dimmed to near-black |
| **MA-D-M5-TONIGHT** | 15.0 s | 6 | 7 | **3** | 2 / 6 | The only complete loop (scan → no app → word → clue → vote → out). But it has **9 caption cards in 11 s**: "Except Sami." 0.6 s, "Who's off?" 0.68 s, "Caught him." 0.73 s. The chat text in the hook is about 20 px tall |
| **MA-F-M6-AR-FAMILY** | 15.0 s | 5 | 5 | **2** | 2 / 6 | The hook card (two lines) is on for 0.78 s. «إلّا خالو» and «وما بيعرف» are 0.49 s each. Six clue bubbles land 0.24 s apart. The joke «خبز؟ بالتبولة؟!» gets 0.56 s. There are 12 phones on screen at once |
| **MishAna-9x16-prelaunch** (film) | 23.8 s | **3** | 8 | 6 | 5 | Frames 0–1.3 s are an empty dark screen with a yellow dot. It says "Turn your **Google TV** into a party" at 1.1–3.7 s, then ends on "Play free in your browser". The CTA pill is small, shows no URL, and is on screen for the last 1.5 s only |

---

## 2. Numbered changes

Each change follows the same format: **Target** · **Now** · **Proposed** · **Why** · **Expected impact**. Impact estimates are directional, based on paid-social norms, not measured. Validate them in Round 1.

### A. Systemic (apply to every ad)

#### 1. Pre-launch end card: "Play free tonight", not "Install"
- **Target:** `EndCard.tsx`, the last 4.0 s of all six ads (M3: 16.0–20.0 s; the others: 11.0–15.0 s).
- **Now:** a fake install flow ("Install it from your phone" → "Pick your TV" → "Done. Game on."), then the logo, the Google Play badge and the tiny "Or search 'Mish Ana' on your TV" line. All of it is untrue until the listing is public. `LAUNCH-PLAN.md` §0 #2 already blocks these ads.
- **Proposed:** add `EndCard variant="prelaunch"` (keep `live` for later), 5.0 s:

  | t (rel.) | Visual | Caption (≥ 88 px) |
  |---|---|---|
  | 0.0–1.6 | Laptop → HDMI cable → TV lights up with the real lobby and QR (one continuous move, no cuts) | "Open it on any TV." |
  | 1.6–3.0 | Three phones scan; tiles drop into the lobby | "Phones join. No app." |
  | 3.0–5.0 (**hold 2.0 s, nothing moves**) | Logo + wordmark. Below it, on a cream pill, a big URL **`mishana.app/tv`** (buy the domain; `workers.dev` looks like phishing and is hard to type). Then "Free to play · 3–12 players" and, smaller, "Google TV app coming soon" | "**Play free tonight.**" |

  The platform button should be "Play game" (Meta) or "Learn more", pointing at the landing page with `?angle=…` and never at Play.
- **Why:** pre-launch, the conversion is "this group plays a round tonight", and the viewer is on a phone, often away from the TV. A memorable URL plus "tonight" sets up a later action. A store badge for an app that isn't out sets up a bounce. The 2 s still hold gives the viewer time to read the URL; today the brand frame is on for about 1.4 s.
- **Expected impact:** makes the ads runnable at all. Among pre-launch alternatives, expect link CTR to be **+30–60 %** higher than with a vague "learn more" ending, because the offer (free, tonight, a URL) is concrete.

#### 2. Caption timing floor: no card under 1.2 s, key lines ≥ 1.8 s
- **Target:** every `AdCaption` / `ArCaption` call.
- **Now:** cards under 1.0 s (fully visible): M1 "Wait… fork?" 0.82 · M2 "Your TV + your phones" ~0.4, "One is different." 0.87 · M4 "Stop passing one phone around." 1.0 (6 words), "Sami's is PASTA." ~0.75, "(he doesn't know)" 0.49 · M5 "No app on phones." 0.9, "Except Sami." 0.6, "Who's off?" 0.68, "Caught him." 0.73 · M6 hook 0.78, «كلّن معن تبولة…» 0.73, «إلّا خالو» 0.49, «وما بيعرف» 0.49, «خبز؟ بالتبولة؟!» 0.56, «طلع خالو!» 0.63 · EC "Install it from your phone" 0.85, "Pick your TV" 0.97, "Done. Game on." 0.34.
- **Proposed:**
  - Rule: `hold ≥ max(1.2 s, 0.45 s + 0.3 s × words)`, and `≥ 1.8 s` for the three load-bearing lines in every ad (the different word, "he doesn't know", the reveal).
  - Arabic: add +25 % (dots and the RTL shape take longer to read at a glance).
  - Word-rise step ≤ `b(0.08)` (≈ 40 ms) so a line is complete within 150 ms. Today `step={b(0.3)}` on "Wait… fork?" and "IT WAS YOU?!" spends 0.3 s just building the line.
  - Lengthen bodies from 11.0 s to **13.5–14.5 s** (ads become 18.5–20 s). Don't squeeze more into 15 s; remove beats instead (see the per-ad changes).
- **Why:** sound-off viewers read about 3–4 words per second **after** a ~0.3–0.5 s orientation. A 0.5 s card is seen, not read. The cards that fail are exactly the ones that make the game make sense ("he doesn't know"), so the result is "fast and confusing" rather than just "fast".
- **Expected impact:** **hold rate +15–25 %** (3 s → ThruPlay). It is the owner's #1 complaint and the cheapest fix (constants only).

#### 3. Brighten the canvas: "daylight" ad palette and bigger UI
- **Target:** `AdBg` in `common.tsx`, plus the scale of the UI groups in every ad.
- **Now:** background `#22103A → #120A1F → #0B0614`, mean luma 22–27/255. The UI occupies the top 55–60 % of the frame (M1 0–2.4 s: the bottom ~45 % is empty; M3: bottom 35 % empty). Losing tiles are dimmed to ~30 %. Phones in M4/M5 (y > 1250) are dimmed to near-black.
- **Proposed:**
  - (a) Lift the ad background to `radial(#3B1D6E → #24123F)`, mean luma target ≥ 55. Better still, run the **hook (0–2 s) and the end card on a bright field**: cream `#FFF7EC` with violet ink, or magenta `#FF3D8B` with ink, the same colours as the stamp floods. The app UI stays dark and sits on top as an object.
  - (b) Scale the main group 1.25–1.4× so it spans y 300–1500.
  - (c) Dim losing tiles to 60 %, not 30 %, and never dim the phones the viewer needs to read.
  - (d) Add a soft white rim light (2 px `#FFF7EC` at 25 %) on phone frames so they separate from the background.
  - Brand: keep night violet for the TV app (dark living room, TV glare). Add a **"marketing daylight" sub-palette** to DESIGN.md: cream, magenta, amber and sky blue as backgrounds, violet as ink. The owner is open to it, and it doesn't touch the app.
- **Why:** most users browse Reels/TikTok in dark mode, and the platform UI overlays are dark too. A dark-on-dark ad looks like a loading frame and gives the eye nothing to land on. Bright first frames win the thumb-stop.
- **Expected impact:** **hook rate +3–8 points** (e.g. 22 % → 27 %). Of all the hook levers here, only adding a human face is likely to beat it.

#### 4. Say "TV" and the brand in the first 1.5 s of every ad
- **Target:** frames 0–1.5 s of M1, M3 and M4, which have no TV or brand before the end card.
- **Now:** M1 opens on five phones; M3 on avatars in a ring; M4 on a phone passed around. A cold viewer sees a phone game, but the product is a TV game.
- **Proposed:**
  - A persistent **brand chip** from frame 0 to the end card: top-left inside the safe zone (x 60, y 160), 44 px, cream on violet pill: [TV glyph] "Mish Ana! · party game for your TV". Use the TV glyph from `EndCard.tsx` (SVG, not an emoji).
  - In M1 and M4, put a small TV mockup behind the phones in frame 0, so the room reads "TV + phones".
- **Why:** viewers decide in about 1.5 s whether something is for them. "Phone word game" and "TV party game" are different audiences: the second one is the persona (the Host). Without the brand chip, viewers who comment on M3 don't know what to search for.
- **Expected impact:** better click quality (fewer "I thought it was a phone app" bounces). **Landing → play +10–20 %**, with a small CTR gain.

#### 5. Give the Mole a non-orange player colour in all creative
- **Target:** `brand.ts`, where Sami is `#FF7A1F`, and every ad where Sami is the Mole (M1, M2, M4, M5, film).
- **Now:** the Mole's *player* colour (#FF7A1F) is nearly the same as the Mole *role* colour (#FF8A3D, orange mask card). Sami's PASTA card is orange, the amber ring around it is orange, and the reveal card is orange. Viewers learn "orange = the bad one", which (a) gives the reveal away at 1.0 s and (b) teaches something false, since a Mole can be any colour. In M3 the innocent Sami is orange and the Mole Karim is blue: if that misdirection is intentional it's clever, but nothing else in the set supports it.
- **Proposed:** make the Mole a sky, violet or green player in the ads (e.g. swap Sami ↔ Nour `#7A43FF`). Keep orange only for the role card at the reveal, so the orange card at the end becomes the payoff colour.
- **Why:** one colour, one meaning. It also makes the "he doesn't know" point visually true: his card looks like everyone's.
- **Expected impact:** clarity. A small but real hold-rate gain on the reveal ads.

#### 6. Voiceover on four ads and the film (scripts in §3)
- **Target:** M1, M4, M5, the new explainer (change 13) and the pre-launch film. M3 stays caption-only with an optional VO (a puzzle works better read). M6 VO comes later, recorded in Lebanese Arabic.
- **Proposed:**
  - VO at **≤ 2.5 words/s**, music ducked −9 dB under the voice (the owner likes the music, so keep it at full level in the gaps and the end card).
  - **Captions = the VO lines word for word**, so sound-off and sound-on tell the same story.
  - Voice: warm, conspiratorial, mid-20s to 30s, a smile in the voice, a friend at the party rather than an announcer.
  - Check each platform's current AI-content disclosure rules for synthetic voices before publishing.
- **Why:**
  - TikTok is mostly watched with sound on; Reels is mixed.
  - The VO carries the rule ("…and he doesn't know") while the eye watches the action, so the reader no longer has to read and watch at the same time. That halves the cognitive load per beat.
  - It's the owner's request.
- **Expected impact:** **hold +10–20 % on TikTok** and a smaller gain on Reels. Comprehension of cold viewers rises the most.

#### 7. One new visual element per beat (cognitive-load rule)
- **Target:** M5 (9 cards + TV + chat + 5 phones in 11 s), M6 (12 phones + 6 bubbles in 1.2 s), M2 (3 strikes 0.49 s apart).
- **Now:** in several places a new caption, a new UI state and a camera move all land in the same beat.
- **Proposed:**
  - Max **one new caption OR one new UI state per 0.97 s** (2 beats).
  - Clue bubbles at ≥ 0.6 s spacing; ≤ 5 clues per ad; ≤ 6 phones visible.
  - M6: keep 12 in the lobby counter (the 12-player claim), then cut to **6 phones** for the deal and clues, with the other 6 as "+6" tiles.
- **Why:** the viewer needs about 300 ms to find the new thing before reading it. Two simultaneous changes split attention, and the eye goes to motion, not text.
- **Expected impact:** included in the hold-rate gain from change 2.

### B. Per ad

#### 8. M1 PIZZA: slow the reveal, show the TV, name the vote
- **Target:** MA-A-M1, 0–15 s.
- **Proposed timeline (19.0 s = 14.5 s body + 4.5 s pre-launch end card):**

  | t | Visual | Caption |
  |---|---|---|
  | 0.0–1.8 | Same 5 phones, scaled 1.3×, on a bright cream or magenta field, with a small TV behind them | "Everyone's word is **PIZZA.**" |
  | 1.8–4.2 | Ring around Sami's card (keep the wobble) | "Except his." → "**He doesn't know.**" (the second line at 2.9 s) |
  | 4.2–8.6 | Tiles; clues at 0.7 s spacing: Cheese, Oven, Slice, Delivery | "One clue each." |
  | 8.6–10.2 | "…Fork?" bubble, zoom punch | "Wait… **fork?**" (1.6 s) |
  | 10.2–12.0 | Vote chips fly; **show one phone with "Who's lying?"** | "Vote on your **phones.**" |
  | 12.0–14.5 | OUT stamp → orange role card "…the Mole! Nice catch." | "IT WAS **YOU?!**" (2.5 s) |
  | 14.5–19.0 | Pre-launch end card | (change 1) |
- **Why:** it adds the missing "he doesn't know" and "on your phones" (the product's differentiator) and gives the joke ("fork?") time to land.
- **Expected impact:** hold +20 %. This ad is the most likely Round 1 winner among the motion cuts.

#### 9. M3 SPOT-THE-MOLE: make the puzzle fair and branded
- **Target:** MA-C-M3, 0–16 s.
- **Now:**
  - Caption "One of them has a different word." The viewer never learns the shared word.
  - Clues: Cheese, Oven, Fork, Slice, Sauce. The answer is "Sauce" (Karim), a clue that fits pizza just as well, so the puzzle can't be solved. People who guess "Fork" (the obvious one) are told "wrong" with no way to have got it right. A gotcha can drive comments, but a viewer who feels cheated doesn't click.
  - The countdown 3-2-1 is 1.45 s long.
- **Proposed:**
  - 0.0–2.4: "Their word: **PIZZA.** One of them has a different word." (two lines, 2.4 s).
  - Keep "Fork" as the red herring, but give Karim a clue that is fair in hindsight: **"Boil"** is too easy, so use **"Al dente…"**, or keep "Sauce" and add after the reveal: "Karim had **PASTA**. 'Sauce' fit both. Sneaky."
  - Stretch the countdown to 2.4 s (5 beats) and add "Pause it. Comment your guess." That's the instruction, and the pause also increases watch time.
  - Add the brand chip (change 4).
- **Why:** puzzle ads earn comments only if viewers feel they *could* have solved it. A fair-in-hindsight answer turns "that's rigged" into "ugh, of course".
- **Expected impact:** **comment rate ×1.5–2**, which feeds the algorithm. Higher CTR quality.

#### 10. M4 PASS-THE-PHONE: hold the key line, light the bottom row
- **Target:** MA-B-M4, 0–11 s.
- **Proposed:**
  - Hook card: "**Still** passing one phone around?" (a question pulls in the person who does this; 5 words), on screen from frame 0, held 2.2 s.
  - "Someone always peeks." held to 3.8 s.
  - "Sami's is PASTA." + "(he doesn't know)" merged into one card, **"Sami's is PASTA. He doesn't know."**, at 80 px, held 2.4 s. Kill the 54 px parenthetical.
  - TV phase: phones in the bottom row at 70 % brightness, not ~20 %, and clue bubbles at 40 px or more (32 px today).
  - Close on "5 players. 5 phones. **Zero passing.**", held 2.0 s.
- **Why:** this angle targets people who already play the pass-the-phone version (the Host persona), and the question form mirrors what they say out loud.
- **Expected impact:** hold +15 %. CTR is likely the best of the motion set with this audience.

#### 11. M5 TONIGHT: cut three cards, keep the loop
- **Target:** MA-D-M5, 0–11 s.
- **Proposed:**
  - Remove "No app on phones." (move it to the end card) and merge "Who's off?" with "Caught him."
  - Final sequence: "Nothing to do tonight?" (1.8 s) → "Put a game on the TV." (2.4 s) → "Everyone scans. No app." (2.8 s) → "Everyone's word is PIZZA…" (2.0 s) → "…except Sami's." (1.8 s) → "One clue each. Who's off?" (2.0 s) → "Caught him." (1.8 s) → "Saturday, sorted." (1.0 s, into the end card).
  - Scale the hook's group-chat text to ≥ 40 px: "what are we watching?" / "idk" / "idk" / "idk" is the relatable bit, and at ~20 px nobody can read it.
- **Why:** it's the clearest full explanation in the set, killed only by speed.
- **Expected impact:** pace 3 → 7. Run it Thu–Sat 17:00–22:00, where "tonight" is literally true.

#### 12. M6 AR FAMILY: half the elements, double the holds
- **Target:** MA-F-M6, 0–11 s (this is seasonal, so there's time to rebuild).
- **Proposed:**
  - Hook «سهرة العيلة؟ ١٢ واحد؟» held 1.8 s while the counter runs 3 → 12.
  - «كلّن معن تبولة… إلّا خالو.» as one card, 2.2 s.
  - «وما بيعرف.» 1.6 s.
  - Show 6 phones, not 12, during the deal.
  - 4 clues at 0.6 s spacing; the خبز joke card 1.6 s; «طلع خالو!» 1.6 s.
  - Use Eastern Arabic digits in the hook (١٢) so it's consistent with the AR packs' feel, or keep 12. Ask a native speaker.
  - Have a Lebanese VO record it (§3.6).
- **Why:** with Arabic text plus 12 small phones plus 0.5 s cards, nothing can be read. The Lebanese food joke is the strongest cultural hook in the set and needs ≥ 1.5 s to land.
- **Expected impact:** pace 2 → 7. Only worth it in the Dec/Ramadan flights.

#### 13. Replace M2 CHECKLIST with "How it works in 15 seconds" (VO explainer)
- **Target:** MA-E-M2.
- **Now:** a checklist hook (generic; rows at 51 px), a payoff line visible for 0.4 s, then lobby → words → "Game night, sorted" chips. It never shows clues, the vote or the reveal, so the viewer sees setup but no fun.
- **Proposed:** re-cut as **MA-E-M7-HOW-IT-WORKS**, 22 s, with VO (§3.4):
  - **Hook:** a cream field with a big "Your TV. Your phones. **One liar.**"
  - **Body:** scan → secret word → one is different → one clue each → vote on phones → OUT + role card. One step per 2–2.4 s, numbered chips ①–⑤ top-left so the viewer always knows where they are.
  - **Close:** "3–12 players".
  - **End card:** pre-launch (change 1).
  - Keep the checklist strike-through only as an optional 2 s *hook variant* (H2), with each strike 0.9 s apart, not 0.49 s.
- **Why:** none of the six ads teaches the game in order at a readable pace. Cold viewers (the TV Browser and Bored Crew personas) don't know the genre, and a calm "here's how it works" ad is usually the best converter for an unknown mechanic, even if its hook rate is lower.
- **Expected impact:** expect a lower hook rate than M1 but the **best landing → play conversion** in the set. That ratio matters most pre-launch, when the goal is rooms played rather than clicks.

#### 14. Product film (pre-launch): fix the first second and the CTA
- **Target:** `MishAna-9x16-prelaunch.mp4` / `16x9-prelaunch` (`Film.tsx`).
- **Now:**
  - 0.0–1.3 s is an empty dark frame with a yellow dot (an intro animation). This is where the scroll decision happens.
  - 1.1–3.7 s: "Turn your **Google TV** into a party." This contradicts the pre-launch CTA, since the app isn't out and the browser version works on any TV with a laptop.
  - "Caught the Mole!" is on for 0.78 s; "Spot who doesn't fit." for 1.07 s.
  - The CTA pill "Play free in your browser" (about 3 % of frame height) and "Google TV app coming soon" appear only at about 22.3 s, 1.5 s before the end, with no URL.
- **Proposed:**
  - Start at the lobby, already lit (cut the dot intro, or move it to the end as the logo build).
  - Caption at frame 0: "Turn **any TV** into a party game." (true for browser + HDMI or a TV browser). Pre-launch only; switch back to Google TV for `cta='live'`.
  - Hold "Caught the Mole!" for 1.6 s.
  - End card ≥ 3 s with the URL `mishana.app/tv` at ≥ 6 % of frame height, plus the pill.
  - Add the VO (§3.5).
- **Why:** this is the asset for Reddit, X and YouTube during launch week (LAUNCH-PLAN). Viewers there are curious, but a dead first second still costs ~30–40 % of them.
- **Expected impact:** 3 s retention +10–15 points. Clicks to the browser game go up because the URL is visible and memorable.

#### 15. Real faces: stitch a 1.0–1.5 s filmed cold open onto the best motion bodies
- **Target:** M1, M4, M5 (and later the full filmed hooks A_H1 and B_H1 from SCRIPTS.md).
- **Proposed:** before the motion body, a phone-shot living room clip, 1.2 s: one friend pointing past the lens screaming "IT WAS YOU?!" (for M1), or hands passing a phone (for M4). Then a hard cut into the motion body with the caption carried across.
- **Why:** faces and real reactions are the most reliable thumb-stop in short-form, and no current asset has a single human. One evening of filming covers all three.
- **Expected impact:** **hook rate +5–10 points** over the motion-only versions. This is the biggest hook lever in the set.

### C. Angles: keep, cut, merge, add

#### 16. Angle portfolio changes

| Angle | Verdict | Reason |
|---|---|---|
| A Reveal (M1) | **Keep, #1** | Emotional peak and self-explaining. Strongest with a filmed cold open |
| B Pass the phone (M4) | **Keep, #2** | The clearest differentiator for people who already play these games |
| C Spot the Mole (M3) | **Keep as the engagement/organic asset** | Best for comments and organic reach. Weaker for clicks, so judge it on comment rate and cost per landing view, not CTR |
| E Zero hardware (M2) | **Merge into the new explainer (change 13)** | "No controllers, no app" is a supporting claim, not a reason to watch. It belongs as a line inside the explainer and on the end card |
| D Tonight (M5) | **Keep as a hook variant on the explainer body**, dayparted Thu–Sat | Boredom is weak in the first second, but "tonight" fits the pre-launch "play in your browser now" offer perfectly |
| F Family AR (M6) | **Keep, seasonal** (Dec / Ramadan) | Unique cultural moat. Rebuild for pace first (change 12) |

**Add (in this order):**
1. **"How it works in 15 s"** with VO (change 13): for cold audiences.
2. **Filmed testimonial-style UGC.** A host to camera: "We stopped passing the phone around. Here's what we play now." 15–20 s, phone-shot, real rounds. Use real people and real words only; no invented quotes or reviews.
3. **Office / team party (pre-launch gold).** "Team icebreaker: laptop + meeting-room screen + everyone's phone." The browser version is the *perfect* fit (every meeting room has a screen and HDMI), and LinkedIn and Meta both reach it. Hook: "Your team's worst liar is about to get caught."
4. **Double date / couples' night (4 players).** Hook: "Double date. Four words. One liar." Don't say "date night for two": the minimum is 3 players.
5. **"You know the spy word game? It's on your TV now."** Speaks to people who already play the genre, *without* naming Undercover or Spyfall (both are registered trademarks; see LAUNCH-PLAN).
6. **Family abroad.** Only if remote play is really supported. Joining needs the QR/room on the shared screen and clues are said out loud, so a video-call version is unverified. **Don't claim it** until it's tested end to end; if it works, it's a strong diaspora angle ("Teta in Beirut, cousins in Montréal").

### D. Landing page

Viewed at 390×844 and 1440×900. Overall it's in good shape: the angle-matched hero (`?angle=`), the phone → laptop send sheet, the device-aware hints, the honest "coming soon" copy and the FAQ coverage are well done. The changes below target the ad-click visitor, who is on a phone and usually not at a TV.

#### 17. Mobile hero CTA: make the hand-off obvious, add "remind me"
- **Target:** hero, first viewport at 390×844.
- **Now:** the primary button reads "Send the link to my laptop or TV · The game runs on the big screen · free". It's long, it's a two-step idea, and the second option ("email it to me") is hidden inside the sheet.
- **Proposed:** two equal-width buttons under the sub:
  - Primary **"Play tonight on your TV"**: opens the native share sheet, as today.
  - Secondary ghost **"Email me the link"**: inline email field, one tap.
  - A text link under them, "Add a reminder for 8 pm": downloads an .ics with the URL.
  - Show the short URL as text, **"or type mishana.app/tv on any laptop"**, because people remember a short URL and the hand-off often happens hours later.
- **Why:** an ad viewer at 13:00 on a bus has intent but not a TV. Capturing "later" (email or reminder) is the conversion; today that path takes two taps and reading a sheet. A named action ("Play tonight") is also more motivating than "Send the link".
- **Expected impact:** on mobile, **hand-off actions (share + email + reminder) +25–40 %**. It also builds the first email list for the Play launch.

#### 18. Hero media: show the payoff, not an empty lobby
- **Target:** the hero video (`hero-16x9-*.mp4`).
- **Now:** the first viewport shows the lobby "Players 0/12" with a QR and the caption "Turn your Google TV into a party." The same Google TV contradiction as the film appears on a browser-first page.
- **Proposed:**
  - Start the loop at the reveal: OUT stamp → "Sami was the Mole" → people reacting (once filmed). Alternatively use the "A whole round in 15 seconds" reel, already built, as the hero.
  - Pre-launch caption: "Turn **any TV** into a party game."
  - Use FR and AR cuts on the localized pages (CRO-AUDIT #7 is still open).
- **Why:** match the ad's peak moment. The visitor clicked on "IT WAS YOU?!" and should land on it.
- **Expected impact:** fewer early bounces. Message match across ad → hero.

#### 19. Trust fixes (cheap, high leverage)
- **Target:** footer, domain, about.
- **Now:**
  - The footer Contact link is **`mailto:{{CONTACT_EMAIL}}`** (an unfilled placeholder, visible on hover and broken on tap).
  - The game URL is `play.mishana.workers.dev`.
  - `site.config.json` still has the placeholder origin `mishana.app`.
  - There's no maker face or story, and no social proof.
- **Proposed:**
  - Fill `contactEmail` and `ownerName`.
  - Buy and point the domain, so `mishana.app/tv` serves the game (or redirects to it).
  - Add a 2-line "Made by Alex in [city], a solo dev who got tired of passing the phone around" with a real photo, in About plus a one-line strip above the FAQ.
  - Once real playtests exist, add 2–3 **real** quotes with first name + city (never invented).
- **Why:** a free game from an unknown dev on a `workers.dev` domain looks risky, and a broken Contact link confirms the doubt. Visitors check these signals before sending a link to friends.
- **Expected impact:** small per visitor, but it compounds across every share. **Share → open rate +10 %.**

#### 20. Message match for every running ad
- **Target:** the hero angle map in `index.html` (`A={reveal, passphone, nohardware, tonight, family, tvgame}`).
- **Now:** M3 (puzzle) would land on `tvgame`: "Looking for a game for your TV? Here's one." That doesn't continue "Did you spot the Mole?". The explainer (change 13) and office angle have no hero.
- **Proposed:** add three hero variants:
  - `puzzle`: "Did you spot the Mole? **Now play it with your friends.**"
  - `howto`: "Your TV. Your phones. **One liar.**"
  - `office`: "The team icebreaker **where someone's lying.**"
  - Each gets a sub that ends in "Free in your browser, tonight."
- **Why:** the first line on the page should continue the last line of the ad.
- **Expected impact:** **landing → play +10–15 %** on those ads.

#### 21. Measure the real conversion: a room with 3+ players
- **Target:** analytics (landing `track()` + `/tv`).
- **Proposed:**
  - Pass the `utm_*` from the landing page through to `/tv?…` (already done for share links; do it for the direct desktop CTA too).
  - On the server, log `room_started` with ≥ 3 phones joined, tagged with the UTM.
  - Report **cost per played room** per ad in Round 1, alongside CTR.
- **Why:** pre-launch, a click on a phone is worth little. The goal is a group that played. Without this, the ad test optimizes for curiosity, not conversion.
- **Expected impact:** it makes the test decide on the right metric. That is the biggest strategic lever, even though it isn't a creative change.

#### 22. Small landing polish
- **Desktop hero:** the right-hand TV mockup shows an empty lobby. Use the reveal frame. The nav "Play free" pill and the hero CTA are consistent; good.
- **Mobile:** the "Plays on any TV, today" strip duplicates the hero hint. Merge it into the hero's hint line to pull "A whole round in 15 seconds" (the best explainer on the page) about 300 px higher.
- **Final CTA section:** strong copy ("Someone at your table is lying. Find out who."). Keep it.
- **Hint text:** the headless capture fell back to the desktop hint ("Connect this computer to the TV") because of its user agent. Check on a real Android phone that the phone hint shows.

---

## 3. Voiceover scripts (EN)

**How to read these:**
- Times are absolute within the ad and assume the re-timed versions above.
- "Wds" is the word count, "w/s" is words per second; every line is ≤ 2.5 w/s.
- **Bold** = the stressed word.
- "Mish Ana" counts as 2 words; say it "mish-AH-na".
- Music is ducked −9 dB under each line and returns to full level in the gaps.

### 3.1 M1 PIZZA (19.0 s)
| t | VO | Wds | w/s |
|---|---|---|---|
| 0.0–1.8 | "Everyone's word is **pizza**." | 4 | 2.2 |
| 1.8–4.2 | "Except his. And he **doesn't know**." | 6 | 2.5 |
| 4.2–5.8 | "One clue each." | 3 | 1.9 |
| 5.8–8.6 | *(no VO: clue pops)* | — | — |
| 8.6–9.8 | "…**Fork**?" (deadpan) | 1 | — |
| 10.2–12.0 | "Vote on your **phones**." | 4 | 2.2 |
| 12.0–13.0 | *(stamp SFX)* | — | — |
| 13.0–14.5 | "It was **him**." | 3 | 2.0 |
| 14.6–17.4 | "Mish Ana. Play **free** on your TV." | 7 | 2.5 |
| 17.6–19.0 | "**Tonight**." | 1 | — |

Post-launch end card: 14.6–17.4 "Mish Ana. **Free** on Google TV." (6) · 17.6–19.0 "Install from your phone." (4, 2.9 w/s: extend the end card to 19.4 s).

### 3.2 M4 PASS-THE-PHONE (20.0 s)
| t | VO | Wds | w/s |
|---|---|---|---|
| 0.0–2.2 | "**Still** passing one phone around?" | 5 | 2.3 |
| 2.2–3.8 | "Someone **always** peeks." | 3 | 1.9 |
| 3.8–5.0 | "Not anymore." | 2 | 1.7 |
| 5.4–7.8 | "**Your** phone. **Your** secret word." | 5 | 2.1 |
| 7.8–10.2 | "Sami's is different. He doesn't **know**." | 6 | 2.5 |
| 10.2–12.2 | "The **TV** runs the game." | 5 | 2.5 |
| 12.2–14.2 | "One clue each. Then **vote**." | 5 | 2.5 |
| 14.2–15.0 | *(stamp)* | — | — |
| 15.0–17.4 | "Five players. Five phones. **Zero** passing." | 6 | 2.5 |
| 17.4–20.0 | "Mish Ana. Play free **tonight**." | 5 | 1.9 |

### 3.3 M5 TONIGHT (20.0 s)
| t | VO | Wds | w/s |
|---|---|---|---|
| 0.0–1.8 | "Nothing to do **tonight**?" | 4 | 2.2 |
| 1.8–4.2 | "Put a game on the **TV**." | 6 | 2.5 |
| 4.2–7.0 | "Everyone scans with their phone. **No app**." | 7 | 2.5 |
| 7.0–9.0 | "Everyone's word is **pizza**…" | 4 | 2.0 |
| 9.0–10.8 | "…except **Sami's**." | 2 | 1.1 |
| 10.8–12.8 | "One clue each. Who's **off**?" | 5 | 2.5 |
| 12.8–14.6 | "Vote. **Caught** him." | 3 | 1.7 |
| 14.6–15.6 | "Saturday, **sorted**." | 2 | 2.0 |
| 15.8–20.0 | "Mish Ana. Free on your TV. Link **below**." | 8 | 1.9 |

### 3.4 NEW M7 HOW-IT-WORKS (22.0 s, replaces M2)
| t | Visual | VO / caption | Wds | w/s |
|---|---|---|---|---|
| 0.0–2.4 | Cream field, big type; TV + phones slide in | "Your TV. Your phones. **One liar**." | 6 | 2.5 |
| 2.4–5.6 | ① Laptop/TV lobby; 3 phones scan, tiles drop | "Open it on the TV. Everyone **scans** the code." | 8 | 2.5 |
| 5.6–8.0 | ② 4 cards flip: PIZZA ×3… | "Everyone gets a **secret** word." | 5 | 2.1 |
| 8.0–10.0 | …PASTA, ring around it | "One player's is **different**." | 4 | 2.0 |
| 10.0–12.4 | ③ Clue bubbles, 0.6 s apart | "Give one clue each, **out loud**." | 6 | 2.5 |
| 12.4–14.4 | ④ Phone "Who's lying?" + TV ticks | "Vote on your **phones**." | 4 | 2.0 |
| 14.4–16.0 | ⑤ OUT → orange Mole card | "Catch the **liar**." | 3 | 1.9 |
| 16.0–17.6 | 12 avatars pop round the TV | "Three to **twelve** players." | 4 | 2.5 |
| 17.6–20.0 | Pre-launch end card | "**Free.** Play tonight in your browser." | 6 | 2.5 |
| 20.4–21.6 | URL hold | "Link below." | 2 | 1.7 |

### 3.5 Product film, pre-launch (24 s, 16:9 / 9:16)
| t | VO | Wds | w/s |
|---|---|---|---|
| 0.0–2.8 | "Turn **any TV** into a party game." | 7 | 2.5 |
| 3.0–5.8 | "Friends join from their phones. **No app**." | 7 | 2.5 |
| 6.2–8.6 | "Everyone gets a **secret** word…" | 5 | 2.1 |
| 9.4–11.0 | "…but one is **different**." | 4 | 2.5 |
| 11.0–13.0 | "Give one-word clues." | 4 | 2.0 |
| 13.2–14.8 | "Spot who doesn't **fit**." | 4 | 2.5 |
| 14.8–17.2 | "Vote them out… **caught** the Mole!" | 6 | 2.5 |
| 17.4–20.0 | "Everyone's innocent. **Someone's lying**." | 4 | 1.5 |
| 20.4–23.6 | "Mish Ana. Play **free** in your browser." | 7 | 2.2 |

### 3.6 M3 SPOT-THE-MOLE (optional VO, 20 s) and M6 (AR, later)
- **M3:**
  - 0.0–2.8 "Their word is pizza. One of them has a **different** word." 11 wds is too many: cut it to "One of them has a **different** word." (7 wds, 2.5 w/s).
  - 8.8–10.4 "Who doesn't **fit**?"
  - 13.0–15.4 "Pause it. Comment your **guess**."
  - Then silence to the reveal, and "**Karim**. 'Sauce' fit both. Sneaky." (5) at 19.2–21.2.
- **M6 (Lebanese Arabic, native voice; ≤ 2.0 w/s because Arabic words are longer). Draft for a native speaker to adapt, not final copy:**
  - «سهرة العيلة؟ … ١٢ واحد؟ أحسن.»
  - «كلّن معن تبولة… إلّا خالو. وما بيعرف.»
  - «كل واحد بيقول كلمة.» … «خبز؟ بالتبولة؟!»
  - «مين مش منّا؟» … «طلع خالو!»
  - End card: «ببلاش… العبوها الليلة عالتلفزيون.»
- **FR (Round 3):** French runs about 15–20 % longer. Budget ≤ 2.2 w/s and drop a line rather than speed up. Example M1 0.0–1.8: « Tout le monde a **pizza**. » · 1.8–4.2: « Sauf lui. Et il **ne le sait pas**. » · end card: « Mish Ana. Gratuit, **ce soir**, sur ta télé. » Use tutoiement and « télé », as REVIEW.md specifies.

---

## 4. Order of work (cheapest × biggest first)
1. Pre-launch end card + URL/domain (changes 1, 19): unblocks everything.
2. Caption timing floor + longer bodies (change 2), brightness (change 3), brand chip (change 4), Mole colour (change 5). Mostly constants; re-render all.
3. VO for M1, M4, M5 + the new explainer M7 (changes 6, 13).
4. One filming evening → cold opens (change 15) + the UGC testimonial angle.
5. Landing: hand-off buttons + reminder (change 17), hero variants (change 20), played-room metric (change 21).
6. Seasonal: rebuild M6 (change 12) in November.
