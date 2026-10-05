# DESIGN — Mish Ana! (مش أنا!)

Design system and screen specs for the **Android TV app** (Compose for TV, 10-foot, D-pad) and the **phone web controller** (Preact, portrait, one thumb), in **EN / FR / AR (RTL)**.

This file builds on [PLAN.md](PLAN.md) and [RESEARCH.md](RESEARCH.md). It follows the approved answers: the official win rule is the default, roles are hidden by default with a beginner mode, the name lives in one constant and asset set, production is on `*.workers.dev`, the web client is served by the same Worker, and AR copy is a draft for native review.

**Precedence.** This file governs **visuals, layout, motion and copy tone**. Every identifier, i18n key, enum, colour id, placeholder syntax (`{name}`, `{count}`), error code, setting, timing constant and protocol field comes from [SPEC.md](SPEC.md); where the two differ, SPEC wins. SPEC §0.5 lists the features described here that are out of v1 (they are marked **[not in v1]** below).

**How to read this file**
- Token names (`color.bg`, `space.4`, `type.tv.headline`) are the contract. CSS variables and Kotlin objects use the same names (§13).
- Design tokens are not i18n keys. The i18n `color.*` keys (SPEC §11.2) are only the 12 player colour **names** (`color.coral` … `color.lilac`); `color.bg`, `color.primary` etc. here are visual tokens.
- Screen IDs (`TV-04`, `PH-07`) are stable. Use them in code comments, tests and screenshot file names.
- **Wireframe scale.** TV wireframes show only the **safe area**: 864 × 486 dp, inside the 48 dp side and 27 dp top/bottom margins of the 960 × 540 dp canvas. The frame is 72 characters × 18 lines, so **1 character ≈ 12 dp and 1 line ≈ 27 dp**. Backgrounds always bleed to the full 960 × 540. Phone wireframes are 36 characters wide inside the frame (≈ 360 px, a common small Android width), so 1 character ≈ 10 px.
- Wireframes are drawn **LTR**. §10 says how each one mirrors in Arabic.
- `[ Button ]` is a button. `(•)` is the initial focus on TV. `<…>` is dynamic content. `▓` is an avatar tile.
- Items marked **[verify]** are API names to check against the pinned library sources before compiling. They are not guesses presented as facts.

**Contents:** 1 Brand · 2 Color · 3 Typography · 4 Space and layout · 5 Icons and avatars · 6 Motion, sound, haptics · 7 TV screens (TV-01 to TV-15) · 8 Phone screens (PH-01 to PH-17) · 9 Components · 10 RTL · 11 Accessibility · 12 Microcopy · 13 Implementation notes · 14 Open questions

---

## 1. Brand

### 1.1 Personality

**"A Beirut rooftop at 1 a.m.: everyone's laughing, and everyone's lying a little."**

| Trait | What it means on screen | What it is not |
|---|---|---|
| **Playful** | Bouncy entrances, chunky shapes, copy that teases | Childish or cartoon mascots |
| **Suspicious** | Spotlights, side-eye pauses, slow reveals, a pointing "!" | Horror, blood or skulls. Being eliminated is a laugh, not a death |
| **Lebanese warmth** | Copy that code-switches the way Lebanese groups talk, a doorway-arch avatar, "yalla", hospitality in the lobby ("{name} معنا!") | Folklore clichés: no cedar-flag palette, no tarboush |
| **Nightlife / party** | A deep violet night, neon magenta, sodium-amber streetlight warmth, a glow on focus | Casino or nightclub sleaze, strobe effects |

**Design principles**
1. **The TV is the stage and the phone is the secret.** Nothing secret is ever drawn on the TV. Nothing performative depends on the phone.
2. **Readable from the couch in 1 second.** One idea per TV screen. The biggest element is the thing to do now.
3. **Every phase has a hero moment.** Make the reveals theatrical, and let anyone press OK on the remote to skip them.
4. **Never block the party.** No modal dead ends, timers skip absent players, and every error offers a next step.
5. **Three languages are first-class.** AR is designed in from the start, not translated at the end.

### 1.2 Name, single source
The name must change in **one place** (PLAN §7):

| Asset | Location | Content |
|---|---|---|
| Constants | SPEC §3: `BRAND` in `shared/src/brand.ts`, hand-written `Brand.kt` | Names and values are defined there (`BRAND.name`, `BRAND.nameAr`, `BRAND.slug = "mish-ana"`) |
| i18n keys | `shared/i18n/*.json` (SPEC §11.2) | `brand.appName`, `brand.slogan`, `brand.tagline`; the store line is `extra.storeHook`. Every other string refers to the game as "the game" |
| Vector assets | `/assets/brand/` (owned by agent C, SPEC §0.1; final art is M5) | `wordmark-bilingual.svg`, `wordmark-latin.svg`, `wordmark-ar.svg`, `mark.svg` (icon). Generated: `banner_{en,fr,ar}.png` (320 × 180 px), `ic_launcher` (160 × 160 px xhdpi), `favicon.svg`, `og.png` |

### 1.3 Wordmark: "the shared bang"
**Concept.** The Latin name ends in "!" on the right. The Arabic name, read right to left, ends in "!" on the **left**. Placing the two halves side by side lets them **share one exclamation mark in the middle**: `MISH ANA ! مش أنا`. Each script reads correctly toward the same "!". It is the gesture of the game: everyone points at the middle and says "not me".

**Construction** (artboard `viewBox="0 0 1200 300"`; all text converted to outlines for the final asset)

| Element | Spec |
|---|---|
| Latin half | "MISH ANA" in **Cairo Black (900)**, all caps, cap height 132 units, tracking −10 (−1 %). Right-aligned so its right edge sits at **x = 548**, baseline **y = 210**. Fill `color.text` `#FFF7EC` |
| Arabic half | "مش أنا" in **Cairo Black (900)**. Font size chosen so the alef's top aligns with the Latin cap height (≈ 150 units). Left edge at **x = 652**, baseline **y = 214** (+4 for optical alignment, because the Arabic baseline sits visually higher). Keep the hamza on the alef (أ). Fill `#FFF7EC` |
| The bang (stem) | Rounded rect x = 576, y = 36, w = 48, h = 150, rx = 24, filled **magenta** `#FF3D8B`, then **skewed −8°** around its centre so it leans forward like a pointing finger |
| The bang (dot) | Circle cx = 594, cy = 236, r = 26, filled **amber** `#FFC23D`. The dot is the spotlight, and it is the only amber in the mark |
| Glow (screens only) | The stem gets an outer glow in `#FF3D8B` at 40 % opacity, blur 24 units. Never in print or the banner |
| Clear space | Half the bang height (75 units) on every side |
| Minimum size | 160 dp wide on TV and 140 px on the phone. Below that, use the single-script wordmark |

**Variants**
- `wordmark-latin`: "MISH ANA" + the bang at the right end (stem + dot). Use it on FR/EN-only surfaces such as small phone headers.
- `wordmark-ar`: the bang at the left end, then "مش أنا". Use it for AR-only surfaces.
- `mark` (app icon): a 160 × 160 rounded square in `color.bg`, with a magenta **speech bubble** 112 × 96 whose tail points down-left. Inside it, the cream bang (stem + amber dot), with the same 8° lean. No text, so it works in every locale.
- **Banner** (320 × 180 px, TV-BN requires the name): a `color.bg` → `#2A0F3D` diagonal gradient, the mark at the left 32 px from the edge at 96 px tall, and `wordmark-latin` (EN/FR) or `wordmark-ar` (AR) at 150 px wide, vertically centred. In the AR banner the mark moves to the right.

```svg
<!-- reference skeleton; replace <text> with outlined paths in the shipped asset -->
<svg viewBox="0 0 1200 300" xmlns="http://www.w3.org/2000/svg">
  <text x="548" y="210" text-anchor="end" font-family="Cairo" font-weight="900"
        font-size="184" letter-spacing="-2" fill="#FFF7EC">MISH ANA</text>
  <g transform="translate(600 111) skewX(-8) translate(-600 -111)">
    <rect x="576" y="36" width="48" height="150" rx="24" fill="#FF3D8B"/>
  </g>
  <circle cx="594" cy="236" r="26" fill="#FFC23D"/>
  <text x="652" y="214" direction="rtl" text-anchor="end" font-family="Cairo"
        font-weight="900" font-size="196" fill="#FFF7EC">مش أنا</text>
</svg>
```
(For `direction="rtl"`, `text-anchor="end"` anchors the visual **left** edge at x = 652. Check the result in a browser before outlining.)

### 1.4 Taglines

| Key | EN | FR | AR (Lebanese) |
|---|---|---|---|
| `brand.slogan` (TV splash) | Everyone's innocent. Someone's lying. | Tout le monde est innocent. Quelqu'un ment. | كلّنا أبرياء… بس في حدا عم يكذب. |
| `brand.tagline` | The secret-word party game | Le jeu d'ambiance du mot secret | لعبة الكلمة السرّية للسهرات |
| `extra.storeHook` (store listing only) | Your phone holds the secret. The TV holds the drama. | Ton téléphone garde le secret. La télé fait le show. | السرّ عالتلفون… والدراما عالتلفزيون. |

### 1.5 Voice

| Do | Don't |
|---|---|
| Talk like a friend hosting the night: short, teasing, warm ("Act natural.", "ولا كأنّو صار شي.") | Use system language ("Operation failed", "Invalid input") |
| Address the **group** on the TV (FR *vous*, AR plural) and **one person** on the phone (FR *tu*) | Mix registers on one screen |
| Write AR in light Lebanese colloquial, readable by any Arab: عم، هلّق، بدنا، يلّا، فيك | Use heavy dialect spellings that non-Lebanese can't parse, or stiff MSA ("يرجى الانتظار") |
| **Use gender-neutral phrasing** (see the rule below) | Use gendered imperatives like "Choose (m.)" to address an unknown player |

