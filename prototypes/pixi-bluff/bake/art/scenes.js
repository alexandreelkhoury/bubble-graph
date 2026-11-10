// scenes.js (trimmed copy of the art-board source: helpers + hubRoom only) — worlds, posters, the hub room and ornaments (ART-DIRECTION §5, §9). Code-drawn vectors only.
import { rng, hashStr, smoothPath, poly, inkRing, brush, brushAll, handPoly, handEllipse, wobble, smooth, sampleClosed, el, uid } from "./hand.js";
import { characterG, INKS, PAPERS, BY_ID } from "./chars.js";

export const WORLDS = {
  hub: { deep: "#1D1036", top: "#2B1650", surface: "#3A2266", elevated: "#4A2E7A", glow: "#FFC94D", inks: ["#C8553D", "#E8A33A", "#2F5DA8"] },
  "night-market": { deep: "#1D1036", top: "#2B1650", surface: "#3A2266", elevated: "#4A2E7A", glow: "#FFC94D", accent: "#FF4F9A", inks: ["#E2477F", "#F29B38", "#2A7F86"] },
  "hakawati-cafe": { deep: "#1C1209", top: "#2E1D0E", surface: "#33230F", elevated: "#4A3418", glow: "#FFE3A3", accent: "#E9A23B", inks: ["#E9A23B", "#B5452B", "#3D6B4F"] },
  rooftop: { deep: "#071A24", top: "#0E2C3B", surface: "#0F2E3D", elevated: "#17404F", glow: "#B8FFF6", accent: "#29D3C2", inks: ["#29D3C2", "#3A6EA5", "#D2694A"] },
  "quiz-studio": { deep: "#0A0F2E", top: "#141C52", surface: "#161D4A", elevated: "#222B63", glow: "#FFD84D", accent: "#5B7CFF", inks: ["#5B7CFF", "#FFD84D", "#E5484D"] },
};

/** Place a character with its ground contact at (x, y), body height ≈ size. */
export function charAt(color, expr, x, y, size, o = {}) {
  const k = size / 24; const flip = o.dir === -1;
  return el("g", { transform: `translate(${x} ${y}) scale(${k}) translate(-12 -22.6)` }, characterG(color, expr, o));
}

/** Filled shape with the world's ink ring (near/mid scenery). */
export function inked(pts, fill, ink, w = 1.2, o = {}) {
  const mis = o.mis ?? [w * 0.35, w * 0.3];
  return el("path", { d: smoothPath(pts), fill, transform: `translate(${mis[0]} ${mis[1]})`, opacity: o.op }, "") + (w ? el("path", { d: inkRing(pts, w, { contrast: 0.35 }), fill: ink }, "") : "");
}
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** One radial light wash (screen). */
export function wash(cx, cy, rx, ry, color, op = 0.18) {
  const id = uid("w");
  return el("defs", {}, el("radialGradient", { id }, el("stop", { offset: 0, "stop-color": color, "stop-opacity": op }, "") + el("stop", { offset: 0.55, "stop-color": color, "stop-opacity": op * 0.35 }, "") + el("stop", { offset: 1, "stop-color": color, "stop-opacity": 0 }, ""))) + el("ellipse", { cx, cy, rx, ry, fill: `url(#${id})`, style: "mix-blend-mode:screen" }, "");
}
/** A hand-drawn light cone (polygon) soft only at the far edge. */
export function cone(pts, color, op = 0.3, dir = [0, 1]) {
  const id = uid("cn"); const x2 = dir[0] > 0 ? 1 : 0;
  return el("defs", {}, el("linearGradient", { id, x1: dir[0] < 0 ? 1 : 0, y1: 0, x2: dir[0] ? x2 : 0, y2: 1 }, el("stop", { offset: 0, "stop-color": color, "stop-opacity": op }, "") + el("stop", { offset: 0.7, "stop-color": color, "stop-opacity": op * 0.55 }, "") + el("stop", { offset: 1, "stop-color": color, "stop-opacity": 0 }, ""))) + el("path", { d: smoothPath(pts), fill: `url(#${id})`, style: "mix-blend-mode:screen" }, "");
}
/** Paper-tooth grain overlay (stand-in for the illustrator's tile; P3). */
export function grain(w, h, op = 0.07, seed = 3) {
  const id = uid("gr");
  return el("defs", {}, el("filter", { id, x: 0, y: 0, width: "100%", height: "100%" }, `<feTurbulence type="fractalNoise" baseFrequency="0.9 0.55" numOctaves="2" seed="${seed}"/><feColorMatrix values="0 0 0 0 0.1  0 0 0 0 0.05  0 0 0 0 0.15  0 0 0 -1.3 0.75"/>`)) + el("rect", { width: w, height: h, filter: `url(#${id})`, opacity: op * 6, style: "mix-blend-mode:multiply" }, "");
}

