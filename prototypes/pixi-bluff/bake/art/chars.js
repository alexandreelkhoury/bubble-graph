// chars.js — the 12 shilleh drawn with a hand (ART-DIRECTION §8), on the canonical geometry of
// shared/src/characters (bodies, face boxes, 13 expressions copied verbatim; read-only copy for the board).
import { rng, hashStr, subpaths, sampleClosed, smooth, wobble, inkRing, brushAll, brush, smoothPath, poly, handEllipse, normals, centroid, bbox, el, uid } from "./hand.js";

export const COLORS = [
  { id: "coral", hex: "#F0183A", shape: "circle", glyph: "ink" },
  { id: "azure", hex: "#478CFF", shape: "square", glyph: "ink" },
  { id: "lemon", hex: "#FFF04D", shape: "star", glyph: "ink" },
  { id: "jade", hex: "#1FA88A", shape: "triangle", glyph: "ink" },
  { id: "grape", hex: "#7A43FF", shape: "diamond", glyph: "cream" },
  { id: "tangerine", hex: "#FF7A1F", shape: "hexagon", glyph: "ink" },
  { id: "aqua", hex: "#7BFFF4", shape: "plus", glyph: "ink" },
  { id: "rose", hex: "#FF96C5", shape: "drop", glyph: "ink" },
  { id: "mint", hex: "#BDF5C8", shape: "crescent", glyph: "ink" },
  { id: "plum", hex: "#C02A8F", shape: "bolt", glyph: "cream" },
  { id: "sand", hex: "#E6C486", shape: "flower", glyph: "ink" },
  { id: "lilac", hex: "#C9BFFF", shape: "arch", glyph: "ink" },
];
export const BY_ID = Object.fromEntries(COLORS.map((c) => [c.id, c]));

const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
export const BODY_PATHS = {
  circle: circle(12, 12, 9),
  square: "M7 3.5H17A3.5 3.5 0 0 1 20.5 7V17A3.5 3.5 0 0 1 17 20.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5Z",
  star: "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z",
  triangle: "M12 2.4 21.4 19H2.6z",
  diamond: "M12 2.2 21.8 12 12 21.8 2.2 12z",
  hexagon: "M12 2.6 20.2 7.3v9.4L12 21.4 3.8 16.7V7.3z",
  plus: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z",
  drop: "M12 1.25S5 9.15 5 13.75a7 7 0 0 0 14 0c0-4.6-7-12.5-7-12.5z",
  crescent: "M15 2.7a9.5 9.5 0 1 0 6.3 13.6A7.6 7.6 0 0 1 15 2.7z",
  bolt: "M13.5 2 5 13.5h6L10 22l9-12h-6.2z",
  flower: null,
  arch: "M5 20.75V10.25a7 7 0 0 1 14 0v10.5h-4.5v-6.5a2.5 2.5 0 0 0-5 0v6.5z",
};
const box = (x, y, w, h) => ({ x, y, w, h });
export const FACE_BOXES = {
  circle: box(6, 7.5, 12, 9), square: box(6, 7.5, 12, 9), star: box(8, 9, 8, 6), triangle: box(7.5, 11.5, 9, 6.75),
  diamond: box(7, 8, 10, 7.5), hexagon: box(6.5, 7.5, 11, 8.25), plus: box(8.5, 8.5, 7, 7), drop: box(7, 11, 10, 7.5),
  crescent: box(4, 9, 8, 6), bolt: box(8.5, 9.5, 6, 4.5), flower: box(7.5, 7.5, 9, 9), arch: box(7, 8.5, 10, 7.5),
};
export const FACE_SPACE = { w: 12, h: 9 };

