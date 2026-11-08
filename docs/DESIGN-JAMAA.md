# DESIGN-JAMAA — the JAMAA platform look, motion and characters

Status: **binding design spec**, draft 2 (review applied), 2026-11-08. Brand: **JAMAA** (Latin), **جماعة** (Arabic): "the gathering, the group". Game #1 keeps its name **Mish Ana!**.

**What this file is.** The visual, motion and character layer of the JAMAA platform: brand, worlds, hub screens, the "entering a game" transition, the player characters, the signature moments of games #2–#4, the animation technology per surface, and wireframes. It **extends** [DESIGN.md](DESIGN.md) and does not replace it.

**Precedence (read this first).**
1. [JAMAA-PLATFORM.md](JAMAA-PLATFORM.md) wins on the platform contract: flow, phases, protocol, settings limits, rules-overlay behaviour, the expression set, the animation stack and the budgets. This file only adds visual detail on top of it. This file's earlier **[AMEND-PLATFORM]** proposals (poster size 210 × 290 dp with a side ticket column, the 1 100 ms first-open portal, the entrance order darken → door → title → characters, the 12 × 9 face space) were **accepted** in the platform's review revision and are now stated in both files (JAMAA-PLATFORM Appendix R). Any future proposal uses the same mark and does not apply until accepted.
2. [GAME-BLUFF.md](GAME-BLUFF.md), [GAME-LIKELY.md](GAME-LIKELY.md) and [GAME-TRIVIA.md](GAME-TRIVIA.md) (which takes over JAMAA-PLATFORM §2.12's game rules) win on each game's rules, phase timings, scoring and per-step reveal scripts. This file adds easing, layout, character staging, sound mapping and reduced-motion detail.
3. [DESIGN.md](DESIGN.md) stays the base system: tokens (§2–§4), focus (§4.6), icons and avatars (§5), motion tokens and reduced motion (§6), RTL (§10), accessibility (§11). Everything here reuses those token names. Mish Ana!'s screens TV-01…TV-15 and PH-01…PH-17 are unchanged except where the platform moves them inside the hub.
4. [SPEC.md](SPEC.md) still wins on identifiers, i18n keys and protocol fields for Mish Ana!.

**Conventions.** As in DESIGN.md: TV wireframes show the 864 × 486 dp safe area at **1 character ≈ 12 dp, 1 line ≈ 27 dp** (72 × 18); phone wireframes are 36 characters wide (≈ 360 px). Wireframes are drawn LTR and mirror per DESIGN §10. `(•)` = initial TV focus. `▓` = character. `[VERIFY]` = an API or fact that could not be checked in the authoring container (Google Maven and gsap.com are unreachable here). Screen ids: `HUB-xx` / `PHH-xx` (platform), `BL-TV-xx` / `BL-PH-xx` (Bluff), `LK-TV-xx` / `LK-PH-xx` (Most Likely), `TR-TV-xx` / `TR-PH-xx` (Trivia).

**Contents:** 1 Brand · 2 Hub · 3 Entering a game · 4 Characters · 5 Signature moments · 6 Animation technology · 7 Wireframes · 8 Tokens to add · 9 Tests and acceptance · 10 Open questions

---

## 1. JAMAA brand

### 1.1 Personality

**"The living room at 11 p.m., when the whole family ends up around the TV."**

Mish Ana!'s personality (DESIGN §1.1, "a Beirut rooftop at 1 a.m.") becomes the personality of **one world** inside JAMAA. JAMAA itself is the **host**: it is warmer, broader and less noir. It is the person who opens the door, says "tfaddalo" and puts the games on the table.

| Trait | On screen | Not |
|---|---|---|
| **Hospitable** | The hub feels like a lit living room. Characters wave when you arrive. Copy greets the group ("Ahla w sahla, {count} of you tonight!") | Corporate "platform" tone, dashboards, menus inside menus |
| **Playful, with craft** | Chunky geometry, springy motion, every transition has a reason (a door, a curtain, a light switch) | Random bounce for its own sake, sugar-rush kids' look |
| **A cast of characters** | The same 12 characters (the **shilleh**, شلّة: Lebanese for "the gang") appear in every game with the same faces | Mascots that speak for the brand, licensed-looking cartoon style |
| **Levantine, modern** | Arches (*bab*), lamps, café warmth, Arabic as a first-class wordmark, darbuka in the sound | Folklore postcards: cedars, flags, tarboush, camels |

**Design principles** (added to DESIGN §1.1, which still applies to every game)
1. **The hub is a room, each game is a world.** The hub is calm and lets the posters glow. A game owns the whole screen with its own light, palette and sound.
2. **Every entrance is a doorway.** Going into a game always passes through a physical metaphor (an arch, a café door, a curtain, a light switch). Going back plays it in reverse. Nothing just cuts.
3. **The characters are the score.** Points are never a bare number change: they come from someone (a fooled friend, a correct answer) and land on someone.
4. **Fewer choices, better defaults.** At most 4 settings rows per game (platform §3.5). The best default always holds the focus.
5. **One code path, two renderers.** Every shape, face and timing comes from shared data, so the browser TV and the native TV cannot drift (§6.4).

### 1.2 Name and voice

- **Display:** "JAMAA" in Latin (all caps in the wordmark only; in running text "Jamaa" is acceptable in EN/FR copy where all caps would shout, e.g. store descriptions). Arabic: «جماعة». Never "Jama'a" or "Jamaa'a" in UI (the apostrophe is the reason the owner chose JAMAA).
- **Pronunciation hint** (store listing, site FAQ): "JAMAA (ja-MAA): Arabic for *the gang, the gathering*."
- **Single source:** `BRAND` in `shared/src/brand.ts` and `Brand.kt` (platform §1.4). i18n: `brand.appName` = "JAMAA" (en, fr, es), «جماعة» (ar). `brand.slogan` and `brand.tagline` get new platform copy (below); Mish Ana!'s current slogan moves to `game.mishana.slogan` (platform §5.7 key layout).

| Key | EN | FR | AR (Lebanese, `[native review]`) |
|---|---|---|---|
| `brand.slogan` (splash, hub ⓘ) | Your phones. One TV. The whole gang. | Vos téléphones. Une télé. Toute la bande. | تلفوناتكن، تلفزيون واحد، والجماعة كلّها. |
| `brand.tagline` | Party games for the whole gathering | Les jeux d'ambiance de toute la bande | ألعاب سهرة للجماعة كلّها |
| `extra.storeHook` | Scan, join, play: party games on your TV, played from your phones. | Scanne, rejoins, joue : des jeux d'ambiance sur la télé, depuis vos téléphones. | امسحوا، فوتوا، والعبوا: ألعاب سهرة عالتلفزيون من تلفوناتكن. |

The voice rules of DESIGN §1.5 (group on TV, one person on phone, gender-neutral AR/FR) apply unchanged.

### 1.3 Wordmark: "the three heads"

**Concept.** "JAMAA" has three A's. In the wordmark each A **loses its crossbar** and gets a **dot** sitting inside its counter. An A without a crossbar plus a dot reads as a person under an arch, or a head under a roof: three people gathered, in the name itself. In the animated splash the three dots are three characters who roll in and sit down (§1.6). The Arabic «جماعة» carries the same dot: the single dot of **ج** is drawn as the same amber dot. The two wordmarks share one detail, as Mish Ana!'s "shared bang" did.

**Construction (Latin, `wordmark-latin.svg`, `viewBox="0 0 1000 260"`)**

| Element | Spec |
|---|---|
| Base glyphs | "JAMAA" set in **Cairo Black (900)**, caps, font size 220 units, tracking −20 (−2 %), baseline y = 200, centred on x = 500. Converted to outlines by `assets/brand/scripts/gen_brand.py` (the existing script; platform §3.9). Fill `color.text` `#FFF7EC` |
| Crossbar removal | For each of the three A outlines: subtract (boolean difference) a rectangle covering the crossbar band, from the inner edge of the left stem to the inner edge of the right stem, y from the crossbar's top − 2 to its bottom + 2 units. The script finds the band as the horizontal run inside the A's bounding box between 55 % and 75 % of the cap height. Result: an open Λ with rounded apex (Cairo's own apex is kept) |
| Dots ("heads") | One circle per A, **r = 19 units**, centre x = the A's counter centre, centre y = baseline − 62 (sits where the crossbar was, slightly lower so it reads as a head with shoulders below). Fill **amber** `#FFC94D` (`color.accent`) in the primary lockup |
| Apex tuning | The three A apexes get a 6-unit round (`stroke-linejoin` emulated by offsetting the outline +3 then −3) so they read as roofs, not spikes |
| Glow (screens only) | Each dot: outer glow `#FFC94D` at 35 %, blur 18 units. Never in print, launcher icon or banner |
| Clear space | The height of the A (cap height ≈ 158 units) × 0.5 on every side |
| Minimum size | 120 dp wide on TV, 96 px on the phone. Below that use the mark (§1.4) |

**Construction (Arabic, `wordmark-ar.svg`, `viewBox="0 0 1000 300"`)**

| Element | Spec |
|---|---|
| Base | «جماعة» in **Cairo Black (900)**, font size chosen so the alef height equals the Latin cap height (≈ 158 units; about 236 units of font size [VERIFY visually]); baseline y = 210 (+10 from the Latin baseline: Arabic sits visually higher); `direction="rtl"`; centred on x = 500. Outlined by `gen_brand.py` |
| The dot | The dot under **ج** is removed from the outline (the script deletes the smallest closed contour below the baseline inside the ج bounding box) and replaced with a circle r = 19 in `#FFC94D` at the removed contour's centre. The two dots of **ة** stay cream (they are letter dots, not heads; colouring them would read as decoration and break the letter) |
| No tracking | Never letter-spaced (DESIGN §3.4) |

**Bilingual lockup (`wordmark-bilingual.svg`, `viewBox="0 0 1000 560"`).** Latin on top (baseline y = 200), Arabic below (baseline y = 470), both centred on x = 500, the Arabic scaled to 0.82 of its standalone size so the two blocks have equal optical width. Gap between them: 0.35 × cap height. In AR-first contexts (AR banner, AR store graphics) the order flips: Arabic on top.

**Colour variants.** Primary: cream letters + amber dots on the hub stage. **Party** (splash end frame, site hero, video end card only): the three Latin dots take three player colours in seat order of the splash: coral `#F0183A`, lemon `#FFF04D`, azure `#478CFF`; the Arabic dot is amber. **Mono**: all cream (watermarks, 1-colour print). **Ink**: all `#120A1F` on light backgrounds (press kit only).

```svg
<!-- reference skeleton for review; the shipped file is outlines from gen_brand.py -->
<svg viewBox="0 0 1000 260" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="noBars"><rect width="1000" height="260" fill="#fff"/>
      <!-- one rect per A crossbar band; x/width filled in by gen_brand.py from the outlines -->
      <rect x="A1x" y="118" width="A1w" height="30" fill="#000"/>
      <rect x="A2x" y="118" width="A2w" height="30" fill="#000"/>
      <rect x="A3x" y="118" width="A3w" height="30" fill="#000"/>
    </mask>
  </defs>
  <text x="500" y="200" text-anchor="middle" font-family="Cairo" font-weight="900"
        font-size="220" letter-spacing="-4" fill="#FFF7EC" mask="url(#noBars)">JAMAA</text>
  <circle cx="A1cx" cy="138" r="19" fill="#FFC94D"/>
  <circle cx="A2cx" cy="138" r="19" fill="#FFC94D"/>
  <circle cx="A3cx" cy="138" r="19" fill="#FFC94D"/>
</svg>
```

`gen_brand.py` must print the computed `A*x`, `A*w`, `A*cx` values and a PNG preview; a reviewer checks that no crossbar fragment remains and that the dots sit inside the counters at 120 dp.

### 1.4 Mark, app icon, TV banner

**Mark: "the ring" (platform §3.9), drawn precisely.** Five character bodies in a closed ring, facing the centre, touching: **circle (coral), square (azure), star (lemon), triangle (jade), arch (lilac)**. They are the five most different silhouettes (DESIGN §5.2), so the ring reads as "different people, one group" and survives CVD by shape. In the middle sits one **amber dot** (the lamp on the table, and the wordmark's dot).

| Element (artboard 108 × 108, the adaptive-icon canvas) | Spec |
|---|---|
| Ring | Centre (54, 54). The five bodies sit on a circle of radius **19**, at angles −90° (top), −18°, 54°, 126°, 198°. Each body is the DESIGN §5.2 24-unit glyph scaled to **17 units**, rotated so its "up" points outward. Adjacent bodies overlap by 1 unit, with a **1.5-unit gap stroke** in the tile colour between them (draw each body with a 1.5-unit stroke in the background colour, painted under the next body), so they read as separate people |
| Faces | Two eye dots per body (r = 1.3, `ink`, or cream on none of these five) at the face box of §4.2, looking at the centre. **Faces are drawn only in the banner and ≥ 96 px renders**; the launcher icon omits them (they turn to noise at 48 px) |
| Centre dot | r = 5, `#FFC94D` |
| Background | radial `#5A2E9A` (centre) → `#3A1E6A` (70 %) → `#2B1650` (edge), as the current launcher tile (DESIGN §1.3), so the icon keeps its edge on dark launchers |
| Safe zone | The ring + dot fit inside the **66-unit** safe circle (outer extent ≈ 19 + 8.5 + 1.5 = 29 units radius → 58 units: 8 units of margin) |
| Monochrome (Android 13 themed icon) | The five bodies + dot as one flat layer; gaps preserved |

**Launcher / Play icon** (`assets/brand/icon.svg`, 512 × 512 export): the mark on its tile. Check legibility at 48 px: the five shapes must still be distinguishable (the star and the arch are the tell). The current icon (speech bubble + bang) becomes Mish Ana!'s **game icon** on its poster (`assets/games/mishana/`).

**TV banner** (`banner_{en,fr,ar}.png`; es and fr use the Latin wordmark of en, 320 × 180 px; Play TV banner 1280 × 720):
- Background: the hub stage (palette B: `#2E1856` → `#1D1036` diagonal) with a soft amber lamp glow (radial 45 % × 60 % at the mark, `#FFC94D` at 18 %).
- Left (EN/FR): the ring **with faces**, 104 px; right: `wordmark-latin`, 160 px wide, vertically centred on the ring; group centred.
- AR: the order mirrors (ring on the right), `wordmark-ar` at 1.2× scale.
- No tagline (TV-BN requires legibility at banner size; the name is enough).

### 1.5 Colour system evolution

The **hub** keeps palette B (DESIGN §2.1) unchanged: violet stage, cream text, the same surfaces, focus ring and status colours. Two changes:

1. **Brand accent = amber.** On hub surfaces the brand colour is `color.accent` `#FFC94D` (the lamp), not magenta. Magenta (`color.primary`) remains the **primary button** colour, and **the focus indicator is one rule everywhere: the 3 dp cream ring + `glow.primary`** (DESIGN §4.6, unchanged), on posters, quiz cards, rows and buttons in every world. A world's accent may tint only a poster's or card's **art**, never the focus indicator. The amber is used for the wordmark dots, "Tonight's cup", the session stars and the New badge.
2. **Worlds.** Each game owns a **world palette** that replaces the stage and adds three accents while the game (or its setup) is on screen. Text, status colours, focus ring and the 12 player colours never change between worlds, so a player is the same colour everywhere.

**World tokens** (ids and accent/deep/glow from platform §3.4; surface/elevated/accentText added here; contrast computed with the WCAG 2.x formula on 2026-11-08):

| Token | `night-market` Mish Ana! | `hakawati-cafe` Bluff | `rooftop` Most Likely | `quiz-studio` Trivia |
|---|---|---|---|---|
| `world.deep` (stage base) | the existing stage (`#1D1036` web / `#120A1F` native) | `#1C1209` espresso | `#071A24` night sky | `#0A0F2E` studio navy |
| `world.stageTop` (stage gradient top) | existing `bgTop` | `#2E1D0E` | `#0E2C3B` | `#141C52` |
| `world.surface` | existing `surface` | `#33230F` | `#0F2E3D` | `#161D4A` |
| `world.elevated` | existing `elevated` | `#4A3418` | `#17404F` | `#222B63` |
| `world.accent` | `#FF4F9A` (= `primary`) | `#E9A23B` brass | `#29D3C2` pool teal | `#5B7CFF` studio blue |
| `world.accentText` (accent as text/thin line on surface) | `#FF7AB3` (= `primaryText`) | `#E9A23B` (6.99:1 on surface) | `#29D3C2` (7.57:1) | **`#8FA8FF`** (7.04:1; the base accent is only 4.41:1 on surface) |
| `world.onAccent` | `#120A1F` | `#120A1F` (8.90:1) | `#120A1F` (10.28:1) | `#120A1F` (5.30:1) |
| `world.glow` | `#FFC94D` | `#FFE3A3` lantern | `#B8FFF6` string lights | `#FFD84D` marquee bulbs |
| `world.signal` (one game-specific accent) | — | `#FF5A5F` **LIE** stamp red (6.04:1 on deep; `ink` on it 6.32:1) | `#FFC94D` award gold (rosettes) | `#3DDC97` correct (= `success`) |

Measured: cream text `#FFF7EC` on `world.deep` 17.34 (café) / 16.72 (rooftop) / 17.64 (studio); on `world.surface` 14.24 / 13.37 / 15.10; on `world.elevated` 11.01 / 10.50 / 12.40. `textMuted` `#B8A8D6` on `world.surface` 6.92 / 6.50 / 7.34. Accent on deep 8.51 / 9.47 / 5.15. All pass DESIGN §2.4's thresholds (body ≥ 4.5:1, large/graphics ≥ 3:1). Player colours on world surfaces get the same 24 % cream ring rule as palette B (DESIGN §2.3) wherever they drop below 3:1; the check belongs in the colour test (§9).

**World stage** (replaces `--stage-tv` / `.tv__bg` while a world is active): linear 180° `world.stageTop` → `world.deep` (60 %), a top glow (radial 90 % × 55 % at 50 % −5 %, `world.glow` at 16 %), an accent bounce (radial 60 % × 50 % at −10 % 70 %, `world.accent` at 12 %), and a 6 % grain on TV (against banding). The grain is **one pre-rendered 128 × 128 tile** (generated once at startup into an `ImageBitmap`, or at build as a data-URI PNG on web) drawn with a repeat shader, never regenerated per frame; it is **off** in lite motion, in calm/reduced motion, and during the portal and the entrance. The native TV keeps its night stage for `night-market` until palette B is checked on the owner's TV (DESIGN §2 note).

**Trivia answer tokens.** Shapes, positions and the never-mirrored 2 × 2 grid are binding in GAME-TRIVIA §8.2 (sun, wave, leaf, spark; True = check, False = cross). GAME-TRIVIA leaves the hex values `[VERIFY]` "against the JAMAA palette"; this file fixes them to palette B values, so the tokens match the phone and browser TV tokens:

| Token | Shape (GAME-TRIVIA) | Colour (final) | Letter | Text on fill | vs `world.surface` (studio) |
|---|---|---|---|---|---|
| A | sun | amber `#FFC94D` (`color.accent`; GAME-TRIVIA's `#FFC23D` is the native night value) | A | ink (12.59:1) | 10.48 |
| B | wave | azure `#478CFF` | B | ink (5.94:1) | 4.94 |
| C | leaf | jade `#1FA88A` | C | ink (6.45:1) | 5.37 |
| D | spark | magenta `#FF4F9A` (`color.primary`; native night value `#FF3D8B`) | D | ink (6.28:1) | 5.22 |
| True | check | jade `#1FA88A` | — | ink | 5.37 |
| False | cross | coral `#F0183A` + 2 dp cream ring at 24 % | — | ink **4.497:1** (below 4.5: the cross glyph only on the fill; the word "False" sits on a cream label strip) | 3.74 |

Amber/azure is the strongest CVD pair; jade and magenta can merge in hue under deutan/protan, so the **shape** (leaf vs spark) and the letter carry them. `[VERIFY with tools/color-check]` the minimum ΔE00 of the four under the Machado matrices and record it here. **The letters A–D stay Latin in all locales**, like the room code (أ ب ج د would not match between an Arabic phone and a French one in a mixed room).

### 1.6 Typography

**Cairo stays**, for all four worlds and the hub. Reasons: one family covers Latin and Arabic with one rhythm (mixed-script names are everywhere), the 600/700/900 subsets are already budgeted (≤ 90 KB web, static instances on Android), and a second display face would add 30–60 KB per script on web and another Arabic pairing problem. World character comes from **treatment, not typeface**:

| World | Title lockup treatment (game posters, setup title, entrance stinger) |
|---|---|
| Mish Ana! | the existing "shared bang" wordmark (DESIGN §1.3), now game art |
| Bluff | Cairo Black in a **neon tube** look: 6-unit cream stroke over a 14-unit `world.accent` outer glow (blur), no fill; the "!" flickers once on entrance (opacity 1 → 0.3 → 1 over 160 ms, once; never a strobe) |
| Most Likely | Cairo Black in **award gold**: a vertical gradient `#FFE7A0` → `#FFC94D` → `#C98A1A`, 2-unit `#7A4A00` inner line at the bottom for a stamped-metal edge |
| Trivia | Cairo Black cream letters on a **marquee panel**: a rounded rect in `world.surface` with a row of 10-unit bulbs (`world.glow`) around the edge, bulbs chase on entrance |

Lockups are generated as outlines by `gen_brand.py` per locale into `assets/games/<id>/title_{en,fr,ar,es}.svg` (platform §3.9). Arabic titles («بلوف!», «مين فينا؟», «مسابقة») get the same treatment, never letter-spaced, never uppercase-transformed.

**Splash (HUB-01, ≤ 1.2 s; platform §3.2):** the 12 characters roll in from the screen edges (each on its own spring, 40 ms stagger, `spring.bouncy`) into a loose ring; three of them (coral, lemon, azure) jump into the three A counters as the wordmark letters draw in (stroke-reveal 400 ms, `ease.decel`) and shrink into the amber dots (scale 1 → dot size, colour crossfade to amber, 200 ms). The remaining nine scatter out of frame. Reduced motion: the final wordmark fades in (200 ms).

---

## 2. Hub

### 2.1 TV hub layout (HUB-02)

Canvas 960 × 540 dp, safe area 864 × 486 (x 48–912, y 27–513), DESIGN §4.2. Two states, driven by the join ticket (platform §3.2):

| Zone | Rect (dp, LTR), compact state | Gathering state (members < 3, or the first 60 s after launch) | Content |
|---|---|---|---|
| Top bar | x 48–912, y 27–75 | same | Start: JAMAA wordmark 120 dp wide. End: "Tonight's cup" chip (hidden until a game ends; OK → cup sheet), ⓘ (40 dp round), Pass button (billing on and not premium), Settings (gear) |
| Carousel | x 48–688, y 87–405 | x 48–640 (about 2 posters visible) | Game posters **210 × 290 dp**, gap 28 dp, the focused one scaled to **1.08** (227 × 313) with the platform focus ring (3 dp cream + `glow.primary`). About 2.6 posters visible in the compact state, so the cut-off poster invites scrolling. The focused poster sits at the start edge + 24 dp. Below it, a meta line (y 405–427, `type.tv.caption`): "3–12 players · 15 min · EN FR AR ES" |
| Join ticket | x 712–912 (200 wide), y 87–427 | x 664–912 (**248** wide) | A ticket card (`elev.1`, `radius.lg`), never focusable: "Join on your phone" (`type.tv.body`), the QR on a cream inner panel (`radius.sm`; the 4-module quiet zone is inside the panel), the room code in `type.tv.code` scaled 0.6 (53 sp) `K X Q P`, then "play.jamaa…/KXQP" in caption. **QR panel: 176 dp compact, ≥ 208 dp gathering.** SPEC §9.9 math, `module = floor(panel / (29 + 8))` for the production version-3 code: 208 → 5 dp modules, 176 → 4 dp (never smaller). The width change animates over 400 ms (`ease.standard`) and never while the carousel moves |
| Members strip | x 48–912, y 435–513 | same | Joined members as **48 dp characters** (faces on) in 72 dp slots with **names under them** (caption; ≤ 8 graphemes when ≤ 8 members, ≤ 6 graphemes at 9–12), idle animation (§4.4), VIP crown badge; 12 × 72 = 864 fits. **Live join:** the joiner drops in (DESIGN §6.2 F), a 2.5 s toast above the strip ("Karim is with us!", `type.tv.body`), and a ring/glow on the newest member until the next join. Empty: "Waiting for the gang…" with three ghost outlines |

**Focus and D-pad** (RTL mirrors Left/Right; every edge is in the remote-only e2e).
- Initial focus: the last played game, else `mishana`.
- Left/Right move through posters and wrap. In RTL the order reverses and Right moves to the previous poster in reading order.
- **Up from the carousel → ⓘ, always** (the rules entry point; it opens the focused game's rules ending with "How JAMAA works"). Left/Right move inside the top bar (wordmark is not focusable); Down from the top bar → the focused poster.
- **Down → the members strip** (first member). OK on a member opens a small menu: **Kick** (confirm dialog, initial focus "Cancel") / **Cancel**. Up → the focused poster.
- The ticket has no focusable element (the QR is not a button), so Left/Right stay purely for games.
- Leaving the carousel keeps `focusedGameId` and the 40 % world tint.
- **Back on the hub** → confirm "Close JAMAA? The room ends for everyone", initial focus **Stay**.
- `hub_move` sound on each move (platform §3.11), at most one per 70 ms like `ui.move`.

**When a poster gains focus** (the "world wakes up", platform §3.2):
1. 0–240 ms: the hub stage crossfades **40 %** toward the focused world's stage (never 100 %: the hub stays recognisably the hub). `ease.standard`.
2. The poster's art starts its ambient loop (≤ 4 moving elements on the poster itself; §5.1 "ambient").
3. The meta line swaps with a 120 ms crossfade.
4. After 300 ms of rest, the TV sends `HUB_FOCUS` (platform debounce; ephemeral, not persisted) and phones slide their card.

### 2.2 Game cards (posters)

```
┌──────────────────────┐   210 × 290 dp, radius.lg, clip
│ ★ NEW          ◆Pass │   badges: top-start / top-end, 24 dp tall pills
│                      │
│    [world scene]     │   world stage gradient + 2–3 code-drawn props
│   ▓   ▓▓   ▓         │   3 characters acting the game (expressions)
│                      │
│ ╔══════════════════╗ │   title lockup (§1.6), max 180 × 64 dp
│ ║   BLUFF!         ║ │
│ ╚══════════════════╝ │
│  Fool your friends   │   tagline, type.tv.caption, 2 lines max
└──────────────────────┘
```

| Element | Spec |
|---|---|
| Art | Code-drawn, no bitmaps (platform §3.4): the world stage, 2–3 props (café: a lantern and a cup; rooftop: string lights and a rosette; studio: two spotlight cones and a buzzer podium; night market: drifting bang marks), and **3 characters** acting the game: Mish Ana!: two `point` at a third `shock`; Bluff: one `smug` holding the fake-moustache prop, two `think`; Most Likely: one `shy` with a rosette, two `point`; Trivia: three behind podiums, one `cheer` |
| Title | The game's lockup in the content locale's script when the content language is AR, else Latin (the poster speaks the language the game will be played in) |
| Tagline | `game.<id>.tagline`, `type.tv.caption`, `textSecondary`, 2 lines max |
| ★ New | Amber pill (`accent` fill, `ink` text, "★ New" / «★ جديد»), shown when the registry marks the game new (platform: last 30 days) |
| Pass chip | Only when `billing` is on, the room is not premium, and the game has Pass packs: a small `gem` chip "Pass" in `overlay` with `textSecondary` text. **Never a lock on a game**: every game is free with starter content (platform §3.2, §4.3). Locks appear only on packs and premium settings inside setup |
| Not available in this content language | The poster dims to 50 % (no blur), with a caption "Not available in {language} yet" across the bottom; it stays focusable and OK opens the platform's content-language dialog |
| Players | The meta line under the focused poster (not on the poster, to keep the art clean): "{min}–{max} players · {minutes} min". When the room has fewer than `minPlayers`, the player part turns `dangerText` and says "Needs 3+" |

### 2.3 Game detail / setup (HUB-03)

Three panes inside the safe area (platform §3.2), drawn on the **full world stage** (the portal has completed the crossfade to 100 %):

| Pane | Rect (dp, LTR) | Content |
|---|---|---|
| Title strip | x 48–912, y 27–91 | Back hint "‹ Games" (start, caption; not focusable, Back does it), the game title lockup 48 dp tall (centre), ⓘ (end, focusable) |
| How to play | x 48–372 (324) | The current how-to card large (illustration 300 × 170 dp + one sentence `type.tv.body`) with dots for 3–4 cards; auto-advances every 6 s while not focused. Focusable as one item: OK replays the full-screen intro (§2.5) |
| Players | x 384–600 (216) | Not focusable. The members as characters on a small stage (64 dp, 3 per row, names in caption below), one dashed ghost per missing player up to `minPlayers` ("Need {n} more"). While below `minPlayers`, a 200 dp QR replaces the bottom half of this pane (platform); otherwise a compact QR + code chip (120 dp QR) stays at the bottom |
| Settings | x 612–912 (300) | "Content: English ▾" (room setting, 40 dp row), then (Trivia with one quiz) the quiz summary card (§2.3.1), then **≤ 4 settings rows** (52 dp each, `type.tv.titleS`, value on the end with ‹ › affordances; a row with one possible value is hidden), then "Advanced ›" (only if the game has advanced settings), then **Start** (full pane width, 56 dp, `primary` fill, `ink` label). `startBlocker` text shows above Start in `dangerText` |

**Settings row style (all games).** Label on the start side, the current value on the end side between chevrons. Left/Right steps; OK on a pack row opens a pack picker sheet (§2.3.1). A setting that is premium shows a `gem` after its label and, when not unlocked, its value is shown greyed with "Pass" (OK opens the Pass store, HUB-08). The row height and focus scale (1.02) are DESIGN §4.6's full-width rule.

**Initial focus (platform §3.10 E):** Start only if this TV has already seen the game's intro **and** `canStart`; on a first visit the intro is full screen (§2.5) and focus returns to the how-to pane after it; otherwise the first settings row. Input is ignored for `INPUT_GUARD_MS` (400 ms) after the portal ends.

**Focus graph:** Content, the settings rows, Advanced and Start form one vertical column (Down from Start → nothing). Left from any of them → the how-to pane; Right from the how-to pane → the row it came from (else the first row). Up from Content or from the how-to pane → the title-strip ⓘ; Down from ⓘ → the how-to pane. The players pane is never focusable. Back → hub with the reverse portal. RTL mirrors Left/Right.

#### 2.3.1 Pack picker (sheet) and the Trivia quiz shelf

**Packs (Mish Ana!, Bluff, Most Likely):** an end-side sheet (420 dp, like the rules overlay) listing packs as rows: pack name, item count, content language chip, and, for locked packs when billing is on, a `lock` + "Pass" chip (OK on it opens HUB-08).

**Trivia quizzes:**
- **One playable quiz in the content language (launch):** no row and no shelf. The settings pane shows a **non-interactive summary card** (300 × 96 dp: cover thumbnail 72 × 96, title, ★★☆ + "Medium", the domain chip and the featured topic chips). Nothing to open, nothing to get lost in.
- **Two or more:** the row "Quiz ‹ Lebanon ›" appears; OK opens the shelf of GAME-TRIVIA §9.1 full screen over the world stage (one row per domain, 240 × 320 dp quiz cards); Back returns without change, OK selects and returns. Visual details of a quiz card:

```
┌──────────────────────────┐  240 × 320 dp, radius.lg
│ [cover: coast + hills,   │  flat palette art, world colours, no flags
│  sunset gradient]        │
│                     ✓    │  selected check badge (top-end)
│ Lebanon: the big quiz    │  type.tv.title, 2 lines
│ ★ ★ ☆  Medium            │  stars 20 dp + word (accessibility)
│ (◉ Lebanon)              │  domain chip: filled world.elevated + arch icon
│ (Music)(Dance)(Football) │  featured topic chips: outlined, max 3 (+n if more)
│ 75 questions      [lock] │  lock + "Pass" only on Pass quizzes in free rooms
└──────────────────────────┘
```

- **Stars:** 1–3 filled amber stars (the star glyph of DESIGN §5.2), empty ones as 2 dp `outlineStrong` outlines; the word Easy / Medium / Hard always follows (GAME-TRIVIA). Spoken label "Difficulty 2 of 3".
- **Domain chip:** a filled pill; the domain icon is the arch glyph for `lebanon`, `globe` for every other domain (no national or religious symbols).
- **Topic chips:** outlined pills for the pack's `featuredTopics`, **in the order the author lists them** (platform §5.4), then "+n"; labels only, never filters (no extra setting).
- Focus: the platform ring (3 dp cream + `glow.primary`); the world accent only tints the cover.
- Rows: the domain name as a row header (`type.tv.title`, `world.accentText`).

### 2.4 ⓘ rules overlay (HUB-07)

Behaviour is binding in platform §3.6 (what each ⓘ opens, the back stack). Visuals:
- TV: end-side sheet, **420 dp on the hub and setup, 360 dp in game**, full height, opaque `world.elevated` fill (or `elevated` on the hub) with a **24 dp shadow edge** on its inner side and **no scrim**; the game remains visible and animated on the other side. In game the sheet covers the end-side content (score rail, Trivia tower, Bluff's right column) for everyone while one person reads; the phone remains the private place to read. Sheet enters with a 240 ms slide from the end edge (`ease.decel`); exit 180 ms (`ease.accel`). Reduced motion: 150 ms fade.
- Header: the game's title lockup at 36 dp, then "Rules" (`type.tv.headline`). On the hub the last section is "How JAMAA works" (3 small cards).
- "**You are here**" section (the rules for `game.phase`) is first, with a 4 dp `world.accent` bar on the start edge and the label "You are here: Voting" in `world.accentText`.
- Sections: a heading (`type.tv.title`), 1–3 sentences (`type.tv.body`), and one small illustration (characters acting it) per section, 120 × 72 dp, static.
- Scoring section: a mini table of points with the same coin glyph as the score moments.
- "Close" button at the bottom (initial focus). Up/Down scroll by 1/3 of the screen with a 200 ms ease. Back from a sheet opened through the pause menu returns to the game, not to the menu.
- **In-game hint:** during round 1 and for 3 s after each phase change, the top bar's end corner shows "◁ Back: menu & rules" (`type.tv.caption`, `textMuted`, back-arrow icon mirrored in RTL), non-focusable.
- Phone: a bottom sheet (≤ 85 % height), same content order, `radius.xl` top corners, a 36 × 4 px grabber. The "Your turn! ✕ to go back" sticky banner (platform) is `world.accent` fill with `onAccent` text and a 3-pulse glow.

### 2.5 First-time "How to play" intro

Triggered **per device** the first time a game's **setup** opens (platform: `intro_seen_<gameId>` on TV, `jamaa:introSeen:<gameId>` on phone). There is no in-game intro phase in any game. The flag is set when the last card is reached **or** the intro is skipped (Back on TV, Skip on phone). Hub Settings and the phone ⋯ menu offer "Show how-to again" (clears the flags); OK on the collapsed how-to pane replays it.

- **TV:** the how-to pane expands to full screen (a 400 ms FLIP from the pane rect, `ease.decel`). Each card: a **large animated scene** (characters acting the step; loops of ≤ 3 s using the character system, so no extra assets), step number "1/4" in `world.accentText`, one sentence in `type.tv.displayS` (44 sp) max 2 lines, a progress bar of segments at the bottom.
  - **Auto-advance after 6 s** per card; **any D-pad input pauses** auto-advance for the rest of the intro; OK = next card; Back = skip to the setup. **The last card never auto-dismisses**: it shows "Got it" (initial focus, `primary`).
  - Card change: the scene slides 48 dp toward the reading start and fades (240 ms), the next one arrives from the reading end (DESIGN §10: mirrors in RTL).
  - **Gathering stays possible:** while members < `minPlayers`, a corner **join chip** (QR ≥ 144 dp on cream + the code) sits in the top-end corner, and a row of 48 dp member characters runs along the bottom (joins drop in with the live-join toast).
  - If `START_GAME` or `CLOSE_GAME` arrives (e.g. from the VIP phone) while the intro is full screen, it **collapses instantly** (no animation) and the world entrance or reverse portal plays.
- **Phone:** a swipeable sheet of the same cards (scene 280 × 160 px, sentence `type.ph.h2`), dots, **Skip** in the top-end corner, "Got it" at the bottom. Swipe direction follows the reading direction. The sheet closes by itself when the room enters PLAYING; the coach marks take over.
- **Coach marks** (platform PHH-04): a 40 px pill at the top of the phone screen during the first round, keyed by `game.phase`, `world.accent` 2 px border, `world.surface` fill, a 16 px `info` icon, dismissed by tap or at the end of the round.

### 2.6 Phone counterparts

| Phone screen | Visual spec |
|---|---|
| **PHH-01 Join** | DESIGN PH-02 with the colour grid replaced by a **character picker**: 4 × 3 grid of 72 px characters (faces on), taken ones greyed (desaturated 80 %, 50 % opacity, a "Taken" caption, no lock icon), the selected one turns `happy` and hops once (§4.4); name input above, "Let me in" bottom button |
| **PHH-02 Hub follow** | A big poster card (the same art as the TV poster, 280 × 380 px, centred) that slides left/right when the TV focus moves (240 ms, `ease.standard`; direction follows the registry order, reversed in RTL), with the meta line under it and "{host} is picking a game on the TV". The phone's background takes 40 % of the world stage, like the TV. VIP: horizontal swipe browses locally and **holds for 6 s after the last swipe**, with a chip "TV: {game}" above the card (tap to resync); an "Open this game" primary button. Non-VIP phones always follow the TV. The ⓘ opens the rules of the card shown on this phone. Bottom: members (40 px characters) and the reactions bar: 6 buttons (48 px) drawn as icons for `laugh`, `shock`, `facepalm`, `happy` (heart), `sad`, `cheer` (confetti) |
| **PHH-03 Setup follow** | Title lockup on the full world stage, then a read-only summary card of the settings (VIP: editable rows, Start). First time: the intro sheet (§2.5) |
| **PHH-04 In game** | The game's screens (§7) under a constant top bar: room code chip (start), own character 28 px + name (centre), ⓘ (44 px) then "⋯" (end) |
| **PHH-05 Results** | The game's results, then "Tonight's cup" with this player's stars flying in from the top (3 × 32 px amber stars, 120 ms stagger, `ease.overshoot`) |

---

## 3. "Entering the game": the doorway transitions

Two transitions together make the "you just walked into another world" feeling. Both have a reduced-motion version. **TV input rule (platform §3.10 E, binding):** while a choreography runs, OK only completes it to its end state and is consumed (it never also activates a control); the screen that follows ignores OK and D-pad for `INPUT_GUARD_MS = 400` after it becomes interactive; key-repeat events never activate buttons. So mashing OK on a poster lands on the setup screen, never on a started game.

### 3.1 A. The Bab portal (hub → setup)

The signature: the focused poster becomes a **doorway arch** (the *bab* shape of the lilac character and of DESIGN §5.2) that grows to fill the screen, and the world is revealed through it. Platform §3.10 A (accepted): **1 100 ms the first time a game is opened in a session** (the "wow"), and **700 ms afterwards** (speed for repeat use), with every step's time scaled by 0.64.

Timeline (first open, 1 100 ms):

| t (ms) | TV | Easing / token |
|---|---|---|
| 0–120 | OK pressed: the poster does a press dip (scale 1.08 → 1.03), `portal_open` sound starts | `motion.instant`, `ease.standard` |
| 0–300 | The other posters slide out sideways (start-side ones toward the start edge, the others toward the end) and fade; the ticket column and members strip slide down 24 dp and fade | 240 ms, `ease.accel` |
| 120–700 | A **clip mask in the arch shape** (the bab path, flat-bottomed) grows from the poster's rect to cover the whole canvas (scale factor ≈ 4.6 at the end, origin = poster centre moving to screen centre). Inside the mask, the world stage is drawn at full screen (not scaled), so it looks like you are approaching a door that opens onto a bigger place. Outside the mask, the hub darkens to `#000` at 40 % | 580 ms, `ease.decel` |
| 200–800 | **Parallax inside the arch:** the world background layer moves at 0.6× of the mask growth, the world props at 1.0× (platform two-layer parallax), so depth reads | same |
| 700–900 | The arch edge disappears (the mask exceeds the screen); a 1-frame-free crossfade from the masked layer to the real setup screen | 200 ms |
| 800–1 000 | The title lockup lands from scale 1.15 → 1 with the world's title treatment flourish (neon flicker, gold glint, bulb chase) | `ease.overshoot` |
| 900–1 100 | The three panes stagger in (60 ms apart) with the default phase transition (rise 24 dp + fade) | `motion.slow`, `ease.decel` |

- **Back (setup → hub)** plays the reverse in 600 ms: the panes drop, the screen shrinks into the arch, the arch shrinks back into the poster, the other posters slide back. `portal_close` sound.
- **Low-end (lite motion, platform §3.8):** the arch mask clips **only the world layer**; the hub layer outside it is replaced by a solid `#000` at 40 % (no live hub drawing under the mask); no blur and no grain anywhere; the parallax props are limited to 2 elements. The portal is part of the gfxinfo frame-time procedure (≥ 50 fps on the reference TV).
- **Reduced motion:** a 150 ms crossfade hub → setup, no scale or mask (platform).
- **Implementation:** TV: `Modifier.graphicsLayer { clip = true; shape = BabShape(progress) }` where `BabShape` is a `Shape` built from the bab `Path` scaled by an `Animatable` [VERIFY that `graphicsLayer` clip with a custom `Shape` performs on the reference TV; else draw with `clipPath` in `drawWithContent`]. Web `/tv`: CSS `clip-path: path(...)` cannot animate scale smoothly across browsers, so use an inline SVG `<clipPath>` with a `transform` driven by the shared choreography runner (§6). Phone: the 600 ms flood of §3.2.

### 3.2 B. World entrance (setup → game)

Platform §3.10 B (accepted order): **≤ 2 000 ms**, OK completes it; the server adds `ENTRANCE_GRACE_MS = 2_500` to the first phase's deadline, which leaves 500 ms for network and render latency. The **core signature lasts 1 250 ms** (darken → the world's own "door" → title); the characters' run-in fills the remainder.

Shared skeleton:

| t (ms) | Step |
|---|---|
| 0–250 | The setup panes fall away (60 ms stagger), the stage darkens to 30 % brightness |
| 250–1 000 | **The world's door** (per game, below), with `world_<id>_sting` |
| 1 000–1 250 | The title lockup hits at scale 1.2 → 1, holds |
| 1 100–1 800 | Characters run in from both sides to their seats (40 ms stagger, landing with `spring.bouncy`, a `happy` blink on landing) |
| 1 800–2 000 | Title moves to its in-game place (top bar) or fades; the first phase's screen is live |

| World | The door (250–1 000 ms, 750 ms window) |
|---|---|
| Mish Ana! (`night-market`) | The amber bang dot drops from the top like a lamp on a cord, swings once (pendulum, damped spring), and its light cone turns the stage on |
| Bluff (`hakawati-cafe`) | The café door (a tall rounded rect in `world.elevated` with a brass handle and a frosted panel where the "BLUFF!" neon is mounted) **swings open** toward the viewer (3D Y rotation 0 → −80°, perspective 1 200 dp, 750 ms, `ease.door`), revealing warm lantern light; one neon flicker (GAME-BLUFF §12.1) |
| Most Likely (`rooftop`) | A velvet curtain **drops closed** (250 ms, `ease.accel`) then **parts** to both sides (500 ms, `ease.door`) revealing the rooftop stage under string lights; the bulbs of the gold arch light up from the centre outward (GAME-LIKELY §12.1) |
| Trivia (`quiz-studio`) | The screen goes dark for 150 ms, then **spotlights snap on one by one** (4 × 120 ms, `trivia.lightsOn` clunks, GAME-TRIVIA §12.1), the bulb arch chases from the reading start to the end, and the two big cones cross at the centre |

**Phone (all worlds):** a 600 ms flood in `world.accent` rising from the bottom (like Mish Ana!'s "Your turn" flood, DESIGN §6.2 F), the title lockup at 70 % width pops in, a haptic `[20, 40, 20]`, then the game's first screen. The phone flood starts when the phone receives `room.phase = PLAYING`, not synced to the TV frame-by-frame.

**Browser TV (`/tv`):** identical script, driven by the shared choreography (§6.4).

**Reduced motion:** a 150 ms crossfade to the world, the title appears for 600 ms, characters appear in place. The sting still plays (sound is not motion).

---

## 4. Player characters: the shilleh

### 4.1 Identity

Twelve characters, one per player colour + shape pair of SPEC §3 (DESIGN §2.3, §5.2). The pair is fixed (Lemon is always the Star), the protocol field stays `color` (platform §3.7), and **the player's name is always shown** next to a character wherever there is room. The character *is* the avatar: in every game, results and the hub, the same body and face. Faces add warmth; **shape + colour + name** remain the identity, so CVD safety is unchanged from DESIGN §2.3.

### 4.2 Construction (vector, code-animated)

Everything lives in `shared/src/characters/` (platform §3.7) as data: SVG path strings plus numbers. `tools/gen-characters` emits `CharacterPaths.kt` and `Choreo.kt`.

**Body.** The DESIGN §5.2 glyph path, in its 24-unit viewBox, **is** the body. On screen the body is drawn directly (no squircle tile behind it) when the character is ≥ 40 dp/px; below 40 the classic avatar tile + glyph of DESIGN §5.2 is used (faces off, platform §3.7). Bodies are filled with the player colour; the three low-contrast colours (coral, grape, plum) get the 2 dp cream ring at 24 % as in DESIGN §2.3, drawn as an outside stroke of the body path.

**Ground shadow.** An ellipse under every standing character: width 70 % of the body width, height 10 %, `#000` at 30 %, scales with hops (smaller and lighter in the air). It anchors characters on stages.

**Face box** (per shape, in body units; features are designed in a 12 × 9 "face space" and scaled uniformly by `faceBox.w / 12`):

| Shape | Face box `{x, y, w, h}` | Note |
|---|---|---|
| Circle | 6, 7.5, 12, 9 | |
| Square | 6, 7.5, 12, 9 | |
| Star | 8, 9, 8, 6 | the face sits in the pentagon core |
| Triangle | 7.5, 11.5, 9, 6.75 | low, where the mass is |
| Diamond | 7, 8, 10, 7.5 | |
| Hexagon | 6.5, 7.5, 11, 8.25 | |
| Plus | 8.5, 8.5, 7, 7 | centre square of the plus |
| Drop | 7, 11, 10, 7.5 | in the round belly |
| Crescent | 4, 9, 8, 6 | on the thick inner part, looking toward the opening |
| Bolt | 8.5, 9.5, 6, 4.5 | the face sits on the central bar; smallest, eyes use the 1.2× size floor |
| Flower | 7.5, 7.5, 9, 9 | on the centre disc |
| Arch | 7, 8.5, 10, 7.5 | in the arch's head, above the door cut-out |

**Features** (face space 12 × 9, origin top-left; colour = the glyph colour: `ink` `#120A1F` on light bodies, cream on grape and plum):

| Feature | Default geometry |
|---|---|
| Eyes | Two ellipses rx 1.1, ry 1.45 at (3.8, 3.6) and (8.2, 3.6). On ink eyes a highlight dot r 0.35 cream at (+0.35, −0.45) of each eye (life at 10 ft; omitted on cream eyes) |
| Brows (optional) | Rounded strokes 2.2 long, width 0.7, at y 1.4 |
| Mouth | Stroke width 0.8, round caps. Soft smile: `M4.4 6.6 Q6 7.6 7.6 6.6` |
| Cheeks (optional) | Circles r 0.9 at (2.2, 5.8) and (9.8, 5.8), cream at 35 % (on cream-eyed bodies: ink at 25 %) |
| Size floor | Below 64 dp, features scale **×1.5** so the eye height is ≥ **2.4 dp** on TV (≥ 2 px on phone); the bolt and star faces get a further ×1.2. Expressions are only *legible* from 72 dp up (§4.4) |

**Rig (what code animates).** Every character is drawn as layers with these animatable properties, the same on TV and web:

| Property | Range | Notes |
|---|---|---|
| `y` (hop) | 0 to −0.5 × body height | ground shadow follows |
| `squash` | scaleY 0.88–1.10, scaleX = 1/scaleY^0.5 (volume kept) | pivot: bottom centre |
| `lean` | −12° to +12° | pivot: bottom centre; `point` uses it |
| `look` | eye offset ≤ 1.2 face units, any direction | platform §3.7 |
| `blink` | eye ry × (0.15–1) | 120 ms close-open |
| `expression` | one of the platform set | features crossfade 120 ms |
| `prop` | an accessory id or none | §4.5 |

### 4.3 Expressions

The set and names are binding in platform §3.7 (`idle`, `think`, `done`, `happy`, `laugh`, `smug`, `shock`, `sad`, `facepalm`, `shy`, `point`, `cheer`, `away`). The owner's list maps: *thinking* → `think`, *shocked* → `shock`, *celebrating* → `cheer`. Feature geometry (face space):

| Expression | Eyes | Brows | Mouth | Body motion |
|---|---|---|---|---|
| `idle` | default; blink every 3–6 s (random per client) | none | soft smile | breathe: squash 1.00 ↔ 1.02, 3.2 s, sine |
| `think` | ellipses offset (+0.9, −0.8) (looking up to the end side) | end brow raised 0.6 | flat line 2.4 wide, offset 0.6 to the end | slow lean ±3°, 2.4 s; on Bluff a pencil prop wiggles |
| `done` | closed arcs `M2.7 3.8 Q3.8 2.8 4.9 3.8` (mirrored for the right) | none | small smile 2.4 wide | one nod (lean 0 → 6° → 0, 300 ms) + `check` badge pop (DESIGN §5.2) |
| `happy` | arcs ^ ^ `M2.7 4.2 Q3.8 2.6 4.9 4.2` | none | open smile: filled half-ellipse 3.6 × 1.8 | one hop (−0.15 body, 260 ms) |
| `laugh` | squeezed `>` `<` (two 1.4-unit chevrons) | none | wide open filled D 4.4 × 2.4 | two quick hops (180 ms each) + squash 0.92 |
| `smug` | half-lidded: ellipses with the top 45 % cut flat | start brow flat, end brow raised 0.8 | side smirk `M4.6 6.8 Q6.8 7.4 7.8 6.0` | lean 6° back, slow (400 ms), hold |
| `shock` | circles r 1.4 with small pupils r 0.5 | both raised 1.0 | O: ellipse 1.4 × 1.8, filled | jump back: squash 1.10 then 0.94, 300 ms |
| `sad` | default eyes, lids drooping (top 25 % cut at a slant toward the outside) | inner ends raised 0.7 (worried) | frown `M4.4 7.4 Q6 6.4 7.6 7.4` | sink: y +0.04 body, squash 0.96, 400 ms |
| `facepalm` | closed lines | none | flat 2.4 | a **hand disc** (r = 0.28 × body width, the body colour, 1-unit glyph-colour outline) slides over the eyes in 200 ms; lean 4° forward |
| `shy` | look down (0, +0.8) | none | tiny smile 1.6 | cheeks on, in rose `#FF96C5` at 60 %; small sway ±2° |
| `point` | look toward the target | none | small open smile (`M4.6 6.6 Q6 7.6 7.4 6.6` closed into a half-ellipse 2.8 × 1.0; distinct from `shock`'s O) | lean toward the target 10°; a short pointing nub (body colour, 0.2 × body) on the target side. `pointSelf`: lean back 6°, eyes at the camera, nub toward itself |
| `cheer` | 4-point stars (size 1.6) instead of eyes | none | wide open | hop loop (3 hops, 220 ms each), squash on landing; optional confetti puff |
| `away` | closed lines | none | small flat | 60 % opacity, desaturated 80 %, a "z" glyph floating up every 2 s; `wifi-off` badge (DESIGN §5.2) |

All expression changes crossfade feature groups in 120 ms (platform). An expression held for an event returns to `idle` after **1.5 s** (reactions) or at the next phase change (game states such as `done`).

**Reaction triggers (shared mapping, `characters/reactions.ts`):**

| Event (any game) | Who | Expression |
|---|---|---|
| Joined the room | the joiner | `happy` + DESIGN §6.2 F join drop |
| `REACT` from a phone | the sender | the chosen reaction, which **is** the expression (platform `REACTIONS = [laugh, shock, facepalm, happy, sad, cheer]`), + its icon burst: laugh → tears, shock → "!", facepalm → sweat drop, happy → heart, sad → rain cloud, cheer → confetti |
| Submitted / voted / answered | the actor (`game.doneIds`) | `done` |
| It's your turn / being waited on | the awaited (`game.awaitedIds`) | `think` + spotlight (last 10 s) |
| Scored by fooling / being right | the scorer | `smug` (fooling) / `happy` → `cheer` (right) |
| Lost points' chance (fooled, wrong) | the player | `shock` (fooled) / `sad` (wrong) |
| Picked as "most likely" | the target | `shy` (or `smug` if they voted for themselves, GAME-LIKELY) |
| New leader | the leader | `cheer` + the crown prop hops on |
| Disconnected | the player | `away` |

**Secrecy rule for characters (binding).** No expression, prop, position or look direction may depend on a secret. Examples: in Mish Ana!, the Mole's character never looks different during ROLE_REVEAL or CLUES; in Bluff, nobody's character reacts to *which* option they voted for before REVEAL; in Trivia, characters show `done` on answer, never right/wrong before REVEAL. The TV can only animate from its own projection, which already enforces this; the rule exists so that phone-side mirrors and mock data never add a "tell". A test checks it (§9).

### 4.4 Readability

- **10 ft:** on a 55" 1080p TV, 1 dp ≈ 1.26 mm, so a 1.6 dp eye is ~2 mm (≈ 2.3 arcmin at 3 m): enough to see eyes, not to tell ^ ^ from stars. Rule: **expressions are legible from 72 dp up**; faces are drawn from 40 dp (platform). **At 40–64 dp every expression is doubled by body motion and/or a badge**: hop for `happy`/`cheer`, sink for `sad`, jump-back for `shock`, the `check` badge for `done`, the `z` for `away`, a lean for `point`. Main stage sizes: 64 dp (setup), 72–96 dp (game stages), 160 dp (spotlight, podium winner). Below 64 dp the eyes are ≥ 2.4 dp (§4.2).
- **Phone:** 40 px in lists, 72 px on the join picker, 96 px for "you" moments.
- **CVD:** unchanged guarantees (shape + colour + name). Expressions never carry information alone: the text verdict (LIE!, "+500", "Correct") is always there.
- **Motion budget:** ≤ 12 characters animating simultaneously on the TV, ≤ 24 moving sprites including coins (GAME-BLUFF §12.7); idle breathing of all 12 is cheap (one shared transform clock), blinks are staggered.

### 4.5 Props (accessories) per game

Props are small vector drawings attached to anchors in the character data: `head` (top centre of the body), `hand` (end side at 60 % height, mirrored in RTL), `front` (centre, over the body bottom). One prop at a time, plus the persistent crown.

| Prop id | Anchor | Game / moment |
|---|---|---|
| `crown` | head | Tonight's cup leader (persists on the hub, platform §3.10 D); new leader in any game |
| `pencil` | hand | Bluff WRITING (wiggles with `think`) |
| `envelope` | hand → drops | Bluff lie submitted (it drops into the box) |
| `moustache` | front, on a stick held at the hand | **Bluff, the liar pops out** (the fake-moustache-on-a-stick: a disguise, the face of a fibber). The house lie character wears a permanent one |
| `ballot` | hand | Bluff and Most Likely: voted |
| `rosette` | front | Most Likely: award won (gold, with the award's first word) |
| `crystal` | hand | Most Likely: Mind Reader |
| `podium` | under the body | Trivia: each character stands behind a podium with its name plate; the podium's front light ring turns on (white) when the player has answered |
| `flame` | around the body (overlay, GAME-TRIVIA §2) | Trivia: streak ≥ 3; flame shapes in `#FF7A1F` with a lemon core, flickering by scale only (no opacity strobe); grows at 5 and 7 |
| `magnifier` | hand | Mish Ana!: optional, VOTING only for **every** character at once (never per role) |

No props reference religion, flags or folklore clichés (DESIGN §1.1).

---

## 5. Signature animated moments per game

General rules (DESIGN §6.1–§6.3 and platform §3.10): the server never waits for animations; OK on the remote completes the running choreography to its end state (platform input rule §3.10 E; host actions are pause-menu items, never on-screen buttons); every countdown comes from server deadlines; reduced motion removes travel and keeps information; total per-moment durations live in `shared/src/motion/choreo.ts`. Tokens: `motion.*`, `ease.*`, `spring.bouncy` from DESIGN §6.1. New tokens in §8.

### 5.1 Shared: points flight and counters (platform §3.10 C)

- **Coin:** a disc of 10 dp (TV) / 8 px (phone) in the **scorer's** player colour, with a 1.5 dp cream rim and the player's shape glyph at 60 % inside (so a coin is identifiable without colour). Large awards (Bluff +500 × m, Trivia correct) show a label chip "+500" riding with the **first** coin only.
- **Path:** a quadratic Bézier with the control point 90 dp above the chord midpoint (below it when both ends are in the top half), the same geometry as DESIGN §6.2 B. Flight 450 ms with `ease.coin` (a soft accelerate/decelerate with a slight wind-up; §8), stagger 70 ms, ≤ 24 coins on screen; when more are needed, coins represent bundles and the label carries the total.
- **Landing:** the target score badge pops (1.15, `ease.overshoot`, 160 ms), `coin_land` plays with pitch rising one pentatonic step per coin (≤ 10 per award).
- **Counter:** integer tick over 600 ms with `ease.decel` (platform). For values ≥ 100 the counter uses an **odometer roll** (each digit column scrolls vertically; columns that do not change stay still), which is what makes Bluff's +500s exciting. Digits are tabular (`tnum`, DESIGN §3.5). Western digits in all locales.
- **Reorder:** FLIP, 400 ms, `ease.standard`; a character that overtakes another does a little hop over it (−0.3 body height arc).
- **Reduced motion:** final numbers at once, a 200 ms crossfade on reorder (platform).

### 5.2 Bluff: the reveal and the points (GAME-BLUFF §12)

**Owner question answered: what is the points style?** Each friend who votes for your lie gives you **+500 × the round multiplier** (×1, ×2, ×3 in the final round), finding the truth is **+1000 × m**, and each like on your lie is **+100**. GAME-BLUFF §6.3 sets these numbers and explains them (finding the truth must be worth more than one fooled friend, so colluding never pays). On screen: **one coin per fooled player** flies **from that player's character to the liar's score pill**, so everyone sees who fell for whom, and the liar's odometer rolls up by 500 at each landing.

Staging on the TV (BL-TV-05), layered on GAME-BLUFF §12.2 step timings:

| Step (GAME-BLUFF) | Visual detail added here | Sound (existing / platform / game ids) |
|---|---|---|
| Intro beat 1.5 s | The corkboard slides down out of view; the lantern light narrows to the centre (the world glow radius 100 % → 55 %, 600 ms) | `sfx.drumroll` start (short version) |
| 1. Spotlight 400 ms | Option card to centre, scale 1 → 1.35, `ease.decel`; other cards dim to 35 % | `ui.select` (soft) |
| 2. Jump-on | Voters hop from the bottom row onto the top edge of the card: arc height 120 dp, 360 ms each, `spring.bouncy` landing, 120 ms stagger; landed voters sit shoulder to shoulder, `think` | `bluff.tok` rising pitch |
| 3. Drumroll 600 ms | The card trembles ±1 dp at 12 Hz (no strobe; disabled in lite and reduced motion) | `sfx.drumroll` peak |
| 4. Stamp 400 ms | LIE! stamp in `world.signal` red, −8°, scale 1.6 → 1 with `ease.overshoot`, an ink-splatter ring (6 dots) for 300 ms; HOUSE LIE: violet `#9B7BFF` stamp + the house character (a cream circle body with the `moustache` prop, no player colour) pops out laughing. Voters → `facepalm` | `bluff.stampLie` / `bluff.stampHouse` |
| 5. The liar pops out 500 ms | The author bursts up from behind the card (y from +40 % of card height to above it, `spring.bouncy`), `smug`, holding the `moustache` prop; name plate slides in under them | `reaction_pop` |
| 6. Coins 600 ms + 80 ms/voter | §5.1 coins from each voter (sitting on the card) to the liar's pill in the scoreboard rail at the end side; label "+500" (or "+1000" ×2, "+1500" ×3) | `coin_fly`, `bluff.coin` / `coin_land` |
| Truth ≈ 4.5 s | Card turns gold (`#FFE3A3` → `#E9A23B` gradient fill), a diagonal light sweep (a 40 dp bright band crossing in 500 ms), TRUTH stamp in `success`; finders `cheer`, coins spring from the card to each finder; non-finders `sad`; the note slides up under the card | `bluff.truth`, `sfx.flip` |
| Nobody bought it 2.5 s | Unpicked lies fan out like a hand of cards (±12° spread), each with a 40 dp `sad` author face, then fall off-screen with gravity (`ease.accel`) | `sfx.leave` (soft) |
| Likes 1.5 s | Hearts (the `vote`-icon-sized heart shape, rose) drift from likers to authors in 600 ms; "+100" | `bluff.like` |
| Scores 6 s (§12.3) | Horizontal bars in each player's colour, odometers, FLIP re-sort, crown hop for the new leader | `counter_tick`, `crown_drop` |

**Phone (BL-PH-04):** a compact mirror: the current option's text big, the stamp drops onto it in the same colours, and **own events** take over the screen: "You fooled 2!" with two coins flying into your total and the haptic `[20, 40, 20]`; "You fell for {name}'s lie" with {name}'s character `smug` and haptic `40`.

**Reduced motion:** no jumps or arcs: voters' mini-characters appear on the card (200 ms fade), the stamp fades in (no scale), coins are replaced by "+500" chips appearing on the liar's pill, counters jump. Reveal time halves (DESIGN §6.3).

### 5.3 Most Likely: the vote reveal (GAME-LIKELY §12.2)

| Step | Visual detail added here | Sound |
|---|---|---|
| Drumroll 0–800 ms | String lights dim to 30 % in a wave from the edges to the centre; the card shrinks to the top (scale 0.6, `ease.standard`) | `sfx.drumroll` |
| Run to your pick | Characters leave the jury arc and **hop in two arcs** to the target, landing behind the previous one: the conga is a polyline behind the target that curls after 6 (shared `likely/layout.ts`); each runner is `point`, lean toward the target | `likely.tok` rising with the line length |
| Count 600 ms | A counter bubble (`world.surface`, cream digits, 40 dp) above each target, odometer roll | `counter_tick` |
| Spotlight 800 ms | Everything but the top target(s) dims to 35 %; a spotlight **drops from the rig** at the top: a radial gradient cone (`world.glow` at 40 %) slides down 120 dp and settles with a small overshoot | `likely.spot` |
| Award stamp 600 ms | A gold rosette (`world.signal` gold, 96 dp, ribbon tails) spins in 180° → 0 and lands on the target's `front` anchor; the award name types in under it (Latin letter-by-letter, Arabic fades, DESIGN §6.2 F); target turns `shy` / `shock` / `smug` | `likely.rosette` |
| Points 800 ms (public mode only) | Agreement coins (GAME-LIKELY §6): for each voter who scored, coins in **that voter's** colour fly from the head of the conga line they joined (their pick) to their own character, labelled "+50 × matches" (e.g. "+150") | `coin_fly`, `coin_land` |
| Unanimous | A confetti cannon from both bottom corners (paper + gold, 36 pieces, 1.2 s), "+400" (public mode) | `likely.confetti` |
| Hold ≥ 1 s | "{name}, defend yourself!" caption with a bouncing speech-bubble icon next to the target | — |

Anonymous mode: identical cream envelopes burst from a ballot box (GAME-LIKELY), counts roll, spotlight and rosette as above, **no points step at all** and no score pills on screen ("Secret votes: awards only"). Chaos: characters scramble (1.2 s), no spotlight.

**Phone (LK-PH-03):** "You got 3 votes!" with your character `shy` under a rosette, or (public mode) "3 others agreed with you: +150" with coins flying into your score. Haptic `[30, 60, 30]` if you topped.

**Reduced motion:** characters appear directly in their conga positions; the spotlight and rosette appear without travel; counts jump.

### 5.4 Trivia: countdown, reveal, streak (GAME-TRIVIA §12)

Phases and timings are GAME-TRIVIA's: QUIZ_INTRO 4 s, READ 3–7 s (never skippable), ANSWER 15 s (`mc4`, pace normal; `tf` 10 s), REVEAL 6 s (+3 s with a fact), LEADERBOARD 6 s after questions 3/6/9/12 and before the final, FINAL_INTRO 4 s. Points: 500–1000 by speed (`tf` 250–500), ×2 on the final, streak bonus +100 per extra correct answer in a row (cap +300). QUIZ_INTRO starts after the platform entrance (its deadline includes `ENTRANCE_GRACE_MS`). This file adds staging detail.

**Quiz intro (TR-TV-01, 4 s after the entrance).** The quiz card **scales in from the marquee** (0.6 → 1, `motion.slow`, `ease.decel`; the shelf is no longer on screen, so there is no FLIP), the ★ stars fill one by one (150 ms each, `ease.overshoot`, `cup_star` pitched up per star), domain and topic chips stagger in (60 ms), studio lights sweep on. Characters stand behind their podiums (`podium` prop).

**Read (TR-TV-02a).** The question card slams in (GAME-TRIVIA §12.2); a thin "get ready" bar fills over the READ duration under the card; the four answer slots show as empty outlined ghosts so the layout does not jump at ANSWER.

**Answer (TR-TV-02).**
- Tiles flip in A→D (90 ms apart, Y axis, `motion.base`); fixed 2 × 2 positions, never mirrored.
- **Countdown:** the ring of 20 bulbs (GAME-TRIVIA) drawn around the question card's edge, `world.glow` bulbs going dark one by one clockwise, computed from `deadline.at − serverNow`; the last 5 s pulse amber with `sfx.tick` (pulse removed in reduced motion; the bulbs still go dark).
- **Answer lock:** the player's podium light ring turns on (white, 200 ms) and the character shows `done` with a buzzer tap. No colour, no shape, no position: nothing hints at the choice (GAME-TRIVIA §8.1). Sound `answer_lock` (= `trivia.buzz`), ≥ 120 ms apart.

**Reveal (TR-TV-03, 6 s).** GAME-TRIVIA §12.3 is the script (Time! stamp → wrong tiles out → jump-on → fastest finger → points fly → tower re-sort → optional fact). Added detail:

| Step | Detail | Sound |
|---|---|---|
| Wrong out | Wrong tiles dim to 30 % and scale 0.96 (`ease.accel`); the correct tile gets a `success` glow and its shape spins 360° (500 ms, `ease.standard`) | `quiz_correct` (= `trivia.correct`) |
| Jump-on | Characters (40 dp) hop from podiums onto their tile along 100 dp arcs (`spring.hop`, 60 ms stagger), stacking 2 rows of 6; on the correct tile `cheer`, on wrong tiles `sad` (or `shock` if they were the only one wrong); no-answer characters stay on the podium with `away`-style "z" | `bluff.tok`-style landing tick (`coin_land` at rate 0.8) |
| Fastest finger | A bolt (the bolt glyph of DESIGN §5.2, lemon) strikes the fastest correct character with a 100 ms white flash on the character only (never full screen) | `trivia.zap` |
| Points fly | One coin per correct player from their character to their row in the leaderboard tower (§5.1), with a "+870"-style label; on the final, the label shows "×2" in amber; a streak ≥ 3 adds a short flame trail to the coin | `coin_fly`, `coin_land` |
| Tower re-sort | FLIP (`motion.reorder`), overtakers hop | `counter_tick` |

**Streak.** At 3 correct in a row a **flame overlay** (`flame` prop, §4.5) wraps the character and the caption "On fire ×3" (`trivia.streak`) shows; the flame grows one step at 5 and 7 (GAME-TRIVIA "3, 5, 7…"), and goes out with a small smoke puff when the streak breaks. Sound `trivia.flame`. The bonus itself is shown inside the coin label (e.g. "+870 +200").

**Stumped / Genius.** Stumped: all tiles dim, the correct tile reveals with a comic "dun-dun", every character `shock`, and `quiz_wrong` (= `trivia.wrong`) plays: the TV never plays a "wrong" sound for one player. Genius: confetti cannon (paper + amber, 1.2 s).

**Final.** FINAL_INTRO: the studio light shifts to `#FF7A1F`/amber, a drum build, a "×2" stamp (`sting.finalQuestion`).

**Phone (TR-PH-01..03).** The answer pad of GAME-TRIVIA §8.4 (bottom 70 %, 2 × 2 tiles, tap = lock, no undo, 250 ms input guard). Visual detail: tiles use the §1.5 colours with the shape at 40 % of tile height and the Latin letter in the tile's top-start corner (20 px, ink); press feedback only during ANSWER. **After a tap all four tiles fade equally to 30 %** (no highlighted choice a neighbour could read), a centred "Locked in! 3.2 s" with a small neutral check appears, and the chosen shape shows only as a 24 px glyph in the top bar until REVEAL. REVEAL: full-screen verdict, jade "Correct! +870" with the coin flying into the score and the flame "×3", or coral "Not this time" with the right answer's token; own rank "You're 2nd".

**Reduced motion:** tiles appear without flipping; wrong tiles fade (no scale); characters appear on their tiles (200 ms fade); no coin flights, scores crossfade; the bulbs still go dark.

### 5.5 Sound cue mapping

Formats follow DESIGN §6.4 (OGG Vorbis 48 kHz mono, −16 LUFS, synthesised by `tools/gen-sounds`, TV and `/tv` only, one global mute). Ids are the platform's (§3.11) and the game docs' (GAME-BLUFF §12.6, GAME-LIKELY §12.6); this file adds no new ids except where marked.

| Moment | Cue |
|---|---|
| Hub focus move | `hub_move` |
| Portal open / close | `portal_open` / `portal_close` |
| World entrance door | `world_mishana_sting`, `world_bluff_sting`, `world_likely_sting`, `world_trivia_sting` (`world_<id>_sting`); Bluff and Most Likely docs also define `sting.bluffIntro` / `sting.likelyIntro`: **the platform names win** (platform precedence) and the game names are aliases in `gen-sounds` |
| Coin flight / landing / counter | `coin_fly` / `coin_land` / `counter_tick` (Bluff's `bluff.coin` is an alias of `coin_land` with its pentatonic stepping) |
| New leader / cup star | `crown_drop` / `cup_star` |
| Reactions | `reaction_pop` |
| Trivia lock / correct / wrong | `answer_lock` / `quiz_correct` / `quiz_wrong` (GAME-TRIVIA's `trivia.buzz`, `trivia.correct`, `trivia.wrong` are aliases); `trivia.lightsOn`, `trivia.slam`, `trivia.tileFlip`, `trivia.zap`, `trivia.flame`, `sting.finalQuestion`, `sting.podium` as defined in GAME-TRIVIA §12.6; `sting.triviaIntro` is an alias of `world_trivia_sting` |
| Bluff truth / house lie | `truth_reveal` (= `bluff.truth`) / `house_got_you` (= `bluff.stampHouse` chuckle) |
| Drumrolls, ticks, stamps, flips | existing `sfx.drumroll`, `sfx.tick`, `sfx.stamp`, `sfx.flip` |
| Trivia studio lights clunk | `trivia.lightsOn` (GAME-TRIVIA) |

---

## 6. Animation technology decision

### 6.1 What was verified (2026-11-08, in the authoring container)

| Fact | Source | Result |
|---|---|---|
| GSAP version, licence | `npm view gsap version license` | **3.15.1**, licence field "Standard 'no charge' license: https://gsap.com/standard-license." The package README says GSAP is "100% FREE … even for commercial use" thanks to Webflow, including all bonus plugins |
| GSAP licence restrictions | gsap.com/standard-license | **Not fetched**: the host is blocked from this container (DNS/proxy refusal). Its restrictions are **[VERIFY]**; this file does not paraphrase them. It is not an OSI licence. The decision below does not depend on the text |
| GSAP size | esbuild 0.25.12 `--bundle --minify --format=esm` + `gzip -9` | `gsap` (full) **27.7 KB gz**; `gsap/gsap-core` **20.2 KB gz** |
| Motion version, licence | `npm view motion` | **14.10.1** latest (MIT); 14.6.0 published 2026-10-22 (the latest ≥ 2 weeks old, platform pin) |
| Motion size | same method | `animate` from `motion`: **26.4 KB gz**; `animate + stagger + spring`: **26.7 KB gz**; `animate` from `motion/mini` (WAAPI): **3.3 KB gz** |
| Motion with Preact | package metadata | React is an optional peer; the vanilla `animate()` works on DOM/SVG elements, so it works with Preact refs without `preact/compat` |
| Three.js | `npm view three`; same method (renderer + scene + camera + box mesh) | **0.187.0** (MIT), **132.0 KB gz** |
| lottie-web | `npm view`; same method (`build/player/lottie_light`) | **5.13.0** (MIT, published 2025-05-21), **48.8 KB gz** |
| dotLottie web | same method | **0.82.1** (MIT), JS 12.7 KB gz **+ WASM 491 KB gz** (`dotlottie-player.wasm`, 1.23 MB raw) |
| Lottie for Compose | Maven Central `maven-metadata.xml` + POM | `com.airbnb.android:lottie-compose` **6.7.1** (latest, updated 2025-10-31), AAR 133.6 KB; depends on `lottie` 6.7.1 (AAR ≈ 433 KB, platform) and Compose BOM 2024.02.01 `foundation`/`ui` (our BOM 2026.09.00 overrides upward; Gradle resolution from Google Maven **[VERIFY]**) |
| Rive | (platform measurement) | web 62 KB gz + WASM 349 KB gz; Android AAR 13 MB |
| Current stack | repo | phone: Preact 10.29.8, `@preact/signals` 2.11.3, ~52.6 KB gz (budget 60); TV: Compose BOM 2026.09.00, tv-material 1.1.0, minSdk 26. `preact@11.2.0` is now latest on npm; **the phone stays on 10.x for this milestone** (no major upgrade mixed into the platform work) |

### 6.2 Evaluation (honest)

- **GSAP** is the best timeline tool on the web, but: 20–28 KB gz is a third to a half of the phone's whole budget, it does not run on the native TV (Kotlin), so every moment would be written twice anyway, and its licence is proprietary with terms we could not read today. **Not on product surfaces.** Fine for `growth/` (site, video) if lane E wants it, with a THIRD_PARTY.md entry after reading the licence.
- **Framer Motion** is React components. The phone is Preact; pulling in compat for animation is the wrong trade. **Rejected.** Its vanilla successor **Motion** (`motion`, same codebase) is MIT and works with Preact through `animate()`, but it brings its own spring solver: the browser TV would then run different curves from Compose on the native TV, and any parity fixture would test code the product does not run. For ~26 KB we would get nothing the shared sampler (§6.4) cannot give in ~1–2 KB. **Not used on product surfaces.**
- **Three.js**: 132 KB gz, about 2.2× the phone budget, a WebGL context on cheap phones and on TV SoCs (Mali-G31-class GPUs with 1–2 GB RAM), and **nothing to share with Compose**. The doorway/world feeling is achieved with 2D masks, parallax, light and scale (§3), which run at 60 fps everywhere. **Rejected** for the phone and the native TV. On the browser TV it would also break parity with the native TV (the real product), so it is rejected there too. Revisit only for a future game whose core *is* 3D.
- **Lottie** is the one format that plays on both Compose and web, but it needs authored files. Without After Effects, options are (a) **code-generated Lottie JSON** from a small TS generator using the same choreography data, or (b) skipping Lottie and drawing the same thing in code. Since (b) is what we do for characters and worlds anyway, Lottie is useful only for a handful of set-pieces (confetti, cup trophy, title stingers) and only once an asset exists. **Optional, not in the critical path** (platform §3.8 agrees).
- **Compose animation** (`Animatable`, `animate*AsState`, `updateTransition`, `AnimatedContent`, `rememberInfiniteTransition`, `spring`, `tween`, `keyframes`, `graphicsLayer`, `Canvas`/`drawWithCache`, `PathMeasure` for arcs) covers every moment in §3–§5 with zero extra APK weight; the repo already uses it (`MishMotion.kt`). `SharedTransitionLayout` (shared-element transitions, in Compose 1.7+) could morph the poster into the setup title **[VERIFY availability and behaviour with tv-material 1.1.0 in BOM 2026.09.00]**; the Bab portal does not depend on it.

### 6.3 The stack, one per surface

| Surface | Stack | Budget | Why |
|---|---|---|---|
| **Phone** (Preact controller) | **The shared choreography runner** (`shared/src/motion/runner.ts`, ~1–2 KB gz: rAF over the deterministic sampler, or step lists pre-sampled into WAAPI keyframes) for every choreographed moment; plain CSS transitions for one-off fades and presses; characters as **inline SVG** from `shared/src/characters`. No Lottie, no Motion, no GSAP, no Three | Core + largest game chunk + locales ≤ **60 KB gz** (platform §3.8); each `game-<id>` chunk ≤ **14 KB gz**; the character renderer ≤ **3 KB gz** in core (paths are data: 12 bodies + ~13 expressions ≈ 6 KB raw) | Phones are the controllers: they must load instantly on 4G and old devices; their animations are small (floods, coins, stamps) |
| **Browser TV** (`/tv` mock) | **The same shared runner** as the phone (springs and timelines from the sampler); inline SVG characters (same code as the phone); `lottie-web` **light** build lazy for optional set-pieces | soft cap **220 KB gz** for TV-mock chunks (platform) | Dev/demo host and the reference implementation of every choreography in TS, running exactly the curves the native TV runs |
| **Native TV** (Kotlin, Compose for TV) | **Compose** (`withFrameNanos` + `graphicsLayer`, or the sampler wrapped as a custom `AnimationSpec`) driven by the **Kotlin port of the shared sampler** with the generated `Choreo.kt`, + a `Canvas` character renderer from generated `CharacterPaths.kt`; plain Compose animation APIs for non-choreographed UI (focus scale, sheet slides); `lottie-compose` **6.7.1** optional for set-pieces only; **lite motion** on low-RAM devices (platform §3.8) | release APK **≤ +1.5 MB** (platform); ≥ **50 fps** in the portal, entrance and points moments on the reference low-end TV | The product. Native animation is the only thing that is smooth on cheap TV SoCs and costs no download |

### 6.4 Parity between browser TV and native TV

1. **One source of geometry.** Character bodies, face boxes, features, props and world props are path data in `shared/src/characters` and `shared/src/worlds`. `tools/gen-characters` generates Kotlin. A fixture (`shared/fixtures/v2/characters.json`) is asserted on both sides.
2. **One source of time, one sampler.** Every moment in §3–§5 is a **step list** in `shared/src/motion/choreo.ts`: `{id, startMs, durationMs, easing, staggerMs?, reduced, lite}` with easing ids mapped to DESIGN §6.1 curves (and §8 new ones). `choreo.ts` exports a deterministic `sample(step, tMs)` covering the cubic-bezier easings **and an analytic damped-spring solution** for `spring.hop` / `spring.bouncy` (fixed settle time). `Choreo.kt` and a Kotlin port of `sample()` are generated/ported; **both products drive their transforms from it** (web: the shared rAF runner; TV: `withFrameNanos`), so the fixture of sampled values (`progress` at t = 0, 25 %, 50 %, 75 %, 100 % of each step, `shared/fixtures/v2/choreo.json`) compared in Vitest and in JVM unit tests checks the curves users actually see.
3. **One layout math.** Positions that depend on players (conga lines, jump-on rows, coin paths, podium order) come from pure functions in `shared/src/games/<id>/layout.ts`, mirrored in Kotlin with fixture tests (GAME-LIKELY §12.7 already requires this for Likely).
4. **Keyframe screenshots.** Playwright captures the `/tv` mock at 3 named keyframes per moment (with a test clock), and the TV's screenshot tests (Roborazzi or Paparazzi, whichever the TV lane already runs [VERIFY]) capture the same keyframes; a reviewer compares them side by side in the PR. They are not pixel-diffed across platforms (fonts render differently), only reviewed.
5. **Reduced motion and lite motion** are flags in the step list (`reduced: 'fade' | 'skip' | 'keep'`, `lite: 'keep' | 'drop'`), so both sides degrade identically.

---

## 7. Wireframes

### 7.1 TV hub (HUB-02)

```
┌────────────────────────────────────────────────────────────────────────┐
│ J A M A A                         [Cup ▓▓▓ ★] (i) [◆ Pass] [⚙]         │ top bar
│                                                                        │
│ ╔═══════════════╗  ┌─────────────┐  ┌─────────────┐┌──┐ ┌────────────┐ │
│ ║★NEW           ║  │             │  │             ││  │ │ Join on    │ │
│ ║  ~ steam ~    ║  │  ▓  ▓  ▓    │  │  ▓ ▓ ▓      ││  │ │ your phone │ │
│ ║ ▓  ▓▓  ▓      ║  │             │  │             ││  │ │ ┌────────┐ │ │
│ ║               ║  │             │  │             ││  │ │ │ ▚▞▚▞▚▞ │ │ │
│ ║ ╔═ BLUFF! ══╗ ║  │ MISH ANA!   │  │ MOST LIKELY ││  │ │ │ ▞▚ QR▚ │ │ │
│ ║ ╚═══════════╝ ║  │             │  │             ││  │ │ │ ▚▞▚▞▚▞ │ │ │
│ ║ Fool your     ║  │ Who's not   │  │ Who's the   ││  │ │ └────────┘ │ │
│ ║ friends(•)    ║  │ one of us?  │  │ one…?       ││  │ │  K X Q P   │ │
│ ╚═══════════════╝  └─────────────┘  └─────────────┘└──┘ │ play.jamaa…│ │
│ 3–12 players · 15 min · EN FR AR ES                     └────────────┘ │
│                                                                        │
│ ▓     ▓     ▓     ▓     ▓     ▓♛      Karim is with us!                │ members
│ Rami  Maya  Joe   Lina  Sami  Karim                                    │ (names)
└────────────────────────────────────────────────────────────────────────┘
```
Compact state. Focused poster (double frame, platform focus ring) at the reading start with its world waking up; the fourth poster is cut off at the ticket edge. In the gathering state (< 3 members or the first 60 s) the ticket widens to 248 dp with a ≥ 208 dp QR panel and about 2 posters show. No in-game screen draws focusable buttons: host actions live in the pause menu, and the wireframes below show the non-focusable "◁ Back: menu" hint where a button used to be. RTL: the wordmark moves to the right, the ticket to the left, posters run right to left.

### 7.2 Game detail / setup (HUB-03, Bluff)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ‹ Games                ╔═ BLUFF! ═╗                               (i)  │
│                        ╚══════════╝                                    │
│ ┌──────────────────────────┐ ┌─────────────────┐ ┌───────────────────┐ │
│ │      HOW TO PLAY         │ │   THE GANG      │ │ Content: English ▾│ │
│ │  ┌────────────────────┐  │ │  ▓     ▓     ▓  │ │ ───────────────── │ │
│ │  │  ▓ writes a fake   │  │ │ Rami  Maya  Joe │ │ Packs   ‹ 2 packs›│ │
│ │  │  ✎  "…ends with?"  │  │ │  ▓     ▓     ░  │ │ Length  ‹ Normal ›│ │
│ │  └────────────────────┘  │ │ Lina  Sami  +1? │ │ Pace    ‹ Normal ›│ │
│ │ 1. Everyone writes a     │ │                 │ │                   │ │
│ │    fake answer.          │ │                 │ │                   │ │
│ │         ● ○ ○ ○          │ │                 │ │ ┌───────────────┐ │ │
│ │                          │ │                 │ │ │   START  (•)  │ │ │
│ └──────────────────────────┘ └─────────────────┘ │ └───────────────┘ │ │
│                                                  └───────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```
Bluff has 3 settings (GAME-BLUFF §9), so no Advanced row. Below `minPlayers`, the gang pane shows a 200 dp QR in its lower half and Start shows "Need 3 players" above it, focus on the first row.

### 7.3 ⓘ rules overlay (HUB-07, in Bluff VOTING)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ROUND 2 · VOTING          │░░░░░░░░░ BLUFF! · Rules ░░░░░░░░░░░░░░░░░░ │
│                           │                                            │
│ ┌──────────┐┌──────────┐  │ ▌You are here: Voting                      │
│ │ answer 1 ││ answer 2 │  │ ▌Pick the answer you think is real. You    │
│ └──────────┘└──────────┘  │ ▌can't pick your own. Change it any time.  │
│ ┌──────────┐┌──────────┐  │                                            │
│ │ answer 3 ││ answer 4 │  │ Writing                                    │
│ └──────────┘└──────────┘  │ Write a fake answer that sounds true…      │
│      (game keeps          │                                            │
│       running) 34         │ Points                                     │
│                           │ ◉ Real one found ........... +1000 × round │
│ ▓ ▓ ▓ ▓ ▓ ▓               │ ◉ Each friend fooled ........ +500 × round │
│                           │ ◉ Each like ...................... +100    │
│                           │              [ Close (•) ]                 │
└────────────────────────────────────────────────────────────────────────┘
```
Sheet 420 dp on the end side; RTL: on the left. The 30 % scrim covers only the sheet's backdrop.

### 7.4 First-time intro (TV, full screen)

```
┌────────────────────────────────────────────────────────────────────────┐
│ BLUFF! · How to play                              2 / 4   [QR] KXQP    │
│                                                                        │
│            ┌──────────────────────────────────────────────┐            │
│            │                                              │            │
│            │   ▓ "…but the cat"   ▓ "…ate the moon"       │            │
│            │        ✎                  ✎                  │            │
│            │                  ▓ (real one, hidden)        │            │
│            │                                              │            │
│            └──────────────────────────────────────────────┘            │
│                                                                        │
│          Everyone votes for the answer they think is real.             │
│                                                                        │
│                                                                        │
│    ████████████████████████████░░░░░░░░░  ░░░░░░░░  ░░░░░░░░           │
│                                         OK: next · Back: skip          │
└────────────────────────────────────────────────────────────────────────┘
```
Last card: the hint is replaced by `[ Got it (•) ]` and auto-advance stops. While members < `minPlayers`, the corner join chip (`[QR]` ≥ 144 dp + code) and a bottom row of 48 dp member characters stay visible. Any D-pad press pauses auto-advance (6 s per card).

### 7.5 Phone: hub follow (PHH-02) and setup intro (PHH-03)

```
┌────────────────────────────────────┐ ┌────────────────────────────────────┐
│ KX QP        ▓ Rami         (i) ⋯  │ │ KX QP        ▓ Rami         (i) ⋯  │
│                                    │ │                          Skip      │
│   ┌────────────────────────────┐   │ │  ┌──────────────────────────────┐  │
│ ‹ │  ★NEW                      │ › │ │  │                              │  │
│   │    ~ steam ~               │   │ │  │   ▓ ✎  "…ends with?"         │  │
│   │  ▓   ▓▓   ▓                │   │ │  │                              │  │
│   │                            │   │ │  └──────────────────────────────┘  │
│   │   ╔═ BLUFF! ═╗             │   │ │                                    │
│   │   ╚══════════╝             │   │ │  1. Everyone writes a fake         │
│   │   Fool your friends        │   │ │     answer on their phone.         │
│   └────────────────────────────┘   │ │                                    │
│   3–12 players · 15 min            │ │            ● ○ ○ ○                 │
│   Maya is picking a game on TV     │ │                                    │
│                                    │ │                                    │
│  ▓ ▓ ▓ ▓ ▓                         │ │                                    │
│ [lol][!][fp][♥][:(][yay]  (icons) │ │                                    │
│ ┌────────────────────────────────┐ │ │ ┌────────────────────────────────┐ │
│ │  Open this game (VIP only)     │ │ │ │            Next                │ │
│ └────────────────────────────────┘ │ │ └────────────────────────────────┘ │
└────────────────────────────────────┘ └────────────────────────────────────┘
```
The reaction buttons are drawn icons for the six platform `REACTIONS` (laugh, shock, facepalm, happy = heart, sad, cheer = confetti), not emoji; the labels above are placeholders.

### 7.6 Bluff: TV

**BL-TV-02 Writing**
```
┌────────────────────────────────────────────────────────────────────────┐
│ ROUND 1 · ×1                                       ( 47 )   KXQP       │
│                                                                        │
│                  ┌ PROVERB ┐                                           │
│        ┌──────────────────────────────────────────────────┐            │
│        │   «اللي بيعرف بيعرف، واللي ما بيعرف…»             │            │
│        │   "Who knows, knows; and who doesn't…"           │            │
│        │                                                  │            │
│        │          Finish it with a convincing lie.        │            │
│        └──────────────────────────────────────────────────┘            │
│                                                                        │
│                                                     ┌──────┐           │
│   ▓✎      ▓✎      ▓✉       ▓✎      ▓✉       ▓✎      │ ✉ ✉  │ 2/6 in    │
│  Rami    Maya    Joe     Lina    Sami    Nour       └──────┘           │
│  ═════   ═════   ═════   ═════   ═════   ═════   (café tables)         │
│                                                    ◁ Back: menu        │
└────────────────────────────────────────────────────────────────────────┘
```
**BL-TV-03 Voting** (≤ 6 options: 1 column; 7–13: 2 columns, GAME-BLUFF §8.2)
```
┌────────────────────────────────────────────────────────────────────────┐
│ ROUND 1 · VOTE: which one is real?   (A full sentence)  ( 28 )   KXQP  │
│      ┌────────────────────────────────────────────────────────┐        │
│      │ A  …dances at every wedding                            │        │
│      ├────────────────────────────────────────────────────────┤        │
│      │ B  …asks for a second plate                            │        │
│      ├────────────────────────────────────────────────────────┤        │
│      │ C  …gets called a know-it-all                          │        │
│      ├────────────────────────────────────────────────────────┤        │
│      │ D  …pays for everyone                                  │        │
│      ├────────────────────────────────────────────────────────┤        │
│      │ E  …keeps quiet and eats                               │        │
│      └────────────────────────────────────────────────────────┘        │
│                         (corkboard, pinned cards)                      │
│   ▓▤      ▓       ▓▤       ▓▤      ▓        ▓▤      ▤ = holds ballot   │
│  Rami    Maya    Joe     Lina    Sami    Nour                          │
│                                                    ◁ Back: menu        │
└────────────────────────────────────────────────────────────────────────┘
```
**BL-TV-05 Reveal (one lie)**
```
┌────────────────────────────────────────────────────────────────────────┐
│ ROUND 1 · REVEAL                                    Rami  2 100 ▲      │
│                         ▓   ▓      ← voters on the card                │
│              ┌─────────────────────────────────────┐ Maya  1 000       │
│              │                    ╲╲ LIE! ╲╲       │ Joe   1 000       │
│              │  …pays for everyone.               │ Lina      0       │
│              │                                     │ Sami      0       │
│              └─────────────────────────────────────┘ Nour      0       │
│                      ▓≡ (smug, moustache on a stick)                   │
│                     RAMI fooled 2!       ●  ● ─────→ Rami's pill      │
│                                          coins "+500"                  │
│   ░ ░ ░ ░  (other cards dimmed 35 %)                                   │
│                                                                        │
│                                                       ◁ menu           │
└────────────────────────────────────────────────────────────────────────┘
```
**BL-TV-06 Scores race** (6 s): horizontal bars per player sorted by score, odometer numbers at the bar ends, crown on the leader. **BL-TV-07 Awards / BL-TV-08 Results**: trophy cards on velvet stands; podium 3-2-1 with `cheer` characters, buttons per HUB-05.

### 7.7 Bluff: phone

```
BL-PH-01 Write                         BL-PH-02 Vote
┌────────────────────────────────────┐ ┌────────────────────────────────────┐
│ KX QP        ▓ Rami         (i) ⋯  │ │ KX QP        ▓ Rami         (i) ⋯  │
│ ┌ Write a fake ending ───────────┐ │ │ Which one is real?           ( 28 )│
│ │ coach mark (round 1 only)      │ │ │ ┌────────────────────────────────┐ │
│ └────────────────────────────────┘ │ │ │ …dances at every wedding.   ♡  │ │
│ «اللي بيعرف بيعرف، واللي ما بيعرف…» │ │ └────────────────────────────────┘ │
│ "Who knows, knows; and who…"       │ │ ┌────────────────────────────────┐ │
│                           ( 47 )   │ │ │ ✓ …asks for a second plate. ♥  │ │
│ ┌────────────────────────────────┐ │ │ └────────────────────────────────┘ │
│ │ …pays for everyone.            │ │ │ ┌────────────────────────────────┐ │
│ │                         19/60  │ │ │ │ …pays for everyone.   (Yours)  │ │
│ └────────────────────────────────┘ │ │ └────────────────────────────────┘ │
│ Help me lie                        │ │ ┌────────────────────────────────┐ │
│                                    │ │ │ …keeps quiet and eats.      ♡  │ │
│                                    │ │ └────────────────────────────────┘ │
│                                    │ │ Likes left: 1                      │
│ ┌────────────────────────────────┐ │ │                                    │
│ │          Lock my lie           │ │ │  Tap to vote. You can change it.   │
│ └────────────────────────────────┘ │ │                                    │
└────────────────────────────────────┘ └────────────────────────────────────┘
```
```
BL-PH-04 Reveal (own event)            BL-PH-05 Scores
┌────────────────────────────────────┐ ┌────────────────────────────────────┐
│ KX QP        ▓ Rami         (i) ⋯  │ │ KX QP        ▓ Rami         (i) ⋯  │
│                                    │ │                                    │
│        "…pays for everyone."       │ │              2nd                   │
│           ╲╲ LIE! ╲╲               │ │            2 100                   │
│                                    │ │          +1 100 this round         │
│              ▓≡                    │ │                                    │
│        You fooled 2!               │ │   ▓ Maya ............ 2 400        │
│      ▓ Maya    ▓ Joe               │ │   ▓ Rami ............ 2 100  ◀     │
│        ●──→  ●──→   [ 2 100 ]      │ │   ▓ Joe ............. 1 000        │
│           +1 000                   │ │                                    │
│                                    │ │     Next prompt in 4…              │
└────────────────────────────────────┘ └────────────────────────────────────┘
```

### 7.8 Most Likely: TV and phone

**LK-TV-01 Card / LK-TV-02 Voting**
```
┌────────────────────────────────────────────────────────────────────────┐
│ CARD 4 / 12                    · · · string lights · · ·    ( 21 )     │
│                   ╭───────────────────────────────╮                    │
│                   │  Who's most likely to…        │                    │
│                   │                               │                    │
│                   │   CRY AT A WEDDING?           │                    │
│                   │                               │                    │
│                   │        Waterworks Award       │                    │
│                   ╰───────────────────────────────╯                    │
│                     ( gold bulb arch behind )                          │
│                                                                        │
│        ▓✓      ▓       ▓✓      ▓✓      ▓       ▓✓      ▓               │
│      Rami    Maya    Joe     Lina    Sami    Nour    Karim  (jury arc) │
│                                                                        │
│                                                   ◁ Back: menu         │
└────────────────────────────────────────────────────────────────────────┘
```
**LK-TV-03 Reveal (public)**
```
┌────────────────────────────────────────────────────────────────────────┐
│ CRY AT A WEDDING?                                                      │
│                           ╲  spotlight  ╱                              │
│                            ╲          ╱                                │
│                             ╲  (✿)   ╱      ← rosette "Waterworks"     │
│          ░             ▓ ▓ ▓ ▓ MAYA ▓        ░                         │
│        Rami(1)        conga line → (4)     Joe(1)                      │
│                                                                        │
│                   Maya, defend yourself!                               │
│                                                                        │
│     coins +100 ──→ ▓Lina ▓Sami ▓Nour ▓Karim                            │
│                                                       ◁ menu           │
└────────────────────────────────────────────────────────────────────────┘
```
```
LK-PH-01 Vote                          LK-PH-03 Reveal
┌────────────────────────────────────┐ ┌────────────────────────────────────┐
│ KX QP        ▓ Rami         (i) ⋯  │ │ KX QP        ▓ Rami         (i) ⋯  │
│ Who's most likely to…       ( 21 ) │ │                                    │
│ cry at a wedding?                  │ │      You read the room!            │
│ ┌────────┐ ┌────────┐ ┌────────┐   │ │           +100                     │
│ │   ▓    │ │   ▓    │ │ ┄▓┄    │   │ │            ●──→ [ 700 ]            │
│ │  Maya  │ │  Joe   │ │  Me    │   │ │                                    │
│ └────────┘ └────────┘ └────────┘   │ │   Maya got the                     │
│ ┌────────┐ ┌────────┐ ┌────────┐   │ │   (✿) Waterworks Award             │
│ │ ✓ ▓    │ │   ▓    │ │   ▓    │   │ │        ▓ (shy)                     │
│ │  Lina  │ │  Sami  │ │  Nour  │   │ │                                    │
│ └────────┘ └────────┘ └────────┘   │ │                                    │
│ Tap to vote. Change it any time.   │ │   Next card in 3…                  │
└────────────────────────────────────┘ └────────────────────────────────────┘
```
Tiles 3 per row at 360 px (≥ 96 × 112 px each), own tile dashed with "Me".

### 7.9 Trivia: TV and phone

**TR-TV-01 Quiz intro (4 s)**
```
┌────────────────────────────────────────────────────────────────────────┐
│                       ○ ○ ○ ○ bulb arch ○ ○ ○ ○                        │
│               ┌──────────────────────────────────────┐                 │
│               │   LEBANON: THE BIG QUIZ              │                 │
│               │   ★ ★ ☆   Medium                     │                 │
│               │   (◉ Lebanon)                        │                 │
│               │   (Music) (Dance) (Football) +8      │                 │
│               │   10 questions                       │                 │
│               └──────────────────────────────────────┘                 │
│                                                                        │
│      ▓        ▓        ▓        ▓        ▓        ▓                    │
│    ┌───┐    ┌───┐    ┌───┐    ┌───┐    ┌───┐    ┌───┐   (podiums)     │
│    │Ram│    │May│    │Joe│    │Lin│    │Sam│    │Nou│                  │
│    └───┘    └───┘    └───┘    └───┘    └───┘    └───┘                  │
│                                                   ◁ Back: menu         │
└────────────────────────────────────────────────────────────────────────┘
```
**TR-TV-02 Answer** (READ looks the same with empty ghost tiles and a "get ready" bar)
```
┌────────────────────────────────────────────────────────────────────────┐
│ QUESTION 3 / 10 · Music                                   ┌──────────┐ │
│      ○ ● ● ● ● ● ● ● ● ● ● ● ●  (bulb ring)               │ Sami  2610│ │
│      ● Which singer is known as "the Neighbour  ●         │ Maya  2140│ │
│      ●  of the Moon"?                           ●         │ Rami  1980│ │
│      ● ● ● ● ● ● ● ● ● ● ● ● ●                            │ Joe   1200│ │
│  ┌───────────────────────────┐ ┌───────────────────────────┐│ Lina   870│ │
│  │ A ☼  Sabah                │ │ B ≈  Fairuz               ││ Nour     0│ │
│  └───────────────────────────┘ └───────────────────────────┘└──────────┘ │
│  ┌───────────────────────────┐ ┌───────────────────────────┐ (tower)   │
│  │ C ❦  Majida El Roumi      │ │ D ✦  Wadih El Safi        │           │
│  └───────────────────────────┘ └───────────────────────────┘           │
│      ▓◌       ▓◉       ▓◉       ▓◌       ▓◉       ▓◌   ◉ = answered    │
│    └Ram┘    └May┘    └Joe┘    └Lin┘    └Sam┘    └Nou┘                  │
│                                                    ◁ menu              │
└────────────────────────────────────────────────────────────────────────┘
```
`☼ ≈ ❦ ✦` stand for the drawn sun, wave, leaf and spark shapes. The A–D grid is never mirrored in RTL (GAME-TRIVIA §8.2); the leaderboard tower moves to the start side in RTL.

**TR-TV-03 Reveal**
```
┌────────────────────────────────────────────────────────────────────────┐
│ QUESTION 3 / 10 · Music                                   ┌──────────┐ │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ╔═══════════════════════════╗│ Sami  3480│ │
│    A ☼ Sabah        ▓          ║ B ≈ Fairuz  ✓  ▓ ▓ ▓ ▓    ║│ Maya  2140│ │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  ╚═══════════════════════════╝│ Rami  2010│ │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │ Joe   1960│ │
│    C ❦ Majida E.R.  ▓            D ✦ Wadih El Safi         │ ...       │ │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  └──────────┘ │
│        Fastest finger: SAMI ϟ        coins "+870 +200" ──→ tower       │
│        Sami: On fire ×3 (flame overlay)                                │
│      ░        ░        ░        ░        ░        ░   (empty podiums)  │
│    └Ram┘    └May┘    └Joe┘    └Lin┘    └Sam┘    └Nou┘                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```
**TR-TV-04 Leaderboard** (6 s): full-screen bars, odometers, crown, "+3 places!" arrow on the biggest climber. **TR-TV-05 Final intro**: "FINAL QUESTION, double points" + ×2 stamp. **TR-TV-06 Results**: podium 3-2-1, stats cards, then the HUB-05 cup panel.

```
TR-PH-01 Answer pad                    TR-PH-03 Reveal
┌────────────────────────────────────┐ ┌────────────────────────────────────┐
│ KX QP        ▓ Rami         (i) ⋯  │ │ KX QP        ▓ Rami         (i) ⋯  │
│ Q3 / 10 · Which singer is known…   │ │                                    │
│ ███████████████████░░░░░░  (time)  │ │           Correct!                 │
│ ┌───────────────┐┌───────────────┐ │ │          +870 +200                 │
│ │A              ││B              │ │ │          ●──→ [ 2 010 ]            │
│ │      ☼        ││      ≈        │ │ │                                    │
│ │    Sabah      ││    Fairuz     │ │ │   ┌────────────────────────────┐   │
│ │               ││               │ │ │   │ B ≈  Fairuz           ✓    │   │
│ └───────────────┘└───────────────┘ │ │   └────────────────────────────┘   │
│ ┌───────────────┐┌───────────────┐ │ │                                    │
│ │C              ││D              │ │ │     ▓ (flame)  On fire ×3          │
│ │      ❦        ││      ✦        │ │ │                                    │
│ │ Majida El R…  ││ Wadih El Safi │ │ │         You're 3rd                 │
│ └───────────────┘└───────────────┘ │ │                                    │
└────────────────────────────────────┘ └────────────────────────────────────┘
```
After a tap: all four tiles fade equally to 30 % (no highlighted choice), a centred "Locked in! 3.2 s" with a small neutral check replaces the time bar, and the chosen shape shows as a 24 px glyph in the top bar until REVEAL (GAME-TRIVIA §8.4).

---

## 8. Tokens to add

**Web** (`web-client/src/styles/tokens.css`): `--world-deep`, `--world-stage-top`, `--world-surface`, `--world-elevated`, `--world-accent`, `--world-accent-text`, `--world-on-accent`, `--world-glow`, `--world-signal`, set by `[data-world="night-market|hakawati-cafe|rooftop|quiz-studio"]` on the root; `--trivia-opt-1..4`. **Compose** (`ui/theme/`): `WorldColors` data class + `LocalWorld` composition local; values generated from `shared/src/worlds/palettes.ts` (created by platform lane A in P; each G lane edits only its world) by `tools/gen-characters` so both sides match (fixture test). The TV design system itself is renamed `Jamaa*` (`JamaaColors`, `JamaaTheme`, `JamaaMotion`…; platform §1.4).

**Motion tokens** (added to DESIGN §6.1, both platforms, in `choreo.ts`):

| Token | Value | Use |
|---|---|---|
| `motion.portal` | 1 100 ms (first open in a session) / 700 ms (repeat) | Bab portal (platform §3.10 A) |
| `motion.entrance` | 2 000 ms (max) | world entrance (platform §3.10 B; server grace 2 500) |
| `motion.entranceCore` | 1 250 ms | darken + world door + title |
| `input.guard` | 400 ms (`INPUT_GUARD_MS`) | input ignored after a transition (platform §3.10 E) |
| `motion.coin` | 450 ms | one coin flight |
| `motion.counter` | 600 ms | counter tick / odometer |
| `motion.reorder` | 400 ms | FLIP |
| `ease.coin` | `cubic-bezier(0.4, -0.15, 0.2, 1)` | coins: a slight wind-up (y1 < 0), then a soft landing |
| `ease.door` | `cubic-bezier(0.6, 0, 0.15, 1)` | door swing, curtain parting |
| `spring.hop` | damping ratio ζ = 0.5, stiffness 500, mass 1, solved analytically by the shared sampler (same curve and settle time on web and TV; platform §3.8) | character hops |
| `spring.bouncy` | the DESIGN §6.1 parameters, solved by the same sampler | landings |

---

## 9. Tests and acceptance (design-owned checks)

- **Contrast:** a unit test (web and TV) computes the WCAG ratios of every world token pair listed in §1.5 and fails below the DESIGN §2.4 thresholds.
- **CVD:** `tools/color-check` (or the unit test) verifies the four Trivia option colours' minimum ΔE00 ≥ 15 under the Machado matrices, and that every player colour on each `world.surface` gets the cream ring when < 3:1.
- **Characters:** fixture equality of geometry (TS ↔ Kotlin, `characters.json`: 12 shapes, 13 expressions, the 12 × 9 face space); a render test at 40 dp asserts the eye height ≥ 2.4 dp for every shape; a snapshot of all 12 × 13 expressions (web) for review; every `REACTIONS` value maps to an expression and a burst.
- **Secrecy:** a test drives each game's projection through all phases and asserts that the character state (expression, prop, look target) for every player is a function of the **public** view only (same output when only secret fields change).
- **Choreography parity:** sampled-progress fixtures (§6.4, springs included) on both sides, against the one sampler both products run; Playwright keyframes for portal, entrance, Bluff reveal, Likely reveal, Trivia reveal.
- **Reduced motion:** e2e with `prefers-reduced-motion: reduce` (and, separately, the Calm animations toggle) asserts no element has a running transform animation longer than 200 ms during the portal and the reveals; TV unit test with `ANIMATOR_DURATION_SCALE = 0` **or** Calm animations on asserts the reduced step lists are used.
- **Remote-only:** e2e drives hub → setup → rules overlay → start → pause → rules → back with D-pad/OK/Back only (EN and AR), checks the initial focus of every screen in §2 and §7 and every focus-graph edge of §2.1 and §2.3, and the input rule: OK ×3 within 300 ms on a poster ends on HUB-03, not PLAYING.
- **Budgets:** `check-size.mjs` (platform rules) and a frame-time check on the reference TV (platform procedure).

## 10. Open questions (defaults chosen; non-blocking)

1. **AR wordmark dot:** the ج dot as the amber head is a strong idea but an unusual treatment of a letter dot; needs a native typographer's look. Fallback: all-cream Arabic wordmark with an amber dot placed after the word.
2. **GSAP licence text** could not be read (gsap.com blocked here); irrelevant to the product surfaces, needed only if `growth/` adopts it.
3. **`SharedTransitionLayout`** on tv-material 1.1.0: nice-to-have for the title morph; the portal is specified without it.
4. **Shilleh** as the internal/marketing name of the character cast: owner approval; it never appears as a UI label in v1.
5. Resolved in this revision (now binding in both files): poster size 210 × 290 dp and the side ticket column with a gathering state; portal 1 100 ms first open / 700 ms after; entrance ≤ 2 000 ms in the order darken → door → title → characters; the 12 × 9 face space; one focus rule (cream ring + `glow.primary`).
