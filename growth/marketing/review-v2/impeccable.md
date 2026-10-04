# Production-quality review: Mish Ana! ad creative, product film and landing page

Reviewer lens: impeccable / production quality (contrast, type sizes, safe zones, pacing, sound-off comprehension, encoding, brand tokens, feed performance).
Date: 2026-10-04. Inputs: `growth/video/out/final/*.mp4` (frames sampled at 2 fps plus key frames at full size), `growth/video/src/**`, `docs/DESIGN.md`, `growth/site/dist` (rendered at 390x844 mobile and 1440x900 desktop with Playwright).

## Verdict

The craft is good. The type is consistent, the brand tokens are used correctly, colour contrast passes WCAG everywhere it matters, the safe-zone centre is offset sensibly away from the right rail, and audio is normalised to -14 LUFS. Three systemic problems undercut conversion, and they match both of the owner's notes:

1. **Too dark.** Every 9:16 ad has a mean luma of 22–38 out of 255. 91–100 % of frames sit below 50, and the 15 s ads that have no "flash" moment never go above 42. The files are also tagged full-range BT.601 with no transfer or primaries flags, so some players will crush them even darker. In a dark-mode feed the opening frames read as a blank or loading tile.
2. **Too fast.** 20 of the 52 on-screen captions are on screen for under 1.0 s, and 7 are under 0.65 s. The ads run captions on a 2–4 beat cadence at 123.78 BPM (1 beat = 0.485 s), which suits the music, but not reading.
3. **The CTA appears too late and can't be acted on.** The Google Play badge appears at 3.39 s into the 4.0 s end card, so it is on screen for **0.6 s**. It sits at y 1333–1507 with the search fallback at y 1530, both inside the Reels/TikTok bottom UI zone. All 6 ads point to Google Play, which isn't live yet, and the "QR" on the end card is decorative and can't be scanned.

Audit health score (impeccable audit rubric, adapted to video plus landing page):

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility (contrast, sound-off, reading speed) | 2 | Contrast passes. Reading speed fails on 20/52 captions. Key labels (clues, reveal line) are 32–48 px |
| 2 | Technical quality (encode, colour tags, safe zones) | 2 | Full-range BT.601 tags. End-card CTA inside the bottom UI zone. 9:16 film chips cross the right rail |
| 3 | Responsive / format adaptation | 3 | 9:16, 16:9 and 1:1 are separate layouts. The landing page has no horizontal overflow at 390 px |
| 4 | Theming / brand tokens | 3 | Tokens used correctly. AR ad ends on the Latin-only wordmark. `text2`/`muted` drift from DESIGN.md |
| 5 | Anti-patterns | 3 | Distinctive and not template-looking. Minor: 28 px card radius and a glass sticky bar on the site |
| **Total** | | **13/20** | Acceptable: needs significant work on brightness, pacing and the CTA |

---

## 1. Measurements

### 1.1 Brightness per video (luma Y, 0–255, sampled at 10 fps; files are full-range)

| Video | Dur | Mean Y | Min | Max | Frames < 50 | Frames < 35 | First 1.5 s mean | Notes |
|---|---|---|---|---|---|---|---|---|
| MA-A-M1-PIZZA | 15.0 s | **21.8** | 15.0 | 27.4 | **100 %** | 100 % | 23.2 | Never brighter than 27. No bright moment at all |
| MA-E-M2-CHECKLIST | 15.0 s | 26.8 | 13.6 | 129.0 | 96.7 % | 94.7 % | 24.5 | One magenta flash at ~5.5 s |
| MA-C-M3-SPOT-THE-MOLE | 20.0 s | 38.0 | 13.6 | 196.0 | 91.0 % | 89.5 % | 21.7 | Amber flood at 8.5 s and 13–15 s (the only bright stretch in the set) |
| MA-B-M4-PASS-THE-PHONE | 15.0 s | 25.2 | 15.0 | 129.4 | 98.0 % | 97.3 % | 27.4 | Magenta flash at ~2.5 s |
| MA-D-M5-TONIGHT | 15.0 s | 27.0 | 13.6 | 195.5 | 98.0 % | 95.3 % | 32.3 | Amber flash at ~9.5 s |
| MA-F-M6-AR-FAMILY | 15.0 s | 25.0 | 14.4 | **42.0** | **100 %** | 99.3 % | 23.8 | Never brighter than 42 |
| MishAna-9x16 / -prelaunch | 23.8 s | 36.0 | 13.1 | 196.0 | 91.2 % | 89.1 % | **17.9** | Opens on ~1 s of near-black with a single amber dot |
| MishAna-16x9 / -prelaunch | 23.8 s | 34.4 | 13.1 | 196.0 | 91.2 % | 90.8 % | 18.1 | Same opening |
| MishAna-1x1 | 23.8 s | 36.1 | 13.1 | 196.0 | 91.2 % | 90.3 % | 18.2 | Same opening |

