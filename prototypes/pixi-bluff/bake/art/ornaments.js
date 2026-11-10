// ornaments.js (trimmed copy): the reaction bursts only (ART-DIRECTION §9.5).
import { rng, sampleClosed, wobble, smoothPath, inkRing, brush, handPoly, poly, el } from "./hand.js";
/** Reaction bursts in marker style, 3 boil variants (ART-DIRECTION §9.5). Box 0..48. */
export function burst(kind, variant, ink = "#160B26") {
  const s = 100 + variant * 17; const wob = (pts, a = 0.5) => wobble(pts, a, s);
  const filled = (d, col, step = 0.6, a = 0.5, w = 1.8) => { const p = wob(sampleClosed(d, step), a); return el("path", { d: smoothPath(p), fill: col, transform: "translate(.8 .7)" }, "") + el("path", { d: inkRing(p, w), fill: ink }, ""); };
  const mark = (d, col, w) => el("path", { d: brush(d, w, { seed: s, jitter: 0.25 + variant * 0.1 }), fill: col }, "");
  switch (kind) {
    case "heart": return filled("M24 40C10 31 6 23 8 16c2-6 10-8 16-1 6-7 14-5 16 1 2 7-2 15-16 24z", "#FF96C5") + mark("M13 17q1-4 5-4", "#FFF1DC", 2.2);
    case "exclaim": return filled("M20 6h9l-2 24h-5z", "#FFF04D", 0.5, 0.35) + filled("M24.5 34a3.6 3.6 0 1 0 0.1 0z", "#FFF04D", 0.4, 0.25);
    case "sweat": return filled("M28 6C22 16 16 22 16 30a9 9 0 0 0 18 0c0-8-4-14-6-24z", "#7BFFF4") + mark("M21 28q0 4 3 6", "#FFF1DC", 2.2);
    case "tears": return filled("M14 10C10 17 8 21 8 26a6 6 0 0 0 12 0c0-5-3-9-6-16z", "#7BFFF4", 0.5, 0.35) + filled("M34 14C30 21 28 25 28 30a6 6 0 0 0 12 0c0-5-3-9-6-16z", "#7BFFF4", 0.5, 0.35);
    case "raincloud": return filled("M12 26a7 7 0 0 1 2-13 9 9 0 0 1 17-2 7 7 0 0 1 5 15z", "#C9BFFF") + mark("M15 31l-2 6M24 31l-2 7M33 31l-2 6", "#478CFF", 2.4);
    case "confetti": { let o = ""; const r = rng(s); const cols = ["#F0183A", "#FFF04D", "#478CFF", "#1FA88A", "#FF96C5", "#FF7A1F"]; for (let i = 0; i < 9; i++) { const cx = 6 + r() * 36, cy = 6 + r() * 36, a = r() * 180; const k = i % 3; const d = k === 0 ? `M${cx - 3} ${cy - 2}h6v4h-6z` : k === 1 ? `M${cx} ${cy - 3}l3 5h-6z` : `M${cx - 2.6} ${cy}a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0`; const p = handPoly(sampleClosed(d, 0.5), s + i, { belly: 0, perEdge: 1, round: 0 }); o += el("g", { transform: `rotate(${a.toFixed(0)} ${cx} ${cy})` }, el("path", { d: poly(p), fill: ink, opacity: 0.4, transform: "translate(.8 .9)" }, "") + el("path", { d: poly(p), fill: cols[i % cols.length] }, "")); } return o; }
  }
  return "";
}
