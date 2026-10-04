# Mish Ana! polish review v2: motion, sound, end card, landing

Lens: micro-details (spring tuning, dwell time, transition seams, text rendering, sound mix, CTA moment, landing finish).
Method: 4 fps contact sheets of all 11 renders, 60 fps frame strips around every fast moment (60 fps, every 3rd frame),
per-0.5 s luma measurement, EBU R128 loudness timelines, spring step responses computed with Remotion's own `spring()`,
Playwright screenshots of the landing at 390 px and 1440 px. Working files: `/tmp/claude-1000/.../scratchpad/review/polish/`.

1 beat = 0.4847 s = 29.08 frames @ 60 fps. "b" below means beats, as in `b()` in `src/time.ts`.

---

## 0. Measured facts (the evidence behind the changes)

| Measurement | Value | What it means |
| --- | --- | --- |
| Mean luma, 9:16 ads (Y 0–255) | M1 **21**, M4 27, M2 27, M5 30, M6 25, M3 37 (only because of the yellow floods) | About 8–12 % brightness. A typical feed frame sits at 90–120. This is why the owner says "too dark". |
| Luma spikes | M4 2.5 s: 125. M2 5.0 s: 128. M5 9.0 s: 195. M3 13.3–14.3 s: 146 → 189 → 189. Film 8.0 s: 127, 16.5–17.5 s: 195 | Jumps from 20 to 190 in 4 frames. Because the base is so dark, every flood reads as a strobe and not as a beat. |
| Integrated loudness | All ads −14.0 LUFS, **LRA 1.3–1.5 LU** (M3 3.2) | A wall of sound with no dynamic contrast. This is the source of ear fatigue. |
| Music bed alone (0.75 gain, from the drop, 15 s) | −14.3 LUFS | The music alone already hits the target loudness, so the SFX sit on top and the loudnorm pass pulls everything down. There is zero headroom for a voice. |
| Song energy after the drop | −11.5 LUFS-S for 0–16 s, then **−16 for 18–23 s**, back to −12 from 25 s | A longer ad (20–25 s) would land its end card in the song's dip. Plan the end card around it (see §6). |
| Music ending | 20-frame (0.33 s) fade, mid-phrase | Sounds like a cut, not an ending. |
| SFX density | M1 22 hits + 8 end card = 30 in 15 s (2.0/s). M4 37 (2.5/s). M5 36 (2.4/s). Only 2 pop samples (`pop_a`, `pop_b`) | Faster than one SFX per beat. The same two pops repeat 6–10 times per ad. |
| Springs (computed) | SNAPPY **13 % overshoot**, settles in 38 f. POP **23 % overshoot**, settles in 41 f (1.4 beats of wobble). HEAVY 14 %, 56 f. SOFT 0 %. Rise exit {30,260} 0 %, 90 % in 14 f | Every caption word (Rise → SNAPPY) bounces 13 %. Every bubble, stamp and badge (POP) wobbles for longer than a beat. Taken together this reads as bouncy, not premium. |
| Exit vs enter (Rise) | Enter travels 110 %, exit travels **145 %** on a stiffer spring | Exits are bigger and faster than enters, which inverts the rule that exits should be softer. Each caption change reads as a "yank". |
| End card CTA hold | Badge fully in at EC b7.4 (14.6 s). Video ends at 15.04 s: **0.45 s of finished CTA**. "Or search Mish Ana on your TV" is legible for about 0.25 s | The CTA never lands. |
| Motion blur | `CameraMotionBlur samples=8 shutterAngle=180` | The OUT stamp (2.6 → 1 in 7 f) renders as 2–3 visible ghost copies (M1 frames 535–543). Caption entrances smear. |

---

## 1. Top 10 changes (do these first)