const ellipse = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const eyesAt = (dx = 0, dy = 0) => ({ part: "eyes", d: ellipse(3.8 + dx, 3.6 + dy, 1.1, 1.45) + ellipse(8.2 + dx, 3.6 + dy, 1.1, 1.45), style: "fill" });
const stroke = (part, d, w = part === "brows" ? 0.7 : 0.8) => ({ part, d, style: "stroke", w });
const fill = (part, d) => ({ part, d, style: "fill" });
const CLOSED = stroke("eyes", "M2.8 3.6H4.8M7.2 3.6H9.2");
const WIDE = fill("mouth", "M3.8 5.8H8.2A2.2 2.4 0 0 1 3.8 5.8Z");
const cheeks = (alpha) => ({ part: "cheeks", d: ellipse(2.2, 5.8, 0.9, 0.9) + ellipse(9.8, 5.8, 0.9, 0.9), style: "fill", alpha });
const star4 = (cx, cy) => `M${cx} ${cy - 1.6}L${cx + 0.45} ${cy - 0.45}L${cx + 1.6} ${cy}L${cx + 0.45} ${cy + 0.45}L${cx} ${cy + 1.6}L${cx - 0.45} ${cy + 0.45}L${cx - 1.6} ${cy}L${cx - 0.45} ${cy - 0.45}Z`;
export const EXPRESSIONS = ["idle", "think", "done", "happy", "laugh", "smug", "shock", "sad", "facepalm", "shy", "point", "cheer", "away"];
export const FEATURES = {
  idle: [eyesAt(), stroke("mouth", "M4.4 6.6Q6 7.6 7.6 6.6")],
  think: [eyesAt(0.9, -0.8), stroke("brows", "M7.4 0.9L9.6 0.5"), stroke("mouth", "M5.4 6.8H7.8")],
  done: [stroke("eyes", "M2.7 3.8Q3.8 2.8 4.9 3.8M7.1 3.8Q8.2 2.8 9.3 3.8"), stroke("mouth", "M4.8 6.6Q6 7.4 7.2 6.6")],
  happy: [stroke("eyes", "M2.7 4.2Q3.8 2.6 4.9 4.2M7.1 4.2Q8.2 2.6 9.3 4.2"), fill("mouth", "M4.2 6H7.8A1.8 1.8 0 0 1 4.2 6Z"), cheeks(0.35)],
  laugh: [stroke("eyes", "M3 2.9L4.4 3.6L3 4.3M9 2.9L7.6 3.6L9 4.3"), WIDE, cheeks(0.35)],
  smug: [fill("eyes", "M2.7 3.2H4.9A1.1 1.1 0 0 1 2.7 3.2ZM7.1 3.2H9.3A1.1 1.1 0 0 1 7.1 3.2Z"), stroke("brows", "M2.7 1.6H4.9M7.1 1.2L9.3 0.6"), stroke("mouth", "M4.6 6.8Q6.8 7.4 7.8 6")],
  shock: [stroke("eyes", ellipse(3.8, 3.6, 1.4, 1.4) + ellipse(8.2, 3.6, 1.4, 1.4)), fill("eyes", ellipse(3.8, 3.6, 0.5, 0.5) + ellipse(8.2, 3.6, 0.5, 0.5)), stroke("brows", "M2.8 0.6H4.8M7.2 0.6H9.2"), fill("mouth", ellipse(6, 6.9, 0.7, 0.9))],
  sad: [fill("eyes", "M2.7 3.4L4.9 3A1.1 1.2 0 0 1 2.7 3.4ZM7.1 3L9.3 3.4A1.1 1.2 0 0 1 7.1 3Z"), stroke("brows", "M2.8 1.9L4.6 1.2M9.2 1.9L7.4 1.2"), stroke("mouth", "M4.4 7.4Q6 6.4 7.6 7.4")],
  facepalm: [CLOSED, stroke("mouth", "M4.8 6.8H7.2")],
  shy: [eyesAt(0, 0.8), stroke("mouth", "M5.2 6.9Q6 7.4 6.8 6.9"), cheeks(0.6)],
  point: [eyesAt(1, 0), fill("mouth", "M4.6 6.4H7.4A1.4 1 0 0 1 4.6 6.4Z")],
  cheer: [fill("eyes", star4(3.8, 3.6) + star4(8.2, 3.6)), WIDE, cheeks(0.35)],
  away: [CLOSED, stroke("mouth", "M5.2 6.8H6.8")],
};
const EYE_HIGHLIGHT = ["idle", "think", "shy", "point"];
const EYE_OFFSET = { think: [0.9, -0.8], shy: [0, 0.8], point: [1, 0] };
const EXTRAS = { facepalm: "hand", point: "nub", done: "check", away: "zzz" };

