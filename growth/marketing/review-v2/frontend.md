# Mish Ana! creative system: frontend-design review (visual craft + brand)

Reviewer lens: composition, colour and mood, type, logo and end card, how consistent the 6 ads and the film are with each other, the landing page, and the store graphics.
Inputs: all 11 renders in `growth/video/out/final/` (contact sheets + key frames), `src/` (brand.ts, layout.ts, parts.tsx, ads/common.tsx, ads/EndCard.tsx, M1–M6), `docs/DESIGN.md` §1–3, the landing page (Playwright, 1440 and 390 px, after scrolling so the reveal animations fire), and the 3 Play Store graphics.

Mock-ups (rendered from HTML, using the app's own Cairo files):
- `growth/marketing/review-v2/frontend-mockups/compare-hook.png`: "Except his." hook frame, current vs B vs A
- `growth/marketing/review-v2/frontend-mockups/compare-vote.png`: "IT WAS YOU?!" reveal frame
- `growth/marketing/review-v2/frontend-mockups/compare-end.png`: end-card lock-up
- `growth/marketing/review-v2/frontend-mockups/compare-feature-graphic.png`: Play feature graphic (current, B, A)
- Source: `frontend-mockups/palettes.html`. The scratchpad copies are at `/tmp/claude-1000/-home-alex/fd33f8b8-ff3a-4b57-a939-83c108a2f362/scratchpad/review/frontend/mock/`. The "current end card" panel in the copied HTML points to a scratchpad PNG, so open the PNGs, not the HTML.

---

## 0. Verdict in one paragraph

The craft is good. Motion is tight, the caption rise is clean, the player-shape system is distinctive, and the OUT stamp is a real signature. The problem is **light and scale, not taste**. Measured mean luma of the ads is **21–37 / 255**: M1 21.5, F 24.6, M4 26.7, M2 26.9, M5 29.5, film 35.9, M3 36.6. Typical feed content sits around 100–140. In a TikTok/Reels feed these ads read as a black rectangle with small coloured chips. Hero elements also sit in the top 60 % of the frame at roughly 70–80 % of the scale a phone viewer needs. The single brightest moment in the whole system, M3's full-bleed amber "Everyone's innocent." card, is the most thumb-stopping frame we have, which tells us where to go. Recommendation: **adopt palette B "Evolved Current" everywhere (TV app included, with a deeper TV `bg`)**, enlarge the hero elements by about 1.3×, switch the hot word in captions to a **plate**, rebuild the end card around logo + badge + gameplay, and borrow A's full-bleed colour-field beats as punctuation in the ads only.

---

## 1. Palette directions

### Direction B: "Evolved Current" (RECOMMENDED)
The same night-violet world, lit like a party rather than a cinema: a lifted violet base, a bright purple glow from the top, a warm sodium-amber rim light at bottom-left (the "Beirut rooftop at 1 a.m." streetlight from DESIGN §1.1), a magenta bounce at the right, and 10 % grain. Mean luma in the mock-ups is **50–63** (2.5× current), with no loss of the premium night mood.

| Token | Current | **B (proposed)** | Note |
|---|---|---|---|
| `bgDeep` | `#0B0614` | **`#1D1036`** | gradient floor; never pure near-black |
| `bg` | `#120A1F` | **`#2B1650`** | marketing/web. **TV app: `#221242`**, one step deeper for dim living rooms |
| `bgGlow` (top radial) | `#22103A` / `#2A0F3D` | **`#6A2E9E` → `#3E1C70`** | `radial-gradient(110% 60% at 50% 0%, #6A2E9E 0%, #3E1C70 38%, #2B1650 68%, #1D1036 100%)` |
| rim light (new) | — | **`rgba(255,138,51,.30)`** at 8 % / 100 %, 60 × 38 % | warm sodium highlight, bottom-left |
| bounce (new) | — | **`rgba(255,79,154,.22)`** at 100 % / 62 % | magenta bounce, right edge |
| `surface` | `#1E1430` | **`#3A2266`** | |
| `elevated` | `#2A1D42` | **`#4A2E7E`** | |
| `outline` | `#4A3A66` | **`#6E55A0`** | |
| `text` | `#FFF7EC` | `#FFF7EC` (keep) | 14.8:1 on bg, 12.4:1 on surface |
| `text2` | `#CFC3E0` | **`#E3D7F5`** | 9.6:1 on surface |
| `muted` | `#9A8CB3` | **`#B9A8D6`** | 6.0:1 on surface |
| `primary` | `#FF3D8B` | **`#FF4F9A`** | ink on primary 6.0:1 (better than today's 5.78) |
| `accent` | `#FFC23D` | **`#FFC94D`** | 8.6:1 on surface |
| `ink` | `#120A1F` | **`#1A0B2E`** | |
| player coral | `#F0183A` | **`#FF3355`** | 3.66:1 on surface |
| player azure | `#478CFF` | **`#5A9BFF`** | 4.73 |
| player lemon | `#FFF04D` | `#FFF04D` | 11.1 |
| player jade | `#1FA88A` | **`#2BC49F`** | 5.93 |
| player grape | `#7A43FF` | **`#9A6BFF`** | 3.70, and the glyph flips to **ink** (5.2:1), so "cream on grape" disappears |
| player tangerine | `#FF7A1F` | **`#FF8A33`** | 5.58 |
| player plum | `#C02A8F` | **`#E0409F`** | 3.38; glyph flips to ink (4.8:1) |
| aqua / rose / mint / sand / lilac | — | keep | already light; all ≥ 8:1 on the new surface |

Why B: it fixes "too dark" (feed visibility, store thumbnails) and keeps the brand equity already built (wordmark, icon, TV UI, site). It also stays honest. The ad looks like the product, which matters for install-to-play retention. Every player colour still clears the 3:1 graphics rule on the new surface. **Re-run the DESIGN §13.4 CVD check** for grape `#9A6BFF` vs azure `#5A9BFF` under deuteranopia: lifting both narrows the gap, and shape is still the primary cue.

**TV app?** Yes, adopt B with `bg #221242`. DESIGN §2's case for dark-first (opaque TV, dim rooms, phone privacy) still holds at this lightness, since it is still a dark UI. The current `#120A1F` is darker than it needs to be. On many TVs, with local dimming and crushed blacks, it shows as black, and the violet identity is lost. The phone client takes the same tokens (web-client `tokens.css`).

### Direction A: "Brighter Party" (challenger, marketing-only)
A warm-paper day world with an ink outline and hard offset "sticker" shadows. Saturated players, magenta plates. Mean luma is **206–226**. It is the most feed-native and the most distinctive against the dark game-ad crowd. But it is a **different product feel** from the dark TV app, so it creates a promise/product gap.

| Token | **A** | Note |
|---|---|---|
| `bg` | **`#FFF1E0`** + corner glows `#FFC9DF` (top-right), `#FFE08A` (bottom-left) | |
| `bgDeep` | `#FFE2C2` | |
| `surface` | `#FFFFFF` | cards always get a 2.5 px `#1A0B2E` outline + `6px 6px 0 #1A0B2E` shadow |
| `text` / `ink` | **`#1A0B2E`** | 16.7:1 on bg |
| `text2` | `#5A4A75` | 7.1:1 |
| `muted` | `#6E5F88` | ≥ 4.5:1 |
| `primary` | **`#FF2E7E`** | plates use **white** text with an ink shadow; magenta as text colour → `#D1145E` (4.8:1) |
| `accent` | **`#FFB800`** | fills only; never text on cream (1.56:1) |
| coral / azure / lemon / jade / grape / tangerine | **`#FF2D4B` / `#2F7BFF` / `#FFE01A` / `#00B386` / `#7B3CFF` / `#FF6A00`** | every avatar gets a 7 % ink outline (lemon on cream is 1.19:1 without it); grape glyph is white |
| full-bleed beat fields | `#FF2E7E`, `#FFB800`, `#2F7BFF` | one-beat colour flashes |

**Recommendation:** do **not** rebrand to A. Take two ideas from it: (1) **full-bleed colour-field beats** (magenta/amber/azure) at the hook and the twist, as M3 already does with amber, and (2) the **plate** caption. If budget allows, run one A-styled cut of M1 as a creative test (same script, A palette). If it beats B on hook rate by more than 25 %, revisit, but still keep the app on B.

---

## 2. Numbered changes

Impact: **H** = likely moves hook rate/CTR or install rate; **M** = perceived quality/consistency; **L** = polish.

### Colour and light
1. **Ad background** (`ads/common.tsx` `AdBg`, `Film.tsx:600`). Current: `radial-gradient(120% 70% at 50% 0%, #22103A, #120A1F 55%, #0B0614)`. Proposed: B's stacked gradient (glow `#6A2E9E` → `#3E1C70` → `#2B1650` → `#1D1036`, plus the amber rim light and magenta bounce from the table) and a 10 % fractal-noise grain overlay (`mix-blend-mode: overlay`). Why: mean luma 21–37 → about 55; the colour reads as violet on phones, not black; the grain stops the gradient banding that H.264 at feed bitrates produces on large dark fields. **H**
2. **Phone screens inside ads** (`PhoneFrame` screen `C.bg`, bezel `#05030A`). Proposed: screen `linear-gradient(180deg,#341A5E,#2B1650)`, bezel `#140A26`. Why: today the phones are black holes on a black field, and only the word cards register. **M**
3. **Add one full-bleed colour-field beat per ad**, at the twist (M1 "Except his." → magenta field for 6 frames; M4 "Zero passing." → amber; M5 "Saturday, sorted." → amber; M2 "One is different." → azure; M6 "برّا" → magenta). M3 already does this and is the brightest ad (36.6). Why: luminance spikes are what stop a thumb, and they also give a strong cover/thumbnail frame. **H**
4. **Dimmed (eliminated/non-speaking) tiles.** Current: opacity ≈ 0.4 on a near-black bg, which produces mud (frames at M1 9–10 s). Proposed: opacity 0.55 plus `filter: saturate(.5)`, and keep the name text at `text2`. Why: the "everyone looks at Sami" moment needs the crowd visible, just quieter. **M**

### Scale and composition (9:16)
5. **Hero scale +30 %.** M1 `AV = 240` → **312**. Word-reveal phones: current ~236 px wide in the 2+3 grid → **300 px** in a fanned layout (±8° rotation, Mole phone in front at 1.18× and +6°). See compare-hook.png. M6 `TILE` 192×204 → 230×245 (4 columns still fit inside SAFE 900 px with a 12 px gap). Why: on a 6.1" phone at feed size, 240 px tiles become about 1.4 cm chips and the names (≈ 28 px) drop below comfortable reading. **H**
6. **Use the lower third.** Content currently ends near y ≈ 1350 while SAFE.bottom = 1620, leaving ~270 px of dead dark band, and the composition is top-heavy. Move the content centre from y ≈ 900 to **y ≈ 1000** and let the hero element (Mole phone, OUT stamp, "Sami was the Mole") occupy **1300–1550**. Keep captions at y 250–300. Why: balance, and the payoff lands where the eye ends up after reading the caption. **M**
7. **OUT stamp.** Current: about 40 % of tile width, sometimes partly hidden behind the tile (M1 9 s). Proposed: 1.6× the tile width, **`font-size 116px`**, rotation −8°, z above everything, drop shadow `0 12px 30px rgba(0,0,0,.4)`, landing with a 1-frame white flash. Why: it is the brand's signature; make it the frame people remember and screenshot. **H**
8. **Film 16:9 opening** (`MishAna-16x9`, 0–1.5 s: a lone amber dot on black, then a TV at about 55 % of frame width). Proposed: open on the lobby TV at **75 % of frame width** with the first player already joining at frame 0; the dot intro can stay for the 9:16 cut only, if at all. Why: YouTube/landing autoplay judges the first second. **M**

### Typography
9. **Caption hot word → plate, not colour.** Current (`AdCaption`): Cairo 900, cream with a `0.075em` stroke in `#120A1F`, hot word recoloured amber. Proposed: hot word on a **plate** (`background: accent; color: ink; padding: 0 .22em .04em; border-radius: .2em; rotate(-2.5deg); box-shadow: 0 8px 24px rgba(255,201,77,.35)`). Use magenta plates for "danger/lie" words (liar, Mole, his) and amber plates for payoff words (sorted, in, zero). Drop the stroke (it only works on dark; with a plate you no longer need it). Why: plates read in the sound-off feed at thumbnail size, survive any background (including the colour-field beats from change 3), and give a recognisable caption signature that captions "in the brand colour" do not. **H**
10. **Caption size floor.** Current sizes range from 70 to 112 across the ads (end card 70/78, M2 title 112, others 84–92). Proposed: **two sizes only**, 96 (one line, ≤ 3 words) and 84 (two lines), line-height 1.02, tracking −0.01em; end-card captions 84. Why: consistent rhythm across the 6 ads; 70 px is too small for a 1-second read. **M**
11. **Caption entrance.** Keep the rise mask (it is lovely), but cut `step` from `b(0.12)` per word to `b(0.08)`, and make the plate *scale-pop* (0.6 → 1.06 → 1, POP spring) one beat after its word lands. Why: full captions are on screen sooner (several sheets catch half-risen lines for about 0.5 s), and the plate pop lands on the beat. **M**
12. **Weight mapping bug.** `Root.tsx` maps weight 800 to `cairo_bold.ttf`, so every "800" in the code renders as 700. Either ship `cairo_extrabold.ttf` (cut it from the variable font, as DESIGN §3.1 does for the others) or change the 800s to 700/900 deliberately. Bubbles, tile names and the end-card "Free to play" line all use 800. **L**

### Logo, end card, store
13. **End card rebuild** (`ads/EndCard.tsx`, lock-up section from b(6)). Current lock: wordmark 640 px wide at y 940, a 30 %-scale tilted phone bottom-left, and the badge 450 px offset to x 630, so the logo, badge and phone sit on three different axes. A large QR/lobby TV sits on top, but **a QR in a phone ad is unscannable by the viewer** and reads as "setup required". Proposed (see compare-end.png): a centred column on `SAFE_CX`:
   - y 240–760: TV at 880 px wide (−2°) showing **gameplay** ("Who's not one of us?", 5 tiles, OUT stamp), with a phone (PIZZA card) overlapping its right edge
   - y 980: **wordmark 820 px wide** (currently 640)
   - y 1220: tagline "The secret-word party game for your TV", 50 px / 800, `text2`
   - y 1340: **Play badge at 560 px** (currently 450)
   - y 1540: pills "Free · 3–12 players · Phones = controllers", 30 px

   Drop "Or search 'Mish Ana' on your TV" to the store listing. Keep the install-from-phone beat before the lock: it is the best explainer we have. Why: one axis, one action, and the payoff picture (people playing) instead of a setup picture. **H**
14. **The "!" bang on the end card.** Give the stem its screen glow (DESIGN §1.3: `#FF3D8B` at 40 %, blur 24) and let the amber dot drop in on the bass hit (`ecHits` b(6)). Today it appears with a flat clip-path wipe. **L**
15. **Play feature graphic** (`play-store/graphics/feature-graphic-1024x500.png`). Current: bilingual wordmark, 6 tiny dots, and the tagline, with **no product shown**. It also uses an amber "Someone's lying" while the site uses magenta. Proposed (compare-feature-graphic.png, B row): wordmark + slogan on the left 55 %; a TV with the vote screen + OUT stamp and two phones (PIZZA / PASTA, the Mole with an amber ring) on the right; B background; "Someone's lying." in **magenta** to match the site H1. Keep the bilingual wordmark for the AR listing variant. Why: the feature graphic is the store's hero; it must show the "TV + phones" mechanic in one glance. **H**
16. **App icon** (512). It is strong. Two tweaks: background `#120A1F` → `#2B1650` with the B top glow, and scale the bubble group down about 4 % toward the centre. The tail tip sits at about (90, 440) of 512, inside Play's 20 % corner radius today, but close enough that launcher squircle and circle masks (Android TV and some OEM launchers) clip it. Check it against a circle mask before shipping. **L**
17. **TV banner** (1280×720). Use the B background, and set the mark-tile fill to `#1D1036` with a 2 px `#6E55A0` inner stroke. Today the tile (`#120A1F`) on `#2A0F3D` is too close in value and the tile edge disappears on dim panels. **L**

### Consistency across the 6 ads
18. **One shared frame grammar.** Today M1/M4/M5/M2 share the system well. Diverging: M6 uses a 4×3 tile grid at a smaller scale with a very busy 12-phone flood (good for "12 players", but the phones are about 130 px wide with unreadable screens), and the film uses a different caption position (bottom in 16:9, top in 9:16). Proposed: (a) M6's phone flood shows only the word cards (drop the phone chrome/text at that scale) at 168→200 px; (b) all 9:16 assets use caption y 250–300 and the plate style; (c) every ad ends with the identical 4 s end card (already true; keep it). **M**
19. **Avatar initials vs DESIGN.** The ads put the player's initial (M, K, L) inside the shape; DESIGN §5.2 shows the shape glyph only, and the app does the same. Keep the initials in marketing (they help name recall in the story), but make sure store screenshots use real app captures so the store isn't shown with UI the app doesn't have. **L**
20. **People.** Every frame is UI; there is no human, room or laughter. That is a visual-strategy gap, not a polish one: party games sell the *room*. Proposed: one ad variant where the middle 6 s are a real (or stylised photographic) living-room shot with the UI composited on the TV, graded with B's rim light. All other ads keep the current approach. **H** (as a test)

### Landing page (`growth/site`, `dist/`)
The site is the most mature surface: a clear H1 with the magenta "Someone's lying.", a real product video in the hero, good pills, and a nice closing band with floating avatars. Changes:

21. **Hero background.** Current: about `#120A1F` with a faint glow; the fold reads as dark and empty in the lower 25 % at 1440×900. Proposed: B `bg` and glow; add the amber rim light behind the hero video (`radial-gradient(40% 50% at 70% 60%, rgba(255,138,51,.18), transparent)`). **M**
22. **Hero video frame.** The video (TV + phone mock) sits at about 500 px wide on desktop. Scale it to **min(46vw, 680px)** and tilt the phone mock 6° with the same Mole amber ring as the ads, so the site and the ads read as one campaign. **M**
23. **Primary CTA.** The two-line pill ("Play free in your browser / Laptop or TV browser · no download") is good, and the sub-line is already at `opacity: .86`, which is fine. With B's lighter magenta (`#FF4F9A`) the ink label gets *more* contrast. On mobile, keep the CTA in the first viewport: at 390×844 it currently starts at about y 570, which is fine; don't let a larger hero video push it lower. **L**
24. **Mid-page sections** ("A whole round in 15 seconds", "Made for the couch", FAQ, About). They sit on a flat `#130B20`-ish field from about 2000 px down, with no colour moment until the closing band. Alternate section backgrounds between `bg` and `surface`-tinted bands (`#2B1650` / `#341C5E`), and give the 4 feature cards a 3 px top border in their player colour (coral/azure/lemon/jade) to echo the avatar icons. **M**
25. **Scroll reveals** (`.js .rv { opacity: 0 }` → `.rv.in`). The no-JS and reduced-motion fallbacks already exist. But a full-page capture without scrolling shows large blank bands, which is also what link-preview and SEO screenshot crawlers will see. Trigger `.in` earlier (`rootMargin: '0px 0px 15% 0px'`) and cut the transition to `.45s`, so fast mobile scrollers never land on empty violet. **L**

---

## 3. Priority order (do these first)
1. B background + grain in ads (#1, #2) → re-render all 11. **This one change answers "too dark".**
2. Plate captions and two sizes (#9, #10, #11).
3. Hero scale +30 % and using the lower third (#5, #6), plus the bigger OUT stamp (#7).
4. End-card rebuild (#13).
5. Feature graphic with product (#15).
6. Colour-field beat per ad (#3).
7. TV app + phone client token migration to B (the table in §1; TV `bg #221242`), then re-run the contrast/CVD script.
8. Landing page bands and hero glow (#21, #24).
9. Test cuts: A-palette M1 and a "people" variant (#20).
