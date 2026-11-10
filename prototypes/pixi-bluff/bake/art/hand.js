/* global document */
/* eslint-disable @typescript-eslint/no-unused-vars -- near-verbatim copy of the art-board source (docs/art-board/README.md); kept as is so it diffs cleanly */
// hand.js — the "hand" layer for JAMAA board renders (ART-DIRECTION §3, §5.4, §8, §10.3).
// Everything is seeded: the same seed always draws the same wonk (no per-render randomness).
// Runs in the browser (uses SVGPathElement.getPointAtLength to sample the canonical geometry).

export const NS = "http://www.w3.org/2000/svg";

export function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashStr = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

let _svg;
function scratch(d) {
  if (!_svg) { _svg = document.createElementNS(NS, "svg"); _svg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden"); document.body.appendChild(_svg); }
  const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); _svg.appendChild(p); return p;
}
/** Split a path into absolute-M subpaths. */
export const subpaths = (d) => d.match(/M[^M]*/g) || [];

/** Sample a closed subpath at roughly `step` spacing. */
export function sampleClosed(d, step = 0.35, min = 16) {
  const p = scratch(d); const L = p.getTotalLength(); const n = Math.max(min, Math.round(L / step)); const pts = [];
  for (let i = 0; i < n; i++) { const q = p.getPointAtLength((i * L) / n); pts.push([q.x, q.y]); }
  p.remove(); return pts;
}
/** Sample an open path from start to end inclusive. */
export function sampleOpen(d, step = 0.2, min = 6) {
  const p = scratch(d); const L = p.getTotalLength(); const n = Math.max(min, Math.round(L / step)); const pts = [];
  for (let i = 0; i <= n; i++) { const q = p.getPointAtLength((i * L) / n); pts.push([q.x, q.y]); }
  p.remove(); return { pts, L };
}

const f = (v) => (Math.round(v * 100) / 100).toString();
export const poly = (pts, close = true) => pts.length ? "M" + pts.map((p) => f(p[0]) + " " + f(p[1])).join("L") + (close ? "Z" : "") : "";

/** Smooth closed polyline as Catmull-Rom -> cubic beziers (nicer than L at large sizes). */
export function smoothPath(pts, close = true) {
  const n = pts.length; if (n < 3) return poly(pts, close);
  const g = (i) => pts[close ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (close ? "Z" : "");
}

export function centroid(pts) { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; }
export function bbox(pts) { let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity; for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); e = Math.max(e, y); } return { x0: a, y0: b, x1: c, y1: e, w: c - a, h: e - b }; }
function area(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }

/** Outward unit normals of a closed polygon. */
export function normals(pts) {
  const n = pts.length; const sgn = area(pts) > 0 ? 1 : -1; const out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    out.push([sgn * ty, -sgn * tx]);
  }
  // safety: flip if the normals point inward on average
  const c = centroid(pts); let s = 0; for (let i = 0; i < n; i++) s += out[i][0] * (pts[i][0] - c[0]) + out[i][1] * (pts[i][1] - c[1]);
  return s < 0 ? out.map(([x, y]) => [-x, -y]) : out;
}

/** Moving average on a closed polygon (rounds corners by ~k*step). Varies per-vertex if kArr given. */
export function smooth(pts, k = 1) {
  if (k <= 0) return pts; const n = pts.length;
  return pts.map((_, i) => { let x = 0, y = 0; for (let j = -k; j <= k; j++) { const p = pts[(i + j + n) % n]; x += p[0]; y += p[1]; } return [x / (2 * k + 1), y / (2 * k + 1)]; });
}

/** Low-frequency, closed (integer-frequency) displacement along the normal: the drawn wonk. */
export function wobble(pts, amp, seed, { freqs = [2, 3, 5], boilAmp = 0, boilSeed = 0, squish = [1, 1] } = {}) {
  const r = rng(seed); const ph = freqs.map(() => r() * Math.PI * 2); const wts = freqs.map((_, i) => (i === 0 ? 0.55 : 0.45 / (freqs.length - 1)) * (0.8 + 0.4 * r()));
  const rb = rng(boilSeed * 7919 + seed + 13); const bf = [3, 4, 7]; const bph = bf.map(() => rb() * Math.PI * 2);
  const ns = normals(pts); const n = pts.length; const c = centroid(pts);
  return pts.map((p, i) => {
    const u = i / n; let d = 0; freqs.forEach((fq, j) => (d += wts[j] * Math.sin(2 * Math.PI * fq * u + ph[j]))); d *= amp;
    if (boilAmp) { let b = 0; bf.forEach((fq, j) => (b += Math.sin(2 * Math.PI * fq * u + bph[j]) / bf.length)); d += b * boilAmp * 1.6; }
    const q = [p[0] + ns[i][0] * d, p[1] + ns[i][1] * d];
    return [c[0] + (q[0] - c[0]) * squish[0], c[1] + (q[1] - c[1]) * squish[1]];
  });
}

