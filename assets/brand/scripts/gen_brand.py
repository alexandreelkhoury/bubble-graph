#!/usr/bin/env python3
"""Generate the JAMAA platform brand (DESIGN-JAMAA §1.3, §1.4; JAMAA-PLATFORM §3.9) from Cairo Black outlines.

Wordmark "the three heads": "JAMAA" with the crossbar of each A removed and an amber dot (a head) in each counter;
the Arabic «جماعة» carries the same amber dot as the dot of ج. Mark "the ring": five character bodies (circle,
square, star, triangle, arch) in a closed ring around one amber dot.

Outputs (all text converted to outlines):
  assets/brand/wordmark-latin.svg      viewBox 0 0 1000 260
  assets/brand/wordmark-ar.svg         viewBox 0 0 1000 300
  assets/brand/wordmark-bilingual.svg  viewBox 0 0 1000 560 (Latin on top)
  assets/brand/mark.svg                the ring on its tile, with faces (108 artboard, 512 px export)
  assets/brand/icon.svg                launcher / Play icon: the ring on its tile, no faces (512 px export)
  assets/brand/banner-en.svg, banner-ar.svg   TV banner 320 x 180 px (EN/FR, and AR mirrored)
  tv-app/app/src/main/res/drawable/banner.xml, drawable-ar/banner.xml
  tv-app/app/src/main/res/drawable/ic_launcher_foreground.xml, ic_launcher_background.xml,
                                   ic_launcher_monochrome.xml, ic_mark.xml
  tv-app/app/src/main/java/app/jamaa/tv/ui/components/BrandPaths.kt

Mish Ana!'s "shared bang" art is game art now: assets/games/mishana/scripts/gen_logo.py.

Usage (from the repo root):
  pip install fonttools uharfbuzz skia-pathops
  python3 assets/brand/scripts/gen_brand.py [--font-dir DIR] [--preview DIR]
--font-dir defaults to tv-app/app/src/main/res/font (cairo_black.ttf). --preview writes PNG previews of the
wordmarks, the icon and the banners (rendered with a headless Chromium; $CHROME overrides it) for the review that
DESIGN-JAMAA §1.3 asks for (no crossbar fragment left, dots inside the counters at 120 dp).
"""
import argparse
import math
import os
import subprocess

import pathops
import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen, RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

# Tokens (DESIGN.md §2, DESIGN-JAMAA §1.3-§1.5)
CREAM = "#FFF7EC"      # color.text
AMBER = "#FFC94D"      # color.accent, the lamp: wordmark dots and the ring's centre dot
INK = "#120A1F"        # glyph ink (faces)
STAGE_TOP = "#2E1856"  # palette B stage, banner diagonal
STAGE_DEEP = "#1D1036"
TILE_STOPS = ((0.0, "#5A2E9A"), (0.7, "#3A1E6A"), (1.0, "#2B1650"))  # icon tile, radial (DESIGN-JAMAA §1.4)
TILE_CENTRE = (0.5, 0.3)  # as the previous launcher tile, so it keeps its edge on dark launchers
TILE_RADIUS = 0.85

# ---------- Latin wordmark (DESIGN-JAMAA §1.3) ----------
LAT_VIEW = (1000.0, 260.0)
LAT_SIZE = 220.0          # font size in artboard units
LAT_TRACKING = -20.0      # 1/1000 em (-2 %)
LAT_BASELINE = 200.0
LAT_CX = 500.0
HEAD_R_MAX = 19.0         # the three dots: r 19 at baseline - 62 in the spec, which assumes a wider counter than
HEAD_RISE = 52.0          # Cairo Black's (31.7 units at that height); so the dot sits at baseline - 52 and takes
HEAD_CLEAR = 3.0          # the largest r <= 19 that keeps 3 units of clearance from the letters (solved below)
AR_DOT_R = 19.0           # the dot of ج (it sits outside the letters, so it keeps the spec's r 19)
APEX_ROUND = 6.0          # apex round (open by 3, close by 3)
BAND_PAD = 2.0            # crossbar cut: band top - 2 to bottom + 2 (artboard units)

# ---------- Arabic wordmark ----------
AR_VIEW = (1000.0, 300.0)
AR_BASELINE = 210.0
AR_CX = 500.0

# ---------- Bilingual lockup ----------
BI_VIEW = (1000.0, 560.0)
BI_LAT_BASELINE = 200.0
BI_AR_BASELINE = 470.0
BI_AR_SCALE = 0.82

# ---------- Mark: the ring (108 artboard, the adaptive-icon canvas) ----------
RING_C = 54.0
RING_ANGLES = (-90.0, -18.0, 54.0, 126.0, 198.0)
RING_OUTER_MAX = 29.0     # the ring + gaps stay inside radius 29 (66-unit safe circle minus 4 units margin)
RING_OVERLAP = 1.0        # adjacent bodies overlap by 1 unit ...
RING_GAP = 1.5            # ... with a 1.5-unit gap cut where they meet
CENTRE_DOT_R = 5.0
# (shape, colour, DESIGN §5.2 24-unit glyph, face box {x, y, w, h} of DESIGN-JAMAA §4.2)
BODIES = (
    ("circle", "#F0183A", "M21 12A9 9 0 1 1 3 12A9 9 0 1 1 21 12Z", (6, 7.5, 12, 9)),
    ("square", "#478CFF", "M7 3.5H17A3.5 3.5 0 0 1 20.5 7V17A3.5 3.5 0 0 1 17 20.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5Z",
     (6, 7.5, 12, 9)),
    ("star", "#FFF04D", "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z", (8, 9, 8, 6)),
    ("triangle", "#1FA88A", "M12 2.4 21.4 19H2.6z", (7.5, 11.5, 9, 6.75)),
    ("arch", "#C9BFFF", "M5 20.75V10.25a7 7 0 0 1 14 0v10.5h-4.5v-6.5a2.5 2.5 0 0 0-5 0v6.5z", (7, 8.5, 10, 7.5)),
)
EYES = ((3.8, 3.6), (8.2, 3.6))  # face space 12 x 9
EYE_RX, EYE_RY = 1.1, 1.45
LOOK = 1.2                        # eyes look at the centre (face units)