| # | Target | Before | After | Why / impact |
| --- | --- | --- | --- | --- |
| 1 | `ads/EndCard.tsx` whole timeline | `EC_BEATS = 8.25` (4.0 s). Badge in at b7, search line at b7.4, end at b8.25 | `EC_BEATS = 12.25` (5.94 s); retime as in §5. Badge at **b8.5**, search line b8.9, then **3.5 b (1.7 s) of still lockup**. With VO: 13 b | The finished CTA currently shows for 0.45 s. Conversion needs at least 1.5 s of a static, readable lockup. |
| 2 | `ads/EndCard.tsx:193` "Done. *Game* *on.*" | start b4.3, end b5.0: **0.22 s** readable | start b5.0, end b6.75 (0.85 s readable) | Right now it flashes. It is the payoff line of the install demo. |
| 3 | `ads/EndCard.tsx:191` "Install it from *your* *phone*" | end b1.9: 1.27 b readable for 5 words | end **b2.6**, sheet opens b2.8 (was 2.05) | Below the 1 beat per 2 words floor. It is also the core message: install from the phone. |
| 4 | `time.ts:30` SNAPPY used for all caption text (`Rise` default) | `{damping:15, stiffness:190, mass:1}`: 13 % overshoot | Add `TEXT = {damping:26, stiffness:220, mass:1}` (0.3 % overshoot, settles in 20 f) and make it the `Rise` default (`parts.tsx:40 cfg = TEXT`) | Mask text that bounces past its baseline looks cheap. A critically damped rise gives premium, kinetic-type motion and also settles 18 f sooner, so text is readable earlier. |
| 5 | `time.ts:31` POP (bubbles, stamps, badge, avatars) | `{damping:11, stiffness:210, mass:0.8}`: 23 % overshoot, 41 f wobble | `{damping:17, stiffness:240, mass:0.8}`: 8.7 % overshoot, settles in 22 f | Keeps a single pop without the jelly. It halves the time things wobble, so the scene calms down between beats. |
| 6 | `ads/common.tsx:65` `AdBg` + dims | `radial-gradient(120% 70% at 50% 0%, #22103A 0%, #120A1F 55%, #0B0614 100%)`. Non-mole dim to 45 % opacity (`M1.tsx:98` `1 - 0.55*…`) | `radial-gradient(130% 80% at 50% 18%, #3B1A63 0%, #24123D 45%, #150B26 100%)`. Dims to `1 - 0.3*…` (70 %) plus `filter: saturate(0.55)` instead of opacity | Target mean luma 45–60 (currently 21–30). Floods then read as accents instead of flashes. The climax stays readable. |
| 7 | Mix headroom: `AdSound` `music = 0.75` | Music −14.3 LUFS on its own; LRA 1.4 | Music bed **0.5 (−6 dB)** baseline. SFX keep their gains (net +3.5 dB relative to music). Add VO ducking (§4): −9 dB under speech, 6 f attack, 18 f release | The mix needs room before a voice can sit in it, and the pops then cut through at a lower absolute level. |
| 8 | SFX density, all `*_HITS` | 2.0–2.5 hits/s, 2 pop samples | At most **1 hit per beat** (≈2/s worst case, 1.2/s average). Delete clue pops 2 and 4 in each ad. Alternate `toneFrequency` 0.94/1.0/1.06 on the pops that remain. All pops −3 dB (0.65 → 0.45) | Fixes ear fatigue. The stamp and floods then hit harder because they are not competing. |
| 9 | Caption holds, every ad (pacing tables §3) | 14 lines below the floor, worst: M4 "(he doesn't know)" 0.34 s, M4 "Sami's is PASTA." 0.52 s, M5 "No app on phones." 0.6 s, M1 "Wait… fork?" 0.68 s | Floor = `max(1.5 b, 0.5 b × words + 0.5 b)` after the last word lands | Fixes "sometimes too fast". These are the story beats (the twist, the USP, the joke). |
| 10 | Music ending, `common.tsx:27` | fade `[duration-20, duration-1]` | fade `[duration-54, duration-1]` (≈0.9 s, cubic ease-in on gain) starting after the badge settles, plus `sparkle` at vol 0.35 as a tail at duration-50 | An ending instead of a cut. It also leaves 0.9 s of near-silence on the lockup, which makes the CTA moment feel deliberate. |

---

## 2. Motion detail changes

### Spring tuning (`src/time.ts`)

Computed with Remotion `spring()` at 60 fps. Settle = within 1 % of target.

| Config | Before | After | Overshoot / settle (after) | Use it for |
| --- | --- | --- | --- | --- |
| TEXT (new) | n/a (text used SNAPPY 13 % / 38 f) | `{damping:26, stiffness:220, mass:1}` | 0.3 % / 20 f | All `Rise`, `Words`, `AdCaption`, `ArCaption` |
| SNAPPY | `{15,190,1}` 13 % / 38 f | `{damping:20, stiffness:200, mass:1}` | 4.3 % / 28 f | Phones, tiles, TV and object moves |
| POP | `{11,210,0.8}` 23 % / 41 f | `{damping:17, stiffness:240, mass:0.8}` | 8.7 % / 22 f | Bubbles, avatars, vote dots, badge |
| HEAVY | `{16,140,1.6}` 14 % / 56 f | `{damping:24, stiffness:150, mass:1.6}` | 2.1 % / 41 f | Big camera or TV arrivals |
| SOFT | `{22,120,1}` 0 % | keep | — | Phone entrance in the end card |
| Rise exit (`parts.tsx:43`) | `{damping:30, stiffness:260}`, travel −145 % | `{damping:30, stiffness:200}`, travel **−60 %** with `opacity: 1 - pout` on the inner span; cull at `pout > 0.97` as now | — | Exits become softer than enters. A 60 % travel plus a fade avoids the stroke specks that the 145 % travel was added to hide, because the fade removes them. |
| Stamp (`M1.tsx:163`, M3/M4/M5/M6 equivalents) | 2.6 → 1 in 7 f linear `easeIn`, then `1 + 0.1*(1-POP)` | 1.8 → 1 in 6 f (`easeIn`), settle on POP(new); add a 2-frame camera shake of 6 px on landing | — | Less travel means far less motion-blur ghosting, and the shake sells the impact in place of the blur. |

