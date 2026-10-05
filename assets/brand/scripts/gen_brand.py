#!/usr/bin/env python3
"""Generate the Mish Ana! brand vectors (DESIGN.md §1.3) from Cairo Black outlines.

Placeholder art until M5. Outputs (all text converted to outlines):
  assets/brand/wordmark-bilingual.svg, wordmark-latin.svg, wordmark-ar.svg, mark.svg,
  assets/brand/banner-en.svg, banner-ar.svg (320 x 180 px, TV-BN)
  tv-app/app/src/main/res/drawable/banner.xml          (EN/FR banner, vector, 320x180 px @ xhdpi)
  tv-app/app/src/main/res/drawable-ar/banner.xml       (AR banner: mark on the right)
  tv-app/app/src/main/res/drawable/ic_launcher_foreground.xml
  tv-app/app/src/main/res/drawable/ic_mark.xml         (the 160 x 160 mark, used in-app)
  tv-app/app/src/main/java/app/mishana/tv/ui/components/BrandPaths.kt

Usage (from the repo root):
  pip install fonttools uharfbuzz
  python3 assets/brand/scripts/gen_brand.py --font-dir <dir containing Cairo_900Black.ttf>
The Cairo static instances ship in tv-app/app/src/main/res/font/ (cairo_black.ttf), which is the default.
"""
import argparse
import math
import os

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

CREAM = "#FFF7EC"
MAGENTA = "#FF3D8B"
AMBER = "#FFC23D"
BG = "#120A1F"
BG_GLOW = "#2A0F3D"

# Launcher / Play icon and TV banner: marketing palette B (growth/video/src/brand.ts; design-v3 D2, D3).
# The in-app mark (ic_mark.xml, mark.svg) keeps the app's own tokens above until the app moves to palette B.
B_MAGENTA = "#FF4F9A"
B_AMBER = "#FFC94D"
B_BG_TOP = "#2E1856"
B_BG_DEEP = "#1D1036"
ICON_TILE_STOPS = ((0.0, "#5A2E9A"), (0.6, "#3A1E6A"), (1.0, "#2B1650"))  # radial, centre (0.5, 0.3), r 0.85

# Artboard constants (DESIGN §1.3, viewBox 0 0 1200 300)
LATIN_RIGHT = 548.0
LATIN_BASELINE = 210.0
LATIN_CAP = 132.0
AR_LEFT = 652.0
AR_BASELINE = 214.0
AR_ALEF_TOP = 140.0  # alef body height in artboard units (aligns with the Latin cap line)
STEM = dict(x=576.0, y=36.0, w=48.0, h=150.0, r=24.0)
DOT = dict(cx=594.0, cy=236.0, r=26.0)
SKEW_DEG = -8.0
SKEW_CENTER = (600.0, 111.0)

K = 0.5522847498  # cubic approximation of a quarter circle