export const INKS = { hub: "#160B26", "night-market": "#140818", "hakawati-cafe": "#1A0F07", rooftop: "#06141C", "quiz-studio": "#070B22" };
export const PAPERS = { hub: "#FFF1DC", "night-market": "#FFE9C7", "hakawati-cafe": "#FFEBC2", rooftop: "#E9FFF9", "quiz-studio": "#FFF6D6" };
const CREAM = "#FFF7EC";
const NO_HIGHLIGHT = new Set(["lemon", "aqua", "mint"]);
const RINGED = new Set(["coral", "grape", "plum"]);

/** Flower outline: union boundary of the five discs, as a polar function from (12,12). */
function flowerPts(n = 180) {
  const discs = [[12, 7.4, 4.6], [16.6, 12, 4.6], [12, 16.6, 4.6], [7.4, 12, 4.6], [12, 12, 4]];
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a); let best = 0;
    for (const [cx, cy, r] of discs) { const ox = 12 - cx, oy = 12 - cy; const b = ox * dx + oy * dy; const c = ox * ox + oy * oy - r * r; const disc = b * b - c; if (disc >= 0) best = Math.max(best, -b + Math.sqrt(disc)); }
    pts.push([12 + dx * best, 12 + dy * best]);
  }
  return pts;
}

// Corner rounding per shape (window k at 0.3-unit sampling): varies so no two shapes have the same corners.
const ROUND = { circle: 1, square: 1, star: 2, triangle: 3, diamond: 2, hexagon: 2, plus: 2, drop: 2, crescent: 1, bolt: 2, flower: 1, arch: 2 };
const _cache = new Map();
/** The hand-drawn body polygon for a shape, boil variant 0/1/2 (A/B/C). Seeded per shape: stored, not random. */
export function bodyPts(shape, variant = 0, { boil = 0.22, squash = 1 } = {}) {
  const key = `${shape}|${variant}|${boil}|${squash}`; if (_cache.has(key)) return _cache.get(key);
  const seed = hashStr(shape);
  let pts = shape === "flower" ? flowerPts() : sampleClosed(BODY_PATHS[shape], 0.3, 60);
  pts = smooth(pts, ROUND[shape]);
  const r = rng(seed + 3);
  // Asymmetry 1–3 % (the two halves differ), displacement ≤ 0.35 unit.
  const sx = 1 + (r() - 0.5) * 0.04, sy = 1 + (r() - 0.5) * 0.03;
  pts = wobble(pts, shape === "circle" ? 0.2 : 0.28, seed, { freqs: [2, 3, 5], boilAmp: variant ? boil : 0, boilSeed: variant, squish: [sx, sy] });
  if (squash !== 1) { const k = squash, kk = 1 / Math.sqrt(k); pts = pts.map(([x, y]) => [12 + (x - 12) * kk, 21 + (y - 21) * k]); }
  _cache.set(key, pts); return pts;
}

/** Face feature data split into subpaths with a hand: one eye fractionally higher and larger. */
function faceSVG(expr, ink, seed, variant, { light = false } = {}) {
  const r = rng(seed + 101); const lift = 0.12 + r() * 0.12; const big = 1 + r() * 0.05; const right = r() > 0.5;
  const out = [];
  const feats = FEATURES[expr];
  for (const [fi, ft] of feats.entries()) {
    const isCheek = ft.part === "cheeks";
    const color = isCheek ? (expr === "shy" ? "#FF96C5" : ink === CREAM ? "#120A1F" : CREAM) : ink;
    const op = isCheek ? (expr === "shy" ? 0.6 : ink === CREAM ? 0.25 : ft.alpha ?? 0.35) : 1;
    const subs = (ft.d.match(/M[^M]*/g) || []).map((sp, si) => {
      // Shift one eye: compute rough x by first number after M.
      const x0 = parseFloat(sp.slice(1)); const isRight = x0 > 6;
      let tf = "";
      if (ft.part === "eyes" && isRight === right) { const cy = 3.6; const cx = isRight ? 8.2 : 3.8; tf = `translate(${cx} ${cy - lift}) scale(${big}) translate(${-cx} ${-cy})`; }
      let d;
      if (ft.style === "stroke") d = brush(sp, ft.w * 1.05, { seed: seed + fi * 13 + si * 7 + variant * 101, endRatio: 0.55, step: 0.08, pressure: 0.15, jitter: variant ? 0.05 : 0.02 });
      else d = sp;
      return el("path", { d, fill: color, opacity: op === 1 ? undefined : op, transform: tf || undefined }, "");
    });
    if (isCheek && expr === "shy") {
      // shy cheeks: 2–3 short hatch strokes, not a blush disc (ART-DIRECTION §8.3)
      const hatch = [];
      for (const cx of [2.2, 9.8]) for (let k = 0; k < 3; k++) hatch.push(brush(`M${cx - 0.9 + k * 0.6} ${6.5}L${cx - 0.4 + k * 0.6} ${5.3}`, 0.35, { seed: seed + k + cx * 10, endRatio: 0.4 }));
      out.push(el("path", { d: hatch.join(""), fill: "#E84A86", opacity: 0.85 }, ""));
    } else out.push(...subs);
  }
  return out.join("");
}

