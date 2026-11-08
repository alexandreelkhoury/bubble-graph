// JAMAA-PLATFORM §3.7 / DESIGN-JAMAA §4.2: the 12 characters' bodies and face boxes. Zod-free, data only. Consumed by
// the web renderer and by tools/gen-characters (CharacterPaths.kt); shared/fixtures/v2/characters.json pins the numbers.
import type { COLORS } from "../constants";

/** The 12 body shapes, one per player colour (constants COLORS). */
export type Shape = (typeof COLORS)[number]["shape"];

/** Body viewBox side: every body path lives in a 24 × 24 box (the DESIGN §5.2 glyph). */
export const CHARACTER_VIEWBOX = 24;
/** Features are designed in a 12 × 9 face space and scaled uniformly by `faceBox.w / FACE_SPACE.w`. */
export const FACE_SPACE = { w: 12, h: 9 } as const;

const circle = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/**
 * The DESIGN §5.2 glyphs as ONE SVG path each (filled, nonzero). The circle, the rounded square and the flower's
 * five discs are written as arcs so every renderer (SVG `d`, Compose `PathParser`) gets the same geometry.
 * JAMAA-GAP: the flower is five overlapping sub-paths; an outside stroke (the 24 % cream ring of coral/grape/plum)
 * never applies to it (sand), so the overlaps are never stroked.
 */
export const BODY_PATHS: { readonly [S in Shape]: string } = {
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
  flower: [circle(12, 7.4, 4.6), circle(16.6, 12, 4.6), circle(12, 16.6, 4.6), circle(7.4, 12, 4.6), circle(12, 12, 4)].join(""),
  arch: "M5 20.75V10.25a7 7 0 0 1 14 0v10.5h-4.5v-6.5a2.5 2.5 0 0 0-5 0v6.5z",
};

export interface FaceBox { x: number; y: number; w: number; h: number }
const box = (x: number, y: number, w: number, h: number): FaceBox => ({ x, y, w, h });

/** Face box per shape, in body units (DESIGN-JAMAA §4.2 table). */
export const FACE_BOXES: { readonly [S in Shape]: FaceBox } = {
  circle: box(6, 7.5, 12, 9), square: box(6, 7.5, 12, 9), star: box(8, 9, 8, 6), triangle: box(7.5, 11.5, 9, 6.75),
  diamond: box(7, 8, 10, 7.5), hexagon: box(6.5, 7.5, 11, 8.25), plus: box(8.5, 8.5, 7, 7), drop: box(7, 11, 10, 7.5),
  crescent: box(4, 9, 8, 6), bolt: box(8.5, 9.5, 6, 4.5), flower: box(7.5, 7.5, 9, 9), arch: box(7, 8.5, 10, 7.5),
};

/** Faces are drawn only at ≥ 40 dp/px; below 64 features scale ×1.5 (×1.8 = 1.5 × 1.2 for the bolt and star faces). */
export const FACE_MIN_SIZE = 40;
export function featureScale(sizePx: number, shape: Shape): number {
  if (sizePx >= 64) return 1;
  return shape === "bolt" || shape === "star" ? 1.8 : 1.5;
}
