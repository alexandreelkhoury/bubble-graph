# Mish Ana! (مش أنا) — Paid Social Ad Scripts

TikTok + Instagram Reels, 9:16 (1080×1920). Version 2, revised 2026-10-04 after creative review (see `REVIEW.md`). Section 4 is unchanged from v1.

> Fact rule for every ad: only claim what is in the product today. That means: 3–12 players, phones join by scanning a QR code on the TV (then type a name and pick a colour), no app on the phones, no account, no controllers, English / French / Arabic (including Lebanese word packs), free to play, Android TV / Google TV. Don't use user counts, ratings, reviews, awards, "#1", premium packs, or any device outside Android TV / Google TV. The app has optional in-app purchases (Premium), so say "free to play" or "free", never "100% free", "no catch" or "no in-app purchases".
>
> Game-accuracy rule: the **Mole does not know they are the Mole** (Beginner mode is off by default). Every phone shows the same face-down card; you hold it to see your word, and the Mole's card looks exactly like everyone else's. Votes are cast **on the phones**. The TV stamps **OUT** (FR **DEHORS**, AR **برّا**), then flips the card to the role: Civilian (sky blue, house), Mole (orange, mask), Blank (paper white, empty card). There is no "MOLE!" stamp. With the default rule the infiltrators win when only **one Civilian** is left, so one wrong vote does not end the game unless the group is tiny. From 5 players up there is also a **Blank** (no word) by default.
>
> Word pairs that exist in the packs: EN **Pizza / Pasta**, FR **Pizza / Pâtes**, generic AR **بيتزا / برغر**, Lebanese **تبولة / فتوش** (Tabbouleh / Fattoush). Never put PIZZA/PASTA in an Arabic ad: that pair is not in the Arabic packs.

---

## 1. Strategy summary

### Personas

| # | Persona | Situation | What they say | What stops their scroll |
|---|---|---|---|---|
| P1 | **The Host** (22–35) | Hosts game nights, owns a Google TV, an Android TV or a Chromecast **with Google TV**, already plays secret-word or spy games on one passed-around phone | "Pass me the phone." "Don't look." "Who's the spy?" | Seeing friends react to a reveal; a fix for the pass-the-phone problem |
| P2 | **The Bored Crew** (18–30) | 3–6 roommates or friends at home on a Thursday to Saturday night with no plan, everyone on their own phone | "What do we do tonight?" "I don't know, you pick." | Seeing their own couch on screen, plus something to do in the next 2 minutes |
| P3 | **The Family Organizer** (28–50) | Lebanese/MENA family, at home or abroad (FR, CA, AU, Gulf). Hosts gatherings after iftar, at Christmas, at New Year. Mixed ages | "Something everyone can play, even Teta." | Their own language and words on screen, a grandparent joining easily |
| P4 | **The TV Browser** (25–45) | Has Google TV and wants more from it than streaming. Doesn't yet know party games exist on TV | "Are there any good games for the TV?" | A clear answer: this game, this TV, free |

Targeting note: neither platform can target "owns a Google TV". Target **Android phones only, 18+**, by interest (board games, party games, game night; Android TV / Google TV interests where available). The end card's "install from your phone" step only works in the Android Play Store app, and only when a TV is signed in to the same Google account. Leave iOS out of every test round. The plain "Chromecast" dongle can't run apps: only say Google TV / Android TV.

### Angles, ranked

| Rank | Code | Angle | utm_campaign | Persona | Why this rank |
|---|---|---|---|---|---|
| 1 | **A** | **The Reveal**: "IT WAS YOU?!" Emotion first, features second | `reveal` | P1, P2 | Real reactions are what the feed rewards. The reveal is the game's natural peak, and it explains the mechanic in a few seconds without a tutorial |
| 2 | **B** | **Stop passing the phone** (owner idea 2) | `passphone` | P1 | Targets people who already play this kind of game and already feel the pain. This is the clearest difference from what they play today |
| 3 | **E** | **Zero hardware**: no controllers, no app, just your phones | `nohardware` | P1, P4 | Answers the objection "TV party games = buy controllers or install stuff". Free to play makes it stronger |
| 4 | **C** | **"Looking for a fun game for your TV? Here's one."** (owner idea 1) | `tvgame` | P4 | Direct and intent-matched, but most viewers aren't actively looking. Expect a lower hook rate and a better click-to-install rate. The C_M3 puzzle is the exception: it hooks with a task, not a question |
| 5 | **D** | **Nothing to do tonight** (owner idea 3) | `tonight` | P2 | Very relatable, but boredom is a weaker emotion than drama, and a bored opening shot is a bored first second. Run Thursday to Saturday, 17:00–22:00 local |
| 6 | **F** | **Family & culture**: Lebanese words, Ramadan, holidays | `family` | P3 | Smallest audience overall, but likely the #1 angle for Arabic-speaking geos. Seasonal: Christmas/New Year (Dec 2026) and Ramadan 2027 (expected to start around 8 February 2027; confirm the date). Not part of the English angle test |

The rank is a starting hypothesis. The test decides.

### Test matrix (angle × hook)

| Angle | H1 | H2 | H3 | H4 / H5 (new) | Motion-only |
|---|---|---|---|---|---|
| A Reveal | MA_A_H1 "IT WAS YOU?!" cold open | MA_A_H2 POV: you're the Mole and nobody told you | MA_A_H3 Rate his poker face | **MA_A_H4** "He said FORK." · **MA_A_H5** Betrayal supercut | **MA_A_M1** Everyone's word is PIZZA |
| B Pass the phone | MA_B_H1 Stop passing the phone | MA_B_H2 There's always one who peeks | MA_B_H3 Before/after split | **MA_B_H4** POV: it's YOUR phone · **MA_B_H5** Hold to see, let go to hide | — |
| C TV game | MA_C_H1 "Looking for a game for your TV?" | MA_C_H2 More than streaming | MA_C_H3 3 to 12 players, one TV | — | **MA_C_M3** Spot the Mole puzzle |
| D Tonight | MA_D_H1 5 people, 5 phones, 0 plans | MA_D_H2 Things to do that aren't a movie | MA_D_H3 The group chat | — | — |
| E Zero hardware | MA_E_H1 You don't need any of this | MA_E_H2 Everything you need: one phone | MA_E_H3 If Teta can join, anyone can | — | **MA_E_M2** Game-night checklist |
| F Family (seasonal, AR/diaspora) | MA_F_H1 Lebanese family game night | MA_F_H2 After iftar | MA_F_H3 Family of 12? Perfect. | — | — |

**Rollout** (one platform, one language, one geo per round, so the creative is the only thing that changes)
- **Round 1 (first paid test, 7 days):** 5 ads. The 3 motion ads (MA_A_M1, MA_E_M2, MA_C_M3) plus the 2 strongest filmed hooks (MA_A_H1, MA_B_H1), in English, Instagram Reels only, Android only, one geo. If the filming evening slips, launch the 3 motion ads on day 1 and add the 2 filmed ads when they're cut; each ad still gets its own 7 days. Full plan and budget: `REVIEW.md` → "Round 1 launch plan".
- **Round 2 (7 days):** 3 new hooks on the winning angle + 2 on the runner-up, same body and end card. For A: H2, H4, H5. For B: H4, H5 (and H2 if a slot frees up). The winner from Round 1 keeps running as the control.
- **Round 3:** French in France, using the winning hooks (France has a large Android TV base through ISP TV boxes; check that the boxes you target have the Play Store). Then the remaining angles (E filmed, C, D) only if their Round 1 motion or filmed ad came within 20 % of the winner's cost per store visit.
- **Seasonal:** F_H3 in December 2026 (Lebanon + diaspora geos, AR and EN), F_H2 for Ramadan 2027. Film the family session in November.

Why not "H1 of all 6 angles" first: one hook per angle tests the hook, not the angle, and 6 filmed ads + 3 motion ads is more spend and editing than a solo owner needs to find the first winner. The two filmed hooks in Round 1 cover the top 2 angles; the motion ads cover A, C and E cheaply.

### Naming convention

`MA_{Angle}_{Hook}_v{n}_{LANG}`

- Angle: `A`–`F`. Hook: `H1`–`H5` for filmed or hybrid ads, `M1`–`M3` for motion-only.
- `v{n}` counts edits of the same hook (new music, a trim, a new end card). The hook itself is the same. A new hook gets a new hook ID.
- LANG: `EN`, `FR`, `AR`.
- Example: `MA_B_H2_v1_EN`. Use the same string for the ad name on the platform, the export filename (`MA_B_H2_v1_EN.mp4`) and `utm_content` (`B_H2_v1_EN`).
- Campaign names: `MA_{platform}_{objective}_{LANG}_{geo}`, for example `MA_IG_Traffic_EN_UK`.

### UTM-tagged Play Store link

The Play Store reads UTM tags only through the URL-encoded `referrer` parameter:

```
https://play.google.com/store/apps/details?id=<PACKAGE_ID>&referrer=utm_source%3Dinstagram%26utm_medium%3Dpaid_social%26utm_campaign%3Dreveal%26utm_content%3DA_H1_v1_EN
```

- `utm_source` = `instagram` | `tiktok` (restrict Meta placements to Instagram Reels during the test so `instagram` stays true)
- `utm_medium` = `paid_social`
- `utm_campaign` = angle slug (`reveal`, `passphone`, `tvgame`, `tonight`, `nohardware`, `family`). In Round 1, put the hook in it too (`reveal_A_H1`), because Play Console shows campaign but not `utm_content`
- `utm_content` = hook ID (`A_H1_v1_EN`)