/**
 * One character as an SVG group in body units (viewBox -4 -6 32 34 is a good frame).
 * opts: color id, expr, world (ink/paper), variant (boil A/B/C = 0/1/2), look ('start'|'end'|null), dir (1 LTR, -1 RTL),
 *       misreg (bool), squash (number), line (ink mean weight), crown, prop, doubleLine (liar caught), desat.
 */
export function characterG(color, expr = "idle", o = {}) {
  const c = BY_ID[color]; const shape = c.shape; const world = o.world || "hub"; const ink = INKS[world]; const paper = PAPERS[world];
  const variant = o.variant || 0; const seed = hashStr(color + shape); const dir = o.dir || 1;
  const pts = bodyPts(shape, variant, { squash: o.squash || 1 });
  const line = o.line ?? 0.9; const glyphInk = c.glyph === "ink" ? ink : CREAM;
  const bodyD = smoothPath(pts);
  const id = uid("ch");
  const mis = o.misreg === false ? [0, 0] : [0.32 * dir, 0.3];
  const bb = bbox(pts); const cc = centroid(pts);
  const parts = [];
  // ground shadow (hand-cut, world ink 30 %)
  if (o.shadow !== false) parts.push(el("path", { d: smoothPath(handEllipse(12, 22.6, 7.6 / Math.sqrt(o.squash || 1), 1.25, seed + 9)), fill: ink, opacity: 0.32 }, ""));
  // nub for point (under the body)
  const extra = EXTRAS[expr];
  const look = o.look ?? (expr === "point" ? (dir > 0 ? "end" : "start") : null);
  if (extra === "nub") {
    const toEnd = look !== "start"; const x0 = toEnd ? 12 : -0.6, x1 = toEnd ? 24.6 : 12;
    const nub = smoothPath(wobble(smooth(sampleClosed(`M${x0 + 1.4} 12.6H${x1 - 1.4}A1.4 1.4 0 0 1 ${x1 - 1.4} 15.4H${x0 + 1.4}A1.4 1.4 0 0 1 ${x0 + 1.4} 12.6Z`, 0.25), 1), 0.12, seed + 4));
    parts.push(el("g", { transform: `translate(${mis[0]} ${mis[1]})` }, el("path", { d: nub, fill: c.hex }, "")));
    parts.push(el("path", { d: inkRing(sampleNubPts(x0, x1, seed), line * 0.8, { dir }), fill: ink }, ""));
  }
  // cream ring for low-contrast colours sits outside the ink line (DESIGN §2.3)
  if (RINGED.has(color) && o.creamRing !== false) parts.push(el("path", { d: inkRing(pts, 1.0, { inside: -0.55, contrast: 0, dir }), fill: CREAM, opacity: 0.24 }, ""));
  // fill, offset by the misregistration vector (the "second pass")
  let fillHex = c.hex; if (o.desat) fillHex = desat(c.hex, 0.6);
  parts.push(el("clipPath", { id: id + "c" }, el("path", { d: bodyD, transform: `translate(${mis[0]} ${mis[1]})` }, "")));
  parts.push(el("path", { d: bodyD, fill: fillHex, transform: `translate(${mis[0]} ${mis[1]})` }, ""));
  // shadow shape: ink 22 % multiply on the bottom-end third, hand-cut edge
  {
    const r = rng(seed + 77); const xs = dir > 0 ? [bb.x0 - 2, bb.x1 + 2] : [bb.x1 + 2, bb.x0 - 2];
    const y0 = bb.y0 + bb.h * (0.78 + r() * 0.06), y1 = bb.y0 + bb.h * (0.28 + r() * 0.08);
    const cut = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6; cut.push([xs[0] + (xs[1] - xs[0]) * t, y0 + (y1 - y0) * t ** 1.4 + Math.sin(t * 9 + r() * 0.5) * 0.35]); }
    cut.push([xs[1], bb.y1 + 3], [xs[0], bb.y1 + 3]);
    parts.push(el("g", { "clip-path": `url(#${id}c)` }, el("path", { d: poly(cut), fill: ink, opacity: 0.24, style: "mix-blend-mode:multiply" }, "")));
  }
  // highlight: two short brush ticks on the top-start shoulder (no glossy crescent)
  if (!NO_HIGHLIGHT.has(color) && o.highlight !== false) {
    const ns = normals(pts); let best = 0, bi = 0; const sx = -dir / Math.SQRT2, sy = -1 / Math.SQRT2;
    pts.forEach((p, i) => { const v = ns[i][0] * sx + ns[i][1] * sy; if (v > best) { best = v; bi = i; } });
    const n = pts.length; const ticks = [];
    const mk = (i0, len, inset, w) => { const seg = []; let acc = 0, i = i0; let prev = null; while (acc < len && seg.length < n) { const p = [pts[i][0] - ns[i][0] * inset, pts[i][1] - ns[i][1] * inset]; if (prev) acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]); seg.push(p); prev = p; i = (i + dir + n) % n; } return brush(poly(seg, false), w, { seed: seed + i0, endRatio: 0.35, step: 0.08 }); };
    const step = (k) => { let acc = 0, i = bi; const target = Math.abs(k); while (acc < target) { const j = (i + Math.sign(k) * dir + n) % n; acc += Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]); i = j; } return i; };
    ticks.push(mk(step(-1.6), 2.0, 1.5, 0.7));
    ticks.push(mk(step(0.9), 0.75, 1.55, 0.62));
    parts.push(el("g", { "clip-path": `url(#${id}c)` }, el("path", { d: ticks.join(""), fill: paper, opacity: 0.72 }, "")));
  }
  // ink outline: the variable-weight ring (or the "busted" double line)
  if (o.doubleLine) {
    const a = bodyPts(shape, 1), b = bodyPts(shape, 2);
    parts.push(el("path", { d: inkRing(a, line * 0.75, { dir }), fill: ink, opacity: 0.7 }, ""));
    parts.push(el("path", { d: inkRing(b.map(([x, y]) => [x + 0.35, y - 0.25]), line * 0.7, { dir }), fill: ink, opacity: 0.7 }, ""));
  } else parts.push(el("path", { d: inkRing(pts, line, { dir }), fill: ink }, ""));
  // face
  const fb = FACE_BOXES[shape]; const k = (fb.w / FACE_SPACE.w) * (o.featureScale || 1);
  const cx = fb.x + fb.w / 2, cy = fb.y + fb.h / 2 + (o.squash && o.squash !== 1 ? (1 - o.squash) * 6 : 0);
  const lookDx = look === "end" ? 1.2 * dir : look === "start" ? -1.2 * dir : 0;
  let faceT = `translate(${cx} ${cy}) scale(${k}) translate(${-FACE_SPACE.w / 2 + lookDx} ${-FACE_SPACE.h / 2})`;
  if (dir < 0) faceT = `translate(${cx} ${cy}) scale(${-k} ${k}) translate(${-FACE_SPACE.w / 2 + lookDx * -1} ${-FACE_SPACE.h / 2})`;
  let face = faceSVG(expr, glyphInk, seed, variant);
  if (EYE_HIGHLIGHT.includes(expr) && glyphInk !== CREAM) { const [ex, ey] = EYE_OFFSET[expr] || [0, 0]; face += el("g", { fill: CREAM }, el("circle", { cx: 3.8 + ex + 0.35, cy: 3.6 + ey - 0.45, r: 0.38 }, "") + el("circle", { cx: 8.2 + ex + 0.35, cy: 3.6 + ey - 0.55, r: 0.34 }, "")); }
  parts.push(el("g", { transform: faceT }, face));
  // body-relative extras
  if (extra === "hand") {
    const eyeY = cy + (3.6 - 4.5) * k; const hp = handEllipse(cx + 0.4, eyeY, 5.04, 4.8, seed + 31, 0.03);
    parts.push(el("path", { d: smoothPath(hp), fill: c.hex, transform: `translate(${mis[0]} ${mis[1]})` }, ""));
    parts.push(el("path", { d: inkRing(hp, line * 0.85, { dir }), fill: ink }, ""));
    parts.push(el("path", { d: brush(`M${cx - 1.6} ${eyeY - 2.4}Q${cx - 0.6} ${eyeY - 3.2} ${cx + 0.8} ${eyeY - 3.1}`, 0.5, { seed }), fill: paper, opacity: 0.6 }, ""));
  }
  if (o.crown || extra === "crownless") parts.push(crownG(ink, seed));
  if (extra === "check") parts.push(checkBadge(ink, seed + variant));
  if (extra === "zzz") parts.push(el("path", { d: brush("M18.6 0.4H21L18.6 3.2H21.2", 0.55, { seed, endRatio: 0.7 }) + brush("M22 -3.4H23.6L22 -1.6H23.8", 0.42, { seed: seed + 1, endRatio: 0.7 }), fill: o.zColor || paper }, ""));
  if (o.prop) parts.push(o.prop(ink, paper, dir, seed));
  return el("g", {}, parts.join(""));
}

