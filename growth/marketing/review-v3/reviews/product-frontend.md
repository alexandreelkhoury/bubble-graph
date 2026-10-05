# Product · Frontend design (visual craft) review — v3

Target: phone controller (`web-client/src/screens`, `styles.css`), browser TV (`web-client/src/tv-mock`, `tv.css`), native TV (`tv-app/.../ui`). Lens: composition, weight, colour, hero moments, rhythm. Skill applied: `frontend-design` (commit to one aesthetic, dominant colour + sharp accents, atmosphere over flat fills, orchestrated hero moments, no generic admin look).

Mockups (static HTML, palette B "lit stage" in the app, shot with headless Chrome via Playwright, `mockups/shoot.mjs`):
- `mockups/tv-lobby-b.png` (TV-02), `mockups/tv-out-b.png` (TV-09 OUT), `mockups/phone-reveal-b-hidden.png` + `phone-reveal-b-held.png` (PH-04).
- Sources: `mockups/stage-b.css` (proposed tokens), `tv-lobby-b.html`, `tv-out-b.html`, `phone-reveal-b.html`. Contrast/CVD numbers come from `mockups/contrast.py`.

## 1. Verdict

The bones are good: big Black type, the six shape-and-colour avatars, the role cards and the TV-04 "CHECK YOUR PHONES!" moment are party-grade. What makes it read as a dark admin panel is the stage. The background is a near-black `#120A1F` (luma 15) with one faint glow, and the tiles are `#1E1430`, only 1.10:1 against it. Everything floats on a void, nothing feels lit, and the "Beirut rooftop at 1 a.m." mood only shows up in the marketing.
Three craft problems flatten the hierarchy: the web build has no Cairo 700, so every Bold renders as Black; disabled CTAs turn into muddy maroon; and the scoreboard and vote-reveal "glow/dim" effects muddy colours instead of lighting them.
My recommendation is to bring palette B's stage and surfaces into the app and keep the app's player colours. The token values, contrast checks and the CVD evidence are in §4.

## 2. Proposals