Two checks before spending:
1. **Play Console groups acquisition data by source and campaign.** Hook-level (`utm_content`) data may not show in the Console UI, hence the hook in `utm_campaign` above. Read hook performance (hook rate, CTR, cost per click) from the ad platform.
2. **Test the attribution path once:** tap your own tagged link on an Android phone, install on the TV through the phone's Play Store, then check Play Console after 24–48 h. The referrer may not carry over when an app is installed remotely on another device. If it doesn't, measure **Play Store visits** (link clicks) as the main conversion and watch total TV installs in Play Console (by country, against the week before launch) for the lift.

**Objective:** use **Traffic** (link clicks → Play Store URL) on Meta. App-install objectives expect an SDK in an app installed on the phone, and this app installs on the TV. TikTok may refuse app-store URLs outside the App Promotion objective; if so (and for TikTok in general), send traffic to a one-screen landing page on your own domain: a 6 s loop of the real install-on-TV flow, a "Get it on Google Play" button with the same UTM link, and the fallback line "Or search “Mish Ana” in the Apps tab on your TV". That page can also hold the TikTok and Meta pixels, which lets Meta optimize for landing-page views instead of raw clicks.

### Metrics and kill/scale rules

**The benchmark numbers below are rough starting points for paid social traffic, not guarantees.** Replace them with your own medians after Round 1.

| Metric | Definition | Kill | OK | Winner |
|---|---|---|---|---|
| **Hook rate** | 3 s video plays ÷ impressions (Meta). On TikTok use 2 s views ÷ impressions and don't compare it with Meta | < 20 % | 25–30 % | ≥ 35 % |
| **Hold rate** | Meta: ThruPlays ÷ 3 s plays. TikTok: 6 s views ÷ 2 s views | < 15 % (Meta) / < 30 % (TT) | 20–25 % / 35–45 % | ≥ 30 % / ≥ 50 % |
| **Link CTR** | Link clicks ÷ impressions | < 0.4 % | 0.6–1.0 % | ≥ 1.2 % |
| **Cost per Play Store visit** | Spend ÷ link clicks | > 2× the Round 1 median | Rough guide: Lebanon/MENA €0.05–0.20 · FR €0.20–0.60 · UK/US €0.30–1.00 | Lowest in the round, with hook rate ≥ 25 % |
| **TV installs** | Play Console installs in the test geo, vs the 7 days before launch | — | Directional only (remote-install caveat) | Rising week on week |

**Rules**
- **Minimum before judging an ad:** 72 h live **and** €25 spent **and** 2,000 impressions (all three). Cost-per-visit comparisons need ≥ 40 link clicks per ad. Budget: €8/day per ad, one ad per ad set (ABO), so each ad really gets its share.
- **Kill (at the 72 h check):** hook rate < 20 %, **or** link CTR < 0.4 %. **At day 7:** cost per visit > 2× the round median.
- **Diagnose before killing a good hook:**
  - High hook rate + low hold rate means the body is the problem. Cut it shorter and get to the word reveal faster.
  - High hold rate + low CTR means the end card is the problem. Show the install-on-TV step earlier and say "free to play" on screen.
  - High CTR + no install lift means people without the right TV are clicking. Put "Android TV & Google TV" on screen in the first 3 s.
  - Every ad fails (best CTR < 0.5 %): it's the offer or the CTA path, not one creative. Test the landing page with the "search on your TV" fallback before making new ads.
- **Install sanity check:** if Play Console shows no TV-install lift in the test geo after €150 and 150+ store visits, pause and fix the install path (attribution test, landing page) before spending more.
- **Scale:** the day-7 winner (lowest cost per visit with hook rate ≥ 25 % and CTR ≥ 0.6 %) is duplicated into a scaling ad set at €20/day. Raise that by 20–30 % every 72 h while cost per visit stays within +20 % of where it started.
- **Fatigue:** refresh when Meta frequency > 2.5–3, or CTR drops > 30 % from its 3-day peak. On TikTok, expect a creative to tire after 7–14 days. Have Round 2 hooks cut before that.
- **Pick the winning angle:** after Round 1, the angle with the best cost per store visit (with hook rate ≥ 25 %) gets 70 % of the Round 2 budget. The second-best angle gets 30 %.
- **Free signal:** post the same 5 cuts organically on the game's own TikTok and Instagram accounts. Organic 2 s/3 s view rates won't match paid numbers, but a hook that dies organically rarely wins paid.

---

## 2. Scripts

### How to read the tables

- **FILMED S#-##** = a shot from the filming guide (section 3). **MOTION** = built in Remotion at 1080×1920. Use `MishAna-9x16` plus `layoutFor(1080,1920)`, and reuse `PhoneFrame`, `Avatar`, `Bubble`, `Words`, `Rise`, `Mark` from `src/parts.tsx`. SFX are the files already in `public/sfx/`.
- **Text** = burned-in caption: Cairo 800–900, cream `#FFF7EC` with a 6 px violet `#120A1F` stroke, key word in magenta `#FF3D8B` or amber `#FFC23D`. 2–5 words per card, on screen from the first frame of its shot (no slow type-ons in a hook). Keep it inside the safe zone: y 150–1620, x 60–960.
- **Game UI must match the real app.** Best: record the real screens (phone: the built-in screen recorder; TV: `adb shell screenrecord` over the same adb connection used for installs, see the filming guide). When a screen must be rebuilt in motion, copy these details:
  - **Phone reveal:** a face-down card in the player's colour → hold → it flips to the word ("Your secret word"). Release to hide. The Mole's card looks like everyone else's. Highlight the odd word with an **edit graphic outside the phone** (an amber ring or arrow), never by recolouring the phone screen.
  - **Your turn:** the phone floods with the player's own colour (not always magenta).
  - **Vote:** each phone shows "Who's lying?" and a list of players; the TV shows "Who's not one of us?" and ✓ marks as votes come in.
  - **Vote reveal (TV):** avatar chips fly along curved paths onto the voted tile, a count rolls up, the other tiles dim, then the **OUT** stamp lands at −8°.
  - **Elimination (TV):** "SAMI IS OUT!" above a card that flips to the role: Mole = orange `#FF8A3D` with a domino mask, Civilian = sky blue `#5AB8FF` with a house, Blank = paper white. Reaction line: "…the Mole! Nice catch." / "…a Civilian. Oops." / "…the Blank! But wait, one last chance…"
  - **Results (TV):** "Civilians win!" or "The infiltrators win!", with "Civilian word: Pizza · Mole word: Pasta".
- Cast placeholders (match them to your friends): **Sami** is the Mole (your most expressive face), **Lina** is the loud accuser, **Maya** is the peeker/comic, **Omar** is the skeptic, **Karim** is the quiet one, **Host** is you.
- Music: UGC-style ads use natural audio over a low bed (music about 20 % under dialogue). Motion-only ads use `take-this-higher.mp3` (Mixkit) cut to the beat. All music is added in the edit, never recorded live.
- **Language versions:** FR uses PIZZA / PÂTES. AR uses بيتزا / برغر (or a Lebanese pair, see section 3). The FR/AR hook lines below follow that.

### Shared module: BODY-1 "The Round" (9.5 s)

Used by most scripts. It explains the game in a single pass, sound off.

| t (rel.) | Type | Visual | Text | Audio | SFX |
|---|---|---|---|---|---|
| 0.0–1.5 | FILMED S3-01 | Over-the-shoulder: a phone scans the QR on the TV, cut (skip the name typing) to "You're in!" on the phone as the player's tile drops into the TV lobby | "Scan the TV. You're in." | natural | `pop_b` on join |
| 1.5–3.0 | MOTION (or real screen recordings in `PhoneFrame`s) | 2×2 grid of `PhoneFrame`s. Thumbs press the face-down cards, which flip on the beat in each player's colour: PIZZA, PIZZA, PIZZA, PASTA. All four cards look the same; an amber ring drawn **around** the 4th phone wobbles 6° | "Everyone gets a secret word…" → "…one is slightly different." | — | `whoosh_fast` ×3, `wrong` (−6 dB) on PASTA |
| 3.0–5.5 | FILMED S1-04 | Wide shot of the group. Jump cuts on 3 clues, each with a `Bubble` burned in next to the speaker's head: Lina "Cheese." Omar "Oven." Sami "…Fork?" | small top chip "1 clue each, out loud" + bubbles | natural clue audio | `pop_a` per bubble |
| 5.5–7.0 | FILMED S1-05 | Everyone taps their phone to vote, eyes on Sami. Lina jabs a finger at him | "Vote on your phone." | "It's Sami." | `drumroll` starts |
| 7.0–9.5 | TV RECORDING (or MOTION copy) → FILMED | The real TV vote reveal: chips fly onto Sami's tile → **OUT** stamp → card flips to the orange Mole card, "…the Mole! Nice catch." → 1 s cut to the real group exploding (S2-01) | "OUT. He was the Mole." | real scream | `stamp` + `impact_drop` |

**BODY-1b** (alternative ending, for A_H2 and A_H3): 7.0–9.5 the votes land on a Civilian instead: **OUT** stamp → sky-blue Civilian card, "…a Civilian. Oops." → cut to the voted player's outrage. Caption: "Wrong guy." Film it for real: it happens in most games.

### Shared module: EC "Install on your TV" end card (4.0 s)

