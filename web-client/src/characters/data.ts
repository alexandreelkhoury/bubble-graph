// JAMAA-PLATFORM §3.7 / DESIGN-JAMAA §4.2–§4.3: the 12 characters (body = the DESIGN §5.2 glyph in a 24-unit
// viewBox), their face boxes, and the 13 expressions as feature geometry in the 12 × 9 face space.
// JAMAA-GAP: lane A owns `shared/src/characters/` (geometry, expressions, reactions) and the `characters.json` fixture.
// They had not landed when lane B built P2; this module carries the DESIGN-JAMAA numbers verbatim with the spec's names
// so the import switches to `@jamaa/shared/characters` without touching the renderer. Zod-free, data only.

export const EXPRESSIONS = ["idle", "think", "done", "happy", "laugh", "smug", "shock", "sad", "facepalm", "shy", "point", "cheer", "away"] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export type ReactionKind = "laugh" | "shock" | "facepalm" | "happy" | "sad" | "cheer";
/** Every reaction IS an expression; each has an icon burst (§3.7). */
export const REACTION_BURST: Record<ReactionKind, string> = {
  laugh: "tears", shock: "exclaim", facepalm: "sweat", happy: "heart", sad: "raincloud", cheer: "confetti",
};

/** Face box per shape, in body units: {x, y, w, h} (DESIGN-JAMAA §4.2). */
export const FACE_BOX: Record<string, readonly [number, number, number, number]> = {
  circle: [6, 7.5, 12, 9], square: [6, 7.5, 12, 9], star: [8, 9, 8, 6], triangle: [7.5, 11.5, 9, 6.75],
  diamond: [7, 8, 10, 7.5], hexagon: [6.5, 7.5, 11, 8.25], plus: [8.5, 8.5, 7, 7], drop: [7, 11, 10, 7.5],
  crescent: [4, 9, 8, 6], bolt: [8.5, 9.5, 6, 4.5], flower: [7.5, 7.5, 9, 9], arch: [7, 8.5, 10, 7.5],
};

/** One feature: a stroked path (`s`), a filled path (`f`), or an ellipse [cx, cy, rx, ry] (`e`, filled). */
export type Feature = { s: string } | { f: string } | { e: readonly [number, number, number, number] };

const EYES: Feature[] = [{ e: [3.8, 3.6, 1.1, 1.45] }, { e: [8.2, 3.6, 1.1, 1.45] }];
const CLOSED: Feature[] = [{ s: "M2.8 3.6H4.8" }, { s: "M7.2 3.6H9.2" }];
const SMILE: Feature = { s: "M4.4 6.6Q6 7.6 7.6 6.6" };
const WIDE: Feature = { f: "M3.8 5.8H8.2A2.2 2.4 0 0 1 3.8 5.8Z" };
const star4 = (cx: number, cy: number): Feature => ({ f: `M${cx} ${cy - 1.6}L${cx + 0.45} ${cy - 0.45}L${cx + 1.6} ${cy}L${cx + 0.45} ${cy + 0.45}L${cx} ${cy + 1.6}L${cx - 0.45} ${cy + 0.45}L${cx - 1.6} ${cy}L${cx - 0.45} ${cy - 0.45}Z` });

/** The features of each expression (DESIGN-JAMAA §4.3). Eyes that blink carry the class `ch__eye` in the renderer. */
export const FEATURES: Record<Expression, readonly Feature[]> = {
  idle: [...EYES, SMILE],
  think: [{ e: [4.7, 2.8, 1.1, 1.45] }, { e: [9.1, 2.8, 1.1, 1.45] }, { s: "M7.4 0.9L9.6 0.5" }, { s: "M5.4 6.8H7.8" }],
  done: [{ s: "M2.7 3.8Q3.8 2.8 4.9 3.8" }, { s: "M7.1 3.8Q8.2 2.8 9.3 3.8" }, { s: "M4.8 6.6Q6 7.4 7.2 6.6" }],
  happy: [{ s: "M2.7 4.2Q3.8 2.6 4.9 4.2" }, { s: "M7.1 4.2Q8.2 2.6 9.3 4.2" }, { f: "M4.2 6H7.8A1.8 1.8 0 0 1 4.2 6Z" }],
  laugh: [{ s: "M3 2.9L4.4 3.6L3 4.3" }, { s: "M9 2.9L7.6 3.6L9 4.3" }, WIDE],
  smug: [{ f: "M2.7 3.2H4.9A1.1 1.1 0 0 1 2.7 3.2Z" }, { f: "M7.1 3.2H9.3A1.1 1.1 0 0 1 7.1 3.2Z" }, { s: "M2.7 1.6H4.9" }, { s: "M7.1 1.2L9.3 0.6" }, { s: "M4.6 6.8Q6.8 7.4 7.8 6" }],
  shock: [{ e: [3.8, 3.6, 0.5, 0.5] }, { e: [8.2, 3.6, 0.5, 0.5] }, { s: "M3.8 2.2a1.4 1.4 0 1 0 0.01 0Z" }, { s: "M8.2 2.2a1.4 1.4 0 1 0 0.01 0Z" }, { s: "M2.8 0.6H4.8" }, { s: "M7.2 0.6H9.2" }, { e: [6, 6.9, 0.7, 0.9] }],
  sad: [{ f: "M2.7 3.4L4.9 3A1.1 1.2 0 0 1 2.7 3.4Z" }, { f: "M7.1 3L9.3 3.4A1.1 1.2 0 0 1 7.1 3Z" }, { s: "M2.8 1.9L4.6 1.2" }, { s: "M9.2 1.9L7.4 1.2" }, { s: "M4.4 7.4Q6 6.4 7.6 7.4" }],
  facepalm: [...CLOSED, { s: "M4.8 6.8H7.2" }],
  shy: [{ e: [3.8, 4.4, 1.1, 1.45] }, { e: [8.2, 4.4, 1.1, 1.45] }, { s: "M5.2 6.9Q6 7.4 6.8 6.9" }],
  point: [{ e: [4.8, 3.6, 1.1, 1.45] }, { e: [9.2, 3.6, 1.1, 1.45] }, { f: "M4.6 6.4H7.4A1.4 1 0 0 1 4.6 6.4Z" }],
  cheer: [star4(3.8, 3.6), star4(8.2, 3.6), WIDE],
  away: [...CLOSED, { s: "M5.2 6.8H6.8" }],
};

/** Expressions whose cheeks are on (shy: rose). */
export const CHEEKS: ReadonlySet<Expression> = new Set(["shy", "happy", "laugh", "cheer"]);
/** Expressions drawn with the eye highlight dot (open ink eyes). */
export const HIGHLIGHT: ReadonlySet<Expression> = new Set(["idle", "think", "shy", "point"]);
/** Below 64 px features scale ×1.5 (×1.8 for the small bolt/star faces) so the eyes stay ≥ 2.4 dp (§3.7). */
export function featureScale(sizePx: number, shape: string): number {
  if (sizePx >= 64) return 1;
  return shape === "bolt" || shape === "star" ? 1.8 : 1.5;
}