**Gender-neutral rule (AR and FR).** Arabic imperatives and adjectives are gendered (اكبس/اكبسي, جاهز/جاهزة), and so is French (prêt/prête).
1. **Button labels speak in the first person or to the app**, so they need no gender: "فوّتني" (let me in), "ثبّت صوتي" (lock my vote), "خلصت" (I'm done; written the same for both), "Valider mon vote".
2. **Body copy uses nouns and the possessive "-ك"**, which is written the same for both genders: "دورك!" (your turn), "كلمتك" (your word), "صوتك انحسب" (your vote counted).
3. **Sentences about a named player avoid verbs that agree with the subject**: use "{name} معنا!", not "وصل/وصلت {name}". In French, "{name} quitte la partie", not "est éliminé(e)".
4. The **TV addresses the group in the plural**: "شوفوا تلفوناتكن"; FR *vous*.

---

## 2. Color

Dark-first, and only dark: the TV must be opaque (TV-TR), and party rooms are dim. The phone uses the same palette, so the phone matches the TV and its screen doesn't light up faces, which helps privacy.

### 2.1 Core tokens

| Token | Hex | Use |
|---|---|---|
| `color.bg` | `#120A1F` | App background ("night violet"). Also `color.ink`, the dark text and glyphs placed on bright fills |
| `color.bgGlow` | `#2A0F3D` | Second stop of the background radial gradient (top-centre, 60 % radius) |
| `color.surface` | `#1E1430` | Cards, tiles, panels |
| `color.elevated` | `#2A1D42` | Focused and raised cards, dialogs, sheets |
| `color.overlay` | `#362752` | Menus over content, the input fill on the phone |
| `color.scrim` | `#120A1F` at 80 % | Behind dialogs and the pause menu |
| `color.outline` | `#4A3A66` | Decorative dividers only (2.2:1, not relied on) |
| `color.outlineStrong` | `#8A77AB` | Input borders and unselected radios (**4.43:1** on surface, meets 1.4.11) |
| `color.text` | `#FFF7EC` | Primary text ("warm cream"; pure white glares on TVs) |
| `color.textSecondary` | `#CBBFDD` | Supporting text |
| `color.textMuted` | `#A193B8` | Hints and metadata. Lowest allowed text colour |
| `color.primary` | `#FF3D8B` | "Neon magenta": the brand, primary buttons, the speaker spotlight, the eliminated highlight |
| `color.onPrimary` | `#120A1F` | Text on primary (cream on magenta is only 3.14:1, so it's banned) |
| `color.accent` | `#FFC23D` | "Sodium amber": timers in their last 10 s, points, the room code, the bang dot |
| `color.onAccent` | `#120A1F` | |
| `color.success` | `#3DDC97` | Ready, voted, connected, correct guess |
| `color.danger` | `#FF5A4E` | Last 5 s of a timer, errors, kick, wrong guess |
| `color.focus` | `#FFF7EC` | TV focus ring (3 dp) plus a glow of `color.primary` at 45 % |

### 2.2 Role tokens (always color + emblem + pattern + label)

| Role (key) | EN / FR / AR label | Color | Emblem (silhouette) | Card pattern |
|---|---|---|---|---|
| `civilian` | Civilian / Civil / مدني | `color.civilian` `#5AB8FF` (sky blue) | **House**: pentagon roof on a square, with a door cut-out | Solid fill |
| `undercover` | Mole / Taupe / جاسوس | `color.undercover` `#FF8A3D` (orange) | **Domino mask**: two eye holes | 45° diagonal stripes, 6 dp, 12 % lighter |
| `blank` | Blank / Blanc / فاضي | `color.blank` `#ECE6F5` (paper white) | **Empty card**: a dashed rounded rect with nothing inside | 4 dp dot grid, 10 % darker |
| team (`undercover` + `blank`) | Infiltrators / Infiltrés / المندسّين | Gradient orange → paper at 135° | Mask and empty card overlapping | — |

- **Why blue/orange:** it is the most robust hue pair under every CVD type. Measured CIEDE2000 ΔE between civilian and undercover: normal 49.7, protan 50.9, deutan 55.1, tritan 74.4. The Blank sits apart by lightness (it is near white).
- **Display names vs keys.** Internal keys stay `civilian` / `undercover` / `blank` (PLAN). EN displays **"Mole"** rather than "Undercover", to keep the trademarked word out of screenshots and the store listing (RESEARCH §6). This is decided (Q1 resolved) and adopted in SPEC §11.2 (`role.undercover`, `results.undercoverWord`, `elim.wasUndercover`, `settings.undercoverCount`, `lobby.roleSummary`).

### 2.3 Player colors (12) — paired 1:1 with a shape
These ids, hexes, shapes and glyph colours are the canonical `COLORS` table in SPEC §3 (same order), the i18n keys `color.coral` … `color.lilac`, and Kotlin `Constants.COLORS`. A player is identified by **shape + color + name**. Color is never the only cue. The pairing is fixed, so "Lemon" is always the Star. Pick order (the first free one is the default on join): 1 → 12.

| # | Token | Name (EN · FR · AR) | Hex | Shape | Glyph color | vs `surface` |
|---|---|---|---|---|---|---|
| 1 | `player.coral` | Coral · Corail · مرجاني | `#F0183A` | Circle | ink | 4.09 |
| 2 | `player.azure` | Azure · Azur · أزرق | `#478CFF` | Square | ink | 5.40 |
| 3 | `player.lemon` | Lemon · Citron · ليموني | `#FFF04D` | Star | ink | 14.88 |
| 4 | `player.jade` | Jade · Jade · يشمي | `#1FA88A` | Triangle | ink | 5.87 |
| 5 | `player.grape` | Grape · Raisin · عنبي | `#7A43FF` | Diamond | **cream** | 3.40 |
| 6 | `player.tangerine` | Tangerine · Mandarine · يافاوي | `#FF7A1F` | Hexagon | ink | 6.72 |
| 7 | `player.aqua` | Aqua · Turquoise · تركوازي | `#7BFFF4` | Plus | ink | 14.57 |
| 8 | `player.rose` | Rose · Rose · زهري | `#FF96C5` | Drop | ink | 8.70 |
| 9 | `player.mint` | Mint · Menthe · نعناعي | `#BDF5C8` | Crescent | ink | 14.24 |
| 10 | `player.plum` | Plum · Prune · خوخي | `#C02A8F` | Bolt | **cream** | 3.31 |
| 11 | `player.sand` | Sand · Sable · رملي | `#E6C486` | Flower (quatrefoil) | ink | 10.52 |
| 12 | `player.lilac` | Lilac · Lilas · ليلكي | `#C9BFFF` | Arch (*bab*, doorway) | ink | 10.33 |

**Verification.** Script in §13.4. CVD simulated with Machado et al. 2009 matrices (severity 1.0) applied in linear RGB, then CIEDE2000. Smallest pairwise ΔE00 for each condition:

| Condition | Worst pair | ΔE00 |
|---|---|---|
| Normal vision | mint / aqua | 15.2 |
| Protanopia | lilac / rose | 10.6 |
| Deuteranopia | azure / grape | 10.5 |
| Tritanopia | jade / azure | 10.8 |

ΔE ≥ 10 is clearly distinguishable when the colors sit side by side. Color is still secondary to shape, because 12 colors can never be told apart one at a time under every condition.

**Rules**
- Every player color reaches **≥ 3:1 on `surface`**, which meets WCAG 1.4.11 for graphics. Player colors are **never used for text**. Names are always `color.text`.
- Plum (3.31) and grape (3.40) drop below 3:1 on `elevated`. On elevated backgrounds, tiles get a 2 dp `color.text` ring at 24 % opacity.
- The avatar glyph is `ink` on light colors and `cream` on grape and plum (cream on grape is 4.85:1 and on plum 4.98:1).
- The AR color names are draft, colloquial-friendly adjectives. "يافاوي" (Jaffa orange) and "خوخي" are Levantine; native review is needed.

### 2.4 Contrast ratios (WCAG 2.x, computed)

| Foreground → background | `bg` | `surface` | `elevated` | `overlay` | Allowed for |
|---|---|---|---|---|---|
| `text` #FFF7EC | **18.15** | 16.50 | 14.61 | 12.60 | all text |
| `textSecondary` #CBBFDD | 11.05 | 10.05 | 8.90 | 7.67 | all text |
| `textMuted` #A193B8 | 6.78 | 6.16 | 5.46 | 4.70 | all text (AA at every level) |
| `primary` #FF3D8B | 5.78 | 5.25 | 4.65 | 4.01* | text ≥ 18.66 px bold / 24 px on overlay; any size on bg/surface/elevated |
| `accent` #FFC23D | 11.97 | 10.88 | 9.64 | 8.31 | all text (timers, code) |
| `success` #3DDC97 | 10.91 | 9.92 | 8.78 | 7.57 | all text |
| `danger` #FF5A4E | 6.27 | 5.70 | 5.04 | 4.35* | *large text only on overlay |
| `civilian` #5AB8FF | 8.94 | 8.13 | 7.20 | 6.20 | all text |
| `undercover` #FF8A3D | 8.22 | 7.48 | 6.62 | 5.71 | all text |
| `blank` #ECE6F5 | 15.80 | 14.36 | 12.72 | 10.97 | all text |

| Text on a fill | Ratio | Verdict |
|---|---|---|
| `ink` on `primary` | **5.78** | ✅ the primary button label |
| `ink` on `accent` / `success` / `danger` | 11.97 / 10.91 / 6.27 | ✅ |
| `ink` on `civilian` / `undercover` / `blank` | 8.94 / 8.22 / 15.80 | ✅ role card text is ink |
| `text` (cream) on `primary` | 3.14 | ❌ never |
| `text` on `danger` | 2.90 | ❌ never; use ink |
| `focus` ring vs `bg` | 18.15 | ✅ |

---

## 3. Typography

### 3.1 Families
| Role | Family | Why |
|---|---|---|
| **Everything, all three scripts** | **Cairo** (OFL; Mohamed Gaber), static instances **Regular 400, SemiBold 600, Bold 700, Black 900** | Cairo extends Titillium Web's Latin with a matching Arabic, so FR/EN/AR share one rhythm and weight logic on the same screen (names are mixed-script). Its open, low-contrast Kufi-like forms survive TV scaling and 3 m viewing better than calligraphic Naskh. The Black weight gives the logo and room code real punch. One family means one fallback chain and a smaller APK |
| Fallback | **Noto Sans Arabic** (OFL) on web. On Android, the system fallback (Noto on Google TV) | Covers rare glyphs and diacritics that a subset might drop |
| Numerals and the room code | Cairo with `tnum` (tabular figures) **[verify Cairo has `tnum`; if not, set fixed-width boxes per digit]** | Timers must not jitter |
| Not used | Thin or Light weights, italics (Arabic has no italic), condensed widths | Unreadable at 10 ft |

- **Web loading:** self-host two **woff2 subsets** per weight, `cairo-latin` (Basic Latin + Latin-1 + Œœ ’ « » … – — NBSP U+202F) and `cairo-arabic` (U+0600–06FF, U+FE70–FEFF subset, U+200C–200F), each with `unicode-range` and `font-display: swap`. Load **600, 700 and 900** (the 700 tokens, e.g. `tv.headline`, `ph.h2`, labels, need the real Bold: without it the browser renders them Black and the browser TV no longer matches the native app); 400 falls back to 600, because the UI doesn't use regular weight. Budget: ≤ 90 KB for all font files (six files ≈ 77 KB) (fonts are outside the 60 KB JS budget in PLAN M2).
- **Android:** `res/font/cairo_{regular,semibold,bold,black}.ttf` as static instances cut from the variable font with `fonttools varLib.instancer`. Static instances keep weight selection trivial (`Font(resId, FontWeight)`) and avoid variable-axis handling on minSdk 26 devices.

### 3.2 TV type scale (sp; designed on the 960 × 540 dp canvas; viewed at 2.5–3.5 m)

Minimum readable size is **20 sp** (≈ 40 px on a 1080p panel). Every TV text, captions included, is ≥ 20 sp: `type.tv.caption` was raised from 16 / 22 to **20 / 26** after the 10-foot review (16 sp captions — the top bar's "N alive", the clue rule line, scoreboard headers, the pause note — were too small from the couch). Caption stays distinct from `body` by its tighter line height, muted colour and placement, not by size.

| Token | Size / line height (Latin) | Line height (AR) | Weight | Tracking | Used for |
|---|---|---|---|---|---|
| `type.tv.code` | 88 / 96 | — (always Latin) | 900 | +8 % | Room code `KXQP` |
| `type.tv.displayL` | 72 / 80 | 96 | 900 | −1 % | "It's a tie!", winner banner, the revealed words |
| `type.tv.displayM` | 56 / 64 | 80 | 900 | −1 % | Speaker name in spotlight, "{name} is out!" |
| `type.tv.displayS` | 44 / 52 | 64 | 700 | 0 | Phase titles ("Who's not one of us?") |
| `type.tv.headline` | 34 / 42 | 52 | 700 | 0 | Screen titles, dialog titles |
| `type.tv.title` | 26 / 32 | 40 | 700 | 0 | Tile names (lobby/vote), card titles |
| `type.tv.titleS` | 22 / 28 | 34 | 600 | 0 | Settings row labels, list items |
| `type.tv.body` | 20 / 28 | 34 | 600 | 0 | Instructions, descriptions |
| `type.tv.label` | 20 / 24 | 30 | 700 | +2 % (Latin only) | Buttons (`labelLarge`) |
| `type.tv.caption` | 20 / 26 | 30 | 600 | +1 % (Latin only) | Badges, hints, footers, the top bar's "N alive", table headers |
| `type.tv.timer` | 40 / 44 | — | 900, `tnum` | 0 | Timer numerals |

Body text uses weight 600, not 400: at 10 ft, regular Cairo strokes break up on cheap panels.

### 3.3 Phone type scale (root 16 px; `rem`, so the browser text size applies)

| Token | rem / px | Line height LTR / AR | Weight | Used for |
|---|---|---|---|---|
| `type.ph.word` | `clamp(2.5rem, 13vw, 4rem)` | 1.1 / 1.4 | 900 | The secret word on the reveal card |
| `type.ph.display` | 2.25rem / 36 | 1.1 / 1.35 | 900 | "Your turn!", win/lose headline |
| `type.ph.h1` | 1.625rem / 26 | 1.2 / 1.5 | 900 | Screen titles |
| `type.ph.h2` | 1.25rem / 20 | 1.3 / 1.55 | 700 | Section titles, list names |
| `type.ph.body` | 1.0625rem / 17 | 1.45 / 1.7 | 600 | Body |
| `type.ph.button` | 1.1875rem / 19 | 1.2 / 1.4 | 900 | Buttons |
| `type.ph.input` | 1.25rem / 20 | 1.3 / 1.5 | 700 | Inputs (≥ 16 px, so iOS doesn't zoom) |
| `type.ph.small` | 0.875rem / 14 | 1.4 / 1.6 | 600 | Hints and metadata (the floor) |
| `type.ph.code` | 2rem / 32 | 1 | 900 + `tnum`, tracking 0.12em | Room-code entry |

### 3.4 Arabic adjustments (both platforms)
- **Line height +20–30 %** (the AR columns above). Arabic has tall ascenders (ل ا ك) and deep descenders (ي ع), and dots and hamza stack. Cairo's metrics are already generous, so **don't add font padding** on Android: keep Compose's default (no font padding since Compose 1.5) and set explicit line heights.
- **Never apply letter-spacing** to Arabic: it breaks the joins. Tracking tokens apply only when `script == Latn`.
- **No uppercase transforms** in Arabic, and none on mixed strings. Latin uppercase is used only in the wordmark and the room code.
- **Optical size:** for the same sp, Arabic in Cairo reads about 8 % smaller. AR uses the same tokens, but `displayM` and larger get a ×1.08 factor (`type.arScaleDisplay`).
- **Tashkeel** (diacritics) are used only where meaning needs them (e.g. "صوّت", "كلّنا"). Keep the shadda. Avoid full vocalisation; it clutters.
- **Mixed strings** such as `{name}` inside AR copy are wrapped in `<bdi>` on the web and with `BidiFormatter.unicodeWrap` (or FSI…PDI) on Android, so "Rami!" doesn't get its "!" on the wrong side.

### 3.5 Numbers and codes
- **Western digits (0–9) in all locales** (RESEARCH §5): `Intl.NumberFormat(locale, {numberingSystem:'latn'})`. On Android, format with `Locale("ar", "LB")` but force `latn` digits: `NumberFormat.getInstance(Locale.forLanguageTag("ar-LB-u-nu-latn"))`.
- The **room code is always LTR**, Latin uppercase, and isolated (`dir="ltr"` / LRI…PDI). It is spaced in two pairs for reading aloud: **KX QP**. TV shows it as `K X Q P` with a 0.08 em gap.
- Timers show **seconds only** under 100 (`27`), never `0:27`.

---

## 4. Space, layout, shape, elevation

### 4.1 Spacing (4-pt base; dp on TV, px on the phone)
`space.0=0 · 1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 7=32 · 8=40 · 9=48 · 10=64 · 11=80 · 12=96`

### 4.2 TV layout
- **Canvas** 960 × 540 dp. **Safe area: 48 dp sides, 27 dp top/bottom → live area 864 × 486 dp** (x 48–912, y 27–513). Nothing interactive or textual goes outside it. Backgrounds, glows and particles bleed to the edges.
- **Content grid:** 12 columns × 52 dp, 20 dp gutters = **844 dp**, centred (58 dp margins, the Google TV recommendation). Status chips and corner badges may extend out to the 48 dp safe line.
- **Rows:** top bar y 27–75 (48 dp); stage y 87–447; bottom action bar y 459–513 (54 dp, button height 48 dp).
- **Focus breathing room:** every focusable element has ≥ 12 dp of clear space around it, because focus scales it to 1.06 and adds a 3 dp ring and an 18 dp glow.

### 4.3 Phone layout
- Single column, `max-width: 480px`, centred on tablets. Side padding `space.5` (20 px) plus `env(safe-area-inset-*)`.
- **Thumb zone:** the primary action is **always anchored to the bottom**, full width, **64 px tall**, `space.5` above the bottom safe area. Secondary actions sit above it (48 px tall) or in the top bar. Nothing destructive goes in the bottom 25 % unless it has a confirm step.
- **Top bar** (56 px): room code chip (start side) · your avatar + name (centre) · menu "⋯" (end side, `phone.menu`): language, vibration, leave.
- Height: `min-height: 100dvh`. Content scrolls; the action bar is `position: sticky; bottom: 0`.
- Minimum touch target **48 × 48 px**, with ≥ 8 px between targets.

### 4.4 Radii
`radius.xs=6 · sm=10 · md=16 · lg=24 · xl=32 · pill=999`. Buttons use `pill`. Tiles and cards use `lg` on TV and `md` on the phone. The role card uses `xl`. QR panel: `lg` outer and `sm` inner.

### 4.5 Elevation (dark UI = tone + glow, not shadow)
| Level | Fill | Extra | Used for |
|---|---|---|---|
| `elev.0` | `bg` + radial `bgGlow` | — | Screen |
| `elev.1` | `surface` | 1 dp inner top highlight in `text` at 6 % | Tiles, panels |
| `elev.2` | `elevated` | Shadow 0 8 24 #000 at 40 % | Focused tiles, sheets, dialogs |
| `elev.3` | `overlay` | Shadow 0 16 48 #000 at 55 % + `scrim` behind | Pause menu, phone overlays |
| `glow.primary` | — | Outer glow in `primary` at 45 %, blur 18 dp | TV focus, speaker spotlight |
| `glow.accent` | — | Outer glow in `accent` at 40 %, blur 24 dp | Winner, points |

### 4.6 Interaction states
**TV focus (the one focus style, everywhere):** scale **1.06** (tiles) or **1.04** (buttons and rows), a 3 dp `color.focus` ring offset 2 dp outside, `glow.primary`, and the fill lifts to `elevated`. Takes `motion.fast` with `ease.standard`. Unfocused focusables sit at 100 % scale with no ring. Disabled: 40 % opacity, still focusable *only* if it explains why it's disabled (e.g. Start shows "Need 3 players").

Compose for TV: use `androidx.tv.material3` `Surface` / `Button` / `Card` with `ClickableSurfaceDefaults.scale(focusedScale = 1.06f)`, `border(focusedBorder = Border(BorderStroke(3.dp, MishColors.Focus), inset = (-2).dp))` and `glow(focusedGlow = Glow(MishColors.Primary.copy(alpha = .45f), 18.dp))` **[verify these parameter names against tv-material 1.1.0]**.

**Phone press:** scale 0.97 plus a 6 % brightness drop on `:active`, taking 80 ms. `:focus-visible` shows a 3 px `color.focus` outline offset 3 px (keyboard and switch users). Selected rows get a 2 px `primary` border plus a check icon. Selection is never shown by color alone.

---

## 5. Iconography, avatars, emblems

### 5.1 Icon style
24 × 24 grid, **2 px stroke, round caps and joins**, 2 px padding, `currentColor`. Shipped as inline SVG on the web (a `<Icon name>` component, tree-shaken) and as Compose `ImageVector`s generated from the same SVGs (`tools/icons-to-kotlin`). On TV, icons render at 32 dp (inside buttons) or 24 dp (badges).

| Name | Glyph | Mirrors in RTL |
|---|---|---|
| `play` | Rounded triangle pointing to the inline end | **no** (media convention) |
| `pause` | Two bars | no |
| `settings` | 6-tooth gear | no |
| `users` | Two heads | no |
| `user-plus` | Head + plus | no |
| `user-x` (kick) | Head + × | no |
| `crown` (host/VIP) | 3-point crown | no |
| `gem` (Premium; PAYMENTS-SPEC §4.4) | Cut gemstone outline (table facet on top, pointed base), same 2 px stroke | no |
| `check` | Tick | no |
| `x` | Cross | no |
| `timer` | Stopwatch | no |
| `eye` / `eye-off` | Eye / eye with slash | no |
| `hand-press` | Fingertip on a dot with 2 ripple arcs | no |
| `speech` | Speech bubble (the brand bubble) | **yes** (tail side) |
| `vote` | Hand pointing at a dot (the accusing finger) | **yes** |
| `arrow-forward` / `arrow-back` / `chevron-*` | — | **yes** |
| `refresh` | Circular arrow | no (clock-wise is universal) |
| `wifi-off` | Wi-Fi arcs with slash | no |
| `lock` | Padlock | no |
| `globe` | Globe (language) | no |
| `volume` / `volume-off` | Speaker / speaker with × | **yes** |
| `vibrate` | Phone with side ticks | no |
| `trophy` | Cup | no |
| `qr` | 3 finder squares | no |
| `tv` / `phone` | Device outlines | no |
| `door-out` (leave / eliminated) | Open door + arrow | **yes** |
| `dice` (random / wheel) | Die face, 5 pips | no |
| `info` / `help` | i / ? in circle | no (the "?" is never mirrored) |

### 5.2 Player avatars (emoji-free, geometric)
**Form:** a squircle tile (`radius.lg` scaled 30 %) filled with the player color, holding the player's **shape glyph** centred at 62 % of the tile size, in the glyph color from §2.3. Sizes: TV 120 (lobby/vote), 160 (spotlight), 48 (order strip), 32 (vote chips); phone 56 (lists), 96 (own header on reveal), 28 (top bar).

**Why a glyph and not an initial:** Arabic initials are ambiguous (the same letter has different forms, and many names start with ا or م), and initials collide in groups (three "M"s). The shape is unique by construction. The **name is always shown next to the avatar**.

Reference geometry (24 × 24 viewBox, filled, no stroke; tune visually in the vector tool):

| Shape | SVG |
|---|---|
| Circle | `<circle cx="12" cy="12" r="9"/>` |
| Square | `<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/>` |
| Star | `<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/>` |
| Triangle | `<path d="M12 3.2 21.4 19.8H2.6z" stroke-linejoin="round"/>` |
| Diamond | `<path d="M12 2.2 21.8 12 12 21.8 2.2 12z"/>` |
| Hexagon | `<path d="M12 2.6 20.2 7.3v9.4L12 21.4 3.8 16.7V7.3z"/>` |
| Plus | `<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>` |
| Drop | `<path d="M12 2.5S5 10.4 5 15a7 7 0 0 0 14 0c0-4.6-7-12.5-7-12.5z"/>` |
| Crescent | `<path d="M15 2.7a9.5 9.5 0 1 0 6.3 13.6A7.6 7.6 0 0 1 15 2.7z"/>` |
| Bolt | `<path d="M13.5 2 5 13.5h6L10 22l9-12h-6.2z"/>` |
| Flower | Four circles r = 4.6 at (12, 7.4), (16.6, 12), (12, 16.6), (7.4, 12) + a centre circle r = 4 |
| Arch (*bab*) | `<path d="M5 21.5V11a7 7 0 0 1 14 0v10.5h-4.5V15a2.5 2.5 0 0 0-5 0v6.5z"/>` (a doorway arch, a nod to the Lebanese triple-arch house) |

**Avatar states** (identical on TV and phone)

| State | Treatment |
|---|---|
| Connected | As above |
| Away (disconnected) | Tile desaturated 80 %, 60 % opacity. A `wifi-off` badge (24 dp, `danger` disc, ink icon) at the top-end corner. **Static** (no countdown ring: SPEC does not project `disconnectedAt`) |
| Ready / Voted | `check` badge (`success` disc, ink icon) at the top-end corner. Pops in with `ease.overshoot`. **Away wins over ready**: a disconnected player shows `wifi-off`, never `check` (SPEC START marks away players ready) |
| Speaking | `glow.primary` + 4 dp `primary` ring + gentle 1.0↔1.03 breathing (1.6 s) |
| Eliminated | Grayscale, 45 % opacity, the role emblem (§5.3) as a 32 dp badge at the bottom-end. **No strikethrough** (a line through Arabic names crosses the joins and dots) |
| Left (forfeited, `left:true`) | As eliminated (the role emblem is shown: a forfeit reveals the role), plus a `door-out` badge at the top-end corner |
| Host (VIP) | `crown` badge (accent disc) at the top-start corner |

Every corner badge has a **2 dp `color.bg` ring** so it separates from any tile colour (a `danger` disc on a coral tile would otherwise merge under protan/deutan).

### 5.3 Role emblems
On the elimination card and in results, each role appears as **emblem silhouette + role color + card pattern + text label** (§2.2), so the role survives grayscale, CVD and small sizes. Emblems use a 48-grid, filled:
- **House** (civilian): a pentagon `M24 6 42 20v22H6V20z` with a door cut-out `M19 42V30h10v12`.
- **Domino mask** (mole): a wide rounded bowtie shape with two almond eye holes.
- **Empty card** (blank): a rounded rect 30 × 38 with a **3 dp dashed stroke** (dash 6, gap 5) and **no fill**. The emptiness is the point.

---

## 6. Motion, sound, haptics

### 6.1 Tokens
| Token | Value | Use |
|---|---|---|
| `motion.instant` | 80 ms | Press feedback, badge swaps |
| `motion.fast` | 150 ms | Focus, hover, toggles |
| `motion.base` | 240 ms | Enter/exit of tiles, sheets, toasts |
| `motion.slow` | 400 ms | Screen (phase) transitions |
| `motion.dramatic` | 800 ms | Card flips, stamp-ins |
| `motion.hold` | 1200 ms | Suspense pause before a reveal |
| `ease.standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default |
| `ease.decel` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Things arriving |
| `ease.accel` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Things leaving |
| `ease.overshoot` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Pops: join, badges, stamps |
| `spring.bouncy` (Compose) | `spring(dampingRatio = 0.55f, stiffness = Spring.StiffnessMediumLow)` | Join pop, vote chips landing |

In Compose, cubic-bezier tokens become `CubicBezierEasing(a, b, c, d)` used with `tween(durationMillis, easing = …)`.

**Phase transition (default, every phase change):** the old stage fades out and scales to 0.98 (`motion.base`, `ease.accel`). Then the new stage rises 24 dp and fades in (`motion.slow`, `ease.decel`). The top bar never moves, which anchors the eye. On the phone the same transition is 16 px.

**TV skip rule:** during any reveal sequence, pressing **OK** on the remote jumps to the end state. Back opens the pause menu (TV-12). The server never waits on animations: the TV plays them locally against the snapshot it received.

### 6.2 Signature moments

**A. Role reveal, hold-to-peek (phone, PH-04)**
| t | What happens |
|---|---|
| 0 | A face-down card (player color at 18 % over `surface`, a diagonal pattern of tiny bang marks, "Hold to see your word" + `hand-press` icon pulsing every 2 s) |
| press 0–150 ms | Nothing visual except the press scale 0.97. **The 150 ms threshold** keeps a palm or a scroll from flashing the word |
| 150 ms | A haptic tick (10 ms). The card **flips on its Y axis** (`motion.base`, `ease.decel`, `perspective: 800px`) to show the face: the word in `type.ph.word`, on the player color for light colors and `elevated` for grape/plum |
| while held | A face, no timer. A small "Release to hide" caption |
| release | **Instant hide** (≤ 80 ms; the flip back plays at 2× speed). The first time, the card face says "That's your word. Don't show anyone." and the "Got it" button appears below |
| Blank | The face is the **empty-card emblem** with "No word for you" + "Listen. Blend in. Bluff." The card face is `blank` paper white with the dot pattern |
| Beginner mode | Below the word, a role chip (emblem + label), e.g. "You're a **Civilian**" |

**Timing budget (binding).** The server does not wait for animations. ELIMINATION lasts `ELIMINATION_HOLD_MS` = 8 s (SPEC §3), and both B and C below must fit inside it: **B ≤ 3 s + C ≤ 4.5 s, leaving ≥ 0.5 s**. Every countdown on screen ("Next round in {count}…") is computed from `deadline.at − serverNow`, never from local constants. Reduced motion halves both.

**B. Vote reveal (TV, TV-07), the centrepiece.** It totals **≤ 3 s** and is skippable.
1. **Lock (0–300 ms):** the voting board darkens to `scrim` at 50 %, the "votes in" stamp drops (`ease.overshoot`) and the drumroll sound starts.
2. **Arrows (300 ms → ≤ 1.8 s; per-voter delay = 1.5 s / voters):** in seat order, a 32 dp chip of the voter's avatar leaves the voter's tile and flies along a **quadratic Bézier** (control point 90 dp above the chord midpoint, or below it when both tiles are in the bottom row) to the target tile. It leaves a 3 dp trail in the voter's color that fades over 600 ms. Chips fan into a stack above the target, offset 10 dp each. Abstentions (away or timed out) fly to a small "No vote" bin at the bottom-end corner.
3. **Tally (overlaps step 2):** each target shows a rolling count badge (`type.tv.title`, `accent` disc, ink digits). The digits roll up over 200 ms with a tick sound per increment.
4. **Suspense (600 ms):** every tile except the top-voted dims to 35 %. The drumroll peaks.
5. **Verdict (400 ms stamp):** the top tile scales to 1.15 with `glow.primary` and a stamp ("OUT" / "DEHORS" / "برّا") lands at −8°. → TV-09 (elimination). For a first tie the same sequence plays as a ≤ 2.5 s overlay at the start of TIE_BREAK (TV-08).
- The arrows come from `lastVote.tally[].voterIds` (public once the vote closes); abstentions from `lastVote.abstainIds`.

**C. Elimination card flip (TV, TV-09)**, **≤ 4.5 s** in total:
1. The eliminated player's tile flies to the centre and grows to a 280 × 380 dp card (400 ms, `ease.decel`). Their name is displayed beneath ("Rami is out!").
2. Hold for 600 ms; a heartbeat sound plays twice.
3. **Card flip on the Y axis (800 ms)**: the back face (the player color with the shape glyph) turns to the **role face**: role color fill + pattern + emblem (120 dp) + role label in `displayM` ink.
4. A **color wash**: a radial burst in the role color at 30 % opacity spreads from the card to the screen edges over 600 ms (overlapping the reaction), then settles to 8 %.
5. A one-line reaction appears (`elim.reactionCivilian` / `elim.reactionUndercover` / `elim.reactionBlank`, or `elim.reactionBlankNoGuess` when `!settings.blankGuess`). The remaining time shows "Next round in {count}…" from the deadline.

**D. Blank guess suspense (TV, TV-10)**
- The room light drops: the background darkens to `#07040D` and a single soft spotlight (radial, 340 dp) falls on the Blank's avatar, which wears a dashed `blank` ring.
- A big timer ring (220 dp, 8 dp stroke) depletes **clockwise**, with a heartbeat sound every 2 s for the last 10 s and every 1 s for the last 5 s.
- **[not in v1]** A "typing…" indicator. The TV shows the static line `guess.guessing` instead.
- **Verdict, correct:** a flash to white at 25 % (100 ms, then 400 ms decay; *no strobe*). Confetti in paper white and amber for 1.6 s. "The Blank nailed it!" Then → Results when the VERDICT deadline (8 s) ends.
- **Verdict, wrong:** the card shakes horizontally (3 cycles of ±12 dp in 360 ms). A soft buzzer. "Wrong! The game goes on." The light comes back over 600 ms.
- **Verdict, timeout:** no shake; "Time's up! No guess." (`guess.timeout`); the light comes back.

**E. Victory (TV, TV-11)**
- **Civilians win:** a sky-blue wash, and house emblems float up as particles (12, slow, 3 s).
- **Infiltrators win:** an orange → paper gradient wash, and masks *peek* in from the screen edges and wink (a 200 ms scaleY to 0.1 and back on the eye holes).
- **Blank wins:** an empty card spins in and then **fills with the guessed word** (from `result.guesses`, public in RESULTS).
- Then **both words slide in** from opposite sides and meet in the middle: Civilian word | Mole word (the "aha" moment). Then the scoreboard rows stagger in at 60 ms each, with points counting up.

**F. Small delights**
- **Lobby join:** a new tile **drops in** from above its slot with `spring.bouncy`, plus a "pop" sound and a 600 ms ring burst in the player's color. The name types on letter by letter in Latin; Arabic names fade in, because letter-by-letter breaks the joins.
- **Your turn (phone):** the whole screen floods with your player color from the bottom (`motion.slow`), plus a haptic pattern.
- **Speaker change (TV):** the spotlight cone **slides** to the next avatar on the order strip, then the hero swaps.

### 6.3 Reduced motion
**Triggers:** web `@media (prefers-reduced-motion: reduce)`. On TV, `Settings.Global.ANIMATOR_DURATION_SCALE == 0f` (read with `Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)`). The in-app **Reduce motion** setting is **[not in v1]**.

| Moment | Reduced version |
|---|---|
| Phase transitions | A 150 ms cross-fade, no movement |
| Card flips (role, elimination) | A cross-fade between faces (200 ms). The role color wash is static |
| Vote arrows | **No flying chips.** Voter mini-avatars appear directly in each target's stack (all at once, 200 ms fade), then the tallies show final numbers (no rolling) |
| Shakes, breathing, confetti, particles | Removed. Use a static icon plus the text verdict |
| Spotlight / dimming | Kept (it's not movement), but the change is instant |
| Timers | The ring still depletes (it's information), but without the pulse |

Reduced motion also halves the total reveal time, so the game moves faster.

### 6.4 Sound cues (TV only. Volume and phone sounds are **[not in v1]**; one global mute is in)
All cues: **OGG Vorbis, 48 kHz, mono, ≤ 1.5 s** (stings ≤ 3 s; the drumroll and the wheel span their animation, ≤ 2.5 s), normalised to **−16 LUFS** integrated with peaks ≤ −1 dBTP. **Implemented** as original synthesis (no samples, nothing to license): `tools/gen-sounds` renders every cue deterministically (`pnpm gen:sounds`, ffmpeg/libvorbis), < 400 KB in total. Pitch-shifted cues (`sfx.join` by seat, `sfx.turn`, `sfx.chipLand`) use the playback rate, within SoundPool's 0.5–2×. Remote feedback cues: `ui.move` (focus moved by the D-pad; very quiet, ≥ 70 ms apart), `ui.select` (OK), `ui.back` (Back). The `/tv` mock unlocks Web Audio on the first key press; reduced motion is not a mute. Played through `SoundPool` on TV and Web Audio on the phone (preloaded after the first tap). Two volume buses: **SFX** and **Stingers**. Global mute is in Settings and the pause menu; on the phone it's in the "⋯" menu.

| ID | When | Character |
|---|---|---|
| `sfx.join` | Player joins | Bubbly "pop" + rising pluck, pitch shifted by seat (12 notes of a pentatonic scale, so a full lobby plays a chord) |
| `sfx.leave` | Player leaves or is kicked | A descending pluck |
| `sfx.ready` | A player taps "Got it" | A soft wooden tick |
| `sfx.allReady` | Everyone is ready | A short 3-note rise |
| `sfx.turn` | A speaker starts | Finger-snap + bell, a different pitch each turn |
| `sfx.tick` | Last 5 s of any timer, once per second | A dry clock tick; the last one is higher |
| `sfx.timeUp` | A timer hits 0 | A muted horn |
| `sfx.voteCast` | Each vote received (no identity) | A paper "flick" |
| `sfx.drumroll` | Vote reveal steps 1–4 | A snare roll building to a cymbal choke |
| `sfx.chipLand` | Each vote chip lands | A marimba tick, rising with the tally |
| `sfx.stamp` | OUT stamp, TIE stamp | A rubber-stamp thud |
| `sfx.flip` | Card flip | A card swish |
| `sting.civilian` / `sting.mole` / `sting.blank` | Role revealed | Civilian: a "aww" brass wah (sympathetic). Mole: a sly pizzicato "gotcha". Blank: a bowed glassy "ooh" |
| `sfx.heartbeat` | Blank guess, tie wheel | A low double-thump |
| `sfx.wheel` | Tie wheel spin | Ratchet clicks slowing with the wheel |
| `sting.correct` | Blank guesses right | A gasp + crash cymbal |
| `sting.wrong` | Blank guesses wrong | A soft "bwomp" (cartoon, not harsh) |
| `sting.winCivilians` / `sting.winInfiltrators` | Results | 3 s: a darbuka groove + brass hit / a sly bass + finger snaps. A **darbuka** motif is the Lebanese signature across the stings |
| `sfx.error` | Rejected action | A low two-tone |

### 6.5 Haptics (phone; Android Chrome `navigator.vibrate`; silently skipped on iOS)
Haptics come only from user gestures or right after one, as the API requires (RESEARCH §2.2). Pair each with a visual cue. There is a toggle in the "⋯" menu.

| Moment | Pattern (ms) |
|---|---|
| Hold reveal crosses 150 ms | `10` |
| Your turn starts | `[30, 60, 30]` |
| Next up (one turn before yours) | `15` |
| Vote locked | `20` |
| You were eliminated | `[80, 40, 80]` |
| Guess submitted | `20` |
| Win | `[20, 40, 20, 40, 60]` |
| Error | `[40, 30, 40]` |

**"Your turn" when the phone is idle.** Chrome allows `vibrate()` only after the page has had a user gesture (sticky activation). The Join tap provides it, so later turn alerts can vibrate while the page is visible. Wake lock (RESEARCH §4) keeps the screen on. The "Your turn" flood on the phone plus `sfx.turn` on the TV is the primary cue, and the vibration is a bonus.

---

## 7. TV screens (Compose for TV, D-pad)

**Global TV rules**
- **Exactly one focus style** (§4.6). Something is always focused.
- **In-game action pill (SPEC §9.6).** Every in-game screen (TV-04 to TV-10) has **one ghost pill** in the bottom-end action bar ("Start now", "Skip turn", "Close vote", "Continue", "Skip"), at 60 % opacity until focused. It holds the initial focus. The **first OK arms it**: the label becomes "Press OK again to confirm" (`tv.pressAgain`) for 3 s. A **second OK within 3 s** sends `HOST_ADVANCE`. On a reveal animation, the first OK jumps the animation to its end state locally; after that the pill logic applies. There are no hidden focus targets and no other host gestures.
- **Lost focus.** When the focused node leaves composition (a kicked tile, an expired verdict button), focus moves to the screen's default target (Start, the action pill, or Resume).
- **Back** follows TV-DB. **Lobby (TV-02) is the root: Back exits the app immediately, with no confirmation.** Home (TV-01) is only a splash. **During a game and on Results, Back opens the pause menu (TV-12)** and never exits silently. Back inside a dialog or menu closes it.
- **No Menu-key dependency** (TV-DM). Every action is reachable with the 5-way D-pad.
- **Top bar** (y 27–75 dp) on every in-game screen: start side shows "GAME {count}" during ROLE_REVEAL (`game.label`; `round` is 0 there) and "ROUND {count} · <phase>" afterwards (`round.label` + `phase.*`). End side shows a mini room code `KXQP`, the alive count (`common.aliveCount`), and a `wifi-off` chip when the TV's socket is degraded.
- **Long names** are truncated with an ellipsis at 12 graphemes on tiles and 20 in the spotlight. The TV-05 order strip uses **width-only** truncation (one ellipsis at the item's text width, no grapheme pre-cut), so a name is never cut twice ("Nour …"). Names come from players, so render them with `TextOverflow.Ellipsis` and `maxLines = 1`.
- **The TV never shows secrets.** No word or role of a living player, and no Blank guess text, ever appears before RESULTS (SPEC §5.4).

### TV-01 Home / splash
**Enters:** app launch. The app creates a room automatically (`POST /api/rooms` in the app language); Home is shown only while that runs or after it fails. There are no menu buttons (SPEC §9.6); How to play is M4 **[not in v1]**, and language lives in the Lobby.

```text
+------------------------------------------------------------------------+
|                                                                        |
|  <mark 48dp>                                                           |
|                                                                        |
|                                                                        |
|                    <wordmark-bilingual, 560dp wide>                    |
|                      MISH ANA  !  <arabic half>                        |
|                                                                        |
|                                                                        |
|                Everyone's innocent. Someone's lying.     (body, muted) |
|                                                                        |
|                                                                        |
|                     (spinner)  Opening the room...                     |
|                                                                        |
|           on failure: "Couldn't create a room." (• Try again)          |
|                                                                        |
|                                                                        |
|                                                                        |
|     3-12 players  -  Phones join with a QR code  -  FR / EN / AR       |
+------------------------------------------------------------------------+
```
- Splash ≤ 800 ms: the bang draws in and the dot drops with `ease.overshoot`, then the spinner with `tv.creatingRoom`.
- Background: `bg` with a slow drifting `bgGlow` (30 s loop; static in reduced motion), plus a faint pattern of tiny bang marks at 4 % opacity.
- **Failure (13d):** `tv.createFailed` plus a muted line with the error code, and **(• Try again)** (`common.retry`) focused; OK retries. **Back: exit the app.**
- The footer line is static brand copy (`brand.tagline` may replace it).

### TV-02 Lobby
**Enters:** after the room is created (the root screen). **Leaves:** to TV-04 on START (from the TV or the VIP phone).

```text
+------------------------------------------------------------------------+
| <wordmark-latin 160dp>                     Lebanese Kitchen - AR words |
|   SCAN TO JOIN                             1 Mole - 1 Blank - Official |
| +------------------+          PLAYERS 5/12          Need 1 more player |
| | ## # ### #  ## # |       +--------+ +--------+ +--------+ +--------+ |
| | # #  QR  CODE  # |       |  [O]   | |  [#]   | |  [*]   | |  [^]   | |
| | ### #  240dp   # |       |Maya (c)| |Rami    | |Lina    | |Joe     | |
| | #  ## # ## ##  # |       +--------+ +--------+ +--------+ +--------+ |
| | ## #  #  #  ### #|       +--------+ +- - - - + +- - - - + +- - - - + |
| | # ### ## # #  #  |       |  [<>]  | :   +    : :   +    : :   +    : |
| | ##  #  ### # ## #|       |Nour    | :        : :        : :        : |
| +------------------+       +--------+ +- - - - + +- - - - + +- - - - + |
|   K X Q P   <72sp amber>   +- - - - + +- - - - + +- - - - + +- - - - + |
|                            :   +    : :   +    : :   +    : :   +    : |
|   or open mish-ana.x.workers.dev                                       |
|   and enter the code       [ Settings ]  [ (globe) English ]  (• Start)|
+------------------------------------------------------------------------+
```

| Element | Spec |
|---|---|
| Label | "SCAN TO JOIN" (`lobby.scanToJoin`), `type.tv.caption`, tracking +8 % (Latin), `textSecondary`, y 87 |
| QR panel | x 58, **y 111–351, 240 × 240 dp** card in `text` cream (the QR needs a light quiet zone). Per SPEC §9.9: ZXing `BitMatrix` with margin 0; `module = floor(240 / (matrix.width + 8))` dp; the modules are drawn inset by `4 × module` **inside** the panel, so the 4-module quiet zone is part of the cream panel. Modules are `ink` on cream; never color them. Error correction **M**. The encoded content is `view.joinUrl` **upper-cased** (QR alphanumeric mode keeps it at version ≤ 3, so module ≥ 6 dp) |
| Code | y 363–435, `type.tv.code` at **72 sp** in `accent`, LTR always, letters spaced |
| Host line | y 447–499, "or open {url} and enter the code" (`lobby.orVisit`) in `type.tv.body` **20 sp** (people type it). `{url}` = `view.joinUrl` with the scheme and path stripped, never hard-coded |
| Player grid | 4 × 3 tiles, **120 × 96 dp**, gap 16 dp, starting x 370, y 111. Each tile has an avatar (56 dp) and a name (`type.tv.title`, 1 line). Empty slots have a dashed `outline` border with a faint "+" (non-focusable), and only the **first empty slot** pulses gently |
| Host badge | `crown` on the VIP (`isHost`) tile |
| Settings summary | Top end, 2 lines in `type.tv.caption` `textSecondary`: pack · word language / role counts (`lobby.roleSummary`) · win rule. It updates live when the VIP changes settings, with a 600 ms `accent` highlight sweep. When `view.premium`, a chip `gem` + `lobby.premiumRoom` is its **first** line (PAYMENTS-SPEC §4.4) |
| Start blocker line | Top end, under the summary: `lobby.needPlayers` / `lobby.blockerRoles` / `lobby.blockerWords` per `view.startBlocker` |
| Bottom bar | Starts at **x ≥ 370** (under the grid, never under the code): **Premium** (`gem` + the fixed label `lobby.premium`; opens the Store, PAYMENTS-SPEC §4.4) · Settings · Language (`common.language`, opens the 3-item list) · Start. It must fit in 960 − 48 − 370 = 542 dp with Start at 200 dp in EN/FR/AR; if the labelled Premium button does not fit, Premium becomes an **icon-only 48 × 48 dp** button with a focus tooltip (`lobby.premium`) and a content description |
| Start | Primary pill **200 × 48 dp** (`lobby.startGame`). Disabled while `startBlocker !== null`. For `NOT_ENOUGH_PLAYERS` it stays focusable; OK plays a gentle shake and `sfx.error`. For `INVALID_ROLE_CONFIG` / `NO_WORDS_AVAILABLE`, OK opens TV-03 focused on the offending row (Roles or Words) |
| Toast zone | Bottom start, above the host line: `lobby.joined` for joins, `lobby.left` for leaves |

- **Live join:** the tile drops in (§6.2-F), `sfx.join`, and the counter "PLAYERS 5/12" rolls. When the 12th player joins, the QR panel crossfades to `lobby.full`, the QR is hidden, and the code is greyed out.
- **Focus:**
  - Initial focus is **Start** if `canStart` or the blocker is `NOT_ENOUGH_PLAYERS`; otherwise **Settings** (SPEC §9.6).
  - Left/Right moves across the bottom bar: Premium ↔ Settings ↔ Language ↔ Start.
  - **Up from the bottom bar enters the player grid** (`focusRestorer`, last row), so tiles are focusable for **kicking**. OK on a focused tile → TV-14a "Remove {name}?".
  - Up from the grid's top row goes nowhere; the QR and the summary are not focusable.
  - **Back exits the app immediately** (no confirm; TV-DB).
- **Edge:** the crown moves only when the VIP's seat is removed (120 s lobby seat hold) or the VIP leaves (SPEC `reassignHost`). The TV remote can always Start.

### TV-03 Settings
**Enters:** from the Lobby only (this room), or from Results via "Change settings" (which first sends PLAY_AGAIN). **Not reachable mid-game.**

```text
+------------------------------------------------------------------------+
| GAME SETTINGS                                            [ Done ]      |
|                                                                        |
| +--------------+  +-------------------------------------------------+  |
| |(• Game      )|  |  Win rule            <  Official (1 Civ left) > |  |
| |  Roles       |  |  Beginner mode       <  Off                   > |  |
| |  Timers      |  |  If the re-vote ties <  Random pick           > |  |
| |  Words       |  |  Blank may guess     <  On                    > |  |
| |              |  |  Points Civ/Mole/Blank   2 / 10 / 6    [Edit]   |  |
| |              |  |  ---------------------------------------------  |  |
| |              |  |  Official: the infiltrators win when only one   |  |
| |              |  |  Civilian is left alive.                        |  |
| +--------------+  +-------------------------------------------------+  |
|                                                                        |
|                          Changes apply to this game.                   |
+------------------------------------------------------------------------+
```
Rows list **exactly** the SPEC §4.4 settings; defaults are SPEC's `DEFAULT_SETTINGS`, and every Left/Right step uses `SETTINGS_BOUNDS` (SPEC §3). The labels are the `settings.*` keys.

| Category (`settings.cat*`) | Rows (default in **bold**) |
|---|---|
| **Game** | Win rule (`winRule`): **Official** / Parity · Beginner mode (`revealRoles`): **Off** / On · If the re-vote ties (`tieBreak`): **Random pick** / Nobody is out · Blank may guess (`blankGuess`): **On** / Off · Points (`points`): Civilian **2**, Mole **10**, Blank **6** (0–20, step 1) |
| **Roles** | Roles (`roleMode`): **Automatic** / Custom · Moles (`undercoverCount`, Custom only): **1**, 1–5 · Blanks (`blankCount`, Custom only): **1**, 0–2 · Inline preview `settings.rolePreview` from `view.roleCounts`. An invalid combination shows `lobby.blockerRoles` in `danger` (the server still accepts the setting; START is blocked) |
| **Timers** | Clue turn (`clueSeconds`): Off, 10–120 step 5, **45** · Vote (`voteSeconds`): Off, 15–300 step 15, **90** · Reading the word (`revealSeconds`): Off, 10–120 step 5, **30** · Blank's guess (`guessSeconds`): Off, 10–120 step 5, **45**. Help line: `settings.timerOffHelp` |
| **Words** | Word language (`wordLocale`): English / Français / العربية (default: the room's creation language) · Packs (`packIds`): **All packs** or a multi-select chip grid with the localised title + `pairCount` + a "Teen" badge (`settings.packTeen`) when `ageRating==="teen"` · Difficulty (`difficulties`): multi-select Easy / Medium / Subtle, **all** · Family friendly (`familyFilter`): **On** / Off · Shuffle word sides (`swapSides`): **On** / Off |

- **Sound: On/Off** (`tv.soundOn` / `tv.soundOff`, a device setting kept on the TV, never sent to the server) sits next to **Done** in the header.
- **About** (`settings.catAbout`, TV only, last category; the phone's PH-03b has no such section): no rows and nothing focusable in its panel — focusing the category shows, in the panel, `settings.appVersion` + the app version and `settings.installId` + the install id (PAYMENTS-SPEC §2.1) as eight groups of four lowercase hex characters (`caption`, `text`, tabular figures, LTR-isolated in every UI language), then `settings.installIdHelp` (`caption`, `textMuted`). The owner reads it to comp this TV (`pnpm grant`, PAYMENTS-SPEC §3.12). Moving toward inline-end from About does nothing.
- **[not in v1]** Display (reduce motion, hide room code), volume, transliteration toggle (translit is shown whenever it is non-null).
- **Interaction:** a category list on the start side (`focusRestorer`) and rows on the end side. **Moving toward inline-end from a category enters its rows** (Right in LTR, **Left in RTL**; Compose geometry handles it), and moving toward inline-start from the rows returns to it. On a row, **Left/Right step the value** (the chevrons follow the reading direction), and **OK also steps** (for sticky D-pads). Multi-option rows (Packs, Difficulty) open a sub-panel on OK. An **explanation panel** below the rows describes the focused row's current value.
- **Locked rows (PAYMENTS-SPEC §4.4):** in a room without Premium, each premium setting row (`PREMIUM_SETTING_KEYS`, v1: Points) moves to the **bottom** of its category and shows a lock badge + `settings.premiumOnly`. Such a row does **not** step: **Left/Right** play the disabled shake + `sfx.error`, and **OK opens the Store** (focused on Premium). The "OK also steps" rule above does not apply to locked rows. In Words → Packs, the locked packs (`view.lockedPacks`) are listed below a divider with a lock badge, `store.packPairs` and `settings.unlockHint`; OK on one opens the Store focused on that pack.
- **Done:** Up from the first category or the first row → **Done**; OK on Done = Back.
- **Initial focus:** the first category (Game). **Back:** if a sub-panel is open, closes it; otherwise returns to the Lobby. Each change sends `UPDATE_SETTINGS` (debounced 300 ms); there's no "save" button.
- **Footer:** "Changes apply to this game." (`settings.applies`).
- **VIP sync:** when the VIP edits settings from a phone, the TV row flashes `accent` and a toast says `settings.changedBy`. Last write wins.

### TV-04 Role reveal wait ("Check your phones")
**Enters:** ROLE_REVEAL. **Leaves:** to TV-05 when everyone connected is ready or the ready timer runs out.

```text
+------------------------------------------------------------------------+
| GAME 1                                                   KXQP - 7 alive|
|                                                                        |
|                     <phone icon, 96dp, gentle wobble>                  |
|                                                                        |
|                       CHECK YOUR PHONES!              (displayL)       |
|                                                                        |
|            Hold the card to see your secret word. Don't show anyone!   |
|             The Blank has no word... and has to bluff.   (body, muted) |
|                                                                        |
|        [O]v   [#]v   [*]    [^]v   [<>]   [+]v   [~]                   |
|        Maya   Rami   Lina   Joe    Nour   Ziad   Sara                  |
|                                                                        |
|                          4 / 7 ready                  (o 32s)          |
|                                                                        |
|                                                     (• Start now )     |
+------------------------------------------------------------------------+
```
- Avatars in one row (≤ 7) or two rows (8–12), 64 dp each. "v" marks the ready `check` badge, which pops in with `sfx.ready`. Away players show the away badge, never the check.
- The second line about the Blank shows **only when `roleCounts.blank > 0`**.
- **Focus:** the action pill **Start now** (`tv.startNow`, double-OK → `HOST_ADVANCE`). Back → pause. The ready timer ring sits at the bottom end (48 dp).

### TV-05 Clues
**Enters:** CLUES and TIE_BREAK (which adds a "TIE-BREAK" badge, `phase.tieBreak`).

```text
+------------------------------------------------------------------------+
| ROUND 2 - CLUES                                          KXQP - 6 alive|
| One word or short phrase. Don't say the word!         (caption, muted) |
|                                                                        |
|                            .----------.                                |
|                          /   +------+   \       <- timer ring 216dp    |
|                         |    | [*]  |    |         avatar 160dp        |
|                         |    | 160  |    |                   (o 23)    |
|                          \   +------+   /                              |
|                            '----------'                                |
|                         LINA'S CLUE           (displayM, name in text) |
|          Say it out loud, then end the turn on your phone              |
| ---------------------------------------------------------------------  |
|  [O]v  >  [#]v  >  (*)NOW  >  [^]  >  [<>]  >  [+]     ( Skip turn )   |
|  Maya     Rami     Lina       Joe     Nour     Ziad                    |
+------------------------------------------------------------------------+
```
- **Spotlight:** a radial cone of `primary` at 12 % from the top centre onto the speaker. The avatar is 160 dp with the "Speaking" state, and the **timer ring (216 dp, 8 dp stroke) wraps the avatar** with the seconds number at its top end (`type.tv.timer`). The ring is `text` until 10 s, `accent` until 5 s, then `danger` with a pulse and `sfx.tick`. Timer Off: no ring, and the line reads `tv.cluesNoTimer`. The sub-line under the name is `tv.cluesSub` (the speaker ends the turn on their phone; the TV never says "tap", since it is used only with a remote).
- **Order strip** (bottom action bar, **y 417–513**, 96 dp; 102 dp in Arabic for the taller line): every alive player in this round's speaking order in **104 dp items**: a 48 dp avatar, 2 dp, the name in **`type.tv.titleS` (22 sp)** truncated **once**, by a single end ellipsis at the item's 96 dp text width (no grapheme pre-cut), 4 dp, the 4 dp current-speaker underline, and 2 dp to the bottom safe line, so the names and the underline always end inside the safe area. The current speaker's full name is shown in the spotlight. Done = `check` and 60 % opacity; current = a 1.25× scale and a `primary` underline bar 4 dp; upcoming = full opacity. Chevrons between them follow the reading direction. In a tie-break round, only the tied players appear.
- **Skipped (away) player:** the tile flashes `wifi-off`, the toast `clues.skipped` appears, and the spotlight moves on.
- **Speaker drops mid-turn:** the turn is kept (SPEC §4.8). The spotlight avatar shows the away badge; the timer continues (with the timer off, a 15 s grace timer appears).
- **Focus:** the action pill **Skip turn** (`clues.skipTurn`, double-OK → `HOST_ADVANCE`). Back → pause.
- **Round 1, first turn only:** under the rule line, `clues.firstHint`.

### TV-06 Voting
**Enters:** VOTING (or the re-vote after a tie, which adds a badge `vote.revoteAmong` and shows only the tied players as candidates).

```text
+------------------------------------------------------------------------+
| ROUND 2 - VOTE                                           KXQP - 6 alive|
|                                                                        |
|           WHO'S NOT ONE OF US?  Vote on your phone   (displayS line)   |
|                                                                        |
|     +----------+   +----------+   +----------+   +----------+          |
|     |   [O]    |   |   [#]  v |   |   [*]  v |   |   [^]    |          |
|     |   Maya   |   |   Rami   |   |   Lina   |   |   Joe    |          |
|     +----------+   +----------+   +----------+   +----------+          |
|     +----------+   +----------+                                        |
|     |  [<>]  v |   |   [+]  v |                                        |
|     |   Nour   |   |   Ziad   |                                        |
|     +----------+   +----------+                                        |
|                                                                        |
|   ==========================================------------  (o 41s)      |
|                   4 / 6 voted                      ( Close vote )      |
+------------------------------------------------------------------------+
```
- Title and subtitle are **one** `displayS` line (`vote.title` + `vote.sub`).
- Up to 8 candidates: tiles 136 × 112 dp (avatar 64 dp), 4 per row. **9–12 candidates: a 6-column grid of 120 × 96 dp tiles** (6 × 120 + 5 × 16 = 800 dp ≤ 844), 2 rows. This keeps the stage within y 87–447.
- The `check` badge means **"this player has voted"**. It never shows *for whom*. There are **no tallies** until the vote closes (SPEC §5.4).
- Each vote plays `sfx.voteCast` (anonymous) and the "x / y voted" counter (`vote.progress`) rolls.
- A **linear timer bar** spans the bottom; it mirrors in RTL (§10). At 10 s the label changes to `vote.tenLeft`.
- Eliminated players aren't shown. Away players show the away state, and their votes count as abstentions.
- **Focus:** the action pill **Close vote** (`vote.close`, double-OK → `HOST_ADVANCE`). Back → pause.

### TV-07 Vote reveal
**Enters:** the phase becomes ELIMINATION (a closed vote with a unique maximum, a random pick, or no elimination) or TIE_BREAK (first tie). It is a client-side sequence (§6.2-B, **≤ 3 s**) played on `lastVote`: the arrows come from `lastVote.tally[].voterIds`, the "No vote" bin from `lastVote.abstainIds`.

```text
+------------------------------------------------------------------------+
| ROUND 2 - THE VOTES ARE IN                               KXQP - 6 alive|
|                                                                        |
|        2                3                                              |
|      o o             o o o                                             |
|     +----------+   +----------+   +----------+   +----------+          |
|     |   [O]    |   |   [#]    |   |   [*]    |   |   [^]    |          |
|     |   Maya   |   |   Rami   |   |   Lina   |   |   Joe    |          |
|     +----------+   +----------+   +----------+   +----------+          |
|             \___________/  \_________/ ...arcs drawn during step 2     |
|     +----------+   +----------+                         [ No vote ]    |
|     |  [<>]    |   |   [+]    |                              o         |
|     |   Nour   |   |   Ziad   |                              1         |
|     +----------+   +----------+                                        |
|                                                                        |
|                       Press OK to skip                ( Continue )     |
+------------------------------------------------------------------------+
```
- **End states:** a unique maximum (`outcome==="ELIMINATED"`) → stamp "OUT" → TV-09. A second tie with `outcome==="RANDOM"` → TV-09 wheel variant. `outcome==="NO_ELIMINATION"` with no tally entries → stamp `vote.nobodyVoted` → TV-09 no-elimination variant. A first tie (phase TIE_BREAK) → stamp "TIE!" → TV-08.
- **Focus:** the action pill (Continue in ELIMINATION). **OK = skip to the end state; a second OK within 3 s = `HOST_ADVANCE`. Back = pause** (the local animation pauses too).

### TV-08 Tie-break (overlay)
**Enters:** TIE_BREAK. The server starts the first tied player's turn immediately, with `TIE_LEAD_IN_MS` (3 s) added to that turn's timer (SPEC §4.7). So the tie is **a ≤ 2.5 s overlay on top of TV-05**, never a separate screen with its own countdown.

```text
+------------------------------------------------------------------------+
| ROUND 2 - TIE-BREAK                                      KXQP - 6 alive|
|                                                                        |
|                             IT'S A TIE!              (displayL, stamp) |
|               +--------------+            +--------------+             |
|               |    [#] 120   |     VS     |    [*] 120   |             |
|               |     Rami     |            |     Lina     |             |
|               |   3 votes    |            |   3 votes    |             |
|               +--------------+            +--------------+             |
|          One more clue each, then everyone votes again - between       |
|                          these two only.                               |
|                (TV-05 with the TIE-BREAK badge underneath)             |
+------------------------------------------------------------------------+
```
- The tied players' cards (2–4) with their tallies, `tie.title` and `tie.explain`. The overlay fades out after ≤ 2.5 s (OK skips it), revealing TV-05 with the tie-break badge and only the tied players in the order strip; then TV-06 with only the tied players as candidates.
- The second-tie wheel and "Nobody's out" are **TV-09 variants** (not this screen).

### TV-09 Elimination reveal
**Enters:** ELIMINATION, after TV-07. Budget **≤ 4.5 s** (§6.2-C).

```text
+------------------------------------------------------------------------+
| ROUND 2                                                  KXQP - 5 alive|
|                                                                        |
|                           RAMI IS OUT!                (displayM)       |
|                        +------------------+                            |
|                        |    <role card    |   280 x 380dp              |
|                        |     emblem 120dp |   flips from avatar back   |
|                        |     + pattern>   |   to role face             |
|                        |   T H E  M O L E |   (ink on role color)      |
|                        +------------------+                            |
|                                                                        |
|                       ...the Mole! Nice catch.        (headline)       |
|                                                                        |
|                    Next round in 2...               ( Continue )       |
+------------------------------------------------------------------------+
```
- The sequence is §6.2-C. "Next round in {count}…" (`elim.nextRound`) counts down from `deadline.at − serverNow`. The server moves on when the 8 s ELIMINATION deadline ends (to CLUES, MR_WHITE_GUESS, RESULTS, or LOBBY on a stalemate).
- **Variants:**
  - **Random pick** (`lastVote.revote && outcome==="RANDOM"`): the tied avatars sit on a ring (radius 150 dp) and a highlight runs around it, decelerating over ≤ 2 s (`sfx.wheel` + heartbeat), landing on `eliminated.playerId` (the server's pick). Copy `elim.randomPick`. Then the card flip, compressed to fit.
  - **No elimination** (`outcome==="NO_ELIMINATION"`): stamp "NOBODY'S OUT" (`elim.noElimination`; `vote.nobodyVoted` when the tally is empty), no card.
  - **The Blank:** reaction `elim.reactionBlank` when `settings.blankGuess`, else `elim.reactionBlankNoGuess`.
- **Beginner mode doesn't change this screen.** Elimination always reveals the role (RESEARCH §1).
- **Forfeits** (a player LEAVEs or is KICKed in-game): toast `elim.forfeit` with the revealed role on TV and phones. If that ends the game, the phase jumps straight to RESULTS; the TV plays a short TV-09 card for the forfeiter before TV-11.
- **Focus:** the action pill **Continue** (`common.continue`). Back = pause.

### TV-10 Blank guess
**Enters:** MR_WHITE_GUESS (the engine state name; the UI always says "Blank").

```text
+------------------------------------------------------------------------+
| ROUND 2 - LAST CHANCE                                    KXQP - 5 alive|
|                                                                        |
|                         .  -  ~  -  .                                  |
|                      '    +------+    '        dark room, one spotlight|
|                     ;     | [ ]  |     ;       dashed paper ring       |
|                      .    +------+    .        timer ring 220dp        |
|                         '  -  ~  -  '                      (o 18)      |
|                                                                        |
|                    THE BLANK GETS ONE GUESS            (displayS)      |
|                  Lina is guessing the Civilians' word...  (body)       |
|                                                                        |
|                          Silence, please!                (caption)     |
|                                                         ( Skip )       |
+------------------------------------------------------------------------+
```
- The sequence is §6.2-D. **The guessed text is never shown before RESULTS** (SPEC §5.4: `guess.text` is null in every view). **House rule:** the Blank reads the guess out loud after submitting (the phone prompts them), and the host decides any override from what was heard. The text appears on TV-11 (`result.guesses`).
- **While PENDING:** the action pill **Skip** (`guess.skip`) sends `HOST_ADVANCE` (TV only; the server makes it a TIMEOUT).
- **Verdict** (status ≠ PENDING; lasts the VERDICT deadline, **8 s**, shown as a depleting bar under the buttons):
  - **CORRECT:** "The Blank nailed it!" + confetti. Buttons **(• Continue)** and **[ Doesn't count ]** (`guess.reject`, TV only, for a matcher false positive; confirm `guess.rejectConfirm`) → `HOST_OVERRIDE_GUESS{accept:false}`.
  - **WRONG:** "Wrong! The game goes on." Buttons **(• Continue)** and **[ It counts! ]** (`guess.accept`; confirm `guess.acceptConfirm`) → `HOST_OVERRIDE_GUESS{accept:true}`.
  - **TIMEOUT:** "Time's up! No guess." Only **(• Continue)**.
  - After an override (`overridden`), only Continue remains, with the `guess.overridden` caption. Overrides are allowed once.
  - Continue is the double-OK action pill (`HOST_ADVANCE`). When the deadline ends, the buttons leave composition and focus returns to the default target.
- **Focus:** while guessing, the Skip pill; in the verdict, Continue. Back → pause.

### TV-11 Results and scoreboard
**Enters:** RESULTS.

```text
+------------------------------------------------------------------------+
| GAME OVER                                                         KXQP |
|                  THE INFILTRATORS WIN!              (headline)         |
|   +------------------------------------------------------------------+ |
|   | CIVILIAN WORD  Manousheh (translit)  |  MOLE WORD  Ka'ke         | |
|   +------------------------------------------------------------------+ |
|   Pack: Lebanese Kitchen   -   Lina guessed: "manoushe"   (caption)    |
|   #  PLAYER     ROLE          THIS GAME    TOTAL                       |
|   1  [^] Joe    (mask) Mole      +10        24                         |
|   2  [*] Lina   (card) Blank      +6        18                         |
|   3  [O] Maya   (house) Civ        0        12                         |
|   4  [#] Rami   (house) Civ        0         8    (focus-scroll)       |
|   R1 [#]x(house)  R2 [*]x(card)  R3 [O] door-out   (history timeline)  |
|      (•  Play again  )   [ Change settings ]   [ New room ]            |
+------------------------------------------------------------------------+
```
- **Stage 1 (≈ 5 s, local):** the victory moment (§6.2-E) in `displayL`, and the words meeting in the middle, with translit under each word whenever `translit !== null`.
- **Stage 2:** the title shrinks to `headline`; the words collapse into **one 56 dp strip**; a caption line shows `results.pack` and, if any, `guess.guessed` for each entry of `result.guesses`; the scoreboard shows **4 rows of 40 dp** (focus-scroll for more) with every player and their now-public role (emblem + label); a one-line **history timeline** from `history` (round, avatar, emblem, cause icon: vote / `dice` for RANDOM / `user-x` for KICK / `door-out` for LEAVE). Rank 1 gets `glow.accent` and a `trophy`.
- **Focus:** initial **Play again** (→ PLAY_AGAIN → TV-02 with the same players and scores). Left/Right across the 3 buttons; Up enters the score list (scroll only). **Change settings** → PLAY_AGAIN, then TV-03. **New room** → TV-14b, then a new room (old phones keep the old room until it expires). **Back** → pause menu (TV-12). The VIP's phone can also Play again.
- Must pass a 1.3× font-scale screenshot test with 12 players (§11).

### TV-12 Pause menu (Back during a game or on Results)
```text
+------------------------------------------------------------------------+
| ROUND 2 - CLUES  (dimmed behind a scrim; the game keeps running)       |
|                                                                        |
|                    +------------------------------+                    |
|                    |          GAME MENU           |                    |
|                    |                              |                    |
|                    |   (•  Resume             )   |                    |
|                    |   [   Skip turn / timer  ]   |                    |
|                    |   [   Players...         ]   |                    |
|                    |   [   End game           ]   |                    |
|                    |   [   Exit               ]   |                    |
|                    +------------------------------+                    |
|                                                                        |
|                      The game keeps running.                           |
+------------------------------------------------------------------------+
```
- Items per SPEC §9.6: **Resume** · **Skip turn / timer** (`tv.skip` → `HOST_ADVANCE`) · **Players…** (`tv.players` → list → TV-14a → `KICK`) · **Sound: On/Off** (the global mute; the menu stays open) · **End game** (TV-14c → `BACK_TO_LOBBY`) · **Exit** (`tv.exitApp`, finishes the app). A Language item is **[not in v1]**.
- **Nothing pauses for everyone** (no PAUSE action in v1): the footer is `tv.pauseNote`. Only local reveal animations pause while the menu is open.
- **Players…** is for removing someone who left for good, so the game stops skipping their turns.
- **Focus:** initial **Resume**; it's a vertical list; **Back = Resume**.

### TV-13 Connection states
| ID | Situation | Treatment |
|---|---|---|
| **13a** | TV socket dropped, reconnecting (≤ 30 s) | The stage stays visible but frozen with a 40 % scrim. A **top banner** in `elevated` with a spinner: `conn.tvReconnecting` and an attempt counter. No focus change. The game state is resumed from the full snapshot when the socket reconnects |
| **13b** | Still offline after 30 s | Full screen: `wifi-off` 96 dp, `conn.lost`, `conn.tvLostBody`, **(• Try again)**. Auto-retry with backoff continues underneath. Back → pause menu (Exit is there) |
| **13c** | A player is away | Their tile goes to the static away state (§5.2) and a toast `conn.playerAway`. Their turn is skipped and their vote counts as an abstention. Their seat is held until the room returns to the lobby (then 120 s) |
| **13d** | Room creation failed (Home) | TV-01 failure state |
| **13e** | Room expired (`ROOM_EXPIRED`, close 4010) | In LOBBY or RESULTS (also ROOM_NOT_FOUND, close 4004): **silently create a new room** and toast `tv.newCode` (SPEC §9.8). A room never expires while the TV is connected (12 h safety cap); it expires 15 min after the TV disconnects (SPEC §7.5). Otherwise full screen `tv.roomClosed` with **(• New room)**. Phones show their RoomGone screen |
| **13f** | No phones connected for 60 s mid-game | A soft banner: `conn.phonesAsleep`. No state change |
| **13g** | Other fatal closes (4002, 4003, 4005) | Full screen with the error text (`error.unsupportedVersion`, `error.tvAuthFailed`, `error.replaced`) and **(• New room)** |

### TV-14 Dialogs (`elev.3`, centred, 520 dp wide, **initial focus on the safe option**)
- **14a Remove player:** `lobby.kickConfirm` / `lobby.kickBody`. **(• Cancel)** [ Remove ] (`danger` outline).
- **14b New room:** `results.newRoomConfirm`. **(• Cancel)** [ New room ].
- **14c End game:** `tv.endGameConfirm` / `tv.endGameBody`. **(• Keep playing)** [ End game ].
- **Back** = the safe option.

### TV-15 How to play **[not in v1, M4]**
A horizontal pager of 4 cards (480 × 300 dp each, the focused card centred): ① Everyone gets a secret word except… ② Give one clue each, out loud. ③ Vote out the odd one. ④ The Blank gets one last guess. **Focus:** Left/Right pages; **OK = next page; on the last page, OK = back**. **Back:** back to the caller. Its i18n keys will be added to SPEC in M4.

---

## 8. Phone screens (Preact, portrait, one thumb)

**Global phone rules**
- **Persistent top bar** (56 px) after joining: `[KXQP]` code chip (start side), your avatar (28 px) + name (centre), `⋯` menu (end side; PH-17).
- **Primary action anchored at the bottom** (64 px pill, full width minus 20 px gutters). If a screen has no action, its status sits at the bottom instead ("Waiting for…").
- **Every phase change** scrolls to the top, moves focus to the screen's `<h1>` (for screen readers), and plays the phase transition.
- **Live region:** one visually hidden `aria-live="polite"` element announces phase changes ("Voting started"). An `assertive` region is used only for "Your turn" and "You're out".
- **Wake lock** is requested on the Join tap and re-acquired on `visibilitychange → visible`. When it's unsupported, the lobby shows a one-time hint "Keep your screen on during the game".
- **Privacy:** the secret word appears **only** on PH-04 while the card is held, and in PH-13 results. Nothing else ever renders it, including `document.title` and toasts.

### PH-01 Enter code (only when opened without a code, e.g. the bare host from the TV's "or open" line)
```text
+------------------------------------+
| <wordmark-latin 140px>   (globe) EN|
|                                    |
|        Join a party                |
|                                    |
|  Enter the code on the TV          |
|  +-----+ +-----+ +-----+ +-----+   |
|  |  K  | |  X  | |  Q  | |  _  |   |
|  +-----+ +-----+ +-----+ +-----+   |
|   (four boxes = one input, LTR)    |
|                                    |
|                                    |
|                                    |
|                                    |
| +--------------------------------+ |
| |            Next  ->            | |
| +--------------------------------+ |
+------------------------------------+
```
- A single `<input inputmode="text" autocapitalize="characters" autocomplete="off" maxlength="4" dir="ltr">` drawn as 4 boxes (`type.ph.code`). It uppercases on input and accepts only `ROOM_CODE_ALPHABET` (SPEC §3; the check is `ROOM_CODE_REGEX`). Any digit, or I, L or O, shakes the box and shows "Codes use letters only, never I, L or O." (`join.codeInvalid`).
- Auto-submits on the 4th character. **Next** is disabled until 4 characters are entered. The `arrow-forward` icon mirrors in RTL.
- Errors after navigating to `/{CODE}` appear on PH-14 (not found) or PH-02 (full, locked).

### PH-02 Join (name + color)
```text
+------------------------------------+
| [KXQP]                   (globe) EN|
|                                    |
|  You're joining KXQP               |
|                                    |
|  Your name                         |
|  +--------------------------------+|
|  | Lina                     4/16 | |
|  +--------------------------------+|
|                                    |
|  Your colour                       |
|  [O]  [#]  [*]  [^]                |
|  [<>] [x]  [+]  [~]                |
|  [(]  [z]  [&]  [n]                |
|   x = taken (hatched, disabled)    |
|                                    |
|        +----------+                |
|        |   [*]    |  preview tile  |
|        |   Lina   |                |
|        +----------+                |
| +--------------------------------+ |
| |          Let me in!            | |
| +--------------------------------+ |
+------------------------------------+
```
- **Name:** `type.ph.input`, 16 graphemes (count with `Intl.Segmenter`), `dir="auto"`, `autocomplete="nickname"`, `enterkeyhint="go"`. It's pre-filled from localStorage (the last name used, in try/catch). The counter and preview use SPEC `sanitizeName`; the server applies the same function.
- **Color grid:** CSS grid `repeat(auto-fill, minmax(48px, 1fr))`, `gap: 8px` (4 columns at 320 px wide: 4 × 48 + 3 × 8 = 216 px fits the 280 px content width). Each 48 × 48 px swatch shows **its shape glyph** (§5.2). Taken swatches are hatched, 35 % opacity, `aria-disabled`, and the label reads "Coral circle, taken". The selected swatch gets a 3 px `text` ring plus a `check`. The first free color is preselected. Taken colors update live from the lobby state.
- The preview tile shows the avatar exactly as it will appear on the TV.
- **CTA "Let me in!"** is disabled until the name is non-empty. It sends `join` and requests the wake lock.
- **Inline errors** (above the CTA, `danger`, with `sfx.error` and the error haptic): `NAME_INVALID`, `NAME_TAKEN` ("Someone already has that name. Add an initial?"), `ROOM_FULL`, `RATE_LIMITED`.
- **Colour race (`COLOR_TAKEN`):** the server rejects the join. The phone keeps the name, refreshes the grid from the latest view, auto-selects the first free swatch, shakes the grid, and shows "That colour was just taken. Pick another." (`join.colorTaken`). The CTA stays enabled, so a second tap joins.
- **Locked variant** (`me===null` and phase ≠ LOBBY; replaces the old ROOM_LOCKED error screen): a `lock` icon, `join.locked`, a read-only live line ("Round 2 · Clues" from `round.label` + `phase.*`), the name field still editable, and the CTA disabled. The phone stays connected as a spectator; **when `view.phase` becomes LOBBY**, the CTA unlocks with a haptic and the toast `join.unlocked`.

### PH-03 Lobby (waiting) — player and VIP variants
```text
+------------------------------------+
| [KXQP]     [*] Lina            ... |
|                                    |
|           You're in!               |
|   Look at the TV: your tile is up. |
|                                    |
|   PLAYERS 5/12                     |
|   [O] Maya (host)  [#] Rami        |
|   [*] Lina (you)   [^] Joe         |
|   [<>] Nour                        |
|                                    |
|   Lebanese Kitchen - AR words      |
|   1 Mole - 1 Blank - Clue 30s      |
|                                    |
|                                    |
|                                    |
|                                    |
|  Waiting for the host to start...  |
+------------------------------------+
```
**VIP variant** (the first joiner; `crown` in the top bar):
```text
+------------------------------------+
| [KXQP]     [*] Lina (crown)    ... |
|                                    |
|   You're the host (crown)          |
|   Start when everybody's in.       |
|                                    |
|   PLAYERS 5/12        (tap = kick) |
|   [O] Maya  [x]   [#] Rami  [x]    |
|   [^] Joe   [x]   [<>] Nour [x]    |
|                                    |
|   +------------------------------+ |
|   | Game settings            >   | |
|   | Lebanese Kitchen - 1 Mole... | |
|   +------------------------------+ |
|                                    |
|                                    |
| +--------------------------------+ |
| |     Everybody's in, start!     | |
| +--------------------------------+ |
+------------------------------------+
```
- **Start** (`lobby.startAll`) is disabled while `view.startBlocker !== null`, with the blocker text under it: `lobby.needPlayers` ("Need 1 more player"; counts **connected** players), `lobby.blockerRoles` (tap → opens the settings sheet at Roles), or `lobby.blockerWords` (tap → opens it at Words).
- **Kick:** tap a player row → a bottom sheet "Remove Joe?" with [Cancel] and [Remove] (`danger`).
- **Game settings ›** opens PH-03b, a full-height sheet with exactly the TV-03 rows, defaults and `SETTINGS_BOUNDS` steps, as native-feeling segmented controls and steppers (48 px). Changes are sent immediately. Sections can be expanded or collapsed. Language is per device (PH-17).
- **Non-VIP:** a read-only settings summary. The player list is announced as a list with "host" and "you" labels.

### PH-04 Your word (ROLE_REVEAL; hold to reveal)
```text
+------------------------------------+
| [KXQP]     [*] Lina            ... |
|                                    |
|        Your secret word            |
|                                    |
|   +----------------------------+   |
|   |  .  !  .  !  .  !  .  !  . |   |
|   |                            |   |
|   |       (hand-press icon)    |   |
|   |                            |   |
|   |   Press and hold to see    |   |
|   |        your word           |   |
|   |                            |   |
|   |  !  .  !  .  !  .  !  .  ! |   |
|   +----------------------------+   |
|    Make sure nobody's looking.     |
|                                    |
| +--------------------------------+ |
| |           Got it               | |
| +--------------------------------+ |
+------------------------------------+
```
**While held:**
```text
+------------------------------------+
|   +----------------------------+   |
|   |                            |   |
|   |                            |   |
|   |        MANOUSHEH           |   |
|   |                            |   |
|   |    (beginner mode only:    |   |
|   |     [house] Civilian)      |   |
|   |                            |   |
|   |     Release to hide        |   |
|   +----------------------------+   |
+------------------------------------+
```
- **Card:** 100 % width, `aspect-ratio: 3/4`, max height 55 dvh, `radius.xl`. The interaction is §6.2-A. Use pointer events (`pointerdown` + `setPointerCapture`; hide on `pointerup`, `pointercancel`, `pointerleave` and `blur`). Set `user-select: none`, `-webkit-touch-callout: none` and `touch-action: none` on the card, and call `contextmenu` `preventDefault` so a long press doesn't open the OS menu.
- **The Blank's face:** the empty-card emblem, "**No word for you.**" and "Listen. Blend in. Bluff."
- **"Got it"** (sends READY) is disabled until the card has been revealed at least once. After that tap: "Ready! Waiting for the others… (4/7)". The card stays available to peek again.
- **Accessibility alternative:** with a screen reader, the card is a `button` labelled "Show my word for 5 seconds". Activating it reveals the word for 5 s and announces the word through the live region. A visible "Tap to show for 5 s instead" link sits under the card for motor-impaired players (§11).

### PH-05 Clues, someone else's turn (incl. "next up")
```text
+------------------------------------+
| [KXQP]     [*] Lina            ... |
| ROUND 2 - CLUES                    |
|                                    |
|          Now speaking              |
|            [#] 96px                |
|              Rami                  |
|         ==========----  23s        |
|                                    |
|  Order: Maya v > RAMI > Lina > Joe |
|                    you're next!    |
|                                    |
|   Listen closely. Who sounds off?  |
|                                    |
| +--------------------------------+ |
| |     (eye) Hold to peek my word | |
| +--------------------------------+ |
+------------------------------------+
```
- A compact speaker hero (96 px avatar plus a linear timer that mirrors in RTL). The order strip is a horizontal scroller with "you" outlined.
- **Next up:** when you're next, a `primary` banner says "You're next. Get your clue ready." plus a 15 ms haptic.
- **The bottom button is a hold-to-peek** (the same mechanics as PH-04): the word shows in a bubble above the button while held. Its label is in the first person ("Hold to peek my word").

### PH-06 Your turn
```text
+------------------------------------+
| [KXQP]     [*] Lina            ... |
| ################################## |
| ##                              ## |
| ##          YOUR TURN!          ## |
| ##                              ## |
| ##   Say one word or a short    ## |
| ##   phrase about your word.    ## |
| ##                              ## |
| ##   ======================-- 27s##|
| ##                              ## |
| ##  +------------------------+  ## |
| ##  |                        |  ## |
| ##  |         DONE           |  ## |
| ##  |                        |  ## |
| ##  +------------------------+  ## |
| ##   (eye) hold to peek my word ## |
| ################################## |
+------------------------------------+
```
- The screen **floods with the player's color** (§6.2-F). Text is `ink` on light colors and cream on grape and plum (both pass, §2.3).
- **DONE** is a 50 dvh-tall rounded rectangle in `bg` with cream text (`type.ph.display`): the biggest target in the app. It sends `CLUE_DONE` and then returns to PH-05.
- **Accidental-tap guard:** DONE is inert for the first 1.5 s of the turn (it shows a fill animation during that time), so a lingering tap can't end the turn.
- **The Blank's variant:** an extra line "Bluff! Listen to the others' clues." Beginner mode adds a role chip.
- Timer at 5 s: the bar turns to `danger` and a 10 ms tick haptic fires each second (Android only).

### PH-07 Vote
```text
+------------------------------------+
| [KXQP]     [*] Lina            ... |
| ROUND 2 - VOTE      ======---  41s |
|                                    |
|       Who's lying?                 |
|   Tap a player, then lock it in.   |
|                                    |
|  +--------------------------------+|
|  | [O]  Maya                   ( )||
|  +--------------------------------+|
|  | [#]  Rami                   (o)||
|  +--------------------------------+|
|  | [^]  Joe                    ( )||
|  +--------------------------------+|
|  | [<>] Nour                   ( )||
|  +--------------------------------+|
|                                    |
| +--------------------------------+ |
| |      Lock my vote: Rami        | |
| +--------------------------------+ |
+------------------------------------+
```
- The selected row (Rami) gets a 2 px `primary` border and a check.
- A `role="radiogroup"` of 64 px rows (56 px avatar, `type.ph.h2` name). **You are not listed** (no self-vote). Eliminated players are not listed. Away players are listed with a `wifi-off` badge, because you may still vote for them.
- The CTA is disabled until a player is selected, then reads "Lock my vote: {name}".
- **Spectators** (eliminated) see PH-10 instead.
- If time runs out before locking, the vote is an abstention (PLAN). A banner says "Time's up, no vote counted."

### PH-08 Vote locked / waiting
```text
+------------------------------------+
| [KXQP]     [*] Lina            ... |
| ROUND 2 - VOTE                     |
|                                    |
|            (check 64px)            |
|          Vote locked.              |
|       Act natural.                 |
|                                    |
|   You voted for [#] Rami           |
|                                    |
|   4 / 6 voted                      |
|                                    |
|   Watch the TV for the reveal.     |
+------------------------------------+
```
- **Deliberate lock UX:** the phone offers no "change vote" button, even though the server accepts an overwrite (SPEC §4.7). After a reconnect, this screen is restored from `me.myVote`. The "You voted for…" line is visible only on this phone. When the vote closes, the phone moves to PH-08b.

### PH-08b Elimination (everyone who is not on PH-10 or PH-11)
```text
+------------------------------------+
| [KXQP]     [*] Lina            ... |
| ROUND 2 - ELIMINATION              |
|                                    |
|           Look at the TV!          |
|                                    |
|   [#] Rami is out!                 |
|   (mask) Rami was the Mole         |
|                                    |
|   [#] Rami   3                     |
|   [*] Lina   2                     |
|   No vote: [^] Joe                 |
|                                    |
|   ==========--------               |
+------------------------------------+
```
- Shown in ELIMINATION after the TV's reveal has had a head start (≈ 3 s, so phones don't spoil the TV), with the outcome line: `elim.eliminated` + `elim.was*` with the role emblem; or `elim.noElimination` (`vote.nobodyVoted` when the tally is empty); or `elim.randomPick` first for a random pick.
- A compact tally from `lastVote.tally` (avatar + count, seat order of voters not shown) and `lastVote.abstainIds` as "No vote" (`vote.noVote`).
- A deadline bar from `deadline`.
- **Forfeits:** a toast `elim.forfeit` ("{name} left the game ({role})") on any screen.

### PH-09 Tie-break
```text
+------------------------------------+
| [KXQP]     [*] Lina            ... |
| TIE-BREAK                          |
|                                    |
|          It's a tie!               |
|   [#] Rami   vs   [*] Lina         |
|                                    |
|   One more clue each, then         |
|   vote again between them.         |
|                                    |
|  (if you're tied:)                 |
|  +--------------------------------+|
|  |  You're in the tie: get your   ||
|  |  best clue ready!              ||
|  +--------------------------------+|
+------------------------------------+
```
- The flow then reuses PH-05 and PH-06 (tied players only), then PH-07 with **only the tied players** as options. Tied players vote too, but **not for themselves**. If two players are tied, each tied player effectively votes for the other.
- **This screen yields to PH-06 when `currentSpeakerId === me.id`** (the server starts the first tied turn immediately, with a 3 s lead-in).
- A random pick after the re-vote is shown on PH-08b (`elim.randomPick`).

### PH-10 Eliminated / spectator
```text
+------------------------------------+
| [KXQP]     [*] Lina (out)      ... |
|                                    |
|          (door-out 64px)           |
|       You're out of the game       |
|                                    |
|     You were: [house] Civilian     |
|                                    |
|   Stick around for the reveal.     |
|   No hints, OK? :)                 |
|                                    |
|  ROUND 3 - CLUES                   |
|  Now speaking: [^] Joe             |
|                                    |
| +--------------------------------+ |
| |     (eye) Hold to peek my word | |
| +--------------------------------+ |
+------------------------------------+
```
- It's shown with an elimination haptic. Your role is shown to **you** (it's public by now on the TV anyway). Then it follows along: a passive phase line and the current speaker, with **no actions**. Peeking at your word stays available, for fun and for the table chat afterwards.
- **If you were the Blank and `settings.blankGuess` is on,** this screen is skipped and you go straight to PH-11.

### PH-11 Blank guess (eliminated Blank only)
```text
+------------------------------------+
| [KXQP]     [*] Lina            ... |
| LAST CHANCE         ======---  18s |
|                                    |
|      What's the Civilians'         |
|             word?                  |
|                                    |
|  +--------------------------------+|
|  | manou|                         ||
|  +--------------------------------+|
|   Spelling doesn't need to be      |
|   perfect.                         |
|                                    |
| +--------------------------------+ |
| |       That's my answer         | |
| +--------------------------------+ |
|  (keyboard open)                   |
+------------------------------------+
```
- The input autofocuses and the screen scrolls so the input and CTA stay above the keyboard (`visualViewport` resize handling). Settings: `type.ph.input`, `dir="auto"`, `autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`, `enterkeyhint="send"`, `maxlength=40`, `lang` = the word language (so the right keyboard is suggested).
- **Submit once.** After submitting: "Sent! Say your answer out loud for everyone." This supports the host-override house rule (TV-10). The phone shows **its own typed text from local state** (the server never echoes it before RESULTS). Then "Look at the TV!"
- **Verdict on the phone:** "You got it! You win!" (`guess.correctYou`; win haptic + confetti in the player color), "Not quite. The game goes on." (`guess.wrongYou`), or "Time's up! No guess." (`guess.timeout`). If the host overrides, the verdict updates with the `guess.overridden` caption.
- At timeout with text in the box, the text is **auto-submitted**. That's kinder than losing it. **[Engine note §13.5]**

### PH-12 Watching the Blank's guess (everyone else)
```text
+------------------------------------+
| [KXQP]     [*] Maya            ... |
| LAST CHANCE                        |
|                                    |
|        (empty card, dashed)        |
|    Lina is the Blank and gets      |
|    one guess. Shh...               |
|                                    |
|         ======-----  18s           |
+------------------------------------+
```
- Verdict states as on PH-11 but in the third person (`guess.correct`, `guess.wrong`, `guess.timeout`). No guess text is shown before RESULTS.
- The VIP variant adds, **only when the status is WRONG and not yet overridden**: [ It counts! ] (`guess.accept` → `HOST_OVERRIDE_GUESS{accept:true}`, with a confirm sheet `guess.acceptConfirm`). It is hidden from the VIP if the VIP is the Blank. "Doesn't count" is TV-only (SPEC §4.9).

### PH-13 Results
```text
+------------------------------------+
| [KXQP]     [*] Lina            ... |
|                                    |
|     THE INFILTRATORS WIN!          |
|         You won! +10               |
|                                    |
|   You were: [mask] Mole            |
|   Civilian word:  Manousheh        |
|   Mole word:      Ka'ke            |
|                                    |
|   1  [^] Joe        24             |
|   2  [*] Lina (you) 18             |
|   3  [O] Maya       12             |
|   4  [#] Rami        8             |
|                                    |
| +--------------------------------+ |
| |       Play again (VIP only)    | |
| +--------------------------------+ |
|   Others: "Waiting for the host to |
|   start the next game..."          |
+------------------------------------+
```
- The personal headline comes first ("You won! +{count}" in `success` / "You lost this one" in `textSecondary`), then the team result, then **both words** (public at RESULTS), the pack (`results.pack`), any Blank guesses (`guess.guessed` from `result.guesses`), and the scoreboard.
- Non-VIP footer: `results.waitingHost` (the TV remote can also start the next game).
- A win plays a confetti burst in the player's color and the win haptic.

### PH-14 Errors and end states
Presentation follows SPEC §6.4: **fatality is decided by the close code**; `error` frames only show messages.

```text
+------------------------------------+
| <wordmark-latin>         (globe) EN|
|                                    |
|          (door-out 64px)           |
|                                    |
|     This room has closed           |
|                                    |
|     Thanks for playing!            |
|                                    |
| +--------------------------------+ |
| |      Join another game         | |
| +--------------------------------+ |
+------------------------------------+
```

**Full-screen (fatal close codes)**

| Close / code | Screen | Title / body (keys) | Actions |
|---|---|---|---|
| 4004 `ROOM_NOT_FOUND` | RoomGone | `phone.noRoom` / `error.roomNotFound` | `phone.differentCode` (→ PH-01, prefilled) |
| 4010 `ROOM_EXPIRED` | RoomGone | `phone.roomGone` / `phone.roomGoneBody` | `phone.goHome` (→ `/`) |
| 4006 `KICKED` | Kicked | `phone.kicked` / `phone.kickedBody` | `phone.goHome` |
| 4005 `REPLACED` | Replaced | `phone.replaced` | **`phone.useHere`** (reconnects with the stored resume token, which in turn replaces the other tab) · `phone.goHome` |
| 4002 `UNSUPPORTED_VERSION` | RoomGone variant | `error.unsupportedVersion` | `conn.reload` |

**Inline (on the screen where it happened)**

| Code | Where | Treatment |
|---|---|---|
| `NAME_INVALID`, `NAME_TAKEN`, `COLOR_TAKEN`, `ROOM_FULL` | PH-02 | Inline error above the CTA (PH-02 rules) |
| `ROOM_LOCKED` | PH-02 | The locked variant (not an error screen) |
| `RESUME_INVALID` | PH-02 | Non-fatal: the stored token is deleted, then the Join form (LOBBY) or the locked variant (in-game) |
| `GUESS_INVALID` | PH-11 | Inline under the input |
| `RATE_LIMITED` | PH-02 inline on join; elsewhere a toast | "Easy there! Try again in a moment." On close 4008, the reconnect banner waits ≥ 10 s |

**Toast + `sfx.error` + error haptic** (3 s): `NOT_HOST`, `WRONG_PHASE`, `NOT_YOUR_TURN`, `NOT_ALIVE`, `INVALID_TARGET`, `INVALID_SETTINGS`, `NOT_ENOUGH_PLAYERS`, `INVALID_ROLE_CONFIG`, `NO_WORDS_AVAILABLE`, `ALREADY_JOINED`, `NOT_AUTHENTICATED`, `BAD_MESSAGE`, `INTERNAL`. `TV_AUTH_FAILED` never reaches a phone.

### PH-15 Paused (overlay) **[not in v1]**
Needs a protocol v2 PAUSE action. The TV pause menu is local in v1, so phones show nothing.

### PH-16 Reconnecting overlay
```text
+------------------------------------+
| [KXQP]     [*] Lina            ... |
|  .  .  .  (screen dimmed, blurred) |
|                                    |
|                                    |
|       +------------------------+   |
|       |   (refresh, spinning)  |   |
|       |    Reconnecting...     |   |
|       |  Your seat is saved.   |   |
|       +------------------------+   |
|                                    |
|                                    |
|  .  .  .                           |
+------------------------------------+
```
- It appears **400 ms after** the socket closes (so brief blips stay invisible). The current screen is blurred with `backdrop-filter: blur(6px)` behind a 70 % scrim. The overlay **never shows the word**: if PH-04 was held, the reveal is cancelled.
- **Reconnect strategy** (RESEARCH §4): reconnect immediately on `visible`, `online` and `pageshow`, then back off. After 20 s: "Still trying… Check your Wi-Fi or mobile data." with [Reload]. On success: a 600 ms `success` check toast "Back in!", then the snapshot renders the right screen.
- In-game seats are held until the room returns to the lobby (SPEC §0.3). If the seat is gone by then, the resume returns `RESUME_INVALID` and the phone shows the Join form (LOBBY) or the locked variant.

### PH-17 Menu sheet and language switcher
```text
+------------------------------------+
| +--------------------------------+ |
| |  Language                      | |
| |  ( ) English                   | |
| |  (o) Francais                  | |
| |  ( ) [arabic: al-arabiyya]     | |
| |  ------------------------------| |
| |  Vibration              [ on ] | |
| |  ------------------------------| |
| |  Leave the game            >   | |
| +--------------------------------+ |
+------------------------------------+
```
- A bottom sheet (`radius.xl` top corners, drag handle, `elev.3`). It's opened by "⋯" in the top bar, and on PH-01 and PH-02 by the globe chip.
- **Language labels are always written in their own language** ("English", "Français", "العربية") and never translated. The default comes from `navigator.languages` (first match of `ar`/`fr`/`en`, otherwise `en`). It is saved to localStorage and sent as `locale` on join. Switching it sets `<html lang dir>` immediately, with a 150 ms cross-fade and no reload.
- **The language is per device.** The word language is a room setting, so a French phone in an AR-words room shows French UI with Arabic words. The word card sets `lang="ar" dir="rtl"` on the word element itself.
- **Leave the game** goes through a confirm ("Leave? Your seat will be freed.") → `LEAVE`.
- Phone sounds, reduce-motion override and How to play are **[not in v1]**; reduced motion follows the system setting.

---

## 9. Shared component inventory
Same names on both platforms, so design QA, code and tests talk about the same things.

| Component | TV (Compose; `ui/components/`) | Phone (Preact; `src/ui/`) | Notes |
|---|---|---|---|
| Button (primary / secondary / danger / ghost) | `MishButton(kind)` on `androidx.tv.material3.Button` | `<Button kind>` | Pill. Primary = `primary` fill + ink label. Secondary = `surface` + `text`. Danger = `danger` outline → fill on focus/press |
| Avatar | `Avatar(player, size, state)` | `<Avatar>` | §5.2 states |
| Player tile | `PlayerTile` | `<PlayerRow>` (list form) | TV tile; phone row |
| Role card | `RoleCard(role, faceUp)` | `<RoleCard>` | Emblem + pattern + label |
| Word card | — (never on TV) | `<WordCard>` | Hold-to-peek |
| Timer ring | `TimerRing(deadline, total)` | — | Clockwise in every locale |
| Timer bar | `TimerBar` | `<TimerBar>` | Mirrors in RTL |
| Order strip | `OrderStrip` | `<OrderStrip>` | Reading direction |
| Room code | `RoomCode(code, size)` | `<RoomCodeChip>` | Always LTR |
| QR panel | `QrPanel(url)` | — | ZXing BitMatrix → `Canvas` |
| Stamp | `Stamp(text, color)` | — | −8°, `ease.overshoot` |
| Vote chip | `VoteChip(from, to)` | — | Bézier flight |
| Toast | `ToastHost` (bottom start, max 2) | `<Toast>` (top, under the top bar) | 3 s; never holds focus |
| Banner (status) | `StatusBanner` | `<Banner>` | Connection, pause, "you're next" |
| Dialog / sheet | `MishDialog` | `<Sheet>` | Safe option first |
| Setting row | `SettingRow(label, value, onPrev, onNext)` | `<Segmented>` / `<Stepper>` / `<Switch>` | Same keys and values |

---

## 10. RTL rules (Arabic)

**Mechanics**
- **Web:** `<html lang="ar" dir="rtl">`, logical CSS properties only (`margin-inline-start`, `inset-inline-end`, `text-align: start`), and `:dir(rtl)`/`[dir=rtl]` for icon flips. Player names use `<bdi>`, and inputs use `dir="auto"`.
- **TV:** `android:supportsRtl="true"` and per-app locale. Compose `Row`, `padding(start=…)` and `Arrangement.Start` mirror automatically through `LocalLayoutDirection`. **Never use `left`/`right` or `absoluteOffset`** except for the explicit "doesn't mirror" items below. For those, wrap the subtree in `CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr)`.

| Mirrors in RTL | Does **not** mirror |
|---|---|
| Overall layout: the lobby QR panel moves to the **right** and the player grid fills from the right | **QR code** (never flip a QR: it wouldn't scan) |
| Grids and lists fill from inline-start (top-right first) | **Room code** `KXQP` and the join URL (LTR isolates) |
| The speaking-order strip and its chevrons (order reads right → left) | **Digits and numbers**, including the "4 / 7" counters. Use Western digits. In RTL "4 / 7" still reads "4 / 7" in an LTR isolate |
| Linear timer bars (deplete toward inline-start) | **Timer rings**: always clockwise, starting at 12 o'clock (the clock metaphor is universal) |
| Directional icons: arrows, chevrons, `speech` tail, `vote` finger, `door-out`, `volume` | `play`, `check`, `refresh`, `timer`, `help` "?", the logo/wordmark (it has its own AR variant), avatar glyphs (the crescent and bolt keep their shape) |
| Settings value chevrons (the visual left = "next" in RTL) | The vote-reveal arcs: they are geometry from voter tile to target tile, so they follow wherever the tiles are |
| Toast position (bottom-start = bottom-right) | Confetti and particles (non-directional) |
| The score table's column order (rank on the right) | Media-like sequences: the wheel spins clockwise everywhere |
| Phone sheets, the top bar (code chip on the right, menu on the left) | Latin words inside AR (e.g. a FR word pack in an AR UI keeps its own direction via `lang`/`dir` on the element) |
| Swipe directions on the phone (none in v1; reserved) | |

**Bidi pitfalls to test (screenshot tests in M4)**
1. `"{name} معنا!"` with a Latin name ("Rami معنا!"): check that the name is isolated and the "!" stays at the visual left.
2. Arabic names in FR/EN copy ("Lina" → "لينا is out!") need the same isolation.
3. "4 / 7 جاهزين": the numbers stay in LTR order inside the RTL sentence.
4. A mixed word card (an EN pack in an AR UI) must be left-aligned inside a centred card. Centring hides most issues; keep the word centred.
5. A punctuation-only name ("!!!") must render the same as on the TV.
6. A billing string with `{price}` and `{date}` in AR (e.g. `store.legalTrialRenew` and `store.renewsOn` with "US$29.99" and a Western-digit date): both values are bidi-isolated and keep their LTR order (PAYMENTS-SPEC §4.7).

---

## 11. Accessibility

| Area | Requirement |
|---|---|
| **Contrast** | All text pairs in §2.4 meet AA (≥ 4.5:1), most AAA. UI graphics and required borders meet ≥ 3:1 (`outlineStrong`, player colors on `surface`). Ratios are computed by `tools/check-contrast` in CI (§13.4) |
| **Text scaling (TV)** | Sizes are in `sp`. Layouts must survive the system **font scale 1.3** without clipping: tiles truncate with an ellipsis, buttons grow taller (min height, not fixed height), and the settings panel scrolls. M3 includes a screenshot test at 1.3, with 12 players on TV-02, TV-06 and TV-11 |
| **Text scaling (phone)** | Sizes are in `rem`. The layout must work at **200 % browser text size** with no horizontal scroll at 320 px width: the action bar wraps its label to 2 lines and the word card text uses `clamp()` and `overflow-wrap: anywhere` |
| **Colour independence** | Roles = color + emblem + pattern + label. Players = color + shape + name. Timers = color + numerals + (sound). Vote state = check icon, not a color. Selected = border + check. The CVD verification is in §2.3 |
| **Screen readers (phone)** | Landmarks: `header` (top bar), `main`, `footer` (action bar). Each screen's `<h1>` is focused on a phase change. Live regions as in §8. Avatars: `aria-hidden` on the glyph, with the label in text ("Lina, Lemon star, host"). Timers: `role="timer"`, `aria-live="off"`, plus milestone announcements at 10 s and 5 s through the polite region. The vote list is a `radiogroup` whose rows are labelled with name + state ("Rami, away"). Hold-to-peek has its accessible alternative (PH-04). Icon-only buttons have `aria-label` (e.g. "Menu", "Language") |
| **Screen readers (TV)** | `contentDescription` / `semantics { }` on tiles ("Maya, host, ready"). Phase changes announced with `liveRegion = LiveRegionMode.Polite` on the phase title. Purely decorative animation nodes are `clearAndSetSemantics {}` |
| **Motor** | Touch targets ≥ 48 px. No gesture-only actions: hold-to-peek has a tap alternative, and nothing is swipe-only. The DONE guard (1.5 s) prevents tremor double-taps from ending the next turn. Every timer can be turned Off (the host then advances) |
| **Cognitive** | One instruction per screen. The rules are explained in Settings next to each option. Beginner mode reveals roles. How-to-play (M4) will be reachable from the lobby on both devices |
| **Reduced motion and flashes** | §6.3. **No flashing above 3 Hz anywhere**; the "correct" flash is a single 25 % white pulse |
| **Audio** | Every sound has a visual counterpart; the game is fully playable muted. Volume and mute controls arrive with the sounds in M4 |
| **Language** | `lang` is set on the root and on mixed-language elements (word cards, names) so screen readers switch voices |

---

## 12. Microcopy (FR and AR seed for `shared/i18n/{fr,ar}.json`)

**Conventions**
- **Keys and EN text live in SPEC §11.2**, which is authoritative and lists every key B and C may use. This table gives the **FR and AR drafts for exactly those keys**, in the same order. Agent D seeds `fr.json` and `ar.json` from it.
- Placeholders use SPEC syntax: `{name}`, `{count}`, `{code}`, etc. `{count}` is the plural selector and is formatted with Western digits. Counted strings are plural objects ("P", with the categories shown); AR `zero`/`one`/`two` forms may omit `{count}` (SPEC §11.1 union rule).
- There is no `.tv` / `.ph` key suffix. TV-only keys (`tv.*`, and copy addressed to the room) use FR *vous* and AR plural; phone-only keys (`phone.*`, `join.*`, `reveal.yourWord`, …) use FR *tu*.
- **FR:** a space before `! ? : ;` in this table stands for **U+202F (narrow no-break space)**; D writes the real character. Use `« »` with U+202F inside, and `’` (U+2019) apostrophes in the final JSON.
- **AR:** light Lebanese colloquial, gender-neutral per §1.5, Western digits. These are **drafts for the user's review** (approved Q7).

| Key | FR | AR |
|---|---|---|
| **Brand, common, language** | | |
| `brand.appName` | Mish Ana ! | مش أنا! |
| `brand.tagline` | Le jeu d'ambiance du mot secret | لعبة الكلمة السرّية للسهرات |
| `brand.slogan` | Tout le monde est innocent. Quelqu'un ment. | كلّنا أبرياء… بس في حدا عم يكذب. |
| `common.ok` | OK | تمام |
| `common.cancel` | Annuler | إلغاء |
| `common.back` | Retour | رجوع |
| `common.close` | Fermer | سكّر |
| `common.continue` | Continuer | كمّل |
| `common.done` | Terminé | خلصت |
| `common.retry` | Réessayer | منجرّب مرة تانية |
| `common.on` | Activé | شغّال |
| `common.off` | Désactivé | مطفي |
| `common.loading` | Chargement… | عم يحمّل… |
| `common.you` | Toi | انت |
| `common.host` | Hôte | المضيف |
| `common.away` | Hors ligne | برّا الخط |
| `common.timerOff` | Sans chrono | بلا وقت |
| `common.seconds` | P one: `{count} seconde` · other: `{count} secondes` | P zero: `{count} ثانية` · one: `ثانية وحدة` · two: `ثانيتين` · few: `{count} ثواني` · many: `{count} ثانية` · other: `{count} ثانية` |
| `common.points` | P one: `{count} point` · other: `{count} points` | P zero: `{count} نقطة` · one: `نقطة وحدة` · two: `نقطتين` · few: `{count} نقاط` · many: `{count} نقطة` · other: `{count} نقطة` |
| `common.aliveCount` | P one: `{count} en jeu` · other: `{count} en jeu` | P zero: `ما حدا باللعبة` · one: `واحد باللعبة` · two: `اتنين باللعبة` · few: `{count} باللعبة` · many: `{count} باللعبة` · other: `{count} باللعبة` |
| `common.language` | Langue | اللغة |
| `lang.en` | English | English |
| `lang.fr` | Français | Français |
| `lang.ar` | العربية | العربية |
| `round.label` | Tour {count} | الجولة {count} |
| `game.label` | Partie {count} | اللعبة {count} |
| **Roles, teams, winners, colours, phases** | | |
| `role.civilian` | Civil | مدني |
| `role.undercover` | Taupe | جاسوس |
| `role.blank` | Blanc | فاضي |
| `roleDesc.civilian` | Tu as le mot de la majorité. Trouve les infiltrés. | معك كلمة الأكثرية. المهمّة: تلاقي المندسّين. |
| `roleDesc.undercover` | Ton mot est un peu différent. Fonds-toi dans la masse. | كلمتك شوي مختلفة. المهمّة: تضيع بين الكل. |
| `roleDesc.blank` | Tu n'as pas de mot. Écoute, bluffe, et devine le mot si on te démasque. | ما في كلمة إلك. السلاح: السمع والتبليف، وإذا انكشف أمرك في فرصة تحزر الكلمة. |
| `team.civilians` | Civils | المدنيين |
| `team.infiltrators` | Infiltrés | المندسّين |
| `winner.civilians` | Les Civils gagnent ! | ربحوا المدنيين! |
| `winner.infiltrators` | Les infiltrés gagnent ! | ربحوا المندسّين! |
| `winner.blank` | Le Blanc gagne : {name} ! | ربح الفاضي: {name}! |
| `color.coral` | Corail | مرجاني |
| `color.azure` | Azur | أزرق |
| `color.lemon` | Citron | ليموني |
| `color.jade` | Jade | يشمي |
| `color.grape` | Raisin | عنبي |
| `color.tangerine` | Mandarine | يافاوي |
| `color.aqua` | Turquoise | تركوازي |
| `color.rose` | Rose | زهري |
| `color.mint` | Menthe | نعناعي |
| `color.plum` | Prune | خوخي |
| `color.sand` | Sable | رملي |
| `color.lilac` | Lilas | ليلكي |
| `phase.lobby` | Salon | الصالون |
| `phase.roleReveal` | Mots secrets | الكلمات السرّية |
| `phase.clues` | Indices | تلميحات |
| `phase.voting` | Vote | التصويت |
| `phase.tieBreak` | Départage | كسر التعادل |
| `phase.elimination` | Élimination | الإقصاء |
| `phase.mrWhiteGuess` | Dernière chance | الفرصة الأخيرة |
| `phase.results` | Résultats | النتايج |
| **Lobby** | | |
| `lobby.scanToJoin` | Scannez pour jouer | امسحوا الكود وفوتوا |
| `lobby.orVisit` | ou allez sur {url} et tapez le code | أو روحوا على {url} واكتبوا الكود |
| `lobby.roomCode` | Code de la salle | كود الغرفة |
| `lobby.playerCount` | Joueurs {count}/{max} | اللاعبين {count}/{max} |
| `lobby.needPlayers` | P one: `Encore {count} joueur` · other: `Encore {count} joueurs` | P zero: `ما ناقصنا حدا` · one: `ناقصنا لاعب واحد` · two: `ناقصنا لاعبين اتنين` · few: `ناقصنا {count} لاعبين` · many: `ناقصنا {count} لاعب` · other: `ناقصنا {count} لاعب` |
| `lobby.blockerRoles` | Les rôles ne collent pas au nombre de joueurs | الأدوار ما بتركب على هالعدد |
| `lobby.blockerWords` | Aucun mot ne correspond à ces réglages | ما في كلمات بتناسب هالإعدادات |
| `lobby.startGame` | Lancer | يلّا نبلّش |
| `lobby.startAll` | Tout le monde est là, on y va ! | كلّنا هون، يلّا! |
| `lobby.waitingPlayers` | En attente des joueurs… | ناطرين اللاعبين… |
| `lobby.waitingHost` | On attend que l'hôte lance la partie… | ناطرين المضيف يبلّش… |
| `lobby.hostIs` | {name} est l'hôte | المضيف: {name} |
| `lobby.roleSummary` | Civils {civilian} · Taupes {undercover} · Blancs {blank} | مدنيين {civilian} · جواسيس {undercover} · فاضي {blank} |
| `lobby.kick` | Retirer | برّا |
| `lobby.kickConfirm` | Retirer {name} ? | نطلّع {name}؟ |
| `lobby.kickBody` | Cette personne pourra revenir avec le code, au salon. | الرجعة بالكود ممكنة بالصالون. |
| `lobby.settings` | Réglages | الإعدادات |
| `lobby.joined` | {name} est là ! | {name} معنا! |
| `lobby.left` | {name} a quitté la salle | باي {name}! |
| `lobby.full` | Salle complète | الغرفة فوّلت |
| `lobby.youreIn` | C'est bon, t'es dedans ! | أهلا وسهلا! انت معنا. |
| `lobby.lookTv` | Regarde la télé : ta case est là. | عالتلفزيون: إسمك صار هونيك. |
| `lobby.youHostSub` | Lance quand tout le monde est là. | البداية بإيدك لمّا الكل يوصل. |
| **Settings** | | |
| `settings.title` | Réglages de la partie | إعدادات اللعبة |
| `settings.catGame` | Partie | اللعبة |
| `settings.catRoles` | Rôles | الأدوار |
| `settings.catTimers` | Chronos | التوقيت |
| `settings.catWords` | Mots | الكلمات |
| `settings.catAbout` | À propos | حول |
| `settings.installId` | ID d’installation | رقم التثبيت |
| `settings.installIdHelp` | Le support peut te demander cet identifiant pour débloquer tes achats sur cette télé. | ممكن الدعم يطلب منك هالرقم ليفتح المشتريات على هالتلفزيون. |
| `settings.appVersion` | Version | النسخة |
| `settings.winRule` | Règle de victoire | شرط الربح |
| `settings.winRuleOfficial` | Officielle (1 Civil restant) | الرسمي (بيبقى مدني واحد) |
| `settings.winRuleParity` | Parité (autant que les Civils) | قدّ بقدّ (عددهن قد المدنيين) |
| `settings.winRuleOfficialHelp` | Les infiltrés gagnent quand il ne reste qu'un seul Civil. | المندسّين بيربحوا لمّا يبقى مدني واحد بس. |
| `settings.winRuleParityHelp` | Les infiltrés gagnent dès qu'ils sont aussi nombreux que les Civils. | المندسّين بيربحوا أوّل ما يصير عددهن قد المدنيين. |
| `settings.revealRoles` | Mode débutant (voir les rôles) | وضع المبتدئين (بيبيّن الأدوار) |
| `settings.roleMode` | Rôles | الأدوار |
| `settings.roleModeAuto` | Automatique | تلقائي |
| `settings.roleModeCustom` | Personnalisé | مخصّص |
| `settings.undercoverCount` | Taupes | الجواسيس |
| `settings.blankCount` | Blancs | الفاضيين |
| `settings.rolePreview` | Avec {count} joueurs : {civilian} Civils · {undercover} Taupes · {blank} Blanc | مع {count} لاعبين: {civilian} مدنيين · {undercover} جواسيس · {blank} فاضي |
| `settings.clueSeconds` | Tour d'indice | دور التلميح |
| `settings.voteSeconds` | Vote | التصويت |
| `settings.revealSeconds` | Lecture du mot | قراءة الكلمة |
| `settings.guessSeconds` | Essai du Blanc | محاولة الفاضي |
| `settings.timerOffHelp` | Désactivé = l'hôte décide quand on avance. | مطفي = المضيف بيقرّر إيمتى منكمّل. |
| `settings.tieBreak` | Si le revote est encore à égalité | إذا رجع التعادل بالتصويت التاني |
| `settings.tieBreakRandom` | Tirage au sort | قرعة |
| `settings.tieBreakNone` | Personne ne sort | ما حدا بيطلع |
| `settings.blankGuess` | Le Blanc éliminé peut deviner le mot | الفاضي إذا طلع فيه يحزر الكلمة |
| `settings.wordLocale` | Langue des mots | لغة الكلمات |
| `settings.packs` | Paquets de mots | باقات الكلمات |
| `settings.allPacks` | Tous les paquets | كل الباقات |
| `settings.packTeen` | Ados | للمراهقين |
| `settings.difficulty` | Difficulté | الصعوبة |
| `settings.difficulty1` | Facile | سهل |
| `settings.difficulty2` | Moyen | وسط |
| `settings.difficulty3` | Subtil | دقيق |
| `settings.familyFilter` | Tout public | مناسب للعيلة |
| `settings.swapSides` | Mélanger les camps des mots | خلط جهات الكلمات |
| `settings.points` | Points des gagnants | نقاط الرابحين |
| `settings.applies` | Les changements s'appliquent à cette partie. | التغييرات بتمشي على هاللعبة. |
| `settings.changedBy` | {name} a changé {setting} → {value} | {name}: {setting} ← {value} |
| **Join (phone)** | | |
| `join.title` | Rejoindre une partie | يلّا عالسهرة! |
| `join.enterCode` | Tape le code affiché sur la télé | الكود اللي عالتلفزيون: |
| `join.codeLabel` | Code | الكود |
| `join.codeInvalid` | Le code n'a que des lettres, jamais I, L ni O. | الكود حروف بس، بلا I ولا L ولا O. |
| `join.next` | Suivant | التالي |
| `join.joiningCode` | Tu rejoins {code} | عالطريق لـ{code} |
| `join.nameLabel` | Ton prénom | اسمك |
| `join.namePlaceholder` | Surnom | لقب |
| `join.colorLabel` | Ta couleur | لونك |
| `join.colorTaken` | Cette couleur vient d'être prise. Choisis-en une autre. | هاللون راح هلّق. في غيرو؟ |
| `join.submit` | C'est parti ! | فوّتني! |
| `join.joining` | Connexion… | عم نفوت… |
| `join.resuming` | Retour à ta place… | عم نرجّعك عمحلّك… |
| `join.locked` | Une partie est en cours. Tu pourras rejoindre à la fin. | في لعبة عم تصير. الدخول بعد ما تخلص. |
| `join.unlocked` | Tu peux rejoindre ! | الدخول صار ممكن! |
| **Role reveal** | | |
| `reveal.yourWord` | Ton mot secret | كلمتك السرّية |
| `reveal.holdToSee` | Appuie longuement pour voir ton mot | كبسة طويلة… وبتبيّن كلمتك |
| `reveal.release` | Relâche pour cacher | بتختفي مع رفع الإصبع |
| `reveal.privacy` | Vérifie que personne ne regarde. | الأحسن ما حدا يكون عم يتطلّع. |
| `reveal.firstTime` | C'est ton mot. Ne le montre à personne. | هيدي كلمتك. ما حدا لازم يشوفها. |
| `reveal.noWord` | Pas de mot pour toi. | ما في كلمة إلك. |
| `reveal.youAreBlank` | Tu es le Blanc | دورك: الفاضي |
| `reveal.blankBody` | Écoute. Fonds-toi dans la masse. Bluffe. | سلاحك: السمع، التمثيل، والتبليف. |
| `reveal.yourRole` | Ton rôle : {role} | دورك: {role} |
| `reveal.ready` | C'est bon | تمام |
| `reveal.tapAlt` | Ou touche pour l'afficher 5 s | أو كبسة وحدة لـ5 ثواني |
| `reveal.showFor5` | Afficher mon mot 5 secondes | فرجيني كلمتي 5 ثواني |
| `reveal.waitingOthers` | C'est noté ! On attend les autres… | تمام! ناطرين الباقيين… |
| `reveal.readyCount` | {ready}/{total} prêts | {ready}/{total} جاهزين |
| `reveal.checkPhones` | Regardez vos téléphones ! | شوفوا تلفوناتكن! |
| `reveal.checkBody` | Maintenez la carte pour voir votre mot secret. Ne le montrez à personne ! | كبسوا عالكرت وضلّوا ماسكين لتشوفوا كلمتكن السرّية. ما تفرجوها لحدا! |
| `reveal.blankHint` | Le Blanc n'a pas de mot… et doit bluffer. | الفاضي ما عندو كلمة… ولازم يبلّف. |
| **Clues** | | |
| `clues.rule` | Un mot ou une courte phrase. Sans dire le mot ! | كلمة وحدة أو جملة قصيرة. بلا ما تقولوا الكلمة! |
| `clues.firstHint` | Écoutez bien. Quelqu'un a un autre mot… ou pas de mot du tout. | سمعوا منيح. في حدا كلمته غير… أو ما عندو كلمة أصلاً. |
| `clues.speaking` | L'indice de {name} | دور {name} |
| `clues.speakerSub` | À voix haute, puis « Terminé » | بصوت عالي، وبعدها «خلصت» |
| `clues.noTimer` | Sans chrono : « Terminé » quand c'est fini | بلا وقت: «خلصت» لمّا يخلص الدور |
| `clues.nowSpeaking` | C'est au tour de | الدور هلّق |
| `clues.upNext` | Ensuite : {name} | بعدو: {name} |
| `clues.youreNext` | Ton tour arrive. Prépare ton indice. | الدور الجاي إلك! |
| `clues.listen` | Écoute bien. Qui sonne faux ? | مين عم يغرّد برّا السرب؟ |
| `clues.yourTurn` | À toi ! | دورك! |
| `clues.yourTurnBody` | Dis un mot ou une courte phrase sur ton mot. | كلمة أو جملة قصيرة عن كلمتك، بصوت عالي. |
| `clues.blankBody` | Bluffe ! Inspire-toi des indices des autres. | وقت التبليف! تلميحات الباقيين بتساعد. |
| `clues.done` | Terminé | خلصت |
| `clues.peek` | Maintenir pour revoir mon mot | كبسة طويلة لشوف كلمتي |
| `clues.skipTurn` | Passer le tour | نطّ الدور |
| `clues.skipped` | {name} n'est pas là, on passe | {name} مش هون، منكمّل |
| **Vote and tie** | | |
| `vote.title` | Qui n'est pas des nôtres ? | مين مش منّا؟ |
| `vote.sub` | Votez sur vos téléphones | صوّتوا عالتلفون |
| `vote.pick` | Qui ment ? | مين عم يكذب؟ |
| `vote.pickSub` | Choisis un joueur, puis valide. | نقّي حدا، وبعدها «ثبّت صوتي». |
| `vote.confirm` | Valider : {name} | ثبّت صوتي: {name} |
| `vote.locked` | Vote validé. | صوتك انحسب. |
| `vote.actNatural` | Fais comme si de rien n'était. | ولا كأنّو صار شي. |
| `vote.youVoted` | Tu as voté pour {name} | صوتك راح لـ{name} |
| `vote.progress` | {cast}/{expected} ont voté | {cast} من {expected} صوّتوا |
| `vote.tenLeft` | Plus que 10 secondes ! | باقي 10 ثواني! |
| `vote.timeUp` | Temps écoulé, vote non compté. | خلص الوقت، ما انحسب صوت. |
| `vote.lookTv` | Regarde la télé ! | العيون عالتلفزيون! |
| `vote.dead` | Tu es hors jeu. Profite du spectacle ! | انت برّا. الفرجة إلك هلّق! |
| `vote.revoteAmong` | Revote entre les ex æquo | تصويت تاني بين المتعادلين |
| `vote.close` | Clore le vote | سكّر التصويت |
| `vote.votesIn` | Les votes sont tombés… | طلعت الأصوات… |
| `vote.noVote` | Pas de vote | بلا صوت |
| `vote.nobodyVoted` | Personne n'a voté | ما حدا صوّت |
| `stamp.out` | DEHORS | برّا |
| `stamp.tie` | ÉGALITÉ ! | تعادل! |
| `tie.title` | Égalité ! | تعادل! |
| `tie.explain` | Un indice de plus chacun, puis on revote, entre eux seulement. | كل واحد بيعطي تلميح كمان، وبعدين منرجع نصوّت بس بيناتهن. |
| `tie.inTie` | Tu es à égalité : sors ton meilleur indice ! | دورك بالتعادل: وقت أحلى تلميح! |
| **Elimination and history** | | |
| `elim.eliminated` | {name} quitte la partie ! | {name} برّا! |
| `elim.wasCivilian` | {name} était Civil | {name}: مدني |
| `elim.wasUndercover` | {name} était la Taupe | {name}: الجاسوس |
| `elim.wasBlank` | {name} était le Blanc | {name}: الفاضي |
| `elim.reactionCivilian` | …un Civil. Oups. | …مدني. ضيعان! |
| `elim.reactionUndercover` | …la Taupe ! Bien vu. | …الجاسوس! برافو عليكن! |
| `elim.reactionBlank` | …le Blanc ! Mais attendez, une dernière chance… | …الفاضي! بس استنّوا… في فرصة أخيرة. |
| `elim.reactionBlankNoGuess` | …le Blanc ! | …الفاضي! |
| `elim.noElimination` | Personne ne sort ce tour-ci | ما حدا طلع هالجولة |
| `elim.randomPick` | Toujours égalité : place au hasard ! | بعدو تعادل؟ خلّي الحظ يقرّر! |
| `elim.abstained` | P one: `{count} n'a pas voté` · other: `{count} n'ont pas voté` | P zero: `الكل صوّت` · one: `واحد ما صوّت` · two: `اتنين ما صوّتوا` · few: `{count} ما صوّتوا` · many: `{count} ما صوّتوا` · other: `{count} ما صوّتوا` |
| `elim.nextRound` | Prochain tour dans {count}… | الجولة الجاية بعد {count}… |
| `elim.you` | Fin de partie pour toi | خلصت اللعبة إلك |
| `elim.youWere` | Ton rôle : {role} | كان دورك: {role} |
| `elim.stay` | Reste pour la suite. Sans souffler, hein ! | الفرجة مسموحة… بس بلا تلميحات! |
| `elim.forfeit` | {name} a quitté la partie ({role}) | {name} برّا اللعبة ({role}) |
| `history.title` | Le fil de la partie | شو صار |
| `history.left` | {name} a quitté la partie | {name} برّا اللعبة |
| `history.kicked` | L'hôte a retiré {name} | المضيف طلّع {name} |
| **Blank guess** | | |
| `guess.title` | Le Blanc a droit à un essai | الفاضي إلو محاولة وحدة |
| `guess.guessing` | {name} cherche le mot des Civils… | {name}: المحاولة الأخيرة لكلمة المدنيين… |
| `guess.silence` | Silence, s'il vous plaît ! | هس… سكوت! |
| `guess.waiting` | {name} est le Blanc et a un essai. Chut… | الفاضي: {name}. إلو محاولة وحدة. هس… |
| `guess.prompt` | Quel est le mot des Civils ? | شو كلمة المدنيين؟ |
| `guess.placeholder` | Ta réponse | جوابك |
| `guess.spelling` | Pas besoin d'une orthographe parfaite. | مش ضروري الإملا تكون مزبوطة. |
| `guess.submit` | C'est ma réponse | هيدا جوابي |
| `guess.sent` | Envoyé ! Dis ta réponse à voix haute. | انبعت! هلّق الجواب بصوت عالي للكل. |
| `guess.correct` | Le Blanc a trouvé ! | الفاضي عرفها! |
| `guess.correctYou` | Trouvé ! Tu gagnes ! | مزبوط! الربح إلك! |
| `guess.wrong` | Raté ! La partie continue. | غلط! اللعبة مكمّلة. |
| `guess.wrongYou` | Pas tout à fait. La partie continue. | مش هيك. اللعبة مكمّلة. |
| `guess.timeout` | Temps écoulé ! Pas de réponse. | خلص الوقت! ما في جواب. |
| `guess.accept` | On l'accepte ! | منقبلها! |
| `guess.acceptConfirm` | Accepter la réponse de {name} ? Le Blanc gagne. | منقبل جواب {name}؟ الفاضي بيربح. |
| `guess.reject` | Refusé | ما بتنحسب |
| `guess.rejectConfirm` | Refuser la réponse ? La partie continue. | منرفض الجواب؟ اللعبة مكمّلة. |
| `guess.overridden` | Décision de l'hôte | قرار المضيف |
| `guess.skip` | Passer | تخطّي |
| `guess.guessed` | {name} a proposé : {text} | جواب {name}: {text} |
| **Results** | | |
| `results.title` | Fin de la partie | خلصت اللعبة |
| `results.civilianWord` | Mot des Civils | كلمة المدنيين |
| `results.undercoverWord` | Mot de la Taupe | كلمة الجاسوس |
| `results.scoreboard` | Classement | الترتيب |
| `results.colRank` | # | # |
| `results.colPlayer` | Joueur | اللاعب |
| `results.colRole` | Rôle | الدور |
| `results.colGame` | Cette partie | هاللعبة |
| `results.colTotal` | Total | المجموع |
| `results.pointsEarned` | +{count} | +{count} |
| `results.youWon` | Gagné ! +{count} | الربح إلك! +{count} |
| `results.youLost` | Perdu pour cette fois | مش هالمرة… |
| `results.playAgain` | Rejouer | كمان جولة! |
| `results.changeSettings` | Modifier les réglages | تغيير الإعدادات |
| `results.newRoom` | Nouvelle salle | غرفة جديدة |
| `results.newRoomConfirm` | Ouvrir une nouvelle salle ? Les joueurs devront utiliser le nouveau code. | نفتح غرفة جديدة؟ اللاعبين بدّن الكود الجديد. |
| `results.waitingHost` | On attend que l'hôte relance une partie… | ناطرين المضيف يبلّش اللعبة الجاية… |
| `results.pack` | Paquet : {title} | الباقة: {title} |
| **Connection** | | |
| `conn.connecting` | Connexion… | عم نتّصل… |
| `conn.reconnecting` | Reconnexion… | عم نرجع نوصل… |
| `conn.lost` | Connexion perdue | انقطع الاتصال |
| `conn.tvReconnecting` | Reconnexion au serveur… | عم نرجع نتّصل بالسيرفر… |
| `conn.tvLostBody` | Vérifiez la connexion de la télé. La salle est gardée un moment : vos joueurs y restent. | شيكوا عالإنترنت تبع التلفزيون. الغرفة محفوظة شوي، واللاعبين بعدن فيها. |
| `conn.cantReach` | Impossible de joindre le serveur. | ما عم نقدر نوصل عالسيرفر. |
| `conn.playerAway` | {name} a perdu la connexion. Sa place est gardée. | انقطع الخط مع {name}. المحلّ محفوظ. |
| `conn.phonesAsleep` | Les téléphones dorment ? Réveillez-les, la partie attend. | التلفونات نايمة؟ فيّقوها، اللعبة ناطرة. |
| `conn.seatSaved` | Ta place est gardée. | محلّك محفوظ. |
| `conn.stillTrying` | On essaie encore… Vérifie ton Wi-Fi ou tes données. | بعدنا عم نحاول… الواي فاي أو الداتا شغّالين؟ |
| `conn.back` | De retour ! | رجعنا! |
| `conn.reload` | Recharger | حمّل من جديد |
| **TV only** | | |
| `tv.creatingRoom` | Ouverture de la salle… | عم نفتح الغرفة… |
| `tv.createFailed` | Impossible de créer une salle. Vérifiez la connexion. | ما قدرنا نفتح غرفة. شيكوا عالإنترنت. |
| `tv.newRoom` | Nouvelle salle | غرفة جديدة |
| `tv.newCode` | Nouveau code : {code} | كود جديد: {code} |
| `tv.startNow` | Commencer | يلّا هلّق |
| `tv.pressAgain` | Appuyez encore sur OK pour confirmer | كبسوا OK مرّة تانية للتأكيد |
| `tv.skipHint` | Appuyez sur OK pour passer | OK للتخطّي |
| `tv.cluesSub` | Dites-le à voix haute, puis terminez le tour sur votre téléphone | قولوها بصوت عالي، وبعدها خلّصوا الدور من التلفون |
| `tv.cluesNoTimer` | Sans chrono : terminez le tour sur votre téléphone quand c'est fini | بلا وقت: خلّصوا الدور من التلفون لمّا تخلصوا |
| `tv.pauseTitle` | Menu de la partie | قائمة اللعبة |
| `tv.pauseNote` | La partie continue | اللعبة مكمّلة |
| `tv.resume` | Reprendre | كمّل |
| `tv.skip` | Passer (tour / chrono) | تخطّي (الدور / الوقت) |
| `tv.players` | Joueurs… | اللاعبين… |
| `tv.endGame` | Terminer la partie | وقّف اللعبة |
| `tv.endGameConfirm` | Terminer cette partie ? | نوقّف هاللعبة؟ |
| `tv.endGameBody` | Personne ne marque. Retour au salon. | ما حدا بيسجّل نقاط. منرجع عالصالون. |
| `tv.keepPlaying` | Continuer | منكمّل |
| `tv.exitApp` | Quitter | خروج |
| `tv.roomClosed` | Cette salle est fermée | هالغرفة تسكّرت |
| `tv.debugTitle` | Réglages de débogage | إعدادات التصحيح |
| `tv.serverUrl` | URL du serveur | عنوان السيرفر |
| **Phone only** | | |
| `phone.menu` | Menu | القائمة |
| `phone.leave` | Quitter la partie | طلوع من اللعبة |
| `phone.leaveConfirm` | Quitter ? Ta place sera libérée. | طلوع؟ محلّك رح يفضى. |
| `phone.youAreHost` | C'est toi l'hôte | معك التحكّم |
| `phone.keepScreenOn` | Garde l'écran allumé pendant la partie | خلّي الشاشة ضاوية خلال اللعبة |
| `phone.vibration` | Vibration | الهزّاز |
| `phone.kicked` | L'hôte t'a retiré de la salle | المضيف طلّعك من الغرفة |
| `phone.kickedBody` | Demande à l'hôte si c'est une erreur. | إذا غلطة، احكي مع المضيف. |
| `phone.roomGone` | Cette salle est fermée | هالغرفة تسكّرت |
| `phone.roomGoneBody` | Merci d'avoir joué ! | يسلموا عاللعب! |
| `phone.noRoom` | Aucune salle {code} | ما في غرفة اسمها {code} |
| `phone.goHome` | Rejoindre une autre partie | لعبة تانية |
| `phone.differentCode` | Entrer un autre code | كود تاني |
| `phone.replaced` | Cette partie est ouverte dans un autre onglet ou téléphone. | اللعبة مفتوحة بمحلّ تاني (تاب أو تلفون). |
| `phone.useHere` | L'utiliser ici | رجّعها لهون |
| **Errors (one per §6.4 code, in table order)** | | |
| `error.badMessage` | Ce message n'est pas valide. | في شي غلط بهالرسالة. |
| `error.unsupportedVersion` | Mise à jour nécessaire. Recharge pour la dernière version. | لازم تحديث. حمّل من جديد. |
| `error.notAuthenticated` | Rejoins d'abord la salle. | الدخول عالغرفة أوّل. |
| `error.tvAuthFailed` | Cette télé n'est plus reliée à la salle. | هالتلفزيون ما عاد مربوط بالغرفة. |
| `error.roomNotFound` | Salle introuvable. Vérifie le code sur la télé. | ما لقينا الغرفة. الكود اللي عالتلفزيون مزبوط؟ |
| `error.roomExpired` | Cette salle est fermée. Merci d'avoir joué ! | هالغرفة تسكّرت. يسلموا عاللعب! |
| `error.roomFull` | Cette salle est complète (12 joueurs max). | الغرفة فوّلت (12 لاعب حدّ أقصى). |
| `error.roomLocked` | Une partie est en cours. Tu pourras rejoindre la suivante. | في لعبة عم تصير. الدخول بالجولة الجاية. |
| `error.alreadyJoined` | Tu as déjà rejoint la salle. | انت أصلاً جوّا. |
| `error.nameInvalid` | Choisis un prénom (1 à 16 caractères). | اسم من 1 لـ16 حرف. |
| `error.nameTaken` | Ce prénom est déjà pris. Ajoute une initiale ? | هالاسم مأخود. منزيد حرف؟ |
| `error.colorTaken` | Cette couleur vient d'être prise. Choisis-en une autre. | هاللون راح هلّق. في غيرو؟ |
| `error.resumeInvalid` | Ta place a expiré. Rejoins la partie. | راح محلّك. الدخول من جديد. |
| `error.kicked` | L'hôte t'a retiré de la salle. | المضيف طلّعك من الغرفة. |
| `error.replaced` | Cette partie est ouverte dans un autre onglet ou téléphone. | اللعبة مفتوحة بمحلّ تاني. |
| `error.notHost` | Seul l'hôte peut faire ça. | هيدي للمضيف بس. |
| `error.wrongPhase` | Pas possible pour l'instant. | مش وقتها هلّق. |
| `error.notYourTurn` | Ce n'est pas ton tour. | مش دورك. |
| `error.notAlive` | Tu es hors jeu pour cette partie. | انت برّا هاللعبة. |
| `error.invalidTarget` | Impossible de choisir ce joueur. | هالاختيار مش ممكن. |
| `error.invalidSettings` | Ces réglages ne sont pas valides. | هالإعدادات ما بتمشي. |
| `error.notEnoughPlayers` | Il faut au moins 3 joueurs connectés. | لازم 3 لاعبين متّصلين عالأقل. |
| `error.invalidRoleConfig` | Ces nombres de rôles ne collent pas au nombre de joueurs. | عدد الأدوار ما بيركب على عدد اللاعبين. |
| `error.noWordsAvailable` | Aucun mot ne correspond à ces réglages. | ما في كلمات بتناسب هالإعدادات. |
| `error.guessInvalid` | Tape une réponse (1 à 40 caractères). | جواب من 1 لـ40 حرف. |
| `error.rateLimited` | Doucement ! Réessaie dans un instant. | على مهلك! منجرّب كمان شوي. |
| `error.internal` | Un problème est survenu. Réessaie. | صار في مشكلة. منجرّب كمان مرة؟ |

**Reviewer notes for AR (open drafts).** Every AR string above was checked against the gender-neutral rule (§1.5): named-player sentences use "{name}:" or "{name} معنا!" forms instead of agreeing verbs, and buttons speak in the first person or to the app. Please confirm or replace:
- "جاسوس" (spy) for the Mole role, and "المندسّين" for the infiltrators team (§14 Q2).
- "باي {name}!" and "{name} برّا اللعبة" for a player leaving (replacing the masculine "فلّ").
- "كمان جولة!" as Play again (replacing "كمان دقّة!").
- "مين عم يغرّد برّا السرب؟" (the idiom is يغرّد, not يغنّي).
- "قدّ بقدّ" for the parity win rule (so it doesn't collide with تعادل, the tie).
- "طلوع من اللعبة" (leave) and "برّا" (remove), replacing the MSA-sounding "ترك" and "إزالة".
- "يافاوي" and "خوخي" as color names.
- "ضيعان!" for the Civilian elimination reaction.

## 13. Implementation notes

### 13.1 Web tokens: `web-client/src/styles/tokens.css`
```css
/* Written by agent B from DESIGN §2–§6. Token names must match this file exactly. */
@font-face { font-family: "Cairo"; font-weight: 600; font-display: swap;
  src: url("/fonts/cairo-600-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0152-0153, U+2013-2014, U+2018-201E, U+2026, U+202F, U+20AC; }
@font-face { font-family: "Cairo"; font-weight: 600; font-display: swap;
  src: url("/fonts/cairo-600-arabic.woff2") format("woff2");
  unicode-range: U+0600-06FF, U+200C-200F, U+FE70-FEFF; }
@font-face { font-family: "Cairo"; font-weight: 700; font-display: swap;
  src: url("/fonts/cairo-700-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0152-0153, U+2013-2014, U+2018-201E, U+2026, U+202F, U+20AC; }
@font-face { font-family: "Cairo"; font-weight: 700; font-display: swap;
  src: url("/fonts/cairo-700-arabic.woff2") format("woff2");
  unicode-range: U+0600-06FF, U+200C-200F, U+FE70-FEFF; }
@font-face { font-family: "Cairo"; font-weight: 900; font-display: swap;
  src: url("/fonts/cairo-900-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0152-0153, U+2013-2014, U+2018-201E, U+2026, U+202F, U+20AC; }
@font-face { font-family: "Cairo"; font-weight: 900; font-display: swap;
  src: url("/fonts/cairo-900-arabic.woff2") format("woff2");
  unicode-range: U+0600-06FF, U+200C-200F, U+FE70-FEFF; }

:root {
  color-scheme: dark;

  /* color — core */
  --color-bg: #120A1F;
  --color-bg-glow: #2A0F3D;
  --color-surface: #1E1430;
  --color-elevated: #2A1D42;
  --color-overlay: #362752;
  --color-scrim: rgb(18 10 31 / 0.8);
  --color-outline: #4A3A66;
  --color-outline-strong: #8A77AB;
  --color-text: #FFF7EC;
  --color-text-secondary: #CBBFDD;
  --color-text-muted: #A193B8;
  --color-ink: #120A1F;
  --color-primary: #FF3D8B;
  --color-on-primary: #120A1F;
  --color-accent: #FFC23D;
  --color-on-accent: #120A1F;
  --color-success: #3DDC97;
  --color-danger: #FF5A4E;
  --color-focus: #FFF7EC;

  /* color — roles */
  --color-civilian: #5AB8FF;
  --color-undercover: #FF8A3D;
  --color-blank: #ECE6F5;

  /* color — players (ids = SPEC §3 COLORS) */
  --player-coral: #F0183A;   --player-azure: #478CFF;   --player-lemon: #FFF04D;
  --player-jade: #1FA88A;    --player-grape: #7A43FF;   --player-tangerine: #FF7A1F;
  --player-aqua: #7BFFF4;    --player-rose: #FF96C5;    --player-mint: #BDF5C8;
  --player-plum: #C02A8F;    --player-sand: #E6C486;    --player-lilac: #C9BFFF;

  /* type */
  --font-sans: "Cairo", "Noto Sans Arabic", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --type-ph-word: 900 clamp(2.5rem, 13vw, 4rem) / 1.1 var(--font-sans);
  --type-ph-display: 900 2.25rem / 1.1 var(--font-sans);
  --type-ph-h1: 900 1.625rem / 1.2 var(--font-sans);
  --type-ph-h2: 700 1.25rem / 1.3 var(--font-sans);
  --type-ph-body: 600 1.0625rem / 1.45 var(--font-sans);
  --type-ph-button: 900 1.1875rem / 1.2 var(--font-sans);
  --type-ph-input: 700 1.25rem / 1.3 var(--font-sans);
  --type-ph-small: 600 0.875rem / 1.4 var(--font-sans);
  --type-ph-code: 900 2rem / 1 var(--font-sans);
  --tracking-code: 0.12em;

  /* space (px) */
  --space-0: 0; --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-7: 32px; --space-8: 40px; --space-9: 48px;
  --space-10: 64px; --space-11: 80px; --space-12: 96px;
  --tap-min: 48px;
  --action-height: 64px;
  --topbar-height: 56px;

  /* radius */
  --radius-xs: 6px; --radius-sm: 10px; --radius-md: 16px; --radius-lg: 24px;
  --radius-xl: 32px; --radius-pill: 999px;

  /* elevation */
  --elev-2-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
  --elev-3-shadow: 0 16px 48px rgb(0 0 0 / 0.55);
  --glow-primary: 0 0 18px rgb(255 61 139 / 0.45);
  --glow-accent: 0 0 24px rgb(255 194 61 / 0.4);

  /* motion */
  --motion-instant: 80ms; --motion-fast: 150ms; --motion-base: 240ms;
  --motion-slow: 400ms; --motion-dramatic: 800ms; --motion-hold: 1200ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-decel: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-accel: cubic-bezier(0.3, 0, 0.8, 0.15);
  --ease-overshoot: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Arabic: looser lines, no tracking */
:root:lang(ar) {
  --type-ph-word: 900 clamp(2.5rem, 13vw, 4rem) / 1.4 var(--font-sans);
  --type-ph-display: 900 2.25rem / 1.35 var(--font-sans);
  --type-ph-h1: 900 1.625rem / 1.5 var(--font-sans);
  --type-ph-h2: 700 1.25rem / 1.55 var(--font-sans);
  --type-ph-body: 600 1.0625rem / 1.7 var(--font-sans);
  --type-ph-button: 900 1.1875rem / 1.4 var(--font-sans);
  --type-ph-input: 700 1.25rem / 1.5 var(--font-sans);
  --type-ph-small: 600 0.875rem / 1.6 var(--font-sans);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-base: 150ms; --motion-slow: 150ms; --motion-dramatic: 200ms; --motion-hold: 600ms;
  }
}
/* Reserved for a future in-app "Reduce motion" switch (not wired in v1). */
:root[data-motion="reduce"] {
  --motion-base: 150ms; --motion-slow: 150ms; --motion-dramatic: 200ms; --motion-hold: 600ms;
}

html { background: var(--color-bg); color: var(--color-text); font: var(--type-ph-body);
  -webkit-text-size-adjust: 100%; }
body { margin: 0; min-height: 100dvh; touch-action: manipulation;
  background: radial-gradient(120% 60% at 50% 0%, var(--color-bg-glow), var(--color-bg) 60%);
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
:lang(ar) * { letter-spacing: 0 !important; }
[dir="rtl"] .icon--mirror { transform: scaleX(-1); }
.num, .timer, .code { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; }
```
There is no token generator in v1 (nobody owns `shared/design/`): B writes `tokens.css` and C writes the Kotlin theme objects below from this file, with identical names and values. Player colour ids, hexes and shapes come from SPEC §3 `COLORS`.

### 13.2 Compose for TV: `tv-app/app/src/main/java/<pkg>/ui/theme/`

```kotlin
// MishColors.kt
import androidx.compose.ui.graphics.Color

object MishColors {
    val Bg = Color(0xFF120A1F)
    val BgGlow = Color(0xFF2A0F3D)
    val Surface = Color(0xFF1E1430)
    val Elevated = Color(0xFF2A1D42)
    val Overlay = Color(0xFF362752)
    val Scrim = Color(0xCC120A1F)          // 80 %
    val Outline = Color(0xFF4A3A66)
    val OutlineStrong = Color(0xFF8A77AB)
    val Text = Color(0xFFFFF7EC)
    val TextSecondary = Color(0xFFCBBFDD)
    val TextMuted = Color(0xFFA193B8)
    val Ink = Color(0xFF120A1F)
    val Primary = Color(0xFFFF3D8B)
    val OnPrimary = Ink
    val Accent = Color(0xFFFFC23D)
    val OnAccent = Ink
    val Success = Color(0xFF3DDC97)
    val Danger = Color(0xFFFF5A4E)
    val Focus = Color(0xFFFFF7EC)
    val Civilian = Color(0xFF5AB8FF)
    val Undercover = Color(0xFFFF8A3D)
    val Blank = Color(0xFFECE6F5)
}

enum class AvatarShape { Circle, Square, Star, Triangle, Diamond, Hexagon, Plus, Drop, Crescent, Bolt, Flower, Arch }

enum class PlayerSwatch(val id: String, val color: Color, val glyph: Color, val shape: AvatarShape) {
    Coral("coral", Color(0xFFF0183A), MishColors.Ink, AvatarShape.Circle),
    Azure("azure", Color(0xFF478CFF), MishColors.Ink, AvatarShape.Square),
    Lemon("lemon", Color(0xFFFFF04D), MishColors.Ink, AvatarShape.Star),
    Jade("jade", Color(0xFF1FA88A), MishColors.Ink, AvatarShape.Triangle),
    Grape("grape", Color(0xFF7A43FF), MishColors.Text, AvatarShape.Diamond),
    Tangerine("tangerine", Color(0xFFFF7A1F), MishColors.Ink, AvatarShape.Hexagon),
    Aqua("aqua", Color(0xFF7BFFF4), MishColors.Ink, AvatarShape.Plus),
    Rose("rose", Color(0xFFFF96C5), MishColors.Ink, AvatarShape.Drop),
    Mint("mint", Color(0xFFBDF5C8), MishColors.Ink, AvatarShape.Crescent),
    Plum("plum", Color(0xFFC02A8F), MishColors.Text, AvatarShape.Bolt),
    Sand("sand", Color(0xFFE6C486), MishColors.Ink, AvatarShape.Flower),
    Lilac("lilac", Color(0xFFC9BFFF), MishColors.Ink, AvatarShape.Arch);
    companion object { fun byId(id: String) = entries.firstOrNull { it.id == id } ?: Coral }
}
```
The protocol sends the color **`id` string** ("lemon"), never a hex value. `PlayerSwatch` must stay identical to SPEC §3 `COLORS` (C may implement it as `Constants.COLORS` plus this enum; a unit test compares them).

```kotlin
// MishType.kt
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

val Cairo = FontFamily(
    Font(R.font.cairo_regular, FontWeight.Normal),
    Font(R.font.cairo_semibold, FontWeight.SemiBold),
    Font(R.font.cairo_bold, FontWeight.Bold),
    Font(R.font.cairo_black, FontWeight.Black),
)

@Immutable
data class MishTypeScale(
    val code: TextStyle, val displayL: TextStyle, val displayM: TextStyle, val displayS: TextStyle,
    val headline: TextStyle, val title: TextStyle, val titleS: TextStyle, val body: TextStyle,
    val label: TextStyle, val caption: TextStyle, val timer: TextStyle,
)

private fun style(
    size: Int, lh: Int, weight: FontWeight, tracking: TextUnit = 0.em, tnum: Boolean = false,
) = TextStyle(
    fontFamily = Cairo, fontWeight = weight, fontSize = size.sp, lineHeight = lh.sp,
    letterSpacing = tracking, fontFeatureSettings = if (tnum) "tnum" else null,
    lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None),
    // includeFontPadding is already false by default since Compose 1.5; don't set it via the deprecated PlatformTextStyle flag.
)

/** Latin/Arabic variants per §3.2. Arabic: taller lines, zero tracking, ×1.08 on display sizes. */
fun mishTypeScale(arabic: Boolean): MishTypeScale {
    fun t(latin: Double) = if (arabic) 0.em else latin.em
    fun d(size: Int) = if (arabic) (size * 1.08).toInt() else size
    return MishTypeScale(
        code     = style(88, 96, FontWeight.Black, 0.08.em, tnum = true), // always Latin
        displayL = style(d(72), if (arabic) 96 else 80, FontWeight.Black, t(-0.01)),
        displayM = style(d(56), if (arabic) 80 else 64, FontWeight.Black, t(-0.01)),
        displayS = style(44, if (arabic) 64 else 52, FontWeight.Bold),
        headline = style(34, if (arabic) 52 else 42, FontWeight.Bold),
        title    = style(26, if (arabic) 40 else 32, FontWeight.Bold),
        titleS   = style(22, if (arabic) 34 else 28, FontWeight.SemiBold),
        body     = style(20, if (arabic) 34 else 28, FontWeight.SemiBold),
        label    = style(20, if (arabic) 30 else 24, FontWeight.Bold, t(0.02)),
        caption  = style(20, if (arabic) 30 else 26, FontWeight.SemiBold, t(0.01)),
        timer    = style(40, 44, FontWeight.Black, tnum = true),
    )
}

val LocalMishType = staticCompositionLocalOf { mishTypeScale(arabic = false) }
```

```kotlin
// MishTheme.kt — maps tokens into tv-material so stock components inherit them.
// [verify] darkColorScheme / Typography / MaterialTheme parameter names against androidx.tv:tv-material:1.1.0 sources.
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Typography
import androidx.tv.material3.darkColorScheme

@Composable
fun MishTheme(content: @Composable () -> Unit) {
    val arabic = LocalLayoutDirection.current == LayoutDirection.Rtl   // or the locale's language == "ar"
    val type = mishTypeScale(arabic)
    val colors = darkColorScheme(
        primary = MishColors.Primary, onPrimary = MishColors.OnPrimary,
        secondary = MishColors.Accent, onSecondary = MishColors.OnAccent,
        background = MishColors.Bg, onBackground = MishColors.Text,
        surface = MishColors.Surface, onSurface = MishColors.Text,
        surfaceVariant = MishColors.Elevated, onSurfaceVariant = MishColors.TextSecondary,
        error = MishColors.Danger, onError = MishColors.Ink,
        border = MishColors.Focus, scrim = MishColors.Scrim,
    )
    val m3Type = Typography(
        displayLarge = type.displayL, displayMedium = type.displayM, displaySmall = type.displayS,
        headlineLarge = type.headline, headlineMedium = type.headline, headlineSmall = type.title,
        titleLarge = type.title, titleMedium = type.titleS, titleSmall = type.titleS,
        bodyLarge = type.body, bodyMedium = type.body, bodySmall = type.caption,
        labelLarge = type.label, labelMedium = type.caption, labelSmall = type.caption,
    )
    CompositionLocalProvider(LocalMishType provides type) {
        MaterialTheme(colorScheme = colors, typography = m3Type, content = content)
    }
}
```

```kotlin
// MishMotion.kt
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.ui.unit.dp

object MishMotion {
    const val Instant = 80; const val Fast = 150; const val Base = 240
    const val Slow = 400; const val Dramatic = 800; const val Hold = 1200
    val Standard = CubicBezierEasing(0.2f, 0f, 0f, 1f)
    val Decel = CubicBezierEasing(0.05f, 0.7f, 0.1f, 1f)
    val Accel = CubicBezierEasing(0.3f, 0f, 0.8f, 0.15f)
    val Overshoot = CubicBezierEasing(0.34f, 1.56f, 0.64f, 1f)
    fun <T> bouncy() = spring<T>(dampingRatio = 0.55f, stiffness = Spring.StiffnessMediumLow)
}

object MishSpace { /* dp */ val s1 = 4.dp; val s2 = 8.dp; val s3 = 12.dp; val s4 = 16.dp; val s5 = 20.dp
    val s6 = 24.dp; val s7 = 32.dp; val s8 = 40.dp; val s9 = 48.dp; val s10 = 64.dp; val s11 = 80.dp; val s12 = 96.dp
    val SafeH = 48.dp; val SafeV = 27.dp }
object MishRadius { val xs = 6.dp; val sm = 10.dp; val md = 16.dp; val lg = 24.dp; val xl = 32.dp }
```

- **Reduced motion on TV:** `val reduce = Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f` (v1 has no in-app override). Provide it through `LocalReduceMotion`. Animations branch on it and don't just shorten durations.
- **Focus helper:** a single `Modifier.mishFocusable()` (or the tv-material `Surface` defaults from §4.6) so the focus style can't drift between screens.
- **Avatars:** `AvatarShape` → `ImageVector`, generated from the same SVGs as the web (`tools/icons-to-kotlin`). Never hand-draw them twice.
- **QR:** per SPEC §9.9: encode `view.joinUrl.uppercase()`, then draw the `BitMatrix` modules as rects inside the 240 dp cream panel with `module = floor(240 / (width + 8))` and a `4 × module` inset. **[verify]** the exact ZXing signature against 3.5.4.

### 13.3 Phone component notes (Preact)
- `<WordCard>`: pointer-events state machine `idle → pressing (150 ms timer) → revealed → idle`. The word element is **only mounted** in `revealed`, so it never sits hidden in the DOM. Cancel on `visibilitychange`.
- `<TimerBar>` and the TV ring compute remaining time from the server `deadline` and a clock offset: `clockOffset = state.serverNow − Date.now()` at receipt of each `state` (SPEC §8.5, §9.8), keeping the largest (least delayed) of the last 5 samples. Ping/pong frames are constant strings and carry no time.
- `<Avatar>`: inline SVG `<symbol>` sprite, color via `--avatar-color`, glyph color via `--avatar-glyph`.
- i18n: the in-house `t(key, params)` of SPEC §8.7 (no rosetta). Plural objects use `Intl.PluralRules(locale)`. The number formatter is forced to `latn`.

### 13.4 Color verification (procedure; the script is not owned by any agent in v1)
1. **WCAG contrast:** relative luminance `L = 0.2126 R + 0.7152 G + 0.0722 B` on linearised sRGB (`c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`), ratio `(L1+0.05)/(L2+0.05)`. Assert every pair in §2.4 against its threshold.
2. **CVD separation:** for each condition, transform linear RGB by the Machado 2009 severity-1.0 matrices, clamp, convert to CIELAB (D65), and compute CIEDE2000 for all 66 player pairs. Assert **min ΔE00 ≥ 10** for normal, protan, deutan and tritan.
   - Protan `[[0.152286,1.052583,−0.204868],[0.114503,0.786281,0.099216],[−0.003882,−0.048116,1.051998]]`
   - Deutan `[[0.367322,0.860646,−0.227968],[0.280085,0.672501,0.047413],[−0.011820,0.042940,0.968881]]`
   - Tritan `[[1.255528,−0.076749,−0.178779],[−0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]]`
3. Assert every player color is ≥ 3:1 on `surface`, and that each player's glyph color is ≥ 3:1 on that player color.

The values in §2.3 and §2.4 were produced by exactly this procedure (a Python prototype, 2026-10-03).

### 13.5 Protocol and engine notes (resolved against SPEC)
Each design need raised earlier is now settled in SPEC. This table records how.

| # | Need | Resolution |
|---|---|---|
| 1 | Voter → target map after the vote | In SPEC: `lastVote.tally[].voterIds` and `abstainIds` (seat order) |
| 2 | TV as host (START, settings, KICK, overrides, skip turn, close vote) | In SPEC: the TV is always host; skip and close are `HOST_ADVANCE` via the action pill (§7) |
| 3 | PAUSE / RESUME | **[not in v1]**: the pause menu says "The game keeps running" |
| 4 | `tieBreak: "wheel"`, ready timer | SPEC `tieBreak: "random" \| "none"` (the TV may animate random as a wheel); `revealSeconds` |
| 5 | `awaySince` / away ring | **[not in v1]**: static away badge |
| 6 | VIP handover | In SPEC: `reassignHost` when the VIP is removed, leaves or is kicked |
| 7 | `blankTyping` | **[not in v1]**: static `guess.guessing` line |
| 8 | Error codes | SPEC §6.4 codes only; PH-14 maps each one |
| 9 | Colour as a swatch id, unique per room | In SPEC (`COLORS` ids). A race returns `COLOR_TAKEN`; no server-side reassignment |
| 10 | Blank's guess auto-submits at `deadline − 1 s` if the field is non-empty | Client-only (B); no engine change |
| 11 | Pacing of reveals | SPEC `ELIMINATION_HOLD_MS` 8 s, `VERDICT_HOLD_MS` 8 s, `TIE_LEAD_IN_MS` 3 s; animations budgeted in §6.2 |

---

## 14. Open design questions (non-blocking; defaults chosen)
1. ~~EN role name~~ **Resolved: "Mole"** (RESEARCH §6), adopted in SPEC §11.2.
2. **AR names:** "جاسوس" for the Mole and "المندسّين" for the infiltrators team? "مندسّين" carries 2019 political echoes; an alternative is "الغشّاشين" (the cheats).
3. ~~Show the Blank's typed guess on the TV after the verdict?~~ **Resolved:** never before RESULTS (SPEC §5.4). It is shown on TV-11 and PH-13 from `result.guesses`, and the Blank reads it aloud at the verdict.
4. **Sound identity (M4):** commission the darbuka-based stings, or source CC0 percussion and edit it? It decides the M4 budget.
5. ~~Phone sounds default Off~~ **Deferred:** phone sounds are not in v1.