/** Far skyline: flat silhouettes, no line, irregular roofline (never on a grid). */
export function skyline(x0, x1, base, hmin, hmax, fill, seed, { windows = null, tanks = true, dishes = true, winOp = 0.85 } = {}) {
  const r = rng(seed); let x = x0; let out = ""; const wins = [];
  while (x < x1) {
    const w = 14 + r() * 26, h = hmin + r() * (hmax - hmin); const top = base - h;
    const pts = [[x, base], [x, top + (r() - 0.5) * 2], [x + w * (0.3 + r() * 0.2), top + (r() - 0.5) * 2], [x + w, top + (r() - 0.5) * 3], [x + w, base]];
    out += el("path", { d: poly(pts), fill }, "");
    if (tanks && r() < 0.45) { const tx = x + 3 + r() * (w - 10); out += el("path", { d: poly([[tx, top], [tx, top - 5], [tx + 1, top - 7], [tx + 6, top - 7], [tx + 7, top - 5], [tx + 7, top]]), fill }, ""); }
    if (dishes && r() < 0.25) { const dx = x + w * 0.7; out += el("path", { d: `M${dx} ${top}v-4M${dx - 3} ${top - 7}a3.4 3.4 0 0 0 6 2.4z`, fill, stroke: fill, "stroke-width": 1 }, ""); }
    if (r() < 0.2) out += el("path", { d: `M${x + w * 0.4} ${top}v-${8 + r() * 6}`, stroke: fill, "stroke-width": 0.8 }, "");
    if (windows) {
      const cols = Math.floor(w / 7); for (let c = 0; c < cols; c++) for (let yy = top + 6; yy < base - 4; yy += 7 + r() * 2) if (r() < 0.16) { const ww = 2.2 + r() * 1.4, hh = 2.6 + r() * 1.6; wins.push(el("rect", { x: x + 3 + c * 7 + (r() - 0.5), y: yy, width: ww, height: hh, rx: 0.4, fill: windows, opacity: winOp * (0.5 + r() * 0.5) }, "")); }
    }
    x += w - 1 + r() * 3;
  }
  return out + wins.join("");
}