/** The variable-weight ink ring (ART-DIRECTION §3.2): thick on the bottom-end, thin top-start. dir = +1 LTR, -1 RTL. */
export function inkRing(pts, mean = 0.9, { dir = 1, inside = 0.38, contrast = 0.3 } = {}) {
  const ns = normals(pts); const s = [dir / Math.SQRT2, 1 / Math.SQRT2];
  const outer = [], inner = [];
  pts.forEach((p, i) => {
    const w = mean * (1 + contrast * (ns[i][0] * s[0] + ns[i][1] * s[1]));
    outer.push([p[0] + ns[i][0] * w * (1 - inside), p[1] + ns[i][1] * w * (1 - inside)]);
    inner.push([p[0] - ns[i][0] * w * inside, p[1] - ns[i][1] * w * inside]);
  });
  return smoothPath(outer) + smoothPath(inner.reverse());
}

/** A tapered brush stroke along an open path: thick in the middle, ends at `endRatio`, round caps. */
export function brush(d, w, { endRatio = 0.55, seed = 1, jitter = 0, step = 0.15, pressure = 0.12, capRound = true } = {}) {
  const { pts } = sampleOpen(d, step);
  const r = rng(seed); const ph = r() * 6.28, ph2 = r() * 6.28; const n = pts.length;
  if (n < 2) return "";
  const left = [], right = [];
  const P = pts.map((p, i) => {
    if (!jitter) return p; const u = i / (n - 1);
    return p; // displacement applied below along normal
  });
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const nx = -ty, ny = tx; const u = i / (n - 1);
    const taper = endRatio + (1 - endRatio) * Math.sin(Math.PI * u) ** 0.6;
    const ww = (w / 2) * taper * (1 + pressure * Math.sin(u * 5.1 + ph));
    const j = jitter * Math.sin(u * 7.3 + ph2);
    const cx = P[i][0] + nx * j, cy = P[i][1] + ny * j;
    left.push([cx + nx * ww, cy + ny * ww]); right.push([cx - nx * ww, cy - ny * ww]);
  }
  // round caps
  const cap = (c, from, to, rad) => { const arr = []; const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]); for (let k = 1; k < 6; k++) { const a = a0 + (Math.PI * k) / 6; arr.push([c[0] + Math.cos(a) * rad, c[1] + Math.sin(a) * rad]); } return arr; };
  const e = P[n - 1], s0 = P[0];
  const rEnd = Math.hypot(left[n - 1][0] - e[0], left[n - 1][1] - e[1]);
  const rStart = Math.hypot(right[0][0] - s0[0], right[0][1] - s0[1]);
  const out = [...left, ...(capRound ? cap(e, left[n - 1], right[n - 1], rEnd) : []), ...right.reverse(), ...(capRound ? cap(s0, right[right.length - 1], left[0], rStart) : [])];
  return poly(out);
}

/** Brush a whole multi-subpath stroke path (each subpath its own stroke). */
export function brushAll(d, w, opts = {}) { return subpaths(d).map((sp, i) => brush(sp, w, { ...opts, seed: (opts.seed || 1) + i * 31 })).join(""); }

/** Hand-cut ellipse (one side flatter). */
export function handEllipse(cx, cy, rx, ry, seed, amp = 0.06) {
  const r = rng(seed); const n = 48; const pts = [];
  const p1 = r() * 6.28, p2 = r() * 6.28; const flat = 0.85 + r() * 0.1;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = 1 + amp * Math.sin(2 * a + p1) + amp * 0.6 * Math.sin(3 * a + p2); let y = Math.sin(a) * ry * k; if (y < 0) y *= flat; pts.push([cx + Math.cos(a) * rx * k, cy + y]); }
  return pts;
}

/** Hand-cut polygon from given corners: edges get a belly, corners slightly rounded. */
export function handPoly(corners, seed, { belly = 0.012, perEdge = 8, round = 1, amp = 0 } = {}) {
  const r = rng(seed); const out = []; const n = corners.length;
  for (let i = 0; i < n; i++) {
    const a = corners[i], b = corners[(i + 1) % n]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
    const sg = (i % 2 ? 1 : -1) * (0.5 + r()) * belly * len; const k = Math.max(2, Math.round(perEdge * Math.min(3, len / 20 + 0.5)));
    for (let j = 0; j < k; j++) { const t = j / k; const bb = Math.sin(Math.PI * t) * sg; out.push([a[0] + (b[0] - a[0]) * t + nx * bb, a[1] + (b[1] - a[1]) * t + ny * bb]); }
  }
  let pts = smooth(out, round);
  if (amp) pts = wobble(pts, amp, seed + 5);
  return pts;
}

export const el = (tag, attrs = {}, inner = "") => `<${tag} ${Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => `${k}="${v}"`).join(" ")}${inner === null ? "/>" : `>${inner}</${tag}>`}`;
let _uid = 0; export const uid = (p = "u") => `${p}${++_uid}`;
