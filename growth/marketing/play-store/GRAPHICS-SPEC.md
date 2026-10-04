# Mish Ana! — Play Store graphics spec (Android TV / Google TV)

Prepared 2026-10-04. Sources, checked today:
- Preview assets: [support.google.com/googleplay/android-developer/answer/9866151](https://support.google.com/googleplay/android-developer/answer/9866151)
- TV distribution: [developer.android.com/training/tv/publishing/distribute](https://developer.android.com/training/tv/publishing/distribute)
- TV app quality (TV-LB, TV-BN, TV-G4): [developer.android.com/docs/quality-guidelines/tv-app-quality](https://developer.android.com/docs/quality-guidelines/tv-app-quality)
- Metadata policy (no ranking or price claims in graphics): [answer/9898842](https://support.google.com/googleplay/android-developer/answer/9898842)

Brand tokens (`docs/DESIGN.md` §1–2): background `#120A1F`, glow `#2A0F3D`, magenta `#FF3D8B`, amber `#FFC23D` (only for the bang dot, timers and points), cream text `#FFF7EC`. Font: **Cairo Black 900** for headlines (OFL, already in `tv-app/app/src/main/res/font/`). Source vectors: `/home/alex/bubble-graph/assets/brand/` (`mark.svg`, `wordmark-bilingual.svg`, `wordmark-latin.svg`, `wordmark-ar.svg`, `banner-en.svg`, `banner-ar.svg`). Dark-only look, no cedar/flag clichés, no cartoon kids (keeps the listing from "appealing to children", see DATA-SAFETY.md §3).

## 1. Required and optional assets

| Asset | Required? | Exact spec | Notes for Mish Ana! |
|---|---|---|---|
| **App icon** | **Required** | **512 × 512 px, 32-bit PNG (with alpha), ≤ 1024 KB** | Full-bleed square: fill the whole square with `#120A1F`; Play applies the rounded mask itself, so **do not** round the corners or add a drop shadow. Use `mark.svg` content (magenta speech bubble + cream bang + amber dot), no text. A ready candidate exists: `/home/alex/mishana-site/assets/img/icon-512.png` (512 × 512, RGBA, opaque `#120A1F` corners). Check the bubble keeps ~10 % padding so the mask does not clip the tail |
| **Feature graphic** | **Required** | **1024 × 500 px, JPEG or 24-bit PNG (no alpha)** | Shown at the top of the listing and as the cover of the promo video (a play button is drawn in the centre when a video is set). See §3 |
| **Android TV banner** | **Required for TV apps** | **1280 × 720 px, JPEG or 24-bit PNG (no alpha)** | Store banner, different from the in-app launcher banner. Must contain the app name (same rule as TV-BN for the launcher). Layout: copy `banner-en.svg` / `banner-ar.svg` scaled 4× (they are 320 × 180): diagonal `#120A1F → #2A0F3D` gradient, mark on the left (right in AR), wordmark centred vertically. Export a localized AR version for the `ar` listing |
| **Android TV screenshots** | **Required: at least 1** (max 8) | JPEG or 24-bit PNG (no alpha), **16:9 landscape, 1920 × 1080** (3840 × 2160 also fine); each side 320–3840 px and the long side ≤ 2× the short side | TV-G4: at least **one unaltered, high-resolution screenshot of the current TV app**. Upload all 8 (plan in §4) |
| Phone screenshots | Not shown to anyone for a TV-only app (leanback required, `AndroidManifest.xml:7`) | Same file rules; min 2 screenshots across all device types | **Uncertain:** Play's rule is "minimum of two screenshots across device types", and Play Console has historically blocked saving the main listing without phone screenshots. If the Phone screenshots field blocks Save, upload the same 1920 × 1080 TV screenshots there (16:9 landscape is a valid phone screenshot size). If Save works without them, leave it empty |
| Tablet / Chromebook / Wear / XR screenshots | Not applicable | — | Leave empty |
| Promo (preview) video | Optional, recommended | **YouTube URL only** (no playlist/channel); public or unlisted; **ads/monetization off**; not age-restricted; embedding allowed | A 23.8 s 1920 × 1080 cut exists: `/home/alex/mishana-video/out/MishAna-16x9-v1.mp4`. Upload it to YouTube yourself (unlisted is fine), turn monetization off, then paste the URL in Main store listing → Video. It must show the real game (TV + phones), which this cut does; double-check it shows no "Premium"/prices before billing ships |
| Launcher assets inside the APK (not uploaded to Play) | TV-LB | 320 × 180 banner + 160 × 160 (xhdpi) icon | Already present: `res/drawable/banner.xml`, `res/drawable-ar/banner.xml`, adaptive `mipmap-anydpi-v26/ic_launcher.xml` (`AndroidManifest.xml:14-15`). Nothing to do |

## 2. Rules that apply to every graphic

- **No** "#1", "Best", "Top", "App of the year", "Editor's choice", "Free", prices, discounts or Google Play program badges in the icon, feature graphic or screenshots.
- **No** "Undercover", "Mr. White" or other apps' names/logos (trademark; see LISTING.md §0). The roles are "Mole" / "Taupe" / "جاسوس" and "Blank" / "Blanc" / "فاضي".
- Screenshots must show the **actual** app. Captions and a device frame are fine; invented UI is not. Use real player names that look natural (e.g. Rami, Léa, Nour, Sam, Maya, Karim) — no real public figures.
- Don't show the room code of a live production room you will keep using (rooms expire anyway, but use a test room).
- Keep text ≥ 48 px tall on 1920 × 1080 (the store shows TV screenshots small on phones and the web).
- Localize: EN and FR can share images if the caption is localized; AR gets **Arabic-UI screenshots** (switch the TV app to Arabic in Settings → Language) and RTL captions.

## 3. Feature graphic (1024 × 500)

| Zone | Content |
|---|---|
| Background | Radial/diagonal gradient `#120A1F → #2A0F3D`, subtle magenta glow behind the bang |
| Left 55 % | `wordmark-bilingual.svg` (MISH ANA ! مش أنا) ~520 px wide; under it, the tagline in Cairo Black 40–44 px, cream: EN "The secret-word party game" · FR "Le jeu d'ambiance du mot secret" · AR "لعبة الكلمة السرّية للسهرات" |
| Right 45 % | A TV showing the lobby (QR + player tiles) with 2–3 phones in front showing the hold-to-reveal word card (one phone shows "No word for you." for intrigue) |
| Safe area | Keep the wordmark and tagline out of the centre 300 × 200 px if you add a promo video (Play draws a play button there) and ≥ 40 px from every edge |
| AR version | Mirror the layout (wordmark/tagline right, TV left), Arabic tagline only |

## 4. TV screenshot sequence (conversion order)

Capture on a **Google TV (1080p) emulator** or a real 1080p TV: `adb exec-out screencap -p > tv-02-lobby.png` (a 4K TV gives 3840 × 2160, which is also accepted). Use the **release** build pointed at production so no debug label shows. Play a real 4–6 player game with phones/browsers to reach each screen. Screen IDs are from `docs/DESIGN.md` §7.

**Caption layout** (for captioned shots): 1920 × 1080 canvas, `#120A1F` background; the real screenshot scaled to 1600 × 900 and placed at the bottom centre (y = 160), 24 px corner radius, 2 px `#4A3A66` outline; caption in the top 160 px band, Cairo Black 64–72 px, cream with the key word in magenta. AR: right-aligned, Arabic caption, RTL.

| # | Screen | What must be visible | EN caption | FR caption | AR caption | Altered? |
|---|---|---|---|---|---|---|
| 1 | **TV-02 Lobby** | QR code, room code, 5–6 player tiles in different colours, "Everybody's in, start!" | Scan the code. **Your phone** is the controller. | Scannez le code. **Votre téléphone** sert de manette. | امسحوا الرمز… **وهاتفك** هو جهاز التحكم | Captioned |
| 2 | **TV-04 Role reveal** + 2 phone frames (PH-04) | TV "Check your phones!", phone A showing a word card, phone B showing "No word for you." | Everyone gets a **secret word**. Almost everyone. | Chacun reçoit un **mot secret**. Ou presque. | كل واحد إلو **كلمة سرّية**… تقريبًا | Captioned (composite of real TV + real phone captures) |
| 3 | **TV-05 Clues** | Speaker spotlight, order strip, timer | One clue each. **Who sounds off?** | Un indice chacun. **Qui sonne faux ?** | تلميح لكل واحد… **مين كلامو غريب؟** | Captioned |
| 4 | **TV-06 Voting** | Vote grid with "voted" checks, countdown | **Vote** from the couch | **Votez** depuis le canapé | **صوّتوا** من عالكنبة | Captioned |
| 5 | **TV-09 Elimination reveal** | OUT stamp, "…the Mole! Nice catch." | — | — | — | **Unaltered** (satisfies TV-G4) |
| 6 | **TV-10 Blank guess** | "The Blank gets one guess" | Caught? The Blank gets **one last guess** | Démasqué ? Le Blanc a **une dernière chance** | انكشف؟ الفاضي إلو **فرصة أخيرة** | Captioned |
| 7 | **TV-11 Results** | Both words, scoreboard with trophy, "Play again" | **Play again.** Scores carry over. | **Rejouez.** Les scores continuent. | **العبوا كمان مرّة**… والنقاط محفوظة | Captioned |
| 8 | **TV-02 Lobby in Arabic** (EN/FR listings) / **TV-02 Lobby in English** (AR listing) | The full UI in the other script, RTL mirrored | — | — | — | **Unaltered** (shows the 3-language support) |

A/B candidate for screenshot slot 1 (graphics experiment, LISTING.md §5): swap #1 and #5 (big reveal first vs "scan to join" first).

## 5. File naming and delivery

Put finished files in `/home/alex/mishana-marketing/play-store/graphics/` (the folder exists):
```
icon-512.png                      32-bit PNG
feature-1024x500-en.png  -fr.png  -ar.png      24-bit PNG (flatten alpha)
tv-banner-1280x720-en.png  -ar.png             24-bit PNG (flatten alpha)
tv-01-lobby-en.png … tv-08-…-en.png            (and -fr, -ar)
```
Flatten alpha for every non-icon asset: `convert in.png -background '#120A1F' -alpha remove -alpha off out.png` (ImageMagick) — Play rejects alpha in the feature graphic, banner and screenshots.

Quick check before upload:
```sh
for f in graphics/*.png; do python3 -c "from PIL import Image; im=Image.open('$f'); print('$f', im.size, im.mode)"; done
# expect: icon RGBA 512x512; everything else RGB; banner 1280x720; feature 1024x500; screenshots 1920x1080
```