/** A cement tile (ART-DIRECTION §9.4): pattern in 3 inks + thick paper edge, variant 0..2, hand-cut. */
export function tile(x, y, s, variant, seed, inks, paper, ink, o = {}) {
  const r = rng(seed); const [rust, saffron, blue] = inks; const cx = x + s / 2, cy = y + s / 2; let out = "";
  const base = o.base || "#EAD9BC";
  out += el("path", { d: smoothPath(handPoly(rect(x, y, s, s), seed, { belly: 0.01, perEdge: 6 })), fill: paper }, "");
  const e = s * 0.08; out += el("path", { d: smoothPath(handPoly(rect(x + e, y + e, s - 2 * e, s - 2 * e), seed + 1, { belly: 0.012, perEdge: 6 })), fill: base }, "");
  const mis = `translate(${s * 0.012} ${s * 0.01})`; const tc = uid("tc"); out += el("clipPath", { id: tc }, el("rect", { x, y, width: s, height: s }, ""));
  let pat = "";
  const petal = (a, len, wd, col) => { const pts = []; for (let i = 0; i < 24; i++) { const t = (i / 24) * Math.PI * 2; const px = Math.cos(t) * len / 2 + len / 2, py = Math.sin(t) * wd / 2 * Math.sin(Math.acos(Math.cos(t))) ; pts.push([px, py]); } const ca = Math.cos(a), sa = Math.sin(a); return el("path", { d: smoothPath(wobble(pts.map(([px, py]) => [cx + px * ca - py * sa, cy + px * sa + py * ca]), s * 0.006, seed + a * 100)), fill: col, transform: mis }, ""); };
  if (variant === 0) { // quatrefoil
    for (let i = 0; i < 4; i++) pat += el("path", { d: smoothPath(handEllipse(cx + Math.cos(i * Math.PI / 2) * s * 0.15, cy + Math.sin(i * Math.PI / 2) * s * 0.15, s * 0.15, s * 0.15, seed + i, 0.04)), fill: rust, transform: mis }, "");
    for (const [qx, qy] of [[x + e, y + e], [x + s - e, y + e], [x + s - e, y + s - e], [x + e, y + s - e]]) pat += el("path", { d: smoothPath(handEllipse(qx, qy, s * 0.16, s * 0.16, seed + qx, 0.03)), fill: blue, transform: mis }, "");
    pat += el("path", { d: smoothPath(handEllipse(cx, cy, s * 0.07, s * 0.07, seed + 9, 0.05)), fill: saffron }, "");
  } else if (variant === 1) { // eight-point star
    const sq = (rot, k, col) => { const pts = []; for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2 + Math.PI / 4; pts.push([cx + Math.cos(a) * s * k, cy + Math.sin(a) * s * k]); } return el("path", { d: smoothPath(handPoly(pts, seed + rot * 10, { belly: 0.02, perEdge: 5 })), fill: col, transform: mis }, ""); };
    pat += sq(0, 0.36, blue) + sq(Math.PI / 4, 0.36, blue) + el("path", { d: smoothPath(handEllipse(cx, cy, s * 0.15, s * 0.15, seed + 2, 0.04)), fill: saffron }, "") + el("path", { d: smoothPath(handEllipse(cx, cy, s * 0.06, s * 0.06, seed + 3, 0.05)), fill: rust }, "");
    for (const [qx, qy] of [[x + e * 2.2, y + e * 2.2], [x + s - e * 2.2, y + e * 2.2], [x + s - e * 2.2, y + s - e * 2.2], [x + e * 2.2, y + s - e * 2.2]]) pat += el("path", { d: smoothPath(handEllipse(qx, qy, s * 0.045, s * 0.045, seed + qx, 0.05)), fill: rust }, "");
  } else { // petals
    for (let i = 0; i < 8; i++) pat += petal(i * Math.PI / 4 + Math.PI / 8, s * 0.36, s * 0.13, i % 2 ? rust : saffron);
    pat += el("path", { d: smoothPath(handEllipse(cx, cy, s * 0.09, s * 0.09, seed + 5, 0.05)), fill: blue }, "");
  }
  out += el("g", { "clip-path": `url(#${tc})` }, pat);
  if (o.line) out += el("path", { d: inkRing(handPoly(rect(x, y, s, s), seed, { belly: 0.01, perEdge: 6 }), o.line, { contrast: 0.3 }), fill: ink, opacity: 0.9 }, "");
  return out;
}

/** A row of tiles, 3–4 variants in a non-repeating seeded order. */
export function tileRow(x, y, s, n, seed, inks, paper, ink, o = {}) {
  const r = rng(seed); let out = ""; const seq = []; let last = -1;
  for (let i = 0; i < n; i++) { let v; do v = Math.floor(r() * 3); while (v === last && r() < 0.8); last = v; seq.push(o.variant ?? v); }
  seq.forEach((v, i) => (out += tile(x + i * s, y, s, v, seed + i * 11, inks, paper, ink, o)));
  return out;
}

