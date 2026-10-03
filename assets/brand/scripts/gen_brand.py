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


# ---------- banner: 320 x 180 ----------

def banner_layers(wm, arabic):
    layers = []
    mark_size = 96.0
    mark_x = 320 - 32 - mark_size if arabic else 32.0
    mark_tf = Affine.scale(mark_size / 160.0).then(Affine.translate(mark_x, (180 - mark_size) / 2.0))
    layers += mark_layers(mark_tf)
    # wordmark: 150 px wide, vertically centred, beside the mark
    bx0, by0, bx1, by1 = bang_bounds()
    if arabic:
        x0, x1 = bx0, wm["ar_bounds"][2]
    else:
        x0, x1 = wm["lat_bounds"][0], bx1
    y0 = min(wm["lat_bounds"][1], wm["ar_bounds"][1], by0)
    y1 = max(wm["lat_bounds"][3], wm["ar_bounds"][3], by1)
    width = 150.0 if not arabic else 120.0
    s = width / (x1 - x0)
    tx = 24.0 if arabic else (mark_x + mark_size + 14.0)
    ty = (180 - (y1 - y0) * s) / 2.0
    tf = Affine.translate(-x0, -y0).then(Affine.scale(s)).then(Affine.translate(tx, ty))
    if arabic:
        layers.append((stem_d(tf), MAGENTA))
        layers.append((dot_d(tf), AMBER))
        layers.append((transform_d(wm["arabic"], tf), CREAM))
    else:
        layers.append((transform_d(wm["latin"], tf), CREAM))
        layers.append((stem_d(tf), MAGENTA))
        layers.append((dot_d(tf), AMBER))
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
    body = ('<!-- TV banner (320 x 180 px, contains the app name). Generated by scripts/gen_brand.py -->\n'
            '  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>\n'
            '  <rect width="320" height="180" fill="url(#bg)"/>\n') % (BG, BG_GLOW)
    for d, fill in banner_layers(wm, arabic):
        body += '  <path d="%s" fill="%s"/>\n' % (d, fill)
    return svg_doc((0, 0, 320, 180), body, 320, 180)


def android_color(hexstr):
    return "#FF" + hexstr[1:]


def vector_xml(width_dp, height_dp, vw, vh, layers, gradient_bg=False, comment=""):
    s = ['<?xml version="1.0" encoding="utf-8"?>',
         "<!-- %s Generated by assets/brand/scripts/gen_brand.py; do not edit by hand. -->" % comment,
         '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
         '    xmlns:aapt="http://schemas.android.com/aapt"',
         '    android:width="%sdp"' % fmt(width_dp),
         '    android:height="%sdp"' % fmt(height_dp),
         '    android:viewportWidth="%s"' % fmt(vw),
         '    android:viewportHeight="%s">' % fmt(vh)]
    if gradient_bg:
        s += ['    <path android:pathData="M0,0h%sv%sh-%sz">' % (fmt(vw), fmt(vh), fmt(vw)),
              '        <aapt:attr name="android:fillColor">',
              '            <gradient android:type="linear" android:startX="0" android:startY="0"',
              '                android:endX="%s" android:endY="%s"' % (fmt(vw), fmt(vh)),
              '                android:startColor="%s" android:endColor="%s"/>' % (android_color(BG), android_color(BG_GLOW)),
              '        </aapt:attr>',
              '    </path>']
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

    res = os.path.join(ROOT, "tv-app/app/src/main/res")
    # banner: 320 x 180 px at xhdpi = 160 x 90 dp
    write(os.path.join(res, "drawable/banner.xml"),
          vector_xml(160, 90, 320, 180, banner_layers(wm, False), True, "TV banner (EN/FR), 320x180 px xhdpi, contains the app name."))
    write(os.path.join(res, "drawable-ar/banner.xml"),
          vector_xml(160, 90, 320, 180, banner_layers(wm, True), True, "TV banner (AR), mark on the right."))
    # mark (in-app)
    write(os.path.join(res, "drawable/ic_mark.xml"), vector_xml(160, 160, 160, 160, mark_layers(), False, "The mark (icon)."))
    # adaptive icon foreground: 108 dp canvas, content inside the 66 dp safe circle
    s = 64.0 / 160.0 * 1.25
    off = (108 - 160 * s) / 2.0
    fg_tf = Affine.scale(s).then(Affine.translate(off, off))
    write(os.path.join(res, "drawable/ic_launcher_foreground.xml"),
          vector_xml(108, 108, 108, 108, mark_layers(fg_tf, with_square=False), False, "Adaptive icon foreground."))
    write(os.path.join(ROOT, "tv-app/app/src/main/java/app/mishana/tv/ui/components/BrandPaths.kt"), kotlin_paths(wm))


if __name__ == "__main__":
    main()
