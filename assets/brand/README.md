# Brand assets (placeholder art until M5)

Source vectors for the Mish Ana! (مش أنا!) identity, built per DESIGN.md §1.3 ("the shared bang"). All text is converted to outlines from **Cairo Black** (SIL OFL 1.1, © The Cairo Project Authors; the same TTFs ship in `tv-app/app/src/main/res/font/`).

| File | Use |
|---|---|
| `wordmark-bilingual.svg` | `MISH ANA ! مش أنا`, the two halves sharing one bang (stem magenta `#FF3D8B`, dot amber `#FFC23D`, text cream `#FFF7EC`) |
| `wordmark-latin.svg`, `wordmark-ar.svg` | Single-script variants (bang at the Latin end / at the Arabic start) |
| `mark.svg` | 160 × 160 in-app mark (app palette; unchanged by D2 until the app moves to palette B): `bg` rounded square, magenta speech bubble (tail down-left), cream bang with an amber dot |
| `icon.svg` | Launcher / Play icon (design-v3 D2), marketing palette B: radial violet tile `#5A2E9A → #3A1E6A → #2B1650`, bubble `#FF4F9A` 4 % bigger with the tail tucked in, wider cream stem, amber `#FFC94D` dot r 10. Source of the Play `icon-512.png` and of the adaptive launcher icon |
| `icon-bubble.svg` | The icon's bubble + bang without the tile (marketing graphics, TV banner) |
| `banner-en.svg`, `banner-ar.svg` | 320 × 180 px TV banners (contain the app name, TV-BN; design-v3 D3): palette-B stage, the icon bubble with no tile + wordmark, centred as a group. The AR banner mirrors the order (bubble on the right). Also drawn at 4× for the Play TV banner |

Generated Android resources (do not edit by hand): `tv-app/app/src/main/res/drawable/banner.xml`, `drawable-ar/banner.xml`, `drawable/ic_mark.xml`, `drawable/ic_launcher_foreground.xml`, `drawable/ic_launcher_background.xml`, and the Compose wordmark geometry `tv-app/app/src/main/java/app/mishana/tv/ui/components/BrandPaths.kt`.

Regenerate everything after changing the construction:

```sh
pip install fonttools uharfbuzz
python3 assets/brand/scripts/gen_brand.py
```

Renaming the game: change `Brand.kt` / `BRAND`, the i18n `brand.*` keys, the two text strings in `scripts/gen_brand.py` (`"MISH ANA"`, `"مش أنا"`), and rerun the script.