Every ad ends on this. People watch ads on their phone, so this card shows the phone-to-TV step. **Build it from a real screen recording** of the Play Store app on an Android phone, cropped into `PhoneFrame`, as soon as the listing is live. Don't redraw Google's UI: a fake Play Store screen with a fake "Install" button is the most likely thing in these ads to get rejected, and the real flow for a TV-only app differs from what you would guess (there is no "This phone" option, because the app can't install on a phone).

| t (rel.) | Visual | Text | SFX |
|---|---|---|---|
| 0.0–0.8 | `PhoneFrame` 620 px wide, centered at y 860, springs up from the bottom (SNAPPY). Screen: the real Play Store listing on a phone | "Install it from your phone" | `click` |
| 0.8–1.8 | Real recording: tap the install button, pick the TV in the device list (exact labels as recorded). A magenta check draws on the TV row (edit graphic) | "Pick your TV" | `tick`, `pop_a` |
| 1.8–2.6 | Real recording: the install starts | — | `swoosh_short` |
| 2.6–4.0 | Pull back: the phone shrinks to the bottom-left, and a TV mockup (900 px wide, y 520) lights up with the real Mish Ana! lobby + QR. Below it: logo + wordmark, the official **Get it on Google Play** badge (unaltered), and two lines: "Free to play · Android TV & Google TV" and, smaller, "Or search “Mish Ana” on your TV" | "Free on Android TV & Google TV" | `sparkle`, `bass_hit` on the logo |

Until the app is live, don't run ads (see section 5). For the motion ads that ship before the recording exists, keep the phone screen abstract (icon + "Install on your TV" in brand type, no Play Store look-alike), then swap in the recording.

Standard CTA lines (adjust per script where noted):
- **EN:** "Install it from your phone, straight to your TV. Free." + small line "Or search “Mish Ana” on your TV"
- **FR:** « Installe-le depuis ton téléphone, direct sur ta télé. Gratuit. » + « Ou cherche “Mish Ana” sur ta télé »
- **AR:** «نزّلها من تلفونك عالتلفزيون، ببلاش.» + «أو دوّر على "Mish Ana" عالتلفزيون»

---

### ANGLE A — The Reveal (`reveal`)

#### MA_A_H1 — "IT WAS YOU?!" cold open
- **Angle:** A · **Length:** 20 s · **Persona:** P1/P2
- **Hook:** "IT WAS YOU?!" **First frame:** Lina already in the air, mid-scream, finger pointing straight past the lens, TV behind her washed in the orange of the Mole card. No setup, no logo, no rise-from-the-couch frames.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–1.5 | FILMED S2-01 | Medium close-up, handheld with a slight push-in. Start mid-jump. TV behind shows the real Mole card | **IT WAS YOU?!** (huge, magenta, 3-frame shake) | Lina: "IT WAS YOU?!" | `impact_drop` at frame 1 |
| 1.5–3.0 | FILMED S2-02 | Reverse shot: Sami, hands up, guilty grin | "“Mish ana!” (= not me)" | Sami: "Mish ana!" | music bed starts |
| 3.0–3.8 | MOTION | Fast rewind: the frame scrubs backward with an amber "2 MINUTES EARLIER" chip | "2 minutes earlier" | — | `whoosh_fast` reversed |
| 3.8–13.3 | BODY-1 | — | — | — | — |
| 13.3–16.0 | FILMED S3-02 | Insert, filmed during the clue round: Sami's thumb holds his card to the lens: **PASTA** (real screen). Group groans over it | "Everyone had PIZZA. He had **PASTA**." | group: "Nooo" | `wrong` |
| 16.0–20.0 | EC | — | — | Host VO: "Mish Ana. Free on your TV." | `bass_hit` |

- **FR hook:** « C'ÉTAIT TOI ?! » · reveal line « Tout le monde avait PIZZA. Lui, PÂTES. » · **FR CTA:** standard
- **AR hook:** «ولك إنتَ؟! طلعت إنتَ!» · reveal line «كلّن معن بيتزا… وهوّي معو برغر.» · **AR CTA:** standard

#### MA_A_H2 — POV: you're the Mole and nobody told you
- **Angle:** A · **Length:** 19 s · **Persona:** P2
- **Hook:** "POV: your word is PASTA. Theirs is PIZZA. Nobody told you." **First frame:** first-person, your thumb already on the card, which flips to PASTA, friends soft-focus behind. This is the game's real twist (the Mole doesn't know), and it reads in one second.
- Film with **4 players** (automatic roles at 4 = 1 Mole, no Blank), so the "infiltrators win" ending happens after two wrong votes.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | FILMED S4-01 | POV, phone at chest height, thumb holds the card → **PASTA** | "POV: your word is **PASTA**." / "Theirs is PIZZA. Nobody told you." | Lina off-screen: "OK, clues!" | `tick tick` |
| 2.0–4.5 | FILMED S4-02 | POV pan across friends, one clue each, with a `Bubble` per clue | "…sounds like pasta to you." | "Cheese." "Oven." "Slice." | `pop_a` ×3 |
| 4.5–6.0 | FILMED S4-03 | Your phone floods with your colour ("Your turn!"). Everyone turns to the lens | "Your clue: “Italian.”" | Host: "…Italian." | music cuts out |
| 6.0–8.5 | TV RECORDING | Vote reveal: the chips fly past you onto **Omar** → OUT → sky-blue card, "…a Civilian. Oops." | "They voted out Omar." | — | `swoosh_short`, `stamp` |
| 8.5–10.0 | FILMED S2-05 | Omar, outraged | "Omar: innocent." | Omar: "It's NOT me!" | — |
| 10.0–11.0 | MOTION | Amber chip | "1 round later…" | — | `whoosh_fast` |
| 11.0–15.0 | TV RECORDING → FILMED S4-04 | TV: "The infiltrators win!" with "Mole word: Pasta". POV flips your phone to the group: PASTA. Everyone erupts | "You were the Mole. **You won anyway.**" | screams | `impact_drop`, music back |
| 15.0–19.0 | EC | — | — | — | — |

- **FR hook:** « POV : ton mot, c'est PÂTES. Le leur, PIZZA. Personne te l'a dit. » · **FR CTA:** standard
- **AR hook:** «POV: كلمتك برغر… كلّن معن بيتزا، وما حدا قلّك.» · **AR CTA:** standard

#### MA_A_H3 — Rate his poker face
- **Angle:** A · **Length:** 20 s · **Persona:** P1/P2
- **Hook:** "Rate his poker face. 1 to 10." **First frame:** extreme close-up of Sami's eyes darting under a frozen smile, the question already on screen. The direct question pulls comments.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | FILMED S2-03 | ECU of Sami's face, eyes moving left and right, tight smile, otherwise still. Punch in 110 % at 1.0 s | "Rate his poker face. **1 to 10.**" | silence + a faint room laugh | `tick` loop |
| 2.0–4.0 | FILMED S2-03b | Same frame. He gives his clue very calmly | "Their word: PIZZA. His clue: “Italian.”" | Sami: "Italian." | — |
| 4.0–13.5 | BODY-1b | The votes land on Karim: OUT → "…a Civilian. Oops." | "Wrong guy." | — | — |
| 13.5–16.0 | FILMED S3-02 + S2-07 | Sami's card to the lens: PASTA. Lina covers her face | "He had **PASTA** the whole time." / "Your score? 👇" | Lina: "No way!" | `stamp` |
| 16.0–20.0 | EC | — | — | — | — |

- **FR hook:** « Note son poker face. Sur 10. » · **FR CTA:** standard
- **AR hook:** «من ١ لـ ١٠… قدّيش بتعطوه عالـ poker face؟» · **AR CTA:** standard

