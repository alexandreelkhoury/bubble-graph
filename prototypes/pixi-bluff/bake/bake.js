/* global document, Image, Blob, FileReader, window */
// Bake step (runs in Chromium via scripts/bake.mjs): renders the hand-made SVG drawings (art/*.js, the board sources)
// into a few texture-atlas pages + the room plate. The runtime never draws SVG: it only loads these pages.
import { characterG, BY_ID, BODY_PATHS } from "./art/chars.js";
import { hubRoom } from "./art/scenes.js";
import { burst } from "./art/ornaments.js";
import { handEllipse, smoothPath, inkRing, brush, el, rng, sampleClosed, wobble, poly } from "./art/hand.js";

const PAGE = 2048;
const INK = "#160B26";

function svgToImage(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

function canvasToDataUrl(canvas, type, q) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(blobToDataUrl(b)), type, q));
}

/** Packs same-size cells into pages; returns [{ name, dataUrl, json }]. */
async function pack(prefix, cells, cw, ch, type = "image/webp", q = 0.95) {
  const cols = Math.floor(PAGE / cw), rows = Math.floor(PAGE / ch), per = cols * rows;
  const pages = [];
  for (let p = 0; p * per < cells.length; p++) {
    const slice = cells.slice(p * per, (p + 1) * per);
    const usedRows = Math.ceil(slice.length / cols);
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(cols, slice.length) * cw;
    canvas.height = usedRows * ch;
    const ctx = canvas.getContext("2d");
    const frames = {};
    for (const [i, cell] of slice.entries()) {
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      const img = await svgToImage(cell.svg);
      ctx.drawImage(img, x, y, cw, ch);
      frames[cell.name] = { frame: { x, y, w: cw, h: ch }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: cw, h: ch }, sourceSize: { w: cw, h: ch } };
    }
    const ext = type === "image/png" ? "png" : "webp";
    const file = `${prefix}-${p}.${ext}`;
    pages.push({ file, dataUrl: await canvasToDataUrl(canvas, type, q), json: { frames, meta: { app: "jamaa-bake", image: file, format: "RGBA8888", size: { w: canvas.width, h: canvas.height }, scale: "1" } } });
  }
  return pages;
}

const svgWrap = (vb, w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}" style="overflow:visible">${inner}</svg>`;

export async function bake({ players, exprs, pxPerUnit }) {
  const out = { pages: [], meta: {} };
  // ---- characters: 3 boil variants per expression, + the "busted" double line (ART-DIRECTION §10.4)
  const VB = [-4, -7, 32, 35];
  const cw = Math.round(VB[2] * pxPerUnit), ch = Math.round(VB[3] * pxPerUnit);
  const cells = [];
  for (const color of players) {
    for (const expr of exprs) for (let v = 0; v < 3; v++) cells.push({ name: `${color}/${expr}/${v}`, svg: svgWrap(VB.join(" "), cw, ch, characterG(color, expr, { variant: v })) });
    for (let v = 0; v < 2; v++) cells.push({ name: `${color}/busted/${v}`, svg: svgWrap(VB.join(" "), cw, ch, characterG(color, "shock", { variant: v, doubleLine: true, misreg: v === 0 })) });
  }
  out.pages.push(...(await pack("chars", cells, cw, ch)));
  out.meta.char = { cw, ch, anchorX: (12 - VB[0]) / VB[2], anchorY: (22.6 - VB[1]) / VB[3], unitPx: pxPerUnit };

  // ---- fx: bursts (3 variants), coins (3 variants), cut-paper confetti (white, tinted at runtime), light shapes
  const fx = [];
  const B = 120;
  for (const kind of ["exclaim", "sweat", "tears", "raincloud", "heart", "confetti"]) for (let v = 0; v < 3; v++) fx.push({ name: `burst/${kind}/${v}`, svg: svgWrap("-2 -2 52 52", B, B, burst(kind, v, INK)) });
  for (let v = 0; v < 3; v++) {
    const pts = handEllipse(24, 24, 18, 18, 300 + v * 7, 0.035);
    const inner = handEllipse(24, 24, 12.5, 12.5, 310 + v * 5, 0.05);
    const coin = el("path", { d: smoothPath(pts), fill: "#B36A12", transform: "translate(1.6 2.2)" }, "")
      + el("path", { d: smoothPath(pts), fill: "#FFC94D" }, "")
      + el("path", { d: inkRing(inner, 1.1, { contrast: 0.4 }), fill: "#C98418" }, "")
      + el("path", { d: smoothPath(wobble(sampleClosed("M24 15.5l2.6 5.4 5.9.7-4.4 4.1 1.2 5.9L24 28.7l-5.3 2.9 1.2-5.9-4.4-4.1 5.9-.7z", 0.3, 40), 0.18, 60 + v)), fill: "#B8730F" }, "")
      + el("path", { d: brush("M12 16Q15 10 21 9", 2.4, { seed: 50 + v }), fill: "#FFF1DC", opacity: 0.8 }, "")
      + el("path", { d: inkRing(pts, 1.5, { contrast: 0.35 }), fill: INK }, "");
    fx.push({ name: `coin/${v}`, svg: svgWrap("0 0 50 50", B, B, coin) });
  }
  const shapes = ["circle", "square", "star", "triangle", "crescent", "drop", "diamond", "plus"];
  for (const shape of shapes) {
    const r = rng(shape.length * 31);
    const pts = wobble(sampleClosed(BODY_PATHS[shape], 0.4, 40), 0.25, 5 + Math.floor(r() * 50));
    const piece = el("path", { d: poly(pts), fill: INK, opacity: 0.45, transform: "translate(1.1 1.3)" }, "") + el("path", { d: poly(pts), fill: "#FFFFFF" }, "");
    fx.push({ name: `confetti/${shape}`, svg: svgWrap("0 0 26 26", B, B, piece) });
  }
  // light (gradients only where there is light): a soft vertical sweep bar and a spotlight cone, white, tinted at runtime
  fx.push({ name: "light/sweep", svg: svgWrap("0 0 120 120", B, B, `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect x="30" width="60" height="120" fill="url(#g)"/>`) });
  fx.push({ name: "light/cone", svg: svgWrap("0 0 120 120", B, B, `<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="M48 0H72L120 120H0Z" fill="url(#c)"/>`) });
  fx.push({ name: "light/glow", svg: svgWrap("0 0 120 120", B, B, `<defs><radialGradient id="r"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="60" cy="60" r="60" fill="url(#r)"/>`) });
  out.pages.push(...(await pack("fx", fx, B, B)));
  out.meta.fx = { cell: B };

  // ---- the room plate (opaque), 1920 x 1080
  {
    const img = await svgToImage(hubRoom({ width: 1920 }));
    const canvas = document.createElement("canvas");
    canvas.width = 1920; canvas.height = 1080;
    canvas.getContext("2d").drawImage(img, 0, 0, 1920, 1080);
    out.room = await canvasToDataUrl(canvas, "image/webp", 0.86);
  }
  out.meta.players = players.map((id) => ({ id, hex: BY_ID[id].hex }));
  return out;
}

window.__bake = bake;
window.__bakeReady = true;