def fmt(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


class Affine:
    def __init__(self, a=1, b=0, c=0, d=1, e=0, f=0):
        self.m = (a, b, c, d, e, f)

    def apply(self, x, y):
        a, b, c, d, e, f = self.m
        return a * x + c * y + e, b * x + d * y + f

    def then(self, other):
        """self followed by other."""
        a1, b1, c1, d1, e1, f1 = self.m
        a2, b2, c2, d2, e2, f2 = other.m
        return Affine(
            a2 * a1 + c2 * b1, b2 * a1 + d2 * b1,
            a2 * c1 + c2 * d1, b2 * c1 + d2 * d1,
            a2 * e1 + c2 * f1 + e2, b2 * e1 + d2 * f1 + f2,
        )

    @staticmethod
    def scale(s, sy=None):
        return Affine(s, 0, 0, s if sy is None else sy, 0, 0)

    @staticmethod
    def translate(x, y):
        return Affine(1, 0, 0, 1, x, y)


def skew_about_center():
    t = math.tan(math.radians(SKEW_DEG))
    cx, cy = SKEW_CENTER
    return Affine.translate(-cx, -cy).then(Affine(1, 0, t, 1, 0, 0)).then(Affine.translate(cx, cy))


def rounded_rect_cmds(x, y, w, h, r):
    """Absolute command list: ("M",(x,y)), ("L",(x,y)), ("C",(x1,y1,x2,y2,x,y)), ("Z",())."""
    k = r * K
    return [
        ("M", (x + r, y)),
        ("L", (x + w - r, y)),
        ("C", (x + w - r + k, y, x + w, y + r - k, x + w, y + r)),
        ("L", (x + w, y + h - r)),
        ("C", (x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h)),
        ("L", (x + r, y + h)),
        ("C", (x + r - k, y + h, x, y + h - r + k, x, y + h - r)),
        ("L", (x, y + r)),
        ("C", (x, y + r - k, x + r - k, y, x + r, y)),
        ("Z", ()),
    ]


def circle_cmds(cx, cy, r):
    k = r * K
    return [
        ("M", (cx + r, cy)),
        ("C", (cx + r, cy + k, cx + k, cy + r, cx, cy + r)),
        ("C", (cx - k, cy + r, cx - r, cy + k, cx - r, cy)),
        ("C", (cx - r, cy - k, cx - k, cy - r, cx, cy - r)),
        ("C", (cx + k, cy - r, cx + r, cy - k, cx + r, cy)),
        ("Z", ()),
    ]


def cmds_to_d(cmds, tf=None):
    out = []
    for op, pts in cmds:
        if op == "Z":
            out.append("Z")
            continue
        p = list(pts)
        if tf is not None:
            q = []
            for i in range(0, len(p), 2):
                q.extend(tf.apply(p[i], p[i + 1]))
            p = q
        out.append(op + " ".join(fmt(v) for v in p))
    return "".join(out)


class Shaper:
    def __init__(self, path):
        self.tt = TTFont(path)
        self.gs = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()
        blob = hb.Blob.from_file_path(path)
        self.hb_font = hb.Font(hb.Face(blob))

    def shape(self, text):
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb_font, buf)
        glyphs = []
        x = 0
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            glyphs.append((self.order[info.codepoint], x + pos.x_offset, pos.y_offset))
            x += pos.x_advance
        return glyphs, x

    def path_d(self, text, tf_font_to_out):
        """SVG path for shaped text; tf maps font units (y up, baseline 0, pen at 0) to output coords."""
        glyphs, _ = self.shape(text)
        pen = SVGPathPen(self.gs, ntos=fmt)
        for name, gx, gy in glyphs:
            g_tf = Affine.translate(gx, gy).then(tf_font_to_out)
            self.gs[name].draw(TransformPen(pen, g_tf.m))
        return pen.getCommands()

    def bounds(self, text):
        glyphs, adv = self.shape(text)
        xmin = ymin = 1e9
        xmax = ymax = -1e9
        for name, gx, gy in glyphs:
            bp = BoundsPen(self.gs)
            self.gs[name].draw(bp)
            if bp.bounds is None:
                continue
            a, b, c, d = bp.bounds
            xmin, ymin, xmax, ymax = min(xmin, a + gx), min(ymin, b + gy), max(xmax, c + gx), max(ymax, d + gy)
        return (xmin, ymin, xmax, ymax), adv

    def glyph_top(self, gname):
        bp = BoundsPen(self.gs)
        self.gs[gname].draw(bp)
        return bp.bounds[3]