For reference, typical high-performing 9:16 game and UGC ads average about Y 90–130. A dark-mode TikTok or Instagram UI is about Y 0–20, so these ads sit almost exactly at the colour of the app chrome around them.

### 1.2 Contrast (WCAG 2.x relative luminance)

| Foreground | on `bg` #120A1F | on gradient top #22103A | on `surface` #1E1430 | on `elevated` #2A1D42 |
|---|---|---|---|---|
| cream #FFF7EC | 18.15 | 16.43 | 16.50 | 14.61 |
| text2 #CFC3E0 | 11.51 | 10.42 | 10.46 | 9.27 |
| muted #9A8CB3 | 6.22 | 5.63 | 5.66 | 5.01 |
| magenta #FF3D8B | 5.78 | 5.23 | 5.25 | 4.65 |
| amber #FFC23D | 11.97 | 10.83 | 10.88 | 9.64 |
| outline #4A3A66 | 1.92 (decorative only) | | | |

Fills: ink on amber 11.97, ink on magenta 5.78, cream on magenta **3.14** (banned in DESIGN.md, and correctly unused). Ink on player swatches: coral 4.50, azure 5.94, lemon 16.4, jade 6.45, tangerine 7.40, **grape 3.74** (Nour uses cream on grape: 4.85, OK). Grey text on the "old phone" screen in M4 (#6E6878 on #F4F2F7): 4.79.

**Conclusion:** contrast ratios are not the problem. The problems are **absolute brightness** (luma), **size** of the secondary labels, and **time on screen**.

### 1.3 Type sizes at 1080 px wide (from source)

| Element | Size | Verdict |
|---|---|---|
| `AdCaption` (all ads) | 70–112 px Cairo 900, 0.075 em violet stroke | Good (≥ 56 px) |
| Clue bubbles | M1 44, M3 46, M5 36, **M4 32** (inside a scaled TV, so ~20 px effective) | Too small: clues are core comprehension |
| "Sami was the Mole" reveal line | M1 48, M4 44 (inside a scaled TV, so ~25 px effective), m5-tv 52 (scaled) | Too small for the payoff line |
| M3 "(Sami just eats pizza with a fork.)" | 48 px, 7 words, 1.55 s | Punchline is too small and too fast |
| End card "Free to play on Android TV" | 40 px | OK |
| End card "Or search “Mish Ana” on your TV" | **30 px** at y 1530 | Too small, and inside the bottom UI zone |
| End card Listing screen text | 17–34 × 1.4 px, then shrinks to 0.3× | Decorative. Illegible after the shrink |
| Player names on tiles / UI chrome inside phones and TVs | 15–28 px | Fine as texture, as long as nothing load-bearing lives there |
| Film 9:16 outro chips | 34 px, nowrap, 3 chips | **Span x 65–1015**: the last chip sits under the TikTok/Reels right rail |

### 1.4 Reading speed (start → exit of each caption; 1 beat = 0.485 s)

✗ = under 1.0 s on screen, or over 4 words/s. ✗✗ = under 0.65 s.

| Ad | Caption (time on screen) | Words | Words/s | Flag |
|---|---|---|---|---|
| M1 | Everyone's word is PIZZA. (0.00–1.11) | 4 | 3.6 | ok |
| M1 | Except his. (1.21–2.28) | 2 | 1.9 | ok |
| M1 | Wait… fork? (5.43–6.25) | 2 | — | ✗ 0.82 s |
| M2 | Everyone gets a secret word. (5.45–6.71) | 5 | 4.0 | borderline |
| M2 | One is different. (6.81–7.68) | 3 | 3.4 | ✗ 0.87 s |
| M3 | One of them has a different word. (0–1.70) | 7 | 4.1 | ✗ |
| M3 | Not the Mole. (12.12–12.89) | 3 | 3.9 | ✗ 0.78 s |
| M3 | (Sami just eats pizza with a fork.) (11.34–12.89) | 7 | 4.5 | ✗ and 48 px |
| M4 | **Stop passing one phone around.** (0–0.99) | 5 | **5.0** | ✗ this is the hook |
| M4 | Sami's is PASTA. (4.40–5.11) | 3 | 4.2 | ✗ 0.71 s |
| M4 | (he doesn't know) (4.65–5.14) | 3 | 6.2 | ✗✗ 0.48 s, the key rule of the game |
| M4 | The TV is the stage. (5.48–6.76) | 5 | 3.9 | borderline |
| M5 | Phones out. Scan the TV. (1.26–2.38) | 5 | 4.5 | ✗ |
| M5 | No app on phones. (2.47–3.37) | 4 | 4.4 | ✗ 0.90 s |
| M5 | Except Sami. (5.02–5.62) | 2 | — | ✗✗ 0.61 s |
| M5 | Who's off? (7.25–7.92) | 2 | — | ✗ 0.68 s |
| M5 | Caught him. (8.05–8.77) | 2 | — | ✗ 0.73 s |
| M6 | سهرة العيلة؟ 12 واحد؟ (0–0.82) | 4 | 4.9 | ✗ hook |
| M6 | كلّن معن تبولة… (3.39–4.12) | 3 | 4.1 | ✗ 0.73 s |
| M6 | إلّا خالو. (4.24–4.73) | 2 | — | ✗✗ 0.49 s |
| M6 | وما بيعرف. (4.80–5.28) | 2 | — | ✗✗ 0.48 s |
| M6 | خبز؟ بالتبولة؟! (7.00–7.56) | 2 | — | ✗✗ 0.56 s |
| M6 | طلع خالو! (8.88–9.50) | 2 | — | ✗✗ 0.63 s |
| End card (all) | Install it from your phone (0.07–0.92) | 5 | **5.9** | ✗ |
| End card (all) | Done. Game on. (2.08–2.42) | 3 | 8.8 | ✗✗ **0.34 s** |
| End card (all) | Google Play badge (3.39–4.00) | — | — | ✗✗ **0.61 s for the CTA** |

Captions not listed are at 1.0 s or more and 3.6 words/s or less. Totals: 52 captions, 20 under 1.0 s, 7 under 0.65 s.

### 1.5 Encoding

| Item | Current | Note |
|---|---|---|
| Codec / profile | H.264 High, CRF 16, 60 fps, AAC 256k, faststart | Good |
| Bitrate | 1.6–3.3 Mb/s (flat dark content compresses very well at CRF 16) | Fine at source. After the platform re-encodes, dark gradients band |
| Pixel format / tags | `yuvj420p`, `color_range=pc`, `colorspace=bt470bg`, transfer and primaries **unknown** | **Wrong for HD delivery.** Players that ignore the range flag treat it as limited range and crush the blacks. BT.601 vs BT.709 shifts magenta and amber slightly |
| Loudness | -14 LUFS / -0.8 dBTP | Good |

---

## 2. Proposed changes (numbered, by priority)

Impact = expected effect on ad conversion: thumb-stop (3 s hook rate), comprehension (hold and CTR quality) and click (CTR / install).

### A. Brightness and the feed palette

**1. Fix the colour tags at render time (cheap, applies to everything)**
- Target: `growth/video/tools/finalize.sh:12` and `:16`
- Current: Remotion default output → `yuvj420p` full range, `bt470bg`, untagged transfer and primaries. The audio pass uses `-c:v copy`, so the tags carry through.
- Proposed: render with `--color-space=bt709`. In the final mux, re-encode the video once: `-vf "scale=out_range=tv:out_color_matrix=bt709,format=yuv420p" -c:v libx264 -crf 16 -preset slow -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv`.
- Why: an untagged full-range file is the most common cause of "it looked fine locally but dark on the phone". With limited-range interpretation, today's mean Y 22 maps to about 7, which is black.
- Impact: **High** (makes every ad visibly less dark at zero creative cost).

**2. Brighter "feed ground" for every ad body**
- Target: `growth/video/src/ads/common.tsx:76-78` (`AdBg`), mirrored in `BgFlood`
- Current: `radial-gradient(120% 70% at 50% 0%, #22103A 0%, #120A1F 55%, #0B0614 100%)` (Y 26 → 15 → 9)
- Proposed: `radial-gradient(130% 80% at 50% 0%, #4B1F86 0%, #3A1A6B 45%, #24103F 100%)` (Y 56 → 45 → 28). Add a subtle 1.5 % monochrome noise layer (an SVG `feTurbulence` at 3 % opacity, or a 512 px noise PNG tiled, blend `overlay`) to stop banding after re-encode.
- Contrast on the new mid-tone #3A1A6B: cream 12.84, amber 8.47, magenta 4.09 (≥ 3:1 for large text, so it passes for 70 px+ captions). Keep the magenta-accent words at 80 px+.
- Why: it lifts the baseline from Y ~22 to ~45–50 without losing the "night violet" identity. The violet becomes visibly *violet* on a phone instead of black.
- Impact: **High** (thumb-stop).

**3. Open every ad on a drenched brand-colour frame, not on dark**
- Target: first 1.5 s of M1, M2, M3, M4, M5, M6 and the film (`Film.tsx`, the 0–1 s amber-dot intro)
- Current: first-1.5 s mean Y is 17.9–32.3 in all 9 videos. The film opens on near-black plus one 70 px amber dot.
- Proposed: frames 0–45 (0.75 s) on full-bleed amber `#FFC23D` (Y 197) or magenta `#FF3D8B` (Y 128), with the hook caption in **ink #120A1F** (11.97:1 on amber, 5.78:1 on magenta), Cairo 900 at 104 px. Then iris into the violet scene using the existing `BgFlood` mechanic in reverse. For M1 use amber with "Everyone's word is PIZZA.", and put PIZZA in ink inside a cream sticker plate. Don't use magenta text on amber: it is 2.07:1. For the film, replace the 1 s amber-dot intro with the amber flood that already exists at 13–15 s.
- Why: the brightest, most saturated frame in the feed at the moment of decision. The brand already owns this move (the M3 amber flood is the only part of the set with Y > 150).
- Impact: **High** (thumb-stop).

**4. Put a bright moment in every 3 s window**
- Target: M1 (never above Y 27) and M6 (never above Y 42)
- Current: M1 has no flash at all. M6's brightest frame is Y 42.
- Proposed: M1 at the vote stamp (~9 s, `STAMP = 18.5` beats): an amber flood behind "IT WAS YOU?!" for 0.6 s, as in M3. M6 at "طلع خالو!" (b18.3): the same. In all ads, render the OUT stamp moment at Y ≥ 150 for at least 10 frames.
- Why: a mid-video brightness spike re-hooks drifting viewers and makes the payoff legible.
- Impact: Medium.

**5. Caption plates instead of stroke-only captions**
- Target: `AdCaption`, `common.tsx:52-62`
- Current: cream text, `WebkitTextStroke` 0.075 em in `C.bg`, no background.
- Proposed: optional `plate` prop. A cream `#FFF7EC` rounded plate (radius 0.22 em, padding 0.18 em 0.4 em) with ink `#120A1F` text and accent words in `#C2185B` (deep magenta, 5.53:1 on cream). Use it on the hook line and the payoff line of each ad, and keep the stroke style for the middle lines.
- Why: plates add large bright areas (raising luma), survive any background (including the new brighter ground and future live-action footage), and read as native "TikTok text". Contrast is 18.15:1.
- Impact: Medium-High.

**6. A/B test a "lights-on" variant of the winning ad**
- Target: after Round 1, re-render the best ad with a cream ground
- Proposed tokens: ground `#FFF7EC`, cards `#FFFFFF` with a 2 px `#120A1F` 12 % border, text ink `#120A1F`, accents `#C2185B` (5.53:1) and amber only as fills behind ink. Avatar fix needed: lemon `#FFF04D` on cream is 1.11:1, so give avatars a 4 px ink outline.
- Why: the owner is open to rebranding. Bright ads usually out-hook dark ones in a dark-mode feed. Test it before changing the app palette; the app stays dark, as DESIGN.md requires for TV rooms.
- Impact: Medium (it may be High; only a test will tell).

### B. Pacing and reading speed ("sometimes too fast")

**7. Minimum caption duration rule**
- Target: every `<AdCaption … start end>` in M1–M6 and `EndCard.tsx:200-202`
- Current: 20 of 52 captions under 1.0 s. The shortest is 0.34 s ("Done. Game on.").
- Proposed: **minimum 2.5 beats (1.21 s)** for 1–2 words and **minimum 0.3 s per word + 0.5 s** for longer lines (for example 5 words = 2.0 s = 4.1 beats). Encode it as a lint helper: `capDur(text) = max(b(2.5), (0.5 + 0.3*words) * FPS)`, and assert `end - start ≥ capDur`.
- Why: comprehension with sound off. Captions are the whole message for about 85 % of feed viewers.
- Impact: **High** (hold and comprehension; directly answers "too fast").

**8. Cut caption count to fit, instead of compressing**
- Target: per ad. Exact cuts:
  - M4: merge "Sami's is PASTA." and "(he doesn't know)" into **one line on 2 rows, "Sami got PASTA / and doesn't know it."**, from b9.0 to b12.0 (1.45 s), at 84 / 64 px. Drop "The TV is the stage." (the visual already says it).
  - M5: drop "Who's off?" and hold "One clue *each.*" from b12.4 to b15.4. Move "Except *Sami.*" to b10.35–b12.6 (1.09 s).
  - M6: merge "إلّا خالو." and "وما بيعرف." into **"إلّا خالو… وما بيعرف."** from b8.75 to b11.25 (1.21 s). Hold "خبز؟ *بالتبولة؟!*" to b16.9.
  - M1: "Wait… *fork?*" from b11.2 to b13.4 (1.07 s). Start "Vote out the *liar.*" at b13.5.
  - M2: "One is *different.*" from b14.05 to b16.6.
  - M3: "Not the *Mole.*" plus "(Sami just eats pizza with a fork.)" held until b28 (cut the "Everyone's innocent / Someone's lying" outro by 1.4 beats to compensate).
- Why: the same 11 s body carries 5–6 readable ideas, not 8–10 flickering ones.
- Impact: **High**.

**9. Hook line fully readable for 1.5 s**
- Target: M4 `M4.tsx:532` ("Stop passing one phone around.", ends at b2.05 = 0.99 s), M6 `M6.tsx:359-360` (ends at b1.6–1.7 = 0.8 s), M3 `M3.tsx:412-413` (7 words in 1.7 s)
- Proposed: hook captions end no earlier than **b3.2 (1.55 s)**. For M4, shorten to **"Stop passing *one* phone."** (4 words). For M3, shorten to **"One has a *different* *word.*"** (5 words).
- Why: the hook is what the 3 s hook rate measures. A 5-words-per-second hook is the single fastest frame in the set.
- Impact: **High**.

**10. Lengthen the end card from 4.0 s to 5.5 s and show the CTA from 1.5 s in**
- Target: `EndCard.tsx:31` `EC_BEATS = 8.25` and the internal timeline
- Current: install-flow captions at 0.85 s, 0.97 s and **0.34 s**. Wordmark at b6 (2.9 s). Badge at b7 (3.39 s), so it is visible for **0.61 s**.
- Proposed: `EC_BEATS = 11.5` (5.57 s). New order: wordmark plus CTA plate at b0.5, held the whole time. The install mini-story (phone → TV) plays underneath from b1 to b8 with two captions of at least 2.5 beats each ("Install from your phone" / "Plays on your TV"). The badge or prelaunch CTA appears at b2 and **stays on screen for at least 3 s**. Delete "Done. Game on.".
- Why: the CTA has to be readable long enough to act on. On Meta the platform CTA button appears after about 3–5 s anyway, so the in-video CTA should reinforce it before then.
- Impact: **High** (click).

**11. Slow motion intensity in transitions, not just captions**
- Target: `Words` step and `Rise` springs (`parts.tsx`), and the `CameraMotionBlur` 8 samples
- Current: words rise every 0.1–0.3 beat with SNAPPY/POP springs. Whole-scene floods take about 0.35 s. M2 and M4 have full-frame magenta floods (Y 129).
- Proposed: hold each new scene still for at least 0.5 s after it lands before the next caption enters. Keep the one-word stagger at b0.15 max. Keep floods but limit them to 1 per 4 s.
- Why: "too fast" is about change rate as much as text. One idea per scene, settled, then move.
- Impact: Medium.

### C. CTA validity and end card

**12. Pre-launch end card for all 6 ads (they currently can't run)**
- Target: `EndCard.tsx` `T.en`/`T.ar`, `Ads.tsx:16-37` (add a `cta: 'live' | 'prelaunch'` argument like `Film.tsx:516`)
- Current: every ad ends on "Install it from your phone → Pick your TV → Google Play badge". The Play listing isn't live (the TV app is in testing).
- Proposed: a prelaunch variant with a magenta pill **"▶ Play free in your browser"** (ink on magenta, 5.78:1, 56 px Cairo 900, 96 px tall), under it **"Open it on any TV or laptop · phones are the controllers"** (40 px, text2), and the URL **play.mishana.workers.dev/tv** in 44 px amber. Render `MA-*-prelaunch.mp4` for every ad.
- Why: an ad that sends people to a listing that doesn't exist wastes 100 % of the spend and risks policy rejection.
- Impact: **High** (blocking).

**13. Real QR code or no QR code**
- Target: `growth/video/src/qr.ts:1` ("decorative: finder patterns + seeded noise"), used in `EndCard.tsx:144-148`, M2, M5 and the film
- Current: a fake QR on the end card. People who watch on a laptop or a second screen will try to scan it.
- Proposed: on the end card, encode the real URL `https://play.mishana.workers.dev/tv?utm_source=ad&utm_content=<adId>` (or the landing page). Size ≥ 300 px with a 4-module quiet zone, ink on cream. Inside the gameplay scenes, keep the decorative grid but blur it 2 px so it doesn't read as scannable.
- Why: a code that can't be scanned frustrates viewers. A real one adds a free conversion path for people watching on a desktop or a second device.
- Impact: Medium.

**14. Move the CTA block out of the bottom UI zone**
- Target: `EndCard.tsx:211-230`: "Free to play" at top 1200, badge centre at y 1420 (1333–1507), "Or search…" at top 1530 (30 px)
- Current: the CTA sits where the Reels caption/CTA overlay (bottom ~35 %, y > 1250) and the TikTok caption/music bar (y > ~1500) are drawn.
- Proposed: the whole CTA stack between **y 700 and y 1200**. Wordmark at 700–890, CTA pill or badge at 960–1060, fallback line at 1100 (**40 px, not 30**). Push the mini TV/phone illustration below 1250, where it may be covered without losing meaning.
- Why: the conversion element should never be under the platform UI.
- Impact: **High**.

**15. Arabic end card uses the Latin-only wordmark**
- Target: `EndCard.tsx:213` (`wordmark-latin.svg` for both languages)
- Proposed: `lang === 'ar' ? 'wordmark-ar.svg' : 'wordmark-latin.svg'` (the asset exists in `site/dist/assets/img/`, copy it into `video/public/`), or the bilingual "shared bang" wordmark for AR and diaspora runs.
- Why: brand consistency, and AR viewers recognise «مش أنا» faster.
- Impact: Low-Medium.

**16. Arabic "و Google TV" line**
- Target: `EndCard.tsx:20` `free2: 'و Google TV'`
- Current: renders as "Google TV و", which at 40 px reads like a stray "g".
- Proposed: merge it into one line, `'اللعب ببلاش على Android TV و Google TV'`, wrapped in one `<bdi>`, or drop free2 in AR.
- Impact: Low.

### D. Safe zones and size of load-bearing labels

**17. Clue bubbles at 48 px minimum**
- Target: `M4.tsx:415` (`size={32}`, inside a scaled TV so ~20 px effective), `M5.tsx:206` (36), `M1.tsx:136` (44), `M3.tsx:67` (46), `M6.tsx:272` (42)
- Proposed: render clue bubbles **outside** the scaled TV group in screen space, at 52 px (Cairo 800, cream plate, ink text, 18.15:1). The Mole's clue uses the amber plate (11.97:1).
- Why: the clues ("Cheese / Oven / …Fork?") are the joke and the rule. At 20–36 px they are unreadable on a 6" phone at arm's length.
- Impact: **High** (comprehension).

**18. Reveal line "Sami was the Mole" at 64 px in screen space**
- Target: `M1.tsx:169` (48), `M4.tsx:418` (44 inside the TV, ~25 px effective), `m5-tv.tsx:296` (52 inside the TV)
- Proposed: promote it to an `AdCaption` at 76 px ("*Sami* was the Mole.") at the caption position, held for 1.5 s. Keep the small TV text as diegetic UI.
- Impact: Medium-High.

**19. M3 fork punchline at 64 px**
- Target: `M3.tsx` ("(Sami just eats pizza with a fork.)", 48 px, 1.55 s, 7 words)
- Proposed: **"(He just eats pizza with a fork.)"** at 64 px, held at least 2.2 s (see #8).
- Impact: Medium.

**20. Caption baseline at y 380, not 250**
- Target: `AdCaption y=` values 196–300 in all ads, and `EndCard.tsx:200-202` (y 250)
- Current: 2-line captions at y 236–300 with size 80 have a top edge at about y 160–220. Meta's Reels guidance keeps the top 14 % (269 px) clear.
- Proposed: caption centre at **y 380** (1-line) / **y 400** (2-line). Shift the scene content down 80–120 px (there is about 400 px of unused dark at y 1300–1700 in M1, M2 and M3).
- Impact: Medium.

**21. 9:16 film outro chips cross the right rail**
- Target: `Film.tsx:560-566` (`chipSize` 34, `flexWrap: 'nowrap'`, 3 chips)
- Current: the chips span x ≈ 65–1015 at 1080 wide. "Free to play" sits under the TikTok/Reels like and comment rail (x > 960).
- Proposed: in `tall` mode use 2 rows (`flexWrap: 'wrap'`, max width 900) or 2 chips ("3–12 players", "Free to play"). Keep "Phones are the controllers" as the tagline.
- Impact: Medium.

**22. 16:9 film captions sit in the bottom 10 %**
- Target: `layout.ts` wide `cap: {y: 930, size: 64}`
- Proposed: `y: 880`. YouTube in-stream and Meta in-stream overlays (ad info, skip button) cover about the bottom 12 %.
- Impact: Low.

**23. A persistent "TV" cue in the first 3 s of M1 and M3**
- Target: M1 and M3 bodies (the tiles and phones are never shown inside a TV until the end card at ~11 s / 16 s)
- Proposed: wrap the player-tile stage in the MiniTv bezel (`EndCard.tsx:136` component, `w=980`) from frame 0, or add a 44 px text2 sub-line under the hook, "a party game on your TV".
- Why: sound-off viewers can't tell this is a TV game until the last 4 s. That is the main qualifier for the click (they need a TV).
- Impact: **High** (click quality).

### E. Consistency and brand tokens

**24. Align video tokens with DESIGN.md**
- Target: `growth/video/src/brand.ts:8-9`
- Current: `text2: '#CFC3E0'`, `muted: '#9A8CB3'`. DESIGN.md has `textSecondary #CBBFDD`, `textMuted #A193B8`. The site uses `--muted: #CFC3E0`, so it names the secondary colour "muted".
- Proposed: one shared token file (or `shared/src/brand.ts`) imported by the video, the site and the phone client. Use the DESIGN.md values (`#A193B8` muted = 6.6:1 on bg).
- Impact: Low (hygiene; prevents drift once the palette changes per #2 or #6).

**25. One house style for the payoff stamp across ads**
- Target: M1 "IT WAS YOU?!" 112 px, M4 "Zero passing." 104 px, M5 "Saturday, sorted." on an amber plate, M6 «رح تولّع» 110 px magenta, M2 "Game night, sorted." 88 px
- Proposed: every ad ends its body on the same treatment: an amber plate with an ink 104–112 px line, −3° tilt (the M5 style, already the best-looking frame in the set). This becomes a recognisable series signature.
- Impact: Low-Medium.

### F. AI voiceover (owner request)

**26. Add VO to M3, M5 and the film. Keep M1, M2, M4 and M6 music-led**
- Target: `AdSound` (`common.tsx:22`), new `vo` prop
- Proposed:
  - VO script = caption text verbatim (sound-on and sound-off say the same thing). Pace 2.3–2.6 words/s, which forces the caption durations in #7.
  - Mix: VO at -16 LUFS short-term, music ducked **-10 dB** under VO with 80 ms attack / 300 ms release (sidechain), then the existing -14 LUFS master pass.
  - Voice: warm, amused, young adult, not announcer. One voice across the set. For M6, a Lebanese-dialect Arabic voice, or no VO (an off-dialect TTS is worse than none).
  - M3 sample (puzzle explainer): "One of them has a different word. … Their clues. … Who doesn't fit? Comment your guess. … It was Karim. Sami? He just eats pizza with a fork." M5 sample: "Nothing to do tonight? Phones out, scan the TV. No app. Everyone gets a secret word, except one. One clue each. Catch the liar."
- Why: VO explains the rule (the weakest part of sound-off comprehension) and slows the edit naturally.
- Impact: Medium-High (comprehension, hold). Test VO and no-VO on the same cut.

### G. Landing page (growth/site)

**27. Reveal-on-scroll hides content by default**
- Target: `site.css` (`.js .rv { opacity: 0; translate: 0 16px }`), `assets/js/main.js:523-531`
- Current: with JS on, every `.rv` block is invisible until IntersectionObserver fires. A full-page render at 390 px showed about 2,400 px of empty sections ("how", "no-tv", "why", final CTA) in a headless capture. In-app browsers (IG/TikTok webviews) that throttle IO, and fast flick-scrolls, show blank space.
- Proposed: keep content visible by default. Animate only `translate` (`0 12px` → `0 0`), not opacity, or use `animation-timeline: view()` inside `@supports`. Never gate the final CTA section (`.final`).
- Impact: Medium (ad traffic arrives in webviews).

**28. Card radius 28 px → 16 px, sticky bar without glass**
- Target: `site.css` `--r-lg: 28px`, and the `.sticky` `backdrop-filter: blur(16px) saturate(150%)`
- Proposed: `--r-lg: 16px`, `--r-md: 12px`. Sticky bar: solid `#1E1430` with a 1 px `rgba(255,247,236,.16)` border, no blur (it is also cheaper on low-end Android webviews).
- Impact: Low.

**29. Message match from the ad's last frame to the landing hero**
- Target: hero (`index.html` `.hero`)
- Current: H1 "Everyone's innocent. Someone's lying." (the slogan) above a TV-plus-phone visual. The CTA on mobile is "Send the link to my laptop or TV" (correct for phone traffic).
- Proposed: for ad traffic (`?utm_source=ad`), swap the eyebrow to the ad's hook payoff ("Game night, sorted." / "No app on phones.") and keep the same amber-plate treatment as #25, so the click feels continuous. Keep the brightness lift from #2 on the hero background: today the hero ground is the same #120A1F.
- Impact: Medium.

**30. Landing hero palette lift (pairs with #2)**
- Target: `.hero` background
- Proposed: hero radial `#4B1F86 → #24103F`, the rest of the page unchanged. Body copy stays cream (12.8:1 on #3A1A6B).
- Impact: Low-Medium.

---

## 3. Top 10 (do these first)

1. **#12 Pre-launch end card for all 6 ads.** They currently point to a Play listing that doesn't exist. (High, blocking.)
2. **#10 + #14 End card 5.5 s with the CTA visible from 1 s in and moved above y 1200.** Today the badge is on screen for 0.6 s inside the bottom UI zone. (High.)
3. **#1 Fix colour tags (BT.709, limited range, tagged).** It removes "player-dependent" darkness for free. (High.)
4. **#2 Brighter feed ground `#4B1F86 → #3A1A6B → #24103F` plus 1.5 % noise.** Baseline luma goes from about 22 to about 45. (High.)
5. **#3 Drenched amber or magenta opening frame with an ink hook (first 0.75 s), and replace the film's black amber-dot intro.** (High, thumb-stop.)
6. **#7 + #8 Minimum caption duration (≥ 1.21 s, 0.3 s per word + 0.5 s) and cut captions to 5–6 per ad.** It fixes 20 of 52 too-fast captions. (High.)
7. **#9 Hooks readable for ≥ 1.55 s, with M4 and M3 hook copy shortened.** (High.)
8. **#17 + #18 Clue bubbles at 52 px and the reveal line at 76 px in screen space.** They are 20–48 px today. (High, comprehension.)
9. **#23 Show a TV in the first 3 s of M1 and M3.** Sound-off viewers currently learn it is a TV game only in the last 4 s. (High, click quality.)
10. **#26 AI voiceover on M3, M5 and the film**, VO = captions verbatim, music ducked -10 dB. Test against no-VO. (Medium-High.)

Then: #5 caption plates, #20 caption baseline y 380, #21 film chips, #13 real QR, #27 reveal gating on the site, #6 lights-on A/B.