| # | P | Effort | Surface/screen | File:line | Current | Proposed | Why (evidence) |
|---|---|---|---|---|---|---|---|
| 1 | P1 | S | Browser TV · TV-08 tie overlay | `web-client/src/tv-mock/tv.css:228`, `:234` | `.tvtie` centres its column over the whole canvas, and the action bar is raised above it (`.tvclues .tvbottom{z-index:9}`, l.225). The explanation line (max-width 640) runs under the focused "Skip turn" pill | `.tvtie{padding-bottom:120px}` (the column ends above the strip line at y 417 dp) and `.tvtie__explain{max-width:560px}` | `tv-07-vote-reveal-tie.png`: "…then everyone votes again, betw…" is cut by the Skip turn pill and can't be read on the one screen that explains the tie-break. (The Kotlin comment says the native overlay draws over the bar, so this needs a device check.) |
| 2 | P2 | S | All web (phone + browser TV) · type | `web-client/src/styles/tokens.css:2-13`; `web-client/public/fonts/` | Only Cairo 600 and 900 are loaded. Every 700 token (`--tv-displayS/headline/title/label`, `--type-ph-h2/input`, plus ~20 `font-weight:700` rules in `styles.css`) falls back to **900** | Add `cairo-700-latin.woff2` + `cairo-700-arabic.woff2` (subset like the others, ~20 KB each) and two `@font-face` blocks with `font-weight:700` | Native already ships Bold (`tv-app/.../theme/MishType.kt:19`), so browser TV ≠ native TV. In `tv-02-lobby-6-players.png` the "Settings/English" pills, the player names and the "PLAYERS 6/12" label all show the same Black weight as the code, and on the phone `ph-13-results-mole.png` "Waiting for the host…" is as heavy as "Civilians win!". The mockups use a real 700 (Settings, Continue, the reaction line), and the hierarchy comes back. |
| 3 | P2 | S | Phone all CTAs + TV `.tvbtn` disabled | `web-client/src/styles.css:127`; `tv-mock/tv.css:69` | `opacity:.4` on a pink button gives ink on `#711E4A`, **1.82:1**, a dirty maroon slab | Disabled = `background: rgb(var(--rgb-text)/.07); color: var(--color-text-muted); box-shadow: inset 0 0 0 1px rgb(var(--rgb-text)/.12)` with no opacity. Muted on that fill is ≈6:1. TV: same, keeping the focus ring | `ph-01-home-empty.png` ("Next" is almost invisible), `ph-04-reveal-hidden.png` ("Got it"), `tv-02-lobby-empty-en.png` (Start). It is the biggest single "cheap" signal on the phone. See `phone-reveal-b-hidden.png`. |
| 4 | P2 | M | All · stage colour (palette B) | `tokens.css:19-31,42`, `:149`; `tv.css:8`; `tv-app/.../theme/MishColors.kt:9-20`; `components/Brand.kt:175-210` (`MishBackground`) | Flat `#120A1F` + one `#2A0F3D` top glow | Lit stage per §4 (token table): gradient `#2B1650→#24124A→#1D1036`, purple top glow 0.45, amber rim 0.14, magenta bounce 0.12, 6 % grain | The brand promise in every ad and on the landing is a lit violet room, and the app is a black void (bg luma 15 vs 35). Tiles at 1.10:1 vs bg can't be told apart from the bg on a TV across a room. Compare `tv-02-lobby-6-players.png` with `mockups/tv-lobby-b.png`. |
| 5 | P2 | S | All · avatar boundary on new surfaces | `styles.css:140-143` (`.avatar__tile`); `MishColors.kt:48` (`needsRingOnElevated`) | Ring only for grape + plum on elevated | With palette B surfaces, give **every** avatar tile a hairline `0 0 0 2px rgb(255 247 236 / .24)` (Compose: `border(2.dp, Text.copy(.24f))`) | On `#3A2266`: grape 2.55, plum 2.48, coral 3.06 (2.49 on elevated) are below 3:1 non-text. One rule for all avoids per-colour exceptions. |
| 6 | P2 | S | Browser TV · TV-05 / TV-10 timer number | `tv.css:220` | `.ring__num{top:4px; inset-inline-end:-88px}`, which floats 88 dp off the ring | `top:-6px; inset-inline-end:-36px` (= native `CluesScreen.kt:223` `offset(x=36.dp, y=(-6).dp)`) | `tv-05-clues-mid.png` "15" and `tv-10-blank-guess.png` "44" hang in empty space and read as a stray element. Native keeps the number attached, so this is also a parity fix. |
| 7 | P2 | S | TV-09 OUT · auto-advance countdown | `tv-mock/tvParts.tsx:101` (`TimerChip`); `tv.css:263-265`; native `TimerRing.kt:155` | The countdown to auto-continue turns `--color-danger` red with a stopwatch at ≤ 3 s | Auto-advance timers use a calm tone: `color: var(--color-text-secondary)`, no danger state, text "Next in 2" (as the NEXT_ROUND branch already does) | `tv-09-elimination-mole.png` and `-blank.png`: a red "⏱ 2" next to Continue reads as an error or alarm during the celebration beat. Red should mean "you are running out of time to act". |
| 8 | P2 | S | TV-09 OUT hero | `tv-mock/tvElimination.tsx:127-131`; `EliminationScreen.kt` (name row) | After the flip only the name is left; the reaction line is `tv-headline` in the same cream as the name | Put the player's 48 dp avatar before "Ben is out!"; set the reaction to `700 24/30` in `--color-text-secondary` with the role word in the role colour (`…the <Mole>! Nice catch.`); tilt the card −3° with a 4 dp cream edge | `tv-09-elimination-mole.png`: card, name and reaction are three equal-weight blocks, and who left is no longer visible as a colour/shape. See `mockups/tv-out-b.png`. |
| 9 | P2 | S | TV-09 OUT · role wash | `tv.css:289-292` | The wash fades to `opacity:.35` of 0.3 alpha, which is nearly invisible on `#120A1F` | Wash 0.34 alpha held at `opacity:1` plus a soft conic "rays" layer in the role colour (7 %, masked radial; see `tv-out-b.html` `.rays`). Static in reduced motion. Compose: one `drawWithCache` conic brush | The OUT is the peak moment of each round, and in `tv-09-elimination-mole.png` the background is the same dark as every other screen. The rays give it a stage-light hit that matches palette B. |
| 10 | P2 | S | TV-11 results scoreboard | `tv.css:392` | `.tvsb__row.is-first{background: accent/.10; box-shadow:0 0 24px accent/.15}` applies to every tied winner | Drop the `box-shadow`; `background: rgb(var(--rgb-accent)/.08)`; the trophy and amber total carry rank 1 | `tv-11-results-scoreboard.png`: four tied winners stack four amber glows into a brown smear across the table. Native draws a coloured shadow per rank-1 row too (`ResultsScreen.kt:498`), so remove it there as well. |
| 11 | P2 | M | TV-11 results scoreboard · fold | `tv.css:388` (`max-height:160px`), `:404` (`.tvhistory`) | 4 rows visible; the 5th (Ben, the Mole, 0 pts) is hidden behind a fade + chevron; a cryptic "R1 ◇ ⬚ ⇝ R2 ■ 🎭 ⇝" strip uses the 40 dp that would show him | Remove the round-history strip from stage 2 (or move it into the pause menu) and set `max-height:200px` (5 rows) | The most interesting row (who was the Mole) is below the fold in the default 5–6 player game. The icon strip can't be read from the couch without a legend. |
| 12 | P2 | M | TV-02 lobby · summary | `tv.css:129`; `tv-mock/tvLobby.tsx:104` | Two right-aligned grey lines: "All packs · English / Civilians 4 · Moles 1 · Blank 1 · Official (1 Civilian left)" | Chips: `[All packs] [English] [● 4 ● 1 ● 1]` with role-colour dots (32 dp pills, `rgb(text/.07)` fill, 700 16 px). Move the "Official (…)" note to Settings | `tv-02-lobby-6-players.png`: the longest text on the screen is configuration jargon, which reads like an admin header. Chips scan in 1 s. See `mockups/tv-lobby-b.png`. |
| 13 | P2 | M | TV-02 lobby · join block + brand | `tv.css:116` (wordmark 160 px), `:118-128`; `LobbyScreen.kt:162-165` | Wordmark 160 dp; "SCAN TO JOIN", QR, code and the URL line are four loose items in the left column | Wordmark 196 dp; one "ticket" card (`--color-surface`, radius 28, inner highlight, soft drop shadow) holding the caption, QR, code (64 px, accent glow .45) and a one-line URL with the host in cream 700 | The lobby sits on screen for minutes while people arrive. It is the brand's billboard, and the mark is currently the smallest heading on screen. Grouping makes "how to join" one object. See `mockups/tv-lobby-b.png`. |
| 14 | P2 | S | TV-02 lobby · newest-player highlight | `tv.css:96-100` (`.tile--drop`) | A 480 ms ring burst, then nothing | Keep a 2 dp ring in the player's own colour + 26 dp colour glow on the newest tile until the next join (it pairs with the "Karim is with us!" line) | `tv-02-lobby-6-players.png`: the toast names Karim but nothing on the grid points to him. See the Karim tile in `mockups/tv-lobby-b.png`. |
| 15 | P3 | S | TV-02 / TV-06 tile radius | `tv.css:138` (`.tvgrid .tile` radius-md 16) vs `:91` (`.tile` radius-lg 24) | The same player tile is 16 dp in the lobby and 24 dp in the vote | 20 dp everywhere (`--radius-tile: 20px`; Compose `RoundedCornerShape(20.dp)`) | Compare the tile corners in `tv-02-lobby-6-players.png` and `tv-06-voting-3-of-6.png`. The same object changing radius between scenes breaks rhythm. |
| 16 | P3 | S | TV-02 empty slots | `tv.css:93` | 2 dp dashed `--color-outline` + "+" on all 11 empty slots | Dashes at `rgb(text/.14)`, "+" at `/.22`; only `.is-next` at `/.32` with its pulse | `tv-02-lobby-empty-en.png` is a grid of 12 equally loud outlines, a wireframe look. Quiet slots let the QR and code lead. |
| 17 | P3 | S | TV-07 vote reveal · suspense dim | `tv.css:269` | Non-top tiles `opacity:.35`, so coral turns maroon, lemon olive, jade bottle-green | `.tvvgrid.is-suspense .tile:not(.is-top) .avatar{filter:grayscale(1); opacity:.5}` and the tile at `opacity:.6` | `e2e-en-tv-07-vote-reveal.png`: the dimmed tiles look dirty, not "out of the running". Grey reads as a deliberate state. |
| 18 | P3 | S | TV-06 voting title | `tv.css:238-240` | "WHO'S NOT ONE OF US?" (44) and "Vote on your phone" (34, lilac) on one line | Subtitle on its own line, `--tv-title` 26, `--color-text-secondary` | `tv-06-voting-3-of-6.png`: two near-equal sizes side by side compete. At 1920 the line almost touches both safe edges and won't fit in FR/AR. |
| 19 | P3 | S | TV-11 results stage 1 · particles | `tv-mock/tvResults.tsx:94`; `ResultsScreen.kt:235` (`FloatingEmblems(House)`) | 12 flat civilian-blue house icons drifting up | Confetti in the six player colours (reuse the phone `.confetti`, 40 pieces, no strobe) or the OUT rays in civilian blue | `tv-11-results-stage1.png`: five scattered houses look like clip-art and undercut the "CIVILIANS WIN!" hero. |
| 20 | P3 | S | PH-03 host lobby · crowns | `web-client/src/screens/Lobby.tsx:46` | Crowns in the top bar avatar, after "You're the host" and on the row avatar | Drop the heading `crown-pill` | `ph-03-lobby-vip-3.png`: three crowns within 400 px. |
| 21 | P3 | S | PH-13 results · lost pill | `styles.css:617` (`.results__me.is-lost`) | Grey surface pill "You lost this one" looks like a disabled button | No fill: `background:none; color: var(--color-text-secondary)` at `--type-ph-h2`, or tint it with the role you played | `ph-13-results-mole.png`: the pill sits right above the hero line and reads as an inactive control. |
| 22 | P3 | M | PH-01 home composition | `styles.css:371-373` | Wordmark in the top bar **and** an 88 px app mark; the content stops at 45 % height and the lower half is empty | Remove the 88 px mark; centre the code block vertically (`.screen--home{justify-content:center}`) and add a single quiet line under the boxes ("No app needed · The TV shows the code") | `ph-01-home-empty.png`: duplicated brand on top and a dead lower half. This is the first screen every new player sees. |
| 23 | P3 | S | PH-10 out (me) | `styles.css:540` | `.outpanel` top-aligned, 55 % empty below | Centre the panel in the screen (`margin-block:auto`) | `ph-10-eliminated-me.png`: the content hugs the top. |
| 24 | P3 | S | PH-04 reveal · card back | `styles.css:424-429` | `color-mix(avatar 18%, surface)` flat + pattern 9 %, small hand icon | Radial `color-mix(avatar 34%→14%, surface)` with a 112 px halo ring around the hand (see `phone-reveal-b-hidden.png`); the "Make sure nobody's looking" line moves inside the card | `ph-04-reveal-hidden.png`: the hold target is a flat maroon slab; a lit centre says "press here" without more copy. |