### Transitions, seams and dead frames

| # | Where | Before | After | Why |
| --- | --- | --- | --- | --- |
| T1 | M1 2.3–2.6 s (b4.7–5.35), phone → tile morph | `WordFace out={b(4.7)}`, tile avatar in at b5.35+i·2f: **~15 frames of empty dark tiles** (strip m1-phonesout frames 7–12) | `out={b(5.0)}`, `TileFace` avatar spring start `b(4.95)+i*2`, name Rise `b(5.05)+i*2`. Overlap the word card's fade and the avatar's scale-up by 4 f | Removes a dead, dark beat and keeps continuity of identity (word card → face). |
| T2 | M4 2.6–2.85 s, magenta flood → 5 phones | Pink phones → black-dot screens → **all-dark phones for ~10 f** → content | Land the flood directly on the WordFace *back* (face-down card in player colour, `contentIn` = flood end −4 f) instead of black screens | Same fix as T1. The eye stays on colour, not black. |
| T3 | M2 2.5–2.9 s, checklist collapse → TV | Checklist collapses to an amber bar → amber TV outline → **8 f nearly empty frame** → QR | Start the TV screen content (QR pop) 6 f earlier, so it overlaps the end of the bar → frame morph | Dead frame. |
| T4 | M2 7.75–8.1 s, phones → checklist 2 | Phones go dark and empty for ~0.3 s | Cross-fade phones out over 10 f while the chips start rising (first chip at b16.6 instead of b17) | Dead frame. |
| T5 | M5 3.4–3.6 s, lobby → phones | TV shrinks into an almost black frame (luma 13, the darkest frame of all ads) | Keep the TV at ≥ 0.55 scale until the phones are on screen; delay `tvB` by 0.25 b | Darkest frame in the set. |
| T6 | All floods (`BgFlood`, `ScreenFlood`, M3 amber, M4 magenta) | Hard-edged `clipPath: circle()` with easeIn over 21 f; full-saturation magenta or amber fills the frame | Keep the timing but add a 1-frame-wide soft edge (wrap in `filter: blur(6px)` on a mask layer, or use a radial `mask-image` with an 8 px feather). Cap full-frame floods at **≤ 10 f of full colour**, then let content punch through | The hard circle edge stair-steps under motion blur. Full-frame colour for 0.4 s (M4, M2) or 1.25 s (M3) is a flash, not a beat. |
| T7 | M3 13.25–14.25 s amber card "Everyone's innocent." | Full amber `#FFC23D`, Y = 189 for 1.25 s, directly after Y = 25 | Fine to keep as the brand's tagline moment, but enter via a 0.25 b luminance ramp (tint `#3B1A63` → amber over 8 f, not 3) and drop the amber to `#FFB22E` with a 6 % vignette | Reduces the strobe on the one deliberate bright scene. |
| T8 | End card 13.4–13.6 s (EC b5.0–5.4) | Phone shrinks away while TV lights; for ~8 f the frame is an empty TV outline + yellow dot | Start the TV content (`on`) at b5.0 not b5.15, start the phone shrink at b6.6 (after cap3) | Dead frame right before the CTA. |
| T9 | Motion blur (`Ads.tsx:29`, `tools/finalize.sh:12`) | `samples 8, shutterAngle 180` | `samples 12, shutterAngle 120` | Fewer ghost copies on the stamp and caption rises (the OUT stamp shows 3 copies in M1 frame 537). More samples smooth the remaining smear. Render time +50 %. |
| T10 | Caption gaps where the screen has no text | M1 b18.2 → b18.75 (stamp); M4 b4.4 → b5.0 | Fine on stamps. Keep gaps ≥ 0.25 b and ≤ 0.6 b everywhere: current gaps already comply | (No change. Listed for consistency) |

### Text rendering