#### MA_A_H4 — "He said FORK." (new)
- **Angle:** A · **Length:** 17 s · **Persona:** P1/P2
- **Hook:** "Their word: PIZZA. His clue: “Fork.”" **First frame:** Sami mid-word, then the whole couch freezes and turns to him in one beat. A bad clue is the funniest moment in the game, and the caption teaches the rule in 1 second.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–0.8 | FILMED S1-04 (Sami's clue) | Medium on Sami, already talking | "Their word: **PIZZA**." | Sami: "…Fork." | — |
| 0.8–1.8 | FILMED S2-08 | Wide: everyone freezes and turns to Sami in one beat. 8-frame zoom punch | "His clue: “**Fork.**”" | dead silence, one "…fork?" | record-stop `swoosh_short` |
| 1.8–3.0 | FILMED S2-03 | Sami, poker face, sips his drink (plain glass, no alcohol) | "Bold." | — | `tick` |
| 3.0–10.5 | BODY-1 (from 1.5 s, trimmed to 7.5 s) | — | — | — | — |
| 10.5–13.0 | FILMED S3-02 | Card to lens: PASTA | "Fork. For **PASTA**. Respect." | laughter | `stamp` |
| 13.0–17.0 | EC | — | — | — | — |

- **FR hook:** « Leur mot : PIZZA. Son indice : “fourchette”. » · **FR CTA:** standard
- **AR hook:** «كلّن معن بيتزا… وهوّي قال: "كاتشب"؟» (use the clue he actually gave in an Arabic round; don't dub) · **AR CTA:** standard

#### MA_A_H5 — Betrayal supercut (new)
- **Angle:** A · **Length:** 18 s · **Persona:** P2
- **Hook:** "Tag the friend who'd lie to your face." **First 1.5 s:** three different real reveal reactions at 0.5 s each (a scream, a face-palm, a couch dive). Real reactions, cut fast, are the most reliable format on both platforms, and the tag line earns shares.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–1.5 | FILMED S1-07 / S2-01 / S2-07 | 3 real reveal reactions, 0.5 s each, hard cuts on the beat | "Tag the friend who'd **lie to your face**." | real screams | `impact_drop` per cut |
| 1.5–3.0 | FILMED S2-02 + S2-06 | Two "not me" denials, 0.75 s each | "“Mish ana!” (= not me)" | "Mish ana!" "Not me!" | — |
| 3.0–12.5 | BODY-1 | — | — | — | — |
| 12.5–14.0 | MOTION | Slogan | "Everyone's innocent. **Someone's lying.**" | — | `sparkle` |
| 14.0–18.0 | EC | — | — | — | — |

- **FR hook:** « Tague le pote qui te mentirait en face. » · **FR CTA:** standard
- **AR hook:** «منشن رفيقك يلّي بيكذب بوجّك وما بيرمش.» · **AR CTA:** standard

---

### ANGLE B — Stop passing the phone (`passphone`)

#### MA_B_H1 — Stop passing the phone around
- **Angle:** B · **Length:** 20 s · **Persona:** P1
- **Hook:** "Stop passing the phone around." **First 2 s:** six 0.33 s whip cuts of one phone going from hand to hand, each person hiding the screen with their palm, until the last one fumbles it onto the carpet. Viewers who play these games will recognize it straight away.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | FILMED S5-01 | 6 tight cuts on hands: one phone passed around the circle, palms covering the screen, last one drops it | "**Stop** passing the phone around." | "Don't look!" "Pass it!" | `whoosh_fast` ×6, thud |
| 2.0–3.5 | FILMED S5-02 | Maya peeks over Karim's shoulder and gets caught. Karim slaps the phone face-down | "(and stop peeking, Maya)" | Karim: "MAYA." | `wrong` |
| 3.5–4.5 | MOTION | Flood wipe | "Now everyone plays on their **own** phone." | — | `whoosh_impact` |
| 4.5–14.0 | BODY-1 | — | — | — | — |
| 14.0–16.0 | FILMED S1-06 | Wide: all six phones raised at once, cheering | "6 players. 6 phones. **0 passing.**" | cheer | music up |
| 16.0–20.0 | EC | — | — | — | — |

- **FR hook:** « Arrête de faire tourner le téléphone. » · **FR CTA:** standard
- **AR hook:** «بلا "مرّقلي التلفون" بقى.» · **AR CTA:** standard

#### MA_B_H2 — There's always one who peeks
- **Angle:** B · **Length:** 20 s · **Persona:** P1
- **Hook:** "There's always one who peeks." **First 2 s:** Maya's peek in a 60 fps slow-motion ramp, with a magenta circle drawn around her eyes. Viewers will be tagging their own peeker.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | FILMED S5-02 (ramped) | Maya leans in to peek. Speed ramps to 25 %, a magenta ring draws around her eyes | "There's always **one** who peeks." | — | `drumroll` snippet, `swoosh_short` |
| 2.0–4.0 | FILMED S5-04 | Lina holds her card, Maya leans in, Lina lets go: the card flips back face-down instantly | "Not in this game." | Lina: "Nice try." | `pop_hard` |
| 4.0–13.5 | BODY-1 | — | — | — | — |
| 13.5–16.0 | FILMED S2-06 | Maya to camera, shrugging: "Fine, I'll just lie better." | "Hold to see. Let go to hide." | Maya line | — |
| 16.0–20.0 | EC | — | — | — | — |

- **FR hook:** « Y en a toujours un qui mate. » · **FR CTA:** standard
- **AR hook:** «دايماً في حدا بيطلّع عتلفون غيرو.» · **AR CTA:** standard

#### MA_B_H3 — Before / after split
- **Angle:** B · **Length:** 18 s · **Persona:** P1
- **Hook:** "Same game night. Zero passing." **First 2 s:** a split screen. The top half shows one phone being passed around in chaos. The bottom half shows six people scanning the TV at once. Note: half-height faces are small on a phone; keep both halves as tight hand shots.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | FILMED S5-01 (top) + S1-02 (bottom), MOTION divider | Top: "BEFORE · 1 phone". Bottom: "AFTER · 6 phones, 1 TV". A violet center bar with a magenta outline | "Same game night. **Zero passing.**" | mixed natural | `bass_hit` |
| 2.0–2.8 | MOTION | The top half slides out and the bottom half fills the screen | — | — | `whoosh_fast` |
| 2.8–12.3 | BODY-1 | — | — | — | — |
| 12.3–14.0 | MOTION | Slogan card | "Everyone's innocent. **Someone's lying.**" | — | `sparkle` |
| 14.0–18.0 | EC | — | — | — | — |

- **FR hook:** « Même soirée. Zéro téléphone qui tourne. » · **FR CTA:** standard
- **AR hook:** «نفس السهرة… بس ما حدا عم يمرّق التلفون.» · **AR CTA:** standard

#### MA_B_H4 — POV: it's YOUR phone they're passing (new)
- **Angle:** B · **Length:** 18 s · **Persona:** P1
- **Hook:** "POV: it's YOUR phone they're passing around." **First frame:** the Host's face, frozen, watching his own phone go round the circle in greasy-chip hands; a (generic, unbranded) notification "Mum: call me back" pops on it as it's passed. Phone owners feel this instantly, and it's funnier than a generic "stop passing".

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–1.0 | FILMED S5-07 | Host, deadpan, eyes tracking his phone | "POV: it's **YOUR** phone they're passing around." | — | `tick` |
| 1.0–2.5 | FILMED S5-07b | Insert: chip-dust thumb on his screen; a plain grey notification slides in | "(with your notifications on)" | Maya: "Who's ‘Mum’?" | `pop_hard` |
| 2.5–3.5 | MOTION | Flood wipe | "Now everyone uses their **own**." | — | `whoosh_impact` |
| 3.5–13.0 | BODY-1 | — | — | — | — |
| 13.0–14.0 | FILMED S3-06 | Host pockets his phone, smug | "Your phone. Your word. Nobody else's." | — | — |
| 14.0–18.0 | EC | — | — | — | — |

- **FR hook:** « POV : c'est TON téléphone qui tourne. » · **FR CTA:** standard
- **AR hook:** «POV: تلفونك إنتَ هوّي يلّي عم يتمرّق.» · **AR CTA:** standard

#### MA_B_H5 — "How we used to read the secret word" (new)
- **Angle:** B · **Length:** 17 s · **Persona:** P1
- **Hook:** "How we used to read the secret word:" **First frame:** Karim crouched in the corner of the room, phone pressed to his chest, hoodie over his head, while the group yells "Hurry up!". Then the switch to the real hold-to-see card. It shows a real feature, not a promise.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–1.5 | FILMED S5-08 | Karim in the corner under his hoodie, reading the shared phone; the group yells | "How we used to read the secret word:" | "HURRY UP!" | `tick` loop |
| 1.5–3.5 | FILMED S3-02 | ECU of his own phone: thumb holds → the card flips to the word → thumb lifts → card hides | "Now: **hold to see. Let go to hide.**" | — | `whoosh_fast`, `pop_a` |
| 3.5–13.0 | BODY-1 | — | — | — | — |
| 13.0–17.0 | EC | — | — | — | — |

- **FR hook:** « Comment on lisait le mot secret avant : » · **FR CTA:** standard
- **AR hook:** «هيك كنّا نقرا الكلمة السرّية:» · **AR CTA:** standard

---

### ANGLE C — A fun game for your TV (`tvgame`)

#### MA_C_H1 — "Looking for a fun game for your TV? Here's one."
- **Angle:** C · **Length:** 20 s · **Persona:** P4
- **Hook:** "Looking for a fun game for your TV? Here's one." **First frame:** the question already on screen over a fast whip-scroll of grey tiles; the click to the lobby lands at 0.6 s. Three seconds of browsing tiles is what every TV ad looks like: get through it before the thumb moves.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–0.6 | FILMED S6-01 + MOTION screen replace | OTS with remote. The TV is replaced in post with generic grey tiles whip-scrolling (no real app logos) | "Looking for a fun game for your TV?" | Host VO: "Looking for a game for your TV?" | `tick` ×3 |
| 0.6–1.5 | same | Click. The screen snaps to the real Mish Ana! lobby with QR | "**Here's one.**" | VO: "Here's one." | `click`, `bass_hit` |
| 1.5–4.5 | FILMED S6-02 | Host turns to camera, waist-up, lobby on the TV behind | "Mish Ana! · 3 to 12 players" | Host: "It's called Mish Ana. Everyone plays on their own phone." | bed in |
| 4.5–14.0 | BODY-1 | — | — | — | — |
| 14.0–16.0 | FILMED S6-02b | Host to camera | "No controllers. Free." | Host: "No controllers, and it's free." | — |
| 16.0–20.0 | EC | — | — | VO: "Install it from your phone, straight to your TV." | — |

- **FR hook:** « Tu cherches un jeu sympa pour ta télé ? En voilà un. » · **FR CTA:** standard
- **AR hook:** «عم تدوّر على لعبة حلوة للتلفزيون؟ هيدي هيّي.» · **AR CTA:** standard

#### MA_C_H2 — Your TV can do more than streaming
- **Angle:** C · **Length:** 20 s · **Persona:** P4/P2
- **Hook:** "Your TV can do more than streaming." **First frame:** four friends staring at a grey "continue watching" grid, the line already on screen; the snap lands at 0.5 s. (v1 had 1.2 s of silent static shot: dead air in the one place you can't afford it.)

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–0.5 | FILMED S5-03 + MOTION screen replace | Locked wide from behind the couch. The TV shows a generic grey grid of blank tiles | "Your TV can do more than streaming." | room tone | — |
| 0.5–1.5 | same | Host snaps fingers. The TV floods into the lobby, the room light shifts magenta (LED strip, see the filming guide) | — | snap | `whoosh_impact` |
| 1.5–11.0 | BODY-1 | — | — | — | — |
| 11.0–14.0 | FILMED S1-07 | Group laughing, someone falls off the couch arm | "A party game on your TV. Your phones are the controllers." | laughter | music up |
| 14.0–16.0 | MOTION | Slogan | "Everyone's innocent. **Someone's lying.**" | — | `sparkle` |
| 16.0–20.0 | EC | — | — | — | — |

- **FR hook:** « Ta télé sait faire autre chose que du streaming. » · **FR CTA:** standard
- **AR hook:** «تلفزيونك مش بس للمسلسلات.» · **AR CTA:** standard

#### MA_C_H3 — 3 to 12 players. One TV.
- **Angle:** C · **Length:** 15 s · **Persona:** P4/P3
- **Hook:** "3 players. 12 players. One TV." **First 2 s:** a kinetic counter jumps 3 → 12 while 12 coloured `Avatar`s pop around a glowing TV mockup.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | MOTION | A TV mockup at center. A big amber number counts 3→12 on the beat, with one `Avatar` popping in per count in a ring | "**3** to **12** players. One TV." | — | `pop_a`/`pop_b` alternating |
| 2.0–4.0 | FILMED S1-02 | Real wide: 5 people scanning the QR at once (speed-ramped through the name typing) | "Everyone joins with their phone." | natural | `pop_b` |
| 4.0–9.0 | BODY-1 (from 1.5 s to 6.5 s) | words → clues → vote | — | — | — |
| 9.0–11.0 | TV RECORDING → FILMED S2-01 | OUT stamp → Mole card → reaction | "OUT. The Mole." | scream | `stamp` |
| 11.0–15.0 | EC | — | — | — | — |

- **FR hook:** « De 3 à 12 joueurs. Une seule télé. » · **FR CTA:** standard
- **AR hook:** «من ٣ لـ ١٢ لاعب… وتلفزيون واحد.» · **AR CTA:** standard

---

### ANGLE D — Nothing to do tonight (`tonight`)

#### MA_D_H1 — 5 people, 5 phones, 0 plans
- **Angle:** D · **Length:** 20 s · **Persona:** P2
- **Hook:** "Friday night. 5 people. 5 phones. 0 plans." **First frame:** five friends slumped on the couch, faces lit blue by their phones, with the full line already on screen (no typing animation) and Omar's "So… what do we do?" landing at 0.3 s. A bored shot only works if something is said in the first half-second.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–1.5 | FILMED S5-03 | Locked wide, dim room, everyone scrolling | "Friday night. 5 people. 5 phones. **0 plans.**" | Omar: "So… what do we do?" Karim: "Dunno." | — |
| 1.5–3.0 | FILMED S5-05 | Host stands into frame and grabs the remote | "Phones out. Not for scrolling." | Host: "Phones out. Not for scrolling." | `click` |
| 3.0–12.5 | BODY-1 | — | — | — | — |
| 12.5–16.0 | FILMED S1-07 | Same couch, same people, now loud and laughing | "Same couch. Better night." | laughter | music up |
| 16.0–20.0 | EC | — | — | — | — |

- **FR hook:** « Vendredi soir. 5 potes. 5 téléphones. 0 plan. » · **FR CTA:** standard
- **AR hook:** «سبت بالليل. ٥ رفقات، ٥ تلفونات… وما في خطّة.» (Saturday, not Friday: Saturday is the night out in Lebanon, and «ليلة الجمعة» means Thursday night) · **AR CTA:** standard

#### MA_D_H2 — Things to do tonight that aren't another movie
- **Angle:** D · **Length:** 20 s · **Persona:** P2
- **Hook:** "Things to do tonight that aren't another movie." **First 1 s:** a listicle card over the couch shot. Item 1 "Another movie" is struck through in magenta on the first beat.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–1.2 | FILMED S5-03 + MOTION list | A list card (cream on violet, rounded 32 px) over the dim couch shot | "Things to do tonight that **aren't** another movie:" / "1. ~~Another movie~~" | — | `swoosh_short` on the strike |
| 1.2–2.2 | MOTION list | "2. ~~Scroll until 2am~~" | — | — | strike |
| 2.2–3.2 | MOTION list → FILMED | "3. Find the liar in your friend group ✓" (amber check). The card flies off and the TV floods magenta | — | — | `correct` |
| 3.2–12.7 | BODY-1 | — | — | — | — |
| 12.7–16.0 | FILMED S2-01 + S2-02 | Accusation and denial | "Free. On your TV. Tonight." | "IT WAS YOU" / "Mish ana!" | `stamp` |
| 16.0–20.0 | EC | — | — | — | — |

- **FR hook:** « Ce soir, autre chose qu'un film ? » · **FR CTA:** standard
- **AR hook:** «شو فينا نعمل الليلة غير فيلم كمان؟» · **AR CTA:** standard

#### MA_D_H3 — The group chat
- **Angle:** D · **Length:** 18 s · **Persona:** P2
- **Hook:** "what are we doing tonight" / "idk" / "idk" / "idk". **First 2 s:** a generic (not WhatsApp-branded) group chat on violet. Three "idk" bubbles land with pops, then the host replies.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | MOTION | Chat UI with generic grey/magenta bubbles. "what are we doing tonight" → "idk" ×3, rapid | chat itself | — | `pop_a` per bubble |
| 2.0–3.0 | MOTION | Host bubble in magenta: "come over. bring your phone." then "(and snacks)" | — | — | `pop_hard` |
| 3.0–4.5 | FILMED S5-06 | Door opens, 3 friends walk in already holding their phones up | "Bring your phone. That's the controller." | "We're here!" | music in |
| 4.5–14.0 | BODY-1 | — | — | — | — |
| 14.0–18.0 | EC | — | — | — | — |

- **FR hook:** « "on fait quoi ce soir ?" "jsp" "jsp" "jsp" » · **FR CTA:** standard
- **AR hook:** write the chat in Arabizi, the way Lebanese friends actually text: "shu mna3mol lleile?" / "ma ba3ref" / "ma ba3ref" / "wala ana" → host: "ta3ou la3ende. jibou telephonetkon." Captions over it in Arabic script for the RTL version if needed · **AR CTA:** standard

---

### ANGLE E — Zero hardware (`nohardware`)

#### MA_E_H1 — You don't need any of this
- **Angle:** E · **Length:** 18 s · **Persona:** P1/P4
- **Hook:** "You don't need any of this." **First 2 s:** top-down shot of a coffee table buried in controllers, cables and dongles. One arm sweeps everything out of frame, then a single phone drops into the empty center.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | FILMED S3-05 | Top-down, the arm sweep, the phone drop. Logos taped over or turned away | "You don't need **any** of this." | clatter | `whoosh_impact` |
| 2.0–4.0 | MOTION | Checklist over violet: "Controllers ✗" "An app on every phone ✗" "Passing one phone ✗" → "Your TV + your phones ✓" (amber) | as listed | — | `wrong` ×3, `correct` |
| 4.0–13.5 | BODY-1 | — | — | — | — |
| 13.5–14.0 | MOTION | Flash card | "Free to play." | — | `sparkle` |
| 14.0–18.0 | EC | — | — | — | — |

- **FR hook:** « T'as besoin de rien de tout ça. » · **FR CTA:** « Pas de manette, pas d'appli. Installe-le depuis ton téléphone, direct sur ta télé. Gratuit. »
- **AR hook:** «ما بدّك شي من هول.» · **AR CTA:** «لا جويستيك، ولا تطبيق. نزّلها من تلفونك عالتلفزيون، ببلاش.»

#### MA_E_H2 — Everything you need for game night
- **Angle:** E · **Length:** 16 s · **Persona:** P1/P4
- **Hook:** "Everything you need for game night:" followed by one phone held up, then "(that's it)". **First 2 s:** the host holds a single phone at arm's length toward the lens, with the TV lobby glowing behind.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | FILMED S3-06 | Host holds the phone toward the lens, deadpan, TV QR soft behind | "Everything you need for game night:" → "(that's it)" | Host: "That's it." | `pop_hard` on "(that's it)" |
| 2.0–5.0 | FILMED S1-02 | One real take of 3 friends scanning and joining, speed-ramped ×3 through the name typing; their tiles drop into the TV lobby | "Scan. Join. Play." | natural | `pop_b` ×3 |
| 5.0–12.0 | BODY-1 (from 1.5 s, cut to 7 s) | — | — | — | — |
| 12.0–16.0 | EC | — | — | — | — |

- **FR hook:** « Tout ce qu'il te faut pour une soirée jeux : (c'est tout) » · **FR CTA:** standard
- **AR hook:** «كلّ يلّي بدّك ياه لسهرة ألعاب: (بس هيدا)» · **AR CTA:** standard

