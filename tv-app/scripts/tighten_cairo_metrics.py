#!/usr/bin/env python3
"""Tighten the vertical metrics of the bundled Cairo fonts (tv-app/app/src/main/res/font/cairo_*.ttf).

Why: Cairo ships ascent/descent 1303/-571 (1.874 em) to cover Arabic marks. On Android 13+ StaticLayout's
fallback line spacing never lets a line be shorter than the font's ascent + descent, and Compose cannot turn it
off, so every `lineHeight` in MishType below 1.874 em was ignored: a 20 sp label took 37.5 dp instead of 24 dp,
and screens overflowed their DESIGN budgets (the lobby's bottom buttons were squeezed and clipped).

With ascent/descent 880/-180 (1.06 em, at or below every line height in MishType) Compose's `lineHeight` decides
the line box again, as CSS line-height does on the web client. ascent - descent = 700 = the cap height, so
`LineHeightStyle.Alignment.Center` centres Latin capitals in the box. Glyphs are not clipped: they may draw past
these metrics (Latin descenders reach -235, Arabic -484/+1020) into the line box's extra space.

Idempotent: it sets absolute values. Needs fontTools (`pip install fonttools`). Run from the repo root:
    python3 tv-app/scripts/tighten_cairo_metrics.py
"""
from pathlib import Path

from fontTools.ttLib import TTFont

ASCENT = 880
DESCENT = -180

FONT_DIR = Path(__file__).resolve().parent.parent / "app/src/main/res/font"

for path in sorted(FONT_DIR.glob("cairo_*.ttf")):
    font = TTFont(path)
    hhea, os2 = font["hhea"], font["OS/2"]
    hhea.ascent, hhea.descent, hhea.lineGap = ASCENT, DESCENT, 0
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = ASCENT, DESCENT, 0
    os2.usWinAscent, os2.usWinDescent = ASCENT, -DESCENT
    font.save(path)
    print(f"{path.name}: ascent {ASCENT}, descent {DESCENT}")