| # | Where | Before | After | Why |
| --- | --- | --- | --- | --- |
| X1 | `AdCaption` stroke `common.tsx:51` | `WebkitTextStroke: size*0.075 px ${C.bg}` (6 px at 80 px), `paintOrder: stroke fill` → about 3 px visible, in `#120A1F` on a `#120A1F` background (invisible) | `size*0.09` px (7 px at 80, 10 px at 112) in `#0B0614`, plus `textShadow: 0 4px 18px rgba(11,6,20,0.55)` | Once the background is brightened (change #6) the stroke has to do real work. A soft shadow keeps captions legible over phones and floods without a sticker look. |
| X2 | Caption tracking | `letterSpacing: -0.01em` at all sizes | `-0.01em` up to 84 px, `-0.02em` for 92–112 px (`size >= 90 ? '-0.02em' : '-0.01em'`) | Cairo Black opens up at display sizes. "IT WAS YOU?!" at 112 px looks loose. |
| X3 | Word stagger `step` | Default `b(0.12)` (3.5 f), M4 hook `step={3}` | Default `b(0.15)` (4.4 f). Never under 4 f | With TEXT springs (no overshoot) a slightly longer stagger keeps the ripple visible. 3 f reads as one blob. |
| X4 | M4 "(he doesn't know)" `M4.tsx:536` | 54 px with parentheses, amber, sits 110 px under a 88 px line | 64 px, no parentheses, `C.text2`, italic-free, y = 350; it becomes a proper sub-line | At 54 px with a 4 px stroke it is the smallest caption in the set and is gone in 0.34 s. |
| X5 | M3 "(Sami just eats pizza with a fork.)" | ~36 px, about 1 b on screen | 52 px, y under the phones, 3 b hold (see pacing table) | It is the joke of the ad. It is currently unreadable on a phone. |
| X6 | Line breaks | "Everyone's word is / PIZZA." wraps naturally in 900 px | Force deliberate breaks with a `\n` token in `Words` (split lines, centre each): "Everyone's word is" / "*PIZZA.*". Also "Stop passing *one* / phone around." and "One of them has a / *different word.*" (already split, good) | Avoids random widows when copy changes. "phone around." currently wraps around the accent word unpredictably. |
| X7 | End card left block `EndCard.tsx:216` | Text column `left: 300, width: 660`, offset right to clear the mini phone | Remove the shrunk phone from the final lockup (fade it to 0 between b6.6–7.2) and centre the column on SAFE_CX (`left: 90, width: 840`) | The tilted 0.3× phone in the bottom-left reads as leftover clutter, and it pushes the CTA off the optical centre. |

---

## 3. Pacing tables (holds that are too short)

Readable hold = caption `end` − the start of the last word. Floor = `max(1.5 b, 0.5 b × words + 0.5 b)`.
Shift every later event by the cumulative delta (all ads use beat constants, so add an offset table or a `shift(b)` helper).

### MA-A M1 PIZZA (body 22.75 b → **26.0 b**)

| Segment | Words | Now (b / s) | Floor | Proposed hold | Delta |
| --- | --- | --- | --- | --- | --- |
| "Everyone's word is PIZZA." (from frame 0) | 4 | 2.3 b / 1.11 s | 2.5 b | end b3.0 | +0.7 |
| Phones → tiles (dead dark frames) | — | 0.6 b gap | 0 | overlap (T1) | −0.3 |
| "Wait… fork?" (punchline) | 2 | 1.4 b / 0.68 s | 1.5 b | 2.5 b (let the fork bubble wobble land) | +1.1 |
| "Vote out the liar." | 4 | 4.5 b | ok | 4.0 b (trim the drumroll) | −0.5 |
| "IT WAS YOU?!" + "Sami was the Mole" | 3+4 | 3.4 b | ok | 4.0 b; "Sami was the Mole" 64 px, not 48 | +0.6 |
| End card | — | 8.25 b | — | 12.25 b | +4.0 |
| **Total** | | 15.0 s | | **18.6 s** (≈ 19 s) | |

### MA-B M4 PASS THE PHONE (22.75 b → **27.0 b**)

| Segment | Words | Now | Floor | Proposed | Delta |
| --- | --- | --- | --- | --- | --- |
| "Stop passing one phone around." (from frame 0) | 5 | 2.05 b / 0.99 s | 3.0 b | 3.25 b; slow `T.pass` to [0.75, 1.5, 2.25] | +1.2 |
| "Someone always peeks." | 3 | 1.75 b | 2.0 b | 2.25 b | +0.5 |
| "Sami's is PASTA." | 3 | 1.08 b / 0.52 s | 2.0 b | 2.5 b | +1.4 |
| "he doesn't know" | 3 | 0.7 b / 0.34 s | 2.0 b | 2.0 b (overlaps the line above; starts 0.5 b after PASTA lands) | (incl.) |
| "The TV is the stage." | 5 | 1.85 b | 3.0 b | 3.0 b | +1.15 |
| "5 players. 5 phones. Zero passing." | 4+2 | 4.0 b | ok | keep | 0 |
| End card | | | | | +4.0 |
| **Total** | | 15.0 s | | **19.6 s** | |

### MA-C M3 SPOT THE MOLE (33 b body, already 20 s → **35 b**)

| Segment | Words | Now | Floor | Proposed | Delta |
| --- | --- | --- | --- | --- | --- |
| "One of them has a / different word." | 7 | 3.4 b | 4.0 b | 4.0 b | +0.6 |
| "Karim was the Mole." | 4 | ≈2.0 b | 2.5 b | 2.5 b | +0.5 |
| "(Sami just eats pizza with a fork.)" | 7 | ≈1.0 b / 0.5 s | 4.0 b | 3.5 b at 52 px | +1.0 (overlaps "And Sami?") |
| "Not the Mole." | 3 | 1.6 b | 2.0 b | 2.0 b | +0.4 |
| Amber "Everyone's innocent." | 2 | ≈2 b | ok | keep | 0 |
| End card | | | | | +4.0 |
| **Total** | | 20.0 s | | **≈23 s**. This is the only ad that should *not* grow much; it is already the long-form engagement cut. Option: cut the countdown from 3 to 2 beats to stay at 22 s. | |

### MA-D M5 TONIGHT (22.75 b → **27.0 b**)

| Segment | Words | Now | Floor | Proposed | Delta |
| --- | --- | --- | --- | --- | --- |
| "Nothing to do tonight?" | 4 | 2.3 b | 2.5 b | 2.75 b | +0.45 |
| "Phones out. Scan the TV." | 5 | 1.7 b / 0.82 s | 3.0 b | 3.0 b | +1.3 |
| "No app on phones." (USP) | 4 | 1.25 b / 0.6 s | 2.5 b | 2.75 b | +1.5 |
| "Except Sami." | 2 | 1.0 b | 1.5 b | 1.75 b | +0.75 |
| "Who's off?" | 2 | 1.15 b | 1.5 b | 1.75 b | +0.6 |
| "Caught him." | 2 | 1.25 b | 1.5 b | 1.5 b | +0.25 |
| End card | | | | | +4.0 |
| **Total** | | 15.0 s | | **19.3 s** | |

### MA-E M2 CHECKLIST (22.75 b → **25.0 b**)

| Segment | Words | Now | Floor | Proposed | Delta |
| --- | --- | --- | --- | --- | --- |
| Checklist strike-throughs (3 items + amber row) | 3×4 | ≈1.1 b per row | 2.5 b per row | Strike rows at b1.0/2.25/3.5 (were ≈0.75/1.4/2.0), amber row b4.5, collapse b5.75 | +1.0 |
| Dead frames 2.5–2.9 s and 7.75–8.1 s | — | 0.8 b + 0.7 b | 0 | T3/T4 | −1.0 |
| "One is different." | 3 | 1.55 b | 2.0 b | 2.25 b | +0.7 |
| Chips "Game night, sorted." + 4 chips | — | ok | | chip spacing 1 b → 0.75 b; hold the full list ≥ 2 b | +0.0 |
| End card | | | | | +4.0 |
| **Total** | | 15.0 s | | **≈17.2 s** | |

### MA-F M6 AR FAMILY (22.75 b → **27.5 b**)

| Segment | Now | Floor | Proposed | Delta |
| --- | --- | --- | --- | --- |
| "سهرة العيلة؟ / 12 واحد؟" + counter (from frame 0) | 1.6 b / 0.78 s | 2.5 b | 2.75 b; counter steps on half-beats 3→12 over 2.5 b (now 2.2 b) | +1.15 |
| "كلّن معن تبولة…" | ≈1.3 b | 2.0 b | 2.0 b | +0.7 |
| "إلّا خالو." | 0.8 b | 1.5 b | 1.75 b | +0.95 |
| "وما بيعرف." | 0.8 b | 1.5 b | 1.75 b | +0.95 |
| "خبز؟ بالتبولة؟!" (punchline) | 0.95 b | 1.5 b | 2.25 b | +1.3 |
| "طلع خالو!" | 1.1 b | 1.5 b | 1.75 b | +0.65 |
| End card | | | | +4.0 |
| **Total** | 15.0 s | | **≈20.5 s** | |

Arabic reads more slowly for most viewers than Latin display type at the same size, and the `pad 0.45em` mask adds visual noise. Apply a +15 % hold factor on top of the floor for every ArCaption.

### Product film (MishAna-16x9 / 1x1 / 9x16)

The lockup (20.0–23.8 s) holds 3.5 s: good. Short segments: "Caught the Mole!" ≈0.5 s (15.75–16.25 s), so give it 1.5 b. "Friends join from their phones. No app." builds in ≈1.5 b, so give it 2.5 b. The opening 0.75 s is a lone yellow dot on near-black (luma 15–18). For feed placements start on the lobby frame (film b1.5) or brighten as in change #6. Total stays ≈24–25 s.

### Length recommendation

* **No VO** (current style, captions carry it): 15 s → **18–20 s** (body +3 to +5 b, end card +4 b). On TikTok and Reels the completion-rate cost from 15 to 19 s is small, and the gain in comprehension of the twist and USP is large.
* **With VO**: **22–25 s**. English VO at ≈2.6 words/s for these scripts (≈35–45 words) needs 14–17 s of body, plus 6 s of end card (5.94 s + a 0.5 s VO tail). Captions then mirror the VO in shortened form; keep them on screen for at least the length of the spoken phrase.
* Keep one **15 s cutdown** per concept (M1 and M5 are the strongest) for the 15 s placements: drop the clue round to 3 clues and keep the 12.25 b end card. Do not shorten the end card.

---

## 4. Sound design changes and VO headroom

### Mix levels (all ads, `ads/common.tsx` `AdSound`; film `Sound.tsx`)

| # | Item | Before | After | Why |
| --- | --- | --- | --- | --- |
| S1 | Music bed gain | 0.75 (−2.5 dB); film 0.8 | **0.5 (−6 dB)** without VO; 0.56 (−5 dB) for the film | Restores about 4 LU of dynamic range and makes room for VO and for the hits. The loudnorm pass to −14 LUFS in `finalize.sh` brings the perceived loudness back. |
| S2 | Pops (`pop_a`, `pop_b`, clue bubbles) | 0.6–0.75 | 0.45, alternate `toneFrequency` [0.94, 1.0, 1.06, 1.0] round-robin | Same sample ×8 at the same pitch is the main fatigue cue. `toneFrequency` works in server render (the Studio preview will not show it). |
| S3 | `bass_hit` used as vote landings (M1 4×, film 5× in 2 beats `Sound.tsx:40-44`) | 0.7 each | First and last 0.6. The middle ones become `tick` at 0.35, or drop them | Five sub-bass hits in one second mask the music's kick and pump the loudnorm. |
| S4 | `wrong` | Used twice in M1 (b2.4 and b11.15) | Keep the first (the Mole reveal); replace the second with nothing (the fork bubble already pops) | Save the "wrong" sting for one moment per ad. |
| S5 | Whooshes on every flood/transition | 3 `whoosh_fast` in M1's first 1.5 b at 0.32 | Keep 1 (the last flood); the first two go | Three whooshes in 0.5 s read as noise. |
| S6 | Stamp moment | `stamp` 1.0 + `impact_drop` 0.45 + `pop_hard` 0.5 0.6 b later | `stamp` 1.0 + `impact_drop` 0.45. Delete `pop_hard`; also duck the music −4 dB for 0.5 b around the stamp (a "hole" before the hit: dip from b(STAMP)−6 f to b(STAMP)+12 f) | The best moment in each ad. Contrast makes it, not more layers. |
| S7 | End card SFX (`ecHits`) | 8 hits in 4 s: whoosh, click, tick, pop, swoosh, sparkle, bass, pop_hard | 5 hits in 5.94 s: click (tap, 0.6), tick (check, 0.4), swoosh (installing, 0.35), sparkle (TV on, 0.5), one soft `pop_a` (badge, 0.4, toneFrequency 1.06). Delete `bass_hit` and `pop_hard` | The CTA should feel calm and confident, not like a slot machine. |
| S8 | Music end | 20 f fade | 54 f fade with cubic ease-in on the gain, starting 0.5 b after the badge settles (so ≈1.7 s of lockup with music fading under it). For VO versions, end the VO ≥ 1 b before the fade starts | An ending, not a cut (see change #10). |
| S9 | True peak | −0.8 dBFS sample peak in M1 and M3 after loudnorm | Add `alimiter=limit=0.89:attack=5:release=50` (≈ −1 dBTP) before the second loudnorm pass, or set `TP=-1.5` in loudnorm | Inter-sample peaks clip after platform re-encode at −0.8 dBFS. |

### Target density

Average ≤ 1.2 hits per second, never two hits within 8 frames unless they are a designed layer (stamp + impact). Leave a 2-beat SFX-free window right after each stamp, and a 3-beat window on the lockup.

### VO ducking spec (for the AI voiceover versions)

Loudness targets after mastering: VO speech −16 LUFS short-term, music under VO −27 to −29 LUFS-S (≈11–13 LU below speech), SFX peaks under VO ≤ −8 dB relative to the VO peak.

| Layer | Level without VO | Under VO | Attack | Release | Notes |
| --- | --- | --- | --- | --- | --- |
| Music | 0.5 (−6 dB) | **0.18 (−15 dB)**, i.e. −9 dB duck | 6 f (100 ms), starting 4 f before the VO word onset | 18 f (300 ms) after the phrase ends; hold if the next phrase starts < 24 f later | Remove the duck on the stamp and lockup beats so the music swells back between lines |
| SFX (non-critical: pops, ticks, whooshes) | as S2–S7 | **−6 dB** (×0.5); drop any pop that lands on a stressed VO syllable | instant (per-hit gain) | — | Keep `stamp` at full level: place the VO line *after* the stamp, not on it |
| SFX (critical: stamp, flood whoosh) | 1.0 / 0.35 | unchanged | — | — | VO lines should leave a 0.5 b gap around these |
| VO | — | −16 LUFS-S, high-pass 90 Hz, de-ess 6 kHz −4 dB, light compression 3:1 | — | — | Warm, playful, 25–35 y/o voice. 150–165 wpm |

Remotion implementation (frame-accurate, no plugin):

```ts
// common.tsx
export type VoLine = {from: number; to: number}; // frames
const duck = (f: number, lines: VoLine[], depth = 0.36 /* -9 dB */, att = 6, rel = 18, pre = 4) => {
  let g = 1;
  for (const l of lines) {
    const a = l.from - pre - att, b0 = l.from - pre, b1 = l.to, c = l.to + rel;
    if (f >= a && f <= c) {
      const t = f < b0 ? (f - a) / att : f <= b1 ? 1 : 1 - (f - b1) / rel;
      g = Math.min(g, 1 - (1 - depth) * t);
    }
  }
  return g;
};
// music: volume={(f) => music * duck(f, vo) * fadeOut(f)}
// SFX hit h: volume = (h.vol ?? 0.7) * (h.critical ? 1 : duck(h.at, vo, 0.5))
```

Where VO fits (per ad, at the proposed lengths): M1, M4 and M5 have natural 2–3 beat gaps between story beats once the holds in §3 are applied; M2 is list-driven and works best with no VO (or one closing line). M3 should not have VO during the countdown (it is a comment prompt; silence plus ticks is stronger). M6 needs a Lebanese-dialect voice or no VO: a generic MSA TTS voice would break the tone of the ad.

---

## 5. End card retime (`ads/EndCard.tsx`): exact values

`EC_BEATS = 12.25` (EC_FRAMES = 356 f, 5.94 s).

| Element | Before (b) | After (b) |
| --- | --- | --- |
| Phone enter (SOFT) | 0 | 0 |
| cap1 "Install it from your phone" | 0.15 → 1.9 | 0.15 → **2.6** |
| tap1 | 1.6–2.2 | 2.3–2.9 |
| Device sheet up | 2.05 | **2.8** |
| tap2 / check | 2.8–3.4 / 3.1–3.5 | 3.6–4.2 / 3.9–4.3 |
| cap2 "Pick your TV" | 2.1 → 4.1 | 2.8 → 4.8 |
| Sheet down / installing / bar | 4.1 / 4.15 / 4.3–5.3 | 4.8 / 4.85 / 5.0–6.0 |
| cap3 "Done. Game on." | 4.3 → 5.0 | **5.0 → 6.75** |
| TV in / TV on / QR / code | 5 / 5.15 / 5.3 / 5.4 | 6.0 / 6.0 / 6.2 / 6.3 |
| Phone shrink away | 4.9 → 5.7 | 6.6 → 7.2, **fade phone to 0** at the end (removes the mini phone from the lockup) |
| Wordmark wipe (`lock`) | 6 | 7.5 |
| "Free to play on Android TV / & Google TV" | 6.3 / 6.5 | 7.8 / 8.0 |
| Badge (POP new) | 7 | **8.5**, scale 1 → 1.03 → 1 (one breath at b10.5, 0.5 b long) to re-attract the eye |
| "Or search Mish Ana on your TV" | 7.4 | 8.9 |
| Still lockup | 0.45 s | **b9.0 → 12.25 = 1.6 s** fully static (except the breath) |
| Music fade | last 20 f | last 54 f |

Layout (final lockup, 1080×1920): TV centre y 560 → 520 (gives 40 px more air under it). Wordmark width 640 → 600, at y 900. Body text centred on SAFE_CX, y 1130. Badge width 450 → **520** at y 1350 (the CTA should be the second-largest element after the wordmark). Search line y 1480. Everything stays inside SAFE.bottom 1620, and the badge is no longer near the bottom UI overlay area.

Optional for conversion: the TV QR in the end card is the *room* QR (JQPU). Viewers will try to scan it from the ad. Either swap in a QR to the Play listing (or the landing page with UTM), or blur it slightly (`filter: blur(1.2px)`) so it reads as illustration.

---

## 6. Consistency of motion language across ads

| Rule | Current state | Proposal |
| --- | --- | --- |
| One "hero" bright beat per ad | M3 has 2 full-frame floods (amber 1.25 s, violet), M4 and M2 have a magenta full-frame flood, M5 an amber one, M1 none | Allow exactly one full-colour flood per ad (≤ 10 f at full colour), and always at the reveal/payoff, not in the setup. M4 and M2 setup floods → contained to the phone rects. |
| Stamp vocabulary | "OUT" (M1, M4, M5, M3) vs "برّا" (M6): good. Rotations vary: M1 −8°, M3 ≈ −4°, M5 ≈ −6° | Standardise −6°, the same scale curve (§2), and the same 6 px shake |
| Caption y-positions | 196 to 596 across ads; M5 jumps 250 → 596 → 262 within one ad | Two anchors only: **y 262** (single line) and 230/330 (two lines). M5 lines 4–5 at y 596 sit on top of the phone row; move them to 262 and drop the phones by 60 px |
| Caption sizes | 54–112 px, 9 distinct sizes | Three sizes: 80 (statement), 96 (punch), 112 (payoff). Sub-line 60 |
| Camera push | M1 push 9 %, M4 hook push 5 %; others none | Every ad gets one slow push (5–8 %) in its last body segment, ease-in-out over ≥ 4 b. This is the premium "settle" cue before the end card |
| End-of-body floods into the end card | `BgFlood` 21 f easeIn from the last action point: consistent, good | Keep. Add the feathered edge (T6) |

---

## 7. Landing page polish (`growth/site`)

The landing is already in good shape: antialiased root, `text-wrap: balance/pretty`, specific transition properties, `scale(.96)` on press, 40–44 px hit areas, `prefers-reduced-motion` guard, staggered hero reveal (80 ms). Remaining details:

#### Image outlines
| Before | After |
| --- | --- |
| `.tv__poster` / `.tv__video` have no outline (`site.css:171`) | `outline: 1px solid rgba(255,255,255,.1); outline-offset: -1px;` on both, so the video edge does not melt into the bezel on dark |
| Reel stage art and the "Try it" phone card: inset shadow `var(--line)` (tinted) | Keep for cards. Apply pure `rgba(255,255,255,.1)` only to media (poster, video, screenshots) |

#### Hero video timing
| Before | After |
| --- | --- |
| Hero loop starts at film 0 s: a yellow dot on black for 0.75 s, then an empty "Players 0/12" lobby, and that same empty lobby is the poster frame | Re-encode `hero-16x9-*.mp4` starting at film 8.5 s (phones flip PIZZA/PASTA) and loop to 20 s, or set `video.currentTime = 8.5` on `loadedmetadata`. Poster = film 9.9 s frame (the row of PIZZA cards with the PASTA one highlighted) |
| `.tv__video` fades in with `opacity .6s` | `.4s` with `cubic-bezier(.2,0,0,1)`: poster → video should feel like a cut-through, not a slow fade |

#### Layout and alignment
| Before | After |
| --- | --- |
| "Try it: here's your phone" text sits bottom-aligned left, with the card on the right and a large empty gap above (desktop) | `.try { align-items: center; grid-template-columns: 1fr minmax(320px, 420px); column-gap: 64px; }` so the text centres on the card |
| Reel: the phone overlaps the TV lobby and cuts the "Lea" star tile in half | Move the phone 6 % right or give the lobby grid `padding-inline-end: 18cqw`, so no tile is half-hidden |
| Feature cards: icon tile radius vs card radius 20 px with 22 px padding | Icon tile radius = 20 − 22 → clamp to 8–10 px (currently looks ≈12): `border-radius: 10px` for concentric corners |

#### Motion
| Before | After |
| --- | --- |
| `.js .rv` reveal `.7s` opacity + translate 16 px | `.5s` opacity, `.6s` translate 12 px, stagger 60 ms for grid children (`.feat:nth-child(n)`): long reveals make scrolling feel laggy |
| `@keyframes pop` / `bub` scale from .5/.6 | Scale from .8 with `opacity 0 → 1` and `filter: blur(4px) → 0` over .35 s: same feel as the new POP spring, less cartoon |
| `.phone--float` bob 6 s ±8 px, `.final__shapes` drift 9 s | Keep, but pause both when off-screen (`animation-play-state` via the existing IntersectionObserver) to save battery on mobile |
| `.btn--play:hover` glow up to `0 14px 40px -8px rgba(255,61,139,.85)` | Cap at `.6` alpha; at .85 the glow bleeds into the sub-line "Laptop or TV browser · no download" and lowers its contrast |

---

## 8. Checklist for the re-render

1. `time.ts`: add TEXT, retune SNAPPY, POP, HEAVY; `parts.tsx` Rise default → TEXT, softer exit.
2. `common.tsx`: AdBg brighter, stroke 0.09 + shadow, music 0.5, 54 f fade, `duck()` helper and `VoLine[]` prop.
3. `EndCard.tsx`: 12.25 b retime, mini phone fades out, badge 520 px, 5 SFX.
4. Each `M*.tsx`: apply the pacing table deltas (a `shift()` helper on beat constants), fix dead frames T1–T5, cut the hit lists to ≤ 1 per beat.
5. `Ads.tsx` / `finalize.sh`: blur 12 samples @ 120°, limiter to −1 dBTP.
6. QA: re-run the luma scan (target mean Y 45–60, no frame < 25, no full-colour flood > 10 f) and ebur128 (target LRA ≥ 4 LU without VO, ≥ 6 LU with VO).