#### MA_E_H3 — If my Teta can join, anyone can
- **Angle:** E · **Length:** 18 s · **Persona:** P3/P1 (bridges E and F)
- **Hook:** "If my Teta can join, anyone can." **First 2 s:** a grandmother (or the oldest relative willing) holds a phone at arm's length and squints at the TV QR, then her tile pops onto the TV and she throws her hands up. Joining takes scan + name + colour, so it is longer than 2 s: shoot it as one real take and speed-ramp the middle. Never caption a time ("in 2 seconds").

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | FILMED S7-01 | **Real single take**, medium shot, TV in frame, middle speed-ramped. Scan → join → her cheer | "If my Teta can join, **anyone** can." | Teta: «ولو! سهلة!» | `pop_b` on join |
| 2.0–3.0 | MOTION | Chip | "No app. No account. Just scan." | — | `swoosh_short` |
| 3.0–12.5 | BODY-1 (family footage S7 if available) | — | — | — | — |
| 12.5–14.0 | FILMED S7-05 | Teta accuses someone, finger raised | "Teta was right." | Teta: «إنتَ!» | `stamp` |
| 14.0–18.0 | EC | — | — | — | — |

"No account" is accurate: joining is scan, a nickname and a colour, with no sign-up.

- **FR hook:** « Si mamie y arrive, tout le monde y arrive. » · **FR CTA:** standard
- **AR hook:** «إذا تيتا عرفت تفوت، الكلّ بيعرف.» · **AR CTA:** standard

