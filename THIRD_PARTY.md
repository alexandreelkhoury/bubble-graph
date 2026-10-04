# Third-party material

This file lists third-party content bundled with Mish Ana! (مش أنا!), apart from npm/Gradle dependencies, which carry their own licenses in their packages.

## Word pairs: antebrl/undercover-word-game (MIT)

- Source: https://github.com/antebrl/undercover-word-game (`src/i18n/locales/{en,fr}/wordPairs.ts`, commit `bb3a72ce0bc5667e9cab4b605aba194198296fd2`).
- Used in these packs, each marked `"license": "MIT"` and `"source": "antebrl/undercover-word-game"`:
  - `word-packs/packs/en/en-food-01.json`, `en-things-01.json`, `en-nature-01.json`, `en-places-01.json`, `en-leisure-01.json`
  - `word-packs/packs/fr/fr-food-01.json`, `fr-things-01.json`, `fr-nature-01.json`, `fr-places-01.json`, `fr-leisure-01.json`
- Changes: we dropped brand names and trademarks (for example Jacuzzi → Hot tub / Bain à remous), products, copyrighted franchises and characters (public-domain characters such as Dracula and Frankenstein are kept), real people, alcohol, religious and violent pairs, pairs that were not "similar words" (such as Germany/Beer), and duplicates. We fixed casing and some French wording (for example Docteur → Médecin, Boeuf → Bœuf), grouped the pairs by theme, and added difficulty ratings.

```
MIT License

Copyright (c) 2025 Ante Brähler

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Original word packs (CC-BY-4.0)

All other packs (`en-everyday-01`, `fr-everyday-01`, every `ar-*` and `lb-*` pack) were written for this project. They are licensed under Creative Commons Attribution 4.0 (`"license": "CC-BY-4.0"`, `"source": "original"`). The Arabic and Lebanese packs are drafts (`"status": "draft"`) awaiting review by native speakers.

## Fonts

- **Cairo**: SIL Open Font License 1.1. Copyright 2009 The Cairo Project Authors (https://github.com/Gue3bara/Cairo). This matches the font's name table (nameID 0 and 13).
  - Files: `tv-app/app/src/main/res/font/cairo_*.ttf` (unmodified), and `web-client/public/fonts/cairo-600-latin.woff2`, `cairo-600-arabic.woff2`, `cairo-900-latin.woff2`, `cairo-900-arabic.woff2`. The web files are subsets converted to WOFF2, so they are Modified Versions under the OFL. They keep the original font name, which no Reserved Font Name prevents.
  - Licence text: the full OFL 1.1 text ships with the fonts in `tv-app/licenses/OFL-Cairo.txt`, as OFL §2 requires. Any distribution of the web client must include that file too.
  - The OFL lets you bundle the font with software. The font itself may not be sold on its own.

## Sound cues: none

Every sound in `web-client/public/sounds` and `tv-app/app/src/main/res/raw` is original: synthesised from oscillators, seeded noise and filters by `tools/gen-sounds` (`pnpm gen:sounds`). No samples or third-party recordings are used.