def build_wordmark(sh):
    """Returns dict with latin/arabic path d (artboard coords) and their bounds."""
    cap = sh.glyph_top("H")  # cap height in font units
    s_lat = LATIN_CAP / cap
    (lx0, ly0, lx1, ly1), _ = sh.bounds("MISH ANA")
    # right-align the ink's right edge at LATIN_RIGHT; y flips (font y up -> svg y down)
    tf_lat = Affine.scale(s_lat, -s_lat).then(Affine.translate(LATIN_RIGHT - lx1 * s_lat, LATIN_BASELINE))
    latin = sh.path_d("MISH ANA", tf_lat)
    lat_bounds = (LATIN_RIGHT - (lx1 - lx0) * s_lat, LATIN_BASELINE - ly1 * s_lat, LATIN_RIGHT, LATIN_BASELINE - ly0 * s_lat)

    alef = sh.glyph_top("uniFE8E")
    s_ar = AR_ALEF_TOP / alef
    (ax0, ay0, ax1, ay1), _ = sh.bounds("مش أنا")
    tf_ar = Affine.scale(s_ar, -s_ar).then(Affine.translate(AR_LEFT - ax0 * s_ar, AR_BASELINE))
    arabic = sh.path_d("مش أنا", tf_ar)
    ar_bounds = (AR_LEFT, AR_BASELINE - ay1 * s_ar, AR_LEFT + (ax1 - ax0) * s_ar, AR_BASELINE - ay0 * s_ar)
    return dict(latin=latin, arabic=arabic, lat_bounds=lat_bounds, ar_bounds=ar_bounds)


def stem_d(tf=None):
    sk = skew_about_center()
    full = sk if tf is None else sk.then(tf)
    return cmds_to_d(rounded_rect_cmds(STEM["x"], STEM["y"], STEM["w"], STEM["h"], STEM["r"]), full)


def dot_d(tf=None):
    return cmds_to_d(circle_cmds(DOT["cx"], DOT["cy"], DOT["r"]), tf)


def bang_bounds():
    sk = skew_about_center()
    pts = [sk.apply(STEM["x"], STEM["y"]), sk.apply(STEM["x"] + STEM["w"], STEM["y"]),
           sk.apply(STEM["x"], STEM["y"] + STEM["h"]), sk.apply(STEM["x"] + STEM["w"], STEM["y"] + STEM["h"])]
    xs = [p[0] for p in pts] + [DOT["cx"] - DOT["r"], DOT["cx"] + DOT["r"]]
    return min(xs), STEM["y"], max(xs), DOT["cy"] + DOT["r"]


def svg_doc(view, body, w=None, h=None):
    x, y, vw, vh = view
    size = "" if w is None else ' width="%s" height="%s"' % (fmt(w), fmt(h))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s"%s>\n%s</svg>\n'
            % (fmt(x), fmt(y), fmt(vw), fmt(vh), size, body))


def wordmark_svgs(wm):
    lat, ar = wm["lat_bounds"], wm["ar_bounds"]
    bx0, by0, bx1, by1 = bang_bounds()
    pad = 24
    glow = ('  <defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%">'
            '<feGaussianBlur stdDeviation="12"/></filter></defs>\n')
    bang = ('  <path d="%s" fill="%s" opacity="0.4" filter="url(#glow)"/>\n'
            '  <path d="%s" fill="%s"/>\n  <path d="%s" fill="%s"/>\n') % (stem_d(), MAGENTA, stem_d(), MAGENTA, dot_d(), AMBER)
    latin = '  <path d="%s" fill="%s"/>\n' % (wm["latin"], CREAM)
    arabic = '  <path d="%s" fill="%s"/>\n' % (wm["arabic"], CREAM)
    top = min(lat[1], ar[1], by0) - pad
    bottom = max(lat[3], ar[3], by1) + pad
    out = {}
    out["wordmark-bilingual.svg"] = svg_doc((lat[0] - pad, top, ar[2] - lat[0] + 2 * pad, bottom - top),
                                            "<!-- Mish Ana! bilingual wordmark (the shared bang). Generated by scripts/gen_brand.py -->\n" + glow + latin + bang + arabic)
    out["wordmark-latin.svg"] = svg_doc((lat[0] - pad, top, bx1 - lat[0] + 2 * pad, bottom - top),
                                        "<!-- Latin wordmark. Generated by scripts/gen_brand.py -->\n" + glow + latin + bang)
    out["wordmark-ar.svg"] = svg_doc((bx0 - pad, top, ar[2] - bx0 + 2 * pad, bottom - top),
                                     "<!-- Arabic wordmark. Generated by scripts/gen_brand.py -->\n" + glow + bang + arabic)
    return out


