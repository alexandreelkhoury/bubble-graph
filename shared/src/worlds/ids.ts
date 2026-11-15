// JAMAA-PLATFORM §3.4: one world per game. Zod-free. The palettes live in ./palettes.ts (P2).
export const WORLD_IDS = ["night-market", "hakawati-cafe", "rooftop", "quiz-studio", "observatory"] as const;
export type WorldId = (typeof WORLD_IDS)[number];