/** String of bulbs along a catenary; 4 drawn bulb variants. */
export function bulbString(x0, y0, x1, y1, sag, n, ink, bulb, seed, glow = true) {
  const r = rng(seed); const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)]); }
  let out = el("path", { d: brush(poly(pts, false), 0.9, { seed, endRatio: 0.8, pressure: 0.2 }), fill: ink }, "");
  for (let i = 1; i < n; i++) {
    const t = i / n; const bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t);
    const v = Math.floor(r() * 4); const rr = 2.1 + v * 0.25;
    if (glow) out += el("circle", { cx: bx, cy: by + 4, r: rr * 3.2, fill: bulb, opacity: 0.12, style: "mix-blend-mode:screen" }, "");
    out += el("path", { d: `M${bx - 0.9} ${by}h1.8v2h-1.8z`, fill: ink }, "");
    out += el("path", { d: smoothPath(handEllipse(bx, by + 4, rr * 0.85, rr * (1.1 + v * 0.05), seed + i, 0.05)), fill: v === 3 ? "#FFD27A" : bulb }, "");
  }
  return out;
}

/** Hatch: 3–5 parallel hand strokes. */
export function hatch(x, y, w, h, n, ink, seed, op = 0.5, angle = 0) {
  const r = rng(seed); let d = "";
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const xx = x + w * t + (r() - 0.5) * 2; d += brush(`M${xx} ${y + r() * h * 0.15}L${xx + angle} ${y + h * (0.75 + r() * 0.25)}`, 0.9, { seed: seed + i, endRatio: 0.3 }); }
  return el("path", { d, fill: ink, opacity: op }, "");
}

