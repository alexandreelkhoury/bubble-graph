// A test model transcribed from the binding docs (DESIGN-JAMAA §4.2 face boxes and features, §1.5 world tokens, §3
// timelines; DESIGN §6.1 easings), so the emitters are tested before lane A's modules exist. Body paths are simple
// stand-ins: the real ones come from shared/src/characters.
import type { GenModel, WorldModel, WorldToken } from "../src/model";

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const FACE_BOXES: Record<string, ReturnType<typeof box>> = {
  circle: box(6, 7.5, 12, 9), square: box(6, 7.5, 12, 9), star: box(8, 9, 8, 6), triangle: box(7.5, 11.5, 9, 6.75),
  diamond: box(7, 8, 10, 7.5), hexagon: box(6.5, 7.5, 11, 8.25), plus: box(8.5, 8.5, 7, 7), drop: box(7, 11, 10, 7.5),
  crescent: box(4, 9, 8, 6), bolt: box(8.5, 9.5, 6, 4.5), flower: box(7.5, 7.5, 9, 9), arch: box(7, 8.5, 10, 7.5),
};

const EYES = { part: "eyes", d: "M2.7 3.6a1.1 1.45 0 1 0 2.2 0a1.1 1.45 0 1 0 -2.2 0M7.1 3.6a1.1 1.45 0 1 0 2.2 0a1.1 1.45 0 1 0 -2.2 0", style: "fill" as const };
const SMILE = { part: "mouth", d: "M4.4 6.6 Q6 7.6 7.6 6.6", style: "stroke" as const, strokeWidth: 0.8 };

const palette = (v: Partial<Record<WorldToken, string | null>>): Record<WorldToken, string | null> => ({
  deep: null, stageTop: null, surface: null, elevated: null, accent: null, accentText: null, onAccent: null, glow: null, signal: null, ...v,
});
const same = (id: string, p: Record<WorldToken, string | null>): WorldModel => ({ id, web: p, native: p });

export const SPEC_WORLDS: WorldModel[] = [
  {
    id: "night-market",
    web: palette({ deep: "#1D1036", stageTop: "#2B1650", surface: "#3A2266", elevated: "#4A2E7A", accent: "#FF4F9A", accentText: "#FF7AB3", onAccent: "#120A1F", glow: "#FFC94D" }),
    native: palette({ deep: "#120A1F", stageTop: "#2A0F3D", surface: "#1E1430", elevated: "#2A1D42", accent: "#FF3D8B", accentText: "#FF7AB3", onAccent: "#120A1F", glow: "#FFC23D" }),
  },
  same("hakawati-cafe", palette({ deep: "#1C1209", stageTop: "#2E1D0E", surface: "#33230F", elevated: "#4A3418", accent: "#E9A23B", accentText: "#E9A23B", onAccent: "#120A1F", glow: "#FFE3A3", signal: "#FF5A5F" })),
  same("rooftop", palette({ deep: "#071A24", stageTop: "#0E2C3B", surface: "#0F2E3D", elevated: "#17404F", accent: "#29D3C2", accentText: "#29D3C2", onAccent: "#120A1F", glow: "#B8FFF6", signal: "#FFC94D" })),
  same("quiz-studio", palette({ deep: "#0A0F2E", stageTop: "#141C52", surface: "#161D4A", elevated: "#222B63", accent: "#5B7CFF", accentText: "#8FA8FF", onAccent: "#120A1F", glow: "#FFD84D", signal: "#3DDC97" })),
];

export const SPEC_MODEL: GenModel = {
  characters: {
    viewBox: 24,
    faceSpace: { w: 12, h: 9 },
    shapes: Object.entries(FACE_BOXES).map(([shape, faceBox]) => ({ shape, body: "M2 2H22V22H2Z", faceBox })),
    expressions: [
      { id: "idle", features: [EYES, SMILE] },
      { id: "happy", features: [{ part: "eyes", d: "M2.7 4.2 Q3.8 2.6 4.9 4.2M7.1 4.2 Q8.2 2.6 9.3 4.2", style: "stroke", strokeWidth: 0.8 }, { part: "mouth", d: "M4.2 6.2h3.6a1.8 1.8 0 0 1 -3.6 0Z", style: "fill" }] },
      { id: "shy", features: [EYES, { part: "mouth", d: "M5.2 6.6 Q6 7.2 6.8 6.6", style: "stroke", strokeWidth: 0.8 }, { part: "cheeks", d: "M1.3 5.8a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0 -1.8 0", style: "fill", alpha: 0.6 }] },
    ],
    reactions: [
      { reaction: "laugh", expression: "happy", burst: "burst.tears" },
      { reaction: "happy", expression: "happy", burst: "burst.heart" },
    ],
  },
  worlds: SPEC_WORLDS,
  choreo: {
    easings: {
      "ease.standard": { kind: "cubic", x1: 0.2, y1: 0, x2: 0, y2: 1 },
      "ease.decel": { kind: "cubic", x1: 0.05, y1: 0.7, x2: 0.1, y2: 1 },
      "ease.accel": { kind: "cubic", x1: 0.3, y1: 0, x2: 0.8, y2: 0.15 },
      "ease.overshoot": { kind: "cubic", x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
      "ease.coin": { kind: "cubic", x1: 0.4, y1: -0.15, x2: 0.2, y2: 1 },
      "ease.door": { kind: "cubic", x1: 0.6, y1: 0, x2: 0.15, y2: 1 },
      "spring.hop": { kind: "spring", dampingRatio: 0.5, stiffness: 500, mass: 1 },
      "spring.bouncy": { kind: "spring", dampingRatio: 0.55, stiffness: 400, mass: 1 },
    },
    moments: {
      // DESIGN-JAMAA §3.1 (first open, 1 100 ms).
      portal: [
        { id: "press", startMs: 0, durationMs: 120, easing: "ease.standard", reduced: "skip", lite: "keep" },
        { id: "othersOut", startMs: 0, durationMs: 240, easing: "ease.accel", reduced: "fade", lite: "keep" },
        { id: "arch", startMs: 120, durationMs: 580, easing: "ease.decel", reduced: "fade", lite: "keep" },
        { id: "title", startMs: 800, durationMs: 200, easing: "ease.overshoot", reduced: "fade", lite: "keep" },
        { id: "panes", startMs: 900, durationMs: 80, easing: "ease.decel", staggerMs: 60, reduced: "fade", lite: "keep" },
      ],
      // DESIGN-JAMAA §3.2 (characters land with spring.bouncy, 40 ms stagger).
      entrance: [{ id: "runIn", startMs: 1100, durationMs: 700, easing: "spring.bouncy", staggerMs: 40, reduced: "skip", lite: "keep" }],
    },
  },
};