---

### ANGLE F — Family & culture (`family`)

Run the Arabic versions first in Lebanon and in Arabic-speaking diaspora geos. English on-screen text plus Arabic dialogue with English subtitles also works for diaspora audiences. Target by geo and language only: never by religion or ethnicity, and never write copy that tells the viewer what they are ("Are you Lebanese?", "your Lebanese family"); Meta's personal-attributes policy rejects that.

#### MA_F_H1 — Lebanese family game night
- **Angle:** F · **Length:** 20 s · **Persona:** P3
- **Hook:** "Lebanese family game night just got dangerous." **First 2 s:** close-up of two phones side by side, held by an uncle and an aunt. One shows **تبولة** (Tabbouleh), the other **فتوش** (Fattoush). Both of them try to look innocent. Every Lebanese viewer gets the joke before reading a word.

> The pair is from the Lebanese food pack (`lb-food-01`). Play in Arabic with that pack selected. The game picks pairs at random, so use the filming build described in section 3 to get this exact pair on camera.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | FILMED S7-02 | Tight two-shot of the held cards, then a tilt up to the two straight faces | "Lebanese family game night just got **dangerous**." | uncle: «شو؟ ما في شي.» | `tick` |
| 2.0–4.0 | MOTION | Language chip pops in: "English · Français · عربي" + "Lebanese word packs" | as listed | — | `pop_a` |
| 4.0–13.5 | BODY-1 (family footage S7: clues in Arabic, with English subtitles) | — | — | — | — |
| 13.5–16.0 | FILMED S7-05 | Teta points, the whole room explodes | "Never trust your khalo." | Teta: «طلعت إنتَ!» | `stamp` |
| 16.0–20.0 | EC (AR version: Arabic labels) | — | — | — | — |

- **FR hook:** « Soirée jeux en famille libanaise : ça va mal finir. » · **FR CTA:** standard
- **AR hook:** «سهرة العيلة رح تولّع.» (on-screen with the two cards: «تبولة؟ فتوش؟ حدا عم يكذب.») · **AR CTA:** «نزّلها من تلفونك عالتلفزيون، ببلاش… وفيها كلمات لبنانية.»

#### MA_F_H2 — After iftar (Ramadan, produce in January 2027)
- **Angle:** F · **Length:** 20 s · **Persona:** P3
- **Hook:** "After iftar. Before the series." **First 2 s:** foreground soft focus on a lit fanous and a glass of jallab. The family is visible moving to the couch, and the TV turns magenta behind them. Warm amber light.

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | FILMED S7-03 | Rack focus from the fanous to the family settling on the couch at night | "After iftar. **Before the series.**" | family chatter | warm, slow licensed bed |
| 2.0–4.0 | FILMED S7-01b | Three generations scan the QR | "Everyone joins from their own phone." | — | `pop_b` ×3 |
| 4.0–13.5 | BODY-1 (family footage) | — | — | — | — |
| 13.5–16.0 | FILMED S7-06 | Group photo pose, everyone holding a phone, laughing | "3 to 12 players. Arabic, English, French." | — | music up |
| 16.0–20.0 | EC | — | — | — | — |

Film it at night, keep it respectful, and show no eating outside iftar. Don't add religious text or symbols beyond everyday décor (fanous). Bonus: جلاب / تمر هندي (Jallab / Tamer hendi) is a real pair in the Lebanese pack.

- **FR hook:** « Après l'iftar. Avant la série. » · **FR CTA:** standard
- **AR hook:** «بعد الفطور… وقبل المسلسل.» · **AR CTA:** «لعبة سهرات رمضان. نزّلها من تلفونك عالتلفزيون، ببلاش.»

#### MA_F_H3 — Family of 12? Perfect. (Christmas/New Year, run in December 2026)
- **Angle:** F · **Length:** 20 s · **Persona:** P3
- **Hook:** "Family of 12? Perfect." **First 2 s:** an overcrowded wide shot. Sofas, floor cushions and a cousin on the armrest, all holding lit phones up toward the camera. (At 12 players the game deals 3 Moles and 2 Blanks automatically: more liars, more chaos.)

| t | Type | Visual | Text | VO / natural | SFX / music |
|---|---|---|---|---|---|
| 0.0–2.0 | FILMED S7-04 | Wide, slightly high angle, everyone holding phones up and cheering | "Family of 12? **Perfect.**" | "Yalla!" | `bass_hit` |
| 2.0–3.5 | MOTION | The amber counter "12" with avatar ring (same as C_H3, shortened) | "Up to 12 players. 3 Moles." | — | `pop_a` run |
| 3.5–13.0 | BODY-1 (family footage) | — | — | — | — |
| 13.0–16.0 | FILMED S7-05 | Reveal: the youngest adult turns out to be a Mole | "The holiday game is on your TV." | screams | `stamp` |
| 16.0–20.0 | EC | — | — | — | — |

- **FR hook:** « Vous êtes 12 ? Parfait. » · **FR CTA:** standard
- **AR hook:** «العيلة ١٢؟ أحسن… كلّنا منلعب.» · **AR CTA:** standard

---

## 3. Filming guide (one evening, 4–6 friends, about 4 hours)