function sampleNubPts(x0, x1, seed) { return wobble(smooth(sampleClosed(`M${x0 + 1.4} 12.6H${x1 - 1.4}A1.4 1.4 0 0 1 ${x1 - 1.4} 15.4H${x0 + 1.4}A1.4 1.4 0 0 1 ${x0 + 1.4} 12.6Z`, 0.25), 1), 0.12, seed + 4); }

export function crownG(ink, seed) {
  const pts = smooth(sampleClosed("M7.5 -1.5l2 1.6L12 -3.6l2.5 3.7 2-1.6-.9 4.5H8.4z", 0.2), 1);
  const w = wobble(pts, 0.12, seed + 55);
  return el("g", { transform: "rotate(-6 12 0)" }, el("path", { d: smoothPath(w), fill: "#FFC94D", transform: "translate(.25 .25)" }, "") + el("path", { d: inkRing(w, 0.55), fill: ink }, "") + el("circle", { cx: 12, cy: -1.2, r: 0.5, fill: "#E2477F" }, ""));
}
export function checkBadge(ink, seed) {
  const pts = handEllipse(21, 3, 3.2, 3.1, seed + 3, 0.03);
  return el("g", { transform: "rotate(-5 21 3)" }, el("path", { d: smoothPath(pts), fill: "#3DDC97", transform: "translate(.25 .25)" }, "") + el("path", { d: inkRing(pts, 0.6), fill: ink }, "") + el("path", { d: brush("M19.3 3.2l1.2 1.2 2.3-2.5", 0.85, { seed, endRatio: 0.6 }), fill: ink }, ""));
}

export function desat(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const l = 0.3 * r + 0.59 * g + 0.11 * b;
  r = r + (l - r) * k; g = g + (l - g) * k; b = b + (l - b) * k; return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** A character as a standalone <svg>. */
export function characterSVG(color, expr, size, o = {}) {
  const vb = o.viewBox || "-4 -6 32 34";
  return el("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: vb, width: size, height: size, style: "overflow:visible" }, characterG(color, expr, o));
}

/** The canonical glyph (for the hand-budget overlay). */
export function canonicalD(shape) { return shape === "flower" ? poly(flowerPts()) : BODY_PATHS[shape]; }