# ---------- mark (icon): 160 x 160 ----------

def bubble_cmds(x, y, w, h, r, tail):
    cmds = rounded_rect_cmds(x, y, w, h, r)
    (t1, t2, t3) = tail
    cmds += [("M", t1), ("L", t2), ("L", t3), ("Z", ())]
    return cmds


MARK_BUBBLE = dict(x=24.0, y=20.0, w=112.0, h=96.0, r=30.0, tail=((36.0, 100.0), (70.0, 112.0), (26.0, 142.0)))
MARK_BANG_SCALE = 0.32


def mark_bang_tf():
    # map the artboard bang (x 576..624+, y 36..262) into the bubble centre
    bx0, by0, bx1, by1 = bang_bounds()
    s = MARK_BANG_SCALE
    cx_b = (bx0 + bx1) / 2.0
    cy_b = (by0 + by1) / 2.0
    cx_t = MARK_BUBBLE["x"] + MARK_BUBBLE["w"] / 2.0
    cy_t = MARK_BUBBLE["y"] + MARK_BUBBLE["h"] / 2.0
    return Affine.translate(-cx_b, -cy_b).then(Affine.scale(s)).then(Affine.translate(cx_t, cy_t))


def mark_layers(tf=None, with_square=True):
    """[(d, fill)] in 160x160 space, mapped by tf."""
    layers = []
    if with_square:
        layers.append((cmds_to_d(rounded_rect_cmds(0, 0, 160, 160, 36), tf), BG))
    b = MARK_BUBBLE
    layers.append((cmds_to_d(bubble_cmds(b["x"], b["y"], b["w"], b["h"], b["r"], b["tail"]), tf), MAGENTA))
    btf = mark_bang_tf() if tf is None else mark_bang_tf().then(tf)
    layers.append((stem_d(btf), CREAM))
    layers.append((dot_d(btf), AMBER))
    return layers


def mark_svg():
    body = "<!-- Mish Ana! mark (app icon). Generated by scripts/gen_brand.py -->\n"
    for d, fill in mark_layers():
        body += '  <path d="%s" fill="%s"/>\n' % (d, fill)
    return svg_doc((0, 0, 160, 160), body, 160, 160)


# ---------- launcher / Play icon (design-v3 D2): 160 x 160 ----------
# Lighter violet tile (stays visible on dark launchers), bubble 4 % bigger with the tail tucked in so a circular
# mask doesn't clip it, bang stem 22 % wider, amber dot r 10 (readable at 32 px).

ICON_TAIL = ((40.0, 104.0), (72.0, 114.0), (35.0, 134.0))
ICON_DOT = (77.6, 97.0, 10.0)
# Visual centre of the bubble (incl. tail) after icon_group_tf(), used to centre it in other canvases.
ICON_CENTRE = (80.0, 77.0)


def icon_group_tf():
    return Affine.translate(-80, -81).then(Affine.scale(1.04)).then(Affine.translate(80, 80))


def icon_layers(tf=None):
    """[(d, fill)] bubble + bang (no tile) in 160x160 icon space, mapped by tf."""
    g = icon_group_tf() if tf is None else icon_group_tf().then(tf)
    b = MARK_BUBBLE
    bubble = cmds_to_d(bubble_cmds(b["x"], b["y"], b["w"], b["h"], b["r"], ICON_TAIL), g)
    widen = Affine.translate(-80, -68).then(Affine(1.22, 0, 0, 1.08, 0, 0)).then(Affine.translate(80, 68))
    stem = stem_d(mark_bang_tf().then(widen).then(g))
    dot = cmds_to_d(circle_cmds(*ICON_DOT), g)
    return [(bubble, B_MAGENTA), (stem, CREAM), (dot, B_AMBER)]