### Before the evening
- **Signed releases from everyone who appears**, collected before filming. A one-page form is enough: name, signature, date, and "I allow [your company] to use video/photos/voice of me in paid advertising on social media and the web, worldwide, for [24 months / unlimited], without payment." Anyone under 18 needs a parent or guardian signature. Better still, keep minors out of the ads entirely, except as background in the family scenes with guardian consent.
- **Room prep:** remove anything with a brand (logo hoodies, posters, snack packaging, consoles with logos). Clear any alcohol off the table and out of shot. The TV may only show Mish Ana! or a plain screen, never a show, a match, or another app.
- **Brand light:** put one cheap RGB LED strip behind the TV set to magenta (#FF3D8B is close to preset "pink"), plus one warm lamp (amber) beside the couch. That gives you the brand palette for free.
- **Props:** 6 phones with the game ready and the screens cleaned; a pile of controllers, cables and dongles for S3-05 (borrowed is fine, logos taped over); a remote; snacks in plain bowls; a hoodie for S5-08.
- **Phones (cameras):** 2 phones that are **not** players. **Cam A** on a tripod or shelf for locked wide shots, **Cam B** handheld for close-ups and POV.

### Game settings for filming
The ads depend on specific game moments, and the game deals words and roles at random. Set it up so you get them:
- **Two kinds of rounds.** *Real rounds* (the game picks everything) give you the genuine reactions. *Scripted-word rounds* give you the PIZZA/PASTA (and تبولة/فتوش) inserts. For those, run a local build (`pnpm dev`, see the game repo README) with a filming-only word pack that contains just that one pair, at difficulty Medium. The screens are the real app; only the pair choice is forced. Never ship that pack, and only use pairs that exist in the real packs.
- **Players and roles.** For the PIZZA/PASTA story (BODY-1, A_H2, A_H3) play with **4 players**: automatic roles give 1 Mole and no Blank. With 5–6 players the game adds a Blank by default; either use that footage for real rounds or set Roles → Custom → Blanks 0.
- **Beginner mode off** (default): the Mole must not see "Mole" on their phone.
- **Shuffle word sides:** off during scripted-word rounds, so the Mole gets PASTA, not PIZZA.
- **Timers:** clue turn 20 s, vote 30 s, reading the word 15 s. Shorter timers keep energy up and cut filming time.
- **Record the TV for real:** `adb shell screenrecord /sdcard/round1.mp4` (max 3 min per file, then pull it with `adb pull`) during every round. These recordings replace most of the "MOTION" game UI in the scripts and are always accurate.

### Camera settings (both cameras)
- **1080×1920, vertical.** Shoot 4K if storage allows, then crop or punch in during the edit.
- **Frame rate:** 60 fps for slow-motion shots (S5-02, S2-01); 30 fps otherwise. In 50 Hz countries (Lebanon, France) LED bulbs can flicker on camera at 60 fps: test 10 s first, and switch to 50 fps or move off LED room light if you see banding.
- Turn off: HDR video, beauty/portrait filters, night mode, auto-framing. Turn on stabilization and the grid.
- **Lock exposure and focus** on faces (long-press on a face → AE/AF lock), then pull exposure down about −0.3 so the TV doesn't blow out.
- **TV brightness at about 50–60 %**, otherwise the screen turns into a white rectangle.
- Phones used **as props:** set brightness to max, turn on Do Not Disturb, and turn off notification previews (except the staged notification in S5-07b).
- Wipe the lens before every setup. Record room audio on the camera phone, and put a cheap lav on the Host for talking-head lines if you have one.
- **No music playing in the room.** Turn off speakers and Spotify. The game's own sound cues are original (synthesised for the app), so they can stay on; mute the TV in the pause menu if they clash with dialogue.

### Shot list by setup (about 4 hours total, plus breaks)

**Priority:** if time runs short, the shots needed for Round 1 (MA_A_H1, MA_B_H1 and BODY-1) are marked ★. Do those first.

**Setup 1 — Living room wide, Cam A locked (50 min, play real rounds)**
| ID | Shot | Used in |
|---|---|---|
| S1-02 | All friends scanning the TV QR at once, tiles dropping into the lobby. One real take, 3 times | B_H3, C_H3, E_H2 |
| ★ S1-04 | Clue round, whole group in frame. Keep rolling through 4–5 real rounds | BODY-1, A_H4 |
| ★ S1-05 | The vote: everyone taps their phone, eyes on the suspect, someone points | BODY-1 |
| ★ S1-06 | All phones raised at once, cheering | B_H1 |
| S1-07 | The group laughing and loud after a reveal | A_H5, C_H2, D_H1 |

**Setup 2 — Reactions, Cam B handheld (45 min)**
| ID | Shot | Used in |
|---|---|---|
| ★ S2-01 | Lina jumps up and points past the lens: "IT WAS YOU?!" (real version during play + 3 staged takes; start recording before the jump) | A_H1, A_H5, BODY-1, C_H3, D_H2 |
| ★ S2-02 | Sami, hands up, guilty grin: "Mish ana!" | A_H1, A_H5, D_H2 |
| S2-03 / 03b | ECU of Sami's poker face, then the calm clue "Italian." | A_H3, A_H4 |
| S2-05 | Omar outraged: "It's NOT me!" | A_H2 |
| S2-06 | Maya to camera: "Fine, I'll just lie better." | B_H2, A_H5 |
| S2-07 | Lina covers her face: "No way!" | A_H3, A_H5 |
| S2-08 | Wide: everyone freezes and turns to Sami after his "Fork." clue (real if it happens, else staged) | A_H4 |

**Setup 3 — Hands and inserts, Cam B (30 min)**
| ID | Shot | Used in |
|---|---|---|
| ★ S3-01 | Over-the-shoulder: a phone scans the TV QR and shows "You're in!" | BODY-1 |
| ★ S3-02 | ECU of a thumb holding the card: it flips to the word, then hides on release. PASTA (scripted-word round), plus the real words from real rounds. Also record the same on the phone's screen recorder | A_H1, A_H3, A_H4, B_H5 |
| S3-05 | Top-down: the controller/cable pile → arm sweep → one phone dropped in the middle. 5 takes | E_H1 |
| S3-06 | Host holds one phone toward the lens, deadpan, TV lobby behind; also pockets it smugly | E_H2, B_H4 |

**Setup 4 — POV, Cam B at chest height (20 min, 4 players, scripted-word round with the Host as the Mole)**
| ID | Shot | Used in |
|---|---|---|
| S4-01 | Your thumb holds the card → PASTA | A_H2 |
| S4-02 | Pan across friends giving clues | A_H2 |
| S4-03 | "Your turn" flood on your phone, everyone turns to stare into the lens | A_H2 |
| S4-04 | You flip the phone to the group: PASTA → eruption (after the TV shows "The infiltrators win!") | A_H2 |

To make the Host the Mole: deal again (Play again) until the Host's card shows PASTA; with 4 players that takes 4 tries on average.

**Setup 5 — "Before" scenes, staged (35 min)**
| ID | Shot | Used in |
|---|---|---|
| ★ S5-01 | One phone passed hand to hand, palms over the screen, last person drops it on the carpet (shoot tight on hands, 3 takes) | B_H1, B_H3 |
| ★ S5-02 | Maya peeks over Karim's shoulder, he slams the phone face-down (also one take at 60 fps for the ramp) | B_H1, B_H2 |
| S5-03 | Locked wide: everyone slumped, scrolling, dim light, silent. TV screen plain/off (it gets replaced in post) | C_H2, D_H1, D_H2 |
| S5-04 | Lina holds her card, Maya leans in, Lina lets go | B_H2 |
| S5-05 | Host stands up into frame, grabs the remote: "Phones out. Not for scrolling." | D_H1 |
| S5-06 | Front door opens, 3 friends walk in with phones up | D_H3 |
| S5-07 / 07b | Host's deadpan face watching his phone go round; insert of a chip-dust thumb and a plain grey notification "Mum: call me back" (staged with a generic notification, no app branding) | B_H4 |
| S5-08 | Karim in the corner under his hoodie reading the shared phone, group yelling "Hurry up!" | B_H5 |

**Setup 6 — Host talking head (15 min)**
| ID | Shot | Used in |
|---|---|---|
| S6-01 | Over-the-shoulder at the TV with remote, scrolling (screen replaced in post) | C_H1 |
| S6-02 / 02b | Waist-up to camera, lobby on the TV behind. Say each line 3 times: once natural, once faster, once smiling | C_H1 |

**Setup 7 — Family session (separate evening or weekend lunch, in November for the December ads)**
| ID | Shot | Used in |
|---|---|---|
| S7-01 / 01b | Teta (or the oldest relative) scans and joins in **one real take**. Three generations scanning | E_H3, F_H2 |
| S7-02 | Two held cards showing تبولة / فتوش, tilt up to the straight faces (scripted-word round, Arabic) | F_H1 |
| S7-03 | Fanous + jallab foreground, family to the couch (Ramadan, at night) | F_H2 |
| S7-04 | Overcrowded wide, everyone holding phones up (aim for 10–12 people) | F_H3 |
| S7-05 | Reveal + accusation, Arabic dialogue | E_H3, F_H1, F_H3 |
| S7-06 | Group pose with phones | F_H2 |

### Getting real reactions
1. **Play for real first, film second.** Run 4–5 real rounds with Cam A rolling and the TV screen-recording the whole time. Nobody knows who the Mole is, not even the Mole. The best "IT WAS YOU?!" will come from these rounds.
2. **Set stakes:** the loser of each round does the dishes or a forfeit. Real stakes, real screams. No money.
3. **Never say "act surprised".** For staged lines, give the situation ("he lied to you for the whole round") and let them use their own words. Shoot 3 takes and keep the messiest one.
4. Keep both cameras rolling **through the reveal and 5 s after it**. The second laugh is often the best one.
5. Do the scripted-word rounds and staged pickups (S2, S4, S5) **after** the real rounds, when everyone is warmed up.
6. Leave 1 s of silence before and after every line so it can be cut cleanly.

### Delivery
Make one folder per setup (`S1/`, `S2/` …) and rename the best takes with the shot ID (`S2-01_take3.mov`). Put TV recordings in `tv/` and phone screen recordings in `phone/`. Keep the signed releases as PDFs in `releases/`.

---

## 4. Motion-only scripts (no filming — produce these first)

These are built entirely in Remotion: 1080×1920, 60 fps (matching `time.ts`), cut to `take-this-higher.mp3` (Mixkit, 123.78 BPM, 1 beat ≈ 0.485 s) with the SFX from `public/sfx/`. Reuse the existing film's lobby, phone flood, clue bubbles, vote flight and MOLE stamp, re-laid out with `layoutFor(1080, 1920)`. All on-screen game UI must match the real app.

### ★ MA_A_M1 — "Everyone's word is PIZZA" (MOTION-ONLY)
- **Angle:** A Reveal · **Length:** 15 s · **utm:** `reveal` / `A_M1_v1_EN`
- **Hook (0–2 s):** "Everyone's word is PIZZA." Five phones flood magenta on five beats, then the fifth one glitches to amber **PASTA**. The rhythm break is the pattern interrupt.

| t | Visual | Text | SFX / music |
|---|---|---|---|
| 0.0–1.2 | Violet #120A1F. Five `PhoneFrame`s (300×620) in a 3+2 fan, centered at y 900. Each floods magenta on a beat and shows "YOUR SECRET WORD: PIZZA" | "Everyone's word is **PIZZA**." | music at the drop, `whoosh_fast` per phone |
| 1.2–2.4 | Phone 5 RGB-split glitches (3 frames) → amber flood → **PASTA**, 6° wobble spring | "Except **his**." | `wrong`, `bass_hit` |
| 2.4–6.4 | The phones shrink into 5 `Avatar`s around the center. `Bubble`s appear one per beat: Lina "Cheese", Omar "Oven", Maya "Slice", Karim "Delivery", Sami "…Fork?" (amber bubble, wobble) | "Clue time." | `pop_a`/`pop_b` alternating |
| 6.4–9.0 | A TV mockup rises to the top third. Four colored vote dots arc from the avatars onto Sami (`Rise` + bezier), and a counter ticks 1→4 | "Vote out the liar." | `drumroll` → `swoosh_short` per vote |
| 9.0–11.0 | **MOLE!** stamp across Sami (scale 1.6→1, 4-frame shake, magenta), Sami's phone flips: PASTA | "**IT WAS YOU?!**" | `stamp`, `impact_drop` |
| 11.0–15.0 | EC | — | `sparkle`, `bass_hit` |

- **FR hook:** « Le mot de tout le monde : PIZZA. » / « Sauf lui. » · **FR CTA:** standard
- **AR hook:** «كلّن كلمتن PIZZA…» / «إلّا هوّي.» · **AR CTA:** standard (render the Arabic text RTL with `direction: rtl`. Cairo covers Arabic)

### ★ MA_E_M2 — "Game-night checklist" (MOTION-ONLY)
- **Angle:** E Zero hardware · **Length:** 15 s · **utm:** `nohardware` / `E_M2_v1_EN`
- **Hook (0–2 s):** "Game night checklist." Three items people expect to need get struck through in magenta, one per beat.

| t | Visual | Text | SFX / music |
|---|---|---|---|
| 0.0–0.5 | Cream title slams in (`Words`, step 3 frames) | "GAME NIGHT CHECKLIST" | `bass_hit` |
| 0.5–2.4 | Three rows rise in on beats, each with a line icon (controller, phone with ↓, two hands passing a phone). A magenta strike draws through each row (strokeclip, 10 frames) | "Controllers" ~~✗~~ · "An app on every phone" ~~✗~~ · "Passing one phone around" ~~✗~~ | `wrong` ×3 (−8 dB) |
| 2.4–3.2 | A 4th row lands in amber with a check | "Your TV + your phones ✓" | `correct` |
| 3.2–6.0 | The checklist slides out. A TV mockup shows the lobby + QR + room code. Four phones fly in from the edges, a magenta scan-line sweeps from each phone to the QR, and an avatar pops into the lobby per phone | "Scan. You're in." | `pop_b` ×4 |
| 6.0–9.0 | "Start" press → magenta flood races across all phones → PIZZA ×3, PASTA ×1 | "Everyone gets a secret word. One is different." | `whoosh_impact` |
| 9.0–11.0 | Three chips stack: "Free to play" · "3–12 players" · "English · Français · عربي" | as listed | `pop_a` ×3 |
| 11.0–15.0 | EC | — | — |

- **FR hook:** « Check-list soirée jeux : manettes ✗ appli ✗ téléphone qui tourne ✗ » · **FR CTA:** « Pas de manette, pas d'appli. Installe-le depuis ton téléphone, direct sur ta TV. Gratuit. »
- **AR hook:** «شو بدّك لسهرة ألعاب؟ جويستيك ✗ تطبيق ✗ تمرير التلفون ✗» · **AR CTA:** «لا جويستيك، لا تطبيق. نزّلها من تلفونك عالتلفزيون، ببلاش.»

### ★ MA_C_M3 — "Spot the Mole" puzzle (MOTION-ONLY)
- **Angle:** C TV game (demonstrates the game as a puzzle the viewer plays) · **Length:** 20 s · **utm:** `tvgame` / `C_M3_v1_EN`
- **Hook (0–2 s):** "One of them has a different word. Can you find them?" The viewer gets a job to do in the first second. Five avatars sit around an amber countdown ring.

| t | Visual | Text | SFX / music |
|---|---|---|---|
| 0.0–2.0 | Five `Avatar`s in a ring (radius 300, centered at y 900), an amber timer ring around them starts draining | "One of them has a **different word**. Who?" | `tick` per beat, music low |
| 2.0–8.0 | Clue `Bubble`s, one per 1.2 s: Lina "Cheese", Omar "Oven", **Sami "Fork"**, Maya "Slice", **Karim "Sauce"** | "Their clues:" | `pop_a`/`pop_b` |
| 8.0–11.0 | Big 3-2-1 countdown (amber, scale-punch on each number). The ring fills | "Comment your guess." | `tick` ×3, `drumroll` |
| 11.0–13.5 | Karim's phone flips: **PASTA**. MOLE! stamp on Karim | "**Karim.** 'Sauce' fooled you." | `stamp`, `impact_drop` |
| 13.5–15.0 | Sami's phone flips: PIZZA, with a small amber caption | "(Sami just eats pizza with a fork.)" | `pop_hard` |
| 15.0–16.0 | Slogan | "Everyone's innocent. **Someone's lying.**" | `sparkle` |
| 16.0–20.0 | EC | — | — |

Why it works: Sami's "Fork" is a red herring and Karim's "Sauce" fits both words, so viewers argue in the comments. Comments push distribution, and the puzzle shows the game better than any feature list could.

- **FR hook:** « L'un d'eux a un mot différent. Lequel ? » · **FR CTA:** standard
- **AR hook:** «واحد منّن كلمتو غير شكل. مين؟» · **AR CTA:** standard (rename the avatars in Arabic for the AR version: لينا، عمر، سامي، مايا، كريم)

**Production order:** A_M1 (most of it reuses the existing film) → E_M2 → C_M3. Build the EC end card first as a standalone composition (`EC-EN`, `EC-FR`, `EC-AR`) so every ad can import it.

---

## 5. Platform rules checklist

**Claims and accuracy**
- [ ] The app is **live** on Google Play for TV before any ad runs. Use "Available on Google TV" / "Get it on Google Play" only once it's live. The ads link to the store, so pre-launch ads would lead to a dead end.
- [ ] Every claim is true today: free to play, 3–12 players, no app on the phones, no account, no controllers, EN/FR/AR.
- [ ] "Free" is worded as "Free" or "Free to play". The app has optional in-app purchases (Premium), and the Play listing will say so: never write "100% free", "no in-app purchases" or "no catch".
- [ ] State the device: "Android TV & Google TV" on the end card. Never imply Samsung Tizen, LG webOS, Apple TV, Roku, Fire TV or the original app-less Chromecast.
- [ ] Recreated UI matches the real app screens (see "Game UI must match the real app" in section 2): face-down card + hold to see, identical cards for the Mole, votes on the phones, OUT stamp, role card flip, "The infiltrators win!". No "MOLE!" stamp, no colour-coded Mole phone, no features, word packs or modes that don't exist (no premium packs).
- [ ] Every word pair shown exists in the pack for that language (EN Pizza/Pasta, FR Pizza/Pâtes, AR بيتزا/برغر, Lebanese تبولة/فتوش). No PIZZA/PASTA in Arabic ads.
- [ ] Game outcomes are possible under default rules (one wrong vote doesn't end a 5-player game; the Mole doesn't know they're the Mole).
- [ ] No fake stats, reviews, ratings, user counts, "trending" badges or "#1".
- [ ] Don't name competitors (Jackbox, Undercover, Spyfall, Werewolf) in on-screen text, VO or ad copy. Say "games where you pass the phone around".

**Trademarks and imitation UI**
- [ ] Use the official Google Play badge, unaltered, with clear space around it, in the right language. Where there's room, add the legal line in the ad description or landing page: "Google Play and the Google Play logo are trademarks of Google LLC."
- [ ] The phone-to-TV install step on the end card is a **real screen recording**, not a redrawn Play Store screen. A fake store screen with a fake "Install" button counts as misleading UI on both platforms. Before the recording exists, keep that screen abstract (no Play Store look-alike).
- [ ] No buttons in the video that look tappable (fake play buttons, fake "Install" or "Download" buttons outside the recorded store flow).
- [ ] No third-party app logos or show content visible on the TV (S5-03, S6-01 screens get replaced with generic tiles in post). Chat UI and notifications are generic, not WhatsApp/iMessage/Android system styling with app icons.
- [ ] No branded clothing, packaging or consoles in shot.

**Music and audio**
- [ ] No music recorded in the raw footage.
- [ ] TikTok: only the **Commercial Music Library** or tracks you hold a commercial license for. Trending sounds aren't cleared for ads.
- [ ] Meta: Sound Collection or licensed tracks. Turn off Advantage+ creative enhancements (music, text variations, image touch-ups) so Meta doesn't add or alter audio or captions.
- [ ] Mixkit tracks: re-read the Mixkit license for paid advertising use, then save the Mixkit page URL + download date + license text in `ads/licenses.txt` as proof.
- [ ] TikTok ads must have sound. Design them to work with sound off too (all key information is in the captions).

**People, audiences and content**
- [ ] Signed releases on file for everyone recognizable, with guardian signatures for minors (better: no minors featured).
- [ ] No alcohol, smoking, or money/betting stakes visible (forfeits only). The vote must not look like gambling (no chips, no cash, no "bet").
- [ ] Target 18+ on both platforms (TikTok restricts ad delivery to minors in many regions).
- [ ] Target the family/Ramadan ads by geo and language only. Don't target or imply religion, ethnicity or nationality of the viewer ("Are you Lebanese?", "your Lebanese family" breaks Meta's personal-attributes rule; "Lebanese family game night" describing the scene is fine).
- [ ] Ramadan creative is respectful: filmed at night, no mocking, no religious text used decoratively.
- [ ] Screen shake and flashes stay short (≤ 4 frames, no strobe), in line with the game's own no-strobe rule.
- [ ] If you later pay creators: use TikTok Spark Ads / Meta partnership ads with the paid-partnership label.

**Format and safe zones (1080×1920)**
- [ ] Keep text and key action out of the **top ~150 px** (account/status UI), the **bottom ~300 px** (caption, CTA button, music ticker) and the **right ~120 px** (like/comment/share rail). Also keep about 60 px from the left edge.
- [ ] Build a Remotion guide overlay (toggleable, never rendered) showing these zones and check every frame of the hook.
- [ ] The hook's caption is on screen from frame 1 (thumbnails and autoplay previews start there).
- [ ] Arabic captions: right-to-left (`direction: rtl`), Cairo font, keep Latin words (Mish Ana, Arabizi chat) as isolated runs. The platform UI rail stays on the right in Arabic too, so the same safe zones apply.
- [ ] Export H.264, 1080×1920, 30 or 60 fps, AAC 48 kHz, under 500 MB. Length 15–20 s.
- [ ] TikTok ad text ≤ 100 characters. Check emoji rendering in the Ads Manager preview before launch.
- [ ] Ad text examples (EN): "Everyone gets a secret word. One of you has a different one. Free on Android TV & Google TV." / "Scan the TV, play on your phone. 3–12 players. Free to play." / "No controllers. No app on your phone. Just your TV and your friends."
- [ ] Ad text examples (FR): « Tout le monde a un mot secret. Un seul a un mot différent. Gratuit sur Android TV et Google TV. » / « Scanne la télé, joue sur ton téléphone. De 3 à 12 joueurs. »
- [ ] Ad text examples (AR): «كلّ واحد معو كلمة سرّية… واحد بس كلمتو غير. ببلاش على Android TV و Google TV.»
