// JAMAA-PLATFORM §3.4 / DESIGN-JAMAA §1.5, §8: the world tokens of each game. Zod-free, data only. Consumed by the web
// (`--world-*` on `[data-world]`) and by tools/gen-characters (WorldColors.kt). Each G lane edits ONLY its own world's
// entry; the structure is fixed in P. A value is one colour for both surfaces, or `{ web, native }` where the native TV
// keeps its night stage (night-market, until palette B is checked on the owner's TV: DESIGN-JAMAA §1.5).
import type { WorldId } from "./ids";

export const WORLD_TOKENS = ["deep", "stageTop", "surface", "elevated", "accent", "accentText", "onAccent", "glow", "signal"] as const;
export type WorldToken = (typeof WORLD_TOKENS)[number];
export type WorldColor = string | { web: string; native: string };
export type WorldPalette = { readonly [T in WorldToken]: T extends "signal" ? WorldColor | null : WorldColor };

export const WORLD_PALETTES: { readonly [W in WorldId]: WorldPalette } = {
  // Mish Ana!: the existing stage. Web = palette B (DESIGN §2.1: --color-bg / bg-top / surface / elevated / primary /
  // primary-text / accent); native = the night palette of JamaaColors (Bg, BgGlow, Surface, Elevated, Primary, Accent).
  // JAMAA-GAP: the native TV has no `bgTop` token; its stage gradient top is BgGlow #2A0F3D (lane D uses the same).
  "night-market": {
    deep: { web: "#1D1036", native: "#120A1F" },
    stageTop: { web: "#2B1650", native: "#2A0F3D" },
    surface: { web: "#3A2266", native: "#1E1430" },
    elevated: { web: "#4A2E7A", native: "#2A1D42" },
    accent: { web: "#FF4F9A", native: "#FF3D8B" },
    accentText: "#FF7AB3",
    onAccent: "#120A1F",
    glow: { web: "#FFC94D", native: "#FFC23D" },
    signal: null,
  },
  // Bluff (owned by the G2 lane A).
  "hakawati-cafe": {
    deep: "#1C1209", stageTop: "#2E1D0E", surface: "#33230F", elevated: "#4A3418",
    accent: "#E9A23B", accentText: "#E9A23B", onAccent: "#120A1F", glow: "#FFE3A3", signal: "#FF5A5F",
  },
  // Most Likely (owned by the G3 lane A).
  rooftop: {
    deep: "#071A24", stageTop: "#0E2C3B", surface: "#0F2E3D", elevated: "#17404F",
    accent: "#29D3C2", accentText: "#29D3C2", onAccent: "#120A1F", glow: "#B8FFF6", signal: "#FFC94D",
  },
  // Trivia (owned by the G4 lane A).
  "quiz-studio": {
    deep: "#0A0F2E", stageTop: "#141C52", surface: "#161D4A", elevated: "#222B63",
    accent: "#5B7CFF", accentText: "#8FA8FF", onAccent: "#120A1F", glow: "#FFD84D", signal: "#3DDC97",
  },
};

/** One token for one surface (`null` only for a world without a signal colour). */
export function worldColor(world: WorldId, token: WorldToken, surface: "web" | "native"): string | null {
  const v = WORLD_PALETTES[world][token];
  if (v === null) return null;
  return typeof v === "string" ? v : v[surface];
}
