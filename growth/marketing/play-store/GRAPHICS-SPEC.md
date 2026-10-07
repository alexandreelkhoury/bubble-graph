# Mish Ana! — Play Store graphics spec (Android TV / Google TV)

Prepared 2026-10-04, rebuilt 2026-10-06 for design-v3 (D1 feature graphic, D2 icon, D3 TV banner, D5 screenshot plan). Google's specs re-checked 2026-10-06:
- Preview assets: [support.google.com/googleplay/android-developer/answer/9866151](https://support.google.com/googleplay/android-developer/answer/9866151)
- Icon: [developer.android.com/distribute/google-play/resources/icon-design-specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications)
- TV launcher icon + banner: [developer.android.com/design/ui/tv/guides/system/tv-app-icon-guidelines](https://developer.android.com/design/ui/tv/guides/system/tv-app-icon-guidelines)
- TV app quality (TV-LB, TV-BN, TV-G4): [developer.android.com/docs/quality-guidelines/tv-app-quality](https://developer.android.com/docs/quality-guidelines/tv-app-quality)
- Metadata policy: [answer/9898842](https://support.google.com/googleplay/android-developer/answer/9898842); listing limits: [answer/9859152](https://support.google.com/googleplay/android-developer/answer/9859152)

**Palette: marketing palette B** for every store graphic (same as the ads and the landing; `growth/video/src/brand.ts`, `review-v2/DECISIONS.md` #1): stage `#2E1856 → #1D1036` with a violet lift `rgba(160,95,245,.55)`, magenta `#FF4F9A` (hot word, bang stem), amber `#FFC94D` (the bang dot, small highlights only), cream `#FFF7EC`, muted `#D6CAE8`, ink `#1A0B2E`. Tokens: `src/brand.css`. **App screens shown inside a graphic stay exactly as captured.** Font: Cairo 900 (OFL, `src/fonts/`). No cedar/flag clichés, no cartoon kids (DATA-SAFETY.md §3).

## Needs re-render (rule change 2026-10-07)

New default: everyone gets the same word except the Mole, whose phone shows a "YOU'RE THE MOLE!" card and no word; the different-word role is now optional. Anything that shows PIZZA/PASTA (a second word) as the twist, or the Blank, is out of date. **Nothing has been re-rendered yet**; wait for the new Mole card and last-guess screens in the game build, then capture and run §6.

| File(s) | What is wrong now | Fix |
|---|---|---|
| `graphics/feature-1024x500-{en,fr,ar}.png` (`src/feature-graphic.html`, `w2` = PASTA / PÂTES / باستا) | Second phone shows PASTA with the "odd one" ring | Phone 2 = the real Mole card (§3); change `w2` to the card, re-render `feature` |
| `graphics/screenshots/tv-01-secret-word-{en,fr,ar}-placeholder.jpg` | Phone 2 (`ph-04-held-mole`) shows the Mole's different word; headline "One is different" | New headline is in `frames.tsv`; re-capture `ph-04-held-mole` as the Mole card, re-render `shots` |
| `graphics/screenshots/tv-07-blank-guess-{en,fr,ar}-placeholder.jpg` | Blank's last guess (role removed) | Re-capture TV-10 as the Mole's last guess; output is now `tv-07-last-guess-*`; delete the old `tv-07-blank-guess-*` files |
| `graphics/screenshots/tv-04-clues-*`, `tv-05-vote-*`, `tv-06-elimination-*` (placeholders) | Captured from the old build: role names/cards may show Mole-with-a-word or Blank | Re-capture from the new build (D4) before upload |
| `src/img/tv-vote-reveal-{en,ar}.png` (inside the feature graphic) | Old-build capture | Swap with a new-build capture when re-rendering the feature graphic |

Not affected: `icon-512.png`, `tv-banner-1280x720-*` (no words), `tv-02-scan-to-join-*`, `tv-03-word-on-phone-*` (civilian word only), `tv-08-play-again-*` (check the scoreboard role labels).

## 1. Assets, Google's rules, our files

| Asset | Google's spec (checked 2026-10-06) | Our file(s) in `graphics/` | Status |
|---|---|---|---|
| **App icon** | 512 × 512, 32-bit PNG with alpha, sRGB, ≤ 1024 KB. Full square: Play applies the rounded mask (30 % radius) and the shadow, so no rounded corners or drop shadow in the file. No badges, ranking, price or text | `icon-512.png` (RGBA, opaque, 76 KB) | Ready (D2) |
| **Feature graphic** | 1024 × 500, JPEG or 24-bit PNG (no alpha). Keep the focal point central-safe; Play draws a play button in the centre when a promo video is set | `feature-1024x500-{en,fr,ar}.png` (RGB, ~430 KB) | **Re-render** (rule change 2026-10-07: shows PIZZA/PASTA) |
| **Android TV banner** | 1280 × 720, JPEG or 24-bit PNG (no alpha). Required to publish a TV app. Must contain the app name; one per language | `tv-banner-1280x720-{en,fr,ar}.png` (RGB) | Ready (D3) |
| **Android TV screenshots** | ≥ 1 required (max 8), JPEG or 24-bit PNG (no alpha), each side 320–3840 px, long side ≤ 2 × short side. TV-G4: at least one **unaltered**, high-resolution screenshot of the current TV app | `screenshots/tv-0[1-8]-<name>-{en,fr,ar}.png` from `frames.tsv` | **Placeholders only** (`*-placeholder.jpg`): D4 is blocked until native captures exist |
| Phone screenshots | Not shown for a TV-only app | — | If Play Console blocks saving without them, upload the same 1920 × 1080 TV screenshots there |
| Promo video | YouTube URL, ads off, embeddable | — | D7 deferred (16:9 "live" cut at launch) |
| In-APK launcher assets (not uploaded) | TV-LB: 320 × 180 banner (xhdpi) + ≥ 160 × 160 icon (xhdpi); adaptive icon content inside the safe zone; banner text per language | `tv-app/app/src/main/res/drawable{,-ar}/banner.xml`, `mipmap-anydpi-v26/ic_launcher.xml` + `drawable/ic_launcher_{background,foreground}.xml` | Ready (D2, D3), generated by `assets/brand/scripts/gen_brand.py` |

Text rules for every graphic: no "Best", "#1", "Top", "New", "Free", "Discount", "Sale", download counts, prices, Google Play badges, and no "Download now"/"Install now" style calls to action. No "Undercover", "Mr. White" or other apps' names (LISTING.md §0); roles are Mole/Taupe/الجاسوس (default) and the optional different-word role, shown in-game as Undercover/المتخفّي but never named in store graphics (EN/FR); the Blank role is gone (rule change 2026-10-07). Screenshots show the actual app (captions and a frame are fine, invented UI is not). Text ≥ 48 px on 1920 × 1080. Natural player names, never a live production room code.

## 2. Icon (D2) — `icon-512.png` and the launcher icon

One source, `assets/brand/icon.svg` (160 × 160 artboard, generated by `gen_brand.py`):
- Tile: radial gradient centre (0.5, 0.3), r 0.85: `#5A2E9A` → `#3A1E6A` (60 %) → `#2B1650`. Lighter than the old `#120A1F` tile, so it keeps a visible edge on dark launchers (`#121214`, Google TV `#1F1F1F`).
- Bubble `#FF4F9A`, 4 % bigger than the in-app mark, tail tucked to (35, 134) so a circular mask never clips it.
- Bang: cream stem 22 % wider, amber `#FFC94D` dot r 10, so the "!" still reads at 32 px.
- Launcher (adaptive, minSdk 26): `ic_launcher_background.xml` = the same radial tile on 108 dp; `ic_launcher_foreground.xml` = bubble + bang at scale 0.43, farthest point 32 dp from the centre (inside the 66 dp safe circle).
- The in-app mark (`drawable/ic_mark.xml`, `assets/brand/mark.svg`, `/brand/mark.svg` on the web) is **unchanged**: it follows the app palette, which moves to B only with DECISIONS-V3 B19.

Check: `design-v3/after/play-store/icon-48-32-light-dark.png` (72/48/32 px, circle + squircle masks, on white, light grey, `#1F1F1F`, `#121214`).

## 3. Feature graphic (D1) — `src/feature-graphic.html?lang=en|fr|ar`

DECISIONS v2 #19 on palette B: the game in one glance (TV is the stage, phones hold the secret).

| Zone (EN/FR; AR mirrored) | Content |
|---|---|
| Background | `#2E1856 → #1D1036`, violet lift top-right, faint amber/magenta corners, spotlight cone onto the TV, 6 % grain |
| Text column x 48–358 (AR x 666–976) | Icon 64 px + "MISH ANA!" / "مش أنا!" Cairo 900 58 px at y 44 · hook 68 px at y 176: EN "Someone's **lying.**", FR "Quelqu'un **ment.**", AR "في حدا عم **يكذب.**" (hot word in a magenta box, ink text, −4°, +4° in AR) · sub 24 px at y 400: "The secret-word party game / **for your TV**" · "Le jeu d'ambiance du mot secret / **pour votre télé**" · "لعبة الكلمة السرّية للسهرات / **عالتلفزيون**" |
| Art (x 440–990, AR mirrored) | TV 540 × 304 showing TV-07 vote reveal (EN capture for EN/FR, Arabic capture for AR) + two PH-04 phones: coral PIZZA (−7°) and the **Mole card** "YOU'RE THE MOLE!" (no word, real PH-04 Mole capture from the new build) with the amber ring (+6°). FR PIZZA / « TU ES LA TAUPE ! », AR بيتزا / «دورك: الجاسوس!». (Until 2026-10-07: PIZZA / PASTA; see the re-render list at the top.) |
| Safe zones | **No text in Play's play-button zone (x 362–662, y 150–350)**: only the TV crosses it. Everything ≥ 40 px from each edge. Overlay check: `design-v3/after/play-store/store-graphics-sheet.png` |

Follow-up after D4: swap `src/img/tv-vote-reveal-{en,ar}.png` (browser-TV captures) for native ones, and add a French one for the FR graphic.

## 4. TV banner (D3) — `src/tv-banner.html?lang=en|fr|ar`

The Play banner is the in-app launcher banner drawn at 4×, from the same generated vector (`assets/brand/banner-{en,ar}.svg` = `res/drawable{,-ar}/banner.xml`): palette-B stage (`#2E1856 → #1D1036` diagonal + violet lift), **no dark tile**: the magenta bubble sits directly on the stage over a soft magenta glow, wordmark beside it (Latin 168/320 px wide; Arabic at 1.2 × the Latin scale). AR mirrors the order (wordmark left, bubble right). FR uses the Latin banner (the name is the same); it is exported as its own file so each listing has one.

## 5. TV screenshots (D5) — the one plan: `frames.tsv`

`frames.tsv` is the **only** source (24 rows: 8 slots × EN/FR/AR). Story order: hook → how you join → privacy of the word → play loop → drama (unaltered) → twist → replay. Play on phones shows shots 1–3 without scrolling, the TV store shows 1–2.

| # | Screen (DESIGN ID) | Type | EN headline (*magenta*) | FR | AR |
|---|---|---|---|---|---|
| 1 | TV-05 Clues + 2 × PH-04 held (civilian word + Mole card) | composite | Same word for everyone… *except the Mole.* | Le même mot pour tous… *sauf la Taupe.* | نفس الكلمة للكل… *إلّا الجاسوس.* |
| 2 | TV-02 Lobby, 6 players, QR | captioned | Scan the code. *Your phone is the controller.* | Scannez le code. *Votre téléphone sert de manette.* | امسحوا الكود… *وتلفونك هو الجويستيك.* |
| 3 | TV-04 Role reveal + PH-04 hidden + held | composite | Your word stays *on your phone.* | Votre mot reste *sur votre téléphone.* | كلمتك بتضلّ *عتلفونك.* |
| 4 | TV-05 Clues, speaker spotlight | captioned | One clue each. *Who sounds off?* | Un indice chacun. *Qui sonne faux ?* | تلميح لكل واحد… *مين كلامو غريب؟* |
| 5 | TV-07 Vote reveal (arrows) | captioned | *Vote* from the couch. | *Votez* depuis le canapé. | *صوّتوا* من عالكنبة. |
| 6 | TV-09 Elimination, OUT | **unaltered** (TV-G4) | — | — | — (Arabic-UI capture) |
| 7 | TV-10 Mole last guess | captioned | Caught? The Mole gets *one last guess.* | Démasquée ? La Taupe a *une dernière chance.* | انكشف الجاسوس؟ إلو *فرصة أخيرة.* |
| 8 | TV-11 Results scoreboard | captioned | *Play again.* Scores carry over. | *Rejouez.* Les scores continuent. | *العبوا كمان مرّة…* والنقاط محفوظة. |

**Frame** (`src/frame.html`, params `img`, `h`, `lang`, optional `p1`/`p2`/`ph`): 1920 × 1080 palette-B stage; capture scaled to **1600 × 900 at x 160, y 160**, radius 24, 2 px `#6B54A0` outline; headline Cairo 900 **68 px** centred in the top 160 px band (`text-wrap: balance`, two lines max), key words in `#FF4F9A`; bubble mark at the start edge. `lang=ar` sets `dir=rtl` (bubble and phones swap sides). No subline: under the 48 px minimum there is no room for one, so the review's sublines were dropped. Composites put two real phone captures (230 × 498, ±5°) at the lower end corner, below the TV's headline row. Unaltered shots are the raw capture re-encoded, nothing else.

**Captures (D4, blocked on the owner's TV):** release build pointed at production, on the Google TV (1080p) or a 1080p emulator: `adb exec-out screencap -p > graphics/raw/<lang>/<name>.png`, named as in the `raw`/`phone1`/`phone2` columns (phones: 390 × 844 css at 2× from a real phone/browser). EN and FR need their own TV language; AR uses the Arabic UI for every shot. Use a 5–6 player test room with natural names.

**Placeholders (now):** until `graphics/raw/` exists, the browser-TV captures listed in the `placeholder_*` columns (design-v3 shot pack) are used. Those outputs are named `*-placeholder.jpg` and carry an amber "PLACEHOLDER · browser capture" stamp (except the unaltered slot 6, marked by its name only). **Never upload a placeholder.** Rendering again after the raw captures land writes the final `*.png` files; then delete `screenshots/*-placeholder.jpg`.

A/B candidate (LISTING.md §5 #3): shot 1 (word hook) vs shot 2 first (scan to join).

## 6. Render and check

```sh
# icon, feature graphics, TV banners
node growth/marketing/play-store/src/render.mjs icon feature banner
# screenshots (finals from graphics/raw/; placeholders from the design-v3 shot pack while raw/ is missing)
node growth/marketing/play-store/src/render.mjs shots --placeholder-root=<path to design-v3/shots>
# after changing icon/banner geometry: regenerate the vectors (Android res + assets/brand) and copy into src/brand/
python3 assets/brand/scripts/gen_brand.py
cp assets/brand/icon.svg growth/marketing/play-store/src/brand/icon.svg
cp assets/brand/icon-bubble.svg growth/marketing/play-store/src/brand/bubble.svg
cp assets/brand/banner-en.svg assets/brand/banner-ar.svg growth/marketing/play-store/src/brand/
```
`render.mjs` flattens every non-icon PNG to 24-bit RGB and writes the icon as 32-bit RGBA. Quick check:
```sh
cd growth/marketing/play-store/graphics
python3 -c "from PIL import Image; import glob; [print(f, Image.open(f).size, Image.open(f).mode) for f in sorted(glob.glob('*.png')+glob.glob('screenshots/*'))]"
# expect: icon-512 RGBA 512x512; feature 1024x500 RGB; banner 1280x720 RGB; screenshots 1920x1080 RGB
```
