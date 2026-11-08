// The normalized input of tools/gen-characters: plain data, independent of how lane A shapes the shared modules.
// load.ts fills it from shared/src/{characters,worlds,motion}; the Kotlin emitters (kotlin.ts) only read this.
//
// Sources (binding): JAMAA-PLATFORM §3.7 (characters), §3.4 (worlds), §3.8 (choreography); DESIGN-JAMAA §4.2
// (geometry, 24-unit body viewBox, 12 × 9 face space), §1.5 / §8 (world tokens), §6.4 / §8 (step lists, easings).

/** Face box in body units (DESIGN-JAMAA §4.2). */
export interface FaceBox { x: number; y: number; w: number; h: number }

/** One feature path of an expression, in the 12 × 9 face space. */
export interface Feature {
  /** Feature group, crossfaded as a unit (eyes, brows, mouth, cheeks, or an extra like the facepalm hand). */
  part: string;
  /** SVG path data. */
  d: string;
  style: "fill" | "stroke";
  /** Stroke width in face units (style "stroke" only). */
  strokeWidth?: number;
  /** Opacity 0..1 (cheeks: 0.35). Default 1. */
  alpha?: number;
}

export interface CharacterModel {
  /** Body viewBox side (24). */
  viewBox: number;
  faceSpace: { w: number; h: number };
  /** Every shape: body path (in the viewBox) and face box. */
  shapes: { shape: string; body: string; faceBox: FaceBox }[];
  /** The platform expressions, in declaration order (13). */
  expressions: { id: string; features: Feature[] }[];
  /** REACT mapping (§3.7): every reaction is an expression plus an icon burst. */
  reactions: { reaction: string; expression: string; burst: string }[];
}

/** DESIGN-JAMAA §8 token names (web `--world-*`, Compose `WorldColors`). `signal` is absent for night-market. */
export const WORLD_TOKENS = ["deep", "stageTop", "surface", "elevated", "accent", "accentText", "onAccent", "glow", "signal"] as const;
export type WorldToken = (typeof WORLD_TOKENS)[number];

/** One world's colours as `#RRGGBB`, per surface (the native TV keeps the night stage for night-market, §1.5). */
export interface WorldModel {
  id: string;
  web: Record<WorldToken, string | null>;
  native: Record<WorldToken, string | null>;
}

export type EasingDef =
  | { kind: "cubic"; x1: number; y1: number; x2: number; y2: number }
  /** Analytic damped spring from 0 to 1 (closed form; the step's durationMs is its fixed settle time). */
  | { kind: "spring"; dampingRatio: number; stiffness: number; mass: number };

export interface StepDef {
  id: string;
  startMs: number;
  durationMs: number;
  /** An id of ChoreoModel.easings (DESIGN §6.1 / DESIGN-JAMAA §8 token, e.g. `ease.decel`, `spring.bouncy`). */
  easing: string;
  staggerMs?: number;
  reduced: "fade" | "skip" | "keep";
  lite: "keep" | "drop";
}

export interface ChoreoModel {
  easings: Record<string, EasingDef>;
  /** Moment id (portal, entrance, pointsFlight, …) → its step list. */
  moments: Record<string, StepDef[]>;
}

export interface GenModel {
  characters: CharacterModel;
  worlds: WorldModel[];
  choreo: ChoreoModel;
}