## 3. Keep list (excellent, do not lose)

1. **The avatar system** (squircle, colour, black/cream glyph, inner bevel). It reads from the couch and stays colour-blind safe because shape carries identity. It is also the best brand asset the product has.
2. **TV-04 "CHECK YOUR PHONES!"** (`tv-04-role-reveal-3-of-6-ready.png`): huge, centred, glowing, with the wobbling phone icon. It is the template for every hero beat.
3. **The phone "Your turn" flood** (`ph-06-your-turn.png`): the whole phone becomes your colour with a black DONE slab. It is unmistakable and a perfect TV/phone hand-off.
4. **Role cards and word chips** (Mole stripes, Blank dot-grid, Civilian blue) on TV-09 / TV-11 / PH-13. They are distinctive, carry identity without words, and the pattern helps CVD.
5. **The TV-05 spotlight cone** and the one focus style (cream ring + pink glow). Both are consistent and atmospheric, and they are exactly the "stage" language palette B extends.

## 4. Palette B in the app: recommendation

**For**, with two conditions: keep the app's player colours (do **not** import B's lifted set), and add the universal avatar hairline (#5). Dial B's light layers down about 30 % from the marketing values so the content stays the brightest thing on screen.

### Tokens (web `styles/tokens.css` + native `MishColors.kt`)

| Token | Now | Proposed | Contrast check (WCAG) |
|---|---|---|---|
| `color.bg` (base, scrims, `--rgb-bg`) | `#120A1F` | `#1D1036` | text 16.76 · muted 8.15 |
| `color.bgTop` (NEW, gradient start) | — | `#2B1650` | text 14.83 · text2 11.38 · muted 7.21 · accent 10.29 |
| `color.bgMid` (NEW, 55 %) | — | `#24124A` | text 15.68 |
| `color.bgGlow` | `#2A0F3D` single radial | layered: `radial(90% 55% at 50% -5%, rgb(140 80 230 / .45))` + `radial(70% 45% at 105% 100%, rgb(255 201 77 / .14))` + `radial(60% 50% at -10% 60%, rgb(255 79 154 / .12))` + grain 6 % overlay | marketing uses .62 / .20 / .16; app −30 % |
| `color.bgDeep` | `#07040D` | **unchanged** | The Blank's "lights down" gets *more* dramatic against a lit stage |
| `color.surface` | `#1E1430` | `#3A2266` | text 12.35 · text2 9.48 · muted 6.00 · accent 8.57 · success 7.42 · civilian 6.08; vs bg 1.20–1.36 (was 1.10) |
| `color.elevated` | `#2A1D42` | `#4A2E7A` | text 10.07 · text2 7.73 · muted 4.90; focus ring cream vs elevated 10.07 |
| `color.overlay` | `#362752` | `#5A3A8E` | text 8.13 · text2 6.24 |
| `color.outline` | `#4A3A66` | `#6B54A0` | decorative only (2.12 on surface) |
| `color.outlineStrong` | `#8A77AB` | `#9C88CC` | 4.25 on surface · 5.11 on bgTop (≥ 3:1 UI) |
| `color.textSecondary` | `#CBBFDD` | `#E2D6F5` | 11.38 on bgTop · 9.48 on surface |
| `color.textMuted` | `#A193B8` | `#B8A8D6` | 7.21 bgTop · 6.00 surface · 4.90 elevated (old `#A193B8` would be 4.61 on the new surface) |
| `color.primary` | `#FF3D8B` | `#FF4F9A` | ink on primary 6.28 (was 5.78) |
| `color.primaryText` (NEW) | — | `#FF7AB3` | for primary *as text* on surface/elevated: 5.43 / 4.43 (large only on elevated). Plain `#FF4F9A` as small text fails on surface (4.27), e.g. `.speaker__label`, `.tvmenu__item.is-on` |
| `color.accent` | `#FFC23D` | `#FFC94D` | ink on accent 12.1 |
| `color.danger` | `#FF5A4E` | `#FF6B60` | 4.70 on surface (old 4.26 fails small text); 5.1+ on bg |
| `color.ink` | `#120A1F` | unchanged (B's `#1A0B2E` gives lower contrast) | — |
| civilian / undercover / blank | unchanged | unchanged | 7.30 / 6.72 / 12.9 on bgTop |
| **player colours** | app set | **unchanged** | see CVD below |

Also update the `--rgb-*` channel tokens (`tokens.css:42`) and `Scrim = 0xCC1D1036`.

### Colour-blind check (Machado 2009 simulation, min pairwise ΔE76 across the 12 player colours)

| Set | normal | protan | **deutan** | tritan |
|---|---|---|---|---|
| App (A) | aqua/mint 25.3 | rose/lilac 18.1 | aqua/rose 15.2 · jade/rose 17.7 | lemon/sand 16.4 |
| B lifted (coral `#FF3355`, azure `#5A9BFF`, jade `#2BC49F`, grape `#9A6BFF`, tangerine `#FF8A33`) | 25.3 | 18.1 | **jade/rose 10.2 · azure/grape 10.2** | 16.4 |

B's lifted player colours make two pairs much closer for deuteranopes (the most common CVD). Shapes still disambiguate, but there is no reason to lose colour separation. The role colours stay far apart in every simulation (civilian/undercover ≥ 93, civilian/blank ≥ 35).

### Device test before shipping (the deferred condition)
- A cheap 8-bit TV panel at 30 % backlight in a dark room. Look for banding in the `#2B1650→#1D1036` gradient (the 6 % grain is the mitigation; in Compose, use a pre-baked 128 px noise PNG tiled at 6 % instead of a shader) and for "milky blacks" washing out the QR. The QR card stays cream, so its contrast is unaffected.
- Phone OLED in a dark room at minimum brightness: the lit bg (luma ≈ 35 vs 15) should not glare. If it does, use `#1D1036` flat on the phone and keep the gradient on the TV only.
- Cost on low-end TV GPUs: three radial brushes + grain recorded once in `drawWithCache` (as `MishBackground` already does for one glow), plus the existing drift on the top-glow layer only.

## Notes
- Not reviewed visually: native TV renders (no device). Native findings are from code and parity with the browser TV (`MishType.kt`, `CluesScreen.kt:223`, `ResultsScreen.kt:235,498`, `Brand.kt:175`).
- Some captured TV frames are mid-animation (INDEX.md). #1 is a layout collision, not a timing artefact. The tie overlay's bleed-through of the clue screen may be the 8 % fade-in frame.