def icon_svg(with_tile=True):
    body = "<!-- Mish Ana! launcher / Play icon (palette B). Generated by scripts/gen_brand.py -->\n"
    if with_tile:
        body += ('  <defs><radialGradient id="tile" cx="0.5" cy="0.3" r="0.85">%s</radialGradient></defs>\n'
                 '  <rect width="160" height="160" fill="url(#tile)"/>\n') % "".join(
            '<stop offset="%s" stop-color="%s"/>' % (fmt(o), c) for o, c in ICON_TILE_STOPS)
        view = (0, 0, 160, 160)
    else:
        view = (20, 16, 120, 122)  # tight box around bubble + tail
    for d, fill in icon_layers():
        body += '  <path d="%s" fill="%s"/>\n' % (d, fill)
    return svg_doc(view, body, view[2], view[3])


def icon_background_xml():
    stops = "\n".join('                <item android:offset="%s" android:color="%s"/>' % (fmt(o), android_color(c))
                      for o, c in ICON_TILE_STOPS)
    return """<?xml version="1.0" encoding="utf-8"?>
<!-- Adaptive icon background (palette B violet tile). Generated by assets/brand/scripts/gen_brand.py; do not edit by hand. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient android:type="radial" android:centerX="54" android:centerY="32.4" android:gradientRadius="91.8">
%s
            </gradient>
        </aapt:attr>
    </path>
</vector>
""" % stops


# ---------- banner: 320 x 180 ----------

BANNER_W, BANNER_H = 320.0, 180.0
BANNER_BUBBLE_H = 84.0   # bubble (incl. tail) height, no tile (design-v3 D3)
BANNER_WM_W = 168.0      # Latin wordmark width; the Arabic one uses the same scale
BANNER_GAP = 16.0
BANNER_AR_BOOST = 1.2    # the Arabic name is short; give it the Latin one's visual weight


def banner_parts(wm, arabic):
    """Layout of the 320x180 banner: bubble + wordmark, centred as a group. Mirrored in Arabic."""
    bx0, by0, bx1, by1 = bang_bounds()
    lx0, lx1 = wm["lat_bounds"][0], bx1
    s = BANNER_WM_W / (lx1 - lx0)
    if arabic:
        x0, x1 = bx0, wm["ar_bounds"][2]
        s *= BANNER_AR_BOOST
    else:
        x0, x1 = lx0, lx1
    y0 = min(wm["lat_bounds"][1], wm["ar_bounds"][1], by0)
    y1 = max(wm["lat_bounds"][3], wm["ar_bounds"][3], by1)
    wm_w = (x1 - x0) * s
    ib = icon_bubble_bounds()
    bs = BANNER_BUBBLE_H / (ib[3] - ib[1])
    bub_w = (ib[2] - ib[0]) * bs
    total = bub_w + BANNER_GAP + wm_w
    left = (BANNER_W - total) / 2.0
    if arabic:
        wm_x, bub_x = left, left + wm_w + BANNER_GAP
    else:
        bub_x, wm_x = left, left + bub_w + BANNER_GAP
    bub_y = (BANNER_H - BANNER_BUBBLE_H) / 2.0
    bub_tf = Affine.translate(-ib[0], -ib[1]).then(Affine.scale(bs)).then(Affine.translate(bub_x, bub_y))
    wm_tf = Affine.translate(-x0, -y0).then(Affine.scale(s)).then(Affine.translate(wm_x, (BANNER_H - (y1 - y0) * s) / 2.0))
    glow = (bub_x + bub_w / 2.0, bub_y + BANNER_BUBBLE_H / 2.0, BANNER_BUBBLE_H * 0.9)
    return bub_tf, wm_tf, glow


