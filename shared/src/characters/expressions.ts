// JAMAA-PLATFORM §3.7 / DESIGN-JAMAA §4.3: the 13 expressions as feature geometry in the 12 × 9 face space (origin top
// left). Zod-free, data only. Colour = the glyph colour (ink on light bodies, cream on grape and plum) unless noted.
// Each feature belongs to a `part` (eyes, brows, mouth, cheeks); renderers crossfade parts in 120 ms on a change.
// JAMAA-GAP: two DESIGN-JAMAA §4.3 elements are body-relative, not face-space features, and are drawn by the renderer
// from these flags: the facepalm "hand" disc (r = 0.28 × body width, body colour, glyph-colour outline) and the
// `point` nub (0.2 × body, toward the target). The eye highlight dot (r 0.35 cream at +0.35, −0.45 of each eye) is drawn
// only on ink eyes of the expressions in EYE_HIGHLIGHT, because it depends on the body's glyph colour.

export const EXPRESSIONS = ["idle", "think", "done", "happy", "laugh", "smug", "shock", "sad", "facepalm", "shy", "point", "cheer", "away"] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export interface Feature {
  part: "eyes" | "brows" | "mouth" | "cheeks";
  d: string;
  style: "fill" | "stroke";
  /** Face units; strokes only (default 0.8 for mouths and eye arcs, 0.7 for brows, DESIGN-JAMAA §4.2). */
  strokeWidth?: number;
  /** 0..1 (cheeks); default 1. */
  alpha?: number;
}

const ellipse = (cx: number, cy: number, rx: number, ry: number): string => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const eyesAt = (dx = 0, dy = 0): Feature => ({ part: "eyes", d: ellipse(3.8 + dx, 3.6 + dy, 1.1, 1.45) + ellipse(8.2 + dx, 3.6 + dy, 1.1, 1.45), style: "fill" });
const stroke = (part: Feature["part"], d: string, strokeWidth = part === "brows" ? 0.7 : 0.8): Feature => ({ part, d, style: "stroke", strokeWidth });
const fill = (part: Feature["part"], d: string): Feature => ({ part, d, style: "fill" });
const CLOSED = stroke("eyes", "M2.8 3.6H4.8M7.2 3.6H9.2");
const WIDE = fill("mouth", "M3.8 5.8H8.2A2.2 2.4 0 0 1 3.8 5.8Z");
const cheeks = (alpha: number): Feature => ({ part: "cheeks", d: ellipse(2.2, 5.8, 0.9, 0.9) + ellipse(9.8, 5.8, 0.9, 0.9), style: "fill", alpha });
const star4 = (cx: number, cy: number): string =>
  `M${cx} ${cy - 1.6}L${cx + 0.45} ${cy - 0.45}L${cx + 1.6} ${cy}L${cx + 0.45} ${cy + 0.45}L${cx} ${cy + 1.6}L${cx - 0.45} ${cy + 0.45}L${cx - 1.6} ${cy}L${cx - 0.45} ${cy - 0.45}Z`;

/** The features of each expression, back to front. */
export const EXPRESSION_FEATURES: { readonly [E in Expression]: readonly Feature[] } = {
  idle: [eyesAt(), stroke("mouth", "M4.4 6.6Q6 7.6 7.6 6.6")],
  think: [eyesAt(0.9, -0.8), stroke("brows", "M7.4 0.9L9.6 0.5"), stroke("mouth", "M5.4 6.8H7.8")],
  done: [stroke("eyes", "M2.7 3.8Q3.8 2.8 4.9 3.8M7.1 3.8Q8.2 2.8 9.3 3.8"), stroke("mouth", "M4.8 6.6Q6 7.4 7.2 6.6")],
  happy: [stroke("eyes", "M2.7 4.2Q3.8 2.6 4.9 4.2M7.1 4.2Q8.2 2.6 9.3 4.2"), fill("mouth", "M4.2 6H7.8A1.8 1.8 0 0 1 4.2 6Z"), cheeks(0.35)],
  laugh: [stroke("eyes", "M3 2.9L4.4 3.6L3 4.3M9 2.9L7.6 3.6L9 4.3"), WIDE, cheeks(0.35)],
  smug: [
    fill("eyes", "M2.7 3.2H4.9A1.1 1.1 0 0 1 2.7 3.2ZM7.1 3.2H9.3A1.1 1.1 0 0 1 7.1 3.2Z"),
    stroke("brows", "M2.7 1.6H4.9M7.1 1.2L9.3 0.6"),
    stroke("mouth", "M4.6 6.8Q6.8 7.4 7.8 6"),
  ],
  shock: [
    stroke("eyes", ellipse(3.8, 3.6, 1.4, 1.4) + ellipse(8.2, 3.6, 1.4, 1.4)),
    fill("eyes", ellipse(3.8, 3.6, 0.5, 0.5) + ellipse(8.2, 3.6, 0.5, 0.5)),
    stroke("brows", "M2.8 0.6H4.8M7.2 0.6H9.2"),
    fill("mouth", ellipse(6, 6.9, 0.7, 0.9)),
  ],
  sad: [
    fill("eyes", "M2.7 3.4L4.9 3A1.1 1.2 0 0 1 2.7 3.4ZM7.1 3L9.3 3.4A1.1 1.2 0 0 1 7.1 3Z"),
    stroke("brows", "M2.8 1.9L4.6 1.2M9.2 1.9L7.4 1.2"),
    stroke("mouth", "M4.4 7.4Q6 6.4 7.6 7.4"),
  ],
  facepalm: [CLOSED, stroke("mouth", "M4.8 6.8H7.2")],
  shy: [eyesAt(0, 0.8), stroke("mouth", "M5.2 6.9Q6 7.4 6.8 6.9"), cheeks(0.6)],
  point: [eyesAt(1, 0), fill("mouth", "M4.6 6.4H7.4A1.4 1 0 0 1 4.6 6.4Z")],
  cheer: [fill("eyes", star4(3.8, 3.6) + star4(8.2, 3.6)), WIDE, cheeks(0.35)],
  away: [CLOSED, stroke("mouth", "M5.2 6.8H6.8")],
};

/** Expressions drawn with the eye highlight dot on ink eyes (open ellipse eyes). */
export const EYE_HIGHLIGHT: readonly Expression[] = ["idle", "think", "shy", "point"];
/** Cheek colour: cream at 35 % on ink-eyed bodies (ink at 25 % on cream-eyed ones); `shy` uses rose `#FF96C5` at 60 %. */
export const SHY_CHEEK_HEX = "#FF96C5";
/** The look offset limit, face units (§3.7: eyes may move up to 1.2 units toward a target). */
export const LOOK_MAX = 1.2;
/** Body-relative extras the renderer draws (see the JAMAA-GAP above). */
export const EXPRESSION_EXTRAS: { readonly [E in Expression]?: "hand" | "nub" | "check" | "zzz" } = { facepalm: "hand", point: "nub", done: "check", away: "zzz" };
/** Crossfade between expressions, and how long a reaction is held before `idle` (§3.7, DESIGN-JAMAA §4.3). */
export const EXPRESSION_CROSSFADE_MS = 120;