# ---------- TV banner (320 x 180 px) ----------
BANNER_W, BANNER_H = 320.0, 180.0
BANNER_RING_PX = 104.0
BANNER_WM_W = 160.0
BANNER_GAP = 16.0
BANNER_AR_BOOST = 1.2

K = 0.5522847498  # cubic approximation of a quarter circle


def fmt(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


class Affine:
    def __init__(self, a=1.0, b=0.0, c=0.0, d=1.0, e=0.0, f=0.0):
        self.m = (a, b, c, d, e, f)

    def apply(self, x, y):
        a, b, c, d, e, f = self.m
        return a * x + c * y + e, b * x + d * y + f

    def then(self, other):
        a1, b1, c1, d1, e1, f1 = self.m
        a2, b2, c2, d2, e2, f2 = other.m
        return Affine(a2 * a1 + c2 * b1, b2 * a1 + d2 * b1, a2 * c1 + c2 * d1, b2 * c1 + d2 * d1,
                      a2 * e1 + c2 * f1 + e2, b2 * e1 + d2 * f1 + f2)

    @staticmethod
    def scale(s, sy=None):
        return Affine(s, 0, 0, s if sy is None else sy, 0, 0)

    @staticmethod
    def translate(x, y):
        return Affine(1, 0, 0, 1, x, y)

    @staticmethod
    def rotate(deg):
        r = math.radians(deg)
        return Affine(math.cos(r), math.sin(r), -math.sin(r), math.cos(r), 0, 0)


# ---------- path helpers (pathops) ----------

def tf_path(path, tf):
    out = pathops.Path()
    path.draw(TransformPen(out.getPen(), tf.m))
    return out


def op(a, b, kind):
    return pathops.op(a, b, kind)


def union(paths):
    out = pathops.Path()
    for p in paths:
        out = op(out, p, pathops.PathOp.UNION)
    return out


def combine(contours):
    """The contours of one glyph as one filled shape (non-zero winding keeps the counters open)."""
    p = pathops.Path()
    for c in contours:
        c.draw(p.getPen())
    return op(p, pathops.Path(), pathops.PathOp.UNION)


def circle_path(cx, cy, r):
    p = pathops.Path()
    pen = p.getPen()
    k = r * K
    pen.moveTo((cx + r, cy))
    pen.curveTo((cx + r, cy + k), (cx + k, cy + r), (cx, cy + r))
    pen.curveTo((cx - k, cy + r), (cx - r, cy + k), (cx - r, cy))
    pen.curveTo((cx - r, cy - k), (cx - k, cy - r), (cx, cy - r))
    pen.curveTo((cx + k, cy - r), (cx + r, cy - k), (cx + r, cy))
    pen.closePath()
    return p


def ellipse_path(cx, cy, rx, ry):
    return tf_path(circle_path(0, 0, 1), Affine.scale(rx, ry).then(Affine.translate(cx, cy)))


def rect_path(x0, y0, x1, y1):
    return poly_path([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def poly_path(pts):
    p = pathops.Path()
    pen = p.getPen()
    pen.moveTo(pts[0])
    for q in pts[1:]:
        pen.lineTo(q)
    pen.closePath()
    return p


def outline(path, width):
    """The band of `width` centred on the outline of `path` (round joins)."""
    s = pathops.Path()
    path.draw(s.getPen())
    s.stroke(width, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 4)
    s.convertConicsToQuads()
    return op(s, pathops.Path(), pathops.PathOp.UNION)


def offset(path, d):
    """Grow (d > 0) or shrink (d < 0) a filled path by |d|."""
    band = outline(path, 2 * abs(d))
    return op(path, band, pathops.PathOp.UNION if d > 0 else pathops.PathOp.DIFFERENCE)


def svg_d(path):
    pen = SVGPathPen(None, ntos=fmt)
    path.draw(pen)
    return pen.getCommands()


def bounds(path):
    return path.bounds  # (xmin, ymin, xmax, ymax)


def svg_to_path(d):
    p = pathops.Path()
    parse_path(d, p.getPen())
    return op(p, pathops.Path(), pathops.PathOp.UNION)


# ---------- shaping ----------

class Shaper:
    def __init__(self, font_path):
        self.tt = TTFont(font_path)
        self.gs = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()
        self.hb_font = hb.Font(hb.Face(hb.Blob.from_file_path(font_path)))

    def shape(self, text, tracking=0.0):
        """[(glyph name, cluster, x, y)] in font units, pen from 0; tracking added between glyphs."""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb_font, buf)
        out, x = [], 0.0
        n = len(buf.glyph_infos)
        for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
            out.append((self.order[info.codepoint], info.cluster, x + pos.x_offset, pos.y_offset))
            x += pos.x_advance + (tracking if i < n - 1 else 0.0)
        return out

    def contours(self, name):
        """The decomposed contours of a glyph, each as a pathops.Path in font units."""
        rec = DecomposingRecordingPen(self.gs)
        self.gs[name].draw(rec)
        out, cur = [], []
        for opname, args in rec.value:
            cur.append((opname, args))
            if opname in ("closePath", "endPath"):
                r = RecordingPen()
                r.value = cur
                p = pathops.Path()
                r.replay(p.getPen())
                out.append(p)
                cur = []
        return out

    def glyph(self, name):
        return combine(self.contours(name))

    def top(self, name):
        bp = BoundsPen(self.gs)
        self.gs[name].draw(bp)
        return bp.bounds[3]


def font_to_art(scale, x, baseline):
    """Font units (y up) -> artboard (y down)."""
    return Affine.scale(scale, -scale).then(Affine.translate(x, baseline))


# ---------- Latin: the three heads ----------

def open_a(a, s):
    """Removes the crossbar of one A (font units). Returns (path, report dict)."""
    xmin, ymin, xmax, ymax = bounds(a)
    cx = (xmin + xmax) / 2.0
    step = 1.0
    # The crossbar is the first filled run above the baseline on the A's vertical axis (between the legs).
    y = ymin + step
    while y < ymax and not a.contains((cx, y)):
        y += step
    band_bottom = y
    while y < ymax and a.contains((cx, y)):
        y += step
    band_top = y
    pad = BAND_PAD / s

    def edge(yy, direction):
        """x of the first ink from the axis outward (bisected to 0.01 font units)."""
        x = cx
        while xmin < x < xmax and not a.contains((x + direction * step, yy)):
            x += direction * step
        lo, hi = x, x + direction * step  # empty at lo, ink at hi
        for _ in range(7):
            mid = (lo + hi) / 2.0
            if a.contains((mid, yy)):
                hi = mid
            else:
                lo = mid
        return hi

    def inner_edges(yy):
        return edge(yy, -1), edge(yy, 1)

    yb, yt = band_bottom - pad, band_top + pad
    lb, rb = inner_edges(yb)
    lt, rt = inner_edges(yt)
    # The legs are straight: the cut follows their inner edges, from below the band to above it.
    cut = poly_path([(lb, yb), (rb, yb), (rt, yt), (lt, yt)])
    opened = op(a, cut, pathops.PathOp.DIFFERENCE)
    # Apex: round the convex corners of the top part only (open by 3, then close by 3).
    r = APEX_ROUND / 2.0 / s
    apex_zone = rect_path(xmin - 50, band_top + (ymax - band_top) * 0.5, xmax + 50, ymax + 50)
    rounded = offset(offset(opened, -r), r)
    opened = op(op(opened, apex_zone, pathops.PathOp.DIFFERENCE),
                op(rounded, apex_zone, pathops.PathOp.INTERSECTION), pathops.PathOp.UNION)
    # Check: nothing left on the axis between the legs, from the baseline to the counter's top.
    leftovers = [yy for yy in range(int(ymin) + 1, int(band_top) + 1) if opened.contains((cx, yy))]
    return opened, dict(cx=cx, band=(band_bottom, band_top), cut_bottom=(lb, rb), cut_top=(lt, rt),
                        leftover=len(leftovers))


def build_latin(sh):
    s = LAT_SIZE / 1000.0
    glyphs = sh.shape("JAMAA", LAT_TRACKING)
    paths, report, a_axes = [], [], []
    for name, _, gx, gy in glyphs:
        g = sh.glyph(name)
        if name == "A":
            g, rep = open_a(g, s)
            report.append(rep)
            a_axes.append(gx + rep["cx"])
            rep["gx"] = gx
        paths.append(tf_path(g, Affine.translate(gx, gy)))
    word = union(paths)
    xmin, _, xmax, _ = bounds(word)
    dx = LAT_CX - (xmin + xmax) / 2.0 * s
    tf = font_to_art(s, dx, LAT_BASELINE)
    letters = tf_path(word, tf)
    heads = [(tf.apply(x, 0)[0], LAT_BASELINE - HEAD_RISE) for x in a_axes]
    head_r = HEAD_R_MAX
    for hx, hy in heads:
        lo, hi = 0.0, HEAD_R_MAX + HEAD_CLEAR
        for _ in range(30):
            mid = (lo + hi) / 2.0
            if op(letters, circle_path(hx, hy, mid), pathops.PathOp.INTERSECTION).area > 0.0:
                hi = mid
            else:
                lo = mid
        head_r = min(head_r, lo - HEAD_CLEAR)
    head_r = round(head_r, 1)
    print("Heads: r = %s at baseline - %s (clearance %s)" % (fmt(head_r), fmt(HEAD_RISE), fmt(HEAD_CLEAR)))
    for i, rep in enumerate(report):
        (lb, rb), (lt, rt) = rep["cut_bottom"], rep["cut_top"]
        x0 = tf.apply(rep["gx"] + min(lb, lt), 0)[0]
        x1 = tf.apply(rep["gx"] + max(rb, rt), 0)[0]
        yb = LAT_BASELINE - rep["band"][0] * s
        yt = LAT_BASELINE - rep["band"][1] * s
        print("A%d: x=%s w=%s cx=%s (crossbar band y %s..%s, %d%%..%d%% of cap height; leftover samples %d)" % (
            i + 1, fmt(x0), fmt(x1 - x0), fmt(heads[i][0]), fmt(yt), fmt(yb),
            round(rep["band"][0] / sh.top("H") * 100), round(rep["band"][1] / sh.top("H") * 100), rep["leftover"]))
        if rep["leftover"]:
            raise SystemExit("crossbar fragment left in A%d" % (i + 1))
    # Each head must sit in the open counter (no letter ink under the dot).
    for hx, hy in heads:
        if op(letters, circle_path(hx, hy, head_r), pathops.PathOp.INTERSECTION).area > 1.0:
            raise SystemExit("a head dot overlaps the letters at (%s, %s)" % (fmt(hx), fmt(hy)))
    return dict(path=letters, heads=heads, r=head_r, cap=sh.top("H") * s)


# ---------- Arabic: the dot of ج ----------

def build_arabic(sh, cap_art):
    s = cap_art / sh.top("uniFE8E")  # alef height = Latin cap height
    glyphs = sh.shape("جماعة")
    paths, dot = [], None
    for name, cluster, gx, gy in glyphs:
        cs = sh.contours(name)
        if cluster == 0:  # ج: drop its smallest closed contour below the baseline, keep the rest
            below = [c for c in cs if bounds(c)[3] <= 0]
            if not below:
                raise SystemExit("no dot found under the jeem")
            d = min(below, key=lambda c: abs(c.area))
            x0, y0, x1, y1 = bounds(d)
            dot = (gx + (x0 + x1) / 2.0, gy + (y0 + y1) / 2.0)
            cs = [c for c in cs if c is not d]
        paths.append(tf_path(combine(cs), Affine.translate(gx, gy)))
    word = union(paths)
    xmin, _, xmax, _ = bounds(word)
    # The dot may stick out past the letters; centre the ink including it.
    xmin, xmax = min(xmin, dot[0] - AR_DOT_R / s), max(xmax, dot[0] + AR_DOT_R / s)
    tf = font_to_art(s, AR_CX - (xmin + xmax) / 2.0 * s, AR_BASELINE)
    letters = tf_path(word, tf)
    head = tf.apply(*dot)
    print("Arabic: font size %s (alef = cap height %s), jeem dot at (%s, %s)" % (
        fmt(s * 1000), fmt(cap_art), fmt(head[0]), fmt(head[1])))
    return dict(path=letters, head=head, r=AR_DOT_R)


# ---------- the ring ----------

def body_path(svg, size):
    """A DESIGN §5.2 glyph scaled from its 24-unit box to `size`, centred on the origin."""
    return tf_path(svg_to_path(svg), Affine.translate(-12, -12).then(Affine.scale(size / 24.0)))


def ring_tf(i, radius, deg):
    a = math.radians(deg)
    # rotate so the glyph's "up" (-y) points outward, then move onto the ring
    return Affine.rotate(deg + 90.0).then(Affine.translate(RING_C + radius * math.cos(a), RING_C + radius * math.sin(a)))


def place_ring(size, radii):
    return [tf_path(body_path(svg, size), ring_tf(i, radii[i], RING_ANGLES[i])) for i, (_, _, svg, _) in enumerate(BODIES)]


def ring_layout():
    """DESIGN-JAMAA §1.4 asks for five bodies that touch (1-unit overlap) around a r 5 dot, inside radius 29. Its
    literal numbers (17-unit bodies on a radius-19 circle) leave about 9 units between neighbours, so the layout is
    solved instead: each body slides along its ray (-90, -18, 54, 126, 198 degrees) toward the centre until it meets
    a neighbour (overlap 1) or the dot's gap, and the body size is the largest that keeps the ring inside 29."""
    inset = RING_OVERLAP / 2.0
    hole = circle_path(RING_C, RING_C, CENTRE_DOT_R + RING_GAP + 0.1)

    def jam(size):
        bodies = [body_path(svg, size) for _, _, svg, _ in BODIES]
        shrunk = [offset(b, -inset) for b in bodies]
        radii = [size * 2.0] * 5

        def at(i, r, path):
            return tf_path(path, ring_tf(i, r, RING_ANGLES[i]))

        for _ in range(12):
            for i in range(5):
                nbrs = [at(j, radii[j], shrunk[j]) for j in ((i - 1) % 5, (i + 1) % 5)]

                def free(r):
                    if op(at(i, r, bodies[i]), hole, pathops.PathOp.INTERSECTION).area > 0.0:
                        return False
                    me = at(i, r, shrunk[i])
                    return all(op(me, n, pathops.PathOp.INTERSECTION).area <= 0.0 for n in nbrs)

                lo, hi = 0.0, radii[i]  # free at hi (current), maybe not at lo
                if free(lo):
                    radii[i] = lo
                    continue
                for _ in range(22):
                    mid = (lo + hi) / 2.0
                    if free(mid):
                        hi = mid
                    else:
                        lo = mid
                radii[i] = hi
        return radii

    def outer(size, radii):
        # the group is re-centred on the tile afterwards, so its half-extent is what must fit
        x0, y0, x1, y1 = bounds(union(place_ring(size, radii)))
        return max(x1 - x0, y1 - y0) / 2.0

    size = 24.0
    for _ in range(4):
        radii = jam(size)
        size *= RING_OUTER_MAX / outer(size, radii)
    radii = jam(size)
    while outer(size, radii) > RING_OUTER_MAX:
        size *= 0.995
        radii = jam(size)
    x0, y0, x1, y1 = bounds(union(place_ring(size, radii)))
    shift = Affine.translate(RING_C - (x0 + x1) / 2.0, RING_C - (y0 + y1) / 2.0)
    print("Ring: bodies %s units (24-unit glyph box), radii %s, half-extent %s (max %s), group shift (%s, %s)" % (
        fmt(size), " ".join(fmt(r) for r in radii), fmt(outer(size, radii)), fmt(RING_OUTER_MAX),
        fmt(shift.m[4]), fmt(shift.m[5])))
    return size, radii, shift


def ring_layers(size, radii, shift, faces):
    """[(path, colour)] in the 108 artboard: bodies with gaps where they meet, optional eyes, centre dot."""
    placed = place_ring(size, radii)
    out = []
    for i, p in enumerate(placed):
        # painted in order 0..4, each over the previous: cut every earlier body by the later neighbour + gap
        later = [placed[j] for j in ((i + 1) % 5, (i - 1) % 5) if j > i]
        for q in later:
            p = op(p, offset(q, RING_GAP), pathops.PathOp.DIFFERENCE)
        out.append([p, BODIES[i][1]])
    centre = circle_path(RING_C, RING_C, CENTRE_DOT_R)
    for layer in out:
        if op(layer[0], offset(centre, RING_GAP), pathops.PathOp.INTERSECTION).area > 0.01:
            raise SystemExit("the centre dot touches a body")
    if faces:
        for i, (_, _, _, (fx, fy, fw, _)) in enumerate(BODIES):
            u = fw / 12.0
            to_ring = Affine.translate(-12, -12).then(Affine.scale(size / 24.0)).then(ring_tf(i, radii[i], RING_ANGLES[i]))
            body = place_ring(size, radii)[i]
            # The eyes look at the centre (the body's "down"); where that would clip them on a cut-out (the arch's
            # door), they move up in steps of 0.2 face units until they sit wholly on the body.
            look = LOOK
            while True:
                eyes = tf_path(union([ellipse_path(fx + ex * u, fy + (ey + look) * u, EYE_RX * u, EYE_RY * u)
                                      for ex, ey in EYES]), to_ring)
                if op(eyes, body, pathops.PathOp.DIFFERENCE).area <= 0.001 or look < -3.0:
                    break
                look -= 0.2
            out.append([op(eyes, out[i][0], pathops.PathOp.INTERSECTION), INK])
    out.append([centre, AMBER])
    return [(tf_path(p, shift), c) for p, c in out]


# ---------- SVG ----------

def svg_doc(view, body, w=None, h=None):
    size = "" if w is None else ' width="%s" height="%s"' % (fmt(w), fmt(h))
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s"%s>\n%s</svg>\n' % (
        " ".join(fmt(v) for v in view), size, body)


GLOW_DEFS = ('  <defs><filter id="glow" x="-100%" y="-100%" width="300%" height="300%">'
             '<feGaussianBlur stdDeviation="9"/></filter></defs>\n')  # blur 18 units (DESIGN-JAMAA §1.3)


def dots_svg(centres, r, glow):
    out = ""
    for cx, cy in centres:
        c = circle_path(cx, cy, r)
        if glow:
            out += '  <path d="%s" fill="%s" opacity="0.35" filter="url(#glow)"/>\n' % (svg_d(c), AMBER)
        out += '  <path d="%s" fill="%s"/>\n' % (svg_d(c), AMBER)
    return out


def wordmark_svgs(lat, ar):
    out = {}
    out["wordmark-latin.svg"] = svg_doc((0, 0) + LAT_VIEW, "<!-- JAMAA Latin wordmark (the three heads). Generated by scripts/gen_brand.py -->\n"
                                        + GLOW_DEFS + '  <path d="%s" fill="%s"/>\n' % (svg_d(lat["path"]), CREAM)
                                        + dots_svg(lat["heads"], lat["r"], True))
    out["wordmark-ar.svg"] = svg_doc((0, 0) + AR_VIEW, "<!-- JAMAA Arabic wordmark. Generated by scripts/gen_brand.py -->\n"
                                     + GLOW_DEFS + '  <path d="%s" fill="%s"/>\n' % (svg_d(ar["path"]), CREAM)
                                     + dots_svg([ar["head"]], ar["r"], True))
    bi_tf = bilingual_ar_tf()
    ar_bi = tf_path(ar["path"], bi_tf)
    head = bi_tf.apply(*ar["head"])
    lat_tf = Affine.translate(0, BI_LAT_BASELINE - LAT_BASELINE)
    out["wordmark-bilingual.svg"] = svg_doc((0, 0) + BI_VIEW, "<!-- JAMAA bilingual lockup (Latin on top). Generated by scripts/gen_brand.py -->\n"
                                            + GLOW_DEFS
                                            + '  <path d="%s" fill="%s"/>\n' % (svg_d(tf_path(lat["path"], lat_tf)), CREAM)
                                            + dots_svg([lat_tf.apply(*h) for h in lat["heads"]], lat["r"], True)
                                            + '  <path d="%s" fill="%s"/>\n' % (svg_d(ar_bi), CREAM)
                                            + dots_svg([head], ar["r"] * BI_AR_SCALE, True))
    return out


def bilingual_ar_tf():
    """Standalone Arabic artboard -> bilingual lockup: scaled 0.82 about (500, baseline), baseline moved to 470."""
    return (Affine.translate(-AR_CX, -AR_BASELINE).then(Affine.scale(BI_AR_SCALE))
            .then(Affine.translate(AR_CX, BI_AR_BASELINE)))


def tile_gradient_svg(gid, w, h):
    return ('<radialGradient id="%s" cx="%s" cy="%s" r="%s">%s</radialGradient>' % (
        gid, fmt(TILE_CENTRE[0]), fmt(TILE_CENTRE[1]), fmt(TILE_RADIUS),
        "".join('<stop offset="%s" stop-color="%s"/>' % (fmt(o), c) for o, c in TILE_STOPS)))


def mark_svg(layers, faces):
    what = "mark (the ring, with faces)" if faces else "launcher / Play icon (the ring, no faces)"
    body = "<!-- JAMAA %s on its tile; 108 artboard, export at 512 px. Generated by scripts/gen_brand.py -->\n" % what
    body += "  <defs>%s</defs>\n  <rect width=\"108\" height=\"108\" fill=\"url(#tile)\"/>\n" % tile_gradient_svg("tile", 108, 108)
    for p, c in layers:
        body += '  <path d="%s" fill="%s"/>\n' % (svg_d(p), c)
    return svg_doc((0, 0, 108, 108), body, 512, 512)


# ---------- banner ----------

def banner_layout(lat, ar, ring, arabic):
    """[(path, colour)] in the 320 x 180 banner and the ring centre (for the lamp glow)."""
    ring_box = (RING_C - RING_OUTER_MAX, RING_C - RING_OUTER_MAX, RING_C + RING_OUTER_MAX, RING_C + RING_OUTER_MAX)
    rs = BANNER_RING_PX / (ring_box[2] - ring_box[0])
    if arabic:
        wpath, heads, r = ar["path"], [ar["head"]], ar["r"]
    else:
        wpath, heads, r = lat["path"], lat["heads"], lat["r"]
    lx0, _, lx1, _ = bounds(lat["path"])
    ws = BANNER_WM_W / (lx1 - lx0)
    if arabic:
        ws *= BANNER_AR_BOOST
    x0, y0, x1, y1 = bounds(union([wpath] + [circle_path(hx, hy, r) for hx, hy in heads]))
    wm_w = (x1 - x0) * ws
    total = BANNER_RING_PX + BANNER_GAP + wm_w
    left = (BANNER_W - total) / 2.0
    if arabic:
        wm_x, ring_x = left, left + wm_w + BANNER_GAP
    else:
        ring_x, wm_x = left, left + BANNER_RING_PX + BANNER_GAP
    ring_y = (BANNER_H - BANNER_RING_PX) / 2.0
    rtf = Affine.translate(-ring_box[0], -ring_box[1]).then(Affine.scale(rs)).then(Affine.translate(ring_x, ring_y))
    wtf = Affine.translate(-x0, -(y0 + y1) / 2.0).then(Affine.scale(ws)).then(Affine.translate(wm_x, BANNER_H / 2.0))
    layers = [(tf_path(p, rtf), c) for p, c in ring]
    layers.append((tf_path(wpath, wtf), CREAM))
    for hx, hy in heads:
        layers.append((tf_path(circle_path(hx, hy, r), wtf), AMBER))
    centre = rtf.apply(RING_C, RING_C)
    return layers, centre


def banner_svg(layers, centre):
    gx, gy = centre
    body = ('<!-- JAMAA TV banner, 320 x 180 px (contains the app name; palette B). Generated by scripts/gen_brand.py -->\n'
            '  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient>\n'
            '  <radialGradient id="lamp" gradientUnits="userSpaceOnUse" cx="%s" cy="%s" r="%s">'
            '<stop offset="0" stop-color="%s" stop-opacity="0.18"/><stop offset="1" stop-color="%s" stop-opacity="0"/></radialGradient></defs>\n'
            '  <rect width="320" height="180" fill="url(#bg)"/>\n  <rect width="320" height="180" fill="url(#lamp)"/>\n') % (
        STAGE_TOP, STAGE_DEEP, fmt(gx), fmt(gy), fmt(lamp_radius()), AMBER, AMBER)
    for p, c in layers:
        body += '  <path d="%s" fill="%s"/>\n' % (svg_d(p), c)
    return svg_doc((0, 0, BANNER_W, BANNER_H), body, BANNER_W, BANNER_H)


def lamp_radius():
    # radial 45 % x 60 % at the mark: one circle with the mean of the two radii (Android gradients are circular)
    return (0.45 * BANNER_W + 0.60 * BANNER_H) / 2.0


# ---------- Android vector drawables ----------

def android_color(hexstr, alpha=1.0):
    return "#%02X%s" % (int(round(alpha * 255)), hexstr[1:])


def vector_xml(comment, w_dp, h_dp, vw, vh, layers, background=""):
    s = ['<?xml version="1.0" encoding="utf-8"?>',
         "<!-- %s Generated by assets/brand/scripts/gen_brand.py; do not edit by hand. -->" % comment,
         '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
         '    xmlns:aapt="http://schemas.android.com/aapt"',
         '    android:width="%sdp"' % fmt(w_dp),
         '    android:height="%sdp"' % fmt(h_dp),
         '    android:viewportWidth="%s"' % fmt(vw),
         '    android:viewportHeight="%s">' % fmt(vh)]
    if background:
        s.append(background)
    for p, c in layers:
        s.append('    <path android:fillColor="%s" android:pathData="%s"/>' % (android_color(c), svg_d(p)))
    s.append("</vector>")
    return "\n".join(s) + "\n"


def gradient_rect(rect, attrs, items=None):
    inner = ('            <gradient %s/>' % attrs) if items is None else (
        '            <gradient %s>\n%s\n            </gradient>' % (attrs, "\n".join(
            '                <item android:offset="%s" android:color="%s"/>' % (fmt(o), android_color(c)) for o, c in items)))
    return ('    <path android:pathData="%s">\n        <aapt:attr name="android:fillColor">\n%s\n'
            '        </aapt:attr>\n    </path>') % (rect, inner)


def tile_background(size, corner=0.0):
    if corner:
        rect = svg_d(rounded_rect(0, 0, size, size, corner))
    else:
        rect = "M0,0h%sv%sh-%sz" % (fmt(size), fmt(size), fmt(size))
    return gradient_rect(rect, 'android:type="radial" android:centerX="%s" android:centerY="%s" android:gradientRadius="%s"' % (
        fmt(TILE_CENTRE[0] * size), fmt(TILE_CENTRE[1] * size), fmt(TILE_RADIUS * size)), TILE_STOPS)


def rounded_rect(x, y, w, h, r):
    p = pathops.Path()
    pen = p.getPen()
    k = r * K
    pen.moveTo((x + r, y))
    pen.lineTo((x + w - r, y))
    pen.curveTo((x + w - r + k, y), (x + w, y + r - k), (x + w, y + r))
    pen.lineTo((x + w, y + h - r))
    pen.curveTo((x + w, y + h - r + k), (x + w - r + k, y + h), (x + w - r, y + h))
    pen.lineTo((x + r, y + h))
    pen.curveTo((x + r - k, y + h), (x, y + h - r + k), (x, y + h - r))
    pen.lineTo((x, y + r))
    pen.curveTo((x, y + r - k), (x + r - k, y), (x + r, y))
    pen.closePath()
    return p


def banner_background(centre):
    rect = "M0,0h320v180h-320z"
    return "\n".join([
        gradient_rect(rect, 'android:type="linear" android:startX="0" android:startY="0" android:endX="320" android:endY="180" '
                            'android:startColor="%s" android:endColor="%s"' % (android_color(STAGE_TOP), android_color(STAGE_DEEP))),
        gradient_rect(rect, 'android:type="radial" android:centerX="%s" android:centerY="%s" android:gradientRadius="%s" '
                            'android:startColor="%s" android:endColor="%s"' % (
                                fmt(centre[0]), fmt(centre[1]), fmt(lamp_radius()), android_color(AMBER, 0.18), android_color(AMBER, 0))),
    ])


# ---------- Kotlin ----------

def kotlin_paths(lat, ar):
    def chunk(s, n=180):
        parts = [s[i:i + n] for i in range(0, len(s), n)]
        return " +\n        ".join('"%s"' % p for p in parts)

    lb, ab = bounds(lat["path"]), bounds(ar["path"])
    heads = ", ".join("%sf, %sf" % (fmt(x), fmt(y)) for x, y in lat["heads"])
    return """// GENERATED by assets/brand/scripts/gen_brand.py from Cairo Black outlines (OFL). Do not edit by hand.
package app.jamaa.tv.ui.components

/**
 * The JAMAA wordmark, "the three heads" (DESIGN-JAMAA §1.3): letter outlines (the A crossbars removed) plus amber
 * dots. Latin artboard %s x %s, Arabic artboard %s x %s (y down); the bilingual lockup stacks them (Latin on top).
 */
internal object BrandPaths {
    const val LATIN_W = %sf
    const val LATIN_H = %sf
    const val ARABIC_W = %sf
    const val ARABIC_H = %sf

    /** Dot radii: the three Latin heads, and the dot of ج (standalone artboards). */
    const val LATIN_DOT_R = %sf
    const val ARABIC_DOT_R = %sf

    /** Bilingual lockup: the Arabic block is scaled by AR_SCALE about (%s, its baseline) and its baseline moves down by AR_SHIFT_Y. */
    const val AR_SCALE = %sf
    const val AR_BASELINE = %sf
    const val AR_CX = %sf
    const val AR_SHIFT_Y = %sf

    /** Ink bounds of the letters (left, top, right, bottom). */
    val LATIN_BOUNDS = floatArrayOf(%sf, %sf, %sf, %sf)
    val ARABIC_BOUNDS = floatArrayOf(%sf, %sf, %sf, %sf)

    /** Centres of the three heads (x, y pairs) in the Latin artboard. */
    val LATIN_DOTS = floatArrayOf(%s)

    /** Centre of the dot of ج in the Arabic artboard. */
    val ARABIC_DOT = floatArrayOf(%sf, %sf)

    /** "JAMAA", centred on x = %s, baseline y = %s. */
    const val LATIN =
        %s

    /** «جماعة» without the dot of ج, centred on x = %s, baseline y = %s. */
    const val ARABIC =
        %s
}
""" % (fmt(LAT_VIEW[0]), fmt(LAT_VIEW[1]), fmt(AR_VIEW[0]), fmt(AR_VIEW[1]),
       fmt(LAT_VIEW[0]), fmt(LAT_VIEW[1]), fmt(AR_VIEW[0]), fmt(AR_VIEW[1]),
       fmt(lat["r"]), fmt(ar["r"]), fmt(AR_CX), fmt(BI_AR_SCALE), fmt(AR_BASELINE), fmt(AR_CX),
       fmt(BI_AR_BASELINE - AR_BASELINE),
       fmt(lb[0]), fmt(lb[1]), fmt(lb[2]), fmt(lb[3]), fmt(ab[0]), fmt(ab[1]), fmt(ab[2]), fmt(ab[3]),
       heads, fmt(ar["head"][0]), fmt(ar["head"][1]),
       fmt(LAT_CX), fmt(LAT_BASELINE), chunk(svg_d(lat["path"])),
       fmt(AR_CX), fmt(AR_BASELINE), chunk(svg_d(ar["path"])))


# ---------- main ----------

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote", os.path.relpath(path, ROOT))


def find_chrome():
    import glob
    for pattern in (os.environ.get("CHROME", ""), "/opt/pw-browsers/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell",
                    "/opt/pw-browsers/chromium-*/chrome-linux64/chrome"):
        hits = sorted(glob.glob(pattern)) if pattern else []
        if hits:
            return hits[-1]
    return None


def preview(chrome, svg_path, png_path, width, height):
    """Renders one SVG at width x height px on the hub stage colour with a headless Chromium."""
    import tempfile
    with open(svg_path, encoding="utf-8") as f:
        svg = f.read()
    html = ('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:%s}svg{display:block;width:%dpx;'
            'height:%dpx}</style>%s' % (STAGE_DEEP, width, height, svg))
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as t:
        t.write(html)
    try:
        subprocess.run([chrome, "--headless", "--no-sandbox", "--hide-scrollbars", "--window-size=%d,%d" % (width, height),
                        "--screenshot=%s" % png_path, "file://" + t.name], check=True, capture_output=True, timeout=60)
        print("preview", png_path)
    except (OSError, subprocess.SubprocessError) as e:
        print("preview failed for %s: %s" % (svg_path, e))
    finally:
        os.unlink(t.name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--font-dir", default=os.path.join(ROOT, "tv-app/app/src/main/res/font"))
    ap.add_argument("--preview", help="directory for PNG previews (needs ImageMagick)")
    args = ap.parse_args()
    font = os.path.join(args.font_dir, "cairo_black.ttf")
    if not os.path.exists(font):
        font = os.path.join(args.font_dir, "Cairo_900Black.ttf")
    sh = Shaper(font)
    lat = build_latin(sh)
    ar = build_arabic(sh, lat["cap"])
    size, radii, shift = ring_layout()
    ring_faces = ring_layers(size, radii, shift, True)
    ring_plain = ring_layers(size, radii, shift, False)

    brand = os.path.join(ROOT, "assets/brand")
    for name, text in wordmark_svgs(lat, ar).items():
        write(os.path.join(brand, name), text)
    write(os.path.join(brand, "mark.svg"), mark_svg(ring_faces, True))
    write(os.path.join(brand, "icon.svg"), mark_svg(ring_plain, False))
    banners = {}
    for arabic, name in ((False, "banner-en.svg"), (True, "banner-ar.svg")):
        layers, centre = banner_layout(lat, ar, ring_faces, arabic)
        banners[arabic] = (layers, centre)
        write(os.path.join(brand, name), banner_svg(layers, centre))

    res = os.path.join(ROOT, "tv-app/app/src/main/res")
    # banner: 320 x 180 px at xhdpi = 160 x 90 dp
    for arabic, sub, label in ((False, "drawable", "EN/FR"), (True, "drawable-ar", "AR, ring on the right")):
        layers, centre = banners[arabic]
        write(os.path.join(res, sub, "banner.xml"),
              vector_xml("JAMAA TV banner (%s), 320 x 180 px at xhdpi, contains the app name; palette B." % label,
                         160, 90, 320, 180, layers, banner_background(centre)))
    # in-app mark: the ring on its rounded tile (corner 24 of 108 = 22 %), no faces (shown at 48 dp)
    write(os.path.join(res, "drawable/ic_mark.xml"),
          vector_xml("The JAMAA mark (the ring) on its tile.", 108, 108, 108, 108, ring_plain, tile_background(108, 24)))
    write(os.path.join(res, "drawable/ic_launcher_foreground.xml"),
          vector_xml("Adaptive icon foreground: the ring inside the 66 dp safe circle, no faces.", 108, 108, 108, 108, ring_plain))
    mono = union([p for p, _ in ring_plain])
    write(os.path.join(res, "drawable/ic_launcher_monochrome.xml"),
          vector_xml("Themed (monochrome) icon: the five bodies and the dot as one flat layer, gaps kept.", 108, 108, 108, 108,
                     [(mono, "#000000")]))
    write(os.path.join(res, "drawable/ic_launcher_background.xml"),
          vector_xml("Adaptive icon background: the violet tile.", 108, 108, 108, 108, [], tile_background(108)))
    write(os.path.join(ROOT, "tv-app/app/src/main/java/app/jamaa/tv/ui/components/BrandPaths.kt"), kotlin_paths(lat, ar))

    if args.preview:
        chrome = find_chrome()
        if chrome is None:
            print("no Chromium found for previews (set CHROME)")
            return
        os.makedirs(args.preview, exist_ok=True)
        for name, w, h in (("wordmark-latin.svg", 1000, 260), ("wordmark-latin.svg", 240, 62), ("wordmark-latin.svg", 120, 31),
                           ("wordmark-ar.svg", 1000, 300), ("wordmark-bilingual.svg", 500, 280), ("icon.svg", 512, 512),
                           ("icon.svg", 48, 48), ("mark.svg", 512, 512), ("banner-en.svg", 640, 360), ("banner-ar.svg", 640, 360)):
            preview(chrome, os.path.join(brand, name), os.path.join(args.preview, "%s-%d.png" % (name[:-4], w)), w, h)


if __name__ == "__main__":
    main()