export function hubRoom(o = {}) {
  const W = 960, H = 540; const w = WORLDS.hub; const ink = INKS.hub; const paper = PAPERS.hub; const [rust, saffron, blue] = w.inks; const seed = 77;
  let s = el("defs", {}, el("linearGradient", { id: "hubg", x1: 0, y1: 0, x2: 0.3, y2: 1 }, el("stop", { offset: 0, "stop-color": "#2E1856" }, "") + el("stop", { offset: 1, "stop-color": "#1D1036" }, "")));
  s += el("rect", { width: W, height: H, fill: "url(#hubg)" }, "");
  // wall texture: faint painted panels
  s += el("path", { d: smoothPath(handPoly(rect(28, 40, 300, 330), 3, { belly: 0.004 })), fill: "#251444", opacity: 0.6 }, "");
  // wall picture above the sofa: a small arch-framed painting of the coast (flat fills)
  { const fp = wobble(sampleClosed("M372 270V196a58 46 0 0 1 116 0v74z", 2), 1.2, 31);
    s += el("clipPath", { id: "hubpic" }, el("path", { d: smoothPath(fp) }, ""));
    s += el("g", { "clip-path": "url(#hubpic)" }, el("rect", { x: 360, y: 140, width: 140, height: 140, fill: "#E8A33A" }, "") + el("path", { d: smoothPath(handPoly([[360, 230], [400, 196], [430, 214], [470, 186], [500, 230], [500, 280], [360, 280]], 32, { belly: 0.02 })), fill: "#5A3A6A" }, "") + el("rect", { x: 360, y: 240, width: 140, height: 40, fill: "#2F5DA8" }, "") + el("path", { d: brush("M380 252H420M440 262H480", 1.6, { seed: 3 }), fill: "#FFF1DC", opacity: 0.6 }, "") + el("circle", { cx: 452, cy: 214, r: 9, fill: "#FFF1DC", opacity: 0.85 }, ""));
    s += el("path", { d: inkRing(fp, 7, { inside: 0.1 }), fill: "#7A4A26" }, "") + el("path", { d: inkRing(fp.map(([x, y]) => [x, y]), 2.4, { inside: -2.6 }), fill: ink }, ""); }
  // baseboard + the lamp's tangled wire
  s += el("path", { d: brush("M0 438H960", 3, { seed: 9, endRatio: 0.9, pressure: 0.1 }), fill: ink, opacity: 0.8 }, "");
  s += el("path", { d: brush("M200 448Q206 470 240 462T262 476Q236 492 214 484", 1.6, { seed: 4, endRatio: 0.7 }), fill: ink }, "");
  // balcony arch window (bab) with the city outside
  const winD = "M600 400V170a120 120 0 0 1 240 0v230z";
  const winPts = wobble(sampleClosed(winD, 3), 2.2, 5);
  s += el("clipPath", { id: "hubwin" }, el("path", { d: smoothPath(winPts) }, ""));
  let city = el("rect", { x: 560, y: 30, width: 320, height: 380, fill: "#120C2E" }, "") + wash(720, 360, 200, 70, "#F29B38", 0.25);
  city += el("circle", { cx: 790, cy: 120, r: 15, fill: "#FFF1DC", opacity: 0.85 }, "") + el("circle", { cx: 796, cy: 116, r: 14, fill: "#120C2E" }, "");
  city += skyline(590, 860, 400, 50, 170, "#21184A", seed, { windows: "#FFD27A", winOp: 0.7 });
  city += skyline(580, 870, 400, 20, 80, "#2C2158", seed + 1, { windows: "#FFE9C7", winOp: 0.8 });
  s += el("g", { "clip-path": "url(#hubwin)" }, city);
  s += el("path", { d: inkRing(winPts, 9, { contrast: 0.3, inside: 0.2 }), fill: "#4A2E7A" }, "") + el("path", { d: inkRing(winPts.map(([x, y]) => [x, y]), 3, { inside: -2.4 }), fill: ink }, "");
  // balcony rail + plant tins + cat tail
  let rail = brush("M604 336H836", 3.5, { seed: 1, endRatio: 0.9 }); for (let x = 616; x < 836; x += 18) rail += brush(`M${x} 338V398`, 2, { seed: x, endRatio: 0.85 });
  s += el("path", { d: rail, fill: ink }, "");
  [[640, 0], [700, 1], [770, 2]].forEach(([x, k]) => { s += inked(handPoly([[x - 12, 316], [x + 12, 316], [x + 10, 336], [x - 10, 336]], 40 + k), [rust, "#9AA8A8", blue][k], ink, 1.6) + el("path", { d: brush(`M${x} 316Q${x - 14} 296 ${x - 20} 292M${x} 316Q${x + 4} 292 ${x + 16} 286M${x} 316Q${x - 2} 300 ${x + 2} 282`, 3.2, { seed: k }), fill: "#3D8B5F" }, ""); });
  s += el("path", { d: brush("M812 334Q826 322 818 306Q814 298 822 294", 4, { seed: 7, endRatio: 0.5 }), fill: ink }, "");
  // curtain
  const cur = handPoly([[560, 40], [600, 40], [596, 200], [608, 410], [566, 414], [574, 220]], 9, { belly: 0.02, round: 3 });
  s += inked(cur, "#7A2E4A", ink, 2.4) + hatch(568, 60, 30, 330, 4, ink, 3, 0.35, 4);
  // standing lamp: light first
  s += cone([[160, 128], [236, 128], [330, 470], [64, 470]], "#FFC94D", 0.18) + wash(198, 120, 220, 170, "#FFC94D", 0.3);
  s += el("path", { d: brush("M198 150V448M172 452H224", 4, { seed: 2, endRatio: 0.9 }), fill: ink }, "");
  s += inked(handPoly([[166, 84], [230, 84], [246, 132], [150, 132]], 12, { belly: 0.03 }), "#E8A33A", ink, 2.4) + el("path", { d: brush("M168 128H228", 2.2, { seed: 3 }), fill: paper, opacity: 0.5 }, "");
  // sofa (mid, long silhouette)
  const sofa = handPoly([[300, 318], [560, 312], [576, 344], [570, 430], [292, 434], [288, 344]], 14, { belly: 0.01, round: 4 });
  s += inked(sofa, "#5A2E6A", ink, 2.2);
  s += inked(handPoly([[312, 360], [552, 356], [556, 400], [306, 402]], 15, { belly: 0.01, round: 3 }), "#6C3A7C", ink, 1.6);
  s += inked(handPoly([[330, 330], [372, 326], [376, 358], [334, 362]], 16, { belly: 0.04, round: 4 }), rust, ink, 1.6) + inked(handPoly([[500, 328], [540, 332], [538, 362], [498, 358]], 17, { belly: 0.04, round: 4 }), blue, ink, 1.6);
  // floor: cement-tile strip
  s += el("rect", { y: 440, width: W, height: 100, fill: "#2A1A3E" }, "");
  s += tileRow(-10, 448, 46, 22, seed + 3, [rust, saffron, blue], paper, ink, { base: "#E3CFAE", line: 0.9 });
  s += el("rect", { y: 448, width: W, height: 46, fill: "#1D1036", opacity: 0.45 }, "");
  s += el("rect", { y: 494, width: W, height: 46, fill: "#22143A" }, "");
  // rug under the table, tile-border edge and fringe
  { const rug = handPoly([[318, 462], [600, 458], [616, 500], [300, 504]], 33, { belly: 0.02, round: 3 });
    s += inked(rug, "#8E3A2E", ink, 1.8) + inked(handPoly([[336, 468], [584, 465], [596, 494], [322, 497]], 34, { belly: 0.02, round: 2 }), "#B5513C", ink, 0);
    let fr = ""; for (let x = 306; x < 612; x += 7) fr += brush(`M${x} ${504 - (x - 300) * 0.0} l-1 7`, 1, { seed: x }); s += el("path", { d: fr, fill: paper, opacity: 0.55 }, "");
    for (let k = 0; k < 7; k++) s += el("path", { d: smoothPath(handEllipse(360 + k * 34, 481, 7, 4.5, 50 + k, 0.08)), fill: k % 2 ? saffron : blue, opacity: 0.9 }, ""); }
  // low table with rakweh and cups + steam
  s += inked(handPoly([[380, 436], [520, 434], [528, 452], [374, 454]], 18), "#7A4A26", ink, 2) + el("path", { d: brush("M392 454V478M512 454V478", 3, { seed: 4 }), fill: ink }, "");
  s += inked(handPoly([[420, 434], [440, 434], [442, 412], [434, 404], [426, 404], [418, 412]], 19, { belly: 0.03 }), "#E9A23B", ink, 1.6) + el("path", { d: brush("M440 414Q454 404 456 394", 2.2, { seed: 5 }), fill: ink }, "");
  s += inked(handPoly([[462, 434], [474, 434], [475, 422], [461, 422]], 20), paper, ink, 1.2) + inked(handPoly([[484, 435], [496, 435], [497, 423], [483, 423]], 21), paper, ink, 1.2);
  s += el("path", { d: brush("M468 416q-5-8 0-14t0-12", 1.4, { seed: 2, endRatio: 0.2 }) + brush("M490 417q5-8 0-14", 1.2, { seed: 3, endRatio: 0.2 }), fill: paper, opacity: 0.5 }, "");
  // characters sitting (gathering state)
  if (o.gang) {
    s += charAt("coral", "happy", 346, 372, 66, { squash: 0.92, variant: 0 });
    s += charAt("azure", "laugh", 414, 370, 64, { squash: 0.92, variant: 1 });
    s += charAt("lemon", "idle", 476, 368, 60, { squash: 0.92, variant: 2, look: "start" });
    s += charAt("sand", "smug", 536, 370, 62, { squash: 0.92, variant: 1 });
    s += charAt("jade", "think", 300, 492, 70, { squash: 0.92, variant: 0, look: "end" });
    s += charAt("lilac", "idle", 652, 494, 68, { variant: 2, look: "start" });
    s += charAt("rose", "shy", 720, 494, 62, { variant: 0, look: "start", squash: 0.94 });
  }
  s += wash(520, 600, 420, 160, "#6FA8FF", 0.16);
  s += grain(W, H, 0.04, 11);
  return el("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: `0 0 ${W} ${H}`, width: o.width || 960, height: ((o.width || 960) * H) / W, style: o.style || "" }, s);
}
