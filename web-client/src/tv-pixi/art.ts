// The characters on the Pixi TV: the same shared drawing data as components/Character.tsx (body glyph + expression
// features), written as one standalone SVG string per (colour, expression), rasterised once into a texture and cached.
// A texture covers the 30 × 32 viewBox; sprites are placed by their feet (anchor bottom-centre).
import { Texture } from "pixi.js";
import { COLORS } from "@jamaa/shared/constants";
import type { ColorId } from "@jamaa/shared/constants";
import {
  BODY_PATHS, EXPRESSION_EXTRAS, EXPRESSION_FEATURES, EYE_HIGHLIGHT, FACE_BOXES, FACE_SPACE, SHY_CHEEK_HEX, featureScale,
} from "@jamaa/shared/characters";
import type { Expression } from "@jamaa/shared/characters";

const CREAM = "#FFF7EC";
const INK = "#120A1F";
const RINGED: ReadonlySet<string> = new Set(["coral", "grape", "plum"]);
const BODY_W = 18;
const EYE_OFFSET: Partial<Record<Expression, readonly [number, number]>> = { think: [0.9, -0.8], shy: [0, 0.8], point: [1, 0] };
/** Texture pixels per viewBox unit (a 120 dp character on a 1080p screen is ~7.5 px per unit). */
const PX = 8;
export const CHAR_ASPECT = 30 / 32;

export function charSvg(color: ColorId, expression: Expression): string {
  const c = COLORS.find((x) => x.id === color) ?? COLORS[0];
  const shape = c.shape;
  const fb = FACE_BOXES[shape];
  const ink = c.glyph === "ink" ? INK : CREAM;
  const k = (fb.w / FACE_SPACE.w) * featureScale(120, shape);
  const cx = fb.x + fb.w / 2, cy = fb.y + fb.h / 2;
  const extra = EXPRESSION_EXTRAS[expression];
  const [ex, ey] = EYE_OFFSET[expression] ?? [0, 0];
  const eyeY = cy + (3.6 - FACE_SPACE.h / 2) * k;
  const feats = EXPRESSION_FEATURES[expression].map((f) => {
    const cheek = f.part === "cheeks";
    const col = cheek ? (expression === "shy" ? SHY_CHEEK_HEX : ink === INK ? CREAM : INK) : ink;
    const op = cheek ? (expression === "shy" ? f.alpha ?? 0.6 : ink === INK ? f.alpha ?? 0.35 : 0.25) : f.alpha;
    const o = op === undefined ? "" : ` opacity="${op}"`;
    return f.style === "stroke"
      ? `<path d="${f.d}" fill="none" stroke="${col}" stroke-width="${f.strokeWidth ?? 0.8}" stroke-linecap="round" stroke-linejoin="round"${o}/>`
      : `<path d="${f.d}" fill="${col}"${o}/>`;
  }).join("");
  const hi = EYE_HIGHLIGHT.includes(expression) && ink === INK
    ? `<g fill="${CREAM}"><circle cx="${3.8 + ex + 0.35}" cy="${3.6 + ey - 0.45}" r="0.35"/><circle cx="${8.2 + ex + 0.35}" cy="${3.6 + ey - 0.45}" r="0.35"/></g>` : "";
  const nub = extra === "nub" ? `<rect x="12" y="12.6" width="${9 + 0.2 * BODY_W}" height="2.8" rx="1.4" fill="${c.hex}"/>` : "";
  const hand = extra === "hand" ? `<circle cx="${cx}" cy="${eyeY}" r="${0.28 * BODY_W}" fill="${c.hex}" stroke="${ink}" stroke-width="1"/>` : "";
  const zzz = extra === "zzz" ? `<text x="19" y="2" fill="${CREAM}" font-size="5" font-weight="700" font-family="sans-serif">z</text>` : "";
  const check = extra === "check"
    ? `<circle cx="21" cy="3" r="3.2" fill="#3DDC97"/><path d="M19.4 3.1l1.1 1.1 2.2-2.3" fill="none" stroke="${INK}" stroke-width=".9" stroke-linecap="round"/>` : "";
  const ring = RINGED.has(color) ? ` stroke="rgba(255,247,236,.24)" stroke-width="1" stroke-linejoin="round"` : "";
  const face = `translate(${cx} ${cy}) scale(${k}) translate(${-FACE_SPACE.w / 2} ${-FACE_SPACE.h / 2})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -5 30 32" width="${30 * PX}" height="${32 * PX}">`
    + `<ellipse cx="12" cy="25" rx="7.5" ry="1.3" fill="rgba(0,0,0,.28)"/>${nub}`
    + `<path d="${BODY_PATHS[shape]}" fill="${c.hex}"${ring}/><g transform="${face}">${feats}${hi}</g>${hand}${zzz}${check}</svg>`;
}

const cache = new Map<string, Texture>();
const waiting = new Map<string, ((t: Texture) => void)[]>();

/** The texture for a character now (an empty one until the SVG decodes: `onReady` swaps the real one in). */
export function charTexture(color: ColorId, expression: Expression, onReady?: (t: Texture) => void): Texture {
  const key = `${color}/${expression}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const list = waiting.get(key);
  if (list) { if (onReady) list.push(onReady); return Texture.EMPTY; }
  waiting.set(key, onReady ? [onReady] : []);
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas");
    cv.width = 30 * PX; cv.height = 32 * PX;
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    const tex = Texture.from(cv);
    tex.source.autoGenerateMipmaps = true;
    cache.set(key, tex);
    for (const f of waiting.get(key) ?? []) f(tex);
    waiting.delete(key);
  };
  img.onerror = () => { waiting.delete(key); };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(charSvg(color, expression))}`;
  return Texture.EMPTY;
}