def icon_bubble_bounds():
    """Ink bounds of the icon bubble (incl. tail) in 160 space after icon_group_tf()."""
    g = icon_group_tf()
    b = MARK_BUBBLE
    pts = [g.apply(b["x"], b["y"]), g.apply(b["x"] + b["w"], b["y"] + b["h"])] + [g.apply(*p) for p in ICON_TAIL]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def banner_layers(wm, arabic):
    bub_tf, tf, _ = banner_parts(wm, arabic)
    layers = list(icon_layers(bub_tf))
    if arabic:
        layers.append((stem_d(tf), B_MAGENTA))
        layers.append((dot_d(tf), B_AMBER))
        layers.append((transform_d(wm["arabic"], tf), CREAM))
    else:
        layers.append((transform_d(wm["latin"], tf), CREAM))
        layers.append((stem_d(tf), B_MAGENTA))
        layers.append((dot_d(tf), B_AMBER))
    return layers


def transform_d(d, tf):
    """Re-emit an absolute SVG path (M/L/H/V/Q/C/Z, as SVGPathPen writes it) through an affine map."""
    import re
    toks = re.findall(r"[MLHVQCZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    out = []
    i = 0
    op = None
    cur = (0.0, 0.0)
    start = (0.0, 0.0)
    while i < len(toks):
        t = toks[i]
        if t in "MLHVQCZ":
            op = t
            i += 1
            if op == "Z":
                out.append("Z")
                cur = start
            continue
        if op == "H":
            nums = [float(toks[i]), cur[1]]
            i += 1
            emit = "L"
        elif op == "V":
            nums = [cur[0], float(toks[i])]
            i += 1
            emit = "L"
        else:
            n = {"M": 2, "L": 2, "Q": 4, "C": 6}[op]
            nums = [float(v) for v in toks[i:i + n]]
            i += n
            emit = op
        cur = (nums[-2], nums[-1])
        if emit == "M":
            start = cur
            op = "L"  # implicit lineto after moveto
        pts = []
        for j in range(0, len(nums), 2):
            pts.extend(tf.apply(nums[j], nums[j + 1]))
        out.append(emit + " ".join(fmt(v) for v in pts))
    return "".join(out)


def banner_svg(wm, arabic):
    _, _, (gx, gy, gr) = banner_parts(wm, arabic)
    body = ('<!-- TV banner (320 x 180 px, contains the app name; palette B, no tile). Generated by scripts/gen_brand.py -->\n'
            '  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient>\n'
            '  <radialGradient id="lift" gradientUnits="userSpaceOnUse" cx="%s" cy="36" r="200">'
            '<stop offset="0" stop-color="#A05FF5" stop-opacity="0.55"/><stop offset="1" stop-color="#A05FF5" stop-opacity="0"/></radialGradient>\n'
            '  <radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="%s" cy="%s" r="%s">'
            '<stop offset="0" stop-color="%s" stop-opacity="0.45"/><stop offset="1" stop-color="%s" stop-opacity="0"/></radialGradient></defs>\n'
            '  <rect width="320" height="180" fill="url(#bg)"/>\n  <rect width="320" height="180" fill="url(#lift)"/>\n'
            '  <rect width="320" height="180" fill="url(#glow)"/>\n') % (
        B_BG_TOP, B_BG_DEEP, fmt(240 if arabic else 80), fmt(gx), fmt(gy), fmt(gr), B_MAGENTA, B_MAGENTA)
    for d, fill in banner_layers(wm, arabic):
        body += '  <path d="%s" fill="%s"/>\n' % (d, fill)
    return svg_doc((0, 0, 320, 180), body, 320, 180)


def android_color(hexstr):
    return "#FF" + hexstr[1:]


def _argb(hexstr, alpha):
    return "#%02X%s" % (int(round(alpha * 255)), hexstr[1:])


def vector_xml(width_dp, height_dp, vw, vh, layers, banner_bg=None, comment=""):
    """banner_bg: None, or (lift_cx, glow_cx, glow_cy, glow_r) for the palette-B banner background."""
    s = ['<?xml version="1.0" encoding="utf-8"?>',
         "<!-- %s Generated by assets/brand/scripts/gen_brand.py; do not edit by hand. -->" % comment,
         '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
         '    xmlns:aapt="http://schemas.android.com/aapt"',
         '    android:width="%sdp"' % fmt(width_dp),
         '    android:height="%sdp"' % fmt(height_dp),
         '    android:viewportWidth="%s"' % fmt(vw),
         '    android:viewportHeight="%s">' % fmt(vh)]
    if banner_bg is not None:
        lift_cx, gx, gy, gr = banner_bg
        rect = "M0,0h%sv%sh-%sz" % (fmt(vw), fmt(vh), fmt(vw))

        def grad(attrs):
            return ['    <path android:pathData="%s">' % rect,
                    '        <aapt:attr name="android:fillColor">',
                    '            <gradient %s/>' % attrs,
                    '        </aapt:attr>',
                    '    </path>']
        s += grad('android:type="linear" android:startX="0" android:startY="0" android:endX="%s" android:endY="%s" '
                  'android:startColor="%s" android:endColor="%s"' % (fmt(vw), fmt(vh), android_color(B_BG_TOP), android_color(B_BG_DEEP)))
        s += grad('android:type="radial" android:centerX="%s" android:centerY="36" android:gradientRadius="200" '
                  'android:startColor="%s" android:endColor="%s"' % (fmt(lift_cx), _argb("#A05FF5", .55), _argb("#A05FF5", 0)))
        s += grad('android:type="radial" android:centerX="%s" android:centerY="%s" android:gradientRadius="%s" '
                  'android:startColor="%s" android:endColor="%s"' % (fmt(gx), fmt(gy), fmt(gr), _argb(B_MAGENTA, .45), _argb(B_MAGENTA, 0)))
    for d, fill in layers:
        s.append('    <path android:fillColor="%s" android:pathData="%s"/>' % (android_color(fill), d))
    s.append("</vector>")
    return "\n".join(s) + "\n"


def kotlin_paths(wm):
    lat, ar = wm["lat_bounds"], wm["ar_bounds"]
    bx0, by0, bx1, by1 = bang_bounds()

    def chunk(s, n=180):
        parts = [s[i:i + n] for i in range(0, len(s), n)]
        return " +\n        ".join('"%s"' % p for p in parts)

    return """// GENERATED by assets/brand/scripts/gen_brand.py from Cairo Black outlines (OFL). Do not edit by hand.
package app.mishana.tv.ui.components

/** Wordmark geometry in the DESIGN §1.3 artboard (viewBox 0 0 1200 300, y down). */
internal object BrandPaths {
    const val ARTBOARD_W = 1200f
    const val ARTBOARD_H = 300f

    // Ink bounds (left, top, right, bottom)
    val LATIN_BOUNDS = floatArrayOf(%sf, %sf, %sf, %sf)
    val ARABIC_BOUNDS = floatArrayOf(%sf, %sf, %sf, %sf)
    val BANG_BOUNDS = floatArrayOf(%sf, %sf, %sf, %sf)

    // The bang: stem rounded rect (skewed %s deg about (%s, %s)) and dot
    const val STEM_X = %sf
    const val STEM_Y = %sf
    const val STEM_W = %sf
    const val STEM_H = %sf
    const val STEM_R = %sf
    const val SKEW_DEG = %sf
    const val SKEW_CX = %sf
    const val SKEW_CY = %sf
    const val DOT_CX = %sf
    const val DOT_CY = %sf
    const val DOT_R = %sf

    /** "MISH ANA", right edge at x = 548, baseline y = 210. */
    const val LATIN =
        %s

    /** "مش أنا", left edge at x = 652, baseline y = 214. */
    const val ARABIC =
        %s
}
""" % (fmt(lat[0]), fmt(lat[1]), fmt(lat[2]), fmt(lat[3]),
       fmt(ar[0]), fmt(ar[1]), fmt(ar[2]), fmt(ar[3]),
       fmt(bx0), fmt(by0), fmt(bx1), fmt(by1),
       fmt(SKEW_DEG), fmt(SKEW_CENTER[0]), fmt(SKEW_CENTER[1]),
       fmt(STEM["x"]), fmt(STEM["y"]), fmt(STEM["w"]), fmt(STEM["h"]), fmt(STEM["r"]),
       fmt(SKEW_DEG), fmt(SKEW_CENTER[0]), fmt(SKEW_CENTER[1]),
       fmt(DOT["cx"]), fmt(DOT["cy"]), fmt(DOT["r"]),
       chunk(wm["latin"]), chunk(wm["arabic"]))


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote", os.path.relpath(path, ROOT))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--font-dir", default=os.path.join(ROOT, "tv-app/app/src/main/res/font"))
    args = ap.parse_args()
    font = os.path.join(args.font_dir, "cairo_black.ttf")
    if not os.path.exists(font):
        font = os.path.join(args.font_dir, "Cairo_900Black.ttf")
    sh = Shaper(font)
    wm = build_wordmark(sh)

    brand = os.path.join(ROOT, "assets/brand")
    for name, text in wordmark_svgs(wm).items():
        write(os.path.join(brand, name), text)
    write(os.path.join(brand, "mark.svg"), mark_svg())
    write(os.path.join(brand, "banner-en.svg"), banner_svg(wm, False))
    write(os.path.join(brand, "banner-ar.svg"), banner_svg(wm, True))
    write(os.path.join(brand, "icon.svg"), icon_svg(True))
    write(os.path.join(brand, "icon-bubble.svg"), icon_svg(False))

    res = os.path.join(ROOT, "tv-app/app/src/main/res")
    # banner: 320 x 180 px at xhdpi = 160 x 90 dp
    for arabic, sub, label in ((False, "drawable", "EN/FR"), (True, "drawable-ar", "AR, mark on the right")):
        _, _, (gx, gy, gr) = banner_parts(wm, arabic)
        write(os.path.join(res, sub, "banner.xml"),
              vector_xml(160, 90, 320, 180, banner_layers(wm, arabic), (240 if arabic else 80, gx, gy, gr),
                         "TV banner (%s), 320x180 px xhdpi, contains the app name; palette B, no tile." % label))
    # mark (in-app, app palette)
    write(os.path.join(res, "drawable/ic_mark.xml"), vector_xml(160, 160, 160, 160, mark_layers(), None, "The mark (icon)."))
    # adaptive icon: palette-B violet tile background + bubble foreground. 108 dp canvas; the bubble (incl. tail)
    # stays inside the 66 dp safe circle (farthest point ~75 icon units from ICON_CENTRE -> 75 * 0.43 = 32 dp).
    s = 0.43
    fg_tf = Affine.translate(-ICON_CENTRE[0], -ICON_CENTRE[1]).then(Affine.scale(s)).then(Affine.translate(54, 54))
    write(os.path.join(res, "drawable/ic_launcher_foreground.xml"),
          vector_xml(108, 108, 108, 108, icon_layers(fg_tf), None, "Adaptive icon foreground (palette B, design-v3 D2)."))
    write(os.path.join(res, "drawable/ic_launcher_background.xml"), icon_background_xml())
    write(os.path.join(ROOT, "tv-app/app/src/main/java/app/mishana/tv/ui/components/BrandPaths.kt"), kotlin_paths(wm))


if __name__ == "__main__":
    main()
